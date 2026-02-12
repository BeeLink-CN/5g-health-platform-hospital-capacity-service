# 5G Health Platform - Hospital Capacity Service

Maintains hospital capacity (beds, ICU) and exposes recommendation APIs for dispatch.

## Features
- Manages hospital registry and capacity snapshots.
- Publishes `hospital.capacity.updated` events via NATS.
- Exposes REST API for capacity updates and dispatch recommendations.
- Calculates distance using Haversine formula.

## Prerequisites
- Node.js >= 18
- Postgres
- NATS JetStream

## Quick Start
1. `npm install`
2. `npm run migrate` (or auto-runs in dev)
3. `npm run dev`

Environment variables:
- `DATABASE_URL`: Postgres connection string
- `NATS_URL`: NATS server URL
- `SERVICE_PORT`: 8093
