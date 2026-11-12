const manifestPromises = new Map();
let currentAudio = null;

function getManifest(accent) {
  const manifestUrl = accent === 'exam-uk'
    ? '/audio/tts-en-gb/manifest-en-gb.json'
    : '/audio/tts-en-us/manifest-en-us.json';
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

if (typeof window !== 'undefined') getManifest();

function showUkSpeechError(button, error) {
  button?.classList.remove('is-playing');
  console.error('Unable to speak English text with UK browser speech synthesis.', error);
  window.alert('Browser Anda belum mendukung aksen UK.');
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
    try {
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        showUkSpeechError(button, new Error('Speech synthesis is not supported.'));
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.lang = 'en-GB';
      utterance.rate = 1;
      utterance.onend = () => button?.classList.remove('is-playing');
      utterance.onerror = (event) => showUkSpeechError(button, event.error);
      button?.classList.add('is-playing');
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      showUkSpeechError(button, error);
    }
    return;
  }

  if (/^(\/|https?:\/\/)/i.test(spokenText)) {
    if (typeof Audio === 'undefined') return;
    const directAudio = new Audio(spokenText);
    currentAudio = directAudio;
    button?.classList.add('is-playing');
    directAudio.onended = () => {
      button?.classList.remove('is-playing');
      if (currentAudio === directAudio) currentAudio = null;
    };
    directAudio.onerror = () => {
      button?.classList.remove('is-playing');
      if (currentAudio === directAudio) currentAudio = null;
    };
    try {
      await directAudio.play();
    } catch (error) {
      console.error(`Unable to play direct TTS audio: ${spokenText}`, error);
      button?.classList.remove('is-playing');
      if (currentAudio === directAudio) currentAudio = null;
    }
    return;
  }

  const manifestAccent = accent === 'exam-uk' ? 'exam-uk' : 'us';
  const audioDirectory = manifestAccent === 'exam-uk' ? '/audio/tts-en-gb/' : '/audio/tts-en-us/';
  const manifest = await getManifest(manifestAccent);
  const audioPath = manifest?.[spokenText];

  if (typeof audioPath !== 'string' || !audioPath.startsWith(audioDirectory)) {
    console.error(`No static ${manifestAccent} TTS audio found for: ${spokenText}`);
    button?.classList.remove('is-playing');
    return;
  }

  const audio = new Audio(audioPath);
  currentAudio = audio;
  let fellBackToSpeech = false;
  const fallBack = () => {
    if (fellBackToSpeech) return;
    fellBackToSpeech = true;
    if (currentAudio === audio) currentAudio = null;
    button?.classList.remove('is-playing');
  };

  button?.classList.add('is-playing');
  audio.onended = () => {
    button?.classList.remove('is-playing');
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onerror = () => {
    console.error(`Unable to play generated TTS audio: ${audioPath}`, audio.error);
    fallBack();
  };

  try {
    await audio.play();
  } catch (error) {
    console.error(`Unable to play generated TTS audio: ${audioPath}`, error);
    fallBack();
  }
}
