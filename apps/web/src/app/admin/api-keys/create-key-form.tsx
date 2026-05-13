"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; email: string; role: string };

export default function CreateKeyForm({ users }: { users: User[] }) {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [name, setName] = useState("");
  const [rpm, setRpm] = useState(60);
  const [cap, setCap] = useState(100);
  const [scopes, setScopes] = useState<string[]>(["studio", "cast", "tutor"]);
  const [loading, setLoading] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggleScope(s: string) {
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setPlaintext(null);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner_user_id: ownerId,
          name,
          scopes,
          rate_limit_per_min: rpm,
          monthly_cost_cap_usd: cap,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "발급 실패");
        return;
      }
      setPlaintext(json.plaintext_key);
      setName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">소유자</span>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
            required
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">키 이름 (예: ACME 통합)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">분당 호출 제한 (rpm)</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={rpm}
            onChange={(e) => setRpm(Number(e.target.value))}
            className="w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">월 비용 한도 (USD)</span>
          <input
            type="number"
            min={1}
            step={10}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value))}
            className="w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
      </div>
      <div className="text-sm">
        <span className="mb-1 block text-muted-foreground">권한 (scopes)</span>
        <div className="flex gap-2">
          {["studio", "cast", "tutor"].map((s) => (
            <label key={s} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 cursor-pointer">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
              {s}
            </label>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !ownerId || !name}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "발급 중..." : "키 발급"}
      </button>

      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {plaintext && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-4">
          <div className="mb-2 text-sm font-semibold text-amber-900">⚠ 이 키는 다시 표시되지 않습니다 — 지금 복사하세요</div>
          <code className="block break-all rounded bg-white p-2 font-mono text-xs">{plaintext}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(plaintext)}
            className="mt-2 rounded border px-3 py-1 text-xs"
          >
            복사
          </button>
        </div>
      )}
    </form>
  );
}
