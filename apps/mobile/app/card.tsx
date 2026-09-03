import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Eye, Snowflake, ShieldCheck, SlidersHorizontal } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card, Avatar, Pill, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, radius } from '../src/theme/tokens';
import { useCardQuery, useFreezeCardMutation, useMeQuery, useTransactionsQuery } from '../src/api/client';
import { formatRelativeDay } from '../src/lib/dates';
import { formatPaisa } from '../src/lib/money';
import { ltrIsolate } from '../src/lib/bidi';

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

  if (!card) {
    return (
      <Screen>
        <Text color={c.ink3} center>{t('common.loading')}</Text>
      </Screen>
    );
  }

  const pan = revealed ? card.pan : `•••• •••• •••• ${card.pan.replace(/\s/g, '').slice(-4)}`;
  const holderName = (urdu && me?.user.urduName ? me.user.urduName : me?.user.name ?? '').toUpperCase();
  const recentCardActivity = (txns?.items ?? []).filter((tx) => tx.direction === 'out').slice(0, 3);

  const toggleFreeze = () => { if (!isLoading) freeze({ frozen: !card.frozen }); };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="card-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2" weight={800}>{t('card.title')}</Text>
      </View>

      <View
        style={{
          height: 214, borderRadius: 24, padding: 22, backgroundColor: card.frozen ? c.ink3 : c.navy,
          overflow: 'hidden', justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text weight={800} color={c.white} style={{ letterSpacing: 1.5 }}>PAYO</Text>
          {card.frozen ? (
            <Pill label={t('card.frozen')} bg="rgba(255,255,255,0.14)" color={c.white} />
          ) : (
            <Pill label={t('card.virtual')} bg="rgba(255,255,255,0.14)" color={c.white} />
          )}
        </View>
        <Text color={c.white} weight={600} style={{ fontSize: 22, letterSpacing: 3, marginTop: 52 }}>
          {ltrIsolate(pan)}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text variant="cap" color="rgba(255,255,255,0.55)">{t('card.holder')}</Text>
            <Text color={c.white} weight={600} style={{ marginTop: 2 }}>{holderName}</Text>
          </View>
          <View>
            <Text variant="cap" color="rgba(255,255,255,0.55)">{t('card.expiry')}</Text>
            <Text color={c.white} weight={600} style={{ marginTop: 2 }}>{ltrIsolate(card.expiry)}</Text>
          </View>
        </View>
      </View>

      <View style={{ height: space.l }} />
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <Pressable
          testID="card-reveal"
          onPress={() => setRevealed((r) => !r)}
          style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.tile, paddingVertical: 14, alignItems: 'center', gap: space.s }}
        >
          <Eye size={22} color={c.ink} strokeWidth={2} />
          <Text variant="sub">{revealed ? t('card.hide') : t('card.reveal')}</Text>
        </Pressable>
        <Pressable
          testID="card-freeze"
          onPress={toggleFreeze}
          style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.tile, paddingVertical: 14, alignItems: 'center', gap: space.s }}
        >
          <Snowflake size={22} color={c.ink} strokeWidth={2} />
          <Text variant="sub">{card.frozen ? t('card.unfreeze') : t('card.freeze')}</Text>
        </Pressable>
        {/* Not yet wired to a screen — rendered as a plain, dimmed View (not Pressable)
            so it doesn't invite a tap that does nothing. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.tile, paddingVertical: 14, alignItems: 'center', gap: space.s, opacity: 0.4 }}
        >
          <SlidersHorizontal size={22} color={c.ink} strokeWidth={2} />
          <Text variant="sub">{t('card.limits')}</Text>
        </View>
      </View>

      {revealed ? (
        <>
          <View style={{ height: space.m }} />
          <Card padding={space.m} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="sub">CVV</Text>
            <Text weight={700}>{ltrIsolate(card.cvv)}</Text>
          </Card>
        </>
      ) : null}

      <View style={{ height: space.l }} />
      <Card padding={0} style={{ paddingHorizontal: space.l }}>
        <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.greenTint, alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} color={c.green} strokeWidth={2.6} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="hl">{card.frozen ? t('card.inactiveTitle') : t('card.activeTitle')}</Text>
            <Text variant="foot">{card.frozen ? t('card.inactiveFoot') : t('card.activeFoot')}</Text>
          </View>
          <Pressable
            testID="card-active-toggle"
            accessibilityRole="switch"
            accessibilityState={{ checked: !card.frozen }}
            disabled={isLoading}
            onPress={toggleFreeze}
            style={{
              width: 50, height: 30, borderRadius: 15, backgroundColor: card.frozen ? c.surface2 : c.green,
              justifyContent: 'center', paddingHorizontal: 3, alignItems: card.frozen ? 'flex-start' : 'flex-end',
            }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.white }} />
          </Pressable>
        </View>
      </Card>

      <View style={{ height: space.l }} />
      <Text variant="cap" style={{ marginBottom: 4 }}>{t('card.activity')}</Text>
      {recentCardActivity.length === 0 ? (
        <Text variant="foot">{t('activity.empty')}</Text>
      ) : recentCardActivity.map((txn, i) => {
        const name = urdu && txn.counterparty.urduName ? txn.counterparty.urduName : txn.counterparty.name;
        return (
          <View
            key={txn.id}
            style={{
              flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
              borderBottomWidth: i < recentCardActivity.length - 1 ? 1 : 0, borderBottomColor: c.separator,
            }}
          >
            <Avatar name={name} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="hl" numberOfLines={1}>{name}</Text>
              <Text variant="foot" numberOfLines={1}>{formatRelativeDay(txn.createdAt)}</Text>
            </View>
            <Text variant="hl">{ltrIsolate('−' + formatPaisa(txn.amountPaisa))}</Text>
          </View>
        );
      })}
    </Screen>
  );
}
