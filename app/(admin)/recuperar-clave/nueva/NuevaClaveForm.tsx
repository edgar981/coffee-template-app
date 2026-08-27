"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { PreAuthShell } from "@/components/admin/PreAuthShell";
import { EnlaceNoDisponible } from "@/components/admin/EnlaceNoDisponible";
import { FormClaveNueva, ErrorTerminal } from "@/components/admin/FormClaveNueva";

// Poner la contraseña nueva. Reusa el form y la terminal compartidos; acá sólo vive
// lo propio del reset: leer el token del query, resetear, y el mensaje de éxito.
//
// EL TOKEN LLEGA POR `?token=` (query), no por segmento: Better Auth valida el token
// en su callback `/api/auth/reset-password/<token>` y REDIRIGE acá con `?token=`
// (válido) o `?error=INVALID_TOKEN` (vencido/usado/inválido). Por eso NO hay un
// `[token]` de path — la pantalla lee el query. (§ verificado en vivo: el endpoint
// da 302 a `/recuperar-clave/nueva?error=…`.)
export default function NuevaClaveForm({ nombre }: { nombre: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const errorParam = params.get("error");

  // Punto 1: si Better Auth ya marcó el token como inválido/vencido (`?error=`), NO
  // se intenta usar — se muestra la terminal directo. Sin token, lo mismo.
  const [terminal, setTerminal] = useState<string | null>(
    errorParam || !token
      ? "Este enlace de recuperación no es válido, ya se usó o venció."
      : null,
  );

  const resetear = async (password: string) => {
    let out;
    try {
      out = await authClient.resetPassword({ newPassword: password, token });
    } catch {
      throw new Error("No se pudo conectar. Verifica tu conexión.");
    }
    if (out.error) {
      // El token pudo vencer entre abrir la pantalla y enviar (ventana de 1 h): eso
      // es terminal (→ enlace muerto), no un error que reintentar en el mismo campo.
      if (out.error.code === "INVALID_TOKEN") {
        throw new ErrorTerminal("Este enlace de recuperación ya se usó o venció.");
      }
      throw new Error(out.error.message || "No se pudo cambiar la contraseña.");
    }

    // Punto 3: el mensaje dice que la contraseña CAMBIÓ, no un "listo" mudo. Aterriza
    // en /login (otra pantalla), que es donde un toast confirma algo ya terminado.
    // Todas las demás sesiones ya murieron (revokeSessionsOnPasswordReset).
    toast.success("Tu contraseña se cambió. Inicia sesión con la nueva.");
    router.push("/login");
  };

  if (terminal) {
    return (
      <EnlaceNoDisponible
        titulo="Enlace no disponible"
        nombre={nombre}
        mensaje={terminal}
        ayuda="Solicita uno nuevo desde “¿Olvidaste tu contraseña?” en el inicio de sesión."
      />
    );
  }

  return (
    <PreAuthShell titulo="Crea una contraseña nueva" nombre={nombre}>
      <FormClaveNueva
        onSubmit={resetear}
        onTerminal={setTerminal}
        ctaLabel="Cambiar contraseña"
        ctaLoadingLabel="Cambiando…"
      />
    </PreAuthShell>
  );
}
