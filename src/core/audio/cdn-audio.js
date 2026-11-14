const AUDIO_REPO_BASE =
  'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main/audio';
const CDN_MANIFEST_URL =
  'https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/NdUniverse@main/manifest-cdn.json';

let cdnManifestPromise;

function getCdnManifest() {
  if (!cdnManifestPromise) {
    cdnManifestPromise = fetch(CDN_MANIFEST_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`CDN audio manifest request failed: ${response.status}`);
        }

        return response.json();
      })
      .then((manifest) => {
        if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
          throw new Error('CDN audio manifest must be a path-to-URL mapping.');
        }

        return manifest;
      })
      .catch((error) => {
        console.error('Unable to load the CDN audio manifest.', error);
        cdnManifestPromise = undefined;
        return null;
      });
  }

  return cdnManifestPromise;
}

export function preloadCdnAudioManifest() {
  if (typeof window !== 'undefined') getCdnManifest();
}

function getAudioKey(audioPath) {
  const cdnPrefix = `${AUDIO_REPO_BASE}/`;
  let encodedKey;

  if (audioPath.startsWith('/audio/')) {
    encodedKey = audioPath.slice('/audio/'.length);
  } else if (audioPath.startsWith(cdnPrefix)) {
    encodedKey = audioPath.slice(cdnPrefix.length);
  } else {
    return null;
  }

  try {
    const key = decodeURIComponent(encodedKey);
    return key.split('/').includes('..') ? null : key;
  } catch (error) {
    console.error('Invalid encoded audio path in the TTS manifest.', error);
    return null;
  }
}

export async function resolveCdnAudioUrl(audioPath) {
  if (typeof audioPath !== 'string') return null;

  const audioKey = getAudioKey(audioPath);
  if (!audioKey) return null;

  const manifest = await getCdnManifest();
  const indexedUrl = manifest?.[audioKey];
  if (typeof indexedUrl === 'string' && indexedUrl.startsWith(`${AUDIO_REPO_BASE}/`)) {
    return indexedUrl;
  }

  return `${AUDIO_REPO_BASE}/${audioKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

export async function resolveEnglishTtsAudioUrl(text, accent = 'us') {
  const spokenText = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!spokenText || typeof window === 'undefined' || !globalThis.crypto?.subtle) return null;

  const locale = accent === 'uk' ? 'gb' : 'us';
  try {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(spokenText),
    );
    const textHash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const audioKey = `tts-en-${locale}/${textHash}-${locale}.mp3`;
    const manifest = await getCdnManifest();
    const indexedUrl = manifest?.[audioKey];

    return typeof indexedUrl === 'string' && indexedUrl.startsWith(`${AUDIO_REPO_BASE}/`)
      ? indexedUrl
      : null;
  } catch (error) {
    console.error('Unable to resolve hashed English TTS audio.', error);
    return null;
  }
}
