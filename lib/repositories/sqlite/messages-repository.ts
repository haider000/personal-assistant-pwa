import { getDb } from "@/lib/db/client";
import type { Message, MessageRole } from "@/lib/shared/types";

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as number,
    role: row.role as MessageRole,
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

export const sqliteMessageRepository = {
  add(role: MessageRole, content: string, createdAt?: string): Message {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO messages (role, content, created_at) VALUES (?, ?, ?)`
    );

    const at = createdAt ?? new Date().toISOString();
    const result = stmt.run(role, content, at);

    return {
      id: Number(result.lastInsertRowid),
      role,
      content,
      createdAt: at,
    };
  },

  list(limit = 200): Message[] {
    const db = getDb();
    const rows = db
      .prepare(
        `
          SELECT id, role, content, created_at
          FROM messages
          ORDER BY id DESC
          LIMIT ?
        `
      )
      .all(limit) as Record<string, unknown>[];

    return rows.reverse().map(rowToMessage);
  },
};
