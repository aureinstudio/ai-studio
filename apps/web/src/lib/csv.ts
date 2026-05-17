/**
 * 클라이언트 CSV export 유틸.
 *
 * 사용:
 *   exportToCsv("students.csv", rows, [
 *     { key: "name", label: "이름" },
 *     { key: "email", label: "이메일" },
 *     { key: "created_at", label: "가입일" },
 *   ]);
 *
 * - UTF-8 BOM 포함 (Excel 한글 깨짐 방지)
 * - 콤마·따옴표·개행 자동 escape
 */
export type CsvColumn<T> = {
  key: keyof T & string;
  label: string;
  format?: (value: unknown, row: T) => string;
};

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv<T extends Record<string, unknown>>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const raw = r[c.key];
          const cooked = c.format ? c.format(raw, r) : raw;
          return escapeCell(cooked);
        })
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const csv = rowsToCsv(rows, columns);
  const bom = "﻿";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
