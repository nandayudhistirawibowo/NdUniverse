export const MAX_MATERIAL_XP = 800;

export function clampMaterialXp(value, maxXp = MAX_MATERIAL_XP) {
  const numericValue = Number(value);
  const numericMax = Number(maxXp);
  const upperBound = Number.isFinite(numericMax)
    ? Math.max(0, Math.min(MAX_MATERIAL_XP, numericMax))
    : MAX_MATERIAL_XP;

  return Math.min(upperBound, Math.max(0, Number.isFinite(numericValue) ? numericValue : 0));
}
