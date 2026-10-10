"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Order, User } from "@/lib/types";
import { useStoreCurrency } from "@/lib/use-store-currency";
import { money } from "@/lib/utils";

const statuses = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
const transitions: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [], RETURNED: [] };

function OrdersAdmin() {
  const currency = useStoreCurrency();
  const client = useQueryClient();
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "20", ...(status ? { status } : {}), ...(paymentStatus ? { paymentStatus } : {}), ...(search.trim() ? { search: search.trim() } : {}), ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}), ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}) }).toString(), [page, status, paymentStatus, search, from, to]);
  const orders = useQuery({ queryKey: ["admin-orders", query], queryFn: () => api.adminOrders(query) });
  const session = useQuery({ queryKey: ["admin-session"], queryFn: async () => { const response = await fetch("/api/auth/session", { cache: "no-store" }); if (!response.ok) throw new Error("Could not verify session"); return response.json() as Promise<{ authenticated: boolean; user?: User }>; }, retry: false });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: { status: string; note?: string; shipment?: { carrier: string; trackingNumber: string; trackingUrl?: string } } }) => api.updateOrderStatus(id, body), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-orders"] }); void client.invalidateQueries({ queryKey: ["admin-orders-summary"] }); void client.invalidateQueries({ queryKey: ["orders"] }); toast.success("Order status updated"); }, onError: (error: Error) => toast.error(error.message) });
  const updateReturn = useMutation({ mutationFn: ({ id, next, note }: { id: string; next: "APPROVED" | "REJECTED"; note: string }) => api.reviewReturn(id, next, note), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-orders"] }); toast.success("Return request reviewed"); }, onError: (error: Error) => toast.error(error.message) });
  const completeReturn = useMutation({ mutationFn: ({ id, note }: { id: string; note: string }) => api.completeReturn(id, note), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-orders"] }); void client.invalidateQueries({ queryKey: ["admin-orders-summary"] }); toast.success("Return marked received and complete"); }, onError: (error: Error) => toast.error(error.message) });
  const refund = useMutation({ mutationFn: (paymentId: string) => api.refundPayment(paymentId), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-orders"] }); void client.invalidateQueries({ queryKey: ["admin-orders-summary"] }); toast.success("Refund submitted to Razorpay"); }, onError: (error: Error) => toast.error(error.message) });

  const changeStatus = (order: Order, next: string) => {
    const note = window.prompt(`Add an optional note for ${next.toLowerCase()}:`) || "";
    let shipment: { carrier: string; trackingNumber: string; trackingUrl?: string } | undefined;
    if (next === "SHIPPED") {
      const carrier = window.prompt("Carrier name:")?.trim() || "";
      const trackingNumber = window.prompt("Tracking number:")?.trim() || "";
      const trackingUrl = window.prompt("Tracking URL (optional):")?.trim() || undefined;
      if (!carrier || !trackingNumber) { toast.error("Carrier and tracking number are required to ship an order."); return; }
      shipment = { carrier, trackingNumber, trackingUrl };
    }
    if (next === "CANCELLED" && order.paymentStatus === "SUCCESS") { toast.error("Paid orders must use the return and refund process."); return; }
    if (!window.confirm(`Move order ${order._id.slice(-8)} from ${order.orderStatus} to ${next}?`)) return;
    update.mutate({ id: order._id, body: { status: next, note, shipment } });
  };

  const renderReturnActions = (order: Order) => {
    const request = order.returnRequest;
    if (!request?.status || request.status === "NONE") return <span className="text-ink/40">—</span>;
    return <div className="min-w-56 text-xs">
      <p className="font-medium">{request.status}</p>
      <p className="my-1 max-w-56 truncate text-ink/50" title={request.reason}>{request.reason}</p>
      {request.status === "REQUESTED" && <div className="flex gap-2">
        <button className="text-emerald-800 underline" disabled={updateReturn.isPending} onClick={() => { const note = window.prompt("Approval note (optional):") || ""; updateReturn.mutate({ id: order._id, next: "APPROVED", note }); }}>Approve</button>
        <button className="text-red-700 underline" disabled={updateReturn.isPending} onClick={() => { const note = window.prompt("Reason for rejecting this return:")?.trim(); if (note) updateReturn.mutate({ id: order._id, next: "REJECTED", note }); }}>Reject</button>
      </div>}
      {request.status === "APPROVED" && <button className="mt-1 block text-emerald-800 underline" disabled={completeReturn.isPending} onClick={() => { if (window.confirm("Confirm the returned goods have been received and inspected? Adjust sellable stock separately in Inventory.")) completeReturn.mutate({ id: order._id, note: "Received and inspected" }); }}>Mark received</button>}
      {["APPROVED", "COMPLETED"].includes(request.status) && order.paymentStatus === "SUCCESS" && order.paymentId && session.data?.user?.permissions?.includes("refunds.approve") && <button className="mt-1 block text-red-700 underline" disabled={refund.isPending} onClick={() => { if (window.confirm(`Submit a full refund of ${money(order.totalAmount, currency)} to Razorpay?`)) refund.mutate(order.paymentId as string); }}>Issue full refund</button>}
      {request.reviewNote && <p className="mt-1 text-ink/50">Staff: {request.reviewNote}</p>}
    </div>;
  };

  return <>
    <div className="mb-8"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Fulfillment</p><h1 className="mt-2 font-display text-5xl">Orders.</h1><p className="mt-3 text-sm text-ink/55">Customer ownership, payment status, return review, and valid order transitions are enforced by the backend.</p></div>
    <div className="mb-5 flex flex-wrap gap-3">
      <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="Search order ID or customer ID" className="field mt-0 max-w-sm" placeholder="Order ID or customer ID"/>
      <select aria-label="Filter by order status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-full border border-ink/15 bg-paper px-4 text-sm"><option value="">All order statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filter by payment status" value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }} className="rounded-full border border-ink/15 bg-paper px-4 text-sm"><option value="">All payment statuses</option>{["PENDING", "SUCCESS", "FAILED", "REFUNDED"].map((value) => <option key={value}>{value}</option>)}</select>
      <label className="text-xs text-ink/50">From<input aria-label="Filter orders from date" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="ml-2 rounded-full border border-ink/15 bg-paper px-3 py-2 text-sm text-ink"/></label>
      <label className="text-xs text-ink/50">To<input aria-label="Filter orders through date" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="ml-2 rounded-full border border-ink/15 bg-paper px-3 py-2 text-sm text-ink"/></label>
    </div>
    {orders.isLoading ? <div className="skeleton h-72 rounded-3xl"/> : orders.error ? <div role="alert" className="rounded-3xl bg-red-50 p-8 text-sm text-red-800">Could not load orders. <button className="ml-2 underline" onClick={() => void orders.refetch()}>Try again</button></div> : !orders.data?.data.length ? <div className="rounded-3xl bg-sand p-10 text-center text-sm text-ink/55">No orders match these filters.</div> : <div className="overflow-x-auto rounded-3xl border border-ink/10"><table className="w-full min-w-[1100px] text-left text-sm">
      <thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-5 py-4">Order</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Placed</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Return / refund</th><th className="px-5 py-4">Update</th></tr></thead>
      <tbody>{orders.data.data.map((order) => <tr key={order._id} className="border-t border-ink/10">
        <td className="px-5 py-4 font-mono text-xs">{order._id.slice(-10)}<p className="mt-1 font-sans text-xs text-ink/45">{order.items.length} line items</p></td>
        <td className="px-5 py-4 text-xs">{order.shippingAddress?.name || order.userId.slice(-8)}</td>
        <td className="whitespace-nowrap px-5 py-4 text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
        <td className="px-5 py-4">{money(order.totalAmount, currency)}</td>
        <td className="px-5 py-4 text-xs">{order.paymentMethod} · {order.paymentStatus}</td>
        <td className="px-5 py-4 text-xs">{order.orderStatus}</td>
        <td className="px-5 py-4">{renderReturnActions(order)}</td>
        <td className="px-5 py-4">{transitions[order.orderStatus]?.length ? <select aria-label={`Change order ${order._id.slice(-8)} status`} value="" disabled={update.isPending} onChange={(event) => event.target.value && changeStatus(order, event.target.value)} className="rounded-full border border-ink/15 bg-paper px-3 py-2 text-xs"><option value="">Choose…</option>{transitions[order.orderStatus].map((next) => <option key={next}>{next}</option>)}</select> : <span className="text-xs text-ink/40">Complete</span>}</td>
      </tr>)}</tbody>
    </table></div>}
    {orders.data?.pagination && <div className="mt-5 flex items-center justify-between text-sm"><span className="text-ink/50">Page {orders.data.pagination.page} of {Math.max(orders.data.pagination.pages || 1, 1)} · {orders.data.pagination.total ?? "—"} orders</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={!orders.data.pagination.hasNext} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
  </>;
}

export default function AdminOrdersPage() { return <AdminShell permission="orders.read_all"><OrdersAdmin /></AdminShell>; }
