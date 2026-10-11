import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Eye, EyeOff, Snowflake, ShieldCheck, SlidersHorizontal, Nfc } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card, ListRow, Avatar, Pill, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, radius, touch, glassTokens } from '../src/theme/tokens';
import { useCardQuery, useFreezeCardMutation, useMeQuery, useTransactionsQuery } from '../src/api/client';
import { formatRelativeDay } from '../src/lib/dates';
import { formatPaisa } from '../src/lib/money';
import { ltrIsolate } from '../src/lib/bidi';

/** The virtual card's height; the three glass action tiles below it. */
const CARD_HEIGHT = 200;
const TILE_MIN_HEIGHT = 88;

// My card — GLASS-SPEC §5 B21: the virtual card as a navy → navyDeep gradient
// with the 1 px glass line (radius 24), the masked number 22/600 cream (always
// LTR), holder + expiry, the amber "PAYO" wordmark; then glass tiles for
// freeze / show number / limits, the voice tip, the active toggle row and the
// recent card activity in glass cards.
export default function CardScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const { data: card } = useCardQuery();
  const { data: me } = useMeQuery();
  const { data: txns } = useTransactionsQuery({});
  const [freeze, { isLoading }] = useFreezeCardMutation();
  const rowDir = urdu ? 'row-reverse' : 'row';

  const backButton = (
    <Pressable
      testID="card-back"
      accessibilityRole="button"
      onPress={() => router.back()}
      hitSlop={8}
      style={{
        width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface,
        borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center',
      }}
    >
      <ChevronLeft size={22} color={c.ink} strokeWidth={2.2} />
    </Pressable>
  );

  if (!card) {
    return (
      <Screen>
        <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
          {backButton}
          <Text variant="h1">{t('card.title')}</Text>
        </View>
        <Text color={c.ink3} center>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const pan = revealed ? card.pan : `•••• •••• •••• ${card.pan.replace(/\s/g, '').slice(-4)}`;
  const holderName = (urdu && me?.user.urduName ? me.user.urduName : me?.user.name ?? '').toUpperCase();
  const recentCardActivity = (txns?.items ?? []).filter((tx) => tx.direction === 'out').slice(0, 3);

  const toggleFreeze = () => { if (!isLoading) freeze({ frozen: !card.frozen }); };

  const tileStyle = {
    flex: 1, minHeight: TILE_MIN_HEIGHT, backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator,
    borderRadius: radius.tile, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' as const, justifyContent: 'center' as const, gap: space.s,
  };

  return (
    <Screen>
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        {backButton}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1" numberOfLines={1}>{t('card.title')}</Text>
          <Text variant="sub" numberOfLines={1}>{card.frozen ? t('card.subtitleFrozen') : t('card.subtitleActive')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.m, paddingBottom: space.xl }}>
        {/* Card artwork is LTR in both languages — it never mirrors. */}
        <LinearGradient
          colors={[c.navy, c.navyDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: CARD_HEIGHT, borderRadius: radius.card, borderWidth: glassTokens.line, borderColor: c.separator,
            padding: space.xl, justifyContent: 'space-between', overflow: 'hidden', opacity: card.frozen ? 0.7 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text weight={800} color={c.amber} style={{ fontSize: 18, lineHeight: 24, letterSpacing: 2, writingDirection: 'ltr' }}>PAYO</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <Pill label={card.frozen ? t('card.frozen') : t('card.virtual')} bg={c.surface2} color={c.ink} />
              <Nfc size={22} color={c.ink2} strokeWidth={2} />
            </View>
          </View>
          <Text color={c.ink} weight={600} numberOfLines={1} style={{ fontSize: 22, lineHeight: 28, letterSpacing: 2.4, writingDirection: 'ltr', textAlign: 'left', fontVariant: ['tabular-nums'] }}>
            {ltrIsolate(pan)}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="cap" color={c.ink3} style={{ textAlign: 'left' }}>{t('card.holder')}</Text>
              <Text color={c.ink} weight={700} numberOfLines={1} style={{ marginTop: 2, fontSize: 15, lineHeight: 20, textAlign: 'left' }}>{holderName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="cap" color={c.ink3} style={{ textAlign: 'right' }}>{t('card.expiry')}</Text>
              <Text color={c.ink} weight={700} style={{ marginTop: 2, fontSize: 15, lineHeight: 20, writingDirection: 'ltr', textAlign: 'right' }}>{ltrIsolate(card.expiry)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ flexDirection: rowDir, gap: 10 }}>
          <Pressable testID="card-freeze" accessibilityRole="button" onPress={toggleFreeze} style={tileStyle}>
            <Snowflake size={24} color={c.amber} strokeWidth={2} />
            <Text variant="sub" weight={600} color={c.ink} center numberOfLines={1} adjustsFontSizeToFit>{card.frozen ? t('card.unfreeze') : t('card.freeze')}</Text>
          </Pressable>
          <Pressable testID="card-reveal" accessibilityRole="button" onPress={() => setRevealed((r) => !r)} style={tileStyle}>
            {revealed ? <EyeOff size={24} color={c.amber} strokeWidth={2} /> : <Eye size={24} color={c.amber} strokeWidth={2} />}
            <Text variant="sub" weight={600} color={c.ink} center numberOfLines={1} adjustsFontSizeToFit>{revealed ? t('card.hide') : t('card.reveal')}</Text>
          </Pressable>
          {/* Not yet wired to a screen — rendered as a plain, dimmed View (not Pressable)
              so it doesn't invite a tap that does nothing. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[tileStyle, { opacity: 0.4 }]}
          >
            <SlidersHorizontal size={24} color={c.amber} strokeWidth={2} />
            <Text variant="sub" weight={600} color={c.ink} center numberOfLines={1} adjustsFontSizeToFit>{t('card.limits')}</Text>
          </View>
        </View>

        {revealed ? (
          <Card padding={14} style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="sub" color={c.ink2}>CVV</Text>
            <Text weight={700} style={{ writingDirection: 'ltr' }}>{ltrIsolate(card.cvv)}</Text>
          </Card>
        ) : null}

        <Card padding={space.l} style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m }}>
          <ShieldCheck size={22} color={c.green} strokeWidth={2} />
          <Text variant="sub" color={c.ink2} style={{ flex: 1 }}>{t('card.voiceTip')}</Text>
        </Card>

        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          <ListRow
            testID="card-active-row"
            left={
              <View style={{ width: touch.min, height: touch.min, borderRadius: 14, backgroundColor: card.frozen ? c.surface2 : c.greenTint, alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} color={card.frozen ? c.ink3 : c.green} strokeWidth={2} />
              </View>
            }
            title={card.frozen ? t('card.inactiveTitle') : t('card.activeTitle')}
            subtitle={card.frozen ? t('card.inactiveFoot') : t('card.activeFoot')}
            separator={false}
            right={
              <Pressable
                testID="card-active-toggle"
                accessibilityRole="switch"
                accessibilityState={{ checked: !card.frozen }}
                disabled={isLoading}
                onPress={toggleFreeze}
                style={{
                  width: 48, height: 28, borderRadius: 14, backgroundColor: card.frozen ? c.surface2 : c.green,
                  borderWidth: glassTokens.line, borderColor: card.frozen ? c.separator : c.green,
                  justifyContent: 'center', paddingHorizontal: 3, alignItems: card.frozen ? 'flex-start' : 'flex-end',
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.ink }} />
              </Pressable>
            }
          />
        </Card>

        <View>
          <Text variant="cap" style={{ marginBottom: 6 }}>{t('card.activity')}</Text>
          {recentCardActivity.length === 0 ? (
            <Text variant="foot">{t('activity.empty')}</Text>
          ) : (
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {recentCardActivity.map((txn, i) => {
                const name = urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name;
                return (
                  <ListRow
                    key={txn.id}
                    left={<Avatar name={name} />}
                    title={name}
                    subtitle={formatRelativeDay(txn.createdAt)}
                    right={<Text variant="hl" style={{ writingDirection: 'ltr' }}>{ltrIsolate('−' + formatPaisa(txn.amountPaisa))}</Text>}
                    separator={i < recentCardActivity.length - 1}
                  />
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
