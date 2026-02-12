import { connect, NatsConnection, JSONCodec, JetStreamClient } from 'nats';
import crypto from 'crypto';
import { config } from '../config';
import { pino } from 'pino';

const logger = pino({ level: config.logLevel });
// const sc = StringCodec();
const jc = JSONCodec();

let nc: NatsConnection | undefined;
let js: JetStreamClient | undefined;

export const connectNats = async () => {
    if (!config.natsRequired && !config.enableNatsConsumer) {
        // If neither required nor consumer enabled, and we fail, maybe we can skip?
        // But usually we want to connect if possible.
    }

    try {
        logger.info(`Connecting to NATS at ${config.natsUrl}...`);
        nc = await connect({ servers: config.natsUrl, name: 'hospital-capacity-service' });
        js = nc.jetstream();
        logger.info('Connected to NATS');

        // Ensure stream exists (idempotent)
        const jsm = await nc.jetstreamManager();
        try {
            await jsm.streams.info(config.natsStream);
        } catch (err) {
            logger.info(`Stream ${config.natsStream} not found, creating...`);
            await jsm.streams.add({
                name: config.natsStream,
                subjects: ['hospital.capacity.*', 'hospital.*'], // listen to relevant subjects
                // Add other stream config as needed, defaulting to standard
            });
        }

    } catch (err) {
        logger.error(err, 'Failed to connect to NATS');
        if (config.natsRequired) {
            process.exit(1);
        }
    }
};

export const getConnection = () => nc;
export const getJetStream = () => js;

export const publishEvent = async (subject: string, data: unknown) => {
    if (!js) {
        logger.warn('JetStream not initialized, cannot publish');
        return;
    }

    const envelope = {
        event_name: subject,
        event_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        payload: data
    };

    try {
        await js.publish(subject, jc.encode(envelope));
        logger.debug({ subject, event_id: envelope.event_id }, 'Published event');
    } catch (err) {
        logger.error({ err, subject }, 'Failed to publish event');
        throw err;
    }
};

export const closeNats = async () => {
    if (nc) {
        await nc.drain();
        await nc.close();
    }
};
