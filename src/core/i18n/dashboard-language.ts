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
  const getParams = (element: HTMLElement): Record<string, string | number> =>
    element.dataset.i18nParams
      ? JSON.parse(element.dataset.i18nParams) as Record<string, string | number>
      : {};

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n as DashboardTranslationKey;
    element.textContent = translateDashboard(key, language, getParams(element));
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel as DashboardTranslationKey;
    element.setAttribute('aria-label', translateDashboard(key, language, getParams(element)));
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    const key = element.dataset.i18nTitle as DashboardTranslationKey;
    element.setAttribute('title', translateDashboard(key, language, getParams(element)));
  });

  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder as DashboardTranslationKey;
    element.setAttribute('placeholder', translateDashboard(key, language, getParams(element)));
  });

  root.querySelectorAll<HTMLInputElement>('[data-i18n-value]').forEach((element) => {
    const key = element.dataset.i18nValue as DashboardTranslationKey;
    element.value = translateDashboard(key, language, getParams(element));
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label-pressed]').forEach((element) => {
    const key = element.getAttribute('aria-pressed') === 'true'
      ? element.dataset.i18nAriaLabelPressed
      : element.dataset.i18nAriaLabel;
    if (key) {
      element.setAttribute(
        'aria-label',
        translateDashboard(key as DashboardTranslationKey, language, getParams(element)),
      );
    }
  });
}
