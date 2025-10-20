-- SQL Schema for the Smart Grid Monitor Project
-- Based on the ERD in C251_A03_Revisi.pdf and the interfaces in src/lib/database/models.ts

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for application users and authentication
CREATE TABLE IF NOT EXISTS "UserAccount" (
    "user_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" VARCHAR(320) NOT NULL UNIQUE,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for embedded devices (e.g., STM32 + ESP-01 gateways) reporting telemetry
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

-- Table for the overall system
CREATE TABLE IF NOT EXISTS "AgentSystem" (
    "agent_system_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for individual zones within the grid
CREATE TABLE IF NOT EXISTS "ZoneAgent" (
    "zone_agent_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "agent_system_id" UUID NOT NULL REFERENCES "AgentSystem"("agent_system_id"),
    "feeder_number" INT NOT NULL,
    "location_description" TEXT,
    "status" VARCHAR(50) NOT NULL CHECK ("status" IN ('NORMAL', 'FAULT', 'ISOLATED', 'OFFLINE')),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for physical sensors
CREATE TABLE IF NOT EXISTS "Sensor" (
    "sensor_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('CURRENT', 'VOLTAGE')),
    "serial_number" VARCHAR(255),
    "installed_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for time-series sensor readings
CREATE TABLE IF NOT EXISTS "SensorReading" (
    "sensor_reading_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sensor_id" UUID NOT NULL REFERENCES "Sensor"("sensor_id"),
    "current" REAL, -- Using REAL for floating point numbers
    "voltage" REAL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Table for relays/switches
CREATE TABLE IF NOT EXISTS "Relay" (
    "relay_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "relay_number" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL CHECK ("status" IN ('OPEN', 'CLOSED'))
);

-- Table representing connections between zones
CREATE TABLE IF NOT EXISTS "GridConnection" (
    "grid_connection_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "from_zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "to_zone_agent_id" UUID NOT NULL REFERENCES "ZoneAgent"("zone_agent_id"),
    "connection_status" VARCHAR(50) NOT NULL CHECK ("connection_status" IN ('ACTIVE', 'INACTIVE', 'CUT')),
    "is_faulty" BOOLEAN NOT NULL DEFAULT FALSE,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Added physical properties for FLISR calculations
    "length_km" REAL NOT NULL,
    "resistance_ohm_km" REAL NOT NULL,
    "inductance_h_km" REAL NOT NULL,
    "capacitance_f_km" REAL NOT NULL
);

-- Table for the agents controlling switches on connections
CREATE TABLE IF NOT EXISTS "SwitchAgent" (
    "switch_agent_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "grid_connection_id" UUID NOT NULL REFERENCES "GridConnection"("grid_connection_id"),
    "logic_status" VARCHAR(50) NOT NULL CHECK ("logic_status" IN ('OPEN', 'CLOSED')),
    "last_activated" TIMESTAMP WITH TIME ZONE
);

-- Table for logging all system events
CREATE TABLE IF NOT EXISTS "EventLog" (
    "event_id" SERIAL PRIMARY KEY, -- Using SERIAL for a simple incrementing integer ID
    "zone_agent_id" UUID REFERENCES "ZoneAgent"("zone_agent_id"),
    "event_type" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT FALSE
);

-- New table for high-resolution fault waveform data, linked to a fault event
CREATE TABLE IF NOT EXISTS "FaultWaveform" (
    "waveform_id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "event_id" INT NOT NULL REFERENCES "EventLog"("event_id"),
    "grid_connection_id" UUID NOT NULL REFERENCES "GridConnection"("grid_connection_id"),
    "timestamp_a" BIGINT NOT NULL, -- Nanosecond timestamp from sensor at the start of the line
    "timestamp_b" BIGINT NOT NULL, -- Nanosecond timestamp from sensor at the end of the line
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for foreign keys and frequently queried columns for better performance
CREATE INDEX IF NOT EXISTS idx_zone_agent_system_id ON "ZoneAgent"("agent_system_id");
CREATE INDEX IF NOT EXISTS idx_sensor_zone_id ON "Sensor"("zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_sensor_reading_sensor_id ON "SensorReading"("sensor_id");
CREATE INDEX IF NOT EXISTS idx_sensor_reading_timestamp ON "SensorReading"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_relay_zone_id ON "Relay"("zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_grid_connection_from_zone ON "GridConnection"("from_zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_grid_connection_to_zone ON "GridConnection"("to_zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_switch_agent_connection_id ON "SwitchAgent"("grid_connection_id");
CREATE INDEX IF NOT EXISTS idx_eventlog_zone_id ON "EventLog"("zone_agent_id");
CREATE INDEX IF NOT EXISTS idx_eventlog_event_type ON "EventLog"("event_type");
CREATE INDEX IF NOT EXISTS idx_eventlog_timestamp ON "EventLog"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_fault_waveform_event_id ON "FaultWaveform"("event_id");
CREATE INDEX IF NOT EXISTS idx_device_zone_agent_id ON "DeviceAgent"("zone_agent_id");


-- Optional: Insert some initial data for testing
-- INSERT INTO "AgentSystem" ("name") VALUES ('Primary Grid');
-- TODO: Add more seed data for zones, sensors, etc. as needed.
