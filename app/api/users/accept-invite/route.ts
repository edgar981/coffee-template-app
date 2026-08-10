import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@duna/core";
import { createHash } from "crypto";

const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga",
  INVALID_PASSWORD: "Contraseña inválida",
};

// Rechazo TERMINAL del enlace: no sirve y no hay contraseña que lo arregle.
// `code: "enlace"` es lo que le permite a la UI decidir si deja el formulario
// (corrige un campo) o lo reemplaza por el final con marca (pide otra
// invitación). Sin esa marca ambos casos son el mismo 400 y solo se
// distinguirían comparando strings de mensaje.
type RechazoEnlace = { error: string; code: "enlace" };

const rechazo = (error: string) =>
  ({ ok: false as const, rechazo: { error, code: "enlace" } satisfies RechazoEnlace });

/**
 * Estado del enlace de invitación. COMPARTIDO por el GET (pre-chequeo al abrir
 * la pantalla) y el POST (canje), para que no puedan divergir: si el pre-chequeo
 * dijera "sirve" y el canje "expiró", el invitado llenaría el formulario para
 * nada — que es exactamente lo que este helper evita.
 *
 * El token viaja en claro en el enlace; en la base solo vive su SHA-256, así que
 * la búsqueda hashea lo recibido. Ojo: un `tokenHash` copiado de la base NO
 * sirve como token — se volvería a hashear y no encontraría nada.
 */
async function evaluarInvitacion(token: unknown) {
  if (typeof token !== "string" || !token) {
    return rechazo("Este enlace de invitación no es válido.");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });

  if (!invitation) return rechazo("Este enlace de invitación no es válido.");
  if (invitation.usedAt) return rechazo("Esta invitación ya fue utilizada.");
  if (invitation.expiresAt < new Date()) {
    return rechazo("Esta invitación expiró. Las invitaciones vencen a las 48 horas.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) return rechazo("Ya existe una cuenta con este correo.");

  return { ok: true as const, invitation };
}

/**
 * PRE-CHEQUEO del enlace, sin canjearlo. Existe para que una invitación muerta
 * se vea muerta AL ABRIR: antes la pantalla mostraba el formulario y el invitado
 * solo se enteraba después de inventar una contraseña y enviarla.
 *
 * No devuelve NADA de la invitación —ni correo ni nombre—, solo si es usable.
 * Quien tiene el token ya podría intentar el canje, así que esto no expone nada
 * que el POST no expusiera igual.
 */
export async function GET(req: NextRequest) {
  const estado = await evaluarInvitacion(req.nextUrl.searchParams.get("token"));
  return estado.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json(estado.rechazo, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const estado = await evaluarInvitacion(token);
  if (!estado.ok) return NextResponse.json(estado.rechazo, { status: 400 });
  const { invitation } = estado;

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
    const conocido = code ? PASSWORD_ERROR_MESSAGES[code] : undefined;
    // Un código CONOCIDO es una contraseña que el usuario debe corregir: no se
    // loguea, es ruido. Uno desconocido no es validación — es un error real que
    // estaríamos aplanando a un 400 genérico, que es justo cómo se pierde una
    // tarde depurando (ver el 500 mudo de /api/users/invite).
    if (!conocido) {
      console.error("[users/accept-invite] signUpEmail falló con un error no mapeado", {
        email: invitation.email,
        invitationId: invitation.id,
        code: code ?? null,
        error: e,
      });
    }
    return NextResponse.json({ error: conocido || "No se pudo crear la cuenta" }, { status: 400 });
  }

  try {
    // role is stripped from signup input (input: false), so set it separately,
    // and mark the invite used in the same transaction as the role assignment
    await prisma.$transaction([
      prisma.user.update({ where: { id: createdUserId }, data: { role: invitation.role } }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } }),
    ]);
  } catch (e) {
    // MISMO patrón que tenía /api/users/invite: catch sin binding, compensación
    // y 500 genérico. Es el paso siguiente del mismo flujo, así que sin este log
    // el invitado ve "intenta de nuevo" para siempre y nosotros no vemos nada.
    console.error("[users/accept-invite] falló la asignación de rol / marcado de la invitación", {
      email: invitation.email,
      invitationId: invitation.id,
      createdUserId,
      rol: invitation.role,
      error: e,
    });
    // Roll back the user so the invite stays valid and can be retried, instead of
    // leaving a half-provisioned account (wrong role, invite never marked used)
    await prisma.user.deleteMany({ where: { id: createdUserId } });
    return NextResponse.json({ error: "No se pudo completar el registro. Intenta de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
