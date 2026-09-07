import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { ChevronLeft, QrCode, ScanLine } from 'lucide-react-native';
import { Screen, Text, Input, Card, Chip, Button } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { useMyQrQuery, useResolveQrMutation, useResolveRecipientMutation, usePayoInstitution, apiErr } from '../../src/api/client';

export default function Qr() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: 'mine' | 'scan' }>();
  const [tab, setTab] = useState<'mine' | 'scan'>(params.tab === 'scan' ? 'scan' : 'mine');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: mine } = useMyQrQuery();
  const [resolve, { isLoading: resolvingQr }] = useResolveQrMutation();
  const [resolveRecipient, { isLoading: resolvingRecipient }] = useResolveRecipientMutation();
  const payoInstitution = usePayoInstitution();

  const onResolve = async () => {
    setError(null);
    try {
      const { user } = await resolve({ payload: pasted.trim() }).unwrap();
      // A scanned QR is always a PAYO wallet user — resolve straight through
      // /transfers/resolve with the PAYO institution and skip the bank/wallet picker.
      if (payoInstitution) {
        const resolved = await resolveRecipient({ institutionId: payoInstitution.id, identifier: user.phone }).unwrap();
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
      } else {
        router.push({ pathname: '/send', params: { phone: user.phone } });
      }
    } catch (e) {
      setError(apiErr(e).code === 'INVALID_QR' ? t('qr.invalid') : apiErr(e).message);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="qr-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
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
          <Button testID="qr-resolve" label={t('common.next')} onPress={onResolve} disabled={!pasted.trim()} loading={resolvingQr || resolvingRecipient} />
        </View>
      )}
    </Screen>
  );
}
