import { haversineDistance } from '../lib/geo';
import { getHospitalsForRecommendation, Hospital } from './hospital';
import { config } from '../config';
import { pool } from '../db'; // Use pool for read queries

export interface RecommendationParams {
    lat: number;
    lon: number;
    radius_km?: number;
    icu_required?: boolean;
    min_available_beds?: number;
    min_icu_available?: number;
}

export interface RecommendationResult {
    items: Hospital[];
    meta: {
        excluded_stale_count: number;
    };
}

export const getRecommendations = async (params: RecommendationParams): Promise<RecommendationResult> => {
    const radius = params.radius_km || 50; // default 50km

    // Get all hospitals with minimal filtering
    const allHospitals = await getHospitalsForRecommendation(pool);

    // Filter and sort in memory
    const now = new Date().getTime();
    let excludedStaleCount = 0;

    const validHospitals = allHospitals.filter((h: Hospital) => {
        // 1. Staleness check
        if (!h.last_capacity_update) {
            excludedStaleCount++;
            return false;
        }
        const updateTime = new Date(h.last_capacity_update).getTime();
        if (now - updateTime > config.capacityStaleMs) {
            excludedStaleCount++;
            return false;
        }

        // 2. ICU check
        if (params.icu_required) {
            if (!h.current_icu_total || h.current_icu_total <= 0) return false;
            if (params.min_icu_available && (h.current_icu_available || 0) < params.min_icu_available) return false;
            if ((h.current_icu_available || 0) <= 0) return false;
        }

        // 3. Bed check
        if (params.min_available_beds && (h.current_available_beds || 0) < params.min_available_beds) return false;
        if ((h.current_available_beds || 0) <= 0 && !params.icu_required) return false;

        // 4. Distance check
        const dist = haversineDistance(params.lat, params.lon, h.lat, h.lon);
        (h as any).distance_km = dist;
        return dist <= radius;
    });

    // Sort
    // 1) availability (icu if required else beds) DESC
    // 2) distance_km ASC
    // 3) last_capacity_update DESC
    validHospitals.sort((a: any, b: any) => {
        let availabilityA = params.icu_required ? (a.current_icu_available || 0) : (a.current_available_beds || 0);
        let availabilityB = params.icu_required ? (b.current_icu_available || 0) : (b.current_available_beds || 0);

        // Primary sort: Availability Descending
        if (availabilityB !== availabilityA) {
            return availabilityB - availabilityA;
        }

        // Secondary sort: Distance Ascending
        if (a.distance_km !== b.distance_km) {
            return a.distance_km - b.distance_km;
        }

        // Tertiary sort: Last Update Descending
        const dateA = new Date(a.last_capacity_update || 0).getTime();
        const dateB = new Date(b.last_capacity_update || 0).getTime();
        return dateB - dateA;
    });

    return {
        items: validHospitals,
        meta: {
            excluded_stale_count: excludedStaleCount
        }
    };
};
