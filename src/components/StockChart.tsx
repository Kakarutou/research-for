"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartPoint, ChartResponse } from "@/app/api/stock/[ticker]/chart/route";

const PERIODS = [
  { label: "1D", range: "1d" },
  { label: "5D", range: "5d" },
  { label: "1M", range: "1mo" },
  { label: "3M", range: "3mo" },
  { label: "1Y", range: "1y" },
];

const UP   = "#16a34a";
const DOWN = "#dc2626";

export default function StockChart({ ticker, initialIsUp }: { ticker: string; initialIsUp?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const mainRef      = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const volRef       = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [chartType, setChartType]   = useState<"candle" | "line">("candle");
  const [range, setRange]           = useState("1mo");
  const [result, setResult]         = useState<ChartResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch(`/api/stock/${encodeURIComponent(ticker)}/chart?range=${range}`, { cache: "no-store" });
      const json: ChartResponse | null = await res.json();
      if (json?.data?.length) { setResult(json); setLastUpdated(new Date()); }
    } finally {
      setLoading(false);
    }
  }, [ticker, range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  const isUp  = result ? result.changePct >= 0 : (initialIsUp ?? true);
  const color = isUp ? UP : DOWN;

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout:    { background: { color: "transparent" }, textColor: "#71717a", fontFamily: "monospace", fontSize: 11 },
      grid:      { vertLines: { color: "#e4e4e7" }, horzLines: { color: "#e4e4e7" } },
      rightPriceScale: { borderColor: "#e4e4e7" },
      timeScale: { borderColor: "#e4e4e7", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      width:  containerRef.current.clientWidth,
      height: 320,
    });
    chartRef.current = chart;

    // Volume series — bottom 15% of chart area
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volRef.current = vol;

    // Resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 320);
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // Update series when chartType or data changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !result?.data?.length) return;

    // Remove old main series
    if (mainRef.current) { chart.removeSeries(mainRef.current); mainRef.current = null; }

    const data: ChartPoint[] = result.data;

    if (chartType === "candle") {
      const s = chart.addSeries(CandlestickSeries, {
        upColor:        UP,
        downColor:      DOWN,
        borderUpColor:  UP,
        borderDownColor: DOWN,
        wickUpColor:    UP,
        wickDownColor:  DOWN,
      });
      s.setData(data.map(d => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
      mainRef.current = s;
    } else {
      const s = chart.addSeries(AreaSeries, {
        lineColor:   color,
        topColor:    isUp ? "rgba(22,163,74,0.18)" : "rgba(220,38,38,0.18)",
        bottomColor: "rgba(0,0,0,0)",
        lineWidth:   2,
      });
      s.setData(data.map(d => ({ time: d.time as UTCTimestamp, value: d.close })));
      mainRef.current = s;
    }

    // Volume
    volRef.current?.setData(data.map(d => ({
      time:  d.time as UTCTimestamp,
      value: d.volume,
      color: d.close >= d.open ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)",
    })));

    chart.timeScale().fitContent();
  }, [chartType, result, color, isUp]);

  const btnBase: React.CSSProperties = {
    fontFamily: "monospace", fontSize: 12, fontWeight: 600,
    padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: "none",
    transition: "all 0.15s",
  };

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        {/* Period */}
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.range} onClick={() => setRange(p.range)} style={{
              ...btnBase,
              background: range === p.range ? color : "var(--gray-100)",
              color:      range === p.range ? "#fff" : "var(--gray-500)",
            }}>{p.label}</button>
          ))}
        </div>

        {/* Chart type toggle */}
        <div style={{ display: "flex", gap: 4, background: "var(--gray-100)", borderRadius: 8, padding: 3 }}>
          {(["candle", "line"] as const).map(t => (
            <button key={t} onClick={() => setChartType(t)} style={{
              ...btnBase,
              padding: "4px 14px", borderRadius: 6,
              background: chartType === t ? "#fff" : "transparent",
              color:      chartType === t ? "var(--gray-900)" : "var(--gray-400)",
              boxShadow:  chartType === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}>
              {t === "candle" ? "🕯 캔들" : "📈 라인"}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: 320, borderRadius: 8, overflow: "hidden" }} />
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.6)", borderRadius: 8,
          }}>
            <div style={{
              width: 22, height: 22,
              border: `2px solid ${color}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "spin 0.8s linear infinite",
            }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-400)" }}>
          15min delay
          {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
        </span>
      </div>
    </div>
  );
}
