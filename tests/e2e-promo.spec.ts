import { expect, test } from '@playwright/test';

test('records the 30-second NdUniverse promo journey', async ({ page }) => {
  const startedAt = Date.now();
  const waitUntil = async (targetMs: number) => {
    const remainingMs = targetMs - (Date.now() - startedAt);
    if (remainingMs > 0) await page.waitForTimeout(remainingMs);
  };

  await page.goto('/');
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1_000);
  await page.mouse.wheel(0, -600);
  await waitUntil(5_000);

  await page.goto('/en/dashboard');
  await waitUntil(10_000);

  await page.goto('/en/materi/latihan?slug=english-a1-animals&type=reading&session=1');
  const questionCard = page.locator('.question-card');
  await expect(questionCard).toBeVisible();
  await questionCard.locator('.match-choice').first().click();
  await page.getByRole('button', { name: 'Periksa Jawaban' }).click();
  await waitUntil(15_000);

  await page.goto('/en');
  await expect(page).toHaveURL(/\/en$/);
  await page.getByRole('button', { name: 'Buka NdUniverse Assistant' }).click();
  const chatInput = page.getByRole('textbox', { name: 'Pesan' });
  await chatInput.fill('NdUniverse itu apa ya?');
  await chatInput.press('Enter');
  const assistantReply = page.locator('.ndbot-message--assistant').nth(1);
  await expect(assistantReply).toBeVisible();
  await expect(assistantReply).not.toBeEmpty();
  await expect(page.getByRole('status', { name: 'Sedang mengetik...' })).toBeHidden();
  await waitUntil(25_000);

  await page.goto('/en/career/it/boss');
  await expect(page.locator('.cinematic-overlay')).toBeVisible();
  await waitUntil(30_000);
});
