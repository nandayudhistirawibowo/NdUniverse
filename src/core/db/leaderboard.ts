import { createServiceRoleClient } from '@core/auth/admin';

export interface LeaderboardEntry {
  id: string;
  name: string;
  level: string;
  xp: number;
  rank: number;
}

interface LeaderboardRow {
  id: string;
  name: string;
  level: string;
  xp: number | string;
}

function isLeaderboardRow(value: unknown): value is LeaderboardRow {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || typeof value.id !== 'string') return false;
  if (!('name' in value) || typeof value.name !== 'string') return false;
  if (!('level' in value) || typeof value.level !== 'string') return false;
  if (!('xp' in value) || (typeof value.xp !== 'number' && typeof value.xp !== 'string')) return false;
  return Number.isFinite(Number(value.xp)) && Number(value.xp) >= 0;
}

export async function fetchLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  unavailable: boolean;
}> {
  try {
    const { data, error } = await createServiceRoleClient().rpc('get_leaderboard');
    if (error) {
      console.error('Unable to fetch leaderboard data.', error);
      return { entries: [], unavailable: true };
    }

    if (!Array.isArray(data) || !data.every(isLeaderboardRow)) {
      console.error('Leaderboard query returned an invalid response.');
      return { entries: [], unavailable: true };
    }

    return {
      entries: data.slice(0, 100).map((row, index) => ({
        id: row.id,
        name: row.name.trim() || 'Member',
        level: row.level.trim() || 'A1',
        xp: Number(row.xp),
        rank: index + 1,
      })),
      unavailable: false,
    };
  } catch (error) {
    console.error('Leaderboard service is unavailable.', error);
    return { entries: [], unavailable: true };
  }
}
