"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// This page implements the "Log & History (3).png" UI.
// It includes filtering, sorting, and pagination controls.

const logData = [
  {
    timestamp: "2025-09-20 08:35:10",
    agent: "Zone 2",
    status: "FAULT",
    voltage: "0V",
    current: "0A",
    description: "Overcurrent detected. Isolating zone.",
  },
  {
    timestamp: "2025-09-20 08:35:12",
    agent: "Zone 2",
    status: "RESTORED",
    voltage: "219.8V",
    current: "6.1A",
    description: "Rerouted power via Feeder 2.",
  },
  {
    timestamp: "2025-09-20 08:36:00",
    agent: "Zone 1",
    status: "NORMAL",
    voltage: "220.1V",
    current: "5.3A",
    description: "System nominal.",
  },
  {
    timestamp: "2025-09-21 11:45:23",
    agent: "Zone 3",
    status: "NORMAL",
    voltage: "221.5V",
    current: "8.1A",
    description: "System nominal.",
  },
  {
    timestamp: "2025-09-22 15:02:18",
    agent: "Zone 1",
    status: "NORMAL",
    voltage: "219.9V",
    current: "4.9A",
    description: "System nominal.",
  },
];

type Status = "FAULT" | "RESTORED" | "NORMAL";

const getBadgeClasses = (status: Status) => {
  switch (status) {
    case "FAULT":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    case "RESTORED":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "NORMAL":
      return "bg-green-500/20 text-green-300 border-green-500/30";
    default:
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  }
};

export default function LogsPage() {
  const [logs] = useState(logData);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Log & History</h2>
        <p className="text-slate-400">
          Monitor and analyze system events and performance data
        </p>
      </div>

      <Card className="bg-slate-800 border-slate-700 p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search logs, zones, descriptions..."
              className="pl-10 bg-slate-700 border-slate-600 w-full"
            />
          </div>
          <Input
            type="text"
            placeholder="From Date: 09/20/2025"
            className="w-full md:w-48 bg-slate-700 border-slate-600"
          />
          <Input
            type="text"
            placeholder="To Date: 09/20/2025"
            className="w-full md:w-48 bg-slate-700 border-slate-600"
          />
          <Button className="w-full md:w-auto">
            <Filter className="mr-2 h-4 w-4" />
            Apply Filter
          </Button>
        </div>

        <div className="border rounded-lg border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-slate-700/50 border-b-slate-700">
                {[
                  "Timestamp",
                  "Zone Agent",
                  "Status",
                  "Voltage",
                  "Current",
                  "Description",
                ].map((header) => (
                  <TableHead key={header} className="text-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      {header}
                      <ArrowUpDown className="h-4 w-4 text-slate-500" />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  key={log.timestamp}
                  className="border-t-slate-700 hover:bg-slate-700/30"
                >
                  <TableCell className="px-4 py-3 text-slate-300">
                    {log.timestamp}
                  </TableCell>
                  <TableCell className="px-4 py-3">{log.agent}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge className={getBadgeClasses(log.status as Status)}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">{log.voltage}</TableCell>
                  <TableCell className="px-4 py-3">{log.current}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-400">
                    {log.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-2 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing 1 to {logs.length} of {logs.length} entries
            </span>
            <Select defaultValue="10">
              <SelectTrigger className="w-[120px] bg-slate-700 border-slate-600">
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 text-white border-slate-700">
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-blue-600 border-blue-500 text-white hover:bg-blue-700"
            >
              1
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
