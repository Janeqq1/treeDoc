-- Per-document ownership + email-based collaborator sharing.

alter table documents add column owner_id uuid references auth.users(id) on delete cascade;

create table document_collaborators (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  email text not null,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  unique (document_id, email)
);

create index document_collaborators_document_id_idx on document_collaborators(document_id);
create index document_collaborators_email_idx on document_collaborators(email);

alter table document_collaborators enable row level security;

-- Lets RLS policies check "does this JWT belong to an invited email" without
-- granting broad SELECT access to auth.users itself.
create function current_user_email() returns text
language sql stable security definer set search_path = public as $$
  select email from auth.users where id = auth.uid();
$$;

-- documents and document_collaborators policies each need to check the OTHER
-- table (is this user the doc's owner? what's their collaborator role?).
-- Querying the other table directly from inside a policy re-triggers that
-- table's own RLS, which loops back and forth forever ("infinite recursion
-- detected in policy"). These two helpers break the cycle: security definer
-- makes them run as the function owner (postgres), who owns both tables and
-- is therefore exempt from their RLS — so the lookups inside are raw, no
-- policy re-evaluation.
create function is_document_owner(doc_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from documents d where d.id = doc_id and d.owner_id = auth.uid());
$$;

create function document_role_for_current_user(doc_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from document_collaborators dc
  where dc.document_id = doc_id and dc.email = current_user_email();
$$;

-- Replace the old fully-open policies with real ownership/collaborator checks.
drop policy "documents are open for now" on documents;
drop policy "nodes are open for now" on nodes;

create policy "owners and collaborators can view documents" on documents
  for select using (owner_id = auth.uid() or document_role_for_current_user(id) is not null);

create policy "authenticated users can create documents they own" on documents
  for insert with check (owner_id = auth.uid());

create policy "owners and editors can update documents" on documents
  for update using (owner_id = auth.uid() or document_role_for_current_user(id) = 'editor');

create policy "owners can delete documents" on documents
  for delete using (owner_id = auth.uid());

create policy "owners and collaborators can view nodes" on nodes
  for select using (
    is_document_owner(document_id) or document_role_for_current_user(document_id) is not null
  );

create policy "owners and editors can modify nodes" on nodes
  for insert with check (
    is_document_owner(document_id) or document_role_for_current_user(document_id) = 'editor'
  );

create policy "owners and editors can update nodes" on nodes
  for update using (
    is_document_owner(document_id) or document_role_for_current_user(document_id) = 'editor'
  );

create policy "owners and editors can delete nodes" on nodes
  for delete using (
    is_document_owner(document_id) or document_role_for_current_user(document_id) = 'editor'
  );

-- Owners see the full collaborator list (to manage it); a collaborator can
-- only see their own row (so the app can tell them apart, viewer vs editor).
create policy "owners view all collaborators, collaborators view their own row" on document_collaborators
  for select using (is_document_owner(document_id) or email = current_user_email());

create policy "owners add collaborators" on document_collaborators
  for insert with check (is_document_owner(document_id));

create policy "owners update collaborators" on document_collaborators
  for update using (is_document_owner(document_id));

create policy "owners remove collaborators" on document_collaborators
  for delete using (is_document_owner(document_id));

-- Unauthenticated requests should get nothing now, not just RLS-filtered rows.
revoke select, insert, update, delete on documents, nodes from anon;
grant select, insert, update, delete on document_collaborators to authenticated;
