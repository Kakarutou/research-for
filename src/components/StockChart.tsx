"use client";
import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import type { ChartResponse } from "@/app/api/stock/[ticker]/chart/route";

const PERIODS = [
  { label: "1D", range: "1d" },
  { label: "5D", range: "5d" },
  { label: "1M", range: "1mo" },
  { label: "3M", range: "3mo" },
  { label: "1Y", range: "1y" },
];

export default function StockChart({ ticker, initialIsUp }: { ticker: string; initialIsUp?: boolean }) {
  const [range, setRange] = useState("1mo");
  const [chart, setChart] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchChart = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(ticker)}/chart?range=${range}`, { cache: 'no-store' });
      const json: ChartResponse | null = await res.json();
      if (json) { setChart(json); setLastUpdated(new Date()); }
    } finally {
      setLoading(false);
    }
  }, [ticker, range]);

  useEffect(() => {
    setLoading(true);
    fetchChart();
    const id = setInterval(fetchChart, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchChart]);

  const isUp = chart ? chart.changePct >= 0 : (initialIsUp ?? true);
  const color = isUp ? "#16a34a" : "#dc2626";

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {PERIODS.map(p => (
          <button key={p.range} onClick={() => setRange(p.range)} style={{
            fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 600,
            padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: "none",
            background: range === p.range ? color : "var(--gray-100)",
            color: range === p.range ? "#fff" : "var(--gray-500)",
            transition: "all 0.15s",
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: 22, height: 22,
            border: `2px solid ${color}`, borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 0.8s linear infinite",
          }} />
        </div>
      ) : !chart?.data?.length ? (
        <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a", fontSize: 13 }}>
          No chart data available
        </div>
      ) : !mounted ? (
        <div style={{ height: 280 }} />
      ) : (
        <>
          {/* Price area chart */}
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fill: "#71717a" }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fill: "#71717a" }}
                  axisLine={false} tickLine={false} width={65} domain={["auto", "auto"]}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(2)}
                />
                <Tooltip
                  contentStyle={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, border: "1px solid #e4e4e7", borderRadius: 8, background: "rgba(255,255,255,0.97)" }}
                  labelStyle={{ fontWeight: 600, color: "#18181b" }}
                  formatter={(v: unknown) => [
                    Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    "Price",
                  ]}
                />
                <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill={`url(#grad-${ticker})`} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Volume bar chart */}
          <div style={{ height: 70 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, border: "1px solid #e4e4e7", borderRadius: 8 }}
                  formatter={(v: unknown) => [`${(Number(v) / 1_000_000).toFixed(2)}M`, "Vol"]}
                />
                <Bar dataKey="volume" fill={color} opacity={0.35} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--gray-400)" }}>
              Yahoo Finance · 15min delay
              {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
