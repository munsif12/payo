import { useMemo } from 'react';
import { useRecipientsQuery } from '../api/client';
import type { RecipientDto } from '../api/types';

/** How many people the Home family row shows (Direction A artboard: four tiles). */
export const FAMILY_ROW_MAX = 4;

/**
 * The people on the Home family row. Saved recipients arrive most-recently-used
 * first, so the row is "who you pay" — the seeded family (Abbu, Bilal, Sara) on a
 * fresh world, and whoever the user saved most recently after that. Pure, so the
 * slice rule is testable without RTK Query.
 */
export function pickFamily(items: RecipientDto[] | undefined, max = FAMILY_ROW_MAX): RecipientDto[] {
  if (!items?.length) return [];
  return items.slice(0, max);
}

export function useFamily(): RecipientDto[] {
  const { data } = useRecipientsQuery();
  return useMemo(() => pickFamily(data?.items), [data]);
}
