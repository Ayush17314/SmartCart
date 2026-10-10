import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthActionForm } from "@/components/auth-action-form";
export const metadata: Metadata = { title: "Choose a new password" };
export default function ResetPasswordPage() { return <section className="mx-auto max-w-md px-5 py-20"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Account recovery</p><h1 className="mt-3 font-display text-5xl">Choose a new password.</h1><p className="mb-8 mt-4 text-sm leading-6 text-ink/60">Reset links expire after 30 minutes and can be used once.</p><Suspense fallback={<div className="skeleton h-52 rounded-2xl" />}><AuthActionForm mode="reset" /></Suspense></section>; }
