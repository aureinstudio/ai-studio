"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/posthog-client";

type State = {
  step?: number;
  target_cert?: string;
  exam_date?: string;
  preferred_hours?: string[];
  language?: string;
  first_question_asked?: boolean;
  completed_at?: string;
};

const TOTAL_STEPS = 5;

export default function OnboardingWizard({
  userName,
  initialState,
}: {
  userName: string | null;
  initialState: State;
}) {
  const router = useRouter();
  const [step, setStep] = useState<number>(initialState.step ?? 1);
  const [state, setState] = useState<State>(initialState);
  const [busy, setBusy] = useState(false);

  async function persist(next: State, nextStep: number, completed = false) {
    setBusy(true);
    try {
      await fetch("/api/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: { ...next, step: nextStep, ...(completed ? { completed_at: new Date().toISOString() } : {}) },
        }),
      });
      trackEvent(`onboarding_step_${nextStep}`, { completed });
    } finally {
      setBusy(false);
    }
  }

  async function next(patch: Partial<State>) {
    const merged = { ...state, ...patch };
    setState(merged);
    const target = step + 1;
    if (target > TOTAL_STEPS) {
      await persist(merged, TOTAL_STEPS, true);
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setStep(target);
    await persist(merged, target);
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <div className="w-full max-w-xl bg-card rounded-lg border p-8 shadow-sm">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded ${i + 1 <= step ? "bg-foreground" : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-2">단계 {step}/{TOTAL_STEPS}</p>

      {step === 1 && <Step1 userName={userName} onNext={next} busy={busy} />}
      {step === 2 && <Step2 state={state} onNext={next} onBack={back} busy={busy} />}
      {step === 3 && <Step3 state={state} onNext={next} onBack={back} busy={busy} />}
      {step === 4 && <Step4 onNext={next} onBack={back} busy={busy} />}
      {step === 5 && <Step5 onComplete={next} onBack={back} busy={busy} />}
    </div>
  );
}

function Step1({ userName, onNext, busy }: { userName: string | null; onNext: (p: Partial<State>) => void; busy: boolean }) {
  const [cert, setCert] = useState("");
  const [date, setDate] = useState("");
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">환영합니다{userName ? `, ${userName}` : ""} 👋</h2>
      <p className="text-sm text-muted-foreground mb-6">학습 목표를 설정해 맞춤 콘텐츠를 추천해 드립니다.</p>
      <label className="block text-sm font-medium mb-1.5">목표 자격증</label>
      <input
        value={cert}
        onChange={(e) => setCert(e.target.value)}
        placeholder="예: 조리기능사"
        className="w-full px-3 py-2 border rounded mb-4 text-sm"
      />
      <label className="block text-sm font-medium mb-1.5">예상 시험일 (선택)</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full px-3 py-2 border rounded mb-6 text-sm"
      />
      <button
        disabled={busy || !cert.trim()}
        onClick={() => onNext({ target_cert: cert.trim(), exam_date: date || undefined })}
        className="w-full py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
      >
        다음 →
      </button>
    </div>
  );
}

