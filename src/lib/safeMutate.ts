// Wraps a write so a permission change that lands mid-action (e.g. an owner
// downgrades someone from editor to viewer right as they click something)
// fails quietly instead of surfacing as an unhandled crash. The live
// collaborator/canEdit sync means this should rarely trigger in practice —
// this is just the fallback for that race.
export async function safeMutate(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    console.error("Action failed — your access may have just changed:", error);
    return false;
  }
}
