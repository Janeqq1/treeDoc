"use client";

import { pdf } from "@react-pdf/renderer";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { exportDocumentToJson, importDocumentFromExport, isDocumentExport, listNodes } from "@/lib/queries";
import { slugify } from "@/lib/slugify";
import { useAuth } from "@/components/AuthProvider";
import BiddingTreePdfDocument from "./BiddingTreePdfDocument";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DocumentActionsMenu({
  documentId,
  documentTitle,
}: {
  documentId: string;
  documentTitle: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "json" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPdf = useCallback(async () => {
    setBusy("pdf");
    setError(null);
    try {
      const nodes = await listNodes(documentId);
      const blob = await pdf(<BiddingTreePdfDocument title={documentTitle} nodes={nodes} />).toBlob();
      downloadBlob(blob, `${slugify(documentTitle)}.pdf`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("Couldn't export PDF.");
    } finally {
      setBusy(null);
    }
  }, [documentId, documentTitle]);

  const handleExportJson = useCallback(async () => {
    setBusy("json");
    setError(null);
    try {
      const data = await exportDocumentToJson(documentId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `${slugify(documentTitle)}.json`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("Couldn't export JSON.");
    } finally {
      setBusy(null);
    }
  }, [documentId, documentTitle]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !user) return;
      setBusy("import");
      setError(null);
      setOpen(false);
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        if (!isDocumentExport(parsed)) {
          throw new Error("That doesn't look like a treeDoc export file.");
        }
        const doc = await importDocumentFromExport(parsed, user.id);
        router.push(`/doc/${doc.id}`);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Couldn't import that file.");
      } finally {
        setBusy(null);
      }
    },
    [user, router],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50"
      >
        Export / Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileSelected}
      />
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded border border-neutral-200 bg-white py-1 shadow-md">
          <MenuItem onClick={handleExportPdf} disabled={busy !== null}>
            {busy === "pdf" ? "Generating…" : "Export PDF"}
          </MenuItem>
          <MenuItem onClick={handleExportJson} disabled={busy !== null}>
            {busy === "json" ? "Exporting…" : "Export JSON"}
          </MenuItem>
          <MenuItem onClick={handleImportClick} disabled={busy !== null}>
            {busy === "import" ? "Importing…" : "Import JSON…"}
          </MenuItem>
        </div>
      )}
      {error && (
        <p className="absolute right-0 top-full mt-1 w-56 rounded bg-white text-xs text-red-500 shadow-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
