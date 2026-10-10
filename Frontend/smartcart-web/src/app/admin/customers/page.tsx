"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

function CustomerTable() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "20", ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) }).toString(), [page, status, search]);
  const customers = useQuery({ queryKey: ["admin-customers", query], queryFn: () => api.adminCustomers(query) });
  const session = useQuery({ queryKey: ["admin-session"], queryFn: async () => (await fetch("/api/auth/session")).json() as Promise<{ user?: User }> });
  const canManage = session.data?.user?.permissions?.includes("customers.manage") || false;
  const update = useMutation({ mutationFn: ({ id, active, reason }: { id: string; active: boolean; reason: string }) => api.changeAccountStatus(id, active, reason), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-customers"] }); void client.invalidateQueries({ queryKey: ["admin-customers-summary"] }); toast.success("Customer account status updated"); }, onError: (error: Error) => toast.error(error.message) });
  const setAccountStatus = (user: User) => {
    const active = !user.isActive;
    if (!window.confirm(`${active ? "Reactivate" : "Suspend"} ${user.name}?`)) return;
    const reason = window.prompt("Enter the reason for this account change:")?.trim();
    if (!reason) return;
    update.mutate({ id: user.id, active, reason });
  };
  const exportCustomers = async () => {
    try {
      const params = new URLSearchParams({ limit: "5000", ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
      const blob = await api.exportCustomers(params.toString());
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "smartcart-customers.csv"; link.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not export customers"); }
  };

  return <>
    <div className="mb-8"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Customer care</p><h1 className="mt-2 font-display text-5xl">Customers.</h1><p className="mt-3 text-sm text-ink/55">Search paginated customer accounts. Suspension revokes active sessions and requires a recorded reason.</p></div>
    <div className="mb-5 flex flex-wrap gap-3"><input aria-label="Search customers" className="field mt-0 max-w-sm" placeholder="Search name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/><select aria-label="Filter customer status" className="rounded-full border border-ink/15 bg-paper px-4 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All customers</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
    <div className="mb-5"><Button type="button" variant="outline" onClick={() => void exportCustomers()}>Export filtered customers</Button></div>
    {customers.isLoading ? <div className="skeleton h-72 rounded-3xl"/> : customers.error ? <div role="alert" className="rounded-3xl bg-red-50 p-8 text-sm text-red-800">Could not load customers. <button className="ml-2 underline" onClick={() => void customers.refetch()}>Try again</button></div> : !customers.data?.data.length ? <div className="rounded-3xl bg-sand p-10 text-center text-sm text-ink/55">No customers match these filters.</div> : <div className="overflow-x-auto rounded-3xl border border-ink/10"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Joined</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Verified</th><th className="px-5 py-4">Status</th>{canManage && <th className="px-5 py-4">Action</th>}</tr></thead><tbody>{customers.data.data.map((user) => <tr key={user.id} className="border-t border-ink/10"><td className="px-5 py-4"><p className="font-medium">{user.name}</p><p className="mt-1 font-mono text-[10px] text-ink/40">{user.id}</p></td><td className="px-5 py-4 text-xs text-ink/55">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td><td className="px-5 py-4">{user.email}</td><td className="px-5 py-4 text-xs">{user.emailVerified ? "Verified" : "Unverified"}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs ${user.isActive ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{user.isActive ? "Active" : "Suspended"}</span></td>{canManage && <td className="px-5 py-4"><Button variant="outline" size="sm" disabled={update.isPending} onClick={() => setAccountStatus(user)}>{user.isActive ? "Suspend" : "Reactivate"}</Button></td>}</tr>)}</tbody></table></div>}
    {customers.data?.pagination && <div className="mt-5 flex items-center justify-between text-sm"><span className="text-ink/50">Page {customers.data.pagination.page} of {Math.max(customers.data.pagination.pages || 1, 1)} · {customers.data.pagination.total} customers</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= customers.data.pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
  </>;
}

export default function AdminCustomersPage() { return <AdminShell permission="customers.read"><CustomerTable /></AdminShell>; }
