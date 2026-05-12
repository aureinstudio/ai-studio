"use client";

import { useState } from "react";

export default function SupportForm({
  prefillEmail,
  prefillName,
}: {
  prefillEmail: string | null;
  prefillName: string | null;
}) {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          name: String(fd.get("name") ?? "") || undefined,
          category: String(fd.get("category") ?? "other"),
          subject: String(fd.get("subject") ?? ""),
          body: String(fd.get("body") ?? ""),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.detail ?? j.error ?? "제출 실패");
        setState("error");
        return;
      }
      setState("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
        <div className="text-3xl mb-3">✓</div>
        <h3 className="text-lg font-bold text-emerald-900">문의가 접수되었습니다</h3>
        <p className="text-sm text-emerald-800 mt-2">
          24시간 이내 답변 이메일을 보내드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 bg-card border rounded-lg p-6">
      <div>
        <label className="block text-sm font-medium mb-1.5">문의 유형 *</label>
        <select
          name="category"
          required
          defaultValue="technical"
          className="w-full px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="technical">기술 문제 (로그인·앱 오류)</option>
          <option value="content_error">콘텐츠 오류 신고</option>
          <option value="billing">결제·환불 문의</option>
          <option value="other">기타</option>
        </select>
      </div>

      <Field label="이름 *" name="name" required defaultValue={prefillName ?? ""} maxLength={60} />
      <Field
        label="이메일 *"
        name="email"
        type="email"
        required
        defaultValue={prefillEmail ?? ""}
        maxLength={120}
      />
      <Field label="제목 *" name="subject" required maxLength={120} placeholder="예: 로그인이 안 됩니다" />

      <div>
        <label className="block text-sm font-medium mb-1.5">자세한 내용 *</label>
        <textarea
          name="body"
          required
          rows={6}
          maxLength={3000}
          placeholder="언제·어디서·어떤 동작에서 문제가 발생했는지 적어주세요. 가능하면 화면 캡쳐도 함께 보내주세요."
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
      >
        {state === "submitting" ? "제출 중…" : "문의 제출"}
      </button>
      {err && <p className="text-sm text-red-600">⚠️ {err}</p>}
      <p className="text-xs text-muted-foreground">
        SLA 24시간 · 긴급한 경우 support@keg.com으로 직접 메일 가능
      </p>
    </form>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{props.label}</label>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        defaultValue={props.defaultValue}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        className="w-full px-3 py-2 border rounded-md text-sm"
      />
    </div>
  );
}
