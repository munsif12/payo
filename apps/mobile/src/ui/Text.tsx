import React from 'react';
import { Text as RNText, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/useTheme';
import { type, type Palette } from '../theme/tokens';

export type TextVariant = 'money' | 'h1' | 'h2' | 'hl' | 'body' | 'sub' | 'foot' | 'cap';

const VARIANT_COLOR: Partial<Record<TextVariant, keyof Palette>> = {
  sub: 'ink2',
  foot: 'ink3',
  cap: 'ink3',
};

export function useIsUrdu() {
  const { i18n } = useTranslation();
  return i18n.language === 'ur';
}

/** Money/numeric text must always read left-to-right, even in an Urdu (RTL)
 * screen — mixing an RTL paragraph direction with digit groups and currency
 * symbols causes the bidi algorithm to reorder them (e.g. "₨84,500" can come
 * out mirrored). Every other variant follows the language direction. Kept
 * pure/exported so it's unit-testable without rendering. */
export function textDirectionFor(variant: TextVariant, urdu: boolean): 'ltr' | 'rtl' {
  if (variant === 'money') return 'ltr';
  return urdu ? 'rtl' : 'ltr';
}

type FontWeightKey = 400 | 500 | 600 | 700 | 800;

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** The plain text inside `children`, for the script check; elements contribute nothing. */
function childrenText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(childrenText).join('');
  return '';
}

/**
 * v8 (Urdu QA): a string with no Arabic-script letters at all — "₨2,000", "2000",
 * "PAYO-96XSZXJ36G" — is set in Plus Jakarta Sans even on an Urdu screen. Nastaliq
 * has no Latin glyphs or tabular figures, so such strings fell back to a system face
 * with Nastaliq's tall metrics and came out clipped and mismatched (live: the
 * confirmation amount lost the top of its digits). Pure, exported for the unit test.
 */
export function isLatinOnly(text: string): boolean {
  return text.length > 0 && !ARABIC_SCRIPT_RE.test(text);
}

/**
 * Nastaliq needs ~1.9× line height or the dots above ف / ق / ت are cut off. Callers
 * that pass an explicit (Latin) `lineHeight` in `style` used to override the Urdu one;
 * now the Urdu minimum wins (live: «فیس ₨0 · کل رقم» read as «سیس ۰ · ل رم»).
 */
export function urduLineHeight(fontSize: number, requested: number | undefined): number {
  return Math.max(requested ?? 0, fontSize * type.urduLineHeightMult);
}

export interface TextProps {
  variant?: TextVariant;
  color?: string;
  /** Override the variant's default font weight (must match a loaded Plus Jakarta Sans cut). */
  weight?: FontWeightKey;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  numberOfLines?: number;
  /** Shrink the text (down to `minimumFontScale`) rather than wrap or clip it.
   *  Only meaningful together with `numberOfLines`. */
  adjustsFontSizeToFit?: boolean;
  testID?: string;
}

// Text variants per Foundations.dc.html: money 40/48/800 tabular, h1 28/34/800,
// h2 22/28/700, headline(hl) 17/22/600, body 17/24/400, sub 15/20/500,
// foot 13/18/500, cap 12/16/600 caps. Urdu switches to Noto Nastaliq Urdu with
// line-height x1.9 and RTL. Respects Dynamic Type up to 1.6x.
//
// Note: fontFamily and fontWeight are always set together to a matching pair
// (e.g. PlusJakartaSans_700Bold + '700') — mixing a custom fontFamily with an
// unrelated fontWeight makes iOS silently substitute a system font.
export function Text({ variant = 'body', color, weight, children, style, center, numberOfLines, adjustsFontSizeToFit, testID }: TextProps) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const scale = type[variant];
  const resolvedColor = color ?? c[VARIANT_COLOR[variant] ?? 'ink'];
  const weightKey: FontWeightKey = weight ?? (Number(scale.fontWeight) as FontWeightKey);
  // Urdu face only for text that actually carries Urdu letters (see isLatinOnly).
  const urduFace = urdu && !isLatinOnly(childrenText(children));

  const textStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: urduFace ? scale.fontSize * type.urduLineHeightMult : scale.lineHeight,
    fontWeight: urduFace ? undefined : (String(weightKey) as TextStyle['fontWeight']),
    letterSpacing: urduFace ? undefined : ('letterSpacing' in scale ? scale.letterSpacing : undefined),
    fontFamily: urduFace ? type.urduFontFamily : type.fontFamily[weightKey],
    color: resolvedColor,
    textAlign: center ? 'center' : urdu ? 'right' : 'left',
    writingDirection: urduFace ? textDirectionFor(variant, urdu) : 'ltr',
    textTransform: variant === 'cap' ? 'uppercase' : undefined,
    fontVariant: variant === 'money' ? ['tabular-nums'] : undefined,
  };

  // The caller's style wins — except that Nastaliq keeps its minimum line height.
  const merged = StyleSheet.flatten([textStyle, style]) as TextStyle;
  if (urduFace) {
    merged.lineHeight = urduLineHeight(merged.fontSize ?? scale.fontSize, merged.lineHeight);
  }

  return (
    <RNText
      testID={testID}
      style={merged}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={adjustsFontSizeToFit ? 0.8 : undefined}
      allowFontScaling
      maxFontSizeMultiplier={type.maxFontSizeMultiplier}
    >
      {children}
    </RNText>
  );
}
