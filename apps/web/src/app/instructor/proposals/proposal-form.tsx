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

export default function ProposalForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [outline, setOutline] = useState("");
  const [category, setCategory] = useState("certification");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/instructor/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, topic, outline, course_category: category }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg("✅ 제안 접수 — SME 검토를 기다려 주세요.");
        setTitle("");
        setTopic("");
        setOutline("");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">제목</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">카테고리</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-sm block">
        <span className="mb-1 block text-muted-foreground">주제 (한 줄 요약)</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} required className="w-full rounded-md border bg-background px-3 py-2" />
      </label>
      <label className="text-sm block">
        <span className="mb-1 block text-muted-foreground">아웃라인 (선택)</span>
        <textarea value={outline} onChange={(e) => setOutline(e.target.value)} rows={5} className="w-full rounded-md border bg-background p-3" placeholder="장·절 구성, 핵심 학습 목표, 예상 분량 등" />
      </label>
      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button type="submit" disabled={busy || !title.trim() || !topic.trim()} className="ml-auto rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "제출 중..." : "제안하기"}
        </button>
      </div>
    </form>
  );
}
