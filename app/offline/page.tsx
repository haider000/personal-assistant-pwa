export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10 pt-safe pb-safe">
      <div className="glass-panel-strong w-full max-w-md rounded-[2rem] p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold uppercase tracking-[0.24em] text-amber-800">
          Off
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">You are offline</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
          Your assistant shell is still available. Expense, note, and reminder commands you type in the app are queued
          locally and sync automatically when your connection comes back.
        </p>
        <div className="mt-6 rounded-[1.5rem] bg-white/85 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Works well offline</p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>`spent 12 coffee`</p>
            <p>`note: buy batteries #home`</p>
            <p>`remind me to stretch at 7pm`</p>
          </div>
        </div>
      </div>
    </main>
  );
}
