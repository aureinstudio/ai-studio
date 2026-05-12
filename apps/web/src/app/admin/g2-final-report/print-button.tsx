"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 text-sm rounded border hover:bg-muted"
    >
      🖨️ 인쇄 / PDF 저장
    </button>
  );
}
