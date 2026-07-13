import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { applyDomLocalization, startDomLocalization } from "./dom-localization";
import { DEFAULT_LOCALE, LANGUAGE_STORAGE_KEY, i18nextResources, supportedLocales } from "./locales";

function preferredLocale() {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const storedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLocale && supportedLocales.includes(storedLocale)) return storedLocale;

  return DEFAULT_LOCALE;
}

function syncDocumentLanguage(locale: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: preferredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

syncDocumentLanguage(i18n.language);
startDomLocalization(() => i18n.language);
i18n.on("languageChanged", (locale) => {
  syncDocumentLanguage(locale);
  applyDomLocalization(locale);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  }
});

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };
