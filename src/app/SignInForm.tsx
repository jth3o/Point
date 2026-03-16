"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function SignInFormInner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const handleGoogleSignIn = () => {
    setError("");
    setLoading(true);
    signIn("google", { callbackUrl });
    // signIn with redirect: true (default) navigates away; loading state may not reset
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-2">Point</h1>
      <p className="text-[var(--muted-foreground)] mb-6 text-center max-w-md">
        Transcript to study deck. Sign in with Google to continue.
      </p>
      <div className="w-full max-w-sm space-y-3">
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <Button
          type="button"
          className="w-full"
          disabled={loading}
          onClick={handleGoogleSignIn}
        >
          {loading ? "Redirecting…" : "Sign in with Google"}
        </Button>
      </div>
    </main>
  );
}

export default function SignInForm() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-bold mb-2">Point</h1>
        <p className="text-[var(--muted-foreground)]">Loading…</p>
      </main>
    }>
      <SignInFormInner />
    </Suspense>
  );
}
