"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

export function StoreFooter() {
  const { data } = useQuery({ queryKey: ["public-store-settings"], queryFn: api.publicStoreSettings, staleTime: 30_000 });
  return <footer className="mt-24 border-t border-ink/10 px-6 py-12"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 text-sm text-ink/55 md:flex-row"><div><BrandLogo brandName={data?.storeName} logoUrl={data?.logoUrl || undefined}/><p className="mt-3">Thoughtfully chosen things for everyday living.</p>{data?.returnPolicy && <details className="mt-4 max-w-xl"><summary className="cursor-pointer">Returns policy</summary><p className="mt-2 whitespace-pre-wrap leading-6">{data.returnPolicy}</p></details>}</div><div className="flex gap-6"><Link href="/products">Shop the collection</Link><Link href="/account">Your account</Link></div><span>© {new Date().getFullYear()} {data?.storeName || "SmartCart"}</span></div></footer>;
}
