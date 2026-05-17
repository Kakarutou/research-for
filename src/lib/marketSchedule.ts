// All times in KST (UTC+9)
// Betting is open AFTER the previous market close, and closes BEFORE the next market open.
//
// NASDAQ:  market open 22:30 KST → cutoff 22:00 KST, settles next day 05:00 KST
// KOSPI:   market open 09:00 KST, close 15:30 KST
//          betting: 15:30 KST (evening) → 08:30 KST next day (morning)
//          - evening bet (placed 15:30–23:59): settles NEXT DAY 15:30
//          - morning bet (placed 00:00–08:30): settles SAME DAY 15:30
// N225:    same schedule as KOSPI
// BTC:     24/7 — daily round 00:00–23:00 KST, settles same day 23:00

export interface Schedule {
  openH: number; openM: number;
  closeH: number; closeM: number;
}

export const SCHEDULES: Record<string, Schedule> = {
  NASDAQ: { openH: 5,  openM: 0,  closeH: 22, closeM: 0  },
  KOSPI:  { openH: 15, openM: 30, closeH: 8,  closeM: 30 },
  N225:   { openH: 15, openM: 30, closeH: 8,  closeM: 30 },
  HSI:    { openH: 17, openM: 0,  closeH: 10, closeM: 30 }, // Hang Seng: 17:00~10:30 KST
  DAX:    { openH: 1,  openM: 30, closeH: 16, closeM: 0  }, // DAX: 01:30~16:00 KST
  BTC:    { openH: 0,  openM: 0,  closeH: 23, closeM: 0  },
};

// KST market close times (minutes from midnight) used for settlement
const SETTLE_TIME_MIN: Record<string, number> = {
  NASDAQ: 5  * 60,        // 05:00 KST
  KOSPI:  15 * 60 + 30,   // 15:30 KST
  N225:   15 * 60 + 30,   // 15:30 KST
  HSI:    17 * 60,        // 17:00 KST (Hang Seng close)
  DAX:    1  * 60 + 30,   // 01:30 KST (DAX close, next day)
  BTC:    23 * 60,        // 23:00 KST
};

function kstTotalMin(): number {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

export function getKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function kstDatePlusDays(days: number): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
}

export function isBettingOpen(marketId: string): boolean {
  const s = SCHEDULES[marketId];
  if (!s) return false;
  const cur   = kstTotalMin();
  const open  = s.openH * 60 + s.openM;
  const close = s.closeH * 60 + s.closeM;

  if (open < close) return cur >= open && cur < close;
  return cur >= open || cur < close;
}

/**
 * Returns the KST date when a bet placed RIGHT NOW should settle.
 * NASDAQ       → always next calendar day
 * KOSPI / N225 → if placed 15:30–23:59 KST (evening) → next day
 *                if placed 00:00–08:29 KST (morning)  → today
 * BTC          → today
 */
export function getSettlementDate(marketId: string): string {
  const cur = kstTotalMin();
  if (marketId === 'NASDAQ' || marketId === 'DAX') return kstDatePlusDays(1);
  if (marketId === 'KOSPI' || marketId === 'N225') {
    return cur >= 15 * 60 + 30 ? kstDatePlusDays(1) : getKST();
  }
  if (marketId === 'HSI') {
    return cur >= 17 * 60 ? kstDatePlusDays(1) : getKST();
  }
  return getKST(); // BTC: same day
}

/**
 * Returns true when a bet with this `settlesOn` date can now be settled.
 * `settlesOn` is the KST calendar date when settlement should occur.
 */
export function shouldSettle(marketId: string, settlesOn: string): boolean {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKST = now.toISOString().slice(0, 10);
  const tm = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (settlesOn > todayKST) return false;       // not yet
  if (settlesOn < todayKST) return true;        // overdue — settle now
  return tm >= (SETTLE_TIME_MIN[marketId] ?? 0); // today: check time
}

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
