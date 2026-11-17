import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('completes the IT Boss Fight interview through the UI', async ({ page }) => {
  await page.goto('/de/career/it/boss');

  const answers = [
    'Erfahrung',
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
  const answerField = page.getByRole('textbox', { name: 'Jawaban Anda' });
  await expect(progress).toHaveText('Pertanyaan 1 dari 10', { timeout: 45_000 });

  for (const [index, answer] of answers.entries()) {
    await expect(progress).toHaveText(`Pertanyaan ${index + 1} dari 10`);
    await answerField.fill(answer);
    await expect(answerField).toHaveValue(answer);
    await expect(page.getByRole('button', { name: 'Kirim jawaban', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Kirim jawaban', exact: true }).click();
    if (index < answers.length - 1) {
      await expect(progress).toHaveText(`Pertanyaan ${index + 2} dari 10`);
    }
  }

  await expect(page.getByRole('heading', { name: 'Wawancara Selesai!' })).toBeVisible();
  await expect(page.getByText('Selamat kamu telah menyelesaikan simulasi wawancara!')).toBeVisible();
});

test('accepts every German answer and assesses it only after question ten', async ({ page }) => {
  await page.goto('/de/career/it/boss');

  const answers = Array(10).fill('Keine Ahnung');
  const answerField = page.getByRole('textbox', { name: 'Jawaban Anda' });
  await expect(page.locator('.boss-progress')).toHaveText('Pertanyaan 1 dari 10', { timeout: 45_000 });

  for (const [index, answer] of answers.entries()) {
    await expect(page.locator('.boss-progress')).toHaveText(`Pertanyaan ${index + 1} dari 10`);
    await answerField.fill(answer);
    await expect(answerField).toHaveValue(answer);
    await page.getByRole('button', { name: 'Kirim jawaban', exact: true }).click();
  }

  await expect(page.getByText('Bagus, akan saya pertimbangkan, silahkan selanjutnya!')).toBeVisible();
});

test('accepts every English answer and assesses it only after question ten', async ({ page }) => {
  await page.goto('/en/career/it/boss');
  await expect(page.locator('.boss-progress')).toHaveText('Pertanyaan 1 dari 10', { timeout: 20_000 });

  const answers = Array(10).fill("I don't know.");
  const answerField = page.getByRole('textbox', { name: 'Jawaban Anda' });

  for (const [index, answer] of answers.entries()) {
    await expect(page.locator('.boss-progress')).toHaveText(`Pertanyaan ${index + 1} dari 10`);
    await answerField.fill(answer);
    await expect(answerField).toHaveValue(answer);
    await page.getByRole('button', { name: 'Kirim jawaban', exact: true }).click();
  }

  await expect(page.getByText('Bagus, akan saya pertimbangkan, silahkan selanjutnya!')).toBeVisible();
});

test('accepts an intermediate English keyword and completes the simulation', async ({ page }) => {
  await page.goto('/en/career/it/boss');
  await expect(page.locator('.boss-progress')).toHaveText('Pertanyaan 1 dari 10', { timeout: 20_000 });

  const answers = [
    'experience',
    'Communication',
    'Improvement',
    'skills',
    'experience',
    'Salary',
    'Company',
    'bug',
    'language',
    'Questions',
  ];
  const answerField = page.getByRole('textbox', { name: 'Jawaban Anda' });

  for (const [index, answer] of answers.entries()) {
    await expect(page.locator('.boss-progress')).toHaveText(`Pertanyaan ${index + 1} dari 10`);
    await answerField.fill(answer);
    await expect(answerField).toHaveValue(answer);
    await page.getByRole('button', { name: 'Kirim jawaban', exact: true }).click();
  }

  await expect(page.getByText('Selamat kamu telah menyelesaikan simulasi wawancara!')).toBeVisible();
});
