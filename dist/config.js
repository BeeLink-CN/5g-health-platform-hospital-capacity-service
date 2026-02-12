"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.SERVICE_PORT || '8093', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/hospital_capacity',
    natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
    natsStream: process.env.NATS_STREAM || 'events',
    natsDurable: process.env.NATS_DURABLE || 'hospital-capacity',
    contractsPath: process.env.CONTRACTS_PATH || path_1.default.resolve(process.cwd(), 'contracts'),
    capacityApiKey: process.env.CAPACITY_API_KEY,
    natsRequired: process.env.NATS_REQUIRED === 'true',
    capacityStaleMs: parseInt(process.env.CAPACITY_STALE_MS || '600000', 10),
    enableNatsConsumer: process.env.ENABLE_NATS_CONSUMER !== 'false',
};
