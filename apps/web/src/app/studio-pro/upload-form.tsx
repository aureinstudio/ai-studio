"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "certification", label: "자격증" },
  { value: "professional", label: "직무" },
  { value: "language", label: "언어" },
  { value: "hobby", label: "취미" },
  { value: "academic", label: "학술" },
];

export default function UploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("professional");
  const [synthVideo, setSynthVideo] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true);
    setMsg(null);

    try {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("course_category", category);
      fd.set("synthesize_video", synthVideo ? "1" : "0");
      fd.set("file", file);

      const res = await fetch("/api/studio-pro/generate", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        setMsg("✅ 작업 시작 — 진행 상황은 페이지를 새로고침하면 확인됩니다.");
        setTitle("");
        setFile(null);
        router.refresh();
      } else {
        setMsg(`❌ ${json.error ?? "실패"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">제목 *</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="예: React Hooks 실전 가이드"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">카테고리</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={synthVideo}
            onChange={(e) => setSynthVideo(e.target.checked)}
            className="h-4 w-4"
          />
          <span>영상 합성까지 진행</span>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">강의 자료 (.md / .txt) *</span>
        <input
          type="file"
          accept=".md,.txt,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        {file && <div className="mt-1 text-xs text-muted-foreground">{file.name} · {Math.round(file.size / 1024)} KB</div>}
      </label>

      <div className="flex items-center justify-between pt-2">
        {msg && <span className="text-sm">{msg}</span>}
        <button
          type="submit"
          disabled={busy || !file || !title.trim()}
          className="ml-auto rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "처리 중..." : "업로드 + 생성 시작"}
        </button>
      </div>
    </form>
  );
}
