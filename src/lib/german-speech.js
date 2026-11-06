function speakWithVoices(text, onerror, voices) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';

  const germanVoice = voices.find((voice) => voice.lang.toLowerCase().includes('de'));
  if (germanVoice) utterance.voice = germanVoice;
  if (onerror) utterance.onerror = onerror;

  window.speechSynthesis.speak(utterance);
}

export function speakGerman(text, onerror) {
  const synthesis = window.speechSynthesis;
  const voices = synthesis.getVoices();

  if (voices.length > 0) {
    speakWithVoices(text, onerror, voices);
    return;
  }

  synthesis.addEventListener('voiceschanged', () => {
    speakWithVoices(text, onerror, synthesis.getVoices());
  }, { once: true });
}
