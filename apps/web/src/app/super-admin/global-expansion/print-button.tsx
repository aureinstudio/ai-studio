"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted print:hidden"
    >
      🖨️ 인쇄 / PDF
    </button>
  );
}
