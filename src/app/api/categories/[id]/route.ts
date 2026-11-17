import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
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

    const current = await prisma.category.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    const newName =
      typeof body?.name === "string" ? body.name.trim() : current.name;
    const newSortOrder =
      typeof body?.sortOrder === "number" ? body.sortOrder : current.sortOrder;

    if (newName.length < 2 || newName.length > 80) {
      return NextResponse.json(
        { error: "Nombre de categoría inválido" },
        { status: 400 }
      );
    }

    if (newName !== current.name) {
      const duplicate = await prisma.category.findUnique({
        where: { name: newName },
      });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: "Ya existe otra categoría con ese nombre" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cat = await tx.category.update({
        where: { id },
        data: { name: newName, sortOrder: newSortOrder },
      });

      if (newName !== current.name) {
        await tx.product.updateMany({
          where: { category: current.name },
          data: { category: newName },
        });
      }

      return cat;
    });

    await triggerAutoBackup(`Categoría actualizada: ${updated.name}`);

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Error al actualizar la categoría" },
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
    const current = await prisma.category.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    await prisma.category.delete({ where: { id } });
    await triggerAutoBackup(`Categoría eliminada: ${current.name}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Error al eliminar la categoría" },
      { status: 500 }
    );
  }
}
