"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IssueCertificateForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [category, setCategory] = useState("certification");
  const [score, setScore] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !name || !courseName) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_email: email,
          student_name: name,
          course_name: courseName,
          course_category: category,
          score: score === "" ? null : Number(score),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ ${json.certificate_number} 발급. /certificates/${json.certificate_number}`);
        setName(""); setCourseName(""); setScore("");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="학생 이메일 *" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="학생 이름 *" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <input value={courseName} onChange={(e) => setCourseName(e.target.value)} required placeholder="과정명 *" className="md:col-span-2 rounded-md border bg-background px-3 py-2 text-sm" />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        <option value="certification">자격증</option>
        <option value="professional">직무</option>
        <option value="language">언어</option>
        <option value="hobby">취미</option>
        <option value="academic">학술</option>
      </select>
      <input type="number" min={0} max={100} step={0.1} value={score} onChange={(e) => setScore(e.target.value === "" ? "" : Number(e.target.value))} placeholder="점수 0-100 (선택)" className="rounded-md border bg-background px-3 py-2 text-sm" />
      <div className="md:col-span-2 flex items-center justify-between">
        {msg && <span className="text-sm">{msg}</span>}
        <button type="submit" disabled={busy || !email || !name || !courseName} className="ml-auto rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "발급 중..." : "수료증 발급"}
        </button>
      </div>
    </form>
  );
}
