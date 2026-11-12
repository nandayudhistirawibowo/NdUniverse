import { expect, test } from '@playwright/test';
import { answerFirstThreeReadingQuestionsWrong, login, openGermanReadingQuiz } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('three consecutive wrong Reading answers end the session with no XP awarded', async ({ page }) => {
  await openGermanReadingQuiz(page);
  await answerFirstThreeReadingQuestionsWrong(page);

  await expect(page.locator('.summary-status')).toHaveText('Sesi GAGAL');
  await expect(page.locator('.summary-stats > div').first().locator('strong')).toHaveText('0 XP');
});

test('opens an English A1 Reading practice quiz from the catalog', async ({ page }) => {
  await page.goto('/en/everyday-english');
  await page.locator('[data-level-filter]').selectOption('A1');

  const firstMaterial = page.locator('.material-card[data-level="A1"]').first();
  await firstMaterial.getByRole('link', { name: /Open Material/ }).click();
  await page.getByRole('link', { name: 'Reading', exact: true }).first().click();

  await expect(page.locator('.practice-page')).toBeVisible();
  await expect(page.locator('.practice-panel')).toBeVisible();
});
