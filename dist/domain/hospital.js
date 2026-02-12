"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHospitalsForRecommendation = exports.listHospitals = exports.getHospital = exports.upsertHospital = void 0;
const upsertHospital = async (db, hospital) => {
    const text = `
    INSERT INTO hospitals (id, name, city, district, address, lat, lon, capabilities, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      city = EXCLUDED.city,
      district = COALESCE(EXCLUDED.district, hospitals.district),
      address = COALESCE(EXCLUDED.address, hospitals.address),
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      capabilities = COALESCE(EXCLUDED.capabilities, hospitals.capabilities),
      updated_at = NOW()
    RETURNING *;
  `;
    const values = [
        hospital.id,
        hospital.name,
        hospital.city,
        hospital.district,
        hospital.address,
        hospital.lat,
        hospital.lon,
        hospital.capabilities
    ];
    const { rows } = await db.query(text, values);
    return rows[0];
};
exports.upsertHospital = upsertHospital;
const getHospital = async (db, id) => {
    const text = `SELECT * FROM hospitals WHERE id = $1`;
    const { rows } = await db.query(text, [id]);
    return rows[0] || null;
};
exports.getHospital = getHospital;
const listHospitals = async (db) => {
    const text = `SELECT * FROM hospitals ORDER BY name ASC`;
    const { rows } = await db.query(text);
    return rows;
};
exports.listHospitals = listHospitals;
const getHospitalsForRecommendation = async (db) => {
    // We can filter by bounding box first for optimization if needed
    const text = `
        SELECT * FROM hospitals 
        WHERE last_capacity_update IS NOT NULL
    `;
    const { rows } = await db.query(text);
    return rows;
};
exports.getHospitalsForRecommendation = getHospitalsForRecommendation;
