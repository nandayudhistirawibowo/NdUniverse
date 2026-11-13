import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useExamAntiCheat } from '@core/game/useExamAntiCheat.js';
import NdBot from '@core/ui/NdBot.jsx';
import { playSound } from '@core/game/quiz-sounds.js';
import { isFuzzyMatch } from '@core/game/fuzzy-match.js';
import {
  calculateModuleScore,
  getBandScore,
  getExamResult,
  getIeltsBandScore,
  getToeflTotalScore,
  isPassed,
  saveExamResult,
} from '@core/game/exam-grading.js';

const MODULES = ['reading', 'listening', 'writing', 'speaking'];
const MODULE_LABELS = {
  reading: 'Membaca',
  listening: 'Menyimak',
  writing: 'Menulis',
  speaking: 'Berbicara',
};
const MODULE_MINUTES = {
  A1: { reading: 15, listening: 10, writing: 15, speaking: 5 },
  A2: { reading: 18, listening: 12, writing: 18, speaking: 6 },
  B1: { reading: 20, listening: 15, writing: 20, speaking: 8 },
  B2: { reading: 25, listening: 20, writing: 25, speaking: 10 },
  C1: { reading: 30, listening: 25, writing: 30, speaking: 12 },
  C2: { reading: 35, listening: 30, writing: 35, speaking: 15 },
};

function countWords(value) {
  return value.trim().match(/\S+/g)?.length ?? 0;
}

function scoreChoices(questions, answers, type) {
  const correct = questions.reduce((total, question, index) => total + Number(answers[index] === question.answer), 0);
  return calculateModuleScore(correct, questions.length, type);
}

function scoreText(answer, targetWords, type) {
  return calculateModuleScore(Math.min(countWords(answer), targetWords), targetWords, type);
}

function scoreKeywords(answer, keywords, type) {
  const matched = keywords.filter((keyword) => isFuzzyMatch(answer, keyword)).length;
  return calculateModuleScore(matched, keywords.length, type);
}

