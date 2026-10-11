import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Keyboard as KeyboardIcon, Send, X } from 'lucide-react-native';
import {
  Text, Card, Input, Button, Sheet, NavyHead, useIsUrdu, SHEET_OVERLAP, SHEET_PADDING_H,
} from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, touch, glassTokens } from '../../src/theme/tokens';
import {
  Rise, TypingDots, Waveform, useFirstPaint,
  wordRiseEnd, splitWords, usePressScale, motionConfig,
} from '../../src/motion';
import { FamilyRow } from '../../src/home/FamilyRow';
import { useFamily } from '../../src/home/useFamily';
import { ComposerBar, KeyboardButton } from '../../src/home/ComposerBar';
import { HeroOrb, MiniOrb } from '../../src/home/Orb';
import { LanguageToggle } from '../../src/home/LanguageToggle';
import { DueBillCard } from '../../src/home/DueBillCard';
import { CardView } from '../../src/components/cards/CardView';
import { useConverse, type ChatMessage } from '../../src/voice/useConverse';
import { showBubbleText } from '../../src/voice/bubbleText';
import { useRecorder } from '../../src/voice/useRecorder';
import { useVoiceLoop, type VoiceLoopHandlers } from '../../src/voice/useVoiceLoop';
import { orbBus } from '../../src/voice/orbBus';
import { usePinSheet } from '../../src/pin/usePinSheet';
import { useHomeGreeting, type Suggestion } from '../../src/home/useHomeGreeting';
import { useHomeDigest } from '../../src/home/useHomeDigest';
import { homeState, headStatus, orbStateFor } from '../../src/home/homeState';
import { useRegisterOutcomePlayer } from '../../src/voice/OutcomeSpeechProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { D_SHEET, STAGGER } = motionConfig;
const KEY_BUTTON = 44;
/** The suggestion chips under the due-bill card: 40 pt glass pills. */
const CHIP_HEIGHT = 40;
/** GLASS-SPEC §2 "User bubble": radius 20 with a 4 pt tail. */
const BUBBLE_RADIUS = 20;
const BUBBLE_TAIL = 4;

