import { expect, test, type Locator, type Page } from '@playwright/test';

async function hoverClick(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await locator.hover();
  await page.waitForTimeout(120);
  await locator.click();
}

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
  await hoverClick(page, questionCard.locator('.match-choice').first());
  await hoverClick(page, page.getByRole('button', { name: 'Periksa Jawaban' }));
  await waitUntil(15_000);

  await page.goto('/en');
  await expect(page).toHaveURL(/\/en$/);
  await hoverClick(page, page.getByRole('button', { name: 'Buka NdUniverse Assistant' }));
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
