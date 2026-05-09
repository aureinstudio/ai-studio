export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:py-6 lg:px-10">
        <p className="tracking-wider">
          Powered by{" "}
          <span className="font-medium text-foreground">Aurein AX</span>{" "}
          <span className="opacity-50">×</span>{" "}
          <span className="font-medium text-foreground">KEG</span>
        </p>
        <p className="font-mono tabular-nums tracking-tight">v0.2.1</p>
      </div>
    </footer>
  );
}
