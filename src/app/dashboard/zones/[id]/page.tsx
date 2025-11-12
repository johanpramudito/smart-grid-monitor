"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  Power,
  PowerOff,
  History,
  Loader,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Define the data structures based on our API response
interface ZoneDetails {
  zone_agent_id: string;
  location_description: string;
  status: "NORMAL" | "FAULT" | "ISOLATED" | "OFFLINE" | "MANUAL";
  feeder_number: number;
  created_at: string;
  active_faults: number;
  active_fault_event_id: number | null;
  fault_description: string | null;
  fault_timestamp: string | null;
  device_id: string | null;
  device_last_seen: string | null;
  relay_state?: string; // OPEN or CLOSED
  manual_override?: boolean; // Is relay in manual override mode?
}

interface AllZonesStatus {
  zones: Array<{
    zone_agent_id: string;
    location_description: string;
    feeder_number: number;
    status: "NORMAL" | "FAULT" | "ISOLATED" | "OFFLINE" | "MANUAL";
    active_faults: number;
  }>;
}

interface SensorReading {
  time: string;
  voltage?: number;
  current?: number;
  power?: number;
  power_factor?: number;
  energy?: number;
  frequency?: number;
}

interface ZoneData {
  details: ZoneDetails;
  history: SensorReading[];
}

interface TopologyNode {
  id: string;
  data: {
    label: string;
    feederNumber: number;
    status: "NORMAL" | "FAULT" | "ISOLATED" | "OFFLINE" | "MANUAL";
    activeFaults: number;
  };
}

