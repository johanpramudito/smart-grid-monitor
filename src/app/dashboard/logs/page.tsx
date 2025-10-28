export const dynamic = "force-dynamic";
export const revalidate = 0;

import { headers } from "next/headers";
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

// This is now an async Server Component
export default async function LogsPage() {
  // Fetch data directly on the server
  // Note: In a real app, the fetch URL should be an absolute path stored in environment variables.
  const headerStore = headers();
  const host = headerStore.get("host") ?? process.env.VERCEL_URL ?? "localhost:3000";
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const baseUrl = host.startsWith("http") ? host : `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/logs`, {
    cache: 'no-store', // Ensure we always get the latest logs
  });
  
  if (!response.ok) {
    return <p className="text-red-500">Failed to load logs.</p>;
  }

  const logs: LogEvent[] = await response.json();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Log & History</h2>
        <p className="text-slate-400">
          A record of all system events and automated actions.
        </p>
      </div>

      <Card className="bg-slate-800 border-slate-700 p-6 space-y-4">
        <div className="border rounded-lg border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-slate-700/50 border-b-slate-700">
                <TableHead className="text-white">Timestamp</TableHead>
                <TableHead className="text-white">Zone</TableHead>
                <TableHead className="text-white">Event Type</TableHead>
                <TableHead className="text-white">Description</TableHead>
                <TableHead className="text-white">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow
                    key={log.event_id}
                    className="border-t-slate-700 hover:bg-slate-700/30"
                  >
                    <TableCell className="text-slate-300">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.zone_name || 'System'}</TableCell>
                    <TableCell>{getBadgeForEvent(log.event_type)}</TableCell>
                    <TableCell className="text-slate-400">
                      {log.description}
                    </TableCell>
                    <TableCell>
                      {log.resolved ? (
                        <span className="flex items-center text-green-400">
                          <CheckCircle className="w-4 h-4 mr-2" /> Resolved
                        </span>
                      ) : (
                        <span className="flex items-center text-yellow-400">
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Active
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 py-8">
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
