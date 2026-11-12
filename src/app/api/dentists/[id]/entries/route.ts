import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { ledgerEntrySchema } from "@/lib/validators";
import { triggerAutoBackup } from "@/lib/auto-backup";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: dentistId } = await context.params;
    const dentist = await prisma.dentist.findUnique({
      where: { id: dentistId },
    });
    if (!dentist) {
      return NextResponse.json(
        { error: "Dentista no encontrado" },
        { status: 404 }
      );
    }

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

    const entry = await prisma.ledgerEntry.create({
      data: {
        dentistId,
        type,
        productId: type === "CHARGE" && productId ? productId : null,
        concept,
        patientOrNotes: patientOrNotes || "",
        quantity: type === "CHARGE" ? quantity : 1,
        unitPrice: type === "CHARGE" ? unitPrice : amount,
        amount: Math.round(amount * 100) / 100,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
      include: {
        product: {
          select: { id: true, name: true, category: true, price: true },
        },
      },
    });

    await triggerAutoBackup(
      `${type === "CHARGE" ? "Trabajo cargado" : "Pago registrado"} (${dentist.fullName}: ${concept})`
    );

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Error creating ledger entry:", error);
    return NextResponse.json(
      { error: "Error al registrar el movimiento" },
      { status: 500 }
    );
  }
}
