import BOSS_AUDIO_MANIFEST from '../../../manifest-boss.json' with { type: 'json' };
import { playAudio, preloadAudio } from './play-audio.js';

const AUDIO_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio';

let activeAudio = null;
let activeAudioStop = null;
const warnedMissingTexts = new Set();

export function preloadBossAudio(text, language) {
  const spokenText = String(text ?? '').trim();
  if (!spokenText || (language !== 'en' && language !== 'de')) return null;

  const audioUrl = BOSS_AUDIO_MANIFEST?.[spokenText];
  const languagePath = `${AUDIO_CDN_BASE}/boss/${language}/`;
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith(languagePath)) return null;

  return preloadAudio(audioUrl);
}

export function playBossAudio(text, language, signal) {
  const spokenText = String(text ?? '').trim();
  if (!spokenText || (language !== 'en' && language !== 'de') || typeof window === 'undefined') {
    return null;
  }
  if (signal?.aborted) return null;

  window.speechSynthesis?.cancel();
  const audioUrl = BOSS_AUDIO_MANIFEST?.[spokenText];
  const languagePath = `${AUDIO_CDN_BASE}/boss/${language}/`;
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith(languagePath)) {
    if (!warnedMissingTexts.has(spokenText)) {
      warnedMissingTexts.add(spokenText);
      console.warn(`No generated ${language.toUpperCase()} boss audio for this line; using browser speech synthesis.`);
    }
    playAudio('', {
      text: spokenText,
      lang: language,
      onFallback: () => {
        signal?.addEventListener(
          'abort',
          () => window.speechSynthesis?.cancel(),
          { once: true },
        );
      },
    })?.catch((error) => {
      console.error(`Unable to speak missing ${language.toUpperCase()} boss audio.`, error);
    });
    return null;
  }

  activeAudioStop?.();
  const audio = preloadAudio(audioUrl);
  if (!audio) return null;

  const cleanup = () => {
    audio.removeEventListener('ended', cleanup);
    audio.removeEventListener('error', cleanup);
    signal?.removeEventListener('abort', stopAudio);
    if (activeAudio === audio) {
      activeAudio = null;
      activeAudioStop = null;
    }
  };
  const stopAudio = () => {
    audio.pause();
    audio.currentTime = 0;
    cleanup();
  };

  activeAudio = audio;
  activeAudioStop = stopAudio;
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('playbackerror', cleanup, { once: true });
  signal?.addEventListener('abort', stopAudio, { once: true });

  playAudio(audioUrl, {
    text: spokenText,
    lang: language,
    onFallback: () => audio.dispatchEvent(new Event('playbackerror')),
  })?.catch(() => {
    audio.dispatchEvent(new Event('playbackerror'));
    cleanup();
  });

  return audio;
}
