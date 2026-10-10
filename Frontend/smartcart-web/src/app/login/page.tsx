import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPortal } from "@/components/login-portal";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <section className="mx-auto grid min-h-[78vh] max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-2 md:gap-16 md:px-8 md:py-14">
    <div className="relative hidden min-h-[590px] overflow-hidden rounded-[2rem] bg-[#d9ded5] md:block">
      <img src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1200&q=85" className="absolute inset-0 h-full w-full object-cover" alt="A calm, sunlit home with carefully chosen furniture" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-10 text-white"><p className="mb-3 text-xs uppercase tracking-[.22em] text-white/75">Thoughtful finds for everyday living</p><p className="max-w-sm font-display text-4xl leading-tight">Make room for the things you love.</p></div>
    </div>
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-700/15 bg-emerald-700/5 px-3 py-1.5 text-xs font-medium text-emerald-700"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-700" />SmartCart secure access</div>
      <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}><LoginPortal /></Suspense>
    </div>
  </section>;
}
