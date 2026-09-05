import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Share2 } from 'lucide-react-native';
import { Screen, Text, Button, Pill, Input, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space } from '../src/theme/tokens';
import { useReducedMotion } from '../src/motion/useReducedMotion';
import { SUCCESS_CHECK_MS, SUCCESS_TEXT_MS, RISE_TRANSLATE_Y, EASE_OUT } from '../src/motion/config';
import { formatPaisa } from '../src/lib/money';
import { useCreateRecipientMutation, useCreateSavedBillerMutation, apiErr } from '../src/api/client';
import type { RecipientSuggestion, BillerSuggestion, Txn } from '../src/api/types';
import { useOutcomeSpeech } from '../src/voice/OutcomeSpeechProvider';

const easeInOut = Easing.inOut(Easing.ease);
const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

function parseJson<T>(raw?: string): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export default function Success() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { refNo, amountPaisa, summary, txn: txnRaw, recipientSuggestion: recipientSuggestionRaw, billerSuggestion: billerSuggestionRaw } =
    useLocalSearchParams<{ refNo: string; amountPaisa: string; summary?: string; txn?: string; recipientSuggestion?: string; billerSuggestion?: string }>();
  const reducedMotion = useReducedMotion();
  const checkProgress = useSharedValue(reducedMotion ? 1 : 0);
  // Text block rises SUCCESS_TEXT_MS after the check lands at SUCCESS_CHECK_MS
  // (Motion.dc.html "Success": "check draws + lands first, then amount and ref rise").
  const textProgress = useSharedValue(reducedMotion ? 1 : 0);

  const recipientSuggestion = useMemo(() => parseJson<RecipientSuggestion>(recipientSuggestionRaw), [recipientSuggestionRaw]);
  const billerSuggestion = useMemo(() => parseJson<BillerSuggestion>(billerSuggestionRaw), [billerSuggestionRaw]);
  const target: 'recipient' | 'biller' | null = recipientSuggestion ? 'recipient' : billerSuggestion ? 'biller' : null;
  const defaultNickname = target === 'recipient' ? (recipientSuggestion?.title ?? '') : (billerSuggestion?.consumerName ?? '');

  const [saveEnabled, setSaveEnabled] = useState(false);
  const [nickname, setNickname] = useState(defaultNickname);
  const [saved, setSaved] = useState(Boolean(recipientSuggestion?.alreadySaved || billerSuggestion?.alreadySaved));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createRecipient] = useCreateRecipientMutation();
  const [createSavedBiller] = useCreateSavedBillerMutation();

  // F2: the classic (non-chat) flows land here after the PIN sheet, and until now
  // said nothing out loud. Spoken once per mount — `spokenRef` rather than the
  // effect's own dependency list, because Strict Mode runs mount effects twice
  // and paying twice as much for TTS is not the kind of echo anyone wants.
  const { speak } = useOutcomeSpeech();
  const spokenRef = useRef(false);
  const txn = useMemo(() => parseJson<Txn>(txnRaw), [txnRaw]);
  useEffect(() => {
    if (spokenRef.current || !txn) return;
    spokenRef.current = true;
    speak({ transaction: txn }, { kind: 'classic', amountPaisa: txn.amountPaisa });
  }, [txn, speak]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!reducedMotion) {
      checkProgress.value = withTiming(1, { duration: SUCCESS_CHECK_MS, easing: easeInOut });
      textProgress.value = withDelay(SUCCESS_CHECK_MS, withTiming(1, { duration: SUCCESS_TEXT_MS, easing: easeOut }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkProgress.value,
    transform: [{ scale: 0.5 + checkProgress.value * 0.5 }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - textProgress.value) * RISE_TRANSLATE_Y }],
  }));

  const onDone = async () => {
    if (target && saveEnabled && !saved && nickname.trim()) {
      setError(null);
      setSaving(true);
      try {
        if (target === 'recipient' && recipientSuggestion) {
          await createRecipient({
            nickname: nickname.trim(), institutionId: recipientSuggestion.institutionId, identifier: recipientSuggestion.identifier,
          }).unwrap();
        } else if (target === 'biller' && billerSuggestion) {
          await createSavedBiller({
            nickname: nickname.trim(), billerId: billerSuggestion.billerId, consumerNo: billerSuggestion.consumerNo,
          }).unwrap();
        }
        setSaved(true);
        setSaving(false);
        return;
      } catch (e) {
        setError(apiErr(e).message);
        setSaving(false);
        return;
      }
    }
    router.dismissAll();
  };

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, paddingHorizontal: space.xl }}>
        <Animated.View
          style={[
            { width: 112, height: 112, borderRadius: 56, backgroundColor: c.greenTint, alignItems: 'center', justifyContent: 'center' },
            checkStyle,
          ]}
        >
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={40} color={c.white} strokeWidth={3} />
          </View>
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', gap: space.m, alignSelf: 'stretch' }, textStyle]}>
          <Text variant="h1" center style={{ marginTop: 8 }}>{t('success.title')}</Text>
          <Text variant="sub" center>{summary || t('success.sent')}</Text>
          {amountPaisa ? <Text variant="money">{formatPaisa(Number(amountPaisa))}</Text> : null}
          {refNo ? <Pill label={t('success.refPill', { ref: refNo })} bg={c.surface2} color={c.ink2} height={32} /> : null}

          {target && saved ? (
            <View testID="success-saved" style={{ marginTop: space.m }}>
              <Pill label={t('save.saved')} bg={c.greenTint} color={c.green} />
            </View>
          ) : target ? (
            <View style={{ alignSelf: 'stretch', marginTop: space.l, gap: space.m }}>
              <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="sub">{target === 'recipient' ? t('save.recipientToggle') : t('save.billerToggle')}</Text>
                <Switch
                  testID="success-save-toggle"
                  value={saveEnabled}
                  onValueChange={setSaveEnabled}
                  trackColor={{ true: c.amber, false: c.surface2 }}
                />
              </View>
              {saveEnabled ? (
                <Input
                  testID="success-save-nickname"
                  placeholder={t('save.nickname')}
                  value={nickname}
                  onChangeText={setNickname}
                />
              ) : null}
              {error ? <Text variant="foot" color={c.red} center>{error}</Text> : null}
            </View>
          ) : null}
        </Animated.View>
      </View>

      <View style={{ paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: 8 }}>
        <Button
          testID="success-done"
          label={t('common.done')}
          onPress={onDone}
          loading={saving}
          disabled={Boolean(target && saveEnabled && !saved && !nickname.trim())}
        />
        <Button
          testID="success-share"
          variant="ghost"
          label={t('success.shareReceipt')}
          icon={<Share2 size={18} color={c.ink3} strokeWidth={2} />}
          onPress={() => {}}
          disabled
        />
        <Text variant="foot" center>{t('common.comingSoon')}</Text>
      </View>
    </Screen>
  );
}
