import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import { pool } from '../db';
import { getConnection } from '../nats';
import { listHospitals, getHospital } from '../domain/hospital';
import { getCapacityHistory } from '../domain/capacity';
import { getRecommendations } from '../domain/recommendation';
import { processCapacityUpdate } from '../domain/ingestion';
import { validate } from '../lib/schemas';

// Metric counters
const metrics = {
    updates_received: 0,
    updates_validated: 0,
    updates_persisted: 0,
    updates_published: 0,
    dropped_invalid: 0,
    db_errors: 0,
    nats_errors: 0,
    stale_filtered: 0
};

export const registerRoutes = async (server: FastifyInstance) => {

    // Health
    server.get('/health', async (req, reply) => {
        const dbOk = (await pool.totalCount) > 0;
        const natsOk = getConnection() ? !getConnection()?.isClosed() : false;

        if (dbOk && (!config.natsRequired || natsOk)) {
            return { status: 'ok', db: 'connected', nats: natsOk ? 'connected' : 'disconnected' };
        } else {
            reply.code(503);
            return { status: 'degraded', db: dbOk ? 'connected' : 'disconnected', nats: natsOk ? 'connected' : 'disconnected' };
        }
    });

    // Ready
    server.get('/ready', async (req, reply) => {
        try {
            await pool.query('SELECT 1');
            if (config.natsRequired && (!getConnection() || getConnection()?.isClosed())) {
                reply.code(503);
                return { status: 'not_ready', reason: 'NATS unreachable' };
            }
            return { status: 'ready' };
        } catch (err) {
            reply.code(503);
            return { status: 'not_ready', reason: 'DB unreachable' };
        }
    });

    // Metrics
    server.get('/metrics', async (req, reply) => {
        return metrics;
    });

    // Hospitals
    server.get('/hospitals', async (req, reply) => {
        return await listHospitals(pool);
    });

    server.get('/hospitals/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const hospital = await getHospital(pool, id);
        if (!hospital) {
            reply.code(404);
            return { error: 'Hospital not found' };
        }
        const history = await getCapacityHistory(pool, id);
        return { ...hospital, history };
    });

    // Recommendations
    server.get('/capacity/recommendation', async (req, reply) => {
        try {
            const query = req.query as any;
            const lat = parseFloat(query.lat);
            const lon = parseFloat(query.lon);

            if (isNaN(lat) || isNaN(lon)) {
                reply.code(400);
                return { error: 'lat and lon are required numbers' };
            }

            const params = {
                lat,
                lon,
                radius_km: query.radius_km ? parseFloat(query.radius_km) : undefined,
                icu_required: query.icu_required === 'true',
                min_available_beds: query.min_available_beds ? parseInt(query.min_available_beds) : undefined,
                min_icu_available: query.min_icu_available ? parseInt(query.min_icu_available) : undefined,
            };

            const result = await getRecommendations(params);
            return result; // Returns { items: [], meta: { ... } }
        } catch (err) {
            req.log.error(err);
            reply.code(500);
            return { error: 'Internal Server Error' };
        }
    });

    // Update
    server.post('/capacity/update', async (req, reply) => {
        // Auth check
        if (config.capacityApiKey) {
            const key = req.headers['x-api-key'];
            if (key !== config.capacityApiKey) {
                reply.code(401);
                return { error: 'Unauthorized' };
            }
        } else {
            // No Key Configured
            if (config.nodeEnv === 'production') {
                reply.code(403);
                return { error: 'API Key not configured, writes disabled in production' };
            } else {
                req.log.warn('Security Warning: POST /capacity/update called without API Key configured (allowed in dev)');
            }
        }

        metrics.updates_received++;
        const body = req.body as any;

        if (!body.hospital_id || !body.name || !body.location) {
            metrics.dropped_invalid++;
            reply.code(400);
            return { error: 'Missing required fields: hospital_id, name, location' };
        }

        try {
            await processCapacityUpdate(
                {
                    id: body.hospital_id,
                    name: body.name,
                    city: body.city,
                    district: body.district,
                    address: body.address,
                    lat: body.location.lat,
                    lon: body.location.lon,
                    capabilities: body.capabilities
                },
                body.capacity,
                {
                    updated_at: body.updated_at || new Date().toISOString(),
                    source: body.source || 'api'
                }
            );

            metrics.updates_persisted++;
            reply.code(200);
            return { status: 'accepted' };

        } catch (err) {
            metrics.db_errors++;
            req.log.error(err);
            reply.code(500);
            return { error: 'Internal Error' };
        }
    });
};
