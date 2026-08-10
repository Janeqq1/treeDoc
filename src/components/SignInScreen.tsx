"use client";

import { supabase } from "@/lib/supabase/client";

export default function SignInScreen() {
  const handleSignIn = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-xl font-semibold text-neutral-800">Bidding Trees</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        Shared, editable trees for bridge bidding systems. Sign in to view or edit a document.
      </p>
      <button
        type="button"
        onClick={handleSignIn}
        className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Sign in with Google
      </button>
    </div>
  );
}
