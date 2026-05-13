"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ModuleCheckbox({ moduleKey, completed }: { moduleKey: string; completed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/instructor/training", {
        method: completed ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ module_key: moduleKey }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
        completed ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "hover:bg-muted"
      }`}
    >
      {completed ? "✓ 완료" : "완료 표시"}
    </button>
  );
}
