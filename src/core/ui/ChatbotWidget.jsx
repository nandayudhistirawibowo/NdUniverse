import { useEffect, useRef, useState } from 'preact/hooks';

const WELCOME_MESSAGE = 'Halo! Saya NdUniverse Assistant. Ada yang ingin kamu tanyakan tentang materi atau latihan?';

function renderInlineMarkdown(text) {
  const parts = [];
  const formatting = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = formatting.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(match[1] !== undefined
      ? <strong key={`bold-${match.index}`}>{match[1]}</strong>
      : <em key={`italic-${match.index}`}>{match[2]}</em>);
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
      blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInlineMarkdown(paragraph.join(' '))}</p>);
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`}>
          {listItems.map((item, index) => (
            <li key={`item-${index}`}>{renderInlineMarkdown(item)}</li>
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

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

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
          messages: nextMessages.slice(-12).map(({ role, content: message }) => ({
            role,
            content: message,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result || typeof result.message !== 'string') {
        throw new Error(typeof result?.message === 'string' ? result.message : 'Chat request failed.');
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
        {
          role: 'assistant',
          content: 'Maaf, pesan belum terkirim. Coba lagi sebentar lagi.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function openWhatsApp(link) {
    if (!/^https:\/\/wa\.me\/6281288951254(?:\?|$)/i.test(link)) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  return (
    <div class="nd-chatbot">
      {isOpen && (
        <section class="nd-chatbot-window" aria-label="NdUniverse Assistant chat">
          <header class="nd-chatbot-header">
            <div>
              <strong>NdUniverse Assistant</strong>
              <span>Learning support</span>
            </div>
            <button
              class="nd-chatbot-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div class="nd-chatbot-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                class={`nd-chatbot-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === 'assistant'
                  ? renderAssistantMessage(message.content)
                  : <p>{message.content}</p>}
                {message.waLink && (
                  <button
                    class="nd-chatbot-whatsapp"
                    type="button"
                    onClick={() => openWhatsApp(message.waLink)}
                  >
                    Buka WhatsApp
                  </button>
                )}
              </div>
            ))}
            {isSending && <p class="nd-chatbot-status" role="status">Sedang mengetik...</p>}
            <div ref={messagesEndRef} />
          </div>

          <form class="nd-chatbot-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onInput={(event) => setInput(event.currentTarget.value)}
              placeholder="Tulis pesan..."
              aria-label="Message"
              maxLength={2000}
              disabled={isSending}
            />
            <button type="submit" disabled={isSending || !input.trim()}>
              Kirim
            </button>
          </form>
        </section>
      )}

      <button
        class="nd-chatbot-fab"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close NdUniverse Assistant' : 'Open NdUniverse Assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? '×' : '💬'}
      </button>

      <style>{`
        .nd-chatbot {
          --chatbot-surface: var(--card-bg);
          --chatbot-text: var(--text-main);
          --chatbot-muted: var(--text-main);
          --chatbot-border: var(--border);
          position: fixed;
          z-index: 9999;
          right: max(1rem, env(safe-area-inset-right));
          bottom: max(1rem, env(safe-area-inset-bottom));
          color: var(--chatbot-text);
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .nd-chatbot-window {
          position: absolute;
          right: 0;
          bottom: calc(100% + .75rem);
          display: flex;
          flex-direction: column;
          width: min(350px, calc(100vw - 2rem));
          height: min(450px, calc(100dvh - 6rem));
          overflow: hidden;
          border: 1px solid var(--chatbot-border);
          border-radius: 1rem;
          background: var(--chatbot-surface);
          box-shadow: 0 16px 48px color-mix(in srgb, var(--bg-dark) 24%, transparent);
        }
        .nd-chatbot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          padding: .9rem 1rem;
          background: var(--bg-dark);
          color: var(--accent-gold);
        }
        .nd-chatbot-header div { display: grid; gap: .15rem; }
        .nd-chatbot-header span { font-size: .75rem; opacity: .82; }
        .nd-chatbot-close {
          width: 2rem;
          height: 2rem;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 1.5rem;
          cursor: pointer;
        }
        .nd-chatbot-messages {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: .7rem;
          overflow-y: auto;
          padding: 1rem;
          background: var(--chatbot-surface);
        }
        .nd-chatbot-message {
          max-width: 85%;
          padding: .65rem .8rem;
          border-radius: .9rem;
          font-size: .9rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .nd-chatbot-message p { margin: 0; }
        .nd-chatbot-message p + p { margin-top: .55rem; }
        .nd-chatbot-message ul { margin: .45rem 0 0; padding-left: 1.2rem; }
        .nd-chatbot-message li + li { margin-top: .2rem; }
        .nd-chatbot-message.assistant {
          align-self: flex-start;
          border: 1px solid var(--chatbot-border);
          background: var(--chatbot-surface);
          color: var(--chatbot-text);
        }
        .nd-chatbot-message.user {
          align-self: flex-end;
          background: var(--accent-gold);
          color: var(--bg-dark);
        }
        .nd-chatbot-status {
          align-self: flex-start;
          margin: 0;
          color: var(--chatbot-muted);
          font-size: .8rem;
        }
        .nd-chatbot-whatsapp {
          margin-top: .65rem;
          border: 0;
          border-radius: .55rem;
          min-height: 40px;
          padding: .55rem .8rem;
          background: #128c7e;
          color: var(--card-bg);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .nd-chatbot-form {
          display: flex;
          gap: .5rem;
          padding: .75rem;
          border-top: 1px solid var(--chatbot-border);
          background: var(--chatbot-surface);
        }
        .nd-chatbot-form input {
          min-width: 0;
          flex: 1;
          border: 1px solid var(--chatbot-border);
          border-radius: .6rem;
          padding: .65rem .75rem;
          background: var(--chatbot-surface);
          color: var(--chatbot-text);
          font: inherit;
          font-size: 16px;
        }
        .nd-chatbot-form button, .nd-chatbot-fab {
          border: 0;
          background: var(--accent-gold);
          color: var(--bg-dark);
          cursor: pointer;
        }
        .nd-chatbot-form button {
          border-radius: .6rem;
          padding: 0 .85rem;
          font: inherit;
          font-weight: 700;
        }
        .nd-chatbot-form button:disabled { cursor: not-allowed; opacity: .55; }
        .nd-chatbot-fab {
          display: grid;
          width: 3.5rem;
          height: 3.5rem;
          margin-left: auto;
          place-items: center;
          border-radius: 50%;
          box-shadow: 0 6px 20px color-mix(in srgb, var(--bg-dark) 25%, transparent);
          font-size: 1.4rem;
        }
        .nd-chatbot button:focus-visible, .nd-chatbot input:focus-visible {
          outline: 3px solid var(--chatbot-text);
          outline-offset: 2px;
        }
        @media (max-width: 480px) {
          .nd-chatbot-window {
            width: calc(100vw - 2rem);
            height: min(450px, calc(100dvh - 6rem));
          }
        }
      `}</style>
    </div>
  );
}
