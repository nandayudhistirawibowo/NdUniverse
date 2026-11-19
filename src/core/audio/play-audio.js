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

export function playAudio(src, options = {}) {
  const audio = getAudio(src);
  if (!audio) return null;

  if (options.volume !== undefined) audio.volume = options.volume;
  audio.currentTime = 0;

  let retryAttempted = false;
  const reportFailure = (error) => {
    activePlayAttempts.delete(audio);
    console.error('[Audio Error] Gagal memutar:', src, error.name, error.message);
    return Promise.reject(error);
  };
  const retryOrReport = (error) => {
    if (error?.name === 'NotSupportedError' && !retryAttempted) {
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