// Home — GLASS-SPEC §5: B11 (greet) / B2 (listening) / B3 (conversation). The
// scene is transparent over the gradient the tabs layout paints, the head is a
// NavyHead that sizes to its content, and the hero orb is the mic. The Home tab
// IS the AI assistant (the nav orb reaches it through orbBus, see
// (tabs)/_layout.tsx). This screen is a view over the existing hooks —
// useVoiceLoop / useConverse / useHomeGreeting / useHomeDigest own all the
// behaviour; `homeState` (pure) decides which of the three faces shows.
export default function Home() {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const { greetingFoot, name, greetingMessage, suggestions, balancePaisa, dueBill } = useHomeGreeting();
  // v8: the people you pay, one tap from a spoken-style turn.
  const family = useFamily();
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [draft, setDraft] = useState('');
  /** The typed composer is opened by the keyboard button (`composer-keyboard`). */
  const [inputOpen, setInputOpen] = useState(false);
  // useConverse and useRecorder own native state and must exist before the loop
  // that drives them, so their callbacks are forwarded through this ref to the
  // loop's stable handlers (see useVoiceLoop's VoiceLoopHandlers).
  const loopRef = useRef<VoiceLoopHandlers | null>(null);
  const converse = useConverse({
    onSpeechEnd: () => loopRef.current?.onSpeechEnd(),
    onTurnDone: () => loopRef.current?.onTurnDone(),
    onError: () => loopRef.current?.onError(),
  });
  const { messages, status, sendText, appendLocal, playAudio } = converse;
  // The proactive digest (spec §1 C): fetched + spoken on focus, rendered on the
  // sheet. Null whenever the setting is off or the 4 h rule says no.
  const digestCard = useHomeDigest(playAudio);
  // F2: the post-PIN outcome sentence plays through THIS player, so the
  // hands-free loop sees `speaking` → audioStarted and onSpeechEnd →
  // audioEnded and re-arms the mic afterwards, exactly as the digest does.
  useRegisterOutcomePlayer(playAudio);
  const recorder = useRecorder((result) => loopRef.current?.onRecordingFinished(result));
  const { recording, level } = recorder;
  const { isOpen: pinSheetOpen } = usePinSheet();
  const loop = useVoiceLoop({ recorder, converse, pinSheetOpen });
  // Assigned in an effect, not during render — render must stay side-effect
  // free (Strict Mode double-renders, and a discarded render would otherwise
  // leave the ref pointing at a loop that never mounted).
  useEffect(() => {
    loopRef.current = loop.handlers;
  }, [loop.handlers]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // The greet face is one screen tall by design (B11); a stale offset (the
  // keyboard shrinking the sheet, a tab re-focus) must never hide the hint row
  // under the greeting, so it snaps back to the top whenever it is shown.
  const greetRef = useRef<ScrollView>(null);

  // Entrance choreography, once per mount (spec §3). The greeting words go
  // first, the sheet settles behind the last word, then the rows cascade.
  // Latched on the first render so the flip to false never replays anything.
  const firstPaint = useFirstPaint();
  // The greeting waits for the name — /me can resolve a beat after mount, and
  // "Assalam o Alaikum, ." is not the line worth playing in word by word.
  // WordRise arms on the first render where this is true and latches that text.
  const greetingPaint = useFirstPaint(name.length > 0);
  const choreo = useRef<{ sheet: number; rows: number } | null>(null);
  if (choreo.current === null) {
    const wordsEnd = firstPaint ? wordRiseEnd(splitWords(greetingMessage).length) : 0;
    choreo.current = firstPaint ? { sheet: wordsEnd, rows: wordsEnd + D_SHEET } : { sheet: 0, rows: 0 };
  }
  /** Rows mounted after the entrance window (a digest landing) rise immediately. */
  const rowDelay = (index: number) => (firstPaint ? choreo.current!.rows + index * STAGGER : 0);

  const live = loop.mode !== 'off';
  /** The mic is open: the orbs show `AudioLines` (and the hero grows rings). */
  const listening = loop.mode === 'listening' || recording;
  const state = homeState({ mode: loop.mode, messageCount: messages.length, recording });

  // Every orb — hero, mini, nav — is the same toggle: start the hands-free loop
  // when it is off, end it when it is live. The handler reads `live` through a
  // ref so the one registered on orbBus never goes stale.
  const liveRef = useRef(live);
  const recordingRef = useRef(recording);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  const { start: startLoop, stop: stopLoop } = loop;
  // While the mic is open, a tap SENDS what was said (the recorder stops and the
  // clip goes out as if the pause had been detected); otherwise it toggles the loop.
  const recorderStop = recorder.stop;
  const toggleLoop = useCallback(
    () => (recordingRef.current ? recorderStop() : liveRef.current ? stopLoop('user') : startLoop()),
    [startLoop, stopLoop, recorderStop],
  );

  // orbBus (GLASS-SPEC §3): while Home is focused the nav orb drives the loop
  // here; on blur the handler goes so a press elsewhere latches a pending start
  // instead. A press from Wallet/Pay therefore lands here on focus and starts.
  useFocusEffect(
    useCallback(() => {
      orbBus.setHandler(toggleLoop);
      if (orbBus.consumePendingStart()) startLoop();
      return () => orbBus.setHandler(null);
    }, [toggleLoop, startLoop]),
  );
  useEffect(() => {
    if (state === 'greet' && !inputOpen) greetRef.current?.scrollTo({ y: 0, animated: false });
  }, [state, inputOpen]);
  // Mirror the loop so every orb shows the same face (Mic / AudioLines).
  useEffect(() => {
    orbBus.setState(orbStateFor(loop.mode, recording));
  }, [loop.mode, recording]);
  useEffect(() => () => orbBus.setState('idle'), []);

  const toggleInput = () => setInputOpen((s) => !s);

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    // v8: the keyboard goes away with the message, so the reply (and the PIN sheet
    // that may follow) lands on a clear screen instead of under the keyboard.
    setInputOpen(false);
    // Typing hands the conversation back to tap-per-turn (spec §1 rule 6).
    loop.onTextSend(text);
  };

  // 'typed' ends the loop because the user took over by hand — no "conversation
  // ended" nudge is wanted there; 'limit' gets its own copy (the cost guard).
  const endedHint =
    loop.endedReason === 'limit' ? t('home.voice.endedLimit')
      : loop.endedReason && loop.endedReason !== 'typed' ? t('home.voice.ended')
        : null;

  const onSuggestion = (intent: string) => (live ? loop.sendSuggestion(intent) : sendText(intent));
  // The composer block (optional input row, composer bar) sits UNDER the sheet
  // in normal flow, so the lists only keep a small foot of their own.
  const contentPadding = { paddingBottom: space.m };

  const orbLabel = live ? t('home.voice.hintLive') : t('home.hint.tap');
  /** `composer-mic` starts, `composer-stop-listening` ends — the v7 testIDs. */
  const orbTestID = live ? 'composer-stop-listening' : 'composer-mic';

  return (
    // Transparent: the tabs layout paints the gradient behind the scene AND
    // the nav pill, so there is no tone step where the nav begins (§1). The
    // whole face lives in one KeyboardAvoidingView so the keyboard shrinks the
    // sheet instead of floating the composer over the transcript.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    >
      <NavyHead
        name={name}
        greetingFoot={greetingFoot}
        // Only the greet face carries the greeting and the balance line; the
        // listening and conversation heads are the compact head row (B2/B3).
        greeting={state === 'greet' ? greetingMessage : undefined}
        balancePaisa={state === 'greet' ? balancePaisa : null}
        balanceRevealed={balanceRevealed}
        onToggleBalance={() => setBalanceRevealed((s) => !s)}
        status={headStatus(loop.mode, recording)}
        onStatusPress={loop.interrupt}
        urdu={urdu}
        animateGreeting={greetingPaint}
        align="center"
        rightSlot={state === 'conversation' ? (
          // B3: in the conversation the mini orb IS the mic.
          <MiniOrb listening={listening} onPress={toggleLoop} label={orbLabel} testID={orbTestID} />
        ) : (
          <LanguageToggle />
        )}
      />

      <Sheet
        testID="home-sheet"
        delay={choreo.current.sheet}
        animate={firstPaint}
        style={{ marginTop: -SHEET_OVERLAP }}
      >
        {state === 'conversation' ? (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ paddingTop: space.s, gap: space.s }, contentPadding]}
            renderItem={({ item }) => <Bubble message={item} onChipTap={sendText} onAppendLocal={appendLocal} />}
            ListFooterComponent={status === 'thinking' ? <ThinkingBubble /> : null}
          />
        ) : state === 'listening' ? (
          // B2: the hero orb with rings, the amber cue, the big line, the
          // footnote, the real waveform, then "Type instead" / "End".
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ alignItems: 'center', gap: space.l, paddingTop: space.xxxl }, contentPadding]}
          >
            <HeroOrb
              listening
              onPress={() => stopLoop('user')}
              onLongPress={() => stopLoop('user')}
              label={t('home.voice.hintLive')}
              testID="home-hero-orb"
            />
            <Text variant="hl" weight={700} color={c.amber} center style={{ marginTop: space.m, lineHeight: urdu ? undefined : 22 }}>
              {t('home.orb.listening')}
            </Text>
            {/* No streaming transcript exists before the clip is sent, so the line
                is the hint; the first user bubble lands in the conversation face. */}
            <Text variant="h1" center style={{ paddingHorizontal: space.l }}>{t('home.hint.speak')}</Text>
            <Text variant="sub" color={c.ink2} center style={{ paddingHorizontal: space.l }}>
              {t('home.orb.footnote')}
            </Text>
            <Waveform level={level} color={c.amber} testID="home-waveform" />
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.m, marginTop: space.s }}>
              <Button
                testID="composer-keyboard"
                variant="secondary"
                label={t('home.orb.typeInstead')}
                icon={<KeyboardIcon size={20} color={c.ink} strokeWidth={2} />}
                onPress={toggleInput}
              />
              <Button
                testID="composer-stop-listening"
                variant="secondary"
                label={t('home.orb.end')}
                icon={<X size={20} color={c.ink} strokeWidth={2.2} />}
                onPress={() => stopLoop('user')}
              />
            </View>
          </ScrollView>
        ) : (
          // B11: hint + keyboard, the hero orb, the examples, FAMILY, the due
          // bill, the digest (when there is one), then the suggestion chips.
          <ScrollView
            ref={greetRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ gap: space.m, paddingTop: 0 }, contentPadding]}
          >
            <Rise delay={rowDelay(0)}>
              <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: space.m }}>
                <Text variant="sub" color={c.ink2} center style={{ flexShrink: 1, lineHeight: urdu ? undefined : 20 }}>
                  {t('home.orb.hint')}
                </Text>
                <KeyboardButton open={inputOpen} onPress={toggleInput} />
              </View>
            </Rise>

            {/* The orb never mirrors (§6 rule 3): it is centred either way. */}
            <View style={{ alignItems: 'center', paddingVertical: space.s }}>
              <HeroOrb listening={listening} onPress={toggleLoop} label={orbLabel} testID={orbTestID} />
            </View>

            <Text variant="foot" center style={{ paddingHorizontal: space.s }}>{t('home.orb.examples')}</Text>

            {family.length > 0 ? (
              <Rise delay={rowDelay(1)}>
                <FamilyRow people={family} onIntent={onSuggestion} />
              </Rise>
            ) : null}

            {dueBill ? (
              <Rise delay={rowDelay(2)}>
                <DueBillCard bill={dueBill} onIntent={onSuggestion} />
              </Rise>
            ) : null}

            {digestCard ? (
              <Rise delay={rowDelay(3)}>
                <CardView card={digestCard} onChipTap={onSuggestion} />
              </Rise>
            ) : null}

            {/* The orb and the examples replaced the chip grid; the suggestions
                stay as one row of chips so `home-suggestion-*` keeps working.
                `inverted` is RN's RTL trick for a horizontal list: in Urdu the
                row starts at the right edge and scrolls leftwards. */}
            <Rise delay={rowDelay(4)}>
              <FlatList
                horizontal
                inverted={urdu}
                data={suggestions}
                keyExtractor={(s) => s.key}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ marginHorizontal: -SHEET_PADDING_H }}
                contentContainerStyle={{ paddingHorizontal: SHEET_PADDING_H, gap: space.s }}
                renderItem={({ item }) => (
                  // A suggestion tap keeps the conversation live (spec §1 rule 6).
                  <SuggestionChip suggestion={item} onPress={() => onSuggestion(item.intent)} />
                )}
              />
            </Rise>
          </ScrollView>
        )}
      </Sheet>

      <View style={{ paddingHorizontal: space.l, paddingBottom: space.m, gap: space.s }}>
          {endedHint ? <Text variant="foot" center>{endedHint}</Text> : null}

          {inputOpen ? (
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.s }}>
              <Input
                autoFocus
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={submitDraft}
                placeholder={t('home.composerPlaceholder')}
                returnKeyType="send"
                containerStyle={{ flex: 1, borderRadius: radius.button }}
              />
              <RoundButton
                testID="composer-send"
                label={t('home.composerPlaceholder')}
                bg={c.amber}
                onPress={submitDraft}
              >
                <Send size={20} color={c.onAmber} strokeWidth={2.4} />
              </RoundButton>
            </View>
          ) : null}

          {/* B3: the slim glass composer bar lives under the transcript only —
              the greet hint row and the listening pills carry their own
              keyboard button. */}
          {state === 'conversation' ? (
            <ComposerBar live={live} inputOpen={inputOpen} onKeyboard={toggleInput} />
          ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function RoundButton({ testID, label, bg, onPress, children, style }: {
  testID: string;
  label: string;
  bg: string;
  onPress: () => void;
  children: React.ReactNode;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}) {
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
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
          width: KEY_BUTTON, height: KEY_BUTTON, borderRadius: KEY_BUTTON / 2,
          backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
          minWidth: touch.min, minHeight: touch.min,
        },
        style,
        pressStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** A suggestion as a 40 pt glass chip (GLASS-SPEC §2 "Chip"): a 16 pt amber icon
 *  and the title at 14/600. The testID is the v7 one (`home-suggestion-<key>`)
 *  so the QA scripts keep working. */
function SuggestionChip({ suggestion, onPress }: { suggestion: Suggestion; onPress: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const Icon = suggestion.icon;
  // Guard against a second fast tap re-firing the intent while the first
  // press is still being handled (run() also gates this, but this keeps the
  // chip itself from looking like it accepts repeat taps).
  const [pressed, setPressed] = useState(false);
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  const handlePress = () => {
    if (pressed) return;
    setPressed(true);
    onPress();
  };
  return (
    <AnimatedPressable
      testID={`home-suggestion-${suggestion.key}`}
      accessibilityRole="button"
      accessibilityLabel={suggestion.title}
      accessibilityHint={suggestion.subtitle}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={pressed}
      style={[
        {
          height: CHIP_HEIGHT,
          borderRadius: CHIP_HEIGHT / 2,
          paddingHorizontal: 14,
          backgroundColor: c.surface,
          borderWidth: glassTokens.line,
          borderColor: c.separator,
          flexDirection: urdu ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        },
        pressStyle,
      ]}
    >
      <Icon size={16} color={c.amber} strokeWidth={2.2} />
      <Text variant="sub" weight={600} color={c.ink} numberOfLines={1} style={{ fontSize: 14, lineHeight: urdu ? undefined : 18 }}>
        {suggestion.title}
      </Text>
    </AnimatedPressable>
  );
}

// B3: the user's turn is an amber pill (max 78%, radius 20 with a 4 pt tail,
// navy 17/600 text); an assistant turn is 86% wide and carries its cards.
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
          maxWidth: isUser ? '78%' : '86%',
          width: isUser ? undefined : '86%',
          backgroundColor: isError ? c.redTint : isUser ? c.amber : 'transparent',
          borderRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: !tailOnRight ? BUBBLE_TAIL : BUBBLE_RADIUS,
          borderBottomRightRadius: tailOnRight ? BUBBLE_TAIL : BUBBLE_RADIUS,
          paddingHorizontal: isUser || isError ? 16 : 0,
          paddingVertical: isUser || isError ? 12 : 0,
        }}
      >
        {isError && <Text variant="sub" weight={700} color={c.red}>{t('voice.errorPrefix')}</Text>}
        {/* A card-carrying assistant turn renders its cards only — see showBubbleText. */}
        {message.text && showBubbleText(message) ? (
          <BubbleText message={message} isUser={isUser} isError={isError} />
        ) : null}
        {message.cards.map((card, i) => (
          <CardView
            key={i}
            card={card}
            onChipTap={onChipTap}
            onAppendLocal={onAppendLocal}
            live={!message.restored}
          />
        ))}
      </View>
    </View>
  );
}

