import { preloadCdnAudioManifest, resolveCdnAudioUrl } from '../../../core/audio/cdn-audio.js';

const manifestPromises = new Map();
let currentAudio = null;

function getManifest(accent) {
  const manifestUrl = accent === 'exam-uk'
    ? 'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio/tts-en-gb/manifest-en-gb.json'
    : 'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio/tts-en-us/manifest-en-us.json';
  if (!manifestPromises.has(accent)) {
    manifestPromises.set(accent, fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`TTS manifest request failed: ${response.status}`);
        }

        return response.json();
      })
      .then((manifest) => {
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
          throw new Error('TTS manifest must be a text-to-audio mapping.');
        }

        return manifest;
      })
      .catch((error) => {
        console.error(`Unable to load the ${accent} TTS audio manifest.`, error);
        manifestPromises.delete(accent);
        return null;
      }));
  }

  return manifestPromises.get(accent);
}

if (typeof window !== 'undefined') {
  getManifest('us');
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

/**
 * @param {string} text
 * @param {string} [accent='us']
 * @param {HTMLButtonElement | null} [button=null]
 */
export async function playAudioTTS(text, accent = 'us', button = null) {
  const spokenText = normalizeText(text);

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

  if (accent === 'uk') {
    speakWithBrowserVoice(spokenText, 'en-GB', button);
    return;
  }

  if (/^(\/|https?:\/\/)/i.test(spokenText)) {
    const directAudioPath = await resolveCdnAudioUrl(spokenText) || spokenText;
    if (typeof Audio === 'undefined') {
      speakWithBrowserVoice(
        spokenText,
        accent === 'exam-uk' ? 'en-GB' : 'en-US',
        button,
      );
      return;
    }
    const directAudio = new Audio(directAudioPath);
    currentAudio = directAudio;
    button?.classList.add('is-playing');
    directAudio.onended = () => {
      button?.classList.remove('is-playing');
      if (currentAudio === directAudio) currentAudio = null;
    };
    directAudio.onerror = () => {
      button?.classList.remove('is-playing');
      if (currentAudio === directAudio) currentAudio = null;
      speakWithBrowserVoice(
        spokenText,
        accent === 'exam-uk' ? 'en-GB' : 'en-US',
        button,
      );
    };
    try {
      await directAudio.play();
    } catch (error) {
      console.error(`Unable to play direct TTS audio: ${directAudioPath}`, error);
      button?.classList.remove('is-playing');
      if (currentAudio === directAudio) currentAudio = null;
      speakWithBrowserVoice(
        spokenText,
        accent === 'exam-uk' ? 'en-GB' : 'en-US',
        button,
      );
    }
    return;
  }

  const manifestAccent = accent === 'exam-uk' ? 'exam-uk' : 'us';
  const audioDirectory = manifestAccent === 'exam-uk'
    ? 'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio/tts-en-gb/'
    : 'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio/tts-en-us/';
  const manifest = await getManifest(manifestAccent);
  const audioPath = manifest?.[spokenText];
  const cdnAudioPath = await resolveCdnAudioUrl(audioPath);

  if (typeof audioPath !== 'string' || !audioPath.startsWith(audioDirectory) || !cdnAudioPath) {
    speakWithBrowserVoice(
      spokenText,
      manifestAccent === 'exam-uk' ? 'en-GB' : 'en-US',
      button,
    );
    return;
  }

  const audio = new Audio(cdnAudioPath);
  currentAudio = audio;
  let fellBackToSpeech = false;
  const fallBack = () => {
    if (fellBackToSpeech) return;
    fellBackToSpeech = true;
    if (currentAudio === audio) currentAudio = null;
    speakWithBrowserVoice(
      spokenText,
      manifestAccent === 'exam-uk' ? 'en-GB' : 'en-US',
      button,
    );
  };

  button?.classList.add('is-playing');
  audio.onended = () => {
    button?.classList.remove('is-playing');
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onerror = () => {
    console.error(`Unable to play generated TTS audio: ${cdnAudioPath}`, audio.error);
    fallBack();
  };

  try {
    await audio.play();
  } catch (error) {
    console.error(`Unable to play generated TTS audio: ${cdnAudioPath}`, error);
    fallBack();
  }
}
