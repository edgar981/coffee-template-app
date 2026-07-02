import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createHash } from "crypto";

const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga",
  INVALID_PASSWORD: "Contraseña inválida",
};

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (typeof token !== "string" || !token || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });

  if (!invitation) {
    return NextResponse.json({ error: "Invitación no válida" }, { status: 400 });
  }
  if (invitation.usedAt) {
    return NextResponse.json({ error: "Esta invitación ya fue utilizada" }, { status: 400 });
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Esta invitación ha expirado" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) {
    return NextResponse.json({ error: "Ya existe un usuario con este correo" }, { status: 400 });
  }

  let createdUserId: string;
  try {
    // Better Auth hashes the password with its own scrypt, in its own format
    const created = await auth.api.signUpEmail({
      body: {
        email: invitation.email,
        name: invitation.name ?? invitation.email,
        password,
      },
    });
    createdUserId = created.user.id;
  } catch (e) {
    const code = (e as { body?: { code?: string } })?.body?.code;
    const message = (code && PASSWORD_ERROR_MESSAGES[code]) || "No se pudo crear la cuenta";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    // role is stripped from signup input (input: false), so set it separately,
    // and mark the invite used in the same transaction as the role assignment
    await prisma.$transaction([
      prisma.user.update({ where: { id: createdUserId }, data: { role: invitation.role } }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } }),
    ]);
  } catch {
    // Roll back the user so the invite stays valid and can be retried, instead of
    // leaving a half-provisioned account (wrong role, invite never marked used)
    await prisma.user.deleteMany({ where: { id: createdUserId } });
    return NextResponse.json({ error: "No se pudo completar el registro. Intenta de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
