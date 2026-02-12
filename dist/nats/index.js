"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeNats = exports.publishEvent = exports.getJetStream = exports.getConnection = exports.connectNats = void 0;
const nats_1 = require("nats");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const pino_1 = require("pino");
const logger = (0, pino_1.pino)({ level: config_1.config.logLevel });
// const sc = StringCodec();
const jc = (0, nats_1.JSONCodec)();
let nc;
let js;
const connectNats = async () => {
    if (!config_1.config.natsRequired && !config_1.config.enableNatsConsumer) {
        // If neither required nor consumer enabled, and we fail, maybe we can skip?
        // But usually we want to connect if possible.
    }
    try {
        logger.info(`Connecting to NATS at ${config_1.config.natsUrl}...`);
        nc = await (0, nats_1.connect)({ servers: config_1.config.natsUrl, name: 'hospital-capacity-service' });
        js = nc.jetstream();
        logger.info('Connected to NATS');
        // Ensure stream exists (idempotent)
        const jsm = await nc.jetstreamManager();
        try {
            await jsm.streams.info(config_1.config.natsStream);
        }
        catch (err) {
            logger.info(`Stream ${config_1.config.natsStream} not found, creating...`);
            await jsm.streams.add({
                name: config_1.config.natsStream,
                subjects: ['hospital.capacity.*', 'hospital.*'], // listen to relevant subjects
                // Add other stream config as needed, defaulting to standard
            });
        }
    }
    catch (err) {
        logger.error(err, 'Failed to connect to NATS');
        if (config_1.config.natsRequired) {
            process.exit(1);
        }
    }
};
exports.connectNats = connectNats;
const getConnection = () => nc;
exports.getConnection = getConnection;
const getJetStream = () => js;
exports.getJetStream = getJetStream;
const publishEvent = async (subject, data) => {
    if (!js) {
        logger.warn('JetStream not initialized, cannot publish');
        return;
    }
    const envelope = {
        event_name: subject,
        event_id: crypto_1.default.randomUUID(),
        timestamp: new Date().toISOString(),
        payload: data
    };
    try {
        await js.publish(subject, jc.encode(envelope));
        logger.debug({ subject, event_id: envelope.event_id }, 'Published event');
    }
    catch (err) {
        logger.error({ err, subject }, 'Failed to publish event');
        throw err;
    }
};
exports.publishEvent = publishEvent;
const closeNats = async () => {
    if (nc) {
        await nc.drain();
        await nc.close();
    }
};
exports.closeNats = closeNats;
