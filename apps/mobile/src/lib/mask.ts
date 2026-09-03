// Masks a recipient identifier (phone / IBAN / account number) for display on
// the `recipient` chat card: keeps the first 3 and last 3 characters, replaces
// the middle with bullets. Short values (<=6 chars) are returned unchanged —
// masking them would reveal nothing anyway.
export function maskIdentifier(value: string): string {
  if (value.length <= 6) return value;
  const head = value.slice(0, 3);
  const tail = value.slice(-3);
  return `${head}${'•'.repeat(Math.min(6, value.length - 6))}${tail}`;
}
