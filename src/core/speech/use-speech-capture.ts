import { useEffect, useRef, useState } from 'preact/hooks';
import { createRecognizer, getRecognitionLang } from './stt-engine';
import { grade, gradeKeywords, type GradeResult, type KeywordGradeResult } from './match';

export type SpeechState = 'idle' | 'listening' | 'processing' | 'feedback' | 'next';
export type SpeechGrade = GradeResult | KeywordGradeResult;

export interface SpeechFeedbackData {
  transcript: string;
  target: string;
  score: number;
  pass: boolean;
  matched: string[];
  missing: string[];
}

interface CaptureOptions {
  target: string;
  keywords?: string[];
  singleWord?: boolean;
  onResult?: (transcript: string, result: SpeechGrade) => void;
  onAdvance?: (transcript: string, result: SpeechGrade) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'Izin mic ditolak': 'Izin mic ditolak',
  'Mic tidak mendengar suara': 'Mic tidak mendengar suara',
  'Cek koneksi': 'Cek koneksi',
  'Mic tidak terdeteksi': 'Mic tidak terdeteksi',
  timeout: 'Waktu rekaman habis. Coba lagi.',
};

export function useSpeechCapture() {
  const [state, setState] = useState<SpeechState>('idle');
  const [feedback, setFeedback] = useState<SpeechFeedbackData | null>(null);
  const [message, setMessage] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer> | null>(null);
  const advanceTimerRef = useRef(0);
  const requestIdRef = useRef(0);

  function reset() {
    requestIdRef.current += 1;
    window.clearTimeout(advanceTimerRef.current);
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setState('idle');
    setFeedback(null);
    setMessage('');
    setUnsupported(false);
  }

  useEffect(() => () => {
    requestIdRef.current += 1;
    window.clearTimeout(advanceTimerRef.current);
    recognizerRef.current?.stop();
  }, []);

  async function start({
    target,
    keywords,
    singleWord = false,
    onResult,
    onAdvance,
  }: CaptureOptions) {
    if (state === 'listening' || state === 'processing') return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    window.clearTimeout(advanceTimerRef.current);
    setFeedback(null);
    setMessage('');
    setUnsupported(false);
    setState('listening');

    try {
      const recognizer = createRecognizer({
        lang: getRecognitionLang({ pathname: window.location.pathname }),
        singleWord,
        gracePeriodMs: 1500,
        onEnd: () => {
          if (requestId === requestIdRef.current) setState('processing');
        },
      });
      recognizerRef.current = recognizer;
      const recognition = await recognizer.recognizeOnce();
      if (requestId !== requestIdRef.current) return;
      recognizerRef.current = null;

      if (recognition.error) {
        setMessage(ERROR_MESSAGES[recognition.error] ?? recognition.error);
        setState('idle');
        return;
      }

      const result = keywords
        ? gradeKeywords(recognition.transcript, keywords)
        : grade(recognition.transcript, target, { singleWord });
      const feedbackTarget = keywords?.join(' ') ?? target;
      const data = {
        transcript: recognition.transcript,
        target: feedbackTarget,
        score: result.score,
        pass: result.pass,
        matched: result.matched,
        missing: result.missing,
      };
      setFeedback(data);
      setState('feedback');
      onResult?.(recognition.transcript, result);
      advanceTimerRef.current = window.setTimeout(() => {
        if (requestId !== requestIdRef.current) return;
        setState('next');
        onAdvance?.(recognition.transcript, result);
      }, 800);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      recognizerRef.current = null;
      setState('idle');
      const code = error instanceof Error ? error.message : String(error);
      if (code === 'STT_NOT_SUPPORTED' || code === 'STT_INSECURE_CONTEXT') {
        setUnsupported(true);
        setMessage(code === 'STT_INSECURE_CONTEXT'
          ? 'Pengenalan suara memerlukan koneksi aman (HTTPS).'
          : 'Pengenalan suara tidak tersedia di browser ini.');
        return;
      }
      setMessage('Pengenalan suara gagal dimulai. Coba lagi atau ketik jawaban.');
      console.error('Unable to start speech recognition.', error);
    }
  }

  return { start, state, feedback, message, unsupported, reset };
}
