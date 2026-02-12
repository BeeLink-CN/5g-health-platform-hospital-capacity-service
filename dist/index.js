"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const config_1 = require("./config");
const routes_1 = require("./api/routes");
const schemas_1 = require("./lib/schemas");
const nats_1 = require("./nats");
const consumer_1 = require("./nats/consumer");
const migrate_1 = require("./db/migrate");
const index_1 = require("./db/index");
const server = (0, fastify_1.default)({
    logger: {
        level: config_1.config.logLevel,
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
});
const start = async () => {
    try {
        // 1. Load Schemas
        (0, schemas_1.loadSchemas)();
        // 2. Connect DB & Run Migrations
        await (0, migrate_1.runMigrations)();
        // 3. Connect NATS
        await (0, nats_1.connectNats)();
        // 4. Start Consumer
        (0, consumer_1.startConsumer)().catch(err => server.log.error(err, 'Consumer failed'));
        // 5. Register Routes
        await (0, routes_1.registerRoutes)(server);
        // 6. Start Server
        await server.listen({ port: config_1.config.port, host: '0.0.0.0' });
        server.log.info(`Server listening on port ${config_1.config.port}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
    process.on(signal, async () => {
        server.log.info(`Received ${signal}, shutting down...`);
        await server.close();
        await (0, nats_1.closeNats)();
        await (0, index_1.closeDb)();
        process.exit(0);
    });
});
start();
