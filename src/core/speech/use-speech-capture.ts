import { useEffect, useRef, useState } from 'preact/hooks';
import { createRecognizer, getRecognitionLang } from './stt-engine';
import { cancelRecording, recordAndTranscribe, stopRecording } from './recorder';
import {
  gradeWithAlternatives,
  normalizeTargetText,
  type GradeResult,
  type GradeWithAlternativesResult,
  type KeywordGradeResult,
} from './match';

export type SpeechState = 'idle' | 'listening' | 'processing' | 'feedback' | 'next';
export type SpeechGrade = GradeResult | KeywordGradeResult | GradeWithAlternativesResult;

export interface SpeechFeedbackData {
  transcript: string;
  target: string;
  score: number;
  pass: boolean;
  matched: string[];
  missing: string[];
  source: 'groq' | 'speechmatics' | 'browser';
}

interface CaptureOptions {
  target: string;
  targetText?: string;
  preserveArticles?: boolean;
  keywords?: string[];
  singleWord?: boolean;
  onResult?: (transcript: string, result: SpeechGrade) => void;
  onAdvance?: (transcript: string, result: SpeechGrade) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'Izin mic ditolak': 'Izin mic diblokir. Klik ikon 🔒 di address bar → Site settings → Microphone → Allow → Reload halaman.',
  'Mic tidak mendengar suara': 'Mic tidak mendengar suara',
  'Cek koneksi': 'Cek koneksi',
  'Mic tidak terdeteksi': 'Mic tidak terdeteksi',
  'service-not-allowed': 'STT tidak tersedia di browser ini (coba Chrome/Edge terbaru)',
  timeout: 'Waktu rekaman habis. Coba lagi.',
};

export function useSpeechCapture() {
  const [state, setState] = useState<SpeechState>('idle');
  const [feedback, setFeedback] = useState<SpeechFeedbackData | null>(null);
  const [message, setMessage] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [noiseFloor, setNoiseFloor] = useState<number | null>(null);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer> | null>(null);
  const advanceTimerRef = useRef(0);
  const requestIdRef = useRef(0);
  const captureActiveRef = useRef(false);
  const microphonePermissionRef = useRef<PermissionState | null>(null);

  useEffect(() => {
    let active = true;
    let permissionStatus: PermissionStatus | null = null;
    if (!navigator.permissions?.query) return undefined;
    const permissions = navigator.permissions as Permissions & {
      query: (descriptor: { name: 'microphone' }) => Promise<PermissionStatus>;
    };

    void permissions.query({ name: 'microphone' }).then((status) => {
      if (!active) return;
      permissionStatus = status;
      microphonePermissionRef.current = status.state;
      status.onchange = () => {
        microphonePermissionRef.current = status.state;
      };
    }).catch(() => {
      // Some browsers do not expose microphone permission state.
    });

    return () => {
      active = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  function reset() {
    requestIdRef.current += 1;
    captureActiveRef.current = false;
    window.clearTimeout(advanceTimerRef.current);
    cancelRecording();
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setState('idle');
    setFeedback(null);
    setMessage('');
    setUnsupported(false);
    setVolumeLevel(0);
    setNoiseFloor(null);
  }

  useEffect(() => () => {
    requestIdRef.current += 1;
    captureActiveRef.current = false;
    window.clearTimeout(advanceTimerRef.current);
    cancelRecording();
    recognizerRef.current?.stop();
  }, []);

  function stop() {
    if (!captureActiveRef.current) return;
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    } else {
      stopRecording();
    }
  }

  async function start({
    target,
    targetText = target,
    preserveArticles = false,
    keywords,
    singleWord = false,
    onResult,
    onAdvance,
  }: CaptureOptions) {
    if (captureActiveRef.current) return;
    if (microphonePermissionRef.current === 'denied') {
      setMessage(ERROR_MESSAGES['Izin mic ditolak']);
      setState('idle');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    captureActiveRef.current = true;
    window.clearTimeout(advanceTimerRef.current);
    setFeedback(null);
    setMessage('');
    setUnsupported(false);
    setVolumeLevel(0);
    setNoiseFloor(null);
    setState('listening');

    try {
      const language = getRecognitionLang({ pathname: window.location.pathname }) === 'de-DE'
        ? 'de'
        : 'en';
      let alternatives: Array<{ transcript: string; confidence: number }>;
      let source: SpeechFeedbackData['source'];

      try {
        const transcription = await recordAndTranscribe({
          lang: language,
          targetText: normalizeTargetText(targetText, { preserveArticles }),
          preserveArticles,
          onVolume: (level) => {
            if (requestId === requestIdRef.current) setVolumeLevel(level);
          },
          onNoiseFloor: (level) => {
            if (requestId === requestIdRef.current) setNoiseFloor(level);
          },
          onUpload: () => {
            if (requestId === requestIdRef.current) setState('processing');
          },
        });
        alternatives = [{ transcript: transcription.transcript, confidence: 1 }];
        source = transcription.source;
        if (import.meta.env.DEV) console.info(`[STT] source=${source}`);
      } catch (whisperError) {
        if (requestId !== requestIdRef.current) return;
        if (import.meta.env.DEV) {
          console.info('[STT] Whisper unavailable; falling back to Web Speech API.', whisperError);
        }
        setVolumeLevel(0);
        setState('listening');
        const recognizer = createRecognizer({
          lang: getRecognitionLang({ pathname: window.location.pathname }),
          singleWord,
          gracePeriodMs: 2000,
          onEnd: () => {
            if (requestId === requestIdRef.current) setState('processing');
          },
        });
        recognizerRef.current?.stop();
        recognizerRef.current = recognizer;
        const recognition = await recognizer.recognizeOnce();
        if (recognition.error || recognition.alternatives.length === 0) {
          throw new Error(recognition.error ?? 'No speech alternatives were returned.');
        }
        alternatives = recognition.alternatives;
        source = 'browser';
        if (import.meta.env.DEV) console.info(`[STT] source=${source}`);
      }

      if (requestId !== requestIdRef.current) return;
      captureActiveRef.current = false;
      recognizerRef.current = null;
      setVolumeLevel(0);

      const result = gradeWithAlternatives(alternatives, target, {
        singleWord,
        keywords,
        preserveArticles,
      });
      const transcript = result.bestAlternative.transcript;
      const firstTranscript = alternatives[0]?.transcript ?? '';
      if (transcript && transcript !== firstTranscript) {
        console.log(
          `[STT] picked alternative #${result.bestAlternative.index + 1}: "${transcript}" (score ${result.score})`,
        );
      }
      const feedbackTarget = keywords?.join(' ') ?? target;
      const data = {
        transcript,
        target: feedbackTarget,
        score: result.score,
        pass: result.pass,
        matched: result.matched,
        missing: result.missing,
        source,
      };
      setFeedback(data);
      setState('feedback');
      onResult?.(transcript, result);
      advanceTimerRef.current = window.setTimeout(() => {
        if (requestId !== requestIdRef.current) return;
        setState('next');
        onAdvance?.(transcript, result);
      }, 800);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      captureActiveRef.current = false;
      recognizerRef.current = null;
      setState('idle');
      setVolumeLevel(0);
      setMessage('STT tidak tersedia, coba lagi');
      if (import.meta.env.DEV) console.warn('[STT] Whisper and Web Speech failed.', error);
    }
  }

  return { start, stop, state, feedback, message, unsupported, volumeLevel, noiseFloor, reset };
}
