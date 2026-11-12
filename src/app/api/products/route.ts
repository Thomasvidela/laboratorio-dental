import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { bulkPriceAdjustmentSchema, productSchema } from "@/lib/validators";
import { triggerAutoBackup } from "@/lib/auto-backup";

export async function GET(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Error al obtener la lista de precios" },
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
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: parsed.data,
    });

    await triggerAutoBackup(`Producto creado: ${product.name}`);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Error al crear el producto" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bulkPriceAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { percentage, category, roundTo } = parsed.data;
    const whereClause =
      category && category !== "TODAS" ? { category } : undefined;

    const products = await prisma.product.findMany({ where: whereClause });
    const factor = 1 + percentage / 100;

    await prisma.$transaction(
      products.map((p) => {
        let newPrice = p.price * factor;
        if (roundTo && roundTo > 0) {
          newPrice = Math.round(newPrice / roundTo) * roundTo;
        } else {
          newPrice = Math.round(newPrice * 100) / 100;
        }
        return prisma.product.update({
          where: { id: p.id },
          data: { price: Math.max(0, newPrice) },
        });
      })
    );

    const updatedProducts = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    await triggerAutoBackup(`Ajuste masivo de precios (${percentage}%)`);

    return NextResponse.json({
      message: `Se actualizaron ${products.length} productos exitosamente`,
      products: updatedProducts,
    });
  } catch (error) {
    console.error("Error adjusting prices:", error);
    return NextResponse.json(
      { error: "Error al actualizar los precios masivamente" },
      { status: 500 }
    );
  }
}
