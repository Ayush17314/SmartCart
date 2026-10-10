import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";

const tools = [
  ["Store operations", "Open the existing orders, inventory, customer, and promotion tools.", "/admin"],
  ["Staff and roles", "Invite staff and manage role assignments.", "/admin/staff"],
  ["Security audit", "Review account and administrative audit events.", "/admin/audit"],
  ["Global settings", "Manage store-wide settings and operational policies.", "/admin/settings"],
];

export default function SuperAdminDashboardPage() {
  return <AdminShell permission="analytics.read"><div className="mb-8"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Restricted administration</p><h1 className="mt-2 font-display text-5xl">Super Admin.</h1><p className="mt-3 text-sm text-ink/55">Manage SmartCart operations, staff access, and system settings.</p></div><div className="grid gap-4 sm:grid-cols-2">{tools.map(([title, description, href]) => <Link key={title} href={href} className="rounded-3xl border border-ink/10 p-6 transition hover:border-emerald-700/40 hover:bg-emerald-700/[.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><h2 className="font-display text-2xl">{title}</h2><p className="mt-3 text-sm leading-6 text-ink/55">{description}</p><span className="mt-5 inline-block text-sm font-medium text-emerald-800 underline underline-offset-4">Open</span></Link>)}</div></AdminShell>;
}
