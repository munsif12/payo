// What PAYO says out loud once a PIN has been accepted (F2).
//
// Until now the app went silent at exactly the moment the user most wants to
// hear something: the sheet closes, cards appear, and nothing is spoken because
// no /converse turn ever ran. This composes that sentence on-device — no model
// call — for the caller to post to POST /speak, the same path the Home digest
// already uses.
//
// Pure on purpose: no expo, no redux, no fetch. Every wording rule is testable
// without a device.
import i18n from '../i18n';
import { capSpeech } from '../home/digestLogic';
import { urduNumberWords } from './urduNumberWords';
import type { PinSheetResolution } from '../pin/usePinSheet';

/** The bits of a `PendingAction` this needs. A real PendingAction satisfies it;
 *  the guardian inbox passes the same object plus `payerName`. */
export interface OutcomeAction {
  kind: string;
  amountPaisa?: number;
  /** `guardian_approval` only: whose send was just approved. */
  payerName?: string;
}

/** Whole rupees spoken as words in Urdu, grouped digits in English.
 *  A part-rupee amount keeps its digits in BOTH languages: the Urdu table only
 *  covers whole rupees, and "two thousand five hundred fifty point seven five"
 *  is not how anyone says it. */
function spokenAmount(amountPaisa: number, language: string): string {
  const urdu = language === 'ur';
  const whole = amountPaisa % 100 === 0;
  const rupees = amountPaisa / 100;

  let amount: string;
  if (urdu) {
    amount = (whole ? urduNumberWords(rupees) : null) ?? String(rupees);
  } else {
    amount = rupees.toLocaleString('en-PK', {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
  }
  return i18n.t('outcome.amountRupees', { lng: language, amount });
}

/**
 * The ≤ 2-sentence sentence spoken after the PIN sheet resolves. Empty string
 * when there is nothing worth saying — the caller then speaks nothing at all
 * rather than posting an empty TTS request.
 *
 * The kind is read off the EXECUTED TRANSACTION, not off `action.kind`: a chat
 * confirmation is created with `kind: 'ai'` regardless of what it does, so the
 * transaction's own type ('bill', 'pocket_deposit', …) is the only honest
 * discriminator. `action.kind` is consulted only for the two outcomes that
 * produce no transaction at all — a card action and a guardian approval.
 */
export function outcomeSpeech(
  resolution: PinSheetResolution,
  action: OutcomeAction,
  language: string,
): string {
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { lng: language, ...opts });
  const txn = resolution.transaction;

  if (!txn) {
    // Approving somebody else's send: it is NOT paid yet — the payer still has
    // to type their own PIN — so the sentence must not claim money moved.
    // No gendered pronoun: "Ammi can enter the PIN now", never "her PIN".
    if (action.kind === 'guardian_approval') {
      return capSpeech(action.payerName
        ? t('outcome.approved', { name: action.payerName })
        : t('outcome.approvedNoName'));
    }
    // A PIN-gated action that moves no money answers with the card's new state.
    if (resolution.card) {
      return capSpeech(resolution.card.frozen ? t('outcome.cardFrozen') : t('outcome.cardActive'));
    }
    return '';
  }

  const amount = spokenAmount(txn.amountPaisa, language);
  const name = (language === 'ur' && txn.counterparty.urduName) || txn.counterparty.name || '';

  switch (txn.type) {
    case 'bill':
      return capSpeech(t('outcome.bill', { name, amount }));
    case 'recharge':
      return capSpeech(t('outcome.recharge', { name, amount }));
    case 'pocket_deposit':
      return capSpeech(t('outcome.pocketDeposit', { name, amount }));
    case 'pocket_withdraw':
      return capSpeech(t('outcome.pocketWithdraw', { name, amount }));
    case 'request_settlement':
      return capSpeech(t('outcome.requestSettled', { name, amount }));
    default: {
      // p2p / bank_transfer / anything a newer backend adds: a send. The
      // reference is its own short sentence so the first one stays speakable,
      // and it is dropped entirely when the backend sent no refNo.
      const sent = t('outcome.send', { name, amount });
      const ref = txn.refNo ? t('outcome.reference', { ref: txn.refNo }) : '';
      return capSpeech(ref ? `${sent} ${ref}` : sent);
    }
  }
}
