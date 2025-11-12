/**
 * Status Utility Functions
 *
 * Provides consistent status handling across the application for the new
 * state-aware status reporting system.
 */

export type ZoneStatus =
  | 'NORMAL'      // Healthy operation
  | 'FAULT'       // Overcurrent detected, protection active
  | 'TRIPPED'     // Relay opened due to fault at this node
  | 'ISOLATED'    // Relay opened by sequencing (fault is downstream)
  | 'LOCKOUT'     // Too many fault attempts, manual intervention required
  | 'OFFLINE'     // Hardware fault (relay closed but PZEM not reading)
  | 'OPEN';       // Relay manually opened or not energized

export type TieRelayStatus =
  | 'NORMAL'      // Normal radial operation, tie in standby
  | 'BACKUP'      // Providing backup power due to fault
  | 'PARALLEL'    // Operating in parallel mode
  | 'FAULT';      // System has faults, tie in standby

export type AllStatus = ZoneStatus | TieRelayStatus;

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: '✓' | '⚠️' | '🔴' | '🔒' | '🔌' | '○' | '🔄' | '⚡';
  severity: 'normal' | 'warning' | 'error' | 'info';
  description: string;
}

/**
 * Get status configuration for display
 */
export function getStatusConfig(status: AllStatus): StatusConfig {
  const configs: Record<AllStatus, StatusConfig> = {
    NORMAL: {
      label: 'Normal',
      color: '#10b981', // green-500
      bgColor: '#064e3b', // green-950
      borderColor: '#10b981', // green-500
      icon: '✓',
      severity: 'normal',
      description: 'System operating normally',
    },
    FAULT: {
      label: 'Fault',
      color: '#ef4444', // red-500
      bgColor: '#7f1d1d', // red-950
      borderColor: '#ef4444', // red-500
      icon: '🔴',
      severity: 'error',
      description: 'Overcurrent detected, protection active',
    },
    TRIPPED: {
      label: 'Tripped',
      color: '#dc2626', // red-600
      bgColor: '#7f1d1d', // red-950
      borderColor: '#dc2626', // red-600
      icon: '🔴',
      severity: 'error',
      description: 'Relay opened due to fault at this node',
    },
    ISOLATED: {
      label: 'Isolated',
      color: '#f59e0b', // amber-500
      bgColor: '#78350f', // amber-950
      borderColor: '#f59e0b', // amber-500
      icon: '⚠️',
      severity: 'warning',
      description: 'Relay opened by protection sequencing',
    },
    LOCKOUT: {
      label: 'Lockout',
      color: '#7c3aed', // violet-600
      bgColor: '#4c1d95', // violet-950
      borderColor: '#7c3aed', // violet-600
      icon: '🔒',
      severity: 'error',
      description: 'Too many fault attempts, manual intervention required',
    },
    OFFLINE: {
      label: 'Offline',
      color: '#6b7280', // gray-500
      bgColor: '#1f2937', // gray-800
      borderColor: '#6b7280', // gray-500
      icon: '🔌',
      severity: 'error',
      description: 'Hardware fault - PZEM not responding',
    },
    OPEN: {
      label: 'Open',
      color: '#94a3b8', // slate-400
      bgColor: '#1e293b', // slate-800
      borderColor: '#94a3b8', // slate-400
      icon: '○',
      severity: 'info',
      description: 'Relay manually opened or not energized',
    },
    BACKUP: {
      label: 'Backup',
      color: '#f59e0b', // amber-500
      bgColor: '#78350f', // amber-950
      borderColor: '#f59e0b', // amber-500
      icon: '🔄',
      severity: 'warning',
      description: 'Providing backup power to isolated zones',
    },
    PARALLEL: {
      label: 'Parallel',
      color: '#3b82f6', // blue-500
      bgColor: '#1e3a8a', // blue-950
      borderColor: '#3b82f6', // blue-500
      icon: '⚡',
      severity: 'info',
      description: 'Operating in parallel mode',
    },
  };

  return configs[status] || configs.NORMAL;
}

