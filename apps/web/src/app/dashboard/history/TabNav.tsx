"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

export function TabNav({ showStudioPro }: { showStudioPro: boolean }) {
  const pathname = usePathname() ?? "/dashboard/history";
  const tabs: Tab[] = [
    { href: "/dashboard/history", label: "📝 Studio" },
    ...(showStudioPro
      ? [{ href: "/dashboard/history/studio-pro", label: "⭐ Studio Pro" }]
      : []),
    { href: "/dashboard/history/cast", label: "🎬 Cast" },
    { href: "/dashboard/history/tutor", label: "🤖 Tutor" },
  ];

  // active: exact match OR (Studio tab) when pathname is exactly /dashboard/history
  const isActive = (href: string) =>
    href === "/dashboard/history"
      ? pathname === "/dashboard/history"
      : pathname.startsWith(href);

  return (
    <div className="mb-8 flex gap-2 border-b border-border/60">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={
            isActive(t.href)
              ? "border-b-2 border-foreground px-4 py-2 text-sm font-semibold"
              : "px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
