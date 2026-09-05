import { useEffect, useRef } from "react";
import { WS_URL } from "../config";
import { useWsStore } from "../stores/wsStore";
import type { WsEvent } from "../types";

const PING_INTERVAL_MS = 20_000;

export function useWebSocket() {
  const { setConnected, handleEvent } = useWsStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;

    function connect() {
      if (!alive) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Start ping interval
        const ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
        (ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> })._pingInterval = ping;
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as WsEvent & { type: string };
          // Ignore pong / keepalive
          if (msg.type === "pong" || msg.type === "keepalive") return;
          handleEvent(msg as WsEvent);
        } catch {
          // Ignore malformed
        }
      };

      ws.onclose = () => {
        setConnected(false);
        const w = ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> };
        if (w._pingInterval) clearInterval(w._pingInterval);
        if (alive) {
          // Reconnect after 3s
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      alive = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        const w = wsRef.current as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> };
        if (w._pingInterval) clearInterval(w._pingInterval);
        wsRef.current.close();
      }
    };
  }, [setConnected, handleEvent]);
}
