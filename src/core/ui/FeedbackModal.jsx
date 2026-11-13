import { useEffect, useState } from 'preact/hooks';
import {
  getDashboardLanguage,
  subscribeDashboardLanguage,
  translateDashboard,
} from '@core/i18n/dashboard-language';

export default function FeedbackModal({ variant = 'default', language }) {
  const [selectedLanguage, setSelectedLanguage] = useState(language ?? 'id');
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const t = (key, params) => translateDashboard(key, selectedLanguage, params);

  useEffect(() => {
    if (language) {
      setSelectedLanguage(language);
      return undefined;
    }

    setSelectedLanguage(getDashboardLanguage());
    return subscribeDashboardLanguage(setSelectedLanguage);
  }, [language]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const sendFeedback = () => {
    const cleanedMessage = message.trim();
    if (!cleanedMessage) return;

    const currentUrl = window.location.href;
    const text = [
        t('feedback.greeting'),
        '',
        t('feedback.report'),
        `${t('feedback.category')}: ${t(`feedback.${category}`)}`,
        `${t('feedback.message')}: ${cleanedMessage}`,
        t('feedback.sentFrom', { url: currentUrl }),
      ].join('\n');

    window.open(`https://wa.me/6281288951254?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <button
        class={`feedback-trigger feedback-trigger-${variant}`}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">💬</span>
        <span>{t('feedback.trigger')}</span>
      </button>

      {isOpen && (
        <div
          class="feedback-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            class="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            <div class="feedback-modal-header">
              <div>
                <span class="feedback-label">{t('feedback.contact')}</span>
                <h2 id="feedback-title">{t('feedback.title')}</h2>
              </div>
              <button
                class="feedback-close"
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t('feedback.close')}
              >
                ×
              </button>
            </div>

            <label class="feedback-field" for="feedback-category">
              <span>{t('feedback.category')}</span>
              <select
                id="feedback-category"
                value={category}
                onChange={(event) => setCategory(event.currentTarget.value)}
              >
                <option value="bug">{t('feedback.bug')}</option>
                <option value="feature">{t('feedback.feature')}</option>
                <option value="other">{t('feedback.other')}</option>
              </select>
            </label>

            <label class="feedback-field" for="feedback-message">
              <span>{t('feedback.message')}</span>
              <textarea
                id="feedback-message"
                value={message}
                onInput={(event) => setMessage(event.currentTarget.value)}
                placeholder={t('feedback.placeholder')}
                rows="7"
              />
            </label>

            <div class="feedback-actions">
              <button class="feedback-cancel" type="button" onClick={() => setIsOpen(false)}>
                {t('feedback.cancel')}
              </button>
              <button
                class="feedback-submit"
                type="button"
                onClick={sendFeedback}
                disabled={!message.trim()}
              >
                {t('feedback.send')}
              </button>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .feedback-trigger {
          display: inline-flex;
          min-height: 40px;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          border: 1px solid var(--border, rgba(43, 45, 66, 0.13));
          border-radius: 999px;
          padding: 0.55rem 0.85rem;
          background: var(--card-bg, #ffffff);
          color: var(--text-main, #2b2d42);
          cursor: pointer;
          font-weight: 800;
          white-space: nowrap;
        }

        .feedback-trigger:hover,
        .feedback-trigger:focus-visible {
          border-color: var(--accent-gold, #e5a93b);
          box-shadow: 0 8px 20px rgba(26, 26, 30, 0.08);
        }

        .feedback-trigger-sidebar {
          width: 100%;
          min-height: 44px;
          justify-content: flex-start;
          border: 0;
          border-radius: 8px;
          padding: 0.5rem 0.65rem;
          background: transparent;
          color: #fff;
          font-size: 0.78rem;
        }

        .feedback-trigger-sidebar:hover,
        .feedback-trigger-sidebar:focus-visible {
          border: 0;
          background: var(--accent-gold, #e5a93b);
          color: var(--bg-dark, #1a1a1e);
          box-shadow: none;
        }

        .feedback-trigger-mobile {
          width: 100%;
          justify-content: flex-start;
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .feedback-backdrop {
          position: fixed;
          z-index: 10020;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 1rem;
          padding-inline: max(1rem, env(safe-area-inset-left), env(safe-area-inset-right));
          padding-bottom: max(1rem, env(safe-area-inset-bottom));
          background: rgba(26, 26, 30, 0.62);
          backdrop-filter: blur(5px);
        }

        .feedback-modal {
          width: min(520px, 100%);
          max-height: calc(100dvh - 2rem);
          overflow-y: auto;
          border: 1px solid var(--border, rgba(43, 45, 66, 0.13));
          border-radius: 20px;
          padding: 1.25rem;
          background: var(--card-bg, #ffffff);
          color: var(--text-main, #2b2d42);
          box-shadow: 0 24px 70px rgba(26, 26, 30, 0.24);
        }

        .feedback-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .feedback-label {
          color: var(--accent-gold, #e5a93b);
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .feedback-modal h2 {
          margin: 0.15rem 0 0;
          font-size: 1.35rem;
        }

        .feedback-close {
          width: 38px;
          height: 38px;
          border: 1px solid var(--border, rgba(43, 45, 66, 0.13));
          border-radius: 50%;
          background: var(--bg-main, #f9f9fb);
          cursor: pointer;
          font-size: 1.35rem;
          line-height: 1;
        }

        .feedback-field {
          display: grid;
          gap: 0.45rem;
          margin-top: 0.85rem;
          font-weight: 700;
        }

        .feedback-field select,
        .feedback-field textarea {
          width: 100%;
          border: 1px solid var(--border, rgba(43, 45, 66, 0.13));
          border-radius: 12px;
          padding: 0.75rem 0.85rem;
          background: var(--bg-main, #f9f9fb);
          color: var(--text-main, #2b2d42);
          font: inherit;
        }

        .feedback-field textarea {
          resize: vertical;
          min-height: 150px;
        }

        .feedback-field select:focus,
        .feedback-field textarea:focus {
          outline: 3px solid rgba(229, 169, 59, 0.22);
          border-color: var(--accent-gold, #e5a93b);
        }

        .feedback-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.1rem;
        }

        .feedback-actions button {
          min-height: 42px;
          border-radius: 999px;
          padding: 0.65rem 1rem;
          cursor: pointer;
          font-weight: 800;
        }

        .feedback-cancel {
          border: 1px solid var(--border, rgba(43, 45, 66, 0.13));
          background: var(--card-bg, #ffffff);
          color: var(--text-main, #2b2d42);
        }

        .feedback-submit {
          border: 1px solid var(--accent-gold, #e5a93b);
          background: var(--accent-gold, #e5a93b);
          color: var(--bg-dark, #1a1a1e);
        }

        .feedback-submit:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        @media (max-width: 640px) {
          .feedback-trigger {
            width: 40px;
            padding: 0.55rem;
          }

          .feedback-trigger span:last-child {
            display: none;
          }

          .feedback-trigger-sidebar,
          .feedback-trigger-mobile {
            width: 100%;
            justify-content: flex-start;
            padding: 0.55rem 0.75rem;
          }

          .feedback-trigger-sidebar span:last-child,
          .feedback-trigger-mobile span:last-child {
            display: inline;
          }

          .feedback-modal {
            border-radius: 16px;
            max-height: calc(100dvh - 1rem);
          }

          .feedback-actions {
            flex-direction: column-reverse;
          }

          .feedback-actions button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
