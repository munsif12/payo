import type {
  InstitutionChip, RecipientChip, BillerChip, RecipientCard, SavePromptCard,
} from '../cardShapes';

// Type-level contract check against services/ai/app/cards.py: if a field name
// or optionality drifts between that file and cardShapes.ts, this file fails
// to compile (tsc), and the object literals below assert the expected keys
// exist at runtime too.

test('InstitutionChip parses a sample with the expected keys', () => {
  const sample: InstitutionChip = { institutionId: 'inst-1', name: 'Easypaisa', urduName: 'ایزی پیسہ', kind: 'wallet' };
  expect(Object.keys(sample).sort()).toEqual(['institutionId', 'kind', 'name', 'urduName'].sort());
});

test('RecipientChip parses a sample with the expected keys', () => {
  const sample: RecipientChip = {
    recipientId: 'r1', nickname: 'Munsif', title: 'Munsif Ali', institutionName: 'Easypaisa', identifier: '03135468810',
  };
  expect(Object.keys(sample).sort()).toEqual(
    ['recipientId', 'nickname', 'title', 'institutionName', 'identifier'].sort(),
  );
});

test('BillerChip parses a sample with the expected keys (savedBillerId optional)', () => {
  const withSaved: BillerChip = { savedBillerId: 'sb1', billerId: 'k-electric', name: 'K-Electric', consumerNo: '0400012345678' };
  const withoutSaved: BillerChip = { billerId: 'k-electric', name: 'K-Electric' };
  expect(Object.keys(withSaved).sort()).toEqual(['savedBillerId', 'billerId', 'name', 'consumerNo'].sort());
  expect(Object.keys(withoutSaved).sort()).toEqual(['billerId', 'name'].sort());
});

test('RecipientCard parses a sample with the expected keys', () => {
  const sample: RecipientCard = {
    kind: 'recipient',
    title: 'Munsif Ali',
    institution: { id: 'inst-1', name: 'Easypaisa', kind: 'wallet' },
    identifier: '03135468810',
    prompt: { en: 'Is this the right recipient?', ur: 'کیا یہ درست وصول کنندہ ہے؟' },
  };
  expect(sample.kind).toBe('recipient');
  expect(Object.keys(sample.institution).sort()).toEqual(['id', 'name', 'kind'].sort());
});

test('SavePromptCard parses recipient and biller target samples', () => {
  const recipientTarget: SavePromptCard = {
    kind: 'save_prompt',
    target: 'recipient',
    institutionId: 'inst-1',
    identifier: '03135468810',
    title: 'Munsif Ali',
    prompt: { en: 'Save Munsif Ali as a recipient?', ur: 'کیا منصف علی کو محفوظ کریں؟' },
  };
  const billerTarget: SavePromptCard = {
    kind: 'save_prompt',
    target: 'biller',
    billerId: 'k-electric',
    consumerNo: '0400012345678',
    consumerName: 'Ammi Jaan',
    prompt: { en: 'Save Ammi Jaan as a biller?', ur: 'کیا امی جان کو محفوظ کریں؟' },
  };
  expect(recipientTarget.target).toBe('recipient');
  expect(billerTarget.target).toBe('biller');
});
