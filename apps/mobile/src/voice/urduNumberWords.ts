// Whole-rupee numbers spelled out in Urdu — a straight port of
// services/ai/app/urdu_numbers.py, kept in lockstep with it (same table, same
// colloquial rule, same range) and covered by the same cases its pytest uses.
//
// Why a second copy rather than asking the service: the app composes the
// post-PIN outcome sentence entirely on-device and posts the finished words to
// POST /speak. The service's own digits→words pass only fires on text it
// generated, so a sentence built here would otherwise reach TTS as "۲۵۵۰",
// which the voice must never read out digit by digit (spec §5).

const ONES = [
  'صفر', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو',
  'دس', 'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس',
  'بیس', 'اکیس', 'بائیس', 'تئیس', 'چوبیس', 'پچیس', 'چھبیس', 'ستائیس', 'اٹھائیس', 'انتیس',
  'تیس', 'اکتیس', 'بتیس', 'تینتیس', 'چونتیس', 'پینتیس', 'چھتیس', 'سینتیس', 'اڑتیس', 'انتالیس',
  'چالیس', 'اکتالیس', 'بیالیس', 'تینتالیس', 'چوالیس', 'پینتالیس', 'چھیالیس', 'سینتالیس', 'اڑتالیس', 'انچاس',
  'پچاس', 'اکاون', 'باون', 'ترپن', 'چون', 'پچپن', 'چھپن', 'ستاون', 'اٹھاون', 'انسٹھ',
  'ساٹھ', 'اکسٹھ', 'باسٹھ', 'تریسٹھ', 'چوسٹھ', 'پینسٹھ', 'چھیاسٹھ', 'سڑسٹھ', 'اڑسٹھ', 'انہتر',
  'ستر', 'اکہتر', 'بہتر', 'تہتر', 'چوہتر', 'پچہتر', 'چھہتر', 'ستہتر', 'اٹھہتر', 'اناسی',
  'اسی', 'اکیاسی', 'بیاسی', 'تراسی', 'چوراسی', 'پچاسی', 'چھیاسی', 'ستاسی', 'اٹھاسی', 'نواسی',
  'نوے', 'اکانوے', 'بانوے', 'ترانوے', 'چورانوے', 'پچانوے', 'چھیانوے', 'ستانوے', 'اٹھانوے', 'ننانوے',
];

/** 99 lakh 99 thousand 999 — the top of the Pakistani lakh system this covers. */
export const MAX_SUPPORTED = 9999999;

const underHundred = (n: number): string[] => (n ? [ONES[n]] : []);

function underThousand(n: number): string[] {
  const parts: string[] = [];
  if (n >= 100) parts.push(ONES[Math.floor(n / 100)], 'سو');
  parts.push(...underHundred(n % 100));
  return parts;
}

/**
 * `n` spelled out in Urdu, or null when it is out of the supported range
 * (negative, non-integer, or above 99,99,999) — the caller then leaves the
 * digits alone rather than mis-speaking them.
 */
export function urduNumberWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > MAX_SUPPORTED) return null;
  if (n === 0) return ONES[0];

  const parts: string[] = [];
  const lakhs = Math.floor(n / 100000);
  const rest = n % 100000;
  if (lakhs) parts.push(...underHundred(lakhs), 'لاکھ');

  if (rest >= 1100 && rest <= 1999) {
    // Colloquial, and deliberate: 1500 is «پندرہ سو», not «ایک ہزار پانچ سو».
    parts.push(ONES[Math.floor(rest / 100)], 'سو');
    parts.push(...underHundred(rest % 100));
  } else {
    const thousands = Math.floor(rest / 1000);
    const under = rest % 1000;
    if (thousands) parts.push(...underThousand(thousands), 'ہزار');
    parts.push(...underThousand(under));
  }
  return parts.join(' ');
}
