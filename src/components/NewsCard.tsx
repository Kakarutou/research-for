"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { NewsItem } from "@/app/api/stock/[ticker]/news/route";
import type { EarningsItem } from "@/app/api/stock/[ticker]/earnings/route";

type Tab = "뉴스" | "악재" | "공시" | "어닝콜";
const TABS: Tab[] = ["뉴스", "악재", "공시", "어닝콜"];

// ── helpers ───────────────────────────────────────────────────────────────────

function relTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600)       return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

const EARNINGS_KW = [
  "earnings call", "earnings report", "quarterly result", "annual result",
  "실적발표", "어닝콜", "분기실적", "연간실적",
];
const INSIDER_SELL_KW = [
  "insider sell","insider sold","insider selling","insider sale",
  "director sells","director sold","director disposes",
  "officer sells","officer sold","ceo sells","cfo sells","coo sells",
  "executive sells","executive sold","vp sells",
  "board member sells","disposes of shares","disposed shares",
  "sells shares","sold shares","sells stock","sold stock",
  "sells stake","sells large stake","sell-to-cover","sells $",
  "insider transaction","form 4",
  "내부자 매도","사내이사 매도","사외이사 매도",
  "임원 주식 매도","임원 매도","대주주 매도","블록딜",
];
const INSIDER_BUY_KW = [
  "insider buy","insider bought","insider buying","insider purchase",
  "director buys","director bought","director purchases",
  "officer buys","officer bought","ceo buys","cfo buys",
  "executive buys","executive bought","board member buys",
  "purchases shares","bought shares",
  "내부자 매수","사내이사 매수","임원 주식 매수","임원 매수","대주주 매수",
];
const DISC_KW = [
  "sec filing","10-k","10-q","8-k","proxy statement","ipo",
  "secondary offering","merger","acquisition","acquires","dividend",
  "buyback","stock split","share repurchase","going public","listing",
  "spinoff","spin-off","delist","regulatory filing","annual report",
  "공시","수시공시","사업보고서","분기보고서","반기보고서","연간보고서",
  "위임장","주주총회 위임장","대량보유","대량보유 보고서",
  "합병","인수","배당","자사주","주식분할","상장","상장폐지",
  "공모","유상증자","무상증자","매각","분사",
];
const POS_KW = [
  "surges","jumps","soars","rallies","rally","spikes","skyrockets",
  "climbs","rises","rebounds","recovers","breakout","short squeeze",
  "upgrade","upgraded","outperform","overweight","buy rating","strong buy",
  "initiated buy","initiated outperform","reiterate buy","reiterate outperform",
  "price target raised","price target increased","raised to buy",
  "record high","all-time high","record revenue","record profit",
  "beats expectations","beat expectations","above expectations",
  "raised guidance","raised forecast","raised outlook","raised annual",
  "profit","double digit growth","margin expansion","cash flow positive",
  "debt reduction","dividend increase","dividend hike","special dividend",
  "share buyback","cost savings","synergy",
  "deal","strategic partnership","joint venture","licensing deal",
  "exclusive deal","supply agreement","multi-year deal","billion dollar",
  "contract win","wins contract","approved","fda approval","fda approved",
  "phase 3 success","clinical trial success","patent granted",
  "breakthrough","milestone","expansion","expands","market expansion",
  "new product","product launch","launches","launch","growth",
  "market share","market leader","strong demand",
  "positive","bullish","momentum","accelerate","boosts","advance",
  "institutional adoption","etf approval","gains",
  "index inclusion","added to s&p","s&p 500 addition","nasdaq inclusion",
  "index addition","added to index","russell addition",
  "insider buying","insider purchase","insider bought","executives buying",
  "credit upgrade","rating upgrade","upgraded to investment grade",
  "moody's upgrade","s&p upgrade","fitch upgrade","short covering",
  "nda approved","pdufa","phase 3 approved","ind cleared",
  "chip demand","ai chip","foundry win","supply deal",
  "oil price rise","opec cut",
  "인덱스 편입","코스피 편입","코스닥 편입","msci 편입",
  "내부자 매수","대주주 매수","임원 매수","신용등급 상향","등급 상향",
  "수출 허가","반도체 수요 증가","파운드리 수주","임상 3상 성공",
  "품목허가","유가 상승","유전 발견",
  "buyout","takeover bid","acquisition offer","premium offer",
  "going private","merger synergy","deal approved","acquisition completed",
  "피인수","인수 프리미엄","인수 제안","합병 시너지","합병 승인",
  "인수 완료","우호적 인수","경영권 프리미엄",
  "상승","급등","강세","반등","회복","돌파","신고가","52주 신고가",
  "목표가 상향","투자의견 상향","매수 의견","강력매수","신규 매수",
  "흑자","흑자전환","매출 증가","영업이익 증가","순이익 증가",
  "수익 개선","실적 개선","기대 이상","어닝 서프라이즈","배당 증가",
  "배당 확대","자사주 매입","주주환원","부채 감소",
  "수주","대규모 수주","계약 체결","신규 계약","독점 계약",
  "전략적 제휴","합작","승인","신약 승인","임상 성공","임상시험 통과",
  "허가","인허가","특허 등록","해외 진출","신사업 진출",
  "글로벌 확장","점유율 확대","투자 확대","수요 증가",
  "호재","긍정적","상향","성장","성장세",
  "수혜","수혜주","선방","턴어라운드","체질 개선","악재 해소","우려 해소",
  "어닝서프라이즈","실적 호조","깜짝 실적","기대치 상회","어닝 서프라이즈",
];
const NEG_KW = [
  "falls","drops","plunges","tumbles","slides","sinks","crashes",
  "slumps","declines","collapses","tanks",
  "downgrade","downgraded","underperform","underweight","sell rating",
  "cut to sell","cut to underperform","removed from buy list",
  "price target cut","price target lowered","price target decreased",
  "loss","net loss","operating loss","deficit","shortfall",
  "misses","missed","below expectations","disappointing","disappoints",
  "cuts guidance","lowers guidance","guidance cut","lowered outlook",
  "profit warning","earnings warning","revenue warning",
  "margin compression","cash burn","debt default","going concern",
  "covenant breach","credit downgrade",
  "class action","antitrust","data breach","cybersecurity breach",
  "sec investigation","doj investigation","ftc investigation",
  "regulatory action","injunction","cease and desist",
  "fraud","ftc probe","criminal probe","federal probe",
  "investigated for","under investigation",
  "lawsuit filed","class action lawsuit","sued by","faces lawsuit",
  "regulatory fine","fined $","pays fine","penalty of","faces penalty",
  "supply chain disruption","production halt","factory closure",
  "plant shutdown","product defect","product recall","safety recall",
  "tariff","trade war","export ban",
  "ceo resigns","ceo resign","ceo departure","ceo steps down",
  "executive departure","cfo resigns","coo resigns",
  "faces headwinds","significant headwinds","serious concerns",
  "major concerns","layoffs","mass layoffs","job cuts","restructuring",
  "bankruptcy","files for bankruptcy","chapter 11","bearish","negative outlook",
  "하락","급락","약세","폭락","추락","52주 신저가",
  "목표가 하향","투자의견 하향","매도 의견","비중축소",
  "적자","적자전환","매출 감소","영업이익 감소","순이익 감소",
  "손실","손실 확대","실적 악화","어닝 쇼크","기대 이하",
  "신용등급 하락","유동성 부족","채무불이행","유동성 위기",
  "집단소송","공정위","금감원 조사","불공정거래","횡령","배임",
  "과징금","행정제재","영업정지",
  "계약 해지","수주 취소","임상 실패","임상시험 실패","허가 거절",
  "품목 취소","공급망 차질","생산 중단","공장 폐쇄",
  "index removal","removed from s&p","s&p 500 removal","index exclusion",
  "removed from index","russell removal","delisted from index",
  "insider selling","insider sale","insider sold","executives selling",
  "credit downgrade","moody's downgrade","s&p downgrade","fitch downgrade",
  "downgraded to junk","junk status","below investment grade",
  "short seller report","short report","short attack","fraud allegations",
  "hindenburg","citron",
  "labor strike","union strike","workers strike","walkout","work stoppage",
  "military action","trade ban","import ban","trade restriction","blacklist",
  "export control","chip ban","entity list","clinical trial failure",
  "trial failure","fda rejection","complete response letter",
  "oil price drop","opec increase",
  "인덱스 제외","코스피 제외","코스닥 제외","msci 제외",
  "내부자 매도","대주주 매도","임원 매도","블록딜",
  "신용등급 하향","등급 하향","투기등급",
  "공매도 리포트","공매도 과열",
  "파업","노조 파업","노사 갈등","생산 차질",
  "전쟁","분쟁","수출 규제","수출 금지","블랙리스트","제재",
  "반도체 수출 제한","수출 통제","임상 실패","임상 3상 실패",
  "허가 거절","유가 하락","공급 과잉",
  "merger falls through","deal falls through","acquisition canceled",
  "acquisition blocked","antitrust blocked","hostile takeover",
  "dilutive acquisition","deal rejected","merger rejected",
  "합병 무산","인수 실패","합병 불발","인수 취소","인수 반대",
  "적대적 인수","경쟁당국 제동","독과점 우려",
  "대표이사 사임","ceo 사임","경영진 교체","대규모 감원",
  "부정적","하향","감원","구조조정","리콜","파산",
  "수요 감소",
];

