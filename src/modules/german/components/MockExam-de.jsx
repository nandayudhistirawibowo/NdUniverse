import { useEffect, useRef, useState } from 'preact/hooks';
import { playAudioTTS } from '@german/config/german-speech.js';
import { playSound } from '@core/game/quiz-sounds.js';

function normalizeAnswer(answer) {
  return String(answer ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function fuzzyMatch(answer, expected) {
  const a = normalizeAnswer(answer);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, column) =>
      row === 0 ? column : column === 0 ? row : 0
    )
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitute = matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, substitute);
    }
  }
  const distance = matrix[a.length][b.length];
  const threshold = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.25));
  return distance <= threshold;
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

  useEffect(() => {
    setAnswers({});
    setFinished(false);
    setScore(null);
  }, [level]);

  const chooseAnswer = (index, value) => {
    if (finished) return;
    setAnswers((current) => ({ ...current, [index]: value }));
  };

  const startSpeaking = (index) => {
    playSound('click');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      chooseAnswer(index, 'Browser tidak mendukung Speech Recognition.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      chooseAnswer(index, transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
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
      } else if (typeof answer === 'string' && fuzzyMatch(answer, task.answer)) {
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
          <p class="eyebrow">Goethe-Zertifikat A1 Adaptation</p>
          <h1>Mock Exam {level}</h1>
          <p>22 task: 10 Lesen, 10 Hören, 1 Schreiben, 1 Sprechen</p>
        </div>
        <span class="exam-status">Target kelulusan: 60%</span>
      </header>

      {unavailable || examTasks.length === 0 ? (
        <section class="exam-result failed" role="alert">
          <h2>Soal untuk level ini belum tersedia.</h2>
          <p>Silakan hubungi admin atau coba level lain setelah materi ditambahkan.</p>
        </section>
      ) : (
        <>

      <ol class="exam-list">
        {examTasks.map((task, index) => (
          <li class="exam-task" key={`${task.kind}-${index}`}>
            <div class="task-meta">
              <span>{task.kindLabel}</span>
              <strong>Task {index + 1}</strong>
            </div>
            {task.passage && <blockquote>{task.passage}</blockquote>}
            {task.kind === 'listening' && (
              <button
                class="audio-button"
                type="button"
                onClick={(event) => playListeningAudio(event, task)}
                aria-label="Putar audio soal"
              >
                🔊 Putar Audio
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
                    {isListening ? '🎤 Merekam...' : '🎤 Rekam Jawaban'}
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
                  placeholder={task.kind === 'writing' ? 'Tulis jawaban bahasa Jerman...' : 'Hasil rekaman atau jawaban tertulis...'}
                />
              </div>
            )}
          </li>
        ))}
      </ol>

      {!finished ? (
        <button class="submit-button" type="button" onClick={submitExam}>
          Selesaikan Ujian
        </button>
      ) : (
        <section class={`exam-result ${score.passed ? 'passed' : 'failed'}`} aria-live="polite">
          <p class="result-label">{score.passed ? 'Selamat!' : 'Belum Lulus'}</p>
          <h2>{score.percent}%</h2>
          <p>{score.correct} dari {score.total} task benar. {score.passed ? 'Anda memenuhi standar kelulusan 60%.' : 'Silakan ulangi latihan dan coba lagi.'}</p>
          {score.passed && (
            <>
              <a href={`/sertifikat/${level.toLowerCase()}`}>Lihat Sertifikat</a>
              <a href="/dashboard">Kembali ke Dashboard</a>
            </>
          )}
        </section>
      )}
            </>
          )}
    </section>
  );
}
