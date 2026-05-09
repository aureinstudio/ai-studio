import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold tracking-tighter shadow-sm">
            ai
          </span>
          <span className="text-base font-semibold tracking-tight text-foreground">
            ai-studio
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {/* 메뉴 자리 — v0.3.0+ 활성화 */}
          <span className="hidden text-sm text-muted-foreground/60 sm:inline">
            {/* 추후 솔루션 · 가격 · 문서 · 로그인 */}
          </span>
        </nav>
      </div>
    </header>
  );
}
