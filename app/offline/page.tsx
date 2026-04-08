export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-20 text-center">
      <h1 className="text-3xl font-semibold text-slate-900">You are offline</h1>
      <p className="mx-auto mt-3 max-w-md text-slate-600">
        Notes and expense commands are queued locally and will sync automatically once you are back online.
      </p>
    </main>
  );
}
