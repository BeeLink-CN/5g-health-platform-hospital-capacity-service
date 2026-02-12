import fs from 'fs';
import path from 'path';
import { pool } from './index';
import { pino } from 'pino';
import { config } from '../config';

const logger = pino({ level: config.logLevel });

export const runMigrations = async () => {
    const client = await pool.connect();
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

        const migrationsDir = path.resolve(process.cwd(), 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            logger.warn('No migrations directory found.');
            return;
        }

        const files = fs.readdirSync(migrationsDir).sort();

        const { rows: executed } = await client.query('SELECT name FROM migrations');
        const executedNames = new Set(executed.map(r => r.name));

        for (const file of files) {
            if (!executedNames.has(file) && file.endsWith('.sql')) {
                logger.info(`Running migration: ${file}`);
                const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
                await client.query(content);
                await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            }
        }

        await client.query('COMMIT');
        logger.info('Migrations completed.');
    } catch (err) {
        await client.query('ROLLBACK');
        logger.error(err, 'Migration failed');
        throw err;
    } finally {
        client.release();
    }
};

if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
