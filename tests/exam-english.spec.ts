import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('opens IELTS and TOEFL exams and their passed-result certificate reports', async ({ page }) => {
  for (const [type, reportTitle] of [
    ['ielts', 'Test Report Form'],
    ['toefl', 'Score Report'],
  ]) {
    await page.goto(`/en/exam/${type}/a1`);
    await expect(page.getByRole('heading', { name: `${type.toUpperCase()} Exam` })).toBeVisible();

    await page.evaluate(({ examType }) => {
      localStorage.setItem(
        `nduniverse-exam-${examType}-a1`,
        JSON.stringify({ passed: true, totalScore: 85, bandScore: '7.0 - 7.5' }),
      );
    }, { examType: type });
    await page.goto(`/sertifikat/en/${type}/a1`);

    await expect(page.getByRole('heading', { name: reportTitle })).toBeVisible();
    await expect(page.locator('#certificate-container')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  }
});