function classify(item: NewsItem): Tab {
  const t = (item.title + " " + item.source).toLowerCase();

  // 1. 공식 공시 소스 → 공시
  if (item.source === 'SEC EDGAR' || item.source === 'DART') return "공시";

  // 2. 어닝콜 키워드
  if (EARNINGS_KW.some(w => t.includes(w))) return "어닝콜";

  // 3. 내부자 매도 → 악재
  if (INSIDER_SELL_KW.some(w => t.includes(w))) return "악재";

  // 4. 긍/부정 스코어 — 부정 우세 시 악재
  const pos = POS_KW.filter(w => t.includes(w)).length;
  const neg = NEG_KW.filter(w => t.includes(w)).length;
  if (neg > pos) return "악재";

  // 5. 내부자 매수 → 뉴스
  if (INSIDER_BUY_KW.some(w => t.includes(w))) return "뉴스";

  // 6. 기본값
  return "뉴스";
}

// ── Preview modal ─────────────────────────────────────────────────────────────

type PreviewTarget =
  | { kind: "news";     item: NewsItem }
  | { kind: "earnings"; item: EarningsItem };

function YoY({ val }: { val: string }) {
  const up = val.startsWith('+');
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, fontFamily: "monospace",
      color: up ? "#16a34a" : "#dc2626",
      background: up ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
      borderRadius: 4, padding: "1px 5px",
    }}>{val}</span>
  );
}

