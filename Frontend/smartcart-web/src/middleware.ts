import { NextRequest, NextResponse } from "next/server";
const protectedPaths = ["/cart", "/checkout", "/orders", "/wishlist", "/account"];
export function middleware(request: NextRequest) { if (protectedPaths.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)) && !request.cookies.has("smartcart_token")) { const login = new URL("/login", request.url); login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`); return NextResponse.redirect(login); } return NextResponse.next(); }
export const config = { matcher: ["/cart/:path*", "/checkout/:path*", "/orders/:path*", "/wishlist/:path*", "/account/:path*"] };
