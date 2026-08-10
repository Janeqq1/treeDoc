"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createNode, listNodes, subscribeToNodeChanges } from "@/lib/queries";
import type { NodeRow } from "@/lib/types";
import TreeNode from "./TreeNode";

export default function TreeView({ documentId, canEdit }: { documentId: string; canEdit: boolean }) {
  const [nodesById, setNodesById] = useState<Record<string, NodeRow>>({});
  const [loading, setLoading] = useState(true);
  // The most recently created (still-unnamed) node, so the matching TreeNode
  // can auto-focus its summary field the moment it appears.
  const [pendingNewNodeId, setPendingNewNodeId] = useState<string | null>(null);

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

  if (loading) {
    return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
  }

  return (
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
  );
}
