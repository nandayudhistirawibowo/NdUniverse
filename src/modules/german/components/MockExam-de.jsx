import { useEffect, useRef, useState } from 'preact/hooks';
import { playAudioTTS } from '@german/config/german-speech.js';
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

/** @param {{ level: string; tasks?: Array<any>; unavailable?: boolean }} props */
export default function MockExam({ level, tasks, unavailable = false }) {
  const examTasks = tasks ?? [];
  const storageKey = `sideutsch-ujian-${level.toLowerCase()}`;
  const [answers, setAnswers] = useState({});
  const [isStarted, setIsStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState(null);

  const { strikeLevel, requestFullscreen, deactivate } = useExamAntiCheat({
    onForceSubmit: () => {
      submitExam();
      deactivate();
    },
  });

  const handleStartExam = () => {
    playSound('click');
    requestFullscreen();
    setIsStarted(true);
  };

  useEffect(() => {
    setAnswers({});
    setIsStarted(false);
    setFinished(false);
    setScore(null);
    setSpeechMessage(null);
    deactivate();
  }, [level]);

  const chooseAnswer = (index, value) => {
    if (finished) return;
    setAnswers((current) => ({ ...current, [index]: value }));
  };

  const startSpeaking = (index) => {
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
      chooseAnswer(index, transcript);
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
      console.error('Unable to start German mock exam speech recognition.', error);
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
    deactivate();
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
          <p class="eyebrow">Adaptasi Goethe-Zertifikat A1</p>
          <h1>Simulasi Ujian {level}</h1>
          <p>22 soal: 10 membaca, 10 menyimak, 1 menulis, dan 1 berbicara</p>
        </div>
        <span class="exam-status">Nilai kelulusan: 60%</span>
      </header>

      {unavailable || examTasks.length === 0 ? (
        <section class="exam-result failed" role="alert">
          <h2>Soal untuk level ini belum tersedia.</h2>
          <p>Silakan hubungi admin atau coba level lain setelah materi tersedia.</p>
        </section>
      ) : (
        <>
          {!isStarted && !finished ? (
            <div class="exam-task" style="text-align: center; padding: 2rem 1.5rem;">
              <p
                style="font-weight: 700; margin-bottom: 0.5rem;"
              >Simulasi ujian Goethe {level} ini dilengkapi perlindungan anti-kecurangan.</p>
              <p style="color: var(--muted); margin-bottom: 1.5rem;">Ujian berjalan dalam mode layar penuh. Jangan berpindah tab atau keluar dari layar penuh.</p>
              <button class="submit-button" type="button" onClick={handleStartExam} style="margin: 0 auto;">
                <span>Mulai Ujian</span>
              </button>
            </div>
          ) : (
            <>
      <ol class="exam-list">
        {examTasks.map((task, index) => (
          <li class="exam-task" key={`${task.kind}-${index}`}>
            <div class="task-meta">
              <span>{task.kind === 'reading' ? 'Membaca' : task.kind === 'listening' ? 'Menyimak' : task.kind === 'writing' ? 'Menulis' : 'Berbicara'}</span>
              <strong>Soal {index + 1}</strong>
            </div>
            {task.passage && <blockquote>{task.passage}</blockquote>}
            {task.kind === 'listening' && (
              <button
                class="audio-button"
                type="button"
                onClick={(event) => playListeningAudio(event, task)}
                aria-label="Putar audio soal"
              >
                <span>🔊 Putar Audio</span>
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
                    <span>{isListening ? '🎤 Merekam...' : '🎤 Rekam Jawaban'}</span>
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
                {task.kind === 'speaking' && speechMessage && (
                  <p
                    role="status"
                  >{speechMessage.fallback}</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!finished ? (
        <button class="submit-button" type="button" onClick={submitExam}>
          <span>Selesaikan Ujian</span>
        </button>
      ) : (
        <section class={`exam-result ${score.passed ? 'passed' : 'failed'}`} aria-live="polite">
          <p class="result-label">{score.passed ? 'Lulus!' : 'Belum Lulus'}</p>
          <h2>{score.percent}%</h2>
          <p>
            <span>{score.correct} dari {score.total} soal benar.</span>{' '}
            <span>{score.passed ? 'Nilai kelulusan 60% tercapai.' : 'Pelajari kembali materi dan coba lagi.'}</span>
          </p>
          {score.passed && (
            <>
              <a href={`/sertifikat/${level.toLowerCase()}`}>Lihat Sertifikat</a>
              <a href="/dashboard">Kembali ke Dasbor</a>
            </>
          )}
        </section>
      )}
            </>
          )}
        </>
      )}
      <NdBot mode="exam" strikeLevel={strikeLevel} />
    </section>
  );
}
