import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Eye, EyeOff, Sparkles } from 'lucide-react-native';
import { Screen, Text, Card, Pill, Avatar, Composer, VoiceStatusBar, useIsUrdu } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius } from '../../src/theme/tokens';
import { Rise, TypingDots, WaveBars } from '../../src/motion';
import { CardView } from '../../src/components/cards/CardView';
import { useConverse, type ChatMessage } from '../../src/voice/useConverse';
import { useRecorder } from '../../src/voice/useRecorder';
import { useVoiceLoop, type VoiceLoopHandlers } from '../../src/voice/useVoiceLoop';
import { usePinSheet } from '../../src/pin/usePinSheet';
import { useHomeGreeting, type Suggestion } from '../../src/home/useHomeGreeting';
import { formatPaisa } from '../../src/lib/money';
import { ltrIsolate } from '../../src/lib/bidi';

// Home — Main.dc.html (idle greeting + suggestions) / HomeListening.dc.html
// (mic listening) / HomeConversation.dc.html (turns in progress). The Home
// tab IS the AI assistant: no AIBar here (see (tabs)/_layout.tsx), the
// Composer at the bottom is the only entry point for voice/text.
export default function Home() {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const { greetingFoot, name, greetingMessage, suggestions, balancePaisa } = useHomeGreeting();
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [draft, setDraft] = useState('');
  // useConverse and useRecorder own native state and must exist before the loop
  // that drives them, so their callbacks are forwarded through this ref to the
  // loop's stable handlers (see useVoiceLoop's VoiceLoopHandlers).
  const loopRef = useRef<VoiceLoopHandlers | null>(null);
  const converse = useConverse({
    onSpeechEnd: () => loopRef.current?.onSpeechEnd(),
    onTurnDone: () => loopRef.current?.onTurnDone(),
    onError: () => loopRef.current?.onError(),
  });
  const { messages, status, sendText, appendLocal } = converse;
  const recorder = useRecorder((result) => loopRef.current?.onRecordingFinished(result));
  const { recording } = recorder;
  const { isOpen: pinSheetOpen } = usePinSheet();
  const loop = useVoiceLoop({ recorder, converse, pinSheetOpen });
  // Assigned in an effect, not during render — render must stay side-effect
  // free (Strict Mode double-renders, and a discarded render would otherwise
  // leave the ref pointing at a loop that never mounted).
  useEffect(() => {
    loopRef.current = loop.handlers;
  }, [loop.handlers]);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const live = loop.mode !== 'off';

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    // Typing hands the conversation back to tap-per-turn (spec §1 rule 6).
    loop.onTextSend(text);
  };

  const hasMessages = messages.length > 0;
  const placeholder = recording ? t('home.hint.listening') : t('home.composerPlaceholder');
  // 'typed' ends the loop because the user took over by hand — no "conversation
  // ended" nudge is wanted there; 'limit' gets its own copy (the cost guard).
  const endedHint =
    loop.endedReason === 'limit' ? t('home.voice.endedLimit')
      : loop.endedReason && loop.endedReason !== 'typed' ? t('home.voice.ended')
        : null;
  const hint = live
    ? t('home.voice.hintLive')
    : endedHint ?? (status === 'thinking' ? t('home.hint.thinking') : t('home.hint.tap'));

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.gutter }}>
        <View
          style={{
            flexDirection: urdu ? 'row-reverse' : 'row',
            alignItems: 'center', justifyContent: 'space-between',
            paddingTop: space.s, paddingBottom: space.s,
          }}
        >
          <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m }}>
            <Avatar name={name || 'PAYO'} size={40} />
            <View>
              <Text variant="foot">{greetingFoot}</Text>
              <Text variant="hl">{name}</Text>
            </View>
          </View>
          <Pressable testID="home-balance-pill" onPress={() => setBalanceRevealed((s) => !s)} hitSlop={8}>
            <Pill
              height={36}
              bg={c.surface}
              color={c.ink}
              icon={
                balanceRevealed
                  ? <EyeOff size={16} color={c.ink3} strokeWidth={2} />
                  : <Eye size={16} color={c.ink3} strokeWidth={2} />
              }
              label={balanceRevealed ? (urdu ? ltrIsolate(formatPaisa(balancePaisa)) : formatPaisa(balancePaisa)) : '₨ ••••••'}
            />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {recording && !live ? (
          // The full-screen listening takeover only applies to a legacy
          // tap-per-turn recording. While a hands-free conversation is live the
          // VoiceStatusBar above the composer carries the state instead, so the
          // messages and suggestion cards stay reachable (spec §4 item 2).
          <ListeningContent />
        ) : hasMessages ? (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingHorizontal: space.gutter, paddingVertical: space.m, gap: space.s }}
            renderItem={({ item }) => <Bubble message={item} onChipTap={sendText} onAppendLocal={appendLocal} />}
            ListFooterComponent={status === 'thinking' ? <ThinkingBubble /> : null}
          />
        ) : (
          <View style={{ flex: 1, paddingHorizontal: space.gutter, paddingTop: space.xs, gap: space.m }}>
            <Rise
              style={{
                flexDirection: urdu ? 'row-reverse' : 'row',
                gap: 10, alignItems: 'flex-end',
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={19} color={c.navy} strokeWidth={2.2} />
              </View>
              <View
                style={{
                  flex: 1, backgroundColor: c.surface, borderRadius: radius.card,
                  borderBottomLeftRadius: urdu ? radius.card : 6,
                  borderBottomRightRadius: urdu ? 6 : radius.card,
                  padding: space.l,
                }}
              >
                <Text style={{ fontSize: 19, lineHeight: 27 }}>{greetingMessage}</Text>
              </View>
            </Rise>

            <View style={{ gap: space.s }}>
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={s.key}
                  suggestion={s}
                  delay={(i + 1) * 60}
                  // A suggestion tap keeps the conversation live (spec §1 rule 6).
                  onPress={() => (live ? loop.sendSuggestion(s.intent) : sendText(s.intent))}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: space.gutter, paddingBottom: space.s, paddingTop: space.s }}>
          {live ? <VoiceStatusBar mode={loop.mode} onInterrupt={loop.interrupt} style={{ marginBottom: space.s }} /> : null}
          <Composer
            value={draft}
            onChangeText={setDraft}
            onSubmit={submitDraft}
            placeholder={placeholder}
            hint={hint}
            live={live}
            onMicPress={loop.start}
            onStopListening={() => loop.stop('user')}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SuggestionCard({ suggestion, delay, onPress }: { suggestion: Suggestion; delay: number; onPress: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const Icon = suggestion.icon;
  // Guard against a second fast tap re-firing the intent while the first
  // press is still being handled (run() also gates this, but this keeps the
  // card itself from looking like it accepts repeat taps).
  const [pressed, setPressed] = useState(false);
  const handlePress = () => {
    if (pressed) return;
    setPressed(true);
    onPress();
  };
  return (
    <Rise delay={delay}>
      <Pressable
        testID={`home-suggestion-${suggestion.key}`}
        accessibilityRole="button"
        onPress={handlePress}
        disabled={pressed}
      >
        <Card
          padding={0}
          style={{
            minHeight: 64,
            paddingHorizontal: space.l, paddingVertical: 10,
            flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={22} color={c.onAmber} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="hl">{suggestion.title}</Text>
            <Text variant="foot" numberOfLines={1}>{suggestion.subtitle}</Text>
          </View>
          <ChevronRight size={20} color={c.ink3} strokeWidth={2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
        </Card>
      </Pressable>
    </Rise>
  );
}

function Bubble({ message, onChipTap, onAppendLocal }: {
  message: ChatMessage;
  onChipTap: (t: string) => void;
  onAppendLocal: (m: Omit<ChatMessage, 'id'> & { id?: string }) => void;
}) {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  const align = isUser ? (urdu ? 'flex-start' : 'flex-end') : (urdu ? 'flex-end' : 'flex-start');
  const tailOnRight = isUser ? !urdu : urdu;

  return (
    <View style={{ alignItems: align }}>
      <View
        style={{
          maxWidth: '86%',
          backgroundColor: isError ? c.redTint : isUser ? c.navy : c.surface,
          borderRadius: radius.card,
          borderBottomLeftRadius: !tailOnRight ? 6 : radius.card,
          borderBottomRightRadius: tailOnRight ? 6 : radius.card,
          paddingHorizontal: space.l, paddingVertical: space.m,
        }}
      >
        {isError && <Text variant="sub" weight={700} color={c.red}>{t('voice.errorPrefix')}</Text>}
        {message.text ? (
          <Text style={{ fontSize: 16, lineHeight: 22 }} color={isError ? c.red : isUser ? c.white : c.ink}>
            {message.text}
          </Text>
        ) : null}
        {message.cards.map((card, i) => (
          <CardView key={i} card={card} onChipTap={onChipTap} onAppendLocal={onAppendLocal} />
        ))}
      </View>
    </View>
  );
}

function ThinkingBubble() {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  return (
    <View style={{ alignItems: urdu ? 'flex-end' : 'flex-start', paddingHorizontal: space.gutter }}>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.card, paddingHorizontal: space.l, paddingVertical: space.m }}>
        <TypingDots color={c.ink3} />
      </View>
    </View>
  );
}

function ListeningContent() {
  const { t } = useTranslation();
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, paddingHorizontal: space.xxl }}>
      <WaveBars color={c.amber} />
      <Text variant="h2" center>{t('home.hint.listening')}</Text>
      <Card style={{ maxWidth: 320 }}>
        <Text center style={{ fontSize: 19, lineHeight: 27 }}>{t('home.hint.speak')}</Text>
      </Card>
      <Text variant="foot" center>{t('home.hint.listeningFootnote')}</Text>
    </View>
  );
}
