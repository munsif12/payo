/**
 * Age-derived risk facts. Kept apart from `guardian.ts` because age gates the SCAM
 * check-in only — it never changes who may approve, and the guardian/approval rule is
 * deliberately age-independent (an over-ceiling send is reviewed for everyone).
 */

export const SENIOR_AGE = 60;
export const MIN_SIGNUP_AGE = 18;

/**
 * Completed years between `dateOfBirth` and `on` — a birthday later today has not happened
 * yet, so 60-tomorrow is 59. A 29 February birthday therefore ages on 1 March in a
 * non-leap year, which is the conventional reading and the one the tests pin.
 * Returns null when the user has never given a date of birth.
 */
export function ageOn(dateOfBirth: Date | null | undefined, on: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && on.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

/**
 * True from the 60th birthday onwards. A user who has not given a date of birth is NOT
 * treated as senior: the extra check-in is a courtesy we can only offer when we know, and
 * guessing it onto everyone would train the whole user base to tap through the question.
 */
export const isSenior = (user: { dateOfBirth?: Date | null }, on: Date = new Date()): boolean => {
  const age = ageOn(user.dateOfBirth, on);
  return age !== null && age >= SENIOR_AGE;
};

export const isAdult = (dateOfBirth: Date, on: Date = new Date()): boolean => {
  const age = ageOn(dateOfBirth, on);
  return age !== null && age >= MIN_SIGNUP_AGE;
};
