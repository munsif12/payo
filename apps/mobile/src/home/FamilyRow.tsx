import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { Text, Avatar, useIsUrdu } from '../ui';
import { useTheme } from '../theme/useTheme';
import { glassTokens, radius, space, touch } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import type { RecipientDto } from '../api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** GLASS-SPEC §5 B11: cream 56 pt avatars with navy initials, label 15/700. */
const AVATAR = 56;

/**
 * The family row on Home (Direction B, B11): the people you pay as four equal
 * glass tiles, one tap from a spoken-style turn — tapping Abbu sends "Send money
 * to Abbu" exactly as if it had been said, so the assistant's own recipient →
 * amount → PIN flow runs. The "Add" tile opens the classic Send flow, where new
 * people get saved. The row reads as a sentence, so it mirrors in Urdu.
 */
export function FamilyRow({ people, onIntent, testID = 'home-family' }: {
  people: RecipientDto[];
  onIntent: (text: string) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();

  return (
    <View testID={testID} style={{ gap: space.m }}>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="cap" style={{ letterSpacing: 0.96 }}>{t('home.family.title')}</Text>
        <Pressable testID="home-family-manage" accessibilityRole="button" hitSlop={8} onPress={() => router.push('/send')}>
          <Text variant="foot" weight={700} color={c.amber}>{t('home.family.manage')}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s }}>
        {people.map((p) => {
          // In Urdu a PAYO-linked person is named in Urdu (بلال), and the spoken-style
          // turn carries that name too, so the assistant's search runs in the user's script.
          const label = urdu ? (p.urduNickname || p.urduTitle || p.nickname) : p.nickname;
          return (
            <PersonTile
              key={p.id}
              testID={`home-family-${p.nickname}`}
              label={label}
              hint={urdu && p.institution.urduName ? p.institution.urduName : p.institution.name}
              onPress={() => onIntent(t('home.family.intent', { name: label }))}
            >
              <Avatar name={p.nickname} size={AVATAR} bg={c.cream} color={c.navy} />
            </PersonTile>
          );
        })}
        <PersonTile testID="home-family-add" label={t('home.family.add')} hint={t('home.family.addSub')} onPress={() => router.push('/send')}>
          <View
            style={{
              width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
              backgroundColor: c.avatarBlueTint, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={22} color={c.ink} strokeWidth={2.2} />
          </View>
        </PersonTile>
      </View>
    </View>
  );
}

/** One glass tile: radius 20, the 1 px line, the avatar over a one-line 15/700 label. */
function PersonTile({ testID, label, hint, onPress, children }: {
  testID: string;
  label: string;
  hint: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          flex: 1,
          minHeight: touch.min,
          backgroundColor: c.surface,
          borderWidth: glassTokens.line,
          borderColor: c.separator,
          borderRadius: radius.tile,
          paddingVertical: space.m,
          paddingHorizontal: space.xs,
          alignItems: 'center',
          gap: space.s,
        },
        pressStyle,
      ]}
    >
      {children}
      <Text variant="sub" weight={700} color={c.ink} numberOfLines={1} center style={{ fontSize: 15, lineHeight: urdu ? undefined : 20 }}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}
