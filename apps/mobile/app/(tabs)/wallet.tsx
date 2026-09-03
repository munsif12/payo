// TEMPORARY placeholder — R5 builds the real Wallet screen (balance card,
// quick actions, recent activity). This just proves the tab + AI bar wiring
// on top of the new kit.
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, Text, Card } from '../../src/ui';
import { space } from '../../src/theme/tokens';
import { useMeQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';

export default function Wallet() {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();

  return (
    <Screen>
      <View style={{ paddingTop: space.l, gap: space.xl }}>
        <Text variant="h1">{t('wallet.title')}</Text>
        <Card>
          <Text variant="sub">{t('wallet.available')}</Text>
          <Text variant="money" style={{ marginTop: 4 }}>
            {me ? formatPaisa(me.account.balancePaisa) : '—'}
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
