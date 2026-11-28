import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLevelProgress } from '../src/core/db/level-points.js';

test('uses the actual material count as the target for each CEFR level', () => {
  const materials = Array.from({ length: 27 }, (_, index) => ({
    slug: `a1-${index}`,
    level: 'A1',
  }));
  const progressRows = materials.map(({ slug }) => ({
    material_slug: slug,
    xp: 800,
  }));

  assert.deepEqual(calculateLevelProgress(materials, progressRows), {
    currentLevel: { code: 'A1', label: 'A1 Pemula', nextLabel: null },
    currentPoints: 270,
    targetPoints: 270,
    percentage: 100,
  });
});

test('starts tracking the next available level after a material there is completed', () => {
  const materials = [
    { slug: 'a1-1', level: 'A1' },
    { slug: 'a2-1', level: 'A2' },
    { slug: 'a2-2', level: 'A2' },
    { slug: 'b1-1', level: 'B1' },
  ];
  const progressRows = [
    { material_slug: 'a1-1', xp: 800 },
    { material_slug: 'a2-1', xp: 800 },
  ];

  assert.deepEqual(calculateLevelProgress(materials, progressRows), {
    currentLevel: { code: 'A2', label: 'A2 Pemula', nextLabel: 'B1' },
    currentPoints: 10,
    targetPoints: 20,
    percentage: 50,
  });
});

test('keeps progress at zero when the current level has no completed materials', () => {
  const result = calculateLevelProgress(
    [{ slug: 'a1-1', level: 'A1' }],
    [{ material_slug: 'a1-1', xp: 799 }],
  );

  assert.equal(result.currentPoints, 0);
  assert.equal(result.targetPoints, 10);
  assert.equal(result.percentage, 0);
});
