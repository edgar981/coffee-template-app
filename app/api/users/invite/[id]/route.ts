import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { sendInvitationEmail } from "@/lib/email";
import {
  cancelarInvitacion, invitacionParaRenovar, confirmarRenovacion, INVITE_EXPIRY_MS,
} from "@/lib/invitations";

async function requireOwner() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as { role?: string }).role !== "OWNER") {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return {};
}

// Cancelar una invitación pendiente. Sólo OWNER — el mismo gate que invitar y
// listar. Borra la fila SIN ACEPTAR; la cancelación es lo que libera una
// dirección bloqueada por un correo mal tecleado (§ lib/invitations).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireOwner();
  if (error) return error;

  const { id } = await params;
  const cancelada = await cancelarInvitacion(id);

  if (!cancelada) {
    // 404, no 500: no había una pendiente con ese id. O ya se aceptó (y entonces
    // el usuario existe y no hay invitación que anular), o ya se canceló. La frase
    // lo dice sin afirmar cuál de los dos.
    return NextResponse.json(
      { error: "Esa invitación ya no está pendiente: se aceptó o ya se canceló." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}

// Reenviar: RENUEVA una invitación pendiente (token nuevo, 48 h más desde ahora) y manda el
// correo de nuevo — el `POST /api/users/invite` rechaza invitar otra vez mientras haya una viva
// (§ el gate de `existingInvite`), así que ésta es la única salida para un correo que no llegó o
// se perdió. Sólo OWNER, mismo gate que crear/cancelar/listar.
//
// EL ORDEN —mandar primero, persistir después— está explicado en `lib/invitations.ts`
// (§ `invitacionParaRenovar`/`confirmarRenovacion`): es lo que evita dejar una invitación viva
// cuyo único token válido nadie recibió.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireOwner();
  if (error) return error;

  const { id } = await params;
  const pendiente = await invitacionParaRenovar(id);
  if (!pendiente) {
    return NextResponse.json(
      { error: "Esa invitación ya no está pendiente: se aceptó o ya se canceló." },
      { status: 404 },
    );
  }

  const token     = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  const origin = process.env.BETTER_AUTH_URL || req.nextUrl.origin;
  const link = `${origin}/aceptar-invitacion?token=${token}`;

  try {
    await sendInvitationEmail({ to: pendiente.email, name: pendiente.name ?? pendiente.email, link });
  } catch (e) {
    // MISMA observabilidad que el POST de crear (§ `app/api/users/invite/route.ts`): el catch
    // deja rastro, nunca se traga el error. Acá no hay fila fresca que borrar — la invitación
    // YA EXISTÍA — así que el 500 se devuelve sin tocar la base: su token/vencimiento viejos
    // siguen intactos.
    console.error("[users/invite/:id] falló el reenvío de la invitación", {
      invitationId: id,
      email: pendiente.email,
      resend: (e as { cause?: unknown }).cause,
      error: e,
      tieneResendApiKey: Boolean(process.env.RESEND_API_KEY),
      emailFrom: process.env.EMAIL_FROM ?? null,
      origin,
    });
    return NextResponse.json({ error: "No se pudo reenviar la invitación" }, { status: 500 });
  }

  const renovada = await confirmarRenovacion(id, tokenHash, expiresAt);
  if (!renovada) {
    // Se aceptó o canceló MIENTRAS el correo viajaba (la ventana angosta documentada en
    // `lib/invitations.ts`): el correo salió con un link que ya no tiene con qué validar.
    return NextResponse.json(
      { error: "Esa invitación ya no está pendiente: se aceptó o ya se canceló." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
