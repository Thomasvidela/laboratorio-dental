import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { productSchema } from "@/lib/validators";
import { triggerAutoBackup } from "@/lib/auto-backup";

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
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const existingCat = await prisma.category.findUnique({
      where: { name: parsed.data.category },
    });
    if (!existingCat) {
      const lastCat = await prisma.category.findFirst({
        orderBy: { sortOrder: "desc" },
      });
      await prisma.category.create({
        data: {
          name: parsed.data.category,
          sortOrder: (lastCat?.sortOrder || 0) + 1,
        },
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
    });

    await triggerAutoBackup(`Precio/producto actualizado: ${product.name}`);

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Error al modificar el producto" },
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
    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Error al eliminar el producto" },
      { status: 500 }
    );
  }
}
