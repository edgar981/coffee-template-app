import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@duna/core";
import { sendInvitationEmail } from "@/lib/email";
import { listarInvitacionesPendientes } from "@/lib/invitations";
import { headers } from "next/headers";
import { randomBytes, createHash } from "crypto";

const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000;

// Listar las invitaciones VIVAS (sin aceptar, sin vencer). Sólo OWNER, el mismo
// gate que invitar y cancelar: quién puede tocar el equipo es una sola decisión.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || (session.user as { role?: string }).role !== "OWNER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const pendientes = await listarInvitacionesPendientes();
  return NextResponse.json(pendientes);
}
// STAFF sale de la lista ofrecida y el valor del enum SE QUEDA (append-only).
// Motivo: hoy es un rol MUERTO — el gate del panel exige OWNER o MANAGER, así
// que un invitado STAFF crea su contraseña y se estrella contra el redirect a
// /login sin explicación. Ver `ROLES_INVITABLES` en lib/usuarios.
const ALLOWED_ROLES = ["MANAGER"] as const;

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
  } catch (e) {
    // OBSERVABILIDAD. Este catch venía sin binding: se tragaba el error entero y
    // un 500 acá no dejaba NADA en los runtime logs, así que no había forma de
    // saber si el envío murió por configuración, por la API key o por el payload.
    // No cambia el comportamiento del response — solo deja rastro.
    console.error("[users/invite] falló el envío de la invitación", {
      email: normalizedEmail,
      invitationId: invitation.id,
      // `cause` trae la respuesta de error de Resend cuando la llamada llegó a
      // completarse: { name, message, statusCode }. Si viene `undefined`, ni
      // siquiera hubo respuesta (config ausente, red, DNS) y el error de abajo
      // es el que lo explica.
      resend: (e as { cause?: unknown }).cause,
      error: e,
      // Discriminan las hipótesis sin exponer secretos: presencia (no valor) de
      // la config de correo, y el origin del que se armó el enlace.
      tieneResendApiKey: Boolean(process.env.RESEND_API_KEY),
      emailFrom: process.env.EMAIL_FROM ?? null,
      origin,
      // OJO: nunca loguear `link` ni `token` — el enlace es la credencial que
      // da acceso al panel, y los runtime logs no son un lugar para eso.
    });
    // Don't leave a live, un-retryable invite behind if the email never went out
    await prisma.invitation.delete({ where: { id: invitation.id } });
    return NextResponse.json({ error: "No se pudo enviar la invitación" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
