import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Keyboard as KeyboardIcon, Mic, Send, X } from 'lucide-react-native';
import { Text, Card, Input, Sheet, NavyHead, useIsUrdu, SHEET_OVERLAP } from '../../src/ui';
import { useTheme } from '../../src/theme/useTheme';
import { space, radius, touch, shadow } from '../../src/theme/tokens';
import {
  Rise, TypingDots, ListeningRings, IconSwap, useFirstPaint,
  wordRiseEnd, splitWords, usePressScale, motionConfig,
} from '../../src/motion';
import { CardView } from '../../src/components/cards/CardView';
import { useConverse, type ChatMessage } from '../../src/voice/useConverse';
import { showBubbleText } from '../../src/voice/bubbleText';
import { useRecorder } from '../../src/voice/useRecorder';
import { useVoiceLoop, type VoiceLoopHandlers } from '../../src/voice/useVoiceLoop';
import { usePinSheet } from '../../src/pin/usePinSheet';
import { useHomeGreeting, type Suggestion } from '../../src/home/useHomeGreeting';
import { useHomeDigest } from '../../src/home/useHomeDigest';
import { homeState, headHeight, headStatus } from '../../src/home/homeState';
import { useRegisterOutcomePlayer } from '../../src/voice/OutcomeSpeechProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { D_SHEET, STAGGER } = motionConfig;
/** Main.dc.html: the amber mic is a 64 pt floating button, bottom-right. */
const FAB_SIZE = 64;
const KEY_BUTTON = 44;
/** What the floating block occupies before onLayout has measured it: the 64 pt
 *  FAB plus the 16 pt gap the artboard leaves under it. The measured height
 *  wins as soon as it arrives — this is only the floor, so the last card is
 *  never briefly stuck under the mic on the very first frame. */
const FAB_CLEARANCE = FAB_SIZE + space.l;

