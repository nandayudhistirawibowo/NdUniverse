let manifestPromise;
let currentAudio = null;

function getManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('/audio/tts/manifest.json')
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
        console.error('Unable to load the TTS audio manifest.', error);
        manifestPromise = undefined;
        return null;
      });
  }

  return manifestPromise;
}

if (typeof window !== 'undefined') getManifest();

function speakEnglish(text, button) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    console.error('Neither generated TTS audio nor browser speech synthesis is available.');
    button?.classList.remove('is-playing');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.onend = () => button?.classList.remove('is-playing');
  utterance.onerror = (event) => {
    button?.classList.remove('is-playing');
    console.error('Unable to speak English text with browser speech synthesis.', event.error);
  };
  button?.classList.add('is-playing');
  window.speechSynthesis.speak(utterance);
}

export function normalizeText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export async function playAudioTTS(text, button, fallbackText = text) {
  const spokenText = normalizeText(text);
  const spokenFallback = normalizeText(fallbackText) || spokenText;

  if (!spokenText) {
    button?.classList.remove('is-playing');
    return;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio.load();
    currentAudio = null;
  }

  if (/^(\/|https?:\/\/)/i.test(spokenText)) {
    if (typeof Audio === 'undefined') {
      speakEnglish(spokenFallback, button);
      return;
    }
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
      speakEnglish(spokenFallback, button);
    };
    try {
      await directAudio.play();
    } catch (error) {
      console.error(`Unable to play direct TTS audio: ${spokenText}`, error);
      button?.classList.remove('is-playing');
      if (currentAudio === directAudio) currentAudio = null;
      speakEnglish(spokenFallback, button);
    }
    return;
  }

  const manifest = await getManifest();
  const audioPath = manifest?.[spokenText];

  if (typeof audioPath !== 'string' || !audioPath.startsWith('/audio/tts/')) {
    speakEnglish(spokenText, button);
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
    speakEnglish(spokenText, button);
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
