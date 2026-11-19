export interface RecordAndTranscribeOptions {
  lang: 'en' | 'de';
  maxMs?: number;
  onVolume?: (level: number) => void;
  onUpload?: () => void;
}

export interface TranscriptionResult {
  transcript: string;
  source: 'groq' | 'speechmatics';
}

interface ActiveRecording {
  stop: () => void;
  cancel: () => void;
}

let activeRecording: ActiveRecording | null = null;
const VOICE_ACTIVITY_THRESHOLD = 0.05;
const SILENCE_GRACE_PERIOD_MS = 2_000;

export function stopRecording(): void {
  activeRecording?.stop();
}

export function cancelRecording(): void {
  activeRecording?.cancel();
}

export async function recordAndTranscribe({
  lang,
  maxMs = 15_000,
  onVolume,
  onUpload,
}: RecordAndTranscribeOptions): Promise<TranscriptionResult> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Audio recording is not supported in this browser.');
  }
  if (activeRecording) throw new Error('An audio recording is already active.');

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let animationFrame = 0;
  let maxTimer = 0;
  let cancelled = false;
  let stopRequested = false;
  const abortController = new AbortController();
  let rejectRecording: ((error: Error) => void) | null = null;

  const session: ActiveRecording = {
    stop: () => {
      stopRequested = true;
      if (recorder?.state === 'recording') recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      abortController.abort();
      if (recorder?.state === 'recording') recorder.stop();
      else rejectRecording?.(new Error('STT_CANCELLED'));
    },
  };
  activeRecording = session;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    if (cancelled) throw new Error('STT_CANCELLED');

    audioContext = new AudioContext();
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const highPassFilter = audioContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 300;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(highPassFilter);
    highPassFilter.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    const preferredMimeType = 'audio/webm;codecs=opus';
    const mimeType = MediaRecorder.isTypeSupported(preferredMimeType)
      ? preferredMimeType
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    const recording = new Promise<Blob>((resolve, reject) => {
      rejectRecording = reject;
      recorder?.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder?.addEventListener('error', () => reject(new Error('Audio recording failed.')), { once: true });
      recorder?.addEventListener('stop', () => {
        if (cancelled) {
          reject(new Error('STT_CANCELLED'));
          return;
        }
        resolve(new Blob(chunks, { type: recorder?.mimeType || mimeType || 'audio/webm' }));
      }, { once: true });
    });

    let heardSound = false;
    let lastSoundAt = 0;
    let lastVolumeUpdate = 0;
    const monitorAudio = (now: number) => {
      if (recorder?.state !== 'recording') return;
      analyser.getByteTimeDomainData(samples);
      let sumSquares = 0;
      for (const sample of samples) {
        const amplitude = (sample - 128) / 128;
        sumSquares += amplitude * amplitude;
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      if (rms >= VOICE_ACTIVITY_THRESHOLD) {
        heardSound = true;
        lastSoundAt = now;
      }
      if (onVolume && now - lastVolumeUpdate >= 100) {
        onVolume(Math.min(1, rms * 6));
        lastVolumeUpdate = now;
      }
      if (heardSound && now - lastSoundAt >= SILENCE_GRACE_PERIOD_MS) {
        session.stop();
        return;
      }
      animationFrame = window.requestAnimationFrame(monitorAudio);
    };

    recorder.start();
    animationFrame = window.requestAnimationFrame(monitorAudio);
    maxTimer = window.setTimeout(() => session.stop(), maxMs);
    if (stopRequested) session.stop();

    const blob = await recording;
    if (cancelled) throw new Error('STT_CANCELLED');
    if (blob.size === 0) throw new Error('Recording was empty.');
    window.clearTimeout(maxTimer);
    maxTimer = 0;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (audioContext && audioContext.state !== 'closed') {
      try {
        await audioContext.close();
      } catch (error) {
        console.warn('Unable to close the microphone audio context.', error);
      }
    }
    audioContext = null;
    onVolume?.(0);
    onUpload?.();

    const formData = new FormData();
    formData.append('audio', blob, 'speech.webm');
    formData.append('lang', lang);
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });
    const result: unknown = await response.json();
    if (!response.ok || !isTranscriptionResponse(result) || !result.transcript.trim()) {
      throw new Error(isErrorResponse(result) ? result.error : 'Transcription failed.');
    }

    return { transcript: result.transcript, source: result.source };
  } finally {
    window.clearTimeout(maxTimer);
    window.cancelAnimationFrame(animationFrame);
    stream?.getTracks().forEach((track) => track.stop());
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
    }
    if (activeRecording === session) activeRecording = null;
    onVolume?.(0);
    rejectRecording = null;
  }
}

function isTranscriptionResponse(
  value: unknown,
): value is { transcript: string; source: 'groq' | 'speechmatics' } {
  return typeof value === 'object'
    && value !== null
    && 'transcript' in value
    && typeof value.transcript === 'string'
    && 'source' in value
    && (value.source === 'groq' || value.source === 'speechmatics');
}

function isErrorResponse(value: unknown): value is { error: string } {
  return typeof value === 'object'
    && value !== null
    && 'error' in value
    && typeof value.error === 'string';
}
