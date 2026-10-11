import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Card, Avatar, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, radius, touch, glassTokens } from '../src/theme/tokens';
import type { RootState } from '../src/store';
import { ltrIsolate } from '../src/lib/bidi';
import i18n, { applyLanguage } from '../src/i18n';

/** B24: a 96 pt cream avatar on the profile card. */
const PROFILE_AVATAR = 96;
/** B24: the two language chips are 56 pt pills. */
const LANG_CHIP_HEIGHT = 56;

// Profile — GLASS-SPEC §5 B24. Glass back button + title, the centred profile
// card (cream avatar, name, the other-script name, phone), the LANGUAGE pair
// of chips (selected = amber) and a read-only NAME card. The language switch
// goes through applyLanguage exactly as before.
export default function Profile() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const lang = i18n.language;
  // The name in the UI's script first; the other script's name underneath (B24).
  const primary = (urdu && user?.urduName ? user.urduName : user?.name) ?? '';
  const secondary = urdu ? user?.name : user?.urduName;

  const row = { flexDirection: urdu ? 'row-reverse' : 'row' } as const;

  return (
    <Screen>
      <BackHeader testID="profile-back" title={t('profile.title')} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xxxl }}>
        <Card style={{ alignItems: 'center', gap: space.m, paddingVertical: space.xxxl }}>
          {/* Initials from the Latin name so the disc reads "AJ" in both languages. */}
          <Avatar name={user?.name || primary || '?'} size={PROFILE_AVATAR} bg={c.cream} color={c.navy} style={{ borderRadius: 28 }} />
          <Text variant="h1" weight={800} color={c.ink} center style={{ lineHeight: urdu ? undefined : 34 }}>{primary}</Text>
          {secondary ? <Text variant="h2" color={c.ink} center>{secondary}</Text> : null}
          {user?.phone ? <Text variant="sub" color={c.ink2} center>{ltrIsolate(user.phone)}</Text> : null}
        </Card>

        <View style={{ gap: space.s }}>
          <SectionLabel>{t('profile.language')}</SectionLabel>
          <View style={[row, { gap: space.m }]}>
            {(['ur', 'en'] as const).map((l) => {
              const selected = lang === l;
              return (
                <Pressable
                  key={l}
                  testID={`lang-${l}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => { applyLanguage(l); }}
                  style={{
                    flex: 1, height: LANG_CHIP_HEIGHT, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? c.amber : c.surface,
                    borderWidth: selected ? 0 : glassTokens.line, borderColor: c.separator,
                  }}
                >
                  <Text variant="hl" weight={700} color={selected ? c.onAmber : c.ink} style={{ lineHeight: undefined }}>
                    {l === 'ur' ? t('profile.urdu') : t('profile.english')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: space.s }}>
          <SectionLabel>{t('profile.fieldName')}</SectionLabel>
          <Card padding={0} style={{ paddingHorizontal: space.xl }}>
            <FieldRow label={t('profile.fieldName')} value={user?.name ?? ''} />
            <FieldRow label={t('profile.fieldUrduName')} value={user?.urduName ?? '—'} last />
          </Card>
          <Text variant="foot" center style={{ marginTop: space.xs }}>{t('profile.hint')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** A read-only field: label ink2 on the leading side, value cream on the trailing side. */
function FieldRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{
      flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.m,
      paddingVertical: space.l, borderBottomWidth: last ? 0 : glassTokens.line, borderBottomColor: c.separator,
    }}>
      <Text variant="body" color={c.ink2}>{label}</Text>
      <Text variant="hl" weight={700} color={c.ink} numberOfLines={1} style={{ flexShrink: 1 }}>{value}</Text>
    </View>
  );
}

/** Section label — 12/600 uppercase, letter-spacing 0.96, ink3 (§2). */
function SectionLabel({ children }: { children: string }) {
  const urdu = useIsUrdu();
  return <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96 }}>{children}</Text>;
}

/** Stack-screen header: a 44 pt round glass back button and the 28/800 title. */
function BackHeader({ testID, title, onBack }: { testID: string; title: string; onBack: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={8}
        style={{ width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
      </Pressable>
      <Text variant="h1" weight={800} color={c.ink} numberOfLines={1} style={{ flex: 1, lineHeight: urdu ? undefined : 34 }}>{title}</Text>
    </View>
  );
}
