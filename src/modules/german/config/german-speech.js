import {
  getSyncGermanTtsAudioUrl,
  preloadCdnAudioManifest,
  resolveCdnAudioUrlSync,
} from '../../../core/audio/cdn-audio.js';

let currentAudio = null;
let currentAudioButton = null;
let activePlaybackId = 0;

if (typeof window !== 'undefined') {
  preloadCdnAudioManifest();
}

function speakGerman(text, button) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    console.error('Neither generated TTS audio nor browser speech synthesis is available.');
    button?.classList.remove('is-playing');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 1;
  utterance.onend = () => button?.classList.remove('is-playing');
  utterance.onerror = (event) => {
    button?.classList.remove('is-playing');
    console.error('Unable to speak German text with browser speech synthesis.', event.error);
  };
  button?.classList.add('is-playing');
  window.speechSynthesis.speak(utterance);
}

export function normalizeText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function stopCurrentAudio() {
  if (!currentAudio) return;

  const audio = currentAudio;
  currentAudio = null;
  currentAudioButton?.classList.remove('is-playing');
  currentAudioButton = null;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.currentTime = 0;
  audio.removeAttribute('src');
  audio.load();
}

async function getAudioHttpStatus(audioUrl) {
  try {
    const response = await fetch(audioUrl, { method: 'HEAD', cache: 'no-store' });
    return response.status;
  } catch (error) {
    console.error(`Unable to verify German audio URL: ${audioUrl}`, error);
    return null;
  }
}

function fallbackToBrowserVoice(text, button, error) {
  const spokenFallback = normalizeText(text);
  if (!spokenFallback || /^(\/|https?:\/\/)/i.test(spokenFallback)) {
    button?.classList.remove('is-playing');
    console.error('CDN audio failed and no text is available for browser speech synthesis.', error);
    return;
  }

  console.warn('[Audio Fallback] Using Web Speech API because CDN failed:', error);
  speakGerman(spokenFallback, button);
}

function playAudioFile(audioUrl, fallbackText, button, playbackId) {
  if (typeof Audio === 'undefined') {
    button?.classList.remove('is-playing');
    console.error('Unable to play German audio because the Audio API is not supported.');
    return;
  }

  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.src = audioUrl;
  currentAudio = audio;
  currentAudioButton = button;
  let failureCheckStarted = false;

  const handleAudioFailure = (initialError) => {
    if (playbackId !== activePlaybackId || currentAudio !== audio) return;

    if (initialError?.name === 'NotAllowedError') {
      button?.classList.remove('is-playing');
      currentAudio = null;
      currentAudioButton = null;
      fallbackToBrowserVoice(fallbackText, button, initialError);
      return;
    }

    if (failureCheckStarted) return;
    failureCheckStarted = true;
    button?.classList.remove('is-playing');
    getAudioHttpStatus(audioUrl).then((status) => {
      if (playbackId !== activePlaybackId || currentAudio !== audio) return;
      currentAudio = null;
      currentAudioButton = null;

      if (status === 404) {
        fallbackToBrowserVoice(fallbackText, button, initialError);
      } else {
        console.error(`Unable to play German audio (HTTP status ${status ?? 'unknown'}).`, initialError);
      }
    });
  };

  button?.classList.add('is-playing');
  audio.onended = () => {
    button?.classList.remove('is-playing');
    if (currentAudio === audio) currentAudio = null;
    if (currentAudioButton === button) currentAudioButton = null;
  };
  audio.onerror = () => handleAudioFailure(audio.error);

  try {
    audio.play()?.catch(handleAudioFailure);
  } catch (error) {
    handleAudioFailure(error);
  }
}

export function playAudioTTS(text, button, fallbackText = text) {
  const spokenText = normalizeText(text);
  const spokenFallback = normalizeText(fallbackText) || spokenText;

  if (typeof window === 'undefined') return;

  const playbackId = ++activePlaybackId;
  stopCurrentAudio();
  window.speechSynthesis?.cancel();

  if (!spokenText) {
    button?.classList.remove('is-playing');
    return;
  }

  let audioUrl;
  let speechText = spokenFallback;
  if (/^(\/|https?:\/\/)/i.test(spokenText)) {
    audioUrl = resolveCdnAudioUrlSync(spokenText);
    if (!audioUrl) {
      button?.classList.remove('is-playing');
      console.error(`German audio source is not a supported CDN URL: ${spokenText}`);
      return;
    }
    speechText = spokenFallback;
  } else {
    audioUrl = getSyncGermanTtsAudioUrl(spokenText);
  }

  if (typeof audioUrl !== 'string') {
    button?.classList.remove('is-playing');
    console.error('Unable to resolve German text to a CDN audio URL.');
    return;
  }

  playAudioFile(audioUrl, speechText, button, playbackId);
}
