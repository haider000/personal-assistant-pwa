export function parseOfflineIntent(text: string): "expense" | "note" | "reminder" | "other" {
  if (/^spent\s+\d+(?:\.\d+)?\s+.+$/i.test(text.trim())) return "expense";
  if (/^(?:note:|save note|add note|note\s+)/i.test(text.trim())) return "note";
  if (/^(?:remind|set reminder)\s+/i.test(text.trim())) return "reminder";
  return "other";
}
