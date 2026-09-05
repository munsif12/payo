import schemas from '../card-schemas.json';

// F3.1 parity gate: `cardShapes.ts` must mirror services/ai/app/cards.py
// field-for-field. `card-schemas.json` is a checked-in export of that file's
// pydantic union; the maps below are the hand-written runtime mirror of what
// cardShapes.ts declares (TypeScript interfaces vanish at runtime, so the keys
// have to be restated here for the comparison to be possible at all).
//
// To regenerate the snapshot after changing cards.py:
//
//   cd services/ai && uv run python ../../scripts/export-card-schemas.py \
//     -o ../../apps/mobile/src/components/cards/card-schemas.json
//
// Then update REQUIRED/OPTIONAL below (and cardShapes.ts) until this is green.

/** Required (non-defaulted, non-nullable) properties of each pydantic model. */
const REQUIRED: Record<string, string[]> = {
  Bilingual: ['en', 'ur'],
  ConfirmationLine: ['label', 'value'],
  ConfirmationCard: ['actionId', 'summary', 'lines', 'amountPaisa', 'feePaisa', 'requiresPin', 'expiresAt'],
  SuccessCard: ['title', 'refNo', 'amountPaisa'],
  TxnCounterparty: ['name', 'detail'],
  Txn: ['id', 'type', 'direction', 'amountPaisa', 'feePaisa', 'counterparty', 'category', 'status', 'refNo', 'createdAt'],
  TransactionsCard: ['items'],
  StatementCard: ['statementId', 'period', 'totalInPaisa', 'totalOutPaisa', 'downloadUrl'],
  InstitutionRef: ['id', 'name', 'kind'],
  InstitutionChip: ['institutionId', 'name', 'kind'],
  InstitutionChipsCard: ['prompt', 'institutions'],
  RecipientCard: ['title', 'institution', 'identifier', 'prompt'],
  RecipientChip: ['recipientId', 'nickname', 'title', 'institutionId', 'institutionName', 'identifier'],
  RecipientChipsCard: ['prompt', 'recipients'],
  BillerChip: ['billerId', 'name'],
  BillerChipsCard: ['prompt', 'billers'],
  SavePromptCard: ['target', 'prompt'],
  BillCard: ['billId', 'biller', 'consumerName', 'amountPaisa', 'dueDate', 'month'],
  PocketCard: ['pocketId', 'name', 'emoji', 'balancePaisa'],
  BalanceCard: ['balancePaisa'],
  ReceiptCard: ['txn', 'shareText'],
  SpendingCategory: ['category', 'label', 'totalPaisa', 'count', 'share'],
  SpendingCompare: ['period', 'totalOutPaisa', 'deltaPaisa'],
  SpendingCard: ['period', 'totalOutPaisa', 'totalInPaisa', 'byCategory'],
  AccountCard: ['name', 'phone', 'memberSince', 'balancePaisa', 'language'],
  ProfileCard: ['name', 'language', 'applied'],
  HelpIntent: ['label', 'intent'],
  HelpCard: ['intents'],
  CardCard: ['last4', 'maskedPan', 'expiry', 'frozen', 'holder'],
  StatementSummary: ['statementId', 'period', 'totalInPaisa', 'totalOutPaisa', 'downloadUrl'],
  StatementsCard: ['items'],
  RecipientsCard: ['items'],
  BillItem: ['billId', 'biller', 'consumerName', 'amountPaisa', 'dueDate', 'month'],
  BillsCard: ['items'],
  BillersCard: ['items'],
  TelcoChip: ['telcoId', 'name'],
  TelcoChipsCard: ['prompt', 'telcos'],
  PocketItem: ['pocketId', 'name', 'emoji', 'balancePaisa', 'progress'],
  PocketsCard: ['items'],
  RequestCounterparty: ['name', 'phone'],
  RequestCard: ['requestId', 'direction', 'counterparty', 'amountPaisa', 'status'],
  RequestItem: ['requestId', 'direction', 'counterparty', 'amountPaisa', 'status'],
  RequestsCard: ['items'],
  QrCard: ['payload', 'name', 'phone'],
  CheckInCard: ['actionId', 'prompt'],
  WaitingApprovalCard: ['actionId', 'guardianName', 'expiresAt', 'amountPaisa', 'summary'],
  ApprovalItem: ['actionId', 'payerName', 'payerPhone', 'summary', 'amountPaisa', 'createdAt', 'expiresAt'],
  ApprovalsCard: ['items'],
  // `kind` here is a FREE-FORM field ('received' | 'bill_due' | …), not the union
  // discriminator, so it is a required property like any other.
  DigestItem: ['kind', 'title'],
  DigestCard: ['items'],
  GuardianPendingChange: ['change'],
  GuardianCard: ['ceilingPaisa', 'coolingMs'],
};

/** Optional properties, EXCLUDING the discriminator `kind` (defaulted in
 *  pydantic, a literal in TS, present on every *Card model). Note that
 *  InstitutionRef/InstitutionChip have a REAL `kind` field ('wallet' | 'bank')
 *  which is not a discriminator and is listed in REQUIRED above. */
