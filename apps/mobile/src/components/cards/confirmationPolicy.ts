// Pure chat-confirmation policy — the rules for when the PIN sheet opens by
// itself (F3.3) and what cards an executed action turns into. Kept out of
// CardView.tsx so they can be unit-tested without pulling in Reanimated and the
// rest of the native render stack.
import i18n from '../../i18n';
import type { RecipientSuggestion, BillerSuggestion, CardSummary } from '../../api/types';
import type { ChatCard } from '../../voice/useConverse';
import type { SavePromptCard as SavePromptCardShape, CardCard as CardCardShape } from './cardShapes';

// Action ids whose PIN sheet has already been auto-opened in THIS app session.
// Module-level, not component state: the card re-mounts on every FlatList
// recycle and on every re-render of its bubble, and re-opening a sheet the user
// just cancelled would trap them in it. Never cleared — an actionId is
// single-use server-side, so growth is bounded by the session's action count.
const autoOpenedActionIds = new Set<string>();

/** Exported for tests only — resets the once-per-action guard. */
export function resetAutoOpenGuard(): void {
  autoOpenedActionIds.clear();
}

/** Should this confirmation card open the PIN sheet by itself, right now?
 *  Pure so the rule is unit-testable without rendering. Note the ORDER matters:
 *  the guard set is only consulted (and never mutated) here — the caller records
 *  the id, exactly once, when this returns true. */
export function shouldAutoOpenPin(input: {
  /** cards.py defaults it to true, so `undefined` means "open". */
  autoOpenPin?: boolean;
  requiresPin: boolean;
  /** False only for a card rehydrated from persisted history. */
  live: boolean;
  /** The action already executed (e.g. this bubble scrolled back into view). */
  done: boolean;
  alreadyOpened: boolean;
}): boolean {
  if (!input.live) return false;
  if (input.autoOpenPin === false) return false;
  if (!input.requiresPin) return false;
  if (input.done) return false;
  if (input.alreadyOpened) return false;
  return true;
}

/** Consult shouldAutoOpenPin for `actionId` and, when it says yes, record the id
 *  so no later mount of the same card can open the sheet again. The single
 *  entry point CardView uses — keeping the check and the record together is what
 *  makes "once per actionId" hold across re-renders and FlatList recycling. */
export function claimAutoOpenPin(
  actionId: string,
  input: { autoOpenPin?: boolean; requiresPin: boolean; live: boolean; done: boolean },
): boolean {
  const open = shouldAutoOpenPin({ ...input, alreadyOpened: autoOpenedActionIds.has(actionId) });
  if (open) autoOpenedActionIds.add(actionId);
  return open;
}

/** Give the claim back, so this action may auto-open again.
 *
 *  The claim is recorded BEFORE openPinSheet resolves — it has to be, or a
 *  re-render during the await would open a second sheet. But openPinSheet can
 *  reject with 'busy' (a sheet is already open for a different action), in
 *  which case no sheet was ever shown for this card and the one auto-open it is
 *  owed has been silently spent. Releasing on that rejection leaves the card
 *  able to self-open on its next mount.
 *
 *  Deliberately NOT called on a 'cancelled' rejection: the user saw the sheet
 *  and dismissed it, so the auto-open happened and must not repeat — the card
 *  keeps its Confirm button for a retry. */
export function releaseAutoOpen(actionId: string): void {
  autoOpenedActionIds.delete(actionId);
}

// Builds the local success + (optional) save_prompt cards appended after a
// chat confirmation executes — shared by the PIN-sheet and no-PIN paths.
// save_prompt's `prompt` is required by the cards.py contract, so it's built
// here in both languages regardless of the current UI language.
export function buildResultCards(
  summary: { en: string; ur: string },
  result: { transaction: { refNo: string; amountPaisa: number } | null; card?: CardSummary },
  recipientSuggestion?: RecipientSuggestion,
  billerSuggestion?: BillerSuggestion,
): ChatCard[] {
  const { transaction, card } = result;
  // A PIN-gated action that moves no money (card_unfreeze) answers
  // { transaction: null, card } — a success card would have to invent an
  // amount, so show the card's new state instead.
  if (!transaction) {
    if (card) {
      const cardCard: CardCardShape = {
        kind: 'card',
        last4: card.last4,
        maskedPan: card.maskedPan,
        expiry: card.expiry,
        frozen: card.frozen,
        holder: card.holder ?? '',
      };
      return [cardCard as unknown as ChatCard];
    }
    return [];
  }
  const cards: ChatCard[] = [
    { kind: 'success', title: summary, refNo: transaction.refNo, amountPaisa: transaction.amountPaisa },
  ];
  if (recipientSuggestion && !recipientSuggestion.alreadySaved) {
    const savePrompt: SavePromptCardShape = {
      kind: 'save_prompt',
      target: 'recipient',
      institutionId: recipientSuggestion.institutionId,
      identifier: recipientSuggestion.identifier,
      title: recipientSuggestion.title,
      prompt: {
        en: i18n.t('save.recipientPrompt', { lng: 'en', name: recipientSuggestion.title }),
        ur: i18n.t('save.recipientPrompt', { lng: 'ur', name: recipientSuggestion.title }),
      },
    };
    cards.push(savePrompt as unknown as ChatCard);
  } else if (billerSuggestion && !billerSuggestion.alreadySaved) {
    const savePrompt: SavePromptCardShape = {
      kind: 'save_prompt',
      target: 'biller',
      billerId: billerSuggestion.billerId,
      consumerNo: billerSuggestion.consumerNo,
      consumerName: billerSuggestion.consumerName,
      prompt: {
        en: i18n.t('save.billerPrompt', { lng: 'en', name: billerSuggestion.consumerName }),
        ur: i18n.t('save.billerPrompt', { lng: 'ur', name: billerSuggestion.consumerName }),
      },
    };
    cards.push(savePrompt as unknown as ChatCard);
  }
  return cards;
}
