import {
  getSyncAudioUrl,
  preloadCdnAudioManifest,
  resolveCdnAudioUrlSync,
} from '../../../core/audio/cdn-audio.js';

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
  audio.onerror = null;
  audio.pause();
  audio.currentTime = 0;
  audio.removeAttribute('src');
  audio.load();
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
    speakWithBrowserVoice(fallbackText, language, button);
    return;
  }

  const audio = new Audio(audioUrl);
  activeAudio = audio;
  activeAudioButton = button;
  let failureCheckStarted = false;
  const handleAudioFailure = (initialError) => {
    if (playbackId !== activePlaybackId || activeAudio !== audio) return;

    if (initialError?.name === 'NotAllowedError') {
      button?.classList.remove('is-playing');
      activeAudio = null;
      activeAudioButton = null;
      console.warn('Browser blocked English audio playback; tap the audio button again.', initialError);
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
        speakWithBrowserVoice(fallbackText, language, button);
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
  audio.onerror = () => {
    void handleAudioFailure(audio.error);
  };

  try {
    audio.load();
    const playPromise = audio.play();
    playPromise?.catch(handleAudioFailure);
  } catch (error) {
    handleAudioFailure(error);
  }
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
    const directAudioPath = resolveCdnAudioUrlSync(spokenText) || spokenText;
    playAudioFile(directAudioPath, spokenFallback, language, button, playbackId);
    return;
  }

  const cdnAudioPath = getSyncAudioUrl(spokenText, accent);

  if (!cdnAudioPath) {
    speakWithBrowserVoice(spokenText, language, button);
    return;
  }

  playAudioFile(cdnAudioPath, spokenText, language, button, playbackId);
}
