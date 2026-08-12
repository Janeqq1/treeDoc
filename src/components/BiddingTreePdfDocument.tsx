import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ComponentProps, ComponentType } from "react";
import type { NodeRow } from "@/lib/types";
import { isExplanationEmpty, renderExplanation } from "@/lib/pdf/tiptapToPdf";

// `bookmark` is a real react-pdf prop (works on any node, not just Page —
// it's how nested, collapsible PDF outline/sidebar entries are built) but
// this package version's View type declarations don't include it.
const ViewWithBookmark = View as unknown as ComponentType<
  ComponentProps<typeof View> & { bookmark?: { title: string; expanded?: boolean } }
>;

// Same hue-per-depth, alternating-shade-per-sibling scheme as the on-screen
// tree (src/lib/colors.ts), translated to hex since react-pdf doesn't read Tailwind.
const DEPTH_COLORS = [
  { base: "#f0f9ff", alt: "#e0f2fe", border: "#7dd3fc" }, // sky
  { base: "#f5f3ff", alt: "#ede9fe", border: "#c4b5fd" }, // violet
  { base: "#fffbeb", alt: "#fef3c7", border: "#fcd34d" }, // amber
  { base: "#ecfdf5", alt: "#d1fae5", border: "#6ee7b7" }, // emerald
  { base: "#fff1f2", alt: "#ffe4e6", border: "#fda4af" }, // rose
];

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 10, color: "#262626" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#737373", marginBottom: 20 },
  node: { borderWidth: 1, borderRadius: 4, padding: 8, marginBottom: 6 },
  summary: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  placeholder: { fontSize: 9, color: "#a3a3a3", fontStyle: "italic" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#a3a3a3", textAlign: "center" },
});

function NodeBlock({
  node,
  depth,
  siblingIndex,
  childrenByParent,
}: {
  node: NodeRow;
  depth: number;
  siblingIndex: number;
  childrenByParent: Map<string | null, NodeRow[]>;
}) {
  const palette = DEPTH_COLORS[depth % DEPTH_COLORS.length];
  const backgroundColor = siblingIndex % 2 === 0 ? palette.base : palette.alt;
  const children = childrenByParent.get(node.id) ?? [];

  return (
    // The bookmark makes this node (and, since bookmarks nest along the
    // component tree, its children) a collapsible entry in the PDF
    // viewer's own outline/sidebar panel — the closest a static PDF page
    // can get to the app's expand/collapse tree, since page content itself
    // can't be interactively hidden without JavaScript-enabled PDF forms.
    <ViewWithBookmark
      style={{ marginLeft: depth * 16 }}
      bookmark={{ title: node.summary || "Untitled bid", expanded: true }}
    >
      <View style={[styles.node, { backgroundColor, borderColor: palette.border }]}>
        <Text style={styles.summary}>{node.summary || "Untitled bid"}</Text>
        {isExplanationEmpty(node.explanation) ? null : renderExplanation(node.explanation, node.id)}
      </View>
      {children.map((child, i) => (
        <NodeBlock
          key={child.id}
          node={child}
          depth={depth + 1}
          siblingIndex={i}
          childrenByParent={childrenByParent}
        />
      ))}
    </ViewWithBookmark>
  );
}

export default function BiddingTreePdfDocument({
  title,
  nodes,
}: {
  title: string;
  nodes: NodeRow[];
}) {
  const childrenByParent = new Map<string | null, NodeRow[]>();
  for (const node of nodes) {
    const key = node.parent_id;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(node);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.position - b.position);

  const roots = childrenByParent.get(null) ?? [];

  return (
    <Document title={title}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Bidding tree</Text>
        {roots.length === 0 ? (
          <Text style={styles.placeholder}>No bids yet.</Text>
        ) : (
          roots.map((node, i) => (
            <NodeBlock key={node.id} node={node} depth={0} siblingIndex={i} childrenByParent={childrenByParent} />
          ))
        )}
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
