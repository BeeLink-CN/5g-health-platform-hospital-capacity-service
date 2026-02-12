"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.loadSchemas = void 0;
const _2020_1 = __importDefault(require("ajv/dist/2020"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const pino_1 = require("pino");
const logger = (0, pino_1.pino)({ level: config_1.config.logLevel });
const ajv = new _2020_1.default({
    strict: false,
    allErrors: true
});
(0, ajv_formats_1.default)(ajv);
const loadedSchemaIds = new Set();
const loadedSchemaHashes = new Set();
const loadSchemas = () => {
    // 1. Load from CONTRACTS_PATH
    loadRecursively(config_1.config.contractsPath);
    // 2. Fallback to local contracts dir if distinctive
    const localContracts = path_1.default.resolve(process.cwd(), 'contracts');
    if (path_1.default.resolve(config_1.config.contractsPath) !== localContracts) {
        loadRecursively(localContracts);
    }
};
exports.loadSchemas = loadSchemas;
const loadRecursively = (dir) => {
    if (!fs_1.default.existsSync(dir))
        return;
    const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path_1.default.join(dir, entry.name);
        if (entry.isDirectory()) {
            loadRecursively(fullPath);
        }
        else if (entry.isFile() && entry.name.endsWith('.json')) {
            try {
                const content = fs_1.default.readFileSync(fullPath, 'utf-8');
                const hash = crypto_1.default.createHash('sha256').update(content).digest('hex');
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
            }
            catch (err) {
                logger.error({ err, file: fullPath }, 'Failed to load schema');
            }
        }
    }
};
const validate = (schemaId, data) => {
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
exports.validate = validate;
