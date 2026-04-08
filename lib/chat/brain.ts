import { parseIntent } from "@/lib/chat/parser";
import { getRepositories } from "@/lib/repositories";
import type { Message } from "@/lib/shared/types";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
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

export function processChatMessage(input: string, createdAt?: string): { user: Message; bot: Message } {
  const repos = getRepositories();
  const now = new Date();
  const userMessage = repos.messages.add("user", input, createdAt ?? now.toISOString());
  const intent = parseIntent(input, now);

  let botReply = "I could not understand that command. Try: `spent 250 food`, `note: buy milk`, or `show notes`.";

  switch (intent.type) {
    case "expense_add": {
      const expense = repos.expenses.add(intent.amount, intent.category, intent.date);
      botReply = `Expense saved: ${money(expense.amount)} in ${expense.category} (${new Date(expense.date).toLocaleDateString()}).`;
      break;
    }
    case "expense_report": {
      const report = repos.expenses.report(intent.range);
      const period = intent.range.replace("ly", "");
      botReply = report.count
        ? [
            `Expense report (${period}):`,
            `Total: ${money(report.total)}`,
            `Entries: ${report.count}`,
            ...report.rows.slice(0, 5).map((row) => `- ${money(row.amount)} ${row.category}`),
          ].join("\n")
        : `No expenses found for this ${period}.`;
      break;
    }
    case "reminder_create": {
      const reminder = repos.reminders.add(intent.content, intent.remindAt);
      botReply = `Reminder created for ${formatTime(reminder.remindAt)}: ${clip(reminder.content)}`;
      break;
    }
    case "note_create": {
      const note = repos.notes.add(intent.content, intent.tags);
      botReply = `📝 Note saved (#${note.id}).`;
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
    case "fallback": {
      botReply = "I could not parse that. Supported: expenses, reminders, notes, note search/list/delete.";
      break;
    }
  }

  const botMessage = repos.messages.add("bot", botReply);
  return { user: userMessage, bot: botMessage };
}
