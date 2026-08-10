"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { updateNode } from "@/lib/queries";
import { safeMutate } from "@/lib/safeMutate";
import type { NodeRow } from "@/lib/types";

export default function ExplanationEditor({ node, canEdit }: { node: NodeRow; canEdit: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Content we just saved, waiting for the node.explanation prop to catch up
  // (it only updates once the realtime round-trip completes). While pending,
  // the editor's own content is already correct — don't let the remote-sync
  // effect below clobber it with the stale pre-save prop value.
  const pendingSaveRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
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

    const current = JSON.stringify(editor.getJSON());
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
    const json = editor.getJSON();
    pendingSaveRef.current = JSON.stringify(json);
    const ok = await safeMutate(() => updateNode(node.id, { explanation: json }));
    if (!ok) pendingSaveRef.current = null;
  }, [editor, node.id]);

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

  if (!isEditing) {
    return (
      <div
        onClick={canEdit ? () => setIsEditing(true) : undefined}
        className={`rounded px-1 py-0.5 text-sm text-neutral-600 ${canEdit ? "cursor-text hover:bg-white/60" : ""}`}
      >
        {editor.isEmpty ? (
          canEdit ? (
            <span className="italic text-neutral-400">Click to add an explanation…</span>
          ) : null
        ) : (
          <div className="max-h-40 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mt-1 rounded border border-neutral-300 bg-white p-2">
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
      </div>
      <div className="h-40 min-h-[3rem] resize-y overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
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
