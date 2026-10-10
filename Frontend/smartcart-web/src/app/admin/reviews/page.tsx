"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Review } from "@/lib/types";
import { toast } from "sonner";

function ReviewsAdmin() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["admin-reviews", status, page], queryFn: () => api.adminReviews(new URLSearchParams({ page: String(page), limit: "50", status }).toString()) });
  const moderate = useMutation({ mutationFn: ({ review, action }: { review: Review; action: "APPROVED" | "HIDDEN" | "REMOVED" }) => api.moderateReview(review._id, action, reason[review._id]?.trim() || ""), onSuccess: () => { toast.success("Review moderation saved"); void qc.invalidateQueries({ queryKey: ["admin-reviews"] }); }, onError: (error) => toast.error(error.message || "Could not update review") });
  return <div><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Store operations</p><h1 className="mb-6 mt-2 font-display text-4xl">Review moderation</h1>
    <label className="mb-5 block max-w-xs text-sm">Filter<select className="field mt-1" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="PENDING">Pending review</option><option value="REPORTED">Reported</option><option value="APPROVED">Approved</option><option value="HIDDEN">Hidden</option><option value="REMOVED">Removed</option></select></label>
    {query.isLoading ? <div className="skeleton h-72 rounded-3xl" /> : query.isError ? <p role="alert">Could not load reviews. Refresh and try again.</p> : !query.data?.items.length ? <p className="rounded-3xl bg-sand p-8 text-sm text-ink/55">No reviews match this filter.</p> : <><div className="space-y-4">{query.data.items.map((review) => <article key={review._id} className="rounded-3xl border border-ink/10 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-ink/45">{review.status} · Product {review.productId}</p><h2 className="mt-2 font-display text-2xl">{review.title} · {review.rating}/5</h2><p className="mt-2 text-xs text-ink/50">{review.userName} · {new Date(review.createdAt).toLocaleString()}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/70">{review.body}</p>{review.reportCount ? <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><strong>{review.reportCount} report(s)</strong>{review.reports?.map((report, index) => <p key={`${report.userId}-${index}`} className="mt-1">{report.reason}</p>)}</div> : null}{review.moderationHistory?.length ? <p className="mt-3 text-xs text-ink/50">Last moderation: {review.moderationReason}</p> : null}</div><span className="rounded-full bg-sand px-3 py-1 text-xs">{review.status}</span></div><label className="mt-4 block text-sm">Moderation reason<input className="field mt-1" value={reason[review._id] || ""} maxLength={500} onChange={(event) => setReason((current) => ({ ...current, [review._id]: event.target.value }))} placeholder="Enter at least 3 characters" /></label><div className="mt-4 flex flex-wrap gap-2"><Button type="button" disabled={moderate.isPending || (reason[review._id] || "").trim().length < 3} onClick={() => moderate.mutate({ review, action: "APPROVED" })}>Approve</Button><Button type="button" variant="outline" disabled={moderate.isPending || (reason[review._id] || "").trim().length < 3} onClick={() => moderate.mutate({ review, action: "HIDDEN" })}>Hide</Button><Button type="button" variant="outline" disabled={moderate.isPending || (reason[review._id] || "").trim().length < 3} onClick={() => { if (window.confirm("Remove this review from public display?")) moderate.mutate({ review, action: "REMOVED" }); }}>Remove</Button></div></article>)}</div><div className="mt-4 flex items-center justify-between text-sm"><span>{query.data.pagination.total} reviews · Page {page} of {Math.max(query.data.pagination.pages, 1)}</span><div className="flex gap-2"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button type="button" variant="outline" disabled={!query.data.pagination.hasNext} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></>}
  </div>;
}

export default function AdminReviewsPage() { return <AdminShell permission="reviews.moderate"><ReviewsAdmin /></AdminShell>; }
