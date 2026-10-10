import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthActionForm } from "@/components/auth-action-form";
export const metadata: Metadata = { title: "Verify your email" };
export default function VerifyEmailPage() { return <section className="mx-auto max-w-md px-5 py-20"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Account verification</p><h1 className="mt-3 font-display text-5xl">One last step.</h1><div className="mb-8 mt-6"><Suspense fallback={<div className="skeleton h-20 rounded-2xl" />}><AuthActionForm mode="verify" /></Suspense></div><Link href="/login" className="text-sm underline underline-offset-4">Return to sign in</Link></section>; }
