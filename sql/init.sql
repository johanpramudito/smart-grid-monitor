-- SQL Schema for the Smart Grid Monitor Project
-- Based on the ERD in C251_A03_Revisi.pdf and TypeScript models in src/lib/database/models.ts
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS "UserAccount" (
    "user_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" VARCHAR(320) NOT NULL UNIQUE,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
/* ---------------------------------------------------------------------------
 Core hierarchy
 --------------------------------------------------------------------------- */
-- Parent system (each ZoneAgent belongs to one AgentSystem)
CREATE TABLE IF NOT EXISTS "AgentSystem" (
    "agent_system_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Zones in the grid
CREATE TABLE IF NOT EXISTS "ZoneAgent" (
    "zone_agent_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "agent_system_id" UUID NOT NULL REFERENCES "AgentSystem"("agent_system_id"),
    "feeder_number" INT NOT NULL,
    "location_description" TEXT,
    "status" VARCHAR(50) NOT NULL CHECK (
        "status" IN ('NORMAL', 'FAULT', 'ISOLATED', 'OFFLINE')
    ),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
/* ---------------------------------------------------------------------------
 Devices & sensors
 --------------------------------------------------------------------------- */
-- Embedded gateways (e.g., STM32 + ESP-01) reporting telemetry
CREATE TABLE IF NOT EXISTS "DeviceAgent" (
    "device_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "name" VARCHAR(255),
    "api_key_id" VARCHAR(64) NOT NULL UNIQUE,
    "api_key_hash" TEXT NOT NULL,
    "firmware_version" VARCHAR(64),
    "last_seen" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Physical sensors (voltage/current)
CREATE TABLE IF NOT EXISTS "Sensor" (
    "sensor_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('CURRENT', 'VOLTAGE')),
    "serial_number" VARCHAR(255),
    "installed_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sensor_zone_type_unique UNIQUE (zone_agent_id, type)
);
-- Time series readings
CREATE TABLE IF NOT EXISTS "SensorReading" (
    "sensor_reading_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sensor_id" UUID NOT NULL REFERENCES "Sensor"("sensor_id"),
    "current" REAL,
    "voltage" REAL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL
);
/* ---------------------------------------------------------------------------
 Switching equipment
 --------------------------------------------------------------------------- */
-- Relays within a zone
CREATE TABLE IF NOT EXISTS "Relay" (
    "relay_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "relay_number" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL CHECK ("status" IN ('OPEN', 'CLOSED')),
    CONSTRAINT relay_zone_number_unique UNIQUE (zone_agent_id, relay_number)
);
-- Connections between zones (for FLISR / topology)
CREATE TABLE IF NOT EXISTS "GridConnection" (
    "grid_connection_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "from_zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "to_zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "connection_status" VARCHAR(50) NOT NULL CHECK (
        "connection_status" IN ('ACTIVE', 'INACTIVE', 'CUT')
    ),
    "is_faulty" BOOLEAN NOT NULL DEFAULT FALSE,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Physical properties for FLISR calculations
    "length_km" REAL NOT NULL,
    "resistance_ohm_km" REAL NOT NULL,
    "inductance_h_km" REAL NOT NULL,
    "capacitance_f_km" REAL NOT NULL
);
-- Switch agents that operate on grid connections
CREATE TABLE IF NOT EXISTS "SwitchAgent" (
    "switch_agent_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "grid_connection_id" UUID NOT NULL REFERENCES "GridConnection"("grid_connection_id"),
    "logic_status" VARCHAR(50) NOT NULL CHECK ("logic_status" IN ('OPEN', 'CLOSED')),
    "last_activated" TIMESTAMP WITH TIME ZONE
);
/* ---------------------------------------------------------------------------
 Events & waveforms
 --------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS "EventLog" (
    "event_id" SERIAL PRIMARY KEY,
    "zone_agent_id" UUID REFERENCES "ZoneAgent"("zone_agent_id"),
    "event_type" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS "FaultWaveform" (
    "waveform_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "event_id" INT NOT NULL REFERENCES "EventLog"("event_id"),
    "grid_connection_id" UUID NOT NULL REFERENCES "GridConnection"("grid_connection_id"),
    "timestamp_a" BIGINT NOT NULL,
    "timestamp_b" BIGINT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
/* ---------------------------------------------------------------------------
 Indexes
 --------------------------------------------------------------------------- */
CREATE INDEX IF NOT EXISTS idx_zone_agent_system_id ON "ZoneAgent"("agent_system_id");
CREATE INDEX IF NOT EXISTS idx_sensor_zone_id ON "Sensor"("zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_sensor_reading_sensor_id ON "SensorReading"("sensor_id");
CREATE INDEX IF NOT EXISTS idx_sensor_reading_timestamp ON "SensorReading"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_relay_zone_id ON "Relay"("zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_grid_conn_from_zone ON "GridConnection"("from_zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_grid_conn_to_zone ON "GridConnection"("to_zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_switch_agent_conn ON "SwitchAgent"("grid_connection_id");
CREATE INDEX IF NOT EXISTS idx_eventlog_zone_id ON "EventLog"("zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_eventlog_event_type ON "EventLog"("event_type");
CREATE INDEX IF NOT EXISTS idx_eventlog_timestamp ON "EventLog"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_fault_waveform_event_id ON "FaultWaveform"("event_id");
CREATE INDEX IF NOT EXISTS idx_device_zone_agent_id ON "DeviceAgent"("zone_agent_id");
-- Optional seed data
-- INSERT INTO "AgentSystem" ("name") VALUES ('Primary Grid');
-- TODO: Add sample zones/sensors/relays if desired.