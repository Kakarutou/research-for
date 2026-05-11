"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart, CandlestickSeries, AreaSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from "lightweight-charts";
import type { ChartPoint, ChartResponse } from "@/app/api/stock/[ticker]/chart/route";

const UP   = "#16a34a";
const DOWN = "#dc2626";

const MINUTE_TFS = [
  { label: "1분",   tf: "1m" },
  { label: "3분",   tf: "3m" },
  { label: "5분",   tf: "5m" },
  { label: "10분",  tf: "10m" },
  { label: "15분",  tf: "15m" },
  { label: "30분",  tf: "30m" },
  { label: "60분",  tf: "60m" },
  { label: "120분", tf: "120m" },
  { label: "240분", tf: "240m" },
];

const DAY_TFS = [
  { label: "일봉", tf: "1d" },
  { label: "주봉", tf: "1w" },
  { label: "월봉", tf: "1mo" },
  { label: "년봉", tf: "1y" },
];

const MINUTE_SET = new Set(MINUTE_TFS.map(t => t.tf));

export default function StockChart({ ticker, initialIsUp }: { ticker: string; initialIsUp?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const mainRef      = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const volRef       = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [chartType, setChartType]   = useState<"candle" | "line">("candle");
  const [tf, setTf]                 = useState("1d");
  const [dropOpen, setDropOpen]     = useState(false);
  const [result, setResult]         = useState<ChartResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [unavail, setUnavail]       = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setUnavail(false);
    try {
      const res  = await fetch(`/api/stock/${encodeURIComponent(ticker)}/chart?tf=${tf}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.error === 'intraday_unavailable') { setUnavail(true); return; }
      if (json?.data?.length) { setResult(json); setLastUpdated(new Date()); }
    } finally {
      setLoading(false);
    }
  }, [ticker, tf]);

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

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volRef.current = vol;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 320);
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []);

  // Update time axis visibility per timeframe
  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: { timeVisible: MINUTE_SET.has(tf), secondsVisible: false },
    });
  }, [tf]);

  // Rebuild main series when chartType or data changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !result?.data?.length) return;

    if (mainRef.current) { chart.removeSeries(mainRef.current); mainRef.current = null; }

    const data: ChartPoint[] = result.data;

    if (chartType === "candle") {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: UP, downColor: DOWN,
        borderUpColor: UP, borderDownColor: DOWN,
        wickUpColor: UP, wickDownColor: DOWN,
      });
      s.setData(data.map(d => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
      mainRef.current = s;
    } else {
      const s = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor:    isUp ? "rgba(22,163,74,0.18)" : "rgba(220,38,38,0.18)",
        bottomColor: "rgba(0,0,0,0)",
        lineWidth: 2,
      });
      s.setData(data.map(d => ({ time: d.time as UTCTimestamp, value: d.close })));
      mainRef.current = s;
    }

    volRef.current?.setData(data.map(d => ({
      time: d.time as UTCTimestamp, value: d.volume,
      color: d.close >= d.open ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)",
    })));

    chart.timeScale().fitContent();
  }, [chartType, result, color, isUp]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropOpen) return;
    const close = () => setDropOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [dropOpen]);

  const activeTfLabel = MINUTE_TFS.find(t => t.tf === tf)?.label ?? null;
  const btnBase: React.CSSProperties = {
    fontFamily: "monospace", fontSize: 12, fontWeight: 600,
    padding: "4px 12px", borderRadius: 6, cursor: "pointer", border: "none",
    transition: "all 0.12s",
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>

        {/* Left: 분봉 dropdown + 일/주/월/년 buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>

          {/* 분봉 dropdown */}
          <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => setDropOpen(o => !o)}
              style={{
                ...btnBase,
                background: activeTfLabel ? color : "var(--gray-100)",
                color:      activeTfLabel ? "#fff" : "var(--gray-500)",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {activeTfLabel ?? "분봉"}
              <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
            </button>

            {dropOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                background: "#fff", border: "1px solid var(--gray-200)",
                borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                overflow: "hidden", minWidth: 80,
              }}>
                {MINUTE_TFS.map(t => (
                  <button key={t.tf} onClick={() => { setTf(t.tf); setDropOpen(false); }} style={{
                    display: "block", width: "100%", textAlign: "left",
                    fontFamily: "monospace", fontSize: 12, fontWeight: 600,
                    padding: "8px 14px", border: "none", cursor: "pointer",
                    background: tf === t.tf ? "var(--gray-100)" : "#fff",
                    color: tf === t.tf ? "var(--gray-900)" : "var(--gray-600)",
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 일/주/월/년 buttons */}
          {DAY_TFS.map(t => (
            <button key={t.tf} onClick={() => setTf(t.tf)} style={{
              ...btnBase,
              background: tf === t.tf ? color : "var(--gray-100)",
              color:      tf === t.tf ? "#fff" : "var(--gray-500)",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Right: candle / line toggle (single button) */}
        <button onClick={() => setChartType(t => t === "candle" ? "line" : "candle")} style={{
          ...btnBase,
          background: "var(--gray-100)", color: "var(--gray-700)",
          border: "1px solid var(--gray-200)",
          minWidth: 68,
        }}>
          {chartType === "candle" ? "캔들" : "라인"}
        </button>
      </div>

      {/* Chart */}
      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: 320, borderRadius: 8, overflow: "hidden" }} />

        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.65)", borderRadius: 8 }}>
            <div style={{ width: 22, height: 22, border: `2px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {unavail && !loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", borderRadius: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--gray-500)" }}>
              분봉 데이터는 한국 주식에서 지원하지 않습니다
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-400)" }}>
          15min delay
          {lastUpdated && ` · ${lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`}
        </span>
      </div>
    </div>
  );
}
