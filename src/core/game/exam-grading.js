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

export function getStorageKey(examType, level) {
  const prefix = STORAGE_KEY_PREFIXES[String(examType).toLowerCase()];
  if (!prefix) {
    throw new RangeError(`Unsupported exam type: ${examType}`);
  }
  return `${prefix}-${String(level).toUpperCase()}`;
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
