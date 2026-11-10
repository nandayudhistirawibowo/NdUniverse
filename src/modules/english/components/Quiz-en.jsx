import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { playAudioTTS } from '@german/config/german-speech.js';
import { playSound } from '@core/game/quiz-sounds.js';
import {
  fetchAllUserProgress,
  getProgressClient,
  normalizePassedSessions,
  upsertUserProgress,
} from '@core/db/progress-client-en.js';

const STORAGE_KEY = 'sideutsch-xp';
const BOOKMARKS_KEY = 'sideutsch-bookmarks';
const PILLAR_TYPES = ['reading', 'listening', 'writing', 'speaking'];

function shuffle(items) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function getPillarQuestionType(pillar, item) {
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
  if (pillar === 'reading') {
    return hasText(item?.lesen_teks) && hasText(item?.lesen_pertanyaan) ? 'reading' : 'matcher';
  }
  if (pillar === 'listening') {
    const canPlayAudio = hasText(item?.hoeren_audio) || hasText(item?.context) || hasText(item?.german);
    return canPlayAudio ? 'listening' : 'matcher';
  }
  if (pillar === 'writing') return 'writing';
  if (pillar === 'speaking') return 'speaking';
  return null;
}

function normalizeAnswer(answer) {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

function fuzzyMatch(answer, expected) {
  const a = normalizeAnswer(answer).replace(/[^\p{L}\p{N}\s]/gu, '');
  const b = normalizeAnswer(expected).replace(/[^\p{L}\p{N}\s]/gu, '');
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, column) =>
      row === 0 ? column : column === 0 ? row : 0
    )
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, substitution);
    }
  }
  const distance = matrix[a.length][b.length];
  const threshold = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.25));
  return distance <= threshold;
}

function getAcceptedAnswers(answer) {
  const normalized = normalizeAnswer(answer);
  const withoutLeadingMarkers = normalized.replace(/^(?:(?:der|die|das|sich)\s+)+/, '');
  return withoutLeadingMarkers === normalized
    ? [normalized]
    : [normalized, withoutLeadingMarkers];
}

function readBookmarks() {
  const saved = window.localStorage.getItem(BOOKMARKS_KEY);
  if (!saved) return [];

  const bookmarks = JSON.parse(saved);
  if (!Array.isArray(bookmarks) || bookmarks.some((word) =>
    !word || typeof word.german !== 'string' || typeof word.indonesian !== 'string' || typeof word.context !== 'string'
  )) {
    throw new Error('Data bookmark tidak valid.');
  }
  return bookmarks;
}

