import { haversineDistance } from '../src/lib/geo';

describe('Geo Lib', () => {
    test('haversineDistance calculates correct distance', () => {
        // Ankara to Istanbul ~350 km
        const ankara = { lat: 39.93, lon: 32.85 };
        const istanbul = { lat: 41.00, lon: 28.97 };

        const dist = haversineDistance(ankara.lat, ankara.lon, istanbul.lat, istanbul.lon);
        expect(dist).toBeGreaterThan(340);
        expect(dist).toBeLessThan(360);
    });

    test('haversineDistance is zero for same point', () => {
        const dist = haversineDistance(10, 10, 10, 10);
        expect(dist).toBe(0);
    });
});
