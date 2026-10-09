"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { ProductSkeletons } from "@/components/skeletons";
import { AuthGate } from "@/components/auth-gate";

function SavedItems() {
  const qc = useQueryClient();
  const { data: ids, isLoading } = useQuery({ queryKey: ["wishlist"], queryFn: api.wishlist });
  const { data: products, isLoading: loadingProducts } = useQuery({ queryKey: ["wishlist-products", ids?.products], queryFn: async () => Promise.all((ids?.products || []).map(id => api.product(id))), enabled: !!ids });
  const remove = useMutation({
    mutationFn: api.removeWishlist,
    onMutate: async id => { await qc.cancelQueries({ queryKey: ["wishlist"] }); const previous = qc.getQueryData<{ products: string[] }>(["wishlist"]); qc.setQueryData(["wishlist"], { products: (previous?.products || []).filter(value => value !== id) }); qc.setQueryData<Product[]>(["wishlist-products", ids?.products], old => old?.filter(product => product._id !== id)); return { previous }; },
    onError: (_error, _id, context) => { qc.setQueryData(["wishlist"], context?.previous); toast.error("Could not remove this piece"); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["wishlist"] }); qc.invalidateQueries({ queryKey: ["wishlist-products"] }); },
  });
  return <section className="mx-auto max-w-[1440px] px-5 py-14 md:px-10"><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Your edit</p><h1 className="mt-3 font-display text-5xl">Things to come back to.</h1>{isLoading || loadingProducts ? <div className="mt-10"><ProductSkeletons/></div> : products?.length ? <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-7">{products.map(product => <div key={product._id}><ProductCard product={product}/><button onClick={() => remove.mutate(product._id)} className="mt-3 text-xs underline underline-offset-4">Remove from saved things</button></div>)}</div> : <div className="mt-10 rounded-3xl bg-sand p-12 text-center"><p className="font-display text-3xl">Your saved list is waiting.</p><Link className="mt-5 inline-block underline" href="/products">Browse the collection</Link></div>}</section>;
}
export default function WishlistPage() { return <AuthGate><SavedItems/></AuthGate>; }
