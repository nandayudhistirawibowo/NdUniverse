import { useState } from 'preact/hooks';
import { playSound } from '@core/game/quiz-sounds.js';

/** @param {{ words?: Array<{ german: string; indonesian: string; options: string[] }>; profession?: string }} props */
export default function CareerQuiz({ words, profession = 'Profesi' }) {
  const vocab = words ?? [];
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState('');
  const [finished, setFinished] = useState(false);

  const current = vocab[index];

  const start = () => {
    playSound('click');
    setStarted(true);
    setIndex(0);
    setScore(0);
    setSelected('');
    setFinished(false);
  };

  const choose = (answer) => {
    if (selected) return;
    playSound(answer === current.indonesian ? 'success' : 'error');
    setSelected(answer);
    if (answer === current.indonesian) setScore((value) => value + 1);
  };

  const next = () => {
    playSound('click');
    if (index + 1 >= vocab.length) {
      playSound(score >= Math.ceil(vocab.length / 2) ? 'success' : 'error');
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected('');
  };

  return (
    <section class="career-quiz" aria-live="polite">
      {!started ? (
        <>
          <p class="career-section-label">Latihan Kosakata</p>
          <div class="career-word-list">
            {vocab.map((word) => (
              <article key={word.german}>
                <strong lang="de">{word.german}</strong>
                <span>{word.indonesian}</span>
              </article>
            ))}
          </div>
          <button class="career-primary-button" type="button" onClick={start}>Mulai Kuis</button>
        </>
      ) : finished ? (
        <div class="career-quiz-result">
          <p class="career-section-label">Hasil Kuis</p>
          <h3>{score}/{vocab.length} jawaban benar</h3>
          <p>Kosakata {profession} berhasil dilatih.</p>
          <button class="career-secondary-button" type="button" onClick={start}>Ulangi Kuis</button>
        </div>
      ) : (
        <div>
          <p class="career-section-label">Kuis {index + 1}/{vocab.length}</p>
          <h3>Arti dari <span lang="de">{current.german}</span> adalah...</h3>
          <div class="career-options">
            {current.options.map((option) => (
              <button
                key={option}
                class={selected ? (option === current.indonesian ? 'correct' : option === selected ? 'wrong' : '') : ''}
                type="button"
                onClick={() => choose(option)}
                disabled={Boolean(selected)}
              >
                {option}
              </button>
            ))}
          </div>
          {selected && (
            <button class="career-primary-button" type="button" onClick={next}>
              {index + 1 >= vocab.length ? 'Lihat Hasil' : 'Lanjut'}
            </button>
          )}
        </div>
      )}
      <style>{`
        .career-quiz { display:grid; gap:.9rem; padding:1.25rem; border:1px solid var(--border); border-radius:14px; background:var(--card-bg); }
        .career-section-label { margin:0; color:#966313; font-size:.72rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .career-word-list { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.65rem; }
        .career-word-list article { display:grid; min-width:0; gap:.35rem; padding:.75rem; border:1px solid var(--border); border-radius:10px; }
        .career-word-list strong,.career-word-list span { overflow-wrap:anywhere; word-break:break-word; }
        .career-word-list strong { color:var(--text-main); }
        .career-word-list span { color:var(--muted); font-size:.85rem; }
        .career-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.65rem; margin:.8rem 0; }
        .career-options button,.career-primary-button,.career-secondary-button { min-height:44px; border-radius:.65rem; padding:.65rem .85rem; font-weight:800; cursor:pointer; }
        .career-options button { border:1px solid var(--border); background:var(--bg-main); color:var(--text-main); }
        .career-options button.correct { border-color:#9bd0a5; background:#edf8ef; color:#218838; }
        .career-options button.wrong { border-color:#e6a3a3; background:#fff2f2; color:#b42318; }
        .career-primary-button { width:fit-content; border:0; background:var(--accent-red); color:#fff; }
        .career-secondary-button { width:fit-content; border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); }
        .career-quiz-result h3,.career-quiz h3 { margin:.2rem 0; color:var(--text-main); }
        .career-quiz-result p:last-of-type { color:var(--muted); }
        @media(max-width:768px){ .career-quiz{padding:1rem;border-radius:12px;} .career-word-list{grid-template-columns:repeat(2,minmax(0,1fr));}.career-options{grid-template-columns:1fr;} .career-primary-button,.career-secondary-button{width:100%;} }
        @media(max-width:420px){ .career-word-list{grid-template-columns:1fr;} }
      `}</style>
    </section>
  );
}
