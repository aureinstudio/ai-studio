import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./LogoutButton";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
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

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
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
