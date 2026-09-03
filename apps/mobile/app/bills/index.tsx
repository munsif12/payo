import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Zap, Flame, Wifi, Droplet, Smartphone, Receipt } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, Text, Card, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useBillersQuery, useDueBillsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { formatShortDate } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';
import type { NamedItem } from '../../src/api/types';

const CAT_ICON: Record<string, LucideIcon> = {
  electricity: Zap, gas: Flame, internet: Wifi, water: Droplet, mobile: Smartphone,
};

function categoryVisual(category: string | undefined, c: ReturnType<typeof useTheme>['c']) {
  const Icon = CAT_ICON[category ?? ''] ?? Receipt;
  switch (category) {
    case 'electricity': return { Icon, bg: c.redTint, color: c.red };
    case 'gas': return { Icon, bg: c.amberTint, color: c.amberDeep };
    case 'internet': return { Icon, bg: c.surface2, color: c.ink2 };
    case 'water': return { Icon, bg: c.surface2, color: c.ink2 };
    case 'mobile': return { Icon, bg: c.greenTint, color: c.green };
    default: return { Icon, bg: c.surface2, color: c.ink2 };
  }
}

export default function Billers() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data } = useBillersQuery();
  const { data: due } = useDueBillsQuery();

  const dueBill = due?.items?.[0];
  const allBillers = useMemo(() => data?.items ?? [], [data]);

  const openBiller = (b: NamedItem, consumerNo?: string) =>
    router.push({ pathname: '/bills/[billerId]', params: { billerId: b.id, name: b.name, urduName: b.urduName, ...(consumerNo ? { consumerNo } : {}) } });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="bills-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2" weight={800}>{t('bills.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.xl, paddingBottom: space.xl }}>
        {dueBill ? (
          <Card style={{ borderWidth: 1.5, borderColor: c.amber, gap: space.m }}>
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.redTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={22} color={c.red} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="hl" numberOfLines={1}>{urdu ? dueBill.biller.urduName : dueBill.biller.name}</Text>
                <Text variant="foot" numberOfLines={1}>{t('bills.dueCard.consumer', { last4: dueBill.consumerNo.slice(-4), month: dueBill.month })}</Text>
              </View>
              <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: c.redTint, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="cap" weight={700} color={c.red} style={{ textTransform: 'none', letterSpacing: undefined, lineHeight: undefined, fontSize: 12 }}>
                  {t('bills.dueCard.due', { date: formatShortDate(dueBill.dueDate) })}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="h2">{ltrIsolate(formatPaisa(dueBill.amountPaisa))}</Text>
              <Pressable
                testID="bills-due-pay"
                onPress={() => openBiller(
                  { id: dueBill.biller.id, name: dueBill.biller.name, urduName: dueBill.biller.urduName },
                  dueBill.consumerNo,
                )}
                style={{ height: 44, paddingHorizontal: 24, borderRadius: 22, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text variant="hl" weight={700} color={c.navy}>{t('bills.payNow')}</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {allBillers.length > 0 ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 4 }}>{t('bills.category.utilities')}</Text>
            {allBillers.map((b) => {
              const { Icon, bg, color } = categoryVisual(b.category, c);
              return (
                <Pressable
                  key={b.id}
                  testID={`biller-${b.name.replace(/\s/g, '-')}`}
                  onPress={() => openBiller(b)}
                  style={{
                    flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.separator,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={22} color={color} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="hl" numberOfLines={1}>{urdu ? b.urduName : b.name}</Text>
                    <Text variant="foot" numberOfLines={1}>{t(`bills.category.${b.category ?? 'other'}`, { defaultValue: b.category ?? '' })}</Text>
                  </View>
                  <ChevronRight size={20} color={c.ink3} strokeWidth={2} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View>
          <Text variant="cap" style={{ marginBottom: 4 }}>{t('bills.category.mobile')}</Text>
          <Pressable
            testID="bills-mobile-topup"
            onPress={() => router.push('/recharge')}
            style={{
              flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 14,
              paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.separator,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.greenTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={22} color={c.green} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="hl" numberOfLines={1}>{t('bills.mobileTopup.title')}</Text>
              <Text variant="foot" numberOfLines={1}>{t('bills.mobileTopup.foot')}</Text>
            </View>
            <ChevronRight size={20} color={c.ink3} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
