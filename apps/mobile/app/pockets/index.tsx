import React, { useState } from 'react';
import { ScrollView, View, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Mono, Card, Field, PrimaryButton, ErrorBanner, Spacer, Row, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { usePocketsQuery, usePocketMoveMutation, apiErr } from '../../src/api/client';
import { holdAction } from '../../src/store/pendingActionHolder';
import { formatPaisa } from '../../src/lib/money';
import type { PocketDto } from '../../src/api/types';

export default function Pockets() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const { data } = usePocketsQuery();
  const [move, setMove] = useState<{ pocket: PocketDto; op: 'deposit' | 'withdraw' } | null>(null);
  const [rupees, setRupees] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pocketMove, { isLoading }] = usePocketMoveMutation();

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
      <Row style={{ justifyContent: 'space-between', marginVertical: tokens.space.s }}>
        <T size={tokens.type.h1}>{t('pockets.title')}</T>
        <Pressable testID="pocket-new" onPress={() => router.push('/pockets/new')}
          style={{ backgroundColor: tokens.color.accent, borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.m, paddingVertical: 6 }}>
          <T size={tokens.type.caption} color={tokens.color.bg}>{t('pockets.new')}</T>
        </Pressable>
      </Row>
      <ScrollView>
        {(data?.items ?? []).length === 0 && <T center color={tokens.color.textMuted}>{t('pockets.empty')}</T>}
        {(data?.items ?? []).map(p => {
          const pct = p.goalPaisa ? Math.min(1, p.balancePaisa / p.goalPaisa) : 0;
          return (
            <Card key={p.id} style={{ marginBottom: tokens.space.m }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T size={tokens.type.h2}>{p.emoji} {urdu && p.urduName ? p.urduName : p.name}</T>
                <Mono weight="800" color={tokens.color.accent}>{formatPaisa(p.balancePaisa)}</Mono>
              </Row>
              {p.goalPaisa ? (
                <>
                  <Spacer h={tokens.space.s} />
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: tokens.color.surfaceRaised, overflow: 'hidden' }}>
                    <View style={{ width: `${pct * 100}%`, height: 10, backgroundColor: tokens.color.accent }} />
                  </View>
                  <Mono size={tokens.type.caption} color={tokens.color.textMuted}>
                    {`${Math.round(pct * 100)}% · ${t('pockets.of')} ${formatPaisa(p.goalPaisa)}`}
                  </Mono>
                </>
              ) : null}
              <Spacer h={tokens.space.s} />
              <Row gap={tokens.space.s}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton testID={`pocket-deposit-${p.id}`} label={t('pockets.deposit')} onPress={() => setMove({ pocket: p, op: 'deposit' })} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton testID={`pocket-withdraw-${p.id}`} label={t('pockets.withdraw')} onPress={() => setMove({ pocket: p, op: 'withdraw' })} danger />
                </View>
              </Row>
            </Card>
          );
        })}
      </ScrollView>

      <Modal visible={!!move} transparent animationType="slide" onRequestClose={() => setMove(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: tokens.color.surface, borderTopLeftRadius: tokens.radius.card, borderTopRightRadius: tokens.radius.card, padding: tokens.space.l }}>
            <T size={tokens.type.h2} center>
              {move ? t(move.op === 'deposit' ? 'pockets.deposit' : 'pockets.withdraw') : ''}
            </T>
            <Spacer />
            <Field testID="pocket-amount" placeholder={t('common.amount')} keyboardType="number-pad" value={rupees} onChangeText={setRupees} />
            <ErrorBanner message={error} />
            <Spacer />
            <PrimaryButton testID="pocket-move-next" label={t('common.next')} onPress={submitMove} disabled={!(Number(rupees) > 0)} loading={isLoading} />
            <Spacer h={tokens.space.s} />
            <PrimaryButton label={t('common.cancel')} onPress={() => { setMove(null); setError(null); }} danger />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}
