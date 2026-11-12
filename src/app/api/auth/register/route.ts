import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getRequestSession,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators";

const DEFAULT_PRODUCTS = [
  {
    name: "Corona de Zirconio Monolítico",
    category: "Prótesis Fija",
    description: "Corona fresada CAD/CAM alta estética",
    price: 65000,
  },
  {
    name: "Corona Metal Cerámica (Porcelana)",
    category: "Prótesis Fija",
    description: "Casquete metálico con recubrimiento cerámico",
    price: 48000,
  },
  {
    name: "Prótesis Completa de Acrílico (Superior o Inferior)",
    category: "Prótesis Removible",
    description: "Acrílico termocurado de alto impacto con dientes tricapa",
    price: 85000,
  },
  {
    name: "Cromo Cobalto (Esquelético Base)",
    category: "Cromo Cobalto",
    description: "Armazón metálico colado con retenedores",
    price: 72000,
  },
  {
    name: "Prótesis Flexible (Deflex / Poliamida)",
    category: "Prótesis Removible",
    description: "Prótesis parcial removible estética sin ganchos metálicos",
    price: 92000,
  },
  {
    name: "Placa Miorrelajante (Bruxismo)",
    category: "Ortodoncia y Placas",
    description: "Placa rígida o termoformada programada",
    price: 38000,
  },
  {
    name: "Provisorio de Acrílico por Pieza",
    category: "Provisorios",
    description: "Corona provisoria termocurada o PMMA",
    price: 16000,
  },
  {
    name: "Reparación Simple / Agregado de Diente",
    category: "Reparaciones",
    description: "Reparación de fractura simple o agregado de 1 pieza en acrílico",
    price: 18000,
  },
];

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const limit = checkRateLimit(`register:${ip}`, 6, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Demasiados intentos. Intenta nuevamente en ${limit.retryAfterSeconds} segundos.`,
        },
        { status: 429 }
      );
    }

    const userCount = await prisma.user.count();
    const currentSession = await getRequestSession(req);

    // Bloqueo de seguridad: si ya existe el protesista registrado, no se permite registro público sin sesión activa
    if (userCount > 0 && !currentSession) {
      return NextResponse.json(
        {
          error:
            "El registro público está bloqueado por seguridad porque el laboratorio ya cuenta con un administrador registrado.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { name, labName, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario registrado con ese correo." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        labName,
        email,
        passwordHash,
      },
    });

    // Si es la primera cuenta del laboratorio y no hay productos aún, precargamos un catálogo base editable
    const productCount = await prisma.product.count();
    if (productCount === 0) {
      await prisma.product.createMany({
        data: DEFAULT_PRODUCTS,
      });
    }

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      labName: user.labName,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          labName: user.labName,
        },
      },
      { status: 201 }
    );

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14, // 14 días
    });

    return response;
  } catch (error) {
    console.error("Error in register:", error);
    return NextResponse.json(
      { error: "Error interno al registrar la cuenta" },
      { status: 500 }
    );
  }
}
