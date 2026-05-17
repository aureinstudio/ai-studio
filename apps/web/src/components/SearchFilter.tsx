"use client";
import { useEffect, useState } from "react";

/**
 * 클라이언트 사이드 테이블 검색 컴포넌트.
 *
 * 사용:
 *   const [q, setQ] = useState("");
 *   <SearchFilter value={q} onChange={setQ} placeholder="이름·이메일 검색" />
 *   const filtered = rows.filter(r => !q || r.name.includes(q) || r.email.includes(q));
 */
export function SearchFilter({
  value,
  onChange,
  placeholder = "검색...",
  debounceMs = 150,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
  }, [local, debounceMs, onChange]);
  return (
    <div className="relative w-full max-w-sm">
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border bg-background px-3 py-2 pl-9 text-sm focus:border-foreground focus:outline-none"
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
      {local && (
        <button
          onClick={() => setLocal("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="지우기"
        >
          ✕
        </button>
      )}
    </div>
  );
}
