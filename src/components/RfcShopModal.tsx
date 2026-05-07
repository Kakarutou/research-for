"use client";
import { useEffect } from "react";

interface Props { onClose: () => void }

export default function RfcShopModal({ onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        <div style={{ padding: "28px 32px", textAlign: "center" }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 20, right: 20,
            background: "none", border: "none", cursor: "pointer", color: "#a1a1aa",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>

          <div style={{
            width: 56, height: 56, borderRadius: 16, background: "#f4f4f5",
            display: "grid", placeItems: "center", margin: "0 auto 20px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>

          <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 17, fontWeight: 700, color: "#18181b", marginBottom: 8 }}>
            RFC Shop
          </div>
          <div style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 14, color: "#a1a1aa", lineHeight: 1.6 }}>
            Items are being prepared.<br/>
            <span style={{ color: "#71717a" }}>Check back soon.</span>
          </div>

          <div style={{
            marginTop: 24, padding: "10px 16px",
            background: "#fafafa", borderRadius: 10, border: "1px solid #f0f0f0",
            fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "#a1a1aa",
          }}>
            Premium features · Profile badges · NFTs · and more
          </div>
        </div>
      </div>
    </div>
  );
}
