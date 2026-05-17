export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-1/3 rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted/60" />
        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="h-24 rounded-lg bg-muted/40" />
          <div className="h-24 rounded-lg bg-muted/40" />
          <div className="h-24 rounded-lg bg-muted/40" />
        </div>
        <div className="mt-6 h-64 rounded-lg bg-muted/30" />
      </div>
    </div>
  );
}
