import { createBrowserClient } from '@supabase/ssr';

let browserClient;
const progressWriteQueues = new Map();

export function getProgressClient() {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  browserClient ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

export function normalizePassedSessions(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(Number).filter((session) => Number.isInteger(session) && session > 0))]
      .sort((left, right) => left - right);
  }

  if (typeof value === 'string') {
    const match = value.match(/^Sesi (\d+) Lulus$/);
    return match ? Array.from({ length: Number(match[1]) }, (_, index) => index + 1) : [];
  }

  return [];
}

export function normalizePassedPillars(value) {
  const pillars = ['reading', 'listening', 'writing', 'speaking'];
  const legacyPillarMap = [null, 'reading', 'listening', 'writing', 'speaking'];

  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
        const match = value.match(/^Sesi\s([1-4])(?:\sLulus)?$/i);
        return match ? Array.from({ length: Number(match[1]) }, (_, index) => index + 1) : [];
      })()
      : [];

  const converted = entries.map((entry) => {
    if (typeof entry === 'string') {
      const normalizedEntry = entry.trim().toLowerCase();
      return pillars.includes(normalizedEntry) ? normalizedEntry : '';
    }
    const legacyIndex = Number(entry);
    return Number.isInteger(legacyIndex) ? legacyPillarMap[legacyIndex] ?? '' : '';
  });
  const normalized = new Set(
    converted.filter((entry) => pillars.includes(entry))
  );
  return pillars.filter((pillar) => normalized.has(pillar));
}

export async function fetchUserProgress(client, userId, materialSlug) {
  const { data, error } = await client
    .from('user_progress')
    .select('id, user_id, material_slug, language_code, xp, sessions_passed, notes')
    .eq('user_id', userId)
    .eq('material_slug', materialSlug)
    .eq('language_code', 'en')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchAllUserProgress(client, userId) {
  const { data, error } = await client
    .from('user_progress')
    .select('id, material_slug, language_code, xp, sessions_passed, notes')
    .eq('user_id', userId)
    .eq('language_code', 'en');

  if (error) throw error;
  return data ?? [];
}

async function writeUserProgress(client, userId, materialSlug, updates) {
  const existing = await fetchUserProgress(client, userId, materialSlug);
  const xpDelta = Number(updates.xpDelta ?? 0);
  const normalizedExistingSessions = normalizePassedPillars(existing?.sessions_passed);
  const existingSessions = Array.isArray(updates.sessions_passed)
    ? normalizePassedPillars(updates.sessions_passed)
    : normalizePassedPillars(existing?.sessions_passed);
  const mergedSessions = Array.isArray(updates.sessions_passed)
    ? [...new Set([
      ...normalizedExistingSessions,
      ...normalizePassedPillars(updates.sessions_passed),
    ])]
    : existingSessions;
  const payload = {
    ...(existing?.id !== undefined ? { id: existing.id } : {}),
    user_id: userId,
    material_slug: materialSlug,
    language_code: 'en',
    xp: Math.max(0, Number(updates.xp ?? existing?.xp ?? 0) + xpDelta),
    sessions_passed: mergedSessions,
    notes: updates.notes ?? existing?.notes ?? '',
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from('user_progress')
    .upsert(payload, { onConflict: 'user_id,material_slug,language_code' });
  if (error) throw error;
}

export function upsertUserProgress(client, userId, materialSlug, updates) {
  const queueKey = `en:${userId}:${materialSlug}`;
  const previousWrite = progressWriteQueues.get(queueKey) ?? Promise.resolve();
  const currentWrite = previousWrite
    .catch(() => {})
    .then(() => writeUserProgress(client, userId, materialSlug, updates));

  progressWriteQueues.set(queueKey, currentWrite);
  return currentWrite.finally(() => {
    if (progressWriteQueues.get(queueKey) === currentWrite) {
      progressWriteQueues.delete(queueKey);
    }
  });
}