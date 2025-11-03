-- Query untuk mendapatkan zone_agent_id (UUID) untuk konfigurasi STM32
-- Jalankan query ini di database PostgreSQL Anda

-- 1. Lihat semua zone yang ada
SELECT
    za.zone_agent_id,
    za.feeder_number,
    za.location_description,
    za.status,
    da.device_id,
    da.api_key_id as deviceKeyId
FROM "ZoneAgent" za
LEFT JOIN "DeviceAgent" da ON da.zone_agent_id = za.zone_agent_id
ORDER BY za.feeder_number;

-- Output contoh:
-- zone_agent_id                        | feeder_number | location_description | status | device_id | deviceKeyId
-- -------------------------------------|---------------|---------------------|--------|-----------|-------------
-- bbe279dd-fafc-46cf-baa6-155274848aa4 | 1             | Zone 1 Prototype    | NORMAL | xxx...    | ac1b15fc
-- c2d8e9f0-1a2b-3c4d-5e6f-7890abcdef12 | 2             | Zone 2 Prototype    | NORMAL | yyy...    | 70f460bd
-- d3e9f0a1-2b3c-4d5e-6f7g-8901bcdefg23 | 3             | Zone 3 Prototype    | NORMAL | zzz...    | df8f6261
-- e4f0a1b2-3c4d-5e6f-7g8h-9012cdefgh34 | 99            | Tie Relay           | NORMAL | www...    | 68a3fd30


-- 2. Jika tidak ada DeviceAgent, buat dulu (opsional)
-- INSERT INTO "DeviceAgent" (zone_agent_id, name, api_key_id, api_key_hash)
-- VALUES
--     ((SELECT zone_agent_id FROM "ZoneAgent" WHERE feeder_number = 1), 'Zone 1 Device', 'ac1b15fc', 'dummy_hash_1'),
--     ((SELECT zone_agent_id FROM "ZoneAgent" WHERE feeder_number = 2), 'Zone 2 Device', '70f460bd', 'dummy_hash_2'),
--     ((SELECT zone_agent_id FROM "ZoneAgent" WHERE feeder_number = 3), 'Zone 3 Device', 'df8f6261', 'dummy_hash_3'),
--     ((SELECT zone_agent_id FROM "ZoneAgent" WHERE feeder_number = 99), 'Tie Device', '68a3fd30', 'dummy_hash_4');


-- 3. Copy zone_agent_id dan paste ke STM32 code di kZones[] array
-- Format untuk STM32:
-- static const ZoneConfig kZones[] = {
--     { "bbe279dd-fafc-46cf-baa6-155274848aa4", "ac1b15fc", "Zone 1 Prototype", 1 },
--     { "c2d8e9f0-1a2b-3c4d-5e6f-7890abcdef12", "70f460bd", "Zone 2 Prototype", 2 },
--     { "d3e9f0a1-2b3c-4d5e-6f7g-8901bcdefg23", "df8f6261", "Zone 3 Prototype", 3 },
--     { "e4f0a1b2-3c4d-5e6f-7g8h-9012cdefgh34", "68a3fd30", "Tie Relay", 99 },
-- };
