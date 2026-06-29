import { getRequestConfig } from 'next-intl/server';

/**
 * next-intl request configuration (single-locale setup, no URL routing).
 *
 * The app currently ships Spanish only; this puts the i18n framework in place so
 * adding a locale becomes config: drop `src/messages/<locale>.json`, resolve the
 * active locale here (cookie/header/user preference), and translate strings via
 * `useTranslations` / `getTranslations`.
 */
export const DEFAULT_LOCALE = 'es';

export const SUPPORTED_LOCALES = ['es'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export default getRequestConfig(async () => {
  const locale: AppLocale = DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
