import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { QrCode, ScanLine } from 'lucide-react-native';
import { Screen, Text, Input, Card, Chip, Button } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useMyQrQuery, useResolveQrMutation, apiErr } from '../../src/api/client';

export default function Qr() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: 'mine' | 'scan' }>();
  const [tab, setTab] = useState<'mine' | 'scan'>(params.tab === 'scan' ? 'scan' : 'mine');
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
      <View style={{ flexDirection: 'row', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Chip
          testID="qr-tab-mine"
          label={t('qr.myCode')}
          selected={tab === 'mine'}
          onPress={() => setTab('mine')}
        />
        <Chip
          testID="qr-tab-scan"
          label={t('qr.scan')}
          selected={tab === 'scan'}
          onPress={() => setTab('scan')}
        />
      </View>

      {tab === 'mine' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l }}>
          <Card padding={space.xl} style={{ backgroundColor: c.white }}>
            {mine ? <QRCode value={mine.payload} size={220} /> : <QrCode size={64} color={c.ink3} strokeWidth={1.5} />}
          </Card>
          <Text variant="sub" center>{t('qr.myCodeHint')}</Text>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', gap: space.l }}>
          <View style={{ alignItems: 'center', gap: space.m }}>
            <ScanLine size={40} color={c.ink3} strokeWidth={1.5} />
            {/* Camera scanning is unavailable on simulators — paste fallback keeps the flow testable. */}
            <Text variant="sub" center>{t('qr.pasteHint')}</Text>
          </View>
          <Input testID="qr-paste" placeholder="payo:v1:…" autoCapitalize="none" value={pasted} onChangeText={setPasted} />
          {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}
          <Button testID="qr-resolve" label={t('common.next')} onPress={onResolve} disabled={!pasted.trim()} loading={isLoading} />
        </View>
      )}
    </Screen>
  );
}
