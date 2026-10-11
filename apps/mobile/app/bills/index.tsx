import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Zap, Flame, Wifi, Droplet, Smartphone, Receipt } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, Text, Card, ListRow, InstitutionLogo, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import {
  useBillersQuery, useDueBillsQuery, useSavedBillersQuery, useDeleteSavedBillerMutation,
  useLookupBillMutation, usePayBillMutation, apiErr,
} from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import { formatShortDate } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';
import type { NamedItem, SavedBillerDto } from '../../src/api/types';

const CAT_ICON: Record<string, LucideIcon> = {
  electricity: Zap, gas: Flame, internet: Wifi, water: Droplet, mobile: Smartphone,
};
const CATEGORY_ORDER = ['electricity', 'gas', 'internet', 'water', 'mobile'];

/** GLASS-SPEC §2 tile icon: a 44 pt `amberTint` square (radius 14) with an amber icon. */
const ICON_SQUARE = 44;
const ICON_SQUARE_RADIUS = 14;

// Bills — GLASS-SPEC §5 B20: 44 pt round glass back button + "Pay bills" 28/800
// and a sub-line, the DUE NOW card tinted amber (`glassTokens.dueBill`) with an
// amber Pay pill, then saved billers and every biller as glass rows with an
// `InstitutionLogo` (or the amber category icon) and a chevron.
export default function Billers() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data } = useBillersQuery();
  const { data: due } = useDueBillsQuery();
  const { data: saved } = useSavedBillersQuery();
  const [deleteSavedBiller] = useDeleteSavedBillerMutation();
  const [lookupBill] = useLookupBillMutation();
  const [payBill] = usePayBillMutation();
  const [error, setError] = useState<string | null>(null);

  const dueBill = due?.items?.[0];
  const allBillers = useMemo(() => data?.items ?? [], [data]);
  const savedItems = saved?.items ?? [];
  const rowDir = urdu ? 'row-reverse' : 'row';

  const grouped = useMemo(() => {
    const byCat = new Map<string, NamedItem[]>();
    for (const b of allBillers) {
      const cat = b.category ?? 'other';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(b);
    }
    const cats = [...CATEGORY_ORDER.filter((cat) => byCat.has(cat)), ...[...byCat.keys()].filter((cat) => !CATEGORY_ORDER.includes(cat))];
    return cats.map((cat) => ({ category: cat, items: byCat.get(cat) ?? [] }));
  }, [allBillers]);

  const openBiller = (b: NamedItem, consumerNo?: string) =>
    router.push({ pathname: '/bills/[billerId]', params: { billerId: b.id, name: b.name, urduName: b.urduName, ...(consumerNo ? { consumerNo } : {}) } });

  const onTapSaved = async (sb: SavedBillerDto) => {
    setError(null);
    try {
      const bill = await lookupBill({ billerId: sb.biller.id, consumerNo: sb.consumerNo }).unwrap();
      const action = await payBill({ billId: bill.billId }).unwrap();
      holdAction(action);
      router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  const onDeleteSaved = (sb: SavedBillerDto) => {
    Alert.alert(
      t('bills.saved.deleteTitle'),
      t('bills.saved.deleteMessage', { name: sb.nickname }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteSavedBiller(sb.id) },
      ],
    );
  };

  const iconSquare = (Icon: LucideIcon) => (
    <View style={{ width: ICON_SQUARE, height: ICON_SQUARE, borderRadius: ICON_SQUARE_RADIUS, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={22} color={c.amber} strokeWidth={2} />
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable
          testID="bills-back"
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
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h1" numberOfLines={1}>{t('bills.title')}</Text>
          <Text variant="sub" numberOfLines={1}>{t('bills.subtitle')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.m, paddingBottom: space.xl }}>
        {dueBill ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 6 }}>{t('bills.dueNow')}</Text>
            <Card padding={14} style={{ backgroundColor: glassTokens.dueBill.fill, borderColor: glassTokens.dueBill.line }}>
              <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, minHeight: touch.min }}>
                {dueBill.biller.logoUrl ? (
                  <InstitutionLogo size={40} shape="rounded" name={dueBill.biller.name} code={dueBill.biller.code ?? dueBill.biller.id} logoUrl={dueBill.biller.logoUrl} />
                ) : (
                  <Zap size={26} color={c.amber} strokeWidth={2.2} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="hl" weight={700} numberOfLines={1}>
                    {`${urdu ? dueBill.biller.urduName : dueBill.biller.name} · ${t('bills.dueCard.due', { date: ltrIsolate(formatShortDate(dueBill.dueDate)) })}`}
                  </Text>
                  <Text variant="foot" color={c.ink2} numberOfLines={1}>
                    {`${ltrIsolate(formatPaisa(dueBill.amountPaisa))} · ${t('bills.dueCard.consumer', { last4: ltrIsolate(dueBill.consumerNo.slice(-4)), month: dueBill.month })}`}
                  </Text>
                </View>
                <Pressable
                  testID="bills-due-pay"
                  accessibilityRole="button"
                  onPress={() => openBiller(
                    { id: dueBill.biller.id, name: dueBill.biller.name, urduName: dueBill.biller.urduName },
                    dueBill.consumerNo,
                  )}
                  style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text variant="sub" weight={700} color={c.onAmber} style={{ lineHeight: undefined }}>{t('bills.dueCard.pay')}</Text>
                </Pressable>
              </View>
            </Card>
          </View>
        ) : null}

        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}

        {savedItems.length > 0 ? (
          <View>
            <Text variant="cap" style={{ marginBottom: 6 }}>{t('bills.saved.title')}</Text>
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {savedItems.map((sb, i) => (
                <ListRow
                  key={sb.id}
                  testID={`saved-biller-${sb.id}`}
                  onPress={() => onTapSaved(sb)}
                  onLongPress={() => onDeleteSaved(sb)}
                  left={<InstitutionLogo size={40} shape="rounded" name={sb.nickname} code={sb.biller.code ?? sb.biller.id} logoUrl={sb.biller.logoUrl} />}
                  title={sb.nickname}
                  subtitle={ltrIsolate(`${urdu ? sb.biller.urduName ?? sb.biller.name : sb.biller.name} · ${sb.consumerNo}`)}
                  showChevron
                  separator={i < savedItems.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null}

        {grouped.map(({ category, items }) => (
          <View key={category}>
            <Text variant="cap" style={{ marginBottom: 6 }}>{t(`bills.category.${category}`, { defaultValue: category })}</Text>
            <Card padding={0} style={{ paddingHorizontal: space.l }}>
              {items.map((b, i) => (
                <ListRow
                  key={b.id}
                  testID={`biller-${b.name.replace(/\s/g, '-')}`}
                  onPress={() => openBiller(b)}
                  left={b.logoUrl ? (
                    <InstitutionLogo size={40} shape="rounded" name={b.name} code={b.code ?? b.id} logoUrl={b.logoUrl} />
                  ) : (
                    // No mark for this biller — the amber category icon is a better
                    // fallback here than initials, and it is what shipped before.
                    iconSquare(CAT_ICON[b.category ?? ''] ?? Receipt)
                  )}
                  title={urdu ? b.urduName : b.name}
                  subtitle={t(`bills.category.${b.category ?? 'other'}`, { defaultValue: b.category ?? '' })}
                  showChevron
                  separator={i < items.length - 1}
                />
              ))}
            </Card>
          </View>
        ))}

        <View>
          <Text variant="cap" style={{ marginBottom: 6 }}>{t('bills.mobileTopup.title')}</Text>
          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            <ListRow
              testID="bills-mobile-topup"
              onPress={() => router.push('/recharge')}
              left={iconSquare(Smartphone)}
              title={t('bills.mobileTopup.title')}
              subtitle={t('bills.mobileTopup.foot')}
              showChevron
              separator={false}
            />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
