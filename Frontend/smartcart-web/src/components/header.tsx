"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Search, ShoppingBag, Sun, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useUI } from "@/store/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function Header() {
  const [search, setSearch] = useState(""); const [dark, setDark] = useState(false); const { setCartOpen, setSearchOpen } = useUI();
  const branding = useQuery({ queryKey: ["public-store-settings"], queryFn: api.publicStoreSettings, staleTime: 30_000 });
  useEffect(() => { const active = localStorage.getItem("smartcart-theme") === "dark"; setDark(active); document.documentElement.classList.toggle("dark", active); }, []);
  const toggleTheme = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("smartcart-theme", next ? "dark" : "light"); };
  return <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper/90 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-10"><nav className="hidden gap-8 text-sm text-ink/65 md:flex"><Link href="/products">Shop</Link><Link href="/products?category=Home">Home</Link><Link href="/products?category=Wear">Wear</Link></nav><BrandLogo className="absolute left-1/2 -translate-x-1/2" brandName={branding.data?.storeName} logoUrl={branding.data?.logoUrl || undefined}/><div className="ml-auto flex items-center gap-1"><button aria-label="Search products" onClick={() => setSearchOpen(true)} className="rounded-full p-3 hover:bg-black/5"><Search size={19}/></button><button aria-label="Toggle dark mode" onClick={toggleTheme} className="rounded-full p-3 hover:bg-black/5">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><Link href="/account" className="hidden px-3 py-2 text-sm md:block">Account</Link><button onClick={() => setCartOpen(true)} aria-label="Open cart" className="rounded-full p-3 hover:bg-black/5"><ShoppingBag size={19}/></button></div></div><SearchOverlay value={search} setValue={setSearch}/></header>;
}
function SearchOverlay({ value, setValue }: { value: string; setValue: (v: string) => void }) {
  const { searchOpen, setSearchOpen } = useUI();
  if (!searchOpen) return null;
  return <div className="fixed inset-0 z-50 bg-ink/35 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setSearchOpen(false)}><div role="dialog" aria-modal="true" aria-label="Search products" className="mx-auto max-w-2xl rounded-3xl bg-paper p-5 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex items-center gap-3 border-b border-ink/10 pb-4"><Search/><input autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && (location.href = `/products?search=${encodeURIComponent(value)}`)} placeholder="Search considered things…" className="w-full bg-transparent text-lg outline-none"/><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X/></button></div><Link onClick={() => setSearchOpen(false)} href={`/products?search=${encodeURIComponent(value)}`} className="mt-4 inline-flex rounded-full bg-ink px-5 py-3 text-sm text-white">Explore results</Link></div></div>;
}
