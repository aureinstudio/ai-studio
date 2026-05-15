"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCaseForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [headline, setHeadline] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [author, setAuthor] = useState("");
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/case-studies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_name: name, industry, headline, problem, solution,
          testimonial, testimonial_author: author, published,
        }),
      });
      if (res.ok) {
        setName(""); setIndustry(""); setHeadline(""); setProblem("");
        setSolution(""); setTestimonial(""); setAuthor(""); setPublished(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="고객사명 *" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="업종 (예: 자격증 학원)" className="rounded-md border bg-background px-3 py-2 text-sm" />
      </div>
      <input value={headline} onChange={(e) => setHeadline(e.target.value)} required placeholder="헤드라인 *" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="문제 (사용 전)" rows={2} className="w-full rounded-md border bg-background p-3 text-sm" />
      <textarea value={solution} onChange={(e) => setSolution(e.target.value)} placeholder="솔루션 (어떻게 사용했는가)" rows={2} className="w-full rounded-md border bg-background p-3 text-sm" />
      <textarea value={testimonial} onChange={(e) => setTestimonial(e.target.value)} placeholder="고객 추천사" rows={2} className="w-full rounded-md border bg-background p-3 text-sm" />
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="추천사 작성자 (이름·직책)" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        즉시 공개 (영업 자료에 활용)
      </label>
      <button type="submit" disabled={busy || !name || !headline} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {busy ? "저장 중..." : "사례 추가"}
      </button>
    </form>
  );
}
