/**
 * Runtime configuration — derived from env vars or window.location.
 * Set VITE_API_HOST in .env to point at a remote backend.
 */
const host = import.meta.env.VITE_API_HOST ?? window.location.hostname;
const port = import.meta.env.VITE_API_PORT ?? "8000";

export const API_BASE = `http://${host}:${port}/api/v1`;
export const HEALTH_URL = `http://${host}:${port}/health`;
export const WS_URL = `ws://${host}:${port}/ws`;
