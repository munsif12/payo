import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronLeft, Download, FileText } from 'lucide-react-native';
import { Screen, Text, Card, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, touch, glassTokens } from '../../src/theme/tokens';
import { useStatementsQuery, useGenerateStatementMutation, apiErr } from '../../src/api/client';
import { useOpenStatementPdf } from '../../src/lib/openStatementPdf';
import { formatPaisa } from '../../src/lib/money';
import { monthName } from '../../src/lib/dates';
import { ltrIsolate } from '../../src/lib/bidi';

type Period = { year: number; month?: number };

/** B14: the ready rows carry a 56 pt amber-tinted disc with the file icon. */
const ROW_ICON_BOX = 56;
/** B14: the amber "PDF" pill on each ready row. */
const PDF_PILL_HEIGHT = 40;
/** PIN-sheet vocabulary for the period picker (§5): navyDeep body, 28 pt top corners. */
const SHEET_RADIUS = 28;

// Statements — GLASS-SPEC §5 B14. Glass back button + title with the "PDF,
// English · the app shows Urdu" sub-line; a REQUEST A STATEMENT card with the
// period field, the amber "Generate PDF" button and the voice hint; then READY
// TO DOWNLOAD as one glass card of rows with amber PDF pills. The flow is
// unchanged: pick a period → confirm → generate (statement-option-N →
// statement-confirm); the amber button jumps straight to the confirm step for
// the period shown in the field.
export default function Statements() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useStatementsQuery();
  const [generate, { isLoading }] = useGenerateStatementMutation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirming, setConfirming] = useState<Period | null>(null);
  const [selected, setSelected] = useState<Period | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const options: Period[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  options.push({ year: now.getFullYear() });
  options.push({ year: now.getFullYear() - 1 });
  const current = selected ?? options[0]!;

  const lang = urdu ? 'ur' : 'en';
  const label = (o: Period) =>
    o.month ? `${monthName(o.month - 1, lang)} ${o.year}` : `${t('statements.yearly')} ${o.year}`;

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
  const row = { flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center' } as const;
  const items = data?.items ?? [];

  return (
    <Screen>
      <BackHeader testID="statements-back" title={t('statements.title')} sub={t('statements.headSub')} onBack={() => router.back()} />

      {error ? <Text variant="sub" color={c.red} center style={{ marginBottom: space.m }}>{error}</Text> : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xxxl }}>
        <Card style={{ gap: space.m }}>
          <SectionLabel>{t('statements.requestOne')}</SectionLabel>
          <Pressable
            testID="statement-new"
            accessibilityRole="button"
            accessibilityLabel={label(current)}
            onPress={() => { setConfirming(null); setPickerOpen(true); }}
            style={[row, {
              height: touch.primary, borderRadius: radius.input, paddingHorizontal: space.l, justifyContent: 'space-between',
              backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator,
            }]}
          >
            <Text variant="hl" weight={600} color={c.ink} style={{ fontSize: 20, lineHeight: urdu ? undefined : 26 }}>{label(current)}</Text>
            <ChevronDown size={22} color={c.ink3} strokeWidth={2} />
          </Pressable>
          <Button
            testID="statement-generate"
            label={t('statements.generate')}
            onPress={() => { setConfirming(current); setPickerOpen(true); }}
          />
          <Text variant="foot">{t('statements.generateHint')}</Text>
        </Card>

        <View style={{ gap: space.s }}>
          <SectionLabel>{t('statements.readyTitle')}</SectionLabel>
          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            {items.length === 0 ? (
              <Text variant="sub" center style={{ paddingVertical: space.l }}>{t('statements.empty')}</Text>
            ) : null}
            {items.map((s, i) => (
              <View
                key={s.id}
                testID={`statement-${s.id}`}
                style={[row, {
                  gap: space.m, paddingVertical: space.l,
                  borderBottomWidth: i < items.length - 1 ? glassTokens.line : 0, borderBottomColor: c.separator,
                }]}
              >
                <View style={{ width: ROW_ICON_BOX, height: ROW_ICON_BOX, borderRadius: ROW_ICON_BOX / 2, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={24} color={c.amber} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text variant="h2" color={c.ink} numberOfLines={1} style={{ fontSize: 20, lineHeight: urdu ? undefined : 26 }}>
                    {label({ year: s.year, month: s.month })}
                  </Text>
                  <Text variant="sub" color={c.ink2} numberOfLines={1} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>
                    {t('statements.in')}{' '}
                    <Text variant="sub" weight={600} color={c.green} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>{ltrIsolate('+' + formatPaisa(s.totalInPaisa))}</Text>
                    {' · '}
                    {t('statements.out')}{' '}
                    <Text variant="sub" weight={600} color={c.red} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>{ltrIsolate('−' + formatPaisa(s.totalOutPaisa))}</Text>
                    {s.txnCount ? ` · ${t('statements.transactions', { count: s.txnCount })}` : ''}
                  </Text>
                </View>
                <Pressable
                  testID={`statement-download-${s.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('statements.download')}
                  onPress={() => openPdf(s.id)}
                  style={{ height: PDF_PILL_HEIGHT, paddingHorizontal: space.l, borderRadius: PDF_PILL_HEIGHT / 2, backgroundColor: c.amber, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Download size={16} color={c.onAmber} strokeWidth={2.6} />
                  <Text variant="sub" weight={700} color={c.onAmber} style={{ lineHeight: undefined }}>PDF</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: `rgba(0,0,0,${glassTokens.backdrop.opacity})` }}>
          <View
            style={{
              backgroundColor: c.navyDeep, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS,
              borderTopWidth: glassTokens.line, borderColor: c.separator,
              padding: space.xl, paddingBottom: insets.bottom + space.l, maxHeight: '75%', gap: space.m,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.separator }} />
            {confirming ? (
              <>
                <Text variant="h2" center>{t('statements.confirmTitle')}</Text>
                <Text variant="sub" center>{label(confirming)}</Text>
                <Button testID="statement-confirm" label={t('common.confirm')} onPress={onGenerate} loading={isLoading} />
                <Button variant="ghost" label={t('common.cancel')} onPress={() => { setConfirming(null); setPickerOpen(false); }} />
              </>
            ) : (
              <ScrollView contentContainerStyle={{ gap: space.xs }}>
                {options.map((o, i) => {
                  const isCurrent = o.year === current.year && o.month === current.month;
                  return (
                    <Pressable
                      key={i}
                      testID={`statement-option-${i}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isCurrent }}
                      onPress={() => { setSelected(o); setConfirming(o); }}
                      style={[row, {
                        gap: space.m, paddingVertical: space.l,
                        borderBottomWidth: i < options.length - 1 ? glassTokens.line : 0, borderBottomColor: c.separator,
                      }]}
                    >
                      <FileText size={20} color={isCurrent ? c.amber : c.ink2} strokeWidth={2} />
                      <Text variant="hl" color={isCurrent ? c.amber : c.ink}>{label(o)}</Text>
                    </Pressable>
                  );
                })}
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

/** Section label — 12/600 uppercase, letter-spacing 0.96, ink3 (§2). */
function SectionLabel({ children }: { children: string }) {
  const urdu = useIsUrdu();
  return <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96 }}>{children}</Text>;
}

/** Stack-screen header: a 44 pt round glass back button, the 28/800 title and a sub-line. */
function BackHeader({ testID, title, sub, onBack }: { testID: string; title: string; sub?: string; onBack: () => void }) {
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
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="h1" weight={800} color={c.ink} numberOfLines={1} style={{ lineHeight: urdu ? undefined : 34 }}>{title}</Text>
        {sub ? <Text variant="sub" color={c.ink2} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}
