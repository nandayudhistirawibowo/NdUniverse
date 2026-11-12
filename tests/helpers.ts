import { expect, type Page } from '@playwright/test';

export async function login(page: Page) {
  const username = process.env.E2E_USERNAME ?? 'testing';
  const password = process.env.E2E_PASSWORD;

  if (!password) {
    throw new Error('Set E2E_PASSWORD in the environment before running authenticated tests.');
  }

  const passwordInput = page.locator('#password');
  const passwordToggle = page.locator('[data-password-toggle="password"]');
  let loginScriptReady = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/login-de?redirect=%2Fdashboard-de');
    await passwordToggle.click();
    loginScriptReady = await passwordInput.getAttribute('type') === 'text';

    if (loginScriptReady) {
      await passwordToggle.click();
      break;
    }

    await page.reload();
  }

  if (!loginScriptReady) {
    throw new Error('The login page script did not initialize; credentials were not submitted.');
  }

  await page.locator('#identifier').fill(username);
  await passwordInput.fill(password);
  await page.locator('#auth-submit').click();
  await expect(page).toHaveURL(/\/dashboard-de(?:\/|$)/, { timeout: 55_000 });
}

export async function openGermanReadingQuiz(page: Page) {
  await page.goto('/de/alltagsdeutsch');
  await page.locator('[data-level-filter]').selectOption('A1');

  const familyMaterial = page.locator('.material-card').filter({
    has: page.getByRole('heading', { name: 'Keluarga', exact: true }),
  });
  await familyMaterial.getByRole('link', { name: /Buka Materi/ }).click();
  await page.getByRole('link', { name: 'Reading', exact: true }).first().click();
  await expect(page.locator('.question-card')).toBeVisible();
}

export async function answerFirstThreeReadingQuestionsWrong(page: Page) {
  const correctAnswers = ['keluarga', 'ibu', 'ayah'];

  for (const [index, correctAnswer] of correctAnswers.entries()) {
    const choices = page.locator('.question-card .multiple-choice-list .match-choice');
    await expect(choices.first()).toBeVisible();
    const choiceTexts = await choices.allTextContents();
    const wrongChoiceIndex = choiceTexts.findIndex(
      (choice) => choice.trim().toLowerCase() !== correctAnswer,
    );

    if (wrongChoiceIndex < 0) {
      throw new Error(`No incorrect answer option found for reading question ${index + 1}.`);
    }

    await choices.nth(wrongChoiceIndex).click();
    await page.locator('.question-card .action-row .primary-btn').click();

    if (index < correctAnswers.length - 1) {
      await expect(page.locator('.question-card .correct-answer')).toBeVisible();
      await page.locator('.question-card .action-row .primary-btn').click();
    }
  }

  await expect(page.getByRole('dialog')).toBeVisible();
}
