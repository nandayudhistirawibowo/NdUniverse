const audioByUrl = new Map();

function getAudio(src) {
  if (typeof Audio === 'undefined' || typeof src !== 'string' || !src) return null;

  let audio = audioByUrl.get(src);
  if (!audio) {
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.onerror = () => console.error('[Audio Load Error] File gagal dimuat/404:', src);
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

  const playPromise = audio.play();
  playPromise?.catch((error) => {
    console.error('[Audio Error] Gagal memutar:', src, error.name, error.message);
  });

  return playPromise ?? null;
}
