import { getDb } from "@/lib/db/client";
import type { Expense } from "@/lib/shared/types";

function toExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as number,
    amount: Number(row.amount),
    category: row.category as string,
    date: row.date as string,
    createdAt: row.created_at as string,
  };
}

function getStartDate(range: "daily" | "weekly" | "monthly" | "yearly", reference = new Date()): Date {
  const d = new Date(reference);
  if (range === "daily") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "weekly") {
    const weekday = d.getDay();
    const diff = weekday === 0 ? 6 : weekday - 1;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "yearly") {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const sqliteExpenseRepository = {
  add(amount: number, category: string, date: string): Expense {
    const db = getDb();
    const createdAt = new Date().toISOString();

    const result = db
      .prepare(`INSERT INTO expenses (amount, category, date, created_at) VALUES (?, ?, ?, ?)`)
      .run(amount, category.toLowerCase(), date, createdAt);

    return {
      id: Number(result.lastInsertRowid),
      amount,
      category: category.toLowerCase(),
      date,
      createdAt,
    };
  },

  list(limit = 20): Expense[] {
    const db = getDb();
    const rows = db
      .prepare(
        `
          SELECT id, amount, category, date, created_at
          FROM expenses
          ORDER BY date DESC, id DESC
          LIMIT ?
        `
      )
      .all(limit) as Record<string, unknown>[];

    return rows.map(toExpense);
  },

  delete(expenseId: number): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM expenses WHERE id = ?`).run(expenseId);
    return result.changes > 0;
  },

  clearAll(): number {
    const db = getDb();
    const result = db.prepare(`DELETE FROM expenses`).run();
    return result.changes;
  },

  clearMonth(reference = new Date()): number {
    const db = getDb();
    const startDate = getStartDate("monthly", reference).toISOString();
    const nextMonth = new Date(reference);
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    nextMonth.setHours(0, 0, 0, 0);

    const result = db.prepare(`DELETE FROM expenses WHERE date >= ? AND date < ?`).run(startDate, nextMonth.toISOString());
    return result.changes;
  },

  report(range: "daily" | "weekly" | "monthly" | "yearly", reference = new Date()) {
    const db = getDb();
    const startDate = getStartDate(range, reference).toISOString();

    const rows = db
      .prepare(
        `
          SELECT id, amount, category, date, created_at
          FROM expenses
          WHERE date >= ?
          ORDER BY date DESC, id DESC
        `
      )
      .all(startDate) as Record<string, unknown>[];

    const expenses = rows.map(toExpense);
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);

    return {
      total,
      count: expenses.length,
      rows: expenses,
    };
  },
};
