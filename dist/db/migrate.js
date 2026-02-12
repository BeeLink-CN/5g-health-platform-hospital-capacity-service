"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("./index");
const pino_1 = require("pino");
const config_1 = require("../config");
const logger = (0, pino_1.pino)({ level: config_1.config.logLevel });
const runMigrations = async () => {
    const client = await index_1.pool.connect();
    try {
        logger.info('Running migrations...');
        await client.query('BEGIN');
        // Create migrations table if not exists
        await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        run_at TIMESTAMP DEFAULT NOW()
      );
    `);
        const migrationsDir = path_1.default.resolve(process.cwd(), 'migrations');
        if (!fs_1.default.existsSync(migrationsDir)) {
            logger.warn('No migrations directory found.');
            return;
        }
        const files = fs_1.default.readdirSync(migrationsDir).sort();
        const { rows: executed } = await client.query('SELECT name FROM migrations');
        const executedNames = new Set(executed.map(r => r.name));
        for (const file of files) {
            if (!executedNames.has(file) && file.endsWith('.sql')) {
                logger.info(`Running migration: ${file}`);
                const content = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf-8');
                await client.query(content);
                await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            }
        }
        await client.query('COMMIT');
        logger.info('Migrations completed.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        logger.error(err, 'Migration failed');
        throw err;
    }
    finally {
        client.release();
    }
};
exports.runMigrations = runMigrations;
if (require.main === module) {
    (0, exports.runMigrations)()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
