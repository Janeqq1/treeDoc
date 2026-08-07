import { Text, View } from "@react-pdf/renderer";
import type { TiptapDoc } from "@/lib/types";

interface TiptapNode {
  type?: string;
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
}

const HEADING_SIZES: Record<number, number> = { 1: 14, 2: 13, 3: 12 };

function renderInline(nodes: TiptapNode[] = [], keyPrefix: string) {
  return nodes.map((node, i) => {
    if (node.type !== "text" || !node.text) return null;
    const bold = node.marks?.some((m) => m.type === "bold");
    const italic = node.marks?.some((m) => m.type === "italic");
    return (
      <Text
        key={`${keyPrefix}-t${i}`}
        style={{ fontFamily: bold ? "Helvetica-Bold" : "Helvetica", fontStyle: italic ? "italic" : "normal" }}
      >
        {node.text}
      </Text>
    );
  });
}

function renderListItems(items: TiptapNode[], keyPrefix: string, marker: (i: number) => string) {
  return items.map((item, i) => (
    <View key={`${keyPrefix}-li${i}`} style={{ flexDirection: "row", marginBottom: 1 }}>
      <Text style={{ width: 12 }}>{marker(i)}</Text>
      <View style={{ flex: 1 }}>
        {(item.content ?? []).map((child, j) => renderBlock(child, `${keyPrefix}-li${i}-${j}`))}
      </View>
    </View>
  ));
}

function renderBlock(node: TiptapNode, keyPrefix: string): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <Text key={keyPrefix} style={{ marginBottom: 2, lineHeight: 1.4 }}>
          {renderInline(node.content, keyPrefix)}
        </Text>
      );
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
      return (
        <Text
          key={keyPrefix}
          style={{ fontFamily: "Helvetica-Bold", fontSize: HEADING_SIZES[level] ?? 12, marginTop: 2, marginBottom: 3 }}
        >
          {renderInline(node.content, keyPrefix)}
        </Text>
      );
    }
    case "bulletList":
      return (
        <View key={keyPrefix} style={{ marginLeft: 4, marginBottom: 2 }}>
          {renderListItems(node.content ?? [], keyPrefix, () => "•")}
        </View>
      );
    case "orderedList":
      return (
        <View key={keyPrefix} style={{ marginLeft: 4, marginBottom: 2 }}>
          {renderListItems(node.content ?? [], keyPrefix, (i) => `${i + 1}.`)}
        </View>
      );
    case "blockquote":
      return (
        <View key={keyPrefix} style={{ borderLeftWidth: 2, borderLeftColor: "#d4d4d4", paddingLeft: 6, marginBottom: 2 }}>
          {(node.content ?? []).map((child, i) => renderBlock(child, `${keyPrefix}-bq${i}`))}
        </View>
      );
    default:
      return null;
  }
}

export function isExplanationEmpty(doc: TiptapDoc | null | undefined): boolean {
  const content = (doc as TiptapNode | null | undefined)?.content;
  if (!content || content.length === 0) return true;
  if (content.length === 1) {
    const only = content[0];
    if (only.type === "paragraph" && (!only.content || only.content.length === 0)) return true;
  }
  return false;
}

export function renderExplanation(doc: TiptapDoc | null | undefined, keyPrefix: string) {
  const blocks = (doc as TiptapNode | null | undefined)?.content ?? [];
  return blocks.map((block, i) => renderBlock(block, `${keyPrefix}-b${i}`));
}
