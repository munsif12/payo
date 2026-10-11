import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { Screen, Text, Card, Input, Button, useIsUrdu, SHEET_RADIUS } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, touch, glassTokens } from '../../src/theme/tokens';
import { usePocketsQuery, usePocketMoveMutation, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';
import type { PocketDto } from '../../src/api/types';

/** The pocket's emoji square (GLASS-SPEC §2 tile icon sizes) and the progress bar. */
const EMOJI_SQUARE = 56;
const PROGRESS_HEIGHT = 8;

// Pockets — GLASS-SPEC §5 B22: the total-saved glass card, one glass card per
// pocket (emoji square, name, "balance of goal", amber percentage, an amber
// progress bar on an `amberTint` track, Add money / Take out), and the amber
// "New pocket" primary. The move sheet is the PIN-sheet vocabulary: `navyDeep`
// body, 28 pt top corners, a glass line on top, black 0.5 backdrop.
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
  const rowDir = urdu ? 'row-reverse' : 'row';

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

  const roundGlass = {
    width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface,
    borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center' as const, justifyContent: 'center' as const,
  };

  return (
    <Screen>
      <View style={{ flexDirection: rowDir, alignItems: 'center', justifyContent: 'space-between', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, flex: 1, minWidth: 0 }}>
          <Pressable testID="pockets-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={roundGlass}>
            <ChevronLeft size={22} color={c.ink} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="h1" numberOfLines={1}>{t('pockets.title')}</Text>
            <Text variant="sub" numberOfLines={1}>{t('pockets.subtitle')}</Text>
          </View>
        </View>
        <Pressable testID="pocket-new" accessibilityRole="button" accessibilityLabel={t('pockets.new')} onPress={() => router.push('/pockets/new')} hitSlop={8} style={roundGlass}>
          <Plus size={22} color={c.ink} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <Card>
          <Text variant="cap">{t('pockets.totalSaved')}</Text>
          <Text variant="money" weight={800} color={c.ink} style={{ fontSize: 36, lineHeight: 44, marginTop: 4, writingDirection: 'ltr' }}>
            {ltrIsolate(formatPaisa(totalPaisa))}
          </Text>
          <Text variant="sub" style={{ marginTop: 4 }}>
            {t('pockets.totalSavedFoot', { count: pockets.length })}
          </Text>
        </Card>

        {pockets.length === 0 && <Text color={c.ink3} center>{t('pockets.empty')}</Text>}

        {pockets.map((p) => {
          const pct = p.goalPaisa ? Math.min(1, p.balancePaisa / p.goalPaisa) : 0;
          return (
            <Card key={p.id} style={{ gap: space.m }}>
              <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m }}>
                <View
                  style={{
                    width: EMOJI_SQUARE, height: EMOJI_SQUARE, borderRadius: 16, backgroundColor: c.surface2,
                    borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Text style={{ fontSize: 26, lineHeight: 32 }}>{p.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="hl" weight={700} numberOfLines={1}>{urdu && p.urduName ? p.urduName : p.name}</Text>
                  <Text variant="sub" numberOfLines={1}>
                    {p.goalPaisa
                      ? t('pockets.ofGoal', { balance: ltrIsolate(formatPaisa(p.balancePaisa)), goal: ltrIsolate(formatPaisa(p.goalPaisa)) })
                      : ltrIsolate(formatPaisa(p.balancePaisa))}
                  </Text>
                </View>
                {p.goalPaisa ? (
                  <Text weight={800} color={c.amber} style={{ fontSize: 22, lineHeight: 28, writingDirection: 'ltr' }}>{ltrIsolate(`${Math.round(pct * 100)}%`)}</Text>
                ) : null}
              </View>

              {p.goalPaisa ? (
                <View
                  accessible
                  accessibilityLabel={t('pockets.pctThere', { pct: Math.round(pct * 100) })}
                  style={{ height: PROGRESS_HEIGHT, borderRadius: PROGRESS_HEIGHT / 2, backgroundColor: c.amberTint, overflow: 'hidden', flexDirection: rowDir }}
                >
                  <View style={{ width: `${pct * 100}%`, height: PROGRESS_HEIGHT, borderRadius: PROGRESS_HEIGHT / 2, backgroundColor: c.amber }} />
                </View>
              ) : null}

              <View style={{ flexDirection: rowDir, gap: space.s }}>
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

        <Button
          testID="pocket-new-bottom"
          label={t('pockets.new')}
          icon={<Plus size={20} color={c.onAmber} strokeWidth={2.4} />}
          onPress={() => router.push('/pockets/new')}
        />
        <Text variant="foot" color={c.ink3} center>{t('pockets.newHint')}</Text>
      </ScrollView>

      <Modal visible={!!move} transparent animationType="slide" onRequestClose={() => setMove(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: glassTokens.backdrop.color, opacity: glassTokens.backdrop.opacity }]} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              style={{
                backgroundColor: c.navyDeep, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS,
                borderTopWidth: glassTokens.line, borderColor: c.separator, padding: space.xl, paddingBottom: space.xxxl, gap: space.m,
              }}
            >
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.surface2, marginBottom: space.xs }} />
              <Text variant="h2" center>
                {move ? t(move.op === 'deposit' ? 'pockets.deposit' : 'pockets.withdraw') : ''}
              </Text>
              {move ? <Text variant="sub" center>{urdu && move.pocket.urduName ? move.pocket.urduName : move.pocket.name}</Text> : null}
              <Input testID="pocket-amount" placeholder={t('common.amount')} keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
              {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}
              <Button testID="pocket-move-next" label={t('common.next')} onPress={submitMove} disabled={!(Number(rupees) > 0)} loading={isLoading} />
              <Button variant="ghost" label={t('common.cancel')} onPress={() => { setMove(null); setError(null); }} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}
