import { useEffect, useState } from 'preact/hooks';
import './DashboardLanguageSwitcher.css';
import {
  getDashboardLanguage,
  setDashboardLanguage,
  subscribeDashboardLanguage,
  translateDashboard,
} from '@core/i18n/dashboard-language';

const languages = [
  { code: 'id', flag: '🇮🇩', label: 'Indonesia' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
];

export default function DashboardLanguageSwitcher() {
  const [language, setLanguage] = useState('id');

  useEffect(() => {
    setLanguage(getDashboardLanguage());
    return subscribeDashboardLanguage(setLanguage);
  }, []);

  const selectedLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <label class="dashboard-language-switcher">
      <span class="visually-hidden">{translateDashboard('language.label', language)}</span>
      <span class="dashboard-language-flag" aria-hidden="true">{selectedLanguage.flag}</span>
      <select
        value={language}
        aria-label={translateDashboard('language.label', language)}
        onChange={(event) => {
          const selected = languages.find((item) => item.code === event.currentTarget.value);
          if (selected) setDashboardLanguage(selected.code);
        }}
      >
        {languages.map((item) => (
          <option value={item.code} aria-label={item.label}>{item.flag}</option>
        ))}
      </select>
    </label>
  );
}
