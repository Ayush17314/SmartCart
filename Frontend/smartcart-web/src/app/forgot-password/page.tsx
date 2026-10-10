import type { Metadata } from "next";
import { AuthActionForm } from "@/components/auth-action-form";
export const metadata: Metadata = { title: "Reset your password" };
export default function ForgotPasswordPage() { return <section className="mx-auto max-w-md px-5 py-20"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Account recovery</p><h1 className="mt-3 font-display text-5xl">Forgot your password?</h1><p className="mb-8 mt-4 text-sm leading-6 text-ink/60">Enter your email and, if your account is eligible, we’ll send a link to choose a new password.</p><AuthActionForm mode="forgot" /></section>; }
