import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLevelProgress,
  getUserLevel,
  normalizeCefrLevel,
} from '../src/core/db/level-points.js';

test('advances to the next level at the actual cumulative material target', () => {
  const materials = [
    ...Array.from({ length: 27 }, (_, index) => ({ slug: `a1-${index}`, level: 'A1' })),
    ...Array.from({ length: 52 }, (_, index) => ({ slug: `a2-${index}`, level: 'A2' })),
  ];
  const progressRows = materials
    .filter(({ level }) => level === 'A1')
    .map(({ slug }) => ({ material_slug: slug, xp: 800 }));

  assert.deepEqual(calculateLevelProgress(materials, progressRows), {
    currentLevel: { code: 'A2', label: 'A2', nextLabel: null },
    currentPoints: 0,
    targetPoints: 520,
    totalPoints: 270,
    percentage: 0,
  });
});

test('uses XP-equivalent points for progress within the active level', () => {
  const materials = [
    { slug: 'a1-1', level: 'A1' },
    { slug: 'a1-2', level: 'A1' },
    { slug: 'a2-1', level: 'A2' },
    { slug: 'a2-2', level: 'A2' },
    { slug: 'a2-3', level: 'A2' },
    { slug: 'b1-1', level: 'B1' },
  ];
  const progressRows = [
    { material_slug: 'a1-1', xp: 800 },
    { material_slug: 'a1-2', xp: 800 },
    { material_slug: 'a2-1', xp: 800 },
  ];

  assert.deepEqual(calculateLevelProgress(materials, progressRows), {
    currentLevel: { code: 'A2', label: 'A2', nextLabel: 'B1' },
    currentPoints: 10,
    targetPoints: 30,
    totalPoints: 30,
    percentage: 33,
  });
});

test('keeps progress at zero until XP reaches a point threshold', () => {
  const result = calculateLevelProgress(
    [{ slug: 'a1-1', level: 'A1' }],
    [{ material_slug: 'a1-1', xp: 79 }],
  );

  assert.equal(result.currentPoints, 0);
  assert.equal(result.targetPoints, 10);
  assert.equal(result.percentage, 0);
});

test('normalizes profile values to pure CEFR codes', () => {
  assert.equal(normalizeCefrLevel('a1'), 'A1');
  assert.equal(normalizeCefrLevel('c2'), 'C2');
  assert.equal(normalizeCefrLevel('unknown'), 'A1');
});

test('moves to B1 when cumulative A1 and A2 targets are met', () => {
  const materials = [
    ...Array.from({ length: 27 }, (_, index) => ({ slug: `a1-${index}`, level: 'A1' })),
    ...Array.from({ length: 52 }, (_, index) => ({ slug: `a2-${index}`, level: 'A2' })),
    { slug: 'b1-1', level: 'B1' },
  ];

  assert.deepEqual(getUserLevel(790, materials), {
    currentLevel: { code: 'B1', label: 'B1', nextLabel: null },
    currentPoints: 0,
    targetPoints: 10,
    totalPoints: 790,
    percentage: 0,
  });
});
