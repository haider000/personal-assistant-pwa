import { parseDate } from "chrono-node";

import type { ParsedIntent } from "@/lib/shared/types";

function extractTags(content: string): string[] {
  const tagMatches = content.match(/#[a-zA-Z0-9_-]+/g) ?? [];
  return tagMatches.map((t) => t.slice(1).toLowerCase());
}

export function parseIntent(input: string, now = new Date()): ParsedIntent {
  const text = input.trim();
  const normalized = text.toLowerCase();

  const expenseAdd = normalized.match(/^spent\s+(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (expenseAdd) {
    const amount = Number(expenseAdd[1]);
    const category = expenseAdd[2].trim();
    if (!Number.isFinite(amount) || amount <= 0 || !category) {
      return { type: "fallback", reason: "Invalid expense format" };
    }

    return {
      type: "expense_add",
      amount,
      category,
      date: now.toISOString(),
    };
  }

  if (
    /(?:expense|spend).*(?:report|today|daily|week|weekly|month|monthly)/i.test(normalized) ||
    /^(today|daily|weekly|monthly) expenses$/i.test(normalized)
  ) {
    let range: "daily" | "weekly" | "monthly" = "daily";
    if (normalized.includes("week")) range = "weekly";
    if (normalized.includes("month")) range = "monthly";
    return { type: "expense_report", range };
  }

  const reminderMatch = text.match(/^(?:remind me|remind)\s+(.+?)\s+at\s+(.+)$/i);
  if (reminderMatch) {
    const content = reminderMatch[1].trim();
    const whenText = reminderMatch[2].trim();
    const remindAtDate = parseDate(whenText, now);
    if (!remindAtDate) {
      return { type: "fallback", reason: "Unable to parse reminder time" };
    }

    return {
      type: "reminder_create",
      content,
      remindAt: remindAtDate.toISOString(),
    };
  }

  const smartReminder = text.match(/^remind\s+(.+)$/i);
  if (smartReminder) {
    const parsed = parseDate(smartReminder[1], now);
    if (parsed) {
      const content = smartReminder[1].replace(parsed.toLocaleString(), "").trim() || "Reminder";
      return {
        type: "reminder_create",
        content,
        remindAt: parsed.toISOString(),
      };
    }
  }

  const noteCreatePatterns = [/^note:\s*(.+)$/i, /^save note\s+(.+)$/i, /^add note\s+(.+)$/i, /^note\s+(.+)$/i];
  for (const pattern of noteCreatePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const content = match[1].trim();
      return {
        type: "note_create",
        content,
        tags: extractTags(content),
      };
    }
  }

  if (/^(?:show|list)(?:\s+my)?\s+notes$/i.test(text)) {
    return { type: "note_list" };
  }

  const noteSearchMatch = text.match(/^(?:find|search)\s+note(?:\s+about)?\s+(.+)$/i);
  if (noteSearchMatch?.[1]) {
    return {
      type: "note_search",
      keyword: noteSearchMatch[1].trim(),
    };
  }

  const noteDeleteMatch = text.match(/^delete\s+note\s+(\d+)$/i);
  if (noteDeleteMatch) {
    return {
      type: "note_delete",
      noteId: Number(noteDeleteMatch[1]),
    };
  }

  return {
    type: "fallback",
    reason: "No known command matched",
  };
}
