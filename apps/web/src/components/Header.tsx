import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/studio", label: "Studio" },
  { href: "/cast", label: "Cast" },
  { href: "/tutor", label: "Tutor" },
  { href: "/dashboard/history", label: "내 작업" },
];

const ROLE_LINK: Record<string, { href: string; label: string }> = {
  admin: { href: "/admin", label: "관리자" },
  sme: { href: "/sme/dashboard", label: "SME" },
  instructor: { href: "/instructor/weekly-report", label: "강사" },
};

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 역할 조회 (로그인 사용자만)
  let roleLink: { href: string; label: string } | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role as string | undefined;
    if (role && ROLE_LINK[role]) roleLink = ROLE_LINK[role];
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Left: 로고 + nav */}
        <div className="flex items-center gap-8">
          <Link
            href={user ? "/dashboard" : "/"}
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold tracking-tighter shadow-sm">
              ai
            </span>
            <span className="text-base font-semibold tracking-tight text-foreground">
              ai-studio
            </span>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Right: 테마 + 사용자 / 로그인 */}
        <nav className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <>
              {roleLink && (
                <Link
                  href={roleLink.href}
                  className="hidden rounded-md border border-foreground/30 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/10 sm:inline-block"
                >
                  {roleLink.label} →
                </Link>
              )}
              <span className="hidden font-mono text-xs text-muted-foreground lg:inline">
                {user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
