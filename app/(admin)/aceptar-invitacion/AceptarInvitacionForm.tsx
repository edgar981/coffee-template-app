"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PreAuthShell } from "@/components/admin/PreAuthShell";
import { EnlaceNoDisponible } from "@/components/admin/EnlaceNoDisponible";
import { FormClaveNueva, ErrorTerminal } from "@/components/admin/FormClaveNueva";

// La lógica de aceptar-invitación vive acá (cliente); el `page.tsx` es un shell
// SERVER que lee el nombre del negocio de SiteSetting y lo pasa, con la frontera
// de Suspense (useSearchParams lo exige).
//
// El FORMULARIO de contraseña y la terminal de enlace-muerto son piezas
// COMPARTIDAS con recuperar-clave (`FormClaveNueva`, `EnlaceNoDisponible`): acá
// sólo vive lo propio de la invitación —comprobar el token al abrir, el canje, el
// redirect a /login—.
export default function AceptarInvitacionForm({ nombre }: { nombre: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  // Enlace TERMINAL (vencido, usado, inválido o cuenta ya existente). Sin token en
  // la URL ya se sabe de entrada, sin ir al servidor.
  const [enlaceMuerto, setEnlaceMuerto] = useState<string | null>(
    token ? null : "Este enlace de invitación no es válido.",
  );
  // Con token hay que preguntarle al servidor: vencida, usada o inexistente no se
  // distinguen desde acá. Se comprueba AL ABRIR y no al enviar — antes el invitado
  // sólo se enteraba de que el enlace estaba muerto después de inventar una
  // contraseña, confirmarla y darle a Crear cuenta.
  const [comprobando, setComprobando] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    fetch(`/api/users/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (!vigente) return;
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setEnlaceMuerto(data?.error ?? "Este enlace de invitación no es válido.");
        }
      })
      // Un fallo de red NO es un enlace muerto: se deja pasar al formulario y que
      // el canje decida. Marcarlo como vencido sería mentir por una conexión
      // intermitente.
      .catch(() => {})
      .finally(() => { if (vigente) setComprobando(false); });
    return () => { vigente = false; };
  }, [token]);

  const canjear = async (password: string) => {
    let res: Response;
    try {
      res = await fetch("/api/users/accept-invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
    } catch {
      // Fallo de RED (no una respuesta del servidor): un mensaje propio, inline.
      throw new Error("No se pudo conectar. Verifica tu conexión.");
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // El servidor marca con `code: "enlace"` lo que es terminal (→ enlace muerto).
      if (data?.code === "enlace") throw new ErrorTerminal(data?.error ?? "Este enlace de invitación no es válido.");
      throw new Error(data?.error || "No se pudo completar el registro.");
    }

    // El toast SÍ va acá: aterriza en /login, que es otra pantalla — es el único
    // lugar donde un toast hace lo que debe (confirmar algo ya terminado).
    toast.success("Cuenta creada. Ahora puedes iniciar sesión.");
    router.push("/login");
  };

  // Mientras se comprueba no se muestra el formulario: aparecer y desaparecer sería
  // peor que esperar un instante.
  if (comprobando) {
    return (
      <PreAuthShell titulo="Crea tu contraseña" nombre={nombre}>
        <p className="py-4 text-center text-sm text-muted-foreground">Comprobando la invitación…</p>
      </PreAuthShell>
    );
  }

  if (enlaceMuerto) {
    return (
      <EnlaceNoDisponible
        titulo="Invitación no disponible"
        nombre={nombre}
        mensaje={enlaceMuerto}
        ayuda="Pídele a quien te invitó que te envíe una invitación nueva."
      />
    );
  }

  return (
    <PreAuthShell titulo="Crea tu contraseña" nombre={nombre}>
      <FormClaveNueva
        onSubmit={canjear}
        onTerminal={setEnlaceMuerto}
        ctaLabel="Crear cuenta"
        ctaLoadingLabel="Creando cuenta…"
      />
    </PreAuthShell>
  );
}
