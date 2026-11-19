const audioByUrl = new Map();
const activePlayAttempts = new WeakSet();

function getAudio(src) {
  if (typeof Audio === 'undefined' || typeof src !== 'string' || !src) return null;

  let audio = audioByUrl.get(src);
  if (!audio) {
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.onerror = () => {
      if (!activePlayAttempts.has(audio)) {
        console.error('[Audio Load Error] File gagal dimuat/404:', src);
      }
    };
    audio.src = src;
    audioByUrl.set(src, audio);
  }

  return audio;
}

export function preloadAudio(src) {
  return getAudio(src);
}

function fallbackToBrowserSpeech(options, error) {
  const text = typeof options.text === 'string' ? options.text.trim() : '';
  if (!text || typeof window === 'undefined' || !window.speechSynthesis
    || typeof SpeechSynthesisUtterance === 'undefined') {
    return null;
  }

  console.warn('[Audio Fallback] Using Web Speech API because audio playback failed:', error);
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang === 'de' ? 'de-DE' : 'en-US';
    utterance.onend = () => options.button?.classList.remove('is-playing');
    utterance.onerror = (speechError) => {
      options.button?.classList.remove('is-playing');
      console.error('[Audio Fallback] Browser speech synthesis returned an error:', speechError.error);
    };
    options.button?.classList.add('is-playing');
    window.speechSynthesis.speak(utterance);
    options.onFallback?.();
    return Promise.resolve(false);
  } catch (speechError) {
    options.button?.classList.remove('is-playing');
    console.error('[Audio Fallback] Browser speech synthesis failed:', speechError);
    return null;
  }
}

export function playAudio(src, options = {}) {
  const audio = getAudio(src);
  if (!audio) {
    const fallback = fallbackToBrowserSpeech(
      options,
      new Error('The browser Audio API is not available.'),
    );
    if (!fallback) {
      console.error('[Audio Error] Audio playback and browser speech synthesis are unavailable:', src);
    }
    return fallback;
  }

  if (options.volume !== undefined) audio.volume = options.volume;
  audio.currentTime = 0;

  let retryAttempted = false;
  const reportFailure = (error) => {
    activePlayAttempts.delete(audio);
    console.error('[Audio Error] Gagal memutar:', src, error?.name, error?.message);
    return fallbackToBrowserSpeech(options, error) ?? Promise.reject(error);
  };
  const retryOrReport = (error) => {
    const hasTextFallback = typeof options.text === 'string' && options.text.trim();
    if (error?.name === 'NotSupportedError' && !retryAttempted && !hasTextFallback) {
      retryAttempted = true;
      try {
        audio.load();
        audio.currentTime = 0;
        return startPlayback();
      } catch (retryError) {
        return reportFailure(retryError);
      }
    }

    return reportFailure(error);
  };
  const startPlayback = () => {
    try {
      return Promise.resolve(audio.play()).then(
        () => activePlayAttempts.delete(audio),
        retryOrReport,
      );
    } catch (error) {
      return retryOrReport(error);
    }
  };

  activePlayAttempts.add(audio);
  return startPlayback();
}
