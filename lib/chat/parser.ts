import { parseDate } from "chrono-node";

import type { ParsedIntent } from "@/lib/shared/types";

function extractTags(content: string): string[] {
  const tagMatches = content.match(/#[a-zA-Z0-9_-]+/g) ?? [];
  return tagMatches.map((t) => t.slice(1).toLowerCase());
}

export function parseIntent(input: string, now = new Date()): ParsedIntent {
  const text = input.trim();
  const normalized = text.toLowerCase();

  if (/^(?:help|commands|what can you do)\??$/i.test(text)) {
    return { type: "help" };
  }

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

  const expenseAddAlt = normalized.match(/^(?:add\s+expense|expense)\s+(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (expenseAddAlt) {
    const amount = Number(expenseAddAlt[1]);
    const category = expenseAddAlt[2].trim();
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
    /(?:expense|spend).*(?:report|today|daily|week|weekly|month|monthly|year|yearly)/i.test(normalized) ||
    /^(?:report\s+)?(?:today|daily|this week|weekly|this month|monthly|this year|yearly)(?:\s+expenses)?$/i.test(
      normalized
    ) ||
    /^report(?:\s+expenses)?$/i.test(normalized)
  ) {
    let range: "daily" | "weekly" | "monthly" | "yearly" = "daily";
    if (normalized.includes("week")) range = "weekly";
    if (normalized.includes("month")) range = "monthly";
    if (normalized.includes("year")) range = "yearly";
    return { type: "expense_report", range };
  }

  if (/^(?:show|list|recent)\s+(?:my\s+)?expenses$/i.test(text)) {
    return { type: "expense_list", limit: 8 };
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

  const setReminder = text.match(/^set reminder\s+(.+)$/i);
  if (setReminder) {
    const parsed = parseDate(setReminder[1], now);
    if (parsed) {
      const content = setReminder[1].replace(parsed.toLocaleString(), "").trim() || "Reminder";
      return {
        type: "reminder_create",
        content,
        remindAt: parsed.toISOString(),
      };
    }
  }

  if (/^(?:show|list)(?:\s+my)?\s+reminders$/i.test(text)) {
    return { type: "reminder_list" };
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
