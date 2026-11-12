function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
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

function similarity(left, right) {
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - levenshteinDistance(left, right) / longest;
}

export function isFuzzyMatch(userAnswer, targetAnswer, threshold = 0.8) {
  const answer = normalize(userAnswer);
  const target = normalize(targetAnswer);
  if (!answer || !target || !Number.isFinite(threshold)) return false;

  const minimumSimilarity = Math.max(0, Math.min(1, threshold));
  if (similarity(answer, target) >= minimumSimilarity) return true;

  const answerWords = answer.split(' ');
  const targetWords = target.split(' ');
  const targetWordCount = targetWords.length;
  for (let start = 0; start <= answerWords.length - targetWordCount; start += 1) {
    const phraseWords = answerWords.slice(start, start + targetWordCount);
    const wordSimilarities = phraseWords.map((word, index) => similarity(word, targetWords[index]));
    if (
      wordSimilarities.every((score) => score >= minimumSimilarity / 2)
      && wordSimilarities.reduce((total, score) => total + score, 0) / wordSimilarities.length >= minimumSimilarity
    ) return true;
  }

  return false;
}
