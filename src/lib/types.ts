// Tiptap stores rich text as a JSON document tree.
export type TiptapDoc = Record<string, unknown>;

export interface DocumentRow {
  id: string;
  title: string;
  owner_id: string | null;
  created_at: string;
}

export type CollaboratorRole = "viewer" | "editor";

export interface CollaboratorRow {
  id: string;
  document_id: string;
  email: string;
  role: CollaboratorRole;
  created_at: string;
}

export interface NodeRow {
  id: string;
  document_id: string;
  parent_id: string | null;
  position: number;
  summary: string;
  explanation: TiptapDoc;
  created_at: string;
  updated_at: string;
}

export const EMPTY_EXPLANATION: TiptapDoc = { type: "doc", content: [] };

// A full, lossless backup of one document — used by JSON export/import.
// Nodes reference their parent by array index (not by database id), since
// import always creates fresh nodes with fresh ids in a brand-new document.
export interface NodeExport {
  parentIndex: number | null;
  position: number;
  summary: string;
  explanation: TiptapDoc;
}

export interface CollaboratorExport {
  email: string;
  role: CollaboratorRole;
}

export interface DocumentExport {
  version: 1;
  exportedAt: string;
  document: { title: string };
  collaborators: CollaboratorExport[];
  nodes: NodeExport[];
}
