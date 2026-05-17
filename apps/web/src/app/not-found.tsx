import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-6xl font-bold text-muted-foreground">404</div>
      <h1 className="mt-2 text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-muted-foreground">URL이 잘못됐거나 페이지가 이동했을 수 있습니다.</p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-md bg-foreground px-4 py-2 text-sm text-background">
        대시보드로
      </Link>
    </div>
  );
}
