import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import {
  EMPTY_EXPLANATION,
  type AllowlistRow,
  type CollaboratorRole,
  type CollaboratorRow,
  type DocumentExport,
  type DocumentRow,
  type NodeRow,
  type TiptapDoc,
} from "./types";

const POSITION_GAP = 1000;

export function isDocumentExport(data: unknown): data is DocumentExport {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.document === "object" &&
    d.document !== null &&
    typeof (d.document as Record<string, unknown>).title === "string" &&
    Array.isArray(d.nodes) &&
    Array.isArray(d.collaborators)
  );
}

export async function isAllowedCreator(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_allowed_creator");
  if (error) throw error;
  return data;
}

export async function isAppAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_app_admin");
  if (error) throw error;
  return data;
}

export async function listAllowedCreators(): Promise<AllowlistRow[]> {
  const { data, error } = await supabase
    .from("document_creators_allowlist")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addAllowedCreator(email: string): Promise<AllowlistRow> {
  const { data, error } = await supabase
    .from("document_creators_allowlist")
    .insert({ email: email.trim().toLowerCase() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeAllowedCreator(id: string): Promise<void> {
  const { error } = await supabase.from("document_creators_allowlist").delete().eq("id", id);
  if (error) throw error;
}

export async function listDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDocument(title: string, ownerId: string): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .insert({ title, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listNodes(documentId: string): Promise<NodeRow[]> {
  const { data, error } = await supabase
    .from("nodes")
    .select("*")
    .eq("document_id", documentId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

async function nextSiblingPosition(
  documentId: string,
  parentId: string | null,
): Promise<number> {
  let query = supabase
    .from("nodes")
    .select("position")
    .eq("document_id", documentId)
    .order("position", { ascending: false })
    .limit(1);
  query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data?.[0]?.position ?? 0) + POSITION_GAP;
}

export async function createNode(
  documentId: string,
  parentId: string | null,
  summary = "",
): Promise<NodeRow> {
  const position = await nextSiblingPosition(documentId, parentId);
  const { data, error } = await supabase
    .from("nodes")
    .insert({
      document_id: documentId,
      parent_id: parentId,
      position,
      summary,
      explanation: EMPTY_EXPLANATION,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNode(
  id: string,
  patch: Partial<{ summary: string; explanation: TiptapDoc }>,
): Promise<void> {
  const { error } = await supabase.from("nodes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from("nodes").delete().eq("id", id);
  if (error) throw error;
}

export async function listCollaborators(documentId: string): Promise<CollaboratorRow[]> {
  const { data, error } = await supabase
    .from("document_collaborators")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addCollaborator(
  documentId: string,
  email: string,
  role: CollaboratorRole,
): Promise<CollaboratorRow> {
  const { data, error } = await supabase
    .from("document_collaborators")
    .insert({ document_id: documentId, email: email.trim().toLowerCase(), role })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCollaboratorRole(id: string, role: CollaboratorRole): Promise<void> {
  const { error } = await supabase.from("document_collaborators").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function removeCollaborator(id: string): Promise<void> {
  const { error } = await supabase.from("document_collaborators").delete().eq("id", id);
  if (error) throw error;
}

export async function exportDocumentToJson(documentId: string): Promise<DocumentExport> {
  const [doc, nodes, collaborators] = await Promise.all([
    getDocument(documentId),
    listNodes(documentId),
    listCollaborators(documentId),
  ]);
  if (!doc) throw new Error("Document not found");

  const childrenByParent = new Map<string | null, NodeRow[]>();
  for (const n of nodes) {
    const key = n.parent_id;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(n);
  }
  for (const list of childrenByParent.values()) list.sort((a, b) => a.position - b.position);

  // Walk parents-before-children so each node's parentIndex always points
  // to an already-emitted array entry.
  const ordered: NodeRow[] = [];
  const idToIndex = new Map<string, number>();
  const visit = (parentId: string | null) => {
    for (const n of childrenByParent.get(parentId) ?? []) {
      idToIndex.set(n.id, ordered.length);
      ordered.push(n);
      visit(n.id);
    }
  };
  visit(null);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    document: { title: doc.title },
    collaborators: collaborators.map((c) => ({ email: c.email, role: c.role })),
    nodes: ordered.map((n) => ({
      parentIndex: n.parent_id ? (idToIndex.get(n.parent_id) ?? null) : null,
      position: n.position,
      summary: n.summary,
      explanation: n.explanation,
    })),
  };
}

export async function importDocumentFromExport(
  data: DocumentExport,
  ownerId: string,
  titleOverride?: string,
): Promise<DocumentRow> {
  const doc = await createDocument(titleOverride?.trim() || data.document.title, ownerId);

  const ids = data.nodes.map(() => crypto.randomUUID());
  const nodeRows = data.nodes.map((n, i) => ({
    id: ids[i],
    document_id: doc.id,
    parent_id: n.parentIndex === null ? null : ids[n.parentIndex],
    position: n.position,
    summary: n.summary,
    explanation: n.explanation,
  }));

  if (nodeRows.length > 0) {
    const { error } = await supabase.from("nodes").insert(nodeRows);
    if (error) throw error;
  }

  if (data.collaborators.length > 0) {
    const { error } = await supabase.from("document_collaborators").insert(
      data.collaborators.map((c) => ({
        document_id: doc.id,
        email: c.email,
        role: c.role,
      })),
    );
    if (error) throw error;
  }

  return doc;
}

export function subscribeToCollaboratorChanges(
  documentId: string,
  onChange: (payload: RealtimePostgresChangesPayload<CollaboratorRow>) => void,
): () => void {
  const channel = supabase
    .channel(`document_collaborators:${documentId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "document_collaborators",
        filter: `document_id=eq.${documentId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNodeChanges(
  documentId: string,
  onChange: (payload: RealtimePostgresChangesPayload<NodeRow>) => void,
): () => void {
  const channel = supabase
    .channel(`nodes:${documentId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "nodes",
        filter: `document_id=eq.${documentId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
