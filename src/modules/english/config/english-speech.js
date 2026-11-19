import {
  getSyncAudioUrl,
  preloadCdnAudioManifest,
  resolveCdnAudioUrlSync,
} from '../../../core/audio/cdn-audio.js';
import { playAudio, preloadAudio } from '../../../core/audio/play-audio.js';

let activeAudio = null;
let activeAudioButton = null;
let activePlaybackId = 0;

if (typeof window !== 'undefined') {
  preloadCdnAudioManifest();
}

function stopActiveAudio() {
  if (!activeAudio) return;

  const audio = activeAudio;
  activeAudio = null;
  activeAudioButton?.classList.remove('is-playing');
  activeAudioButton = null;
  audio.onended = null;
  audio.pause();
  audio.currentTime = 0;
}

function showUkSpeechError(button, error) {
  button?.classList.remove('is-playing');
  console.error('Unable to speak English text with UK browser speech synthesis.', error);
  window.alert('This browser does not support a UK voice.');
}

function speakWithBrowserVoice(text, language, button) {
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    if (language === 'en-GB') {
      showUkSpeechError(button, new Error('Speech synthesis is not supported.'));
    } else {
      button?.classList.remove('is-playing');
      console.error('Unable to play static English audio or use browser speech synthesis.');
    }
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = 1;
  utterance.onend = () => button?.classList.remove('is-playing');
  utterance.onerror = (event) => {
    button?.classList.remove('is-playing');
    if (event.error === 'interrupted' || event.error === 'canceled') return;

    if (language === 'en-GB') {
      showUkSpeechError(button, event.error);
    }
    if (language !== 'en-GB') {
      console.error('Unable to speak English text with US browser speech synthesis.', event.error);
    }
  };
  button?.classList.add('is-playing');

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    if (language === 'en-GB') {
      showUkSpeechError(button, error);
    } else {
      button?.classList.remove('is-playing');
      console.error('Unable to start US browser speech synthesis.', error);
    }
  }
}

function fallbackToBrowserVoice(text, language, button, error) {
  const spokenFallback = normalizeText(text);
  if (!spokenFallback || /^(\/|https?:\/\/)/i.test(spokenFallback)) {
    button?.classList.remove('is-playing');
    console.error('CDN audio failed and no text is available for browser speech synthesis.', error);
    return;
  }

  console.warn('[Audio Fallback] Using Web Speech API because CDN failed:', error);
  speakWithBrowserVoice(spokenFallback, language, button);
}

export function normalizeText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

async function getAudioHttpStatus(audioUrl) {
  try {
    const response = await fetch(audioUrl, { method: 'HEAD', cache: 'no-store' });
    return response.status;
  } catch (error) {
    console.error(`Unable to verify English audio URL: ${audioUrl}`, error);
    return null;
  }
}

function playAudioFile(audioUrl, fallbackText, language, button, playbackId) {
  if (playbackId !== activePlaybackId) return;

  if (typeof Audio === 'undefined') {
    button?.classList.remove('is-playing');
    console.error('Unable to play English audio because the Audio API is not supported.');
    return;
  }

  const audio = preloadAudio(audioUrl);
  if (!audio) {
    button?.classList.remove('is-playing');
    console.error('Unable to prepare English audio because the Audio API is not supported.');
    return;
  }
  activeAudio = audio;
  activeAudioButton = button;
  let failureCheckStarted = false;
  const handleAudioFailure = (initialError) => {
    if (playbackId !== activePlaybackId || activeAudio !== audio) return;

    if (initialError?.name === 'NotAllowedError') {
      button?.classList.remove('is-playing');
      activeAudio = null;
      activeAudioButton = null;
      fallbackToBrowserVoice(fallbackText, language, button, initialError);
      return;
    }

    if (failureCheckStarted) return;
    failureCheckStarted = true;
    button?.classList.remove('is-playing');
    getAudioHttpStatus(audioUrl).then((status) => {
      if (playbackId !== activePlaybackId || activeAudio !== audio) return;
      activeAudio = null;
      activeAudioButton = null;

      if (status === 404) {
        fallbackToBrowserVoice(fallbackText, language, button, initialError);
      } else {
        console.error(`Unable to play English audio (HTTP status ${status ?? 'unknown'}).`, initialError);
      }
    });
  };

  button?.classList.add('is-playing');
  audio.onended = () => {
    button?.classList.remove('is-playing');
    if (activeAudio === audio) {
      activeAudio = null;
      activeAudioButton = null;
    }
  };
  audio.addEventListener('error', () => {
    void handleAudioFailure(audio.error);
  }, { once: true });

  playAudio(audioUrl)?.catch(handleAudioFailure);
}

export function preloadEnglishTtsAudio(text, accent = 'us') {
  const spokenText = normalizeText(text);
  if (!spokenText) return null;

  const audioUrl = /^(\/|https?:\/\/)/i.test(spokenText)
    ? resolveCdnAudioUrlSync(spokenText)
    : getSyncAudioUrl(spokenText, accent);
  return audioUrl ? preloadAudio(audioUrl) : null;
}

/**
 * @param {string} text
 * @param {'us' | 'uk'} [accent='us']
 * @param {HTMLButtonElement | null} [button=null]
 * @param {string} [fallbackText=text]
 */
export function playAudioTTS(text, accent = 'us', button = null, fallbackText = text) {
  const spokenText = normalizeText(text);
  const spokenFallback = normalizeText(fallbackText) || spokenText;
  const language = accent === 'uk' ? 'en-GB' : 'en-US';

  if (typeof window === 'undefined') return;

  const playbackId = ++activePlaybackId;
  stopActiveAudio();
  window.speechSynthesis?.cancel();

  if (!spokenText) {
    button?.classList.remove('is-playing');
    return;
  }

  if (/^(\/|https?:\/\/)/i.test(spokenText)) {
    const directAudioPath = resolveCdnAudioUrlSync(spokenText);
    if (!directAudioPath) {
      button?.classList.remove('is-playing');
      console.error(`English audio source is not a supported CDN URL: ${spokenText}`);
      return;
    }
    playAudioFile(directAudioPath, spokenFallback, language, button, playbackId);
    return;
  }

  const cdnAudioPath = getSyncAudioUrl(spokenText, accent);

  if (!cdnAudioPath) {
    button?.classList.remove('is-playing');
    console.error('Unable to resolve English text to a CDN audio URL.');
    return;
  }

  playAudioFile(cdnAudioPath, spokenText, language, button, playbackId);
}
