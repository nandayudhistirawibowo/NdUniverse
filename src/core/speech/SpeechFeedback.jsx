export default function SpeechFeedback({ feedback, state, message }) {
  if (!feedback && !message && state === 'idle') return null;

  return (
    <div class="speech-feedback" role="status" aria-live="polite">
      {state === 'listening' && <p class="speech-state speech-listening">Mendengarkan…</p>}
      {state === 'processing' && <p class="speech-state">Memproses ucapan…</p>}
      {state === 'next' && <p class="speech-state">Lanjut…</p>}
      {message && <p class="speech-error">{message}</p>}
      {feedback && (
        <>
          <p>Kamu: "{feedback.transcript}"</p>
          <p>Keyword kena: [{feedback.matched.join(', ')}]</p>
          <p>Skor: {Math.round(feedback.score * 100)}%</p>
        </>
      )}
      <style>{`
        .speech-feedback { margin:.6rem 0; padding:.7rem .85rem; border-radius:.6rem; background:var(--bg-main,rgba(0,0,0,.06)); line-height:1.55; }
        .speech-feedback p { margin:.2rem 0; }
        .speech-state { font-weight:700; }
        .speech-listening { color:var(--accent-red,#d64545); }
        .speech-error,.speech-word-missing { color:#d32f2f; }
        .speech-word-missing { text-decoration:line-through; }
        .speech-word-matched { color:inherit; }
        .speech-mic-listening { animation:speechPulse 1s ease-in-out infinite; }
        @keyframes speechPulse { 50% { box-shadow:0 0 0 10px rgba(214,69,69,.22); transform:scale(1.05); } }
      `}</style>
    </div>
  );
}
