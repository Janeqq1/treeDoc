"use client";

import { useCallback, useState } from "react";
import { createNode, deleteNode, updateNode } from "@/lib/queries";
import { nodeColorClasses } from "@/lib/colors";
import type { NodeRow } from "@/lib/types";
import ExplanationEditor from "./ExplanationEditor";

interface TreeNodeProps {
  node: NodeRow;
  depth: number;
  siblingIndex: number;
  childrenByParent: Map<string | null, NodeRow[]>;
  documentId: string;
}

export default function TreeNode({
  node,
  depth,
  siblingIndex,
  childrenByParent,
  documentId,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(node.summary);

  const children = childrenByParent.get(node.id) ?? [];
  const hasChildren = children.length > 0;

  const startEditingSummary = useCallback(() => {
    setSummaryDraft(node.summary);
    setEditingSummary(true);
  }, [node.summary]);

  const saveSummary = useCallback(async () => {
    setEditingSummary(false);
    if (summaryDraft !== node.summary) {
      await updateNode(node.id, { summary: summaryDraft });
    }
  }, [node.id, node.summary, summaryDraft]);

  const handleAddSibling = useCallback(async () => {
    await createNode(documentId, node.parent_id, "New bid");
  }, [documentId, node.parent_id]);

  const handleAddChild = useCallback(async () => {
    await createNode(documentId, node.id, "New bid");
    setExpanded(true);
  }, [documentId, node.id]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete "${node.summary || "this node"}" and all its children?`)) return;
    await deleteNode(node.id);
  }, [node.id, node.summary]);

  return (
    <div className="relative">
      <div
        className={`group flex items-start gap-2 rounded-md border px-3 py-2 ${nodeColorClasses(depth, siblingIndex)}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={`mt-0.5 h-4 w-4 shrink-0 text-neutral-500 ${hasChildren ? "" : "invisible"}`}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>

        <div className="min-w-0 flex-1">
          {editingSummary ? (
            <input
              autoFocus
              className="w-full rounded border border-neutral-300 px-1.5 py-0.5 text-sm font-semibold outline-none focus:border-neutral-500"
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              onBlur={saveSummary}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setSummaryDraft(node.summary);
                  setEditingSummary(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="text-left text-sm font-semibold text-neutral-800"
              onClick={startEditingSummary}
            >
              {node.summary || (
                <span className="italic text-neutral-400">Click to name this bid…</span>
              )}
            </button>
          )}

          <ExplanationEditor node={node} />
        </div>

        <div className="pointer-events-none flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={handleAddSibling}
            title="Add sibling"
            className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-white hover:text-neutral-800"
          >
            + sibling
          </button>
          <button
            type="button"
            onClick={handleAddChild}
            title="Add child"
            className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-white hover:text-neutral-800"
          >
            + child
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete"
            className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-white hover:text-red-600"
          >
            delete
          </button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 ml-6 space-y-1 border-l border-neutral-200 pl-3">
          {children.map((child, index) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              siblingIndex={index}
              childrenByParent={childrenByParent}
              documentId={documentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
