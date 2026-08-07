"use client";

import { pdf } from "@react-pdf/renderer";
import { useCallback, useState } from "react";
import { listNodes } from "@/lib/queries";
import BiddingTreePdfDocument from "./BiddingTreePdfDocument";

function slugify(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bidding-tree";
}

export default function ExportPdfButton({
  documentId,
  documentTitle,
}: {
  documentId: string;
  documentTitle: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const nodes = await listNodes(documentId);
      const blob = await pdf(<BiddingTreePdfDocument title={documentTitle} nodes={nodes} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(documentTitle)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [documentId, documentTitle]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
    >
      {isExporting ? "Generating…" : "Export PDF"}
    </button>
  );
}
