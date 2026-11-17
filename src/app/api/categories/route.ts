import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { OFFICIAL_CATEGORIES } from "@/lib/default-catalog";
import { triggerAutoBackup } from "@/lib/auto-backup";

export async function ensureDefaultCategories() {
  for (const cat of OFFICIAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, sortOrder: cat.sortOrder },
    });
  }

  // Asegurar que cualquier categoría usada por algún producto existente también esté registrada
  const productCategories = await prisma.product.findMany({
    select: { category: true },
    distinct: ["category"],
  });

  let maxOrder = OFFICIAL_CATEGORIES.length;
  for (const pc of productCategories) {
    if (!pc.category) continue;
    const exists = await prisma.category.findUnique({
      where: { name: pc.category },
    });
    if (!exists) {
      maxOrder += 1;
      await prisma.category.create({
        data: { name: pc.category, sortOrder: maxOrder },
      });
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await ensureDefaultCategories();

    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.product.findMany({
        select: { category: true },
      }),
    ]);

    const countByCat = new Map<string, number>();
    for (const p of products) {
      countByCat.set(p.category, (countByCat.get(p.category) || 0) + 1);
    }

    const formatted = categories.map((c) => ({
      ...c,
      productsCount: countByCat.get(c.name) || 0,
    }));

    return NextResponse.json({ categories: formatted });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Error al obtener las categorías" },
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
    const name = String(body?.name || "").trim();
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "El nombre de la categoría debe tener entre 2 y 80 caracteres" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre", category: existing },
        { status: 409 }
      );
    }

    const lastCat = await prisma.category.findFirst({
      orderBy: { sortOrder: "desc" },
    });
    const nextOrder =
      typeof body?.sortOrder === "number"
        ? body.sortOrder
        : (lastCat?.sortOrder || 0) + 1;

    const category = await prisma.category.create({
      data: {
        name,
        sortOrder: nextOrder,
      },
    });

    await triggerAutoBackup(`Categoría creada: ${category.name}`);

    return NextResponse.json(
      { category: { ...category, productsCount: 0 } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Error al crear la categoría" },
      { status: 500 }
    );
  }
}
