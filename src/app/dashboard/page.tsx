"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  Zap,
  Waves,
  SlidersHorizontal,
  Loader,
  Clock3,
} from "lucide-react";

// Data structure for a single zone, fetched from the new /api/topology endpoint
interface Zone {
  id: string;
  data: {
    label: string;
    status: "NORMAL" | "FAULT" | "ISOLATED" | "OFFLINE";
    activeFaults: number;
    lastFaultAt: string | null;
    deviceLastSeen: string | null;
  };
  // We will fetch voltage and current separately or assume they are part of another API call
  // For now, we will display status and name.
}

interface DashboardStats {
  totalZones: number;
  activeFaults: number;
  systemStatus: string;
}

export default function DashboardPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setError(null);
        // Fetch both stats and zone details in parallel
        const [statsResponse, topologyResponse] = await Promise.all([
          fetch("/api/dashboard-stats", { cache: "no-store" }),
          fetch("/api/topology", { cache: "no-store" }),
        ]);

        if (!statsResponse.ok || !topologyResponse.ok) {
          throw new Error("Failed to fetch dashboard data.");
        }

        const statsData = await statsResponse.json();
        const topologyData = await topologyResponse.json();

        setStats(statsData);
        // The topology API returns nodes, which are our zones
        setZones(topologyData.nodes);

      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
    // Optional: Set up a polling interval to refresh data periodically
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-12 h-12 animate-spin text-blue-500" />
        <p className="ml-4 text-lg">Loading Dashboard Data...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center">Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Energy Monitor</h2>
        <p className="text-slate-400">
          Real-time monitoring of smart grid zones
        </p>
      </div>

      {/* Zone status cards will be simplified as detailed V/A data is on the zone page */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-white">
        {zones.map((zone) => (
          <Link
            href={`/dashboard/zones/${zone.id}`}
            key={zone.id}
            className="cursor-pointer"
          >
            <Card
              className={`bg-slate-800 border transition-all hover:border-blue-500 ${
                zone.data.status === "FAULT"
                  ? "border-red-500/50"
                  : "border-slate-700"
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-md font-medium flex items-center text-white">
                  {zone.data.status === "NORMAL" ? (
                    <Zap className="w-5 h-5 mr-2 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />
                  )}
                  {zone.data.label}
                </CardTitle>
                <Badge
                  variant={zone.data.status === "FAULT" ? "destructive" : "default"}
                  className={
                    zone.data.status === "NORMAL"
                      ? "bg-green-500/20 text-green-300 border-green-500/30"
                      : ""
                  }
                >
                  {zone.data.status}
                </Badge>
              </CardHeader>
              <CardContent>
                 <div className="text-sm text-slate-400 pt-4 space-y-2">
                    <p>Click to view detailed voltage, current, and history.</p>
                    {zone.data.activeFaults > 0 ? (
                      <span className="flex items-center text-red-400">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        {zone.data.activeFaults} active fault
                        {zone.data.activeFaults > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-500">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        No active faults
                      </span>
                    )}
                    {zone.data.lastFaultAt && (
                      <span className="flex items-center text-slate-500">
                        <Clock3 className="w-4 h-4 mr-2" />
                        Last fault: {new Date(zone.data.lastFaultAt).toLocaleString()}
                      </span>
                    )}
                    {zone.data.deviceLastSeen && (
                      <span className="flex items-center text-slate-500">
                        <Loader className="w-4 h-4 mr-2" />
                        Device: {new Date(zone.data.deviceLastSeen).toLocaleTimeString()}
                      </span>
                    )}
                 </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="text-white">
        <h3 className="text-2xl font-bold flex items-center mb-4">
          <SlidersHorizontal className="w-6 h-6 mr-3" /> System Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700 p-4 flex flex-col items-center justify-center text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-3xl font-bold text-white">
              {stats?.totalZones ?? 'N/A'}
            </p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Total Zones
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-3xl font-bold text-white">{stats?.activeFaults ?? 'N/A'}</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Active Faults
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4 flex flex-col items-center justify-center text-center">
            <Waves className="w-8 h-8 text-sky-500 mb-2" />
            <p className="text-xl font-bold text-white">{stats?.systemStatus ?? 'N/A'}</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              System Status
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4 flex flex-col items-center justify-center text-center">
            <Zap className="w-8 h-8 text-yellow-500 mb-2" />
            <p className="text-xl font-bold text-white">Real-Time</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Monitoring
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
