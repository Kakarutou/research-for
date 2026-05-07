"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface ChartData { date: string; close: number; volume: number; }

export default function StockChart({ data, isUp }: { data: ChartData[]; isUp: boolean }) {
  const color = isUp ? "#16a34a" : "#dc2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Price chart */}
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="date" tick={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} width={60} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, border: "1px solid #e4e4e7", borderRadius: 8, background: "rgba(255,255,255,0.95)" }}
              labelStyle={{ fontWeight: 600, color: "#18181b" }}
            />
            <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill="url(#colorClose)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume chart */}
      <div style={{ height: 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, border: "1px solid #e4e4e7", borderRadius: 8 }}
              formatter={(v: unknown) => [`${(Number(v) / 1000000).toFixed(1)}M`, "Volume"]}
            />
            <Bar dataKey="volume" fill={color} opacity={0.4} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
