import React from 'react';

type ZoneStatus = 'NORMAL' | 'FAULT' | 'TRIPPED' | 'ISOLATED' | 'LOCKOUT' | 'OFFLINE' | 'OPEN' | 'BACKUP' | 'PARALLEL';

interface IECSymbolProps {
  status?: ZoneStatus;
  size?: number;
}

// Helper function to get color based on status
function getStatusColor(status: ZoneStatus): string {
  switch (status) {
    case 'NORMAL':
      return '#10b981'; // green-500
    case 'FAULT':
    case 'TRIPPED':
      return '#ef4444'; // red-500
    case 'LOCKOUT':
      return '#7c3aed'; // violet-600
    case 'ISOLATED':
    case 'BACKUP':
      return '#f59e0b'; // amber-500
    case 'OFFLINE':
      return '#6b7280'; // gray-500
    case 'OPEN':
      return '#94a3b8'; // slate-400
    case 'PARALLEL':
      return '#3b82f6'; // blue-500
    default:
      return '#10b981'; // default green
  }
}

// IEC 60617 Voltage Source (AC Generator)
export const VoltageSource: React.FC<IECSymbolProps> = ({ status = 'NORMAL', size = 60 }) => {
  const color = getStatusColor(status);

  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      <circle
        cx="30"
        cy="30"
        r="25"
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
      <text
        x="30"
        y="36"
        textAnchor="middle"
        fill={color}
        fontSize="24"
        fontWeight="bold"
      >
        ~
      </text>
    </svg>
  );
};

// IEC 60617 Circuit Breaker / Switch (Relay)
export const CircuitBreaker: React.FC<IECSymbolProps & { closed?: boolean }> = ({
  closed = false,
  size = 60,
  status = 'NORMAL'
}) => {
  const color = getStatusColor(status);

  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      {/* Connection points */}
      <line x1="30" y1="5" x2="30" y2="15" stroke={color} strokeWidth="3" />
      <line x1="30" y1="45" x2="30" y2="55" stroke={color} strokeWidth="3" />

      {/* Switch blade */}
      {closed ? (
        <line x1="30" y1="15" x2="30" y2="45" stroke={color} strokeWidth="4" />
      ) : (
        <line x1="30" y1="15" x2="40" y2="35" stroke={color} strokeWidth="4" />
      )}

      {/* Contact points */}
      <circle cx="30" cy="15" r="3" fill={color} />
      <circle cx="30" cy="45" r="3" fill={color} />

      {/* State indicator box */}
      <rect
        x="45"
        y="22"
        width="12"
        height="16"
        fill={closed ? color : 'none'}
        stroke={color}
        strokeWidth="2"
        rx="2"
      />
    </svg>
  );
};

// IEC 60617 Current Transformer / Sensor
export const CurrentSensor: React.FC<IECSymbolProps> = ({ status = 'NORMAL', size = 60 }) => {
  const color = getStatusColor(status);

  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      {/* Main circle (sensor body) */}
      <circle
        cx="30"
        cy="30"
        r="20"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
      />

      {/* Inner measurement symbol */}
      <circle
        cx="30"
        cy="30"
        r="14"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />

      {/* Current indicator (I) */}
      <text
        x="30"
        y="36"
        textAnchor="middle"
        fill={color}
        fontSize="16"
        fontWeight="bold"
      >
        I
      </text>

      {/* Connection terminals */}
      <circle cx="30" cy="8" r="2" fill={color} />
      <circle cx="30" cy="52" r="2" fill={color} />
    </svg>
  );
};

// IEC 60617 Voltage Transformer / Sensor
export const VoltageSensor: React.FC<IECSymbolProps> = ({ status = 'NORMAL', size = 60 }) => {
  const color = getStatusColor(status);

  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      {/* Main circle (sensor body) */}
      <circle
        cx="30"
        cy="30"
        r="20"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
      />

      {/* Inner measurement symbol */}
      <circle
        cx="30"
        cy="30"
        r="14"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />

      {/* Voltage indicator (V) */}
      <text
        x="30"
        y="36"
        textAnchor="middle"
        fill={color}
        fontSize="16"
        fontWeight="bold"
      >
        V
      </text>

      {/* Connection terminals */}
      <circle cx="30" cy="8" r="2" fill={color} />
      <circle cx="30" cy="52" r="2" fill={color} />
    </svg>
  );
};

