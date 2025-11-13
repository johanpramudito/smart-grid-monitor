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
    feederNumber?: number; // Add feeder number for sorting
    isTie?: boolean; // Add tie relay flag for sorting
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
    async function fetchData(showLoading = false) {
      if (showLoading) {
        setIsLoading(true);
      }
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
        // Sort zones by feeder number to maintain consistent order:
        // Zone 1, Zone 2, Zone 3, ..., Tie Relay
        const sortedZones = [...topologyData.nodes].sort((a: Zone, b: Zone) => {
          // Tie relay (feeder 99 or isTie flag) should always be last
          if (a.data.isTie && !b.data.isTie) return 1;
          if (!a.data.isTie && b.data.isTie) return -1;

          // Sort regular zones by feeder number (1, 2, 3, ...)
          const feederA = a.data.feederNumber ?? 999;
          const feederB = b.data.feederNumber ?? 999;
          return feederA - feederB;
        });

        setZones(sortedZones);

      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    }

    // Initial fetch with loading indicator
    fetchData(true);

    // Subsequent fetches without loading indicator (background refresh)
    const interval = setInterval(() => fetchData(false), 2000); // Refresh every 2 seconds
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
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold">Energy Monitor</h2>
        <p className="text-sm sm:text-base text-slate-400">
          Real-time monitoring of smart grid zones
        </p>
      </div>

      {/* Zone status cards will be simplified as detailed V/A data is on the zone page */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 text-white">
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
                <CardTitle className="text-sm sm:text-md font-medium flex items-center text-white">
                  {zone.data.status === "NORMAL" ? (
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-red-400 flex-shrink-0" />
                  )}
                  <span className="break-words">{zone.data.label}</span>
                </CardTitle>
                <Badge
                  variant={zone.data.status === "FAULT" ? "destructive" : "default"}
                  className={`text-xs flex-shrink-0 ${
                    zone.data.status === "NORMAL"
                      ? "bg-green-500/20 text-green-300 border-green-500/30"
                      : ""
                  }`}
                >
                  {zone.data.status}
                </Badge>
              </CardHeader>
              <CardContent>
                 <div className="text-xs sm:text-sm text-slate-400 pt-3 sm:pt-4 space-y-2">
                    <p className="hidden sm:block">Click to view detailed voltage, current, and history.</p>
                    <p className="sm:hidden">Tap for details</p>
                    {zone.data.activeFaults > 0 ? (
                      <span className="flex items-center text-red-400">
                        <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="text-xs sm:text-sm">{zone.data.activeFaults} active fault{zone.data.activeFaults > 1 ? "s" : ""}</span>
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-500">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="text-xs sm:text-sm">No active faults</span>
                      </span>
                    )}
                    {zone.data.lastFaultAt && (
                      <span className="flex items-center text-slate-500">
                        <Clock3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="text-xs sm:text-sm">Last fault: {new Date(zone.data.lastFaultAt).toLocaleString()}</span>
                      </span>
                    )}
                    {zone.data.deviceLastSeen && (
                      <span className="flex items-center text-slate-500">
                        <Loader className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="text-xs sm:text-sm">Device: {new Date(zone.data.deviceLastSeen).toLocaleTimeString()}</span>
                      </span>
                    )}
                 </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="text-white">
        <h3 className="text-xl sm:text-2xl font-bold flex items-center mb-3 sm:mb-4">
          <SlidersHorizontal className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" /> System Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-slate-800 border-slate-700 p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mb-1 sm:mb-2" />
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {stats?.totalZones ?? 'N/A'}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">
              Total Zones
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 mb-1 sm:mb-2" />
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.activeFaults ?? 'N/A'}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">
              Active Faults
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <Waves className="w-6 h-6 sm:w-8 sm:h-8 text-sky-500 mb-1 sm:mb-2" />
            <p className="text-base sm:text-xl font-bold text-white break-words">{stats?.systemStatus ?? 'N/A'}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">
              System Status
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-3 sm:p-4 flex flex-col items-center justify-center text-center">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 mb-1 sm:mb-2" />
            <p className="text-base sm:text-xl font-bold text-white whitespace-nowrap">Real-Time</p>
            <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">
              Monitoring
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
