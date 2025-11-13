import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishRelayCommand } from "@/lib/mqtt/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/relay/restore-all
 *
 * Intelligently closes all OPEN feeder relays (excludes tie relay)
 * Only sends commands to relays that are actually OPEN
 * Designed for post-fault restoration by technicians
 */
export async function POST(request: NextRequest) {
  try {
    // Fetch all zones with their current relay states
    const zones = await db.query(
      `SELECT
        za.zone_agent_id,
        za.feeder_number,
        za.location_description,
        da.device_key_id,
        r.relay_id,
        r.state as relay_state
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

    // Filter zones with OPEN relays (exclude tie relay by checking feeder_number is not null)
    const openRelays = zones.rows.filter(
      (zone) => zone.relay_state === "OPEN" && zone.feeder_number !== null
    );

    if (openRelays.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All feeder relays are already closed",
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
        if (!zone.device_key_id) {
          errors.push({
            zoneId: zone.zone_agent_id,
            error: "No device key configured",
          });
          continue;
        }

        // Publish MQTT command to close relay
        const success = await publishRelayCommand(
          zone.device_key_id,
          1, // relay number (always 1 for zone relays)
          "CLOSED"
        );

        if (success) {
          // Update database relay state
          await db.query(
            `UPDATE "Relay"
             SET state = 'CLOSED', updated_at = NOW()
             WHERE relay_id = $1`,
            [zone.relay_id]
          );

          closedRelays.push({
            zoneId: zone.zone_agent_id,
            feederNumber: zone.feeder_number,
            location: zone.location_description || `Zone ${zone.feeder_number}`,
            deviceKeyId: zone.device_key_id,
          });
        } else {
          errors.push({
            zoneId: zone.zone_agent_id,
            error: "MQTT publish failed",
          });
        }
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
  }
}
