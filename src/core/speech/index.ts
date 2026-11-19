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
  gradeWithAlternatives,
  normalizeText,
  normalizeTargetText,
  phoneticKey,
  phoneticSimilarity,
  similarity,
  wordLevenshtein,
  type GradeOptions,
  type GradeResult,
  type GradeWithAlternativesOptions,
  type GradeWithAlternativesResult,
  type GradedAlternative,
  type KeywordGradeResult,
} from './match';
export { type SpeechAlternative } from './stt-engine';
export { useSpeechCapture } from './use-speech-capture';
export { default as SpeechFeedback } from './SpeechFeedback.jsx';
export {
  cancelRecording,
  recordAndTranscribe,
  stopRecording,
  type RecordAndTranscribeOptions,
  type TranscriptionResult,
} from './recorder';
