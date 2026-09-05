export interface PublicUser {
  id: string; name: string; urduName?: string; email?: string; phone: string;
  avatar?: string; language: 'ur' | 'en'; pinSet: boolean;
  /** v6. Absent on an older backend — treat a missing flag as ON (the server default). */
  preferences?: { proactiveGreeting: boolean };
  /** Only what the payer needs to render "protected by …" — never the guardian's user id. */
  guardian?: { name: string; phone: string };
}

export interface Txn {
  id: string;
  type: 'p2p' | 'bank_transfer' | 'bill' | 'recharge' | 'pocket_deposit' | 'pocket_withdraw' | 'request_settlement';
  direction: 'in' | 'out';
  amountPaisa: number; feePaisa: number;
  counterparty: { name: string; urduName?: string; detail: string; institutionLogoUrl?: string; domain?: string };
  category: string; status: 'completed'; refNo: string; createdAt: string;
}

/** The guardian gate on a pending send (v6). `waiting` = the PIN sheet must NOT open. */
export interface ActionApproval {
  required: boolean;
  guardianId: string;
  status: 'waiting' | 'approved' | 'declined';
  decidedAt?: string | null;
  reason?: string | null;
  remindedAt?: string | null;
}

export interface PendingAction {
  id: string; kind: string; amountPaisa: number; feePaisa: number;
  summary: { en: string; ur: string };
  lines: { label: { en: string; ur: string }; value: string }[];
  requiresPin: boolean; expiresAt: string; status: string;
  // ---- v6 (absent on an older backend / on locally-built pseudo-actions) ----
  cancelReason?: string | null;
  approval?: ActionApproval | null;
  riskFlags?: string[];
  checkIn?: { answered: boolean; someoneAsked: boolean } | null;
}

/** GET /guardian — the trusted-contact state, including a loosening still cooling off. */
export interface GuardianState {
  guardian: { userId: string; phone: string; name: string; ceilingPaisa: number; since: string } | null;
  /** A scheduled LOOSENING that has not taken effect yet. `replace` carries the
   *  INCOMING guardian in `phone`/`name` (the swap is a loosening for the current
   *  one); `raise` carries the ceiling it is going up to. */
  pending: {
    change: 'remove' | 'replace' | 'raise';
    ceilingPaisa?: number;
    phone?: string;
    name?: string;
    effectiveAt: string;
  } | null;
  ceilingPaisa: number;
  coolingMs: number;
}

/** GET /approvals — one send waiting for MY decision as somebody's guardian. */
export interface ApprovalDto {
  id: string; kind: string;
  payer: { name: string; urduName?: string; phone: string };
  summary: { en: string; ur: string };
  amountPaisa: number; feePaisa: number;
  riskFlags: string[];
  createdAt: string; expiresAt: string;
}

/** GET /me/digest — one row of the proactive greeting. Shapes differ per `kind`,
 *  so the extra fields are read defensively by the renderer. */
export interface DigestItemDto {
  kind: 'received' | 'bill_due' | 'approval_waiting' | 'request' | 'anomaly' | 'guardian_notice';
  amountPaisa?: number;
  from?: { name: string; urduName?: string; detail?: string; phone?: string };
  payer?: { name: string; phone: string };
  biller?: { id: string; name: string; urduName?: string; code?: string; logoUrl?: string; domain?: string };
  summary?: { en: string; ur: string };
  category?: string;
  thisMonthPaisa?: number;
  averagePaisa?: number;
  ratio?: number;
  change?: 'remove' | 'replace' | 'raise' | 'reminder';
  ceilingPaisa?: number;
  effectiveAt?: string;
  dueDate?: string;
  note?: string;
  actionId?: string;
  billId?: string;
  requestId?: string;
  noticeId?: string;
  transactionId?: string;
}

export interface DigestDto { items: DigestItemDto[]; since: string }

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

/** POST /actions/:id/execute. `transaction` is null for a PIN-gated action that
 *  moves no money (`card_unfreeze`), which returns the new `card` state instead. */
export interface ExecuteActionResult {
  transaction: Txn | null;
  card?: CardSummary;
  recipientSuggestion?: RecipientSuggestion;
  billerSuggestion?: BillerSuggestion;
}

/** The masked card state returned alongside a PIN-gated card action
 *  (POST /actions/:id/execute for `card_unfreeze`). Never carries pan/cvv. */
export interface CardSummary {
  id: string; last4: string; maskedPan: string; expiry: string; frozen: boolean;
  /** Absent on older backends — the card card falls back to an empty holder line. */
  holder?: string;
}

export interface CardDto { id: string; pan: string; cvv: string; expiry: string; frozen: boolean }

export interface StatementMeta {
  id: string; year: number; month?: number;
  totalInPaisa: number; totalOutPaisa: number; txnCount: number; createdAt: string;
}

export interface BillLookup {
  billId: string; consumerName: string; amountPaisa: number; dueDate: string; month: string;
}

export interface NamedItem {
  id: string; name: string; urduName: string; category?: string;
  /** F1 logos — optional; absent means the category icon. */
  code?: string; logoUrl?: string; domain?: string;
}

export interface InstitutionDto {
  id: string; name: string; urduName: string; kind: 'wallet' | 'bank'; code?: string; popular: boolean;
  /** F1 logos — optional. */
  logoUrl?: string; domain?: string;
}

export interface ResolvedRecipient {
  title: string;
  institution: { id: string; name: string; urduName?: string; kind: 'wallet' | 'bank'; code?: string; logoUrl?: string; domain?: string };
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
  institution: { id: string; name: string; urduName?: string; kind: 'wallet' | 'bank'; code?: string; logoUrl?: string; domain?: string };
  identifier: string; linkedUserId?: string; lastUsedAt?: string;
}

export interface SavedBillerDto {
  id: string; nickname: string;
  biller: { id: string; name: string; urduName?: string; category?: string; code?: string; logoUrl?: string; domain?: string };
  consumerNo: string; consumerName: string;
}

export interface DueBill {
  billId: string;
  biller: { id: string; name: string; urduName: string; category?: string; code?: string; logoUrl?: string; domain?: string };
  consumerNo: string; amountPaisa: number; dueDate: string; month: string;
}
