import { useRef, useState } from 'preact/hooks';

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
  profession = 'Karir',
  returnHref = '/career',
}) {
  const fallbackQuestion = {
    question: 'Erzählen Sie mir von sich.',
    keywords: ['nama', 'pengalaman', 'belajar'],
  };
  const interviewQuestions = questions.length > 0 ? questions : [fallbackQuestion];
  const [gameState, setGameState] = useState('intro');
  const [bossEntered, setBossEntered] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [messages, setMessages] = useState([]);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const currentQuestion = interviewQuestions[questionIndex];

  const knockDoor = () => {
    setBossEntered(true);
    setMessages([]);
  };

  const startInterview = () => {
    setGameState('interview');
    setMessages([{ speaker: 'hrd', text: interviewQuestions[0].question }]);
    setQuestionIndex(0);
    setAnswer('');
    setCorrectAnswers(0);
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages((current) => [
        ...current,
        { speaker: 'system', text: 'Browser tidak mendukung Speech Recognition.' },
      ]);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current = recognition;
    setListening(true);
    recognition.onresult = (event) => setAnswer(event.results[0]?.[0]?.transcript ?? '');
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const submitAnswer = () => {
    if (!answer.trim()) return;
    const normalized = normalizeAnswer(answer);
    const matchedKeywords = (currentQuestion.keywords ?? []).filter((keyword) =>
      normalized.includes(normalizeAnswer(keyword))
    );
    const passed = matchedKeywords.length > 0;
    const totalPassed = correctAnswers + (passed ? 1 : 0);
    const userMessage = { speaker: 'user', text: answer };
    const feedback = passed
      ? `Jawaban cukup: cocok dengan ${matchedKeywords.join(', ')}.`
      : 'Jawaban belum mengenali kata kunci dari pertanyaan ini.';

    const finalQuestionIndex = questionIndex + 1;
    if (finalQuestionIndex >= interviewQuestions.length) {
      setMessages((current) => [...current, userMessage, { speaker: 'hrd', text: feedback }]);
      setCorrectAnswers(totalPassed);
      setAnswer('');
      setGameState('finished');
      return;
    }

    const nextQuestion = interviewQuestions[finalQuestionIndex].question;
    setCorrectAnswers(totalPassed);
    setMessages((current) => [
      ...current,
      userMessage,
      { speaker: 'hrd', text: feedback },
      { speaker: 'hrd', text: nextQuestion },
    ]);
    setQuestionIndex(finalQuestionIndex);
    setAnswer('');
  };

  const passedInterview = correctAnswers >= Math.ceil(interviewQuestions.length / 2);

  return (
    <section class="boss-fight">
      {gameState === 'intro' && (
        <div class="office-intro" aria-live="polite">
          <div class="office-room">
            <div class="office-wall">
              <div class="office-window"><span /><span /></div>
              <div class="office-board"><i /><i /><i /></div>
            </div>
            <div class="office-desk">
              <div class="desk-laptop" />
              <div class="desk-chair" />
              <div class={bossEntered ? 'boss-character boss-entered' : 'boss-character'} aria-label="Herr Müller, HRD">
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
                <p>Guten Tag! Bitte setzen Sie sich. Ich bin Herr Müller, HRD di sini.</p>
                <button class="boss-start-button" type="button" onClick={startInterview}>Mulai Wawancara</button>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === 'interview' && (
        <div class="boss-chat-game">
          <p class="career-section-label">Boss Fight: {profession}</p>
          <div class="boss-progress">
            Pertanyaan {Math.min(questionIndex + 1, interviewQuestions.length)} dari {interviewQuestions.length}
          </div>
          <div class="boss-chat" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.speaker}-${index}`} class={`chat-message ${message.speaker}`}>
                {message.speaker === 'hrd' ? 'HRD: ' : message.speaker === 'user' ? 'Anda: ' : ''}
                {message.text}
              </div>
            ))}
          </div>
          <div class="boss-interview">
            <label for="boss-answer">Jawaban Anda</label>
            <textarea
              id="boss-answer"
              rows="4"
              value={answer}
              onInput={(event) => setAnswer(event.currentTarget.value)}
              placeholder="Jawab dalam bahasa Jerman..."
            />
            <div class="boss-actions">
              <button class="boss-mic-button" type="button" onClick={startListening} disabled={listening}>
                {listening ? '🎤 Mendengarkan...' : '🎤 Gunakan Mic'}
              </button>
              <button class="boss-finish-button" type="button" onClick={submitAnswer} disabled={!answer.trim()}>
                Kirim Jawaban
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'finished' && (
        <div class={passedInterview ? 'boss-finished boss-victory' : 'boss-finished'}>
          <span class="finished-icon" aria-hidden="true">{passedInterview ? '🏆' : '📋'}</span>
          <p class="career-section-label">Boss Fight Selesai</p>
          <h2>Wawancara Selesai!</h2>
          <p>{passedInterview ? `Selamat, Anda Lulus Wawancara ${profession}!` : `Anda menyelesaikan wawancara ${profession}.`}</p>
          <strong>{correctAnswers}/{interviewQuestions.length} pertanyaan memenuhi kata kunci.</strong>
          {passedInterview && <p>Badge {badge} berhasil diperoleh.</p>}
          <a class="boss-return-button" href={returnHref}>Kembali ke Materi</a>
        </div>
      )}

      <style>{`
        .boss-fight { display:grid; gap:.75rem; padding:1.25rem; border:1px solid var(--accent-gold); border-radius:14px; background:radial-gradient(circle at top right,rgba(229,169,59,.16),transparent 45%),var(--card-bg); }
        .career-section-label { margin:0; color:#966313; font-size:.72rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
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
        .chat-message.user { justify-self:end; background:var(--accent-red); color:#fff; }
        .chat-message.system { justify-self:center; color:#b42318; }
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
        }
      `}</style>
    </section>
  );
}