const OPTIONAL: Record<string, string[]> = {
  ConfirmationCard: ['autoOpenPin'],
  TxnCounterparty: ['urduName'],
  InstitutionRef: ['urduName'],
  InstitutionChip: ['urduName'],
  RecipientCard: ['linkedUserId'],
  BillerChip: ['savedBillerId', 'urduName', 'consumerNo'],
  SavePromptCard: ['institutionId', 'identifier', 'title', 'billerId', 'consumerNo', 'consumerName'],
  PocketCard: ['urduName', 'goalPaisa'],
  SpendingCompare: ['deltaPct'],
  SpendingCard: ['compare'],
  AccountCard: ['urduName'],
  ProfileCard: ['urduName'],
  TelcoChip: ['urduName'],
  PocketItem: ['urduName', 'goalPaisa'],
  RequestCounterparty: ['urduName'],
  RequestCard: ['note'],
  RequestItem: ['note'],
  CheckInCard: ['riskFlags'],
  ApprovalItem: ['riskFlags'],
  DigestItem: ['subtitle', 'amountPaisa', 'intent', 'refId'],
  GuardianPendingChange: ['phone', 'ceilingPaisa', 'effectiveAt'],
  GuardianCard: ['name', 'phone', 'pendingChange'],
};

interface Def { properties?: Record<string, { const?: string }>; required?: string[] }
const defs = (schemas as { $defs: Record<string, Def> }).$defs;

/** The union's discriminator: a `kind` property pinned to a literal. A model
 *  with a free-form `kind` (InstitutionRef) keeps it as a normal field. */
const isDiscriminator = (d: Def) => typeof d.properties?.kind?.const === 'string';

test('the mirror covers exactly the models cards.py exports', () => {
  expect(Object.keys(REQUIRED).sort()).toEqual(Object.keys(defs).sort());
});

test.each(Object.keys(defs).sort())('%s required fields match cardShapes.ts', (name) => {
  expect([...(REQUIRED[name] ?? [])].sort()).toEqual([...(defs[name].required ?? [])].sort());
});

test.each(Object.keys(defs).sort())('%s full field set matches cardShapes.ts', (name) => {
  const def = defs[name];
  const schemaProps = Object.keys(def.properties ?? {})
    .filter((p) => !(p === 'kind' && isDiscriminator(def)));
  const tsProps = [...(REQUIRED[name] ?? []), ...(OPTIONAL[name] ?? [])];
  expect(tsProps.sort()).toEqual(schemaProps.sort());
});

test('every v5 card kind from the spec is in the union', () => {
  const kinds = Object.values(defs)
    .map((d) => d.properties?.kind?.const)
    .filter(Boolean);
  for (const k of [
    'receipt', 'spending', 'account', 'profile', 'help', 'card', 'statements',
    'recipients', 'bills', 'billers', 'telco_chips', 'pockets', 'request', 'requests', 'qr',
  ]) {
    expect(kinds).toContain(k);
  }
});

/** model name → the `kind` literal it is discriminated by. Restated here so a card
 *  kind that appears in, disappears from, or is RENAMED in cards.py fails this suite
 *  instead of slipping through: the per-model property tests above are keyed by model
 *  name, and a `kind` whose property set drifts would otherwise only be caught if the
 *  model name happened to change too. */
const CARD_KINDS: Record<string, string> = {
  ConfirmationCard: 'confirmation', SuccessCard: 'success', TransactionsCard: 'transactions',
  StatementCard: 'statement', InstitutionChipsCard: 'institution_chips', RecipientCard: 'recipient',
  RecipientChipsCard: 'recipient_chips', BillerChipsCard: 'biller_chips', SavePromptCard: 'save_prompt',
  BillCard: 'bill', PocketCard: 'pocket', BalanceCard: 'balance', ReceiptCard: 'receipt',
  SpendingCard: 'spending', AccountCard: 'account', ProfileCard: 'profile', HelpCard: 'help',
  CardCard: 'card', StatementsCard: 'statements', RecipientsCard: 'recipients', BillsCard: 'bills',
  BillersCard: 'billers', TelcoChipsCard: 'telco_chips', PocketsCard: 'pockets', RequestCard: 'request',
  RequestsCard: 'requests', QrCard: 'qr',
  CheckInCard: 'check_in', WaitingApprovalCard: 'waiting_approval', ApprovalsCard: 'approvals',
  DigestCard: 'digest', GuardianCard: 'guardian',
};

test('the snapshot discriminates exactly the kinds the mirror claims', () => {
  const fromSchema: Record<string, string> = {};
  for (const [name, def] of Object.entries(defs)) {
    if (isDiscriminator(def)) fromSchema[name] = def.properties!.kind!.const!;
  }
  expect(fromSchema).toEqual(CARD_KINDS);
});

test.each(Object.entries(CARD_KINDS))('kind %s (%s) has the property set cardShapes.ts declares', (name) => {
  const def = defs[name];
  expect(def).toBeDefined();
  const schemaProps = Object.keys(def.properties ?? {}).filter((p) => p !== 'kind');
  expect([...(REQUIRED[name] ?? []), ...(OPTIONAL[name] ?? [])].sort()).toEqual(schemaProps.sort());
});

test('every v6 card kind from the spec is in the union', () => {
  for (const k of ['check_in', 'waiting_approval', 'approvals', 'digest', 'guardian']) {
    expect(Object.values(CARD_KINDS)).toContain(k);
  }
});