// Home — Main.dc.html (greet) / HomeListening.dc.html (listening) /
// HomeConversation.dc.html (conversation): a navy head over a cream sheet, with
// the amber mic floating on the sheet. The Home tab IS the AI assistant (no
// AIBar here, see (tabs)/_layout.tsx). This screen is a view over the existing
// hooks — useVoiceLoop / useConverse / useHomeGreeting / useHomeDigest own all
// the behaviour; `homeState` (pure) decides which of the three faces shows.
export default function Home() {
  const { t } = useTranslation();
  const urdu = useIsUrdu();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { greetingFoot, name, greetingMessage, suggestions, balancePaisa } = useHomeGreeting();
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [draft, setDraft] = useState('');
  /** The composer input is opened by the keyboard icon (spec §1 rule 1). */
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
  // Measured height of the floating block (optional input row + mic FAB) so the
  // sheet's scrollable content reserves exactly that much bottom space and its
  // last card stops above the mic instead of landing under it.
  const [composerBlockHeight, setComposerBlockHeight] = useState(0);

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
  const state = homeState({ mode: loop.mode, messageCount: messages.length, recording });

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
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
  // The floating block (mic FAB, keyboard button, optional input) sits OVER the
  // sheet, so everything scrollable inside the sheet has to reserve its height —
  // otherwise the last suggestion card is unreadable and untappable under the
  // mic. Measured via onLayout, floored at the FAB's own clearance plus whatever
  // the safe area leaves between the sheet and the tab bar.
  const bottomBlock = Math.max(composerBlockHeight, FAB_CLEARANCE + Math.max(insets.bottom, space.l));
  const contentPadding = { paddingBottom: bottomBlock + space.m };

  return (
    <View style={{ flex: 1, backgroundColor: c.navy }}>
      <NavyHead
        name={name}
        greetingFoot={greetingFoot}
        greeting={greetingMessage}
        // The conversation head drops the balance line (HomeConversation.dc.html).
        balancePaisa={state === 'conversation' ? null : balancePaisa}
        balanceRevealed={balanceRevealed}
        onToggleBalance={() => setBalanceRevealed((s) => !s)}
        status={headStatus(loop.mode, recording)}
        level={level}
        onStatusPress={loop.interrupt}
        height={headHeight(state)}
        urdu={urdu}
        animateGreeting={greetingPaint}
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
          // HomeListening.dc.html: the sheet is the transcript.
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ gap: space.s }, contentPadding]}
          >
            <SheetLabel>{t('home.sheet.heard')}</SheetLabel>
            <Card padding={0} style={{ paddingHorizontal: 14, paddingVertical: space.m }}>
              <Text style={{ fontSize: 17, lineHeight: urdu ? undefined : 24 }} color={c.ink3}>
                {t('home.hint.speak')}
              </Text>
            </Card>
          </ScrollView>
        ) : (
          // Main.dc.html: "Since you were last here" (the digest card carries its
          // own heading) then "Say it, or tap" over the suggestions.
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ gap: space.s }, contentPadding]}
          >
            {digestCard ? (
              <Rise delay={rowDelay(0)}>
                <CardView card={digestCard} onChipTap={onSuggestion} />
              </Rise>
            ) : null}

            <SheetLabel>{t('home.sheet.sayOrTap')}</SheetLabel>

            {suggestions.map((s, i) => (
              <SuggestionCard
                key={s.key}
                suggestion={s}
                delay={rowDelay(i + 1)}
                // A suggestion tap keeps the conversation live (spec §1 rule 6).
                onPress={() => onSuggestion(s.intent)}
              />
            ))}
          </ScrollView>
        )}
      </Sheet>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
      >
        <View
          pointerEvents="box-none"
          style={{
            paddingHorizontal: space.xxl,
            paddingBottom: Math.max(insets.bottom, space.l),
            gap: space.s,
          }}
          onLayout={(e) => setComposerBlockHeight(e.nativeEvent.layout.height)}
        >
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
                <Send size={20} color={c.navy} strokeWidth={2.4} />
              </RoundButton>
            </View>
          ) : null}

          {/* HomeUrdu.dc.html keeps the mic bottom-RIGHT in Urdu too, so this
              row is the one thing on Home that does not mirror. */}
          <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RoundButton
              testID="composer-keyboard"
              label={t('home.hint.askPayo')}
              bg={c.surface}
              onPress={() => setInputOpen((s) => !s)}
              style={shadow.card.light}
            >
              <IconSwap
                active={inputOpen}
                size={22}
                from={<KeyboardIcon size={22} color={c.ink2} strokeWidth={2} />}
                to={<X size={22} color={c.ink2} strokeWidth={2} />}
              />
            </RoundButton>
            <View style={{ flex: 1 }} />
            <MicFab
              live={live}
              listening={loop.mode === 'listening'}
              onPress={() => (live ? loop.stop('user') : loop.start())}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The uppercase sheet section label — Main.dc.html "SINCE YOU WERE LAST HERE" /
 *  "SAY IT, OR TAP": 12/600, .08em tracking, ink3. */
function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="cap" style={{ letterSpacing: 0.96, marginTop: space.xs }}>{children}</Text>
  );
}

/** The amber mic (Main.dc.html): 64 pt, bottom-right, amber glow. Rings only
 *  while the loop is actually listening (spec §3) — nothing loops otherwise. */
function MicFab({ live, listening, onPress }: { live: boolean; listening: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <View style={{ width: FAB_SIZE, height: FAB_SIZE }}>
      {listening ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ListeningRings size={FAB_SIZE} color={c.amber} />
        </View>
      ) : null}
      <AnimatedPressable
        testID={live ? 'composer-stop-listening' : 'composer-mic'}
        accessibilityRole="button"
        accessibilityLabel={live ? t('home.voice.hintLive') : t('home.hint.tap')}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          {
            width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
            backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center',
            shadowColor: 'rgba(242,169,59,1)',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.45,
            shadowRadius: 20,
            elevation: 6,
          },
          pressStyle,
        ]}
      >
        <IconSwap
          active={live}
          size={28}
          from={<Mic size={28} color={c.navy} strokeWidth={2.4} />}
          to={<X size={26} color={c.navy} strokeWidth={2.6} />}
        />
      </AnimatedPressable>
    </View>
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

