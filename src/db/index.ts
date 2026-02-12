import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { pino } from 'pino';

const logger = pino({ level: config.logLevel });

export const pool = new Pool({
    connectionString: config.databaseUrl,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'hospital_capacity',
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432
});

pool.on('error', (err) => {
    logger.error(err, 'Unexpected error on idle client');
    process.exit(-1);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = async (text: string, params?: any[]) => {
    // const start = Date.now();
    const res = await pool.query(text, params);
    // const duration = Date.now() - start;
    // logger.debug({ text, duration, rows: res.rowCount }, 'Executed query');
    return res;
};

// Generic query interface compatible with Pool and PoolClient
export interface Queryable {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query(text: string, params?: any[]): Promise<any>;
}

export const withTransaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const closeDb = async () => {
    await pool.end();
};
