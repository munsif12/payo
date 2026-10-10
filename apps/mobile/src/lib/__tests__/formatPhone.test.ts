import { formatPhone } from '../mask';

describe('formatPhone', () => {
  it('groups a +92 mobile number for reading', () => {
    expect(formatPhone('+923001110001')).toBe('+92 300 111 0001');
    expect(formatPhone('+92 300 1110007')).toBe('+92 300 111 0007');
  });
  it('leaves anything else alone', () => {
    expect(formatPhone('+442071234567')).toBe('+442071234567');
    expect(formatPhone('')).toBe('');
  });
});
