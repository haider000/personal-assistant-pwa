import { getDb } from "@/lib/db/client";
import type { Note } from "@/lib/shared/types";

function toNote(row: Record<string, unknown>): Note {
  const rawTags = (row.tags as string | null) ?? "";
  return {
    id: row.id as number,
    content: row.content as string,
    tags: rawTags ? rawTags.split(",").filter(Boolean) : [],
    createdAt: row.created_at as string,
  };
}

export const sqliteNoteRepository = {
  add(content: string, tags: string[]): Note {
    const db = getDb();
    const createdAt = new Date().toISOString();
    const normalizedTags = Array.from(new Set(tags.map((tag) => tag.toLowerCase())));

    const result = db
      .prepare(`INSERT INTO notes (content, tags, created_at) VALUES (?, ?, ?)`)
      .run(content, normalizedTags.join(","), createdAt);

    return {
      id: Number(result.lastInsertRowid),
      content,
      tags: normalizedTags,
      createdAt,
    };
  },

  list(limit = 100): Note[] {
    const db = getDb();
    const rows = db
      .prepare(
        `
          SELECT id, content, tags, created_at
          FROM notes
          ORDER BY id DESC
          LIMIT ?
        `
      )
      .all(limit) as Record<string, unknown>[];

    return rows.map(toNote);
  },

  search(keyword: string): Note[] {
    const db = getDb();
    const q = `%${keyword.toLowerCase()}%`;
    const rows = db
      .prepare(
        `
          SELECT id, content, tags, created_at
          FROM notes
          WHERE lower(content) LIKE ? OR lower(COALESCE(tags, '')) LIKE ?
          ORDER BY id DESC
        `
      )
      .all(q, q) as Record<string, unknown>[];

    return rows.map(toNote);
  },

  delete(noteId: number): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM notes WHERE id = ?`).run(noteId);
    return result.changes > 0;
  },
};
