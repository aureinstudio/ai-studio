"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="mt-4 text-2xl font-bold">문제가 발생했습니다</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message?.slice(0, 200) ?? "알 수 없는 오류"}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">에러 ID: {error.digest}</p>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="rounded-md border bg-foreground px-4 py-2 text-sm text-background">
          다시 시도
        </button>
        <Link href="/dashboard" className="rounded-md border px-4 py-2 text-sm">
          대시보드로
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        반복되면 <a href="mailto:aureinstudio@gmail.com" className="underline">aureinstudio@gmail.com</a>으로 알려주세요.
      </p>
    </div>
  );
}
