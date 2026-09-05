import { showBubbleText } from '../bubbleText';
import type { ChatCard } from '../useConverse';

const card = (kind: string) => ({ kind }) as ChatCard;

describe('showBubbleText (spec §6, card-only bubbles)', () => {
  test('an assistant turn with no cards shows its text', () => {
    expect(showBubbleText({ role: 'assistant', text: 'Your balance is ₨84,500.', cards: [] })).toBe(true);
  });

  test.each([
    'confirmation', 'success', 'balance', 'receipt', 'spending', 'card',
    'recipient_chips', 'institution_chips', 'biller_chips', 'telco_chips',
    'save_prompt', 'requests', 'qr', 'help',
  ])('an assistant turn carrying a %s card hides its text', (kind) => {
    expect(showBubbleText({ role: 'assistant', text: 'Here you go.', cards: [card(kind)] })).toBe(false);
  });

  test('several cards also hide the text', () => {
    expect(showBubbleText({
      role: 'assistant', text: 'Sent.', cards: [card('success'), card('save_prompt')],
    })).toBe(false);
  });

  test('a user bubble always shows its text', () => {
    expect(showBubbleText({ role: 'user', text: 'what is my balance', cards: [] })).toBe(true);
  });

  test('an error bubble always shows its text', () => {
    expect(showBubbleText({ role: 'error', text: 'Network error', cards: [] })).toBe(true);
    expect(showBubbleText({ role: 'error', text: 'Network error', cards: [card('balance')] })).toBe(true);
  });
});
