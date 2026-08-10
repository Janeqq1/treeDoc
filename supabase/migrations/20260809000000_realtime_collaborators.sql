-- Collaborator role changes need to reach an already-open tab live, same as
-- node edits already do, so access downgrades take effect without a reload.
alter publication supabase_realtime add table document_collaborators;
