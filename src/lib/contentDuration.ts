/** Source narration baseline, not total seat time (practice and quizzes are extra). */
export const SOURCE_WORDS_PER_MINUTE = 130;

export function countSourceWords(text: string): number {
  // Upload status/error messages are not instructional content. Preserve manually
  // pasted notes below the status block, if present.
  const content = text.replace(/^\[Document\][^\n]*(?:\n+[ \t]*(?:Warning:|Could not extract)[^\n]*)?\s*/i, "");
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateMinutesFromText(text: string): number {
  return Math.ceil(countSourceWords(text) / SOURCE_WORDS_PER_MINUTE);
}

/** Bytes measure storage, not pages or instructional content. */
export function estimateMinutesFromDocumentMeta(
  _fileSize?: number | null,
  _fileName?: string | null,
): number {
  return 0;
}

/** Retain the upload API without allowing images/compression to inflate duration. */
export function estimateMinutesCombined(
  text: string,
  _fileSize?: number | null,
  _fileName?: string | null,
): number {
  return estimateMinutesFromText(text);
}