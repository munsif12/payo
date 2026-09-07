// Pure proactive-greeting logic (spec §1 C, §4). Deliberately free of
// lucide-react-native / RTK / expo imports so it can be unit-tested directly —
// same reason homeGreetingLogic.ts exists.
import i18n from '../i18n';
import { formatPaisa } from '../lib/money';
import { formatShortDate } from '../lib/dates';
import type { DigestItemDto } from '../api/types';
import type { Bilingual, DigestCard, DigestItem } from '../components/cards/cardShapes';

/** The AI service's `POST /speak` hard cap (SPEAK_MAX_CHARS in services/ai/app/main.py).
 *  Mirrored here so the app trims at a SENTENCE boundary before the service trims mid-word. */
export const SPEAK_MAX_CHARS = 200;

/** At most once every 4 hours (spec §1 rule 12). */
export const DIGEST_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** AsyncStorage key for the on-device "when did we last speak a digest" stamp.
 *  The server keeps its own `lastDigestAt` (which decides WHAT is in the digest);
 *  this one only decides WHETHER to ask, so a second device asking does not have
 *  to wait on a round-trip to find out it shouldn't have. */
export const LAST_DIGEST_STORAGE_KEY = 'payo.lastDigestAt';

/**
 * Should Home fetch (and speak) the digest right now?
 *
 * @param lastDigestAt epoch ms of the last digest this device spoke, or null/undefined
 *                     when it has never spoken one (or the stamp is unreadable/corrupt).
 * @param now          epoch ms.
 * @param enabled      `preferences.proactiveGreeting`. Off ⇒ never (spec §1 rule 13:
 *                     nothing financial is shown or spoken unprompted).
 */
export function shouldFetchDigest(
  lastDigestAt: number | null | undefined,
  now: number,
  enabled: boolean,
): boolean {
  if (!enabled) return false;
  if (lastDigestAt == null || !Number.isFinite(lastDigestAt)) return true;
  // A stamp in the future (clock moved back) must not lock the digest out for
  // hours — treat anything not at least an interval old as "too soon", and
  // anything ahead of now as "due" rather than silently waiting it out.
  if (lastDigestAt > now) return true;
  return now - lastDigestAt >= DIGEST_INTERVAL_MS;
}

/** The order the spoken summary counts things in — approvals first, because
 *  somebody is waiting on this user to act (spec §4). Mirrors the row order the
 *  backend already returns; kept explicit so the sentence never depends on it. */
const SPOKEN_KINDS: DigestItemDto['kind'][] = [
  'approval_waiting', 'received', 'bill_due', 'request', 'anomaly', 'guardian_notice',
];

/**
 * The ≤ 2-sentence spoken summary, built entirely on-device (no model turn) and
 * posted to the AI service's `POST /speak` (spec §4). Empty string for an empty
 * digest — the caller then speaks nothing at all.
 *
 * Sentence 1: what is waiting on the user (approvals, bills due, requests).
 * Sentence 2: what happened to their money (received, anomaly, guardian notice).
 * Either sentence is dropped when it has no clauses, so this is never 3 sentences.
 */
export function digestSpeech(items: DigestItemDto[], language: string): string {
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { lng: language, ...opts });
  const of = (kind: DigestItemDto['kind']) => items.filter((i) => i.kind === kind);
  const sum = (list: DigestItemDto[]) => list.reduce((n, i) => n + (i.amountPaisa ?? 0), 0);

  const waiting: string[] = [];
  const news: string[] = [];
  for (const kind of SPOKEN_KINDS) {
    const list = of(kind);
    if (!list.length) continue;
    switch (kind) {
      case 'approval_waiting':
        waiting.push(t('digest.speech.approvals', { count: list.length }));
        break;
      case 'bill_due':
        waiting.push(t('digest.speech.bills', { count: list.length, amount: formatPaisa(sum(list)) }));
        break;
      case 'request':
        waiting.push(t('digest.speech.requests', { count: list.length }));
        break;
      case 'received':
        news.push(t('digest.speech.received', { count: list.length, amount: formatPaisa(sum(list)) }));
        break;
      case 'anomaly':
        // The category is a backend enum ('bills', 'transfer', …) with no
        // translation table of its own — spoken verbatim, as the spending card does.
        news.push(t('digest.speech.anomaly', { category: list[0].category ?? '' }));
        break;
      case 'guardian_notice':
        news.push(t('digest.speech.guardianNotice', { count: list.length }));
        break;
    }
  }

  const join = (parts: string[]) =>
    parts.length <= 1 ? parts[0] ?? '' : `${parts.slice(0, -1).join(t('digest.speech.listSep'))}${t('digest.speech.listLast')}${parts[parts.length - 1]}`;

  const sentences: string[] = [];
  if (waiting.length) sentences.push(t('digest.speech.waitingSentence', { list: join(waiting) }));
  if (news.length) sentences.push(t('digest.speech.newsSentence', { list: join(news) }));
  return capSpeech(sentences.join(' '));
}

