import React from 'react';
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  ViewStyle, TextStyle, StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { tokens } from '../theme/tokens';
import { formatPaisa } from '../lib/money';

export const useUrdu = () => {
  const { i18n } = useTranslation();
  return i18n.language === 'ur';
};

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{
      flex: 1, backgroundColor: tokens.color.bg,
      paddingTop: insets.top, paddingBottom: insets.bottom,
      paddingHorizontal: tokens.space.m,
    }, style]}>
      {children}
    </View>
  );
}

// Localized text: Nastaliq + RTL in Urdu, system font LTR in English.
export function T({ children, size = tokens.type.body, color = tokens.color.text, weight, style, center }: {
  children: React.ReactNode; size?: number; color?: string;
  weight?: TextStyle['fontWeight']; style?: StyleProp<TextStyle>; center?: boolean;
}) {
  const urdu = useUrdu();
  return (
    <Text style={[{
      color, fontSize: size,
      fontFamily: urdu ? tokens.type.urduFont : undefined,
      fontWeight: urdu ? undefined : weight,
      lineHeight: urdu ? size * tokens.type.urduLineHeightMult : size * 1.35,
      writingDirection: urdu ? 'rtl' : 'ltr',
      textAlign: center ? 'center' : urdu ? 'right' : 'left',
    }, style]}>
      {children}
    </Text>
  );
}

// Always-LTR text for numbers, refs, emails, amounts.
export function Mono({ children, size = tokens.type.body, color = tokens.color.text, weight = '600', style, center }: {
  children: React.ReactNode; size?: number; color?: string;
  weight?: TextStyle['fontWeight']; style?: StyleProp<TextStyle>; center?: boolean;
}) {
  return (
    <Text style={[{
      color, fontSize: size, fontWeight: weight, writingDirection: 'ltr',
      textAlign: center ? 'center' : 'left',
    }, style]}>
      {children}
    </Text>
  );
}

export function MoneyText({ paisa, size = tokens.type.money, color = tokens.color.text, center }: {
  paisa: number; size?: number; color?: string; center?: boolean;
}) {
  return <Mono size={size} weight="800" color={color} center={center}>{formatPaisa(paisa)}</Mono>;
}

export function PrimaryButton({ label, onPress, disabled, loading, danger, testID }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; danger?: boolean; testID?: string;
}) {
  const urdu = useUrdu();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        minHeight: tokens.touch.primary,
        borderRadius: tokens.radius.button,
        backgroundColor: danger ? tokens.color.danger : tokens.color.accent,
        opacity: disabled ? 0.4 : 1,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: tokens.space.l, paddingVertical: tokens.space.s,
      }}
    >
      {loading ? <ActivityIndicator color={tokens.color.bg} /> : (
        <Text style={{
          color: tokens.color.bg, fontSize: tokens.type.body + 2,
          fontFamily: urdu ? tokens.type.urduFont : undefined,
          fontWeight: urdu ? undefined : '700',
          lineHeight: urdu ? (tokens.type.body + 2) * 1.8 : undefined,
        }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{
      backgroundColor: tokens.color.surface, borderRadius: tokens.radius.card,
      padding: tokens.space.l,
    }, style]}>
      {children}
    </View>
  );
}

export function ListRow({ left, title, subtitle, right, onPress, testID }: {
  left?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode;
  right?: React.ReactNode; onPress?: () => void; testID?: string;
}) {
  const urdu = useUrdu();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: urdu ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.card,
        padding: tokens.space.m,
        marginBottom: tokens.space.s,
        minHeight: tokens.touch.primary,
        gap: tokens.space.m,
      }}
    >
      {left}
      <View style={{ flex: 1 }}>
        {typeof title === 'string' ? <T>{title}</T> : title}
        {subtitle ? (typeof subtitle === 'string' ? <T size={tokens.type.caption} color={tokens.color.textMuted}>{subtitle}</T> : subtitle) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput> & { rtl?: boolean }) {
  const { rtl, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={tokens.color.textMuted}
      style={[{
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.button,
        color: tokens.color.text,
        fontSize: tokens.type.body,
        minHeight: tokens.touch.primary,
        paddingHorizontal: tokens.space.m,
        textAlign: rtl ? 'right' : 'left',
      }, style]}
      {...rest}
    />
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={{
      backgroundColor: '#3A1B22', borderRadius: tokens.radius.button,
      padding: tokens.space.m, marginVertical: tokens.space.s,
    }}>
      <T color={tokens.color.danger} center>{message}</T>
    </View>
  );
}

export function Spacer({ h = tokens.space.m }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Row({ children, style, gap = tokens.space.s, rtlAware = true }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; rtlAware?: boolean;
}) {
  const urdu = useUrdu();
  return (
    <View style={[{
      flexDirection: rtlAware && urdu ? 'row-reverse' : 'row',
      alignItems: 'center', gap,
    }, style]}>
      {children}
    </View>
  );
}
