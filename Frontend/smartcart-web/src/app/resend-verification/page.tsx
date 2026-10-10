import type { Metadata } from "next";
import { AuthActionForm } from "@/components/auth-action-form";
export const metadata: Metadata = { title: "Verify your email" };
export default function ResendVerificationPage() { return <section className="mx-auto max-w-md px-5 py-20"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Account verification</p><h1 className="mt-3 font-display text-5xl">Check your email.</h1><p className="mb-8 mt-4 text-sm leading-6 text-ink/60">Request a fresh verification link. The response won’t reveal whether an address has an account.</p><AuthActionForm mode="resend" /></section>; }
