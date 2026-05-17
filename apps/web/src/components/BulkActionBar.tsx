"use client";

/**
 * 테이블 위에 떠 있는 bulk 액션 바.
 *
 * 사용:
 *   const [selected, setSelected] = useState<Set<string>>(new Set());
 *   {selected.size > 0 && (
 *     <BulkActionBar
 *       count={selected.size}
 *       onClear={() => setSelected(new Set())}
 *       actions={[
 *         { label: "삭제", onClick: () => handleDelete(selected), variant: "danger" },
 *         { label: "내보내기", onClick: () => handleExport(selected) },
 *       ]}
 *     />
 *   )}
 */
export function BulkActionBar({
  count,
  onClear,
  actions,
}: {
  count: number;
  onClear: () => void;
  actions: { label: string; onClick: () => void; variant?: "default" | "danger" }[];
}) {
  return (
    <div className="sticky top-2 z-10 flex items-center justify-between rounded-lg border bg-card px-4 py-2 shadow-sm">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{count}개 선택됨</span>
        <button onClick={onClear} className="text-muted-foreground underline hover:text-foreground">
          선택 해제
        </button>
      </div>
      <div className="flex gap-2">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className={
              a.variant === "danger"
                ? "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                : "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            }
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
