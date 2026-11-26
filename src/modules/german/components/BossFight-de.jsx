import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { playSound } from '@core/game/quiz-sounds.js';
import { playBossAudio, preloadBossAudio } from '@core/audio/boss-audio.js';
import { isArticleQuestion } from '@core/game/fuzzy-match.js';
import { gradeKeywords } from '@core/speech/match.ts';
import { SpeechFeedback, useSpeechCapture } from '@core/speech/index.ts';

const EMPTY_BOSS_INTRO = [];
const DEFAULT_BOSS_INTRO = [
  { detik: 0, aksi: 'Pintu tertutup; kamera gelap.', dialog: '' },
  { detik: 2, aksi: 'Pintu terbuka perlahan dan cahaya masuk.', dialog: '' },
  { detik: 5, aksi: 'Der Personalverantwortliche betritt den Raum.', dialog: '' },
  { detik: 8, aksi: 'Der Personalverantwortliche begrüßt den Kandidaten.', dialog: 'Guten Tag! Bitte nehmen Sie Platz. Erzählen Sie mir zum Einstieg etwas über sich.' },
];

function ChatBubble({ text, isUser, isSystem, isIntro, speakerLabel, language, onComplete }) {
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    const characters = Array.from(text);
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let cancelled = false;
    let completed = false;
    let playbackFailed = false;
    let timer;
    const controller = new AbortController();
    const complete = () => {
      if (cancelled || completed) return;
      completed = true;
      onComplete?.();
    };
    const finishAfterAudio = (audio) => {
      if (!audio || audio.ended || audio.error || playbackFailed) {
        complete();
        return;
      }
      audio.addEventListener('ended', complete, { once: true });
      audio.addEventListener('playbackerror', complete, { once: true });
    };
    const typeText = (intervalMs, audio) => {
      if (prefersReducedMotion) {
        setVisibleText(text);
        finishAfterAudio(audio);
        return;
      }

      let visibleLength = 0;
      setVisibleText('');
      const revealNextCharacter = () => {
        if (cancelled) return;
        visibleLength += 1;
        setVisibleText(characters.slice(0, visibleLength).join(''));
        if (visibleLength >= characters.length) {
          finishAfterAudio(audio);
          return;
        }
        timer = window.setTimeout(revealNextCharacter, intervalMs);
      };
      timer = window.setTimeout(revealNextCharacter, intervalMs);
    };

    if (characters.length === 0) {
      setVisibleText(text);
      complete();
      return undefined;
    }

    const hasBossVoice = !isUser && !isSystem;
    const audio = hasBossVoice ? playBossAudio(text, language, controller.signal) : null;
    const handlePlaybackError = () => {
      playbackFailed = true;
    };
    audio?.addEventListener('playbackerror', handlePlaybackError, { once: true });
    const duration = audio?.duration ?? null;
    const intervalMs = Number.isFinite(duration) && duration > 0
      ? (duration * 1000) / characters.length
      : 60;
    typeText(intervalMs, audio);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      audio?.removeEventListener('playbackerror', handlePlaybackError);
      controller.abort();
    };
  }, [isSystem, isUser, language, onComplete, text]);

  const messageClass = isSystem ? 'system' : isUser ? 'user' : 'hrd';
  if (isIntro) return <p>{visibleText}</p>;

  return (
    <div class={`chat-message ${messageClass}`} role="article" aria-label={`${speakerLabel}: ${text}`}>
      <span class="chat-speaker">{speakerLabel}</span>
      <span aria-hidden="true">{visibleText}</span>
    </div>
  );
}

