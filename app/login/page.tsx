"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("Wrong password");
        return;
      }

      router.replace("/chat");
      router.refresh();
    } catch {
      setError("Unable to login right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute left-[8%] top-[10%] h-40 w-40 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute right-[10%] top-[14%] h-56 w-56 rounded-full bg-teal-300/30 blur-3xl" />
        <div className="absolute bottom-[12%] left-[16%] h-64 w-64 rounded-full bg-orange-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <span className="inline-flex rounded-full border border-white/60 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 backdrop-blur">
            Offline-first workspace
          </span>
          <div className="max-w-2xl">
            <h1 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
              Personal admin without the clutter.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">
              Track expenses, capture notes, and queue reminders from one private assistant that keeps working
              even when your connection does not.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Fast capture", text: "Natural commands for daily logging" },
              { label: "Private by default", text: "Local storage with a minimal auth layer" },
              { label: "Always available", text: "Queued actions sync when you reconnect" },
            ].map((item) => (
              <div key={item.label} className="glass-panel rounded-3xl p-4">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
          <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-teal-700">Sign in</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use your assistant password to unlock your workspace.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                  placeholder="Enter password"
                  required
                  autoFocus
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Enter assistant"}
              </button>
            </form>

            {error ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}

            <div className="mt-6 rounded-2xl bg-slate-900 px-4 py-4 text-sm text-slate-200">
              Try commands like <span className="font-medium text-white">spent 18 coffee</span> or{" "}
              <span className="font-medium text-white">note: renew passport</span>.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
