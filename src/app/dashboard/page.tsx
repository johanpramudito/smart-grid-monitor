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
  Sigma,
  SlidersHorizontal,
} from "lucide-react";

// This page implements the "Dashboard - 1.png" UI.
// It simulates real-time data updates for the zones.

// Mock data structure matching the UI
interface Zone {
  id: string;
  name: string;
  voltage: number;
  current: number;
  status: "Active" | "FAULT";
  lastUpdated: string;
}

const initialZones: Zone[] = [
  {
    id: "1",
    name: "Zone 1",
    voltage: 220.1,
    current: 5.3,
    status: "Active",
    lastUpdated: "2025-01-20 14:32:15",
  },
  {
    id: "2",
    name: "Zone 2",
    voltage: 0,
    current: 0,
    status: "FAULT",
    lastUpdated: "2025-01-20 14:32:15",
  },
  {
    id: "3",
    name: "Zone 3",
    voltage: 220.1,
    current: 7.8,
    status: "Active",
    lastUpdated: "2025-01-20 14:32:15",
  },
];

export default function DashboardPage() {
  const [zones, setZones] = useState<Zone[]>(initialZones);

  // Simulate real-time data from Firestore with an onSnapshot listener
  useEffect(() => {
    const interval = setInterval(() => {
      setZones((prevZones) =>
        prevZones.map((zone) => {
          if (zone.status === "Active") {
            const newCurrent = Math.max(
              0,
              parseFloat(
                (zone.current + (Math.random() - 0.5) * 0.2).toFixed(1)
              )
            );
            return {
              ...zone,
              current: newCurrent,
              lastUpdated: new Date().toISOString(),
            };
          }
          return { ...zone, lastUpdated: new Date().toISOString() };
        })
      );
    }, 4000); // Update data every 4 seconds as specified

    return () => clearInterval(interval);
  }, []);

  const activeZones = zones.filter((z) => z.status === "Active");
  const faultZones = zones.filter((z) => z.status === "FAULT");
  const averageVoltage =
    activeZones.length > 0
      ? (
          activeZones.reduce((acc, z) => acc + z.voltage, 0) /
          activeZones.length
        ).toFixed(1)
      : "0.0";
  const totalCurrent = zones.reduce((acc, z) => acc + z.current, 0).toFixed(1);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Energy Monitor</h2>
        <p className="text-slate-400">
          Real-time monitoring of smart grid zones
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-white">
        {zones.map((zone) => (
          <Link
            href={`/dashboard/zones/${zone.id}`}
            key={zone.id}
            className="cursor-pointer"
          >
            <Card
              className={`bg-slate-800 border transition-all hover:border-blue-500 ${
                zone.status === "FAULT"
                  ? "border-red-500/50"
                  : "border-slate-700"
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-md font-medium flex items-center text-white">
                  {zone.status === "Active" ? (
                    <Zap className="w-5 h-5 mr-2 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />
                  )}
                  {zone.name}
                </CardTitle>
                <Badge
                  variant={zone.status === "FAULT" ? "destructive" : "default"}
                  className={
                    zone.status === "Active"
                      ? "bg-green-500/20 text-green-300 border-green-500/30"
                      : ""
                  }
                >
                  {zone.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex justify-around items-center pt-4">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">VOLTAGE</p>
                    <p
                      className={`text-4xl font-bold ${
                        zone.status === "FAULT"
                          ? "text-red-500"
                          : "text-sky-400"
                      }`}
                    >
                      {zone.voltage.toFixed(1)}
                      <span className="text-2xl text-slate-400">V</span>
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">CURRENT</p>
                    <p
                      className={`text-4xl font-bold ${
                        zone.status === "FAULT"
                          ? "text-red-500"
                          : "text-amber-400"
                      }`}
                    >
                      {zone.current.toFixed(1)}
                      <span className="text-2xl text-slate-400">A</span>
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-500 pt-6">
                  {zone.status === "FAULT" ? (
                    <span className="flex items-center text-red-400/80">
                      <AlertTriangle className="w-3 h-3 mr-1.5" />
                      Fault detected:{" "}
                      {new Date(zone.lastUpdated).toLocaleTimeString("en-GB")}
                    </span>
                  ) : (
                    <span>
                      Last updated:{" "}
                      {new Date(zone.lastUpdated).toLocaleTimeString("en-GB")}
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
              {activeZones.length}
            </p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Active Zones
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-3xl font-bold text-white">{faultZones.length}</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Fault Zones
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4 flex flex-col items-center justify-center text-center">
            <Waves className="w-8 h-8 text-sky-500 mb-2" />
            <p className="text-3xl font-bold text-white">{averageVoltage}V</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Average Voltage
            </p>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4 flex flex-col items-center justify-center text-center">
            <Zap className="w-8 h-8 text-yellow-500 mb-2" />
            <p className="text-3xl font-bold text-white">{totalCurrent}A</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Total Current
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
