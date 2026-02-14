import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { registerRoutes } from '../src/api/routes';
import { pool } from '../src/db/index';
import { config } from '../src/config';

// Mock NATS
jest.mock('../src/nats/index', () => ({
    getConnection: jest.fn(),
    getJetStream: jest.fn(),
    publishEvent: jest.fn(),
    connectNats: jest.fn(),
    closeNats: jest.fn(),
}));

import { publishEvent } from '../src/nats/index';

describe('Integration API', () => {
    let server: FastifyInstance;

    const resetTables = async () => {
        await pool.query('DELETE FROM capacity_snapshots');
        await pool.query('DELETE FROM hospitals');
    };

    beforeAll(async () => {
        console.log('--- TEST DEBUG ---');
        console.log('ENV PGUSER:', process.env.PGUSER);
        console.log('ENV DB_USER:', process.env.DB_USER);
        console.log('CONFIG dbUser:', config.dbUser);
        console.log('------------------');
        server = Fastify();
        await registerRoutes(server);
        await resetTables();
    });

    beforeEach(async () => {
        await resetTables();
    });

    afterAll(async () => {
        await server.close();
        await pool.end();
    });

    // Security test in different suite or here?
    // We can modify config for tests but it's singleton.
    // For integration test, we can assume non-prod or key presence.
    // Let's test standard flow.

    test('POST /capacity/update creates hospital and records capacity', async () => {
        const payload = {
            hospital_id: 'test-hosp-1',
            name: 'Test Hospital',
            location: { lat: 40.0, lon: 30.0 },
            city: 'Test City',
            updated_at: new Date().toISOString(),
            capacity: {
                total_beds: 100,
                available_beds: 10,
                icu_total: 20,
                icu_available: 5
            },
            source: 'test'
        };

        const response = await server.inject({
            method: 'POST',
            url: '/capacity/update',
            payload
        });

        expect(response.statusCode).toBe(200);

        // Verify DB
        const { rows: hRows } = await pool.query('SELECT * FROM hospitals WHERE id = $1', ['test-hosp-1']);
        expect(hRows.length).toBe(1);
        expect(hRows[0].current_available_beds).toBe(10);

        const { rows: cRows } = await pool.query('SELECT * FROM capacity_snapshots WHERE hospital_id = $1', ['test-hosp-1']);
        expect(cRows.length).toBe(1);

        // Verify NATS Publish
        expect(publishEvent).toHaveBeenCalledWith('hospital.capacity.updated', expect.objectContaining({
            hospital_id: 'test-hosp-1',
            source: 'service:hospital-capacity', // Check if source is overridden correctly
            capacity: expect.objectContaining({ available_beds: 10 })
        }));
    });

    test('GET /capacity/recommendation filters correctly and returns meta', async () => {
        await pool.query(`
      INSERT INTO hospitals (id, name, city, lat, lon, last_capacity_update)
      VALUES ('test-hosp-1', 'Test Hospital', 'Test City', 40.0, 30.0, NOW())
    `);

        // Seed another hospital far away
        await pool.query(`
      INSERT INTO hospitals (id, name, city, lat, lon, last_capacity_update) 
      VALUES ('far-hosp', 'Far', 'City', 50.0, 50.0, NOW())
    `);

        // Near hospital is 'test-hosp-1' at 40,30.
        // Query near 40,30
        const response = await server.inject({
            method: 'GET',
            url: '/capacity/recommendation',
            query: {
                lat: '40.0',
                lon: '30.0',
                radius_km: '100'
            }
        });

        expect(response.statusCode).toBe(200);
        const result = response.json();

        // Check envelope
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('meta');
        expect(result.items.length).toBe(1);
        expect(result.items[0].id).toBe('test-hosp-1');
    });

    test('GET /capacity/recommendation exclusions', async () => {
        await pool.query(`
        INSERT INTO hospitals (id, name, city, lat, lon, last_capacity_update)
        VALUES ('test-hosp-1', 'Test Hospital', 'Test City', 40.0, 30.0, NOW())
      `);

        // Insert stale hospital
        // stale default is 10 mins (600000ms)
        // insert update 20 mins old
        await pool.query(`
        INSERT INTO hospitals (id, name, city, lat, lon, last_capacity_update) 
        VALUES ('stale-hosp', 'Stale', 'City', 40.05, 30.05, NOW() - INTERVAL '20 minutes')
      `);

        const response = await server.inject({
            method: 'GET',
            url: '/capacity/recommendation',
            query: {
                lat: '40.0',
                lon: '30.0',
                radius_km: '100'
            }
        });

        const result = response.json();
        expect(result.items.find((h: any) => h.id === 'stale-hosp')).toBeUndefined();
        // meta.excluded_stale_count should be at least 1 (unless 'far-hosp' is also stale now? no, it was NOW())
        expect(result.meta.excluded_stale_count).toBeGreaterThanOrEqual(1);
    });
});
