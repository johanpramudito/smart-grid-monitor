/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { randomBytes, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");
const { Pool } = require("pg");

const scrypt = promisify(scryptCallback);
const HASH_KEY_LENGTH = 64;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, HASH_KEY_LENGTH);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

function generateApiKey() {
  const id = randomBytes(4).toString("hex");
  const secret = randomBytes(18).toString("hex");
  return {
    apiKey: `sgm_${id}_${secret}`,
    apiKeyId: id,
  };
}

async function prompt(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const zoneAgentId = (await prompt("ZoneAgent ID (UUID): ")).trim();
  if (!zoneAgentId) {
    console.error("ZoneAgent ID is required.");
    process.exit(1);
  }

  const deviceName =
    (await prompt("Device name (optional): ")).trim() || null;
  const firmware =
    (await prompt("Firmware version (optional): ")).trim() || null;

  const client = await pool.connect();
  try {
    const { apiKey, apiKeyId } = generateApiKey();
    const apiKeyHash = await hashPassword(apiKey);

    const result = await client.query(
      `
        INSERT INTO "DeviceAgent"
          (zone_agent_id, name, api_key_id, api_key_hash, firmware_version)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING device_id, zone_agent_id, name, firmware_version
      `,
      [zoneAgentId, deviceName, apiKeyId, apiKeyHash, firmware]
    );

    const device = result.rows[0];
    console.log("\nDevice registered successfully:");
    console.log(`  device_id:     ${device.device_id}`);
    console.log(`  zone_agent_id: ${device.zone_agent_id}`);
    console.log(`  name:          ${device.name ?? "(none)"}`);
    console.log(`  firmware:      ${device.firmware_version ?? "(none)"}`);
    console.log(`  api_key:       ${apiKey}\n`);
    console.log(
      "Store this api_key on the STM32 / bridge; it will not be shown again."
    );
  } catch (error) {
    console.error(
      "Failed to register device:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
