"use client";

import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useState } from "react";

export const LINK_PREVIEW_NODE_NAME = "linkPreview";

// Clicking a link inserts one of these as a real sibling block right after
// the paragraph it's in, so it appears in-place even with multiple links
// open at once. It's never persisted — stripPreviewNodes() removes it
// before saving/comparing, so a viewer's locally-open previews don't leak
// into the shared document content other collaborators see.
export const LinkPreviewNode = Node.create({
  name: LINK_PREVIEW_NODE_NAME,
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      url: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${LINK_PREVIEW_NODE_NAME}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": LINK_PREVIEW_NODE_NAME })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewView);
  },
});

export function stripPreviewNodes(json: JSONContent): JSONContent {
  if (!Array.isArray(json.content)) return json;
  return {
    ...json,
    content: json.content
      .filter((n) => n.type !== LINK_PREVIEW_NODE_NAME)
      .map((n) => stripPreviewNodes(n)),
  };
}

const MIN_IFRAME_HEIGHT = 128;
const DEFAULT_IFRAME_HEIGHT = 256;

function LinkPreviewView({ node, editor, getPos }: NodeViewProps) {
  const url = node.attrs.url as string;
  const [height, setHeight] = useState(DEFAULT_IFRAME_HEIGHT);
  const [dragging, setDragging] = useState(false);

  const close = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.chain().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  // A hand-rolled drag handle instead of CSS resize: the explanation box
  // itself is also natively resizable (resize-y), and Chrome only shows one
  // grip when resizable elements are nested — the innermost one wins,
  // hiding the outer box's handle whenever a preview is open. A transparent
  // overlay covers the iframe while dragging so the drag doesn't get lost
  // the moment the cursor crosses into the iframe's own document.
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      const startY = e.clientY;
      const startHeight = height;
      const onMove = (moveEvent: MouseEvent) => {
        setHeight(Math.max(MIN_IFRAME_HEIGHT, startHeight + (moveEvent.clientY - startY)));
      };
      const onUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [height],
  );

  return (
    <NodeViewWrapper
      className="my-1 overflow-hidden rounded border border-neutral-300 bg-white"
      contentEditable={false}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-2 py-1">
        <span className="truncate text-xs text-neutral-500">{url}</span>
        <div className="flex shrink-0 gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-preview-external-link="true"
            className="rounded px-1.5 py-0.5 text-xs text-sky-600 hover:bg-sky-50"
          >
            Open in new tab ↗
          </a>
          <button
            type="button"
            onClick={close}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </div>
      <div className="relative w-full overflow-hidden" style={{ height }}>
        <iframe
          src={url}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          referrerPolicy="no-referrer"
        />
        {dragging && <div className="absolute inset-0 z-10 cursor-ns-resize" />}
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          className="absolute bottom-0 right-0 z-20 flex h-3 w-3 cursor-ns-resize items-center justify-center"
        >
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-neutral-400">
            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
