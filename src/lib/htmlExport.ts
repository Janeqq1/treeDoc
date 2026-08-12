import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { NodeRow } from "@/lib/types";
import { isExplanationEmpty } from "@/lib/pdf/tiptapToPdf";

// Same hue-per-depth, alternating-shade-per-sibling scheme as the on-screen
// tree (src/lib/colors.ts) and the PDF export, translated to hex since this
// file has no Tailwind runtime.
const DEPTH_COLORS = [
  { base: "#f0f9ff", alt: "#e0f2fe", border: "#7dd3fc" }, // sky
  { base: "#f5f3ff", alt: "#ede9fe", border: "#c4b5fd" }, // violet
  { base: "#fffbeb", alt: "#fef3c7", border: "#fcd34d" }, // amber
  { base: "#ecfdf5", alt: "#d1fae5", border: "#6ee7b7" }, // emerald
  { base: "#fff1f2", alt: "#ffe4e6", border: "#fda4af" }, // rose
];

const EXPORT_EXTENSIONS = [StarterKit.configure({ link: false }), Link];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A link mark's stored `target` (e.g. `null`, set by the live editor to
// disable its own default new-tab behavior in favor of the in-place
// preview) always wins over any extension-level default passed to
// generateHTML — Tiptap only falls back to the option default when the
// attribute is absent, not when it's explicitly null. A static export has
// no in-place preview to open into, so every link here should unconditionally
// open in a new tab regardless of what was stored; force it via the DOM
// rather than fighting Tiptap's attribute precedence.
function forceLinksToOpenInNewTab(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("a").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  return container.innerHTML;
}

function renderNode(
  node: NodeRow,
  depth: number,
  siblingIndex: number,
  childrenByParent: Map<string | null, NodeRow[]>,
): string {
  const palette = DEPTH_COLORS[depth % DEPTH_COLORS.length];
  const background = siblingIndex % 2 === 0 ? palette.base : palette.alt;
  const children = childrenByParent.get(node.id) ?? [];
  const explanationHtml = isExplanationEmpty(node.explanation)
    ? ""
    : forceLinksToOpenInNewTab(generateHTML(node.explanation, EXPORT_EXTENSIONS));
  const childrenHtml = children
    .map((child, i) => renderNode(child, depth + 1, i, childrenByParent))
    .join("\n");

  // The bid name is the only thing inside <summary> — deliberately not the
  // explanation, since links live in there and a click on a link bubbling
  // up through <summary> would also toggle the details open/closed (a
  // real, well-known interaction quirk with nesting <a> inside <summary>).
  // Keeping <summary> link-free sidesteps that entirely with zero JS.
  return `
    <details class="node" open style="margin-left:${depth === 0 ? 0 : 20}px">
      <summary style="background:${background};border-color:${palette.border}">${escapeHtml(node.summary || "Untitled bid")}</summary>
      ${
        explanationHtml
          ? `<div class="node-body" style="background:${background};border-color:${palette.border}">${explanationHtml}</div>`
          : ""
      }
      ${childrenHtml}
    </details>
  `;
}

export function buildTreeHtml(title: string, nodes: NodeRow[]): string {
  const childrenByParent = new Map<string | null, NodeRow[]>();
  for (const node of nodes) {
    const key = node.parent_id;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(node);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.position - b.position);

  const roots = childrenByParent.get(null) ?? [];
  const treeHtml = roots.length
    ? roots.map((node, i) => renderNode(node, 0, i, childrenByParent)).join("\n")
    : `<p class="empty">No bids yet.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #262626;
    max-width: 900px;
    margin: 2rem auto;
    padding: 0 1.5rem;
  }
  h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  .subtitle { color: #737373; font-size: 0.85rem; margin-bottom: 1.5rem; }
  details.node { margin-bottom: 6px; }
  details.node > summary {
    list-style: revert;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.95rem;
    border: 1px solid;
    border-radius: 6px;
    padding: 8px 10px;
  }
  details.node[open] > summary { border-radius: 6px 6px 0 0; border-bottom: none; }
  details.node > summary::marker { color: #737373; }
  .node-body {
    border: 1px solid;
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 6px 10px 8px;
    font-size: 0.85rem;
    color: #404040;
  }
  .node-body p { margin: 0.15rem 0; }
  .node-body ul, .node-body ol { margin: 0.15rem 0; padding-left: 1.25rem; }
  .node-body a { color: #2563eb; text-decoration: underline; }
  .empty { color: #a3a3a3; font-style: italic; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="subtitle">Bidding tree — click a bid to expand/collapse.</p>
${treeHtml}
</body>
</html>`;
}
