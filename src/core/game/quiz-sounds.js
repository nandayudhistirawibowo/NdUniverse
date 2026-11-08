const SOUND_FILES = {
  click: '/sounds/quiz-click.mp3',
  success: '/sounds/quiz-success.mp3',
  error: '/sounds/quiz-error.mp3',
};

export function playSound(name) {
  if (typeof Audio === 'undefined') return;

  const path = SOUND_FILES[name];
  if (!path) return;

  const sound = new Audio(path);
  sound.volume = 0.45;
  sound.play().catch(() => {});
}
