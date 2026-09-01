export function formatPaisa(paisa: number): string {
  const rupees = paisa / 100;
  const hasFraction = paisa % 100 !== 0;
  return '₨' + rupees.toLocaleString('en-PK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}
