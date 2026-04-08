"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type { Message } from "@/lib/shared/types";
import { parseOfflineIntent } from "@/lib/shared/offline-intent";

type PendingItem = {
  message: string;
  createdAt: string;
};

const QUEUE_KEY = "pa_pending_queue";

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

function createClientMessage(role: Message["role"], content: string): Message {
  return {
    id: -1 * Math.floor(Math.random() * 1000000),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  useEffect(() => {
    setIsOnline(window.navigator.onLine);

    async function loadMessages() {
      try {
        const response = await fetch("/api/messages", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }

        const data = (await response.json()) as { messages: Message[] };
        setMessages(data.messages ?? []);
      } catch {
        setError("Unable to load message history.");
      }
    }

    loadMessages();
    const queue = loadQueue();
    setPendingCount(queue.length);

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
  }, [sortedMessages, loading]);

  async function flushQueue() {
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
      setMessages((prev) => [...prev, ...syncedMessages]);

      saveQueue([]);
      setPendingCount(0);
    } catch {
      setError("Offline sync failed. Your queued commands are safe.");
    }
  }

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
    setMessages((prev) => [...prev, data.user, data.bot]);
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
        ? createClientMessage("bot", "📝 Note saved locally. It will sync when you reconnect.")
        : kind === "expense"
          ? createClientMessage("bot", "Expense saved locally. It will sync when you reconnect.")
          : createClientMessage("bot", "Message queued. It will be processed when you are online.");

    setMessages((prev) => [...prev, userMessage, botMessage]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
      }
    } catch {
      enqueueOffline(message, createdAt);
      setError("Network issue detected. Message queued for sync.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-3xl flex-col bg-gradient-to-b from-slate-200 via-slate-100 to-white">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Private Assistant</h1>
            <p className="text-xs text-slate-600">
              {isOnline ? "Online" : "Offline"}
              {pendingCount > 0 ? ` • ${pendingCount} pending sync` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
        {!sortedMessages.length ? (
          <div className="rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
            Try messages like: <code>spent 250 food</code>, <code>note: buy milk</code>, <code>show notes</code>.
          </div>
        ) : null}

        {sortedMessages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={`${message.id}-${message.createdAt}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm sm:max-w-[75%] ${
                  isUser ? "rounded-br-sm bg-sky-600 text-white" : "rounded-bl-sm bg-white text-slate-900"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className={`mt-1 text-[11px] ${isUser ? "text-sky-100" : "text-slate-500"}`}>
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command..."
            className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-900 outline-none ring-sky-200 focus:ring"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Send
          </button>
        </div>
        {loading ? <p className="mt-2 text-xs text-slate-500">Working on it...</p> : null}
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </form>
    </main>
  );
}
