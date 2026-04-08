import type { Expense, Message, MessageRole, Note, Reminder } from "@/lib/shared/types";

export interface MessageRepository {
  add(role: MessageRole, content: string, createdAt?: string): Message;
  list(limit?: number): Message[];
  clear(): void;
}

export interface ExpenseRepository {
  add(amount: number, category: string, date: string): Expense;
  list(limit?: number): Expense[];
  delete(expenseId: number): boolean;
  clearAll(): number;
  clearMonth(reference?: Date): number;
  report(range: "daily" | "weekly" | "monthly" | "yearly", reference?: Date): {
    total: number;
    count: number;
    rows: Expense[];
  };
}

export interface ReminderRepository {
  add(content: string, remindAt: string): Reminder;
  listDue(nowIso: string): Reminder[];
  markDelivered(id: number): void;
  listUpcoming(limit?: number): Reminder[];
  delete(id: number): boolean;
  clear(): number;
}

export interface NoteRepository {
  add(content: string, tags: string[]): Note;
  list(limit?: number): Note[];
  search(keyword: string): Note[];
  delete(noteId: number): boolean;
  clear(): number;
}

export interface RepositoryBundle {
  messages: MessageRepository;
  expenses: ExpenseRepository;
  reminders: ReminderRepository;
  notes: NoteRepository;
}
