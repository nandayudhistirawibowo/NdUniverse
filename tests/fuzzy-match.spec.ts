import { expect, test } from '@playwright/test';
import {
  isAnswerCorrect,
  isArticleQuestion,
  isFuzzyMatch,
  normalizeText,
} from '../src/core/game/fuzzy-match.js';
import {
  gradeKeywords,
  gradeWithAlternatives,
  normalizeTargetText,
} from '../src/core/speech/match.ts';

test('normalizes punctuation and removes English and German articles', () => {
  expect(normalizeText('The answer!')).toBe('answer');
  expect(normalizeText('der, die und das Haus')).toBe('und haus');
  expect(normalizeText('The Head.')).toBe(normalizeText('the head'));
  expect(normalizeText('head-word')).toBe('headword');
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

test('speech grading ignores articles and punctuation but still tolerates typos', () => {
  expect(normalizeTargetText('The Head.')).toBe('head');
  expect(gradeKeywords('The eye!', ['eye']).pass).toBe(true);
  expect(gradeKeywords('yelow', ['yellow']).pass).toBe(true);
  expect(gradeWithAlternatives([{ transcript: 'eye.', confidence: 1 }], 'the eye').pass).toBe(true);
});

test('article-focused answers can retain articles when the prompt requires them', () => {
  expect(gradeKeywords('the', ['the']).pass).toBe(true);
  expect(gradeKeywords('book', ['the book'], { preserveArticles: true }).pass).toBe(false);
  expect(isAnswerCorrect('the', 'the')).toBe(true);
  expect(isAnswerCorrect('book', 'the book')).toBe(true);
  expect(isAnswerCorrect('book', 'the book', 0.8, { preserveArticles: true })).toBe(false);
  expect(isArticleQuestion('Fill in the blank: ___ book is on the table.')).toBe(true);
  expect(isArticleQuestion('Please describe the book.')).toBe(false);
});
