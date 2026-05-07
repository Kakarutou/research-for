export const MARKETS = [
  { id: "NASDAQ", name: "Nasdaq Composite", price: "18,432.10", change: "+1.42%", isUp: true,  longPool: "12,847", shortPool: "7,892" },
  { id: "KOSPI",  name: "Korea Composite",  price: "2,683.45",  change: "+0.56%", isUp: true,  longPool: "4,521",  shortPool: "3,847" },
  { id: "N225",   name: "Nikkei 225",       price: "38,210.55", change: "−0.42%", isUp: false, longPool: "2,108",  shortPool: "3,562" },
  { id: "BTC",    name: "Bitcoin",          price: "$98,420",   change: "+2.18%", isUp: true,  longPool: "18,450", shortPool: "6,124" },
];

export const STOCK_DETAIL: Record<string, {
  ticker: string;
  name: string;
  price: string;
  change: string;
  changeAmt: string;
  isUp: boolean;
  shortSelling: { date: string; ratio: number; amount: string }[];
  news: { title: string; source: string; time: string; summary: string }[];
  issuance: { date: string; shares: number; type: string }[];
  chartData: { date: string; close: number; volume: number }[];
}> = {
  NVDA: {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    price: "$875.43",
    change: "+3.24%",
    changeAmt: "+$27.50",
    isUp: true,
    shortSelling: [
      { date: "2026-05-07", ratio: 1.82, amount: "2.4M" },
      { date: "2026-05-06", ratio: 2.10, amount: "2.8M" },
      { date: "2026-05-05", ratio: 1.95, amount: "2.6M" },
      { date: "2026-05-02", ratio: 2.34, amount: "3.1M" },
      { date: "2026-05-01", ratio: 2.21, amount: "2.9M" },
    ],
    news: [
      { title: "NVIDIA Blackwell GPU demand surges, analysts raise targets", source: "Reuters", time: "2h ago", summary: "NVIDIA's Blackwell architecture sees unprecedented demand from cloud providers." },
      { title: "NVIDIA 1Q FY2027 earnings beat expectations significantly", source: "Bloomberg", time: "5h ago", summary: "Revenue of $44.1B beat consensus of $43.2B, driven by data center segment." },
      { title: "Jensen Huang announces next-gen Rubin GPU platform at GTC", source: "The Verge", time: "1d ago", summary: "Rubin platform expected to launch in late 2026, features HBM4 memory." },
    ],
    issuance: [
      { date: "2026-04-15", shares: 2400000, type: "ATM Offering" },
      { date: "2026-03-20", shares: 1200000, type: "Employee RSU" },
      { date: "2026-02-10", shares: 800000,  type: "Options Exercise" },
    ],
    chartData: [
      { date: "04/07", close: 820, volume: 42000000 },
      { date: "04/14", close: 835, volume: 38000000 },
      { date: "04/21", close: 810, volume: 51000000 },
      { date: "04/28", close: 848, volume: 44000000 },
      { date: "05/05", close: 848, volume: 39000000 },
      { date: "05/07", close: 875, volume: 55000000 },
    ],
  },
  AAPL: {
    ticker: "AAPL",
    name: "Apple Inc.",
    price: "$213.18",
    change: "-0.84%",
    changeAmt: "-$1.81",
    isUp: false,
    shortSelling: [
      { date: "2026-05-07", ratio: 0.62, amount: "4.1M" },
      { date: "2026-05-06", ratio: 0.71, amount: "4.7M" },
      { date: "2026-05-05", ratio: 0.68, amount: "4.5M" },
    ],
    news: [
      { title: "Apple Vision Pro 2 rumored for WWDC announcement", source: "MacRumors", time: "3h ago", summary: "Lighter form factor and improved battery life expected in second generation." },
      { title: "Apple Services revenue hits all-time high in Q2 FY2026", source: "CNBC", time: "8h ago", summary: "$26.6B in services revenue, up 14% year over year." },
    ],
    issuance: [
      { date: "2026-03-15", shares: 800000, type: "Employee RSU" },
    ],
    chartData: [
      { date: "04/07", close: 218, volume: 62000000 },
      { date: "04/14", close: 224, volume: 58000000 },
      { date: "04/21", close: 215, volume: 71000000 },
      { date: "04/28", close: 219, volume: 65000000 },
      { date: "05/05", close: 215, volume: 59000000 },
      { date: "05/07", close: 213, volume: 67000000 },
    ],
  },
};

export function getStockData(ticker: string) {
  const key = ticker.toUpperCase();
  return STOCK_DETAIL[key] ?? null;
}
