// Quality heuristics — no LLM call needed
// Returns true if the extracted text is poor quality (scanned/image document)
export function isLowQuality(text: string, sizeBytes: number): boolean {
  // Large file but almost no text → image-only PDF
  if (sizeBytes > 10_000 && text.trim().length < 50) return true
  // High ratio of non-alphanumeric chars → garbled encoding
  const nonAlpha = (text.match(/[^a-zA-Z0-9\s.,!?;:()\-$%]/g) ?? []).length
  if (nonAlpha / Math.max(text.length, 1) > 0.3 && text.length > 20) return true
  // Unicode replacement chars → encoding failure
  if (text.includes('\uFFFD')) return true
  return false
}