function buildQuestionQueue(items, sessionNumber = 1, useSessionType = false, pillarType = null) {
  return items.map((item, index) => ({
    ...item,
    id: `${item.german}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    type: pillarType
      ? getPillarQuestionType(pillarType, item)
      : useSessionType
        ? (getPillarQuestionType(pillarType, item) ?? 'matcher')
        : 'matcher',
    needsReview: false,
    correctAfterWrong: 0,
  }));
}

function buildMatcherSet(currentItem, items) {
  if (!currentItem) return null;

  const uniqueItems = [...new Map(items.map((item) => [item.german, item])).values()];
  const pool = [
    currentItem,
    ...shuffle(uniqueItems.filter((item) => item.german !== currentItem.german && item.indonesian !== currentItem.indonesian)).slice(0, 3),
  ];
  const germanWords = shuffle(pool.map((item) => item.german));
  const indonesianOptions = shuffle(pool.map((item) => item.indonesian));

  return {
    germanWords,
    indonesianOptions,
    correctMap: Object.fromEntries(pool.map((item) => [item.german, item.indonesian])),
  };
}

function buildMultipleChoiceOptions(currentItem, items) {
  if (!currentItem) return [];

  const uniqueItems = [...new Map(items.map((item) => [item.indonesian, item])).values()];
  const distractors = shuffle(
    uniqueItems
      .filter((item) => item.indonesian !== currentItem.indonesian)
      .map((item) => item.indonesian)
  ).slice(0, 3);

  return shuffle([currentItem.indonesian, ...distractors]);
}

function readCompletedSessions(materialId) {
  if (!materialId) return 0;

  try {
    const saved = window.localStorage.getItem(`progress_materi_${materialId}`) ?? '';
    return Number(saved.match(/^Sesi (\d+) Lulus$/)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

function filterPillarItems(items, pillarType, startIndex = 0, batchSize = 5) {
  if (!PILLAR_TYPES.includes(pillarType)) return items.slice(startIndex, startIndex + batchSize);
  return items.slice(startIndex, startIndex + batchSize);
}

/** @param {{ items?: Array<{ german: string, indonesian: string, context: string, lesen_teks?: string, lesen_pertanyaan?: string, hoeren_audio?: string, schreiben_instruksi?: string, sprechen_pertanyaan?: string }>, track?: string, level?: string, jurusan?: string, returnHref?: string, startIndex?: number, batchSize?: number, sessionMode?: boolean, session?: number, materialId?: string, type?: string }} props */
export default function Quiz(props) {
  const {
    items: suppliedItems,
    track,
    level,
    jurusan,
    returnHref = '/materi',
    startIndex = 0,
    batchSize,
    sessionMode = false,
    session = 0,
    materialId,
    type: pillarType,
  } = props;
  const items = suppliedItems ?? [];
  const pillarMode = PILLAR_TYPES.includes(pillarType);
  const effectiveBatchSize = Math.max(1, batchSize ?? (sessionMode ? 5 : items.length || 1));
  const selectedSession = Math.max(1, Number(session) || Math.floor(startIndex / effectiveBatchSize) + 1);
  const sessionStartIndex = (selectedSession - 1) * effectiveBatchSize;
  const [activeStartIndex, setActiveStartIndex] = useState(sessionStartIndex);
  const pillarItems = useMemo(
    () => filterPillarItems(items, pillarType, activeStartIndex, effectiveBatchSize),
    [items, pillarType, activeStartIndex, effectiveBatchSize]
  );
  const [xp, setXp] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [lives, setLives] = useState(3);
  const [sessionInitialized, setSessionInitialized] = useState(!sessionMode);
  const currentBatchItems = useMemo(
    () => pillarMode
      ? pillarItems
      : sessionMode
        ? items.slice(activeStartIndex, activeStartIndex + effectiveBatchSize)
        : items,
    [pillarItems, pillarMode, items, activeStartIndex, effectiveBatchSize, sessionMode]
  );
  const sessionCount = Math.ceil(items.length / effectiveBatchSize);
  const activeSessionNumber = Math.floor(activeStartIndex / effectiveBatchSize) + 1;
  const [queue, setQueue] = useState(() => buildQuestionQueue(
    pillarMode
      ? filterPillarItems(items, pillarType, sessionStartIndex, effectiveBatchSize)
      : sessionMode
        ? items.slice(sessionStartIndex, sessionStartIndex + effectiveBatchSize)
        : items,
    selectedSession,
    sessionMode,
    pillarType
  ));
  const [attemptedCount, setAttemptedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongWords, setWrongWords] = useState([]);
  const [bookmarkedWords, setBookmarkedWords] = useState(() => new Set());
  const [isGameOver, setIsGameOver] = useState(false);
  const [arrangeSelected, setArrangeSelected] = useState([]);
  const [arrangeOptions, setArrangeOptions] = useState([]);
  const [matcherSelection, setMatcherSelection] = useState(null);
  const [matcherMatches, setMatcherMatches] = useState({});
  const [userAnswer, setUserAnswer] = useState('');
  const [choiceAnswer, setChoiceAnswer] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [matcherWrongPair, setMatcherWrongPair] = useState(null);
  const matcherWrongTimeoutRef = useRef(0);
  const [checkedResult, setCheckedResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [materialXp, setMaterialXp] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const progressClientRef = useRef(null);
  const progressUserIdRef = useRef(null);
  const progressWriteQueueRef = useRef(Promise.resolve());
  const pendingProgressRef = useRef({ xpDelta: 0, sessions_passed: null });
  const earnedXpRef = useRef(0);
  const finalizedXpRef = useRef(false);
  const completedSessionsRef = useRef([]);
  const hasAnsweredRef = useRef(false);

  function queueProgressUpdate(updates) {
    if (!materialId) return;

    const userId = progressUserIdRef.current;
    if (!userId) {
      if (updates.xpDelta) pendingProgressRef.current.xpDelta += updates.xpDelta;
      if (updates.sessions_passed) {
        pendingProgressRef.current.sessions_passed = updates.sessions_passed;
      }
      return;
    }

    progressWriteQueueRef.current = progressWriteQueueRef.current
      .then(() => upsertUserProgress(progressClientRef.current, userId, materialId, updates))
      .catch(() => {});
  }

  useEffect(() => {
    let cancelled = false;
    const loadProgress = async () => {
      const client = getProgressClient();
      if (!client) {
        setAuthResolved(true);
        return;
      }

      const { data: { session }, error: authError } = await client.auth.getSession();
      if (cancelled) return;
      const user = session?.user;
      if (authError || !user) {
        setAuthResolved(true);
        return;
      }

      progressClientRef.current = client;
      progressUserIdRef.current = user.id;

      let localXp = 0;
      let localMaterialXp = 0;
      try {
        localXp = Number(window.localStorage.getItem(STORAGE_KEY) || '0');
        localMaterialXp = materialId
          ? Number(window.localStorage.getItem(`progress_xp_${materialId}`) || '0')
          : 0;
      } catch {
        localXp = 0;
        localMaterialXp = 0;
      }

      setXp(Number.isFinite(localXp) ? localXp : 0);
      setMaterialXp(Number.isFinite(localMaterialXp) ? localMaterialXp : 0);
      setIsAuthenticated(true);
      setAuthResolved(true);

      if (!materialId) return;

      const rows = await fetchAllUserProgress(client, user.id);
      if (cancelled) return;

      const current = rows.find((row) => row.material_slug === materialId);
      const currentMaterialXp = Math.max(0, Number(current?.xp) || 0);
      const remoteTotalXp = rows.reduce((total, row) => total + Math.max(0, Number(row.xp) || 0), 0);
      const legacyXp = remoteTotalXp === 0 && Number.isFinite(localXp)
        ? Math.max(0, localXp - earnedXpRef.current)
        : 0;
      const offlineXp = remoteTotalXp > 0
        ? Math.max(0, localMaterialXp - currentMaterialXp - earnedXpRef.current)
        : 0;
      const remoteSessions = normalizePassedSessions(current?.sessions_passed);
      const localCompleted = readCompletedSessions(materialId);
      const completed = Math.max(localCompleted, remoteSessions.at(-1) ?? 0);
      const mergedSessions = Array.from({ length: completed }, (_, index) => index + 1);

      setXp(remoteTotalXp + legacyXp + offlineXp + earnedXpRef.current);
      setMaterialXp(currentMaterialXp + legacyXp + offlineXp + earnedXpRef.current);

      if (completed > 0) {
        completedSessionsRef.current = mergedSessions;
        try {
          window.localStorage.setItem(`progress_materi_${materialId}`, `Sesi ${completed} Lulus`);
        } catch {
          // Keep the remote progress available if local storage is unavailable.
        }
      }

      const pending = pendingProgressRef.current;
      pendingProgressRef.current = { xpDelta: 0, sessions_passed: null };
      if (legacyXp > 0) queueProgressUpdate({ xp: (Number(current?.xp) || 0) + legacyXp });
      if (offlineXp > 0) queueProgressUpdate({ xpDelta: offlineXp });
      if (pending.xpDelta > 0) queueProgressUpdate({ xpDelta: pending.xpDelta });
      const sessionsToSave = pending.sessions_passed
        ?? (localCompleted > (remoteSessions.at(-1) ?? 0) ? mergedSessions : null);
      if (sessionsToSave) queueProgressUpdate({ sessions_passed: sessionsToSave });

      const requestedSession = Number(new URLSearchParams(window.location.search).get('session')) || 0;
      if (sessionMode && !hasAnsweredRef.current) {
        const totalSessions = Math.ceil(items.length / effectiveBatchSize);
        const nextSession = requestedSession
          ? Math.min(Math.max(requestedSession, 1), Math.min(completed + 1, totalSessions || 1))
          : Math.min(completed + 1, totalSessions || 1);
        const nextStartIndex = (nextSession - 1) * effectiveBatchSize;
        if (nextStartIndex !== activeStartIndex) {
          finalizedXpRef.current = false;
          setActiveStartIndex(nextStartIndex);
          setQueue(buildQuestionQueue(
            items.slice(nextStartIndex, nextStartIndex + effectiveBatchSize),
            nextSession,
            sessionMode
          ));
        }
      }
    };

    loadProgress().catch(() => {
      if (!cancelled) setAuthResolved(true);
    });
    return () => { cancelled = true; };
  }, [materialId, items, sessionMode, effectiveBatchSize]);

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(xp));
    } catch {
      // ignore localStorage errors in restricted environments
    }
  }, [xp, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !materialId) return;
    try {
      window.localStorage.setItem(`progress_xp_${materialId}`, String(materialXp));
    } catch {
      // Keep XP in memory if local storage is unavailable.
    }
  }, [materialXp, materialId, isAuthenticated]);

  useEffect(() => {
    if (!authResolved) return;

    if (pillarMode) {
      const firstStartIndex = sessionStartIndex;
      const firstBatch = filterPillarItems(items, pillarType, firstStartIndex, effectiveBatchSize);
      finalizedXpRef.current = false;
      setActiveStartIndex(firstStartIndex);
      setSessionInitialized(true);
      setQueue(buildQuestionQueue(firstBatch, 1, true, pillarType));
      setLives(3);
      setSessionXp(0);
      setAttemptedCount(0);
      setCorrectCount(0);
      setWrongWords([]);
      setIsGameOver(false);
      setArrangeSelected([]);
      setMatcherSelection(null);
      setMatcherMatches({});
      setUserAnswer('');
      setChoiceAnswer('');
      setCheckedResult(null);
      setToast(null);
      return;
    }

    const totalSessions = Math.ceil(items.length / effectiveBatchSize);
    const completed = sessionMode && isAuthenticated ? readCompletedSessions(materialId) : 0;
    const requestedSession = sessionMode
      ? Number(new URLSearchParams(window.location.search).get('session')) || 0
      : 0;
    const defaultSession = Math.min(completed + 1, totalSessions || 1);
    const selectedSession = Math.min(
      Math.max(requestedSession || defaultSession, 1),
      Math.min(completed + 1, totalSessions || 1)
    );
    const nextStartIndex = sessionMode ? (selectedSession - 1) * effectiveBatchSize : startIndex;
    const firstBatch = sessionMode
      ? items.slice(nextStartIndex, nextStartIndex + effectiveBatchSize)
      : items;

    finalizedXpRef.current = false;
    setActiveStartIndex(nextStartIndex);
    setSessionInitialized(true);
    setQueue(buildQuestionQueue(firstBatch, selectedSession, sessionMode));
    setLives(3);
    setSessionXp(0);
    setAttemptedCount(0);
    setCorrectCount(0);
    setWrongWords([]);
    setIsGameOver(false);
    setArrangeSelected([]);
    setMatcherSelection(null);
    setMatcherMatches({});
    setUserAnswer('');
    setChoiceAnswer('');
    setCheckedResult(null);
    setToast(null);
  }, [items, sessionMode, materialId, effectiveBatchSize, startIndex, sessionStartIndex, authResolved, isAuthenticated, pillarMode, pillarType]);

  const currentQuestion = queue[0] ?? null;
  const showSummary = isGameOver || queue.length === 0;

  useEffect(() => {
    if (!currentQuestion) return;
    window.clearTimeout(matcherWrongTimeoutRef.current);
    setMatcherWrongPair(null);
    if (currentQuestion.type === 'arrange') {
      const tokens = currentQuestion.german.split(/\s+/).filter(Boolean);
      setArrangeOptions(shuffle(tokens));
      setArrangeSelected([]);
    } else {
      setMatcherSelection(null);
      setMatcherMatches({});
    }
    setUserAnswer('');
    setChoiceAnswer('');
  }, [currentQuestion]);

  useEffect(() => {
    if (!toast) return undefined;

    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!showSummary) return;

    try {
      setBookmarkedWords(new Set(readBookmarks().map((word) => word.german)));
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Bookmark tidak dapat dibaca.' });
    }
  }, [showSummary]);

  const matcherSet = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== 'matcher') return null;
    return buildMatcherSet(currentQuestion, currentBatchItems);
  }, [currentQuestion, currentBatchItems]);

  const multipleChoiceOptions = useMemo(() => {
    if (!currentQuestion || !['reading', 'listening'].includes(currentQuestion.type)) return [];
    return buildMultipleChoiceOptions(currentQuestion, currentBatchItems);
  }, [currentQuestion, currentBatchItems]);

  const requiredCorrect = Math.ceil(currentBatchItems.length * 0.8);
  const sessionPassed = (sessionMode || pillarMode)
    && !isGameOver
    && queue.length === 0
    && correctCount >= requiredCorrect;
  const sessionFailed = isGameOver || (sessionMode && queue.length === 0 && !sessionPassed);

  useEffect(() => {
    if (!sessionPassed || !materialId) return;

    if (pillarMode && pillarType) {
      let savedPillars = [];
      const key = `progress_pillar_${materialId}_${pillarType}`;
      try {
        const saved = window.localStorage.getItem(key);
        savedPillars = saved ? JSON.parse(saved) : [];
      } catch {
        savedPillars = [];
      }
      const pillarsPassed = [...new Set([...savedPillars, pillarType])];
      completedSessionsRef.current = pillarsPassed;
      try {
        window.localStorage.setItem(key, JSON.stringify(pillarsPassed));
      } catch {
        // Progress tetap dapat disimpan melalui Supabase saat tersedia.
      }
      queueProgressUpdate({ sessions_passed: pillarsPassed });
      return;
    }

    const savedCompleted = isAuthenticated ? readCompletedSessions(materialId) : 0;
    const completed = Math.max(savedCompleted, activeSessionNumber);
    const sessionsPassed = Array.from({ length: completed }, (_, index) => index + 1);
    completedSessionsRef.current = sessionsPassed;
    if (isAuthenticated) {
      try {
        window.localStorage.setItem(`progress_materi_${materialId}`, `Sesi ${completed} Lulus`);
      } catch {
        // The session still syncs to Supabase when available.
      }
    }
    queueProgressUpdate({ sessions_passed: sessionsPassed });
  }, [sessionPassed, materialId, activeSessionNumber, isAuthenticated, pillarMode, pillarType]);

  useEffect(() => {
    if (queue.length > 0 || isGameOver || finalizedXpRef.current) return;

    finalizedXpRef.current = true;
    if (sessionXp <= 0) return;

    earnedXpRef.current += sessionXp;
    setXp((total) => total + sessionXp);
    setMaterialXp((total) => total + sessionXp);
    queueProgressUpdate({ xpDelta: sessionXp });
  }, [queue.length, isGameOver, sessionXp]);

  if (items.length === 0) {
    return (
      <div className="quiz-empty">
        <p>Belum ada vocab untuk latihan saat ini.</p>
      </div>
    );
  }

  if (sessionMode && !sessionInitialized) {
    return <p className="quiz-empty">Menyiapkan progress sesi...</p>;
  }

  function awardXp(amount) {
    setSessionXp((prev) => prev + amount);
  }

  function bookmarkWord(word) {
    try {
      const bookmarks = readBookmarks();
      const alreadySaved = bookmarks.some((saved) =>
        saved.german.trim().toLocaleLowerCase() === word.german.trim().toLocaleLowerCase()
      );
      if (!alreadySaved) {
        bookmarks.push({
          german: word.german,
          indonesian: word.indonesian,
          context: word.context ?? '',
        });
        window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
      }
      setBookmarkedWords((saved) => new Set([...saved, word.german]));
      setToast({
        type: 'success',
        message: alreadySaved ? 'Kata sudah ada di Bookmark.' : 'Kata disimpan ke Bookmark.',
      });
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Bookmark tidak dapat disimpan.' });
    }
  }

  function restartGame() {
    const sessionItems = sessionMode
      ? items.slice(activeStartIndex, activeStartIndex + effectiveBatchSize)
      : items;
    const restartItems = pillarMode
      ? filterPillarItems(items, pillarType, activeStartIndex, effectiveBatchSize)
      : sessionItems;
    finalizedXpRef.current = false;
    setQueue(buildQuestionQueue(restartItems, activeSessionNumber, sessionMode, pillarType));
    setLives(3);
    setSessionXp(0);
    setAttemptedCount(0);
    setCorrectCount(0);
    setWrongWords([]);
    setIsGameOver(false);
    setArrangeSelected([]);
    setMatcherSelection(null);
    setMatcherMatches({});
    setMatcherWrongPair(null);
    window.clearTimeout(matcherWrongTimeoutRef.current);
    setUserAnswer('');
    setChoiceAnswer('');
    setCheckedResult(null);
    setToast(null);
  }

  function startSession(sessionNumber) {
    const nextStartIndex = (sessionNumber - 1) * effectiveBatchSize;
    const nextItems = items.slice(nextStartIndex, nextStartIndex + effectiveBatchSize);
    finalizedXpRef.current = false;
    setActiveStartIndex(nextStartIndex);
    setQueue(buildQuestionQueue(
      pillarMode ? nextItems : nextItems,
      sessionNumber,
      sessionMode,
      pillarMode ? pillarType : null
    ));
    setLives(3);
    setSessionXp(0);
    setAttemptedCount(0);
    setCorrectCount(0);
    setWrongWords([]);
    setIsGameOver(false);
    setArrangeSelected([]);
    setMatcherSelection(null);
    setMatcherMatches({});
    setMatcherWrongPair(null);
    window.clearTimeout(matcherWrongTimeoutRef.current);
    setUserAnswer('');
    setChoiceAnswer('');
    setCheckedResult(null);
    setToast(null);
    const params = new URLSearchParams(window.location.search);
    params.set('session', String(sessionNumber));
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  function showResult(isCorrect) {
    if (checkedResult !== null || !currentQuestion) return;

    hasAnsweredRef.current = true;
    setCheckedResult(isCorrect);
    setAttemptedCount((count) => count + 1);
    if (isCorrect) {
      setCorrectCount((count) => count + 1);
      awardXp(10);
      setToast({ type: 'success', message: 'Jawaban Tepat! +10 XP setelah sesi selesai' });
      playSound('success');
    } else {
      setLives((remaining) => Math.max(remaining - 1, 0));
      setWrongWords((words) => [...words, currentQuestion]);
      if (lives <= 1) {
        setIsGameOver(true);
        setSessionXp(0);
      }
      setToast({ type: 'error', message: 'Kurang tepat, coba lagi!' });
      playSound('error');
    }
  }

  function advanceQuestion() {
    if (!currentQuestion || checkedResult === null) return;

    setQueue((currentQueue) => currentQueue.slice(1));
    setArrangeSelected([]);
    setMatcherSelection(null);
    setMatcherMatches({});
    setMatcherWrongPair(null);
    window.clearTimeout(matcherWrongTimeoutRef.current);
    setUserAnswer('');
    setChoiceAnswer('');
    setCheckedResult(null);
    setToast(null);
  }

  function handleArrangeSubmit() {
    if (arrangeSelected.length === 0) return;

    const answer = arrangeSelected.map((index) => arrangeOptions[index]).join(' ');
    const isCorrect = answer === currentQuestion.german;
    showResult(isCorrect);
  }

  function handleMatcherSubmit() {
    if (!matcherSet) return;

    const isCorrect = Object.entries(matcherSet.correctMap).every(
      ([german, meaning]) => matcherMatches[german] === meaning
    );

    showResult(isCorrect);
  }

  function handleTextSubmit() {
    if (!currentQuestion || !userAnswer.trim()) return;
    const acceptedAnswers = getAcceptedAnswers(currentQuestion.german);
    showResult(acceptedAnswers.includes(normalizeAnswer(userAnswer)));
  }

  function handleMultipleChoiceSubmit() {
    if (!choiceAnswer) return;
    showResult(choiceAnswer === currentQuestion.indonesian);
  }

  function handleFuzzySubmit() {
    if (!currentQuestion || !userAnswer.trim()) return;
    const acceptedAnswers = [currentQuestion.german];
    const isCorrect = acceptedAnswers.some((answer) => fuzzyMatch(userAnswer, answer));
    showResult(isCorrect);
  }

  function startSpeechRecognition() {
    if (checkedResult !== null || isListening) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast({ type: 'error', message: 'Speech recognition tidak didukung browser ini.' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? '';
      setUserAnswer(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setToast({ type: 'error', message: 'Suara tidak berhasil dikenali. Coba lagi.' });
    };
    recognition.start();
  }

  function playListeningAudio(event) {
    const audioSource = currentQuestion?.hoeren_audio?.trim()
      || currentQuestion?.context?.trim()
      || currentQuestion?.german?.trim();
    if (!audioSource) return;

    if (/^(\/|https?:\/\/)/i.test(audioSource)) {
      const button = event.currentTarget;
      button.classList.add('is-playing');
      if (typeof Audio === 'undefined') return;
      const audio = new Audio(audioSource);
      audio.onended = () => button.classList.remove('is-playing');
      audio.onerror = () => {
        button.classList.remove('is-playing');
      };
      audio.play().catch(() => button.classList.remove('is-playing'));
      return;
    }

    playAudioTTS(audioSource, event.currentTarget);
  }

  function addArrangeToken(index) {
    setArrangeSelected((prev) => [...prev, index]);
    playSound('click');
  }

  function removeArrangeToken() {
    setArrangeSelected((prev) => prev.slice(0, -1));
  }

  function resetArrange() {
    setArrangeSelected([]);
  }

  function handleMatcherPick(indonesianWord) {
    if (!matcherSet || checkedResult !== null || !matcherSelection) return;

    const selectedGerman = matcherSelection;
    setMatcherSelection(null);

    if (matcherSet.correctMap[selectedGerman] === indonesianWord) {
      setMatcherMatches((matches) => ({ ...matches, [selectedGerman]: indonesianWord }));
      playSound('success');
      return;
    }

    window.clearTimeout(matcherWrongTimeoutRef.current);
    setMatcherWrongPair({ german: selectedGerman, indonesian: indonesianWord });
    matcherWrongTimeoutRef.current = window.setTimeout(() => setMatcherWrongPair(null), 700);
    playSound('error');
  }

  function selectMatcherWord(word) {
    if (checkedResult !== null || Object.prototype.hasOwnProperty.call(matcherMatches, word)) return;

    setMatcherSelection((selected) => selected === word ? null : word);
    playSound('click');
  }

  function handleQuestionAction() {
    if (checkedResult !== null) {
      advanceQuestion();
      return;
    }

    if (currentQuestion.type === 'arrange') handleArrangeSubmit();
    else if (currentQuestion.type === 'matcher') handleMatcherSubmit();
    else if (currentQuestion.type === 'reading' || currentQuestion.type === 'listening') handleMultipleChoiceSubmit();
    else if (currentQuestion.type === 'writing' || currentQuestion.type === 'speaking') handleFuzzySubmit();
    else handleTextSubmit();
  }

  const questionNumber = Math.min(attemptedCount + (checkedResult === null ? 1 : 0), currentBatchItems.length);
  const progress = currentBatchItems.length === 0 ? 0 : Math.round((attemptedCount / currentBatchItems.length) * 100);
  const accuracy = attemptedCount === 0 ? 0 : Math.round((correctCount / attemptedCount) * 100);
  const matcherIsComplete = matcherSet && Object.keys(matcherMatches).length === matcherSet.germanWords.length;
  const canCheckAnswer = currentQuestion?.type === 'arrange'
    ? arrangeSelected.length > 0
    : currentQuestion?.type === 'matcher'
      ? matcherIsComplete
      : ['reading', 'listening'].includes(currentQuestion?.type)
        ? Boolean(choiceAnswer)
      : userAnswer.trim().length > 0;

  return (
    <div className="quiz-shell">
      {toast && (
        <div className={`quiz-toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {toast.type === 'success'
              ? <path d="m5 12 4 4L19 6" />
              : <path d="m6 6 12 12M18 6 6 18" />}
          </svg>
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      <div className="quiz-header">
        <span className="track-tag">{track ?? 'Track'}</span>
        <span className="xp-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
          <span>XP sesi: {sessionXp} · Total: {xp}</span>
        </span>
        <div className="game-controls">
          <div className="hearts" role="img" aria-label={`Nyawa: ${lives} dari 3`}>
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} className={index < lives ? 'heart-active' : 'heart-empty'} aria-hidden="true">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.8 4.8a5.3 5.3 0 0 0-7.5 0L12 6.1l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5l1.3 1.3L12 21l7.5-7.4 1.3-1.3a5.3 5.3 0 0 0 0-7.5Z" />
                </svg>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="restart-btn"
            onClick={restartGame}
            aria-label="Ulangi kuis dari awal"
            title="Ulangi kuis"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M6.1 9a7 7 0 0 1 11.6-2L20 12M4 12l2.3 5a7 7 0 0 0 11.6-2" />
            </svg>
          </button>
        </div>
      </div>

      {!showSummary && currentQuestion && (
        <>
          <div className="progress-section">
            <div className="progress-label">
              <span>
                {sessionMode && `Sesi ${activeSessionNumber} dari ${sessionCount} · `}
                Soal {questionNumber} dari {currentBatchItems.length}
              </span>
              <span>{progress}%</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Progress kuis"
              aria-valuemin="0"
              aria-valuemax={currentBatchItems.length}
              aria-valuenow={attemptedCount}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

              <div className="question-card">
                {currentQuestion.type === 'arrange' ? (
                  <>
                    <p className="question-label">Tipe A · Susun kata</p>
                    <h3>Susun dalam English: {currentQuestion.indonesian}</h3>
                    <div className="answer-box">
                      <div className="answer-content">
                        {arrangeSelected.length === 0 && <span className="placeholder">Pilih kata untuk menyusun</span>}
                        {arrangeSelected.map((optionIndex, index) => (
                          <span key={`${optionIndex}-${index}`} className="answer-token">
                            {arrangeOptions[optionIndex]}
                          </span>
                        ))}
                      </div>
                      <button type="button" className="reset-btn" onClick={resetArrange} disabled={checkedResult !== null}>
                        Reset
                      </button>
                    </div>
                    <div className="tokens-wrap">
                      {arrangeOptions.map((token, index) => !arrangeSelected.includes(index) && (
                        <button key={`${token}-${index}`} type="button" className="token-chip" onClick={() => addArrangeToken(index)} disabled={checkedResult !== null}>
                          {token}
                        </button>
                      ))}
                    </div>
                    {checkedResult === false && <p className="correct-answer">Jawaban yang benar: {currentQuestion.german}</p>}
                  </>
                ) : currentQuestion.type === 'matcher' ? (
                  <>
                    <p className="question-label">Tipe B · Word matcher</p>
                    <h3>Hubungkan kata dengan artinya</h3>
                    <div className="matcher-board">
                      <div className="matcher-grid">
                        <div className="matcher-column">
                          <p className="column-title">English</p>
                          {matcherSet?.germanWords.map((word) => {
                            const isMatched = Object.prototype.hasOwnProperty.call(matcherMatches, word);
                            const isWrong = matcherWrongPair?.german === word;
                            return (
                              <button
                                key={word}
                                type="button"
                                className={`match-choice ${matcherSelection === word ? 'active' : ''} ${isMatched ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                                onClick={() => selectMatcherWord(word)}
                                disabled={checkedResult !== null || isMatched}
                                aria-pressed={matcherSelection === word}
                              >
                                {word}
                              </button>
                            );
                          })}
                        </div>
                        <div className="matcher-column">
                          <p className="column-title">Bahasa Indonesia</p>
                          {matcherSet?.indonesianOptions.map((word) => {
                            const matchedGerman = Object.keys(matcherMatches).find((german) => matcherMatches[german] === word);
                            const isWrong = matcherWrongPair?.indonesian === word;
                            return (
                              <button
                                key={word}
                                type="button"
                                className={`match-choice ${matcherSelection ? 'selectable' : ''} ${matchedGerman ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                                onClick={() => handleMatcherPick(word)}
                                disabled={checkedResult !== null || Boolean(matchedGerman) || !matcherSelection}
                                aria-pressed={Boolean(matcherSelection)}
                              >
                                {word}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {checkedResult === false && (
                      <p className="correct-answer">
                        Jawaban yang benar: {Object.entries(matcherSet.correctMap).map(([german, indonesian]) => `${german} = ${indonesian}`).join(', ')}
                      </p>
                    )}
                  </>
                ) : currentQuestion.type === 'reading' ? (
                  <>
                    <p className="question-label">Tipe D · Reading / Reading</p>
                    <h3>Bacalah teks berikut</h3>
                    <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-main)', lineHeight: 1.7 }}>
                      {currentQuestion.lesen_teks}
                    </div>
                    <h3 style={{ marginTop: '1rem' }}>{currentQuestion.lesen_pertanyaan}</h3>
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      {multipleChoiceOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`match-choice ${choiceAnswer === option ? 'active' : ''} ${checkedResult !== null && option === currentQuestion.indonesian ? 'correct' : ''}`}
                          onClick={() => setChoiceAnswer(option)}
                          disabled={checkedResult !== null}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {checkedResult === false && <p className="correct-answer">Jawaban yang benar: {currentQuestion.indonesian}</p>}
                  </>
                ) : currentQuestion.type === 'listening' ? (
                  <>
                    <p className="question-label">Tipe E · Listening / Listening</p>
                    <h3>Dengarkan audio, lalu pilih arti yang tepat</h3>
                    <button
                      type="button"
                      className="vocab-speech-button"
                      onClick={playListeningAudio}
                      aria-label={`Putar audio: ${currentQuestion.hoeren_audio}`}
                      title="Putar audio"
                      style={{ width: '52px', height: '52px', fontSize: '1.35rem' }}
                    >
                      🔊
                    </button>
                    <div style={{ display: 'grid', gap: '0.65rem', marginTop: '1rem' }}>
                      {multipleChoiceOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`match-choice ${choiceAnswer === option ? 'active' : ''} ${checkedResult !== null && option === currentQuestion.indonesian ? 'correct' : ''}`}
                          onClick={() => setChoiceAnswer(option)}
                          disabled={checkedResult !== null}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {checkedResult === false && <p className="correct-answer">Jawaban yang benar: {currentQuestion.indonesian}</p>}
                  </>
                ) : currentQuestion.type === 'writing' ? (
                  <>
                    <p className="question-label">Tipe F · Writing / Writing</p>
                    <h3>{currentQuestion.schreiben_instruksi || `Tulis dalam English: ${currentQuestion.indonesian}`}</h3>
                    <textarea
                      value={userAnswer}
                      onInput={(event) => setUserAnswer(event.currentTarget.value)}
                      placeholder="Tulis jawabanmu di sini"
                      aria-label="Jawaban tulisan"
                      disabled={checkedResult !== null}
                      rows={5}
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        padding: '0.85rem 0.9rem',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        font: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                    {checkedResult === false && <p className="correct-answer">Jawaban yang mendekati: {currentQuestion.german}</p>}
                  </>
                ) : currentQuestion.type === 'speaking' ? (
                  <>
                    <p className="question-label">Tipe G · Speaking / Speaking</p>
                    <h3>{currentQuestion.sprechen_pertanyaan || `Ucapkan dalam English: ${currentQuestion.indonesian}`}</h3>
                    <button
                      type="button"
                      onClick={startSpeechRecognition}
                      disabled={checkedResult !== null || isListening}
                      aria-label="Mulai rekaman suara"
                      title="Ucapkan jawaban"
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        border: '1px solid var(--border)',
                        background: isListening ? '#e5484d' : 'var(--card-bg)',
                        color: isListening ? '#fff' : 'var(--text-main)',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        marginBottom: '0.75rem',
                      }}
                    >
                      🎤
                    </button>
                    <input
                      type="text"
                      value={userAnswer}
                      onInput={(event) => setUserAnswer(event.currentTarget.value)}
                      placeholder="Ketik kata kunci jawabannya"
                      aria-label="Jawaban kata kunci"
                      disabled={checkedResult !== null}
                      autoComplete="off"
                      style={{
                        boxSizing: 'border-box',
                        width: '100%',
                        minHeight: '48px',
                        padding: '0.7rem 0.9rem',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        font: 'inherit',
                      }}
                    />
                    {checkedResult === false && <p className="correct-answer">Kata kunci: {currentQuestion.german}</p>}
                  </>
                ) : (
                  <>
                    <p className="question-label">Tipe C · Text Box</p>
                    <h3>Bagaimana mengatakan „{currentQuestion.indonesian}“ dalam English?</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', margin: '0.25rem 0 1rem' }}>
                      <input
                        type="text"
                        value={userAnswer}
                        onInput={(event) => setUserAnswer(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && userAnswer.trim()) {
                            event.preventDefault();
                            handleQuestionAction();
                          }
                        }}
                        placeholder="Ketik jawaban dalam English"
                        aria-label="Jawaban dalam English"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={checkedResult !== null}
                        style={{
                          boxSizing: 'border-box',
                          flex: '1 1 auto',
                          width: '100%',
                          minWidth: 0,
                          minHeight: '48px',
                          padding: '0.7rem 0.9rem',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          background: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          font: 'inherit',
                        }}
                      />
                    </div>
                    {checkedResult === false && <p className="correct-answer">Jawaban yang benar: {currentQuestion.german}</p>}
                  </>
                )}

                <div className="action-row">
                  {currentQuestion.type === 'arrange' && checkedResult === null && (
                    <button type="button" className="secondary-btn" onClick={removeArrangeToken} disabled={arrangeSelected.length === 0}>
                      Hapus Terakhir
                    </button>
                  )}
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handleQuestionAction}
                    disabled={checkedResult === null && !canCheckAnswer}
                  >
                    {checkedResult !== null || (currentQuestion.type === 'matcher' && matcherIsComplete) ? 'Nextkan' : 'Periksa'}
                  </button>
                </div>
              </div>
        </>
      )}

      {showSummary && (
        <div className="quiz-overlay">
          <section className="summary-modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
            <p className={`summary-status ${sessionFailed ? 'game-over' : 'complete'}`}>
              {sessionMode ? (sessionPassed ? 'Sesi LULUS' : 'Sesi GAGAL') : (isGameOver ? 'Game Over' : 'Sesi selesai')}
            </p>
            <h2 id="summary-title">
              {sessionMode
                ? (sessionPassed ? 'Target akurasi tercapai!' : 'Belum mencapai 80%')
                : (isGameOver ? 'Nyawa kamu habis' : 'Latihan tuntas!')}
            </h2>
            {sessionMode && (
              <p className="session-result-copy">
                Sesi {activeSessionNumber} dari {sessionCount}: {correctCount} benar dari {currentBatchItems.length} soal (butuh {requiredCorrect}).
              </p>
            )}
            <div className="summary-stats">
              <div>
                <span>Total XP didapat</span>
                <strong>{sessionXp} XP</strong>
              </div>
              <div>
                <span>Akurasi</span>
                <strong>{accuracy}%</strong>
              </div>
              <div>
                <span>Jawaban benar</span>
                <strong>{correctCount} / {attemptedCount}</strong>
              </div>
            </div>

            <div className="review-panel">
              <h3>Review Kata Sulit</h3>
              {wrongWords.length === 0 ? (
                <p>Belum ada kata yang perlu diulang. Keren!</p>
              ) : (
                <ul>
                  {wrongWords.map((word, index) => (
                    <li key={`${word.german}-${index}`}>
                      <div className="review-word">
                        <strong>{word.german}</strong>
                        <span>{word.indonesian}</span>
                      </div>
                      <button
                        type="button"
                        className={`bookmark-btn ${bookmarkedWords.has(word.german) ? 'saved' : ''}`}
                        aria-label={`${bookmarkedWords.has(word.german) ? 'Tersimpan di' : 'Simpan ke'} Bookmark: ${word.german}`}
                        title={bookmarkedWords.has(word.german) ? 'Sudah tersimpan' : 'Simpan ke Bookmark'}
                        onClick={() => bookmarkWord(word)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="summary-actions">
              {sessionMode && sessionPassed && activeSessionNumber < sessionCount ? (
                <button type="button" className="primary-btn" onClick={() => startSession(activeSessionNumber + 1)}>
                  Next ke Sesi Berikutnya
                </button>
              ) : (
                <button type="button" className="primary-btn" onClick={restartGame}>
                  {sessionMode ? 'Ulangi Sesi Ini' : (isGameOver ? 'Coba Lagi' : 'Ulangi Quiz')}
                </button>
              )}
              <a className="secondary-btn" href={returnHref}>Kembali ke Materi</a>
            </div>
          </section>
        </div>
      )}

      {!showSummary && (
        <div className="meta-stack">
        <span>{track ?? 'Track'} • {level ?? jurusan ?? 'Materi'}</span>
        </div>
      )}

      <style>
        {`
          .quiz-shell {
            display: grid;
            gap: 0.9rem;
            min-width: 0;
            position: relative;
          }

          .quiz-toast {
            display: flex;
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            width: max-content;
            max-width: min(400px, calc(100vw - 32px));
            padding: 12px 24px;
            border: 1px solid;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            font-weight: 800;
            text-align: center;
            animation: toast-slide-fade 3s ease forwards;
            pointer-events: none;
            align-items: center;
            justify-content: center;
            gap: 0.55rem;
          }

          .quiz-toast.success {
            border-color: #22c55e;
            background: #dcfce7;
            color: #166534;
          }

          .quiz-toast.error {
            border-color: #ef4444;
            background: #fee2e2;
            color: #991b1b;
          }

          .quiz-toast svg {
            width: 18px;
            height: 18px;
            flex: 0 0 auto;
            fill: none;
            stroke: currentColor;
            stroke-width: 2.4;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .toast-message {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          @keyframes toast-slide-fade {
            0% { opacity: 0; transform: translate(-50%, -12px); }
            12%, 78% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -4px); }
          }

          .quiz-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.75rem;
            font-size: 0.75rem;
            font-weight: 700;
          }

          .track-tag {
            color: var(--text-main);
          }

          .xp-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            min-height: 36px;
            padding: 0.4rem 0.7rem;
            border: 1px solid rgba(229, 169, 59, 0.55);
            border-radius: 8px;
            background: #FFF4DC;
            color: var(--text-main);
            font-size: 0.75rem;
            letter-spacing: 0;
          }

          .xp-badge svg {
            width: 16px;
            height: 16px;
            flex: 0 0 auto;
            fill: none;
            stroke: #966313;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .game-controls {
            display: flex;
            align-items: center;
            gap: 0.65rem;
          }

          .hearts {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            letter-spacing: 0;
          }

          .hearts span {
            display: grid;
            width: 24px;
            height: 28px;
            place-items: center;
          }

          .hearts svg {
            width: 21px;
            height: 21px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .heart-active {
            color: var(--accent-red);
          }

          .heart-empty {
            color: #A7A7B0;
          }

          .restart-btn {
            display: inline-grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: #fff;
            color: var(--text-main);
            cursor: pointer;
          }

          .restart-btn:hover {
            border-color: var(--accent-gold);
            background: #FFF4DC;
            color: #966313;
            transform: rotate(-18deg);
          }

          .restart-btn svg {
            width: 18px;
            height: 18px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .progress-section {
            display: grid;
            gap: 0.45rem;
          }

          .progress-label {
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            color: var(--text-main);
            font-size: 0.78rem;
            font-weight: 700;
          }

          .progress-track {
            height: 10px;
            overflow: hidden;
            border-radius: 999px;
            background: #F7E5C2;
          }

          .progress-track > span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: var(--accent-gold);
            transition: width 0.35s ease;
          }

          .question-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: clamp(1rem, 2.5vw, 1.6rem);
            box-shadow: 0 12px 30px rgba(26, 26, 30, 0.07);
          }

          .question-label {
            margin: 0 0 0.5rem;
            font-size: 0.72rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            color: var(--text-main);
            text-transform: uppercase;
          }

          h3 {
            margin: 0 0 1rem;
            font-size: 1.15rem;
            line-height: 1.5;
          }

          .answer-box {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            flex-wrap: wrap;
            min-width: 0;
            min-height: 52px;
            gap: 0.5rem;
            margin-bottom: 1rem;
            padding: 0.8rem;
            border-radius: 10px;
            background: #f8fafc;
            border: 1px dashed rgba(148, 163, 184, 0.7);
          }

          .answer-content {
            display: flex;
            flex: 1;
            flex-wrap: wrap;
            gap: 0.5rem;
            min-width: 0;
          }

          .placeholder {
            color: #94a3b8;
            font-size: 0.85rem;
          }

          .answer-token,
          .summary-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.45rem 0.75rem;
            border-radius: 999px;
            background: #F7E5C2;
            color: var(--text-main);
            font-weight: 700;
          }

          .tokens-wrap {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .token-chip,
          .match-choice {
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 8px;
            background: #fff;
            color: var(--text-main);
            padding: 0.65rem 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.18s ease;
          }

          .token-chip:hover,
          .match-choice:hover {
            border-color: var(--accent-gold);
          }

          .token-chip:disabled,
          .match-choice:disabled,
          .primary-btn:disabled,
          .secondary-btn:disabled,
          .reset-btn:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }

          .reset-btn {
            flex: 0 0 auto;
            padding: 0.35rem 0.65rem;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            background: #fff;
            color: #334155;
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
          }

          .match-choice.active {
            background: #F7E5C2;
            border-color: var(--accent-gold);
            color: var(--text-main);
          }

          .match-choice.correct,
          .cloze-choice.correct {
            background: #dcfce7;
            border-color: #16a34a;
            color: #166534;
            animation: choice-pop 0.28s ease-out;
          }

          .match-choice.wrong,
          .cloze-choice.wrong {
            background: #fee2e2;
            border-color: var(--accent-red);
            color: #991b1b;
            animation: choice-shake 0.28s ease-in-out;
          }

          @keyframes choice-pop {
            50% { transform: scale(1.04); }
          }

          @keyframes choice-shake {
            25% { transform: translateX(-3px); }
            75% { transform: translateX(3px); }
          }

          .matcher-board {
            margin-bottom: 1rem;
          }

          .matcher-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: clamp(0.65rem, 3vw, 1.5rem);
            padding: 0.2rem 0;
          }

          .matcher-column {
            display: grid;
            align-content: start;
            gap: 0.5rem;
          }

          .matcher-column:last-child {
            justify-items: stretch;
          }

          .matcher-column .match-choice {
            width: 100%;
            max-width: 100%;
            min-height: 48px;
            overflow-wrap: anywhere;
            text-align: left;
            background: #fff;
          }

          .matcher-column .match-choice.active {
            background: #F7E5C2;
            border-color: var(--accent-gold);
            color: var(--text-main);
          }

          .matcher-column .match-choice.correct {
            background: #dcfce7;
          }

          .matcher-column .match-choice.wrong {
            background: #fee2e2;
          }

          .match-choice.selectable:not(:disabled) {
            border-color: var(--accent-gold);
            box-shadow: 0 0 0 3px rgba(229, 169, 59, 0.2);
          }

          .cloze-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
            gap: 0.65rem;
            margin: 1rem 0;
          }

          .cloze-choice {
            min-height: 48px;
            padding: 0.7rem 0.9rem;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            background: #fff;
            color: #1e293b;
            font-weight: 700;
            text-align: left;
            cursor: pointer;
            transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
          }

          .cloze-choice.selected:not(.correct):not(.wrong) {
            border-color: var(--accent-gold);
            background: #FFF4DC;
            color: var(--text-main);
          }

          .cloze-choice:hover:not(:disabled) {
            border-color: var(--accent-gold);
            transform: translateY(-1px);
          }

          .column-title {
            margin: 0 0 0.2rem;
            color: #475569;
            font-size: 0.74rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .match-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-bottom: 0.8rem;
          }

          .action-row {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
          }

          .primary-btn,
          .secondary-btn {
            border: 0;
            border-radius: 999px;
            padding: 0.7rem 1rem;
            font-weight: 700;
            cursor: pointer;
          }

          .primary-btn {
            background: var(--accent-gold);
            color: var(--text-main);
            flex: 1;
          }

          .primary-btn:hover:not(:disabled),
          .next-btn:hover {
            background: #F0B84F;
          }

          .secondary-btn {
            background: rgba(148, 163, 184, 0.12);
            color: #0f172a;
          }

          .correct-answer {
            margin: 0.9rem 0 0;
            padding: 0.75rem 0.9rem;
            border-radius: 10px;
            background: #FCE7E7;
            color: var(--accent-red);
            font-weight: 600;
            line-height: 1.5;
          }

          .next-btn {
            width: 100%;
            min-height: 52px;
            margin-top: 1rem;
            padding: 0.8rem 1rem;
            border: 0;
            border-radius: 10px;
            background: var(--accent-gold);
            color: var(--text-main);
            font-size: 1rem;
            font-weight: 800;
            cursor: pointer;
          }

          .meta-stack {
            text-align: right;
            font-size: 0.75rem;
            color: #475569;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .quiz-empty {
            padding: 1rem;
            border: 1px dashed rgba(148, 163, 184, 0.6);
            border-radius: 0.8rem;
            color: #475569;
            text-align: center;
          }

          .quiz-complete {
            display: grid;
            justify-items: start;
            gap: 0.5rem;
            padding: 1rem;
          }

          .quiz-complete h3,
          .quiz-complete p {
            margin: 0;
          }

          .quiz-complete .primary-btn {
            min-height: 44px;
            margin-top: 0.5rem;
            padding: 0.65rem 1rem;
            border: 0;
            border-radius: 999px;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
          }

          .quiz-overlay {
            position: fixed;
            inset: 0;
            z-index: 90;
            display: grid;
            place-items: center;
            overflow-y: auto;
            padding: 1rem;
            background: rgba(26, 26, 30, 0.72);
          }

          .summary-modal {
            width: min(100%, 560px);
            max-height: min(92vh, 780px);
            overflow-y: auto;
            padding: 1.4rem;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
          }

          .summary-status {
            display: inline-flex;
            margin: 0 0 0.7rem;
            padding: 0.3rem 0.65rem;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 800;
          }

          .summary-status.game-over {
            background: var(--accent-red);
            color: #ffffff;
          }

          .summary-status.complete {
            background: #dcfce7;
            color: #166534;
          }

          .summary-modal h2 {
            margin: 0 0 1rem;
            font-size: 1.6rem;
          }

          .summary-stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.6rem;
          }

          .summary-stats > div {
            display: grid;
            gap: 0.25rem;
            align-content: start;
            padding: 0.75rem;
            border-radius: 10px;
            background: #FFF4DC;
          }

          .summary-stats span {
            color: #475569;
            font-size: 0.72rem;
            line-height: 1.4;
          }

          .summary-stats strong {
            color: var(--text-main);
            font-size: 1rem;
          }

          .review-panel {
            margin-top: 1.1rem;
            padding: 0.9rem;
            border: 1px solid var(--border);
            border-radius: 10px;
          }

          .review-panel h3 {
            margin: 0 0 0.65rem;
            font-size: 1rem;
          }

          .review-panel p {
            margin: 0;
            color: #475569;
            font-size: 0.9rem;
          }

          .review-panel ul {
            display: grid;
            max-height: 180px;
            gap: 0.5rem;
            overflow-y: auto;
            margin: 0;
            padding: 0;
            list-style: none;
          }

          .review-panel li {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            padding-bottom: 0.45rem;
            border-bottom: 1px solid var(--border);
            color: #475569;
            font-size: 0.88rem;
          }

          .review-panel li:last-child {
            padding-bottom: 0;
            border-bottom: 0;
          }

          .review-panel li strong {
            color: var(--text-main);
          }

          .review-word {
            display: grid;
            gap: 0.15rem;
          }

          .bookmark-btn {
            display: inline-grid;
            width: 34px;
            height: 34px;
            flex: 0 0 auto;
            place-items: center;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--card-bg);
            color: var(--text-main);
            cursor: pointer;
          }

          .bookmark-btn:hover,
          .bookmark-btn.saved {
            border-color: var(--accent-gold);
            color: var(--accent-gold);
          }

          .bookmark-btn svg {
            width: 18px;
            height: 18px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .bookmark-btn.saved svg {
            fill: currentColor;
          }

          .summary-actions {
            display: flex;
            gap: 0.65rem;
            margin-top: 1rem;
          }

          .summary-actions .primary-btn,
          .summary-actions .secondary-btn {
            display: inline-flex;
            min-height: 46px;
            align-items: center;
            justify-content: center;
            padding: 0.65rem 0.85rem;
            border: 0;
            border-radius: 10px;
            font: inherit;
            font-weight: 700;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
          }

          .summary-actions .secondary-btn {
            flex: 1;
            background: #ECECF0;
            color: var(--text-main);
          }

          @media (max-width: 520px) {
            .summary-modal {
              padding: 1rem;
            }

            .summary-stats {
              grid-template-columns: 1fr 1fr;
            }

            .summary-actions {
              flex-direction: column;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .quiz-toast {
              animation: none;
            }

            .progress-track > span {
              transition: none;
          }
        `}
      </style>
    </div>
  );
}
