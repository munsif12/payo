import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { Screen, Text, Card, Input, Button, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, touch, glassTokens } from '../../src/theme/tokens';
import { useCreatePocketMutation, apiErr } from '../../src/api/client';

const EMOJIS = ['🕋', '🎓', '🏠', '💍', '🚗', '✈️', '🎁', '🐖'];
const EMOJI_TILE = 52;

// New pocket — GLASS-SPEC §5 B22: a glass form — the emoji picker as small glass
// tiles (selected = amberTint fill + amber line), three glass inputs, amber Save.
export default function NewPocket() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const [name, setName] = useState('');
  const [urduName, setUrduName] = useState('');
  const [emoji, setEmoji] = useState('🐖');
  const [goalRs, setGoalRs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createPocket, { isLoading }] = useCreatePocketMutation();
  const rowDir = urdu ? 'row-reverse' : 'row';

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
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable
          testID="pocket-new-back"
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
          <Text variant="h1" numberOfLines={1}>{t('pockets.new')}</Text>
          <Text variant="sub" numberOfLines={1}>{t('pockets.subtitle')}</Text>
        </View>
      </View>

      <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xl }}>
        <Card padding={space.l} style={{ gap: space.m }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s }}>
            {EMOJIS.map((e) => {
              const selected = emoji === e;
              return (
                <Pressable
                  key={e}
                  testID={`pocket-emoji-${e}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setEmoji(e)}
                  hitSlop={4}
                  style={{
                    width: EMOJI_TILE, height: EMOJI_TILE, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? c.amberTint : c.surface,
                    borderWidth: selected ? glassTokens.inputFocusLine : glassTokens.line,
                    borderColor: selected ? c.amber : c.separator,
                  }}
                >
                  <Text style={{ fontSize: 26, lineHeight: 32 }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
          <Input testID="pocket-name" placeholder={t('pockets.name')} value={name} onChangeText={setName} />
          <Input testID="pocket-urduName" placeholder={t('pockets.urduName')} value={urduName} onChangeText={setUrduName} style={{ textAlign: 'right', writingDirection: 'rtl' }} />
          <Input testID="pocket-goal" placeholder={t('pockets.goal')} keyboardType="number-pad" value={goalRs} onChangeText={setGoalRs} />
        </Card>
        {error ? <Text variant="sub" color={c.red} center>{error}</Text> : null}
        <Button testID="pocket-create" label={t('common.save')} onPress={submit} disabled={!name.trim() || !emoji} loading={isLoading} />
      </ScrollView>
    </Screen>
  );
}
