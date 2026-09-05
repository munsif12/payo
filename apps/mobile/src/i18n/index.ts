import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AUTH_STORAGE_KEY } from '../store/storageKeys';
import ur from './ur.json';
import en from './en.json';

// RTL approach: we do NOT rely on I18nManager.forceRTL (it requires an app
// restart to take effect). Layouts read isRTL() and use
// flexDirection: isRTL() ? 'row-reverse' : 'row', plus writingDirection on text.
i18n.use(initReactI18next).init({
  resources: { ur: { translation: ur }, en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
export default i18n;
export const isRTL = () => i18n.language === 'ur';

/** Switches the UI language AND writes it back into the persisted session, so the
 *  next cold start (app/_layout.tsx reads `stored.user.language`) comes up in the
 *  same language. The single entry point for a language change: the More → Profile
 *  toggle and the AI `profile` card (whose `applied` includes 'language') both use it.
 *  Persisting is best-effort — the in-memory switch must never fail because storage did. */
export async function applyLanguage(lang: string): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    // Imported lazily: this module is loaded by every unit test that touches a
    // translated string, and AsyncStorage's native module isn't available there.
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as { user?: { language?: string } };
    if (!stored?.user) return;
    stored.user.language = lang;
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable/corrupt — the language still changed for this session.
  }
}
