"use client";

import { useCallback, useEffect, useState } from "react";
import { createNode, deleteNode, updateNode } from "@/lib/queries";
import { nodeColorClasses } from "@/lib/colors";
import { safeMutate } from "@/lib/safeMutate";
import type { NodeRow } from "@/lib/types";
import ExplanationEditor from "./ExplanationEditor";
import { useDragDrop } from "./TreeView";

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

  const { draggedNode, dropTarget, startDrag, setDropTarget, commitDrop, endDrag } = useDragDrop();
  const isDragging = draggedNode?.id === node.id;
  // Reordering only makes sense among siblings under the same parent —
  // dropping onto a node with a different parent is rejected here, which
  // also rules out dropping a node onto one of its own descendants, since a
  // descendant's parent_id is never the dragged node's own parent_id.
  const isValidDropZone =
    !!draggedNode && draggedNode.parent_id === node.parent_id && draggedNode.id !== node.id;
  const showDropIndicator = isValidDropZone && dropTarget?.nodeId === node.id;

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
        onDragOver={(e) => {
          if (!isValidDropZone) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const edge = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
          setDropTarget(node.id, edge);
        }}
        onDrop={(e) => {
          if (!isValidDropZone) return;
          e.preventDefault();
          commitDrop();
        }}
        className={`group flex items-start gap-2 rounded-md border px-3 py-2 ${nodeColorClasses(depth, siblingIndex)} ${
          isDragging ? "opacity-40" : ""
        } ${showDropIndicator && dropTarget?.edge === "before" ? "border-t-4 border-t-sky-500" : ""} ${
          showDropIndicator && dropTarget?.edge === "after" ? "border-b-4 border-b-sky-500" : ""
        }`}
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
            <span
              draggable
              onDragStart={(e) => {
                startDrag(node);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", node.id);
              }}
              onDragEnd={endDrag}
              title="Drag to reorder"
              className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-neutral-400 hover:text-neutral-700 active:cursor-grabbing"
            >
              <svg viewBox="0 0 10 16" className="h-3.5 w-2.5" fill="currentColor">
                <circle cx="3" cy="3" r="1.3" />
                <circle cx="7" cy="3" r="1.3" />
                <circle cx="3" cy="8" r="1.3" />
                <circle cx="7" cy="8" r="1.3" />
                <circle cx="3" cy="13" r="1.3" />
                <circle cx="7" cy="13" r="1.3" />
              </svg>
            </span>
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
