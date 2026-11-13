import { useEffect, useRef, useState } from 'preact/hooks';
import './DashboardLanguageSwitcher.css';
import {
  getDashboardLanguage,
  setDashboardLanguage,
  subscribeDashboardLanguage,
  translateDashboard,
} from '@core/i18n/dashboard-language';

const languages = [
  { code: 'id', flag: '/flags/id.svg', label: 'Indonesia' },
  { code: 'en', flag: '/flags/gb.svg', label: 'English' },
  { code: 'de', flag: '/flags/de.svg', label: 'Deutsch' },
];

export default function DashboardLanguageSwitcher() {
  const [language, setLanguage] = useState('id');
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef(null);

  useEffect(() => {
    setLanguage(getDashboardLanguage());
    const unsubscribe = subscribeDashboardLanguage(setLanguage);
    const closeOnOutsideClick = (event) => {
      if (!switcherRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      switcherRef.current?.querySelector('button')?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      unsubscribe();
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const selectedLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <div class="dashboard-language-switcher" ref={switcherRef}>
      <button
        class="dashboard-language-button"
        type="button"
        aria-label={translateDashboard('language.label', language)}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <img class="dashboard-language-flag" src={selectedLanguage.flag} alt="" />
      </button>
      {isOpen && (
        <div class="dashboard-language-options" role="group" aria-label={translateDashboard('language.label', language)}>
          {languages.map((item) => (
            <button
              class="dashboard-language-option"
              type="button"
              aria-label={item.label}
              aria-pressed={language === item.code}
              onClick={() => {
                setDashboardLanguage(item.code);
                setIsOpen(false);
              }}
            >
              <img class="dashboard-language-flag" src={item.flag} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
