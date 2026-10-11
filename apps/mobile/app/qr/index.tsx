import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { ChevronLeft, QrCode, ScanLine } from 'lucide-react-native';
import { Screen, Text, Input, Card, Chip, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import { useMyQrQuery, useMeQuery, useResolveQrMutation, useResolveRecipientMutation, usePayoInstitution, apiErr } from '../../src/api/client';
import { ltrIsolate } from '../../src/lib/bidi';

const QR_SIZE = 200;

// QR — GLASS-SPEC §5 B26: the code on a cream 24-radius card (navy modules on
// cream, so it scans), the name above and the phone line below, "My code" /
// "Scan" as glass chips (amber when selected).
export default function Qr() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: 'mine' | 'scan' }>();
  const [tab, setTab] = useState<'mine' | 'scan'>(params.tab === 'scan' ? 'scan' : 'mine');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: mine } = useMyQrQuery();
  const { data: me } = useMeQuery();
  const [resolve, { isLoading: resolvingQr }] = useResolveQrMutation();
  const [resolveRecipient, { isLoading: resolvingRecipient }] = useResolveRecipientMutation();
  const payoInstitution = usePayoInstitution();
  const rowDir = urdu ? 'row-reverse' : 'row';

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

  const displayName = (urdu && me?.user.urduName) || me?.user.name || '';

  return (
    <Screen>
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable
          testID="qr-back"
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
          <Text variant="h1" numberOfLines={1}>{tab === 'mine' ? t('qr.myTitle') : t('qr.scanTitle')}</Text>
          <Text variant="sub" numberOfLines={1}>{tab === 'mine' ? t('qr.mySubtitle') : t('qr.pasteHint')}</Text>
        </View>
      </View>

      <View style={{ flexDirection: rowDir, gap: space.s, marginBottom: space.l }}>
        <Chip testID="qr-tab-mine" label={t('qr.myCode')} selected={tab === 'mine'} onPress={() => setTab('mine')} />
        <Chip testID="qr-tab-scan" label={t('qr.scan')} selected={tab === 'scan'} onPress={() => setTab('scan')} />
      </View>

      {tab === 'mine' ? (
        <View style={{ flex: 1, gap: space.l }}>
          <Card padding={space.xxl} style={{ backgroundColor: c.cream, borderColor: c.cream, alignItems: 'center', gap: space.m }}>
            {displayName ? <Text variant="h2" color={c.navy} center numberOfLines={1}>{displayName}</Text> : null}
            {mine ? (
              <QRCode value={mine.payload} size={QR_SIZE} color={c.navy} backgroundColor={c.cream} />
            ) : (
              <View style={{ width: QR_SIZE, height: QR_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={64} color={c.navy} strokeWidth={1.5} />
              </View>
            )}
            {me?.user.phone ? (
              <Text variant="sub" color={c.navy} center style={{ writingDirection: 'ltr' }}>{ltrIsolate(`${me.user.phone} · ${t('appName')}`)}</Text>
            ) : null}
          </Card>
          <Text variant="foot" color={c.ink3} center>{t('qr.anyoneHint')}</Text>
        </View>
      ) : (
        <View style={{ flex: 1, gap: space.l }}>
          <Card padding={space.xl} style={{ alignItems: 'center', gap: space.m }}>
            <ScanLine size={44} color={c.amber} strokeWidth={1.5} />
            {/* Camera scanning is unavailable on simulators — paste fallback keeps the flow testable. */}
            <Text variant="sub" center>{t('qr.pasteHint')}</Text>
          </Card>
          <Input testID="qr-paste" placeholder="payo:v1:…" autoCapitalize="none" value={pasted} onChangeText={setPasted} />
          {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}
          <Button testID="qr-resolve" label={t('common.next')} onPress={onResolve} disabled={!pasted.trim()} loading={resolvingQr || resolvingRecipient} />
        </View>
      )}
    </Screen>
  );
}
