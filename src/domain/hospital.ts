import { Queryable } from '../db';

export interface Hospital {
    id: string;
    name: string;
    city: string;
    district?: string;
    address?: string;
    lat: number;
    lon: number;
    capabilities?: any;
    updated_at?: Date;
    // Current capacity cache
    current_total_beds?: number;
    current_available_beds?: number;
    current_icu_total?: number;
    current_icu_available?: number;
    last_capacity_update?: Date;
}

export const upsertHospital = async (db: Queryable, hospital: Hospital) => {
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

export const getHospital = async (db: Queryable, id: string) => {
    const text = `SELECT * FROM hospitals WHERE id = $1`;
    const { rows } = await db.query(text, [id]);
    return rows[0] || null;
};

export const listHospitals = async (db: Queryable) => {
    const text = `SELECT * FROM hospitals ORDER BY name ASC`;
    const { rows } = await db.query(text);
    return rows;
};

export const getHospitalsForRecommendation = async (db: Queryable) => {
    // We can filter by bounding box first for optimization if needed
    const text = `
        SELECT * FROM hospitals 
        WHERE last_capacity_update IS NOT NULL
    `;
    const { rows } = await db.query(text);
    return rows;
};
