/**
 * NdBot.jsx — Generasi baru chatbot NdUniverse
 *
 * Props:
 *   mode        'study' | 'exam' | 'quiz'   (default: 'study')
 *   strikeLevel  0 | 1 | 2 | 3    (default: 0, hanya relevan di mode 'exam')
 *
 * Mode 'study' → perilaku chatbot normal (RAG aktif, bisa dibuka/tutup)
 * Mode 'exam'  → chat dinonaktifkan, FAB berubah warna sesuai strikeLevel,
 *                klik FAB memunculkan toast "Mode Ujian Aktif. Fokus!"
 * Mode 'quiz'  → chat dinonaktifkan, klik FAB memunculkan toast
 *                "Fokus kerjain kuisnya dulu ya! Nanti kalau udah selesai baru tanya-tanya."
 */

import { useEffect, useRef, useState } from 'preact/hooks';

// ── Konstanta ───────────────────────────────────────────────────────────────

const WELCOME_MESSAGE =
  'Halo! Saya NdUniverse Assistant. Ada yang ingin kamu tanyakan tentang materi atau latihan?';

/** Warna FAB sesuai strike level saat mode ujian aktif */
const STRIKE_COLORS = {
  0: { bg: '#22c55e', ring: '#16a34a', label: 'Aman' },
  1: { bg: '#eab308', ring: '#ca8a04', label: 'Peringatan 1' },
  2: { bg: '#f97316', ring: '#ea580c', label: 'Peringatan 2' },
  3: { bg: '#ef4444', ring: '#dc2626', label: 'Bahaya!' },
};

// ── Helpers: inline markdown renderer ───────────────────────────────────────

function renderInlineMarkdown(text) {
  const parts = [];
  const formatting = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = formatting.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      match[1] !== undefined
        ? <strong key={`bold-${match.index}`}>{match[1]}</strong>
        : <em key={`italic-${match.index}`}>{match[2]}</em>,
    );
    lastIndex = formatting.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function renderAssistantMessage(content) {
  const blocks = [];
  let paragraph = [];
  let listItems = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(
        <p key={`para-${blocks.length}`}>{renderInlineMarkdown(paragraph.join(' '))}</p>,
      );
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`}>
          {listItems.map((item, i) => (
            <li key={`li-${i}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  }

  content.split(/\r?\n/).forEach((line) => {
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  });

  flushParagraph();
  flushList();
  return blocks;
}

// ── SVG Robot Icon ───────────────────────────────────────────────────────────

function RobotIcon({ faceColor }) {
  const c = faceColor || '#1A1A1E';
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Antena */}
      <line x1="12" y1="5.5" x2="12" y2="3" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="2.5" r="1.2" fill={c} />
      {/* Kepala */}
      <rect x="6" y="5.5" width="12" height="8" rx="2.5" fill={c} />
      {/* Mata */}
      <circle cx="9.5" cy="9.5" r="1.4" fill="white" opacity="0.9" />
      <circle cx="14.5" cy="9.5" r="1.4" fill="white" opacity="0.9" />
      {/* Badan */}
      <rect x="7" y="14.5" width="10" height="6.5" rx="2" fill={c} />
      {/* Telinga / konektor */}
      <rect x="4" y="7" width="2" height="4" rx="1" fill={c} />
      <rect x="18" y="7" width="2" height="4" rx="1" fill={c} />
    </svg>
  );
}

// ── Komponen Utama: NdBot ───────────────────────────────────────────────────

