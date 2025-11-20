import { useEffect, useState } from 'react';

interface StatusUpdate {
  zoneId: string;
  status: string;
  timestamp: string;
}

/**
 * Hook to subscribe to real-time status updates for all zones
 * Uses WebSocket to get instant status changes without polling
 */
export function useStatusUpdates() {
  const [lastStatusUpdate, setLastStatusUpdate] = useState<StatusUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to status broadcast channel
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/status-updates`;

    console.log('[StatusUpdates] Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[StatusUpdates] Connected to status broadcast');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        console.log('[StatusUpdates] 📨 Raw message received:', event.data);
        const message = JSON.parse(event.data);
        console.log('[StatusUpdates] 📦 Parsed message:', message);

        if (message.type === 'connected') {
          console.log('[StatusUpdates] ✅', message.message);
          return;
        }

        if (message.type === 'status-change') {
          console.log('[StatusUpdates] ⚡⚡⚡ STATUS CHANGE RECEIVED:', message.data);
          setLastStatusUpdate(message.data);
        } else {
          console.log('[StatusUpdates] ⚠️ Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[StatusUpdates] ❌ Error parsing message:', error, 'Raw:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('[StatusUpdates] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[StatusUpdates] Disconnected from status broadcast');
      setIsConnected(false);
    };

    return () => {
      console.log('[StatusUpdates] Cleaning up WebSocket connection');
      ws.close();
    };
  }, []);

  return { lastStatusUpdate, isConnected };
}
