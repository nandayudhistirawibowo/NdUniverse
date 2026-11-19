import type { APIRoute } from 'astro';
import { BatchClient } from '@speechmatics/batch-client';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const SPEECHMATICS_TIMEOUT_MS = 15_000;
const rateLimits = new Map<string, { startedAt: number; count: number }>();

function jsonResponse(body: Record<string, unknown>, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip: string, now: number): boolean {
  if (rateLimits.size > 10_000) {
    rateLimits.forEach((entry, key) => {
      if (now - entry.startedAt >= RATE_WINDOW_MS) rateLimits.delete(key);
    });
  }

  const current = rateLimits.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateLimits.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  if (current.count >= RATE_LIMIT) return true;
  current.count += 1;
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  const now = Date.now();
  const ip = getClientIp(request);
  if (isRateLimited(ip, now)) {
    return jsonResponse(
      { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
      429,
      { 'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)) },
    );
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data')) {
    return jsonResponse({ error: 'Kirim audio sebagai multipart/form-data.' }, 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Form data audio tidak valid.' }, 400);
  }

  const audio = formData.get('audio');
  if (!(audio instanceof File)) {
    return jsonResponse({ error: 'File audio wajib disertakan.' }, 400);
  }
  if (audio.size === 0) {
    return jsonResponse({ error: 'File audio kosong.' }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonResponse({ error: 'Ukuran audio maksimal 10 MB.' }, 413);
  }

  const mimeType = audio.type.toLowerCase().split(';')[0].trim();
  const extensions: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/wav': 'wav',
  };
  const extension = extensions[mimeType];
  if (!extension) {
    return jsonResponse({ error: 'Format audio harus WebM, MP4, atau WAV.' }, 415);
  }

  const language = formData.get('lang');
  if (language !== 'en' && language !== 'de') {
    return jsonResponse({ error: 'Bahasa harus en atau de.' }, 400);
  }

  const rawTargetText = formData.get('target_text');
  const targetText = typeof rawTargetText === 'string'
    ? rawTargetText.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
    : '';
  const targetTextHint = targetText
    ? `The user is trying to say: "${targetText.replace(/"/g, '\\"')}". `
    : '';
  const groqPrompt = `${targetTextHint}Transcribe the main speaker's voice only. Ignore all background music, singing, crosstalk, and other people talking. Ignore background noise.`;

  const groqApiKey = import.meta.env.GROQ_API_KEY;
  if (groqApiKey) {
    try {
      const groqForm = new FormData();
      groqForm.append('file', audio, `speech.${extension}`);
      groqForm.append('model', 'whisper-large-v3-turbo');
      groqForm.append('language', language);
      groqForm.append('response_format', 'json');
      groqForm.append('temperature', '0');
      groqForm.append('prompt', groqPrompt);

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: groqForm,
        signal: AbortSignal.timeout(SPEECHMATICS_TIMEOUT_MS),
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (isRecord(result) && typeof result.text === 'string' && result.text.trim()) {
          return jsonResponse({
            transcript: result.text,
            ...(typeof result.confidence === 'number' ? { confidence: result.confidence } : {}),
            source: 'groq',
          });
        }
        console.warn('Groq returned an invalid or empty transcription response.');
      } else {
        console.warn(`Groq transcription returned HTTP ${response.status}; trying Speechmatics.`);
      }
    } catch (error) {
      console.warn('Groq transcription failed; trying Speechmatics.', error);
    }
  } else {
    console.warn('GROQ_API_KEY is not configured; trying Speechmatics.');
  }

  const speechmaticsApiKey = import.meta.env.SPEECHMATICS_API_KEY;
  if (speechmaticsApiKey) {
    try {
      const client = new BatchClient({ apiKey: speechmaticsApiKey, appId: 'nduniverse' });
      const result = await client.transcribe(
        audio,
        {
          transcription_config: {
            language,
            model: 'enhanced',
            operating_point: 'enhanced',
          },
        },
        {
          format: 'json-v2',
          signal: AbortSignal.timeout(SPEECHMATICS_TIMEOUT_MS),
        },
      );
      const transcript = result.results
        .map((item) => item.alternatives?.[0]?.content)
        .filter((content): content is string => Boolean(content))
        .join(' ')
        .trim();

      if (transcript) return jsonResponse({ transcript, source: 'speechmatics' });
      console.warn('Speechmatics returned an empty transcript.');
    } catch (error) {
      console.warn('Speechmatics batch transcription failed.', error);
    }
  } else {
    console.warn('SPEECHMATICS_API_KEY is not configured.');
  }

  return jsonResponse({ error: 'ALL_STT_FAILED' }, 502);
};
