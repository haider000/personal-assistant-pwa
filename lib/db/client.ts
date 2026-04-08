import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { env } from "@/lib/config/env";

type DbInstance = Database.Database;

declare global {
  var __pa_db__: DbInstance | undefined;
}

function init(db: DbInstance) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      remind_at TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_notes_content ON notes(content);
    CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at, delivered);
  `);
}

function createDb(): DbInstance {
  const dbPath = path.resolve(process.cwd(), env.databaseUrl);
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(dbPath);
  init(db);
  return db;
}

export function getDb(): DbInstance {
  if (!global.__pa_db__) {
    global.__pa_db__ = createDb();
  }
  return global.__pa_db__;
}
