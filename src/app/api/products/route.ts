import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/auth";
import { bulkPriceAdjustmentSchema, productSchema } from "@/lib/validators";
import { triggerAutoBackup } from "@/lib/auto-backup";
import {
  OFFICIAL_CATEGORIES,
  OFFICIAL_PRODUCTS_CATALOG,
} from "@/lib/default-catalog";

const OLD_DEMO_PRODUCT_NAMES = [
  "Corona de Zirconio Monolítico",
  "Corona Metal Cerámica (Porcelana)",
  "Prótesis Completa de Acrílico (Superior o Inferior)",
  "Cromo Cobalto (Esquelético Base)",
  "Prótesis Flexible (Deflex / Poliamida)",
  "Placa Miorrelajante (Bruxismo)",
  "Provisorio de Acrílico por Pieza",
  "Reparación Simple / Agregado de Diente",
];

const OLD_DEMO_CATEGORY_NAMES = [
  "Prótesis Fija",
  "Prótesis Removible",
  "Cromo Cobalto",
  "Ortodoncia y Placas",
  "Provisorios",
  "Reparaciones",
];

export async function GET(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar si ya se cargó el catálogo oficial Abril 2026 en esta base de datos
    const hasOfficialCatalog = await prisma.product.findFirst({
      where: { name: "Removible de acrílico - Hasta 4 elementos" },
    });

    if (!hasOfficialCatalog) {
      // 1. Asegurar las 8 categorías oficiales del PDF con su orden
      for (const cat of OFFICIAL_CATEGORIES) {
        await prisma.category.upsert({
          where: { name: cat.name },
          update: { sortOrder: cat.sortOrder },
          create: { name: cat.name, sortOrder: cat.sortOrder },
        });
      }

      // 2. Eliminar únicamente los 8 productos de demostración viejos (conservando cualquier producto creado por el protesista)
      await prisma.product.deleteMany({
        where: { name: { in: OLD_DEMO_PRODUCT_NAMES } },
      });

      // 3. Limpiar categorías viejas de demostración que hayan quedado vacías
      for (const oldCatName of OLD_DEMO_CATEGORY_NAMES) {
        const countInOld = await prisma.product.count({
          where: { category: oldCatName },
        });
        if (countInOld === 0) {
          await prisma.category.deleteMany({
            where: { name: oldCatName },
          });
        }
      }

      // 4. Insertar los 32 productos oficiales del PDF sin duplicar si alguno ya existía
      const existingProducts = await prisma.product.findMany({
        select: { name: true },
      });
      const existingNames = new Set(existingProducts.map((p) => p.name));
      const toInsert = OFFICIAL_PRODUCTS_CATALOG.filter(
        (p) => !existingNames.has(p.name)
      );

      if (toInsert.length > 0) {
        await prisma.product.createMany({
          data: toInsert,
        });
      }
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

    // Asegurar que la categoría exista en la tabla de categorías
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
