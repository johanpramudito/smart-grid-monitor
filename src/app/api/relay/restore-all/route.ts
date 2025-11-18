import { NextResponse } from "next/server";
import { pool } from "@/lib/database/connection";
import { publishRelayCommand } from "@/lib/mqtt/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/relay/restore-all
 *
 * Intelligently closes all OPEN feeder relays (excludes tie relay)
 * Only sends commands to relays that are actually OPEN
 * Designed for post-fault restoration by technicians
 */
export async function POST() {
  const client = await pool.connect();

  try {
    // Fetch all zones with their current relay states and fault status
    const zones = await client.query(
      `SELECT
        za.zone_agent_id,
        za.feeder_number,
        za.location_description,
        za.status as zone_status,
        da.api_key_id,
        r.relay_id,
        r.status as relay_status
       FROM "ZoneAgent" za
       LEFT JOIN "DeviceAgent" da ON za.zone_agent_id = da.zone_agent_id
       LEFT JOIN "Relay" r ON za.zone_agent_id = r.zone_agent_id
       WHERE za.feeder_number IS NOT NULL
       ORDER BY za.feeder_number ASC`
    );

    if (!zones.rows || zones.rows.length === 0) {
      return NextResponse.json(
        { error: "No zones found" },
        { status: 404 }
      );
    }

    // Check if zone 3 has a fault (if so, don't restore anything to prevent tie relay issues)
    const zone3 = zones.rows.find((zone) => zone.feeder_number === 3);
    if (zone3 && (zone3.zone_status === "FAULT" || zone3.zone_status === "LOCKOUT")) {
      return NextResponse.json({
        success: false,
        message: "Cannot restore relays: Zone 3 has a fault. Tie relay must remain open.",
        relaysClosed: 0,
        zones: [],
      });
    }

    // Filter zones with OPEN relays that are NORMAL status (exclude tie relay and zones still in fault)
    const openRelays = zones.rows.filter(
      (zone) =>
        zone.relay_status === "OPEN" &&
        zone.zone_status === "NORMAL" && // Only restore zones that are no longer in fault
        zone.feeder_number !== null &&
        zone.feeder_number <= 3 && // Exclude tie relay (feeder 99)
        zone.feeder_number > 0 // Only actual feeders
    );

    console.log(`[RESTORE-ALL] Found ${zones.rows.length} zones total`);
    console.log(`[RESTORE-ALL] Zone 3 status: ${zone3?.zone_status || 'NOT FOUND'}`);
    console.log(`[RESTORE-ALL] Found ${openRelays.length} NORMAL zones with OPEN relays ready for restoration`);
    openRelays.forEach(zone => {
      console.log(`  - Zone ${zone.feeder_number} (${zone.zone_agent_id}): relay_status=${zone.relay_status}, zone_status=${zone.zone_status}, api_key_id=${zone.api_key_id}`);
    });

    if (openRelays.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No relays need restoration (all NORMAL zones have closed relays)",
        relaysClosed: 0,
        zones: [],
      });
    }

    // Send CLOSE commands to each open relay via MQTT
    const closedRelays: Array<{
      zoneId: string;
      feederNumber: number;
      location: string;
      deviceKeyId: string;
    }> = [];

    const errors: Array<{ zoneId: string; error: string }> = [];

    for (const zone of openRelays) {
      try {
        // Double-check: never send commands to tie relay or zones still in fault
        if (zone.feeder_number > 3 || zone.feeder_number === 99) {
          console.log(`[RESTORE-ALL] Skipping tie relay (feeder ${zone.feeder_number})`);
          continue;
        }

        if (zone.zone_status === "FAULT" || zone.zone_status === "LOCKOUT") {
          console.log(`[RESTORE-ALL] Skipping zone ${zone.feeder_number} due to ${zone.zone_status} status`);
          continue;
        }

        if (!zone.api_key_id) {
          errors.push({
            zoneId: zone.zone_agent_id,
            error: "No API key configured",
          });
          continue;
        }

        // Publish MQTT command to close relay
        console.log(`[RESTORE-ALL] Sending CLOSE command to zone ${zone.feeder_number} (${zone.zone_agent_id})`);
        await publishRelayCommand({
          zoneId: zone.zone_agent_id,
          relayNumber: 1, // always 1 for zone relays
          command: "CLOSED",
          timestamp: new Date().toISOString(),
          source: "MANUAL",
        });
        console.log(`[RESTORE-ALL] Command sent successfully to zone ${zone.feeder_number}`);

        // Add delay to allow ESP32 to process the command before sending the next one
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay

        // Update database relay status
        await client.query(
          `UPDATE "Relay"
           SET status = 'CLOSED'
           WHERE relay_id = $1`,
          [zone.relay_id]
        );

        closedRelays.push({
          zoneId: zone.zone_agent_id,
          feederNumber: zone.feeder_number,
          location: zone.location_description || `Zone ${zone.feeder_number}`,
          deviceKeyId: zone.api_key_id,
        });
      } catch (err) {
        console.error(`Error closing relay for zone ${zone.zone_agent_id}:`, err);
        errors.push({
          zoneId: zone.zone_agent_id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Restoration initiated for ${closedRelays.length} relay(s)`,
      relaysClosed: closedRelays.length,
      zones: closedRelays,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in restore-all API:", error);
    return NextResponse.json(
      {
        error: "Failed to restore relays",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
