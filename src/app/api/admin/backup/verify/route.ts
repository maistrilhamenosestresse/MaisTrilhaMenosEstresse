import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { verifyLatestServerBackup } from "@/lib/server/backup-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  try {
    const result = await verifyLatestServerBackup(auth.user.email || auth.user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Falha no teste de restauração do backup:", error);
    return NextResponse.json(
      { error: error.message || "Falha no teste de restauração" },
      { status: 500 },
    );
  }
}
