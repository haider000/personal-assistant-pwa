import { parseDate } from "chrono-node";

import type { ParsedIntent } from "@/lib/shared/types";

function extractTags(content: string): string[] {
  const tagMatches = content.match(/#[a-zA-Z0-9_-]+/g) ?? [];
  return tagMatches.map((t) => t.slice(1).toLowerCase());
}

const monthMap: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function trimExpenseLabel(text: string): string {
  let next = text.replace(/\s+/g, " ").trim();

  for (let index = 0; index < 3; index += 1) {
    const withoutLeading = next.replace(/^(?:on|for|from|at)\s+/i, "").trim();
    const withoutTrailing = withoutLeading.replace(/\s+(?:on|for|from|at)$/i, "").trim();
    if (withoutTrailing === next) {
      break;
    }
    next = withoutTrailing;
  }

  return next;
}

function isValidCalendarDate(year: number, monthIndex: number, day: number): boolean {
  const candidate = new Date(year, monthIndex, day, 12, 0, 0, 0);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === monthIndex &&
    candidate.getDate() === day
  );
}

function buildExpenseDate(year: number, monthIndex: number, day: number): string | null {
  if (!isValidCalendarDate(year, monthIndex, day)) {
    return null;
  }

  return new Date(year, monthIndex, day, 12, 0, 0, 0).toISOString();
}

function normalizeYear(rawYear: string): number {
  const year = Number(rawYear);
  if (rawYear.length === 2) {
    return year >= 70 ? 1900 + year : 2000 + year;
  }
  return year;
}

function parseExplicitExpenseDate(rawValue: string, now: Date): { date: string; matchedText: string } | null {
  const patterns = [
    /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/i,
    /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{2,4}))?\b/i,
    /\bon\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  ] as const;

  const numeric = rawValue.match(patterns[0]);
  if (numeric) {
    const day = Number(numeric[1]);
    const monthIndex = Number(numeric[2]) - 1;
    const year = numeric[3] ? normalizeYear(numeric[3]) : now.getFullYear();
    const date = buildExpenseDate(year, monthIndex, day);
    if (date) {
      return { date, matchedText: numeric[0] };
    }
  }

  const namedMonth = rawValue.match(patterns[1]);
  if (namedMonth) {
    const day = Number(namedMonth[1]);
    const monthIndex = monthMap[namedMonth[2].toLowerCase()];
    if (monthIndex !== undefined) {
      const year = namedMonth[3] ? normalizeYear(namedMonth[3]) : now.getFullYear();
      const date = buildExpenseDate(year, monthIndex, day);
      if (date) {
        return { date, matchedText: namedMonth[0] };
      }
    }
  }

  const dayOnly = rawValue.match(patterns[2]);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    const date = buildExpenseDate(now.getFullYear(), now.getMonth(), day);
    if (date) {
      return { date, matchedText: dayOnly[0] };
    }
  }

  return null;
}

function parseExpensePayload(rawValue: string, amountText: string, now: Date): ParsedIntent {
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { type: "fallback", reason: "Invalid expense format" };
  }

  const explicitDate = parseExplicitExpenseDate(rawValue, now);
  const categorySource = explicitDate ? rawValue.replace(explicitDate.matchedText, " ") : rawValue;
  const category = trimExpenseLabel(categorySource) || "general";

  return {
    type: "expense_add",
    amount,
    category,
    date: explicitDate?.date ?? now.toISOString(),
  };
}

export function parseIntent(input: string, now = new Date()): ParsedIntent {
  const text = input.trim();
  const normalized = text.toLowerCase();

  if (/^(?:help|commands|what can you do)\??$/i.test(text)) {
    return { type: "help" };
  }

  const expenseAdd = text.match(/^spent\s+(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (expenseAdd) {
    return parseExpensePayload(expenseAdd[2], expenseAdd[1], now);
  }

  const expenseAddAlt = text.match(/^(?:add\s+expense|expense)\s+(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (expenseAddAlt) {
    return parseExpensePayload(expenseAddAlt[2], expenseAddAlt[1], now);
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
