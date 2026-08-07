// Tiptap stores rich text as a JSON document tree.
export type TiptapDoc = Record<string, unknown>;

export interface DocumentRow {
  id: string;
  title: string;
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
