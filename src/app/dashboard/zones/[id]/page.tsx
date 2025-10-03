"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  Power,
  PowerOff,
  Thermometer,
  WifiOff,
  Cpu,
  History,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

// This page implements the "Zone Agent 2 Details.png" UI.
// It displays detailed charts and status panels for a specific zone.

const mockChartData = [
  { time: "14:31:00", voltage: 220, current: 5.5 },
  { time: "14:31:15", voltage: 220, current: 5.6 },
  { time: "14:31:30", voltage: 150, current: 3.0 },
  { time: "14:31:45", voltage: 0, current: 0 }, // FAULT POINT
  { time: "14:32:00", voltage: 0, current: 0 },
  { time: "14:32:15", voltage: 0, current: 0 },
];

const zoneDetail = {
  id: "2",
  status: "FAULT",
  relayStatus: "OFF",
  lastUpdate: "2025-01-15 14:32:15",
  diagnostics: {
    communication: "FAILED",
    powerSupply: "OFFLINE",
    temperature: "N/A",
    uptime: "0h, 0m",
  },
};

export default function ZoneDetailPage() {
  const params = useParams();
  const isFault = zoneDetail.status === "FAULT";
  const zoneName = `Zone Agent ${params.id}`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">{zoneName} Details</h2>
        <p className="text-slate-400">
          Real-time monitoring and control for {zoneName}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Voltage Chart */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Voltage (V) over Time</CardTitle>
              {isFault && <Badge variant="destructive">FAULT</Badge>}
            </CardHeader>
            <CardContent className="h-64 relative">
              {isFault && (
                <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-slate-800/50 text-2xl font-bold z-10 rounded-md">
                  FAULT: 0V
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={mockChartData}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis
                    dataKey="time"
                    stroke="#94A3B8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={12}
                    domain={[0, 250]}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1E293B",
                      border: "1px solid #475569",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="voltage"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#38BDF8" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Current Chart */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Current (A) over Time</CardTitle>
              {isFault && <Badge variant="destructive">FAULT</Badge>}
            </CardHeader>
            <CardContent className="h-64 relative">
              {isFault && (
                <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-slate-800/50 text-2xl font-bold z-10 rounded-md">
                  FAULT: 0A
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={mockChartData}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis
                    dataKey="time"
                    stroke="#94A3B8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={12}
                    domain={[0, 10]}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1E293B",
                      border: "1px solid #475569",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#FBBF24"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#FBBF24" }}
                    activeDot={{ r: 6 }}
                  />
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
                <Badge variant={isFault ? "destructive" : "default"}>
                  {zoneDetail.status}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Relay Status</span>
                <Badge variant={isFault ? "secondary" : "default"}>
                  {zoneDetail.relayStatus}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center">
                  <History className="mr-2 h-4 w-4" />
                  Last Update
                </span>
                <span>{zoneDetail.lastUpdate}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle>Manual Override</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!isFault}
              >
                <Power className="mr-2 h-4 w-4" />
                Turn Relay ON
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={isFault}
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Turn Relay OFF
              </Button>
              {isFault && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Override Disabled</AlertTitle>
                  <AlertDescription>
                    Relay is currently offline due to a system fault.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle>Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center">
                  <WifiOff className="mr-2 h-4 w-4" />
                  Communication
                </span>
                <Badge variant="destructive">
                  {zoneDetail.diagnostics.communication}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center">
                  <PowerOff className="mr-2 h-4 w-4" />
                  Power Supply
                </span>
                <Badge variant="destructive">
                  {zoneDetail.diagnostics.powerSupply}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center">
                  <Thermometer className="mr-2 h-4 w-4" />
                  Temperature
                </span>
                <Badge variant="secondary">
                  {zoneDetail.diagnostics.temperature}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center">
                  <Cpu className="mr-2 h-4 w-4" />
                  Uptime
                </span>
                <Badge variant="secondary">
                  {zoneDetail.diagnostics.uptime}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
