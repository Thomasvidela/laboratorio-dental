import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export interface BackupDataPayload {
  exportedAt: string;
  reason?: string;
  labName?: string;
  data: {
    products: Array<{
      id: string;
      name: string;
      category: string;
      description: string;
      price: number;
      active: boolean;
      createdAt?: string | Date;
      updatedAt?: string | Date;
    }>;
    dentists: Array<{
      id: string;
      fullName: string;
      clinicName: string;
      phone: string;
      email: string;
      address: string;
      notes: string;
      createdAt?: string | Date;
      updatedAt?: string | Date;
    }>;
    entries: Array<{
      id: string;
      dentistId: string;
      productId: string | null;
      type: string;
      concept: string;
      patientOrNotes: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      occurredAt: string | Date;
      createdAt?: string | Date;
      updatedAt?: string | Date;
    }>;
  };
}

const MAX_SNAPSHOTS = 20;

export async function buildBackupPayload(
  reason = "Respaldo Automático",
  labName = "Laboratorio Dental"
): Promise<BackupDataPayload> {
  const [products, dentists, entries] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.dentist.findMany({ orderBy: { fullName: "asc" } }),
    prisma.ledgerEntry.findMany({ orderBy: { occurredAt: "desc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    reason,
    labName,
    data: {
      products,
      dentists,
      entries,
    },
  };
}

/**
 * Dispara un respaldo automático en la base de datos (BackupSnapshot)
 * y, si corre en PC local, también guarda el archivo en la carpeta /backups.
 */
export async function triggerAutoBackup(
  reason = "Respaldo Automático"
): Promise<void> {
  try {
    const payload = await buildBackupPayload(reason);
    const payloadJson = JSON.stringify(payload);

    await prisma.backupSnapshot.create({
      data: {
        reason,
        productsCount: payload.data.products.length,
        dentistsCount: payload.data.dentists.length,
        entriesCount: payload.data.entries.length,
        payloadJson,
      },
    });

    // Rotación automática: mantener los últimos MAX_SNAPSHOTS puntos de restauración
    const oldSnapshots = await prisma.backupSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      skip: MAX_SNAPSHOTS,
      select: { id: true },
    });

    if (oldSnapshots.length > 0) {
      await prisma.backupSnapshot.deleteMany({
        where: { id: { in: oldSnapshots.map((s) => s.id) } },
      });
    }

    // Capa extra en PC local: guardar archivo físico en carpeta /backups
    if (!process.env.VERCEL) {
      try {
        const backupsDir = path.join(process.cwd(), "backups");
        await fs.mkdir(backupsDir, { recursive: true });
        const dateStr = new Date().toISOString().slice(0, 10);
        const dailyPath = path.join(backupsDir, `auto-backup-${dateStr}.json`);
        const latestPath = path.join(
          backupsDir,
          "ultimo-respaldo-automatico.json"
        );
        const formatted = JSON.stringify(payload, null, 2);
        await Promise.all([
          fs.writeFile(dailyPath, formatted, "utf8"),
          fs.writeFile(latestPath, formatted, "utf8"),
        ]);
      } catch {
        // En entornos serverless de solo lectura se ignora silenciosamente
      }
    }
  } catch (error) {
    console.error("Error en triggerAutoBackup:", error);
  }
}

/**
 * Restaura de forma atómica los productos, dentistas y movimientos desde un payload de backup.
 */
export async function restoreFromBackupPayload(
  payload: BackupDataPayload
): Promise<{
  productsRestored: number;
  dentistsRestored: number;
  entriesRestored: number;
}> {
  if (!payload?.data || !Array.isArray(payload.data.products)) {
    throw new Error("Formato de archivo de respaldo inválido");
  }

  // Guardar punto de restauración previo por seguridad antes de pisar datos
  await triggerAutoBackup("Respaldo automático previo a restauración");

  const products = payload.data.products || [];
  const dentists = payload.data.dentists || [];
  const entries = payload.data.entries || [];

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany();
    await tx.dentist.deleteMany();
    await tx.product.deleteMany();

    for (const p of products) {
      await tx.product.create({
        data: {
          id: p.id,
          name: String(p.name || "Producto"),
          category: String(p.category || "General"),
          description: String(p.description || ""),
          price: Number(p.price) || 0,
          active: p.active !== false,
          ...(p.createdAt ? { createdAt: new Date(p.createdAt) } : {}),
        },
      });
    }

    for (const d of dentists) {
      await tx.dentist.create({
        data: {
          id: d.id,
          fullName: String(d.fullName || "Dentista"),
          clinicName: String(d.clinicName || ""),
          phone: String(d.phone || ""),
          email: String(d.email || ""),
          address: String(d.address || ""),
          notes: String(d.notes || ""),
          ...(d.createdAt ? { createdAt: new Date(d.createdAt) } : {}),
        },
      });
    }

    const validProductIds = new Set(products.map((p) => p.id));
    const validDentistIds = new Set(dentists.map((d) => d.id));

    for (const e of entries) {
      if (!validDentistIds.has(e.dentistId)) continue;
      await tx.ledgerEntry.create({
        data: {
          id: e.id,
          dentistId: e.dentistId,
          productId:
            e.productId && validProductIds.has(e.productId)
              ? e.productId
              : null,
          type: e.type === "PAYMENT" ? "PAYMENT" : "CHARGE",
          concept: String(e.concept || "Movimiento"),
          patientOrNotes: String(e.patientOrNotes || ""),
          quantity: Number(e.quantity) || 1,
          unitPrice: Number(e.unitPrice) || 0,
          amount: Number(e.amount) || 0,
          occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
          ...(e.createdAt ? { createdAt: new Date(e.createdAt) } : {}),
        },
      });
    }
  });

  await triggerAutoBackup("Restauración de respaldo completada");

  return {
    productsRestored: products.length,
    dentistsRestored: dentists.length,
    entriesRestored: entries.length,
  };
}
