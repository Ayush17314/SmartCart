import type { Cart, Order, PageResult, PaymentCheckout, Product, User } from "@/lib/types";

type ApiResult<T> = { success: boolean; data: T; message?: string; pagination?: PageResult<unknown>["pagination"] };
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); this.name = "ApiError"; } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/backend${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers }, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => ({})) as ApiResult<T>;
  if (!response.ok || body.success === false) throw new ApiError(body.message || "Something went wrong. Please try again.", response.status);
  return body.data;
}
const newIdempotencyKey = () => globalThis.crypto.randomUUID();
export const api = {
  products: async (query = ""): Promise<PageResult<Product>> => request(`/api/products${query ? `?${query}` : ""}`),
  product: (id: string) => request<Product>(`/api/products/${encodeURIComponent(id)}`),
  categories: () => request<{ name: string; productCount: number }[]>("/api/products/categories"),
  cart: () => request<Cart>("/api/cart"),
  addCart: (productId: string, quantity = 1) => request<Cart>("/api/cart/items", { method: "POST", headers: { "Idempotency-Key": newIdempotencyKey() }, body: JSON.stringify({ productId, quantity }) }),
  updateCart: (productId: string, quantity: number) => request<Cart>(`/api/cart/items/${encodeURIComponent(productId)}`, { method: "PUT", body: JSON.stringify({ quantity }) }),
  removeCart: (productId: string) => request<Cart>(`/api/cart/items/${encodeURIComponent(productId)}`, { method: "DELETE" }),
  clearCart: () => request<null>("/api/cart", { method: "DELETE" }),
  wishlist: () => request<{ products: string[] }>("/api/wishlist"),
  addWishlist: (id: string) => request<{ products: string[] }>(`/api/wishlist/${encodeURIComponent(id)}`, { method: "POST" }),
  removeWishlist: (id: string) => request<{ products: string[] }>(`/api/wishlist/${encodeURIComponent(id)}`, { method: "DELETE" }),
  orders: () => request<Order[]>("/api/orders?page=1&limit=50"),
  order: (id: string) => request<Order>(`/api/orders/${encodeURIComponent(id)}`),
  tracking: (id: string) => request<{ orderId: string; status: string; shipment: Order["shipment"]; history: Order["statusHistory"] }>(`/api/orders/${encodeURIComponent(id)}/tracking`),
  createOrder: (body: { items: { productId: string; quantity: number }[]; shippingAddress: Record<string, string>; paymentMethod: "UPI" | "CARD" | "COD" }) => request<Order>("/api/orders", { method: "POST", headers: { "Idempotency-Key": newIdempotencyKey() }, body: JSON.stringify(body) }),
  createPayment: (body: { orderId: string; amount: number; paymentMethod: "UPI" | "CARD" | "COD" }, idempotencyKey: string) => request<{ payment: { _id: string; status: string }; checkout: PaymentCheckout | null }>("/api/payments/create", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) }),
  verifyPayment: (paymentId: string, body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) => request<{ payment: { status: string } }>(`/api/payments/verify/${encodeURIComponent(paymentId)}`, { method: "POST", body: JSON.stringify(body) }),
  cancelOrder: (id: string) => request<Order>(`/api/orders/${encodeURIComponent(id)}/cancellation`, { method: "PATCH", body: JSON.stringify({}) }),
  returnOrder: (id: string) => request<Order>(`/api/orders/${encodeURIComponent(id)}/returns`, { method: "POST", headers: { "Idempotency-Key": newIdempotencyKey() }, body: JSON.stringify({}) }),
  profile: () => request<User>("/api/auth/profile"),
  updateProfile: (body: { name: string; phone?: string; address?: Record<string, string> }) => request<User>("/api/auth/profile", { method: "PUT", body: JSON.stringify(body) }),
};
