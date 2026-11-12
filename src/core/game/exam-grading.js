const STORAGE_KEY_PREFIXES = {
  goethe: 'nduniverse-goethe',
  ielts: 'nduniverse-exam-ielts',
  toefl: 'nduniverse-exam-toefl',
};

function getLocalStorage() {
  if (typeof localStorage === 'undefined') {
    throw new Error('Exam results require browser localStorage.');
  }
  return localStorage;
}

export function calculateModuleScore(correct, total, _type) {
  const correctCount = Number(correct);
  const totalCount = Number(total);
  if (!Number.isFinite(correctCount) || !Number.isFinite(totalCount) || totalCount <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((correctCount / totalCount) * 100)));
}

export function isPassed(moduleScores, threshold = 60) {
  return Array.isArray(moduleScores)
    && moduleScores.length > 0
    && moduleScores.every((score) => Number.isFinite(Number(score)) && Number(score) >= threshold);
}

function getModulePercentages(moduleScores) {
  const scores = Array.isArray(moduleScores)
    ? moduleScores
    : moduleScores && typeof moduleScores === 'object'
      ? Object.values(moduleScores)
      : [];
  return scores.map((score) => Number(score));
}

export function getToeflTotalScore(moduleScores) {
  const scores = getModulePercentages(moduleScores);
  if (scores.length === 0 || !scores.every(Number.isFinite)) return 0;
  const points = scores.reduce(
    (total, score) => total + (Math.min(100, Math.max(0, score)) / 100) * 30,
    0,
  );
  return Math.round(points);
}

export function getIeltsBandScore(moduleScores) {
  const scores = getModulePercentages(moduleScores);
  if (scores.length === 0 || !scores.every(Number.isFinite)) return 3;
  const average = scores.reduce(
    (total, score) => total + Math.min(100, Math.max(0, score)),
    0,
  ) / scores.length;

  if (average >= 95) return 9;
  if (average >= 90) return 8.5;
  if (average >= 80) return 7;
  if (average >= 70) return 6.5;
  if (average >= 60) return 6;
  if (average >= 50) return 5.5;
  if (average >= 40) return 5;
  if (average >= 30) return 4.5;
  if (average >= 20) return 4;
  if (average >= 10) return 3.5;
  return 3;
}

export function getStorageKey(examType, level) {
  const prefix = STORAGE_KEY_PREFIXES[String(examType).toLowerCase()];
  if (!prefix) {
    throw new RangeError(`Unsupported exam type: ${examType}`);
  }
  return `${prefix}-${String(level).toLowerCase()}`;
}

export function saveExamResult(examType, level, result) {
  getLocalStorage().setItem(
    getStorageKey(examType, level),
    JSON.stringify(result),
  );
}

export function getExamResult(examType, level) {
  const storage = getLocalStorage();
  const storageKey = getStorageKey(examType, level);
  let serializedResult = storage.getItem(storageKey);

  if (serializedResult === null) {
    const prefix = STORAGE_KEY_PREFIXES[String(examType).toLowerCase()];
    const previousKey = `${prefix}-${String(level).toUpperCase()}`;
    if (previousKey !== storageKey) {
      serializedResult = storage.getItem(previousKey);
    }
  }

  if (serializedResult === null && String(examType).toLowerCase() === 'goethe') {
    serializedResult = storage.getItem(`sideutsch-goethe-${String(level).toLowerCase()}`);
  }

  return serializedResult === null ? null : JSON.parse(serializedResult);
}

export function getBandScore(percentage) {
  if (percentage >= 90) return '8.0 - 9.0';
  if (percentage >= 80) return '7.0 - 7.5';
  if (percentage >= 70) return '6.0 - 6.5';
  if (percentage >= 60) return '5.5 - 6.0';
  return 'Di Bawah 5.5';
}
