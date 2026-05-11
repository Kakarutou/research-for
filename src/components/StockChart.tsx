"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart, CandlestickSeries, AreaSeries, HistogramSeries, TickMarkType,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from "lightweight-charts";
import type { ChartResponse } from "@/app/api/stock/[ticker]/chart/route";

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

function padZ(n: number) { return n.toString().padStart(2, "0"); }

function makeTickFormatter(isIntraday: boolean, utcOffset: number) {
  return (time: UTCTimestamp, type: TickMarkType, _locale: string): string | null => {
    const localTs = isIntraday ? time + utcOffset : time;
    const d = new Date(localTs * 1000);
    switch (type) {
      case TickMarkType.Year:        return String(d.getUTCFullYear());
      case TickMarkType.Month:       return `${d.getUTCFullYear()}.${padZ(d.getUTCMonth() + 1)}`;
      case TickMarkType.DayOfMonth:  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
      case TickMarkType.Time:
      case TickMarkType.TimeWithSeconds:
        return `${padZ(d.getUTCHours())}:${padZ(d.getUTCMinutes())}`;
    }
    return null;
  };
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div style={{ userSelect: "none", cursor: "pointer" }} onClick={onToggle}>
      <div style={{
        width: 44, height: 24, borderRadius: 12, position: "relative",
        background: on ? "#18181b" : "#d4d4d8",
        transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", width: 18, height: 18, borderRadius: "50%",
          background: "#fff", top: 3, left: on ? 23 : 3,
          transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }} />
      </div>
    </div>
  );
}

const CHART_H = 226;

export default function StockChart({ ticker, initialIsUp }: { ticker: string; initialIsUp?: boolean }) {
  const chartRef   = useRef<HTMLDivElement>(null);
  const chart      = useRef<IChartApi | null>(null);
  const mainSeries = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const volSeries  = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [chartType, setChartType]     = useState<"candle" | "line">("candle");
  const [tf, setTf]                   = useState("1d");
  const [dropOpen, setDropOpen]       = useState(false);
  const [result, setResult]           = useState<ChartResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [unavail, setUnavail]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setUnavail(false);
    try {
      const res  = await fetch(`/api/stock/${encodeURIComponent(ticker)}/chart?tf=${tf}`, { cache: "no-store" });
      const json: ChartResponse & { error?: string } | null = await res.json();
      if (json?.error === "intraday_unavailable") { setUnavail(true); return; }
      if (json?.data?.length) { setResult(json as ChartResponse); setLastUpdated(new Date()); }
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

  const isUp      = result ? result.changePct >= 0 : (initialIsUp ?? true);
  const color     = isUp ? UP : DOWN;
  const isIntraday = MINUTE_SET.has(tf);
  const utcOffset  = result?.utcOffset ?? -14400;

  // Create single chart with volume on a separate price scale
  useEffect(() => {
    if (!chartRef.current) return;
    const c = createChart(chartRef.current, {
      layout:    { background: { color: "transparent" }, textColor: "#71717a", fontFamily: "monospace", fontSize: 11 },
      grid:      { vertLines: { color: "#e4e4e7" }, horzLines: { color: "#e4e4e7" } },
      rightPriceScale: { borderColor: "#e4e4e7" },
      timeScale: { borderColor: "#e4e4e7", timeVisible: false, secondsVisible: false },
      crosshair: { mode: 1 },
      width:  chartRef.current.clientWidth,
      height: CHART_H,
    });

    // Price scale occupies top ~70%, leaving room for volume below
    c.priceScale("right").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.28 } });

    // Volume histogram on a separate scale pinned to bottom 22%
    const vs = c.addSeries(HistogramSeries, {
      priceFormat:      { type: "volume" },
      priceScaleId:     "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    c.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

    chart.current     = c;
    volSeries.current = vs;

    const ro = new ResizeObserver(() => {
      if (chartRef.current) c.resize(chartRef.current.clientWidth, CHART_H);
    });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); c.remove(); chart.current = null; volSeries.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync time axis + crosshair formatter
  useEffect(() => {
    const fmt = makeTickFormatter(isIntraday, utcOffset);
    const timeFmt = (time: UTCTimestamp): string => {
      const localTs = isIntraday ? time + utcOffset : time;
      const d = new Date(localTs * 1000);
      if (isIntraday) return `${padZ(d.getUTCHours())}:${padZ(d.getUTCMinutes())}`;
      return `${d.getUTCFullYear()}.${padZ(d.getUTCMonth() + 1)}.${padZ(d.getUTCDate())}`;
    };
    chart.current?.applyOptions({
      localization: { timeFormatter: timeFmt },
      timeScale: { timeVisible: isIntraday, secondsVisible: false, tickMarkFormatter: fmt },
    });
  }, [isIntraday, utcOffset]);

  // Rebuild price series when chartType or data changes
  useEffect(() => {
    const c = chart.current;
    if (!c || !result?.data?.length) return;

    if (mainSeries.current) { c.removeSeries(mainSeries.current); mainSeries.current = null; }

    const data = result.data;
    if (chartType === "candle") {
      const s = c.addSeries(CandlestickSeries, {
        upColor: UP, downColor: DOWN,
        borderUpColor: UP, borderDownColor: DOWN,
        wickUpColor: UP, wickDownColor: DOWN,
      });
      s.setData(data.map(d => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
      mainSeries.current = s;
    } else {
      const s = c.addSeries(AreaSeries, {
        lineColor:   color,
        topColor:    isUp ? "rgba(22,163,74,0.18)" : "rgba(220,38,38,0.18)",
        bottomColor: "rgba(0,0,0,0)",
        lineWidth:   2,
      });
      s.setData(data.map(d => ({ time: d.time as UTCTimestamp, value: d.close })));
      mainSeries.current = s;
    }
    c.timeScale().fitContent();

    volSeries.current?.setData(data.map(d => ({
      time:  d.time as UTCTimestamp,
      value: d.volume,
      color: d.close >= d.open ? "rgba(22,163,74,0.5)" : "rgba(220,38,38,0.5)",
    })));
  }, [chartType, result, color, isUp]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element)?.closest?.("[data-dropdown]")) setDropOpen(false);
    };
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
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {/* 분봉 dropdown */}
          <div style={{ position: "relative" }} data-dropdown>
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
                    color:      tf === t.tf ? "var(--gray-900)" : "var(--gray-600)",
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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

        <ToggleSwitch
          on={chartType === "candle"}
          onToggle={() => setChartType(t => t === "candle" ? "line" : "candle")}
        />
      </div>

      {/* Chart */}
      <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid var(--gray-200)" }}>
        <div ref={chartRef} style={{ width: "100%" }} />

        {(loading || unavail) && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.75)", borderRadius: 8 }}>
            {loading
              ? <div style={{ width: 22, height: 22, border: `2px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              : <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--gray-500)" }}>분봉은 한국 주식에서 지원되지 않습니다</span>
            }
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-400)" }}>
          15min delay{lastUpdated && ` · ${lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`}
        </span>
      </div>
    </div>
  );
}
