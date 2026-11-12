import { NextRequest, NextResponse } from "next/server";
import { triggerAutoBackup } from "@/lib/auto-backup";
import { getRequestSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const session = await getRequestSession(req);

    // Permitir ejecución desde Vercel Cron o desde una sesión autenticada del protesista
    const isVercelCron =
      req.headers.get("x-vercel-cron") === "1" ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isVercelCron && !session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await triggerAutoBackup("Backup automático programado diario");
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in cron backup:", error);
    return NextResponse.json(
      { error: "Error en backup automático" },
      { status: 500 }
    );
  }
}
