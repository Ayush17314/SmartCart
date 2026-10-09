import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { Providers } from "@/components/providers";
import { StoreLayout } from "@/components/layout";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display-face" });

export const metadata: Metadata = {
  title: { default: "SmartCart — considered living", template: "%s — SmartCart" },
  description: "A considered collection of useful things for everyday living, from SmartCart.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${display.variable}`}><Providers><StoreLayout>{children}</StoreLayout></Providers></body></html>;
}
