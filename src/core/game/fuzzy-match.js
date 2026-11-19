const ARTICLES = new Set(['a', 'an', 'the', 'der', 'die', 'das']);

export function normalizeText(value) {
  return String(value ?? '')
    .replace(/[\p{P}\p{S}]/gu, '')
    .trim()
    .replace(/\s{2,}/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter((word) => word && !ARTICLES.has(word))
    .join(' ');
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }

  return previous[right.length];
}

export function calculateSimilarity(left, right) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  return calculateNormalizedSimilarity(normalizedLeft, normalizedRight);
}

function calculateNormalizedSimilarity(left, right) {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - levenshteinDistance(left, right) / longest;
}

export function isFuzzyMatch(userAnswer, targetAnswer, threshold = 0.8) {
  const answer = normalizeText(userAnswer);
  const target = normalizeText(targetAnswer);
  if (!answer || !target || !Number.isFinite(threshold)) return false;

  const minimumSimilarity = Math.max(0, Math.min(1, threshold));
  if (calculateNormalizedSimilarity(answer, target) >= minimumSimilarity) return true;

  const answerWords = answer.split(' ');
  const targetWords = target.split(' ');
  const targetWordCount = targetWords.length;
  for (let start = 0; start <= answerWords.length - targetWordCount; start += 1) {
    const phraseWords = answerWords.slice(start, start + targetWordCount);
    const wordSimilarities = phraseWords.map((word, index) =>
      calculateNormalizedSimilarity(word, targetWords[index])
    );
    if (
      wordSimilarities.every((score) => score >= minimumSimilarity / 2)
      && wordSimilarities.reduce((total, score) => total + score, 0) / wordSimilarities.length >= minimumSimilarity
    ) return true;
  }

  return false;
}

export function isAnswerCorrect(userAnswer, correctAnswer, threshold = 0.8) {
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.some((answer) => isAnswerCorrect(userAnswer, answer, threshold));
  }

  const answer = normalizeText(userAnswer);
  const target = normalizeText(correctAnswer);
  if (!answer || !target || !Number.isFinite(threshold)) return false;

  const minimumSimilarity = Math.max(0, Math.min(1, threshold));
  return calculateNormalizedSimilarity(answer, target) >= minimumSimilarity
    || isFuzzyMatch(answer, target, minimumSimilarity);
}
