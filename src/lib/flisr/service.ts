import { PoolClient } from "pg";
import {
  calculateFaultDistance,
  calculatePropagationSpeed,
  calculateTimeDeltaSeconds,
  FaultDistanceResult,
} from "./calculations";
import { deriveRestorationPlan } from "./planner";
import {
  ConnectionState,
  FaultContext,
  RestorationPlan,
  ZoneState,
  ZoneStatus,
} from "./types";
import { publishSwitchCommand } from "../mqtt/client";

async function fetchFaultContext(client: PoolClient, faultEventId: number): Promise<FaultContext> {
  const faultQuery = `
    SELECT
      e.event_id,
      e.description AS event_description,
      e.timestamp AS event_timestamp,
      fw.timestamp_a,
      fw.timestamp_b,
      gc.grid_connection_id,
      gc.from_zone_agent_id,
      gc.to_zone_agent_id,
      gc.length_km,
      gc.inductance_h_km,
      gc.capacitance_f_km,
      z_from.location_description AS from_zone_name,
      z_to.location_description AS to_zone_name
    FROM "EventLog" e
    JOIN "FaultWaveform" fw ON fw.event_id = e.event_id
    JOIN "GridConnection" gc ON fw.grid_connection_id = gc.grid_connection_id
    LEFT JOIN "ZoneAgent" z_from ON gc.from_zone_agent_id = z_from.zone_agent_id
    LEFT JOIN "ZoneAgent" z_to ON gc.to_zone_agent_id = z_to.zone_agent_id
    WHERE e.event_id = $1
      AND e.event_type = 'FAULT';
  `;

  const result = await client.query(faultQuery, [faultEventId]);

  if (result.rows.length === 0) {
    const error = new Error(`Fault event ${faultEventId} not found or has no associated waveform.`);
    error.name = "NotFoundError";
    throw error;
  }

  const row = result.rows[0];

  return {
    eventId: row.event_id,
    eventDescription: row.event_description ?? null,
    eventTimestamp: row.event_timestamp,
    gridConnectionId: row.grid_connection_id,
    fromZoneId: row.from_zone_agent_id,
    fromZoneName: row.from_zone_name ?? null,
    toZoneId: row.to_zone_agent_id,
    toZoneName: row.to_zone_name ?? null,
    lengthKm: Number(row.length_km),
    inductanceHKm: Number(row.inductance_h_km),
    capacitanceFKm: Number(row.capacitance_f_km),
    timestampA: row.timestamp_a,
    timestampB: row.timestamp_b,
  };
}

async function fetchNetworkState(client: PoolClient): Promise<{
  zones: ZoneState[];
  connections: ConnectionState[];
}> {
  const [zonesResult, connectionsResult] = await Promise.all([
    client.query(`
      SELECT zone_agent_id, feeder_number, location_description, status
      FROM "ZoneAgent";
    `),
    client.query(`
      SELECT
        grid_connection_id,
        from_zone_agent_id,
        to_zone_agent_id,
        connection_status,
        is_faulty,
        length_km,
        resistance_ohm_km,
        inductance_h_km,
        capacitance_f_km
      FROM "GridConnection";
    `),
  ]);

  return {
    zones: zonesResult.rows.map((row) => ({
      zone_agent_id: row.zone_agent_id,
      feeder_number: Number(row.feeder_number),
      location_description: row.location_description ?? null,
      status: row.status as ZoneStatus,
    })),
    connections: connectionsResult.rows.map((row) => ({
      grid_connection_id: row.grid_connection_id,
      from_zone_agent_id: row.from_zone_agent_id,
      to_zone_agent_id: row.to_zone_agent_id,
      connection_status: row.connection_status,
      is_faulty: row.is_faulty,
      length_km: Number(row.length_km),
      resistance_ohm_km: Number(row.resistance_ohm_km),
      inductance_h_km: Number(row.inductance_h_km),
      capacitance_f_km: Number(row.capacitance_f_km),
    })),
  };
}

async function persistOutcome(
  client: PoolClient,
  faultContext: FaultContext,
  plan: RestorationPlan,
  distanceResult: FaultDistanceResult,
) {
  await client.query("BEGIN");
  try {
    const timestamp = new Date().toISOString();

    // Mark the primary faulted connection as isolated.
    await client.query(
      `
        UPDATE "GridConnection"
        SET connection_status = 'CUT',
            is_faulty = TRUE,
            updated_at = NOW()
        WHERE grid_connection_id = $1
      `,
      [faultContext.gridConnectionId],
    );

    // Publish MQTT command to open the faulted switch
    await publishSwitchCommand({
      gridConnectionId: faultContext.gridConnectionId,
      command: 'OPEN',
      timestamp,
      source: 'FLISR',
      reason: 'Isolate detected faulted feeder segment',
    });

    for (const action of plan.actions) {
      if (action.action === "CLOSE_SWITCH") {
        await client.query(
          `
            UPDATE "GridConnection"
            SET connection_status = 'ACTIVE',
                is_faulty = FALSE,
                updated_at = NOW()
            WHERE grid_connection_id = $1
          `,
          [action.target_connection_id],
        );

        // Publish MQTT command to close the tie switch
        await publishSwitchCommand({
          gridConnectionId: action.target_connection_id,
          command: 'CLOSE',
          timestamp,
          source: 'FLISR',
          reason: action.reason,
        });
      }

      const description = [
        `FLISR Action: ${action.action}`,
        `Target: ${action.target_connection_id}`,
        `Reason: ${action.reason}`,
        action.metadata ? `Metadata: ${JSON.stringify(action.metadata)}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      await client.query(
        `
          INSERT INTO "EventLog" (event_type, description, resolved)
          VALUES ($1, $2, $3)
        `,
        ["SERVICE_RESTORATION", description, true],
      );
    }

    const analysisSummary = `Fault located ~${distanceResult.distanceFromStartMeters.toFixed(
      1,
    )} m from source (${faultContext.fromZoneName ?? faultContext.fromZoneId}).`;

    await client.query(
      `
        INSERT INTO "EventLog" (event_type, description, resolved)
        VALUES ($1, $2, $3)
      `,
      ["FAULT_ANALYSIS", analysisSummary, true],
    );

    await client.query(
      `UPDATE "EventLog" SET resolved = TRUE WHERE event_id = $1`,
      [faultContext.eventId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function runFlisrWorkflow(client: PoolClient, faultEventId: number) {
  const faultContext = await fetchFaultContext(client, faultEventId);

  const timeDeltaSeconds = calculateTimeDeltaSeconds(
    faultContext.timestampA,
    faultContext.timestampB,
  );
  const propagationSpeed = calculatePropagationSpeed(
    faultContext.inductanceHKm,
    faultContext.capacitanceFKm,
  );
  const distanceResult = calculateFaultDistance(
    faultContext.lengthKm,
    propagationSpeed,
    timeDeltaSeconds,
  );

  const { zones, connections } = await fetchNetworkState(client);
  const restorationPlan = deriveRestorationPlan(faultContext, zones, connections);

  await persistOutcome(client, faultContext, restorationPlan, distanceResult);

  return {
    faultContext,
    distanceResult,
    restorationPlan,
  };
}
