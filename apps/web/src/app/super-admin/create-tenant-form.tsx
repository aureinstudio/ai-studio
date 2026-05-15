"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateTenantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tenantType, setTenantType] = useState<"b2b_customer" | "demo">("b2b_customer");
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("starter");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, slug, tenant_type: tenantType, plan }),
      });
      const json = await res.json();
      if (res.ok) {
        setMsg(`✅ 생성됨 — slug: ${json.slug}`);
        setName("");
        setSlug("");
        router.refresh();
      } else {
        setMsg(`❌ ${json.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">이름</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="예: ACME 교육원"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">slug (URL용)</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          required
          pattern="[a-z0-9-]+"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
          placeholder="acme"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">유형</span>
        <select
          value={tenantType}
          onChange={(e) => setTenantType(e.target.value as "b2b_customer" | "demo")}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="b2b_customer">B2B 고객사</option>
          <option value="demo">Demo</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted-foreground">플랜</span>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as "starter" | "pro" | "enterprise")}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </label>
      <div className="md:col-span-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !name.trim() || !slug.trim()}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "생성 중..." : "테넌트 생성"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
