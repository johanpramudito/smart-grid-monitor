"use client";

import { useState, useEffect } from "react";
import { Bell, Check, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

// Extend Window interface for webkit audio context
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: "critical" | "warning" | "success" | "info";
  zoneId: string | null;
  zoneName: string;
}

interface NotificationData {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previousNotificationIds, setPreviousNotificationIds] = useState<Set<number>>(new Set());

  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Create audio context for beep sound (440Hz for 200ms)
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440; // A4 note
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Silently fail if audio context is not supported
      console.debug("Could not play notification sound:", error);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?limit=20");
      if (!response.ok) return;

      const data: NotificationData = await response.json();

      // Check for new critical notifications
      if (previousNotificationIds.size > 0) {
        const newCriticalNotifications = data.notifications.filter(
          (notif) =>
            !previousNotificationIds.has(notif.id) &&
            notif.severity === "critical" &&
            !notif.read
        );

        if (newCriticalNotifications.length > 0) {
          playNotificationSound();

          // Show browser notification if permission granted
          if ("Notification" in window && Notification.permission === "granted") {
            newCriticalNotifications.forEach((notif) => {
              new Notification(notif.title, {
                body: `${notif.zoneName}: ${notif.message}`,
                icon: "/favicon-96x96.png",
                badge: "/favicon-96x96.png",
                tag: `notification-${notif.id}`,
              });
            });
          }
        }
      }

      // Update notification IDs
      setPreviousNotificationIds(new Set(data.notifications.map((n) => n.id)));

      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      if (response.ok) {
        // Update local state
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Fetch notifications on mount and set up polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get icon based on severity
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  // Get badge color based on severity
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "warning":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "success":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-full hover:bg-slate-700 flex-shrink-0 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-6 h-6 text-slate-300" />
          {unreadCount > 0 && (
            <>
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 sm:w-96 bg-slate-800 border-slate-700 text-white p-0 max-h-[80vh] overflow-hidden flex flex-col"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                {unreadCount} new
              </Badge>
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                disabled={isLoading}
                className="text-xs text-slate-400 hover:text-white"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">No notifications yet</p>
              <p className="text-slate-500 text-xs mt-1">
                You&apos;ll see updates about faults and system events here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-700/50 transition-colors ${
                    !notification.read ? "bg-slate-700/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(notification.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {notification.zoneName}
                          </p>
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="flex-shrink-0 p-1 rounded hover:bg-slate-600 transition-colors"
                            aria-label="Mark as read"
                          >
                            <Check className="w-3 h-3 text-slate-400" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          className={`text-xs ${getSeverityColor(
                            notification.severity
                          )}`}
                        >
                          {notification.type}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                      </div>
                      {notification.zoneId && (
                        <Link
                          href={`/dashboard/zones/${notification.zoneId}`}
                          onClick={() => setIsOpen(false)}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                        >
                          View zone details →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-slate-700 text-center">
            <Link
              href="/dashboard/logs"
              onClick={() => setIsOpen(false)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all logs →
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
