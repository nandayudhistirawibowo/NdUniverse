export {
  createRecognizer,
  getRecognitionLang,
  type CreateRecognizerOptions,
  type GetRecognitionLangOptions,
  type RecognitionResult,
  type Recognizer,
} from './stt-engine';
export {
  grade,
  gradeKeywords,
  normalizeText,
  similarity,
  wordLevenshtein,
  type GradeOptions,
  type GradeResult,
  type KeywordGradeResult,
} from './match';
export { useSpeechCapture } from './use-speech-capture';
export { default as SpeechFeedback } from './SpeechFeedback.jsx';
