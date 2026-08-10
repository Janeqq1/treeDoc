"use client";

import { useCallback, useEffect, useState } from "react";
import { createNode, deleteNode, updateNode } from "@/lib/queries";
import { nodeColorClasses } from "@/lib/colors";
import { safeMutate } from "@/lib/safeMutate";
import type { NodeRow } from "@/lib/types";
import ExplanationEditor from "./ExplanationEditor";

interface TreeNodeProps {
  node: NodeRow;
  depth: number;
  siblingIndex: number;
  childrenByParent: Map<string | null, NodeRow[]>;
  documentId: string;
  canEdit: boolean;
  pendingNewNodeId: string | null;
  onNodeCreated: (id: string) => void;
  onPendingNewNodeHandled: () => void;
}

export default function TreeNode({
  node,
  depth,
  siblingIndex,
  childrenByParent,
  documentId,
  canEdit,
  pendingNewNodeId,
  onNodeCreated,
  onPendingNewNodeHandled,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(node.summary);
  // True only for the window right after this node was created and hasn't
  // been named yet — lets us tell "abandoned draft" apart from "someone
  // intentionally cleared an existing node's name."
  const [isFreshUnnamed, setIsFreshUnnamed] = useState(false);

  const children = childrenByParent.get(node.id) ?? [];
  const hasChildren = children.length > 0;

  useEffect(() => {
    if (pendingNewNodeId !== node.id) return;
    queueMicrotask(() => {
      setSummaryDraft("");
      setIsFreshUnnamed(true);
      setEditingSummary(true);
    });
    onPendingNewNodeHandled();
  }, [pendingNewNodeId, node.id, onPendingNewNodeHandled]);

  const startEditingSummary = useCallback(() => {
    setSummaryDraft(node.summary);
    setIsFreshUnnamed(false);
    setEditingSummary(true);
  }, [node.summary]);

  const saveSummary = useCallback(async () => {
    setEditingSummary(false);
    const trimmed = summaryDraft.trim();
    if (isFreshUnnamed && trimmed === "") {
      setIsFreshUnnamed(false);
      await safeMutate(() => deleteNode(node.id));
      return;
    }
    setIsFreshUnnamed(false);
    if (summaryDraft !== node.summary) {
      await safeMutate(() => updateNode(node.id, { summary: summaryDraft }));
    }
  }, [node.id, node.summary, summaryDraft, isFreshUnnamed]);

  const cancelEditingSummary = useCallback(async () => {
    setEditingSummary(false);
    if (isFreshUnnamed) {
      setIsFreshUnnamed(false);
      await safeMutate(() => deleteNode(node.id));
      return;
    }
    setSummaryDraft(node.summary);
  }, [node.id, node.summary, isFreshUnnamed]);

  const handleAddSibling = useCallback(async () => {
    try {
      const created = await createNode(documentId, node.parent_id);
      onNodeCreated(created.id);
    } catch (error) {
      console.error("Failed to add sibling:", error);
    }
  }, [documentId, node.parent_id, onNodeCreated]);

  const handleAddChild = useCallback(async () => {
    try {
      const created = await createNode(documentId, node.id);
      onNodeCreated(created.id);
      setExpanded(true);
    } catch (error) {
      console.error("Failed to add child:", error);
    }
  }, [documentId, node.id, onNodeCreated]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete "${node.summary || "this node"}" and all its children?`)) return;
    await safeMutate(() => deleteNode(node.id));
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
              placeholder="New bid"
              onChange={(e) => setSummaryDraft(e.target.value)}
              onBlur={saveSummary}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") cancelEditingSummary();
              }}
            />
          ) : canEdit ? (
            <button
              type="button"
              className="text-left text-sm font-semibold text-neutral-800"
              onClick={startEditingSummary}
            >
              {node.summary || (
                <span className="italic text-neutral-400">Click to name this bid…</span>
              )}
            </button>
          ) : (
            <span className="block text-left text-sm font-semibold text-neutral-800">
              {node.summary || <span className="italic text-neutral-400">Untitled bid</span>}
            </span>
          )}

          <ExplanationEditor node={node} canEdit={canEdit} />
        </div>

        {canEdit && (
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
        )}
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
              canEdit={canEdit}
              pendingNewNodeId={pendingNewNodeId}
              onNodeCreated={onNodeCreated}
              onPendingNewNodeHandled={onPendingNewNodeHandled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
