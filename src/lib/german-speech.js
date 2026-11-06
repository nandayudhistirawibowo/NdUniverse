const MAX_TTS_TEXT_LENGTH = 200;

export function playAudioTTS(text, button) {
  const limitedText = Array.from(text).slice(0, MAX_TTS_TEXT_LENGTH).join('');
  if (!limitedText.trim()) return;

  const audio = new Audio();
  audio.src = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(limitedText)}&tl=de&client=tw-ob`;

  const clearPlayingState = () => button?.classList.remove('is-playing');
  button?.classList.add('is-playing');
  audio.onended = clearPlayingState;
  audio.onerror = () => {
    clearPlayingState();
    console.error('Unable to load Google Translate TTS audio.', audio.error);
  };

  audio.play().catch((error) => {
    clearPlayingState();
    console.error('Unable to play Google Translate TTS audio.', error);
  });
}
