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

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, ZapIcon, AlertTriangle } from "lucide-react";
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
  faultEventId: number | null;
  faultDescription: string | null;
  lastFaultAt: string | null;
  deviceId: string | null;
  deviceLastSeen: string | null;
};

type ZoneNode = Node<ZoneNodeData>;
type FlisrResponsePayload = Record<string, unknown>;

export default function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [flisrResult, setFlisrResult] = useState<FlisrResponsePayload | null>(null);
  const [isFlisrLoading, setIsFlisrLoading] = useState(false);
  const [faultEventId, setFaultEventId] = useState<number | null>(null);
  const [tieClosed, setTieClosed] = useState(false);

  const buildGraph = useCallback(
    (data: { nodes: ZoneNode[]; tieClosed?: boolean }) => {
      const mainZones = data.nodes
        .filter((node) => !node.data.isTie)
        .sort((a, b) => (a.data.feederNumber ?? 0) - (b.data.feederNumber ?? 0));
      const tieZone = data.nodes.find((node) => node.data.isTie) ?? null;

      const tieIsClosed = data.tieClosed ?? mainZones.some((zone) => zone.data.status === "FAULT");

      // Layout configuration
      const startX = 120;
      const startY = 250;
      const spacing = 280;

      const graphNodes: Node[] = [];
      const graphEdges: Edge[] = [];

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
        const isFault = zone.data.status === "FAULT";

        // Sensor Node (V&A Meter)
        graphNodes.push({
          id: sensorId,
          type: "sensor",
          position: { x: currentX, y: startY },
          data: {
            label: zone.data.label || `Zone ${feederNum}`,
            status: zone.data.status,
            feederNumber: feederNum,
            activeFaults: zone.data.activeFaults,
          } as SensorNodeData,
          draggable: false,
          selectable: true,
        });

        // Connect previous node to sensor
        // Gray out if any previous relay is OPEN (de-energized)
        const previousNodeId = index === 0 ? "pln" : `relay-${mainZones[index - 1].id}`;
        const isEnergized = !anyPreviousRelayOpen;

        graphEdges.push({
          id: `edge-${previousNodeId}-${sensorId}`,
          source: previousNodeId,
          target: sensorId,
          type: "straight",
          animated: isEnergized && !isFault,
          style: {
            stroke: !isEnergized ? "#64748b" : (isFault ? "#ef4444" : "#10b981"),
            strokeWidth: !isEnergized ? 2 : (isFault ? 5 : 3),
            strokeDasharray: !isEnergized ? "8 4" : "0",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: !isEnergized ? "#64748b" : (isFault ? "#ef4444" : "#10b981"),
          },
        });

        currentX += 120;

        // Relay Node (Circuit Breaker)
        graphNodes.push({
          id: relayId,
          type: "relay",
          position: { x: currentX, y: startY },
          data: {
            label: `CB${feederNum}`,
            status: zone.data.status,
            feederNumber: feederNum,
            state: isFault ? "OPEN" : "CLOSED",
          } as RelayNodeData,
          draggable: false,
          selectable: false,
        });

        // Connect sensor to relay
        // If previous relay was open OR current zone offline, gray this out too
        const sensorToRelayEnergized = isEnergized && zone.data.status !== "OFFLINE";

        graphEdges.push({
          id: `edge-${sensorId}-${relayId}`,
          source: sensorId,
          target: relayId,
          type: "straight",
          animated: sensorToRelayEnergized && !isFault,
          style: {
            stroke: !sensorToRelayEnergized ? "#64748b" : (isFault ? "#ef4444" : "#10b981"),
            strokeWidth: !sensorToRelayEnergized ? 2 : (isFault ? 5 : 3),
            strokeDasharray: !sensorToRelayEnergized ? "8 4" : "0",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: !sensorToRelayEnergized ? "#64748b" : (isFault ? "#ef4444" : "#10b981"),
          },
        });

        // Update tracking: if this relay is OPEN (fault), all downstream should be gray
        if (isFault || zone.data.status === "ISOLATED" || zone.data.status === "OFFLINE") {
          anyPreviousRelayOpen = true;
        }

        currentX += spacing;
      });

      // 3. Tie Relay (at the end, vertically offset)
      const tieNodeId = tieZone?.id ?? "tie";
      const lastRelayId = mainZones.length > 0 ? `relay-${mainZones[mainZones.length - 1].id}` : "pln";

      graphNodes.push({
        id: tieNodeId,
        type: "tieRelay",
        position: { x: currentX - 100, y: startY + 180 },
        data: {
          label: "Tie Relay",
          status: tieIsClosed ? "FAULT" : "NORMAL",
          state: tieIsClosed ? "CLOSED" : "OPEN",
          isTie: true,
        } as TieRelayNodeData,
        draggable: false,
        selectable: true,
      });

      // Connect last relay to tie relay
      graphEdges.push({
        id: `edge-${lastRelayId}-${tieNodeId}`,
        source: lastRelayId,
        target: tieNodeId,
        type: "straight",
        animated: tieIsClosed,
        style: {
          stroke: tieIsClosed ? "#22c55e" : "#64748b",
          strokeWidth: tieIsClosed ? 5 : 3,
          strokeDasharray: tieIsClosed ? "0" : "8 4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: tieIsClosed ? "#22c55e" : "#64748b",
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

      graphEdges.push({
        id: `edge-${tieNodeId}-feeder2`,
        source: tieNodeId,
        target: "feeder2-end",
        type: "straight",
        animated: tieIsClosed,
        style: {
          stroke: tieIsClosed ? "#22c55e" : "#64748b",
          strokeWidth: tieIsClosed ? 5 : 3,
          strokeDasharray: tieIsClosed ? "0" : "8 4",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: tieIsClosed ? "#22c55e" : "#64748b",
        },
      });

      const firstFaultNode = mainZones.find((zone) => zone.data.faultEventId !== null);

      return {
        nodes: graphNodes,
        edges: graphEdges,
        faultEventId: firstFaultNode?.data.faultEventId ?? null,
        tieClosed: tieIsClosed,
      };
    },
    []
  );

  const fetchTopology = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/topology");
      if (!response.ok) {
        throw new Error("Failed to fetch topology data");
      }
      const data: { nodes: ZoneNode[]; tieClosed?: boolean } = await response.json();

      const graph = buildGraph(data);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setFaultEventId(graph.faultEventId);
      setTieClosed(graph.tieClosed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges, buildGraph]);

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(() => {
      fetchTopology();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTopology]);

  const handleTriggerFlisr = async () => {
    if (!faultEventId) {
      setFlisrResult({ message: "No active fault event to process." });
      return;
    }
    setIsFlisrLoading(true);
    setFlisrResult(null);
    try {
      const response = await fetch("/api/flisr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faultEventId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "An error occurred during the FLISR process.");
      }
      setFlisrResult(result);
      fetchTopology();
    } catch (error) {
      setFlisrResult({
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsFlisrLoading(false);
    }
  };

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
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <ZapIcon className="w-8 h-8 text-yellow-400" />
            Live Grid Topology (IEC 60617)
          </h2>
          <p className="text-slate-400 mt-1">
            Real-time visualization using IEC standard electrical symbols
          </p>
          <div className="flex gap-4 mt-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-slate-300">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-slate-300">Fault</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-slate-500"></div>
              <span className="text-slate-300">Offline</span>
            </div>
          </div>
        </div>
        <Button onClick={handleTriggerFlisr} disabled={isFlisrLoading || faultEventId === null}>
          {isFlisrLoading ? "Processing..." : "Trigger FLISR"}
        </Button>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-lg border-2 ${
        tieClosed
          ? 'bg-yellow-950 border-yellow-600'
          : 'bg-green-950 border-green-600'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tieClosed ? (
              <>
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <div>
                  <p className="font-bold text-yellow-200">FLISR Active - Fault Detected</p>
                  <p className="text-sm text-yellow-300">
                    Tie relay is CLOSED to restore power to healthy zones
                  </p>
                </div>
              </>
            ) : (
              <>
                <ZapIcon className="w-6 h-6 text-green-400" />
                <div>
                  <p className="font-bold text-green-200">Normal Operation</p>
                  <p className="text-sm text-green-300">
                    All zones operating normally - Tie relay OPEN
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FLISR Result */}
      {flisrResult && (
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>FLISR Process Report</AlertTitle>
          <AlertDescription>
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(flisrResult, null, 2)}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      {faultEventId === null && (
        <Alert>
          <AlertDescription>
            No unresolved faults detected. Restoration planner is on standby.
          </AlertDescription>
        </Alert>
      )}

      {/* Topology Canvas */}
      <div className="w-full h-[70vh] border-2 rounded-lg border-slate-700 bg-slate-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Controls />
          <Background color="#334155" gap={20} size={1} />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex flex-col items-center">
          <div className="text-sm font-semibold text-slate-300 mb-1">Power Source</div>
          <div className="text-xs text-slate-400">AC Generator (~)</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-sm font-semibold text-slate-300 mb-1">V&A Meter</div>
          <div className="text-xs text-slate-400">PZEM Sensor</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-sm font-semibold text-slate-300 mb-1">Circuit Breaker</div>
          <div className="text-xs text-slate-400">Relay Control</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-sm font-semibold text-slate-300 mb-1">Tie Switch</div>
          <div className="text-xs text-slate-400">Normally Open</div>
        </div>
      </div>
    </div>
  );
}
