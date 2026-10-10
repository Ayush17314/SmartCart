"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AdminShell } from "@/components/admin-shell";
import { useStoreCurrency } from "@/lib/use-store-currency";
import { money } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-3xl border border-ink/10 bg-paper p-5 md:p-6"><p className="text-xs uppercase tracking-[.15em] text-ink/45">{label}</p><p className="mt-3 font-display text-3xl md:text-4xl">{value}</p><p className="mt-2 text-xs text-ink/50">{detail}</p></article>;
}

function Overview() {
  const currency = useStoreCurrency();
  const [trendDays, setTrendDays] = useState(30);
  const orders = useQuery({ queryKey: ["admin-orders-summary", trendDays], queryFn: () => api.adminOrderSummary(trendDays) });
  const customers = useQuery({ queryKey: ["admin-customers-summary"], queryFn: api.adminCustomerSummary });
  const inventory = useQuery({ queryKey: ["admin-inventory-summary"], queryFn: api.adminInventorySummary });
  const topProducts = useQuery({ queryKey: ["admin-top-products"], queryFn: () => api.adminTopProducts("limit=10") });
  const error = orders.error || customers.error || inventory.error || topProducts.error;
  const retry = () => { void orders.refetch(); void customers.refetch(); void inventory.refetch(); void topProducts.refetch(); };
  const loading = orders.isLoading || customers.isLoading || inventory.isLoading;

  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Store operations</p><h1 className="mt-2 font-display text-5xl">Overview.</h1><p className="mt-3 text-sm text-ink/55">Live totals from orders, customers, and inventory services.</p></div><Link href="/products" className="text-sm underline underline-offset-4">View storefront</Link></div>
    {error && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-red-50 p-5 text-sm text-red-800"><p>Some dashboard data could not be loaded.</p><Button variant="outline" size="sm" onClick={retry}>Try again</Button></div>}
    {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton h-32 rounded-3xl" />)}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Total orders" value={String(orders.data?.totalOrders ?? "—")} detail={`${orders.data?.pendingShipments ?? 0} awaiting fulfillment`} />
      <Metric label="Gross merchandise sales" value={money(orders.data?.grossSales ?? 0, currency)} detail="Paid subtotals before discounts, tax, and shipping" />
      <Metric label="Net sales" value={money(orders.data?.netSales ?? 0, currency)} detail={`After ${money(orders.data?.discounts ?? 0, currency)} in discounts and ${money(orders.data?.refunds ?? 0, currency)} in refunds`} />
      <Metric label="Customers" value={String(customers.data?.customers ?? "—")} detail={`${customers.data?.newCustomers30d ?? 0} joined in the last 30 days`} />
      <Metric label="Paid orders" value={String(orders.data?.paidOrders ?? "—")} detail="Payment status: successful" />
      <Metric label="Payments pending" value={String(orders.data?.pendingPayments ?? "—")} detail={`${orders.data?.failedPayments ?? 0} failed · ${orders.data?.refundedPayments ?? 0} refunded`} />
      <Metric label="Low stock" value={String(inventory.data?.lowStock ?? "—")} detail={`At or below ${inventory.data?.lowStockThreshold ?? 5} units`} />
      <Metric label="Out of stock" value={String(inventory.data?.outOfStock ?? "—")} detail={`${inventory.data?.totalProducts ?? 0} products in catalog`} />
      <Metric label="Pending returns" value={String(orders.data?.pendingReturns ?? 0)} detail="Awaiting staff review" />
    </div>}
    <section className="mt-10 rounded-3xl border border-ink/10 p-5 md:p-7"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-emerald-700">Sales trend</p><h2 className="mt-2 font-display text-3xl">Paid order value · last {trendDays} days</h2></div><select aria-label="Sales trend period" className="rounded-full border border-ink/15 bg-paper px-4 py-2 text-sm" value={trendDays} onChange={(event) => setTrendDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></div>
      {orders.data?.trend.length ? <div className="flex h-48 items-end gap-1.5 overflow-x-auto border-b border-ink/10 pb-2">{orders.data.trend.map((day) => { const max = Math.max(...orders.data!.trend.map((item) => item.sales), 1); return <div key={day._id} className="group flex min-w-3 flex-1 flex-col items-center justify-end" title={`${day._id}: ${money(day.sales, currency)} · ${day.orders} orders`}><div className="w-full rounded-t bg-emerald-700/75 transition-colors group-hover:bg-emerald-700" style={{ height: `${Math.max(4, day.sales / max * 100)}%` }} /><span className="mt-2 hidden text-[9px] text-ink/45 group-hover:block">{day._id.slice(5)}</span></div>; })}</div> : <p className="rounded-2xl bg-sand/70 p-8 text-center text-sm text-ink/55">No paid sales are available for this period.</p>}
      <p className="mt-4 text-xs leading-5 text-ink/45">Trend totals include tax and shipping from paid orders. Gross merchandise sales use paid pre-discount item subtotals; net sales subtract discounts and recorded full refunds.</p>
    </section>
    <section className="mt-10 rounded-3xl border border-ink/10 p-5 md:p-7"><div className="mb-5"><p className="text-xs uppercase tracking-[.18em] text-emerald-700">Merchandising</p><h2 className="mt-2 font-display text-3xl">Top-selling products</h2></div>{topProducts.isLoading ? <div className="skeleton h-40 rounded-2xl" /> : topProducts.isError ? <p role="alert">Could not load top products. <button className="underline" onClick={() => void topProducts.refetch()}>Try again</button></p> : !topProducts.data?.length ? <p className="rounded-2xl bg-sand/70 p-8 text-center text-sm text-ink/55">No paid product sales are available.</p> : <div className="overflow-x-auto rounded-2xl border border-ink/10"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-sand"><tr>{["Product", "Category", "Units sold", "Gross merchandise sales"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{topProducts.data.map((product) => <tr key={product.productId} className="border-t border-ink/10"><td className="px-4 py-3">{product.name}</td><td className="px-4 py-3">{product.category}</td><td className="px-4 py-3">{product.unitsSold}</td><td className="px-4 py-3">{money(product.grossSales, currency)}</td></tr>)}</tbody></table></div>}</section>
  </>;
}

export default function AdminPage() { return <AdminShell permission="analytics.read"><Overview /></AdminShell>; }
