"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendations = void 0;
const geo_1 = require("../lib/geo");
const hospital_1 = require("./hospital");
const config_1 = require("../config");
const db_1 = require("../db"); // Use pool for read queries
const getRecommendations = async (params) => {
    const radius = params.radius_km || 50; // default 50km
    // Get all hospitals with minimal filtering
    const allHospitals = await (0, hospital_1.getHospitalsForRecommendation)(db_1.pool);
    // Filter and sort in memory
    const now = new Date().getTime();
    let excludedStaleCount = 0;
    const validHospitals = [];
    for (const h of allHospitals) {
        // 1. Staleness check
        if (!h.last_capacity_update) {
            excludedStaleCount++;
            continue;
        }
        const updateTime = new Date(h.last_capacity_update).getTime();
        if (now - updateTime > config_1.config.capacityStaleMs) {
            excludedStaleCount++;
            continue;
        }
        // 2. ICU check
        if (params.icu_required) {
            if (!h.current_icu_total || h.current_icu_total <= 0)
                continue;
            if (params.min_icu_available && (h.current_icu_available || 0) < params.min_icu_available)
                continue;
            if ((h.current_icu_available || 0) <= 0)
                continue;
        }
        // 3. Bed check
        if (params.min_available_beds && (h.current_available_beds || 0) < params.min_available_beds)
            continue;
        if ((h.current_available_beds || 0) <= 0 && !params.icu_required)
            continue;
        // 4. Distance check
        const dist = (0, geo_1.haversineDistance)(params.lat, params.lon, h.lat, h.lon);
        if (dist <= radius) {
            validHospitals.push({ ...h, distance_km: dist });
        }
    }
    // Sort
    // 1) availability (icu if required else beds) DESC
    // 2) distance_km ASC
    // 3) last_capacity_update DESC
    validHospitals.sort((a, b) => {
        const availabilityA = params.icu_required ? (a.current_icu_available || 0) : (a.current_available_beds || 0);
        const availabilityB = params.icu_required ? (b.current_icu_available || 0) : (b.current_available_beds || 0);
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
exports.getRecommendations = getRecommendations;
