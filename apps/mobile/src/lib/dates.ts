// Date formatting helpers shared by transaction / activity / statement rows.
// "Today, 3:20 PM" / "Yesterday, 3:20 PM" / "Aug 28" per Wallet.dc.html rows —
// and, since v8 Urdu QA, their Urdu forms: «آج، 3:20 PM» / «کل، 3:20 PM» /
// «28 اگست» (day before month, as Urdu reads a date).
import { ltrIsolate } from './bidi';

export type DateLang = 'en' | 'ur';

export const EN_MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Urdu month names have one form — there is no short/long distinction. Kept
 *  here (not in Intl) because 'ur' month names are not reliably available on-device. */
export const UR_MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];

const UR_TODAY = 'آج';
const UR_YESTERDAY = 'کل';
/** U+060C — the Urdu/Arabic comma. */
const UR_COMMA = '،';

/** Month name by 0-based index, in the given language. */
export function monthName(monthIndex: number, lang: DateLang = 'en', style: 'long' | 'short' = 'long'): string {
  if (lang === 'ur') return UR_MONTHS[monthIndex] ?? '';
  return (style === 'short' ? EN_MONTHS_SHORT : EN_MONTHS_LONG)[monthIndex] ?? '';
}

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

/** «28 اگست» — day, then month; the year only when it differs from `nowYear`
 *  (same rule as the English form). Digits stay ASCII, as every amount in the
 *  app does, so the row's numbers all read in one script. */
function urduMonthDay(day: number, monthIndex: number, year: number, nowYear: number): string {
  const base = `${day} ${UR_MONTHS[monthIndex]}`;
  return year !== nowYear ? `${base} ${year}` : base;
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
 * pass `now` explicitly to test). In Urdu: «آج، 3:20 PM» / «کل، 3:20 PM» /
 * «28 اگست», with the clock time LTR-isolated so it never reorders inside
 * the RTL run. */
export function formatRelativeDay(iso: string, now: Date = new Date(), lang: DateLang = 'en'): string {
  const d = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (lang === 'ur') {
    if (sameDay(d, now)) return `${UR_TODAY}${UR_COMMA} ${ltrIsolate(formatTime(d))}`;
    if (sameDay(d, yesterday)) return `${UR_YESTERDAY}${UR_COMMA} ${ltrIsolate(formatTime(d))}`;
    return urduMonthDay(d.getDate(), d.getMonth(), d.getFullYear(), now.getFullYear());
  }
  if (sameDay(d, now)) return `Today, ${formatTime(d)}`;
  if (sameDay(d, yesterday)) return `Yesterday, ${formatTime(d)}`;
  return d.toLocaleDateString('en-US', monthDayOpts(d, now));
}

/** "Sep 10" (or "Sep 10, 2025" for a prior year) — short month + day, used
 * for due-bill dates. Urdu: «10 ستمبر» (/ «10 ستمبر 2025»). `now` defaults to
 * the real current time; pass it explicitly to test. */
export function formatShortDate(iso: string, now: Date = new Date(), lang: DateLang = 'en'): string {
  const d = calendarDate(iso);
  if (lang === 'ur') {
    // UTC getters, to stay on the UTC-midnight day calendarDate() pinned.
    return urduMonthDay(d.getUTCDate(), d.getUTCMonth(), d.getUTCFullYear(), now.getUTCFullYear());
  }
  // timeZone: 'UTC' pins the rendered day to the UTC-midnight Date built above —
  // without it, toLocaleDateString re-projects through the device's own
  // timezone and can print the day before or after depending on where the
  // phone is (the bug this function exists to avoid).
  return d.toLocaleDateString('en-US', { ...monthDayOpts(d, now, true), timeZone: 'UTC' });
}
