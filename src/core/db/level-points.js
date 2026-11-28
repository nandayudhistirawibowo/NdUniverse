import { clampMaterialXp, MAX_MATERIAL_XP } from './progress-xp.js';

export const MATERIAL_LEVEL_POINTS = 10;

const CEFR_LEVELS = [
  { code: 'A1', label: 'A1 Pemula' },
  { code: 'A2', label: 'A2 Pemula' },
  { code: 'B1', label: 'B1' },
  { code: 'B2', label: 'B2' },
  { code: 'C1', label: 'C1' },
  { code: 'C2', label: 'C2 (Mahir)' },
];

export function calculateLevelProgress(materials, progressRows) {
  const pointsByLevel = new Map(
    CEFR_LEVELS.map(({ code }) => [code, { targetPoints: 0, currentPoints: 0 }]),
  );
  const progressBySlug = new Map(
    (progressRows ?? []).map((row) => [row.material_slug, clampMaterialXp(row.xp)]),
  );

  (materials ?? []).forEach((material) => {
    const level = String(material.level ?? '').toUpperCase();
    const levelPoints = pointsByLevel.get(level);
    if (!levelPoints) return;

    levelPoints.targetPoints += MATERIAL_LEVEL_POINTS;
    if (clampMaterialXp(progressBySlug.get(material.slug)) >= MAX_MATERIAL_XP) {
      levelPoints.currentPoints += MATERIAL_LEVEL_POINTS;
    }
  });

  const availableLevels = CEFR_LEVELS.filter(
    ({ code }) => pointsByLevel.get(code).targetPoints > 0,
  );
  const activeLevel = [...availableLevels].reverse().find(
    ({ code }) => pointsByLevel.get(code).currentPoints > 0,
  ) ?? availableLevels[0] ?? CEFR_LEVELS[0];
  const activeIndex = availableLevels.findIndex(({ code }) => code === activeLevel.code);
  const nextLevel = activeIndex >= 0 ? availableLevels[activeIndex + 1] ?? null : null;
  const { currentPoints, targetPoints } = pointsByLevel.get(activeLevel.code);

  return {
    currentLevel: {
      ...activeLevel,
      nextLabel: nextLevel?.label ?? null,
    },
    currentPoints,
    targetPoints,
    percentage: targetPoints > 0
      ? Math.min(100, Math.round((currentPoints / targetPoints) * 100))
      : 0,
  };
}
