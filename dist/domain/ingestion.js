"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processCapacityUpdate = void 0;
const db_1 = require("../db");
const hospital_1 = require("./hospital");
const capacity_1 = require("./capacity");
const nats_1 = require("../nats");
const processCapacityUpdate = async (hospitalData, capacityData, meta) => {
    await (0, db_1.withTransaction)(async (client) => {
        // 1. Upsert Hospital
        const hospital = await (0, hospital_1.upsertHospital)(client, {
            ...hospitalData,
            city: hospitalData.city || 'Unknown'
        });
        // 2. Insert Snapshot and Update Cache
        // Only if capacity data is provided (it usually is for this updates)
        if (capacityData) {
            const updatePayload = {
                hospital_id: hospitalData.id,
                ...capacityData,
                updated_at: meta.updated_at,
                source: meta.source
            };
            await (0, capacity_1.insertCapacitySnapshot)(client, updatePayload);
            await (0, capacity_1.updateHospitalCapacityCache)(client, updatePayload);
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
    await (0, nats_1.publishEvent)('hospital.capacity.updated', eventPayload);
};
exports.processCapacityUpdate = processCapacityUpdate;
