"use client";

import { FormEvent, KeyboardEvent, startTransition, useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";

import type { Expense, Message, Note, Reminder } from "@/lib/shared/types";
import { parseOfflineIntent } from "@/lib/shared/offline-intent";

type PendingItem = {
  message: string;
  createdAt: string;
};

type ReportRange = "daily" | "weekly" | "monthly" | "yearly";

type ExpenseReport = {
  range: ReportRange;
  total: number;
  count: number;
  rows: Expense[];
};

type MobileTab = "chat" | "overview" | "reminders" | "notes";
type SuggestedCommand = {
  text: string;
  score: number;
};

const QUEUE_KEY = "pa_pending_queue";
const FREQUENT_COMMANDS_KEY = "pa_frequent_commands";
const WORKSPACE_CACHE_KEY = "pa_workspace_cache";
const commandTemplates = [
  "spent 250 groceries",
  "report this month",
  "note: buy milk #shopping",
  "remind me to call mom at 7pm",
  "show notes",
  "show reminders",
];

function loadQueue(): PendingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

type WorkspaceCache = {
  messages?: Message[];
  report?: ExpenseReport | null;
  reminders?: Reminder[];
  recentExpenses?: Expense[];
  notes?: Note[];
};

function loadWorkspaceCache(): WorkspaceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceCache;
  } catch {
    return null;
  }
}

function saveWorkspaceCache(cache: WorkspaceCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors for optional offline cache.
  }
}

function loadFrequentCommands(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FREQUENT_COMMANDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ text: string; count: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.text === "string" && typeof item.count === "number")
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((item) => item.text);
  } catch {
    return [];
  }
}

function storeFrequentCommand(text: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(FREQUENT_COMMANDS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<{ text: string; count: number }>) : [];
    const next = Array.isArray(parsed) ? parsed : [];
    const normalized = text.trim();
    const existing = next.find((item) => item.text === normalized);
    if (existing) {
      existing.count += 1;
    } else {
      next.push({ text: normalized, count: 1 });
    }
    next.sort((a, b) => b.count - a.count);
    window.localStorage.setItem(FREQUENT_COMMANDS_KEY, JSON.stringify(next.slice(0, 12)));
  } catch {
    // Ignore localStorage issues for optional suggestions.
  }
}

function buildSmartSuggestions(messages: Message[]): string[] {
  const expenseMap = new Map<string, { count: number; amount: number }>();
  const genericMap = new Map<string, number>();

  for (const message of messages) {
    if (message.role !== "user") continue;

    const text = message.content.trim();
    if (!text) continue;

    const expenseMatch = text.match(/^(?:spent|add\s+expense|expense)\s+(\d+(?:\.\d+)?)\s+(?:on\s+)?(.+)$/i);
    if (expenseMatch) {
      const amount = Number(expenseMatch[1]);
      const category = expenseMatch[2].trim().toLowerCase();
      if (Number.isFinite(amount) && category) {
        const existing = expenseMap.get(category) ?? { count: 0, amount };
        existing.count += 1;
        existing.amount = amount;
        expenseMap.set(category, existing);
      }
      continue;
    }

    if (/^(?:report|show notes|show reminders|help|note:|remind me|set reminder)/i.test(text)) {
      genericMap.set(text, (genericMap.get(text) ?? 0) + 1);
    }
  }

  const suggestions: SuggestedCommand[] = [
    ...Array.from(expenseMap.entries()).map(([category, value]) => ({
      text: `spent ${value.amount} ${category}`,
      score: value.count + 2,
    })),
    ...Array.from(genericMap.entries()).map(([text, count]) => ({
      text,
      score: count,
    })),
  ];

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.text);
}

