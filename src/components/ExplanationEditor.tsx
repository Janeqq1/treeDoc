"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect, useRef, useState } from "react";
import { updateNode } from "@/lib/queries";
import { safeMutate } from "@/lib/safeMutate";
import type { NodeRow } from "@/lib/types";
import { LINK_PREVIEW_NODE_NAME, LinkPreviewNode, stripPreviewNodes } from "@/components/LinkPreviewNode";

const RESIZE_FOOTER_HEIGHT = 12;
const MIN_BOX_HEIGHT = 48 + RESIZE_FOOTER_HEIGHT;
const DEFAULT_BOX_HEIGHT = 160;

export default function ExplanationEditor({ node, canEdit }: { node: NodeRow; canEdit: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  // null = not yet manually resized. In view mode that means "auto height,
  // capped, only as tall as the content needs" (max-h-40); in edit mode it
  // means the spacious DEFAULT_BOX_HEIGHT editing area. Once someone drags
  // the handle, it becomes a fixed height that sticks across both modes.
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const [resizingBox, setResizingBox] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Content we just saved, waiting for the node.explanation prop to catch up
  // (it only updates once the realtime round-trip completes). While pending,
  // the editor's own content is already correct — don't let the remote-sync
  // effect below clobber it with the stale pre-save prop value.
  const pendingSaveRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: null },
      }),
      LinkPreviewNode,
    ],
    content: node.explanation,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none min-h-[1.4em]",
      },
    },
  });

  // Reflect remote edits (from other collaborators) while this user isn't
  // actively typing here, so live sync doesn't clobber in-progress input.
  useEffect(() => {
    if (!editor || isEditing) return;
    const incoming = JSON.stringify(node.explanation);

    if (pendingSaveRef.current !== null) {
      if (incoming === pendingSaveRef.current) pendingSaveRef.current = null;
      return;
    }

    const current = JSON.stringify(stripPreviewNodes(editor.getJSON()));
    if (incoming !== current) {
      editor.commands.setContent(node.explanation);
    }
  }, [editor, node.explanation, isEditing]);

  useEffect(() => {
    editor?.setEditable(isEditing);
    if (isEditing) editor?.commands.focus("end");
  }, [editor, isEditing]);

  const save = useCallback(async () => {
    if (!editor) return;
    setIsEditing(false);
    const json = stripPreviewNodes(editor.getJSON());
    pendingSaveRef.current = JSON.stringify(json);
    const ok = await safeMutate(() => updateNode(node.id, { explanation: json }));
    if (!ok) pendingSaveRef.current = null;
  }, [editor, node.id]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  // Links open an in-place preview instead of navigating away, inserted as
  // a real node right after the paragraph containing the link — so it
  // appears exactly where that link is, and multiple links can each have
  // their own preview open at once. Clicking is intercepted at the content
  // wrapper (works whether or not the editor is in edit mode) rather than
  // relying on Link's own openOnClick, so it also stops the click from
  // bubbling into the "click to start editing" / "click outside to save"
  // handlers. The preview's own "open in new tab" control is marked with
  // data-preview-external-link and left alone — checking for a `target`
  // attribute instead would be wrong, since existing content links can
  // carry one too (e.g. saved before this feature existed).
  //
  // Because this stops the click from reaching the "click to start editing"
  // handler, clicking a link while still in read-only view never used to
  // enter edit mode on its own — leaving the box in the non-editable
  // layout, which has no resize handle at all (only the edit-mode layout
  // does). That looked like a missing/flaky resize handle bug when really
  // the box just hadn't switched into edit mode yet. Entering edit mode
  // here too, for anyone who can edit, fixes that directly.
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editor) return;
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor || anchor.hasAttribute("data-preview-external-link")) return;
      e.preventDefault();
      e.stopPropagation();
      const url = anchor.getAttribute("href");
      if (!url) return;

      const pos = editor.view.posAtDOM(anchor, 0);
      const $pos = editor.state.doc.resolve(pos);
      const afterPos = $pos.after(1);

      const existing = editor.state.doc.nodeAt(afterPos);
      if (existing?.type.name === LINK_PREVIEW_NODE_NAME && existing.attrs.url === url) {
        editor.chain().deleteRange({ from: afterPos, to: afterPos + existing.nodeSize }).run();
      } else {
        editor.chain().insertContentAt(afterPos, { type: LINK_PREVIEW_NODE_NAME, attrs: { url } }).run();
      }

      // Deferred to its own microtask: inserting/removing the preview node
      // above makes Tiptap mount/unmount its NodeView synchronously (via
      // React's flushSync), and calling setIsEditing in the very same tick
      // collides with that ("flushSync was called from inside a lifecycle
      // method").
      if (canEdit) queueMicrotask(() => setIsEditing(true));
    },
    [editor, canEdit],
  );

  // A hand-rolled drag handle instead of CSS resize-y: the box's own
  // overflow-y-auto scrollbar and a native resize handle both want the same
  // bottom-right corner pixel, so once a link preview makes the content
  // overflow (showing the scrollbar), Chrome stops drawing the handle there.
  const startResizeBox = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizingBox(true);
      const startY = e.clientY;
      const startHeight = manualHeight ?? DEFAULT_BOX_HEIGHT;
      const onMove = (moveEvent: MouseEvent) => {
        setManualHeight(Math.max(MIN_BOX_HEIGHT, startHeight + (moveEvent.clientY - startY)));
      };
      const onUp = () => {
        setResizingBox(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [manualHeight],
  );

  // Blur-based "click away to save" is unreliable here: a contentEditable
  // element only reliably blurs when the new click target is itself
  // focusable (e.g. another node's button), not for plain non-focusable
  // elements like backgrounds or gaps between nodes. A document-level click
  // listener fires for literally any click, so it works consistently.
  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        save();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, save]);

  if (!editor) return null;

  // EditorContent stays mounted at one stable position in the tree at all
  // times — only the surrounding chrome (toolbar, resize footer, box
  // sizing) varies with isEditing. Previously view/edit mode were two
  // separate early-return JSX trees, each with its own <EditorContent>;
  // switching between them unmounted and remounted the ProseMirror view,
  // which silently dropped whatever a click had just done (e.g. opening a
  // link preview) if that click also happened to be what triggered the
  // switch into edit mode.
  const showPlaceholder = !isEditing && editor.isEmpty && canEdit;
  const showEmptyView = !isEditing && editor.isEmpty;
  // Edit mode always gets a spacious fixed-height area to type into. View
  // mode stays auto-height (compact, only as tall as the content) until
  // someone manually resizes it, at which point that size sticks.
  const fixedHeight = isEditing ? (manualHeight ?? DEFAULT_BOX_HEIGHT) : manualHeight;

  return (
    <div
      ref={containerRef}
      onClick={!isEditing && canEdit ? () => setIsEditing(true) : undefined}
      className={
        isEditing
          ? "mt-1 rounded border border-neutral-300 bg-white p-2"
          : `rounded px-1 py-0.5 text-sm text-neutral-600 ${canEdit ? "cursor-text hover:bg-white/60" : ""}`
      }
    >
      {isEditing && (
        <div className="mb-1 flex gap-1 border-b border-neutral-100 pb-1 text-xs">
          <ToolbarButton
            label="B"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="I"
            italic
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="• list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="1. list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton label="🔗" active={editor.isActive("link")} onClick={setLink} />
        </div>
      )}

      {showPlaceholder && <span className="italic text-neutral-400">Click to add an explanation…</span>}

      <div
        className={
          showEmptyView ? "hidden" : fixedHeight !== null ? "overflow-y-auto" : "max-h-40 overflow-y-auto"
        }
        style={fixedHeight !== null ? { height: fixedHeight - RESIZE_FOOTER_HEIGHT } : undefined}
        onClick={handleContentClick}
      >
        <EditorContent editor={editor} />
      </div>

      {/* The drag handle lives in its own strip below the scrollable area,
          never overlapping it, so it can't be covered by that area's own
          scrollbar — which can render at a different width/style (e.g. a
          permanent, wider track under some OS scrollbar settings) than
          whatever was used to size/position an overlaid handle. Available
          in both view and edit mode — resizing is a local display
          preference, not a data change, so viewers get it too. */}
      {!showEmptyView && (
        <div className="relative flex h-3 shrink-0 items-center justify-end pr-0.5">
          {resizingBox && <div className="fixed inset-0 z-50 cursor-ns-resize" />}
          <div
            onMouseDown={startResizeBox}
            title="Drag to resize"
            className="flex h-3 w-3 shrink-0 cursor-ns-resize items-center justify-center"
          >
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-neutral-400">
              <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  active,
  italic,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  italic?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 hover:bg-neutral-100 ${italic ? "italic" : ""} ${
        active ? "bg-neutral-200" : ""
      }`}
    >
      {label}
    </button>
  );
}
