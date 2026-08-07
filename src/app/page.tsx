"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createDocument, listDocuments } from "@/lib/queries";
import type { DocumentRow } from "@/lib/types";

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    listDocuments().then((docs) => {
      setDocuments(docs);
      setLoading(false);
    });
  }, []);

  const handleCreate = useCallback(async () => {
    const doc = await createDocument(title.trim() || "Untitled bidding system");
    router.push(`/doc/${doc.id}`);
  }, [title, router]);

  return (
    <main className="w-full px-8 py-8">
      <h1 className="text-xl font-semibold text-neutral-800">Bidding Trees</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Shared, editable trees for bridge bidding systems.
      </p>

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
          className="rounded bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
        >
          Create
        </button>
      </div>

      <ul className="mt-8 divide-y divide-neutral-100">
        {loading && <li className="py-3 text-sm text-neutral-400">Loading…</li>}
        {!loading && documents.length === 0 && (
          <li className="py-3 text-sm text-neutral-400">No documents yet — create one above.</li>
        )}
        {documents.map((doc) => (
          <li key={doc.id} className="py-3">
            <Link
              href={`/doc/${doc.id}`}
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
