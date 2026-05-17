import Link from "next/link";

export const metadata = { title: "결제 취소 · ai-studio" };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="text-2xl font-bold">결제 취소됨</h1>
      <p className="mt-2 text-muted-foreground">결제가 완료되지 않았습니다. 언제든 다시 시도 가능합니다.</p>
      <Link href="/pricing" className="mt-6 inline-block rounded-md border px-6 py-3 text-sm font-medium">
        요금제 다시 보기
      </Link>
    </div>
  );
}
