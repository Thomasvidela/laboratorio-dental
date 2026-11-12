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

    const dentist = await prisma.dentist.create({
      data: parsed.data,
    });

    await triggerAutoBackup(`Dentista registrado: ${dentist.fullName}`);

    return NextResponse.json(
      {
        dentist: {
          ...dentist,
          totalCharges: 0,
          totalPayments: 0,
          balance: 0,
          entriesCount: 0,
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
