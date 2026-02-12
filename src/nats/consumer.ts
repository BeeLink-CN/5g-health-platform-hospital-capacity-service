import { JSONCodec, consumerOpts } from 'nats';
import { config } from '../config';
import { getJetStream } from './index';
import { processCapacityUpdate } from '../domain/ingestion';
import { validate } from '../lib/schemas';
import { pino } from 'pino';

const logger = pino({ level: config.logLevel });
const jc = JSONCodec();

export const startConsumer = async () => {
    if (!config.enableNatsConsumer) {
        logger.info('NATS consumer disabled.');
        return;
    }

    const js = getJetStream();
    if (!js) {
        logger.error('JetStream not initialized, cannot consume');
        return;
    }

    const opts = consumerOpts();
    opts.durable(config.natsDurable);
    opts.manualAck();
    opts.ackExplicit();
    opts.deliverTo(config.natsDurable);

    try {
        const sub = await js.subscribe('hospital.capacity.reported', opts);
        logger.info('Subscribed to hospital.capacity.reported');

        for await (const m of sub) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = jc.decode(m.data) as any;
                const payload = data.payload || data;

                const errors = validate('https://5g-health-platform.com/schemas/events/hospital-capacity-reported.json', payload);
                if (errors) {
                    logger.warn({ errors, payload }, 'Invalid payload received - Schema Validation Failed');
                    m.term(); // Poison message, do not retry
                    continue;
                }

                if (payload.hospital_id && payload.name && payload.location) {
                    await processCapacityUpdate(
                        {
                            id: payload.hospital_id,
                            name: payload.name,
                            city: payload.city,
                            district: payload.district,
                            address: payload.address,
                            lat: payload.location.lat,
                            lon: payload.location.lon,
                            capabilities: payload.capabilities
                        },
                        payload.capacity,
                        {
                            updated_at: payload.updated_at || new Date().toISOString(),
                            source: payload.source || 'nats-consumer'
                        }
                    );

                    m.ack();
                } else {
                    // Should be caught by schema validation, but keep as fallback
                    logger.warn({ payload }, 'Invalid payload received - Missing Fields');
                    m.term();
                }

            } catch (err) {
                logger.error(err, 'Error processing message');
                m.nak();
            }
        }
    } catch (err) {
        logger.error(err, 'Consumer subscription failed');
    }
};
