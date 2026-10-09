export type Product = { _id: string; name: string; description?: string; price: number; category: string; brand?: string; images?: string[]; stock: number; rating?: number; specifications?: Record<string, unknown> };
export type CartItem = { productId: string; name: string; price: number; quantity: number; image?: string };
export type Cart = { items: CartItem[]; total: number; _id?: string };
export type User = { id: string; name: string; email: string; phone?: string; role: "customer" | "admin"; address?: Record<string, string> };
export type PaymentCheckout = { keyId: string; orderId: string; amount: number; currency: string; name: string; description: string };
export type Order = { _id: string; items: CartItem[]; totalAmount: number; paymentId?: string | null; paymentMethod?: "UPI" | "CARD" | "COD"; paymentCheckout?: PaymentCheckout | null; paymentStatus: string; orderStatus: string; statusHistory?: { status: string; note: string; changedAt: string }[]; shipment?: { carrier?: string; trackingNumber?: string; trackingUrl?: string }; createdAt: string };
export type PageResult<T> = { items: T[]; pagination: { page: number; limit: number; total: number; pages: number; hasNext?: boolean; hasPrevious?: boolean } };
