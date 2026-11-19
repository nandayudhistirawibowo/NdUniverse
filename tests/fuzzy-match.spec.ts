import { expect, test } from '@playwright/test';
import { isAnswerCorrect, isFuzzyMatch, normalizeText } from '../src/core/game/fuzzy-match.js';

test('normalizes punctuation and removes English and German articles', () => {
  expect(normalizeText('The answer!')).toBe('answer');
  expect(normalizeText('der, die und das Haus')).toBe('und haus');
});

test('accepts equivalent text with omitted articles and small typos', () => {
  expect(isAnswerCorrect('answer', 'the answer')).toBe(true);
  expect(isAnswerCorrect('die Antwort', 'Antwort')).toBe(true);
  expect(isFuzzyMatch('answr', 'answer', 0.8)).toBe(true);
});

test('does not accept input containing only articles', () => {
  expect(isAnswerCorrect('the', 'a')).toBe(false);
  expect(isFuzzyMatch('der', 'die', 0.8)).toBe(false);
});
