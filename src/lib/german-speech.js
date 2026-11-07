let manifestPromise;

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
        return null;
      });
  }

  return manifestPromise;
}

if (typeof window !== 'undefined') getManifest();

function speakGerman(text, button) {
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

export async function playAudioTTS(text, button) {
  const manifest = await getManifest();
  const audioPath = manifest?.[text];

  if (typeof audioPath !== 'string' || !audioPath.startsWith('/audio/tts/')) {
    speakGerman(text, button);
    return;
  }

  const audio = new Audio(audioPath);
  let fellBackToSpeech = false;
  const fallBack = () => {
    if (fellBackToSpeech) return;
    fellBackToSpeech = true;
    button?.classList.remove('is-playing');
    speakGerman(text, button);
  };

  button?.classList.add('is-playing');
  audio.onended = () => button?.classList.remove('is-playing');
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
