import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/studio", label: "Studio" },
  { href: "/cast", label: "Cast" },
  { href: "/tutor", label: "Tutor" },
  { href: "/dashboard/history", label: "내 작업" },
];

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

        {/* Right: 사용자 / 로그인 */}
        <nav className="flex items-center gap-3">
          {user ? (
            <>
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
