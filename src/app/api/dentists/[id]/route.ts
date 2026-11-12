import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { dentistSchema } from "@/lib/validators";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const dentist = await prisma.dentist.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            product: {
              select: { id: true, name: true, category: true, price: true },
            },
          },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!dentist) {
      return NextResponse.json(
        { error: "Dentista no encontrado" },
        { status: 404 }
      );
    }

    let totalCharges = 0;
    let totalPayments = 0;

    for (const entry of dentist.entries) {
      if (entry.type === "CHARGE") {
        totalCharges += entry.amount;
      } else if (entry.type === "PAYMENT") {
        totalPayments += entry.amount;
      }
    }

    const balance = Math.round((totalCharges - totalPayments) * 100) / 100;

    return NextResponse.json({
      dentist: {
        ...dentist,
        totalCharges: Math.round(totalCharges * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        balance,
      },
    });
  } catch (error) {
    console.error("Error fetching dentist detail:", error);
    return NextResponse.json(
      { error: "Error al obtener los datos del dentista" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = dentistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const dentist = await prisma.dentist.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ dentist });
  } catch (error) {
    console.error("Error updating dentist:", error);
    return NextResponse.json(
      { error: "Error al actualizar los datos del dentista" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    await prisma.dentist.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting dentist:", error);
    return NextResponse.json(
      { error: "Error al eliminar el dentista" },
      { status: 500 }
    );
  }
}
