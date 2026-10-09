"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutSchema } from "@/lib/schemas";
import { api } from "@/lib/api";
import { loadRazorpay, openRazorpayCheckout } from "@/lib/razorpay";
import { money } from "@/lib/utils";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { z } from "zod";

type Checkout = z.infer<typeof checkoutSchema>;
function CheckoutForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: cart, isLoading } = useQuery({ queryKey: ["cart"], queryFn: api.cart });
  const { register, handleSubmit, formState: { errors } } = useForm<Checkout>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { country: "India", paymentMethod: "UPI" },
  });

  const order = useMutation({
    mutationFn: (values: Checkout) => api.createOrder({
      items: (cart?.items || []).map((item) => ({ productId: item.productId, quantity: item.quantity })),
      shippingAddress: {
        name: values.name,
        line1: values.line1,
        city: values.city,
        region: values.region,
        postalCode: values.postalCode,
        country: values.country,
      },
      paymentMethod: values.paymentMethod,
    }),
    onSuccess: async (result, values) => {
      if (values.paymentMethod === "COD") {
        await api.clearCart().catch(() => null);
        await qc.invalidateQueries({ queryKey: ["cart"] });
        toast.success("Your order is placed");
        router.push(`/orders/${result._id}`);
        return;
      }

      const checkout = result.paymentCheckout;
      if (!checkout || !result.paymentId) {
        toast.error("Your order was saved, but payment could not be started. Open the order and try again.");
        router.push(`/orders/${result._id}`);
        return;
      }

      try {
        await loadRazorpay();
        const paymentWindow = openRazorpayCheckout(checkout, async (response) => {
            try {
              const verification = await api.verifyPayment(result.paymentId!, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              if (verification.payment.status !== "SUCCESS") {
                toast.message("Payment is processing. Your order will update after Razorpay confirms capture.");
                router.push(`/orders/${result._id}`);
                return;
              }
              await api.clearCart().catch(() => null);
              await qc.invalidateQueries({ queryKey: ["cart"] });
              toast.success("Payment confirmed and order placed");
              router.push(`/orders/${result._id}`);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not verify your payment");
              router.push(`/orders/${result._id}`);
            }
          }, values.name, () => toast.message("Checkout closed. You can retry payment from your order."));
        paymentWindow.on("payment.failed", () => toast.error("Payment did not complete. You can retry from your order."));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open Razorpay Checkout");
        router.push(`/orders/${result._id}`);
      }
    },
    onError: (error) => toast.error(error.message || "Could not place your order"),
  });

  if (isLoading) return <div className="skeleton h-72 rounded-3xl" />;
  if (!cart?.items.length) return <div className="rounded-3xl bg-sand p-10 text-center"><p className="font-display text-3xl">Your bag is still empty.</p><Link className="mt-4 inline-block underline" href="/products">Find your first piece</Link></div>;

  const field = (key: keyof Checkout, label: string) => <label className="block text-sm">{label}<input {...register(key)} className="field" />{errors[key] && <span role="alert" className="mt-1 block text-xs text-red-700">{errors[key]?.message}</span>}</label>;
  return <form onSubmit={handleSubmit((values) => order.mutate(values))} className="grid gap-10 lg:grid-cols-[1fr_360px]">
    <div className="space-y-8">
      <section className="rounded-3xl border border-ink/10 p-6 md:p-8"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Step 01</p><h2 className="mb-6 mt-2 font-display text-3xl">Where should it go?</h2><div className="grid gap-4 sm:grid-cols-2">{field("name", "Full name")}{field("line1", "Street address")}{field("city", "City")}{field("region", "State / region")}{field("postalCode", "Postal code")}{field("country", "Country")}</div></section>
      <section className="rounded-3xl border border-ink/10 p-6 md:p-8"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Step 02</p><h2 className="mb-6 mt-2 font-display text-3xl">How would you like to pay?</h2><div className="grid gap-3 sm:grid-cols-3">{(["UPI", "CARD", "COD"] as const).map((method) => <label key={method} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 p-4 text-sm"><input type="radio" value={method} {...register("paymentMethod")} />{method === "COD" ? "Pay on delivery" : method}</label>)}</div><p className="mt-4 text-xs text-ink/45">UPI and card payments are securely processed by Razorpay. Test keys simulate payments without charging real money.</p></section>
    </div>
    <aside className="h-fit rounded-3xl bg-sand p-6"><h2 className="font-display text-2xl">Your order</h2><div className="my-5 space-y-3">{cart.items.map((item) => <div key={item.productId} className="flex justify-between gap-4 text-sm"><span>{item.name} × {item.quantity}</span><span>{money(item.price * item.quantity)}</span></div>)}</div><div className="flex justify-between border-t border-ink/10 pt-5 font-medium"><span>Total</span><span>{money(cart.total)}</span></div><Button type="submit" disabled={order.isPending} className="mt-6 w-full">{order.isPending ? "Preparing checkout…" : "Place order"}</Button></aside>
  </form>;
}

export default function CheckoutPage() {
  return <AuthGate><section className="mx-auto max-w-6xl px-5 py-14 md:px-10"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">The last little step</p><h1 className="mb-10 mt-3 font-display text-5xl">Make it yours.</h1><CheckoutForm /></section></AuthGate>;
}
