"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * 라이트·다크 모드 토글.
 * - localStorage('theme') = "light" | "dark" 저장
 * - 미설정 시 prefers-color-scheme 따름
 * - <html>에 .dark 클래스 토글
 *
 * SSR FOUC 회피: layout.tsx <head>의 inline 스크립트가 페인트 전 클래스를 부여.
 * 본 컴포넌트는 hydration 후 현재 상태 동기화 + 클릭 핸들러 제공.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // 초기 동기화 — <html>에 이미 적용된 클래스에서 읽기
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 시크릿 모드 등 — 무시
    }
  }

  // 첫 렌더 (hydration 전)에는 빈 자리만 차지 — hydration 불일치 회피
  if (theme === null) {
    return <div className="h-8 w-8" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={theme === "dark" ? "라이트 모드" : "다크 모드"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-card/60 text-foreground transition-colors hover:bg-card"
    >
      {theme === "dark" ? (
        // sun icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        // moon icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}
