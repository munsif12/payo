// Date formatting helpers shared by transaction / activity rows.
// "Today, 3:20 PM" / "Yesterday, 3:20 PM" / "Aug 28" per Wallet.dc.html rows.

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function monthDayOpts(d: Date, now: Date): Intl.DateTimeFormatOptions {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  // Without the year, a transaction/due-date from a previous year ("Aug 28")
  // reads as if it happened this year. Append it only when it differs.
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return opts;
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
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', monthDayOpts(d, now));
}
