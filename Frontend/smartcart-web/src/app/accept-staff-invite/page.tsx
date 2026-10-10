"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function AcceptStaffInvitePage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const rawToken = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    setToken(rawToken);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) { toast.error("Invitation token is missing. Open the original invitation link."); return; }
    if (password.length < 8 || password.length > 128) { toast.error("Password must be between 8 and 128 characters."); return; }
    if (password !== confirmation) { toast.error("Passwords do not match."); return; }
    setPending(true);
    try { await api.acceptStaffInvite(token, password); setComplete(true); setToken(""); toast.success("Invitation accepted. You can sign in now."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not accept invitation"); }
    finally { setPending(false); }
  };
  return <section className="mx-auto max-w-md px-5 py-20"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Staff access</p><h1 className="mt-3 font-display text-5xl">Accept invitation.</h1>{complete ? <div className="mt-8 rounded-3xl bg-sand p-7"><p>Your staff account is ready. Sign in using the email address that received the invitation.</p><Link className="mt-5 inline-block underline" href="/login">Go to sign in</Link></div> : <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-ink/10 p-6"><label className="block text-sm">New password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" className="field mt-1" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="block text-sm">Confirm password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" className="field mt-1" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><Button className="w-full" disabled={pending || !token}>{pending ? "Accepting…" : "Set password and accept"}</Button>{!token && <p role="alert" className="text-sm text-red-700">Waiting for the invitation token. Open the full link from your email.</p>}</form>}<Link href="/login" className="mt-6 inline-block text-sm underline">Return to sign in</Link></section>;
}