/** Main.dc.html suggestion row: white card radius 18, 40 pt amber icon tile,
 *  15/600 title over a 13 pt subtitle, chevron. */
function SuggestionCard({ suggestion, delay, onPress }: { suggestion: Suggestion; delay: number; onPress: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const Icon = suggestion.icon;
  // Guard against a second fast tap re-firing the intent while the first
  // press is still being handled (run() also gates this, but this keeps the
  // card itself from looking like it accepts repeat taps).
  const [pressed, setPressed] = useState(false);
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale();
  const handlePress = () => {
    if (pressed) return;
    setPressed(true);
    onPress();
  };
  return (
    <Rise delay={delay}>
      <AnimatedPressable
        testID={`home-suggestion-${suggestion.key}`}
        accessibilityRole="button"
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={pressed}
        style={pressStyle}
      >
        <Card
          padding={0}
          style={{
            borderRadius: radius.tile,
            paddingHorizontal: 14, paddingVertical: space.m,
            flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m,
            minHeight: touch.min + 2 * space.m,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: space.m, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} color={c.onAmber} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="hl" style={{ fontSize: 15, lineHeight: urdu ? undefined : 19 }}>{suggestion.title}</Text>
            <Text variant="foot" numberOfLines={1}>{suggestion.subtitle}</Text>
          </View>
          <ChevronRight size={18} color={c.ink3} strokeWidth={2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
        </Card>
      </AnimatedPressable>
    </Rise>
  );
}

// HomeConversation.dc.html: the user's turn is a navy bubble (max 78%, radius
// 20/20/4/20); an assistant turn is 86% wide and carries its cards.
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
          backgroundColor: isError ? c.redTint : isUser ? c.navy : 'transparent',
          borderRadius: radius.card,
          borderBottomLeftRadius: !tailOnRight ? 4 : radius.card,
          borderBottomRightRadius: tailOnRight ? 4 : radius.card,
          paddingHorizontal: isUser || isError ? 14 : 0,
          paddingVertical: isUser || isError ? 10 : 0,
        }}
      >
        {isError && <Text variant="sub" weight={700} color={c.red}>{t('voice.errorPrefix')}</Text>}
        {/* A card-carrying assistant turn renders its cards only — see showBubbleText. */}
        {message.text && showBubbleText(message) ? (
          <AssistantText message={message} isUser={isUser} isError={isError} />
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

/** An assistant line with no card of its own still needs the white bubble the
 *  artboard gives it; the user's line is already inside its navy pill. */
function AssistantText({ message, isUser, isError }: { message: ChatMessage; isUser: boolean; isError: boolean }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const body = (
    <Text
      style={{ fontSize: 15, lineHeight: urdu ? undefined : 21 }}
      color={isError ? c.red : isUser ? c.white : c.ink}
    >
      {message.text}
    </Text>
  );
  if (isUser || isError) return body;
  return (
    <Card
      padding={0}
      style={{
        paddingHorizontal: 14, paddingVertical: space.m,
        borderBottomLeftRadius: urdu ? radius.card : 4,
        borderBottomRightRadius: urdu ? 4 : radius.card,
        marginBottom: message.cards.length ? space.s : 0,
        alignSelf: urdu ? 'flex-end' : 'flex-start',
      }}
    >
      {body}
    </Card>
  );
}

function ThinkingBubble() {
  const urdu = useIsUrdu();
  const { c } = useTheme();
  return (
    <View style={{ alignItems: urdu ? 'flex-end' : 'flex-start' }}>
      <Card padding={0} style={{ paddingHorizontal: 14, paddingVertical: space.m }}>
        <TypingDots color={c.ink3} />
      </Card>
    </View>
  );
}
