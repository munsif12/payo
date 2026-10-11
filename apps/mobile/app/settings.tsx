import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Phone, ShieldCheck, Sparkles, Users, Wallet, type LucideIcon } from 'lucide-react-native';
import { Screen, Text, Card, Button, Input, ListRow, Avatar, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, touch, glassTokens } from '../src/theme/tokens';
import { usePinSheet } from '../src/pin/usePinSheet';
import {
  useGuardianQuery, useSetGuardianMutation, useRemoveGuardianMutation, useUpdateCeilingMutation,
  useMeQuery, useUpdateMeMutation, apiErr,
} from '../src/api/client';
import { guardianPendingLine } from '../src/components/cards/guardianPolicy';
import { formatPaisa } from '../src/lib/money';
import { ltrIsolate } from '../src/lib/bidi';
import i18n from '../src/i18n';
import type { PendingAction } from '../src/api/types';

/** B10: the trusted contact's 56 pt avatar. */
const GUARDIAN_AVATAR = 56;
const ROW_ICON = 24;

/** The PIN sheet renders a bilingual summary, so a guardian change needs one in both
 *  languages regardless of the current UI language — same approach as save_prompt. */
const bilingual = (key: string, opts?: Record<string, unknown>) => ({
  en: i18n.t(key, { lng: 'en', ...opts }),
  ur: i18n.t(key, { lng: 'ur', ...opts }),
});

/** A pseudo-action: it exists only to give the PIN sheet something to describe.
 *  Nothing is executed through /actions/:id — the sheet runs in guardian mode and
 *  the typed PIN goes straight to the guardian route (see PinSheetOptions). */
const pinAction = (id: string, summaryKey: string, opts?: Record<string, unknown>): PendingAction => ({
  id, kind: 'guardian', amountPaisa: 0, feePaisa: 0,
  summary: bilingual(summaryKey, opts), lines: [], requiresPin: true,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), status: 'pending',
});

