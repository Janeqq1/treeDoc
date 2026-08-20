"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { POSITION_GAP, createNode, listNodes, subscribeToNodeChanges, updateNode } from "@/lib/queries";
import { safeMutate } from "@/lib/safeMutate";
import type { NodeRow } from "@/lib/types";
import TreeNode from "./TreeNode";

// Drag-to-reorder state, shared across every TreeNode in the tree without
// threading half a dozen extra props through each recursive level (which
// already passes quite a few). Reordering is scoped to siblings under the
// same parent — dropping onto a node with a different parent is a no-op,
// which also conveniently rules out dropping a node onto one of its own
// descendants, since a descendant's parent_id is never the dragged node's
// own parent_id.
interface DropTarget {
  nodeId: string;
  edge: "before" | "after";
}
interface DragDropApi {
  draggedNode: NodeRow | null;
  dropTarget: DropTarget | null;
  startDrag: (node: NodeRow) => void;
  setDropTarget: (nodeId: string, edge: DropTarget["edge"]) => void;
  commitDrop: () => void;
  endDrag: () => void;
}
const DragDropContext = createContext<DragDropApi | null>(null);
export function useDragDrop(): DragDropApi {
  const ctx = useContext(DragDropContext);
  if (!ctx) throw new Error("useDragDrop must be used within TreeView");
  return ctx;
}

export default function TreeView({ documentId, canEdit }: { documentId: string; canEdit: boolean }) {
  const [nodesById, setNodesById] = useState<Record<string, NodeRow>>({});
  const [loading, setLoading] = useState(true);
  // The most recently created (still-unnamed) node, so the matching TreeNode
  // can auto-focus its summary field the moment it appears.
  const [pendingNewNodeId, setPendingNewNodeId] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<NodeRow | null>(null);
  const [dropTarget, setDropTargetState] = useState<DropTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    listNodes(documentId).then((nodes) => {
      if (cancelled) return;
      const map: Record<string, NodeRow> = {};
      for (const n of nodes) map[n.id] = n;
      setNodesById(map);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    return subscribeToNodeChanges(documentId, (payload) => {
      setNodesById((prev) => {
        const next = { ...prev };
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) delete next[oldId];
        } else {
          const row = payload.new as NodeRow;
          next[row.id] = row;
        }
        return next;
      });
    });
  }, [documentId]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, NodeRow[]>();
    for (const node of Object.values(nodesById)) {
      const key = node.parent_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [nodesById]);

  const rootNodes = childrenByParent.get(null) ?? [];

  const handleAddRoot = useCallback(async () => {
    try {
      const created = await createNode(documentId, null);
      setPendingNewNodeId(created.id);
    } catch (error) {
      console.error("Failed to add top-level bid:", error);
    }
  }, [documentId]);

  const handlePendingNewNodeHandled = useCallback(() => setPendingNewNodeId(null), []);

  const startDrag = useCallback((node: NodeRow) => setDraggedNode(node), []);
  const setDropTarget = useCallback(
    (nodeId: string, edge: DropTarget["edge"]) => setDropTargetState({ nodeId, edge }),
    [],
  );
  const endDrag = useCallback(() => {
    setDraggedNode(null);
    setDropTargetState(null);
  }, []);

  const commitDrop = useCallback(() => {
    const edge = dropTarget?.edge;
    const target = dropTarget ? nodesById[dropTarget.nodeId] : null;
    if (!draggedNode || !target || !edge || target.parent_id !== draggedNode.parent_id || target.id === draggedNode.id) {
      endDrag();
      return;
    }
    const siblings = (childrenByParent.get(draggedNode.parent_id) ?? []).filter(
      (n) => n.id !== draggedNode.id,
    );
    const targetIndex = siblings.findIndex((n) => n.id === target.id);
    const neighbor = edge === "before" ? siblings[targetIndex - 1] : siblings[targetIndex + 1];
    const newPosition =
      edge === "before"
        ? neighbor
          ? (neighbor.position + target.position) / 2
          : target.position / 2
        : neighbor
          ? (target.position + neighbor.position) / 2
          : target.position + POSITION_GAP;
    endDrag();
    safeMutate(() => updateNode(draggedNode.id, { position: newPosition }));
  }, [draggedNode, dropTarget, nodesById, childrenByParent, endDrag]);

  const dragDropApi = useMemo(
    () => ({ draggedNode, dropTarget, startDrag, setDropTarget, commitDrop, endDrag }),
    [draggedNode, dropTarget, startDrag, setDropTarget, commitDrop, endDrag],
  );

  if (loading) {
    return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <DragDropContext.Provider value={dragDropApi}>
      <div className="p-6">
        <div className="space-y-1">
          {rootNodes.map((node, index) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              siblingIndex={index}
              childrenByParent={childrenByParent}
              documentId={documentId}
              canEdit={canEdit}
              pendingNewNodeId={pendingNewNodeId}
              onNodeCreated={setPendingNewNodeId}
              onPendingNewNodeHandled={handlePendingNewNodeHandled}
            />
          ))}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleAddRoot}
            className="mt-4 rounded border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-800"
          >
            + Add top-level bid
          </button>
        )}
      </div>
    </DragDropContext.Provider>
  );
}
