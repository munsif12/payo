import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Plus } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { Screen, Text, Card, Input, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, touch } from '../../src/theme/tokens';
import { usePressScale } from '../../src/motion/usePressScale';
import { usePocketsQuery, usePocketMoveMutation, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';
import type { PocketDto } from '../../src/api/types';

export default function Pockets() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { data } = usePocketsQuery();
  const [move, setMove] = useState<{ pocket: PocketDto; op: 'deposit' | 'withdraw' } | null>(null);
  const [rupees, setRupees] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pocketMove, { isLoading }] = usePocketMoveMutation();

  const pockets = data?.items ?? [];
  const totalPaisa = pockets.reduce((sum, p) => sum + p.balancePaisa, 0);

  const submitMove = async () => {
    setError(null);
    try {
      const action = await pocketMove({ id: move!.pocket.id, op: move!.op, amountPaisa: Number(rupees) * 100 }).unwrap();
      setMove(null);
      setRupees('');
      holdAction(action);
      router.push({ pathname: '/confirm/[actionId]', params: { actionId: action.id } });
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.l, marginBottom: space.l }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Pressable testID="pockets-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={c.ink} strokeWidth={2} />
          </Pressable>
          <Text variant="h2">{t('pockets.title')}</Text>
        </View>
        <Pressable
          testID="pocket-new"
          accessibilityRole="button"
          onPress={() => router.push('/pockets/new')}
          hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={22} color={c.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <Card style={{ backgroundColor: c.navy }}>
          <Text variant="cap" color="rgba(255,255,255,0.6)">{t('pockets.totalSaved')}</Text>
          <Text variant="money" weight={800} color={c.white} style={{ fontSize: 36, lineHeight: 42, marginTop: 4 }}>
            {ltrIsolate(formatPaisa(totalPaisa))}
          </Text>
          <Text variant="foot" color="rgba(255,255,255,0.6)" style={{ marginTop: 4 }}>
            {t('pockets.totalSavedFoot', { count: pockets.length })}
          </Text>
        </Card>

        {pockets.length === 0 && <Text color={c.ink3} center>{t('pockets.empty')}</Text>}

        {pockets.map((p) => {
          const pct = p.goalPaisa ? Math.min(1, p.balancePaisa / p.goalPaisa) : 0;
          return (
            <Card key={p.id} style={{ gap: space.m }}>
              <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="hl" numberOfLines={1}>{urdu && p.urduName ? p.urduName : p.name}</Text>
                  {p.goalPaisa ? (
                    <Text variant="foot" numberOfLines={1}>{t('pockets.goalFoot', { goal: ltrIsolate(formatPaisa(p.goalPaisa)) })}</Text>
                  ) : null}
                </View>
                <Text variant="hl">{ltrIsolate(formatPaisa(p.balancePaisa))}</Text>
              </View>

              {p.goalPaisa ? (
                <View style={{ gap: 6 }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' }}>
                    <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: c.amber }} />
                  </View>
                  <Text variant="foot">{t('pockets.pctThere', { pct: Math.round(pct * 100) })}</Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: space.s }}>
                <View style={{ flex: 1 }}>
                  <Button testID={`pocket-deposit-${p.id}`} label={t('pockets.deposit')} onPress={() => setMove({ pocket: p, op: 'deposit' })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID={`pocket-withdraw-${p.id}`} variant="secondary" label={t('pockets.withdraw')} onPress={() => setMove({ pocket: p, op: 'withdraw' })} />
                </View>
              </View>
            </Card>
          );
        })}

        <TertiaryButton
          testID="pocket-new-bottom"
          label={t('pockets.new')}
          icon={<Plus size={20} color={c.white} strokeWidth={2} />}
          onPress={() => router.push('/pockets/new')}
        />
      </ScrollView>

      <Modal visible={!!move} transparent animationType="slide" onRequestClose={() => setMove(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: space.l, gap: space.m }}>
            <Text variant="h2" center>
              {move ? t(move.op === 'deposit' ? 'pockets.deposit' : 'pockets.withdraw') : ''}
            </Text>
            <Input testID="pocket-amount" placeholder={t('common.amount')} keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
            {error ? <Text color={c.red} center>{error}</Text> : null}
            <Button testID="pocket-move-next" label={t('common.next')} onPress={submitMove} disabled={!(Number(rupees) > 0)} loading={isLoading} />
            <Button variant="ghost" label={t('common.cancel')} onPress={() => { setMove(null); setError(null); }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Pockets.dc.html "New pocket": a navy-filled pill — the app's third button
// weight (primary amber / secondary cream / this, tertiary navy) alongside
// the shared Button component's variants.
function TertiaryButton({ label, icon, onPress, testID }: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const { style, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        {
          height: touch.primary, minHeight: touch.min, borderRadius: radius.button,
          backgroundColor: c.navy, alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 8,
        },
        style,
      ]}
    >
      {icon}
      <Text variant="hl" weight={700} color={c.white}>{label}</Text>
    </AnimatedPressable>
  );
}
