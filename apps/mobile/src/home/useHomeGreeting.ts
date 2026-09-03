import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Zap, Wallet, Smartphone, FileText, type LucideIcon } from 'lucide-react-native';
import { useMeQuery, useDueBillsQuery } from '../api/client';
import { greetingBucket, billSubtitle, type Translate } from './homeGreetingLogic';
import type { DueBill } from '../api/types';

export { greetingBucket, billSubtitle };

export interface Suggestion {
  key: 'send' | 'bill' | 'balance' | 'topup' | 'statement';
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Exact text sent as the user's turn when the card is tapped. */
  intent: string;
}

/** The five Home suggestion cards, in the brief's fixed order. Pure — takes a
 * translator + plain data so it's testable without RTK/i18next context. */
export function buildSuggestions(urdu: boolean, dueBill: DueBill | undefined, t: Translate): Suggestion[] {
  return [
    {
      key: 'send', icon: Send,
      title: t('home.suggest.send.title'), subtitle: t('home.suggest.send.subtitle'),
      intent: t('home.suggest.send.intent'),
    },
    {
      key: 'bill', icon: Zap,
      title: t('home.suggest.bill.title'), subtitle: billSubtitle(dueBill, urdu, t),
      intent: t('home.suggest.bill.intent'),
    },
    {
      key: 'balance', icon: Wallet,
      title: t('home.suggest.balance.title'), subtitle: t('home.suggest.balance.subtitle'),
      intent: t('home.suggest.balance.intent'),
    },
    {
      key: 'topup', icon: Smartphone,
      title: t('home.suggest.topup.title'), subtitle: t('home.suggest.topup.subtitle'),
      intent: t('home.suggest.topup.intent'),
    },
    {
      key: 'statement', icon: FileText,
      title: t('home.suggest.statement.title'), subtitle: t('home.suggest.statement.subtitle'),
      intent: t('home.suggest.statement.intent'),
    },
  ];
}

/** Home screen greeting + suggestions — header text, assistant greeting
 * bubble, and the 5 suggestion cards (bill subtitle sourced from the
 * caller's first due bill, GET /bills/due). */
export function useHomeGreeting() {
  const { t, i18n } = useTranslation();
  const urdu = i18n.language === 'ur';
  const { data: me } = useMeQuery();
  const { data: due } = useDueBillsQuery();
  const dueBill = due?.items?.[0];

  const bucket = greetingBucket(new Date().getHours());
  const name = me ? (urdu && me.user.urduName ? me.user.urduName : me.user.name) : '';

  const suggestions = useMemo(() => buildSuggestions(urdu, dueBill, t), [urdu, dueBill, t]);

  return {
    greetingFoot: t(`home.greeting.${bucket}`),
    name,
    greetingMessage: t('home.greeting.hello', { name }),
    suggestions,
    balancePaisa: me?.account.balancePaisa ?? 0,
  };
}
