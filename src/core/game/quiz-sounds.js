import { playAudio, preloadAudio } from '../audio/play-audio.js';

const AUDIO_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/NdUniverse@main/public/sounds';
const SOUND_FILES = {
  click: `${AUDIO_CDN_BASE}/quiz-click.mp3`,
  success: `${AUDIO_CDN_BASE}/quiz-success.mp3`,
  error: `${AUDIO_CDN_BASE}/quiz-error.mp3`,
};

if (typeof window !== 'undefined') {
  Object.values(SOUND_FILES).forEach(preloadAudio);
}

export function playSound(name) {
  const src = SOUND_FILES[name];
  if (src) void playAudio(src, { volume: 0.45 })?.catch(() => {});
}
