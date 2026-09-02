import React from 'react';
import { Text as RNText, TextStyle, StyleProp } from 'react-native';
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

type FontWeightKey = 400 | 500 | 600 | 700 | 800;

export interface TextProps {
  variant?: TextVariant;
  color?: string;
  /** Override the variant's default font weight (must match a loaded Plus Jakarta Sans cut). */
  weight?: FontWeightKey;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  numberOfLines?: number;
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
export function Text({ variant = 'body', color, weight, children, style, center, numberOfLines, testID }: TextProps) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const scale = type[variant];
  const resolvedColor = color ?? c[VARIANT_COLOR[variant] ?? 'ink'];
  const weightKey: FontWeightKey = weight ?? (Number(scale.fontWeight) as FontWeightKey);

  const textStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: urdu ? scale.fontSize * type.urduLineHeightMult : scale.lineHeight,
    fontWeight: urdu ? undefined : (String(weightKey) as TextStyle['fontWeight']),
    letterSpacing: urdu ? undefined : ('letterSpacing' in scale ? scale.letterSpacing : undefined),
    fontFamily: urdu ? type.urduFontFamily : type.fontFamily[weightKey],
    color: resolvedColor,
    textAlign: center ? 'center' : urdu ? 'right' : 'left',
    writingDirection: urdu ? 'rtl' : 'ltr',
    textTransform: variant === 'cap' ? 'uppercase' : undefined,
    fontVariant: variant === 'money' ? ['tabular-nums'] : undefined,
  };

  return (
    <RNText
      testID={testID}
      style={[textStyle, style]}
      numberOfLines={numberOfLines}
      allowFontScaling
      maxFontSizeMultiplier={type.maxFontSizeMultiplier}
    >
      {children}
    </RNText>
  );
}
