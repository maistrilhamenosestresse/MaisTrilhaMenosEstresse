import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;
  return NextResponse.json({ allowed: true });
}
