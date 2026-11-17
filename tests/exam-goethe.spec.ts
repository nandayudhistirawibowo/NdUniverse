import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('shows the Goethe timer and makes the certificate available for a passed result', async ({ page }) => {
  await page.goto('/de/ujian/goethe/a1');
  const timer = page.locator('.exam-timer strong');
  await expect(timer).toHaveText(/^\d{1,2}:\d{2}$/);

  await page.getByRole('button', { name: 'Mulai Ujian' }).click();

  const readSeconds = async () => {
    const [minutes, seconds] = (await timer.innerText()).split(':').map(Number);
    return minutes * 60 + seconds;
  };
  const initialSeconds = await readSeconds();
  await expect.poll(readSeconds, { timeout: 5000 }).toBeLessThan(initialSeconds);

  await page.evaluate(() => {
    localStorage.setItem('nduniverse-goethe-a1', JSON.stringify({ passed: true }));
  });
  await page.goto('/de/sertifikat/goethe/a1');

  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
});
