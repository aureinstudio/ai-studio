"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["how-to", "case-study", "industry", "announcement"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export default function NewPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("how-to");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title, slug: slug || slugify(title), category, excerpt, body_md: body,
          status: publish ? "published" : "draft",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ 저장됨 — /blog/${slug || slugify(title)}`);
        setTitle(""); setSlug(""); setExcerpt(""); setBody("");
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
        <input value={title} onChange={(e) => { setTitle(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} required placeholder="제목 *" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required pattern="[a-z0-9가-힣-]+" placeholder="slug (URL) *" className="rounded-md border bg-background px-3 py-2 text-sm font-mono" />
      </div>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="요약 (목록 노출용)" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={10} placeholder="본문 (markdown — # ## ### - ``` 지원)" className="w-full rounded-md border bg-background p-3 text-sm font-mono" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
        즉시 발행 (/blog에서 공개)
      </label>
      <div className="flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button type="submit" disabled={busy || !title || !body} className="ml-auto rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "저장 중..." : publish ? "발행" : "초안 저장"}
        </button>
      </div>
    </form>
  );
}
