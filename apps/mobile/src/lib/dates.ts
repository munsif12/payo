// Date formatting helpers shared by transaction / activity rows.
// "Today, 3:20 PM" / "Yesterday, 3:20 PM" / "Aug 28" per Wallet.dc.html rows.

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function monthDayOpts(d: Date, now: Date, utc = false): Intl.DateTimeFormatOptions {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  // Without the year, a transaction/due-date from a previous year ("Aug 28")
  // reads as if it happened this year. Append it only when it differs.
  // `utc` compares both sides via the UTC calendar year — used by the
  // UTC-anchored formatShortDate so the year boundary can't shift either.
  const dYear = utc ? d.getUTCFullYear() : d.getFullYear();
  const nowYear = utc ? now.getUTCFullYear() : now.getFullYear();
  if (dYear !== nowYear) opts.year = 'numeric';
  return opts;
}

/** Reads the calendar date out of an ISO string as a UTC-midnight Date, so a
 *  formatter built on it never shifts a day forward/backward depending on the
 *  device's timezone. A "due date" (unlike a transaction timestamp) has no
 *  meaningful time-of-day component — it names a calendar day, and must read
 *  as the SAME day everywhere regardless of where the phone happens to be. */
function calendarDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Date(iso);
}

/** "Today, 3:20 PM" / "Yesterday, 3:20 PM" / "Aug 28" (or "Aug 28, 2025" for
 * a prior year) — relative to `now` (defaults to the real current time;
 * pass `now` explicitly to test). */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return `Today, ${formatTime(d)}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday, ${formatTime(d)}`;
  return d.toLocaleDateString('en-US', monthDayOpts(d, now));
}

/** "Sep 10" (or "Sep 10, 2025" for a prior year) — short month + day, used
 * for due-bill dates (locale-fixed per the artboards, which show this format
 * regardless of app language). `now` defaults to the real current time; pass
 * it explicitly to test. */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const d = calendarDate(iso);
  // timeZone: 'UTC' pins the rendered day to the UTC-midnight Date built above —
  // without it, toLocaleDateString re-projects through the device's own
  // timezone and can print the day before or after depending on where the
  // phone is (the bug this function exists to avoid).
  return d.toLocaleDateString('en-US', { ...monthDayOpts(d, now, true), timeZone: 'UTC' });
}
