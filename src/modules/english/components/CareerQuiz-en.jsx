import { useState } from 'preact/hooks';
import { playSound } from '@core/game/quiz-sounds.js';

const WORDS_PER_BATCH = 5;

/** @param {{ words?: Array<{ word: string; translation: string; context: string; contextIndonesian?: string }>; profession?: string }} props */
export default function CareerQuiz({ words = [], profession = 'Career' }) {
  const [phase, setPhase] = useState('intro');
  const [batchIndex, setBatchIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [batchScore, setBatchScore] = useState(0);
  const [selected, setSelected] = useState('');

  const batchCount = Math.ceil(words.length / WORDS_PER_BATCH);
  const batchWords = words.slice(batchIndex * WORDS_PER_BATCH, (batchIndex + 1) * WORDS_PER_BATCH);
  const current = batchWords[questionIndex];
  const overallIndex = batchIndex * WORDS_PER_BATCH + questionIndex;

  const getOptions = () => {
    if (!current) return [];
    const distractors = [];
    for (let offset = 1; offset <= words.length && distractors.length < 3; offset += 1) {
      const translation = words[(overallIndex + offset) % words.length]?.translation;
      if (translation && translation !== current.translation && !distractors.includes(translation)) {
        distractors.push(translation);
      }
    }

    const options = [current.translation, ...distractors];
    const rotation = options.length ? overallIndex % options.length : 0;
    return [...options.slice(rotation), ...options.slice(0, rotation)];
  };

  const startQuiz = () => {
    playSound('click');
    setPhase('quiz');
    setBatchIndex(0);
    setQuestionIndex(0);
    setScore(0);
    setBatchScore(0);
    setSelected('');
  };

  const chooseAnswer = (answer) => {
    if (selected || !current) return;
    playSound('click');
    setSelected(answer);
    if (answer === current.translation) {
      playSound('success');
      setScore((value) => value + 1);
      setBatchScore((value) => value + 1);
    } else {
      playSound('error');
    }
  };

  const advance = () => {
    playSound('click');
    if (questionIndex + 1 < batchWords.length) {
      setQuestionIndex((value) => value + 1);
      setSelected('');
      return;
    }

    setPhase(batchIndex + 1 < batchCount ? 'batch-complete' : 'finished');
  };

  const startNextBatch = () => {
    playSound('click');
    setBatchIndex((value) => value + 1);
    setQuestionIndex(0);
    setBatchScore(0);
    setSelected('');
    setPhase('quiz');
  };

  return (
    <section class="career-quiz" aria-live="polite">
      {phase === 'intro' && (
        <div class="quiz-intro">
          <p class="career-section-label">Latihan Kosakata</p>
          <h2><span>{profession} </span><span>Kuis Kosakata</span></h2>
          <p>Latih {words.length} kosakata karier dalam kelompok berisi {WORDS_PER_BATCH}. Pilih arti dalam bahasa Indonesia yang paling sesuai dengan setiap kata bahasa Inggris.</p>
          {words.length === 0 ? (
            <p class="quiz-empty">Konten kosakata belum tersedia.</p>
          ) : (
            <button class="career-primary-button" type="button" onClick={startQuiz}>Mulai Kuis</button>
          )}
        </div>
      )}

      {phase === 'quiz' && current && (
        <div class="quiz-question">
          <div class="quiz-progress">
            <p class="career-section-label">Kelompok {batchIndex + 1} dari {batchCount}</p>
            <span>Kata {questionIndex + 1} dari {batchWords.length}</span>
          </div>
          <h2>Apa arti <span>{current.word}</span>?</h2>
          <p class="quiz-context" lang="en">{current.context}</p>
          <div class="career-options">
            {getOptions().map((option) => (
              <button
                key={option}
                class={selected ? (option === current.translation ? 'correct' : option === selected ? 'wrong' : '') : ''}
                type="button"
                onClick={() => chooseAnswer(option)}
                disabled={Boolean(selected)}
              >
                {option}
              </button>
            ))}
          </div>
          {selected && (
            <div class={selected === current.translation ? 'answer-feedback is-correct' : 'answer-feedback is-wrong'}>
              <strong>{selected === current.translation ? 'Benar!' : `Belum tepat. Jawaban yang benar: ${current.translation}`}</strong>
              {current.contextIndonesian && <p>{current.contextIndonesian}</p>}
              <button class="career-primary-button" type="button" onClick={advance}>
                <span>
                  {questionIndex + 1 < batchWords.length ? 'Kata Berikutnya' : batchIndex + 1 < batchCount ? 'Selesaikan Kelompok' : 'Lihat Hasil'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'batch-complete' && (
        <div class="quiz-result">
          <p class="career-section-label">Kelompok {batchIndex + 1} Selesai</p>
          <h2>{batchScore}/{batchWords.length} jawaban benar</h2>
          <p>Siap berlatih lima kosakata {profession.toLowerCase()} berikutnya?</p>
          <button class="career-primary-button" type="button" onClick={startNextBatch}>Mulai Kelompok Berikutnya</button>
        </div>
      )}

      {phase === 'finished' && (
        <div class="quiz-result">
          <p class="career-section-label">Kuis Selesai</p>
          <h2>{score}/{words.length} jawaban benar</h2>
          <p>Kamu telah menyelesaikan seluruh {batchCount} kelompok kosakata untuk {profession}.</p>
          <button class="career-secondary-button" type="button" onClick={startQuiz}>Coba Lagi</button>
        </div>
      )}

      <style>{`
        .career-quiz {
          --quiz-ink: var(--text-main, #2b2d42);
          --quiz-muted: var(--muted, #6b7280);
          --quiz-border: var(--border, rgba(43,45,66,.13));
          --quiz-card: var(--card-bg, #fff);
          --quiz-success: #218838;
          --quiz-error: #b42318;
          display:grid;
          gap:1rem;
          padding:1.25rem;
          border:1px solid var(--quiz-border);
          border-radius:14px;
          background:var(--quiz-card);
          color:var(--quiz-ink);
        }
        .quiz-intro,.quiz-result,.quiz-question { display:grid; gap:.75rem; }
        .career-section-label { margin:0; color:var(--accent-gold,#966313); font-size:.72rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .career-quiz h2 { margin:0; color:var(--quiz-ink); font-size:clamp(1.2rem,3vw,1.6rem); }
        .quiz-intro > p:not(.career-section-label),.quiz-result > p:not(.career-section-label) { margin:0; color:var(--quiz-muted); line-height:1.6; }
        .quiz-empty { color:var(--quiz-error)!important; }
        .quiz-progress { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
        .quiz-progress > span { color:var(--quiz-muted); font-size:.9rem; }
        .quiz-context { margin:0; color:var(--quiz-muted); font-style:italic; line-height:1.6; }
        .career-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.65rem; }
        .career-options button,.career-primary-button,.career-secondary-button { min-height:44px; border-radius:.65rem; padding:.65rem .85rem; font:inherit; font-weight:800; cursor:pointer; }
        .career-options button { border:1px solid var(--quiz-border); background:var(--bg-main,var(--quiz-card)); color:var(--quiz-ink); text-align:left; }
        .career-options button:disabled { cursor:default; }
        .career-options button.correct { border-color:var(--quiz-success); background:color-mix(in srgb,var(--quiz-success) 10%,var(--quiz-card)); color:var(--quiz-success); }
        .career-options button.wrong { border-color:var(--quiz-error); background:color-mix(in srgb,var(--quiz-error) 8%,var(--quiz-card)); color:var(--quiz-error); }
        .career-primary-button { width:fit-content; border:0; background:var(--accent-red,#d93838); color:#fff; }
        .career-secondary-button { width:fit-content; border:1px solid var(--quiz-border); background:var(--quiz-card); color:var(--quiz-ink); }
        .answer-feedback { display:grid; gap:.6rem; padding:.85rem; border-radius:.65rem; background:var(--bg-main,#f8f9fa); }
        .answer-feedback.is-correct strong { color:var(--quiz-success); }
        .answer-feedback.is-wrong strong { color:var(--quiz-error); }
        .answer-feedback p { margin:0; color:var(--quiz-muted); }
        @media(max-width:600px) {
          .career-options { grid-template-columns:1fr; }
          .quiz-progress { align-items:flex-start; flex-direction:column; gap:.35rem; }
        }
      `}</style>
    </section>
  );
}
