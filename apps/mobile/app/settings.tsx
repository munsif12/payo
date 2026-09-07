import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Phone, ShieldCheck, Sparkles, Users, Wallet } from 'lucide-react-native';
import { Screen, Text, Card, Button, Input, ListRow, useIsUrdu } from '../src/ui';
import { useTheme } from '../src/theme/useTheme';
import { space, touch } from '../src/theme/tokens';
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

// Settings — More → Settings (spec §4): trusted contact, approval ceiling, and the
// "PAYO speaks first" switch. Every guardian change is PIN-gated; tightening
// (setting a guardian, lowering the ceiling) applies at once, loosening (removing,
// raising) cools off first and the screen says when it will take effect.
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

  return (
    <Screen>
      <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', alignItems: 'center', gap: space.m, paddingTop: space.l, marginBottom: space.l }}>
        <Pressable testID="settings-back" accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2} style={urdu ? { transform: [{ scaleX: -1 }] } : undefined} />
        </Pressable>
        <Text variant="h2">{t('settings.title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.l, paddingBottom: space.xxxl }}>
        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          <ListRow
            testID="settings-guardian"
            left={<RowIcon icon={ShieldCheck} c={c} />}
            title={t('settings.trustedContact')}
            subtitle={isLoading
              ? t('common.loading')
              : guardian
                ? `${guardian.name} · ${ltrIsolate(guardian.phone)}`
                : t('guardian.none')}
            separator={false}
          />
          {pendingLine ? (
            <Text testID="settings-guardian-pending" variant="foot" color={c.amberDeep} style={{ paddingBottom: space.m }}>
              {pendingLine}
            </Text>
          ) : null}

          {phoneOpen ? (
            <View style={{ gap: space.s, paddingBottom: space.l }}>
              <Input
                testID="settings-guardian-phone"
                icon={<Phone size={18} color={c.ink3} strokeWidth={2} />}
                placeholder={t('settings.phonePlaceholder')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s }}>
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
            <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s, paddingBottom: space.l }}>
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

        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          <ListRow
            testID="settings-ceiling"
            left={<RowIcon icon={Wallet} c={c} />}
            title={t('settings.ceiling')}
            subtitle={t('settings.ceilingFoot', { amount: ltrIsolate(formatPaisa(ceilingPaisa)) })}
            separator={false}
          />
          {ceilingOpen ? (
            <View style={{ gap: space.s, paddingBottom: space.l }}>
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
              <View style={{ flexDirection: urdu ? 'row-reverse' : 'row', gap: space.s }}>
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
              style={{ marginBottom: space.l, minHeight: touch.min }}
            />
          )}
        </Card>

        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          <ListRow
            testID="settings-speaks-first"
            left={<RowIcon icon={Sparkles} c={c} />}
            title={t('settings.speaksFirst')}
            subtitle={t('settings.speaksFirstFoot')}
            right={
              <Switch
                testID="settings-speaks-first-switch"
                value={speaksFirst}
                onValueChange={onToggleSpeaksFirst}
                trackColor={{ true: c.amber, false: c.separator }}
              />
            }
            separator={false}
          />
        </Card>

        <Card padding={0} style={{ paddingHorizontal: space.l }}>
          <ListRow
            testID="settings-age-protection"
            left={<RowIcon icon={Users} c={c} />}
            title={t('settings.ageProtection.title')}
            subtitle={t('settings.ageProtection.foot')}
            separator={false}
          />
        </Card>

        {error ? <Text testID="settings-error" variant="sub" color={c.red} center>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function RowIcon({ icon: Icon, c }: { icon: typeof ShieldCheck; c: ReturnType<typeof useTheme>['c'] }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.amberTint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} color={c.navy} strokeWidth={2} />
    </View>
  );
}
