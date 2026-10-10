"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { User, UserRole } from "@/lib/types";

function StaffTable() {
  const client = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePreview, setInvitePreview] = useState("");
  const [invite, setInvite] = useState({ name: "", email: "", role: "support" as Exclude<UserRole, "customer"> });
  const staff = useQuery({ queryKey: ["admin-staff"], queryFn: api.staff });
  const session = useQuery({ queryKey: ["admin-session"], queryFn: async () => (await fetch("/api/auth/session")).json() as Promise<{ user?: User }> });
  const updateRole = useMutation({ mutationFn: ({ id, role }: { id: string; role: UserRole }) => api.changeStaffRole(id, role), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-staff"] }); toast.success("Staff role updated"); }, onError: (error: Error) => toast.error(error.message) });
  const updateStatus = useMutation({ mutationFn: ({ id, active, reason }: { id: string; active: boolean; reason: string }) => api.changeAccountStatus(id, active, reason), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-staff"] }); toast.success("Staff account status updated"); }, onError: (error: Error) => toast.error(error.message) });
  const isSuperAdmin = session.data?.user?.role === "super_admin";
  const canManageStaff = session.data?.user?.permissions?.includes("staff.manage") || false;
  const sendInvite = useMutation({ mutationFn: () => api.inviteStaff({ name: invite.name.trim(), email: invite.email.trim(), role: invite.role }), onSuccess: (result) => { void client.invalidateQueries({ queryKey: ["admin-staff"] }); setInvitePreview(result.developmentEmailPreview || ""); setInviteOpen(false); setInvite({ name: "", email: "", role: "support" }); toast.success(result.developmentEmailPreview ? "Invitation created. Use the development preview below." : "Staff invitation sent"); }, onError: (error: Error) => toast.error(error.message) });
  const resendInvite = useMutation({ mutationFn: (id: string) => api.resendStaffInvite(id), onSuccess: (result) => { void client.invalidateQueries({ queryKey: ["admin-staff"] }); setInvitePreview(result.developmentEmailPreview || ""); toast.success(result.developmentEmailPreview ? "Invitation rotated. Use the development preview below." : "Invitation resent"); }, onError: (error: Error) => toast.error(error.message) });
  const changeStatus = (user: User) => {
    const active = !user.isActive;
    if (!window.confirm(`${active ? "Reactivate" : "Suspend"} ${user.name}?`)) return;
    const reason = window.prompt("Enter the reason for this account change:")?.trim();
    if (!reason) return;
    updateStatus.mutate({ id: user.id, active, reason });
  };

  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Access control</p><h1 className="mt-2 font-display text-5xl">Staff access.</h1><p className="mt-3 text-sm text-ink/55">Roles are enforced by backend permissions. Role and account changes revoke existing sessions.</p></div>{canManageStaff && <Button type="button" onClick={() => setInviteOpen((open) => !open)}>{inviteOpen ? "Close invite" : "Invite staff"}</Button>}</div>
    <div className="mb-6 rounded-2xl bg-sand/70 p-4 text-sm leading-6 text-ink/65">The initial Super Admin is created with the documented one-time CLI. Staff invitations expire after 24 hours and require the recipient to set a password. Only a Super Admin can invite another Super Admin.</div>
    {inviteOpen && canManageStaff && <form className="mb-8 grid gap-4 rounded-3xl border border-ink/10 p-5 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); sendInvite.mutate(); }}><label className="block text-sm">Name<input required minLength={2} maxLength={200} className="field mt-1" value={invite.name} onChange={(event) => setInvite({ ...invite, name: event.target.value })} /></label><label className="block text-sm">Email<input required type="email" className="field mt-1" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></label><label className="block text-sm">Role<select className="field mt-1" value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as Exclude<UserRole, "customer"> })}><option value="support">Support</option><option value="inventory_staff">Inventory staff</option><option value="admin">Admin</option>{isSuperAdmin && <option value="super_admin">Super Admin</option>}</select></label><div className="flex items-end"><Button disabled={sendInvite.isPending}>{sendInvite.isPending ? "Sending…" : "Send invitation"}</Button></div></form>}
    {invitePreview && <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Development email preview (no email was sent)</p><p className="mt-2 break-all">{invitePreview}</p></div>}
      {staff.isLoading ? <div className="skeleton h-72 rounded-3xl" /> : staff.error ? <div role="alert" className="rounded-3xl bg-red-50 p-8 text-sm text-red-800">Could not load staff accounts. <button className="ml-2 underline" onClick={() => void staff.refetch()}>Try again</button></div> : !staff.data?.length ? <div className="rounded-3xl bg-sand p-10 text-center text-sm text-ink/55">No staff accounts are set up yet.</div> : <div className="overflow-x-auto rounded-3xl border border-ink/10"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-5 py-4">Staff member</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Actions</th></tr></thead><tbody>{staff.data.map((user) => <tr key={user.id} className="border-t border-ink/10"><td className="px-5 py-4"><p className="font-medium">{user.name}</p><p className="mt-1 text-xs text-ink/50">{user.email}</p></td><td className="px-5 py-4"><select aria-label={`Role for ${user.name}`} disabled={!canManageStaff || (!isSuperAdmin && user.role === "super_admin") || updateRole.isPending} value={user.role} onChange={(event) => { const role = event.target.value as UserRole; if (window.confirm(`Change ${user.name} to ${role.replaceAll("_", " ")}?`)) updateRole.mutate({ id: user.id, role }); }} className="rounded-full border border-ink/15 bg-paper px-3 py-2 text-xs"><option value="support">Support</option><option value="inventory_staff">Inventory staff</option><option value="admin">Admin</option><option value="super_admin" disabled={!isSuperAdmin}>Super Admin</option></select></td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs ${user.isActive ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{!user.emailVerified ? "Invitation pending" : user.isActive ? "Active" : "Suspended"}</span></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{canManageStaff && !user.emailVerified && <Button variant="outline" size="sm" disabled={resendInvite.isPending} onClick={() => resendInvite.mutate(user.id)}>Resend invite</Button>}<Button variant="outline" size="sm" disabled={user.role === "super_admin" && !isSuperAdmin || updateStatus.isPending} onClick={() => changeStatus(user)}>{user.isActive ? "Suspend" : "Reactivate"}</Button></div></td></tr>)}</tbody></table></div>}
  </>;
}

export default function AdminStaffPage() { return <AdminShell permission="staff.read"><StaffTable /></AdminShell>; }
