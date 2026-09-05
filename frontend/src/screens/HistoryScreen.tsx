import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getPowerHistory, getAlerts, getExportUrl } from "../api/client";
import type { PowerHistoryItem, AlertRecord } from "../types";
import { formatWatts, formatDateTime } from "../utils/formatters";

const DEVICE_OPTIONS = [
  { value: "", label: "All Devices" },
  { value: "evse_01", label: "EVSE" },
  { value: "light_01", label: "Light" },
  { value: "dishwasher_01", label: "Dishwasher" },
  { value: "washing_machine_01", label: "Washing Machine" },
  { value: "water_heater_01", label: "Water Heater" },
  { value: "heat_pump_01", label: "Heat Pump" },
  { value: "cctv_01", label: "CCTV" },
  { value: "microwave_01", label: "Microwave" },
  { value: "refrigerator_01", label: "Refrigerator" },
];

export default function HistoryScreen() {
  const [deviceId, setDeviceId] = useState("");
  const [limit, setLimit] = useState(200);
  const [history, setHistory] = useState<PowerHistoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"chart" | "alerts">("chart");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a] = await Promise.all([
        getPowerHistory({ device_id: deviceId || undefined, limit }),
        getAlerts(50),
      ]);
      setHistory(h);
      setAlerts(a);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, [deviceId, limit]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Group by timestamp for chart
  const chartData = (() => {
    if (!deviceId) {
      // Aggregate all devices per timestamp
      const map: Record<string, { time: string; watts: number }> = {};
      for (const r of history) {
        const key = r.timestamp;
        if (!map[key]) map[key] = { time: new Date(key).toLocaleTimeString(), watts: 0 };
        map[key].watts += r.watts;
      }
      return Object.values(map).slice(-100);
    }
    return history.slice(-100).map((r: PowerHistoryItem) => ({
      time: new Date(r.timestamp).toLocaleTimeString(),
      watts: r.watts,
    }));
  })();

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "1.5rem",
      display: "flex", flexDirection: "column", gap: "1.25rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4" }}>
            Power History
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--stone-400)", marginTop: "0.2rem" }}>
            Historical power readings from the simulation
          </p>
        </div>
        {/* Export buttons */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a
            href={getExportUrl({ format: "csv", device_id: deviceId || undefined, limit })}
            target="_blank" rel="noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: "0.8rem", textDecoration: "none" }}
          >
            ↓ CSV
          </a>
          <a
            href={getExportUrl({ format: "xlsx", device_id: deviceId || undefined, limit })}
            target="_blank" rel="noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: "0.8rem", textDecoration: "none" }}
          >
            ↓ XLSX
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="glass" style={{ padding: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}>
          <label style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", display: "block", marginBottom: "0.4rem" }}>
            DEVICE
          </label>
          <select className="input" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            {DEVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", display: "block", marginBottom: "0.4rem" }}>
            LIMIT
          </label>
          <select className="input" value={limit} onChange={e => setLimit(+e.target.value)}>
            {[100, 200, 500, 1000, 2000].map(l => <option key={l} value={l}>{l} rows</option>)}
          </select>
        </div>
        <button className="btn btn-primary" style={{ fontSize: "0.8rem" }} onClick={fetchHistory} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {(["chart", "alerts"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "0.78rem", textTransform: "capitalize" }}>
            {t === "chart" ? "📈 Chart" : `🔔 Alerts (${alerts.length})`}
          </button>
        ))}
      </div>

      {tab === "chart" && (
        <div className="glass" style={{ padding: "1.5rem", flex: 1, minHeight: 320 }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", marginBottom: "1rem" }}>
            POWER DRAW OVER TIME {deviceId ? `— ${deviceId}` : "— ALL DEVICES"}
          </div>
          {chartData.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--stone-500)", paddingTop: "4rem" }}>
              No data yet. Start some devices to generate readings.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4d7c4d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4d7c4d" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: "#78716c", fontSize: 10 }} tickLine={false} />
                <YAxis tickFormatter={v => formatWatts(v)} tick={{ fill: "#78716c", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(22,26,36,0.95)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "0.5rem",
                    color: "#e8e8ea",
                    fontSize: "0.78rem",
                  }}
                  formatter={(v: any) => [formatWatts(Number(v ?? 0)), "Power"]}
                />
                <Area
                  type="monotone" dataKey="watts" stroke="#4d7c4d" strokeWidth={2}
                  fill="url(#powerGrad)" dot={false} activeDot={{ r: 4, fill: "#81c784" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <div className="glass" style={{ padding: "1rem", flex: 1 }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", marginBottom: "1rem" }}>
            RECENT ALERTS
          </div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--stone-500)", paddingTop: "3rem" }}>
              No alerts recorded.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {alerts.map((a: AlertRecord) => (
                <div key={a.id} style={{
                  display: "flex", gap: "1rem", alignItems: "flex-start",
                  padding: "0.75rem 1rem",
                  background: a.alertType === "overload_trip"
                    ? "rgba(244,67,54,0.07)"
                    : "rgba(255,193,7,0.07)",
                  border: `1px solid ${a.alertType === "overload_trip" ? "rgba(244,67,54,0.2)" : "rgba(255,193,7,0.2)"}`,
                  borderRadius: "0.5rem",
                }}>
                  <span style={{ fontSize: "1rem" }}>{a.alertType === "overload_trip" ? "🔴" : "⚠️"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.78rem", color: a.alertType === "overload_trip" ? "#ef9a9a" : "#ffd54f", fontWeight: 600 }}>
                      {a.alertType.replace(/_/g, " ").toUpperCase()}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#c8c8ca", marginTop: "0.15rem" }}>{a.message}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--stone-500)", marginTop: "0.25rem", fontFamily: "var(--font-mono)" }}>
                      {formatWatts(a.totalDrawWatts)} / {formatWatts(a.limitWatts)} · {formatDateTime(a.raisedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
