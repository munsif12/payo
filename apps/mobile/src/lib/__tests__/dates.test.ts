import { formatRelativeDay, formatShortDate, monthName, UR_MONTHS } from '../dates';

const NOW = new Date('2026-09-03T15:20:00');

test('formatRelativeDay: today shows "Today, <time>"', () => {
  expect(formatRelativeDay('2026-09-03T15:20:00', NOW)).toBe('Today, 3:20 PM');
});

test('formatRelativeDay: yesterday shows "Yesterday, <time>"', () => {
  expect(formatRelativeDay('2026-09-02T15:26:00', NOW)).toBe('Yesterday, 3:26 PM');
});

test('formatRelativeDay: older dates fall back to "Mon D"', () => {
  expect(formatRelativeDay('2026-08-28T09:00:00', NOW)).toBe('Aug 28');
});

test('formatShortDate: short month + day', () => {
  expect(formatShortDate('2026-09-10T00:00:00', NOW)).toBe('Sep 10');
});

test('formatRelativeDay: older date from a prior year includes the year', () => {
  expect(formatRelativeDay('2025-08-28T09:00:00', NOW)).toBe('Aug 28, 2025');
});

test('formatShortDate: date from a prior year includes the year', () => {
  expect(formatShortDate('2025-09-10T00:00:00', NOW)).toBe('Sep 10, 2025');
});

test('formatShortDate: date from the current year omits the year', () => {
  expect(formatShortDate('2026-09-10T00:00:00', NOW)).toBe('Sep 10');
});

test('formatShortDate: a date-only ISO string reads as its own calendar day, not shifted by the device timezone', () => {
  expect(formatShortDate('2026-09-09', NOW)).toBe('Sep 9');
});

test('formatShortDate: an ISO timestamp near UTC midnight still reads as the SAME calendar day the digest card shows (no timezone-induced off-by-one)', () => {
  // A due date near the UTC day boundary must format to the same day
  // regardless of local device offset — both the digest row and the
  // suggestion card call this one helper, so they can never disagree.
  expect(formatShortDate('2026-09-09T23:30:00.000Z', NOW)).toBe('Sep 9');
  expect(formatShortDate('2026-09-09T00:00:00.000Z', NOW)).toBe('Sep 9');
});

// ---- v8 Urdu QA: dates render in Urdu on an Urdu screen ----

test('formatRelativeDay (ur): today reads «آج، <time>» with the clock time LTR-isolated', () => {
  expect(formatRelativeDay('2026-09-03T15:20:00', NOW, 'ur')).toBe('آج، ⁦3:20 PM⁩');
});

test('formatRelativeDay (ur): yesterday reads «کل، <time>»', () => {
  expect(formatRelativeDay('2026-09-02T15:26:00', NOW, 'ur')).toBe('کل، ⁦3:26 PM⁩');
});

test('formatRelativeDay (ur): older dates read day-then-Urdu-month, no year in the current year', () => {
  expect(formatRelativeDay('2026-08-28T09:00:00', NOW, 'ur')).toBe('28 اگست');
});

test('formatRelativeDay (ur): a prior year appends the year', () => {
  expect(formatRelativeDay('2025-08-28T09:00:00', NOW, 'ur')).toBe('28 اگست 2025');
});

test('formatShortDate (ur): due dates read «D <month>» and stay on their own calendar day', () => {
  expect(formatShortDate('2026-09-10T00:00:00', NOW, 'ur')).toBe('10 ستمبر');
  expect(formatShortDate('2026-09-09', NOW, 'ur')).toBe('9 ستمبر');
  expect(formatShortDate('2026-09-09T23:30:00.000Z', NOW, 'ur')).toBe('9 ستمبر');
  expect(formatShortDate('2025-09-10T00:00:00', NOW, 'ur')).toBe('10 ستمبر 2025');
});

test('monthName: English long/short and the single Urdu form', () => {
  expect(monthName(8)).toBe('September');
  expect(monthName(8, 'en', 'short')).toBe('Sep');
  expect(monthName(8, 'ur')).toBe('ستمبر');
  expect(UR_MONTHS).toHaveLength(12);
});

test('the English forms are unchanged when no language is passed (default en)', () => {
  expect(formatRelativeDay('2026-09-03T15:20:00', NOW)).toBe(formatRelativeDay('2026-09-03T15:20:00', NOW, 'en'));
  expect(formatShortDate('2026-09-10', NOW)).toBe(formatShortDate('2026-09-10', NOW, 'en'));
});
