"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDb = exports.withTransaction = exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const config_1 = require("../config");
const pino_1 = require("pino");
const logger = (0, pino_1.pino)({ level: config_1.config.logLevel });
exports.pool = new pg_1.Pool({
    connectionString: config_1.config.databaseUrl,
});
exports.pool.on('error', (err) => {
    logger.error(err, 'Unexpected error on idle client');
    process.exit(-1);
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = async (text, params) => {
    // const start = Date.now();
    const res = await exports.pool.query(text, params);
    // const duration = Date.now() - start;
    // logger.debug({ text, duration, rows: res.rowCount }, 'Executed query');
    return res;
};
exports.query = query;
const withTransaction = async (callback) => {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};
exports.withTransaction = withTransaction;
const closeDb = async () => {
    await exports.pool.end();
};
exports.closeDb = closeDb;
