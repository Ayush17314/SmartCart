import { NextRequest } from "next/server"; import { authenticate } from "@/lib/auth-route";
export const POST = (request: NextRequest) => authenticate(request, "register");
