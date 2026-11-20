export default function SpeechFeedback({
  feedback,
  state,
  message,
  volumeLevel = 0,
  noiseFloor = null,
  onStop,
}) {
  if (!feedback && !message && state === 'idle') return null;

  return (
    <div class="speech-feedback" role="status" aria-live="polite">
      {state === 'listening' && <p class="speech-state speech-listening">Mendengarkan…</p>}
      {state === 'listening' && (
        <>
          <progress class="speech-volume-meter" max="1" value={volumeLevel} aria-label="Volume mikrofon" />
          {onStop && <button class="speech-stop-button" type="button" onClick={onStop}>Stop rekaman</button>}
          {noiseFloor !== null && noiseFloor > 0.1 && (
            <p class="speech-noise-warning">Lingkungan terlalu berisik. Suara musik/orang lain mungkin mengganggu.</p>
          )}
        </>
      )}
      {state === 'processing' && (
        <p class="speech-state">
          <span class="speech-upload-spinner" aria-hidden="true" />
          Mengunggah dan memproses ucapan…
        </p>
      )}
      {state === 'next' && <p class="speech-state">Lanjut…</p>}
      {message && <p class="speech-error">{message}</p>}
      {feedback && (
        <>
          {feedback.transcript.trim() && (
            <p>
              Kamu mengucapkan: '{feedback.transcript}'
              {feedback.source === 'groq' && <span class="speech-source-badge">🎙️ Groq</span>}
              {feedback.source === 'speechmatics' && (
                <span class="speech-source-badge" title="Fallback: Speechmatics Global English">
                  🎙️ Speechmatics
                </span>
              )}
              {feedback.source === 'browser' && <span class="speech-source-badge">🎙️ Browser</span>}
            </p>
          )}
          {feedback.score === 0 ? (
            <p class="speech-error">Tidak terdeteksi / Suara kurang jelas. Coba lagi dan pastikan suara kamu lebih keras dari musik.</p>
          ) : (
            <>
              <p>Keyword kena: [{feedback.matched.join(', ')}]</p>
              <p>Skor: {Math.round(feedback.score * 100)}%</p>
            </>
          )}
        </>
      )}
      <style>{`
        .speech-feedback { margin:.6rem 0; padding:.7rem .85rem; border-radius:.6rem; background:var(--bg-main,rgba(0,0,0,.06)); line-height:1.55; }
        .speech-feedback p { margin:.2rem 0; }
        .speech-state { font-weight:700; }
        .speech-listening { color:var(--accent-red,#d64545); }
        .speech-error { color:#d32f2f; }
        .speech-noise-warning { color:#b77900; font-size:.85rem; font-weight:700; }
        .speech-volume-meter { display:block; width:min(240px,100%); height:.55rem; margin:.4rem 0; accent-color:var(--accent-red,#d64545); }
        .speech-stop-button { padding:.35rem .7rem; border:1px solid currentColor; border-radius:.4rem; background:transparent; color:inherit; cursor:pointer; }
        .speech-source-badge { display:inline-block; margin-left:.5rem; padding:.12rem .4rem; border-radius:999px; background:rgba(38,128,88,.13); color:#18704b; font-size:.75em; font-weight:700; }
        .speech-upload-spinner { display:inline-block; width:.8rem; height:.8rem; margin-right:.4rem; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; vertical-align:-.1em; animation:speechSpin .7s linear infinite; }
        .speech-mic-listening { animation:speechPulse 1s ease-in-out infinite; }
        @keyframes speechSpin { to { transform:rotate(360deg); } }
        @keyframes speechPulse { 50% { box-shadow:0 0 0 10px rgba(214,69,69,.22); transform:scale(1.05); } }
      `}</style>
    </div>
  );
}
