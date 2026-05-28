import TopNav from "@/components/TopNav";
import IndexBox from "@/components/IndexBox";
import NewsBox from "@/components/NewsBox";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.6, zIndex: 1, mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      <TopNav showSearch />

      {/* 검색창 아래 — 월가 5대 지수 */}
      <IndexBox />
      <NewsBox />
    </div>
  );
}
