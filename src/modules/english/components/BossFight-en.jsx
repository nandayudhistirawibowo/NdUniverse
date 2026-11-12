import { useEffect, useRef, useState } from 'preact/hooks';
import { playAudioTTS } from '../config/english-speech.js';

function normalizeAnswer(answer) {
  return String(answer ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function BossFight({
  questions = [],
  badge = 'Career',
  profession = 'Career',
  returnHref = '/en/career',
}) {
  const fallbackQuestion = {
    question: 'Tell me about yourself.',
    keywords: ['experience', 'skills', 'goals'],
  };
  const interviewQuestions = questions.length > 0 ? questions : [fallbackQuestion];
  const [gameState, setGameState] = useState('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const currentQuestion = interviewQuestions[questionIndex];

  useEffect(() => {
    if (gameState === 'interview' && currentQuestion?.question) {
      void playAudioTTS(currentQuestion.question, 'us');
    }
  }, [gameState, questionIndex, currentQuestion?.question]);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const startInterview = () => {
    setQuestionIndex(0);
    setAnswer('');
    setScore(0);
    setFeedback(null);
    setGameState('interview');
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setFeedback({ passed: false, message: 'Speech recognition is not supported in this browser. You can type your answer instead.' });
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current = recognition;
    setListening(true);
    setFeedback(null);
    recognition.onresult = (event) => {
      setAnswer(event.results[0]?.[0]?.transcript ?? '');
    };
    recognition.onerror = (event) => {
      setListening(false);
      setFeedback({ passed: false, message: `Speech recognition failed (${event.error}). Please type your answer.` });
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
    } catch (error) {
      setListening(false);
      setFeedback({ passed: false, message: 'Could not start speech recognition. Please type your answer.' });
      console.error('Unable to start English career speech recognition.', error);
    }
  };

  const submitAnswer = () => {
    if (!answer.trim() || feedback?.submitted) return;

    const normalized = normalizeAnswer(answer);
    const keywords = Array.isArray(currentQuestion.keywords) ? currentQuestion.keywords : [];
    const matchedKeywords = keywords.filter((keyword) => {
      const normalizedKeyword = normalizeAnswer(keyword);
      return normalizedKeyword && normalized.includes(normalizedKeyword);
    });
    const passed = matchedKeywords.length >= 2;
    if (passed) setScore((value) => value + 1);
    setFeedback({
      passed,
      submitted: true,
      message: passed
        ? `Good answer! You included ${matchedKeywords.length} key ideas.`
        : `Try to include at least two key ideas. You matched ${matchedKeywords.length} of ${keywords.length}.`,
    });
  };

  const advance = () => {
    if (questionIndex + 1 >= interviewQuestions.length) {
      recognitionRef.current?.abort?.();
      setListening(false);
      setGameState('finished');
      return;
    }
    setQuestionIndex((value) => value + 1);
    setAnswer('');
    setFeedback(null);
  };

  const passedInterview = score >= Math.ceil(interviewQuestions.length / 2);

  return (
    <section class="boss-fight" aria-live="polite">
      {gameState === 'intro' && (
        <div class="boss-intro">
          <div class="boss-avatar" aria-hidden="true">👩‍💼</div>
          <p class="career-section-label">Boss Fight · {profession}</p>
          <h2>Job Interview Challenge</h2>
          <p>Answer {interviewQuestions.length} role-specific interview questions. Include at least two of the three key ideas in each answer to earn credit.</p>
          <button class="boss-primary-button" type="button" onClick={startInterview}>Start Interview</button>
        </div>
      )}

      {gameState === 'interview' && currentQuestion && (
        <div class="interview-panel">
          <div class="interview-header">
            <div>
              <p class="career-section-label">Interview · {profession}</p>
              <h2>Question {questionIndex + 1} of {interviewQuestions.length}</h2>
            </div>
            <span class="score-pill">{score} correct</span>
          </div>

          <article class="question-card">
            <div class="question-title">
              <h3 lang="en">{currentQuestion.question}</h3>
              <button
                class="boss-speak-button"
                type="button"
                onClick={() => void playAudioTTS(currentQuestion.question, 'us')}
                aria-label="Play interview question"
                title="Play interview question"
              >
                🔊
              </button>
            </div>
            <p>Your answer should include at least two relevant key ideas.</p>
          </article>

          <label class="answer-label" for="boss-answer">Your Answer</label>
          <textarea
            id="boss-answer"
            rows="5"
            value={answer}
            onInput={(event) => setAnswer(event.currentTarget.value)}
            placeholder="Type your answer in English..."
            disabled={Boolean(feedback?.submitted)}
          />

          {feedback && (
            <p class={feedback.passed ? 'answer-feedback is-correct' : 'answer-feedback'} role="status">
              {feedback.message}
            </p>
          )}

          <div class="boss-actions">
            <button class="boss-secondary-button" type="button" onClick={startListening} disabled={listening || Boolean(feedback?.submitted)}>
              {listening ? 'Listening...' : '🎤 Answer with Mic'}
            </button>
            {!feedback?.submitted ? (
              <button class="boss-primary-button" type="button" onClick={submitAnswer} disabled={!answer.trim()}>
                Submit Answer
              </button>
            ) : (
              <button class="boss-primary-button" type="button" onClick={advance}>
                {questionIndex + 1 < interviewQuestions.length ? 'Next Question' : 'Finish Interview'}
              </button>
            )}
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <div class={passedInterview ? 'boss-finished is-passed' : 'boss-finished'}>
          <span class="finished-icon" aria-hidden="true">{passedInterview ? '🏆' : '📋'}</span>
          <p class="career-section-label">Challenge Complete</p>
          <h2>Interview Finished</h2>
          <p>{passedInterview ? `You passed the ${profession} interview challenge!` : `You completed the ${profession} interview challenge.`}</p>
          <strong>{score}/{interviewQuestions.length} answers included at least two key ideas.</strong>
          {passedInterview && <p class="badge-earned">Badge earned: {badge}</p>}
          <a class="boss-primary-button return-button" href={returnHref}>Back to Career Prep</a>
        </div>
      )}

      <style>{`
        .boss-fight {
          --boss-ink: var(--text-main,#2b2d42);
          --boss-muted: var(--muted,#6b7280);
          --boss-border: var(--border,rgba(43,45,66,.13));
          --boss-card: var(--card-bg,#fff);
          display:grid;
          min-height:340px;
          align-content:center;
          padding:clamp(1rem,3vw,2rem);
          border:1px solid var(--boss-border);
          border-radius:1rem;
          background:var(--boss-card);
          color:var(--boss-ink);
        }
        .boss-intro,.boss-finished { display:grid; justify-items:center; gap:.75rem; max-width:680px; margin:auto; text-align:center; }
        .boss-avatar { display:grid; width:5rem; height:5rem; place-items:center; border-radius:50%; background:var(--bg-main,#f6f7f8); font-size:2.6rem; }
        .career-section-label { margin:0; color:var(--accent-gold,#966313); font-size:.75rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
        .boss-fight h2 { margin:0; color:var(--boss-ink); font-size:clamp(1.4rem,4vw,2rem); }
        .boss-intro > p:not(.career-section-label),.boss-finished > p { margin:0; color:var(--boss-muted); line-height:1.65; }
        .interview-panel { display:grid; gap:1rem; width:min(760px,100%); margin:auto; }
        .interview-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
        .interview-header h2 { margin-top:.25rem; font-size:1.4rem; }
        .score-pill { padding:.45rem .7rem; border:1px solid var(--boss-border); border-radius:999px; color:var(--boss-muted); font-size:.85rem; font-weight:700; white-space:nowrap; }
        .question-card { display:grid; gap:.6rem; padding:1rem; border:1px solid var(--boss-border); border-left:4px solid var(--accent-gold,#e5a93b); border-radius:.75rem; background:var(--bg-main,#f8f9fa); }
        .question-title { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; }
        .question-card h3 { margin:0; color:var(--boss-ink); font-size:1.15rem; line-height:1.5; }
        .question-card p { margin:0; color:var(--boss-muted); font-size:.9rem; }
        .boss-speak-button { width:42px; height:42px; flex:0 0 auto; border:1px solid var(--boss-border); border-radius:.65rem; background:var(--boss-card); cursor:pointer; }
        .answer-label { color:var(--boss-ink); font-weight:800; }
        .interview-panel textarea { width:100%; min-height:130px; resize:vertical; padding:.85rem; border:1px solid var(--boss-border); border-radius:.65rem; background:var(--boss-card); color:var(--boss-ink); font:inherit; line-height:1.5; }
        .interview-panel textarea:focus { outline:3px solid color-mix(in srgb,var(--accent-gold,#e5a93b) 35%,transparent); border-color:var(--accent-gold,#e5a93b); }
        .answer-feedback { margin:0; color:var(--boss-muted); font-weight:700; }
        .answer-feedback.is-correct { color:#218838; }
        .boss-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:.65rem; }
        .boss-primary-button,.boss-secondary-button { display:inline-flex; min-height:44px; align-items:center; justify-content:center; padding:.65rem 1rem; border-radius:.65rem; font:inherit; font-weight:800; cursor:pointer; text-decoration:none; }
        .boss-primary-button { border:0; background:var(--accent-red,#d93838); color:#fff; }
        .boss-secondary-button { border:1px solid var(--boss-border); background:var(--boss-card); color:var(--boss-ink); }
        .boss-primary-button:disabled,.boss-secondary-button:disabled { cursor:not-allowed; opacity:.6; }
        .finished-icon { font-size:2.5rem; }
        .boss-finished strong { color:var(--boss-ink); }
        .badge-earned { font-weight:800; }
        .return-button { margin-top:.4rem; }
        @media(max-width:560px) {
          .interview-header { align-items:flex-start; flex-direction:column; }
          .boss-actions { justify-content:stretch; }
          .boss-actions button { flex:1 1 100%; }
        }
      `}</style>
    </section>
  );
}
