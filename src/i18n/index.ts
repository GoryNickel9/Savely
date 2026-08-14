import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import it from "./locales/it.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "spendy-language";

/**
 * Italiano resta italiano, qualunque altra lingua del browser degrada in inglese.
 */
export function detectBrowserLanguage(browserLanguages: ReadonlyArray<string | undefined>): "it" | "en" {
  const prefersItalian = browserLanguages.some((lang) => lang?.toLowerCase().startsWith("it"));
  return prefersItalian ? "it" : "en";
}

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      return stored;
    }
  } catch {
    // localStorage non disponibile (SSR/incognito): si usa il rilevamento
  }
  const browserLanguages =
    typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  return detectBrowserLanguage(browserLanguages);
}

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: "it",
  // Le chiavi sono le stringhe italiane originali: in italiano il testo
  // coincide con la chiave, quindi it.json resta quasi vuoto e ogni
  // stringa non ancora tradotta degrada elegantemente in italiano.
  interpolation: {
    escapeValue: false, // React effettua già l'escaping
  },
  returnEmptyString: false,
});

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignora: è solo persistenza del preferito
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
}

export function changeLanguage(code: LanguageCode) {
  void i18n.changeLanguage(code);
}

export default i18n;
