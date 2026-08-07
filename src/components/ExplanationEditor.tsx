"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useState } from "react";
import { updateNode } from "@/lib/queries";
import type { NodeRow } from "@/lib/types";

export default function ExplanationEditor({ node }: { node: NodeRow }) {
  const [isEditing, setIsEditing] = useState(false);

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
    await updateNode(node.id, { explanation: editor.getJSON() });
  }, [editor, node.id]);

  if (!editor) return null;

  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-text rounded px-1 py-0.5 text-sm text-neutral-600 hover:bg-white/60"
      >
        {editor.isEmpty ? (
          <span className="italic text-neutral-400">Click to add an explanation…</span>
        ) : (
          <div className="max-h-40 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-1 rounded border border-neutral-300 bg-white p-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) save();
      }}
    >
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