export default function BossFight({
  questions = [],
  bossIntro = EMPTY_BOSS_INTRO,
  badge = 'Career',
  profession = 'Karir',
  returnHref = '/career',
}) {
  const fallbackQuestion = {
    question: 'Welche Erfahrung ist für diese Stelle am relevantesten?',
    keywords: ['Erfahrung', 'Projekt', 'Beruf'],
  };
  const interviewQuestions = useMemo(
    () => questions.length > 0 ? questions : [fallbackQuestion],
    [questions],
  );
  const introTimeline = useMemo(
    () => [...(bossIntro.length > 0 ? bossIntro : DEFAULT_BOSS_INTRO)].sort((a, b) => a.detik - b.detik),
    [bossIntro],
  );
  const [gameState, setGameState] = useState('intro');
  const [bossEntered, setBossEntered] = useState(false);
  const [doorState, setDoorState] = useState('closed');
  const [introEventIndex, setIntroEventIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [messages, setMessages] = useState([]);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
  const [hasAdvancedVocabulary, setHasAdvancedVocabulary] = useState(false);
  const speechCapture = useSpeechCapture();
  const messagesEndRef = useRef(null);
  const doorTransitionRef = useRef(null);
  const introSpeechDoneRef = useRef(false);
  const cinematicActive = true;

  const markIntroSpeechComplete = useCallback(() => {
    introSpeechDoneRef.current = true;
  }, []);

  const currentQuestion = interviewQuestions[questionIndex];
  const activeIntroEvent = introTimeline[introEventIndex] ?? introTimeline[0];

  useEffect(() => {
    interviewQuestions.forEach(({ question }) => preloadBossAudio(question, 'de'));
    introTimeline.forEach(({ dialog }) => preloadBossAudio(dialog, 'de'));
  }, [interviewQuestions, introTimeline]);

  useEffect(() => {
    if (!cinematicActive) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(doorTransitionRef.current);
    };
  }, [cinematicActive]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages]);

  const knockDoor = () => {
    if (doorState !== 'closed') return;
    playSound('click');
    setMessages([]);
    setDoorState('opening');
    doorTransitionRef.current = window.setTimeout(() => {
      setDoorState('entering');
      doorTransitionRef.current = window.setTimeout(() => {
        setBossEntered(true);
        setDoorState('inside');
      }, 900);
    }, 700);
  };

  const startInterview = useCallback(() => {
    playSound('click');
    setGameState('interview');
    setMessages([{ speaker: 'hrd', text: interviewQuestions[0].question }]);
    setQuestionIndex(0);
    setAnswer('');
    setAnsweredQuestions(0);
    setHasAdvancedVocabulary(false);
  }, [interviewQuestions]);

  useEffect(() => {
    if (gameState !== 'intro') return undefined;

    let elapsed = 0;
    const finalSecond = introTimeline[introTimeline.length - 1]?.detik ?? 8;
    const interval = window.setInterval(() => {
      elapsed += 1;

      let nextIndex = 0;
      for (let index = 1; index < introTimeline.length; index += 1) {
        if (introTimeline[index].detik <= elapsed) nextIndex = index;
        else break;
      }

      setIntroEventIndex(nextIndex);
      setDoorState(
        nextIndex === 0 ? 'closed'
          : nextIndex === 1 ? 'opening'
            : nextIndex === 2 ? 'entering'
              : 'inside',
      );

      const finalDialog = introTimeline[introTimeline.length - 1]?.dialog?.trim();
      if (elapsed > finalSecond && (!finalDialog || introSpeechDoneRef.current)) {
        window.clearInterval(interval);
        startInterview();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [gameState, introTimeline, startInterview]);

  const startListening = () => {
    playSound('click');
    const keywords = currentQuestion.keywords ?? [];
    void speechCapture.start({
      target: keywords.join(' ') || currentQuestion.question,
      preserveArticles: isArticleQuestion(currentQuestion.question),
      keywords,
      onResult: (transcript) => setAnswer(transcript),
      onAdvance: (transcript) => submitAnswer(transcript),
    });
  };

  const submitAnswer = (spokenAnswer = answer) => {
    if (!spokenAnswer.trim()) return;
    playSound('click');
    const matchedAdvancedKeywords = gradeKeywords(
      spokenAnswer,
      currentQuestion.advancedKeywords ?? [],
      { preserveArticles: isArticleQuestion(currentQuestion.question) },
    ).matched;
    const userMessage = { speaker: 'user', text: spokenAnswer };
    const feedback = 'Terima kasih atas jawaban Anda. Silakan lanjut ke pertanyaan berikutnya.';

    const finalQuestionIndex = questionIndex + 1;
    if (finalQuestionIndex >= interviewQuestions.length) {
      playSound('success');
      const qualifiesForCompletion = hasAdvancedVocabulary || matchedAdvancedKeywords.length > 0;
      const finalFeedback = qualifiesForCompletion
        ? 'Selamat kamu telah menyelesaikan simulasi wawancara!'
        : 'Bagus, akan saya pertimbangkan, silahkan selanjutnya!';
      setMessages((current) => [...current, userMessage, { speaker: 'hrd', text: finalFeedback }]);
      setAnsweredQuestions((count) => count + 1);
      if (matchedAdvancedKeywords.length > 0) setHasAdvancedVocabulary(true);
      setAnswer('');
      setGameState('finished');
      return;
    }

    const nextQuestion = interviewQuestions[finalQuestionIndex].question;
    playSound('success');
    setAnsweredQuestions((count) => count + 1);
    if (matchedAdvancedKeywords.length > 0) setHasAdvancedVocabulary(true);
    setMessages((current) => [
      ...current,
      userMessage,
      { speaker: 'hrd', text: feedback },
      { speaker: 'hrd', text: nextQuestion },
    ]);
    setQuestionIndex(finalQuestionIndex);
    setAnswer('');
  };

  const passedInterview = hasAdvancedVocabulary;

  return (
    <section class="boss-fight">
      {gameState === 'intro' && !cinematicActive && (
        <div class="office-intro" aria-live="polite">
          <div class="office-room">
            <div class="office-wall">
              <div class="office-window"><span /><span /></div>
              <div class="office-board"><i /><i /><i /></div>
            </div>
            <div class="office-desk">
              <div class="desk-laptop" />
              <div class="desk-chair" />
              <div class={bossEntered ? 'boss-character boss-entered' : 'boss-character'} aria-label="Bapak Müller, HRD">
                👨‍💼
              </div>
            </div>
            <div class={bossEntered ? 'office-door door-open' : 'office-door'}>
              <span>PINTU HRD</span>
            </div>
          </div>

          {!bossEntered ? (
            <div class="intro-dialog">
              <p>Anda memasuki ruang wawancara...</p>
              <button class="boss-start-button" type="button" onClick={knockDoor}>Ketuk Pintu</button>
            </div>
          ) : (
            <div class="intro-dialog boss-speech">
              <div class="boss-avatar" aria-hidden="true">👨‍💼</div>
              <div>
                <strong>Herr Müller</strong>
                <p>Selamat datang! Silakan duduk. Saya Bapak Müller, HRD di sini.</p>
                <button class="boss-start-button" type="button" onClick={startInterview}>Mulai Wawancara</button>
              </div>
            </div>
          )}
        </div>
      )}

      {cinematicActive && (
        <div class="cinematic-overlay" aria-live="polite">
          <div class={`cinematic-room room-${doorState}`}>
            <div class="cinematic-header">
              <span class="career-section-label">Tantangan Akhir: {profession}</span>
              {gameState === 'interview' && (
                <span class="boss-progress">
                  Pertanyaan {Math.min(questionIndex + 1, interviewQuestions.length)} dari {interviewQuestions.length}
                </span>
              )}
            </div>

            {doorState !== 'inside' && (
              <div class="cinematic-scene-label">RUANGAN HRD</div>
            )}

            {doorState !== 'inside' && (
              <div class={`door-sequence door-${doorState}`}>
                <div class="door-zoom-room">
                  <div class="door-wall" />
                  <div class="door-frame">
                    <div class={`cinematic-door door-${doorState}`}>
                      <i aria-hidden="true" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {doorState === 'inside' && gameState === 'intro' && (
              <div class="cinematic-intro">
                <div class="cinematic-boss" aria-label="Bapak Müller, HRD">
                  <span class="boss-silhouette" aria-hidden="true"><i class="boss-head" /><i class="boss-hair" /><i class="boss-body" /><i class="boss-tie" /></span>
                </div>
                <div class="boss-speech-bubble">
                  <strong>Herr Müller</strong>
                  <ChatBubble
                    text={activeIntroEvent?.dialog ?? ''}
                    isIntro
                    speakerLabel="Herr Müller"
                    language="de"
                    onComplete={markIntroSpeechComplete}
                  />
                </div>
              </div>
            )}

            {doorState === 'inside' && gameState === 'interview' && (
              <div class="cinematic-interview">
                <div class="cinematic-boss-panel">
                  <div class="boss-chair" aria-hidden="true"><span /></div>
                  <div class="cinematic-boss" aria-hidden="true">
                    <span class="boss-silhouette"><i class="boss-head" /><i class="boss-hair" /><i class="boss-body" /><i class="boss-tie" /></span>
                  </div>
                  <div class="boss-desk" aria-hidden="true"><span /></div>
                  <span>Herr Müller</span>
                  <small>Wawancara HRD</small>
                </div>
                <div class="cinematic-chat-panel">
                  <div class="boss-chat" aria-live="polite">
                    {messages.map((message, index) => (
                      <ChatBubble
                        key={`${message.speaker}-${index}`}
                        text={message.text}
                        isUser={message.speaker === 'user'}
                        isSystem={message.speaker === 'system'}
                        speakerLabel={message.speaker === 'hrd' ? 'HRD' : message.speaker === 'user' ? 'Anda' : 'Info'}
                        language="de"
                      />
                    ))}
                    <div ref={messagesEndRef} class="chat-scroll-anchor" aria-hidden="true" />
                  </div>
                  <div class="boss-interview">
                    <label class="sr-only" for="boss-answer">Jawaban Anda</label>
                    <div class="boss-composer">
                      {!speechCapture.unsupported && <button
                        className={speechCapture.state === 'listening' ? 'boss-mic-button speech-mic-listening' : 'boss-mic-button'}
                        type="button"
                        onClick={startListening}
                        disabled={speechCapture.state === 'listening' || speechCapture.state === 'processing'}
                        aria-label={speechCapture.state === 'listening' ? 'Sedang mendengarkan' : 'Gunakan mikrofon'}
                        title={speechCapture.state === 'listening' ? 'Sedang mendengarkan' : 'Gunakan mikrofon'}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="9" y="2.5" width="6" height="12" rx="3" />
                          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
                        </svg>
                      </button>}
                      <textarea
                        id="boss-answer"
                        rows="2"
                        value={answer}
                        onInput={(event) => {
                          if (!answer) playSound('click');
                          setAnswer(event.currentTarget.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' || event.shiftKey) return;
                          event.preventDefault();
                          if (answer.trim() && speechCapture.state !== 'listening' && speechCapture.state !== 'processing' && speechCapture.state !== 'feedback') {
                            submitAnswer();
                          }
                        }}
                        placeholder="Jawab dalam bahasa Jerman..."
                      />
                      <button
                        class="boss-finish-button"
                        type="button"
                        onClick={() => submitAnswer()}
                        disabled={!answer.trim() || speechCapture.state === 'listening' || speechCapture.state === 'processing' || speechCapture.state === 'feedback'}
                        aria-label="Kirim jawaban"
                        title="Kirim jawaban"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m21 3-7.2 18-3.8-7-7-3.8L21 3Z" />
                          <path d="M21 3 10 14" />
                        </svg>
                      </button>
                    </div>
                    <SpeechFeedback feedback={speechCapture.feedback} state={speechCapture.state} message={speechCapture.message} volumeLevel={speechCapture.volumeLevel} noiseFloor={speechCapture.noiseFloor} onStop={speechCapture.stop} />
                  </div>
                </div>
              </div>
            )}

            {doorState === 'inside' && gameState === 'finished' && (
              <div class={passedInterview ? 'boss-finished boss-victory' : 'boss-finished'}>
                <span class="finished-icon" aria-hidden="true">{passedInterview ? '🏆' : '📋'}</span>
                <p class="career-section-label">Tantangan Selesai</p>
                <h2>Wawancara Selesai!</h2>
                <p
                >{passedInterview
                    ? 'Selamat kamu telah menyelesaikan simulasi wawancara!'
                    : 'Bagus, akan saya pertimbangkan, silahkan selanjutnya!'}</p>
                <strong>{answeredQuestions}/{interviewQuestions.length} pertanyaan telah dijawab.</strong>
                {passedInterview && <p>Lencana {badge} berhasil diperoleh.</p>}
                <a class="boss-return-button" href={returnHref}>Kembali ke Dashboard</a>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .boss-fight { display:grid; gap:.75rem; padding:1.25rem; border:1px solid var(--accent-gold); border-radius:14px; background:radial-gradient(circle at top right,rgba(229,169,59,.16),transparent 45%),var(--card-bg); }
        .cinematic-overlay { --cinematic-ink:var(--text-main); --cinematic-muted:var(--muted); --cinematic-line:#d8dee5; position:fixed; z-index:9999; inset:0; display:grid; place-items:center; background:#000; overflow:hidden; }
        .cinematic-room { position:relative; isolation:isolate; perspective:1200px; width:100vw; height:100vh; height:100dvh; display:grid; grid-template-rows:auto minmax(0,1fr); overflow:hidden; color:var(--cinematic-ink); background:radial-gradient(circle at 50% 20%,rgba(111,83,48,.3),transparent 30%),linear-gradient(180deg,#101820 0%,#172633 54%,#080d12 100%); animation:cinematicRoomIn .5s cubic-bezier(.2,.8,.2,1) both; }
        .cinematic-header { position:relative; z-index:10; display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:clamp(1rem,3vw,2rem) clamp(1rem,5vw,5rem) 0; }
        .cinematic-header .career-section-label { color:var(--accent-gold); }
        .cinematic-header .boss-progress { color:var(--cinematic-muted); }
        .cinematic-intro { position:relative; z-index:10; display:grid; grid-template-columns:minmax(180px,.8fr) minmax(280px,1.2fr); align-items:center; gap:clamp(1rem,5vw,5rem); width:min(1100px,calc(100% - 2rem)); margin:auto; }
        .cinematic-boss { display:grid; place-items:center; min-height:180px; font-size:clamp(7rem,18vw,13rem); line-height:1; filter:drop-shadow(0 18px 14px rgba(23,32,42,.18)); }
        .boss-speech-bubble { position:relative; max-width:620px; padding:clamp(1.25rem,3vw,2.25rem); border:1px solid var(--cinematic-line); border-radius:1rem; background:#fff; box-shadow:0 24px 60px rgba(23,32,42,.14); animation:cinematicTextIn .65s .2s ease both; }
        .boss-speech-bubble::before { content:""; position:absolute; left:-15px; top:50%; width:28px; height:28px; border-left:1px solid var(--cinematic-line); border-bottom:1px solid var(--cinematic-line); background:#fff; transform:translateY(-50%) rotate(45deg); }
        .boss-speech-bubble strong { font-size:1.1rem; }
        .boss-speech-bubble p { margin:.6rem 0 1.25rem; color:var(--cinematic-muted); font-size:clamp(1rem,2vw,1.2rem); line-height:1.6; }
        .cinematic-interview { position:relative; z-index:10; display:grid; grid-template-columns:minmax(190px,.65fr) minmax(0,1.35fr); gap:clamp(1rem,4vw,4rem); width:min(1160px,calc(100% - 2rem)); min-height:0; margin:auto; padding:clamp(1rem,3vw,2rem) 0 clamp(1rem,4vw,4rem); }
        .cinematic-boss-panel { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:0; padding:1rem; border-right:1px solid var(--cinematic-line); }
        .cinematic-boss-panel .cinematic-boss { min-height:0; font-size:clamp(6rem,13vw,10rem); }
        .cinematic-boss-panel span { font-weight:900; font-size:1.1rem; }
        .cinematic-boss-panel small { margin-top:.3rem; color:var(--cinematic-muted); }
        .cinematic-chat-panel { display:grid; grid-template-rows:minmax(0,1fr) auto; gap:1rem; min-height:0; }
        .cinematic-chat-panel .boss-chat { min-height:0; max-height:none; padding:clamp(.75rem,2vw,1.25rem); border:1px solid var(--cinematic-line); border-radius:1rem; background:rgba(255,255,255,.72); box-shadow:0 16px 40px rgba(23,32,42,.08); }
        .cinematic-chat-panel .boss-interview { padding:1rem; border:1px solid var(--cinematic-line); border-radius:1rem; background:#fff; box-shadow:0 12px 30px rgba(23,32,42,.08); }
        .cinematic-chat-panel .boss-interview label { color:var(--cinematic-ink); }
        .cinematic-chat-panel .boss-interview textarea { border-color:var(--cinematic-line); background:#f8fafb; color:var(--cinematic-ink); }
        .chat-speaker { display:block; margin-bottom:.2rem; color:var(--accent-gold); font-size:.68rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
        .cinematic-chat-panel .chat-message { border-radius:1rem; animation:cinematicTextIn .35s ease both; }
        .cinematic-chat-panel .chat-message.hrd { border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); }
        .cinematic-chat-panel .chat-message.user { border:1px solid var(--accent-gold); background:var(--accent-gold); color:var(--bg-dark); }
        .cinematic-chat-panel .chat-message.system { color:var(--accent-red); }
        .door-sequence { position:absolute; z-index:1; inset:0; width:100%; height:100%; perspective:1400px; overflow:hidden; }
        .door-zoom-room { position:absolute; inset:0; width:100%; height:100%; transform-style:preserve-3d; transform-origin:center 55%; transition:transform 5s ease-in-out; will-change:transform; }
        .door-wall { position:absolute; inset:0; border:0; border-radius:0; background:radial-gradient(ellipse at 50% 22%,rgba(255,230,167,.2),transparent 38%),linear-gradient(90deg,rgba(0,0,0,.38),transparent 24% 76%,rgba(0,0,0,.38)),linear-gradient(180deg,#263a49 0%,#172633 58%,#080d12 100%); box-shadow:none; transform:translateZ(-20px); }
        .door-frame { position:absolute; top:12%; bottom:0; left:50%; width:min(38vw,520px); transform:translateX(-50%) translateZ(30px); border:14px solid #6b432a; border-bottom:0; border-radius:0; background:transparent; box-shadow:none; }
        .cinematic-scene-label { position:absolute; z-index:10; top:clamp(4.5rem,10vh,7rem); left:50%; transform:translateX(-50%); color:#f1dfb2; font-size:clamp(.75rem,1.8vw,1rem); font-weight:900; letter-spacing:.16em; text-align:center; text-shadow:0 2px 12px rgba(0,0,0,.9); white-space:nowrap; }
        .cinematic-door { position:absolute; inset:0; display:grid; place-items:center; transform-origin:left center; border:7px solid #a26b3a; border-radius:0; background:linear-gradient(105deg,#9a5d32,#633a29 52%,#321f1e); box-shadow:inset 14px 0 rgba(255,221,148,.14),inset -18px 0 rgba(0,0,0,.36),0 18px 25px rgba(0,0,0,.5); transition:transform .7s cubic-bezier(.2,.8,.2,1); }
        .cinematic-door::before { content:""; position:absolute; inset:10%; border:2px solid rgba(244,202,116,.42); border-radius:.25rem; box-shadow:inset 0 0 20px rgba(0,0,0,.25); }
        .cinematic-door i { position:absolute; z-index:2; right:12%; width:14px; height:14px; border:2px solid #f1c76e; border-radius:50%; background:#4d2c20; box-shadow:0 0 12px rgba(244,190,84,.5); }
        .door-sequence.door-opening .cinematic-door,.door-sequence.door-entering .cinematic-door { transform:rotateY(-90deg); }
        .cinematic-room::before { content:""; position:absolute; z-index:0; top:-18%; left:50%; width:min(60vw,760px); height:78vh; background:linear-gradient(180deg,rgba(255,244,204,.42),rgba(226,174,77,.06) 70%,transparent); clip-path:polygon(42% 0,58% 0,100% 100%,0 100%); filter:blur(16px); opacity:.8; }
        .cinematic-room::after { content:""; position:absolute; z-index:0; right:-10%; bottom:-23%; left:-10%; height:58%; background:repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,transparent 1px 9%),linear-gradient(170deg,transparent 0 18%,rgba(0,0,0,.7) 18%); transform:perspective(500px) rotateX(58deg); transform-origin:bottom; opacity:.5; }
        .cinematic-room > .cinematic-header,.cinematic-room > .cinematic-intro,.cinematic-room > .cinematic-interview,.cinematic-room > .boss-finished { position:relative; z-index:10; }
        .cinematic-header .career-section-label { text-shadow:0 2px 12px rgba(0,0,0,.8); }
        .cinematic-header .boss-progress { color:#d5dde5; text-shadow:0 2px 10px rgba(0,0,0,.8); }
        .cinematic-intro { color:#fff; }
        .cinematic-intro .boss-speech-bubble { border-color:#bd9146; background:rgba(13,22,30,.86); box-shadow:0 25px 70px rgba(0,0,0,.5),inset 0 1px rgba(255,255,255,.1); backdrop-filter:blur(12px); }
        .cinematic-intro .boss-speech-bubble::before { border-color:#bd9146; background:#172633; }
        .cinematic-intro .boss-speech-bubble p { color:#d5dde5; }
        .cinematic-interview { position:relative; display:block; width:100%; height:100%; margin:0; padding:0; }
        .cinematic-boss-panel { position:absolute; z-index:1; inset:0; display:block; padding:0; border:0; pointer-events:none; }
        .cinematic-boss-panel .cinematic-boss { position:absolute; z-index:1; bottom:clamp(18rem,36vh,26rem); left:50%; min-height:0; width:auto; font-size:1rem; filter:none; transform:translateX(-50%); }
        .boss-chair { position:absolute; z-index:0; bottom:clamp(17rem,30vh,23rem); left:50%; width:clamp(170px,20vw,270px); height:clamp(210px,32vh,320px); transform:translateX(-50%); border:3px solid #53677b; border-bottom:0; border-radius:42% 42% 8% 8%; background:linear-gradient(110deg,#172636,#31485b 45%,#101b27); box-shadow:inset 18px 0 rgba(255,255,255,.07),inset -22px 0 rgba(0,0,0,.32),0 25px 35px rgba(0,0,0,.5); }
        .boss-chair::before,.boss-chair::after { content:""; position:absolute; top:36%; width:22px; height:45%; border:3px solid #53677b; border-radius:12px; background:#1b2b3b; box-shadow:0 12px 12px rgba(0,0,0,.45); }
        .boss-chair::before { left:-19px; transform:rotate(9deg); }
        .boss-chair::after { right:-19px; transform:rotate(-9deg); }
        .boss-chair span { position:absolute; right:12%; bottom:0; left:12%; height:24%; border-radius:45% 45% 0 0; background:#101a25; box-shadow:inset 0 5px rgba(255,255,255,.06); }
        .boss-desk { position:absolute; z-index:2; bottom:clamp(21rem,38vh,27rem); left:50%; width:clamp(260px,30vw,420px); height:clamp(3.5rem,7vh,5rem); transform:translateX(-50%) perspective(500px) rotateX(7deg); border:2px solid #6f4325; border-radius:.45rem .45rem .15rem .15rem; background:linear-gradient(180deg,#c9894b 0%,#8d4e2c 46%,#4c2b21 100%); box-shadow:0 16px 0 rgba(35,19,15,.72),0 22px 28px rgba(0,0,0,.62),inset 0 3px rgba(255,218,148,.38); }
        .boss-desk::before { content:""; position:absolute; top:-.45rem; right:-2px; left:-2px; height:.7rem; border:2px solid #7c4c28; border-radius:.35rem; background:linear-gradient(180deg,#e1aa62,#a96235); box-shadow:0 5px 8px rgba(0,0,0,.34); }
        .boss-desk span { position:absolute; top:42%; left:10%; width:80%; height:2px; background:rgba(255,226,164,.22); box-shadow:0 10px rgba(56,27,19,.25); }
        .cinematic-boss-panel > span,.cinematic-boss-panel > small { position:absolute; left:50%; transform:translateX(-50%); text-shadow:0 2px 8px #000; }
        .cinematic-boss-panel > span { bottom:clamp(6.5rem,14vh,9rem); color:#fff; }
        .cinematic-boss-panel > small { bottom:clamp(5.4rem,12vh,7.5rem); color:#d5dde5; }
        .cinematic-chat-panel { position:absolute; z-index:3; right:clamp(1rem,5vw,5rem); bottom:clamp(1rem,3vh,2rem); left:clamp(1rem,5vw,5rem); display:grid; grid-template-rows:minmax(0,1fr) auto; gap:.7rem; min-height:0; padding:clamp(.65rem,1.5vw,1rem); border:1px solid rgba(209,166,83,.8); border-radius:1rem; background:rgba(8,15,21,.78); box-shadow:0 18px 55px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.12); backdrop-filter:blur(14px); }
        .cinematic-chat-panel .boss-chat { height:clamp(110px,22vh,220px); overflow-y:auto; padding:.2rem .25rem; border:0; background:transparent; }
        .cinematic-chat-panel .boss-interview { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:.65rem; padding:0; border:0; background:transparent; box-shadow:none; }
        .cinematic-chat-panel .boss-interview label { grid-column:1 / -1; color:#f1dfb2; font-size:.75rem; letter-spacing:.08em; text-transform:uppercase; }
        .cinematic-chat-panel .boss-interview textarea { grid-column:1; min-height:52px; max-height:100px; resize:none; border-color:rgba(255,255,255,.2); background:rgba(255,255,255,.1); color:#fff; }
        .cinematic-chat-panel .boss-interview textarea::placeholder { color:#aeb9c3; }
        .cinematic-chat-panel .boss-actions { grid-column:2; display:flex; flex-wrap:nowrap; }
        .cinematic-chat-panel .boss-mic-button { border-color:rgba(255,255,255,.25); background:rgba(255,255,255,.1); color:#fff; }
        .cinematic-chat-panel .boss-finish-button { border:1px solid #d6a64f; background:linear-gradient(135deg,#bd7b2c,#8f3d2c); box-shadow:0 5px 16px rgba(0,0,0,.3); }
        .boss-silhouette { position:relative; display:block; width:clamp(150px,18vw,220px); height:clamp(230px,38vh,360px); filter:drop-shadow(22px 24px 12px rgba(0,0,0,.72)); transform:translateZ(40px); }
        .boss-head,.boss-hair,.boss-body,.boss-tie { position:absolute; display:block; }
        .boss-head { z-index:2; top:7%; left:31%; width:38%; aspect-ratio:1; border:4px solid #d5a871; border-radius:50%; background:radial-gradient(circle at 35% 28%,#f3c996 0 9%,#b86d4f 10% 18%,#754631 19% 100%); box-shadow:inset -12px -10px 0 rgba(68,31,29,.28); }
        .boss-hair { z-index:3; top:4%; left:28%; width:45%; height:21%; border-radius:60% 45% 35% 30%; background:linear-gradient(135deg,#2d2020,#080c12); transform:rotate(-5deg); }
        .boss-body { bottom:0; left:8%; width:84%; height:70%; border:4px solid #ad8b54; border-bottom:0; border-radius:48% 48% 8% 8%; background:linear-gradient(105deg,#283949 0 42%,#b8b7ae 43% 57%,#202d3b 58%); box-shadow:inset 15px 0 rgba(255,255,255,.08),inset -20px 0 rgba(0,0,0,.25); }
        .boss-tie { z-index:4; bottom:12%; left:45%; width:11%; height:48%; clip-path:polygon(50% 0,100% 18%,70% 100%,30% 100%,0 18%); background:linear-gradient(90deg,#6e1d24,#d65a43 48%,#601722); }
        .cinematic-boss-panel .cinematic-boss::before { content:""; position:absolute; z-index:-1; top:-18%; left:50%; width:clamp(180px,23vw,300px); height:clamp(230px,40vh,390px); transform:translateX(-50%); background:radial-gradient(ellipse,rgba(250,220,150,.36),rgba(250,220,150,.07) 45%,transparent 72%); filter:blur(10px); }
        @keyframes cinematicRoomIn { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
        @keyframes cinematicTextIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .career-section-label { margin:0; color:var(--accent-gold); font-size:.72rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .boss-start-button,.boss-finish-button,.boss-return-button { width:fit-content; min-height:44px; border:0; border-radius:.65rem; padding:.75rem 1rem; background:var(--accent-red); color:#fff; font-weight:800; cursor:pointer; text-decoration:none; }
        .office-intro { display:grid; gap:.8rem; }
        .office-room { position:relative; height:280px; overflow:hidden; border:1px solid var(--border); border-radius:.75rem; background:linear-gradient(to bottom,#dde4ec 0 68%,#8b7355 68% 100%); }
        .office-wall { position:absolute; inset:0 0 32%; }
        .office-window { position:absolute; top:35px; left:38px; width:110px; height:80px; display:flex; border:6px solid var(--bg-main); background:#9ec8dc; }
        .office-window span { flex:1; border-right:3px solid var(--bg-main); }
        .office-board { position:absolute; top:38px; right:38px; width:130px; height:75px; display:flex; align-items:center; justify-content:center; gap:8px; border:5px solid #c5a66b; background:#f6f0d5; }
        .office-board i { width:22px; height:22px; border-radius:50%; background:#966313; opacity:.45; }
        .office-desk { position:absolute; z-index:3; left:24%; right:18%; bottom:42px; height:58px; border-radius:6px 6px 0 0; background:#70583d; box-shadow:0 12px 0 #4e4030; }
        .desk-laptop { position:absolute; right:28px; bottom:58px; width:58px; height:38px; border-radius:5px 5px 2px 2px; background:#4b5563; }
        .desk-chair { position:absolute; left:-20px; bottom:-8px; width:90px; height:62px; border-radius:45px 45px 12px 12px; background:#263a4d; }
        .office-door { position:absolute; z-index:2; right:18px; bottom:20px; width:82px; height:160px; display:grid; place-items:center; border:7px solid #6d5034; border-bottom:0; background:#8b6847; transform-origin:left center; transition:transform .8s ease; }
        .office-door span { color:#f4e9d7; font-size:.65rem; font-weight:800; writing-mode:vertical-rl; }
        .office-door.door-open { transform:perspective(400px) rotateY(-62deg); }
        .boss-character { position:absolute; z-index:2; left:-4px; bottom:-22px; opacity:0; transform:translateY(25px) scale(.85); font-size:58px; transition:all .8s ease .25s; }
        .boss-character.boss-entered { opacity:1; transform:translateY(0) scale(1); }
        .intro-dialog { display:flex; align-items:center; gap:.8rem; min-height:74px; padding:.75rem; border:1px solid var(--border); border-radius:.75rem; background:var(--card-bg); }
        .intro-dialog > p { margin:0; color:var(--text-main); font-weight:700; }
        .boss-speech { align-items:flex-start; }
        .boss-avatar { font-size:42px; line-height:1; }
        .boss-speech strong { color:var(--text-main); }
        .boss-speech p { margin:.25rem 0 .65rem; color:var(--muted); }
        .boss-chat-game { display:grid; gap:.75rem; }
        .boss-progress { color:var(--muted); font-size:.82rem; font-weight:800; }
        .boss-chat { display:grid; gap:.55rem; max-height:320px; overflow-y:auto; padding:.75rem; border:1px solid var(--border); border-radius:.65rem; background:var(--bg-main); }
        .chat-message { max-width:82%; padding:.65rem .75rem; border-radius:.75rem; line-height:1.45; overflow-wrap:anywhere; word-break:break-word; }
        .chat-message.hrd { justify-self:start; border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); }
        .chat-message.user { justify-self:end; background:var(--accent-gold); color:var(--bg-dark); }
        .chat-message.system { justify-self:center; color:var(--accent-red); }
        .boss-interview { display:grid; gap:.75rem; }
        .boss-interview label { font-weight:800; color:var(--text-main); }
        .boss-interview textarea { width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:.65rem; padding:.75rem; background:var(--bg-main); color:var(--text-main); font:inherit; resize:vertical; }
        .boss-actions { display:flex; flex-wrap:wrap; gap:.65rem; }
        .boss-mic-button { min-height:44px; border:1px solid var(--border); border-radius:.65rem; padding:.65rem .85rem; background:var(--card-bg); color:var(--text-main); font-weight:800; cursor:pointer; }
        .boss-finished { display:grid; justify-items:center; gap:.65rem; min-height:360px; align-content:center; text-align:center; border-radius:.75rem; background:var(--bg-main); }
        .boss-finished h2 { margin:.15rem 0; color:var(--text-main); font-size:clamp(1.8rem,5vw,3rem); }
        .boss-finished p,.boss-finished strong { margin:0; color:var(--text-main); }
        .boss-victory { border:1px solid #9bd0a5; background:linear-gradient(135deg,#edf8ef,var(--bg-main)); }
        .finished-icon { font-size:64px; animation:bossVictory 1s ease both; }
        @keyframes bossVictory { from{opacity:0;transform:translateY(20px) scale(.6)} to{opacity:1;transform:translateY(0) scale(1)} }
        @media(max-width:700px){
          .boss-fight{padding:.85rem;border-radius:12px}
          .cinematic-header { padding:1rem 1rem 0; }
          .cinematic-intro { grid-template-columns:1fr; gap:.5rem; text-align:center; }
          .cinematic-boss { min-height:130px; font-size:7rem; }
          .boss-speech-bubble { width:100%; box-sizing:border-box; }
          .boss-speech-bubble::before { left:50%; top:-15px; transform:translateX(-50%) rotate(135deg); }
          .cinematic-interview { grid-template-columns:1fr; gap:.5rem; width:calc(100% - 1rem); padding-top:.5rem; }
          .cinematic-boss-panel { flex-direction:row; justify-content:flex-start; gap:.75rem; min-height:auto; padding:.25rem 0 .65rem; border-right:0; border-bottom:1px solid var(--cinematic-line); }
          .cinematic-boss-panel .cinematic-boss { font-size:4rem; }
          .cinematic-boss-panel .cinematic-boss { bottom:54%; left:50%; transform:translateX(-50%); }
          .boss-chair { bottom:48%; width:180px; height:220px; }
          .boss-desk { bottom:52%; left:50%; width:min(88vw,360px); height:3.25rem; }
          .cinematic-boss-panel > span { bottom:39%; }
          .cinematic-boss-panel > small { bottom:35%; }
          .cinematic-boss-panel > span,.cinematic-boss-panel > small { left:50%; }
          .cinematic-chat-panel { right:.75rem; bottom:.75rem; left:.75rem; max-height:56vh; }
          .cinematic-chat-panel .boss-chat { height:clamp(90px,18vh,150px); }
          .cinematic-chat-panel .boss-interview { grid-template-columns:1fr; }
          .cinematic-chat-panel .boss-interview textarea { grid-column:1; }
          .cinematic-chat-panel .boss-actions { grid-column:1; display:grid; grid-template-columns:1fr 1fr; }
          .cinematic-boss-panel small { margin-top:0; }
          .cinematic-chat-panel { gap:.6rem; }
          .cinematic-chat-panel .boss-chat { max-height:none; }
          .office-room{height:240px}
          .office-window{left:18px;width:82px}
          .office-board{right:18px;width:95px}
          .office-desk{left:22%;right:12%}
          .chat-message{max-width:92%}
          .boss-chat{max-height:min(42vh,320px)}
          .intro-dialog{align-items:flex-start;flex-wrap:wrap}
          .boss-speech{display:grid;grid-template-columns:auto minmax(0,1fr)}
          .boss-actions{display:grid;grid-template-columns:minmax(0,1fr)}
          .boss-mic-button,.boss-finish-button{width:100%;justify-content:center}
          .boss-interview textarea{min-height:120px;font-size:16px}
          .cinematic-room { height:100vh; height:100dvh; }
          .cinematic-overlay { overflow-y:auto; }
          .cinematic-interview { height:auto; min-height:0; align-content:start; overflow-y:auto; overscroll-behavior:contain; padding-bottom:max(.75rem,env(safe-area-inset-bottom)); }
          .cinematic-chat-panel { min-height:0; grid-template-rows:minmax(120px,32vh) auto; }
          .cinematic-chat-panel .boss-chat { height:auto; min-height:120px; max-height:32vh; }
          .cinematic-chat-panel .boss-interview { position:relative; }
          .cinematic-chat-panel .boss-interview textarea { min-height:96px; max-height:none; font-size:16px; resize:vertical; }
          .cinematic-chat-panel .boss-actions { grid-template-columns:1fr; }
        }
        @media(max-width:768px){
          .door-frame { top:16%; width:min(72vw,460px); border-width:10px; }
          .cinematic-room { height:100vh; height:100dvh; }
          .cinematic-overlay { overflow-y:auto; }
          .cinematic-interview { height:auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; }
          .cinematic-boss-panel .cinematic-boss { bottom:54%; width:auto; }
          .boss-chair { bottom:48%; }
          .boss-desk { bottom:52%; }
          .cinematic-chat-panel { max-height:52vh; }
        }
        @media(max-width:420px){
          .boss-fight{padding:.65rem}
          .office-room{height:220px}
          .office-window{width:68px;height:68px}
          .office-board{width:78px;height:66px}
          .office-door{right:10px;width:72px;height:145px}
          .desk-laptop{right:14px}
          .boss-speech{grid-template-columns:32px minmax(0,1fr)}
          .boss-avatar{font-size:30px}
          .cinematic-header { align-items:flex-start; flex-direction:column; gap:.35rem; }
          .cinematic-intro { width:calc(100% - 1rem); }
          .cinematic-boss { min-height:110px; font-size:6rem; }
          .cinematic-interview { width:calc(100% - .8rem); }
          .cinematic-boss-panel .cinematic-boss { font-size:3.5rem; }
        }
        .cinematic-overlay {
          --cinematic-ink: var(--text-main);
          --cinematic-muted: var(--muted);
          --cinematic-line: var(--border);
          background: var(--bg-dark);
        }
        .cinematic-room {
          color: var(--text-main);
          background: radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--accent-gold) 12%, transparent), transparent 34%), linear-gradient(180deg, var(--bg-main), var(--bg-dark));
        }
        .cinematic-room.room-closed::before { opacity: .08; }
        .cinematic-room.room-opening::before { opacity: .95; }
        .cinematic-room.room-opening .door-wall { animation: cinematicCameraReveal .8s ease both; }
        .cinematic-header .career-section-label,
        .career-section-label { color: var(--accent-gold); }
        .cinematic-header .boss-progress { color: var(--muted); }
        .cinematic-intro { color: var(--text-main); animation: cinematicBossEntrance .8s ease both; }
        .cinematic-intro .boss-speech-bubble {
          border-color: var(--accent-gold);
          background: color-mix(in srgb, var(--card-bg) 92%, transparent);
          color: var(--text-main);
        }
        .cinematic-intro .boss-speech-bubble::before { border-color: var(--accent-gold); background: var(--card-bg); }
        .cinematic-intro .boss-speech-bubble p { color: var(--muted); }
        .cinematic-chat-panel {
          border-color: var(--border);
          background: color-mix(in srgb, var(--bg-dark) 92%, transparent);
        }
        .cinematic-chat-panel .boss-chat {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: .3rem;
        }
        .chat-message {
          width: fit-content;
          max-width: min(82%, 40rem);
          box-sizing: border-box;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .chat-message.hrd {
          align-self: flex-start;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-main);
        }
        .chat-message.user {
          align-self: flex-end;
          border: 1px solid var(--accent-gold);
          background: var(--accent-gold);
          color: var(--bg-dark);
        }
        .chat-message.system {
          align-self: center;
          border: 1px dashed var(--border);
          background: color-mix(in srgb, var(--card-bg) 88%, transparent);
          color: var(--muted);
        }
        .chat-speaker { color: var(--accent-gold); }
        .cinematic-chat-panel .boss-interview label { color: var(--text-main); }
        .cinematic-chat-panel .boss-interview textarea {
          border-color: var(--border);
          background: var(--bg-dark);
          color: var(--text-main);
        }
        .cinematic-chat-panel .boss-interview textarea::placeholder { color: var(--muted); }
        .boss-start-button,
        .boss-finish-button,
        .boss-return-button {
          border: 1px solid var(--accent-gold);
          background: var(--accent-gold);
          color: var(--bg-dark);
        }
        .boss-mic-button {
          border-color: var(--border);
          background: var(--card-bg);
          color: var(--text-main);
        }
        .boss-finished { background: var(--bg-main); color: var(--text-main); }
        .boss-finished h2,
        .boss-finished p,
        .boss-finished strong { color: var(--text-main); }
        .boss-victory {
          border-color: var(--nd-status-safe);
          background: color-mix(in srgb, var(--nd-status-safe) 15%, var(--bg-dark));
        }
        @keyframes cinematicCameraReveal {
          from { opacity: 0; transform: translateY(12px) translateZ(-20px); }
          to { opacity: 1; transform: translateY(0) translateZ(-20px); }
        }
        @keyframes cinematicBossEntrance {
          from { opacity: 0; transform: translateY(24px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media(max-width:768px) {
        }
        .cinematic-interview,
        .cinematic-chat-panel,
        .cinematic-chat-panel .boss-chat,
        .cinematic-chat-panel .boss-interview { min-width: 0; max-width: 100%; box-sizing: border-box; }
        .cinematic-chat-panel .boss-chat { width: 100%; overflow-x: hidden; }
        .cinematic-chat-panel .boss-interview {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: .45rem;
          width: 100%;
        }
        .cinematic-chat-panel .boss-interview label { grid-column: 1; }
        .chat-message {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: .9rem;
        }
        .chat-message.hrd { border-radius: 16px 16px 16px 4px; }
        .chat-message.user { border-radius: 16px 16px 4px 16px; }
        .chat-message.user .chat-speaker { color: var(--bg-dark); opacity: .72; }
        .chat-scroll-anchor { flex: 0 0 1px; min-height: 1px; }
        .sr-only {
          position: absolute;
          overflow: hidden;
          width: 1px;
          height: 1px;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          clip-path: inset(50%);
        }
        .boss-composer {
          display: flex;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          align-items: flex-end;
          gap: .25rem;
          box-sizing: border-box;
          padding: .35rem;
          border: 1px solid var(--border);
          border-radius: 24px;
          background: var(--card-bg);
          transition: border-color .16s ease, box-shadow .16s ease;
        }
        .boss-composer:focus-within {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-gold) 18%, transparent);
        }
        .boss-composer textarea {
          flex: 1 1 auto;
          width: 100%;
          min-width: 0;
          min-height: 2.5rem;
          max-height: 3.4rem;
          resize: none;
          overflow-y: auto;
          padding: .55rem .65rem;
          border: 0 !important;
          border-radius: 0;
          outline: 0;
          background: transparent !important;
          color: var(--text-main) !important;
          font: inherit;
          font-size: .9rem;
          line-height: 1.35;
        }
        .boss-composer textarea::placeholder { color: var(--muted) !important; }
        .boss-composer .boss-mic-button,
        .boss-composer .boss-finish-button {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          padding: 0;
          border-radius: 50%;
        }
        .boss-composer .boss-mic-button {
          width: 36px;
          height: 36px;
          min-height: 36px;
          border: 0;
          background: transparent;
          color: var(--muted);
        }
        .boss-composer .boss-mic-button:disabled { opacity: .55; }
        .boss-composer .boss-finish-button {
          width: 40px;
          height: 40px;
          min-height: 40px;
          border: 0;
          background: var(--accent-gold);
          color: var(--bg-dark);
        }
        .boss-composer .boss-finish-button:disabled { opacity: .45; }
        .boss-composer .boss-mic-button svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
        .boss-composer .boss-finish-button svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
        @media(max-width:700px) {
          .cinematic-chat-panel { right: .75rem; left: .75rem; width: auto; max-width: calc(100vw - 1.5rem); }
          .boss-composer { width: 100%; max-width: 100%; }
        }
        .door-sequence.door-opening .door-zoom-room,
        .door-sequence.door-entering .door-zoom-room { transform:scale(1.2); }
        @media(max-width:768px) {
          .door-sequence.door-opening .door-zoom-room,
          .door-sequence.door-entering .door-zoom-room { transform:scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </section>
  );
}
