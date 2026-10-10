import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { ChevronLeft, FileText, Download } from 'lucide-react-native';
import { Screen, Text, Card, Button, Pill, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius } from '../../src/theme/tokens';
import { useStatementsQuery, useGenerateStatementMutation, apiErr } from '../../src/api/client';
import { useOpenStatementPdf } from '../../src/lib/openStatementPdf';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';

const UR_MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Statements() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data } = useStatementsQuery();
  const [generate, { isLoading }] = useGenerateStatementMutation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirming, setConfirming] = useState<{ year: number; month?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const options: { year: number; month?: number }[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  options.push({ year: now.getFullYear() });
  options.push({ year: now.getFullYear() - 1 });

  const label = (o: { year: number; month?: number }) =>
    o.month ? `${(urdu ? UR_MONTHS : EN_MONTHS)[o.month - 1]} ${o.year}` : `${t('statements.yearly')} ${o.year}`;

  const onGenerate = async () => {
    setError(null);
    try {
      await generate(confirming!).unwrap();
      setConfirming(null);
      setPickerOpen(false);
    } catch (e) {
      setConfirming(null);
      setError(apiErr(e).code === 'NO_ACTIVITY' ? t('statements.noActivity') : apiErr(e).message);
    }
  };

  const openPdf = useOpenStatementPdf();

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="statements-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('statements.title')}</Text>
      </View>

      {error ? <Text color={c.red} center style={{ marginBottom: space.m }}>{error}</Text> : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <Card style={{ gap: space.s }}>
          <Text variant="cap">{t('statements.requestOne')}</Text>
          <Pressable
            testID="statement-new"
            onPress={() => setPickerOpen(true)}
            style={{
              height: 48, borderRadius: radius.input, backgroundColor: c.surface2,
              alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.m,
            }}
          >
            <Text color={c.ink3}>{options[0] ? label(options[0]) : ''}</Text>
          </Pressable>
          <Text variant="foot">{t('statements.requestFoot')}</Text>
        </Card>

        <View>
          <Text variant="cap" style={{ marginBottom: 4 }}>{t('statements.readyTitle')}</Text>
          {(data?.items ?? []).length === 0 && <Text color={c.ink3} center>{t('statements.empty')}</Text>}
          {(data?.items ?? []).map((s, i, arr) => (
            <View
              key={s.id}
              testID={`statement-${s.id}`}
              style={{
                flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: c.separator,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={20} color={c.ink2} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="hl" numberOfLines={1}>{label({ year: s.year, month: s.month })}</Text>
                <Text variant="foot" numberOfLines={1}>
                  {ltrIsolate(`${t('statements.moneyIn')} ${formatPaisa(s.totalInPaisa)} · ${t('statements.moneyOut')} ${formatPaisa(s.totalOutPaisa)}`)}
                </Text>
              </View>
              <Pressable testID={`statement-download-${s.id}`} onPress={() => openPdf(s.id)}>
                <Pill label="PDF" bg={c.amberTint} color={c.onAmber} icon={<Download size={14} color={c.onAmber} strokeWidth={2.6} />} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: space.l, maxHeight: '75%', gap: space.m }}>
            {confirming ? (
              <>
                <Text variant="h2" center>{t('statements.confirmTitle')}</Text>
                <Text color={c.ink3} center>{label(confirming)}</Text>
                <Button testID="statement-confirm" label={t('common.confirm')} onPress={onGenerate} loading={isLoading} />
                <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirming(null)} />
              </>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 4 }}>
                {options.map((o, i) => (
                  <Pressable
                    key={i}
                    testID={`statement-option-${i}`}
                    onPress={() => setConfirming(o)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.separator }}
                  >
                    <FileText size={20} color={c.ink2} strokeWidth={2} />
                    <Text variant="hl">{label(o)}</Text>
                  </Pressable>
                ))}
                <View style={{ height: space.s }} />
                <Button variant="ghost" label={t('common.cancel')} onPress={() => setPickerOpen(false)} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
