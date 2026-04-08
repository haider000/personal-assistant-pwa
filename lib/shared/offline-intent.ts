export function parseOfflineIntent(text: string): "expense" | "note" | "other" {
  if (/^spent\s+\d+(?:\.\d+)?\s+.+$/i.test(text.trim())) return "expense";
  if (/^(?:note:|save note|add note|note\s+)/i.test(text.trim())) return "note";
  return "other";
}
