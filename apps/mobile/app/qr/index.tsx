import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { Screen, T, Field, PrimaryButton, Card, ErrorBanner, Spacer, Row } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useMyQrQuery, useResolveQrMutation, apiErr } from '../../src/api/client';

export default function Qr() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<'mine' | 'scan'>('mine');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: mine } = useMyQrQuery();
  const [resolve, { isLoading }] = useResolveQrMutation();

  const onResolve = async () => {
    setError(null);
    try {
      const { user } = await resolve({ payload: pasted.trim() }).unwrap();
      router.push({ pathname: '/send', params: { phone: user.phone } });
    } catch (e) {
      setError(apiErr(e).code === 'INVALID_QR' ? t('qr.invalid') : apiErr(e).message);
    }
  };

  return (
    <Screen>
      <Row style={{ marginVertical: tokens.space.s, gap: tokens.space.s }}>
        {(['mine', 'scan'] as const).map(k => (
          <Pressable
            key={k}
            testID={`qr-tab-${k}`}
            onPress={() => setTab(k)}
            style={{
              flex: 1, borderRadius: tokens.radius.pill, paddingVertical: tokens.space.s,
              backgroundColor: tab === k ? tokens.color.accent : tokens.color.surface,
            }}
          >
            <T center color={tab === k ? tokens.color.bg : tokens.color.text}>
              {t(k === 'mine' ? 'qr.myCode' : 'qr.scan')}
            </T>
          </Pressable>
        ))}
      </Row>

      {tab === 'mine' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Card style={{ backgroundColor: '#FFFFFF', padding: tokens.space.xl }}>
            {mine ? <QRCode value={mine.payload} size={220} /> : <T>{t('common.loading')}</T>}
          </Card>
          <Spacer />
          <T center color={tokens.color.textMuted}>{t('qr.myCodeHint')}</T>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* Camera scanning is unavailable on simulators — paste fallback keeps the flow testable. */}
          <T center color={tokens.color.textMuted}>{t('qr.pasteHint')}</T>
          <Spacer h={tokens.space.s} />
          <Field testID="qr-paste" placeholder="payo:v1:…" autoCapitalize="none" value={pasted} onChangeText={setPasted} />
          <ErrorBanner message={error} />
          <Spacer />
          <PrimaryButton testID="qr-resolve" label={t('common.next')} onPress={onResolve} disabled={!pasted.trim()} loading={isLoading} />
        </View>
      )}
    </Screen>
  );
}
