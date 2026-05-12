"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESS_INFO } from "@/lib/legal/business-info";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // 약관 동의 (3개 필수 + 1개 선택)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeBeta, setAgreeBeta] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const allRequiredAgreed = agreeTerms && agreePrivacy && agreeBeta;
  const allAgreed = allRequiredAgreed && agreeMarketing;

  function toggleAll() {
    const next = !allAgreed;
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeBeta(next);
    setAgreeMarketing(next);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!allRequiredAgreed) {
      setError("필수 약관 3개에 모두 동의해야 가입 가능합니다.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // 동의 기록 저장 (세션 있을 때만 — 즉시 인증)
    if (data.session) {
      try {
        await fetch("/api/legal/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consents: [
              {
                consent_type: "terms_of_service",
                version: BUSINESS_INFO.versions.terms_of_service,
                agreed: true,
              },
              {
                consent_type: "privacy_policy",
                version: BUSINESS_INFO.versions.privacy_policy,
                agreed: true,
              },
              {
                consent_type: "beta_consent",
                version: BUSINESS_INFO.versions.beta_consent,
                agreed: true,
              },
              {
                consent_type: "marketing",
                version: "v1",
                agreed: agreeMarketing,
              },
            ],
          }),
        });
      } catch (err) {
        console.warn("[signup] consent log failed (non-fatal):", err);
      }
    }

    setLoading(false);
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(
        "가입이 완료되었습니다. 이메일 인증 후 첫 로그인 시 약관 동의가 자동 기록됩니다.",
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-6 py-20 lg:py-28">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          회원가입
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ai-studio 베타 계정 생성
        </p>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                이름
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                required
                disabled={loading}
                autoComplete="name"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                이메일
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                비밀번호
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                minLength={6}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2 rounded-md border border-border bg-background/40 p-3">
              <label className="flex cursor-pointer items-center gap-2 border-b border-border/40 pb-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={allAgreed}
                  onChange={toggleAll}
                  disabled={loading}
                  className="h-4 w-4 accent-foreground"
                />
                전체 동의 (선택 포함)
              </label>

              <ConsentItem
                checked={agreeTerms}
                onChange={setAgreeTerms}
                disabled={loading}
                required
                label="이용약관에 동의합니다"
                link="/legal/terms"
              />
              <ConsentItem
                checked={agreePrivacy}
                onChange={setAgreePrivacy}
                disabled={loading}
                required
                label="개인정보처리방침에 동의합니다"
                link="/legal/privacy"
              />
              <ConsentItem
                checked={agreeBeta}
                onChange={setAgreeBeta}
                disabled={loading}
                required
                label="베타 참여 동의서에 동의합니다"
                link="/legal/beta-consent"
              />
              <ConsentItem
                checked={agreeMarketing}
                onChange={setAgreeMarketing}
                disabled={loading}
                label="마케팅 정보 수신에 동의합니다 (선택)"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              size="lg"
              disabled={loading || !email || !password || !name || !allRequiredAgreed}
              className="h-11 w-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
            >
              {loading
                ? "가입 중..."
                : allRequiredAgreed
                  ? "가입하기"
                  : "필수 약관 동의 필요"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          로그인
        </Link>
      </p>
    </div>
  );
}

function ConsentItem({
  checked,
  onChange,
  disabled,
  required,
  label,
  link,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  required?: boolean;
  label: string;
  link?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 accent-foreground"
      />
      <span className="flex-1">
        <span className={required ? "text-foreground" : "text-muted-foreground"}>
          {required && <span className="text-red-400">[필수] </span>}
          {!required && <span className="opacity-60">[선택] </span>}
          {label}
        </span>
        {link && (
          <>
            {" "}
            <Link
              href={link}
              target="_blank"
              className="text-muted-foreground underline hover:text-foreground"
            >
              보기
            </Link>
          </>
        )}
      </span>
    </label>
  );
}
