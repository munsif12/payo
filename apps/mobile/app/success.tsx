import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Share, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, Mic, Share2 } from 'lucide-react-native';
import { Screen, Text, Card, Button, Pill, Input, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, glassTokens } from '../src/theme/tokens';
import { IconSwap, useRise, useCountUp, motionConfig } from '../src/motion';
import { formatPaisa } from '../src/lib/money';
import { ltrIsolate } from '../src/lib/bidi';
import { useCreateRecipientMutation, useCreateSavedBillerMutation, apiErr } from '../src/api/client';
import { outcomeSpeech } from '../src/voice/outcomeSpeech';
import type { RecipientSuggestion, BillerSuggestion, Txn } from '../src/api/types';
import { useOutcomeSpeech } from '../src/voice/OutcomeSpeechProvider';

const { D_UI } = motionConfig;
/** GLASS-SPEC §5 B19: a 96 pt greenTint disc with the green check, sitting
 *  half over the top edge of the glass card beneath it. */
const CHECK_SIZE = 96;
const CHECK_GLYPH = 44;
/** "Sent" at 32/800 (B19). */
const TITLE_SIZE = 32;
const TITLE_LINE_HEIGHT = 38;

function parseJson<T>(raw?: string): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// Success — B19: the check lands first (IconSwap, once), then the
// amount/recipient/reference/spoken-line block rises D_UI behind it (spec §3
// "check draws + lands first, then amount and ref rise"). Both primitives
// already honour reduced motion and the UI-thread-only rule on their own.
export default function Success() {
  const { t, i18n } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { refNo, amountPaisa, summary, txn: txnRaw, recipientSuggestion: recipientSuggestionRaw, billerSuggestion: billerSuggestionRaw } =
    useLocalSearchParams<{ refNo: string; amountPaisa: string; summary?: string; txn?: string; recipientSuggestion?: string; billerSuggestion?: string }>();

  // Flips false → true right after mount, so IconSwap actually animates the
  // check "in" instead of starting already-settled — a one-shot entrance,
  // never replayed (this component only ever mounts once per transaction).
  const [checkIn, setCheckIn] = useState(false);
  useEffect(() => { setCheckIn(true); }, []);
  const textStyle = useRise(D_UI);

  const countedAmount = useCountUp(Number(amountPaisa || 0));

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
  // The same sentence, composed with the same pure helper `speak` posts for
  // TTS, rendered as the visible "spoken line" (B19: a mic glyph next to the
  // quoted sentence) — spec §3 "every animated/spoken change also has a static cue".
  const spokenLine = useMemo(
    () => (txn ? outcomeSpeech({ transaction: txn }, { kind: 'classic', amountPaisa: txn.amountPaisa }, i18n.language) : ''),
    [txn, i18n.language],
  );

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

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

  // "Share receipt": the same three facts the screen shows, through the system
  // share sheet (the chat receipt card shares the same way).
  const onShare = () => {
    const message = [
      summary || t('success.sent'),
      amountPaisa ? formatPaisa(Number(amountPaisa)) : '',
      refNo ? t('success.refPill', { ref: refNo }) : '',
    ].filter(Boolean).join(' · ');
    Share.share({ message }).catch(() => {
      // User dismissed the share sheet, or the platform refused it — nothing to recover.
    });
  };

  const savePrompt = target === 'recipient'
    ? t('save.recipientPrompt', { name: defaultNickname })
    : t('save.billerPrompt', { name: defaultNickname });

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: space.l, paddingTop: space.xl, paddingBottom: space.l }}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: CHECK_SIZE, height: CHECK_SIZE, borderRadius: CHECK_SIZE / 2,
              backgroundColor: c.greenTint, borderWidth: glassTokens.line, borderColor: c.green,
              alignItems: 'center', justifyContent: 'center',
              // Half of the disc overlaps the card below.
              marginBottom: -CHECK_SIZE / 2, zIndex: 1,
            }}
          >
            <IconSwap
              testID="success-check"
              active={checkIn}
              size={CHECK_GLYPH}
              from={null}
              to={<Check size={CHECK_GLYPH} color={c.green} strokeWidth={2.6} />}
            />
          </View>

          <Card style={{ alignSelf: 'stretch', paddingTop: CHECK_SIZE / 2 + space.l, alignItems: 'center' }}>
            <Animated.View style={[{ alignItems: 'center', gap: space.m, alignSelf: 'stretch' }, textStyle]}>
              <Text variant="h1" center style={{ fontSize: TITLE_SIZE, lineHeight: urdu ? undefined : TITLE_LINE_HEIGHT }}>
                {t('success.title')}
              </Text>
              {amountPaisa ? <Text variant="money">{formatPaisa(countedAmount)}</Text> : null}
              <Text variant="sub" color={c.ink2} center>{summary || t('success.sent')}</Text>
              {refNo ? (
                <Pill
                  label={t('success.refPill', { ref: ltrIsolate(refNo) })}
                  bg={c.surface2}
                  color={c.ink2}
                  style={{ borderWidth: glassTokens.line, borderColor: c.separator }}
                />
              ) : null}
              {spokenLine ? (
                <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Mic size={14} color={c.amber} strokeWidth={2} />
                  <Text variant="foot" color={c.ink2} center style={{ flexShrink: 1 }}>&ldquo;{spokenLine}&rdquo;</Text>
                </View>
              ) : null}
            </Animated.View>
          </Card>
        </View>

        {target && saved ? (
          <View testID="success-saved" style={{ alignItems: 'center' }}>
            <Pill label={t('save.saved')} bg={c.greenTint} color={c.green} />
          </View>
        ) : target ? (
          // B19: the save prompt as its own glass card — title, hint, amber switch.
          <Card style={{ gap: space.m }}>
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="hl" weight={700}>{savePrompt}</Text>
                <Text variant="sub" color={c.ink2}>{t('success.saveHint')}</Text>
              </View>
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
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ paddingBottom: space.l, gap: 8 }}>
        <Button
          testID="success-done"
          label={t('common.done')}
          onPress={onDone}
          loading={saving}
          disabled={Boolean(target && saveEnabled && !saved && !nickname.trim())}
        />
        <Button
          testID="success-share"
          variant="secondary"
          label={t('success.shareReceipt')}
          icon={<Share2 size={18} color={c.ink} strokeWidth={2} />}
          onPress={onShare}
        />
      </View>
    </Screen>
  );
}
