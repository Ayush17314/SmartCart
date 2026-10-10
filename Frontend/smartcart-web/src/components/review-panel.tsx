"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReviewPanel({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const reviews = useQuery({ queryKey: ["product-reviews", productId], queryFn: () => api.reviews(productId) });
  const submit = useMutation({ mutationFn: () => api.createReview(productId, { rating, title, body }), onSuccess: () => { setTitle(""); setBody(""); toast.success("Review submitted for moderation"); void qc.invalidateQueries({ queryKey: ["product-reviews", productId] }); }, onError: (error) => toast.error(error.message || "Could not submit review") });
  const report = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => api.reportReview(id, reason), onSuccess: () => toast.success("Report sent to the moderation team"), onError: (error) => toast.error(error.message || "Could not report review") });
  return <div className="space-y-8">
    <form onSubmit={(event) => { event.preventDefault(); submit.mutate(); }} className="rounded-2xl bg-sand/70 p-5">
      <h3 className="font-display text-2xl">Share your experience</h3><p className="mb-4 mt-2 text-xs text-ink/50">Only customers with a delivered purchase can post. New reviews are checked before publication.</p>
      <div className="grid gap-3 sm:grid-cols-[130px_1fr]"><label className="text-sm">Rating<select className="field mt-1" value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><label className="text-sm">Title<input className="field mt-1" required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label></div>
      <label className="mt-3 block text-sm">Your review<textarea className="field mt-1 min-h-24" required minLength={10} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <Button className="mt-4" type="submit" disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit review"}</Button>
    </form>
    <div><h3 className="mb-4 font-display text-2xl">Customer reviews</h3>{reviews.isLoading ? <div className="skeleton h-36 rounded-2xl" /> : reviews.isError ? <p role="alert" className="text-sm text-red-700">Reviews could not be loaded.</p> : !reviews.data?.items.length ? <p className="text-sm text-ink/55">No approved reviews yet. Be the first to share after your order arrives.</p> : <div className="space-y-4">{reviews.data.items.map((review) => <article key={review._id} className="border-b border-ink/10 pb-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-amber-700" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p><h4 className="mt-1 font-medium">{review.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/65">{review.body}</p><p className="mt-3 text-xs text-ink/45">{review.userName} · {new Date(review.createdAt).toLocaleDateString()}</p></div><button type="button" className="shrink-0 text-xs underline text-ink/50" onClick={() => { const reason = window.prompt("Why are you reporting this review? (3–500 characters)"); if (reason?.trim()) report.mutate({ id: review._id, reason: reason.trim() }); }}>Report</button></div></article>)}</div>}</div>
  </div>;
}
