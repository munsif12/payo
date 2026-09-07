import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import {
  PiggyBank, CreditCard, FileText, Users, Globe, ShieldCheck, Bell, HelpCircle, LogOut,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { Screen, Text, Card, ListRow, Avatar, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import { signedOut } from '../../src/store/authSlice';
import { useMeQuery, usePocketsQuery, useRequestsQuery } from '../../src/api/client';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';
import i18n from '../../src/i18n';

export default function More() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const dispatch = useDispatch();
  const { data: me } = useMeQuery();
  const { data: pockets } = usePocketsQuery();
  const { data: requests } = useRequestsQuery();

  const user = me?.user;
  const name = urdu && user?.urduName ? user.urduName : user?.name ?? '';
  const totalPocketPaisa = (pockets?.items ?? []).reduce((sum, p) => sum + p.balancePaisa, 0);
  const pendingRequests = (requests?.items ?? []).filter((r) => r.status === 'pending' && r.direction === 'incoming').length;
  const languageLabel = i18n.language === 'ur' ? t('profile.urdu') : t('profile.english');

  return (
    <Screen>
      <View style={{ paddingTop: space.l }}>
        <Text variant="h2" style={{ marginBottom: space.l }}>{t('more.title')}</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
          <Pressable testID="more-profile-header" onPress={() => router.push('/profile')}>
            <Card style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
              <Avatar name={name || '?'} size={48} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="hl" numberOfLines={1}>{name}</Text>
                <Text variant="foot" numberOfLines={1}>{ltrIsolate(user?.phone ?? '')}</Text>
              </View>
            </Card>
          </Pressable>

          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            <ListRow
              testID="more-pockets"
              onPress={() => router.push('/pockets')}
              left={<Icon icon={PiggyBank} c={c} />}
              title={t('more.pockets')}
              subtitle={t('more.pocketsFoot', { count: pockets?.items.length ?? 0, amount: ltrIsolate(formatPaisa(totalPocketPaisa)) })}
              showChevron
            />
            <ListRow
              testID="more-card"
              onPress={() => router.push('/card')}
              left={<Icon icon={CreditCard} c={c} />}
              title={t('more.card')}
              subtitle={me?.card.frozen ? t('card.frozen') : t('more.cardFoot')}
              showChevron
            />
            <ListRow
              testID="more-statements"
              onPress={() => router.push('/statements')}
              left={<Icon icon={FileText} c={c} />}
              title={t('more.statements')}
              showChevron
            />
            <ListRow
              testID="more-requests"
              onPress={() => router.push('/requests')}
              left={<Icon icon={Users} c={c} />}
              title={t('more.requests')}
              subtitle={pendingRequests > 0 ? t('more.requestsFoot', { count: pendingRequests }) : undefined}
              showChevron
              separator={false}
            />
          </Card>

          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            <ListRow
              testID="more-language"
              onPress={() => router.push('/profile')}
              left={<Icon icon={Globe} c={c} />}
              title={t('more.language')}
              right={<Text variant="sub">{languageLabel}</Text>}
            />
            <ListRow
              testID="more-settings"
              onPress={() => router.push('/settings')}
              left={<Icon icon={SettingsIcon} c={c} />}
              title={t('more.settings')}
              subtitle={t('more.settingsFoot')}
              showChevron
            />
            <ListRow
              testID="more-security"
              left={<Icon icon={ShieldCheck} c={c} />}
              title={t('more.security')}
              showChevron
            />
            <ListRow
              testID="more-notifications"
              left={<Icon icon={Bell} c={c} />}
              title={t('more.notifications')}
              showChevron
            />
            <ListRow
              testID="more-help"
              left={<Icon icon={HelpCircle} c={c} />}
              title={t('more.help')}
              showChevron
              separator={false}
            />
          </Card>

          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            <ListRow
              testID="more-logout"
              onPress={() => dispatch(signedOut())}
              left={<Icon icon={LogOut} c={c} tint="danger" />}
              title={<Text variant="hl" color={c.red}>{t('auth.logout')}</Text>}
              showChevron
              separator={false}
            />
          </Card>

          <Text variant="foot" center>{t('more.version')}</Text>
        </ScrollView>
      </View>
    </Screen>
  );
}

function Icon({ icon: IconCmp, c, tint }: { icon: typeof PiggyBank; c: ReturnType<typeof useTheme>['c']; tint?: 'danger' }) {
  const bg = tint === 'danger' ? c.redTint : c.amberTint;
  const color = tint === 'danger' ? c.red : c.navy;
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <IconCmp size={20} color={color} strokeWidth={2} />
    </View>
  );
}
