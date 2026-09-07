import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Input, Button } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius } from '../../src/theme/tokens';
import { useCreatePocketMutation, apiErr } from '../../src/api/client';

const EMOJIS = ['🕋', '🎓', '🏠', '💍', '🚗', '✈️', '🎁', '🐖'];

export default function NewPocket() {
  const { t } = useTranslation();
  const { c } = useTheme();
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="pocket-new-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </Pressable>
        <Text variant="h2">{t('pockets.new')}</Text>
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.m, paddingBottom: space.xl }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs }}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              testID={`pocket-emoji-${e}`}
              onPress={() => setEmoji(e)}
              hitSlop={6}
              style={{
                width: 48, height: 48, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center',
                backgroundColor: emoji === e ? c.amberTint : 'transparent',
              }}
            >
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <Input testID="pocket-name" placeholder={t('pockets.name')} value={name} onChangeText={setName} />
        <Input testID="pocket-urduName" placeholder={t('pockets.urduName')} value={urduName} onChangeText={setUrduName} style={{ textAlign: 'right', writingDirection: 'rtl' }} />
        <Input testID="pocket-goal" placeholder={t('pockets.goal')} keyboardType="number-pad" value={goalRs} onChangeText={setGoalRs} />
        {error ? <Text color={c.red} center>{error}</Text> : null}
        <Button testID="pocket-create" label={t('common.save')} onPress={submit} disabled={!name.trim() || !emoji} loading={isLoading} />
      </ScrollView>
    </Screen>
  );
}
