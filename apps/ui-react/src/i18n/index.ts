import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import skeleton locales (to be populated later)
// EN is the primary source of truth
import en from './locales/en.json';
import enUS from './locales/en-US.json';
import pt from './locales/pt.json';
import es from './locales/es.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

const resources = {
    en: { translation: en },
    'en-US': { translation: enUS },
    pt: { translation: pt },
    es: { translation: es },
    de: { translation: de },
    ja: { translation: ja },
    zh: { translation: zh }
};

/**
 * genOS™ v5.0.0 — Global Localization Engine
 * English-First architecture with support for 6 industrial hubs.
 */
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en-US',
        debug: false,
        interpolation: {
            escapeValue: false, // React already safe from XSS
        },
        detection: {
            order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage', 'cookie'],
        }
    });

export default i18n;
