"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
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
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Confirm email OFF인 경우 session 즉시 발급 → /dashboard 이동
    // ON인 경우 session=null → 안내 메시지
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(
        "가입이 완료되었습니다. 이메일 인증 링크가 전송되었으니 확인 후 로그인해주세요.",
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

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              size="lg"
              disabled={loading || !email || !password || !name}
              className="h-11 w-full bg-foreground text-base font-medium text-background hover:bg-foreground/90"
            >
              {loading ? "가입 중..." : "가입하기"}
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
