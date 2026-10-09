"use client";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Cart, Product } from "@/lib/types";
import { api } from "@/lib/api";
import { imageFor, money } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: () => api.addCart(product._id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["cart"] });
      const previous = qc.getQueryData<Cart>(["cart"]);
      if (previous) {
        const existing = previous.items.find(item => item.productId === product._id);
        const items = existing ? previous.items.map(item => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item) : [...previous.items, { productId: product._id, name: product.name, price: product.price, quantity: 1, image: product.images?.[0] }];
        qc.setQueryData(["cart"], { ...previous, items, total: previous.total + product.price });
      } else qc.setQueryData(["cart"], { items: [{ productId: product._id, name: product.name, price: product.price, quantity: 1, image: product.images?.[0] }], total: product.price });
      return { previous };
    },
    onSuccess: () => toast.success("Added to your bag"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (_error, _variables, context) => { qc.setQueryData(["cart"], context?.previous); toast.error("Sign in to add this piece"); },
  });
  const heart = useMutation({
    mutationFn: () => api.addWishlist(product._id),
    onMutate: async () => { await qc.cancelQueries({ queryKey: ["wishlist"] }); const previous = qc.getQueryData<{ products: string[] }>(["wishlist"]); qc.setQueryData(["wishlist"], { products: [...new Set([...(previous?.products || []), product._id])] }); return { previous }; },
    onSuccess: () => toast.success("Saved to your list"),
    onError: (_error, _variables, context) => { qc.setQueryData(["wishlist"], context?.previous); toast.error("Sign in to save pieces"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
  return <article className="group"><div className="relative overflow-hidden rounded-[1.6rem] bg-sand"><Link href={`/products/${product._id}`} aria-label={`View ${product.name}`}><img src={imageFor(product)} alt={product.name} className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.035]" loading="lazy"/></Link><div className="absolute inset-x-3 bottom-3 flex translate-y-0 justify-between opacity-100 transition group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 md:translate-y-3 md:opacity-0"><button onClick={() => heart.mutate()} className="grid h-11 w-11 place-items-center rounded-full bg-white/95 shadow" aria-label="Add to wishlist"><Heart size={18}/></button><button onClick={() => add.mutate()} className="flex items-center gap-2 rounded-full bg-white/95 px-4 text-sm shadow"><Plus size={17}/> Quick add</button></div></div><div className="flex justify-between gap-3 pt-4"><div><p className="font-medium">{product.name}</p><p className="mt-1 text-xs uppercase tracking-[.12em] text-ink/45">{product.category}</p></div><p className="shrink-0 text-sm">{money(product.price)}</p></div></article>;
}
