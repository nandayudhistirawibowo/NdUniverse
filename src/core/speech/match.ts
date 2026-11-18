export interface GradeOptions {
  singleWord?: boolean;
}

export interface GradeWithAlternativesOptions extends GradeOptions {
  keywords?: string[];
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

export interface GradedAlternative {
  transcript: string;
  confidence: number;
  index: number;
}

export interface GradeWithAlternativesResult extends KeywordGradeResult {
  bestTranscript: string;
  bestAlternative: GradedAlternative;
  method: 'exact' | 'phonetic' | 'fuzzy';
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

export function phoneticKey(word: string): string {
  return normalizeText(word)
    .replace(/\s+/g, '')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/ck/g, 'k')
    .replace(/v/g, 'f')
    .replace(/ore/g, 'or')
    .replace(/oa/g, 'o')
    .replace(/sch/g, 'sh')
    .replace(/ch/g, 'k')
    .replace(/(.)\1+/g, '$1')
    .replace(/ed$/g, '')
    .replace(/e$/g, '')
    .replace(/[aeiouy]/g, '0')
    .replace(/0+/g, '0');
}

function phoneticWordSimilarity(left: string, right: string): number {
  const leftKey = phoneticKey(left);
  const rightKey = phoneticKey(right);
  if (leftKey === rightKey) return 1;
  const length = Math.max(leftKey.length, rightKey.length);
  return length === 0 ? 1 : 1 - wordLevenshtein(leftKey, rightKey) / length;
}

export function phoneticSimilarity(transcript: string, target: string): number {
  const transcriptWords = normalizeText(transcript).split(' ').filter(Boolean);
  const targetWords = normalizeText(target).split(' ').filter(Boolean);
  if (targetWords.length === 0) return 0;

  const usedTranscriptWords = new Set<number>();
  const score = targetWords.reduce((total, targetWord) => {
    let bestIndex = -1;
    let bestScore = 0;

    transcriptWords.forEach((transcriptWord, index) => {
      if (usedTranscriptWords.has(index)) return;
      const candidateScore = phoneticWordSimilarity(transcriptWord, targetWord);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestIndex = index;
      }
    });

    if (bestIndex !== -1) usedTranscriptWords.add(bestIndex);
    return total + bestScore;
  }, 0);

  return score / targetWords.length;
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

function exactWordScore(transcript: string, targetWords: string[]): number {
  if (targetWords.length === 0) return 0;
  const transcriptWords = normalizeText(transcript).split(' ').filter(Boolean);
  const usedTranscriptWords = new Set<number>();
  const matched = targetWords.filter((targetWord) => {
    const index = transcriptWords.findIndex(
      (transcriptWord, transcriptIndex) =>
        !usedTranscriptWords.has(transcriptIndex) && transcriptWord === normalizeText(targetWord),
    );
    if (index === -1) return false;
    usedTranscriptWords.add(index);
    return true;
  });
  return matched.length / targetWords.length;
}

export function gradeWithAlternatives(
  alternatives: Array<{ transcript: string; confidence: number }>,
  target: string,
  { singleWord = false, keywords }: GradeWithAlternativesOptions = {},
): GradeWithAlternativesResult {
  const targetWords = (keywords?.length ? keywords.join(' ') : target)
    .split(/\s+/)
    .filter(Boolean);
  const threshold = keywords?.length ? 0.6 : singleWord ? 0.85 : 0.75;
  const candidates = alternatives.length > 0
    ? alternatives
    : [{ transcript: '', confidence: 0 }];

  let bestResult: GradeWithAlternativesResult | null = null;
  candidates.forEach((alternative, index) => {
    const fuzzyGrade = keywords?.length
      ? gradeKeywords(alternative.transcript, keywords)
      : grade(alternative.transcript, target, { singleWord });
    const exactScore = exactWordScore(alternative.transcript, targetWords);
    const phoneticScore = phoneticSimilarity(alternative.transcript, targetWords.join(' '));
    const scoringMethods = [
      { score: exactScore, method: 'exact' as const, priority: 2 },
      { score: phoneticScore, method: 'phonetic' as const, priority: 1 },
      { score: fuzzyGrade.score, method: 'fuzzy' as const, priority: 0 },
    ].sort((left, right) => right.score - left.score || right.priority - left.priority);
    const selected = scoringMethods[0];
    const bestTranscript = alternative.transcript.trim();
    const result: GradeWithAlternativesResult = {
      score: selected.score,
      pass: selected.method === 'phonetic'
        ? selected.score >= 0.85
        : selected.score >= threshold,
      matched: fuzzyGrade.matched,
      missing: fuzzyGrade.missing,
      bestTranscript,
      bestAlternative: { ...alternative, transcript: bestTranscript, index },
      method: selected.method,
    };
    const methodPriority = { exact: 2, phonetic: 1, fuzzy: 0 };

    if (
      !bestResult
      || result.score > bestResult.score
      || (
        result.score === bestResult.score
        && methodPriority[result.method] > methodPriority[bestResult.method]
      )
      || (
        result.score === bestResult.score
        && result.method === bestResult.method
        && alternative.confidence > bestResult.bestAlternative.confidence
      )
    ) {
      bestResult = result;
    }
  });

  return bestResult ?? {
    score: 0,
    pass: false,
    matched: [],
    missing: targetWords,
    bestTranscript: '',
    bestAlternative: { transcript: '', confidence: 0, index: -1 },
    method: 'fuzzy',
  };
}
