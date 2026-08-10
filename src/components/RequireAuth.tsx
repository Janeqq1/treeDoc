"use client";

import { useAuth } from "./AuthProvider";
import SignInScreen from "./SignInScreen";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <SignInScreen />;
  return <>{children}</>;
}
