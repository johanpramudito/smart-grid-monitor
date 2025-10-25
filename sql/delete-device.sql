WITH ranked AS (
    SELECT zone_agent_id,
        feeder_number,
        ROW_NUMBER() OVER (
            PARTITION BY feeder_number
            ORDER BY created_at DESC
        ) AS rn
    FROM "ZoneAgent"
    WHERE feeder_number IN (1, 2, 3, 99)
),
to_delete AS (
    SELECT zone_agent_id
    FROM ranked
    WHERE rn > 1 -- keep only the newest zone per feeder
),
deleted_readings AS (
    DELETE FROM "SensorReading"
    WHERE sensor_id IN (
            SELECT sensor_id
            FROM "Sensor"
            WHERE zone_agent_id IN (
                    SELECT zone_agent_id
                    FROM to_delete
                )
        )
),
deleted_sensors AS (
    DELETE FROM "Sensor"
    WHERE zone_agent_id IN (
            SELECT zone_agent_id
            FROM to_delete
        )
),
deleted_relays AS (
    DELETE FROM "Relay"
    WHERE zone_agent_id IN (
            SELECT zone_agent_id
            FROM to_delete
        )
),
deleted_devices AS (
    DELETE FROM "DeviceAgent"
    WHERE zone_agent_id IN (
            SELECT zone_agent_id
            FROM to_delete
        )
),
deleted_waveforms AS (
    DELETE FROM "FaultWaveform"
    WHERE event_id IN (
            SELECT event_id
            FROM "EventLog"
            WHERE zone_agent_id IN (
                    SELECT zone_agent_id
                    FROM to_delete
                )
        )
),
deleted_events AS (
    DELETE FROM "EventLog"
    WHERE zone_agent_id IN (
            SELECT zone_agent_id
            FROM to_delete
        )
)
DELETE FROM "ZoneAgent"
WHERE zone_agent_id IN (
        SELECT zone_agent_id
        FROM to_delete
    );