import {
  dashboardDictionary,
  type DashboardLanguage,
  type DashboardTranslationKey,
} from './dashboard-dict';

export const DASHBOARD_LANGUAGE_KEY = 'nd-dashboard-language';
export const DASHBOARD_LANGUAGE_EVENT = 'nd:dashboard-language-changed';

const isDashboardLanguage = (value: string | null): value is DashboardLanguage =>
  value === 'id' || value === 'en' || value === 'de';

export function getDashboardLanguage(): DashboardLanguage {
  if (typeof window === 'undefined') return 'id';

  try {
    const storedLanguage = window.localStorage.getItem(DASHBOARD_LANGUAGE_KEY);
    return isDashboardLanguage(storedLanguage) ? storedLanguage : 'id';
  } catch (error) {
    console.warn('Could not read dashboard language preference.', error);
    return 'id';
  }
}

export function setDashboardLanguage(language: DashboardLanguage): void {
  try {
    window.localStorage.setItem(DASHBOARD_LANGUAGE_KEY, language);
  } catch (error) {
    console.warn('Could not save dashboard language preference.', error);
  }

  window.dispatchEvent(new CustomEvent<DashboardLanguage>(DASHBOARD_LANGUAGE_EVENT, {
    detail: language,
  }));
}

export function subscribeDashboardLanguage(
  callback: (language: DashboardLanguage) => void,
): () => void {
  const handleLanguageChange = (event: Event) => {
    const language = (event as CustomEvent<DashboardLanguage>).detail;
    if (isDashboardLanguage(language)) callback(language);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === DASHBOARD_LANGUAGE_KEY && isDashboardLanguage(event.newValue)) {
      callback(event.newValue);
    }
  };

  window.addEventListener(DASHBOARD_LANGUAGE_EVENT, handleLanguageChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(DASHBOARD_LANGUAGE_EVENT, handleLanguageChange);
    window.removeEventListener('storage', handleStorage);
  };
}

export function translateDashboard(
  key: DashboardTranslationKey,
  language: DashboardLanguage = getDashboardLanguage(),
  params: Record<string, string | number> = {},
): string {
  const template = dashboardDictionary[language][key] ?? dashboardDictionary.id[key];
  return Object.entries(params).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export function applyDashboardTranslations(
  root: ParentNode = document,
  language: DashboardLanguage = getDashboardLanguage(),
): void {
  const collect = <T extends HTMLElement>(selector: string): T[] => {
    const matches = [...root.querySelectorAll<T>(selector)];
    if (root instanceof HTMLElement && root.matches(selector)) matches.unshift(root as T);
    return matches;
  };
  const getParams = (element: HTMLElement): Record<string, string | number> =>
    element.dataset.i18nParams
      ? JSON.parse(element.dataset.i18nParams) as Record<string, string | number>
      : {};

  collect<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n as DashboardTranslationKey;
    const translation = translateDashboard(key, language, getParams(element));
    if (element.textContent !== translation) element.textContent = translation;
  });

  collect<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel as DashboardTranslationKey;
    const translation = translateDashboard(key, language, getParams(element));
    if (element.getAttribute('aria-label') !== translation) element.setAttribute('aria-label', translation);
  });

  collect<HTMLElement>('[data-i18n-title]').forEach((element) => {
    const key = element.dataset.i18nTitle as DashboardTranslationKey;
    const translation = translateDashboard(key, language, getParams(element));
    if (element.getAttribute('title') !== translation) element.setAttribute('title', translation);
  });

  collect<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder as DashboardTranslationKey;
    const translation = translateDashboard(key, language, getParams(element));
    if (element.getAttribute('placeholder') !== translation) element.setAttribute('placeholder', translation);
  });

  collect<HTMLInputElement>('[data-i18n-value]').forEach((element) => {
    const key = element.dataset.i18nValue as DashboardTranslationKey;
    const translation = translateDashboard(key, language, getParams(element));
    if (element.value !== translation) element.value = translation;
  });

  collect<HTMLElement>('[data-i18n-aria-label-pressed]').forEach((element) => {
    const key = element.getAttribute('aria-pressed') === 'true'
      ? element.dataset.i18nAriaLabelPressed
      : element.dataset.i18nAriaLabel;
    if (key) {
      const translation = translateDashboard(key as DashboardTranslationKey, language, getParams(element));
      if (element.getAttribute('aria-label') !== translation) {
        element.setAttribute('aria-label', translation);
      }
    }
  });
}
