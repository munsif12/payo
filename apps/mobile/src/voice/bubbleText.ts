import type { ChatMessage } from './useConverse';

/** Should an assistant bubble show its `text` alongside its cards?
 *
 *  Spec §6 "Card-only bubbles": when the assistant answers with at least one
 *  card, the card IS the answer — the sentence beside it just repeats what the
 *  card already shows. The text stays in `messages` and is still what gets
 *  spoken (TTS reads the turn, not the bubble), so this is a rendering rule
 *  only: nothing in useConverse or the voice loop changes.
 *
 *  The user's own bubbles and error bubbles always show their text — a user
 *  bubble never carries cards, and an error's message is the whole point. */
export function showBubbleText(message: Pick<ChatMessage, 'role' | 'text' | 'cards'>): boolean {
  if (message.role !== 'assistant') return true;
  return message.cards.length === 0;
}
