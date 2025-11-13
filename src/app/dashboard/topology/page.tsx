"use client";

import { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { ZapIcon, AlertTriangle } from "lucide-react";
import {
  nodeTypes,
  type ZoneStatus,
  type PowerSupplyNodeData,
  type SensorNodeData,
  type RelayNodeData,
  type TieRelayNodeData,
} from "@/components/topology/CustomNodes";

type ZoneNodeData = {
  label: string;
  status: ZoneStatus;
  feederNumber: number | null;
  isTie: boolean;
  activeFaults: number;
  faultDescription: string | null;
  lastFaultAt: string | null;
  deviceId: string | null;
  deviceLastSeen: string | null;
};

type ZoneNode = Node<ZoneNodeData>;

export default function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tieClosed, setTieClosed] = useState(false);

  const buildGraph = useCallback(
    (data: { nodes: ZoneNode[]; tieClosed?: boolean }) => {
      const mainZones = data.nodes
        .filter((node) => !node.data.isTie)
        .sort(
          (a, b) => (a.data.feederNumber ?? 0) - (b.data.feederNumber ?? 0)
        );
      const tieZone = data.nodes.find((node) => node.data.isTie) ?? null;

      const tieIsClosed =
        data.tieClosed ??
        mainZones.some((zone) => zone.data.status === "FAULT");

      // Layout configuration
      const startX = 120;
      const startY = 250;
      const spacing = 280;

      const graphNodes: Node[] = [];
      const graphEdges: Edge[] = [];

      // Helper function to check if device is online (communicating)
      const isDeviceOnline = (zone: ZoneNode) => {
        if (!zone.data.deviceLastSeen) return false;
        const lastSeenTime = new Date(zone.data.deviceLastSeen).getTime();
        const now = Date.now();
        const timeSinceLastSeen = now - lastSeenTime;
        // Consider offline if no communication in last 60 seconds
        return timeSinceLastSeen < 60000;
      };

      // Helper function to determine connection color and state
      const getConnectionColor = (zone: ZoneNode, isEnergized: boolean) => {
        // Check if device is communicating
        const deviceOnline = isDeviceOnline(zone);

        // OFFLINE = Gray (device not communicating or under maintenance)
        if (zone.data.status === "OFFLINE" || !deviceOnline) return "#64748b"; // Gray

        // FAULT = Red (fault detected, relay open for protection)
        if (zone.data.status === "FAULT") return "#ef4444"; // Red

        // ISOLATED = Orange (manually isolated or by FLISR)
        if (zone.data.status === "ISOLATED") return "#f97316"; // Orange

        // NOT ENERGIZED = Gray (upstream relay is open, no power)
        if (!isEnergized) return "#64748b"; // Gray

        // NORMAL = Green (powered and operational AND device is online)
        return "#10b981"; // Green
      };

      // Helper to check if zone should be animated (has power and working)
      const shouldAnimate = (zone: ZoneNode, isEnergized: boolean) => {
        const deviceOnline = isDeviceOnline(zone);
        return isEnergized && zone.data.status === "NORMAL" && deviceOnline;
      };

      // 1. PLN Power Source (leftmost)
      graphNodes.push({
        id: "pln",
        type: "powerSupply",
        position: { x: startX, y: startY },
        data: { label: "PLN" } as PowerSupplyNodeData,
        draggable: false,
        selectable: false,
      });

      let currentX = startX + 200;

      // Track if any previous relay is open (to gray out downstream connections)
      let anyPreviousRelayOpen = false;

      // 2. For each zone, create Sensor -> Relay pair
      mainZones.forEach((zone, index) => {
        const zoneId = zone.id;
        const sensorId = `sensor-${zoneId}`;
        const relayId = `relay-${zoneId}`;
        const feederNum = zone.data.feederNumber ?? index + 1;
        const status: ZoneStatus = zone.data.status;
        const deviceOnline = isDeviceOnline(zone);

        // Determine if this zone has power based on upstream conditions and device status
        const isEnergized =
          !anyPreviousRelayOpen && status !== "OFFLINE" && deviceOnline;

        // Sensor Node (V&A Meter)
        graphNodes.push({
          id: sensorId,
          type: "sensor",
          position: { x: currentX, y: startY },
          data: {
            label: zone.data.label || `Zone ${feederNum}`,
            status: deviceOnline ? status : "OFFLINE",
            feederNumber: feederNum,
            activeFaults: zone.data.activeFaults,
          } as SensorNodeData,
          draggable: false,
          selectable: true,
        });

        // Connect previous node to sensor
        const previousNodeId =
          index === 0 ? "pln" : `relay-${mainZones[index - 1].id}`;
        const connectionColor = getConnectionColor(zone, isEnergized);
        const animate = shouldAnimate(zone, isEnergized);

        graphEdges.push({
          id: `edge-${previousNodeId}-${sensorId}`,
          source: previousNodeId,
          target: sensorId,
          type: "straight",
          animated: animate,
          style: {
            stroke: connectionColor,
            strokeWidth: status === "FAULT" ? 5 : isEnergized ? 3 : 2,
            strokeDasharray: !isEnergized || !deviceOnline ? "8 4" : "0",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: connectionColor,
          },
        });

        currentX += 120;

        // Determine relay state based on zone status and device communication
        const relayState = !deviceOnline
          ? "UNKNOWN" // Device offline: state unknown
          : status === "FAULT"
          ? "OPEN" // Fault: relay opens for protection
          : status === "ISOLATED"
          ? "OPEN" // Isolated: relay open for isolation
          : status === "OFFLINE"
          ? "UNKNOWN" // Offline: state unknown
          : "CLOSED"; // Normal: relay closed

        // Relay Node (Circuit Breaker)
        graphNodes.push({
          id: relayId,
          type: "relay",
          position: { x: currentX, y: startY },
          data: {
            label: `CB${feederNum}`,
            status: deviceOnline ? status : "OFFLINE",
            feederNumber: feederNum,
            state: relayState,
          } as RelayNodeData,
          draggable: false,
          selectable: false,
        });

        // Connect sensor to relay (same color logic)
        graphEdges.push({
          id: `edge-${sensorId}-${relayId}`,
          source: sensorId,
          target: relayId,
          type: "straight",
          animated: animate,
          style: {
            stroke: connectionColor,
            strokeWidth: status === "FAULT" ? 5 : isEnergized ? 3 : 2,
            strokeDasharray: !isEnergized || !deviceOnline ? "8 4" : "0",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: connectionColor,
          },
        });

        // Update tracking: if this relay is OPEN or device offline, all downstream connections should be de-energized (gray)
        if (status === "FAULT" || status === "ISOLATED" || !deviceOnline) {
          anyPreviousRelayOpen = true;
        }

        currentX += spacing;
      });

      // 3. Tie Relay (at the end, vertically offset)
      const tieNodeId = tieZone?.id ?? "tie";
      const lastRelayId =
        mainZones.length > 0
          ? `relay-${mainZones[mainZones.length - 1].id}`
          : "pln";

      // Determine tie relay status and energization
      const tieStatus = tieZone?.data.status ?? "OFFLINE";
      const tieRelayState = tieIsClosed ? "CLOSED" : "OPEN";
      const tieDeviceOnline = tieZone ? isDeviceOnline(tieZone) : false;

      // Determine proper tie relay display status
      let tieDisplayStatus: ZoneStatus;
      if (!tieDeviceOnline || tieStatus === "OFFLINE") {
        tieDisplayStatus = "OFFLINE";
      } else if (tieStatus === "FAULT") {
        tieDisplayStatus = "FAULT";
      } else if (tieIsClosed) {
        tieDisplayStatus = "NORMAL"; // Closed and providing backup
      } else {
        tieDisplayStatus = "ISOLATED"; // Open (standby)
      }

      // Tie relay is energized if:
      // 1. Any upstream relay in main line is open (anyPreviousRelayOpen=true), AND
      // 2. Tie relay is CLOSED, AND
      // 3. Tie zone is not OFFLINE AND device is online
      const tieIsEnergized =
        anyPreviousRelayOpen &&
        tieIsClosed &&
        tieDeviceOnline &&
        tieStatus !== "OFFLINE";

      // Color for tie relay connections
      const tieConnectionColor = getConnectionColor(
        tieZone ??
          ({ data: { status: "OFFLINE", deviceLastSeen: null } } as ZoneNode),
        tieIsEnergized
      );

      // Animation for tie relay
      const tieAnimate = shouldAnimate(
        tieZone ??
          ({ data: { status: "OFFLINE", deviceLastSeen: null } } as ZoneNode),
        tieIsEnergized
      );

      graphNodes.push({
        id: tieNodeId,
        type: "tieRelay",
        position: { x: currentX - 100, y: startY + 180 },
        data: {
          label: "Tie Relay",
          status: tieDisplayStatus,
          state: tieRelayState,
          isTie: true,
        } as TieRelayNodeData,
        draggable: false,
        selectable: true,
      });

      // Connect last relay to tie relay
      // This connection should only be energized if upstream has faults (FLISR activated)
      const lastRelayToTieColor =
        anyPreviousRelayOpen && tieIsClosed ? tieConnectionColor : "#64748b";
      const lastRelayToTieAnimate =
        anyPreviousRelayOpen && tieIsClosed && tieAnimate;

      graphEdges.push({
        id: `edge-${lastRelayId}-${tieNodeId}`,
        source: lastRelayId,
        target: tieNodeId,
        type: "straight",
        animated: lastRelayToTieAnimate,
        style: {
          stroke: lastRelayToTieColor,
          strokeWidth: tieIsClosed ? 5 : 3,
          strokeDasharray: tieIsClosed ? "0" : "8 4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: lastRelayToTieColor,
        },
      });

      // Feeder 2 connection (from tie relay)
      const feeder2EndX = startX;
      const feeder2EndY = startY + 360;

      graphNodes.push({
        id: "feeder2-end",
        type: "powerSupply",
        position: { x: feeder2EndX, y: feeder2EndY },
        data: { label: "Feeder 2" } as PowerSupplyNodeData,
        draggable: false,
        selectable: false,
      });

      // Feeder 2 connection is energized only if tie is closed and functioning
      graphEdges.push({
        id: `edge-${tieNodeId}-feeder2`,
        source: tieNodeId,
        target: "feeder2-end",
        type: "straight",
        animated: tieAnimate,
        style: {
          stroke: tieConnectionColor,
          strokeWidth: tieIsClosed ? 5 : 3,
          strokeDasharray: tieIsClosed ? "0" : "8 4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: tieConnectionColor,
        },
      });

      return {
        nodes: graphNodes,
        edges: graphEdges,
        tieClosed: tieIsClosed,
      };
    },
    []
  );

  const fetchTopology = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setIsLoading(true);
      }
      try {
        const response = await fetch("/api/topology", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to fetch topology data");
        }
        const data: { nodes: ZoneNode[]; tieClosed?: boolean } =
          await response.json();

        const graph = buildGraph(data);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setTieClosed(graph.tieClosed);
        setError(null); // Clear any previous errors
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [setNodes, setEdges, buildGraph]
  );

  useEffect(() => {
    // Initial fetch with loading indicator
    fetchTopology(true);

    // Subsequent fetches without loading indicator (background refresh)
    // For Vercel: 500ms is safest, but 200ms works if traffic is low
    // For Azure App Service: 200ms is safe and provides real-time feel
    const interval = setInterval(() => {
      fetchTopology(false);
    }, 200); // Real-time updates (5 per second)

    return () => clearInterval(interval);
  }, [fetchTopology]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-slate-300">Loading Grid Topology...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1">
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ZapIcon className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
            <span className="break-words">Live Grid Topology (IEC 60617)</span>
          </h2>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Real-time visualization using IEC standard electrical symbols
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-500"></div>
              <span className="text-slate-300">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-500"></div>
              <span className="text-slate-300">Fault</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-slate-500"></div>
              <span className="text-slate-300">Offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`p-3 sm:p-4 rounded-lg border-2 ${
          tieClosed
            ? "bg-yellow-950 border-yellow-600"
            : "bg-green-950 border-green-600"
        }`}
      >
        <div className="flex items-center gap-3">
          {tieClosed ? (
            <>
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-yellow-200 text-sm sm:text-base">
                  FLISR Active - Fault Detected
                </p>
                <p className="text-xs sm:text-sm text-yellow-300">
                  Tie relay is CLOSED to restore power to healthy zones
                </p>
              </div>
            </>
          ) : (
            <>
              <ZapIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-green-200 text-sm sm:text-base">
                  Normal Operation
                </p>
                <p className="text-xs sm:text-sm text-green-300">
                  All zones operating normally - Tie relay OPEN
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Topology Canvas */}
      <div className="w-full h-[50vh] sm:h-[60vh] lg:h-[70vh] border-2 rounded-lg border-slate-700 bg-slate-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Controls />
          <Background color="#334155" gap={20} size={1} />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex flex-col items-center text-center">
          <div className="text-xs sm:text-sm font-semibold text-slate-300 mb-1">
            Power Source
          </div>
          <div className="text-xs text-slate-400">AC Generator (~)</div>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="text-xs sm:text-sm font-semibold text-slate-300 mb-1">
            V&A Meter
          </div>
          <div className="text-xs text-slate-400">PZEM Sensor</div>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="text-xs sm:text-sm font-semibold text-slate-300 mb-1">
            Circuit Breaker
          </div>
          <div className="text-xs text-slate-400">Relay Control</div>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="text-xs sm:text-sm font-semibold text-slate-300 mb-1">
            Tie Switch
          </div>
          <div className="text-xs text-slate-400">Normally Open</div>
        </div>
      </div>
    </div>
  );
}
