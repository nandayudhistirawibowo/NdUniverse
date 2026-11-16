import { preloadAudioUrl } from '../audio/audio-cache.js';

const SOUND_FILES = {
  click: '/sounds/quiz-click.mp3',
  success: '/sounds/quiz-success.mp3',
  error: '/sounds/quiz-error.mp3',
};

const sounds = new Map();

if (typeof window !== 'undefined') {
  Object.entries(SOUND_FILES).forEach(([name, path]) => {
    const sound = preloadAudioUrl(path);
    if (sound) {
      sound.volume = 0.45;
      sounds.set(name, sound);
    }
  });
}

export function playSound(name) {
  const sound = sounds.get(name);
  if (!sound) return;

  sound.currentTime = 0;
  sound.play()?.catch((error) => {
    console.error(`Unable to play the ${name} quiz sound.`, error);
  });
}
