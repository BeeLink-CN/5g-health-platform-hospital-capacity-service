"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startConsumer = void 0;
const nats_1 = require("nats");
const config_1 = require("../config");
const index_1 = require("./index");
const ingestion_1 = require("../domain/ingestion");
const pino_1 = require("pino");
const logger = (0, pino_1.pino)({ level: config_1.config.logLevel });
const jc = (0, nats_1.JSONCodec)();
const startConsumer = async () => {
    if (!config_1.config.enableNatsConsumer) {
        logger.info('NATS consumer disabled.');
        return;
    }
    const js = (0, index_1.getJetStream)();
    if (!js) {
        logger.error('JetStream not initialized, cannot consume');
        return;
    }
    const opts = (0, nats_1.consumerOpts)();
    opts.durable(config_1.config.natsDurable);
    opts.manualAck();
    opts.ackExplicit();
    opts.deliverTo(config_1.config.natsDurable);
    try {
        const sub = await js.subscribe('hospital.capacity.reported', opts);
        logger.info('Subscribed to hospital.capacity.reported');
        for await (const m of sub) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = jc.decode(m.data);
                const payload = data.payload || data;
                if (payload.hospital_id && payload.name && payload.location) {
                    await (0, ingestion_1.processCapacityUpdate)({
                        id: payload.hospital_id,
                        name: payload.name,
                        city: payload.city,
                        district: payload.district,
                        address: payload.address,
                        lat: payload.location.lat,
                        lon: payload.location.lon,
                        capabilities: payload.capabilities
                    }, payload.capacity, {
                        updated_at: payload.updated_at || new Date().toISOString(),
                        source: payload.source || 'nats-consumer'
                    });
                    m.ack();
                }
                else {
                    logger.warn({ payload }, 'Invalid payload received');
                    m.term();
                }
            }
            catch (err) {
                logger.error(err, 'Error processing message');
                m.nak();
            }
        }
    }
    catch (err) {
        logger.error(err, 'Consumer subscription failed');
    }
};
exports.startConsumer = startConsumer;
