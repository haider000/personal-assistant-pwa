import { parseIntent } from "@/lib/chat/parser";
import { getRepositories } from "@/lib/repositories";
import type { Message } from "@/lib/shared/types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function clip(text: string, max = 180): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function formatNotesList(lines: { id: number; content: string }[]): string {
  if (!lines.length) return "No notes found yet.";
  return [
    "Your notes:",
    ...lines.map((note, idx) => `${idx + 1}. (#${note.id}) ${clip(note.content)}`),
  ].join("\n");
}

function formatExpenseRange(range: "daily" | "weekly" | "monthly" | "yearly"): string {
  switch (range) {
    case "daily":
      return "today";
    case "weekly":
      return "this week";
    case "monthly":
      return "this month";
    case "yearly":
      return "this year";
  }
}

function helpText(): string {
  return [
    "Try one of these commands:",
    "- spent 18 lunch",
    "- spent 500 on 2nd april from slice app",
    "- add expense 72 groceries",
    "- report today / this week / this month / this year",
    "- remind me to call mom at 7pm",
    "- set reminder pay rent tomorrow 9am",
    "- note: buy milk #shopping",
    "- show notes / search note groceries / delete note 3",
    "- show reminders / recent expenses",
  ].join("\n");
}

export function processChatMessage(input: string, createdAt?: string): { user: Message; bot: Message } {
  const repos = getRepositories();
  const now = new Date();
  const userMessage = repos.messages.add("user", input, createdAt ?? now.toISOString());
  const intent = parseIntent(input, now);

  let botReply = "I could not understand that command. Try: `spent 250 food`, `note: buy milk`, or `show notes`.";

  switch (intent.type) {
    case "expense_add": {
      const expense = repos.expenses.add(intent.amount, intent.category, intent.date);
      botReply = `Expense saved: ${money(expense.amount)} in ${expense.category} (${formatDate(expense.date)}).`;
      break;
    }
    case "expense_report": {
      const report = repos.expenses.report(intent.range);
      const period = formatExpenseRange(intent.range);
      botReply = report.count
        ? [
            `Expense report for ${period}:`,
            `Total: ${money(report.total)}`,
            `Entries: ${report.count}`,
            ...report.rows.slice(0, 5).map((row) => `- ${money(row.amount)} ${row.category}`),
          ].join("\n")
        : `No expenses found for ${period}.`;
      break;
    }
    case "expense_list": {
      const expenses = repos.expenses.list(intent.limit);
      botReply = expenses.length
        ? [
            "Recent expenses:",
            ...expenses.map(
              (row) => `- ${money(row.amount)} ${row.category} on ${formatDate(row.date)} (#${row.id})`
            ),
          ].join("\n")
        : "No expenses yet.";
      break;
    }
    case "reminder_create": {
      const reminder = repos.reminders.add(intent.content, intent.remindAt);
      botReply = `Reminder created for ${formatTime(reminder.remindAt)}: ${clip(reminder.content)}`;
      break;
    }
    case "reminder_list": {
      const reminders = repos.reminders.listUpcoming(8);
      botReply = reminders.length
        ? [
            "Upcoming reminders:",
            ...reminders.map((reminder) => `- ${formatTime(reminder.remindAt)}: ${clip(reminder.content)}`),
          ].join("\n")
        : "No upcoming reminders.";
      break;
    }
    case "note_create": {
      const note = repos.notes.add(intent.content, intent.tags);
      botReply = `Note saved (#${note.id}).`;
      break;
    }
    case "note_list": {
      const notes = repos.notes.list(100);
      botReply = formatNotesList(notes);
      break;
    }
    case "note_search": {
      const notes = repos.notes.search(intent.keyword);
      botReply = notes.length
        ? [
            `Matches for "${intent.keyword}":`,
            ...notes.map((note) => `- (#${note.id}) ${clip(note.content)}`),
          ].join("\n")
        : `No notes found for "${intent.keyword}".`;
      break;
    }
    case "note_delete": {
      const deleted = repos.notes.delete(intent.noteId);
      botReply = deleted ? `Deleted note #${intent.noteId}.` : `Note #${intent.noteId} was not found.`;
      break;
    }
    case "help": {
      botReply = helpText();
      break;
    }
    case "fallback": {
      botReply = `I could not parse that.\n${helpText()}`;
      break;
    }
  }

  const botMessage = repos.messages.add("bot", botReply);
  return { user: userMessage, bot: botMessage };
}
