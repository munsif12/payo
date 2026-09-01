import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, T, Field, MoneyText, Row, useUrdu } from '../../src/components/ui';
import { CardView } from '../../src/components/cards/CardView';
import { tokens } from '../../src/theme/tokens';
import { useMeQuery } from '../../src/api/client';
import { useConverse, ChatMessage } from '../../src/voice/useConverse';
import { useRecorder } from '../../src/voice/useRecorder';

const SUGGESTIONS = [
  { key: 'voice.suggest.payBill', emoji: '🧾' },
  { key: 'voice.suggest.sendMoney', emoji: '💸' },
  { key: 'voice.suggest.statement', emoji: '📄' },
  { key: 'voice.suggest.balance', emoji: '💰' },
] as const;

export default function VoiceHome() {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const [showBalance, setShowBalance] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const { data: me } = useMeQuery();
  const { messages, status, sendText, sendAudio } = useConverse();
  const { recording, start, stop } = useRecorder(({ uri }) => sendAudio(uri));
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setTyping(false);
    sendText(text);
  };

  const micLabel = recording ? t('voice.listening')
    : status === 'thinking' ? t('voice.thinking')
    : t('home.tapToSpeak');

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingVertical: tokens.space.s }}>
        <T size={tokens.type.h2} color={tokens.color.accent} weight="800">PAYO</T>
        <Pressable testID="balance-pill" onPress={() => setShowBalance(s => !s)}
          style={{ backgroundColor: tokens.color.surface, borderRadius: tokens.radius.pill, paddingHorizontal: tokens.space.m, paddingVertical: tokens.space.s }}>
          {showBalance && me
            ? <MoneyText paisa={me.account.balancePaisa} size={tokens.type.h2} color={tokens.color.accent} />
            : <T size={tokens.type.caption} color={tokens.color.textMuted}>{'₨ •••• — ' + t('home.tapToReveal')}</T>}
        </Pressable>
      </Row>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', flexWrap: 'wrap', justifyContent: 'center', gap: tokens.space.m }}>
              {SUGGESTIONS.map(s => (
                <Pressable
                  key={s.key}
                  testID={`suggest-${s.key.split('.').pop()}`}
                  onPress={() => sendText(t(s.key))}
                  style={{
                    width: '45%', minHeight: tokens.touch.primary * 1.3,
                    backgroundColor: tokens.color.surface, borderRadius: tokens.radius.card,
                    alignItems: 'center', justifyContent: 'center', padding: tokens.space.m,
                  }}
                >
                  <T size={24}>{s.emoji}</T>
                  <T size={tokens.type.caption} center>{t(s.key)}</T>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingVertical: tokens.space.m, gap: tokens.space.s }}
            renderItem={({ item }) => <Bubble message={item} onChipTap={sendText} />}
          />
        )}

        <View style={{ alignItems: 'center', paddingVertical: tokens.space.m }}>
          {typing ? (
            <Row style={{ alignSelf: 'stretch' }} gap={tokens.space.s} rtlAware={false}>
              <View style={{ flex: 1 }}>
                <Field
                  testID="chat-input"
                  autoFocus
                  placeholder={t('voice.typePlaceholder')}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={submitDraft}
                  returnKeyType="send"
                  rtl={urdu}
                />
              </View>
              <Pressable testID="chat-send" onPress={submitDraft}
                style={{ width: tokens.touch.primary, height: tokens.touch.primary, borderRadius: tokens.radius.button, backgroundColor: tokens.color.accent, alignItems: 'center', justifyContent: 'center' }}>
                <T size={22}>➤</T>
              </Pressable>
            </Row>
          ) : (
            <>
              <Row gap={tokens.space.xl} rtlAware={false} style={{ alignItems: 'center' }}>
                <Pressable testID="keyboard-toggle" onPress={() => setTyping(true)}
                  style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: tokens.color.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={22}>⌨️</T>
                </Pressable>
                <Pressable
                  testID="mic-button"
                  onPress={() => (recording ? stop() : start())}
                  disabled={status === 'thinking'}
                  style={{
                    width: 96, height: 96, borderRadius: 48,
                    backgroundColor: recording ? tokens.color.danger : tokens.color.accent,
                    opacity: status === 'thinking' ? 0.5 : 1,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <T size={40}>{recording ? '⏹' : '🎙️'}</T>
                </Pressable>
                <View style={{ width: 52 }} />
              </Row>
              <T size={tokens.type.caption} color={tokens.color.textMuted} center style={{ marginTop: tokens.space.s }}>
                {micLabel}
              </T>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ message, onChipTap }: { message: ChatMessage; onChipTap: (t: string) => void }) {
  const { t } = useTranslation();
  const urdu = useUrdu();
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  return (
    <View style={{ alignItems: isUser ? (urdu ? 'flex-start' : 'flex-end') : (urdu ? 'flex-end' : 'flex-start') }}>
      <View style={{
        maxWidth: '88%',
        backgroundColor: isError ? '#3A1B22' : isUser ? tokens.color.accent : tokens.color.surface,
        borderRadius: tokens.radius.card,
        paddingHorizontal: tokens.space.m,
        paddingVertical: tokens.space.s,
      }}>
        {isError && <T color={tokens.color.danger} weight="700">{t('voice.errorPrefix')}</T>}
        {message.text ? (
          <T color={isError ? tokens.color.danger : isUser ? tokens.color.bg : tokens.color.text}>
            {message.text}
          </T>
        ) : null}
        {message.cards.map((card, i) => <CardView key={i} card={card} onChipTap={onChipTap} />)}
      </View>
    </View>
  );
}
