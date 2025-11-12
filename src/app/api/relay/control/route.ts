/**
 * POST /api/relay/control
 *
 * Force manual relay control (ON/OFF/AUTO) for a specific zone.
 * - CLOSED/ON: Close the relay contact (manual override)
 * - OPEN/OFF: Open the relay contact (manual override)
 * - AUTO: Exit manual override mode and return to automatic protection
 *
 * This endpoint updates the relay status in the database (for OPEN/CLOSED commands)
 * and publishes an MQTT command to the IoT device.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/database/connection';
import { publishRelayCommand, RelayCommand } from '@/lib/mqtt/client';

/**
 * Validation schema for relay control request
 */
const relayControlSchema = z.object({
  zoneAgentId: z.string().uuid('Invalid zone agent ID format'),
  relayNumber: z.number().int().positive('Relay number must be positive'),
  command: z.enum(['CLOSED', 'OPEN', 'ON', 'OFF', 'AUTO'], {
    message: 'Command must be CLOSED, OPEN, ON, OFF, or AUTO',
  }),
});

export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = relayControlSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { zoneAgentId, relayNumber, command: rawCommand } = validation.data;

    // Normalize command: CLOSED/ON -> CLOSED, OPEN/OFF -> OPEN
    const command = rawCommand === 'ON' ? 'CLOSED' : rawCommand === 'OFF' ? 'OPEN' : rawCommand;

    // Check if zone exists and is not in FAULT state
    const zoneCheck = await client.query(
      `
      SELECT zone_agent_id, location_description, status
      FROM "ZoneAgent"
      WHERE zone_agent_id = $1
      `,
      [zoneAgentId]
    );

    if (zoneCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Zone not found' },
        { status: 404 }
      );
    }

    const zone = zoneCheck.rows[0];

    // Handle AUTO command specially - it exits manual override mode
    // without directly changing relay state in database
    if (command === 'AUTO') {
      // Log the AUTO command event
      await client.query(
        `
        INSERT INTO "EventLog" (
          zone_agent_id,
          event_type,
          description,
          resolved
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          zoneAgentId,
          'AUTO_PROTECTION',
          `Manual override exit requested - Relay ${relayNumber} returning to automatic protection mode`,
          true,
        ]
      );

      // Publish MQTT AUTO command to STM32
      const timestamp = new Date().toISOString();
      await publishRelayCommand({
        zoneId: zoneAgentId,
        relayNumber,
        command: 'AUTO',
        timestamp,
        source: 'MANUAL',
      });

      return NextResponse.json(
        {
          message: `Relay ${relayNumber} returning to automatic protection mode`,
          relay: {
            zone_agent_id: zoneAgentId,
            relay_number: relayNumber,
            command_sent: 'AUTO',
            timestamp,
          },
        },
        { status: 200 }
      );
    }

    // Allow manual override even during fault (removed restriction)
    // WARNING: This allows operators to override protection systems
    // Consider logging this as a critical action for audit trail

    // Check if relay exists for this zone
    const relayCheck = await client.query(
      `
      SELECT relay_id, status
      FROM "Relay"
      WHERE zone_agent_id = $1 AND relay_number = $2
      `,
      [zoneAgentId, relayNumber]
    );

    if (relayCheck.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Relay not found',
          message: `No relay with number ${relayNumber} found for this zone`,
        },
        { status: 404 }
      );
    }

    const relay = relayCheck.rows[0];
    const newStatus = command === 'CLOSED' ? 'CLOSED' : 'OPEN';

    // NOTE: We do NOT check if relay.status === newStatus because:
    // 1. Database is a CACHE, STM32 GPIO is the SOURCE OF TRUTH
    // 2. After protection trips, STM32 opens relay but DB may not update immediately
    // 3. Always send MQTT command to ensure physical state matches intent
    // 4. Database will sync when telemetry arrives

    // Begin transaction
    await client.query('BEGIN');

    try {
      // Update relay status in database
      await client.query(
        `
        UPDATE "Relay"
        SET status = $1
        WHERE relay_id = $2
        `,
        [newStatus, relay.relay_id]
      );

      // Log the manual override action to EventLog
      // Add special warning if overriding during fault
      const isFaultOverride = zone.status === 'FAULT';
      const description = isFaultOverride
        ? `⚠️ CRITICAL: Manual relay control during FAULT - Relay ${relayNumber} turned ${command} (${newStatus})`
        : `Manual relay control: Relay ${relayNumber} turned ${command} (${newStatus})`;

      await client.query(
        `
        INSERT INTO "EventLog" (
          zone_agent_id,
          event_type,
          description,
          resolved
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          zoneAgentId,
          isFaultOverride ? 'CRITICAL_OVERRIDE' : 'MANUAL_OVERRIDE',
          description,
          true, // Manual actions are immediately resolved
        ]
      );

      // Publish MQTT command to the IoT device
      const timestamp = new Date().toISOString();
      await publishRelayCommand({
        zoneId: zoneAgentId,
        relayNumber,
        command: command as RelayCommand,
        timestamp,
        source: 'MANUAL',
      });

      // Commit transaction
      await client.query('COMMIT');

      return NextResponse.json(
        {
          message: `Relay ${command} command sent successfully`,
          relay: {
            relay_id: relay.relay_id,
            zone_agent_id: zoneAgentId,
            relay_number: relayNumber,
            status: newStatus,
            command_sent: command,
            timestamp,
          },
        },
        { status: 200 }
      );
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('[API] Relay control error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message:
          error instanceof Error ? error.message : 'Failed to control relay',
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
