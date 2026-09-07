// Pure Home-greeting logic — deliberately free of lucide-react-native / RTK
// imports so it can be unit-tested directly (jest-expo can't transform the
// lucide ESM package outside a React Native module render).
import { formatPaisa } from '../lib/money';
import { formatShortDate } from '../lib/dates';
import type { DueBill } from '../api/types';

export type GreetingBucket = 'morning' | 'afternoon' | 'evening';

/** Main.dc.html header: "Good morning" < 12, "Good afternoon" < 17, else "Good evening". */
export function greetingBucket(hour: number): GreetingBucket {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Main.dc.html greets on FIRST name only — "Assalam o Alaikum, Ammi." — while
 *  the row above it keeps the full name ("Ammi Jaan"). Whitespace-only or empty
 *  names give '', so the caller can tell the name has not arrived yet. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** The bill suggestion's subtitle: the first due bill (biller + amount +
 * short date) when one exists, else the generic "see what's due" line. */
export function billSubtitle(bill: DueBill | undefined, urdu: boolean, t: Translate): string {
  if (!bill) return t('home.suggest.bill.subtitleGeneric');
  const biller = urdu && bill.biller.urduName ? bill.biller.urduName : bill.biller.name;
  return t('home.suggest.bill.subtitleDue', {
    biller,
    amount: formatPaisa(bill.amountPaisa),
    date: formatShortDate(bill.dueDate),
  });
}
