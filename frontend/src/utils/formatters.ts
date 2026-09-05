export function formatWatts(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

export function formatKva(kva: number): string {
  return `${kva.toFixed(1)} kVA`;
}

export function formatAmps(a: number): string {
  return `${Math.round(a)} A`;
}

export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function stateBadgeClass(state: string): string {
  switch (state) {
    case "on": return "state-on";
    case "running": return "state-running";
    case "idle": return "state-idle";
    case "off": return "state-off";
    case "fault": return "state-fault";
    default: return "badge badge-gray";
  }
}
