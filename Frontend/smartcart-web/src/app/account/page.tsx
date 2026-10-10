"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema } from "@/lib/schemas";
import { api } from "@/lib/api";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { z } from "zod";
type Profile = z.infer<typeof profileSchema>;
function Account() {
  const router = useRouter(); const qc = useQueryClient(); const { data: user } = useQuery({ queryKey: ["profile"], queryFn: api.profile });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Profile>({ resolver: zodResolver(profileSchema) });
  useEffect(() => { if (user) reset({ name: user.name, phone: user.phone || "" }); }, [user, reset]);
  const update = useMutation({ mutationFn: api.updateProfile, onSuccess: value => { qc.setQueryData(["profile"], value); toast.success("Your details are saved"); }, onError: () => toast.error("Could not save your details") });
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login?portal=customer"); router.refresh(); };
  return <section className="mx-auto max-w-4xl px-5 py-14 md:px-10"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">A little about you</p><h1 className="mt-3 font-display text-5xl">Your account.</h1><div className="mt-10 grid gap-10 md:grid-cols-[1fr_240px]"><form onSubmit={handleSubmit(value => update.mutate(value))} className="space-y-5 rounded-3xl border border-ink/10 p-6 md:p-8"><label className="block text-sm">Name<input {...register("name")} className="field"/>{errors.name && <span role="alert" className="text-xs text-red-700">{errors.name.message}</span>}</label><label className="block text-sm">Email<input value={user?.email || ""} disabled className="field opacity-50"/></label><label className="block text-sm">Phone<input {...register("phone")} className="field"/></label><Button disabled={update.isPending}>{update.isPending ? "Saving…" : "Save details"}</Button></form><aside className="space-y-4"><Link href="/orders" className="block rounded-2xl bg-sand p-5">Your orders →</Link><Link href="/wishlist" className="block rounded-2xl bg-sand p-5">Saved things →</Link><button onClick={logout} className="p-4 text-sm text-ink/55 underline">Sign out</button></aside></div></section>;
}
export default function AccountPage() { return <AuthGate><Account/></AuthGate>; }
