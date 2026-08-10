"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addCollaborator,
  listCollaborators,
  removeCollaborator,
  updateCollaboratorRole,
} from "@/lib/queries";
import type { CollaboratorRole, CollaboratorRow } from "@/lib/types";

export default function SharePanel({ documentId }: { documentId: string }) {
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("viewer");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setCollaborators(await listCollaborators(documentId));
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    listCollaborators(documentId).then((rows) => {
      if (cancelled) return;
      setCollaborators(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const handleAdd = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await addCollaborator(documentId, trimmed, role);
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that email.");
    }
  }, [documentId, email, role, refresh]);

  const handleRoleChange = useCallback(
    async (id: string, newRole: CollaboratorRole) => {
      await updateCollaboratorRole(id, newRole);
      await refresh();
    },
    [refresh],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      await removeCollaborator(id);
      await refresh();
    },
    [refresh],
  );

  return (
    <div className="absolute right-6 top-14 z-10 w-80 rounded border border-neutral-200 bg-white p-3 shadow-md">
      <h2 className="text-sm font-semibold text-neutral-800">Share this document</h2>

      <div className="mt-2 flex gap-1">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as CollaboratorRole)}
          className="rounded border border-neutral-300 px-1 py-1 text-xs"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded bg-neutral-800 px-2 py-1 text-xs text-white hover:bg-neutral-700"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <ul className="mt-3 divide-y divide-neutral-100">
        {loading && <li className="py-2 text-xs text-neutral-400">Loading…</li>}
        {!loading && collaborators.length === 0 && (
          <li className="py-2 text-xs text-neutral-400">Not shared with anyone yet.</li>
        )}
        {collaborators.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-xs">
            <span className="truncate text-neutral-700">{c.email}</span>
            <div className="flex shrink-0 items-center gap-1">
              <select
                value={c.role}
                onChange={(e) => handleRoleChange(c.id, e.target.value as CollaboratorRole)}
                className="rounded border border-neutral-300 px-1 py-0.5 text-xs"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                className="text-red-400 hover:text-red-600"
              >
                remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
