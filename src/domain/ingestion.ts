import { withTransaction } from '../db';
import { upsertHospital } from './hospital';
import { insertCapacitySnapshot, updateHospitalCapacityCache, CapacityUpdate } from './capacity';
import { publishEvent } from '../nats';

export const processCapacityUpdate = async (
    hospitalData: {
        id: string;
        name: string;
        city?: string;
        district?: string;
        address?: string;
        lat: number;
        lon: number;
        capabilities?: any;
    },
    capacityData: {
        total_beds: number;
        available_beds: number;
        icu_total: number;
        icu_available: number;
    },
    meta: {
        updated_at: string;
        source: string;
    }
) => {
    await withTransaction(async (client) => {
        // 1. Upsert Hospital
        const hospital = await upsertHospital(client, {
            ...hospitalData,
            city: hospitalData.city || 'Unknown'
        });

        // 2. Insert Snapshot and Update Cache
        // Only if capacity data is provided (it usually is for this updates)
        if (capacityData) {
            const updatePayload: CapacityUpdate = {
                hospital_id: hospitalData.id,
                ...capacityData,
                updated_at: meta.updated_at,
                source: meta.source
            };

            await insertCapacitySnapshot(client, updatePayload);
            await updateHospitalCapacityCache(client, updatePayload);
        }

        // 3. Publish Event (AFTER commit essentially, but we do it here. If commit fails, we might have published ghost event?
        // Ideally use outbox pattern. But for MVP, publishing here is acceptable risk, or published after transaction.
        // If we wait after transaction, we lose the 'atomic' feel if node crashes.
        // User requirement: "Use a single DB transaction for upsert hospital + insert snapshot + update hospitals current_* cache columns."
        // It doesn't strictly say publish must be in transaction (impossible with NATS).
        // Let's publish AFTER transaction succeeds.
        return hospital;
    });

    // 4. Publish Event
    const eventPayload = {
        hospital_id: hospitalData.id,
        name: hospitalData.name,
        location: {
            lat: hospitalData.lat,
            lon: hospitalData.lon
        },
        city: hospitalData.city || 'Unknown',
        updated_at: meta.updated_at,
        capacity: capacityData,
        source: "service:hospital-capacity"
    };

    await publishEvent('hospital.capacity.updated', eventPayload);
};
