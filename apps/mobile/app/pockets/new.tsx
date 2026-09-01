import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, T, Field, PrimaryButton, ErrorBanner, Spacer, Row, useUrdu } from '../../src/components/ui';
import { tokens } from '../../src/theme/tokens';
import { useCreatePocketMutation, apiErr } from '../../src/api/client';

const EMOJIS = ['🕋', '🎓', '🏠', '💍', '🚗', '✈️', '🎁', '🐖'];

export default function NewPocket() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const router = useRouter();
  const [name, setName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [emoji, setEmoji] = useState('🐖');
  const [goalRs, setGoalRs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createPocket, { isLoading }] = useCreatePocketMutation();

  const submit = async () => {
    setError(null);
    try {
      await createPocket({
        name: name.trim(), urduName: urduName.trim() || undefined, emoji,
        goalPaisa: goalRs ? Number(goalRs) * 100 : undefined,
      }).unwrap();
      router.back();
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  return (
    <Screen>
      <T size={tokens.type.h1} style={{ marginVertical: tokens.space.s }}>{t('pockets.new')}</T>
      <ScrollView>
        <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {EMOJIS.map(e => (
            <T key={e} size={30}
              style={{ padding: tokens.space.s, opacity: emoji === e ? 1 : 0.4 }}
              // @ts-expect-error Text onPress
              onPress={() => setEmoji(e)}>
              {e}
            </T>
          ))}
        </Row>
        <Spacer h={tokens.space.s} />
        <Field testID="pocket-name" placeholder={t('pockets.name')} value={name} onChangeText={setName} />
        <Spacer h={tokens.space.s} />
        <Field testID="pocket-urduName" placeholder={t('pockets.urduName')} value={urduName} onChangeText={setUrduName} rtl />
        <Spacer h={tokens.space.s} />
        <Field testID="pocket-goal" placeholder={t('pockets.goal')} keyboardType="number-pad" value={goalRs} onChangeText={setGoalRs} />
        <ErrorBanner message={error} />
        <Spacer />
        <PrimaryButton testID="pocket-create" label={t('common.save')} onPress={submit} disabled={!name.trim() || !emoji} loading={isLoading} />
      </ScrollView>
    </Screen>
  );
}