/** The user's line sits in its amber pill (navy 17/600); an error's in its red
 *  tint; an assistant line with no card of its own gets the glass card (§2). */
function BubbleText({ message, isUser, isError }: { message: ChatMessage; isUser: boolean; isError: boolean }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  if (isUser) {
    return (
      <Text variant="hl" weight={600} color={c.onAmber} style={{ lineHeight: urdu ? undefined : 22 }}>
        {message.text}
      </Text>
    );
  }
  if (isError) {
    return (
      <Text style={{ fontSize: 15, lineHeight: urdu ? undefined : 21 }} color={c.red}>
        {message.text}
      </Text>
    );
  }
  return (
    <Card
      padding={0}
      style={{
        paddingHorizontal: 14, paddingVertical: space.m,
        borderRadius: BUBBLE_RADIUS,
        borderBottomLeftRadius: urdu ? BUBBLE_RADIUS : BUBBLE_TAIL,
        borderBottomRightRadius: urdu ? BUBBLE_TAIL : BUBBLE_RADIUS,
        marginBottom: message.cards.length ? space.s : 0,
        alignSelf: urdu ? 'flex-end' : 'flex-start',
      }}
    >
      <Text style={{ fontSize: 15, lineHeight: urdu ? undefined : 21 }} color={c.ink}>
        {message.text}
      </Text>
    </Card>
  );
}

function ThinkingBubble() {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  return (
    <View style={{ alignItems: urdu ? 'flex-end' : 'flex-start' }}>
      <Card padding={0} style={{ paddingHorizontal: 14, paddingVertical: space.m, borderRadius: BUBBLE_RADIUS }}>
        <TypingDots color={c.ink3} />
      </Card>
    </View>
  );
}
