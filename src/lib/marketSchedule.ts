// All times in KST (UTC+9)
// Betting is open AFTER the previous market close, and closes BEFORE the next market open.
//
// NASDAQ:  market open 22:30 KST (summer) / 23:30 KST (winter) → cutoff 22:00 KST
//          market close 05:00 KST (summer) / 06:00 KST (winter) → opens 05:00 KST
// KOSPI:   market open 09:00 KST, close 15:30 KST
//          betting: 15:30 KST → 08:30 KST (next day)
// N225:    market open 09:00 KST (= 09:00 JST), close 15:30 KST
//          betting: 15:30 KST → 08:30 KST (next day)
// BTC:     24/7 — daily round, cutoff at 23:00 KST

export interface Schedule {
  /** KST time when betting OPENS (after previous market close) */
  openH: number; openM: number;
  /** KST time when betting CLOSES (before next market open) */
  closeH: number; closeM: number;
  /** Human-readable label shown in the card */
  closeLabel: string;
  openLabel: string;
}

export const SCHEDULES: Record<string, Schedule> = {
  NASDAQ: { openH: 5,  openM: 0,  closeH: 22, closeM: 0,  closeLabel: "22:00 KST", openLabel: "05:00 KST" },
  KOSPI:  { openH: 15, openM: 30, closeH: 8,  closeM: 30, closeLabel: "08:30 KST", openLabel: "15:30 KST" },
  N225:   { openH: 15, openM: 30, closeH: 8,  closeM: 30, closeLabel: "08:30 KST", openLabel: "15:30 KST" },
  BTC:    { openH: 0,  openM: 0,  closeH: 23, closeM: 0,  closeLabel: "23:00 KST", openLabel: "00:00 KST" },
};

function kstTotalMin(): number {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

export function isBettingOpen(marketId: string): boolean {
  const s = SCHEDULES[marketId];
  if (!s) return false;
  const cur = kstTotalMin();
  const open  = s.openH  * 60 + s.openM;
  const close = s.closeH * 60 + s.closeM;

  if (open < close) {
    // Same-day window (e.g. NASDAQ 05:00–22:00, BTC 00:00–23:00)
    return cur >= open && cur < close;
  } else {
    // Overnight window (e.g. KOSPI 15:30–08:30 next day)
    return cur >= open || cur < close;
  }
}

/** Returns minutes remaining until betting closes (for countdown display) */
export function minsUntilClose(marketId: string): number {
  const s = SCHEDULES[marketId];
  if (!s) return 0;
  const cur   = kstTotalMin();
  const close = s.closeH * 60 + s.closeM;
  return cur < close ? close - cur : 24 * 60 - cur + close;
}

export function formatCountdown(mins: number): string {
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

/**
 * Returns true when a bet placed on `kstDate` for `marketId` can now be settled.
 * NASDAQ settles at 05:00 KST next day (= NYSE close).
 * KOSPI / N225 settle at 15:30 KST same day.
 * BTC settles at 23:00 KST same day.
 */
export function shouldSettle(marketId: string, kstDate: string): boolean {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST
  const todayKST = now.toISOString().slice(0, 10);
  const tm = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (kstDate === todayKST) {
    if (marketId === 'NASDAQ') return false;                 // closes next day
    if (marketId === 'KOSPI' || marketId === 'N225') return tm >= 15 * 60 + 30;
    if (marketId === 'BTC')   return tm >= 23 * 60;
    return false;
  }
  if (kstDate < todayKST) {
    if (marketId === 'NASDAQ') return tm >= 5 * 60;          // wait for 05:00 KST
    return true;                                             // all others settled same day
  }
  return false;
}
