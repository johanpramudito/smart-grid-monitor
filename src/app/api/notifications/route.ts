import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { pool } from "@/lib/database/connection";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications
 * Fetches recent system notifications/events for the dashboard
 */
export async function GET(request: Request) {
  // Check authentication
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  const client = await pool.connect();
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const unreadOnly = searchParams.get("unread") === "true";

    // Fetch recent events from EventLog
    // Events are notifications: FAULT, SERVICE_RESTORATION, NORMAL, etc.
    const query = `
      SELECT
        el.event_id,
        el.event_type,
        el.description,
        el.timestamp,
        el.resolved,
        za.location_description as zone_name,
        za.zone_agent_id,
        CASE
          WHEN el.event_type = 'FAULT' THEN 'critical'
          WHEN el.event_type = 'SERVICE_RESTORATION' THEN 'warning'
          WHEN el.event_type = 'NORMAL' THEN 'success'
          ELSE 'info'
        END as severity
      FROM "EventLog" el
      LEFT JOIN "ZoneAgent" za ON el.zone_agent_id = za.zone_agent_id
      WHERE 1=1
      ${unreadOnly ? "AND el.resolved = false" : ""}
      ORDER BY el.timestamp DESC
      LIMIT $1
    `;

    const result = await client.query(query, [limit]);

    // Format notifications
    const notifications = result.rows.map((row) => ({
      id: row.event_id,
      type: row.event_type,
      title: getNotificationTitle(row.event_type),
      message: row.description,
      timestamp: row.timestamp,
      read: row.resolved,
      severity: row.severity,
      zoneId: row.zone_agent_id,
      zoneName: row.zone_name || "System",
    }));

    // Get unread count
    const unreadCountResult = await client.query(
      'SELECT COUNT(*) as count FROM "EventLog" WHERE resolved = false'
    );
    const unreadCount = parseInt(unreadCountResult.rows[0].count);

    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { message: "Failed to fetch notifications", error: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * POST /api/notifications
 * Mark a notification as read (resolve an event)
 */
export async function POST(request: Request) {
  // Check authentication
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      // Mark all notifications as read
      await client.query(
        'UPDATE "EventLog" SET resolved = true WHERE resolved = false'
      );
      return NextResponse.json({
        message: "All notifications marked as read",
      });
    } else if (notificationId) {
      // Mark specific notification as read
      await client.query(
        'UPDATE "EventLog" SET resolved = true WHERE event_id = $1',
        [notificationId]
      );
      return NextResponse.json({
        message: "Notification marked as read",
      });
    } else {
      return NextResponse.json(
        { message: "Missing notificationId or markAll parameter" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json(
      { message: "Failed to mark notification as read", error: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Helper function to generate notification titles
function getNotificationTitle(eventType: string): string {
  switch (eventType.toUpperCase()) {
    case "FAULT":
      return "⚠️ Fault Detected";
    case "SERVICE_RESTORATION":
      return "✅ Service Restored";
    case "NORMAL":
      return "✓ System Normal";
    case "ISOLATION":
      return "🔒 Zone Isolated";
    case "MANUAL_OVERRIDE":
      return "🎮 Manual Override Active";
    default:
      return "ℹ️ System Event";
  }
}
