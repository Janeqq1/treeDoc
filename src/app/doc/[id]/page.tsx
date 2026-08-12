"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { deleteDocument, getDocument, listCollaborators, subscribeToCollaboratorChanges } from "@/lib/queries";
import type { CollaboratorRow, DocumentRow } from "@/lib/types";
import TreeView from "@/components/TreeView";
import SharePanel from "@/components/SharePanel";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase/client";

// @react-pdf/renderer isn't SSR-safe, so this must only ever run client-side.
const DocumentActionsMenu = dynamic(() => import("@/components/DocumentActionsMenu"), { ssr: false });

export default function DocumentPage({ params }: PageProps<"/doc/[id]">) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <DocumentContent id={id} />
    </RequireAuth>
  );
}

const EDIT_MODE_TIMEOUT_MS = 2 * 60 * 1000;

function DocumentContent({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Defaults to view-only every time the page loads, even for people who
  // can edit — they have to consciously flip this on, so a stray click
  // can't silently modify the document. Any click or keypress while it's
  // on resets a timer that flips it back off after a couple of minutes of
  // no activity at all.
  const [editModeOn, setEditModeOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDocument(id).then((d) => {
      if (cancelled) return;
      if (!d) setNotFound(true);
      else setDoc(d);
    });
    listCollaborators(id).then((rows) => {
      if (!cancelled) setCollaborators(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Live-sync collaborator changes so a permission downgrade (or removal)
  // takes effect immediately for anyone with the document already open,
  // instead of only on their next reload.
  useEffect(() => {
    return subscribeToCollaboratorChanges(id, (payload) => {
      setCollaborators((prev) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id?: string }).id;
          return prev.filter((c) => c.id !== oldId);
        }
        const row = payload.new as CollaboratorRow;
        const exists = prev.some((c) => c.id === row.id);
        return exists ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row];
      });
    });
  }, [id]);

  // Auto-revert to view-only after a stretch of no activity at all, so an
  // edit session left open doesn't stay unlocked indefinitely.
  useEffect(() => {
    if (!editModeOn) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setEditModeOn(false), EDIT_MODE_TIMEOUT_MS);
    };
    resetTimer();
    document.addEventListener("mousedown", resetTimer);
    document.addEventListener("keydown", resetTimer);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", resetTimer);
      document.removeEventListener("keydown", resetTimer);
    };
  }, [editModeOn]);

  const handleDeleteDocument = useCallback(async () => {
    if (!doc) return;
    if (!window.confirm(`Delete "${doc.title}" and everything in it? This can't be undone.`)) return;
    await deleteDocument(doc.id);
    router.push("/");
  }, [doc, router]);

  if (notFound) {
    return (
      <main className="w-full px-8 py-8">
        <p className="text-neutral-500">Document not found.</p>
        <Link href="/" className="text-sm text-sky-600 hover:underline">
          ← Back home
        </Link>
      </main>
    );
  }

  if (!user) return null;

  const isOwner = doc?.owner_id === user.id;
  const myRole = collaborators.find((c) => c.email === user.email)?.role;
  const canEdit = isOwner || myRole === "editor";

  return (
    <main className="relative w-full px-8">
      <header className="flex items-start justify-between border-b border-neutral-200 px-6 py-4">
        <div>
          <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-600">
            ← All documents
          </Link>
          <h1 className="text-lg font-semibold text-neutral-800">{doc?.title ?? "Loading…"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">{user.email}</span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Sign out
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditModeOn((v) => !v)}
              className={
                editModeOn
                  ? "rounded border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                  : "rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              }
            >
              {editModeOn ? "EDIT" : "VIEW"}
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setShareOpen((v) => !v)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
            >
              Share
            </button>
          )}
          {doc && <DocumentActionsMenu documentId={id} documentTitle={doc.title} />}
          {isOwner && (
            <button
              type="button"
              onClick={handleDeleteDocument}
              title="Delete document"
              className="rounded border border-neutral-300 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </header>
      {shareOpen && isOwner && <SharePanel documentId={id} />}
      <TreeView documentId={id} canEdit={canEdit && editModeOn} />
    </main>
  );
}
