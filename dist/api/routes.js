"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = void 0;
const config_1 = require("../config");
const db_1 = require("../db");
const nats_1 = require("../nats");
const hospital_1 = require("../domain/hospital");
const capacity_1 = require("../domain/capacity");
const recommendation_1 = require("../domain/recommendation");
const ingestion_1 = require("../domain/ingestion");
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
const registerRoutes = async (server) => {
    // Health
    server.get('/health', async (_req, reply) => {
        const dbOk = (await db_1.pool.totalCount) > 0;
        const natsOk = (0, nats_1.getConnection)() ? !(0, nats_1.getConnection)()?.isClosed() : false;
        if (dbOk && (!config_1.config.natsRequired || natsOk)) {
            return { status: 'ok', db: 'connected', nats: natsOk ? 'connected' : 'disconnected' };
        }
        else {
            reply.code(503);
            return { status: 'degraded', db: dbOk ? 'connected' : 'disconnected', nats: natsOk ? 'connected' : 'disconnected' };
        }
    });
    // Ready
    server.get('/ready', async (_req, reply) => {
        try {
            await db_1.pool.query('SELECT 1');
            if (config_1.config.natsRequired && (!(0, nats_1.getConnection)() || (0, nats_1.getConnection)()?.isClosed())) {
                reply.code(503);
                return { status: 'not_ready', reason: 'NATS unreachable' };
            }
            return { status: 'ready' };
        }
        catch (err) {
            reply.code(503);
            return { status: 'not_ready', reason: 'DB unreachable' };
        }
    });
    // Metrics
    server.get('/metrics', async () => {
        return metrics;
    });
    // Hospitals
    server.get('/hospitals', async () => {
        return await (0, hospital_1.listHospitals)(db_1.pool);
    });
    server.get('/hospitals/:id', async (req, reply) => {
        const { id } = req.params;
        const hospital = await (0, hospital_1.getHospital)(db_1.pool, id);
        if (!hospital) {
            reply.code(404);
            return { error: 'Hospital not found' };
        }
        const history = await (0, capacity_1.getCapacityHistory)(db_1.pool, id);
        return { ...hospital, history };
    });
    // Recommendations
    server.get('/capacity/recommendation', async (req, reply) => {
        try {
            const query = req.query;
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
            const result = await (0, recommendation_1.getRecommendations)(params);
            return result; // Returns { items: [], meta: { ... } }
        }
        catch (err) {
            req.log.error(err);
            reply.code(500);
            return { error: 'Internal Server Error' };
        }
    });
    // Update
    server.post('/capacity/update', async (req, reply) => {
        // Auth check
        if (config_1.config.capacityApiKey) {
            const key = req.headers['x-api-key'];
            if (key !== config_1.config.capacityApiKey) {
                reply.code(401);
                return { error: 'Unauthorized' };
            }
        }
        else {
            // No Key Configured
            if (config_1.config.nodeEnv === 'production') {
                reply.code(403);
                return { error: 'API Key not configured, writes disabled in production' };
            }
            else {
                req.log.warn('Security Warning: POST /capacity/update called without API Key configured (allowed in dev)');
            }
        }
        metrics.updates_received++;
        const body = req.body;
        if (!body.hospital_id || !body.name || !body.location) {
            metrics.dropped_invalid++;
            reply.code(400);
            return { error: 'Missing required fields: hospital_id, name, location' };
        }
        try {
            await (0, ingestion_1.processCapacityUpdate)({
                id: body.hospital_id,
                name: body.name,
                city: body.city,
                district: body.district,
                address: body.address,
                lat: body.location.lat,
                lon: body.location.lon,
                capabilities: body.capabilities
            }, body.capacity, {
                updated_at: body.updated_at || new Date().toISOString(),
                source: body.source || 'api'
            });
            metrics.updates_persisted++;
            reply.code(200);
            return { status: 'accepted' };
        }
        catch (err) {
            metrics.db_errors++;
            req.log.error(err);
            reply.code(500);
            return { error: 'Internal Error' };
        }
    });
};
exports.registerRoutes = registerRoutes;
