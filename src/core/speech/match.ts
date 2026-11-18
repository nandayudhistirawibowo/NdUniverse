export interface GradeOptions {
  singleWord?: boolean;
}

export interface GradeResult {
  score: number;
  pass: boolean;
  threshold: number;
  matched: string[];
  missing: string[];
}

export interface KeywordGradeResult {
  score: number;
  pass: boolean;
  matched: string[];
  missing: string[];
}

export function normalizeText(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function wordLevenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }

  return previous[right.length];
}

function pronunciationKey(word: string): string {
  return word
    .replace(/ch/g, 'k')
    .replace(/^or/, 'o')
    .replace(/oa/g, 'o')
    .replace(/ore/g, 'or');
}

function wordsMatch(transcriptWord: string, targetWord: string): boolean {
  return transcriptWord === targetWord
    || pronunciationKey(transcriptWord) === pronunciationKey(targetWord)
    || wordLevenshtein(transcriptWord, targetWord) <= 1;
}

function matchTargetWords(
  transcript: string,
  targetWords: string[],
): { matched: string[]; missing: string[] } {
  const transcriptWords = normalizeText(transcript).split(' ').filter(Boolean);
  const normalizedTargets = targetWords.map((word) => normalizeText(word));
  const usedTranscriptWords = new Set<number>();
  const matchedIndices = new Set<number>();

  normalizedTargets.forEach((targetWord, targetIndex) => {
    const exactIndex = transcriptWords.findIndex(
      (word, index) => !usedTranscriptWords.has(index) && word === targetWord,
    );
    if (exactIndex !== -1) {
      usedTranscriptWords.add(exactIndex);
      matchedIndices.add(targetIndex);
    }
  });

  normalizedTargets.forEach((targetWord, targetIndex) => {
    if (matchedIndices.has(targetIndex)) return;

    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;
    transcriptWords.forEach((word, index) => {
      if (usedTranscriptWords.has(index)) return;
      const distance = wordLevenshtein(word, targetWord);
      const pronunciationMatch = pronunciationKey(word) === pronunciationKey(targetWord);
      const matchDistance = pronunciationMatch ? 0 : distance;
      if (wordsMatch(word, targetWord) && matchDistance < closestDistance) {
        closestIndex = index;
        closestDistance = matchDistance;
      }
    });

    if (closestIndex !== -1) {
      usedTranscriptWords.add(closestIndex);
      matchedIndices.add(targetIndex);
    }
  });

  return {
    matched: targetWords.filter((_, index) => matchedIndices.has(index)),
    missing: targetWords.filter((_, index) => !matchedIndices.has(index)),
  };
}

export function similarity(transcript: string, target: string): number {
  const targetWords = normalizeText(target).split(' ').filter(Boolean);
  if (targetWords.length === 0) return 0;

  const { matched } = matchTargetWords(transcript, targetWords);
  return matched.length / targetWords.length;
}

export function grade(
  transcript: string,
  target: string,
  { singleWord = false }: GradeOptions = {},
): GradeResult {
  const targetWords = normalizeText(target).split(' ').filter(Boolean);
  const { matched, missing } = matchTargetWords(transcript, targetWords);
  const threshold = singleWord ? 0.85 : 0.75;
  const score = targetWords.length === 0 ? 0 : matched.length / targetWords.length;

  return { score, pass: score >= threshold, threshold, matched, missing };
}

export function gradeKeywords(transcript: string, keywords: string[]): KeywordGradeResult {
  const targetWords = keywords.flatMap((keyword) => normalizeText(keyword).split(' ').filter(Boolean));
  const { matched, missing } = matchTargetWords(transcript, targetWords);
  const score = targetWords.length === 0 ? 0 : matched.length / targetWords.length;

  return { score, pass: score >= 0.6, matched, missing };
}
