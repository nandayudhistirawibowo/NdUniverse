import { expect, test } from '@playwright/test';
import { answerFirstThreeReadingQuestionsWrong, login, openGermanReadingQuiz } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('opens the profile and updates then restores the display name', async ({ page }) => {
  await page.goto('/dashboard-de');
  await page.locator('summary.account-trigger').click();
  await page.getByRole('link', { name: 'Profil Saya' }).click();

  const nameInput = page.locator('#nama-lengkap');
  const submitButton = page.locator('#profile-submit');
  const message = page.locator('#profile-message');
  const originalName = await nameInput.inputValue();
  const restoreName = process.env.E2E_RESTORE_PROFILE_NAME ?? originalName;
  const temporaryName = `${originalName} E2E ${Date.now()}`;

  try {
    await nameInput.fill(temporaryName);
    await submitButton.click();
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toBeEnabled();
    await expect(message).toHaveText('Profil berhasil disimpan.');
  } finally {
    await nameInput.fill(restoreName);
    await submitButton.click();
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toBeEnabled();
    await expect(message).toHaveText('Profil berhasil disimpan.');
    await page.reload();
    await expect(nameInput).toHaveValue(restoreName);
  }
});

test('saves a difficult word to bookmarks and finds it on the bookmark page', async ({ page }) => {
  await openGermanReadingQuiz(page);
  await answerFirstThreeReadingQuestionsWrong(page);

  const bookmarkButton = page.locator('.bookmark-btn').first();
  const label = await bookmarkButton.getAttribute('aria-label');
  const germanWord = label?.split(': ').at(-1);
  expect(germanWord).toBeTruthy();

  await bookmarkButton.click();
  await expect(bookmarkButton).toHaveAttribute('aria-label', `Tersimpan di Bookmark: ${germanWord}`);
  await page.goto('/dashboard-de/bookmark');

  await expect(page.getByRole('heading', { name: germanWord!, exact: true })).toBeVisible();
  await expect(page.getByText('keluarga', { exact: true })).toBeVisible();
});
