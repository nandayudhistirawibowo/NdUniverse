import { clampMaterialXp, MAX_MATERIAL_XP } from './progress-xp.js';

export const MATERIAL_LEVEL_POINTS = 10;
export const XP_PER_LEVEL_POINT = MAX_MATERIAL_XP / MATERIAL_LEVEL_POINTS;

const CEFR_LEVELS = [
  { code: 'A1', label: 'A1' },
  { code: 'A2', label: 'A2' },
  { code: 'B1', label: 'B1' },
  { code: 'B2', label: 'B2' },
  { code: 'C1', label: 'C1' },
  { code: 'C2', label: 'C2' },
];

export function normalizeCefrLevel(value) {
  const match = String(value ?? '').match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
  return match ? match[1].toUpperCase() : 'A1';
}

export function getUserLevel(totalPoints, materials) {
  const targetPointsByLevel = new Map(CEFR_LEVELS.map(({ code }) => [code, 0]));
  (materials ?? []).forEach((material) => {
    const level = String(material.level ?? '').toUpperCase();
    if (targetPointsByLevel.has(level)) {
      targetPointsByLevel.set(
        level,
        targetPointsByLevel.get(level) + MATERIAL_LEVEL_POINTS,
      );
    }
  });

  const availableLevels = CEFR_LEVELS.filter(
    ({ code }) => targetPointsByLevel.get(code) > 0,
  );
  const points = Math.max(0, Number(totalPoints) || 0);
  let remainingPoints = points;

  for (let index = 0; index < availableLevels.length; index += 1) {
    const level = availableLevels[index];
    const targetPoints = targetPointsByLevel.get(level.code);
    if (remainingPoints < targetPoints) {
      const currentPoints = remainingPoints;
      return {
        currentLevel: {
          ...level,
          nextLabel: availableLevels[index + 1]?.label ?? null,
        },
        currentPoints,
        targetPoints,
        totalPoints: points,
        percentage: Math.min(100, Math.round((currentPoints / targetPoints) * 100)),
      };
    }
    remainingPoints -= targetPoints;
  }

  const highestLevel = availableLevels.at(-1) ?? CEFR_LEVELS[0];
  const targetPoints = targetPointsByLevel.get(highestLevel.code) ?? 0;
  return {
    currentLevel: { ...highestLevel, nextLabel: null },
    currentPoints: targetPoints,
    targetPoints,
    totalPoints: points,
    percentage: targetPoints > 0 ? 100 : 0,
  };
}

export function calculateLevelProgress(materials, progressRows) {
  const materialsBySlug = new Map(
    (materials ?? []).map((material) => [material.slug, material]),
  );
  const progressBySlug = new Map(
    (progressRows ?? []).map((row) => [row.material_slug, clampMaterialXp(row.xp)]),
  );
  const totalXp = [...progressBySlug].reduce((total, [slug, xp]) => (
    total + (materialsBySlug.has(slug) ? xp : 0)
  ), 0);
  const totalPoints = Math.floor(totalXp / XP_PER_LEVEL_POINT);
  return getUserLevel(totalPoints, materials);
}