/**
 * Get Tailwind CSS classes for status badge
 */
export function getStatusBadgeClasses(status: AllStatus): string {
  const config = getStatusConfig(status);

  const baseClasses = 'px-2 py-1 rounded-md text-xs font-semibold';

  const colorClasses = {
    normal: 'bg-green-500/20 text-green-300 border border-green-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    error: 'bg-red-500/20 text-red-300 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  };

  return `${baseClasses} ${colorClasses[config.severity]}`;
}

/**
 * Get Tailwind CSS classes for status card
 */
export function getStatusCardClasses(status: AllStatus): string {
  const config = getStatusConfig(status);

  const baseClasses = 'transition-all';

  const colorClasses = {
    normal: 'border-green-500/50',
    warning: 'border-amber-500/50',
    error: 'border-red-500/50',
    info: 'border-blue-500/50',
  };

  return `${baseClasses} ${colorClasses[config.severity]}`;
}

/**
 * Determine if a status requires immediate attention
 */
export function requiresAttention(status: AllStatus): boolean {
  return ['FAULT', 'TRIPPED', 'LOCKOUT', 'OFFLINE'].includes(status);
}

/**
 * Determine if a status indicates healthy operation
 */
export function isHealthy(status: AllStatus): boolean {
  return ['NORMAL', 'PARALLEL'].includes(status);
}

/**
 * Get status priority for sorting (higher = more urgent)
 */
export function getStatusPriority(status: AllStatus): number {
  const priorities: Record<AllStatus, number> = {
    LOCKOUT: 90,
    FAULT: 80,
    TRIPPED: 70,
    OFFLINE: 60,
    ISOLATED: 50,
    BACKUP: 40,
    OPEN: 30,
    PARALLEL: 20,
    NORMAL: 10,
  };

  return priorities[status] || 0;
}

/**
 * Format status for display with icon
 */
export function formatStatus(status: AllStatus): string {
  const config = getStatusConfig(status);
  return `${config.icon} ${config.label}`;
}

/**
 * Get relay state color
 */
export function getRelayStateColor(state: 'OPEN' | 'CLOSED'): string {
  return state === 'CLOSED' ? '#10b981' : '#94a3b8';
}

/**
 * Check if telemetry is expected based on relay state and status
 */
export function expectsTelemetry(relayState: 'OPEN' | 'CLOSED', status: AllStatus): boolean {
  // If relay is CLOSED, we expect telemetry (unless OFFLINE)
  if (relayState === 'CLOSED') {
    return status !== 'OFFLINE';
  }

  // If relay is OPEN, we don't expect telemetry
  return false;
}

/**
 * Get status explanation for user
 */
export function getStatusExplanation(
  status: AllStatus,
  relayState: 'OPEN' | 'CLOSED',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _hasTelemetry: boolean
): string {
  if (status === 'OFFLINE' && relayState === 'CLOSED') {
    return '⚠️ Hardware fault detected! Relay is closed but PZEM is not responding. Check physical connections.';
  }

  if (status === 'TRIPPED') {
    return '🔴 Protection system opened this relay due to overcurrent fault. No telemetry expected until relay is closed.';
  }

  if (status === 'ISOLATED') {
    return '⚠️ This relay was opened by protection sequencing to isolate a downstream fault. No telemetry expected until restored.';
  }

  if (status === 'LOCKOUT') {
    return '🔒 This node has exceeded maximum auto-reset attempts. Manual intervention required to clear lockout.';
  }

  if (status === 'BACKUP') {
    return '🔄 Tie relay is providing backup power to zones isolated due to faults.';
  }

  if (status === 'PARALLEL') {
    return '⚡ Tie relay is operating in parallel mode - both sources are active.';
  }

  if (status === 'OPEN') {
    return '○ Relay is manually opened or system is not energized.';
  }

  return getStatusConfig(status).description;
}