function PreviewModal({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const [bullets, setBullets]     = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [fetchErr, setFetchErr]   = useState(false);
  const [secFiling, setSecFiling] = useState(false);
  const [dartFiling, setDartFiling] = useState(false);
  const [paywall, setPaywall]     = useState(false);

  const isNews     = target.kind === "news";
  const isEarnings = target.kind === "earnings";
  const url        = target.item.url;
  const source     = isNews ? target.item.source : "SEC 실적발표";
  const ts         = target.item.publishedAt;

  const newsItem = isNews ? (target.item as NewsItem) : null;

  useEffect(() => {
    if (!isNews) return;
    // Finnhub summary already available — use directly, no fetch needed
    if (newsItem?.summary) {
      setBullets([newsItem.summary]);
      return;
    }
    if (!url) return;
    setLoading(true); setBullets([]); setFetchErr(false); setSecFiling(false); setDartFiling(false); setPaywall(false);
    fetch(`/api/preview?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (d.paywall)    { setPaywall(true); return; }
        if (d.dartFiling) { setDartFiling(true); if (d.bullets?.length) setBullets(d.bullets); return; }
        if (d.secFiling)  { setSecFiling(true);  if (d.bullets?.length) setBullets(d.bullets); return; }
        if (d.blocked)    { setFetchErr(true); return; }
        if (d.bullets?.length) setBullets(d.bullets);
        else setFetchErr(true);
      })
      .catch(() => setFetchErr(true))
      .finally(() => setLoading(false));
  }, [url, isNews, newsItem?.summary]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const e = isEarnings ? (target.item as EarningsItem) : null;
  const n = isNews     ? (target.item as NewsItem)     : null;

  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={ev => ev.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 520,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f4f4f5", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              {/* Source chip */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "#f4f4f5", borderRadius: 6, padding: "3px 8px",
                fontFamily: "var(--font-mono), monospace", fontSize: 10,
                fontWeight: 700, color: "#71717a", letterSpacing: "0.04em",
                marginBottom: 8,
              }}>
                {source.toUpperCase()}
                <span style={{ color: "#d4d4d8" }}>·</span>
                {relTime(ts)}
              </div>

              {/* Title / Quarter */}
              {n && (
                <div style={{ fontSize: 15, fontWeight: 700, color: "#18181b", lineHeight: 1.4, paddingRight: 8 }}>
                  {n.title}
                </div>
              )}
              {e && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontFamily: "var(--font-mono), monospace", fontSize: 13, fontWeight: 800,
                    background: "#18181b", color: "white", borderRadius: 6, padding: "3px 10px",
                  }}>{e.quarter}</span>
                  {e.headline && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#3f3f46", lineHeight: 1.3 }}>
                      {e.headline}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Close */}
            <button onClick={onClose} style={{
              flexShrink: 0, marginLeft: 8,
              width: 28, height: 28, borderRadius: "50%",
              background: "#f4f4f5", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, color: "#71717a",
            }}>×</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* News summary */}
          {n && (
            <>
              {loading && (
                <div style={{ color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: 12, padding: "20px 0", textAlign: "center" }}>
                  핵심 내용 분석 중...
                </div>
              )}
              {!loading && bullets.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {bullets.map((b, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{
                        flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                        background: "#18181b", color: "white",
                        fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginTop: 1,
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.7 }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}
              {!loading && paywall && (
                <div style={{ padding: "16px 0" }}>
                  <div style={{
                    background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)",
                    borderRadius: 10, padding: "14px 16px", marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309", fontFamily: "var(--font-mono), monospace", marginBottom: 6, letterSpacing: "0.04em" }}>
                      PAYWALL
                    </div>
                    <div style={{ fontSize: 13, color: "#78716c", lineHeight: 1.65 }}>
                      이 기사는 구독이 필요한 유료 매체입니다.<br />
                      원문 보기로 접속하거나, 아래 요약을 참고하세요.
                    </div>
                  </div>
                  {n?.summary && (
                    <div style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.7, padding: "4px 0" }}>
                      {n.summary}
                    </div>
                  )}
                </div>
              )}
              {!loading && dartFiling && bullets.length === 0 && (
                <div style={{
                  background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)",
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", fontFamily: "var(--font-mono), monospace", marginBottom: 6, letterSpacing: "0.04em" }}>
                    DART 전자공시
                  </div>
                  <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.65 }}>
                    금융감독원 전자공시 문서입니다.<br />아래 버튼으로 공시 전문을 확인할 수 있습니다.
                  </div>
                </div>
              )}
              {!loading && secFiling && bullets.length === 0 && (
                <div style={{
                  background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)",
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", fontFamily: "var(--font-mono), monospace", marginBottom: 6, letterSpacing: "0.04em" }}>
                    SEC EDGAR
                  </div>
                  <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.65 }}>
                    SEC 공식 공시 문서입니다.<br />아래 버튼으로 원문을 확인해주세요.
                  </div>
                </div>
              )}
              {!loading && fetchErr && !paywall && !secFiling && !dartFiling && bullets.length === 0 && (
                <div style={{ color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: 12, padding: "20px 0", textAlign: "center", lineHeight: 1.8 }}>
                  해당 기사는 미리보기를 지원하지 않습니다.<br />아래 버튼으로 원문을 확인해주세요.
                </div>
              )}
            </>
          )}

          {/* Earnings detail */}
          {e && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Metrics row */}
              {(e.revenue || e.eps || e.netIncome || e.opProfit) && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${[e.revenue, e.eps, e.netIncome || e.opProfit].filter(Boolean).length}, 1fr)`,
                  gap: 1, background: "#f4f4f5", borderRadius: 12, overflow: "hidden",
                }}>
                  {e.revenue && (
                    <div style={{ background: "white", padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", marginBottom: 4 }}>매출</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#18181b", fontFamily: "var(--font-mono), monospace" }}>{e.revenue}</div>
                      {e.revenueYoY && <YoY val={e.revenueYoY} />}
                    </div>
                  )}
                  {e.eps && (
                    <div style={{ background: "white", padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", marginBottom: 4 }}>EPS</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#18181b", fontFamily: "var(--font-mono), monospace" }}>{e.eps}</div>
                    </div>
                  )}
                  {(e.netIncome || e.opProfit) && (
                    <div style={{ background: "white", padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", marginBottom: 4 }}>{e.opProfit ? "영업이익" : "순이익"}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#18181b", fontFamily: "var(--font-mono), monospace" }}>{e.opProfit ?? e.netIncome}</div>
                    </div>
                  )}
                </div>
              )}

              {/* CEO quote */}
              {e.ceoQuote && (
                <div style={{
                  background: "#fafafa", borderRadius: 10, padding: "14px 16px",
                  borderLeft: "3px solid #e4e4e7",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", marginBottom: 8, letterSpacing: "0.05em" }}>CEO 코멘트</div>
                  <div style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.7, fontStyle: "italic" }}>
                    "{e.ceoQuote}"
                  </div>
                </div>
              )}

              {/* Guidance */}
              {e.guidance && (
                <div style={{
                  background: "rgba(99,102,241,0.05)", borderRadius: 10, padding: "14px 16px",
                  borderLeft: "3px solid rgba(99,102,241,0.4)",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(99,102,241,0.7)", fontFamily: "var(--font-mono), monospace", marginBottom: 8, letterSpacing: "0.05em" }}>가이던스</div>
                  <div style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.7 }}>{e.guidance}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "12px 20px 20px", borderTop: "1px solid #f4f4f5", flexShrink: 0 }}>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            style={{
              display: "block", textAlign: "center",
              padding: "12px 0", borderRadius: 12,
              background: "#18181b", color: "white",
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 14, fontWeight: 600, textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            원문 보기
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Earnings card (sidebar) ───────────────────────────────────────────────────

function EarningsCard({
  e, isLast, onClick,
}: { e: EarningsItem; isLast: boolean; onClick: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        padding: "16px 0",
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.06)",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "monospace", fontSize: 12, fontWeight: 800, letterSpacing: "0.04em",
            background: "#18181b", color: "white", borderRadius: 5, padding: "2px 8px",
          }}>{e.quarter}</span>
          <span style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "monospace" }}>
            {relTime(e.publishedAt)}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "var(--gray-400)", fontFamily: "monospace" }}>자세히 →</span>
      </div>

      {/* Title */}
      {e.headline && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-800)", lineHeight: 1.4, marginBottom: 10 }}>
          {e.headline}
        </div>
      )}

      {/* Metrics */}
      {(e.revenue || e.eps || e.netIncome || e.opProfit) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${[e.revenue, e.eps, e.netIncome || e.opProfit].filter(Boolean).length}, 1fr)`,
          gap: 8,
          background: "rgba(0,0,0,0.02)", borderRadius: 8, padding: "10px 12px",
          marginBottom: e.ceoQuote ? 10 : 0,
        }}>
          {e.revenue && (
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-500)", marginBottom: 3, fontFamily: "monospace" }}>REVENUE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#18181b", fontFamily: "monospace", marginBottom: 2 }}>{e.revenue}</div>
              {e.revenueYoY && <YoY val={e.revenueYoY} />}
            </div>
          )}
          {e.eps && (
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-500)", marginBottom: 3, fontFamily: "monospace" }}>EPS</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#18181b", fontFamily: "monospace" }}>{e.eps}</div>
            </div>
          )}
          {(e.netIncome || e.opProfit) && (
            <div>
              <div style={{ fontSize: 10, color: "var(--gray-500)", marginBottom: 3, fontFamily: "monospace" }}>{e.opProfit ? "OP PROFIT" : "NET INC"}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#18181b", fontFamily: "monospace" }}>{e.opProfit ?? e.netIncome}</div>
            </div>
          )}
        </div>
      )}

      {/* CEO quote preview */}
      {e.ceoQuote && (
        <div
          onClick={ev => { ev.stopPropagation(); setOpen(o => !o); }}
          style={{
            fontSize: 12, color: "var(--gray-600)", lineHeight: 1.55,
            fontStyle: "italic", cursor: e.ceoQuote.length > 100 ? "pointer" : "default",
          }}
        >
          <span style={{ color: "var(--gray-400)" }}>"</span>
          {open || e.ceoQuote.length <= 100
            ? e.ceoQuote
            : e.ceoQuote.slice(0, 98) + "…"}
          <span style={{ color: "var(--gray-400)" }}>"</span>
          {e.ceoQuote.length > 100 && (
            <span style={{ marginLeft: 4, fontSize: 11, color: "var(--gray-400)", fontStyle: "normal" }}>
              {open ? "접기" : "더보기"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewsCard({ news, earnings = [] }: { news: NewsItem[]; earnings?: EarningsItem[] }) {
  const [tab, setTab]           = useState<Tab>("뉴스");
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview]   = useState<PreviewTarget | null>(null);

  const openNews     = useCallback((item: NewsItem)     => setPreview({ kind: "news",     item }), []);
  const openEarnings = useCallback((item: EarningsItem) => setPreview({ kind: "earnings", item }), []);
  const closePreview = useCallback(() => setPreview(null), []);

  const cats = useMemo(() => {
    const r: Record<Tab, NewsItem[]> = { 뉴스: [], 악재: [], 공시: [], 어닝콜: [] };
    for (const n of news) r[classify(n)].push(n);
    return r;
  }, [news]);

  const isEarningsTab = tab === "어닝콜";
  const newsItems     = cats[tab];
  const hasMore       = !isEarningsTab && newsItems.length > 5;

  const tabHasNew = (t: Tab) => {
    if (t === "어닝콜") return earnings.length > 0 && (Date.now() / 1000 - earnings[0].publishedAt) < 86400 * 7;
    return cats[t].some(n => (Date.now() / 1000 - n.publishedAt) < 86400);
  };

  return (
    <>
      {/* Modal */}
      {preview && <PreviewModal target={preview} onClose={closePreview} />}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

        {/* Tab bar */}
        <div style={{
          display: "flex", alignItems: "stretch",
          height: 44, flexShrink: 0, marginBottom: 14,
          background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        }}>
          {TABS.map((t, idx) => {
            const active = tab === t;
            const isNew  = tabHasNew(t);
            const count  = t === "어닝콜" ? earnings.length : cats[t].length;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setExpanded(false); }}
                style={{
                  flex: 1, position: "relative",
                  background: active ? "#18181b" : "none", border: "none",
                  borderRight: idx < TABS.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans), sans-serif",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? "white" : "#3f3f46",
                  letterSpacing: "-0.01em", whiteSpace: "nowrap",
                  transition: "background 0.12s, color 0.12s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}
              >
                {t}
                {count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.3)", fontFamily: "monospace" }}>
                    {count}
                  </span>
                )}
                {isNew && (
                  <span style={{
                    position: "absolute", top: 4, right: 5,
                    fontSize: 8, fontWeight: 800, letterSpacing: "0.05em", lineHeight: 1,
                    background: active ? "rgba(245,158,11,0.4)" : "#f59e0b",
                    color: active ? "#fde68a" : "white",
                    borderRadius: 3, padding: "2px 4px",
                  }}>NEW</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>

          {/* 어닝콜 */}
          {isEarningsTab && (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
              {earnings.length === 0
                ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--gray-400)", fontFamily: "monospace", fontSize: 12 }}>어닝콜 데이터 없음</div>
                : earnings.map((e, i) => (
                  <EarningsCard key={i} e={e} isLast={i === earnings.length - 1} onClick={() => openEarnings(e)} />
                ))
              }
            </div>
          )}

          {/* 호재·악재·공시 */}
          {!isEarningsTab && (
            <>
              <div style={{ position: "absolute", inset: 0, overflowY: expanded ? "auto" : "hidden" }}>
                {newsItems.length === 0
                  ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--gray-400)", fontFamily: "monospace", fontSize: 12 }}>{tab === "뉴스" ? "관련 뉴스 없음" : `관련 ${tab} 없음`}</div>
                  : newsItems.map((n, i) => (
                    <div
                      key={i}
                      onClick={() => openNews(n)}
                      style={{
                        padding: "13px 0",
                        borderBottom: i < newsItems.length - 1 ? "1px solid var(--gray-100)" : "none",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-500)", fontWeight: 600, marginRight: 8 }}>{n.source}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-400)", whiteSpace: "nowrap" }}>{relTime(n.publishedAt)}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", lineHeight: 1.4 }}>
                        {n.title}
                      </div>
                    </div>
                  ))
                }
              </div>

              {!expanded && hasMore && (
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 88,
                  background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.98) 55%)",
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  paddingBottom: 6, pointerEvents: "none",
                }}>
                  <button
                    onClick={() => setExpanded(true)}
                    style={{
                      pointerEvents: "auto",
                      fontFamily: "var(--font-sans), sans-serif", fontSize: 13, fontWeight: 600,
                      padding: "6px 24px", borderRadius: 20, cursor: "pointer",
                      border: "1.5px solid rgba(0,0,0,0.18)",
                      background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
                      color: "#27272a", boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
                      letterSpacing: "-0.01em",
                    }}
                  >more ▾</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
