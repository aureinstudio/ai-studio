"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "info" | "error"; text: string } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const initialError = searchParams.get("error");

  // URL의 ?error= 표시 (콜백 실패 시)
  if (initialError && !message) {
    setMessage({ type: "error", text: decodeURIComponent(initialError) });
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "info",
        text: `${email}로 매직 링크를 보냈습니다. 이메일을 확인해주세요.`,
      });
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-6 py-20 lg:py-28">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "magic" ? "이메일로 매직 링크를 받으세요" : "이메일과 비밀번호로 로그인"}
        </p>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-6">
          <form
            onSubmit={mode === "magic" ? handleMagicLink : handlePasswordLogin}
            className="space-y-4"
          >
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

            {mode === "password" && (
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
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            )}

            {message && (
              <p
                className={`text-sm ${
                  message.type === "error" ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {message.text}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading || !email}
              className="h-11 w-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
            >
              {loading
                ? "처리 중..."
                : mode === "magic"
                  ? "매직 링크 받기"
                  : "로그인"}
            </Button>
          </form>

          <div className="mt-4 border-t border-border/40 pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "magic" ? "password" : "magic");
                setMessage(null);
              }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {mode === "magic" ? "→ 비밀번호로 로그인" : "→ 매직 링크로 로그인"}
            </button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        처음이신가요?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-20" />}>
      <LoginForm />
    </Suspense>
  );
}
