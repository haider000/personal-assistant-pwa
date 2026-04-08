export type MessageRole = "user" | "bot" | "system";

export interface Message {
  id: number;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Expense {
  id: number;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
}

export interface Reminder {
  id: number;
  content: string;
  remindAt: string;
  delivered: boolean;
  createdAt: string;
}

export interface Note {
  id: number;
  content: string;
  tags: string[];
  createdAt: string;
}

export type ChatIntentType =
  | "expense_add"
  | "expense_report"
  | "expense_list"
  | "reminder_create"
  | "reminder_list"
  | "note_create"
  | "note_list"
  | "note_search"
  | "note_delete"
  | "help"
  | "fallback";

export type ParsedIntent =
  | {
      type: "expense_add";
      amount: number;
      category: string;
      date: string;
    }
  | {
      type: "expense_report";
      range: "daily" | "weekly" | "monthly" | "yearly";
    }
  | {
      type: "expense_list";
      limit: number;
    }
  | {
      type: "reminder_create";
      content: string;
      remindAt: string;
    }
  | {
      type: "reminder_list";
    }
  | {
      type: "note_create";
      content: string;
      tags: string[];
    }
  | {
      type: "note_list";
    }
  | {
      type: "note_search";
      keyword: string;
    }
  | {
      type: "note_delete";
      noteId: number;
    }
  | {
      type: "help";
    }
  | {
      type: "fallback";
      reason: string;
    };
