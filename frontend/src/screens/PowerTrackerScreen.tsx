/**
 * PowerTrackerScreen — household power consumption over time.
 *
 * Reuses getPowerHistory() and getAlerts() from api/client (same endpoints as
 * HistoryScreen), but presents the data differently:
 *
 *  - Summary strip: total gross draw / solar generation / net draw against limit
 *  - Stacked area chart: gross device load + solar offset (as negative area)
 *  - Per-device bar chart for the current snapshot
 *  - Alert history table (same data as HistoryScreen's alert tab)
 *
 * Live values come from wsStore so the summary strip ticks in real time.
 */
import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { getPowerHistory, getAlerts, getExportUrl } from "../api/client";
import { useWsStore } from "../stores/wsStore";
import type { PowerHistoryItem, AlertRecord } from "../types";
import { formatWatts, formatDateTime } from "../utils/formatters";

function StatCard({ label, value, color, sub }: {
  label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div className="glass" style={{ padding: "1rem 1.25rem", flex: "1 1 160px" }}>
      <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--stone-500)", marginBottom: "0.3rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-mono)", fontWeight: 700, color }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.65rem", color: "var(--stone-500)", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

export default function PowerTrackerScreen() {
  const reading      = useWsStore((s) => s.latestPowerReading);
  const solarGen     = useWsStore((s) => s.solarGenerationWatts);
  const netDraw      = useWsStore((s) => s.netDrawWatts);
  const tier         = useWsStore((s) => s.tier);

  const [history, setHistory]     = useState<PowerHistoryItem[]>([]);
  const [alerts,  setAlerts]      = useState<AlertRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [tab,     setTab]         = useState<"chart" | "breakdown" | "alerts">("chart");
  const [limit,   setLimit]       = useState(200);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a] = await Promise.all([
        getPowerHistory({ limit }),
        getAlerts(50),
      ]);
      setHistory(h);
      setAlerts(a);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Chart data: aggregate all devices per timestamp ─────────────────
  const chartData = (() => {
    const map: Record<string, { time: string; gross: number; solar: number }> = {};
    for (const r of history) {
      const key = r.timestamp;
      if (!map[key]) map[key] = { time: new Date(key).toLocaleTimeString(), gross: 0, solar: 0 };
      if (r.deviceId === "solar_panel_01") {
        map[key].solar += Math.abs(r.watts);
      } else {
        map[key].gross += r.watts;
      }
    }
    return Object.values(map).slice(-100).map((d) => ({
      ...d,
      net: Math.max(0, d.gross - d.solar),
    }));
  })();

  // ── Per-device breakdown from latest power_reading ───────────────────
  const perDevice = reading?.perDevice ?? [];
  const breakdownData = perDevice
    .filter((d) => Math.abs(d.watts) > 0)
    .map((d) => ({
      name: d.deviceId.replace("_01", "").replace(/_/g, " "),
      watts: d.watts,
      isSolar: d.deviceId === "solar_panel_01",
    }))
    .sort((a, b) => Math.abs(b.watts) - Math.abs(a.watts));

  const gross       = reading?.totalDrawWatts ?? 0;
  const limitWatts  = reading?.limitWatts ?? 9200;
  const utilisationPct = limitWatts > 0 ? (netDraw / limitWatts) * 100 : 0;

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`btn ${tab === id ? "btn-primary" : "btn-ghost"}`}
      style={{ fontSize: "0.78rem" }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      height: "100%", overflowY: "auto", padding: "1.5rem",
      display: "flex", flexDirection: "column", gap: "1.25rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", fontWeight: 700, color: "#f0ece4" }}>
            Power Tracker
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--stone-400)", marginTop: "0.2rem" }}>
            Household consumption, solar generation, net draw vs {tier ? tier.toUpperCase() : "—"} tier limit
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <a href={getExportUrl({ format: "csv" })} target="_blank" rel="noreferrer"
            className="btn btn-ghost" style={{ fontSize: "0.8rem", textDecoration: "none" }}>
            ↓ CSV
          </a>
          <a href={getExportUrl({ format: "xlsx" })} target="_blank" rel="noreferrer"
            className="btn btn-ghost" style={{ fontSize: "0.8rem", textDecoration: "none" }}>
            ↓ XLSX
          </a>
          <button className="btn btn-ghost" style={{ fontSize: "0.8rem" }}
            onClick={fetchData} disabled={loading}>
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <StatCard
          label="TOTAL DEVICE DRAW"
          value={formatWatts(gross)}
          color="#e8e8ea"
          sub="gross consumption"
        />
        <StatCard
          label="SOLAR GENERATION"
          value={solarGen > 0 ? `−${formatWatts(solarGen)}` : "—"}
          color="#4ade80"
          sub="offsetting load"
        />
        <StatCard
          label="NET DRAW"
          value={formatWatts(netDraw)}
          color={utilisationPct >= 95 ? "#f87171" : utilisationPct >= 80 ? "#fbbf24" : "#a3e635"}
          sub={`${utilisationPct.toFixed(1)} % of ${formatWatts(limitWatts)} limit`}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {tabBtn("chart",     "📈 History chart")}
        {tabBtn("breakdown", "📊 Device breakdown")}
        {tabBtn("alerts",    `🔔 Alerts (${alerts.length})`)}
      </div>

      {/* ── History chart ── */}
      {tab === "chart" && (
        <div className="glass" style={{ padding: "1.5rem", flex: 1, minHeight: 320 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)" }}>
              POWER DRAW OVER TIME
            </div>
            <select className="input" style={{ fontSize: "0.72rem", width: "auto" }}
              value={limit} onChange={(e) => setLimit(+e.target.value)}>
              {[100, 200, 500, 1000].map((l) => (
                <option key={l} value={l}>{l} rows</option>
              ))}
            </select>
          </div>
          {chartData.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--stone-500)", paddingTop: "4rem" }}>
              No data yet. Start some devices to generate readings.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: "#78716c", fontSize: 10 }} tickLine={false} />
                <YAxis tickFormatter={(v) => formatWatts(Number(v ?? 0))} tick={{ fill: "#78716c", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(22,26,36,0.95)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "0.5rem", color: "#e8e8ea", fontSize: "0.78rem" }}
                  formatter={((v: unknown, name: string) => [formatWatts(Number(v ?? 0)), name]) as any}
                />
                <Legend wrapperStyle={{ fontSize: "0.72rem", color: "var(--stone-400)" }} />
                <Area type="monotone" dataKey="gross"  name="Gross draw"  stroke="#6366f1" strokeWidth={1.5} fill="url(#grossGrad)"  dot={false} />
                <Area type="monotone" dataKey="solar"  name="Solar gen"   stroke="#4ade80" strokeWidth={1.5} fill="url(#solarGrad)"  dot={false} />
                <Area type="monotone" dataKey="net"    name="Net draw"    stroke="#fbbf24" strokeWidth={2}   fill="url(#netGrad)"    dot={false} />
                <ReferenceLine y={limitWatts} stroke="rgba(248,113,113,0.5)" strokeDasharray="4 4"
                  label={{ value: "Limit", fill: "#f87171", fontSize: 10, position: "insideTopRight" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Device breakdown ── */}
      {tab === "breakdown" && (
        <div className="glass" style={{ padding: "1.5rem", flex: 1, minHeight: 280 }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", marginBottom: "1rem" }}>
            CURRENT DEVICE BREAKDOWN
          </div>
          {breakdownData.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--stone-500)", paddingTop: "3rem" }}>
              No active devices.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, breakdownData.length * 38)}>
              <BarChart data={breakdownData} layout="vertical" margin={{ top: 0, right: 60, left: 20, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tickFormatter={(v) => formatWatts(Math.abs(Number(v ?? 0)))}
                  tick={{ fill: "#78716c", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a8a29e", fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                <Tooltip
                  contentStyle={{ background: "rgba(22,26,36,0.95)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "0.5rem", fontSize: "0.78rem" }}
                  formatter={((v: unknown, _: string, props: { payload?: { isSolar?: boolean } }) =>
                    [formatWatts(Math.abs(Number(v ?? 0))), props?.payload?.isSolar ? "Generation" : "Consumption"]) as any}
                />
                <Bar dataKey="watts" radius={[0, 4, 4, 0]}
                  fill="#6366f1"
                  label={{ position: "right", fill: "#a8a29e", fontSize: 10,
                    formatter: ((v: number) => formatWatts(Math.abs(v))) as any }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Alerts ── */}
      {tab === "alerts" && (
        <div className="glass" style={{ padding: "1rem", flex: 1 }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--stone-400)", marginBottom: "1rem" }}>
            RECENT ALERTS (net-draw based — solar offsets are factored in)
          </div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--stone-500)", padding: "2rem 0" }}>
              No alerts recorded.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {alerts.map((a: AlertRecord) => (
                <div key={a.id} style={{
                  display: "flex", gap: "1rem", alignItems: "flex-start",
                  padding: "0.75rem 1rem",
                  background: a.alertType === "overload_trip" ? "rgba(244,67,54,0.07)" : "rgba(255,193,7,0.07)",
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
                      {formatWatts(a.totalDrawWatts)} net / {formatWatts(a.limitWatts)} limit · {formatDateTime(a.raisedAt)}
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
