import { ageOn, isSenior, SENIOR_AGE } from '../risk';

const on = new Date('2026-09-06T12:00:00Z');
const dob = (iso: string) => new Date(`${iso}T00:00:00Z`);

test('ageOn counts completed years, not calendar-year differences', () => {
  expect(ageOn(dob('2000-09-06'), on)).toBe(26);
  expect(ageOn(dob('2000-09-07'), on)).toBe(25); // birthday is tomorrow
  expect(ageOn(dob('2000-09-05'), on)).toBe(26); // birthday was yesterday
  expect(ageOn(dob('2000-12-31'), on)).toBe(25); // later in the same year
  expect(ageOn(dob('2000-01-01'), on)).toBe(26);
});

test('a 29 February birthday ages on 1 March in a non-leap year', () => {
  expect(ageOn(dob('2000-02-29'), new Date('2026-02-28T12:00:00Z'))).toBe(25);
  expect(ageOn(dob('2000-02-29'), new Date('2026-03-01T12:00:00Z'))).toBe(26);
});

test('isSenior is true from the 60th birthday, not the day before', () => {
  expect(SENIOR_AGE).toBe(60);
  expect(isSenior({ dateOfBirth: dob('1966-09-06') }, on)).toBe(true);   // exactly 60 today
  expect(isSenior({ dateOfBirth: dob('1966-09-07') }, on)).toBe(false);  // 60 tomorrow
  expect(isSenior({ dateOfBirth: dob('1966-09-05') }, on)).toBe(true);   // 60 yesterday
  expect(isSenior({ dateOfBirth: dob('1961-03-15') }, on)).toBe(true);   // Ammi
  expect(isSenior({ dateOfBirth: dob('1993-08-02') }, on)).toBe(false);  // Bilal
});

test('a user with no date of birth is not treated as senior', () => {
  expect(isSenior({}, on)).toBe(false);
  expect(isSenior({ dateOfBirth: null }, on)).toBe(false);
  expect(ageOn(undefined, on)).toBeNull();
});
