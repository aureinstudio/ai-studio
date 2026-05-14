"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PhotoUpload({ hasPhoto }: { hasPhoto: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/instructor/assets/photo", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ 등록 완료 (talking_photo_id: ${json.talking_photo_id?.slice(0, 12)}...)`);
        setFile(null);
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <button
        type="submit"
        disabled={busy || !file}
        className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? "등록 중..." : hasPhoto ? "재등록" : "등록"}
      </button>
      {msg && <span className="text-xs">{msg}</span>}
    </form>
  );
}
