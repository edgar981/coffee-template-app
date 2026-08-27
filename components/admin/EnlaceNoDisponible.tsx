import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { PreAuthShell, PREAUTH_BOTON } from "@/components/admin/PreAuthShell";

// ─── Terminal de ENLACE NO DISPONIBLE (pre-auth) ─────────────────────────────
//
// Cuando un token de un solo uso está vencido, usado o es inválido, el formulario
// deja de tener sentido: no hay contraseña que arregle un token muerto. En vez de
// dejar a la persona reintentando contra un campo que nunca va a pasar, se muestra
// un final con marca.
//
// Compartida por las DOS puertas que reciben un token: aceptar-invitación y
// recuperar-clave. Lo único que cambia por caso es el `titulo`, el `mensaje` (qué
// pasó) y la `ayuda` (cómo conseguir uno nuevo); la forma —ícono, copy, botón a
// /login— es la misma, así que vive una sola vez.
export function EnlaceNoDisponible({ titulo, nombre, mensaje, ayuda }: {
  titulo: string;
  /** Nombre del negocio para la línea de contexto del shell. */
  nombre: string;
  /** Qué pasó (lo dice el servidor o la ausencia de token). */
  mensaje: string;
  /** Cómo conseguir un enlace nuevo — distinto por puerta. */
  ayuda: string;
}) {
  return (
    <PreAuthShell titulo={titulo} nombre={nombre}>
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <LinkIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{mensaje}</p>
        <p className="text-xs text-muted-foreground/80">{ayuda}</p>
        <Link href="/login" className={`${PREAUTH_BOTON} block text-center`}>
          Ir al inicio de sesión
        </Link>
      </div>
    </PreAuthShell>
  );
}
