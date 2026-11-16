const AUDIO_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio';
const MANIFEST_URL = '/manifest-boss.json';

let manifestPromise;
let playbackQueue = Promise.resolve();
let activeAudio = null;
let activeAudioStop = null;
const audioCompletions = new WeakMap();
const warnedMissingTexts = new Set();

function getManifest() {
  if (!manifestPromise) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    manifestPromise = fetch(MANIFEST_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Boss audio manifest request failed: ${response.status}`);
        }

        return response.json();
      })
      .then((manifest) => {
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
          throw new Error('Boss audio manifest must be a text-to-audio mapping.');
        }

        return manifest;
      })
      .catch((error) => {
        console.warn('Boss audio manifest is unavailable; using the default typewriter speed.', error);
        return null;
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
  }

  return manifestPromise;
}

function playAudioWhenReady(audioUrl, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted || typeof Audio === 'undefined') {
      resolve(null);
      return;
    }

    let settled = false;
    let startupTimeout;
    let resolveCompletion;
    let playRequested = false;
    let playbackReady = false;
    const completion = new Promise((done) => {
      resolveCompletion = done;
    });
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audioCompletions.set(audio, completion);
    activeAudio = audio;

    const cleanup = () => {
      window.clearTimeout(startupTimeout);
      audio.removeEventListener('loadedmetadata', handleReady);
      audio.removeEventListener('canplay', handleReady);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      signal?.removeEventListener('abort', stopAudio);
      resolveCompletion();
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
      if (playbackReady) {
        settle(audio);
        return;
      }
      if (!playRequested) {
        playRequested = true;
        try {
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
              playbackReady = true;
              if (Number.isFinite(audio.duration) && audio.duration > 0) {
                settle(audio);
              }
            }, failAudio);
          } else {
            playbackReady = true;
            settle(audio);
          }
        } catch (error) {
          failAudio(error);
          return;
        }
      }
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
      audio.load();
    } catch (error) {
      failAudio(error);
    }
  });
}

export async function playBossAudio(text, language, signal) {
  const spokenText = String(text ?? '').trim();
  if (!spokenText || (language !== 'en' && language !== 'de') || typeof window === 'undefined') {
    return null;
  }

  const manifest = await getManifest();
  if (signal?.aborted) return null;
  if (!manifest) return null;

  const audioUrl = manifest?.[spokenText];
  const languagePath = `${AUDIO_CDN_BASE}/boss/${language}/`;
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith(languagePath)) {
    if (!warnedMissingTexts.has(spokenText)) {
      warnedMissingTexts.add(spokenText);
      console.warn(`No generated ${language.toUpperCase()} boss audio for this line; using the default typewriter speed.`);
    }
    return null;
  }

  const queuedPlayback = playbackQueue
    .catch(() => undefined)
    .then(() => {
      if (signal?.aborted) return null;
      activeAudioStop?.();
      return playAudioWhenReady(audioUrl, signal);
    });

  playbackQueue = queuedPlayback.then((audio) => (
    audio ? audioCompletions.get(audio) : undefined
  ));

  return queuedPlayback;
}
