export interface PublicUser {
  id: string; name: string; urduName?: string; email?: string; phone: string;
  avatar?: string; language: 'ur' | 'en'; pinSet: boolean;
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

export interface InstitutionDto {
  id: string; name: string; urduName: string; kind: 'wallet' | 'bank'; code?: string; popular: boolean;
}

export interface ResolvedRecipient {
  title: string;
  institution: { id: string; name: string; urduName?: string; kind: 'wallet' | 'bank' };
  identifier: string;
  linkedUserId?: string;
}

export interface RecipientSuggestion {
  institutionId: string; identifier: string; title: string; alreadySaved: boolean;
}

export interface BillerSuggestion {
  billerId: string; consumerNo: string; consumerName: string; alreadySaved: boolean;
}

export interface RecipientDto {
  id: string; nickname: string; title: string;
  institution: { id: string; name: string; urduName?: string; kind: 'wallet' | 'bank' };
  identifier: string; linkedUserId?: string; lastUsedAt?: string;
}

export interface SavedBillerDto {
  id: string; nickname: string;
  biller: { id: string; name: string; urduName?: string; category?: string };
  consumerNo: string; consumerName: string;
}

export interface DueBill {
  billId: string;
  biller: { id: string; name: string; urduName: string; category?: string };
  consumerNo: string; amountPaisa: number; dueDate: string; month: string;
}
