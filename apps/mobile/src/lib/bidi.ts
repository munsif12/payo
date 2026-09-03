// Wraps a run of always-LTR content (phone numbers, OTP codes, countdowns)
// with Unicode isolate marks (U+2066 LRI … U+2069 PDI) so it renders
// left-to-right even when embedded inside an RTL (Urdu) sentence, without
// flipping the direction of the surrounding Urdu words. Mirrors the design
// system's `.num { direction:ltr; unicode-bidi:isolate }` CSS rule
// (Foundations.dc.html) for text that mixes translated copy with digits.
export function ltrIsolate(value: string): string {
  return `⁦${value}⁩`;
}
