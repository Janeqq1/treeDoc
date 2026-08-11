import { createClient } from "@supabase/supabase-js";
import { debugLog } from "@/lib/authDebug";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// TEMPORARY: catch anything the library's own internal init (which starts
// immediately on createClient, before React even mounts) might throw and
// swallow, plus record which hash param NAMES (never values) are present
// at the earliest possible moment this module runs.
if (typeof window !== "undefined") {
  debugLog({
    event: "client-module-eval",
    supabaseUrlConfigured: !!supabaseUrl,
    anonKeyConfigured: !!supabaseAnonKey,
    hashParamNames: window.location.hash ? window.location.hash.slice(1).split("&").map((p) => p.split("=")[0]) : [],
  });
  window.addEventListener("error", (e) => {
    debugLog({ event: "window-error", message: e.message, filename: e.filename, lineno: e.lineno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    let reason = "unknown";
    try {
      reason = e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : JSON.stringify(e.reason);
    } catch {
      reason = String(e.reason);
    }
    debugLog({ event: "unhandledrejection", reason });
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
