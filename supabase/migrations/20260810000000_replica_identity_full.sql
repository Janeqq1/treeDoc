-- Postgres only includes primary-key columns in the "old row" it publishes
-- for UPDATE/DELETE by default. Our RLS policies need document_id from that
-- old row to decide who's allowed to see a delete event — without it,
-- Realtime can't evaluate the policy and just drops the event, so deletes
-- never reach other open tabs until they reload. FULL includes every column.
alter table nodes replica identity full;
alter table document_collaborators replica identity full;
