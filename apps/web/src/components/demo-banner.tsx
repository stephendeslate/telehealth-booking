export function DemoBanner() {
  return (
    <div
      role="status"
      aria-label="Demo environment notice"
      data-testid="demo-banner"
      className="bg-amber-500 text-black text-center py-1 text-sm font-medium"
    >
      DEMO Environment — All patient data is synthetic (Synthea-generated). Not for clinical use.
    </div>
  );
}
