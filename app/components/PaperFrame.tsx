/**
 * The artifact signature (PLAN §8): a thin ink border with map furniture —
 * grid references in the margins. Fixed, decorative, never interactive.
 */
export function PaperFrame() {
  const cols = ["1", "2", "3", "4", "5", "6"];
  const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  return (
    <div
      aria-hidden="true"
      data-print-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 hidden sm:block"
    >
      <div className="absolute inset-2 border border-ink/60" />
      <div className="absolute inset-3.5 border border-ink/25" />
      {/* grid refs: numbers across the top, letters down the left */}
      <div className="absolute inset-x-8 top-0 flex h-2 justify-between">
        {cols.map((c) => (
          <span key={c} className="font-display text-[9px] leading-none text-ink/70">
            {c}
          </span>
        ))}
      </div>
      <div className="absolute inset-y-8 left-0.5 flex w-2 flex-col justify-between">
        {rows.map((r) => (
          <span key={r} className="font-display text-[9px] leading-none text-ink/70">
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
