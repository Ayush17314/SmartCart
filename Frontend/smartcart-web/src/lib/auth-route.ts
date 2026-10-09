import { NextRequest, NextResponse } from "next/server";
const upstream = () => (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
export async function authenticate(request: NextRequest, action: "login" | "register") {
  const response = await fetch(`${upstream()}/api/auth/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: await request.text(), cache: "no-store" });
  const body = await response.json().catch(() => ({ success: false, message: "Authentication service returned an invalid response" }));
  if (!response.ok || !body.success) return NextResponse.json(body, { status: response.status });
  const token = body.data?.token;
  if (!token) return NextResponse.json({ success: false, message: "Authentication token was not returned" }, { status: 502 });
  const result = NextResponse.json({ success: true, data: { user: body.data.user } }, { status: response.status });
  result.cookies.set("smartcart_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return result;
}
