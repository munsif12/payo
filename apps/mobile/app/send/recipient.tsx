import React from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Card, Avatar, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, touch, glassTokens } from '../../src/theme/tokens';
import { maskIdentifier } from '../../src/lib/mask';
import { ltrIsolate } from '../../src/lib/bidi';

/** B17 resolved-recipient card: the person's cream avatar, large. */
const AVATAR = 72;

/** GLASS-SPEC §5 B17: the 44 pt round glass back button in the head. */
function BackButton({ testID, onPress }: { testID: string; onPress: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={{
        width: touch.min, height: touch.min, borderRadius: touch.min / 2,
        backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}

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
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.xl }}>
        <BackButton testID="recipient-back" onPress={() => router.back()} />
        <Text variant="h1" style={{ flex: 1 }}>{t('send.recipientTitle')}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <Card style={{ alignItems: 'center', gap: space.m }}>
          {/* People you pay wear the cream avatar (GLASS-SPEC §2 "Avatar"). */}
          <Avatar name={params.title ?? ''} size={AVATAR} bg={c.cream} color={c.navy} />
          <Text variant="h2" center>{params.title}</Text>
          <Text variant="sub" color={c.ink2} center>{ltrIsolate(`${institutionLabel} · ${maskIdentifier(params.identifier ?? '')}`)}</Text>
        </Card>

        <Pressable testID="recipient-change" accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text variant="sub" weight={600} color={c.amber}>{t('send.notYouChange')}</Text>
        </Pressable>
      </View>

      <Button testID="recipient-continue" label={t('common.continue')} onPress={goAmount} style={{ marginBottom: space.l }} />
    </Screen>
  );
}
