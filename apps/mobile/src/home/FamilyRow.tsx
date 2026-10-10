import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { Text, Avatar, useIsUrdu } from '../ui';
import { useTheme } from '../theme/useTheme';
import { space, touch } from '../theme/tokens';
import { usePressScale } from '../motion/usePressScale';
import type { RecipientDto } from '../api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AVATAR = 52;

/** Direction A artboard: Abbu amber, Bilal blue, Sara violet, then amber again. */
function tint(index: number, c: ReturnType<typeof useTheme>['c']): { bg: string; color: string } {
  const tints = [
    { bg: c.amberTint, color: c.onAmber },
    { bg: c.avatarBlueTint, color: c.avatarBlue },
    { bg: c.avatarVioletTint, color: c.avatarViolet },
  ];
  return tints[index % tints.length]!;
}

/**
 * The family row on Home (v8, Direction A): the people you pay, one tap from a
 * spoken-style turn — tapping Abbu sends "Send money to Abbu" exactly as if it
 * had been said, so the assistant's own recipient → amount → PIN flow runs.
 * The "+" tile opens the classic Send flow, where new people get saved.
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
        <Text variant="cap" style={{ letterSpacing: 0.96 }}>{t('home.family.label')}</Text>
        <Pressable testID="home-family-manage" accessibilityRole="button" hitSlop={8} onPress={() => router.push('/send')}>
          <Text variant="foot" weight={700} color={c.amberDeep}>{t('home.family.manage')}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: space.s }}>
        {people.map((p, i) => (
          <PersonTile
            key={p.id}
            testID={`home-family-${p.nickname}`}
            label={p.nickname}
            sub={urdu && p.institution.urduName ? p.institution.urduName : p.institution.name}
            onPress={() => onIntent(t('home.family.intent', { name: p.nickname }))}
          >
            <Avatar name={p.nickname} size={AVATAR} bg={tint(i, c).bg} color={tint(i, c).color} />
          </PersonTile>
        ))}
        <PersonTile testID="home-family-add" label={t('home.family.add')} sub={t('home.family.addSub')} onPress={() => router.push('/send')}>
          <View
            style={{
              width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: c.surface,
              borderWidth: 1.5, borderColor: c.separator, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={22} color={c.ink3} strokeWidth={2.2} />
          </View>
        </PersonTile>
      </View>
    </View>
  );
}

function PersonTile({ testID, label, sub, onPress, children }: {
  testID: string;
  label: string;
  sub: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[{ alignItems: 'center', gap: 6, width: 72, minHeight: touch.min }, pressStyle]}
    >
      {children}
      <Text variant="foot" weight={700} numberOfLines={1} center style={{ fontSize: 13 }}>{label}</Text>
      <Text variant="foot" numberOfLines={1} center style={{ fontSize: 11, lineHeight: 14, marginTop: -4 }}>{sub}</Text>
    </AnimatedPressable>
  );
}
