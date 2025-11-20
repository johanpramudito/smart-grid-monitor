import { useEffect, useRef, useState, useCallback } from 'react';

export interface TelemetryData {
  voltage?: number;
  current?: number;
  power?: number;
  power_factor?: number;
  energy?: number;
  frequency?: number;
  status?: string;
  timestamp: string;
}

interface WebSocketMessage {
  type: 'connected' | 'telemetry';
  zoneId?: string;
  data?: TelemetryData;
  message?: string;
  timestamp: string;
}

export function useWebSocket(zoneId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<TelemetryData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!zoneId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Use wss:// for production (HTTPS) or ws:// for development (HTTP)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/telemetry?zoneId=${zoneId}`;

      console.log(`[WebSocket] Connecting to ${wsUrl}`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`[WebSocket] Connected to zone ${zoneId}`);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect counter on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'telemetry' && message.data) {
            console.log(`[WebSocket] Received telemetry:`, message.data);
            setLastMessage(message.data);
          } else if (message.type === 'connected') {
            console.log(`[WebSocket] ${message.message}`);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error(`[WebSocket] Error for zone ${zoneId}:`, error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log(`[WebSocket] Disconnected from zone ${zoneId}`);
        setIsConnected(false);
        wsRef.current = null;

        // Exponential backoff for reconnection
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[WebSocket] Reconnecting in ${backoffMs}ms...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, backoffMs);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setIsConnected(false);
    }
  }, [zoneId]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
}
