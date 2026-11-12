import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const [userCount, session] = await Promise.all([
      prisma.user.count(),
      getSession(),
    ]);

    return NextResponse.json({
      hasUsers: userCount > 0,
      registrationOpen: userCount === 0 || Boolean(session),
      authenticated: Boolean(session),
      user: session,
    });
  } catch (error) {
    console.error("Error in auth status:", error);
    return NextResponse.json(
      { error: "Error al verificar estado del sistema" },
      { status: 500 }
    );
  }
}
