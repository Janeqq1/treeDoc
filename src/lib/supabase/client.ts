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

  // Wrap fetch to see every network attempt the auth library makes,
  // including ones that fail before ever reaching the Network tab.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
    const isAuthCall = url.includes("/auth/v1/");
    if (isAuthCall) debugLog({ event: "fetch-start", path: url.split("/auth/v1/")[1]?.split("?")[0] });
    try {
      const response = await originalFetch(...args);
      if (isAuthCall) {
        debugLog({
          event: "fetch-done",
          path: url.split("/auth/v1/")[1]?.split("?")[0],
          status: response.status,
        });
      }
      return response;
    } catch (err) {
      if (isAuthCall) {
        debugLog({
          event: "fetch-threw",
          path: url.split("/auth/v1/")[1]?.split("?")[0],
          message: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
