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

function getStartDate(range: "daily" | "weekly" | "monthly", reference = new Date()): Date {
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

  report(range: "daily" | "weekly" | "monthly", reference = new Date()) {
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
