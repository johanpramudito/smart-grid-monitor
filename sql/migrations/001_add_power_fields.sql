-- Migration: Add power, power_factor, energy, and frequency fields to SensorReading
-- Date: 2025-11-10
-- Description: Extends SensorReading table to support PZEM004T additional telemetry data

-- Add new columns to SensorReading table
ALTER TABLE "SensorReading"
  ADD COLUMN IF NOT EXISTS "power" REAL,
  ADD COLUMN IF NOT EXISTS "power_factor" REAL,
  ADD COLUMN IF NOT EXISTS "energy" REAL,
  ADD COLUMN IF NOT EXISTS "frequency" REAL;

-- Add comments for documentation
COMMENT ON COLUMN "SensorReading"."power" IS 'Active power in watts (W)';
COMMENT ON COLUMN "SensorReading"."power_factor" IS 'Power factor (0.0 to 1.0)';
COMMENT ON COLUMN "SensorReading"."energy" IS 'Accumulated energy in kilowatt-hours (kWh)';
COMMENT ON COLUMN "SensorReading"."frequency" IS 'AC frequency in hertz (Hz)';

-- Create indexes for the new fields to improve query performance
CREATE INDEX IF NOT EXISTS idx_sensor_reading_power ON "SensorReading"("power") WHERE "power" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sensor_reading_energy ON "SensorReading"("energy") WHERE "energy" IS NOT NULL;
