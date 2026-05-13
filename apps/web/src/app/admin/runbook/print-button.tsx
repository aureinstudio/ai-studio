"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print w-full rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
    >
      🖨️ 인쇄 / PDF 저장
    </button>
  );
}
