import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { dentistSchema } from "@/lib/validators";
import { triggerAutoBackup } from "@/lib/auto-backup";

export async function GET(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const dentists = await prisma.dentist.findMany({
      include: {
        entries: {
          orderBy: { occurredAt: "desc" },
        },
      },
      orderBy: { fullName: "asc" },
    });

    const formatted = dentists.map((d) => {
      let totalCharges = 0;
      let totalPayments = 0;

      for (const entry of d.entries) {
        if (entry.type === "CHARGE") {
          totalCharges += entry.amount;
        } else if (entry.type === "PAYMENT") {
          totalPayments += entry.amount;
        }
      }

      const balance = Math.round((totalCharges - totalPayments) * 100) / 100;
      const lastActivity = d.entries[0]?.occurredAt || d.updatedAt;

      return {
        id: d.id,
        fullName: d.fullName,
        clinicName: d.clinicName,
        phone: d.phone,
        email: d.email,
        address: d.address,
        notes: d.notes,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        totalCharges: Math.round(totalCharges * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        balance,
        entriesCount: d.entries.length,
        lastActivity,
      };
    });

    return NextResponse.json({ dentists: formatted });
  } catch (error) {
    console.error("Error fetching dentists:", error);
    return NextResponse.json(
      { error: "Error al obtener los dentistas" },
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
    const parsed = dentistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { initialBalance, ...dentistData } = parsed.data;
    const cleanInitial = Math.round((Number(initialBalance) || 0) * 100) / 100;

    const dentist = await prisma.dentist.create({
      data: {
        ...dentistData,
        ...(cleanInitial > 0
          ? {
              entries: {
                create: {
                  type: "CHARGE",
                  productId: null,
                  concept: "Saldo anterior acumulado",
                  patientOrNotes: "Monto migrado de cuenta previa",
                  quantity: 1,
                  unitPrice: cleanInitial,
                  amount: cleanInitial,
                  occurredAt: new Date(),
                },
              },
            }
          : {}),
      },
    });

    await triggerAutoBackup(`Dentista registrado: ${dentist.fullName}`);

    return NextResponse.json(
      {
        dentist: {
          ...dentist,
          totalCharges: cleanInitial,
          totalPayments: 0,
          balance: cleanInitial,
          entriesCount: cleanInitial > 0 ? 1 : 0,
          lastActivity: dentist.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating dentist:", error);
    return NextResponse.json(
      { error: "Error al registrar el dentista" },
      { status: 500 }
    );
  }
}
