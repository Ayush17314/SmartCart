"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Mode = "forgot" | "resend" | "reset" | "verify";

export function AuthActionForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(mode === "verify");
  const previewLink = preview.match(/https?:\/\/\S+/)?.[0];

  useEffect(() => {
    if (mode !== "verify") return;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) { setError("This verification link is invalid or expired."); setPending(false); return; }
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.message || "This verification link is invalid or expired.");
        setMessage(body.data?.message || "Email verified. You can now sign in.");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not verify this email."))
      .finally(() => setPending(false));
  }, [mode]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setMessage(""); setPreview("");
    if (!email.trim() || ((mode === "reset") && (!password || password !== confirmation || password.length < 8))) {
      setError(mode === "reset" ? "Enter matching passwords with at least 8 characters." : "Enter a valid email address."); return;
    }
    setPending(true);
    try {
      const path = mode === "forgot" ? "forgot-password" : mode === "resend" ? "resend-verification" : "reset-password";
      const token = mode === "reset" ? new URLSearchParams(window.location.hash.slice(1)).get("token") : undefined;
      const body = mode === "reset" ? { token, password } : { email: email.trim() };
      if (mode === "reset" && !token) throw new Error("Reset link is invalid or expired.");
      const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Request could not be completed.");
      setMessage(result.message || result.data?.message || "Request received.");
      setPreview(result.data?.developmentEmailPreview || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request could not be completed.");
    } finally { setPending(false); }
  };

  if (mode === "verify") return <div className="space-y-4">{pending && <p role="status">Verifying your email…</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}</div>;

  return <form onSubmit={submit} className="space-y-5">
    {mode !== "reset" && <label className="block text-sm font-medium">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required className="field" placeholder="you@example.com" /></label>}
    {mode === "reset" && <><label className="block text-sm font-medium">New password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" required minLength={8} className="field" /></label><label className="block text-sm font-medium">Confirm password<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" autoComplete="new-password" required minLength={8} className="field" /></label></>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
    {previewLink && <a href={previewLink} className="block break-all rounded-xl bg-sand p-4 text-xs text-emerald-800 underline">Open development-only email link</a>}
    <Button className="w-full" disabled={pending}>{pending ? "Please wait…" : mode === "forgot" ? "Send reset link" : mode === "resend" ? "Send verification link" : "Update password"}</Button>
  </form>;
}
