import { cache } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";

// 같은 request 내 중복 호출 1회만 — Header가 layout에서 매 페이지 호출되므로 핵심
const getCurrentUserAndRole = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: undefined as string | undefined };

  // admin 클라이언트로 RLS 우회 → profiles select 1회만 (가장 빠름)
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { user, role: profile?.role as string | undefined };
});

type NavItem = { href: string; label: string; highlight?: boolean };

// 역할별 상단 메뉴 — 각 역할이 실제 사용하는 도구만 노출
const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/courses", label: "과정" },
  { href: "/tutor", label: "Tutor" },
  { href: "/blog", label: "Blog" },
];

const INSTRUCTOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/studio-pro", label: "Studio Pro", highlight: true },
  { href: "/studio", label: "Studio" },
  { href: "/cast", label: "Cast" },
  { href: "/tutor", label: "Tutor" },
  { href: "/dashboard/history", label: "내 작업" },
  { href: "/blog", label: "Blog" },
];

const SME_NAV: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/sme/dashboard", label: "검수 큐" },
  { href: "/courses", label: "과정" },
  { href: "/blog", label: "Blog" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/admin", label: "관리자" },
  { href: "/admin/monitoring", label: "모니터링" },
  { href: "/admin/users", label: "사용자" },
  { href: "/courses", label: "과정" },
  { href: "/blog", label: "Blog" },
];

function navForRole(role: string | undefined): NavItem[] {
  switch (role) {
    case "admin":
    case "keg_super_admin":
    case "tenant_admin":
      return ADMIN_NAV;
    case "sme":
    case "operations":
      return SME_NAV;
    case "instructor":
    case "creator":
      return INSTRUCTOR_NAV;
    default:
      return STUDENT_NAV;
  }
}

const ROLE_LINK: Record<string, { href: string; label: string }> = {
  keg_super_admin: { href: "/super-admin", label: "Super Admin" },
  admin: { href: "/admin", label: "관리자" },
  tenant_admin: { href: "/admin", label: "테넌트 관리자" },
  sme: { href: "/sme/dashboard", label: "SME" },
  instructor: { href: "/instructor/dashboard", label: "강사" },
  operations: { href: "/operations/dashboard", label: "운영팀" },
};

export async function Header() {
  const { user, role: userRole } = await getCurrentUserAndRole();
  const roleLink: { href: string; label: string } | null =
    userRole && ROLE_LINK[userRole] ? ROLE_LINK[userRole] : null;
  const navItems = navForRole(userRole);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Left: 로고 + nav */}
        <div className="flex items-center gap-8">
          <Link
            href={user ? "/dashboard" : "/"}
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            {/* 라이트 모드 — 블랙 로고 */}
            <Image
              src="/logo_bk.png"
              alt="ai-studio"
              width={120}
              height={32}
              priority
              className="block h-8 w-auto dark:hidden"
            />
            {/* 다크 모드 — 화이트 로고 */}
            <Image
              src="/logo_wh.png"
              alt="ai-studio"
              width={120}
              height={32}
              priority
              className="hidden h-8 w-auto dark:block"
            />
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.highlight
                      ? "flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  }
                >
                  {item.highlight && <span aria-hidden>⭐</span>}
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
