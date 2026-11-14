import {
  preloadCdnAudioManifest,
  resolveCdnAudioUrl,
  resolveEnglishTtsAudioUrl,
} from '../../../core/audio/cdn-audio.js';

let currentAudio = null;

if (typeof window !== 'undefined') {
  preloadCdnAudioManifest();
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
    if (language === 'en-GB') {
      showUkSpeechError(button, event.error);
    } else {
      button?.classList.remove('is-playing');
    }
    if (language !== 'en-GB' && event.error !== 'interrupted' && event.error !== 'canceled') {
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

async function playAudioFile(audioUrl, fallbackText, language, button) {
  if (typeof Audio === 'undefined') {
    speakWithBrowserVoice(fallbackText, language, button);
    return;
  }

  const audio = new Audio(audioUrl);
  currentAudio = audio;
  let failurePromise = null;
  const handleAudioFailure = (error) => {
    if (!failurePromise) {
      button?.classList.remove('is-playing');
      failurePromise = (async () => {
        const status = await getAudioHttpStatus(audioUrl);
        if (currentAudio !== audio) return;
        currentAudio = null;

        if (status === 404) {
          speakWithBrowserVoice(fallbackText, language, button);
        } else if (error?.name === 'NotAllowedError') {
          console.warn('Browser blocked English audio playback; retry from a user action.', error);
        } else {
          console.error(`Unable to play English audio (HTTP status ${status ?? 'unknown'}).`, error);
        }
      })();
    }
    return failurePromise;
  };

  button?.classList.add('is-playing');
  audio.onended = () => {
    button?.classList.remove('is-playing');
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onerror = () => {
    void handleAudioFailure(audio.error);
  };

  try {
    await audio.play();
  } catch (error) {
    await handleAudioFailure(error);
  }
}

/**
 * @param {string} text
 * @param {'us' | 'uk'} [accent='us']
 * @param {HTMLButtonElement | null} [button=null]
 * @param {string} [fallbackText=text]
 */
export async function playAudioTTS(text, accent = 'us', button = null, fallbackText = text) {
  const spokenText = normalizeText(text);
  const spokenFallback = normalizeText(fallbackText) || spokenText;
  const language = accent === 'uk' ? 'en-GB' : 'en-US';

  if (!spokenText) {
    button?.classList.remove('is-playing');
    return;
  }

  if (typeof window === 'undefined') return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio.load();
    currentAudio = null;
  }

  if (/^(\/|https?:\/\/)/i.test(spokenText)) {
    const directAudioPath = await resolveCdnAudioUrl(spokenText) || spokenText;
    await playAudioFile(directAudioPath, spokenFallback, language, button);
    return;
  }

  const cdnAudioPath = await resolveEnglishTtsAudioUrl(spokenText, accent);

  if (!cdnAudioPath) {
    speakWithBrowserVoice(spokenText, language, button);
    return;
  }

  await playAudioFile(cdnAudioPath, spokenText, language, button);
}
