"use client";

import { useState } from "react";

export default function BetaApplyForm() {
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "") || undefined,
      course_interest: String(fd.get("course_interest") ?? "") || undefined,
      motivation: String(fd.get("motivation") ?? "") || undefined,
      availability: String(fd.get("availability") ?? "") || undefined,
      source: new URLSearchParams(window.location.search).get("utm_source") || undefined,
    };
    try {
      const r = await fetch("/api/beta/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.message ?? j.error ?? "제출 실패");
        setState("error");
        return;
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
        <div className="text-3xl mb-3">✓</div>
        <h3 className="text-lg font-bold text-emerald-900">신청 접수 완료</h3>
        <p className="text-sm text-emerald-800 mt-2">
          제출하신 이메일로 접수 확인 메일을 보내드렸습니다.<br />
          2영업일 이내에 결과를 안내드립니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="이름 *" name="name" required maxLength={60} placeholder="홍길동" />
      <Field label="이메일 *" name="email" type="email" required maxLength={120} placeholder="you@example.com" />
      <Field label="휴대폰 (선택)" name="phone" maxLength={30} placeholder="010-0000-0000" />
      <Field label="관심 자격증 과정" name="course_interest" maxLength={200} placeholder="예: 조리기능사" />
      <TextArea
        label="이 베타에 참여하는 이유 (자유 서술)"
        name="motivation"
        maxLength={2000}
        placeholder="AI 튜터로 학습 효율을 높이고 싶어 신청합니다…"
      />
      <Field
        label="이용 가능 시간대"
        name="availability"
        maxLength={200}
        placeholder="예: 평일 저녁 8~10시, 주말 오후"
      />
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" required className="mt-0.5" />
        <span>
          <a href="/legal/terms" className="underline">이용약관</a> ·
          <a href="/legal/privacy" className="underline ml-1">개인정보처리방침</a> ·
          <a href="/legal/beta-consent" className="underline ml-1">베타 동의서</a>에 동의합니다.
        </span>
      </label>
      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full py-3 rounded-lg bg-foreground text-background font-semibold disabled:opacity-50"
      >
        {state === "submitting" ? "제출 중…" : "신청서 제출"}
      </button>
      {error && (
        <p className="text-sm text-red-600">⚠️ {error}</p>
      )}
    </form>
  );
}

function Field(props: {
  label: string; name: string; type?: string; required?: boolean; maxLength?: number; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={props.name} className="block text-sm font-medium mb-1.5">{props.label}</label>
      <input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function TextArea(props: {
  label: string; name: string; maxLength?: number; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={props.name} className="block text-sm font-medium mb-1.5">{props.label}</label>
      <textarea
        id={props.name}
        name={props.name}
        rows={4}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
