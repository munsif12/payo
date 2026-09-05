// Mirrors services/ai/app/cards.py (the authoritative card contract) so tsc
// catches drift between what the AI service emits and what CardView renders.
// Keep field names/optionality in lockstep with that file — do not invent
// fields here that cards.py doesn't have.

export interface Bilingual {
  en: string;
  ur: string;
}

export interface InstitutionRef {
  id: string;
  name: string;
  urduName?: string;
  kind: 'wallet' | 'bank';
}

export interface InstitutionChip {
  institutionId: string;
  name: string;
  urduName?: string;
  kind: 'wallet' | 'bank';
}

export interface InstitutionChipsCard {
  kind: 'institution_chips';
  prompt: Bilingual;
  institutions: InstitutionChip[];
}

export interface RecipientCard {
  kind: 'recipient';
  title: string;
  institution: InstitutionRef;
  identifier: string;
  linkedUserId?: string;
  prompt: Bilingual;
}

export interface RecipientChip {
  recipientId: string;
  nickname: string;
  title: string;
  institutionId: string;
  institutionName: string;
  identifier: string;
}

export interface RecipientChipsCard {
  kind: 'recipient_chips';
  prompt: Bilingual;
  recipients: RecipientChip[];
}

export interface BillerChip {
  savedBillerId?: string;
  billerId: string;
  name: string;
  urduName?: string;
  consumerNo?: string;
}

export interface BillerChipsCard {
  kind: 'biller_chips';
  prompt: Bilingual;
  billers: BillerChip[];
}

export interface SavePromptCard {
  kind: 'save_prompt';
  target: 'recipient' | 'biller';
  institutionId?: string;
  identifier?: string;
  title?: string;
  billerId?: string;
  consumerNo?: string;
  consumerName?: string;
  prompt: Bilingual;
}

export interface ConfirmationLine {
  label: Bilingual;
  value: string;
}

export interface ConfirmationCard {
  kind: 'confirmation';
  actionId: string;
  summary: Bilingual;
  lines: ConfirmationLine[];
  amountPaisa: number;
  feePaisa: number;
  requiresPin: boolean;
  expiresAt: string;
  // Defaulted server-side (cards.py: True) — absent means "open the sheet".
  autoOpenPin?: boolean;
}

export interface SuccessCard {
  kind: 'success';
  title: Bilingual;
  refNo: string;
  amountPaisa: number;
}

export interface TxnCounterparty {
  name: string;
  urduName?: string;
  detail: string;
}

export interface Txn {
  id: string;
  type: string;
  direction: 'in' | 'out';
  amountPaisa: number;
  feePaisa: number;
  counterparty: TxnCounterparty;
  category: string;
  status: string;
  refNo: string;
  createdAt: string;
}

export interface TransactionsCard {
  kind: 'transactions';
  items: Txn[];
}

export interface StatementCard {
  kind: 'statement';
  statementId: string;
  period: Bilingual;
  totalInPaisa: number;
  totalOutPaisa: number;
  downloadUrl: string;
}

export interface BillCard {
  kind: 'bill';
  billId: string;
  biller: string;
  consumerName: string;
  amountPaisa: number;
  dueDate: string;
  month: string;
}

export interface PocketCard {
  kind: 'pocket';
  pocketId: string;
  name: string;
  urduName?: string;
  emoji: string;
  balancePaisa: number;
  goalPaisa?: number;
}

export interface BalanceCard {
  kind: 'balance';
  balancePaisa: number;
}

// ---- v5 card kinds (spec §4.2) ----

export interface ReceiptCard {
  kind: 'receipt';
  txn: Txn;
  shareText: Bilingual;
}

export interface SpendingCategory {
  category: string;
  label: Bilingual;
  totalPaisa: number;
  count: number;
  /** 0..1 of totalOutPaisa — drives the bar width. */
  share: number;
}

export interface SpendingCompare {
  period: Bilingual;
  totalOutPaisa: number;
  /** current - previous. */
  deltaPaisa: number;
  /** null when the previous period spent nothing. */
  deltaPct?: number | null;
}

export interface SpendingCard {
  kind: 'spending';
  period: Bilingual;
  totalOutPaisa: number;
  totalInPaisa: number;
  byCategory: SpendingCategory[];
  compare?: SpendingCompare | null;
}

export interface AccountCard {
  kind: 'account';
  name: string;
  urduName?: string;
  phone: string;
  memberSince: string;
  balancePaisa: number;
  language: string;
}

export type ProfileField = 'name' | 'urduName' | 'language';

export interface ProfileCard {
  kind: 'profile';
  name: string;
  urduName?: string;
  language: string;
  applied: ProfileField[];
}

export interface HelpIntent {
  label: Bilingual;
  intent: Bilingual;
}

export interface HelpCard {
  kind: 'help';
  intents: HelpIntent[];
}

/** The user's virtual debit card — last-4 only. `pan`/`cvv` never appear here
 *  and the renderer never shows them even if a malformed payload carries them. */
export interface CardCard {
  kind: 'card';
  last4: string;
  maskedPan: string;
  expiry: string;
  frozen: boolean;
  holder: string;
}

export interface StatementSummary {
  statementId: string;
  period: Bilingual;
  totalInPaisa: number;
  totalOutPaisa: number;
  downloadUrl: string;
}

export interface StatementsCard {
  kind: 'statements';
  items: StatementSummary[];
}

export interface RecipientsCard {
  kind: 'recipients';
  items: RecipientChip[];
}

export interface BillItem {
  billId: string;
  biller: string;
  consumerName: string;
  amountPaisa: number;
  dueDate: string;
  month: string;
}

export interface BillsCard {
  kind: 'bills';
  items: BillItem[];
}

export interface BillersCard {
  kind: 'billers';
  items: BillerChip[];
}

export interface TelcoChip {
  telcoId: string;
  name: string;
  urduName?: string;
}

export interface TelcoChipsCard {
  kind: 'telco_chips';
  prompt: Bilingual;
  telcos: TelcoChip[];
}

export interface PocketItem {
  pocketId: string;
  name: string;
  urduName?: string;
  emoji: string;
  balancePaisa: number;
  goalPaisa?: number;
  /** 0..1 — balance/goal, precomputed server-side. */
  progress: number;
}

export interface PocketsCard {
  kind: 'pockets';
  items: PocketItem[];
}

export interface RequestCounterparty {
  name: string;
  urduName?: string;
  phone: string;
}

export interface RequestCard {
  kind: 'request';
  requestId: string;
  direction: 'in' | 'out';
  counterparty: RequestCounterparty;
  amountPaisa: number;
  note?: string;
  status: string;
}

export interface RequestItem {
  requestId: string;
  direction: 'in' | 'out';
  counterparty: RequestCounterparty;
  amountPaisa: number;
  note?: string;
  status: string;
}

export interface RequestsCard {
  kind: 'requests';
  items: RequestItem[];
}

export interface QrCard {
  kind: 'qr';
  payload: string;
  name: string;
  phone: string;
}

export type AnyCard =
  | ConfirmationCard | SuccessCard | TransactionsCard | StatementCard
  | InstitutionChipsCard | RecipientCard | RecipientChipsCard | BillerChipsCard
  | SavePromptCard | BillCard | PocketCard | BalanceCard
  | ReceiptCard | SpendingCard | AccountCard | ProfileCard | HelpCard | CardCard
  | StatementsCard | RecipientsCard | BillsCard | BillersCard | TelcoChipsCard
  | PocketsCard | RequestCard | RequestsCard | QrCard;
