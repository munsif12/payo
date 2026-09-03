import { Institution, User } from '../models';
import { ApiError } from './apiError';
import { resolveFakeTitle } from './fakeTitles';

const PHONE_LOCAL_RE = /^0\d{10}$/;
const PHONE_INTL_RE = /^\+92\d{10}$/;
const PHONE_92_NO_PLUS_RE = /^92\d{10}$/;
const PHONE_SHORT_RE = /^3\d{9}$/;
const IBAN_RE = /^PK\d{2}[A-Z]{4}\d{16}$/;
const ACCOUNT_RE = /^\d{10,16}$/;

/**
 * Accepts `+92xxxxxxxxxx`, `92xxxxxxxxxx`, `03xxxxxxxxx`, or `3xxxxxxxxx` (10 digits) and
 * normalises all four to the canonical `+92xxxxxxxxxx` — so the same number always
 * resolves/dedupes to one identifier regardless of how it was typed. null if none match.
 */
export function normalizePhone(identifier: string): string | null {
  if (PHONE_INTL_RE.test(identifier)) return identifier;
  if (PHONE_92_NO_PLUS_RE.test(identifier)) return `+${identifier}`;
  if (PHONE_LOCAL_RE.test(identifier)) return `+92${identifier.slice(1)}`;
  if (PHONE_SHORT_RE.test(identifier)) return `+92${identifier}`;
  return null;
}

/** `****` + last 4 chars, used in counterparty detail lines. */
export function maskIdentifier(identifier: string): string {
  if (identifier.length <= 4) return identifier;
  return `****${identifier.slice(-4)}`;
}

export interface InstitutionDto { id: string; name: string; urduName: string; kind: 'wallet' | 'bank' }

export interface ResolvedRecipient {
  title: string;
  institution: InstitutionDto;
  identifier: string;
  linkedUserId?: string;
}

/**
 * Resolves an institution + raw identifier into a display title (and, for a PAYO wallet
 * send, the real linked user). Shared by POST /transfers/resolve and POST /transfers
 * (which re-resolves server-side rather than trusting a client-supplied title).
 */
export async function resolveRecipient(
  institutionId: string, identifier: string, callerUserId: string,
): Promise<ResolvedRecipient> {
  const institution = await Institution.findById(institutionId).catch(() => null);
  if (!institution) throw new ApiError(404, 'NOT_FOUND', 'Institution not found');
  const institutionDto: InstitutionDto = {
    id: String(institution._id), name: institution.name, urduName: institution.urduName,
    kind: institution.kind as 'wallet' | 'bank',
  };

  if (institution.kind === 'wallet') {
    const phone = normalizePhone(identifier);
    if (!phone) throw new ApiError(400, 'INVALID_IDENTIFIER', 'Invalid phone number');
    if (institution.code === 'PAYO') {
      const recipient = await User.findOne({ phone });
      if (!recipient) throw new ApiError(404, 'RECIPIENT_NOT_FOUND', 'No PAYO user with that phone');
      if (String(recipient._id) === callerUserId) throw new ApiError(400, 'SELF_TRANSFER', 'Cannot send money to yourself');
      return { title: recipient.name, institution: institutionDto, identifier: phone, linkedUserId: String(recipient._id) };
    }
    return { title: resolveFakeTitle(phone), institution: institutionDto, identifier: phone };
  }

  if (IBAN_RE.test(identifier) || ACCOUNT_RE.test(identifier))
    return { title: resolveFakeTitle(identifier), institution: institutionDto, identifier };
  throw new ApiError(400, 'INVALID_IDENTIFIER', 'Invalid IBAN or account number');
}
