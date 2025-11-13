"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, RefreshCw } from "lucide-react";

// Define the structure of a log event based on our API response
interface LogEvent {
  event_id: number;
  event_type: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  zone_name: string | null;
}

// Helper to determine badge color based on event type
const getBadgeForEvent = (eventType: string) => {
  switch (eventType.toUpperCase()) {
    case 'FAULT':
      return <Badge variant="destructive">{eventType}</Badge>;
    case 'SERVICE_RESTORATION':
      return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">{eventType}</Badge>;
    case 'NORMAL':
      return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">{eventType}</Badge>;
    default:
      return <Badge variant="secondary">{eventType}</Badge>;
  }
};

// Converted to Client Component with automatic polling
export default function LogsPage() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const response = await fetch("/api/logs", {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error("Failed to load logs");
      }

      const data: LogEvent[] = await response.json();
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial fetch with loading indicator
    fetchLogs(true);

    // Subsequent fetches without loading indicator (background refresh)
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 2000); // Auto-refresh logs every 2 seconds

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div>Loading logs...</div>;
  }

  if (error) {
    return <p className="text-red-500">Failed to load logs: {error}</p>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold">Log & History</h2>
        <p className="text-sm sm:text-base text-slate-400">
          A record of all system events and automated actions.
        </p>
      </div>

      <Card className="bg-slate-800 border-slate-700 p-3 sm:p-4 lg:p-6 space-y-4">
        <div className="border rounded-lg border-slate-700 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-slate-700/50 border-b-slate-700">
                <TableHead className="text-white text-xs sm:text-sm">Timestamp</TableHead>
                <TableHead className="text-white text-xs sm:text-sm">Zone</TableHead>
                <TableHead className="text-white text-xs sm:text-sm">Event Type</TableHead>
                <TableHead className="text-white text-xs sm:text-sm min-w-[200px]">Description</TableHead>
                <TableHead className="text-white text-xs sm:text-sm">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow
                    key={log.event_id}
                    className="border-t-slate-700 hover:bg-slate-700/30"
                  >
                    <TableCell className="text-slate-300 text-xs sm:text-sm whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">{log.zone_name || 'System'}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{getBadgeForEvent(log.event_type)}</TableCell>
                    <TableCell className="text-slate-400 text-xs sm:text-sm">
                      {log.description}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                      {log.resolved ? (
                        <span className="flex items-center text-green-400">
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Resolved</span>
                          <span className="sm:hidden">✓</span>
                        </span>
                      ) : (
                        <span className="flex items-center text-yellow-400">
                          <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                          <span className="hidden sm:inline">Active</span>
                          <span className="sm:hidden">⟳</span>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 py-8 text-sm">
                    No log events found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
