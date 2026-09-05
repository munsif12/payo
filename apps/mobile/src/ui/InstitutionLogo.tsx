import React, { useEffect, useState } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../theme/useTheme';
import { Avatar } from './Avatar';
import { LOGO_OVERRIDES, pickLogoSource, type LogoOverrides } from './logoOverrides';

export { pickLogoSource } from './logoOverrides';
export type { LogoOverrides, LogoSource, LogoModule } from './logoOverrides';

/** The three sizes the design uses: a chip/row mark (24), a list mark (32) and a
 *  card-header mark (40). Not free-form — a fourth size would be a design change. */
export type InstitutionLogoSize = 24 | 32 | 40;

export interface InstitutionLogoProps {
  /** The provider's hosted mark. A bundled override for `code` still wins. */
  logoUrl?: string | null;
  /** Institution / biller code — the key into assets/logos (see its README). */
  code?: string | null;
  /** Used for the initials fallback, and as the accessibility label. */
  name: string;
  size: InstitutionLogoSize;
  shape: 'circle' | 'rounded';
  /** Test seam: the bundled-override map to consult. Defaults to LOGO_OVERRIDES. */
  overrides?: LogoOverrides;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * An institution / wallet / biller mark, with the initials Avatar as its floor.
 *
 * The component is deliberately small and dumb: `pickLogoSource` owns the rule
 * (bundled override ▸ hosted url ▸ nothing) and everything else here is the
 * render plus the one piece of state that rule cannot express — a url that
 * RESOLVED to an image and then failed to load. That failure can only be known
 * at runtime, so it collapses to the same Avatar the "no url at all" case uses:
 * a name always renders as something, never as a grey hole.
 *
 * Not a touch target itself. Callers put it inside a row/chip that already
 * carries the ≥44pt target, which is why 24/32/40 are the only sizes.
 */
export function InstitutionLogo({
  logoUrl, code, name, size, shape, overrides = LOGO_OVERRIDES, style, testID,
}: InstitutionLogoProps) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const source = pickLogoSource(overrides, code, logoUrl);
  const remoteUri = source?.kind === 'remote' ? source.uri : null;

  // A recycled row can be handed a different institution without unmounting —
  // a previous url's failure must not blank out the new one's logo.
  useEffect(() => { setFailed(false); }, [remoteUri, code]);

  if (!source || failed) {
    return <Avatar name={name} size={size} style={style} />;
  }

  const br = shape === 'circle' ? size / 2 : Math.round(size / 4);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        {
          width: size,
          height: size,
          borderRadius: br,
          backgroundColor: c.surface2,
          overflow: 'hidden',
          flexShrink: 0,
          // Square and centred — nothing here mirrors, so it is RTL-safe as-is.
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={source.kind === 'local' ? source.module : { uri: source.uri }}
        style={{ width: size, height: size, borderRadius: br }}
        contentFit="contain"
        // Keyed by url so two rows showing the same institution share one entry
        // rather than re-fetching per row (and per FlatList recycle).
        cachePolicy="memory-disk"
        recyclingKey={source.kind === 'remote' ? source.uri : String(code ?? name)}
        transition={0}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
