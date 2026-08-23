import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cancelarInvitacion } from "@/lib/invitations";

// Cancelar una invitación pendiente. Sólo OWNER — el mismo gate que invitar y
// listar. Borra la fila SIN ACEPTAR; la cancelación es lo que libera una
// dirección bloqueada por un correo mal tecleado (§ lib/invitations).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || (session.user as { role?: string }).role !== "OWNER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

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
