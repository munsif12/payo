import React from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Card, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { maskIdentifier } from '../../src/lib/mask';
import { ltrIsolate } from '../../src/lib/bidi';

export default function ResolvedRecipientScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const params = useLocalSearchParams<{
    title: string; institutionId: string; institutionName: string; institutionUrduName?: string;
    institutionKind: string; identifier: string; linkedUserId?: string;
  }>();

  const institutionLabel = urdu && params.institutionUrduName ? params.institutionUrduName : params.institutionName;

  const goAmount = () =>
    router.push({
      pathname: '/send/amount',
      params: {
        institutionId: params.institutionId, identifier: params.identifier,
        title: params.title, institutionName: params.institutionName,
        institutionUrduName: params.institutionUrduName ?? '',
      },
    });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="recipient-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('send.recipientTitle')}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <Card style={{ alignItems: 'center', gap: space.m }}>
          <Avatar name={params.title ?? ''} size={64} />
          <Text variant="h2" center>{params.title}</Text>
          <Text variant="foot" center>{ltrIsolate(`${institutionLabel} · ${maskIdentifier(params.identifier ?? '')}`)}</Text>
        </Card>

        <Pressable testID="recipient-change" onPress={() => router.back()} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text variant="sub" weight={600} color={c.amberDeep}>{t('send.notYouChange')}</Text>
        </Pressable>
      </View>

      <Button testID="recipient-continue" label={t('common.continue')} onPress={goAmount} />
    </Screen>
  );
}
