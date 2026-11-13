import { useEffect, useRef, useState } from 'preact/hooks';
import { playAudioTTS } from '@german/config/german-speech.js';
import { calculateModuleScore, isPassed, saveExamResult } from '@core/game/exam-grading.js';
import { playSound } from '@core/game/quiz-sounds.js';
import { isFuzzyMatch } from '@core/game/fuzzy-match.js';
import { useExamAntiCheat } from '@core/game/useExamAntiCheat.js';
import NdBot from '@core/ui/NdBot.jsx';

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

const OFFICIAL_EXAM_NAMES = {
  A1: 'Goethe-Zertifikat A1: Start Deutsch 1',
  A2: 'Goethe-Zertifikat A2: Start Deutsch 2',
  B1: 'Goethe-Zertifikat B1: Zertifikat Deutsch (ZD)',
  B2: 'Goethe-Zertifikat B2',
  C1: 'Goethe-Zertifikat C1',
  C2: 'Goethe-Zertifikat C2: Großes Deutsches Sprachdiplom (GDS)',
};

const MODULES = [
  { id: 'lesen', label: 'Lesen', english: 'Reading' },
  { id: 'hoeren', label: 'Hören', english: 'Listening' },
  { id: 'schreiben', label: 'Schreiben', english: 'Writing' },
  { id: 'sprechen', label: 'Sprechen', english: 'Speaking' },
];

const TIMER_MINUTES = {
  A1: { lesen: 25, hoeren: 20, schreiben: 20, sprechen: 15 },
  A2: { lesen: 30, hoeren: 30, schreiben: 30, sprechen: 15 },
  B1: { lesen: 65, hoeren: 40, schreiben: 60, sprechen: 15 },
  B2: { lesen: 65, hoeren: 40, schreiben: 60, sprechen: 15 },
  C1: { lesen: 75, hoeren: 40, schreiben: 70, sprechen: 15 },
  C2: { lesen: 75, hoeren: 50, schreiben: 70, sprechen: 15 },
};

