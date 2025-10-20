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
  activeFaults: number;
  faultEventId: number | null;
  faultDescription: string | null;
  lastFaultAt: string | null;
  deviceId: string | null;
  deviceLastSeen: string | null;
};

type ZoneEdgeData = {
  status: string;
  isFaulty: boolean;
  faultEventId: number | null;
  updatedAt: string | null;
};

type ZoneNode = Node<ZoneNodeData>;
type ZoneEdge = Edge<ZoneEdgeData>;

type FlisrResponsePayload = Record<string, unknown>;

export default function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ZoneNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ZoneEdgeData>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [flisrResult, setFlisrResult] = useState<FlisrResponsePayload | null>(null);
  const [isFlisrLoading, setIsFlisrLoading] = useState(false);
  const [faultEventId, setFaultEventId] = useState<number | null>(null);

  const fetchTopology = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/topology");
      if (!response.ok) {
        throw new Error("Failed to fetch topology data");
      }
      const data: { nodes: ZoneNode[]; edges: ZoneEdge[] } = await response.json();
      
      const faultNodeWithEvent = data.nodes.find((n) => n.data.faultEventId !== null);
      if (faultNodeWithEvent) {
        setFaultEventId(faultNodeWithEvent.data.faultEventId);
      } else {
        setFaultEventId(null);
      }

      setNodes(data.nodes);
      setEdges(data.edges);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges]);

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
      // Refresh the topology to show the updated state after restoration
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
