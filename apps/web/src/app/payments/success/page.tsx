import Link from "next/link";

export const metadata = { title: "결제 완료 · ai-studio" };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-6xl">🎉</div>
      <h1 className="mt-4 text-2xl font-bold">결제 완료</h1>
      <p className="mt-2 text-muted-foreground">구독이 활성화됐습니다. 학습을 시작하세요.</p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background">
        대시보드로 →
      </Link>
    </div>
  );
}
