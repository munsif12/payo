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

// Pakistani mobile numbers read as "+92 300 111 0001" (country · network · two
// groups); anything that is not a +92 mobile is returned untouched. Display only.
export function formatPhone(value: string): string {
  const m = /^\+92(3\d{2})(\d{3})(\d{4})$/.exec(value.replace(/\s+/g, ''));
  return m ? `+92 ${m[1]} ${m[2]} ${m[3]}` : value;
}
