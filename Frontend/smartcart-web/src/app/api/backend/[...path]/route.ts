import { cookies } from "next/headers"; import { NextRequest, NextResponse } from "next/server";
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: NextRequest, context: Context) {
  if (!(["GET", "HEAD", "OPTIONS"].includes(request.method))) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) return NextResponse.json({ success: false, message: "Cross-origin request rejected" }, { status: 403 });
  }
  const { path } = await context.params;
  const target = `${(process.env.API_URL || "http://localhost:4000").replace(/\/$/, "")}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const token = (await cookies()).get("smartcart_token")?.value;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);
  try {
    const upstream = await fetch(target, { method: request.method, headers, ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: await request.arrayBuffer() }), cache: "no-store" });
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
  } catch {
    return NextResponse.json({ success: false, message: "The SmartCart API is unavailable" }, { status: 503 });
  }
}
export const GET = proxy; export const POST = proxy; export const PUT = proxy; export const PATCH = proxy; export const DELETE = proxy;
