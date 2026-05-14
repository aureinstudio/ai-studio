"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoiceUpload({ hasVoice }: { hasVoice: boolean }) {
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
      const res = await fetch("/api/instructor/assets/voice", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ ${json.message ?? "샘플 업로드 완료"}`);
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
        accept="audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <button
        type="submit"
        disabled={busy || !file}
        className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {busy ? "업로드 중..." : hasVoice ? "재업로드" : "업로드"}
      </button>
      {msg && <span className="text-xs">{msg}</span>}
    </form>
  );
}
