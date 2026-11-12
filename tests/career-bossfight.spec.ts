import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('completes the IT Boss Fight interview through the UI', async ({ page }) => {
  await page.goto('/de/career/it');
  await page.getByRole('link', { name: 'Mulai Boss Fight' }).click();
  await page.getByRole('button', { name: 'Masuk ke Ruangan' }).click();
  await page.getByRole('button', { name: 'Mulai Wawancara' }).click();

  const answers = [
    'Mein Name ist Testing',
    'Teamarbeit',
    'Perfektionismus',
    'Programmierung',
    'Softwareprojekte',
    'Gehalt',
    'Motivation',
    'Debugging',
    'JavaScript',
    'Fragen',
  ];
  const progress = page.locator('.boss-progress');

  for (const [index, answer] of answers.entries()) {
    await expect(progress).toHaveText(`Pertanyaan ${index + 1} dari 10`);
    await page.locator('#boss-answer').fill(answer);
    await page.getByRole('button', { name: 'Kirim Jawaban' }).click();
    if (index < answers.length - 1) {
      await expect(progress).toHaveText(`Pertanyaan ${index + 2} dari 10`);
    }
  }

  await expect(page.getByRole('heading', { name: 'Wawancara Selesai!' })).toBeVisible();
});
