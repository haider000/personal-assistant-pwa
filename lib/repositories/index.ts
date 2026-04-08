import { env } from "@/lib/config/env";
import type { RepositoryBundle } from "@/lib/repositories/types";
import { sqliteExpenseRepository } from "@/lib/repositories/sqlite/expenses-repository";
import { sqliteMessageRepository } from "@/lib/repositories/sqlite/messages-repository";
import { sqliteNoteRepository } from "@/lib/repositories/sqlite/notes-repository";
import { sqliteReminderRepository } from "@/lib/repositories/sqlite/reminders-repository";

function buildSqliteRepositories(): RepositoryBundle {
  return {
    messages: sqliteMessageRepository,
    expenses: sqliteExpenseRepository,
    reminders: sqliteReminderRepository,
    notes: sqliteNoteRepository,
  };
}

export function getRepositories(): RepositoryBundle {
  if (env.dbProvider === "sqlite") {
    return buildSqliteRepositories();
  }

  if (env.dbProvider === "mongodb") {
    throw new Error(
      "MongoDB provider is not implemented yet. The repository abstraction is ready for swapping providers."
    );
  }

  throw new Error(`Unsupported DB_PROVIDER: ${env.dbProvider}`);
}
