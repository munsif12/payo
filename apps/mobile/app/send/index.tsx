import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronLeft, Landmark, Search, Smartphone, type LucideIcon } from 'lucide-react-native';
import { Screen, Text, Card, Input, ListRow, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, radius, glassTokens } from '../../src/theme/tokens';
import { usePressScale } from '../../src/motion/usePressScale';
import { useRecipientsQuery, useDeleteRecipientMutation } from '../../src/api/client';
import { pickFamily } from '../../src/home/useFamily';
import { maskIdentifier } from '../../src/lib/mask';
import { ltrIsolate } from '../../src/lib/bidi';
import type { RecipientDto } from '../../src/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** B16 "New" tiles: each one just primes the identifier field — the keyboard it
 *  opens and the placeholder it shows — so the resolution path stays the single
 *  identifier → institution route it always was. */
type NewMode = 'phone' | 'iban' | 'bank';
const NEW_TILES: { mode: NewMode; Icon: LucideIcon }[] = [
  { mode: 'phone', Icon: Smartphone },
  { mode: 'iban', Icon: Landmark },
  { mode: 'bank', Icon: Building2 },
];
/** B16 tile: a 44 pt amberTint icon square (GLASS-SPEC §2 "Tile"). */
const TILE_ICON = 44;
const TILE_ICON_RADIUS = 14;
const ROW_AVATAR = 44;

/** GLASS-SPEC §5 B16: the 44 pt round glass back button in the head. */
function BackButton({ testID, onPress }: { testID: string; onPress: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={{
        width: touch.min, height: touch.min, borderRadius: touch.min / 2,
        backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}

function NewTile({ mode, Icon, selected, onPress }: { mode: NewMode; Icon: LucideIcon; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      testID={`send-new-${mode}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          flex: 1, borderRadius: radius.tile, padding: space.m, gap: space.s,
          alignItems: urdu ? 'flex-end' : 'flex-start',
          backgroundColor: selected ? c.surface2 : c.surface,
          borderWidth: glassTokens.line, borderColor: selected ? c.amber : c.separator,
        },
        style,
      ]}
    >
      <View style={{ width: TILE_ICON, height: TILE_ICON, borderRadius: TILE_ICON_RADIUS, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={c.amber} strokeWidth={2} />
      </View>
      <Text variant="sub" weight={600} color={c.ink} numberOfLines={1}>{t(`send.new.${mode}`)}</Text>
    </AnimatedPressable>
  );
}

export default function SendIdentifier() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; phone?: string }>();
  const [identifier, setIdentifier] = useState(params.phone ?? '');
  const [query, setQuery] = useState(params.q ?? '');
  const [mode, setMode] = useState<NewMode | null>(null);
  const { data: recipients } = useRecipientsQuery(query || undefined);
  const [deleteRecipient] = useDeleteRecipientMutation();

  const items = useMemo(() => recipients?.items ?? [], [recipients]);
  const numericFriendly = /^[+\d]*$/.test(identifier);
  // B16: the first few saved people are "Family" (the same slice Home shows);
  // the rest are "Saved". A search collapses everything into one result list.
  const searching = query.trim().length > 0;
  const family = useMemo(() => (searching ? [] : pickFamily(items)), [items, searching]);
  const saved = useMemo(() => (searching ? items : items.slice(family.length)), [items, searching, family.length]);

  const keyboardType =
    mode === 'phone' ? 'phone-pad'
      : mode === 'bank' ? 'number-pad'
        : mode === 'iban' ? 'default'
          : numericFriendly ? 'phone-pad' : 'default';

  const goInstitution = () =>
    router.push({ pathname: '/send/institution', params: { identifier: identifier.trim() } });

  const goAmountForRecipient = (r: RecipientDto) =>
    router.push({
      pathname: '/send/amount',
      params: {
        recipientId: r.id,
        title: r.title,
        institutionName: urdu && r.institution.urduName ? r.institution.urduName : r.institution.name,
        identifier: r.identifier,
      },
    });

  const onDelete = (r: RecipientDto) => {
    Alert.alert(
      t('send.saved.deleteTitle'),
      t('send.saved.deleteMessage', { name: r.nickname }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteRecipient(r.id) },
      ],
    );
  };

  const sectionLabel = (label: string) => (
    <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96, marginBottom: space.s }}>{label}</Text>
  );

  const renderRow = (r: RecipientDto, i: number, all: RecipientDto[]) => (
    <ListRow
      key={r.id}
      testID={`saved-recipient-${r.id}`}
      onPress={() => goAmountForRecipient(r)}
      onLongPress={() => onDelete(r)}
      separator={i < all.length - 1}
      style={{ paddingVertical: 10 }}
      // People you pay wear the cream avatar (GLASS-SPEC §2 "Avatar").
      left={<Avatar name={r.nickname} size={ROW_AVATAR} bg={c.cream} color={c.navy} />}
      title={urdu ? (r.urduNickname || r.urduTitle || r.nickname) : r.nickname}
      subtitle={ltrIsolate(`${urdu && r.urduTitle ? r.urduTitle : r.title} · ${urdu && r.institution.urduName ? r.institution.urduName : r.institution.name} · ${maskIdentifier(r.identifier)}`)}
      showChevron
    />
  );

  return (
    <Screen>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: space.m, paddingTop: space.l, marginBottom: space.xl }}>
        <BackButton testID="send-back" onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1">{t('send.whoTitle')}</Text>
          <Text variant="sub" color={c.ink2}>{t('send.whoSubtitle')}</Text>
        </View>
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.xl, paddingBottom: space.xl }}>
        <View style={{ gap: space.m }}>
          {/* B16: the identifier field carries a persistent amber line, not just
              on focus — it is the one field on the screen. Remounted when a
              "New" tile is picked so autoFocus brings the right keyboard up. */}
          <Input
            key={mode ?? 'any'}
            testID="send-identifier"
            icon={<Search size={20} color={c.ink3} strokeWidth={2} />}
            placeholder={mode ? t(`send.new.${mode}`) : t('send.identifierPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={mode !== null}
            keyboardType={keyboardType}
            value={identifier}
            onChangeText={setIdentifier}
            containerStyle={{ borderWidth: glassTokens.inputFocusLine, borderColor: c.amber }}
          />
          <Button
            testID="send-identifier-continue"
            label={t('common.continue')}
            disabled={identifier.trim().length < 4}
            onPress={goInstitution}
          />
        </View>

        {family.length > 0 ? (
          <View>
            {sectionLabel(t('send.family'))}
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {family.map((r, i) => renderRow(r, i, family))}
            </Card>
          </View>
        ) : null}

        <View>
          {sectionLabel(t('send.saved.title'))}
          <Input
            testID="send-saved-search"
            icon={<Search size={20} color={c.ink3} strokeWidth={2} />}
            placeholder={t('send.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            containerStyle={{ marginBottom: space.m }}
          />
          {saved.length > 0 ? (
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {saved.map((r, i) => renderRow(r, i, saved))}
            </Card>
          ) : items.length === 0 ? (
            <Text variant="sub" color={c.ink2} center style={{ marginTop: space.s }}>{t('send.saved.empty')}</Text>
          ) : null}
        </View>

        <View>
          {sectionLabel(t('send.new.label'))}
          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.m }}>
            {NEW_TILES.map(({ mode: m, Icon }) => (
              <NewTile
                key={m}
                mode={m}
                Icon={Icon}
                selected={mode === m}
                onPress={() => setMode(m)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
