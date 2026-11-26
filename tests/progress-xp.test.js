import assert from 'node:assert/strict';
import test from 'node:test';
import { clampMaterialXp, MAX_MATERIAL_XP } from '../src/core/db/progress-xp.js';

test('caps legacy material XP at 800', () => {
  assert.equal(clampMaterialXp(1200), 800);
  assert.equal(clampMaterialXp(MAX_MATERIAL_XP), 800);
});

test('keeps valid XP and floors invalid or negative values', () => {
  assert.equal(clampMaterialXp(425), 425);
  assert.equal(clampMaterialXp(-10), 0);
  assert.equal(clampMaterialXp(Number.NaN), 0);
});

test('respects a lower material-specific ceiling', () => {
  assert.equal(clampMaterialXp(1200, 400), 400);
});
