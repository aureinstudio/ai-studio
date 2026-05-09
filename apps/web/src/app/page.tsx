export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          ai-studio
        </h1>

        <p className="text-lg text-zinc-600 dark:text-zinc-400 sm:text-xl">
          KEG 자체 AI 교육 플랫폼
        </p>

        <p className="mt-8 font-mono text-sm text-zinc-500 dark:text-zinc-500">
          v0.1.0 — Built on 2026-05-09
        </p>
      </div>

      <footer className="mt-24 text-xs tracking-widest text-zinc-400 dark:text-zinc-600">
        Powered by Aurein AX
      </footer>
    </main>
  );
}
