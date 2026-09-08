/**
 * Minimal reconnecting WebSocket hook with ping/pong keepalive.
 *
 * Mirrors the contract described in FRONTEND_HANDOFF.md: the backend sends a
 * `keepalive` frame every 30 s of silence and answers `{type:"ping"}` with
 * `{type:"pong"}`. We send a ping every 20 s so a dead socket is noticed fast.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';

type JsonMsg = Record<string, unknown>;

interface Options {
  url: string;
  enabled: boolean;
  onMessage: (msg: JsonMsg) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useWebSocket({ url, enabled, onMessage, onOpen, onClose }: Options): void {
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closedByUs = false;
    let attempt = 0;

    const connect = () => {
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
        onOpenRef.current?.();
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20_000);
      };

      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data as string) as JsonMsg;
          onMessageRef.current(parsed);
        } catch {
          /* ignore non-JSON frames */
        }
      };

      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        onCloseRef.current?.();
        if (closedByUs) return;
        attempt += 1;
        const delay = Math.min(1000 * 2 ** attempt, 15_000);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      closedByUs = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [url, enabled]);
}
