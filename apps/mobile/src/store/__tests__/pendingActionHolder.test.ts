import { holdAction, takeAction, markActionDone, isActionDone } from '../pendingActionHolder';

const action = { id: 'a1', kind: 'send_money', amountPaisa: 100, feePaisa: 0, summary: { en: 'x', ur: 'x' }, lines: [], requiresPin: true, expiresAt: '', status: 'pending' } as never;

test('hand-off returns the held action only for its own id', () => {
  holdAction(action);
  expect(takeAction('a1')).toBe(action);
  expect(takeAction('other')).toBeNull();
});

test('executed actions are remembered as done', () => {
  expect(isActionDone('a1')).toBe(false);
  markActionDone('a1');
  expect(isActionDone('a1')).toBe(true);
  expect(isActionDone('a2')).toBe(false);
});
