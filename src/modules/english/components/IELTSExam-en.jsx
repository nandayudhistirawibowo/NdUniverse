import { useEffect, useRef, useState } from 'preact/hooks';
import { useExamAntiCheat } from '@core/game/useExamAntiCheat.js';
import NdBot from '@core/ui/NdBot.jsx';
import { playAudioTTS } from '@german/config/german-speech.js';
import { playSound } from '@core/game/quiz-sounds.js';
import { isFuzzyMatch } from '@core/game/fuzzy-match.js';

function normalizeAnswer(answer) {
  return String(answer ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function tokenizeAnswer(answer) {
  const articles = new Set(['der', 'die', 'das', 'den', 'dem']);
  return normalizeAnswer(answer)
    .split(/\s+/)
    .filter((token) => token && !articles.has(token));
}

function partialTextScore(answer, task) {
  const answerTokens = tokenizeAnswer(answer);
  if (answerTokens.length === 0) return 0;

  const rawGroups = Array.isArray(task?.keywordGroups) ? task.keywordGroups : [];
  const keywordGroups = rawGroups.length > 0
    ? rawGroups
    : [Array.isArray(task?.keywords) ? task.keywords : []];
  const usableGroups = keywordGroups.filter((group) =>
    Array.isArray(group) && group.some((keyword) => normalizeAnswer(keyword))
  );
  if (usableGroups.length === 0) return 0;

  let matchedGroups = 0;
  usableGroups.forEach((group) => {
    const matched = group.some((keyword) => {
      const keywordTokens = tokenizeAnswer(keyword);
      if (keywordTokens.length === 0) return false;
      return keywordTokens.every((keywordToken) =>
        answerTokens.some((answerToken) =>
          isFuzzyMatch(answerToken, keywordToken)
        )
      );
    });
    if (matched) matchedGroups += 1;
  });
  return matchedGroups / usableGroups.length;
}

const MODULES = [
  { id: 'lesen', label: 'Membaca', english: 'Membaca' },
  { id: 'hoeren', label: 'Menyimak', english: 'Menyimak' },
  { id: 'schreiben', label: 'Menulis', english: 'Menulis' },
  { id: 'sprechen', label: 'Berbicara', english: 'Berbicara' },
];

const TIMER_MINUTES = {
  A1: { lesen: 25, hoeren: 20, schreiben: 20, sprechen: 15 },
  A2: { lesen: 30, hoeren: 30, schreiben: 30, sprechen: 15 },
  B1: { lesen: 65, hoeren: 40, schreiben: 60, sprechen: 15 },
  B2: { lesen: 65, hoeren: 40, schreiben: 60, sprechen: 15 },
  C1: { lesen: 75, hoeren: 40, schreiben: 70, sprechen: 15 },
  C2: { lesen: 75, hoeren: 50, schreiben: 70, sprechen: 15 },
};

function rating(percent) {
  if (percent >= 85) return 'Sangat Baik';
  if (percent >= 70) return 'Baik';
  if (percent >= 60) return 'Cukup';
  return 'Perlu Latihan';
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export default function GoetheExam({ level, tasks, available = true }) {
  const storageKey = `sideutsch-goethe-${level.toLowerCase()}`;
  const [isStarted, setIsStarted] = useState(false);
  const [activeModule, setActiveModule] = useState('lesen');
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState(null);
  const [playedAudio, setPlayedAudio] = useState({});
  const recognitionRef = useRef(null);
  const answersRef = useRef({});
  const secondsByModule = TIMER_MINUTES[level] ?? TIMER_MINUTES.A1;
  const [remainingSeconds, setRemainingSeconds] = useState(secondsByModule.lesen * 60);
  const remainingRef = useRef({});

  const handleForceSubmit = () => {
    submitExam();
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
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    setAnswers({});
    answersRef.current = {};
    setResult(null);
    setActiveModule('lesen');
    setPlayedAudio({});
    setSpeechMessage(null);
  }, [level]);

  const chooseAnswer = (moduleId, index, value) => {
    if (result) return;
    playSound('click');
    setAnswers((current) => {
      const next = { ...current, [`${moduleId}-${index}`]: value };
      answersRef.current = next;
      return next;
    });
  };

  const startSpeaking = (moduleId, index) => {
    playSound('click');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage({
        key: 'exam.speechUnsupported',
        fallback: 'Speech recognition is not supported by this browser. Please type your answer.',
      });
      return;
    }
    recognitionRef.current?.abort?.();
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      chooseAnswer(moduleId, index, transcript);
      setSpeechMessage(transcript
        ? { key: 'exam.speechCaptured', fallback: 'Speech captured successfully.' }
        : { key: 'exam.noSpeech', fallback: 'No speech was captured. Please try again.' });
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setSpeechMessage({
        key: 'exam.speechError',
        params: { error: event.error },
        fallback: `Speech was not recognized (${event.error}). Please try again or type your answer.`,
      });
    };
    recognition.onend = () => {
      setIsListening(false);
      setSpeechMessage((message) => message?.key === 'exam.recording'
        ? { key: 'exam.noSpeech', fallback: 'No speech was captured. Please try again.' }
        : message);
    };
    try {
      recognition.start();
      setIsListening(true);
      setSpeechMessage({ key: 'exam.recording', fallback: 'Recording...' });
    } catch (error) {
      setIsListening(false);
      setSpeechMessage({
        key: 'exam.recordingFailed',
        fallback: 'Recording could not be started. Please try again or type your answer.',
      });
      console.error('Unable to start IELTS exam speech recognition.', error);
    }
  };

  const playListeningAudio = (event, task, index) => {
    const audioKey = String(index);
    if (playedAudio[audioKey] || result) return;
    playSound('click');
    setPlayedAudio((current) => ({ ...current, [audioKey]: true }));
    playAudioTTS(task.audio, event.currentTarget, task.audioFallback || task.audio);
  };

  const submitExam = () => {
    playSound('click');
    const currentAnswers = answersRef.current;
    const moduleResults = MODULES.map((module) => {
      const moduleTasks = tasks[module.id] ?? [];
      let correct = 0;
      moduleTasks.forEach((task, index) => {
        const answer = currentAnswers[`${module.id}-${index}`];
        if (module.id === 'lesen' || module.id === 'hoeren') {
          if (normalizeAnswer(answer) === normalizeAnswer(task.answer)) correct += 1;
        } else if (typeof answer === 'string') {
          correct += partialTextScore(answer, task);
        }
      });
      const ratio = moduleTasks.length ? correct / moduleTasks.length : 0;
      const percent = Math.round(ratio * 100);
      return {
        id: module.id,
        label: module.label,
        correct: Math.round(correct * 100) / 100,
        total: moduleTasks.length,
        percent,
        points: Math.round(ratio * 25),
        passed: percent >= 60,
        rating: rating(percent),
        answers: moduleTasks.map((task, index) => String(currentAnswers[`${module.id}-${index}`] ?? '').trim()),
        keywords: moduleTasks.map((task) => task.keywords ?? task.answer ?? []),
      };
    });
    const totalPoints = moduleResults.reduce((sum, module) => sum + module.points, 0);
    const passed = moduleResults.every((module) => module.passed);
    const nextResult = {
      passed,
      totalPoints,
      modules: moduleResults,
      completedAt: new Date().toISOString(),
      readingKeyParagraph: tasks.lesen?.[0]?.keyParagraph ?? '',
      listeningTranscript: tasks.hoeren?.[0]?.transcript ?? '',
    };
    setResult(nextResult);
    playSound(passed ? 'success' : 'error');
    localStorage.setItem(storageKey, JSON.stringify(nextResult));
  };

  const finishCurrentModule = () => {
    const currentIndex = MODULES.findIndex((module) => module.id === activeModule);
    if (currentIndex < MODULES.length - 1) {
      const nextModule = MODULES[currentIndex + 1].id;
      setActiveModule(nextModule);
      setRemainingSeconds((secondsByModule[nextModule] ?? 15) * 60);
    } else {
      submitExam();
    }
  };

  const openModule = (moduleId) => {
    playSound('click');
    setActiveModule(moduleId);
    const saved = remainingRef.current[moduleId];
    setRemainingSeconds(saved ?? (secondsByModule[moduleId] ?? 15) * 60);
  };

  useEffect(() => {
    if (!isStarted || result) return undefined;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        remainingRef.current[activeModule] = Math.max(current - 1, 0);
        if (current <= 1) {
          window.clearInterval(timer);
          window.setTimeout(finishCurrentModule, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isStarted, activeModule, result]);

  const progressPercent = (moduleId) => {
    const total = tasks[moduleId]?.length ?? 0;
    if (!total) return 0;
    const answered = moduleTasksAnswered(moduleId);
    return Math.round((answered / total) * 100);
  };

  function moduleTasksAnswered(moduleId) {
    return (tasks[moduleId] ?? []).filter((_, index) =>
      String(answers[`${moduleId}-${index}`] ?? '').trim().length > 0
    ).length;
  }

  const failedModules = result?.modules.filter((module) => !module.passed) ?? [];

  const hasTasks = available !== false && MODULES.some((module) =>
    Array.isArray(tasks?.[module.id]) && tasks[module.id].length > 0
  );

  if (!hasTasks) {
    return (
      <section class="goethe-exam">
        <div class="goethe-task" role="alert">
          <h1>Soal untuk level ini belum tersedia.</h1>
          <p>Silakan hubungi administrator atau coba level lain setelah materi tersedia.</p>
        </div>
      </section>
    );
  }

  return (
    <section class="goethe-exam">
      <header class="goethe-heading">
        <div>
          <p class="eyebrow">Persiapan IELTS/TOEFL</p>
          <h1>
            {level} · Membaca, Menyimak, Menulis, Berbicara
          </h1>
          <p>Anda lulus jika setiap modul mencapai nilai minimal 60%.</p>
        </div>
        <div class="exam-timer" aria-live="polite">
          <span>{MODULES.find((module) => module.id === activeModule)?.label}</span>
          <strong>{formatTime(remainingSeconds)}</strong>
        </div>
      </header>

      {!isStarted && !result ? (
        <div class="goethe-task exam-start-card" style="text-align: center; padding: 2rem 1.5rem;">
          <p style="font-weight: 700; margin-bottom: 0.5rem;">Persiapan IELTS/TOEFL · {level}</p>
          <p style="color: var(--muted); margin-bottom: 1.5rem;">
            Ujian berjalan dalam mode layar penuh. Jangan berpindah tab atau keluar dari layar penuh.
            Pelanggaran sebanyak 3 kali akan mengirimkan ujian secara otomatis.
          </p>
          <button class="submit-button" type="button" onClick={handleStartExam} style="margin: 0 auto;">
            <span>Mulai Ujian</span>
          </button>
        </div>
      ) : (
        <>
          <nav class="module-progress" aria-label="Progres modul ujian">
            {MODULES.map((module) => (
              <button
                type="button"
                class={activeModule === module.id ? 'active' : ''}
                onClick={() => openModule(module.id)}
                disabled={Boolean(result)}
                key={module.id}
              >
                <span>{module.label}</span>
                <strong>{moduleTasksAnswered(module.id)}/{tasks[module.id]?.length ?? 0}</strong>
                <div class="module-track" aria-hidden="true">
                  <span style={`width: ${progressPercent(module.id)}%`} />
                </div>
              </button>
            ))}
          </nav>

          {!result && (
            <section class="module-panel" aria-labelledby="active-module-title">
              <header>
                <p>{MODULES.find((module) => module.id === activeModule)?.label}</p>
                <h2 id="active-module-title">{MODULES.find((module) => module.id === activeModule)?.label}</h2>
              </header>

              {(tasks[activeModule] ?? []).map((task, index) => (
                <article class="goethe-task" key={`${activeModule}-${index}`}>
                  <div class="task-meta">Soal {index + 1}</div>
                  {task.passage && <blockquote>{task.passage}</blockquote>}
                  {activeModule === 'hoeren' && (
                    <div class="audio-controls">
                      <button
                        class="audio-button"
                        type="button"
                        disabled={Boolean(playedAudio[String(index)])}
                        onClick={(event) => playListeningAudio(event, task, index)}
                      >
                        <span>
                          {playedAudio[String(index)] ? 'Audio sudah diputar 1 kali' : 'Putar audio (maks. 1 kali)'}
                        </span>
                      </button>
                    </div>
                  )}
                  <p class="prompt">{task.prompt}</p>

                  {(activeModule === 'lesen' || activeModule === 'hoeren') && (
                    <div class="options">
                      {task.options.map((option, optionIndex) => (
                        <label
                          class={`option ${answers[`${activeModule}-${index}`] === option ? 'selected' : ''}`}
                          key={`${option}-${optionIndex}`}
                        >
                          <input
                            type="radio"
                            name={`${activeModule}-${index}`}
                            value={option}
                            checked={answers[`${activeModule}-${index}`] === option}
                            onChange={() => chooseAnswer(activeModule, index, option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {(activeModule === 'schreiben' || activeModule === 'sprechen') && (
                    <div class="text-answer">
                      {activeModule === 'sprechen' && (
                        <button
                          class="mic-button"
                          type="button"
                          disabled={isListening}
                          onClick={() => startSpeaking(activeModule, index)}
                        >
                          <span>
                            {isListening ? '🎤 Merekam...' : '🎤 Rekam Jawaban'}
                          </span>
                        </button>
                      )}
                      <textarea
                        rows={activeModule === 'schreiben' ? '8' : '4'}
                        value={answers[`${activeModule}-${index}`] ?? ''}
                        onInput={(event) => chooseAnswer(activeModule, index, event.currentTarget.value)}
                        placeholder={activeModule === 'schreiben' ? 'Tulis jawaban dalam Bahasa Inggris...' : 'Hasil rekaman atau jawaban tertulis...'}
                      />
                      {activeModule === 'sprechen' && speechMessage && (
                        <p
                          role="status"
                        >{speechMessage.fallback}</p>
                      )}
                      {task.keywords && (
                        <small><span>Kata kunci yang dinilai:</span> {task.keywords.join(', ')}</small>
                      )}
                    </div>
                  )}
                </article>
              ))}

              {activeModule === 'sprechen' ? (
                <button class="submit-button" type="button" onClick={submitExam}>Selesaikan Semua Modul</button>
              ) : (
                <button class="submit-button" type="button" onClick={finishCurrentModule}>Selesaikan Modul &amp; Lanjutkan</button>
              )}
            </section>
          )}

          {result && (
            <section class={`goethe-result ${result.passed ? 'passed' : 'failed'}`} aria-live="polite">
              <p class="result-label">{result.passed ? 'Lulus!' : 'Belum Lulus'}</p>
              <h2><span>🏆 Total Nilai:</span> {result.totalPoints}/100 ({result.passed ? 'Lulus!' : 'Belum Lulus'})</h2>
              <div class="module-results">
                {result.modules.map((module) => {
                  const ratingKey = module.rating === 'Sangat Baik'
                    ? 'exam.ratingExcellent'
                    : module.rating === 'Baik'
                      ? 'exam.ratingGood'
                      : module.rating === 'Cukup'
                        ? 'exam.ratingFair'
                        : 'exam.ratingPractice';
                  return (
                    <article key={module.id} class={module.passed ? 'passed' : 'failed'}>
                      <h3>{module.label}</h3>
                      <strong>{module.points}/25 ({module.rating})</strong>
                      <p>
                        {module.id === 'lesen' ? (
                          <><span>Paragraf kunci:</span> {result.readingKeyParagraph}</>
                        ) : module.id === 'hoeren' ? (
                          <><span>Transkrip:</span> {result.listeningTranscript}</>
                        ) : (
                          module.answers.map((answer, index) => {
                            const keywords = module.keywords[index];
                            const keywordItems = Array.isArray(keywords) ? keywords : [String(keywords ?? '')];
                            return (
                              <span key={`${module.id}-answer-${index}`}>
                                {index > 0 && ' | '}
                                <span>Jawaban Anda:</span> "{answer || '-'}" ·{' '}
                                <span>Kata kunci yang dinilai:</span> "{keywordItems.map((keyword, keywordIndex) => (
                                  <span key={`${module.id}-keyword-${index}-${keywordIndex}`}>
                                    {keywordIndex > 0 && <span>atau</span>}
                                    {keyword}
                                  </span>
                                ))}"
                              </span>
                            );
                          })
                        )}
                      </p>
                    </article>
                  );
                })}
              </div>
              {!result.passed ? (
                <>
                  <p class="retry-message"><span>Anda perlu mengulang modul:</span> {failedModules.map((module) => module.label).join(', ')}.</p>
                  <a class="certificate-link failure-link" href={`/en/everyday-english/${level.toLowerCase()}`}>Tinjau kembali materi</a>
                </>
              ) : (
                <div class="result-navigation">
                  <a class="certificate-link" href={`/sertifikat/en/ielts/${level.toLowerCase()}`}>Ambil Sertifikat</a>
                  <a class="certificate-link" href="/en/dashboard">Kembali ke Dasbor Bahasa Inggris</a>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <NdBot mode="exam" strikeLevel={strikeLevel} />
    </section>
  );
}
