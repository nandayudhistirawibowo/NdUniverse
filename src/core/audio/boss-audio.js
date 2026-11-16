import BOSS_AUDIO_MANIFEST from '../../../manifest-boss.json' with { type: 'json' };

const AUDIO_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio';

let activeAudio = null;
let activeAudioStop = null;
const warnedMissingTexts = new Set();

function playAudioWhenReady(audioUrl, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted || typeof Audio === 'undefined') {
      resolve(null);
      return;
    }

    let settled = false;
    let startupTimeout;
    let playbackStarted = false;
    let metadataReady = false;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    activeAudio = audio;

    const cleanup = () => {
      window.clearTimeout(startupTimeout);
      audio.removeEventListener('loadedmetadata', handleReady);
      audio.removeEventListener('canplay', handleReady);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      signal?.removeEventListener('abort', stopAudio);
      if (activeAudio === audio) {
        activeAudio = null;
        activeAudioStop = null;
      }
    };

    const settle = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(startupTimeout);
      resolve(result);
    };

    const stopAudio = () => {
      audio.pause();
      cleanup();
      audio.removeAttribute('src');
      audio.load();
      settle(null);
    };

    activeAudioStop = stopAudio;
    const failAudio = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      reject(error);
    };
    const handleReady = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      metadataReady = true;
      if (playbackStarted) settle(audio);
    };
    const handleEnded = () => {
      if (!settled) {
        failAudio(new Error('Boss audio ended before metadata was ready.'));
        return;
      }
      cleanup();
    };
    const handleError = () => {
      const error = new Error('Boss audio could not be loaded.');
      if (!settled) {
        failAudio(error);
        return;
      }

      console.warn('Boss audio failed during playback.', audio.error);
      cleanup();
    };

    audio.addEventListener('loadedmetadata', handleReady);
    audio.addEventListener('canplay', handleReady);
    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleError, { once: true });
    signal?.addEventListener('abort', stopAudio, { once: true });
    startupTimeout = window.setTimeout(
      () => failAudio(new Error('Boss audio did not load valid metadata within 5 seconds.')),
      5000,
    );

    try {
      audio.src = audioUrl;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          playbackStarted = true;
          if (metadataReady) settle(audio);
        }, failAudio);
      } else {
        playbackStarted = true;
        if (metadataReady) settle(audio);
      }
    } catch (error) {
      failAudio(error);
    }
  });
}

export function playBossAudio(text, language, signal) {
  const spokenText = String(text ?? '').trim();
  if (!spokenText || (language !== 'en' && language !== 'de') || typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (signal?.aborted) return Promise.resolve(null);

  const audioUrl = BOSS_AUDIO_MANIFEST?.[spokenText];
  const languagePath = `${AUDIO_CDN_BASE}/boss/${language}/`;
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith(languagePath)) {
    if (!warnedMissingTexts.has(spokenText)) {
      warnedMissingTexts.add(spokenText);
      console.warn(`No generated ${language.toUpperCase()} boss audio for this line; using the default typewriter speed.`);
    }
    return Promise.resolve(null);
  }

  activeAudioStop?.();
  return playAudioWhenReady(audioUrl, signal);
}
