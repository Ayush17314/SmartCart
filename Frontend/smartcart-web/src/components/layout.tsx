import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { CartDrawer } from "@/components/cart-drawer";
import { BrandLogo } from "@/components/brand-logo";

export function StoreLayout({ children }: { children: ReactNode }) {
  return <><Header/><main>{children}</main><footer className="mt-24 border-t border-ink/10 px-6 py-12"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 text-sm text-ink/55 md:flex-row"><div><BrandLogo/><p className="mt-3">Thoughtfully chosen things for everyday living.</p></div><div className="flex gap-6"><Link href="/products">Shop the collection</Link><Link href="/account">Your account</Link></div><span>© 2026 SmartCart</span></div></footer><CartDrawer/></>;
}
