"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await signIn("resend", {
        email: email.trim(),
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setError(res.error === "EmailSignin" ? "Failed to send email. Check your address." : String(res.error));
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-[var(--muted-foreground)] text-center max-w-md mb-4">
          We sent a sign-in link to <strong>{email}</strong>. Click the link to sign in.
        </p>
        <p className="text-sm text-[var(--muted-foreground)]">
          Didn’t get it? Check spam or{" "}
          <button type="button" className="underline" onClick={() => setSent(false)}>
            try again
          </button>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-2">Cript</h1>
      <p className="text-[var(--muted-foreground)] mb-6 text-center max-w-md">
        Transcript to study deck. Sign in with your email to continue.
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="w-full"
        />
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending…" : "Send sign-in link"}
        </Button>
      </form>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-3xl font-bold mb-2">Cript</h1>
        <p className="text-[var(--muted-foreground)]">Loading…</p>
      </main>
    }>
      <SignInForm />
    </Suspense>
  );
}
