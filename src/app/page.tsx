"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDocument,
  importDocumentFromExport,
  isAllowedCreator,
  isAppAdmin,
  isDocumentExport,
  listDocuments,
} from "@/lib/queries";
import type { DocumentRow } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import CreatorAllowlistPanel from "@/components/CreatorAllowlistPanel";
import { supabase } from "@/lib/supabase/client";

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  );
}

function HomeContent() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // null while the permission checks are still loading — the buttons stay
  // disabled either way, but the "you're not allowed" message only shows
  // once we actually know that's true, not just because it hasn't loaded yet.
  const [canCreate, setCanCreate] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    listDocuments().then((docs) => {
      setDocuments(docs);
      setLoading(false);
    });
    isAllowedCreator().then(setCanCreate);
    isAppAdmin().then(setIsAdmin);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!user || !canCreate) return;
    const doc = await createDocument(title.trim() || "Untitled bidding system", user.id);
    router.push(`/doc/${doc.id}`);
  }, [title, router, user, canCreate]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !user) return;
      setImporting(true);
      setImportError(null);
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        if (!isDocumentExport(parsed)) {
          throw new Error("That doesn't look like a treeDoc export file.");
        }
        const doc = await importDocumentFromExport(parsed, user.id, title);
        router.push(`/doc/${doc.id}`);
      } catch (err) {
        console.error(err);
        setImportError(err instanceof Error ? err.message : "Couldn't import that file.");
      } finally {
        setImporting(false);
      }
    },
    [user, router, title],
  );

  if (!user) return null;

  return (
    <main className="w-full px-8 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-800">Bidding Trees</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Shared, editable trees for bridge bidding systems.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>{user.email}</span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="rounded border border-neutral-300 px-2.5 py-1 hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New document title…"
          className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="rounded bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Create
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          disabled={importing || !canCreate}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import JSON…"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
      {canCreate === false && (
        <p className="mt-2 text-xs text-neutral-400">
          Only invited creators can start new documents. Ask the admin for access if you&apos;d
          like to create your own.
        </p>
      )}
      {importError && <p className="mt-2 text-xs text-red-500">{importError}</p>}
      {isAdmin && <CreatorAllowlistPanel />}

      <ul className="mt-8 divide-y divide-neutral-100">
        {loading && <li className="py-3 text-sm text-neutral-400">Loading…</li>}
        {!loading && documents.length === 0 && (
          <li className="py-3 text-sm text-neutral-400">No documents yet — create one above.</li>
        )}
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between py-3">
            <Link
              href={`/doc/${doc.id}`}
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              {doc.title}
            </Link>
            <span className="text-xs text-neutral-400">
              {doc.owner_id === user.id ? "Owned by you" : "Shared with you"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
