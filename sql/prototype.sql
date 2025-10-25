WITH system_row AS (
    INSERT INTO "AgentSystem" (name)
    VALUES ('Prototype Grid')
    RETURNING agent_system_id
),
zones AS (
    INSERT INTO "ZoneAgent" (
            agent_system_id,
            feeder_number,
            location_description,
            status
        )
    SELECT system_row.agent_system_id,
        z.feeder,
        z.description,
        'NORMAL'
    FROM system_row
        CROSS JOIN (
            VALUES (1, 'Zone 1 Prototype'),
                (2, 'Zone 2 Prototype'),
                (3, 'Zone 3 Prototype'),
                (99, 'Tie Relay')
        ) AS z(feeder, description)
    RETURNING zone_agent_id,
        feeder_number
),
sensor_rows AS (
    INSERT INTO "Sensor" (zone_agent_id, type)
    SELECT zones.zone_agent_id,
        sensor_types.type
    FROM zones
        CROSS JOIN (
            VALUES ('VOLTAGE'),
                ('CURRENT')
        ) AS sensor_types(type)
    RETURNING sensor_id,
        zone_agent_id
)
INSERT INTO "Relay" (zone_agent_id, relay_number, status)
SELECT zone_agent_id,
    1,
    'OPEN'
FROM zones;
