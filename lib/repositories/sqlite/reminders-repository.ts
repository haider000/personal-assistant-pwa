import { getDb } from "@/lib/db/client";
import type { Reminder } from "@/lib/shared/types";

function toReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as number,
    content: row.content as string,
    remindAt: row.remind_at as string,
    delivered: Number(row.delivered) === 1,
    createdAt: row.created_at as string,
  };
}

export const sqliteReminderRepository = {
  add(content: string, remindAt: string): Reminder {
    const db = getDb();
    const createdAt = new Date().toISOString();
    const result = db
      .prepare(`INSERT INTO reminders (content, remind_at, delivered, created_at) VALUES (?, ?, 0, ?)`)
      .run(content, remindAt, createdAt);

    return {
      id: Number(result.lastInsertRowid),
      content,
      remindAt,
      delivered: false,
      createdAt,
    };
  },

  listDue(nowIso: string): Reminder[] {
    const db = getDb();
    const rows = db
      .prepare(
        `
          SELECT id, content, remind_at, delivered, created_at
          FROM reminders
          WHERE delivered = 0 AND remind_at <= ?
          ORDER BY remind_at ASC
        `
      )
      .all(nowIso) as Record<string, unknown>[];
    return rows.map(toReminder);
  },

  markDelivered(id: number): void {
    const db = getDb();
    db.prepare(`UPDATE reminders SET delivered = 1 WHERE id = ?`).run(id);
  },

  listUpcoming(limit = 20): Reminder[] {
    const db = getDb();
    const rows = db
      .prepare(
        `
          SELECT id, content, remind_at, delivered, created_at
          FROM reminders
          WHERE delivered = 0
          ORDER BY remind_at ASC
          LIMIT ?
        `
      )
      .all(limit) as Record<string, unknown>[];

    return rows.map(toReminder);
  },

  delete(id: number): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM reminders WHERE id = ?`).run(id);
    return result.changes > 0;
  },
};
