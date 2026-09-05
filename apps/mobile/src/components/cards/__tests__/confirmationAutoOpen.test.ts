import {
  shouldAutoOpenPin, claimAutoOpenPin, releaseAutoOpen, buildResultCards, resetAutoOpenGuard,
  showConfirmationAmount,
} from '../confirmationPolicy';

const base = { requiresPin: true, live: true, done: false, alreadyOpened: false };

describe('shouldAutoOpenPin (F3.3)', () => {
  test('opens when autoOpenPin is undefined — cards.py defaults it to true', () => {
    expect(shouldAutoOpenPin({ ...base })).toBe(true);
  });

  test('opens when autoOpenPin is explicitly true', () => {
    expect(shouldAutoOpenPin({ ...base, autoOpenPin: true })).toBe(true);
  });

  test('does not open when autoOpenPin is false', () => {
    expect(shouldAutoOpenPin({ ...base, autoOpenPin: false })).toBe(false);
  });

  test('does not open twice for the same action', () => {
    expect(shouldAutoOpenPin({ ...base, alreadyOpened: true })).toBe(false);
  });

  test('does not open for a card restored from persisted history', () => {
    expect(shouldAutoOpenPin({ ...base, live: false })).toBe(false);
  });

  test('does not open for an action that needs no PIN', () => {
    expect(shouldAutoOpenPin({ ...base, requiresPin: false })).toBe(false);
  });

  test('does not open for an action that already executed', () => {
    expect(shouldAutoOpenPin({ ...base, done: true })).toBe(false);
  });
});

describe('claimAutoOpenPin (the once-per-actionId guard)', () => {
  beforeEach(() => resetAutoOpenGuard());

  test('opens once, then never again for the same action', () => {
    const input = { requiresPin: true, live: true, done: false };
    expect(claimAutoOpenPin('a-1', input)).toBe(true);
    expect(claimAutoOpenPin('a-1', input)).toBe(false);
    expect(claimAutoOpenPin('a-1', input)).toBe(false);
  });

  test('a different action still opens', () => {
    const input = { requiresPin: true, live: true, done: false };
    expect(claimAutoOpenPin('a-1', input)).toBe(true);
    expect(claimAutoOpenPin('a-2', input)).toBe(true);
  });

  test('release hands the claim back — claim, release, claim again opens', () => {
    const input = { requiresPin: true, live: true, done: false };
    expect(claimAutoOpenPin('a-busy', input)).toBe(true);
    releaseAutoOpen('a-busy');
    expect(claimAutoOpenPin('a-busy', input)).toBe(true);
  });

  test('without a release the claim stays spent — claim, claim again refuses', () => {
    const input = { requiresPin: true, live: true, done: false };
    expect(claimAutoOpenPin('a-kept', input)).toBe(true);
    expect(claimAutoOpenPin('a-kept', input)).toBe(false);
  });

  test('releasing one action does not release another', () => {
    const input = { requiresPin: true, live: true, done: false };
    claimAutoOpenPin('a-x', input);
    claimAutoOpenPin('a-y', input);
    releaseAutoOpen('a-x');
    expect(claimAutoOpenPin('a-x', input)).toBe(true);
    expect(claimAutoOpenPin('a-y', input)).toBe(false);
  });

  test('a refused card is not recorded — it must stay refusable, not become "already opened"', () => {
    expect(claimAutoOpenPin('a-3', { requiresPin: true, live: false, done: false })).toBe(false);
    // Same card arriving live later (e.g. history replaced by a live turn) still opens.
    expect(claimAutoOpenPin('a-3', { requiresPin: true, live: true, done: false })).toBe(true);
  });
});

describe('showConfirmationAmount (non-money actions)', () => {
  test('hides the money line for a zero-amount action (card_unfreeze)', () => {
    expect(showConfirmationAmount(0)).toBe(false);
  });

  test('shows the money line for any real amount', () => {
    expect(showConfirmationAmount(1)).toBe(true);
    expect(showConfirmationAmount(50000)).toBe(true);
  });

  test('a negative amount is still shown — that is a bug worth seeing, not one to hide', () => {
    expect(showConfirmationAmount(-100)).toBe(true);
  });
});

describe('buildResultCards with a null transaction (F3.3)', () => {
  const summary = { en: 'Unfreeze card', ur: 'کارڈ کھولیں' };

  test('card_unfreeze renders a card card, never a success card with an amount', () => {
    const cards = buildResultCards(summary, {
      transaction: null,
      card: { id: 'c1', last4: '4242', maskedPan: '•••• •••• •••• 4242', expiry: '09/29', frozen: false, holder: 'AMMI JAAN' },
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('card');
    expect(cards[0]).not.toHaveProperty('amountPaisa');
    expect(cards[0]).toMatchObject({ last4: '4242', frozen: false, holder: 'AMMI JAAN' });
  });

  test('a null transaction with no card yields no cards rather than an empty success', () => {
    expect(buildResultCards(summary, { transaction: null })).toEqual([]);
  });

  test('a money transaction still yields the success card', () => {
    const cards = buildResultCards(summary, { transaction: { refNo: 'PY-1', amountPaisa: 50000 } });
    expect(cards[0]).toMatchObject({ kind: 'success', refNo: 'PY-1', amountPaisa: 50000 });
  });
});
