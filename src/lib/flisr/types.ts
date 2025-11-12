export type ZoneStatus =
  | "NORMAL"      // Healthy operation
  | "FAULT"       // Overcurrent detected, protection active
  | "TRIPPED"     // Relay opened due to fault at this node
  | "ISOLATED"    // Relay opened by sequencing (downstream fault)
  | "LOCKOUT"     // Too many attempts, needs manual reset
  | "OFFLINE"     // Hardware fault (relay closed but PZEM not reading)
  | "OPEN"        // Relay manually opened or not energized
  | "BACKUP"      // Tie relay providing backup power
  | "PARALLEL";   // Tie relay in parallel mode

export interface ZoneState {
  zone_agent_id: string;
  feeder_number: number;
  location_description: string | null;
  status: ZoneStatus;
}

export interface ConnectionState {
  grid_connection_id: string;
  from_zone_agent_id: string;
  to_zone_agent_id: string;
  connection_status: "ACTIVE" | "INACTIVE" | "CUT";
  is_faulty: boolean;
  length_km: number;
  resistance_ohm_km: number;
  inductance_h_km: number;
  capacitance_f_km: number;
}

export interface FaultContext {
  eventId: number;
  eventDescription: string | null;
  eventTimestamp: string;
  gridConnectionId: string;
  fromZoneId: string;
  fromZoneName: string | null;
  toZoneId: string;
  toZoneName: string | null;
  lengthKm: number;
  inductanceHKm: number;
  capacitanceFKm: number;
  timestampA: unknown;
  timestampB: unknown;
}

export type RestorationActionType = "OPEN_SWITCH" | "CLOSE_SWITCH" | "ISOLATE_SECTION" | "NOTIFY";

export interface RestorationAction {
  action: RestorationActionType;
  target_connection_id: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface RestorationPlan {
  actions: RestorationAction[];
  rationale: string[];
  estimatedNewLoss?: number;
}