function getWritingPrompts(writing, examType) {
  if (typeof writing === 'string') {
    return [{ id: 'writing-answer', title: 'Menulis', prompt: writing }];
  }
  if (!writing || typeof writing !== 'object') return [];
  if (examType === 'ielts') {
    return [
      { id: 'writing-task1', title: 'Tugas Menulis 1', prompt: writing.task1 },
      { id: 'writing-task2', title: 'Tugas Menulis 2', prompt: writing.task2 },
    ].filter((task) => typeof task.prompt === 'string');
  }
  return [
    { id: 'writing-integrated', title: 'Menulis Terpadu', prompt: writing.integrated },
    {
      id: 'writing-academic-discussion',
      title: 'Diskusi Akademik',
      prompt: writing.academic_discussion,
    },
  ].filter((task) => typeof task.prompt === 'string');
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function EnglishExam({ exam, type, level }) {
  const examType = String(type ?? exam?.exam_type ?? '').toLowerCase();
  const examLevel = String(level ?? exam?.level ?? 'A1').toUpperCase();
  const durations = MODULE_MINUTES[examLevel] ?? MODULE_MINUTES.A1;
  const readingQuestions = (exam?.reading ?? []).flatMap((group) => (
    Array.isArray(group.questions)
      ? group.questions.map((question) => ({ ...question, passage: group.passage }))
      : [group]
  ));
  const listeningQuestions = (exam?.listening ?? []).flatMap((group) => (
    Array.isArray(group.questions)
      ? group.questions.map((question) => ({ ...question, transcript: group.transcript }))
      : [group]
  ));
  const writingPrompts = getWritingPrompts(exam?.writing, examType);
  const speakingParts = Array.isArray(exam?.speaking?.parts)
    ? exam.speaking.parts.map((part, index) => ({ ...part, id: `speaking-part-${index + 1}` }))
    : exam?.speaking?.question
      ? [{ ...exam.speaking, part: 'Berbicara', id: 'speaking-part-1' }]
      : [];
  const speakingKeywords = speakingParts.flatMap((part) => part.keywords ?? []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(durations.reading * 60);
  const [answers, setAnswers] = useState({ reading: [], listening: [] });
  const [writingAnswers, setWritingAnswers] = useState({});
  const [speakingAnswers, setSpeakingAnswers] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [examResult, setExamResult] = useState(null);
  const [isStarted, setIsStarted] = useState(false);
  const resultSoundPlayed = useRef(false);

  const activeModule = MODULES[activeIndex];
  const writingAnswer = Object.values(writingAnswers).join(' ');
  const speakingAnswer = Object.values(speakingAnswers).join(' ');
  const scores = useMemo(() => ({
    reading: scoreChoices(readingQuestions, answers.reading, examType),
    listening: scoreChoices(listeningQuestions, answers.listening, examType),
    writing: scoreText(writingAnswer, 20, examType),
    speaking: scoreKeywords(speakingAnswer, speakingKeywords, examType),
  }), [readingQuestions, listeningQuestions, answers, writingAnswer, speakingAnswer, speakingKeywords, examType]);
  const totalPercentage = calculateModuleScore(
    MODULES.reduce((total, module) => total + scores[module], 0),
    MODULES.length * 100,
    examType,
  );
  const totalScore = examType === 'toefl' ? getToeflTotalScore(scores) : totalPercentage;
  const passed = isPassed(MODULES.map((module) => scores[module]));
  const bandScore = examType === 'ielts'
    ? getIeltsBandScore(scores).toFixed(1)
    : getBandScore(totalPercentage);
  const writingWordCount = countWords(writingAnswer);
  const speakingWordCount = countWords(speakingAnswer);

  const handleForceSubmit = () => {
    setIsComplete(true);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const { strikeLevel, requestFullscreen } = useExamAntiCheat({
    onForceSubmit: handleForceSubmit,
  });

  const handleStartExam = () => {
    requestFullscreen();
    setIsStarted(true);
  };

  useEffect(() => {
    if (!isComplete) return;
    const result = {
      examType,
      level: examLevel,
      totalScore,
      totalPercentage,
      passed,
      scores,
      bandScore,
      completedAt: new Date().toISOString(),
    };
    setExamResult(result);
    saveExamResult(examType, examLevel, result);
    const savedResult = getExamResult(examType, examLevel);
    if (savedResult) setExamResult(savedResult);
    if (!resultSoundPlayed.current) {
      playSound(passed ? 'success' : 'error');
      resultSoundPlayed.current = true;
    }
  }, [isComplete, examType, examLevel, totalScore, passed, scores, bandScore]);

  useEffect(() => {
    if (!isStarted || isComplete) return undefined;
    if (remainingSeconds <= 0) {
      if (activeIndex === MODULES.length - 1) {
        setIsComplete(true);
      } else {
        const nextIndex = activeIndex + 1;
        setActiveIndex(nextIndex);
        setRemainingSeconds(durations[MODULES[nextIndex]] * 60);
      }
      return undefined;
    }

    const timer = window.setTimeout(() => setRemainingSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [isStarted, activeIndex, durations, isComplete, remainingSeconds]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
  }, []);

  function updateChoice(module, questionIndex, answer) {
    setAnswers((current) => ({
      ...current,
      [module]: Object.assign([...current[module]], { [questionIndex]: answer }),
    }));
  }

  function advanceModule() {
    if (activeIndex === MODULES.length - 1) {
      setIsComplete(true);
      return;
    }
    const nextIndex = activeIndex + 1;
    setActiveIndex(nextIndex);
    setRemainingSeconds(durations[MODULES[nextIndex]] * 60);
  }

  function startSpeakingCapture(answerId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechMessage('Pengenalan suara tidak tersedia di browser ini. Kamu bisa mengetik jawaban.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsRecording(true);
      setSpeechMessage('Mendengarkan...');
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? '';
      if (transcript) {
        setSpeakingAnswers((current) => ({
          ...current,
          [answerId]: [current[answerId], transcript].filter(Boolean).join(' '),
        }));
      }
      setSpeechMessage('Suara berhasil direkam. Kamu dapat mengedit transkrip di bawah.');
    };
    recognition.onerror = () => setSpeechMessage('Suara tidak berhasil direkam. Coba lagi atau ketik jawabanmu.');
    recognition.onend = () => setIsRecording(false);
    try {
      recognition.start();
    } catch (error) {
      setIsRecording(false);
      setSpeechMessage('Pengenalan suara tidak dapat dimulai. Coba lagi atau ketik jawabanmu.');
      console.error('Unable to start English exam speech recognition.', error);
    }
  }

  if (!exam) {
    return <section className="english-exam unavailable"><h1>Ujian tidak tersedia</h1><p>Konten ujian untuk level ini belum tersedia.</p><a href="/en/everyday-english">Kembali ke Bahasa Inggris Sehari-hari</a></section>;
  }

  return (
    <main className="english-exam">
      <header className="exam-heading">
        <div>
          <a className="exam-back-link" href="/en/everyday-english">Kembali ke Bahasa Inggris Sehari-hari</a>
          <p className="exam-eyebrow">{exam.exam_type.toUpperCase()} · {examLevel}</p>
          <h1>Ujian {exam.exam_type.toUpperCase()}</h1>
          <p>Selesaikan setiap bagian sebelum waktu habis. Setiap bagian membutuhkan nilai minimal 60% untuk lulus.</p>
        </div>
      </header>

      {!isStarted && !isComplete ? (
        <div className="exam-start-card">
          <p className="exam-eyebrow">{exam.exam_type.toUpperCase()} · {examLevel}</p>
          <h2>Ujian {exam.exam_type.toUpperCase()} — {examLevel}</h2>
          <p>Mode layar penuh akan diaktifkan. Jangan berpindah tab atau keluar dari mode layar penuh selama ujian. Setiap pelanggaran akan mendapat satu teguran; tiga teguran akan mengirimkan ujian secara otomatis.</p>
          <button className="primary-action" type="button" onClick={handleStartExam}>
            Mulai Ujian
          </button>
        </div>
      ) : (
        <>
          {!isComplete && (
            <div className="timer-sticky-shell">
              <div className={`exam-timer ${remainingSeconds <= 60 ? 'urgent' : ''}`} role="timer" aria-live="off">
                <span>Waktu {MODULE_LABELS[activeModule]}</span>
                <strong>{formatTime(remainingSeconds)}</strong>
              </div>
            </div>
          )}

          <nav className="module-steps" aria-label="Bagian ujian">
            {MODULES.map((module, index) => (
              <div className={`module-step ${index === activeIndex && !isComplete ? 'active' : ''} ${index < activeIndex || isComplete ? 'complete' : ''}`} key={module}>
                <span className="step-number">{index < activeIndex || isComplete ? '✓' : `0${index + 1}`}</span>
                <span>{MODULE_LABELS[module]}</span>
              </div>
            ))}
          </nav>

          {isComplete ? (
            <section className={`exam-results ${(examResult?.passed ?? passed) ? 'passed' : 'failed'} ${examType === 'ielts' ? 'ielts-results' : ''}`} aria-live="polite">
              <p className="results-eyebrow">{exam.exam_type.toUpperCase()} · {examLevel}</p>
              <h2>{(examResult?.passed ?? passed) ? 'LULUS' : 'BELUM LULUS'}</h2>
              <div className="score-summary">
                <p className="total-score">
                  {examType === 'ielts'
                    ? (examResult?.bandScore ?? bandScore)
                    : `${examResult?.totalScore ?? totalScore} / 120`}
                  <span>{examType === 'ielts' ? 'Skor Band Keseluruhan' : 'Nilai Total'}</span>
                </p>
                {examType === 'ielts' && <small className="scoring-note">Perkiraan berdasarkan nilai setiap bagian.</small>}
              </div>
              <p className="result-note">Kamu membutuhkan nilai minimal 60% di setiap bagian untuk lulus.</p>
              <div className="score-grid">
                {MODULES.map((module) => (
                  <article key={module} className={(examResult?.scores?.[module] ?? scores[module]) >= 60 ? 'score-card passed' : 'score-card failed'}>
                    <span>{MODULE_LABELS[module]}</span>
                    <strong>{examResult?.scores?.[module] ?? scores[module]}%</strong>
                    <small>{(examResult?.scores?.[module] ?? scores[module]) >= 60 ? 'Lulus' : 'Di bawah 60%'}</small>
                  </article>
                ))}
              </div>
              <p className="scoring-note">Nilai Menulis diperkirakan berdasarkan target 20 kata; nilai Berbicara berdasarkan kata kunci yang ditentukan.</p>
              <div className="result-actions">
                {(examResult?.passed ?? passed) && (
                  <a className="primary-action" href={`/sertifikat/en/${examType}/${examLevel.toLowerCase()}`}>Ambil Sertifikat</a>
                )}
                <button type="button" className="primary-action" onClick={() => window.location.reload()}>Ulangi Ujian</button>
                <a className="secondary-action" href="/en/everyday-english">Kembali ke Bahasa Inggris Sehari-hari</a>
              </div>
            </section>
          ) : (
            <section className="module-panel" aria-labelledby="module-title">
              <header className="module-heading">
                <div>
                  <p>{`Bagian 0${activeIndex + 1} dari 04`}</p>
                  <h2 id="module-title">{MODULE_LABELS[activeModule]}</h2>
                </div>
                <span>{activeModule === 'reading' || activeModule === 'listening' ? `${activeModule === 'reading' ? readingQuestions.length : listeningQuestions.length} soal` : `${activeModule === 'writing' ? writingWordCount : speakingWordCount} kata`}</span>
              </header>

              {activeModule === 'reading' && (
                <div className="question-list">
                  {readingQuestions.map((question, index) => (
                    <article className="exam-question" key={`reading-${index}`}>
                      <p className="question-count">Soal {index + 1}</p>
                      <blockquote>{question.passage}</blockquote>
                      <h3>{question.question}</h3>
                      <div className="answer-options">
                        {question.options.map((option) => (
                          <label key={option} className={`answer-option ${answers.reading[index] === option ? 'selected' : ''}`}>
                            <input type="radio" name={`reading-${index}`} checked={answers.reading[index] === option} onChange={() => { updateChoice('reading', index, option); playSound('click'); }} />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </article>
                  ))}
                  {readingQuestions.length === 0 && <p className="empty-module">Soal Membaca untuk ujian ini belum tersedia.</p>}
                </div>
              )}

              {activeModule === 'listening' && (
                <div className="question-list">
                  {listeningQuestions.map((question, index) => (
                    <article className="exam-question" key={`listening-${index}`}>
                      <p className="question-count">Soal {index + 1}</p>
                      <h3>{question.question}</h3>
                      <div className="answer-options">
                        {question.options.map((option) => (
                          <label key={option} className={`answer-option ${answers.listening[index] === option ? 'selected' : ''}`}>
                            <input type="radio" name={`listening-${index}`} checked={answers.listening[index] === option} onChange={() => { updateChoice('listening', index, option); playSound('click'); }} />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </article>
                  ))}
                  {listeningQuestions.length > 0 && (
                    <audio
                      className="exam-listening-audio"
                      controls
                      preload="none"
                      src={`https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio/exam-listening/${examType}-${examLevel.toLowerCase()}.mp3`}
                    >
                      Browser kamu tidak mendukung pemutaran audio.
                    </audio>
                  )}
                  {listeningQuestions.length === 0 && <p className="empty-module">Soal Menyimak untuk ujian ini belum tersedia.</p>}
                </div>
              )}

              {activeModule === 'writing' && (
                <div className="written-response">
                  {writingPrompts.map((task) => (
                    <article className="writing-task" key={task.id}>
                      <h3>{task.title}</h3>
                      <p className="response-prompt">{task.prompt}</p>
                      <label htmlFor={task.id}>Jawabanmu</label>
                      <textarea
                        id={task.id}
                        value={writingAnswers[task.id] ?? ''}
                        onInput={(event) => {
                          const value = event.currentTarget.value;
                          setWritingAnswers((current) => ({ ...current, [task.id]: value }));
                        }}
                        placeholder="Tulis jawabanmu di sini"
                        rows={10}
                      />
                    </article>
                  ))}
                  <div className="word-count"><span>{writingWordCount} kata</span><span>Minimal yang disarankan: 20 kata</span></div>
                </div>
              )}

              {activeModule === 'speaking' && (
                <div className="spoken-response">
                  {speakingParts.map((part) => (
                    <article className="speaking-part" key={part.id}>
                      <h3>{part.part}</h3>
                      <p className="response-prompt">{part.question}</p>
                      <button
                        className="audio-action mic-action"
                        type="button"
                        onClick={() => startSpeakingCapture(part.id)}
                        disabled={isRecording}
                      >
                        {isRecording ? 'Mendengarkan...' : '🎙 Rekam jawaban'}
                      </button>
                      <label htmlFor={part.id}>Transkrip atau jawaban yang kamu ketik</label>
                      <textarea
                        id={part.id}
                        value={speakingAnswers[part.id] ?? ''}
                        onInput={(event) => {
                          const value = event.currentTarget.value;
                          setSpeakingAnswers((current) => ({ ...current, [part.id]: value }));
                        }}
                        placeholder="Hasil pengenalan suara akan muncul di sini. Kamu juga dapat mengetik."
                        rows={4}
                      />
                    </article>
                  ))}
                  <p className="speech-message" role="status">{speechMessage}</p>
                  <div className="word-count"><span>{speakingWordCount} kata</span><span>Minimal yang disarankan: 10 kata</span></div>
                </div>
              )}

              <footer className="module-footer">
                <span>Progres: {activeIndex + 1} / {MODULES.length}</span>
                <button className="primary-action" type="button" onClick={() => { playSound('click'); advanceModule(); }}>{activeIndex === MODULES.length - 1 ? 'Lihat Hasil' : `Lanjut ke ${MODULE_LABELS[MODULES[activeIndex + 1]]}`}</button>
              </footer>
            </section>
          )}
        </>
      )}

      <NdBot mode="exam" strikeLevel={strikeLevel} />

      <style>{`
        .english-exam { display:grid; gap:1.15rem; width:min(100%, 980px); margin:0 auto; padding:1rem 0 2.5rem; color:var(--text-main); }
        .exam-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; }
        .exam-heading h1 { margin:.25rem 0; font-size:clamp(1.8rem, 5vw, 2.6rem); }
        .exam-heading p { max-width:680px; margin:.4rem 0 0; color:var(--muted); line-height:1.6; }
        .exam-back-link { display:inline-block; margin-bottom:.75rem; color:var(--text-main); font-weight:700; text-decoration:none; }
        .exam-eyebrow,.results-eyebrow { margin:0; color:#966313; font-size:.75rem; font-weight:900; text-transform:uppercase; }
        .exam-start-card { display:grid; gap:1rem; padding:clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 3vw, 2rem); border:2px solid var(--accent-gold); border-radius:1rem; background:var(--card-bg); text-align:center; }
        .exam-start-card h2 { margin:.25rem 0; font-size:clamp(1.4rem, 4vw, 1.9rem); }
        .exam-start-card p { margin:0; color:var(--muted); line-height:1.6; }
        .exam-start-card .primary-action { justify-self:center; min-width:160px; }
        .timer-sticky-shell { position:sticky; top:72px; z-index:19; display:flex; justify-content:flex-end; padding:.5rem 0; border-bottom:1px solid var(--border); background:rgba(249,249,251,.96); backdrop-filter:blur(10px); }
        .exam-timer { display:grid; min-width:150px; gap:.2rem; padding:.55rem .8rem; border:1px solid var(--border); border-radius:8px; background:var(--card-bg); text-align:center; }
        .exam-timer span { color:var(--muted); font-size:.72rem; font-weight:800; text-transform:uppercase; }
        .exam-timer strong { font-size:1.65rem; font-variant-numeric:tabular-nums; }
        .exam-timer.urgent { border-color:#c83c3c; color:#a51d1d; }
        .module-steps { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.55rem; }
        .module-step { display:flex; min-height:48px; align-items:center; gap:.55rem; padding:.6rem; border:1px solid var(--border); border-radius:6px; background:var(--card-bg); color:var(--muted); font-size:.82rem; font-weight:800; }
        .module-step.active { border-color:var(--accent-gold); color:var(--text-main); }
        .module-step.complete { border-color:#72a982; color:#23723a; }
        .step-number { display:grid; width:27px; height:27px; flex:0 0 27px; place-items:center; border-radius:50%; background:var(--bg-main); font-size:.72rem; }
        .module-panel,.exam-results { display:grid; gap:1rem; padding:clamp(1rem, 3vw, 1.5rem); border:1px solid var(--border); border-radius:8px; background:var(--card-bg); }
        .module-heading { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding-bottom:.75rem; border-bottom:1px solid var(--border); }
        .module-heading p,.module-heading h2 { margin:0; }
        .module-heading p,.module-heading > span { color:var(--muted); font-size:.78rem; font-weight:800; }
        .module-heading h2 { margin-top:.15rem; font-size:1.45rem; }
        .question-list { display:grid; gap:1rem; }
        .exam-question { display:grid; gap:.75rem; padding:1rem; border:1px solid var(--border); border-radius:6px; background:var(--bg-main); }
        .question-count { margin:0; color:#966313; font-size:.76rem; font-weight:900; text-transform:uppercase; }
        .exam-question blockquote { max-height:200px; overflow-y:auto; overflow-wrap:anywhere; margin:0; padding:1rem; border-left:3px solid var(--accent-gold); background:var(--card-bg); line-height:1.7; overscroll-behavior:contain; }
        .exam-question h3 { margin:0; font-size:1rem; }
        .answer-options { display:flex; flex-direction:column; gap:12px; min-width:0; }
        .answer-option { display:flex; min-width:0; min-height:46px; align-items:center; gap:.65rem; padding:.7rem; border:1px solid var(--border); border-radius:6px; background:var(--card-bg); cursor:pointer; overflow-wrap:anywhere; }
        .answer-option.selected { border-color:#3979bc; background:#eef5fc; }
        .answer-option input { flex:0 0 auto; accent-color:#2874b8; }
        .audio-action { width:fit-content; min-height:44px; padding:.7rem 1rem; border:0; border-radius:6px; background:#2874b8; color:white; font:inherit; font-weight:800; cursor:pointer; }
        .mic-action { background:#218449; }
        .audio-action:disabled { opacity:.65; cursor:progress; }
        .written-response,.spoken-response { display:grid; gap:.65rem; }
        .writing-task,.speaking-part { display:grid; gap:.65rem; }
        .writing-task h3,.speaking-part h3 { margin:.25rem 0 0; }
        .response-prompt { margin:0 0 .25rem; padding:1rem; border-left:3px solid var(--accent-gold); background:var(--bg-main); font-weight:700; line-height:1.65; }
        .written-response label,.spoken-response label { font-size:.86rem; font-weight:800; }
        .written-response textarea,.spoken-response textarea { box-sizing:border-box; width:100%; min-width:0; max-width:100%; min-height:150px; padding:.8rem; border:1px solid var(--border); border-radius:6px; background:var(--bg-main); color:var(--text-main); font:inherit; font-size:16px; resize:vertical; overflow-wrap:anywhere; }
        .spoken-response textarea { min-height:110px; }
        .word-count { display:flex; flex-wrap:wrap; justify-content:space-between; gap:.5rem; color:var(--muted); font-size:.78rem; }
        .speech-message { min-height:1.2em; margin:0; color:var(--muted); font-size:.82rem; }
        .module-footer { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding-top:.75rem; border-top:1px solid var(--border); }
        .module-footer > span { color:var(--muted); font-size:.82rem; font-weight:800; }
        .primary-action,.secondary-action { display:inline-flex; min-height:44px; align-items:center; justify-content:center; padding:.7rem 1rem; border:0; border-radius:6px; font:inherit; font-weight:900; text-decoration:none; cursor:pointer; }
        .primary-action { background:var(--accent-gold); color:#352407; }
        .secondary-action { border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); }
        .exam-results { text-align:center; }
        .exam-results.passed { border-color:#82bd91; }
        .exam-results.failed { border-color:#d99494; }
        .exam-results h2 { margin:0; font-size:2rem; }
        .score-summary { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:1rem; }
        .total-score { margin:0; font-size:2.5rem; font-weight:900; }
        .total-score span { display:block; color:var(--muted); font-size:.85rem; font-weight:600; }
        .result-note,.scoring-note { margin:0; color:var(--muted); font-size:.85rem; }
        .ielts-results .total-score { font-size:4rem; }
        .score-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.65rem; }
        .score-card { display:grid; gap:.25rem; padding:.8rem; border:1px solid var(--border); border-radius:6px; background:var(--bg-main); }
        .score-card span,.score-card small { color:var(--muted); font-size:.75rem; }
        .score-card strong { font-size:1.35rem; }
        .score-card.passed strong { color:#23723a; }
        .score-card.failed strong { color:#a51d1d; }
        .result-actions { display:flex; justify-content:center; flex-wrap:wrap; gap:.65rem; }
        .empty-module { margin:0; color:var(--muted); }
        .unavailable { padding:2rem; }
        @media(max-width:700px) {
          .exam-heading { align-items:stretch; flex-direction:column; }
          .timer-sticky-shell { top:62px; justify-content:stretch; }
          .exam-timer { width:100%; min-width:0; }
          .module-steps { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .module-step { min-height:48px; }
          .score-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .module-footer { align-items:stretch; flex-direction:column; }
          .module-footer .primary-action { width:100%; }
          .result-actions { align-items:stretch; flex-direction:column; }
          .result-actions > * { width:100%; box-sizing:border-box; }
          .exam-start-card .primary-action { width:100%; }
        }
        @media(max-width:380px) {
          .module-steps { grid-template-columns:1fr; }
          .score-grid { grid-template-columns:1fr; }
        }
      `}</style>
    </main>
  );
}
