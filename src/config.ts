import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    port: parseInt(process.env.SERVICE_PORT || '8093', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/hospital_capacity',
    dbUser: process.env.DB_USER || (process.env.PGUSER && process.env.PGUSER !== 'root' ? process.env.PGUSER : 'postgres'),
    dbPassword: process.env.PGPASSWORD || 'postgres',
    dbHost: process.env.PGHOST || 'localhost',
    dbPort: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
    dbName: process.env.PGDATABASE || 'hospital_capacity',
    natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
    natsStream: process.env.NATS_STREAM || 'events',
    natsDurable: process.env.NATS_DURABLE || 'hospital-capacity',
    contractsPath: process.env.CONTRACTS_PATH || path.resolve(process.cwd(), 'contracts'),
    capacityApiKey: process.env.CAPACITY_API_KEY,
    natsRequired: process.env.NATS_REQUIRED === 'true',
    capacityStaleMs: parseInt(process.env.CAPACITY_STALE_MS || '600000', 10),
    enableNatsConsumer: process.env.ENABLE_NATS_CONSUMER !== 'false',
};
