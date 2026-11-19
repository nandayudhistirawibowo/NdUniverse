type SpeechRecognitionErrorCode =
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'audio-capture'
  | 'aborted'
  | string;

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: SpeechRecognitionErrorCode;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionLike;
}

export interface GetRecognitionLangOptions {
  lang?: string;
  pathname?: string;
}

export interface CreateRecognizerOptions {
  lang: string;
  singleWord?: boolean;
  timeoutMs?: number;
  gracePeriodMs?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface RecognitionResult {
  alternatives: SpeechAlternative[];
  best: string;
  error?: string;
}

export interface Recognizer {
  recognizeOnce(): Promise<RecognitionResult>;
  stop(): void;
}

const RECOGNITION_ERRORS: Record<string, string> = {
  'not-allowed': 'Izin mic diblokir. Klik ikon 🔒 di address bar → Site settings → Microphone → Allow → Reload halaman.',
  'service-not-allowed': 'STT tidak tersedia di browser ini (coba Chrome/Edge terbaru)',
  'no-speech': 'Mic tidak mendengar suara',
  network: 'Cek koneksi',
  'audio-capture': 'Mic tidak terdeteksi',
};

export function getRecognitionLang({
  lang,
  pathname,
}: GetRecognitionLangOptions = {}): 'de-DE' | 'en-US' {
  const requestedLang = lang?.toLowerCase();
  if (requestedLang) return requestedLang.startsWith('de') ? 'de-DE' : 'en-US';

  return pathname && /(^|\/)de(\/|$)/i.test(pathname) ? 'de-DE' : 'en-US';
}

export function createRecognizer({
  lang,
  singleWord = false,
  timeoutMs = 8000,
  gracePeriodMs = 2000,
  onStart,
  onEnd,
}: CreateRecognizerOptions): Recognizer {
  if (typeof window === 'undefined') throw new Error('STT_NOT_SUPPORTED');

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  if (!Recognition) throw new Error('STT_NOT_SUPPORTED');
  if (!window.isSecureContext) throw new Error('STT_INSECURE_CONTEXT');

  let activeStop: (() => void) | null = null;

  return {
    recognizeOnce() {
      return new Promise<RecognitionResult>((resolve) => {
        activeStop?.();
        const recognition = new Recognition();
        recognition.continuous = !singleWord;
        recognition.interimResults = true;
        recognition.maxAlternatives = 5;
        recognition.lang = lang.toLowerCase().startsWith('de') ? 'de-DE' : 'en-US';

        let settled = false;
        const alternatives: SpeechAlternative[] = [];
        const confidenceCounts: number[] = [];
        let graceTimer = 0;

        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          activeStop = null;
          window.clearTimeout(graceTimer);
          recognition.stop();
          resolve({ alternatives: [], best: '', error: 'timeout' });
        }, timeoutMs);

        const finish = (result: RecognitionResult) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          window.clearTimeout(graceTimer);
          activeStop = null;
          resolve(result);
        };

        const stop = () => {
          if (settled) return;
          recognition.stop();
        };

        activeStop = stop;
        recognition.onresult = (event) => {
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            if (!result.isFinal) continue;

            for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
              const alternative = result[alternativeIndex];
              if (!alternative) continue;

              const previous = alternatives[alternativeIndex];
              const count = confidenceCounts[alternativeIndex] ?? 0;
              alternatives[alternativeIndex] = {
                transcript: `${previous?.transcript ? `${previous.transcript} ` : ''}${alternative.transcript}`.trim(),
                confidence: ((previous?.confidence ?? 0) * count + alternative.confidence) / (count + 1),
              };
              confidenceCounts[alternativeIndex] = count + 1;
            }
          }

          if (alternatives[0]?.transcript && singleWord) stop();
        };
        recognition.onerror = (event) => finish({
          alternatives: [],
          best: '',
          error: RECOGNITION_ERRORS[event.error] ?? event.error,
        });
        recognition.onend = () => {
          if (settled) return;
          onEnd?.();
          graceTimer = window.setTimeout(() => {
            const best = alternatives.reduce(
              (current, alternative) => alternative.confidence > current.confidence ? alternative : current,
              { transcript: '', confidence: Number.NEGATIVE_INFINITY },
            );
            finish({
              alternatives: alternatives.filter((alternative) => alternative.transcript),
              best: best.transcript,
            });
          }, gracePeriodMs);
        };

        try {
          recognition.start();
          onStart?.();
        } catch (error) {
          window.clearTimeout(timer);
          settled = true;
          activeStop = null;
          throw error;
        }
      });
    },
    stop() {
      activeStop?.();
    },
  };
}
