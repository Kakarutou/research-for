"use client";
import { useState, useMemo } from "react";
import type { NewsItem } from "@/app/api/stock/[ticker]/news/route";

type Tab = "호재" | "악재" | "공시" | "어닝콜";
const TABS: Tab[] = ["호재", "악재", "공시", "어닝콜"];

function relTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function classify(item: NewsItem): Tab {
  // Force-classify SEC earnings press releases into 어닝콜
  if (item.source === 'SEC 실적발표') return "어닝콜";

  const t = (item.title + " " + item.source).toLowerCase();

  // 어닝콜 — 실적 발표 관련
  const earningsKw = [
    // EN
    "earnings", "eps", "quarterly result", "q1 ", "q2 ", "q3 ", "q4 ",
    "guidance", "outlook", "conference call", "results", "beat estimates",
    "missed estimates", "fiscal year", "annual result", "revenue beat",
    "revenue miss", "earnings call", "earnings report", "profit forecast",
    // KO
    "실적발표", "어닝콜", "분기실적", "연간실적", "가이던스", "영업이익",
    "순이익", "매출액 발표", "실적 시즌",
  ];
  if (earningsKw.some(w => t.includes(w))) return "어닝콜";

  // 내부자 거래 — 공시보다 먼저 체크 (공시 키워드에 묻히지 않도록)
  const insiderSellKw = [
    "insider sell", "insider sold", "insider selling", "insider sale",
    "director sells", "director sold", "director disposes",
    "officer sells", "officer sold", "ceo sells", "cfo sells", "coo sells",
    "executive sells", "executive sold", "vp sells",
    "board member sells", "disposes of shares", "disposed shares",
    "sells shares", "sold shares", "sells stock", "sold stock",
    "sells stake", "sells large stake", "sell-to-cover", "sells $",
    "insider transaction", "form 4",
    "내부자 매도", "사내이사 매도", "사외이사 매도",
    "임원 주식 매도", "임원 매도", "대주주 매도", "블록딜",
  ];
  if (insiderSellKw.some(w => t.includes(w))) return "악재";

  const insiderBuyKw = [
    "insider buy", "insider bought", "insider buying", "insider purchase",
    "director buys", "director bought", "director purchases",
    "officer buys", "officer bought", "ceo buys", "cfo buys",
    "executive buys", "executive bought", "board member buys",
    "purchases shares", "bought shares",
    "내부자 매수", "사내이사 매수", "임원 주식 매수", "임원 매수", "대주주 매수",
  ];
  if (insiderBuyKw.some(w => t.includes(w))) return "호재";

  // 공시 — 공식 공시 / 규제 / 기업 이벤트
  const discKw = [
    // EN
    "sec filing", "10-k", "10-q", "8-k", "proxy statement", "ipo",
    "secondary offering", "merger", "acquisition", "acquires", "dividend",
    "buyback", "stock split", "share repurchase", "going public", "listing",
    "spinoff", "spin-off", "delist", "regulatory filing", "annual report",
    // KO
    "공시", "수시공시", "사업보고서", "분기보고서", "반기보고서", "연간보고서",
    "위임장", "주주총회 위임장", "대량보유", "대량보유 보고서",
    "합병", "인수", "배당", "자사주", "주식분할", "상장", "상장폐지",
    "공모", "유상증자", "무상증자", "매각", "분사",
  ];
  if (discKw.some(w => t.includes(w))) return "공시";

  // 호재 키워드
  const posKw = [
    // EN — price action
    "surges", "jumps", "soars", "rallies", "rally", "spikes", "skyrockets",
    "climbs", "rises", "rebounds", "recovers", "breakout", "short squeeze",
    // EN — analyst
    "upgrade", "upgraded", "outperform", "overweight", "buy rating", "strong buy",
    "initiated buy", "initiated outperform", "reiterate buy", "reiterate outperform",
    "price target raised", "price target increased", "raised to buy",
    // EN — earnings / financials
    "record high", "all-time high", "record revenue", "record profit",
    "beats expectations", "beat expectations", "above expectations",
    "raised guidance", "raised forecast", "raised outlook", "raised annual",
    "profit", "double digit growth", "margin expansion", "cash flow positive",
    "debt reduction", "dividend increase", "dividend hike", "special dividend",
    "share buyback", "cost savings", "synergy",
    // EN — deals / business
    "deal", "strategic partnership", "joint venture", "licensing deal",
    "exclusive deal", "supply agreement", "multi-year deal", "billion dollar",
    "contract win", "wins contract", "approved", "fda approval", "fda approved",
    "phase 3 success", "clinical trial success", "patent granted",
    "breakthrough", "milestone", "expansion", "expands", "market expansion",
    "new product", "product launch", "launches", "launch", "growth",
    "market share", "market leader", "strong demand",
    "positive", "bullish", "momentum", "accelerate", "boosts", "advance",
    "institutional adoption", "etf approval", "gains",
    // EN — 인덱스 편입
    "index inclusion", "added to s&p", "s&p 500 addition", "nasdaq inclusion",
    "index addition", "added to index", "russell addition",
    // EN — 내부자 매수
    "insider buying", "insider purchase", "insider bought", "executives buying",
    // EN — 신용등급 상향
    "credit upgrade", "rating upgrade", "upgraded to investment grade",
    "moody's upgrade", "s&p upgrade", "fitch upgrade",
    // EN — 공매도 커버
    "short covering", "short squeeze",
    // EN — 섹터 특화 호재 (반도체/바이오/에너지)
    "nda approved", "pdufa", "phase 3 approved", "ind cleared",
    "chip demand", "ai chip", "foundry win", "supply deal",
    "oil price rise", "opec cut",
    // KO — 인덱스 편입
    "인덱스 편입", "코스피 편입", "코스닥 편입", "msci 편입",
    // KO — 내부자 매수
    "내부자 매수", "대주주 매수", "임원 매수",
    // KO — 신용등급
    "신용등급 상향", "등급 상향",
    // KO — 섹터 특화
    "수출 허가", "반도체 수요 증가", "파운드리 수주", "임상 3상 성공",
    "품목허가", "유가 상승", "유전 발견",
    // EN — M&A 호재
    "buyout", "takeover bid", "acquisition offer", "premium offer",
    "going private", "merger synergy", "deal approved", "acquisition completed",
    // KO — M&A 호재
    "피인수", "인수 프리미엄", "인수 제안", "합병 시너지", "합병 승인",
    "인수 완료", "우호적 인수", "경영권 프리미엄",
    // KO — 주가
    "상승", "급등", "강세", "반등", "회복", "돌파", "신고가", "52주 신고가",
    // KO — 애널리스트
    "목표가 상향", "투자의견 상향", "매수 의견", "강력매수", "신규 매수",
    // KO — 실적/재무
    "흑자", "흑자전환", "매출 증가", "영업이익 증가", "순이익 증가",
    "수익 개선", "실적 개선", "기대 이상", "어닝 서프라이즈", "배당 증가",
    "배당 확대", "자사주 매입", "주주환원", "부채 감소",
    // KO — 사업/계약
    "수주", "대규모 수주", "계약 체결", "신규 계약", "독점 계약",
    "전략적 제휴", "합작", "승인", "신약 승인", "임상 성공", "임상시험 통과",
    "허가", "인허가", "특허 등록", "해외 진출", "신사업 진출",
    "글로벌 확장", "점유율 확대", "투자 확대", "수요 증가",
    "호재", "긍정적", "상향", "성장", "성장세",
  ];

  // 악재 키워드
  const negKw = [
    // EN — price action
    "falls", "drops", "plunges", "tumbles", "slides", "sinks", "crashes",
    "slumps", "declines", "collapses", "tanks",
    // EN — analyst
    "downgrade", "downgraded", "underperform", "underweight", "sell rating",
    "cut to sell", "cut to underperform", "removed from buy list",
    "price target cut", "price target lowered", "price target decreased",
    // EN — earnings / financials
    "loss", "net loss", "operating loss", "deficit", "shortfall",
    "misses", "missed", "below expectations", "disappointing", "disappoints",
    "cuts guidance", "lowers guidance", "guidance cut", "lowered outlook",
    "profit warning", "earnings warning", "revenue warning",
    "margin compression", "cash burn", "debt default", "going concern",
    "covenant breach", "credit downgrade",
    // EN — legal / regulatory
    "class action", "antitrust", "data breach", "cybersecurity breach",
    "sec investigation", "doj investigation", "ftc investigation",
    "regulatory action", "injunction", "cease and desist",
    "fraud", "sec investigation", "doj investigation", "ftc probe",
    "criminal probe", "federal probe", "investigated for", "under investigation",
    "lawsuit filed", "class action lawsuit", "sued by", "faces lawsuit",
    "regulatory fine", "fined $", "pays fine", "penalty of", "faces penalty",
    // EN — operations
    "supply chain disruption", "production halt", "factory closure",
    "plant shutdown", "product defect", "product recall", "safety recall",
    "tariff", "trade war", "export ban",
    // EN — personnel
    "ceo resigns", "ceo resign", "ceo departure", "ceo steps down",
    "executive departure", "cfo resigns", "coo resigns",
    // EN — misc
    "faces headwinds", "significant headwinds", "serious concerns",
    "major concerns", "layoffs", "mass layoffs", "job cuts", "restructuring",
    "bankruptcy", "files for bankruptcy", "chapter 11",
    "bearish", "negative outlook",
    // KO — 주가
    "하락", "급락", "약세", "폭락", "추락", "52주 신저가",
    // KO — 애널리스트
    "목표가 하향", "투자의견 하향", "매도 의견", "비중축소",
    // KO — 실적/재무
    "적자", "적자전환", "매출 감소", "영업이익 감소", "순이익 감소",
    "손실", "손실 확대", "실적 악화", "어닝 쇼크", "기대 이하",
    "신용등급 하락", "유동성 부족", "채무불이행", "유동성 위기",
    // KO — 법적/규제
    "집단소송", "공정위", "금감원 조사", "불공정거래", "횡령", "배임",
    "과징금", "행정제재", "영업정지",
    // KO — 사업/운영
    "계약 해지", "수주 취소", "임상 실패", "임상시험 실패", "허가 거절",
    "품목 취소", "공급망 차질", "생산 중단", "공장 폐쇄",
    // EN — 인덱스 제외
    "index removal", "removed from s&p", "s&p 500 removal", "index exclusion",
    "removed from index", "russell removal", "delisted from index",
    // EN — 내부자 매도
    "insider selling", "insider sale", "insider sold", "executives selling",
    "mass insider sell",
    // EN — 신용등급 하향
    "credit downgrade", "moody's downgrade", "s&p downgrade", "fitch downgrade",
    "downgraded to junk", "junk status", "below investment grade",
    // EN — 공매도 리포트
    "short seller report", "short report", "short attack", "fraud allegations",
    "hindenburg", "citron",
    // EN — 파업/노사
    "labor strike", "union strike", "workers strike", "walkout", "work stoppage",
    // EN — 지정학
    "military action", "export ban", "trade ban",
    "import ban", "trade restriction", "blacklist",
    // EN — 섹터 특화 악재 (반도체/바이오/에너지)
    "export control", "chip ban", "entity list", "clinical trial failure",
    "trial failure", "fda rejection", "complete response letter",
    "oil price drop", "opec increase",
    // KO — 인덱스 제외
    "인덱스 제외", "코스피 제외", "코스닥 제외", "msci 제외",
    // KO — 내부자 매도
    "내부자 매도", "대주주 매도", "임원 매도", "블록딜",
    // KO — 신용등급
    "신용등급 하향", "등급 하향", "투기등급",
    // KO — 공매도
    "공매도 리포트", "공매도 과열",
    // KO — 파업/노사
    "파업", "노조 파업", "노사 갈등", "생산 차질",
    // KO — 지정학
    "전쟁", "분쟁", "수출 규제", "수출 금지", "블랙리스트", "제재",
    // KO — 섹터 특화
    "반도체 수출 제한", "수출 통제", "임상 실패", "임상 3상 실패",
    "허가 거절", "유가 하락", "공급 과잉",
    // EN — M&A 악재
    "merger falls through", "deal falls through", "acquisition canceled",
    "acquisition blocked", "antitrust blocked", "hostile takeover",
    "dilutive acquisition", "deal rejected", "merger rejected",
    // KO — M&A 악재
    "합병 무산", "인수 실패", "합병 불발", "인수 취소", "인수 반대",
    "적대적 인수", "경쟁당국 제동", "독과점 우려",
    // KO — 경영진
    "대표이사 사임", "ceo 사임", "경영진 교체", "대규모 감원",
    // KO — misc
    "우려", "부정적", "하향", "감원", "구조조정", "리콜", "파산",
    "수요 감소", "악재",
  ];

  const pos = posKw.filter(w => t.includes(w)).length;
  const neg = negKw.filter(w => t.includes(w)).length;
  return neg > pos ? "악재" : "호재";
}

