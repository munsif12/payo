import { formatRelativeDay, formatShortDate } from '../dates';

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
