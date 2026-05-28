"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/app/api/search/route";

const NAV_TABS = [
  { id: "forum",   label: "Forum",   href: "/forum" },
  { id: "crypto",  label: "Crypto",  href: "/crypto" },
  { id: "news",    label: "News",    href: "/news" },
  { id: "reports", label: "Reports", href: "/reports" },
];

export default function SearchBox({ hideTabs, compact, width }: { hideTabs?: boolean; compact?: boolean; width?: number } = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch {}
    }, 300);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("searchInput")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const logAndNavigate = useCallback((symbol: string, name: string) => {
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, name }),
    }).catch(() => {});
    setShowDropdown(false);
    setQuery("");
    router.push(`/stock/${symbol}`);
  }, [router]);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    if (suggestions.length > 0) {
      logAndNavigate(suggestions[0].symbol, suggestions[0].name);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const results: SearchResult[] = res.ok ? await res.json() : [];
      const sym = results[0]?.symbol ?? query.trim().toUpperCase();
      const name = results[0]?.name ?? sym;
      logAndNavigate(sym, name);
    } finally {
      setSearching(false);
    }
  };

  // compact 모드: 브레드크럼 오른쪽에 붙는 작은 검색바
  if (compact) {
    const btnSize = 32;
    return (
      <div ref={wrapperRef} style={{ position: "relative", width: width ?? 260, maxWidth: "100%" }}>
        <div style={{
          background: "rgba(255,255,255,0.15)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: showDropdown ? "10px 10px 0 0" : 10,
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0 6px 0 12px", height: 36 }}>
            <svg style={{ color: "rgba(255,255,255,0.55)", marginRight: 8, flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              id="searchInput"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder="종목 검색…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 13, color: "white", minWidth: 0,
              }}
            />
            <button onClick={handleSearch} disabled={searching} style={{
              background: "rgba(255,255,255,0.18)", color: "white",
              border: "none", width: btnSize, height: btnSize, borderRadius: 7,
              cursor: searching ? "default" : "pointer",
              display: "grid", placeItems: "center", flexShrink: 0,
              transition: "background 0.15s",
            }}>
              {searching ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "rgba(255,255,255,0.97)", backdropFilter: "blur(24px)",
            border: "1px solid var(--gray-200)", borderTop: "none",
            borderRadius: "0 0 10px 10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 100, overflow: "hidden",
          }}>
            {suggestions.map((s, i) => (
              <div
                key={s.symbol}
                onMouseDown={() => logAndNavigate(s.symbol, s.name)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", cursor: "pointer",
                  borderTop: i > 0 ? "1px solid var(--gray-100)" : "none",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
              >
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 700, color: "var(--gray-900)", minWidth: 80 }}>
                  {s.symbol}
                </span>
                <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 12, color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 600 }}>
      {/* Category tabs */}
      {!hideTabs && <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 14 }}>
        {NAV_TABS.map(t => (
          <button key={t.id} onClick={() => router.push(t.href)} style={{
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 20, padding: "6px 18px",
            fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 500,
            color: "rgba(255,255,255,0.82)", cursor: "pointer",
            backdropFilter: "blur(8px)", transition: "all 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.22)"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.82)"; }}
          >
            {t.label}
          </button>
        ))}
      </div>}

      {/* Search input + autocomplete */}
      <div ref={wrapperRef} style={{ position: "relative" }}>
        <div style={{
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(24px)",
          border: "1px solid var(--gray-200)",
          borderRadius: showDropdown ? "24px 24px 0 0" : 24,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", padding: "6px 8px 6px 24px" }}>
            <svg style={{ color: "var(--gray-400)", marginRight: 14, flexShrink: 0 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              id="searchInput"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder="전 종목 검색 — AAPL, 삼성전자, BTC, TSLA…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                padding: "22px 0", fontFamily: "var(--font-sans), sans-serif",
                fontSize: 17, color: "var(--gray-900)", minWidth: 0,
              }}
            />
            <button onClick={handleSearch} disabled={searching} style={{
              background: searching ? "var(--gray-400)" : "var(--gray-900)", color: "white",
              border: "none", width: 44, height: 44, borderRadius: 14,
              cursor: searching ? "default" : "pointer",
              display: "grid", placeItems: "center", flexShrink: 0,
              transition: "background 0.15s",
            }}>
              {searching ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "rgba(255,255,255,0.97)", backdropFilter: "blur(24px)",
            border: "1px solid var(--gray-200)", borderTop: "none",
            borderRadius: "0 0 24px 24px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden",
          }}>
            {suggestions.map((s, i) => (
              <div
                key={s.symbol}
                onMouseDown={() => logAndNavigate(s.symbol, s.name)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 24px", cursor: "pointer",
                  borderTop: i > 0 ? "1px solid var(--gray-100)" : "none",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
              >
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, fontWeight: 700, color: "var(--gray-900)", minWidth: 100 }}>
                  {s.symbol}
                </span>
                <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 13, color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
