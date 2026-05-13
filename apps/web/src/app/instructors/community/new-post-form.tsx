"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"qa" | "best_practice">("qa");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/instructor/community", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, category }),
      });
      if (res.ok) {
        setTitle("");
        setBody("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as "qa" | "best_practice")} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="qa">Q&A</option>
          <option value="best_practice">베스트 프랙티스</option>
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          required
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="내용"
        required
        className="w-full rounded-md border bg-background p-3 text-sm"
      />
      <button type="submit" disabled={busy || !title.trim() || !body.trim()} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {busy ? "등록 중..." : "글쓰기"}
      </button>
    </form>
  );
}
