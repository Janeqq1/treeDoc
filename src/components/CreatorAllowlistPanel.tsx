"use client";

import { useCallback, useEffect, useState } from "react";
import { addAllowedCreator, listAllowedCreators, removeAllowedCreator } from "@/lib/queries";
import type { AllowlistRow } from "@/lib/types";

export default function CreatorAllowlistPanel() {
  const [entries, setEntries] = useState<AllowlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setEntries(await listAllowedCreators());
  }, []);

  useEffect(() => {
    let cancelled = false;
    listAllowedCreators().then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await addAllowedCreator(trimmed);
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that email.");
    }
  }, [email, refresh]);

  const handleRemove = useCallback(
    async (id: string) => {
      await removeAllowedCreator(id);
      await refresh();
    },
    [refresh],
  );

  return (
    <div className="mt-6 rounded border border-neutral-200 bg-neutral-50 p-3">
      <h2 className="text-sm font-semibold text-neutral-800">Who can create documents</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        Only you (as admin) and the emails below can start new documents. This doesn&apos;t affect
        who can view or edit documents already shared with someone — that&apos;s controlled per
        document via Share.
      </p>

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
        <button
          type="button"
          onClick={handleAdd}
          className="rounded bg-neutral-800 px-2 py-1 text-xs text-white hover:bg-neutral-700"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <ul className="mt-2 divide-y divide-neutral-200">
        {loading && <li className="py-2 text-xs text-neutral-400">Loading…</li>}
        {!loading && entries.length === 0 && (
          <li className="py-2 text-xs text-neutral-400">No one added yet — just you.</li>
        )}
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
            <span className="truncate text-neutral-700">{entry.email}</span>
            <button
              type="button"
              onClick={() => handleRemove(entry.id)}
              className="shrink-0 text-red-400 hover:text-red-600"
            >
              remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
