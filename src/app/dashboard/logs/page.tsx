"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, RefreshCw, Search, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";

// Define the structure of a log event based on our API response
interface LogEvent {
  event_id: number;
  event_type: string;
  description: string;
  timestamp: string;
  resolved: boolean;
  zone_name: string | null;
}

type StatusFilter = "all" | "active" | "resolved";

// Helper to determine badge color based on event type
const getBadgeForEvent = (eventType: string) => {
  switch (eventType.toUpperCase()) {
    case "FAULT":
      return <Badge variant="destructive">{eventType}</Badge>;
    case "SERVICE_RESTORATION":
      return (
        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
          {eventType}
        </Badge>
      );
    case "NORMAL":
      return (
        <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
          {eventType}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{eventType}</Badge>;
  }
};

// Converted to Client Component with automatic polling
export default function LogsPage() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchLogs = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const response = await fetch("/api/logs", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load logs");
      }

      const data: LogEvent[] = await response.json();
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
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
    // For Vercel: 500ms is safest, but 200ms works if traffic is low
    // For Azure App Service: 200ms is safe and provides real-time feel
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 200); // Real-time updates (5 per second)

    return () => clearInterval(interval);
  }, []);

  // Filter logs based on search query and status filter
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by status
      if (statusFilter === "active" && log.resolved) return false;
      if (statusFilter === "resolved" && !log.resolved) return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesZone = log.zone_name?.toLowerCase().includes(query);
        const matchesType = log.event_type.toLowerCase().includes(query);
        const matchesDescription = log.description.toLowerCase().includes(query);
        return matchesZone || matchesType || matchesDescription;
      }

      return true;
    });
  }, [logs, searchQuery, statusFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
  };

  // Get active and resolved counts
  const activeLogs = logs.filter((log) => !log.resolved).length;
  const resolvedLogs = logs.filter((log) => log.resolved).length;

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

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
        <p className="text-sm sm:text-base text-muted-foreground">
          A record of all system events and automated actions.
        </p>
      </div>

      {/* Search and Filter Controls */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by zone, event type, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              All ({logs.length})
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Active ({activeLogs})
            </Button>
            <Button
              variant={statusFilter === "resolved" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("resolved")}
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Resolved ({resolvedLogs})
            </Button>
          </div>
        </div>

        {/* Results count and items per page */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {filteredLogs.length > 0 ? (
              <>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} of{" "}
                {filteredLogs.length} {(searchQuery || statusFilter !== "all") && `filtered`} logs
              </>
            ) : (
              "No logs to display"
            )}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => setItemsPerPage(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-3 sm:p-4 lg:p-6 space-y-4">
        <div className="border rounded-lg border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-accent/50 border-t-border">
                <TableHead className="text-foreground text-xs sm:text-sm">
                  Timestamp
                </TableHead>
                <TableHead className="text-foreground text-xs sm:text-sm">
                  Zone
                </TableHead>
                <TableHead className="text-foreground text-xs sm:text-sm">
                  Event Type
                </TableHead>
                <TableHead className="text-foreground text-xs sm:text-sm min-w-[200px]">
                  Description
                </TableHead>
                <TableHead className="text-foreground text-xs sm:text-sm">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <TableRow
                    key={log.event_id}
                    className="border-t-border hover:bg-accent/30"
                  >
                    <TableCell className="text-foreground text-xs sm:text-sm whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                      {log.zone_name || "System"}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      {getBadgeForEvent(log.event_type)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs sm:text-sm">
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
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8 text-sm"
                  >
                    {searchQuery || statusFilter !== "all"
                      ? "No logs match your filters."
                      : "No log events found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={previousPage}
                disabled={currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none scrollbar-hide">
                {getPageNumbers().map((page, index) => (
                  <Button
                    key={index}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => typeof page === "number" && goToPage(page)}
                    disabled={page === "..."}
                    className="w-8 h-8 sm:w-10 sm:h-10 p-0 flex-shrink-0"
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
