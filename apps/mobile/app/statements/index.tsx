import React, { useState } from 'react';
import { ScrollView, View, Pressable, Modal, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Screen, T, Mono, ListRow, PrimaryButton, ErrorBanner, Spacer, Row, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useStatementsQuery, useGenerateStatementMutation, apiErr } from '../../src/api/client';
import { apiBase } from '../../src/lib/backendUrl';
import type { RootState } from '../../src/store';
import { formatPaisa } from '../../src/lib/money';

const UR_MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Statements() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const token = useSelector((s: RootState) => s.auth.token);
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

  const openPdf = async (id: string) => {
    // WebBrowser can't send Authorization headers; pass the token via query is not supported
    // by the backend — so fetch to a data url is overkill for the demo: open via fetch+share.
    try {
      const url = `${apiBase()}/statements/${id}/pdf`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const FileSystem = await import('expo-file-system/legacy');
        const Sharing = await import('expo-sharing');
        const base64 = String(reader.result).split(',')[1];
        const path = `${FileSystem.cacheDirectory}statement-${id}.pdf`;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/pdf' });
        else await WebBrowser.openBrowserAsync(path);
      };
      reader.readAsDataURL(blob);
    } catch {
      Alert.alert('PDF', 'Could not open the PDF');
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginVertical: tokens.space.s }}>
        <T size={tokens.type.h1}>{t('statements.title')}</T>
        <Pressable testID="statement-new" onPress={() => setPickerOpen(true)}
          style={{ backgroundColor: tokens.color.accent, borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.m, paddingVertical: 6 }}>
          <T size={tokens.type.caption} color={tokens.color.bg}>{t('statements.generate')}</T>
        </Pressable>
      </Row>
      <ErrorBanner message={error} />
      <ScrollView>
        {(data?.items ?? []).length === 0 && <T center color={tokens.color.textMuted}>{t('statements.empty')}</T>}
        {(data?.items ?? []).map(s => (
          <ListRow
            key={s.id}
            testID={`statement-${s.id}`}
            left={<T size={24}>📄</T>}
            title={<T>{label({ year: s.year, month: s.month })}</T>}
            subtitle={
              <Mono size={tokens.type.caption} color={tokens.color.textMuted} weight="400">
                {`${t('statements.moneyIn')} ${formatPaisa(s.totalInPaisa)} · ${t('statements.moneyOut')} ${formatPaisa(s.totalOutPaisa)}`}
              </Mono>
            }
            right={
              <Pressable testID={`statement-download-${s.id}`} onPress={() => openPdf(s.id)}
                style={{ backgroundColor: tokens.color.accent, borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.m, paddingVertical: 8 }}>
                <T size={tokens.type.caption} color={tokens.color.bg}>{t('statements.download')}</T>
              </Pressable>
            }
          />
        ))}
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: tokens.color.surface, borderTopLeftRadius: tokens.radius.card, borderTopRightRadius: tokens.radius.card, padding: tokens.space.l, maxHeight: '75%' }}>
            {confirming ? (
              <>
                <T size={tokens.type.h2} center>{t('statements.confirmTitle')}</T>
                <T center color={tokens.color.textMuted}>{label(confirming)}</T>
                <Spacer />
                <PrimaryButton testID="statement-confirm" label={t('common.confirm')} onPress={onGenerate} loading={isLoading} />
                <Spacer h={tokens.space.s} />
                <PrimaryButton label={t('common.cancel')} onPress={() => setConfirming(null)} danger />
              </>
            ) : (
              <ScrollView>
                {options.map((o, i) => (
                  <ListRow key={i} testID={`statement-option-${i}`} onPress={() => setConfirming(o)}
                    left={<T size={22}>📅</T>} title={<T>{label(o)}</T>} />
                ))}
                <PrimaryButton label={t('common.cancel')} onPress={() => setPickerOpen(false)} danger />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
