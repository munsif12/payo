export interface PublicUser {
  id: string; name: string; urduName?: string; email: string; phone: string;
  avatar?: string; language: 'ur' | 'en';
}

export interface Txn {
  id: string;
  type: 'p2p' | 'bank_transfer' | 'bill' | 'recharge' | 'pocket_deposit' | 'pocket_withdraw' | 'request_settlement';
  direction: 'in' | 'out';
  amountPaisa: number; feePaisa: number;
  counterparty: { name: string; urduName?: string; detail: string };
  category: string; status: 'completed'; refNo: string; createdAt: string;
}

export interface PendingAction {
  id: string; kind: string; amountPaisa: number; feePaisa: number;
  summary: { en: string; ur: string };
  lines: { label: { en: string; ur: string }; value: string }[];
  requiresPin: boolean; expiresAt: string; status: string;
}

export interface Me {
  user: PublicUser;
  account: { id: string; balancePaisa: number };
  card: { id: string; last4: string; frozen: boolean };
}

export interface ContactDto {
  id: string; name: string; urduName?: string; kind: 'payo' | 'bank';
  phone?: string; bankId?: string; bankName?: string; iban?: string; linkedUserId?: string;
}

export interface PocketDto {
  id: string; name: string; urduName?: string; emoji: string;
  goalPaisa?: number; balancePaisa: number;
}

export interface RequestDto {
  id: string; direction: 'outgoing' | 'incoming';
  counterparty: { name: string; urduName?: string; phone: string };
  amountPaisa: number; note?: string; status: 'pending' | 'approved' | 'declined'; createdAt: string;
}

export interface CardDto { id: string; pan: string; cvv: string; expiry: string; frozen: boolean }

export interface StatementMeta {
  id: string; year: number; month?: number;
  totalInPaisa: number; totalOutPaisa: number; txnCount: number; createdAt: string;
}

export interface BillLookup {
  billId: string; consumerName: string; amountPaisa: number; dueDate: string; month: string;
}

export interface NamedItem { id: string; name: string; urduName: string; category?: string }