function createClientMessage(role: Message["role"], content: string): Message {
  return {
    id: -1 * Math.floor(Math.random() * 1000000),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [reportRange, setReportRange] = useState<ReportRange>("monthly");
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteQuery, setNoteQuery] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [frequentCommands, setFrequentCommands] = useState<string[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const deferredNoteQuery = useDeferredValue(noteQuery.trim());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);

    async function bootstrap() {
      try {
        const [messagesResponse, reportResponse, remindersResponse, expensesResponse, notesResponse] = await Promise.all([
          fetch("/api/messages", { cache: "no-store" }),
          fetch("/api/expenses/report?range=monthly", { cache: "no-store" }),
          fetch("/api/reminders", { cache: "no-store" }),
          fetch("/api/expenses?limit=6", { cache: "no-store" }),
          fetch("/api/notes", { cache: "no-store" }),
        ]);

        if (
          !messagesResponse.ok ||
          !reportResponse.ok ||
          !remindersResponse.ok ||
          !expensesResponse.ok ||
          !notesResponse.ok
        ) {
          throw new Error("bootstrap failed");
        }

        const [messagesData, reportData, remindersData, expensesData, notesData] = await Promise.all([
          messagesResponse.json() as Promise<{ messages: Message[] }>,
          reportResponse.json() as Promise<ExpenseReport>,
          remindersResponse.json() as Promise<{ reminders: Reminder[] }>,
          expensesResponse.json() as Promise<{ expenses: Expense[] }>,
          notesResponse.json() as Promise<{ notes: Note[] }>,
        ]);

        startTransition(() => {
          setMessages(messagesData.messages ?? []);
          setReport(reportData);
          setReminders(remindersData.reminders ?? []);
          setRecentExpenses(expensesData.expenses ?? []);
          setNotes(notesData.notes ?? []);
        });
        saveWorkspaceCache({
          messages: messagesData.messages ?? [],
          report: reportData,
          reminders: remindersData.reminders ?? [],
          recentExpenses: expensesData.expenses ?? [],
          notes: notesData.notes ?? [],
        });
      } catch {
        const cached = loadWorkspaceCache();
        if (cached) {
          startTransition(() => {
            setMessages(cached.messages ?? []);
            setReport(cached.report ?? null);
            setReminders(cached.reminders ?? []);
            setRecentExpenses(cached.recentExpenses ?? []);
            setNotes(cached.notes ?? []);
          });
          setError("Offline mode: showing your last saved workspace snapshot.");
        } else {
          setError("Unable to load your assistant workspace.");
        }
      }
    }

    void bootstrap();
    const queue = loadQueue();
    setPendingCount(queue.length);
    setFrequentCommands(loadFrequentCommands());

    const handleOnline = () => {
      setIsOnline(true);
      void flushQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    setSmartSuggestions(buildSmartSuggestions(messages));
  }, [messages]);

  useEffect(() => {
    async function refreshPanels() {
      try {
        const reportUrl = `/api/expenses/report?range=${reportRange}`;
        const notesUrl = deferredNoteQuery ? `/api/notes?q=${encodeURIComponent(deferredNoteQuery)}` : "/api/notes";

        const [reportResponse, remindersResponse, expensesResponse, notesResponse] = await Promise.all([
          fetch(reportUrl, { cache: "no-store" }),
          fetch("/api/reminders", { cache: "no-store" }),
          fetch("/api/expenses?limit=6", { cache: "no-store" }),
          fetch(notesUrl, { cache: "no-store" }),
        ]);

        if (!reportResponse.ok || !remindersResponse.ok || !expensesResponse.ok || !notesResponse.ok) {
          throw new Error("refresh failed");
        }

        const [reportData, remindersData, expensesData, notesData] = await Promise.all([
          reportResponse.json() as Promise<ExpenseReport>,
          remindersResponse.json() as Promise<{ reminders: Reminder[] }>,
          expensesResponse.json() as Promise<{ expenses: Expense[] }>,
          notesResponse.json() as Promise<{ notes: Note[] }>,
        ]);

        startTransition(() => {
          setReport(reportData);
          setReminders(remindersData.reminders ?? []);
          setRecentExpenses(expensesData.expenses ?? []);
          setNotes(notesData.notes ?? []);
        });
        const cached = loadWorkspaceCache();
        saveWorkspaceCache({
          messages: cached?.messages ?? [],
          report: reportData,
          reminders: remindersData.reminders ?? [],
          recentExpenses: expensesData.expenses ?? [],
          notes: notesData.notes ?? [],
        });
      } catch {
        setError("Unable to refresh assistant panels right now.");
      }
    }

    void refreshPanels();
  }, [reportRange, deferredNoteQuery]);

  async function refreshMessages() {
    const response = await fetch("/api/messages", { cache: "no-store" });
    if (!response.ok) throw new Error("messages failed");
    const data = (await response.json()) as { messages: Message[] };
    startTransition(() => {
      setMessages(data.messages ?? []);
    });
    saveWorkspaceCache({
      messages: data.messages ?? [],
      report,
      reminders,
      recentExpenses,
      notes,
    });
  }

  async function refreshPanelsNow() {
    const reportUrl = `/api/expenses/report?range=${reportRange}`;
    const notesUrl = deferredNoteQuery ? `/api/notes?q=${encodeURIComponent(deferredNoteQuery)}` : "/api/notes";
    const [reportResponse, remindersResponse, expensesResponse, notesResponse] = await Promise.all([
      fetch(reportUrl, { cache: "no-store" }),
      fetch("/api/reminders", { cache: "no-store" }),
      fetch("/api/expenses?limit=6", { cache: "no-store" }),
      fetch(notesUrl, { cache: "no-store" }),
    ]);

    if (!reportResponse.ok || !remindersResponse.ok || !expensesResponse.ok || !notesResponse.ok) {
      throw new Error("refresh failed");
    }

    const [reportData, remindersData, expensesData, notesData] = await Promise.all([
      reportResponse.json() as Promise<ExpenseReport>,
      remindersResponse.json() as Promise<{ reminders: Reminder[] }>,
      expensesResponse.json() as Promise<{ expenses: Expense[] }>,
      notesResponse.json() as Promise<{ notes: Note[] }>,
    ]);

    startTransition(() => {
      setReport(reportData);
      setReminders(remindersData.reminders ?? []);
      setRecentExpenses(expensesData.expenses ?? []);
      setNotes(notesData.notes ?? []);
    });
    saveWorkspaceCache({
      messages,
      report: reportData,
      reminders: remindersData.reminders ?? [],
      recentExpenses: expensesData.expenses ?? [],
      notes: notesData.notes ?? [],
    });
  }

  const flushQueue = useEffectEvent(async () => {
    const queue = loadQueue();
    if (!queue.length) {
      setPendingCount(0);
      return;
    }

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue }),
      });

      if (!response.ok) {
        throw new Error("sync failed");
      }

      const data = (await response.json()) as {
        synced: Array<{ user: Message; bot: Message }>;
      };

      const syncedMessages = data.synced.flatMap((pair) => [pair.user, pair.bot]);
      const nextMessages = [...messages, ...syncedMessages];
      startTransition(() => {
        setMessages(nextMessages);
      });
      saveWorkspaceCache({
        messages: nextMessages,
        report,
        reminders,
        recentExpenses,
        notes,
      });

      saveQueue([]);
      setPendingCount(0);
      await refreshPanelsNow();
    } catch {
      setError("Offline sync failed. Your queued commands are still safe.");
    }
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function sendOnline(message: string, createdAt: string) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, createdAt }),
    });

    if (!response.ok) {
      throw new Error("chat request failed");
    }

    const data = (await response.json()) as { user: Message; bot: Message };
    const nextMessages = [...messages, data.user, data.bot];
    startTransition(() => {
      setMessages(nextMessages);
    });
    saveWorkspaceCache({
      messages: nextMessages,
      report,
      reminders,
      recentExpenses,
      notes,
    });
    await refreshPanelsNow();
  }

  function enqueueOffline(message: string, createdAt: string) {
    const queue = loadQueue();
    queue.push({ message, createdAt });
    saveQueue(queue);
    setPendingCount(queue.length);

    const kind = parseOfflineIntent(message);
    const userMessage = createClientMessage("user", message);
    const botMessage =
      kind === "note"
        ? createClientMessage("bot", "Note saved locally. It will sync when you reconnect.")
        : kind === "expense"
          ? createClientMessage("bot", "Expense saved locally. It will sync when you reconnect.")
          : kind === "reminder"
            ? createClientMessage("bot", "Reminder queued locally. It will sync when you reconnect.")
            : createClientMessage("bot", "Message queued. It will be processed when you are online.");

    const nextMessages = [...messages, userMessage, botMessage];
    startTransition(() => {
      setMessages(nextMessages);
    });
    saveWorkspaceCache({
      messages: nextMessages,
      report,
      reminders,
      recentExpenses,
      notes,
    });
    storeFrequentCommand(message);
    setFrequentCommands(loadFrequentCommands());
  }

  async function submitCurrentMessage() {
    const message = input.trim();
    if (!message || loading) return;

    setInput("");
    setError("");
    setLoading(true);
    const createdAt = new Date().toISOString();

    try {
      if (!isOnline) {
        enqueueOffline(message, createdAt);
      } else {
        await sendOnline(message, createdAt);
        storeFrequentCommand(message);
        setFrequentCommands(loadFrequentCommands());
      }
    } catch {
      enqueueOffline(message, createdAt);
      setError("Network issue detected. Message queued for sync.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await submitCurrentMessage();
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) {
        void submitCurrentMessage();
      }
    }
  }

  async function clearHistory() {
    try {
      if (typeof window !== "undefined" && !window.confirm("Clear all chat history?")) {
        return;
      }
      setError("");
      const response = await fetch("/api/messages", { method: "DELETE" });
      if (!response.ok) throw new Error("clear failed");
      startTransition(() => {
        setMessages([]);
      });
      saveWorkspaceCache({
        messages: [],
        report,
        reminders,
        recentExpenses,
        notes,
      });
    } catch {
      setError("Unable to clear history right now.");
    }
  }

  async function clearCurrentMonthData() {
    try {
      if (
        typeof window !== "undefined" &&
        !window.confirm("Delete this month's expense entries? This cannot be undone.")
      ) {
        return;
      }

      setError("");
      const response = await fetch("/api/data?scope=month", { method: "DELETE" });
      if (!response.ok) throw new Error("clear month failed");
      await refreshPanelsNow();
    } catch {
      setError("Unable to clear this month's expenses right now.");
    }
  }

  async function clearAllData() {
    try {
      if (
        typeof window !== "undefined" &&
        !window.confirm("Delete all expenses, notes, reminders, and chat history? This cannot be undone.")
      ) {
        return;
      }

      setError("");
      const response = await fetch("/api/data?scope=all", { method: "DELETE" });
      if (!response.ok) throw new Error("clear all failed");

      saveQueue([]);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(FREQUENT_COMMANDS_KEY);
        window.localStorage.removeItem(WORKSPACE_CACHE_KEY);
      }

      startTransition(() => {
        setMessages([]);
        setReport({ range: reportRange, total: 0, count: 0, rows: [] });
        setReminders([]);
        setRecentExpenses([]);
        setNotes([]);
        setFrequentCommands([]);
        setSmartSuggestions([]);
      });
      setPendingCount(0);
      setInput("");
      saveWorkspaceCache({
        messages: [],
        report: { range: reportRange, total: 0, count: 0, rows: [] },
        reminders: [],
        recentExpenses: [],
        notes: [],
      });
    } catch {
      setError("Unable to clear all data right now.");
    }
  }

  async function dismissReminder(id: number) {
    try {
      setError("");
      const response = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      await refreshPanelsNow();
    } catch {
      setError("Unable to dismiss that reminder.");
    }
  }

  async function deleteExpense(id: number) {
    try {
      if (typeof window !== "undefined" && !window.confirm("Remove this expense entry?")) {
        return;
      }

      setError("");
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      await refreshPanelsNow();
    } catch {
      setError("Unable to remove that expense entry.");
    }
  }

  function queuePrompt(prompt: string) {
    setInput(prompt);
    setMobileTab("chat");
    inputRef.current?.focus();
  }

  const reportButtons: Array<{ label: string; value: ReportRange }> = [
    { label: "Today", value: "daily" },
    { label: "Week", value: "weekly" },
    { label: "Month", value: "monthly" },
    { label: "Year", value: "yearly" },
  ];

  const mobileTabs: Array<{ key: MobileTab; label: string }> = [
    { key: "chat", label: "Chat" },
    { key: "overview", label: "Overview" },
    { key: "reminders", label: "Reminders" },
    { key: "notes", label: "Notes" },
  ];

  const composerSuggestions = [
    ...commandTemplates.slice(0, 4),
    ...smartSuggestions.slice(0, 3),
    ...frequentCommands.slice(0, 3),
  ].filter((value, index, arr) => arr.indexOf(value) === index);

  return (
    <main className="h-[100dvh] overflow-hidden px-3 py-3 pb-28 pt-safe sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden">
        <header className="glass-panel-strong shrink-0 rounded-[1.5rem] px-3 py-3 sm:rounded-[2rem] sm:px-6 sm:py-4">
          <div className="hidden items-center justify-between gap-2 sm:flex">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isOnline ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                {pendingCount > 0 ? `${pendingCount} pending` : "All synced"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void refreshMessages();
                  void refreshPanelsNow();
                }}
                className="rounded-full border border-slate-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={logout}
                className="hidden rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 sm:inline-flex"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-2 hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-full border border-slate-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white"
            >
              Clear history
            </button>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isOnline ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
              {pendingCount > 0 ? `${pendingCount} pending` : "All synced"}
            </span>
            <button
              type="button"
              onClick={logout}
              className="ml-auto rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="mt-6 grid min-h-0 flex-1 gap-6 overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="hidden h-full min-h-0 overflow-y-auto pr-1 xl:block">
            <div className="space-y-4 pb-6">
            <section className="glass-panel rounded-[1.75rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Expense snapshot</p>
                  <p className="mt-1 text-sm text-slate-600">A quick read on your spending rhythm.</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {reportButtons.map((button) => (
                  <button
                    key={button.value}
                    type="button"
                    onClick={() => setReportRange(button.value)}
                    className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                      reportRange === button.value
                        ? "bg-slate-900 text-white"
                        : "bg-white/85 text-slate-700 hover:bg-white"
                    }`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[1.5rem] bg-slate-900 px-4 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Total</p>
                  <p className="mt-2 text-3xl font-semibold">{money(report?.total ?? 0)}</p>
                </div>
                <div className="rounded-[1.5rem] bg-amber-100 px-4 py-4 text-amber-900">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Entries</p>
                  <p className="mt-2 text-3xl font-semibold">{report?.count ?? 0}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void clearCurrentMonthData();
                  }}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  Clear this month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void clearAllData();
                  }}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900 transition hover:bg-rose-100"
                >
                  Clear all data
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-900">Recent expenses</p>
                {recentExpenses.length ? (
                  recentExpenses.map((expense) => (
                    <div key={expense.id} className="rounded-2xl bg-white/85 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize text-slate-900">{expense.category}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(expense.date)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{money(expense.amount)}</p>
                          <button
                            type="button"
                            onClick={() => {
                              void deleteExpense(expense.id);
                            }}
                            className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-slate-600">No expenses yet.</p>
                )}
              </div>
            </section>

            <section className="glass-panel rounded-[1.75rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Upcoming reminders</p>
                  <p className="mt-1 text-sm text-slate-600">Stay on top of what is about to fire.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {reminders.length ? (
                  reminders.map((reminder) => (
                    <div key={reminder.id} className="rounded-[1.35rem] bg-white/85 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{reminder.content}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(reminder.remindAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void dismissReminder(reminder.id);
                          }}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-slate-600">No upcoming reminders.</p>
                )}
              </div>
            </section>

            <section className="glass-panel rounded-[1.75rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notes library</p>
                  <p className="mt-1 text-sm text-slate-600">Search by phrase or hashtag.</p>
                </div>
              </div>

              <input
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
                placeholder="Search notes"
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />

              <div className="mt-4 space-y-3">
                {notes.length ? (
                  notes.slice(0, 6).map((note) => (
                    <div key={note.id} className="rounded-[1.35rem] bg-white/85 px-4 py-3">
                      <p className="text-sm text-slate-800">{note.content}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {note.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                            #{tag}
                          </span>
                        ))}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                          #{note.id}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-slate-600">
                    {deferredNoteQuery ? "No notes matched that search." : "No notes yet."}
                  </p>
                )}
              </div>
            </section>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col space-y-4 overflow-hidden">
            <section className={`glass-panel-strong flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] ${mobileTab !== "chat" ? "hidden sm:flex" : ""}`}>
            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-20 sm:px-6 sm:py-5 sm:pb-24">
              {!messages.length ? (
                <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-600">
                  Start with a simple command like <code>spent 25 groceries</code>, <code>show reminders</code>, or{" "}
                  <code>help</code>.
                </div>
              ) : null}

              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={`${message.id}-${message.createdAt}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] rounded-[1.6rem] px-4 py-3 shadow-sm sm:max-w-[78%] ${
                        isUser
                          ? "rounded-br-md bg-slate-900 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white/92 text-slate-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      <p className={`mt-2 text-[11px] ${isUser ? "text-slate-300" : "text-slate-500"}`}>
                        {new Date(message.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleSubmit}
              className="sticky bottom-0 z-10 border-t border-slate-200/70 bg-[rgba(255,255,255,0.78)] px-3 py-3 pb-safe backdrop-blur sm:px-6"
            >
              <div className="rounded-[1.5rem] border border-slate-200 bg-white/95 p-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:rounded-[1.75rem] sm:p-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Type a command"
                  className="min-h-14 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-slate-900 outline-none sm:min-h-16"
                  required
                />
                <div className="mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1">
                  {composerSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => queuePrompt(prompt)}
                      className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                  <p className="text-xs text-slate-500">Tap a suggestion to edit it quickly.</p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="h-4 w-4 fill-current"
                    >
                      <path d="M1.2 2.1a.75.75 0 0 1 .83-.12l12 5.5a.75.75 0 0 1 0 1.36l-12 5.5A.75.75 0 0 1 1 13.67V10.3l6.15-1.62a.5.5 0 0 0 0-.96L1 6.1V2.75c0-.27.14-.52.2-.65Z" />
                    </svg>
                    {loading ? "Working" : "Send"}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {error}
                </p>
              ) : null}
            </form>
            </section>

            <section className={`glass-panel rounded-[1.5rem] p-4 sm:hidden ${mobileTab !== "overview" ? "hidden" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Expense snapshot</p>
                  <p className="mt-1 text-sm text-slate-600">Quick money check without leaving your phone.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {reportButtons.map((button) => (
                  <button
                    key={button.value}
                    type="button"
                    onClick={() => setReportRange(button.value)}
                    className={`rounded-2xl px-2 py-2 text-xs font-medium transition ${
                      reportRange === button.value ? "bg-slate-900 text-white" : "bg-white/85 text-slate-700"
                    }`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-[1.35rem] bg-slate-900 px-4 py-4 text-white">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
                  {reportButtons.find((button) => button.value === reportRange)?.label ?? "Selected"}
                </p>
                <p className="mt-2 text-3xl font-semibold">{money(report?.total ?? 0)}</p>
                <p className="mt-1 text-xs text-slate-300">{report?.count ?? 0} entries</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void clearCurrentMonthData();
                  }}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
                >
                  Clear this month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void clearAllData();
                  }}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900"
                >
                  Clear all data
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {recentExpenses.length ? (
                  recentExpenses.map((expense) => (
                    <div key={expense.id} className="rounded-[1.35rem] bg-white/85 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize text-slate-900">{expense.category}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(expense.date)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-sm font-semibold text-slate-900">{money(expense.amount)}</p>
                          <button
                            type="button"
                            onClick={() => {
                              void deleteExpense(expense.id);
                            }}
                            className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-slate-600">No expenses yet.</p>
                )}
              </div>
            </section>

            <section className={`glass-panel rounded-[1.5rem] p-4 sm:hidden ${mobileTab !== "reminders" ? "hidden" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Upcoming reminders</p>
                  <p className="mt-1 text-sm text-slate-600">Easy to review on the go.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {reminders.length ? (
                  reminders.map((reminder) => (
                    <div key={reminder.id} className="rounded-[1.35rem] bg-white/85 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{reminder.content}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(reminder.remindAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void dismissReminder(reminder.id);
                          }}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-slate-600">No upcoming reminders.</p>
                )}
              </div>
            </section>

            <section className={`glass-panel rounded-[1.5rem] p-4 sm:hidden ${mobileTab !== "notes" ? "hidden" : ""}`}>
              <div>
                <p className="text-sm font-semibold text-slate-900">Notes library</p>
                <p className="mt-1 text-sm text-slate-600">Search notes quickly while you are out.</p>
              </div>
              <input
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
                placeholder="Search notes"
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
              <div className="mt-4 space-y-3">
                {notes.length ? (
                  notes.slice(0, 8).map((note) => (
                    <div key={note.id} className="rounded-[1.35rem] bg-white/85 px-4 py-3">
                      <p className="text-sm text-slate-800">{note.content}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {note.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-slate-600">
                    {deferredNoteQuery ? "No notes matched that search." : "No notes yet."}
                  </p>
                )}
              </div>
            </section>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/92 px-3 py-3 backdrop-blur pb-safe sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          {mobileTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMobileTab(tab.key)}
              className={`flex-1 rounded-2xl px-3 py-3 text-xs font-medium transition ${
                mobileTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