// Settings — More → Settings (spec §4), skinned per GLASS-SPEC §5 B10: a glass
// back button + 28/800 title, the TRUSTED CONTACT card (avatar, name, phone,
// glass "Change" / red "Remove"), the approval-limit card with the amber
// amount, and the ASSISTANT card (speaks-first switch, age protection). Every
// guardian change is PIN-gated; tightening applies at once, loosening cools
// off first and the screen says when it will take effect. Behaviour unchanged.
export default function Settings() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const urdu = useIsUrdu();
  const router = useRouter();
  const { openPinSheet } = usePinSheet();
  const { data: guardianState, isLoading } = useGuardianQuery();
  const { data: me } = useMeQuery();
  const [setGuardian] = useSetGuardianMutation();
  const [removeGuardian] = useRemoveGuardianMutation();
  const [updateCeiling] = useUpdateCeilingMutation();
  const [updateMe] = useUpdateMeMutation();

  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [ceilingOpen, setCeilingOpen] = useState(false);
  const [ceilingRupees, setCeilingRupees] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guardian = guardianState?.guardian ?? null;
  const pending = guardianState?.pending ?? null;
  const ceilingPaisa = guardianState?.ceilingPaisa ?? 0;
  // Absent on an older backend — the server default is ON.
  const speaksFirst = me?.user.preferences?.proactiveGreeting ?? true;

  /** Every guardian change funnels through here: open the sheet, hand it the request
   *  to run with the typed PIN, and let the sheet own INVALID_PIN / PIN_LOCKED. */
  const withPin = async (action: PendingAction, run: (pin: string) => Promise<unknown>) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await openPinSheet(action, { execute: async (pin) => { await run(pin); } });
      return true;
    } catch (e) {
      const message = (e as Error)?.message;
      if (message !== 'cancelled' && message !== 'busy') setError(apiErr(e).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSaveGuardian = async () => {
    const value = phone.trim();
    if (!value) return;
    const ok = await withPin(
      pinAction('guardian-set', guardian ? 'settings.pin.changeGuardian' : 'settings.pin.setGuardian', { phone: value }),
      (pin) => setGuardian({ phone: value, pin }).unwrap(),
    );
    if (ok) { setPhoneOpen(false); setPhone(''); }
  };

  const onRemoveGuardian = () =>
    withPin(
      pinAction('guardian-remove', 'settings.pin.removeGuardian', { name: guardian?.name ?? '' }),
      (pin) => removeGuardian({ pin }).unwrap(),
    );

  const onSaveCeiling = async () => {
    const rupees = Number(ceilingRupees);
    if (!Number.isFinite(rupees) || rupees < 0) return;
    const next = Math.round(rupees) * 100;
    const raising = next > ceilingPaisa;
    const ok = await withPin(
      pinAction('guardian-ceiling', raising ? 'settings.pin.raiseCeiling' : 'settings.pin.lowerCeiling', {
        amount: formatPaisa(next),
      }),
      (pin) => updateCeiling({ ceilingPaisa: next, pin }).unwrap(),
    );
    if (ok) { setCeilingOpen(false); setCeilingRupees(''); }
  };

  const onToggleSpeaksFirst = async (value: boolean) => {
    setError(null);
    try {
      await updateMe({ preferences: { proactiveGreeting: value } }).unwrap();
    } catch (e) {
      setError(apiErr(e).message);
    }
  };

  // Three ways, not two: `replace` names the INCOMING contact (the backend schedules
  // a swap rather than a remove-then-set), `remove` never shows an amount, and `raise`
  // shows the ceiling it is going to. See guardianPolicy.guardianPendingLine.
  const pendingLine = guardianPendingLine(
    pending,
    ceilingPaisa,
    t,
    (paisa) => ltrIsolate(formatPaisa(paisa)),
  );

  const row = { flexDirection: urdu ? 'row-reverse' : 'row' } as const;
  const sub = (text: string) => <Text variant="sub" color={c.ink2} numberOfLines={1}>{text}</Text>;

  return (
    <Screen>
      <BackHeader testID="settings-back" title={t('settings.title')} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xxxl }}>
        <Card style={{ gap: space.m }}>
          <SectionLabel>{t('settings.trustedContact')}</SectionLabel>
          <ListRow
            testID="settings-guardian"
            left={<Avatar name={guardian?.name || '?'} size={GUARDIAN_AVATAR} />}
            title={(
              <Text variant="h2" color={c.ink} numberOfLines={1}>
                {isLoading ? t('common.loading') : guardian ? guardian.name : t('settings.trustedContact')}
              </Text>
            )}
            subtitle={sub(guardian ? ltrIsolate(guardian.phone) : isLoading ? '' : t('guardian.none'))}
            separator={false}
            style={{ paddingVertical: 0 }}
          />
          {pendingLine ? (
            <Text testID="settings-guardian-pending" variant="sub" color={c.amber}>
              {pendingLine}
            </Text>
          ) : null}

          {phoneOpen ? (
            <View style={{ gap: space.s }}>
              <Input
                testID="settings-guardian-phone"
                icon={<Phone size={18} color={c.ink3} strokeWidth={2} />}
                placeholder={t('settings.phonePlaceholder')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <View style={[row, { gap: space.s }]}>
                <Button
                  testID="settings-guardian-save"
                  label={t('common.save')}
                  onPress={onSaveGuardian}
                  disabled={!phone.trim() || busy}
                  style={{ flex: 1, minHeight: touch.min }}
                />
                <Button
                  testID="settings-guardian-cancel"
                  variant="ghost"
                  label={t('common.cancel')}
                  onPress={() => { setPhoneOpen(false); setPhone(''); }}
                  style={{ flex: 1, minHeight: touch.min }}
                />
              </View>
            </View>
          ) : (
            <View style={[row, { gap: space.s }]}>
              <Button
                testID="settings-guardian-edit"
                variant="secondary"
                label={guardian ? t('settings.changeContact') : t('settings.setContact')}
                onPress={() => { setPhoneOpen(true); setPhone(guardian?.phone ?? ''); }}
                style={{ flex: 1, minHeight: touch.min }}
              />
              {guardian ? (
                <Button
                  testID="settings-guardian-remove"
                  variant="danger"
                  label={t('common.remove')}
                  onPress={onRemoveGuardian}
                  disabled={busy}
                  style={{ flex: 1, minHeight: touch.min }}
                />
              ) : null}
            </View>
          )}
        </Card>

        <Card style={{ gap: space.m }}>
          <ListRow
            testID="settings-ceiling"
            left={<RowIcon icon={Wallet} />}
            title={t('settings.ceiling')}
            subtitle={sub(t('settings.ceilingFoot', { amount: ltrIsolate(formatPaisa(ceilingPaisa)) }))}
            right={(
              <Text variant="hl" weight={700} color={c.amber}>{ltrIsolate(formatPaisa(ceilingPaisa))}</Text>
            )}
            separator={false}
            style={{ paddingVertical: 0 }}
          />
          {ceilingOpen ? (
            <View style={{ gap: space.s }}>
              <Input
                testID="settings-ceiling-input"
                placeholder={t('settings.ceilingPlaceholder')}
                value={ceilingRupees}
                onChangeText={(v) => setCeilingRupees(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
              <Text variant="foot">
                {Number(ceilingRupees || '0') * 100 > ceilingPaisa ? t('settings.raiseNote') : t('settings.lowerNote')}
              </Text>
              <View style={[row, { gap: space.s }]}>
                <Button
                  testID="settings-ceiling-save"
                  label={t('common.save')}
                  onPress={onSaveCeiling}
                  disabled={!ceilingRupees || busy}
                  style={{ flex: 1, minHeight: touch.min }}
                />
                <Button
                  testID="settings-ceiling-cancel"
                  variant="ghost"
                  label={t('common.cancel')}
                  onPress={() => { setCeilingOpen(false); setCeilingRupees(''); }}
                  style={{ flex: 1, minHeight: touch.min }}
                />
              </View>
            </View>
          ) : (
            <Button
              testID="settings-ceiling-edit"
              variant="secondary"
              label={t('settings.changeCeiling')}
              onPress={() => { setCeilingOpen(true); setCeilingRupees(String(Math.round(ceilingPaisa / 100))); }}
              disabled={!guardian}
              style={{ minHeight: touch.min }}
            />
          )}
        </Card>

        <View style={{ gap: space.s }}>
          <SectionLabel>{t('settings.section.assistant')}</SectionLabel>
          <Card padding={0} style={{ paddingHorizontal: space.l }}>
            <ListRow
              testID="settings-speaks-first"
              left={<RowIcon icon={Sparkles} />}
              title={t('settings.speaksFirst')}
              subtitle={sub(t('settings.speaksFirstFoot'))}
              right={
                <Switch
                  testID="settings-speaks-first-switch"
                  value={speaksFirst}
                  onValueChange={onToggleSpeaksFirst}
                  trackColor={{ true: c.amber, false: c.separator }}
                />
              }
            />
            <ListRow
              testID="settings-age-protection"
              left={<RowIcon icon={Users} />}
              title={t('settings.ageProtection.title')}
              subtitle={sub(t('settings.ageProtection.foot'))}
              separator={false}
            />
          </Card>
        </View>

        {error ? <Text testID="settings-error" variant="sub" color={c.red} center>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

/** B10 rows carry a bare 24 pt amber icon (no square — that is the More screen's vocabulary). */
function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={ROW_ICON} color={c.amber} strokeWidth={2} />
    </View>
  );
}

/** Section label — 12/600 uppercase, letter-spacing 0.96, ink3 (§2). */
function SectionLabel({ children }: { children: string }) {
  const urdu = useIsUrdu();
  return <Text variant="cap" style={{ letterSpacing: urdu ? undefined : 0.96 }}>{children}</Text>;
}

/** Stack-screen header: a 44 pt round glass back button and the 28/800 title. */
function BackHeader({ testID, title, onBack }: { testID: string; title: string; onBack: () => void }) {
  const { c } = useTheme();
  const urdu = useIsUrdu();
  return (
    <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={8}
        style={{ width: touch.min, height: touch.min, borderRadius: touch.min / 2, backgroundColor: c.surface, borderWidth: glassTokens.line, borderColor: c.separator, alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
      </Pressable>
      <Text variant="h1" weight={800} color={c.ink} numberOfLines={1} style={{ flex: 1, lineHeight: urdu ? undefined : 34 }}>{title}</Text>
    </View>
  );
}
