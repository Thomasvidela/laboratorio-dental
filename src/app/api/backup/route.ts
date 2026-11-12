import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import {
  BackupDataPayload,
  buildBackupPayload,
  restoreFromBackupPayload,
} from "@/lib/auto-backup";

export async function GET(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const snapshotId = req.nextUrl.searchParams.get("snapshotId");
    if (snapshotId) {
      const snap = await prisma.backupSnapshot.findUnique({
        where: { id: snapshotId },
      });
      if (!snap) {
        return NextResponse.json(
          { error: "Punto de restauración no encontrado" },
          { status: 404 }
        );
      }
      return NextResponse.json(JSON.parse(snap.payloadJson));
    }

    const includeSnapshots =
      req.nextUrl.searchParams.get("snapshots") === "1";

    if (includeSnapshots) {
      const snapshots = await prisma.backupSnapshot.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          reason: true,
          productsCount: true,
          dentistsCount: true,
          entriesCount: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ snapshots });
    }

    const payload = await buildBackupPayload(
      "Descarga de Respaldo",
      session.labName
    );
    return NextResponse.json({
      ...payload,
      exportedBy: session.email,
    });
  } catch (error) {
    console.error("Error generating backup:", error);
    return NextResponse.json(
      { error: "Error al generar la copia de seguridad" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();

    // Opción 1: Restaurar desde un Snapshot Automático guardado en base de datos
    if (body?.snapshotId && typeof body.snapshotId === "string") {
      const snapshot = await prisma.backupSnapshot.findUnique({
        where: { id: body.snapshotId },
      });
      if (!snapshot) {
        return NextResponse.json(
          { error: "No se encontró el punto de restauración seleccionado" },
          { status: 404 }
        );
      }

      const parsedPayload = JSON.parse(
        snapshot.payloadJson
      ) as BackupDataPayload;
      const result = await restoreFromBackupPayload(parsedPayload);
      return NextResponse.json({
        message: `Punto de restauración aplicado (${result.productsRestored} productos, ${result.dentistsRestored} dentistas, ${result.entriesRestored} movimientos).`,
        ...result,
      });
    }

    // Opción 2: Restaurar desde un archivo JSON o desde el Espejo del Teléfono
    const payload = (body?.payload || body) as BackupDataPayload;
    const result = await restoreFromBackupPayload(payload);

    return NextResponse.json({
      message: `Respaldo restaurado con éxito (${result.productsRestored} productos, ${result.dentistsRestored} dentistas, ${result.entriesRestored} movimientos).`,
      ...result,
    });
  } catch (error) {
    console.error("Error restoring backup:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al restaurar la copia de seguridad",
      },
      { status: 400 }
    );
  }
}
