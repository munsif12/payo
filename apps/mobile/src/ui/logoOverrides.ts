// Bundled logo overrides + the pure decision helper behind `InstitutionLogo`.
//
// Deliberately free of react / expo-image imports so the rule can be unit-tested
// on its own — same reason confirmationPolicy.ts sits beside CardView.tsx.

/** What `require('…png')` evaluates to under Metro (an opaque asset handle) and
 *  under jest-expo (an object). Never inspected — only handed to <Image />. */
export type LogoModule = number | object;

/** code (lowercase, trimmed) → bundled asset. See assets/logos/README.md for the
 *  naming rule; entries are added by hand because the bundler cannot build a
 *  `require()` path at runtime. Intentionally empty until a provider's hosted
 *  mark actually needs overriding. */
export type LogoOverrides = Record<string, LogoModule>;

export const LOGO_OVERRIDES: LogoOverrides = {};

export type LogoSource =
  | { kind: 'local'; module: LogoModule }
  | { kind: 'remote'; uri: string };

/**
 * Which image (if any) should stand in for an institution / biller mark?
 *
 * Order matters: a BUNDLED override always wins over the backend's `logoUrl`.
 * That is the whole point of the override — it exists precisely for the cases
 * where the hosted mark is wrong, missing or ugly, so a later backend change
 * must not silently take the override's place.
 *
 * `null` means "there is nothing to show" and the caller falls back to the
 * initials Avatar — the same fallback used when a remote image fails to load.
 */
export function pickLogoSource(
  overrides: LogoOverrides,
  code: string | null | undefined,
  logoUrl: string | null | undefined,
): LogoSource | null {
  const key = typeof code === 'string' ? code.trim().toLowerCase() : '';
  if (key) {
    // `in` rather than a truthiness check: a bundled asset handle is a NUMBER
    // under Metro, and asset id 0 is a legitimate handle.
    const local = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : undefined;
    if (local != null) return { kind: 'local', module: local };
  }
  const uri = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  if (uri) return { kind: 'remote', uri };
  return null;
}
