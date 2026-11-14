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

const STUDY_BUBBLES = [
  'Eh, masih di sini? Yuk lanjutin sesi berikutnya!',
  'Butuh bantuan materi? Tanya gua aja!',
];

function getWelcomeMessage(userName, userLevel) {
  return `Eh, halo ${userName}! 👋 Lu masih di ${userLevel} nih, mau gua temenin naik ke level berikutnya? Atau lu mau curhat dulu? Gua bisa dua-duanya kok.`;
}

/** Warna FAB sesuai strike level saat mode ujian aktif */
const STRIKE_COLORS = {
  0: { bg: 'var(--nd-status-safe)', ring: 'var(--nd-status-safe-ring)', label: 'Aman' },
  1: { bg: 'var(--nd-status-warning)', ring: 'var(--nd-status-warning-ring)', label: 'Peringatan 1' },
  2: { bg: 'var(--nd-status-alert)', ring: 'var(--nd-status-alert-ring)', label: 'Peringatan 2' },
  3: { bg: 'var(--nd-status-critical)', ring: 'var(--nd-status-critical-ring)', label: 'Bahaya!' },
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

// ── Komponen Utama: NdBot ───────────────────────────────────────────────────

export default function NdBot({
  mode = 'study',
  strikeLevel = 0,
  userName = 'teman',
  userLevel = 'A1 Pemula',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [examFlash, setExamFlash] = useState(false);
  const [bubbleIndex, setBubbleIndex] = useState(STUDY_BUBBLES.length - 1);
  const [isBubbleVisible, setIsBubbleVisible] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: getWelcomeMessage(userName, userLevel) },
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
    if (mode !== 'study') {
      setIsBubbleVisible(false);
      return undefined;
    }

    let hideTimer;
    const bubbleInterval = setInterval(() => {
      setBubbleIndex((current) => (current + 1) % STUDY_BUBBLES.length);
      setIsBubbleVisible(true);
      hideTimer = setTimeout(() => setIsBubbleVisible(false), 3500);
    }, 15000);

    return () => {
      clearInterval(bubbleInterval);
      clearTimeout(hideTimer);
    };
  }, [mode]);

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
    <div class={`ndbot ndbot--${mode}`}>
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

      {mode === 'study' && (
        <aside
          class={`ndbot-bubble${isBubbleVisible ? ' is-visible' : ''}`}
          aria-live="polite"
        >
          {STUDY_BUBBLES[bubbleIndex]}
        </aside>
      )}

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
        <span class="ndbot-character" aria-hidden="true">
          <span class="ndbot-antenna" />
          <span class="ndbot-head">
            <span class="ndbot-eyes">
              <i class="ndbot-eye" />
              <i class="ndbot-eye" />
            </span>
            <span class="ndbot-mouth" />
          </span>
          <span class="ndbot-body" />
          <span class="ndbot-arm ndbot-arm--left" />
          <span class="ndbot-arm ndbot-arm--wave">
            <span class="ndbot-hand" />
          </span>
        </span>
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
          --ndbot-surface: var(--card-bg);
          --ndbot-text: var(--text-main);
          --ndbot-border: var(--border);
          --ndbot-fab-bg: var(--accent-gold);
          --ndbot-fab-ring: var(--primary-hover);
          position: fixed;
          z-index: 9999;
          right: max(1rem, env(safe-area-inset-right));
          bottom: max(1rem, env(safe-area-inset-bottom));
          font-family: var(--font-body, 'Plus Jakarta Sans', system-ui, sans-serif);
          color: var(--ndbot-text);
        }

        .ndbot--exam { --ndbot-eye-color: var(--ndbot-fab-bg); }
        .ndbot--quiz { --ndbot-eye-color: var(--accent-gold); }

        .ndbot-bubble {
          position: absolute;
          right: .2rem;
          bottom: calc(100% + .65rem);
          width: max-content;
          max-width: min(250px, calc(100vw - 2.5rem));
          padding: .6rem .8rem;
          border: 1px solid var(--ndbot-border);
          border-radius: .8rem .8rem .2rem .8rem;
          background: var(--ndbot-surface);
          color: var(--ndbot-text);
          font-size: .78rem;
          font-weight: 700;
          line-height: 1.4;
          box-shadow: 0 8px 24px color-mix(in srgb, var(--bg-dark) 16%, transparent);
          opacity: 0;
          pointer-events: none;
          transform: translateY(6px) scale(.96);
          transition: opacity .2s ease, transform .2s ease;
        }
        .ndbot-bubble.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
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
          background: var(--bg-dark);
          color: var(--text-main);
          font-size: .82rem;
          font-weight: 700;
          line-height: 1.4;
          letter-spacing: .01em;
          box-shadow: 0 6px 20px color-mix(in srgb, var(--bg-dark) 22%, transparent);
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
          box-shadow: 0 16px 48px color-mix(in srgb, var(--bg-dark) 24%, transparent);
        }

        /* ── Header ───────────────────────────────────────────────── */
        .ndbot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          padding: .9rem 1rem;
          background: var(--bg-dark);
          color: var(--accent-gold);
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
        .ndbot-close:hover { background: color-mix(in srgb, var(--text-main) 12%, transparent); }

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
          background: var(--accent-gold);
          color: var(--bg-dark);
        }
        .ndbot-status {
          align-self: flex-start;
          margin: 0;
          color: var(--muted);
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
          background: var(--nd-whatsapp-bg);
          color: var(--text-main);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .ndbot-whatsapp:hover { background: var(--nd-whatsapp-hover); }

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
          outline: 2px solid var(--accent-gold);
          outline-offset: 1px;
        }
        .ndbot-form button {
          padding: 0 .85rem;
          border: 0;
          border-radius: .6rem;
          background: var(--accent-gold);
          color: var(--bg-dark);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          min-height: 40px;
        }
        .ndbot-form button:disabled { opacity: .5; cursor: not-allowed; }
        .ndbot-form button:not(:disabled):hover { background: var(--primary-hover); }

        /* ── FAB ──────────────────────────────────────────────────── */
        .ndbot-fab {
          position: relative;
          display: grid;
          width: 4.75rem;
          height: 5rem;
          margin-left: auto;
          place-items: center;
          border: 0;
          border-radius: 1.5rem;
          background: transparent;
          color: var(--bg-dark);
          cursor: pointer;
          transition: transform .2s ease, filter .2s ease;
        }
        .ndbot-fab:hover {
          transform: translateY(-2px);
          filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--ndbot-fab-ring) 40%, transparent));
        }
        .ndbot-fab:focus-visible {
          outline: 3px solid var(--ndbot-fab-bg);
          outline-offset: 3px;
        }

        .ndbot-character {
          position: relative;
          display: block;
          width: 4.2rem;
          height: 4.6rem;
          transform-origin: center bottom;
          animation: ndbot-breathe 3s ease-in-out infinite;
        }
        .ndbot-antenna {
          position: absolute;
          top: .05rem;
          left: 2rem;
          width: .18rem;
          height: .5rem;
          border-radius: 1rem;
          background: var(--accent-gold);
        }
        .ndbot-antenna::after {
          position: absolute;
          top: -.17rem;
          left: -.13rem;
          width: .44rem;
          height: .32rem;
          border-radius: 50%;
          background: var(--accent-gold);
          content: '';
        }
        .ndbot-head {
          position: absolute;
          top: .48rem;
          left: .65rem;
          display: grid;
          width: 2.9rem;
          height: 2.25rem;
          place-items: center;
          border: 2px solid var(--accent-gold);
          border-radius: .9rem;
          background: var(--bg-dark);
        }
        .ndbot-eyes {
          display: flex;
          gap: .55rem;
          transform-origin: center;
          animation: ndbot-blink 3s ease-in-out infinite;
        }
        .ndbot-eye {
          width: .42rem;
          height: .42rem;
          border-radius: 50%;
          background: var(--ndbot-eye-color, var(--accent-gold));
        }
        .ndbot-mouth {
          position: absolute;
          bottom: .34rem;
          width: .55rem;
          height: .13rem;
          border-radius: 1rem;
          background: var(--accent-gold);
        }
        .ndbot-body {
          position: absolute;
          bottom: .05rem;
          left: 1.05rem;
          width: 2.1rem;
          height: 1.65rem;
          border: 2px solid var(--accent-gold);
          border-radius: 1rem 1rem .55rem .55rem;
          background: var(--bg-dark);
        }
        .ndbot-arm {
          position: absolute;
          z-index: 1;
          width: .48rem;
          height: 1.25rem;
          border: 2px solid var(--accent-gold);
          border-radius: 1rem;
          background: var(--bg-dark);
        }
        .ndbot-arm--left {
          top: 2.55rem;
          left: .55rem;
          transform: rotate(24deg);
        }
        .ndbot-arm--wave {
          top: 1.05rem;
          right: .12rem;
          transform: translateX(10px) rotate(35deg);
          transform-origin: center bottom;
          animation: ndbot-wave 5s ease-in-out infinite;
        }
        .ndbot-hand {
          position: absolute;
          top: -.24rem;
          left: -.12rem;
          width: .62rem;
          height: .5rem;
          border: 2px solid var(--accent-gold);
          border-radius: 50%;
          background: var(--bg-dark);
        }
        .ndbot--exam .ndbot-arm--wave,
        .ndbot--quiz .ndbot-arm--wave { display: none; }

        @keyframes ndbot-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes ndbot-blink {
          0%, 44%, 51%, 100% { transform: scaleY(1); opacity: 1; }
          47%, 49% { transform: scaleY(.08); opacity: .65; }
        }
        @keyframes ndbot-wave {
          0%, 82%, 100% { opacity: 0; transform: translateX(10px) rotate(35deg); }
          84% { opacity: 1; transform: translateX(0) rotate(25deg); }
          86%, 90% { transform: translateX(0) rotate(-24deg); }
          88%, 92% { transform: translateX(0) rotate(28deg); }
          94% { opacity: 0; transform: translateX(10px) rotate(35deg); }
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
          background: var(--bg-dark);
          border: 2px solid var(--ndbot-fab-bg);
          color: var(--text-main);
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
          .ndbot-bubble { transition-duration: .01ms; }
        }
      `}</style>
    </div>
  );
}
