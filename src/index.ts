import Fastify from 'fastify';
import { config } from './config';
import { registerRoutes } from './api/routes';
import { loadSchemas } from './lib/schemas';
import { connectNats, closeNats } from './nats';
import { startConsumer } from './nats/consumer';
import { runMigrations } from './db/migrate';
import { closeDb } from './db/index';

const server = Fastify({
    logger: {
        level: config.logLevel,
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
        loadSchemas();

        // 2. Connect DB & Run Migrations
        await runMigrations();

        // 3. Connect NATS
        await connectNats();

        // 4. Start Consumer
        startConsumer().catch(err => server.log.error(err, 'Consumer failed'));

        // 5. Register Routes
        await registerRoutes(server);

        // 6. Start Server
        await server.listen({ port: config.port, host: '0.0.0.0' });
        server.log.info(`Server listening on port ${config.port}`);

    } catch (err) {
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
        await closeNats();
        await closeDb();
        process.exit(0);
    });
});

start();
