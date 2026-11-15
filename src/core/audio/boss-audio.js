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
  return new Promise((resolve) => {
    if (signal?.aborted || typeof Audio === 'undefined') {
      resolve(null);
      return;
    }

    let settled = false;
    let startupTimeout;
    let resolveCompletion;
    const completion = new Promise((done) => {
      resolveCompletion = done;
    });
    const audio = new Audio(audioUrl);
    audioCompletions.set(audio, completion);
    activeAudio = audio;

    const cleanup = () => {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
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
      audio.removeAttribute('src');
      audio.load();
      cleanup();
      settle(null);
    };

    activeAudioStop = stopAudio;
    audio.onplay = () => settle(audio);
    audio.onended = cleanup;
    audio.onerror = () => {
      console.warn('Boss audio could not be loaded; using the default typewriter speed.', audio.error);
      cleanup();
      settle(null);
    };
    signal?.addEventListener('abort', stopAudio, { once: true });
    startupTimeout = window.setTimeout(() => {
      if (settled) return;
      console.warn('Boss audio did not start in time; using the default typewriter speed.');
      stopAudio();
    }, 10000);

    try {
      audio.play()?.catch((error) => {
        console.warn('Boss audio playback failed; using the default typewriter speed.', error);
        cleanup();
        settle(null);
      });
    } catch (error) {
      console.warn('Boss audio playback failed; using the default typewriter speed.', error);
      cleanup();
      settle(null);
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