// IEC 60617 Combined V&A Meter (PZEM Sensor)
export const PowerMeter: React.FC<IECSymbolProps & { label?: string }> = ({
  status = 'NORMAL',
  size = 80,
  label
}) => {
  const color = getStatusColor(status);
  const bgColor = status === 'FAULT' ? '#7f1d1d' : '#064e3b';

  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      {/* Outer box (meter housing) */}
      <rect
        x="10"
        y="10"
        width="60"
        height="60"
        fill={bgColor}
        stroke={color}
        strokeWidth="3"
        rx="4"
      />

      {/* Top measurement display */}
      <rect
        x="15"
        y="15"
        width="50"
        height="20"
        fill="#0f172a"
        stroke={color}
        strokeWidth="1.5"
        rx="2"
      />

      {/* V&A Label */}
      <text
        x="40"
        y="29"
        textAnchor="middle"
        fill={color}
        fontSize="12"
        fontWeight="bold"
      >
        V&A
      </text>

      {/* Bottom label */}
      {label && (
        <text
          x="40"
          y="55"
          textAnchor="middle"
          fill="#f1f5f9"
          fontSize="10"
          fontWeight="600"
        >
          {label}
        </text>
      )}

      {/* Connection terminals */}
      <circle cx="40" cy="3" r="3" fill={color} />
      <circle cx="40" cy="77" r="3" fill={color} />

      {/* Status indicator LED */}
      <circle
        cx="62"
        cy="18"
        r="4"
        fill={status === 'FAULT' ? '#ef4444' : '#22c55e'}
        opacity="0.9"
      />
    </svg>
  );
};

// IEC 60617 Bus Bar (Horizontal Line)
export const BusBar: React.FC<{
  width?: number;
  status?: 'NORMAL' | 'FAULT' | 'ISOLATED' | 'OFFLINE';
  energized?: boolean;
}> = ({ width = 200, status = 'NORMAL', energized = true }) => {
  const color = getStatusColor(status);
  const strokeWidth = status === 'FAULT' ? 6 : 4;

  return (
    <svg width={width} height="20" viewBox={`0 0 ${width} 20`}>
      <line
        x1="0"
        y1="10"
        x2={width}
        y2="10"
        stroke={energized ? color : '#475569'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {energized && status !== 'FAULT' && (
        <line
          x1="0"
          y1="10"
          x2={width}
          y2="10"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity="0.4"
        >
          <animate
            attributeName="stroke-dasharray"
            values="0,200;200,0"
            dur="2s"
            repeatCount="indefinite"
          />
        </line>
      )}
    </svg>
  );
};

// IEC 60617 Tie Switch (Normally Open)
export const TieSwitch: React.FC<{
  closed?: boolean;
  status?: 'NORMAL' | 'FAULT' | 'ISOLATED' | 'OFFLINE';
  size?: number;
}> = ({ closed = false, status = 'NORMAL', size = 80 }) => {
  const color = closed
    ? (status === 'FAULT' ? '#ef4444' : '#22c55e')
    : '#64748b';
  const bgColor = closed
    ? (status === 'FAULT' ? '#7f1d1d' : '#14532d')
    : '#1e293b';

  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      {/* Outer housing */}
      <rect
        x="10"
        y="10"
        width="60"
        height="60"
        fill={bgColor}
        stroke={color}
        strokeWidth="3"
        rx="8"
      />

      {/* Connection points */}
      <line x1="40" y1="5" x2="40" y2="20" stroke={color} strokeWidth="3" />
      <line x1="40" y1="60" x2="40" y2="75" stroke={color} strokeWidth="3" />

      {/* Switch blade */}
      {closed ? (
        <>
          <line x1="40" y1="25" x2="40" y2="55" stroke={color} strokeWidth="5" />
          <text
            x="40"
            y="44"
            textAnchor="middle"
            fill="#fff"
            fontSize="14"
            fontWeight="bold"
          >
            TIE
          </text>
        </>
      ) : (
        <>
          <line x1="40" y1="25" x2="52" y2="48" stroke={color} strokeWidth="5" />
          <text
            x="40"
            y="44"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="14"
            fontWeight="bold"
          >
            TIE
          </text>
        </>
      )}

      {/* Contact points */}
      <circle cx="40" cy="25" r="4" fill={color} />
      <circle cx="40" cy="55" r="4" fill={color} />

      {/* Status text */}
      <text
        x="40"
        y="68"
        textAnchor="middle"
        fill={color}
        fontSize="8"
        fontWeight="600"
      >
        {closed ? 'CLOSED' : 'OPEN'}
      </text>
    </svg>
  );
};
