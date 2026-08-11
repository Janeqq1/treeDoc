"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

// TEMPORARY diagnostic: survives the Google/Supabase redirect round-trip
// (unlike browser devtools, which reset on cross-origin navigation), so we
// can see what actually happened after the fact. Redacts real token values.
function debugLog(entry: Record<string, unknown>) {
  try {
    const key = "__treedoc_auth_debug";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]");
    prev.push({ t: new Date().toISOString(), ...entry });
    localStorage.setItem(key, JSON.stringify(prev.slice(-30)));
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    debugLog({
      event: "mount",
      hasHash: window.location.hash.length > 0,
      hashLooksLikeToken: window.location.hash.includes("access_token"),
      hashLooksLikeError: window.location.hash.includes("error"),
      hasSearch: window.location.search.length > 0,
      searchLooksLikeCode: window.location.search.includes("code="),
      searchLooksLikeError: window.location.search.includes("error"),
    });

    supabase.auth.getSession().then(({ data, error }) => {
      debugLog({ event: "getSession", hasSession: !!data.session, error: error?.message ?? null });
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      debugLog({ event: "onAuthStateChange", authEvent: event, hasSession: !!session });
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
