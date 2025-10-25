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
  status: "NORMAL" | "FAULT" | "ISOLATED" | "OFFLINE";
  created_at: string;
  active_faults: number;
  active_fault_event_id: number | null;
  fault_description: string | null;
  fault_timestamp: string | null;
  device_id: string | null;
  device_last_seen: string | null;
}

interface SensorReading {
  time: string;
  voltage?: number;
  current?: number;
}

interface ZoneData {
  details: ZoneDetails;
  history: SensorReading[];
}

export default function ZoneDetailPage() {
  const params = useParams();
  const { id } = params;

  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      try {
        const response = await fetch(`/api/zones/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch zone data.");
        }
        const data: ZoneData = await response.json();
        setZoneData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id]);

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
  const formattedHistory = history.map(h => ({
      ...h,
      time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">{details.location_description} Details</h2>
        <p className="text-slate-400">
          Real-time monitoring and control for Zone ID: {details.zone_agent_id}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Charts */}
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
                  <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 15]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                  <Line type="monotone" dataKey="current" stroke="#FBBF24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Side Panels */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Zone Agent</span>
                <Badge variant={isFault ? "destructive" : "default"}>{details.status}</Badge>
              </div>
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
              <Button className="w-full bg-green-600 hover:bg-green-700" disabled={isFault}>
                <Power className="mr-2 h-4 w-4" />
                Force Relay ON
              </Button>
              <Button variant="destructive" className="w-full" disabled={!isFault}>
                <PowerOff className="mr-2 h-4 w-4" />
                Force Relay OFF
              </Button>
              {isFault && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Override Disabled</AlertTitle>
                  <AlertDescription>
                    Manual control is disabled during a fault condition.
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
