import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';
import { pino } from 'pino';

const logger = pino({ level: config.logLevel });

const ajv = new Ajv({
    strict: false,
    allErrors: true
});
addFormats(ajv);

const loadedSchemaIds = new Set<string>();
const loadedSchemaHashes = new Set<string>();

export const loadSchemas = () => {
    // 1. Load from CONTRACTS_PATH
    loadRecursively(config.contractsPath);

    // 2. Fallback to local contracts dir if distinctive
    const localContracts = path.resolve(process.cwd(), 'contracts');
    if (path.resolve(config.contractsPath) !== localContracts) {
        loadRecursively(localContracts);
    }
};

const loadRecursively = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            loadRecursively(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const hash = crypto.createHash('sha256').update(content).digest('hex');

                if (loadedSchemaHashes.has(hash)) {
                    // Duplicate content, skip silently or log debug
                    continue;
                }

                const schema = JSON.parse(content);
                if (schema.$id) {
                    if (loadedSchemaIds.has(schema.$id)) {
                        // ID collision but different content (since hash check passed first)
                        // This is tricky. Ajv will throw. We should skip.
                        logger.warn({ id: schema.$id, file: fullPath }, 'Skipping duplicate schema ID');
                        continue;
                    }

                    ajv.addSchema(schema);
                    loadedSchemaIds.add(schema.$id);
                    loadedSchemaHashes.add(hash);
                    logger.info({ id: schema.$id }, 'Loaded schema');
                }
            } catch (err) {
                logger.error({ err, file: fullPath }, 'Failed to load schema');
            }
        }
    }
};

export const validate = (schemaId: string, data: any) => {
    const validateFn = ajv.getSchema(schemaId);
    if (!validateFn) {
        throw new Error(`Schema ${schemaId} not found`);
    }
    const valid = validateFn(data);
    if (!valid) {
        return validateFn.errors;
    }
    return null;
};
