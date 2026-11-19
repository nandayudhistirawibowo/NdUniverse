export interface RecordAndTranscribeOptions {
  lang: 'en' | 'de';
  targetText?: string;
  maxMs?: number;
  onVolume?: (level: number) => void;
  onNoiseFloor?: (level: number) => void;
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
const NOISE_CALIBRATION_MS = 500;
const VOICE_ACTIVITY_MIN_THRESHOLD = 0.02;
const VOICE_ACTIVITY_NOISE_MARGIN = 0.03;
const SILENCE_GRACE_PERIOD_MS = 1_500;

export function stopRecording(): void {
  activeRecording?.stop();
}

export function cancelRecording(): void {
  activeRecording?.cancel();
}

export async function recordAndTranscribe({
  lang,
  targetText,
  maxMs = 15_000,
  onVolume,
  onNoiseFloor,
  onUpload,
}: RecordAndTranscribeOptions): Promise<TranscriptionResult> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Audio recording is not supported in this browser.');
  }
  if (activeRecording) throw new Error('An audio recording is already active.');

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let filteredStream: MediaStream | null = null;
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
    const lowPassFilter = audioContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = 4_000;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(highPassFilter);
    highPassFilter.connect(lowPassFilter);
    lowPassFilter.connect(analyser);
    const recordingDestination = audioContext.createMediaStreamDestination();
    analyser.connect(recordingDestination);
    filteredStream = recordingDestination.stream;
    const samples = new Uint8Array(analyser.fftSize);

    const readRms = () => {
      analyser.getByteTimeDomainData(samples);
      let sumSquares = 0;
      for (const sample of samples) {
        const amplitude = (sample - 128) / 128;
        sumSquares += amplitude * amplitude;
      }
      return Math.sqrt(sumSquares / samples.length);
    };
    const calibrationSamples: number[] = [];
    const calibrationEnd = performance.now() + NOISE_CALIBRATION_MS;
    while (performance.now() < calibrationEnd) {
      if (cancelled) throw new Error('STT_CANCELLED');
      calibrationSamples.push(readRms());
      await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
    }
    if (cancelled) throw new Error('STT_CANCELLED');
    const noiseFloor = calibrationSamples.length > 0
      ? calibrationSamples.reduce((sum, level) => sum + level, 0) / calibrationSamples.length
      : 0;
    const voiceActivityThreshold = Math.max(
      VOICE_ACTIVITY_MIN_THRESHOLD,
      noiseFloor + VOICE_ACTIVITY_NOISE_MARGIN,
    );
    onNoiseFloor?.(noiseFloor);

    const preferredMimeType = 'audio/webm;codecs=opus';
    const mimeType = MediaRecorder.isTypeSupported(preferredMimeType)
      ? preferredMimeType
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
    recorder = mimeType
      ? new MediaRecorder(filteredStream, { mimeType })
      : new MediaRecorder(filteredStream);
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
      const rms = readRms();
      if (rms > voiceActivityThreshold) {
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
    filteredStream?.getTracks().forEach((track) => track.stop());
    filteredStream = null;
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
    if (targetText?.trim()) formData.append('target_text', targetText.trim());
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
    filteredStream?.getTracks().forEach((track) => track.stop());
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