function ratingKey(percent) {
  if (percent >= 85) return { key: 'exam.ratingExcellent', label: 'Sangat Baik' };
  if (percent >= 70) return { key: 'exam.ratingGood', label: 'Baik' };
  if (percent >= 60) return { key: 'exam.ratingFair', label: 'Cukup' };
  return { key: 'exam.ratingPractice', label: 'Perlu Latihan' };
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export default function GoetheExam({ level, tasks, available = true }) {
  const [isStarted, setIsStarted] = useState(false);
  const [activeModule, setActiveModule] = useState('lesen');
  const [completedModules, setCompletedModules] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState(null);
  const [moduleWarning, setModuleWarning] = useState(null);
  const [playedAudio, setPlayedAudio] = useState({});
  const recognitionRef = useRef(null);
  const answersRef = useRef({});
  const secondsByModule = TIMER_MINUTES[level] ?? TIMER_MINUTES.A1;
  const [remainingSeconds, setRemainingSeconds] = useState(secondsByModule.lesen * 60);
  const remainingRef = useRef({});

  const { strikeLevel, requestFullscreen, deactivate } = useExamAntiCheat({
    onForceSubmit: () => {
      submitExam(true);
      deactivate();
    },
  });

  const handleStartExam = () => {
    playSound('click');
    requestFullscreen();
    setIsStarted(true);
  };

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    setAnswers({});
    answersRef.current = {};
    setIsStarted(false);
    setResult(null);
    setActiveModule('lesen');
    setCompletedModules([]);
    setPlayedAudio({});
    setSpeechMessage(null);
    setModuleWarning(null);
    deactivate();
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
      setSpeechMessage({ key: 'exam.speechUnsupported', fallback: 'Browser ini tidak mendukung pengenalan suara. Silakan ketik jawaban.' });
      return;
    }
    recognitionRef.current?.abort?.();
    const recognition = new Recognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      chooseAnswer(moduleId, index, transcript);
      setSpeechMessage(transcript
        ? { key: 'exam.speechCaptured', fallback: 'Jawaban suara berhasil ditangkap.' }
        : { key: 'exam.noSpeech', fallback: 'Tidak ada ucapan yang tertangkap. Coba lagi.' });
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setSpeechMessage({
        key: 'exam.speechError',
        params: { error: event.error },
        fallback: `Suara tidak berhasil dikenali (${event.error}). Coba lagi atau ketik jawaban.`,
      });
    };
    recognition.onend = () => {
      setIsListening(false);
      setSpeechMessage((message) => message?.key === 'exam.recording'
        ? { key: 'exam.noSpeech', fallback: 'Tidak ada ucapan yang tertangkap. Coba lagi.' }
        : message);
    };
    try {
      recognition.start();
      setIsListening(true);
      setSpeechMessage({ key: 'exam.recording', fallback: 'Merekam...' });
    } catch (error) {
      setIsListening(false);
      setSpeechMessage({ key: 'exam.recordingFailed', fallback: 'Perekaman tidak dapat dimulai. Coba lagi atau ketik jawaban.' });
      console.error('Unable to start Goethe exam speech recognition.', error);
    }
  };

  const playListeningAudio = (event, task, index) => {
    const audioKey = String(index);
    if (playedAudio[audioKey] || result) return;
    playSound('click');
    setPlayedAudio((current) => ({ ...current, [audioKey]: true }));
    playAudioTTS(task.audio, event.currentTarget, task.audioFallback || task.audio);
  };

  const submitExam = (force = false) => {
    const incompleteModule = MODULES.find((module) => (
      moduleTasksAnswered(module.id) < (tasks[module.id]?.length ?? 0)
    ));
    if (force !== true && incompleteModule) {
      setModuleWarning({ key: 'exam.completeAllTasks', fallback: 'Jawab semua tugas sebelum menyelesaikan ujian.' });
      setActiveModule(incompleteModule.id);
      return;
    }

    setModuleWarning(null);
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
      const percent = calculateModuleScore(correct, moduleTasks.length, 'goethe');
      return {
        id: module.id,
        label: module.label,
        correct: Math.round(correct * 100) / 100,
        total: moduleTasks.length,
        percent,
        points: calculateModuleScore(correct, moduleTasks.length * 4, 'goethe'),
        passed: isPassed([percent]),
        rating: ratingKey(percent),
        answers: moduleTasks.map((task, index) => String(currentAnswers[`${module.id}-${index}`] ?? '').trim()),
        keywords: moduleTasks.map((task) => task.keywords ?? task.answer ?? []),
      };
    });
    const totalPoints = moduleResults.reduce((sum, module) => sum + module.points, 0);
    const passed = isPassed(moduleResults.map((module) => module.percent));
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
    saveExamResult('goethe', level, nextResult);
    deactivate();
  };

  const finishCurrentModule = (force = false) => {
    if (force !== true && moduleTasksAnswered(activeModule) < (tasks[activeModule]?.length ?? 0)) {
      setModuleWarning({
        key: 'exam.completeModuleBeforeContinue',
        fallback: 'Selesaikan semua tugas di modul ini sebelum melanjutkan.',
      });
      return;
    }

    setModuleWarning(null);
    const currentIndex = MODULES.findIndex((module) => module.id === activeModule);
    setCompletedModules((current) => (
      current.includes(activeModule) ? current : [...current, activeModule]
    ));
    if (currentIndex < MODULES.length - 1) {
      playSound('click');
      const nextModule = MODULES[currentIndex + 1].id;
      setActiveModule(nextModule);
      setRemainingSeconds((secondsByModule[nextModule] ?? 15) * 60);
    } else {
      submitExam(force);
    }
  };

  const openModule = (moduleId) => {
    if (!isModuleUnlocked(moduleId)) return;
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
          window.setTimeout(() => finishCurrentModule(true), 0);
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
  const firstIncompleteModule = MODULES.findIndex((module) => !completedModules.includes(module.id));
  const unlockedModuleCount = firstIncompleteModule < 0 ? MODULES.length : firstIncompleteModule + 1;
  const isModuleUnlocked = (moduleId) => (
    MODULES.findIndex((module) => module.id === moduleId) < unlockedModuleCount
  );

  const hasTasks = available !== false && MODULES.some((module) =>
    Array.isArray(tasks?.[module.id]) && tasks[module.id].length > 0
  );

  if (!hasTasks) {
    return (
      <section class="goethe-exam">
        <div class="goethe-task" role="alert">
          <h1 data-i18n="exam.unavailableTitle">Soal untuk level ini belum tersedia.</h1>
          <p data-i18n="exam.unavailableDescription">Silakan hubungi admin.</p>
        </div>
      </section>
    );
  }

  return (
    <section class="goethe-exam">
      <header class="goethe-heading">
        <div>
          <p class="eyebrow">{OFFICIAL_EXAM_NAMES[level] || `Goethe-Zertifikat ${level}`}</p>
          <h1>
            {level} · <span data-i18n="exam.module.lesen">Lesen</span>,{' '}
            <span data-i18n="exam.module.hoeren">Hören</span>,{' '}
            <span data-i18n="exam.module.schreiben">Schreiben</span>,{' '}
            <span data-i18n="exam.module.sprechen">Sprechen</span>
          </h1>
          <p data-i18n="exam.goethePassRule">Kelulusan hanya diberikan jika setiap modul mencapai minimal 60%.</p>
        </div>
        <div class="exam-timer" aria-live="polite">
          <span data-i18n={`exam.module.${activeModule}`}>{MODULES.find((module) => module.id === activeModule)?.label}</span>
          <strong>{formatTime(remainingSeconds)}</strong>
        </div>
      </header>

      {!isStarted && !result ? (
        <div class="goethe-task exam-start-card" style="text-align: center; padding: 2rem 1.5rem;">
          <p style="font-weight: 700; margin-bottom: 0.5rem;">{OFFICIAL_EXAM_NAMES[level] || `Goethe-Zertifikat ${level}`} dilengkapi sistem Anti-Cheat.</p>
          <p style="color: var(--muted); margin-bottom: 1.5rem;">Mode layar penuh (fullscreen) akan diaktifkan. Jangan berpindah tab atau keluar dari layar penuh selama ujian berlangsung.</p>
          <button class="submit-button" type="button" onClick={handleStartExam} style="margin: 0 auto;">
            Mulai Ujian
          </button>
        </div>
      ) : (
        <>
          <nav class="module-progress" aria-label="Progress modul ujian" data-i18n-aria-label="exam.moduleProgress">
        {MODULES.map((module) => (
          <button
            type="button"
            class={activeModule === module.id ? 'active' : ''}
            onClick={() => openModule(module.id)}
            disabled={Boolean(result) || !isModuleUnlocked(module.id)}
            key={module.id}
          >
            <span data-i18n={`exam.module.${module.id}`}>{module.label}</span>
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
            <p data-i18n={`exam.moduleEnglish.${activeModule}`}>{MODULES.find((module) => module.id === activeModule)?.english}</p>
            <h2 id="active-module-title" data-i18n={`exam.module.${activeModule}`}>{MODULES.find((module) => module.id === activeModule)?.label}</h2>
          </header>

          {(tasks[activeModule] ?? []).map((task, index) => (
            <article class="goethe-task" key={`${activeModule}-${index}`}>
              <div class="task-meta" data-i18n="exam.taskNumber" data-i18n-params={JSON.stringify({ number: index + 1 })}>Task {index + 1}</div>
              {task.passage && <blockquote>{task.passage}</blockquote>}
              {activeModule === 'hoeren' && (
                <div class="audio-controls">
                  <button
                    class="audio-button"
                    type="button"
                    disabled={Boolean(playedAudio[String(index)])}
                    onClick={(event) => playListeningAudio(event, task, index)}
                  >
                    <span data-i18n={playedAudio[String(index)] ? 'quiz.audioPlayed' : 'exam.playAudioOnce'}>{playedAudio[String(index)] ? 'Audio sudah diputar 1x' : 'Putar Audio (maks. 1x)'}</span>
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
                      <span data-i18n={isListening ? 'exam.recording' : 'exam.recordAnswer'}>{isListening ? '🎤 Merekam...' : '🎤 Rekam Jawaban'}</span>
                    </button>
                  )}
                  <textarea
                    rows={activeModule === 'schreiben' ? '8' : '4'}
                    value={answers[`${activeModule}-${index}`] ?? ''}
                    onInput={(event) => chooseAnswer(activeModule, index, event.currentTarget.value)}
                    placeholder={activeModule === 'schreiben' ? 'Tulis jawaban dalam bahasa Jerman...' : 'Hasil rekaman atau jawaban tertulis...'}
                    data-i18n-placeholder={activeModule === 'schreiben' ? 'exam.writeGerman' : 'exam.recordingOrWritten'}
                  />
                  {activeModule === 'sprechen' && speechMessage && (
                    <p
                      role="status"
                      data-i18n={speechMessage.key}
                      data-i18n-params={speechMessage.params ? JSON.stringify(speechMessage.params) : undefined}
                    >{speechMessage.fallback}</p>
                  )}
                  {task.keywords && (
                    <small><span data-i18n="exam.scoredKeywords">Kata kunci yang dinilai:</span> {task.keywords.join(', ')}</small>
                  )}
                </div>
              )}
            </article>
          ))}

          {moduleWarning && <p class="module-warning" role="alert" data-i18n={moduleWarning.key}>{moduleWarning.fallback}</p>}

          {activeModule === 'sprechen' ? (
            <button class="submit-button" type="button" onClick={submitExam} data-i18n="exam.finishAllModules">Selesaikan Semua Modul</button>
          ) : (
            <button class="submit-button" type="button" onClick={finishCurrentModule} data-i18n="exam.finishModuleContinue">Selesaikan Modul & Lanjut</button>
          )}
        </section>
      )}

      {result && (
        <section class={`goethe-result ${result.passed ? 'passed' : 'failed'}`} aria-live="polite">
          <p class="result-label" data-i18n={result.passed ? 'exam.resultPassed' : 'exam.resultFailed'}>{result.passed ? 'LULUS' : 'GAGAL'}</p>
          <h2><span data-i18n="exam.totalScore">🏆 Total Skor:</span> {result.totalPoints}/100 (<span data-i18n={result.passed ? 'exam.resultPassed' : 'exam.resultFailed'}>{result.passed ? 'LULUS' : 'GAGAL'}</span>)</h2>
          <div class="module-results">
            {result.modules.map((module) => {
              const feedbackKey = module.id === 'lesen'
                ? (module.passed ? 'exam.readingFeedbackPassed' : 'exam.readingFeedbackRetry')
                : module.id === 'hoeren'
                  ? (module.passed ? 'exam.listeningFeedbackPassed' : 'exam.listeningFeedbackRetry')
                  : (module.passed ? 'exam.writingFeedbackPassed' : 'exam.writingFeedbackRetry');
              const taskFeedback = module.id === 'schreiben' || module.id === 'sprechen'
                ? module.answers.map((answer, index) => {
                    const keywords = module.keywords[index];
                    return {
                      answer: answer || '-',
                      keywords: Array.isArray(keywords) ? keywords.join(' oder ') : String(keywords ?? ''),
                    };
                  })
                : [];
              return (
                <article key={module.id} class={module.passed ? 'passed' : 'failed'}>
                  <h3><span data-i18n={`exam.module.${module.id}`}>{module.id === 'lesen' ? '📖 Lesen' : module.id === 'hoeren' ? '🎧 Hören' : module.id === 'schreiben' ? '✍️ Schreiben' : '🗣️ Sprechen'}</span></h3>
                  <strong>{module.points}/25 (<span data-i18n={module.rating.key}>{module.rating.label}</span>)</strong>
                  <p>
                    <span data-i18n={feedbackKey} data-i18n-params={JSON.stringify({ percent: module.percent })}>
                      {module.percent}% — {module.id === 'lesen'
                        ? module.passed ? 'Kemampuan membaca sudah cukup baik.' : 'Perkuat pemahaman paragraf dan kosakata bacaan.'
                        : module.id === 'hoeren'
                          ? module.passed ? 'Pemahaman mendengar sudah baik.' : 'Latih kembali audio dan makna kalimat utama.'
                          : module.passed ? 'Keterampilan sudah cukup baik.' : 'Perlu lebih banyak kosakata dan struktur kalimat.'}
                    </span>{' '}
                    {taskFeedback.map((task, index) => (
                      <span key={`${module.id}-feedback-${index}`}>
                        <span data-i18n="exam.yourAnswer">Jawaban Anda:</span> "{task.answer}" ·{' '}
                        <span data-i18n="exam.scoredKeywords">Kata kunci yang dinilai:</span> "{task.keywords}"{' '}
                      </span>
                    ))}
                  </p>
                </article>
              );
            })}
          </div>
          {!result.passed ? (
            <>
              <p class="retry-message"><span data-i18n="exam.retryModules">Anda harus mengulang modul:</span> {failedModules.map((module) => module.label).join(', ')}.</p>
              <a class="certificate-link failure-link" href={`/de/ujian/goethe/${level.toLowerCase()}`} data-i18n="exam.retrySkills">Perbaiki Skillku</a>
            </>
          ) : (
            <div class="result-navigation">
              <a class="certificate-link" href={`/sertifikat/goethe/${level.toLowerCase()}`} data-i18n="exam.certificate">Ambil Sertifikat</a>
              <a class="certificate-link" href="/de/dashboard" data-i18n="exam.backDashboard">Kembali ke Dashboard</a>
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
