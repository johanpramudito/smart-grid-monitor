import {
  ConnectionState,
  FaultContext,
  RestorationAction,
  RestorationPlan,
  ZoneState,
} from "./types";

function findTieSwitchCandidate(
  faultContext: FaultContext,
  zones: ZoneState[],
  connections: ConnectionState[],
) {
  const candidate = connections.find((conn) => {
    if (conn.grid_connection_id === faultContext.gridConnectionId) {
      return false;
    }
    if (conn.connection_status !== "INACTIVE") {
      return false;
    }
    if (conn.is_faulty) {
      return false;
    }
    return (
      conn.from_zone_agent_id === faultContext.fromZoneId ||
      conn.from_zone_agent_id === faultContext.toZoneId ||
      conn.to_zone_agent_id === faultContext.fromZoneId ||
      conn.to_zone_agent_id === faultContext.toZoneId
    );
  });

  if (!candidate) {
    return null;
  }

  const fromZone = zones.find((zone) => zone.zone_agent_id === candidate.from_zone_agent_id) ?? null;
  const toZone = zones.find((zone) => zone.zone_agent_id === candidate.to_zone_agent_id) ?? null;

  return {
    connection: candidate,
    fromZone,
    toZone,
  };
}

export function deriveRestorationPlan(
  faultContext: FaultContext,
  zones: ZoneState[],
  connections: ConnectionState[],
): RestorationPlan {
  const rationale: string[] = [];
  const actions: RestorationAction[] = [
    {
      action: "OPEN_SWITCH",
      target_connection_id: faultContext.gridConnectionId,
      reason: "Isolate the detected faulted feeder segment.",
      metadata: {
        eventId: faultContext.eventId,
        fromZoneId: faultContext.fromZoneId,
        toZoneId: faultContext.toZoneId,
      },
    },
  ];

  rationale.push(
    `Fault located on connection ${faultContext.gridConnectionId} between zones ${faultContext.fromZoneName ?? faultContext.fromZoneId
    } and ${faultContext.toZoneName ?? faultContext.toZoneId}.`,
  );

  const tieCandidate = findTieSwitchCandidate(faultContext, zones, connections);

  if (tieCandidate) {
    const { connection, fromZone, toZone } = tieCandidate;
    actions.push({
      action: "CLOSE_SWITCH",
      target_connection_id: connection.grid_connection_id,
      reason: "Backfeed downstream loads through healthy alternate path.",
      metadata: {
        fromZoneId: connection.from_zone_agent_id,
        toZoneId: connection.to_zone_agent_id,
        fromZoneName: fromZone?.location_description ?? null,
        toZoneName: toZone?.location_description ?? null,
      },
    });
    rationale.push(
      `Tie switch ${connection.grid_connection_id} selected (currently ${connection.connection_status}).`,
    );
    return {
      actions,
      rationale,
    };
  }

  rationale.push("No viable tie switch found. Escalating to operator for manual restoration.");
  actions.push({
    action: "NOTIFY",
    target_connection_id: faultContext.gridConnectionId,
    reason: "No automated restoration path available.",
    metadata: {
      escalation: "DISPATCH_CREW",
    },
  });

  return {
    actions,
    rationale,
  };
}