export default function ZoneDetailPage() {
  const params = useParams();
  const { id } = params;

  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [allZones, setAllZones] = useState<AllZonesStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relayControlLoading, setRelayControlLoading] = useState(false);
  const [relayControlMessage, setRelayControlMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isActive = true;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/zones/${id}`, { cache: "no-store" });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch zone data.");
        }
        const data: ZoneData = await response.json();
        if (!isActive) return;
        setZoneData(data);

        // If this is a tie relay (feeder_number 99), fetch all zones for FLISR dashboard
        if (data.details.feeder_number === 99) {
          const topologyResponse = await fetch('/api/topology', { cache: 'no-store' });
          if (topologyResponse.ok) {
            const topologyData: { nodes: TopologyNode[] } = await topologyResponse.json();
            setAllZones({
              zones: topologyData.nodes
                .filter((node: TopologyNode) => node.data.feederNumber !== 99)
                .map((node: TopologyNode) => ({
                  zone_agent_id: node.id,
                  location_description: node.data.label,
                  feeder_number: node.data.feederNumber,
                  status: node.data.status,
                  active_faults: node.data.activeFaults,
                }))
            });
          }
        }

        setError(null);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    };

    fetchData();
    const intervalId = window.setInterval(fetchData, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [id]);

  const handleRelayControl = async (command: 'CLOSED' | 'OPEN' | 'AUTO') => {
    if (!id) return;

    setRelayControlLoading(true);
    setRelayControlMessage(null);

    try {
      const response = await fetch('/api/relay/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneAgentId: id,
          relayNumber: 1, // Default to relay 1
          command,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to control relay');
      }

      setRelayControlMessage(`✓ ${result.message}`);

      // Refresh zone data to show updated status
      const refreshResponse = await fetch(`/api/zones/${id}`, { cache: 'no-store' });
      if (refreshResponse.ok) {
        const data: ZoneData = await refreshResponse.json();
        setZoneData(data);
      }
    } catch (err) {
      setRelayControlMessage(
        `✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setRelayControlLoading(false);

      // Clear message after 5 seconds
      setTimeout(() => setRelayControlMessage(null), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-12 h-12 animate-spin text-blue-500" />
        <p className="ml-4 text-lg">Loading Zone Data...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center">Error: {error}</div>;
  }

  if (!zoneData) {
    return <div className="text-center">No data available for this zone.</div>;
  }

  const { details, history } = zoneData;
  const isFault = details.status === "FAULT";
  const isTieRelay = details.feeder_number === 99;
  const isManualMode = details.status === "MANUAL";
  const isManualOverride = details.manual_override === true;

  const formattedHistory = history.map(h => ({
      ...h,
      time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }));

  // FLISR logic for tie relay
  const anyZoneFaulted = allZones?.zones.some(z => z.status === 'FAULT') ?? false;
  const faultedZones = allZones?.zones.filter(z => z.status === 'FAULT') ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">
          {isTieRelay ? "⚡ " : ""}{details.location_description} Details
        </h2>
        <p className="text-slate-400">
          {isTieRelay
            ? "FLISR (Fault Location, Isolation, and Service Restoration) Control System"
            : `Real-time monitoring and control for Zone ID: ${details.zone_agent_id}`}
        </p>
      </div>

      {/* FLISR Status Banner - Only for Tie Relay */}
      {isTieRelay && (
        <Card className={`border-2 ${
          isManualMode
            ? 'bg-yellow-950 border-yellow-500'
            : anyZoneFaulted
              ? 'bg-red-950 border-red-500'
              : 'bg-blue-950 border-blue-500'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                {isManualMode ? (
                  <>
                    <AlertTriangle className="w-6 h-6 mr-3 text-yellow-400" />
                    Manual Override Active
                  </>
                ) : anyZoneFaulted ? (
                  <>
                    <AlertTriangle className="w-6 h-6 mr-3 text-red-400" />
                    FLISR Activated - Fault Detected
                  </>
                ) : (
                  <>
                    <Power className="w-6 h-6 mr-3 text-blue-400" />
                    FLISR Automatic Mode - Normal Operation
                  </>
                )}
              </span>
              <Badge className={
                isManualMode
                  ? 'bg-yellow-500 text-yellow-950'
                  : anyZoneFaulted
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white'
              }>
                {isManualMode ? 'MANUAL' : anyZoneFaulted ? 'FAULT' : 'NORMAL'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isManualMode ? (
              <div className="text-yellow-200">
                <p className="font-semibold mb-2">🎮 Manual Control Mode</p>
                <p className="text-sm">
                  Tie relay is under manual control. Automatic FLISR logic is bypassed.
                  The system will not automatically respond to zone faults until manual mode is exited.
                </p>
              </div>
            ) : anyZoneFaulted ? (
              <div className="text-red-200">
                <p className="font-semibold mb-2">⚡ FLISR Active - Service Restoration</p>
                <p className="text-sm mb-3">
                  Fault detected in {faultedZones.map(z => z.location_description).join(', ')}.
                  Tie relay has automatically <strong>CLOSED</strong> to restore power to healthy zones.
                </p>
                <div className="bg-red-900/30 p-3 rounded-md border border-red-700">
                  <p className="text-xs font-mono">
                    <strong>FLISR Logic:</strong> Zone fault → Isolate faulted zone → Close tie relay → Restore service to healthy zones
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-blue-200">
                <p className="font-semibold mb-2">✓ All Systems Normal</p>
                <p className="text-sm mb-3">
                  All zones are operating normally. Tie relay is <strong>OPEN</strong> to maintain zone isolation.
                  FLISR will automatically close the tie relay if any zone experiences a fault.
                </p>
                <div className="bg-blue-900/30 p-3 rounded-md border border-blue-700">
                  <p className="text-xs font-mono">
                    <strong>Normal Operation:</strong> All zones powered independently → Tie relay OPEN → Zones isolated
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Zone Health Monitoring - Only for Tie Relay */}
      {isTieRelay && allZones && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="w-5 h-5 mr-3" />
              Zone Health Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {allZones.zones.map((zone) => (
                <div
                  key={zone.zone_agent_id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    zone.status === 'FAULT'
                      ? 'bg-red-950 border-red-500'
                      : 'bg-green-950 border-green-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{zone.location_description}</h3>
                    {zone.status === 'FAULT' ? (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Power className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    <p className={zone.status === 'FAULT' ? 'text-red-300' : 'text-green-300'}>
                      Status: <strong>{zone.status}</strong>
                    </p>
                    <p className="text-slate-400">
                      Feeder: {zone.feeder_number}
                    </p>
                    {zone.active_faults > 0 && (
                      <p className="text-red-400">
                        Active Faults: {zone.active_faults}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {anyZoneFaulted && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-md">
                <p className="text-red-200 text-sm">
                  ⚠️ <strong>FLISR Action:</strong> Tie relay is CLOSED to restore power to healthy zones ({
                    allZones.zones
                      .filter(z => z.status !== 'FAULT')
                      .map(z => z.location_description)
                      .join(', ')
                  })
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className={`grid grid-cols-1 ${isTieRelay ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6`}>
        {/* Charts - Only show for regular feeders, not for tie relay */}
        {!isTieRelay && (
          <div className="lg:col-span-2 space-y-6">
            {/* Regular Feeders: Show all electrical parameters */}
            <>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Voltage (V) over Time</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 250]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                      <Line type="monotone" dataKey="voltage" stroke="#38BDF8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Current (A) over Time</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 6]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                      <Line type="monotone" dataKey="current" stroke="#FBBF24" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Power Chart */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Power (W) over Time</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 1500]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                      <Line type="monotone" dataKey="power" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Power Factor Chart */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Power Factor over Time</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 1]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                      <Line type="monotone" dataKey="power_factor" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Energy Chart */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Energy (kWh) - Cumulative</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                      <Line type="monotone" dataKey="energy" stroke="#F59E0B" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Frequency Chart */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle>Frequency (Hz) over Time</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} domain={[49, 51]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                      <Line type="monotone" dataKey="frequency" stroke="#EC4899" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          </div>
        )}

        <div className="space-y-6">
          {/* Side Panels */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle>{isTieRelay ? "FLISR System Status" : "System Status"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{isTieRelay ? "FLISR Mode" : "Zone Agent"}</span>
                <Badge variant={isFault ? "destructive" : "default"}>{details.status}</Badge>
              </div>
              {isTieRelay && (
                <>
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 pr-2">Relay State</span>
                    <span className={`text-right font-semibold ${
                      isManualMode
                        ? 'text-yellow-300'
                        : anyZoneFaulted
                          ? 'text-red-300'
                          : 'text-green-300'
                    }`}>
                      {isManualMode
                        ? 'MANUAL CONTROL'
                        : anyZoneFaulted
                          ? 'CLOSED (Restoring Service)'
                          : 'OPEN (Normal Isolation)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-start text-sm">
                    <span className="text-slate-400 pr-2">Automatic Control</span>
                    <span className={`text-right ${isManualMode ? 'text-yellow-300' : 'text-green-300'}`}>
                      {isManualMode ? 'Bypassed' : 'Active'}
                    </span>
                  </div>
                  {anyZoneFaulted && !isManualMode && (
                    <div className="flex justify-between items-start text-sm">
                      <span className="text-slate-400 pr-2">Faulted Zones</span>
                      <span className="text-right text-red-300">
                        {faultedZones.map(z => z.location_description).join(', ')}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center">
                  <History className="mr-2 h-4 w-4" />
                  Created
                </span>
                <span>{new Date(details.created_at).toLocaleDateString()}</span>
              </div>
              {details.device_id && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Device ID</span>
                  <span className="text-slate-300 truncate max-w-[140px]" title={details.device_id}>
                    {details.device_id}
                  </span>
                </div>
              )}
              {details.device_last_seen && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Last seen</span>
                  <span className="text-slate-300">
                    {new Date(details.device_last_seen).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Active faults</span>
                <span className={details.active_faults > 0 ? "text-red-400 font-medium" : "text-slate-300"}>
                  {details.active_faults}
                </span>
              </div>
              {details.fault_timestamp && (
                <div className="flex justify-between items-start text-sm">
                  <span className="text-slate-400 pr-2">Last fault</span>
                  <span className="text-right text-slate-300">
                    {new Date(details.fault_timestamp).toLocaleString()}
                    {details.fault_description && (
                      <>
                        <br />
                        <span className="text-xs text-slate-400">
                          {details.fault_description}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle>Manual Override</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isTieRelay && !isManualMode && anyZoneFaulted && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>⚠️ Critical: FLISR Active</AlertTitle>
                  <AlertDescription>
                    FLISR is actively restoring service to healthy zones. Manual override will bypass automatic fault isolation.
                    This may cause service interruption to healthy zones!
                  </AlertDescription>
                </Alert>
              )}
              {isTieRelay && isManualMode && (
                <Alert className="mb-3 border-yellow-500 bg-yellow-950">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <AlertTitle className="text-yellow-300">FLISR Bypassed</AlertTitle>
                  <AlertDescription className="text-yellow-200">
                    Automatic FLISR control is currently disabled. The system will NOT respond to zone faults automatically.
                  </AlertDescription>
                </Alert>
              )}
              {!isTieRelay && isFault && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>⚠️ Warning: Fault Detected</AlertTitle>
                  <AlertDescription>
                    System is in FAULT state. Manual override will bypass protection systems. Use with caution!
                  </AlertDescription>
                </Alert>
              )}
              {isManualOverride && (
                <Alert className="mb-3 border-orange-500 bg-orange-950">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  <AlertTitle className="text-orange-300">Manual Override Active</AlertTitle>
                  <AlertDescription className="text-orange-200">
                    This relay is under manual control. Automatic protection is bypassed.
                    Click "Return to Auto Protection" to re-enable automatic control after 60 seconds or immediately.
                  </AlertDescription>
                </Alert>
              )}
              {isManualOverride && (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={relayControlLoading}
                  onClick={() => handleRelayControl('AUTO')}
                >
                  {relayControlLoading ? (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Power className="mr-2 h-4 w-4" />
                  )}
                  Return to Auto Protection
                </Button>
              )}
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={relayControlLoading}
                onClick={() => handleRelayControl('CLOSED')}
              >
                {relayControlLoading ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Power className="mr-2 h-4 w-4" />
                )}
                {isTieRelay ? 'Manual CLOSE Tie Relay' : 'Force Relay CLOSED'}
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={relayControlLoading}
                onClick={() => handleRelayControl('OPEN')}
              >
                {relayControlLoading ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="mr-2 h-4 w-4" />
                )}
                {isTieRelay ? 'Manual OPEN Tie Relay' : 'Force Relay OPEN'}
              </Button>
              {isTieRelay && (
                <div className="mt-3 p-3 bg-slate-700 rounded-md border border-slate-600">
                  <p className="text-xs text-slate-300">
                    <strong>Note:</strong> Manual control will {isManualMode ? 'remain active' : 'bypass FLISR automatic control'}.
                    {!isManualMode && ' The system will not automatically respond to zone faults until you exit manual mode.'}
                  </p>
                </div>
              )}
              {relayControlMessage && (
                <Alert className={relayControlMessage.startsWith('✓') ? 'border-green-500 bg-green-950' : 'border-red-500 bg-red-950'}>
                  <AlertDescription className={relayControlMessage.startsWith('✓') ? 'text-green-200' : 'text-red-200'}>
                    {relayControlMessage}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
