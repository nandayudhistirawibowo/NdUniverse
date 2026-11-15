import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login } from './helpers';

declare global {
  interface Window {
    __quizTransitionPromise?: Promise<number>;
  }
}

test.use({ video: 'off' });

const bugReportPath = resolve(process.cwd(), 'bug-report.txt');

async function captureStep(stepName: string, action: () => Promise<void>) {
  try {
    await test.step(stepName, action);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ');
    await appendFile(
      bugReportPath,
      `[${new Date().toISOString()}] - ${stepName} - ${message}\n`,
      'utf8',
    );
  }
}

async function hoverClick(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await locator.hover();
  await page.waitForTimeout(120);
  await locator.click();
}

async function checkLandingLayout(page: Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1_000);
  await page.mouse.move(960, 540);

  const firstLayout = await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('h1, h2, h3, p')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && rect.width > 0 && rect.height > 0 && element.textContent?.trim();
      });

    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });
  });

  await page.waitForTimeout(250);
  const layoutIssues = await page.evaluate((initialLayout) => {
    const currentElements = [...document.querySelectorAll<HTMLElement>('h1, h2, h3, p')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && rect.width > 0 && rect.height > 0 && element.textContent?.trim();
      });
    const issues: string[] = [];

    if (document.documentElement.scrollWidth > window.innerWidth + 2) {
      issues.push(`horizontal overflow (${document.documentElement.scrollWidth}px > ${window.innerWidth}px)`);
    }

    const currentLayout = currentElements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });

    for (const before of initialLayout) {
      const after = currentLayout.find((item) => item.tag === before.tag && item.text === before.text);
      if (after && Math.max(
        Math.abs(before.x - after.x),
        Math.abs(before.y - after.y),
        Math.abs(before.width - after.width),
        Math.abs(before.height - after.height),
      ) > 3) {
        issues.push(`layout shifted for "${before.text}"`);
      }
    }

    for (let firstIndex = 0; firstIndex < currentElements.length; firstIndex += 1) {
      const first = currentElements[firstIndex];
      const firstRect = first.getBoundingClientRect();
      for (let secondIndex = firstIndex + 1; secondIndex < currentElements.length; secondIndex += 1) {
        const second = currentElements[secondIndex];
        if (first.contains(second) || second.contains(first)) continue;
        const secondRect = second.getBoundingClientRect();
        const overlapX = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
        const overlapY = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
        if (overlapX > 4 && overlapY > 4) {
          issues.push(`text overlap: "${first.textContent?.trim()}" / "${second.textContent?.trim()}"`);
        }
      }
    }

    return issues;
  }, firstLayout);

  if (layoutIssues.length) throw new Error(layoutIssues.join('; '));
}

test('hunts layout and interaction bugs across NdUniverse', async ({ page }) => {
  test.setTimeout(180_000);
  let isAuthenticated = false;

  for (const route of ['/', '/de', '/en']) {
    await captureStep(`Landing and portal layout: ${route}`, async () => {
      await checkLandingLayout(page, route);
    });
  }

  await captureStep('Auth: login with the configured dummy student account', async () => {
    await login(page);
    isAuthenticated = true;
  });

  if (isAuthenticated) {
    await captureStep('Dashboard: open dashboard', async () => {
      await page.goto('/dashboard-de');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1_000);
    });

    await captureStep('Dashboard: sidebar is visible', async () => {
      await expect(page.locator('.private-sidebar')).toBeVisible();
    });

    await captureStep('Dashboard: XP card is visible', async () => {
      await expect(page.locator('.level-card .level-points')).toContainText('XP');
    });

    await captureStep('Dashboard: NdBot button is visible', async () => {
      await expect(page.locator('.ndbot-fab')).toBeVisible();
    });
  }

  for (const pillar of ['reading', 'listening', 'writing', 'speaking'] as const) {
    await captureStep(`Quiz ${pillar}: answer and validate the interaction`, async () => {
      await page.goto(`/en/materi/latihan?slug=english-a1-animals&type=${pillar}&session=1`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1_000);
      const questionNumber = page.locator('.progress-label > span').first();
      await expect(questionNumber).toContainText('Soal 1 dari');

      if (pillar === 'reading') {
        await hoverClick(page, page.getByRole('button', { name: 'the dog', exact: true }));
      } else if (pillar === 'listening') {
        await hoverClick(page, page.getByRole('button', { name: 'anjing', exact: true }));
      } else {
        const answerField = pillar === 'writing'
          ? page.getByRole('textbox', { name: 'Jawaban tertulis' })
          : page.getByRole('textbox', { name: 'Jawaban kata kunci' });
        await hoverClick(page, answerField);
        await answerField.fill('the dog');
      }

      await page.evaluate(() => {
        const progress = document.querySelector('.progress-label > span');
        const button = [...document.querySelectorAll<HTMLButtonElement>('.question-card .primary-btn')]
          .find((element) => element.textContent?.includes('Periksa Jawaban'));
        if (!progress || !button) throw new Error('Quiz progress or answer button is missing.');

        window.__quizTransitionPromise = new Promise<number>((resolve) => {
          button.addEventListener('click', () => {
            const startedAt = performance.now();
            const observer = new MutationObserver(() => {
              if (progress.textContent?.includes('Soal 2 dari')) {
                observer.disconnect();
                resolve(performance.now() - startedAt);
              }
            });
            observer.observe(progress, { childList: true, characterData: true, subtree: true });
          }, { once: true, capture: true });
        });
      });
      await hoverClick(page, page.getByRole('button', { name: 'Periksa Jawaban' }));
      await expect(questionNumber).toContainText('Soal 2 dari', { timeout: 3_000 });
      const transitionDuration = await page.evaluate(async () => {
        const duration = await window.__quizTransitionPromise;
        delete window.__quizTransitionPromise;
        return duration ?? Number.POSITIVE_INFINITY;
      });
      if (pillar === 'reading' && transitionDuration > 1_000) {
        throw new Error(`quiz question transition took ${transitionDuration}ms (expected <= 1000ms)`);
      }
    });
  }

  await captureStep('NdBot: chat bubble appears with a smooth animation', async () => {
    await page.goto('/en/everyday-english');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);
    await hoverClick(page, page.getByRole('button', { name: 'Buka NdUniverse Assistant' }));

    const chatInput = page.getByRole('textbox', { name: 'Pesan' });
    await chatInput.fill('Test');
    await chatInput.press('Enter');
    const userBubble = page.locator('.ndbot-message--user').last();
    await expect(userBubble).toBeVisible();

    const animation = await userBubble.evaluate((element) => ({
      name: getComputedStyle(element).animationName,
      duration: getComputedStyle(element).animationDuration,
    }));
    if (animation.name === 'none' || animation.duration === '0s') {
      throw new Error(`chat bubble has no visible entrance animation (${animation.name}, ${animation.duration})`);
    }
  });

  await captureStep('Boss Fight: door animation and interview chat transition are smooth', async () => {
    await page.goto('/en/career/it/boss');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5_000);
    await expect(page.locator('.cinematic-overlay')).toBeVisible();

    const door = page.locator('.cinematic-door');
    if (await door.count()) {
      const transition = await door.evaluate((element) => getComputedStyle(element).transition);
      if (!transition.includes('transform')) {
        throw new Error(`boss door has no transform transition (${transition})`);
      }
    }

    await expect(page.locator('.cinematic-chat-panel')).toBeVisible({ timeout: 30_000 });
  });
});
