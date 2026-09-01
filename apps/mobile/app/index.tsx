import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { tokens } from '../src/theme/tokens';

const SUGGESTIONS = [
  { key: 'home.suggestions.payBill', emoji: '🧾' },
  { key: 'home.suggestions.sendMoney', emoji: '💸' },
  { key: 'home.suggestions.statement', emoji: '📄' },
  { key: 'home.suggestions.savings', emoji: '🐖' },
] as const;

export default function VoiceHome() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg, alignItems: 'center', justifyContent: 'center', padding: tokens.space.l }}>
      <Text style={{ color: tokens.color.accent, fontSize: tokens.type.h1, fontWeight: '800', letterSpacing: 4, marginBottom: tokens.space.xxl }}>
        {t('appName')}
      </Text>

      <Pressable
        style={({ pressed }) => ({
          width: 96, height: 96, borderRadius: 48,
          backgroundColor: pressed ? tokens.color.accentPressed : tokens.color.accent,
          alignItems: 'center', justifyContent: 'center',
        })}
      >
        <Text style={{ fontSize: 40 }}>🎙️</Text>
      </Pressable>

      <Text
        style={{
          color: tokens.color.text, fontSize: tokens.type.body,
          fontFamily: tokens.type.urduFont,
          lineHeight: tokens.type.body * tokens.type.urduLineHeightMult,
          marginTop: tokens.space.l, marginBottom: tokens.space.xl,
          writingDirection: 'rtl', textAlign: 'center',
        }}
      >
        {t('home.tapToSpeak')}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: tokens.space.m }}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s.key}
            style={{
              width: '45%', minHeight: tokens.touch.primary,
              backgroundColor: tokens.color.surface, borderRadius: tokens.radius.card,
              alignItems: 'center', justifyContent: 'center', padding: tokens.space.m,
            }}
          >
            <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
            <Text
              style={{
                color: tokens.color.text, fontSize: tokens.type.body,
                fontFamily: tokens.type.urduFont,
                lineHeight: tokens.type.body * tokens.type.urduLineHeightMult,
                writingDirection: 'rtl', textAlign: 'center',
              }}
            >
              {t(s.key)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
