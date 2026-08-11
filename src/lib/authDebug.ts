// TEMPORARY diagnostic helper: persists to localStorage so entries survive
// the Google/Supabase cross-origin redirect (unlike devtools, which reset on
// navigation). Never logs actual token/secret values, only shapes/names.
export function debugLog(entry: Record<string, unknown>) {
  try {
    const key = "__treedoc_auth_debug";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]");
    prev.push({ t: new Date().toISOString(), ...entry });
    localStorage.setItem(key, JSON.stringify(prev.slice(-40)));
  } catch {
    // ignore
  }
}
