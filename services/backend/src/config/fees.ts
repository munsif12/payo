export const FEES_PAISA: Record<string, number> = { send_money_bank: 2500 };
export const feeFor = (kind: string) => FEES_PAISA[kind] ?? 0;
