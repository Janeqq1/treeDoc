-- Documents: top-level shared trees
create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  created_at timestamptz not null default now()
);

-- Nodes: the tree itself. parent_id null = top-level node within a document.
create table nodes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  parent_id uuid references nodes(id) on delete cascade,
  position integer not null,
  summary text not null default '',
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nodes_document_id_idx on nodes(document_id);
create index nodes_parent_id_idx on nodes(parent_id);

-- Keep updated_at current on edits
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger nodes_set_updated_at
  before update on nodes
  for each row
  execute function set_updated_at();

-- No auth yet: RLS stays open. Enabling RLS with permissive policies now
-- (rather than skipping it) means tightening later is just replacing the
-- `using (true)` clauses, not bolting RLS on from scratch.
alter table documents enable row level security;
alter table nodes enable row level security;

create policy "documents are open for now" on documents
  for all using (true) with check (true);

create policy "nodes are open for now" on nodes
  for all using (true) with check (true);

-- RLS policies only govern row visibility; the anon/authenticated roles also
-- need base table grants, matching the "open for now" policies above.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on documents, nodes to anon, authenticated;

-- Enable Realtime change feed on nodes so clients can subscribe to live edits.
alter publication supabase_realtime add table nodes;
