// Pure-logic tests only — homeGreetingLogic has no lucide-react-native/RTK
// import, so these run without a store, network mocking, or a native-module
// transform. `useHomeGreeting` / `buildSuggestions` (which also need the
// lucide icon set) are exercised indirectly via the Home screen.
import { greetingBucket, billSubtitle, firstName } from '../homeGreetingLogic';
import type { DueBill } from '../../api/types';

const t = (key: string, opts?: Record<string, unknown>) => {
  if (!opts) return key;
  return key + ':' + JSON.stringify(opts);
};

test('greetingBucket: morning below 12, afternoon below 17, else evening', () => {
  expect(greetingBucket(0)).toBe('morning');
  expect(greetingBucket(11)).toBe('morning');
  expect(greetingBucket(12)).toBe('afternoon');
  expect(greetingBucket(16)).toBe('afternoon');
  expect(greetingBucket(17)).toBe('evening');
  expect(greetingBucket(23)).toBe('evening');
});

// Main.dc.html: "Assalam o Alaikum, Ammi." over the row that still says "Ammi Jaan".
test('firstName: the greeting line uses the first name only', () => {
  expect(firstName('Ammi Jaan')).toBe('Ammi');
  expect(firstName('Ammi')).toBe('Ammi');
  expect(firstName('Munsif Ali Misri')).toBe('Munsif');
  expect(firstName('  Ammi   Jaan  ')).toBe('Ammi');
  expect(firstName('امی جان')).toBe('امی');
});

test('firstName: an unknown name stays empty so callers can wait for /me', () => {
  expect(firstName('')).toBe('');
  expect(firstName('   ')).toBe('');
});

const bill: DueBill = {
  billId: 'b1',
  biller: { id: 'k1', name: 'K-Electric', urduName: 'کے الیکٹرک' },
  consumerNo: '1234567890',
  amountPaisa: 432000,
  dueDate: '2026-09-10T00:00:00.000Z',
  month: '2026-09',
};

test('billSubtitle: generic line when there is no due bill', () => {
  expect(billSubtitle(undefined, false, t)).toBe('home.suggest.bill.subtitleGeneric');
});

test('billSubtitle: biller + amount + short date when a bill is due (English)', () => {
  expect(billSubtitle(bill, false, t)).toBe(
    'home.suggest.bill.subtitleDue:' + JSON.stringify({ biller: 'K-Electric', amount: '₨4,320', date: 'Sep 10' }),
  );
});

test('billSubtitle: uses the Urdu biller name when urdu is true', () => {
  expect(billSubtitle(bill, true, t)).toBe(
    'home.suggest.bill.subtitleDue:' + JSON.stringify({ biller: 'کے الیکٹرک', amount: '₨4,320', date: 'Sep 10' }),
  );
});

