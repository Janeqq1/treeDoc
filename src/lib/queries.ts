import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import { EMPTY_EXPLANATION, type DocumentRow, type NodeRow, type TiptapDoc } from "./types";

const POSITION_GAP = 1000;

export async function listDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDocument(title: string): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .insert({ title })
    .select()
    .single();
  if (error) throw error;
  return data;
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
