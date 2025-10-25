"use client";

import { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

type ZoneStatus = "NORMAL" | "FAULT" | "ISOLATED" | "OFFLINE";

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

const DEFAULT_NODE_DATA: ZoneNodeData = {
  label: "",
  status: "NORMAL",
  feederNumber: null,
  isTie: false,
  activeFaults: 0,
  faultEventId: null,
  faultDescription: null,
  lastFaultAt: null,
  deviceId: null,
  deviceLastSeen: null,
};

export default function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ZoneNodeData>([]);
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
        .sort(
          (a, b) => (a.data.feederNumber ?? 0) - (b.data.feederNumber ?? 0)
        );
      const tieZone = data.nodes.find((node) => node.data.isTie) ?? null;

      const tieIsClosed =
        data.tieClosed ?? mainZones.some((zone) => zone.data.status === "FAULT");

      const baseTopY = 80;
      const baseX = 220;
      const spacing = 240;

      const graphNodes: ZoneNode[] = [
        {
          id: "pln",
          position: { x: 60, y: baseTopY },
          data: { ...DEFAULT_NODE_DATA, label: "PLN" },
          draggable: false,
          selectable: false,
          style: {
            width: 90,
            height: 90,
            borderRadius: 9999,
            background: "#0f172a",
            border: "4px solid #1e293b",
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
          },
        },
        {
          id: "feeder1-label",
          position: { x: baseX, y: baseTopY - 60 },
          data: { ...DEFAULT_NODE_DATA, label: "Feeder 1" },
          draggable: false,
          selectable: false,
          style: {
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            fontWeight: 600,
            pointerEvents: "none",
          },
        },
        {
          id: "feeder2-label",
          position: { x: baseX, y: baseTopY + 140 },
          data: { ...DEFAULT_NODE_DATA, label: "Feeder 2" },
          draggable: false,
          selectable: false,
          style: {
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            fontWeight: 600,
            pointerEvents: "none",
          },
        },
        {
          id: "feeder2-start",
          position: { x: 60, y: baseTopY + 150 },
          data: { ...DEFAULT_NODE_DATA, label: "" },
          draggable: false,
          selectable: false,
          style: {
            width: 1,
            height: 1,
            border: "none",
            background: "transparent",
            pointerEvents: "none",
          },
        },
      ];

      const mainZoneNodes = mainZones.map((zone, index) => {
        const x = baseX + index * spacing;
        const isFault = zone.data.status === "FAULT";
        const label =
          zone.data.label || `Zone ${zone.data.feederNumber ?? index + 1}`;

        return {
          id: zone.id,
          position: { x, y: baseTopY },
          data: {
            ...DEFAULT_NODE_DATA,
            ...zone.data,
            label: `V&A\n${label}`,
          },
          draggable: false,
          selectable: true,
          style: {
            width: 120,
            height: 120,
            borderRadius: "9999px",
            background: isFault ? "#ef4444" : "#1e293b",
            border: `4px solid ${isFault ? "#ef4444" : "#1e293b"}`,
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            whiteSpace: "pre-line",
            fontWeight: 700,
            fontSize: 16,
          },
        } satisfies ZoneNode;
      });

      graphNodes.push(...mainZoneNodes);

      const lastZoneX =
        mainZoneNodes.length > 0
          ? mainZoneNodes[mainZoneNodes.length - 1].position.x ?? baseX
          : baseX;

      const feeder2Mid: ZoneNode = {
        id: "feeder2-mid",
        position: { x: lastZoneX, y: baseTopY + 150 },
        data: { ...DEFAULT_NODE_DATA, label: "" },
        draggable: false,
        selectable: false,
        style: {
          width: 1,
          height: 1,
          border: "none",
          background: "transparent",
          pointerEvents: "none",
        },
      };

      const tieNodeId = tieZone?.id ?? "tie";
      const tieNodeX = lastZoneX + spacing;
      const tieLabel = tieIsClosed ? "Tie Relay\nClosed" : "Tie Relay\nOpen";

      const tieNode: ZoneNode = {
        id: tieNodeId,
        position: { x: tieNodeX, y: baseTopY + 60 },
        data: {
          ...DEFAULT_NODE_DATA,
          ...tieZone?.data,
          label: tieLabel,
          isTie: true,
        },
        draggable: false,
        selectable: false,
        style: {
          width: 120,
          height: 120,
          borderRadius: "9999px",
          background: tieIsClosed ? "#22c55e" : "#0f172a",
          border: `4px solid ${tieIsClosed ? "#22c55e" : "#475569"}`,
          color: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          whiteSpace: "pre-line",
          fontWeight: 700,
          fontSize: 16,
        },
      };

      const feeder2End: ZoneNode = {
        id: "feeder2-end",
        position: { x: tieNodeX, y: baseTopY + 150 },
        data: { ...DEFAULT_NODE_DATA, label: "" },
        draggable: false,
        selectable: false,
        style: {
          width: 1,
          height: 1,
          border: "none",
          background: "transparent",
          pointerEvents: "none",
        },
      };

      graphNodes.push(feeder2Mid, tieNode, feeder2End);

      const graphEdges: Edge[] = [];
      const baseEdgeStyle = {
        stroke: "#334155",
        strokeWidth: 3,
      };

      let previousNodeId = "pln";
      mainZones.forEach((zone) => {
        const zoneId = zone.id;
        const isFault = zone.data.status === "FAULT";
        graphEdges.push({
          id: `edge-${previousNodeId}-${zoneId}`,
          source: previousNodeId,
          target: zoneId,
          type: "smoothstep",
          animated: zone.data.status !== "OFFLINE",
          style: {
            ...baseEdgeStyle,
            stroke: isFault ? "#ef4444" : "#334155",
            strokeWidth: isFault ? 5 : 3,
          },
        });
        previousNodeId = zoneId;
      });

      graphEdges.push(
        {
          id: "edge-pln-feeder2",
          source: "pln",
          target: "feeder2-start",
          type: "smoothstep",
          style: baseEdgeStyle,
        },
        {
          id: "edge-feeder2-start-mid",
          source: "feeder2-start",
          target: "feeder2-mid",
          type: "smoothstep",
          style: baseEdgeStyle,
        },
        {
          id: "edge-feeder2-mid-end",
          source: "feeder2-mid",
          target: "feeder2-end",
          type: "smoothstep",
          style: baseEdgeStyle,
        }
      );

      if (mainZones.length > 0) {
        const lastZoneId = mainZones[mainZones.length - 1].id;
        const tieEdgeStyle = tieIsClosed
          ? { stroke: "#22c55e", strokeWidth: 4 }
          : { stroke: "#64748b", strokeWidth: 3, strokeDasharray: "6 4" };

        graphEdges.push(
          {
            id: "edge-zone-tie",
            source: lastZoneId,
            target: tieNodeId,
            type: "smoothstep",
            animated: tieIsClosed,
            style: tieEdgeStyle,
          },
          {
            id: "edge-tie-feeder2",
            source: tieNodeId,
            target: "feeder2-end",
            type: "smoothstep",
            animated: tieIsClosed,
            style: tieEdgeStyle,
          }
        );
      }

      const firstFaultNode = mainZones.find(
        (zone) => zone.data.faultEventId !== null
      );

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
      setFlisrResult({ message: `Error: ${error instanceof Error ? error.message : "Unknown error"}` });
    } finally {
      setIsFlisrLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading Topology...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Live Grid Topology</h2>
          <p className="text-slate-400">
            Dynamic visualization of the smart grid network with fault overlays.
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Tie Relay:{" "}
            <span className={tieClosed ? "text-green-400 font-semibold" : "text-slate-300"}>
              {tieClosed ? "Closed (fault detected)" : "Open"}
            </span>
          </p>
        </div>
        <Button onClick={handleTriggerFlisr} disabled={isFlisrLoading || faultEventId === null}>
          {isFlisrLoading ? "Processing..." : "Trigger FLISR"}
        </Button>
      </div>

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

      <div className="w-full h-[60vh] border rounded-lg border-slate-700">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Controls />
          <Background color="#aaa" gap={16} />
        </ReactFlow>
      </div>
    </div>
  );
}
