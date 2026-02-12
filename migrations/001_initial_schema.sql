CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  capabilities JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Latest capacity cache columns
  current_total_beds INTEGER,
  current_available_beds INTEGER,
  current_icu_total INTEGER,
  current_icu_available INTEGER,
  last_capacity_update TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id TEXT REFERENCES hospitals(id),
  total_beds INTEGER,
  available_beds INTEGER,
  icu_total INTEGER,
  icu_available INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL, -- The time from the payload
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Persist time
);

CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(lat, lon);
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_hospital_updated ON capacity_snapshots(hospital_id, updated_at DESC);
