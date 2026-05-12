"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "keg-cookie-consent-v1";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // 약간 지연 후 표시 (페이지 로드 우선)
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function accept(level: "essential" | "all") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        level,
        accepted_at: new Date().toISOString(),
        version: "v1",
      }),
    );
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-lg border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-sm font-medium text-foreground">
            🍪 쿠키 사용 안내
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            KEG AI Studio는 인증·세션 유지를 위한 *필수 쿠키*만 사용합니다.
            분석·광고 쿠키는 사용하지 않습니다. 자세한 내용은{" "}
            <Link href="/legal/privacy" className="text-foreground underline">
              개인정보처리방침
            </Link>
            을 참고하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => accept("all")}
            className="flex-1 rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-medium text-background hover:bg-foreground/90"
          >
            동의
          </button>
          <button
            onClick={() => accept("essential")}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-xs font-medium text-foreground hover:bg-card"
          >
            필수만
          </button>
        </div>
      </div>
    </div>
  );
}
