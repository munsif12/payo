import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
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
