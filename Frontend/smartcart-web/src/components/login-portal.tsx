"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

const portals = [
  { id: "customer", label: "Customer", icon: ShoppingBag, heading: "Welcome Back", subtitle: "Sign in to shop with SmartCart." },
  { id: "staff", label: "Staff / Store Manager", icon: Store, heading: "Store Management Login", subtitle: "Access your store operations and management tools." },
  { id: "super_admin", label: "Super Admin", icon: ShieldCheck, heading: "Super Admin Login", subtitle: "Authorized access to SmartCart administration." },
] as const;

type Portal = (typeof portals)[number]["id"];

export function LoginPortal() {
  const params = useSearchParams();
  const initial = params.get("portal");
  const [selected, setSelected] = useState<Portal>(initial === "staff" || initial === "super_admin" ? initial : "customer");
  const current = portals.find((portal) => portal.id === selected)!;

  return <>
    <fieldset className="mb-7">
      <legend className="mb-3 text-sm font-medium">Choose your sign-in portal</legend>
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-sand p-1.5">
        {portals.map(({ id, label, icon: Icon }) => <label key={id} className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-medium leading-tight transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700 sm:flex-row sm:text-xs ${selected === id ? "bg-white text-emerald-900 shadow-sm" : "text-ink/60 hover:text-ink"}`}><input className="sr-only" type="radio" name="login-portal" value={id} checked={selected === id} onChange={() => setSelected(id)} /><Icon size={16} aria-hidden="true"/><span>{label}</span></label>)}
      </div>
    </fieldset>
    <h1 className="font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">{current.heading}</h1>
    <p className="mb-7 mt-3 text-sm leading-6 text-ink/60">{current.subtitle}</p>
    <AuthForm key={selected} mode="login" audience={selected} />
    <p className="mt-7 text-center text-xs leading-5 text-ink/45">Sign in uses a secure, HTTP-only session. Portal access is verified by SmartCart.</p>
  </>;
}
