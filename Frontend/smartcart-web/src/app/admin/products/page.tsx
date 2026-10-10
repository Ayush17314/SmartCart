"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useStoreCurrency } from "@/lib/use-store-currency";
import { money } from "@/lib/utils";

type Draft = { name: string; sku: string; description: string; category: string; brand: string; price: string; stock: string; stockAdjustmentReason: string; images: string; specifications: string };
const emptyDraft: Draft = { name: "", sku: "", description: "", category: "", brand: "", price: "", stock: "0", stockAdjustmentReason: "", images: "", specifications: "{}" };
const draftFromProduct = (product: Product): Draft => ({ name: product.name, sku: product.sku || "", description: product.description || "", category: product.category, brand: product.brand || "", price: String(product.price), stock: String(product.stock), stockAdjustmentReason: "", images: (product.images || []).join("\n"), specifications: JSON.stringify(product.specifications || {}, null, 2) });

function ProductsAdmin() {
  const currency = useStoreCurrency();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("updatedAt");
  const [order, setOrder] = useState("desc");
  const [archiveFilter, setArchiveFilter] = useState("false");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [historyId, setHistoryId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const query = useMemo(() => new URLSearchParams({ page: String(page), limit: "20", archived: archiveFilter, sort, order, ...(category ? { category } : {}), ...(brand ? { brand } : {}), ...(search.trim() ? { search: search.trim() } : {}) }).toString(), [page, archiveFilter, search, category, brand, sort, order]);
  const products = useQuery({ queryKey: ["admin-products", query], queryFn: () => api.adminProducts(query) });
  const categories = useQuery({ queryKey: ["product-categories"], queryFn: api.categories });
  const brands = useQuery({ queryKey: ["product-brands"], queryFn: api.brands });
  const history = useQuery({ queryKey: ["inventory-history", historyId], queryFn: () => api.inventoryMovements(historyId), enabled: Boolean(historyId) });
  const mutation = useMutation({
    mutationFn: async (input: { id?: string; draft: Draft }) => {
      const specifications = JSON.parse(input.draft.specifications || "{}") as Record<string, unknown>;
      const body = { name: input.draft.name.trim(), sku: input.draft.sku.trim(), description: input.draft.description.trim(), category: input.draft.category.trim(), brand: input.draft.brand.trim(), price: Number(input.draft.price), stock: Number(input.draft.stock), stockAdjustmentReason: input.draft.stockAdjustmentReason.trim(), images: input.draft.images.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), specifications };
      return input.id ? api.updateProduct(input.id, body) : api.createProduct(body);
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-products"] }); void client.invalidateQueries({ queryKey: ["admin-inventory-summary"] }); toast.success(editing ? "Product updated" : "Product created"); setFormOpen(false); setEditing(null); setDraft(emptyDraft); },
    onError: (error: Error) => toast.error(error.message || "Could not save product"),
  });
  const archive = useMutation({ mutationFn: ({ id, archived }: { id: string; archived: boolean }) => api.setProductArchived(id, archived), onSuccess: () => { void client.invalidateQueries({ queryKey: ["admin-products"] }); void client.invalidateQueries({ queryKey: ["admin-inventory-summary"] }); toast.success("Product visibility updated"); }, onError: (error: Error) => toast.error(error.message) });
  const beginCreate = () => { setEditing(null); setDraft(emptyDraft); setFormOpen(true); };
  const beginEdit = (product: Product) => { setEditing(product); setDraft(draftFromProduct(product)); setFormOpen(true); };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(draft.price); const stock = Number(draft.stock);
    if (!draft.name.trim() || !draft.category.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) { toast.error("Enter a name, category, non-negative price, and whole-number stock."); return; }
    if (editing && stock !== editing.stock && draft.stockAdjustmentReason.trim().length < 3) { toast.error("Add a reason for this stock adjustment."); return; }
    try { const specs = JSON.parse(draft.specifications || "{}"); if (!specs || Array.isArray(specs) || typeof specs !== "object") throw new Error(); }
    catch { toast.error("Specifications must be a valid JSON object."); return; }
    if (draft.images.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).some((url) => !/^https:\/\//i.test(url))) { toast.error("Use HTTPS image URLs, one per line."); return; }
    mutation.mutate({ id: editing?._id, draft });
  };

  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-emerald-700">Catalog operations</p><h1 className="mt-2 font-display text-5xl">Products.</h1><p className="mt-3 text-sm text-ink/55">Create, edit, search, and archive catalog items. Archived items remain available in historical order snapshots.</p></div><Button onClick={beginCreate}>Add product</Button></div>
    {formOpen && <form onSubmit={submit} className="mb-8 rounded-3xl border border-ink/10 p-5 md:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-3xl">{editing ? "Edit product" : "New product"}</h2><button type="button" className="text-sm underline" onClick={() => setFormOpen(false)}>Close</button></div><div className="grid gap-4 sm:grid-cols-2">{([ ["name", "Name"], ["sku", "SKU (optional)"], ["category", "Category"], ["brand", "Brand (optional)"], ["price", `Price (${currency})`], ["stock", "Stock quantity"] ] as const).map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}<input required={key === "name" || key === "category" || key === "price" || key === "stock"} type={key === "price" ? "number" : key === "stock" ? "number" : "text"} min={key === "price" || key === "stock" ? "0" : undefined} step={key === "price" ? "0.01" : key === "stock" ? "1" : undefined} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="field" /></label>)}
      {editing && <label className="block text-sm font-medium sm:col-span-2">Reason for stock change<textarea rows={2} value={draft.stockAdjustmentReason} onChange={(event) => setDraft({ ...draft, stockAdjustmentReason: event.target.value })} className="field" placeholder="Required if you change the stock quantity" /></label>}
      <label className="block text-sm font-medium sm:col-span-2">Description<textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="field" /></label>
      <label className="block text-sm font-medium sm:col-span-2">Image HTTPS URLs, one per line<textarea rows={2} value={draft.images} onChange={(event) => setDraft({ ...draft, images: event.target.value })} className="field" placeholder="https://example.com/product.jpg" /></label>
      <label className="block text-sm font-medium sm:col-span-2">Specifications as JSON object<textarea rows={4} value={draft.specifications} onChange={(event) => setDraft({ ...draft, specifications: event.target.value })} className="field font-mono text-xs" /></label>
    </div><div className="mt-5 flex gap-3"><Button disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : editing ? "Save changes" : "Create product"}</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button></div></form>}
    <div className="mb-5 flex flex-wrap gap-3"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="field mt-0 max-w-sm" placeholder="Search name, SKU, category…" aria-label="Search products" /><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="rounded-full border border-ink/15 bg-paper px-4 text-sm" aria-label="Filter category"><option value="">All categories</option>{categories.data?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><select value={brand} onChange={(event) => { setBrand(event.target.value); setPage(1); }} className="rounded-full border border-ink/15 bg-paper px-4 text-sm" aria-label="Filter brand"><option value="">All brands</option>{brands.data?.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><select value={`${sort}:${order}`} onChange={(event) => { const [nextSort, nextOrder] = event.target.value.split(":"); setSort(nextSort); setOrder(nextOrder); setPage(1); }} className="rounded-full border border-ink/15 bg-paper px-4 text-sm" aria-label="Sort products"><option value="updatedAt:desc">Recently updated</option><option value="name:asc">Name A to Z</option><option value="name:desc">Name Z to A</option><option value="price:asc">Price low to high</option><option value="price:desc">Price high to low</option><option value="stock:asc">Stock low to high</option><option value="stock:desc">Stock high to low</option></select><select value={archiveFilter} onChange={(event) => { setArchiveFilter(event.target.value); setPage(1); }} className="rounded-full border border-ink/15 bg-paper px-4 text-sm" aria-label="Product visibility"><option value="false">Active products</option><option value="true">Archived products</option><option value="all">All products</option></select></div>
    {products.isLoading ? <div className="skeleton h-72 rounded-3xl"/> : products.error ? <div role="alert" className="rounded-3xl bg-red-50 p-8 text-sm text-red-800">Could not load products. <button className="ml-2 underline" onClick={() => void products.refetch()}>Try again</button></div> : !products.data?.items.length ? <div className="rounded-3xl bg-sand p-10 text-center text-sm text-ink/55">No products match these filters.</div> : <div className="overflow-x-auto rounded-3xl border border-ink/10"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-5 py-4">Product</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4">Visibility</th><th className="px-5 py-4">Actions</th></tr></thead><tbody>{products.data.items.map((product) => <tr key={product._id} className="border-t border-ink/10"><td className="px-5 py-4"><p className="font-medium">{product.name}</p><p className="mt-1 text-xs text-ink/45">{product.sku || product.brand || product._id.slice(-8)}</p></td><td className="px-5 py-4">{product.category}</td><td className="px-5 py-4">{money(product.price, currency)}</td><td className="px-5 py-4">{product.stock}</td><td className="px-5 py-4">{product.archivedAt ? "Archived" : "Active"}</td><td className="px-5 py-4"><div className="flex gap-3"><button className="underline" onClick={() => beginEdit(product)}>Edit</button><button className="underline" onClick={() => setHistoryId(product._id)}>Stock history</button><button className="underline" onClick={() => { const archived = !product.archivedAt; if (window.confirm(`${archived ? "Archive" : "Restore"} ${product.name}?`)) archive.mutate({ id: product._id, archived }); }}>{product.archivedAt ? "Restore" : "Archive"}</button></div></td></tr>)}</tbody></table></div>}
    {historyId && <section className="mt-6 rounded-3xl border border-ink/10 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">Stock adjustment history</h2><button className="text-sm underline" onClick={() => setHistoryId("")}>Close</button></div>{history.isLoading ? <div className="skeleton h-24 rounded-2xl"/> : history.error ? <p role="alert" className="text-sm text-red-700">Could not load stock history.</p> : history.data?.length ? <ul className="divide-y divide-ink/10">{history.data.map((entry, index) => <li key={`${entry.changedAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{entry.previousStock} → {entry.newStock} · {entry.reason}</span><span className="text-xs text-ink/45">{new Date(entry.changedAt).toLocaleString()} · {entry.actorUserId}</span></li>)}</ul> : <p className="text-sm text-ink/50">No stock changes have been recorded.</p>}</section>}
    {products.data && <div className="mt-5 flex items-center justify-between text-sm"><span className="text-ink/50">Page {products.data.pagination.page} of {Math.max(products.data.pagination.pages, 1)} · {products.data.pagination.total} products</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= products.data.pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
  </>;
}

export default function AdminProductsPage() { return <AdminShell permission="products.write"><ProductsAdmin /></AdminShell>; }
