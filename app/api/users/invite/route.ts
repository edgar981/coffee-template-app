import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/email";
import { headers } from "next/headers";
import { randomBytes, createHash } from "crypto";

const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000;
const ALLOWED_ROLES = ["STAFF", "MANAGER"] as const;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || (session.user as { role?: string }).role !== "OWNER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { email, name, role } = await req.json();

  if (typeof email !== "string" || !email.trim() || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Correo y nombre son obligatorios" }, { status: 400 });
  }

  // Validate role against a whitelist — never trust the payload
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const existingInvite = await prisma.invitation.findFirst({
    where: { email: normalizedEmail, usedAt: null, expiresAt: { gt: new Date() } },
  });

  if (existingUser || existingInvite) {
    return NextResponse.json(
      { error: "Ya existe una invitación pendiente o un usuario con este correo" },
      { status: 400 }
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invitation = await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      name: name.trim(),
      role,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
    },
  });

  const origin = process.env.BETTER_AUTH_URL || req.nextUrl.origin;
  const link = `${origin}/aceptar-invitacion?token=${token}`;

  try {
    await sendInvitationEmail({ to: normalizedEmail, name: name.trim(), link });
  } catch {
    // Don't leave a live, un-retryable invite behind if the email never went out
    await prisma.invitation.delete({ where: { id: invitation.id } });
    return NextResponse.json({ error: "No se pudo enviar la invitación" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
