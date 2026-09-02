// TEMPORARY — R3.6 kit preview route. Renders every src/ui + src/motion
// primitive so they can be screenshotted (both themes) via Argent. Deleted
// in Phase R7 (R7.1) once every screen has been restyled onto this kit.
import React, { useState } from 'react';
import { ScrollView, View, Appearance } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useTheme } from '../../src/theme/useTheme';
import { space } from '../../src/theme/tokens';
import {
  Text, Button, Card, ListRow, Chip, Pill, Avatar, Input, Keypad,
  PinDots, TabBar, AIBar, Composer, Screen,
} from '../../src/ui';
import type { PinDotsHandle, TabKey } from '../../src/ui';
import { Rise, Breathe, ListeningRings, WaveBars, TypingDots, useCountUp, useShake } from '../../src/motion';
import { Wallet as WalletIcon } from 'lucide-react-native';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12, marginBottom: 32 }}>
      <Text variant="cap">{title}</Text>
      {children}
    </View>
  );
}

export default function DevKit() {
  const { c, dark } = useTheme();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState<TabKey>('home');
  const [composerText, setComposerText] = useState('');
  const [listening, setListening] = useState(false);
  const [balance, setBalance] = useState(8450000);
  const [inputValue, setInputValue] = useState('');
  const pinDotsRef = React.useRef<PinDotsHandle>(null);
  const shake = useShake();
  const animatedBalance = useCountUp(balance);

  const toggleTheme = () => {
    Appearance.setColorScheme(dark ? 'light' : 'dark');
  };
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ur' ? 'en' : 'ur');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Text variant="h1" style={{ marginBottom: 4 }}>UI kit</Text>
        <Text variant="sub" style={{ marginBottom: space.xxl }}>src/ui + src/motion — R3 preview (temporary route)</Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: space.xxxl }}>
          <Button label={dark ? 'Switch to light' : 'Switch to dark'} variant="secondary" onPress={toggleTheme} testID="kit-theme-toggle" />
          <Button label={i18n.language === 'ur' ? 'English' : 'اردو'} variant="secondary" onPress={toggleLanguage} testID="kit-lang-toggle" />
        </View>

        <Section title="Text variants">
          <Text variant="money">₨84,500</Text>
          <Text variant="h1">Large title</Text>
          <Text variant="h2">Title</Text>
          <Text variant="hl">Headline</Text>
          <Text variant="body">Body — the elder-friendly floor is 17pt.</Text>
          <Text variant="sub">Subhead</Text>
          <Text variant="foot">Footnote</Text>
          <Text variant="cap">Caption</Text>
        </Section>

        <Section title="Buttons">
          <Button label="Primary" variant="primary" onPress={() => {}} testID="kit-btn-primary" />
          <Button label="Secondary" variant="secondary" onPress={() => {}} testID="kit-btn-secondary" />
          <Button label="Ghost" variant="ghost" onPress={() => {}} testID="kit-btn-ghost" />
          <Button label="Danger" variant="danger" onPress={() => {}} testID="kit-btn-danger" />
          <Button label="Loading" variant="primary" loading onPress={() => {}} />
          <Button label="Disabled" variant="primary" disabled onPress={() => {}} />
        </Section>

        <Section title="Card + ListRow">
          <Card>
            <ListRow
              left={<Avatar name="Ammi Jaan" />}
              title="Ammi Jaan"
              subtitle="Today, 3:20 PM · Transfer"
              right={<Text variant="hl">−₨1,500</Text>}
            />
            <ListRow
              left={<Avatar name="Bilal Ahmed" bg="#E3EEF7" color="#2E5B7A" />}
              title="Bilal Ahmed"
              subtitle="Today, 3:26 PM · Transfer"
              showChevron
              onPress={() => {}}
              separator={false}
            />
          </Card>
        </Section>

        <Section title="Chip + Pill">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Selected" selected onPress={() => {}} />
            <Chip label="Chip" onPress={() => {}} />
          </View>
          <Pill label="Status" bg={c.greenTint} color={c.green} />
        </Section>

        <Section title="Avatar">
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Avatar name="Ammi Jaan" />
            <Avatar name="Sara Khan" bg="#E3EEF7" color="#2E5B7A" />
          </View>
        </Section>

        <Section title="Input">
          <Input
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Input — 56pt, 16 radius, amber focus"
            icon={<WalletIcon size={20} color={c.ink3} strokeWidth={2} />}
          />
        </Section>

        <Section title="Keypad + PinDots">
          <PinDots ref={pinDotsRef} filled={pin.length} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button label="Wrong PIN (shake)" variant="ghost" onPress={() => pinDotsRef.current?.shake()} testID="kit-shake" />
            <Button label="Clear" variant="ghost" onPress={() => setPin('')} />
          </View>
          <Keypad
            onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
            onBackspace={() => setPin((p) => p.slice(0, -1))}
          />
        </Section>

        <Section title="TabBar">
          <View style={{ borderRadius: 16, overflow: 'hidden' }}>
            <TabBar active={tab} onPress={setTab} />
          </View>
        </Section>

        <Section title="AIBar">
          <AIBar onPress={() => {}} />
        </Section>

        <Section title="Composer">
          <Composer
            value={composerText}
            onChangeText={setComposerText}
            placeholder="Type in English or Urdu…"
            hint={listening ? t('home.hint.speak') : t('home.hint.tap')}
            listening={listening}
            onMicPress={() => setListening(true)}
            onStopListening={() => setListening(false)}
          />
          <Button label={listening ? 'Stop demo listening' : 'Start demo listening'} variant="secondary" onPress={() => setListening((v) => !v)} />
        </Section>

        <Section title="Motion — Rise">
          <Rise delay={0}><Card><Text>Rise 0ms</Text></Card></Rise>
          <Rise delay={60}><Card><Text>Rise 60ms</Text></Card></Rise>
        </Section>

        <Section title="Motion — Breathe / ListeningRings / WaveBars / TypingDots">
          <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
            <Breathe>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.amber }} />
            </Breathe>
            <View style={{ width: 64, height: 64 }}>
              <ListeningRings size={64} color={c.amber} />
            </View>
          </View>
          <WaveBars color={c.navy} />
          <TypingDots color={c.ink3} />
        </Section>

        <Section title="Motion — useCountUp / useShake">
          <Text variant="money">{'₨' + (animatedBalance / 100).toLocaleString('en-PK')}</Text>
          <Button label="Bump balance" variant="secondary" onPress={() => setBalance((b) => b + 150000)} />
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Animated.View style={[{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#D64545' }, shake.style]} />
            <Button label="Shake" variant="ghost" onPress={shake.shake} />
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}
