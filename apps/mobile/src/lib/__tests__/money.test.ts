import { formatPaisa } from '../money';

test('formats paisa as rupees with grouping, no decimals when whole', () => {
  expect(formatPaisa(150000)).toBe('₨1,500');
  expect(formatPaisa(432050)).toBe('₨4,320.50');
  expect(formatPaisa(0)).toBe('₨0');
});
