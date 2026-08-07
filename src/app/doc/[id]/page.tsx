"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { use, useEffect, useState } from "react";
import { getDocument } from "@/lib/queries";
import type { DocumentRow } from "@/lib/types";
import TreeView from "@/components/TreeView";

// @react-pdf/renderer isn't SSR-safe, so this must only ever run client-side.
const ExportPdfButton = dynamic(() => import("@/components/ExportPdfButton"), { ssr: false });

export default function DocumentPage({ params }: PageProps<"/doc/[id]">) {
  const { id } = use(params);
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDocument(id).then((d) => {
      if (cancelled) return;
      if (!d) setNotFound(true);
      else setDoc(d);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  return (
    <main className="w-full px-8">
      <header className="flex items-start justify-between border-b border-neutral-200 px-6 py-4">
        <div>
          <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-600">
            ← All documents
          </Link>
          <h1 className="text-lg font-semibold text-neutral-800">{doc?.title ?? "Loading…"}</h1>
        </div>
        {doc && <ExportPdfButton documentId={id} documentTitle={doc.title} />}
      </header>
      <TreeView documentId={id} />
    </main>
  );
}
