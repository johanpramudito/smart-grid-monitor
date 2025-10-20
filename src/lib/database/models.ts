
// Based on the ERD from C251_A03_Revisi.pdf (Figure 8.8)

/**
 * Represents the overall grid system.
 */
export interface AgentSystem {
  agent_system_id: string; // Primary Key
  name: string;
  created_at: Date;
}

/**
 * Represents a specific zone within the grid, managed by a ZoneAgent.
 */
export interface ZoneAgent {
  zone_agent_id: string; // Primary Key
  agent_system_id: string; // Foreign Key to AgentSystem
  feeder_number: 1 | 2;
  location_description?: string;
  status: 'NORMAL' | 'FAULT' | 'ISOLATED' | 'OFFLINE';
  created_at: Date;
}

/**
 * Represents a physical sensor (e.g., ACS712, ZMPT101B).
 */
export interface Sensor {
  sensor_id: string; // Primary Key
  zone_agent_id: string; // Foreign Key to ZoneAgent
  type: 'CURRENT' | 'VOLTAGE';
  serial_number?: string;
  installed_at: Date;
}

/**
 * Represents a reading from a specific sensor at a point in time.
 */
export interface SensorReading {
  sensor_reading_id: string; // Primary Key
  sensor_id: string; // Foreign Key to Sensor
  current?: number; // Amperes
  voltage?: number; // Volts
  timestamp: Date;
}

/**
 * Represents a relay/switch in the grid.
 */
export interface Relay {
  relay_id: string; // Primary Key
  zone_agent_id: string; // Foreign Key to ZoneAgent
  relay_number: number;
  status: 'OPEN' | 'CLOSED'; // OPEN means off, CLOSED means on
}

/**
 * Represents the connection between two zones.
 */
export interface GridConnection {
  grid_connection_id: string; // Primary Key
  from_zone_agent_id: string; // Foreign Key to ZoneAgent
  to_zone_agent_id: string; // Foreign Key to ZoneAgent
  connection_status: 'ACTIVE' | 'INACTIVE' | 'CUT';
  is_faulty: boolean;
  updated_at: Date;
}

/**
 * Represents the agent controlling a switch on a GridConnection.
 */
export interface SwitchAgent {
  switch_agent_id: string; // Primary Key
  grid_connection_id: string; // Foreign Key to GridConnection
  logic_status: 'OPEN' | 'CLOSED';
  last_activated: Date;
}

/**
 * Represents a logged event (e.g., fault, restoration, error).
 */
export interface EventLog {
  event_id: string; // Primary Key
  zone_agent_id?: string; // Foreign Key to ZoneAgent, optional if system-wide event
  event_type: 'FAULT_DETECTED' | 'ISOLATION' | 'RESTORATION_SUCCESS' | 'RESTORATION_FAILURE' | 'SYSTEM_ERROR';
  description: string;
  timestamp: Date;
  resolved: boolean;
}
