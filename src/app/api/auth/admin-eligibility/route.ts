import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminRequest(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ allowed: true });
}