/** POST /speak trims at 200 characters server-side (it is billed per character), and a
 *  blind trim can cut a sentence — or a number — in half. Drop whole sentences from the
 *  end instead, and only fall back to a hard slice if even the first one is too long. */
export function capSpeech(text: string, max = SPEAK_MAX_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  // Keep the terminator with its sentence: split AFTER '.' or the Urdu '۔'.
  const parts = trimmed.split(/(?<=[.۔])\s+/);
  let out = '';
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length > max) break;
    out = next;
  }
  return out || trimmed.slice(0, max).trimEnd();
}

/** Both languages for one key — digest rows are card data, and a card carries a
 *  `Bilingual` for every string regardless of the current UI language. */
const bi = (key: string, opts?: Record<string, unknown>): Bilingual => ({
  en: i18n.t(key, { lng: 'en', ...opts }),
  ur: i18n.t(key, { lng: 'ur', ...opts }),
});

const refIdOf = (item: DigestItemDto) =>
  item.actionId ?? item.billId ?? item.requestId ?? item.noticeId ?? item.transactionId ?? item.category ?? null;

/**
 * GET /me/digest returns raw per-kind rows (a `received` carries `from`, a `bill_due`
 * carries `biller`, …); the `digest` CARD wants uniform bilingual rows. This is that
 * mapping — pure, so the wording is testable without rendering Home.
 *
 * Order is preserved exactly as the backend sent it (approvals first, spec §4).
 */
export function toDigestCard(items: DigestItemDto[]): DigestCard {
  return {
    kind: 'digest',
    items: items.map((item): DigestItem => {
      const refId = refIdOf(item);
      switch (item.kind) {
        case 'received':
          return {
            kind: item.kind, refId,
            title: bi('digest.row.received', { name: item.from?.name ?? '' }),
            amountPaisa: item.amountPaisa ?? null,
            intent: bi('digest.intent.received'),
          };
        case 'bill_due':
          return {
            kind: item.kind, refId,
            title: bi('digest.row.billDue', { biller: item.biller?.name ?? '' }),
            // formatShortDate is the SAME helper the suggestion card uses (homeGreetingLogic's
            // billSubtitle) — both must agree on the calendar day for the same ISO input, or
            // the digest row and the suggestion card can disagree by a day near a timezone edge.
            subtitle: item.dueDate ? bi('digest.row.billDueSub', { date: formatShortDate(item.dueDate) }) : null,
            amountPaisa: item.amountPaisa ?? null,
            intent: bi('digest.intent.billDue', { biller: item.biller?.name ?? '' }),
          };
        case 'approval_waiting':
          return {
            kind: item.kind, refId,
            title: bi('digest.row.approval', { name: item.payer?.name ?? '' }),
            // The action's own summary is already bilingual — reuse it verbatim
            // rather than rebuilding a sentence the payer's app already worded.
            subtitle: item.summary ?? null,
            amountPaisa: item.amountPaisa ?? null,
            intent: bi('digest.intent.approvals'),
          };
        case 'request':
          return {
            kind: item.kind, refId,
            title: bi('digest.row.request', { name: item.from?.name ?? '' }),
            subtitle: item.note ? { en: item.note, ur: item.note } : null,
            amountPaisa: item.amountPaisa ?? null,
            intent: bi('digest.intent.requests'),
          };
        case 'anomaly':
          return {
            kind: item.kind, refId,
            title: bi('digest.row.anomaly', { category: item.category ?? '' }),
            subtitle: bi('digest.row.anomalySub', { average: formatPaisa(item.averagePaisa ?? 0) }),
            amountPaisa: item.thisMonthPaisa ?? null,
            intent: bi('digest.intent.spending'),
          };
        case 'guardian_notice': {
          // Branch per change, never a two-way fallback: a `remove` or a `replace`
          // carries no ceiling, so the old "else = raise" arm printed "₨0" for them.
          // A `reminder` is not a loosening at all — it is the payer nudging their
          // guardian — and gets its own row and its own one-tap intent.
          const name = item.payer?.name ?? '';
          const subtitleKey = item.change === 'remove' ? 'digest.row.noticeRemove'
            : item.change === 'replace' ? 'digest.row.noticeReplace'
              : item.change === 'reminder' ? 'digest.row.noticeReminder'
                : 'digest.row.noticeRaise';
          return {
            kind: item.kind, refId,
            title: bi(item.change === 'reminder' ? 'digest.row.noticeNudge' : 'digest.row.notice', { name }),
            subtitle: item.change === 'raise'
              ? bi(subtitleKey, { amount: formatPaisa(item.ceilingPaisa ?? 0) })
              : bi(subtitleKey, { name }),
            intent: bi(item.change === 'reminder' ? 'digest.intent.approvals' : 'digest.intent.guardian'),
          };
        }
        default:
          return { kind: item.kind, refId, title: bi('digest.row.other') };
      }
    }),
  };
}
