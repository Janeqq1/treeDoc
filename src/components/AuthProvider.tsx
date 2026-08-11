"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { debugLog } from "@/lib/authDebug";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

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
