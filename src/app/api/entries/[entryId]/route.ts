import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { ledgerEntrySchema } from "@/lib/validators";
import { triggerAutoBackup } from "@/lib/auto-backup";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ entryId: string }> }
) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { entryId } = await context.params;
    const body = await req.json();
    const parsed = ledgerEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const {
      type,
      productId,
      concept,
      patientOrNotes,
      quantity,
      unitPrice,
      amount,
      occurredAt,
    } = parsed.data;

    const entry = await prisma.ledgerEntry.update({
      where: { id: entryId },
      data: {
        type,
        productId: type === "CHARGE" && productId ? productId : null,
        concept,
        patientOrNotes: patientOrNotes || "",
        quantity: type === "CHARGE" ? quantity : 1,
        unitPrice: type === "CHARGE" ? unitPrice : amount,
        amount: Math.round(amount * 100) / 100,
        ...(occurredAt ? { occurredAt: new Date(occurredAt) } : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, category: true, price: true },
        },
      },
    });

    await triggerAutoBackup(`Movimiento editado: ${entry.concept}`);

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Error updating ledger entry:", error);
    return NextResponse.json(
      { error: "Error al editar el movimiento" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ entryId: string }> }
) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { entryId } = await context.params;
    await prisma.ledgerEntry.delete({ where: { id: entryId } });

    await triggerAutoBackup("Movimiento eliminado");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting ledger entry:", error);
    return NextResponse.json(
      { error: "Error al eliminar el movimiento" },
      { status: 500 }
    );
  }
}
