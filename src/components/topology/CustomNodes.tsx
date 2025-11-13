import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  VoltageSource,
  CircuitBreaker,
  PowerMeter,
  TieSwitch,
} from './IECSymbols';

export type ZoneStatus = 'NORMAL' | 'FAULT' | 'ISOLATED' | 'OFFLINE';

export interface PowerSupplyNodeData {
  label: string;
}

export interface SensorNodeData {
  label: string;
  status: ZoneStatus;
  feederNumber: number;
  activeFaults: number;
}

export interface RelayNodeData {
  label: string;
  status: ZoneStatus;
  feederNumber: number;
  state: 'OPEN' | 'CLOSED' | 'UNKNOWN';
}

export interface TieRelayNodeData {
  label: string;
  status: ZoneStatus;
  state: 'OPEN' | 'CLOSED';
  isTie: boolean;
}

// PLN Power Supply Node
export function PowerSupplyNode({ data }: NodeProps<PowerSupplyNodeData>) {
  return (
    <div className="flex flex-col items-center">
      <VoltageSource status="NORMAL" size={80} />
      <div className="mt-1 sm:mt-2 text-xs sm:text-sm font-bold text-slate-200 bg-slate-800 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md border border-slate-600 whitespace-nowrap">
        {data.label}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#10b981',
          width: '12px',
          height: '12px',
          border: '2px solid #065f46',
        }}
      />
    </div>
  );
}

// V&A Sensor Node (PZEM)
export function SensorNode({ data, id }: NodeProps<SensorNodeData>) {
  return (
    <div className="flex flex-col items-center cursor-pointer" data-zone-id={id}>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: data.status === 'FAULT' ? '#ef4444' : '#10b981',
          width: '12px',
          height: '12px',
          border: `2px solid ${data.status === 'FAULT' ? '#7f1d1d' : '#065f46'}`,
        }}
      />

      <PowerMeter
        status={data.status}
        size={90}
        label={`F${data.feederNumber}`}
      />

      <div className={`mt-1 sm:mt-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
        data.status === 'FAULT'
          ? 'bg-red-900 text-red-200 border border-red-600'
          : 'bg-green-900 text-green-200 border border-green-600'
      }`}>
        {data.label}
      </div>

      {data.activeFaults > 0 && (
        <div className="mt-0.5 sm:mt-1 px-1.5 sm:px-2 py-0.5 bg-red-600 text-white text-[9px] sm:text-xs rounded-full font-bold whitespace-nowrap">
          ⚠ {data.activeFaults} Fault{data.activeFaults > 1 ? 's' : ''}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: data.status === 'FAULT' ? '#ef4444' : '#10b981',
          width: '12px',
          height: '12px',
          border: `2px solid ${data.status === 'FAULT' ? '#7f1d1d' : '#065f46'}`,
        }}
      />
    </div>
  );
}

// Relay/Circuit Breaker Node
export function RelayNode({ data }: NodeProps<RelayNodeData>) {
  const closed = data.state === 'CLOSED';

  return (
    <div className="flex flex-col items-center">
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: data.status === 'FAULT' ? '#ef4444' : '#10b981',
          width: '12px',
          height: '12px',
          border: `2px solid ${data.status === 'FAULT' ? '#7f1d1d' : '#065f46'}`,
        }}
      />

      <CircuitBreaker
        closed={closed}
        status={data.status}
        size={70}
      />

      <div className={`mt-0.5 sm:mt-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
        closed
          ? 'bg-green-900 text-green-200 border border-green-600'
          : 'bg-slate-800 text-slate-300 border border-slate-600'
      }`}>
        {data.label}
      </div>

      <div className="mt-0.5 text-[9px] sm:text-xs font-mono text-slate-400 whitespace-nowrap">
        {closed ? 'CLOSED' : 'OPEN'}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: closed
            ? (data.status === 'FAULT' ? '#ef4444' : '#10b981')
            : '#64748b',
          width: '12px',
          height: '12px',
          border: `2px solid ${
            closed
              ? (data.status === 'FAULT' ? '#7f1d1d' : '#065f46')
              : '#334155'
          }`,
        }}
      />
    </div>
  );
}

// Tie Relay Node
export function TieRelayNode({ data }: NodeProps<TieRelayNodeData>) {
  const closed = data.state === 'CLOSED';

  return (
    <div className="flex flex-col items-center">
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: closed ? '#22c55e' : '#64748b',
          width: '14px',
          height: '14px',
          border: `3px solid ${closed ? '#14532d' : '#334155'}`,
          top: '-7px',
        }}
      />

      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: closed ? '#22c55e' : '#64748b',
          width: '14px',
          height: '14px',
          border: `3px solid ${closed ? '#14532d' : '#334155'}`,
        }}
      />

      <TieSwitch
        closed={closed}
        status={data.status}
        size={100}
      />

      <div className={`mt-1 sm:mt-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-bold whitespace-nowrap ${
        closed
          ? 'bg-green-600 text-white border-2 border-green-400'
          : 'bg-slate-700 text-slate-300 border-2 border-slate-500'
      }`}>
        {data.label}
      </div>

      {closed && (
        <div className="mt-0.5 sm:mt-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-yellow-600 text-yellow-50 text-[10px] sm:text-xs rounded-full font-semibold animate-pulse whitespace-nowrap">
          ⚡ ENERGIZED
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: closed ? '#22c55e' : '#64748b',
          width: '14px',
          height: '14px',
          border: `3px solid ${closed ? '#14532d' : '#334155'}`,
          bottom: '-7px',
        }}
      />
    </div>
  );
}

// Export node types for ReactFlow
export const nodeTypes = {
  powerSupply: PowerSupplyNode,
  sensor: SensorNode,
  relay: RelayNode,
  tieRelay: TieRelayNode,
};
