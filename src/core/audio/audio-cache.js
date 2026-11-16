const audioByUrl = new Map();

export function preloadAudioUrl(url) {
  if (typeof Audio === 'undefined' || typeof url !== 'string' || !url) return null;

  let audio = audioByUrl.get(url);
  if (!audio) {
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.src = url;
    audioByUrl.set(url, audio);
  }

  return audio;
}