function Step2({ state, onNext, onBack, busy }: { state: State; onNext: (p: Partial<State>) => void; onBack: () => void; busy: boolean }) {
  const slots = ["아침 6~9시", "오전 9~12시", "점심 12~14시", "오후 14~18시", "저녁 18~22시", "심야 22~02시"];
  const [picked, setPicked] = useState<string[]>(state.preferred_hours ?? []);
  function toggle(s: string) {
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  }
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">언제 주로 학습하세요?</h2>
      <p className="text-sm text-muted-foreground mb-6">선택한 시간대에 학습 알림을 보내드립니다.</p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {slots.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`px-3 py-2.5 rounded border text-sm ${
              picked.includes(s)
                ? "bg-foreground text-background border-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2.5 rounded border text-sm">← 이전</button>
        <button
          disabled={busy}
          onClick={() => onNext({ preferred_hours: picked })}
          className="flex-1 py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

function Step3({ state, onNext, onBack, busy }: { state: State; onNext: (p: Partial<State>) => void; onBack: () => void; busy: boolean }) {
  const langs = [
    { code: "ko", label: "한국어" },
    { code: "en", label: "English" },
    { code: "zh", label: "中文" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "id", label: "Bahasa Indonesia" },
  ];
  const [lang, setLang] = useState(state.language ?? "ko");
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">사용 언어</h2>
      <p className="text-sm text-muted-foreground mb-6">AI 튜터가 이 언어로 응답합니다. (질문은 자동 감지)</p>
      <div className="grid grid-cols-1 gap-2 mb-6">
        {langs.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            className={`px-4 py-3 rounded border text-sm text-left ${
              lang === l.code
                ? "bg-foreground text-background border-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2.5 rounded border text-sm">← 이전</button>
        <button
          disabled={busy}
          onClick={() => onNext({ language: lang })}
          className="flex-1 py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

function Step4({ onNext, onBack, busy }: { onNext: (p: Partial<State>) => void; onBack: () => void; busy: boolean }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">AI Tutor 사용법</h2>
      <p className="text-sm text-muted-foreground mb-6">교재 기반으로 답변합니다. 모르면 거부합니다(환각 차단).</p>

      <div className="space-y-4 mb-6">
        <Tip emoji="💡" title="좋은 질문 예시">
          <ul className="text-sm leading-relaxed list-disc pl-5 text-muted-foreground">
            <li>“한식 양념 5가지 핵심 성분은?”</li>
            <li>“발효 식품과 비발효 식품의 차이는?”</li>
            <li>“이 단원의 시험 출제 포인트 3가지는?”</li>
          </ul>
        </Tip>
        <Tip emoji="📎" title="출처가 보이면 신뢰">
          답변 아래 “출처 [1] [2]”가 표시되면 교재에서 가져온 검증된 정보입니다.
        </Tip>
        <Tip emoji="🚫" title="‘답변 어려움’ 표시">
          교재에 없는 내용은 답을 거부합니다. 강사에 문의하세요 — 자동 안내됩니다.
        </Tip>
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2.5 rounded border text-sm">← 이전</button>
        <button
          disabled={busy}
          onClick={() => onNext({})}
          className="flex-1 py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
        >
          확인했어요 →
        </button>
      </div>
    </div>
  );
}

function Step5({ onComplete, onBack, busy }: { onComplete: (p: Partial<State>) => void; onBack: () => void; busy: boolean }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">준비 완료 🎉</h2>
      <p className="text-sm text-muted-foreground mb-6">
        대시보드에서 첫 학습을 시작하세요. 자주 가는 페이지를 안내드립니다.
      </p>
      <ul className="space-y-3 mb-6">
        <Linkish href="/samples" title="샘플 콘텐츠" body="자격증 과정 미리보기 (회원가입 없이 열람 가능)" />
        <Linkish href="/studio" title="Studio" body="원하는 주제 → 학습 콘텐츠 자동 생성" />
        <Linkish href="/tutor" title="Tutor" body="과정 학습 중 질문 → 1:1 답변 + 출처" />
      </ul>
      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2.5 rounded border text-sm">← 이전</button>
        <button
          disabled={busy}
          onClick={() => onComplete({})}
          className="flex-1 py-2.5 rounded bg-foreground text-background font-semibold disabled:opacity-50"
        >
          시작하기 →
        </button>
      </div>
    </div>
  );
}

function Tip({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 bg-muted/40 rounded-lg">
      <div className="text-2xl">{emoji}</div>
      <div>
        <div className="font-semibold text-sm mb-1">{title}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

function Linkish({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <li>
      <a href={href} className="block p-3 rounded-lg border hover:bg-muted/40">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </a>
    </li>
  );
}
