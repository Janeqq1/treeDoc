// Per-depth hue family, alternating tint/shade by sibling position —
// makes it easy to visually track which nodes are siblings vs. children.
const DEPTH_PALETTE = [
  { base: "bg-sky-50 border-sky-200", alt: "bg-sky-100 border-sky-300" },
  { base: "bg-violet-50 border-violet-200", alt: "bg-violet-100 border-violet-300" },
  { base: "bg-amber-50 border-amber-200", alt: "bg-amber-100 border-amber-300" },
  { base: "bg-emerald-50 border-emerald-200", alt: "bg-emerald-100 border-emerald-300" },
  { base: "bg-rose-50 border-rose-200", alt: "bg-rose-100 border-rose-300" },
];

export function nodeColorClasses(depth: number, siblingIndex: number): string {
  const entry = DEPTH_PALETTE[depth % DEPTH_PALETTE.length];
  return siblingIndex % 2 === 0 ? entry.base : entry.alt;
}
