import { useEffect, useRef, useState } from 'preact/hooks';
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

/** @param {{ level: string; tasks?: Array<any>; unavailable?: boolean }} props */
export default function MockExam({ level, tasks, unavailable = false }) {
  const examTasks = tasks ?? [];
  const storageKey = `sideutsch-ujian-${level.toLowerCase()}`;
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState(null);

  useEffect(() => {
    setAnswers({});
    setFinished(false);
    setScore(null);
    setSpeechMessage(null);
  }, [level]);

  const chooseAnswer = (index, value) => {
    if (finished) return;
    setAnswers((current) => ({ ...current, [index]: value }));
  };

  const startSpeaking = (index) => {
    playSound('click');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage({ key: 'exam.speechUnsupported', fallback: 'Speech recognition is not supported by this browser. Please type your answer.' });
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
      chooseAnswer(index, transcript);
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
      setSpeechMessage({ key: 'exam.recordingFailed', fallback: 'Recording could not be started. Please try again or type your answer.' });
      console.error('Unable to start English mock exam speech recognition.', error);
    }
  };

  const playListeningAudio = (event, task) => {
    playSound('click');
    const button = event.currentTarget;
    const audioSource = String(task.audio ?? '').trim();
    if (!audioSource) return;
    playAudioTTS(audioSource, button, task.audioFallback || audioSource);
  };

  const submitExam = () => {
    playSound('click');
    let correct = 0;
    examTasks.forEach((task, index) => {
      const answer = answers[index];
      if (task.kind === 'reading' || task.kind === 'listening') {
        if (normalizeAnswer(answer) === normalizeAnswer(task.answer)) correct += 1;
      } else if (typeof answer === 'string' && isFuzzyMatch(answer, task.answer)) {
        correct += 1;
      }
    });
    const percent = Math.round((correct / examTasks.length) * 100);
    const passed = percent >= 60;
    setScore({ correct, total: examTasks.length, percent, passed });
    setFinished(true);
    if (passed) {
      playSound('success');
      localStorage.setItem(storageKey, JSON.stringify({
        passed: true,
        level,
        percent,
        completedAt: new Date().toISOString(),
      }));
    } else {
      playSound('error');
    }
  };

  return (
    <section class="mock-exam">
      <header class="exam-heading">
        <div>
          <p class="eyebrow" data-i18n="exam.englishExamPrep">IELTS/TOEFL Preparation</p>
          <h1 data-i18n="exam.titleMock" data-i18n-params={JSON.stringify({ level })}>English Mock Exam {level}</h1>
          <p data-i18n="exam.tasksSummaryEn">22 tasks: 10 Reading, 10 Listening, 1 Writing, and 1 Speaking</p>
        </div>
        <span class="exam-status" data-i18n="exam.passingScore">Passing score: 60%</span>
      </header>

      {unavailable || examTasks.length === 0 ? (
        <section class="exam-result failed" role="alert">
          <h2 data-i18n="exam.unavailableTitle">No questions are available for this level yet.</h2>
          <p data-i18n="exam.unavailableDescription">Contact an administrator or try another level once content is available.</p>
        </section>
      ) : (
        <>

      <ol class="exam-list">
        {examTasks.map((task, index) => (
          <li class="exam-task" key={`${task.kind}-${index}`}>
            <div class="task-meta">
              <span data-i18n={task.kind === 'reading' ? 'exam.module.lesen' : task.kind === 'listening' ? 'exam.module.hoeren' : task.kind === 'writing' ? 'exam.module.schreiben' : 'exam.module.sprechen'}>{task.kindLabel}</span>
              <strong data-i18n="exam.taskNumber" data-i18n-params={JSON.stringify({ number: index + 1 })}>Task {index + 1}</strong>
            </div>
            {task.passage && <blockquote>{task.passage}</blockquote>}
            {task.kind === 'listening' && (
              <button
                class="audio-button"
                type="button"
                onClick={(event) => playListeningAudio(event, task)}
                aria-label="Play question audio"
                data-i18n-aria-label="exam.playQuestionAudio"
              >
                <span data-i18n="exam.playAudio">🔊 Play Audio</span>
              </button>
            )}
            <p class="prompt">{task.prompt}</p>

            {(task.kind === 'reading' || task.kind === 'listening') && (
              <div class="options">
                {task.options.map((option, optionIndex) => (
                  <label class={`option ${answers[index] === option ? 'selected' : ''}`} key={`${option}-${optionIndex}`}>
                    <input
                      type="radio"
                      name={`task-${index}`}
                      value={option}
                      checked={answers[index] === option}
                      onChange={() => {
                        playSound('click');
                        chooseAnswer(index, option);
                      }}
                      disabled={finished}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}

            {(task.kind === 'writing' || task.kind === 'speaking') && (
              <div class="text-answer">
                {task.kind === 'speaking' && (
                  <button
                    class="mic-button"
                    type="button"
                    onClick={() => startSpeaking(index)}
                    disabled={finished || isListening}
                  >
                    <span data-i18n={isListening ? 'exam.recording' : 'exam.recordAnswer'}>{isListening ? '🎤 Recording...' : '🎤 Record Answer'}</span>
                  </button>
                )}
                <textarea
                  rows="3"
                  value={answers[index] ?? ''}
                  onInput={(event) => {
                    playSound('click');
                    chooseAnswer(index, event.currentTarget.value);
                  }}
                  disabled={finished}
                  placeholder={task.kind === 'writing' ? 'Write your answer in English...' : 'Your recording or written response...'}
                  data-i18n-placeholder={task.kind === 'writing' ? 'exam.writeEnglish' : 'exam.recordingOrWritten'}
                />
                {task.kind === 'speaking' && speechMessage && (
                  <p
                    role="status"
                    data-i18n={speechMessage.key}
                    data-i18n-params={speechMessage.params ? JSON.stringify(speechMessage.params) : undefined}
                  >{speechMessage.fallback}</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!finished ? (
        <button class="submit-button" type="button" onClick={submitExam}>
          <span data-i18n="exam.complete">Complete Exam</span>
        </button>
      ) : (
        <section class={`exam-result ${score.passed ? 'passed' : 'failed'}`} aria-live="polite">
          <p class="result-label" data-i18n={score.passed ? 'exam.resultPassed' : 'exam.resultFailed'}>{score.passed ? 'Passed!' : 'Not Passed'}</p>
          <h2>{score.percent}%</h2>
          <p>
            <span data-i18n="exam.correctTasksEn" data-i18n-params={JSON.stringify({ correct: score.correct, total: score.total })}>{score.correct} of {score.total} tasks correct.</span>{' '}
            <span data-i18n={score.passed ? 'exam.meetStandard' : 'exam.reviewRetry'}>{score.passed ? 'You met the 60% passing standard.' : 'Review the material and try again.'}</span>
          </p>
          {score.passed && (
            <>
              <a href={`/sertifikat/en/ielts/${level.toLowerCase()}`} data-i18n="exam.certificate">View Certificate</a>
              <a href="/en/dashboard" data-i18n="exam.backDashboard">Back to English Dashboard</a>
            </>
          )}
        </section>
      )}
            </>
          )}
    </section>
  );
}
