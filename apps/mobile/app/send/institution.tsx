import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search } from 'lucide-react-native';
import { Screen, Text, Card, Input, ListRow, InstitutionLogo, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, radius, glassTokens } from '../../src/theme/tokens';
import { usePressScale } from '../../src/motion/usePressScale';
import { useInstitutionsQuery, useResolveRecipientMutation, apiErr } from '../../src/api/client';
import { ltrIsolate } from '../../src/lib/bidi';
import type { InstitutionDto } from '../../src/api/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** B17: the popular wallets/banks sit in a 3-up grid of glass tiles. */
const POPULAR_COLUMNS = 3;
const TILE_HEIGHT = 120;

/** GLASS-SPEC §5 B17: the 44 pt round glass back button in the head. */
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

function InstitutionTile({ inst, label, busy, onPress, testID }: {
  inst: InstitutionDto;
  label: string;
  busy: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          flex: 1, height: TILE_HEIGHT, borderRadius: radius.tile, padding: space.m, gap: space.s,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: busy ? c.surface2 : c.surface,
          borderWidth: glassTokens.line, borderColor: busy ? c.amber : c.separator,
        },
        style,
      ]}
    >
      <InstitutionLogo size={40} shape="rounded" name={inst.name} code={inst.code ?? inst.id} logoUrl={inst.logoUrl} />
      <Text variant="sub" weight={600} color={c.ink} center numberOfLines={1} adjustsFontSizeToFit>
        {busy ? t('common.loading') : label}
      </Text>
    </AnimatedPressable>
  );
}

export default function InstitutionPicker() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const [query, setQuery] = useState('');
  const { data } = useInstitutionsQuery(query || undefined);
  const [resolveRecipient, { isLoading: resolving }] = useResolveRecipientMutation();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const popular = useMemo(() => items.filter((i) => i.popular), [items]);
  const rest = useMemo(
    () => [...items.filter((i) => !i.popular)].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );
  const popularRows = useMemo(() => {
    const rows: InstitutionDto[][] = [];
    for (let i = 0; i < popular.length; i += POPULAR_COLUMNS) rows.push(popular.slice(i, i + POPULAR_COLUMNS));
    return rows;
  }, [popular]);

  const onPick = async (inst: InstitutionDto) => {
    setError(null);
    setResolvingId(inst.id);
    try {
      const resolved = await resolveRecipient({ institutionId: inst.id, identifier: identifier ?? '' }).unwrap();
      router.push({
        pathname: '/send/recipient',
        params: {
          title: resolved.title,
          institutionId: resolved.institution.id,
          institutionName: resolved.institution.name,
          institutionUrduName: resolved.institution.urduName ?? '',
          institutionKind: resolved.institution.kind,
          identifier: resolved.identifier,
          linkedUserId: resolved.linkedUserId ?? '',
        },
      });
    } catch (e) {
      const { code, message } = apiErr(e);
      const key = code === 'RECIPIENT_NOT_FOUND' ? 'send.errors.recipientNotFound'
        : code === 'SELF_TRANSFER' ? 'send.errors.selfTransfer'
        : code === 'INVALID_IDENTIFIER' ? 'send.errors.invalidIdentifier'
        : null;
      setError(key ? t(key) : message);
    } finally {
      setResolvingId(null);
    }
  };

  const label = (inst: InstitutionDto) => (urdu && inst.urduName ? inst.urduName : inst.name);
  const testIdFor = (inst: InstitutionDto) => `institution-${inst.name.replace(/\s/g, '-')}`;

  // B17 "All banks": 56 pt glass rows — a 40 pt InstitutionLogo (the closest of
  // its fixed 24/32/40 sizes to the artboard), the name, a chevron, grouped in
  // one glass card with separators between rows.
  const renderRow = (inst: InstitutionDto, i: number, all: InstitutionDto[]) => (
    <ListRow
      key={inst.id}
      testID={testIdFor(inst)}
      onPress={() => onPick(inst)}
      separator={i < all.length - 1}
      style={{ paddingVertical: 8 }}
      left={<InstitutionLogo size={40} shape="rounded" name={inst.name} code={inst.code ?? inst.id} logoUrl={inst.logoUrl} />}
      title={label(inst)}
      subtitle={resolvingId === inst.id && resolving ? t('common.loading') : undefined}
      showChevron
    />
  );

  const sectionLabel = (text: string) => (
    <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96, marginBottom: space.s }}>{text}</Text>
  );

  return (
    <Screen>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: space.m, paddingTop: space.l, marginBottom: space.xl }}>
        <BackButton testID="institution-back" onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1">{t('send.chooseInstitution')}</Text>
          {identifier ? (
            <Text variant="sub" color={c.ink2} numberOfLines={1}>{t('send.forIdentifier', { identifier: ltrIsolate(identifier) })}</Text>
          ) : null}
        </View>
      </View>

      <Input
        testID="institution-search"
        icon={<Search size={18} color={c.ink3} strokeWidth={2} />}
        placeholder={t('send.searchInstitutions')}
        value={query}
        onChangeText={setQuery}
        containerStyle={{ marginBottom: space.l }}
      />

      {error ? <Text variant="sub" color={c.red} center style={{ marginBottom: space.m }}>{error}</Text> : null}

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.xl }}>
        {popular.length > 0 ? (
          <View style={{ marginBottom: space.xl }}>
            {sectionLabel(t('send.popular'))}
            <View style={{ gap: space.m }}>
              {popularRows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.m }}>
                  {row.map((inst) => (
                    <InstitutionTile
                      key={inst.id}
                      inst={inst}
                      label={label(inst)}
                      busy={resolvingId === inst.id && resolving}
                      onPress={() => onPick(inst)}
                      testID={testIdFor(inst)}
                    />
                  ))}
                  {/* Fillers keep a short last row's tiles the same width as the others. */}
                  {Array.from({ length: POPULAR_COLUMNS - row.length }).map((_, fi) => (
                    <View key={`fill-${fi}`} style={{ flex: 1 }} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {rest.length > 0 ? (
          <View>
            {sectionLabel(t('send.allInstitutions'))}
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {rest.map((inst, i) => renderRow(inst, i, rest))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
