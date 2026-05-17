"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 print:hidden">
      🖨️ 인쇄 / PDF 저장
    </button>
  );
}
