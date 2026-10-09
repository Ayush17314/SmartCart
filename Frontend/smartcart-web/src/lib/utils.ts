import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
export const imageFor = (product?: { images?: string[]; category?: string }, index = 0) => product?.images?.[index] || `https://images.unsplash.com/photo-${({ Living: "1490312278390-ab64016e0aa9", Home: "1600210492486-724fe5c67fb0", Wear: "1529139574466-a303027c1d8b", Objects: "1490312278390-ab64016e0aa9" } as Record<string, string>)[product?.category || ""] || "1490312278390-ab64016e0aa9"}?auto=format&fit=crop&w=1000&q=85`;