export default function NewsCard({ news }: { news: NewsItem[] }) {
  const [tab, setTab]           = useState<Tab>("호재");
  const [expanded, setExpanded] = useState(false);

  const cats = useMemo(() => {
    const r: Record<Tab, NewsItem[]> = { 호재: [], 악재: [], 공시: [], 어닝콜: [] };
    for (const n of news) r[classify(n)].push(n);
    return r;
  }, [news]);

  const items   = cats[tab];
  const hasMore = items.length > 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* Nav-pill style tabs */}
      <div style={{
        display: "flex", alignItems: "stretch",
        height: 44, flexShrink: 0,
        marginBottom: 14,
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(0,0,0,0.09)",
        borderRadius: 10, overflow: "hidden",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      }}>
        {TABS.map((t, idx) => {
          const active = tab === t;
          const isNew  = cats[t].some(n => (Date.now() / 1000 - n.publishedAt) < 86400);
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setExpanded(false); }}
              style={{
                flex: 1, position: "relative",
                background: active ? "#18181b" : "none",
                border: "none",
                borderRight: idx < TABS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? "white" : "#3f3f46",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                transition: "background 0.12s, color 0.12s",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {t}
              {isNew && (
                <span style={{
                  position: "absolute", top: 4, right: 5,
                  fontSize: 8, fontWeight: 800, letterSpacing: "0.05em", lineHeight: 1,
                  background: active ? "rgba(245,158,11,0.4)" : "#f59e0b",
                  color: active ? "#fde68a" : "white",
                  borderRadius: 3, padding: "2px 4px",
                }}>
                  NEW
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List area */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>

        {/* Scrollable inner */}
        <div style={{ position: "absolute", inset: 0, overflowY: expanded ? "auto" : "hidden" }}>
          {items.length === 0
            ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--gray-400)", fontFamily: "monospace", fontSize: 12 }}>
                관련 {tab} 뉴스 없음
              </div>
            )
            : items.map((n, i) => (
              <div key={i} style={{ padding: "13px 0", borderBottom: i < items.length - 1 ? "1px solid var(--gray-100)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-500)", fontWeight: 600, marginRight: 8 }}>{n.source}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-400)", whiteSpace: "nowrap" }}>{relTime(n.publishedAt)}</span>
                </div>
                {n.url
                  ? <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.4, textDecoration: "none", display: "block" }}>
                      {n.title}
                    </a>
                  : <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.4 }}>{n.title}</div>
                }
              </div>
            ))
          }
        </div>

        {/* Gradient fade + more button */}
        {!expanded && hasMore && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 88,
            background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.98) 55%)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            paddingBottom: 6,
            pointerEvents: "none",
          }}>
            <button
              onClick={() => setExpanded(true)}
              style={{
                pointerEvents: "auto",
                fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 600,
                padding: "6px 24px", borderRadius: 20, cursor: "pointer",
                border: "1.5px solid rgba(0,0,0,0.18)",
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(8px)",
                color: "#27272a",
                boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
                letterSpacing: "-0.01em",
              }}
            >
              more ▾
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
