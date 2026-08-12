-- App-level allowlist controlling who can create new documents. This is
-- separate from (and doesn't affect) per-document sharing: an invited
-- collaborator can still view/edit whatever specific documents they've been
-- given access to even if they're not on this list — they just can't start
-- brand new documents of their own unless they're allowlisted here too.

create table document_creators_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table document_creators_allowlist enable row level security;

-- The app has a single fixed admin (the project owner) rather than a role
-- stored in the database, matching the "only I can manage this" scope the
-- feature was asked for. Kept as its own function (rather than inlined into
-- is_allowed_creator) so the admin is always implicitly allowed to create
-- documents without needing a row of their own in the allowlist table.
create function is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select current_user_email() = 'qinqin.j.wang@gmail.com';
$$;

create function is_allowed_creator() returns boolean
language sql stable security definer set search_path = public as $$
  select is_app_admin() or exists (
    select 1 from document_creators_allowlist where email = current_user_email()
  );
$$;

create policy "admin manages the creator allowlist" on document_creators_allowlist
  for all using (is_app_admin()) with check (is_app_admin());

-- Real enforcement lives here — the UI hides/disables Create & Import for
-- disallowed users, but that's just UX; this is what actually stops it.
drop policy "authenticated users can create documents they own" on documents;
create policy "allowlisted users can create documents they own" on documents
  for insert with check (owner_id = auth.uid() and is_allowed_creator());

grant select, insert, update, delete on document_creators_allowlist to authenticated;
revoke select, insert, update, delete on document_creators_allowlist from anon;
