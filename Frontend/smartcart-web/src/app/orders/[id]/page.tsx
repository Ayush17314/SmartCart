"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { loadRazorpay, openRazorpayCheckout } from "@/lib/razorpay";
import { money } from "@/lib/utils";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: order, isLoading, error, refetch } = useQuery({ queryKey: ["order", id], queryFn: () => api.order(id) });
  const { data: tracking } = useQuery({ queryKey: ["tracking", id], queryFn: () => api.tracking(id), enabled: !!order });

  const action = useMutation({
    mutationFn: (type: "cancel" | "return") => type === "cancel" ? api.cancelOrder(id) : api.returnOrder(id),
    onSuccess: (value) => {
      qc.setQueryData(["order", id], value);
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order status updated");
    },
    onError: (e) => toast.error(e.message || "This order can’t be changed"),
  });

  const retryPayment = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("Order details are not available");
      if (order.paymentId && order.paymentCheckout) return { payment: { _id: order.paymentId }, checkout: order.paymentCheckout };
      return api.createPayment({ orderId: order._id, amount: order.totalAmount, paymentMethod: order.paymentMethod || "UPI" }, `order-${order._id}`);
    },
    onSuccess: async (result) => {
      if (!order) return;
      if (!result.checkout) {
        toast.error("Razorpay could not start checkout. Check the payment service configuration and retry.");
        return;
      }
      try {
        await loadRazorpay();
        const checkout = openRazorpayCheckout(result.checkout, async (response) => {
          try {
            const verification = await api.verifyPayment(result.payment._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await qc.invalidateQueries({ queryKey: ["order", id] });
            await qc.invalidateQueries({ queryKey: ["orders"] });
            if (verification.payment.status === "SUCCESS") {
              await api.clearCart().catch(() => null);
              await qc.invalidateQueries({ queryKey: ["cart"] });
              toast.success("Payment confirmed");
            } else {
              toast.message("Payment is processing. The order will update after Razorpay confirms capture.");
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not verify payment");
          }
        }, undefined, () => toast.message("Checkout closed. You can retry payment here."));
        checkout.on("payment.failed", () => toast.error("Payment did not complete. You can retry here."));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open Razorpay Checkout");
      }
    },
    onError: (e) => toast.error(e.message || "Could not start payment"),
  });

  if (isLoading) return <div className="skeleton mx-auto mt-14 h-96 max-w-4xl rounded-3xl" />;
  if (error || !order) return <section className="mx-auto max-w-4xl px-6 py-20"><p>We couldn’t find this order.</p><button onClick={() => refetch()} className="mt-4 underline">Try again</button></section>;

  const canCancel = ["PENDING", "CONFIRMED"].includes(order.orderStatus);
  const canReturn = order.orderStatus === "DELIVERED";
  const needsPayment = order.paymentMethod !== "COD" && order.paymentStatus !== "SUCCESS" && order.paymentStatus !== "REFUNDED";

  return <section className="mx-auto max-w-5xl px-5 py-14 md:px-10">
    <Link href="/orders" className="text-sm text-ink/50">← All orders</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Order {order._id.slice(-8)}</p><h1 className="mt-2 font-display text-5xl">{order.orderStatus.toLowerCase()}.</h1></div><p className="text-lg">{money(order.totalAmount)}</p></div>
    <div className="mt-10 grid gap-8 md:grid-cols-[1fr_300px]">
      <div className="rounded-3xl border border-ink/10 p-6"><h2 className="font-display text-2xl">The pieces</h2>{order.items?.map((item) => <div key={item.productId} className="flex justify-between gap-4 border-b border-ink/10 py-4 text-sm"><span>{item.name} × {item.quantity}</span><span>{money(item.price * item.quantity)}</span></div>)}<div className="mt-5 flex justify-between"><span>Total</span><span>{money(order.totalAmount)}</span></div></div>
      <aside className="rounded-3xl bg-sand p-6"><h2 className="font-display text-2xl">On its way</h2><p className="mt-3 text-sm">Payment: {order.paymentStatus}</p>{tracking?.shipment?.carrier && <p className="mt-3 text-sm">{tracking.shipment.carrier} · {tracking.shipment.trackingNumber}</p>}{tracking?.shipment?.trackingUrl && <a className="mt-3 inline-block text-sm underline" href={tracking.shipment.trackingUrl} target="_blank" rel="noreferrer">Track with carrier</a>}
        <ol className="mt-6 space-y-4 border-l border-ink/20 pl-4">{tracking?.history?.map((event, index) => <li key={`${event.changedAt}-${index}`} className="relative text-sm"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-emerald-700" /><span className="font-medium">{event.status}</span><p className="text-xs text-ink/50">{new Date(event.changedAt).toLocaleString()}</p>{event.note && <p className="mt-1 text-xs text-ink/60">{event.note}</p>}</li>)}</ol>
        {needsPayment && <Button className="mt-7 w-full" disabled={retryPayment.isPending} onClick={() => retryPayment.mutate()}>{retryPayment.isPending ? "Preparing checkout…" : "Pay with Razorpay"}</Button>}
        {canCancel && <Button variant="outline" className="mt-3 w-full" disabled={action.isPending} onClick={() => action.mutate("cancel")}>Cancel order</Button>}
        {canReturn && <Button variant="outline" className="mt-3 w-full" disabled={action.isPending} onClick={() => action.mutate("return")}>Request a return</Button>}
      </aside>
    </div>
  </section>;
}

export default function OrderDetailPage() { return <AuthGate><OrderDetail /></AuthGate>; }
