"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCapacityHistory = exports.updateHospitalCapacityCache = exports.insertCapacitySnapshot = void 0;
const insertCapacitySnapshot = async (db, update) => {
    const snapshotText = `
    INSERT INTO capacity_snapshots (hospital_id, total_beds, available_beds, icu_total, icu_available, updated_at, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
  `;
    await db.query(snapshotText, [
        update.hospital_id,
        update.total_beds,
        update.available_beds,
        update.icu_total,
        update.icu_available,
        update.updated_at,
        update.source
    ]);
};
exports.insertCapacitySnapshot = insertCapacitySnapshot;
const updateHospitalCapacityCache = async (db, update) => {
    const hospitalText = `
    UPDATE hospitals SET
      current_total_beds = $2,
      current_available_beds = $3,
      current_icu_total = $4,
      current_icu_available = $5,
      last_capacity_update = $6
    WHERE id = $1;
  `;
    await db.query(hospitalText, [
        update.hospital_id,
        update.total_beds,
        update.available_beds,
        update.icu_total,
        update.icu_available,
        update.updated_at
    ]);
};
exports.updateHospitalCapacityCache = updateHospitalCapacityCache;
const getCapacityHistory = async (db, hospitalId, limit = 20) => {
    const text = `
    SELECT * FROM capacity_snapshots 
    WHERE hospital_id = $1 
    ORDER BY updated_at DESC 
    LIMIT $2
  `;
    const { rows } = await db.query(text, [hospitalId, limit]);
    return rows;
};
exports.getCapacityHistory = getCapacityHistory;