export default function NdBot({ mode = 'study', strikeLevel = 0 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [examFlash, setExamFlash] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const messagesEndRef = useRef(null);

  const isExamMode = mode === 'exam';
  const isQuizMode = mode === 'quiz';
  const isLocked = isExamMode || isQuizMode;
  const clampedStrike = Math.min(Math.max(Number(strikeLevel) || 0, 0), 3);
  const strikeInfo = STRIKE_COLORS[clampedStrike];

  // Auto-tutup window kalau tiba-tiba masuk exam atau quiz mode
  useEffect(() => {
    if (isLocked) setIsOpen(false);
  }, [isLocked]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  // ── Handler FAB ──────────────────────────────────────────────────────────
  function handleFabClick() {
    if (isLocked) {
      // Tampilkan toast sebentar
      setExamFlash(true);
      setTimeout(() => setExamFlash(false), 1800);
      return;
    }
    setIsOpen((o) => !o);
  }

  // ── Kirim pesan ke API ───────────────────────────────────────────────────
  async function sendMessage(event) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.slice(-12).map(({ role, content: msg }) => ({
            role,
            content: msg,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result || typeof result.message !== 'string') {
        throw new Error(
          typeof result?.message === 'string' ? result.message : 'Chat request failed.',
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.message,
          ...(result.type === 'whatsapp' && typeof result.waLink === 'string'
            ? { waLink: result.waLink }
            : {}),
        },
      ]);
    } catch (error) {
      console.error('NdUniverse chat request failed.', error);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'Maaf, pesan belum terkirim. Coba lagi sebentar lagi.' },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function openWhatsApp(link) {
    if (!/^https:\/\/wa\.me\/6281288951254(?:\?|$)/i.test(link)) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  // ── FAB color (CSS custom property) ─────────────────────────────────────
  const fabStyle = isExamMode
    ? `--ndbot-fab-bg: ${strikeInfo.bg}; --ndbot-fab-ring: ${strikeInfo.ring};`
    : '--ndbot-fab-bg: var(--accent-gold); --ndbot-fab-ring: var(--primary-hover);';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div class="ndbot">
      {/* Toast: muncul di exam atau quiz mode saat diklik */}
      <div
        class={`ndbot-exam-toast${examFlash ? ' ndbot-exam-toast--visible' : ''}`}
        aria-live="assertive"
        aria-atomic="true"
      >
        {isQuizMode
          ? 'Fokus kerjain kuisnya dulu ya! Nanti kalau udah selesai baru tanya-tanya.'
          : '🔒 Mode Ujian Aktif. Fokus!'}
      </div>

      {/* Chat window — hanya di mode study */}
      {!isLocked && isOpen && (
        <section class="ndbot-window" aria-label="NdUniverse Assistant chat">
          <header class="ndbot-header">
            <div>
              <strong>NdUniverse Assistant</strong>
              <span>Learning support</span>
            </div>
            <button
              class="ndbot-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup chat"
            >
              ×
            </button>
          </header>

          <div class="ndbot-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                class={`ndbot-message ndbot-message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === 'assistant'
                  ? renderAssistantMessage(message.content)
                  : <p>{message.content}</p>}
                {message.waLink && (
                  <button
                    class="ndbot-whatsapp"
                    type="button"
                    onClick={() => openWhatsApp(message.waLink)}
                  >
                    Buka WhatsApp
                  </button>
                )}
              </div>
            ))}
            {isSending && (
              <p class="ndbot-status" role="status">Sedang mengetik...</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form class="ndbot-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onInput={(e) => setInput(e.currentTarget.value)}
              placeholder="Tulis pesan..."
              aria-label="Pesan"
              maxLength={2000}
              disabled={isSending}
            />
            <button type="submit" disabled={isSending || !input.trim()}>
              Kirim
            </button>
          </form>
        </section>
      )}

      {/* FAB Button */}
      <button
        class={`ndbot-fab${isExamMode ? ' ndbot-fab--exam' : ''}${isQuizMode ? ' ndbot-fab--quiz' : ''}`}
        type="button"
        onClick={handleFabClick}
        style={fabStyle}
        aria-label={
          isExamMode
            ? `NdBot — ${strikeInfo.label} (${clampedStrike}/3 pelanggaran)`
            : isQuizMode
              ? 'NdBot — Mode Kuis'
              : isOpen
                ? 'Tutup NdUniverse Assistant'
                : 'Buka NdUniverse Assistant'
        }
        aria-expanded={!isLocked ? isOpen : undefined}
      >
        <RobotIcon faceColor={isExamMode ? '#fff' : 'var(--bg-dark)'} />
        {/* Badge strike — hanya exam mode & strike > 0 */}
        {isExamMode && clampedStrike > 0 && (
          <span class="ndbot-strike-badge" aria-hidden="true">
            {clampedStrike}
          </span>
        )}
      </button>

      <style>{`
        /* ── Wrapper ──────────────────────────────────────────────── */
        .ndbot {
          --ndbot-surface: var(--card-bg, #fff);
          --ndbot-text: var(--text-main, #2B2D42);
          --ndbot-border: var(--border, rgba(43,45,66,.13));
          --ndbot-fab-bg: var(--accent-gold, #E5A93B);
          --ndbot-fab-ring: var(--primary-hover, #C98D23);
          position: fixed;
          z-index: 9999;
          right: max(1rem, env(safe-area-inset-right));
          bottom: max(1rem, env(safe-area-inset-bottom));
          font-family: var(--font-body, 'Plus Jakarta Sans', system-ui, sans-serif);
          color: var(--ndbot-text);
        }

        /* ── Toast exam & quiz ────────────────────────────────────── */
        .ndbot-exam-toast {
          position: absolute;
          right: 0;
          bottom: calc(100% + .6rem);
          width: max-content;
          max-width: min(300px, calc(100vw - 2.5rem));
          padding: .65rem .95rem;
          border-radius: .7rem;
          background: var(--bg-dark, #1A1A1E);
          color: #fff;
          font-size: .82rem;
          font-weight: 700;
          line-height: 1.4;
          letter-spacing: .01em;
          box-shadow: 0 6px 20px rgba(0,0,0,.22);
          pointer-events: none;
          opacity: 0;
          transform: translateY(6px) scale(.95);
          transition: opacity .18s ease, transform .18s ease;
        }
        .ndbot-exam-toast--visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        /* ── Chat window ──────────────────────────────────────────── */
        .ndbot-window {
          position: absolute;
          right: 0;
          bottom: calc(100% + .75rem);
          display: flex;
          flex-direction: column;
          width: min(350px, calc(100vw - 2rem));
          height: min(450px, calc(100dvh - 6rem));
          overflow: hidden;
          border: 1px solid var(--ndbot-border);
          border-radius: 1rem;
          background: var(--ndbot-surface);
          box-shadow: 0 16px 48px color-mix(in srgb, var(--bg-dark, #1A1A1E) 24%, transparent);
        }

        /* ── Header ───────────────────────────────────────────────── */
        .ndbot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          padding: .9rem 1rem;
          background: var(--bg-dark, #1A1A1E);
          color: var(--accent-gold, #E5A93B);
        }
        .ndbot-header div { display: grid; gap: .15rem; }
        .ndbot-header span { font-size: .75rem; opacity: .82; color: inherit; }

        .ndbot-close {
          display: grid;
          width: 2rem;
          height: 2rem;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: inherit;
          font-size: 1.5rem;
          cursor: pointer;
          line-height: 1;
        }
        .ndbot-close:hover { background: rgba(255,255,255,.12); }

        /* ── Messages ─────────────────────────────────────────────── */
        .ndbot-messages {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: .7rem;
          overflow-y: auto;
          padding: 1rem;
          background: var(--ndbot-surface);
        }
        .ndbot-message {
          max-width: 85%;
          padding: .65rem .8rem;
          border-radius: .9rem;
          font-size: .9rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .ndbot-message p { margin: 0; }
        .ndbot-message p + p { margin-top: .55rem; }
        .ndbot-message ul { margin: .45rem 0 0; padding-left: 1.2rem; }
        .ndbot-message li + li { margin-top: .2rem; }
        .ndbot-message--assistant {
          align-self: flex-start;
          border: 1px solid var(--ndbot-border);
          background: var(--ndbot-surface);
          color: var(--ndbot-text);
        }
        .ndbot-message--user {
          align-self: flex-end;
          background: var(--accent-gold, #E5A93B);
          color: var(--bg-dark, #1A1A1E);
        }
        .ndbot-status {
          align-self: flex-start;
          margin: 0;
          color: var(--muted, #6B7280);
          font-size: .8rem;
        }

        /* ── WhatsApp button ──────────────────────────────────────── */
        .ndbot-whatsapp {
          display: block;
          margin-top: .65rem;
          min-height: 40px;
          padding: .55rem .8rem;
          border: 0;
          border-radius: .55rem;
          background: #128c7e;
          color: #fff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .ndbot-whatsapp:hover { background: #0e7265; }

        /* ── Form ─────────────────────────────────────────────────── */
        .ndbot-form {
          display: flex;
          gap: .5rem;
          padding: .75rem;
          border-top: 1px solid var(--ndbot-border);
          background: var(--ndbot-surface);
        }
        .ndbot-form input {
          min-width: 0;
          flex: 1;
          padding: .65rem .75rem;
          border: 1px solid var(--ndbot-border);
          border-radius: .6rem;
          background: var(--ndbot-surface);
          color: var(--ndbot-text);
          font: inherit;
          font-size: 16px; /* cegah iOS zoom */
        }
        .ndbot-form input:focus-visible {
          outline: 2px solid var(--accent-gold, #E5A93B);
          outline-offset: 1px;
        }
        .ndbot-form button {
          padding: 0 .85rem;
          border: 0;
          border-radius: .6rem;
          background: var(--accent-gold, #E5A93B);
          color: var(--bg-dark, #1A1A1E);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          min-height: 40px;
        }
        .ndbot-form button:disabled { opacity: .5; cursor: not-allowed; }
        .ndbot-form button:not(:disabled):hover { background: var(--primary-hover, #C98D23); }

        /* ── FAB ──────────────────────────────────────────────────── */
        .ndbot-fab {
          position: relative;
          display: grid;
          width: 3.5rem;
          height: 3.5rem;
          margin-left: auto;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: var(--ndbot-fab-bg);
          color: var(--bg-dark, #1A1A1E);
          cursor: pointer;
          box-shadow:
            0 6px 20px color-mix(in srgb, var(--ndbot-fab-ring) 35%, transparent),
            0 0 0 0 color-mix(in srgb, var(--ndbot-fab-ring) 50%, transparent);
          transition:
            background .25s ease,
            box-shadow .25s ease,
            transform .15s ease;
        }
        .ndbot-fab:hover {
          transform: scale(1.07);
          box-shadow:
            0 8px 24px color-mix(in srgb, var(--ndbot-fab-ring) 45%, transparent),
            0 0 0 4px color-mix(in srgb, var(--ndbot-fab-ring) 20%, transparent);
        }
        .ndbot-fab:focus-visible {
          outline: 3px solid var(--ndbot-fab-bg);
          outline-offset: 3px;
        }

        /* Pulse animasi untuk exam mode saat strike > 0 */
        .ndbot-fab--exam {
          animation: ndbot-pulse 2.2s ease-in-out infinite;
        }

        /* Flash animasi saat diklik di exam mode */
        .ndbot-fab[data-exam-flash='true'] {
          animation: ndbot-flash .4s ease 2;
        }

        @keyframes ndbot-pulse {
          0%, 100% {
            box-shadow:
              0 6px 20px color-mix(in srgb, var(--ndbot-fab-ring) 35%, transparent),
              0 0 0 0 color-mix(in srgb, var(--ndbot-fab-ring) 50%, transparent);
          }
          50% {
            box-shadow:
              0 6px 20px color-mix(in srgb, var(--ndbot-fab-ring) 35%, transparent),
              0 0 0 8px color-mix(in srgb, var(--ndbot-fab-ring) 0%, transparent);
          }
        }

        @keyframes ndbot-flash {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.18); }
        }

        /* ── Strike badge ─────────────────────────────────────────── */
        .ndbot-strike-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          display: grid;
          width: 1.15rem;
          height: 1.15rem;
          place-items: center;
          border-radius: 50%;
          background: #1A1A1E;
          border: 2px solid var(--ndbot-fab-bg);
          color: #fff;
          font-size: .62rem;
          font-weight: 800;
          line-height: 1;
        }

        /* ── Focus utility ────────────────────────────────────────── */
        .ndbot button:focus-visible,
        .ndbot input:focus-visible {
          outline: 3px solid var(--ndbot-fab-bg);
          outline-offset: 2px;
        }

        /* ── Responsive ───────────────────────────────────────────── */
        @media (max-width: 480px) {
          .ndbot-window {
            width: calc(100vw - 2rem);
            height: min(450px, calc(100dvh - 6rem));
          }
        }

        /* Hormat ke prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .ndbot-fab--exam { animation: none; }
          .ndbot-exam-toast { transition-duration: .01ms; }
        }
      `}</style>
    </div>
  );
}
