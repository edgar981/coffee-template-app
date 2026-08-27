"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { PreAuthShell, PREAUTH_INPUT, PREAUTH_BOTON, AvisoError } from "@/components/admin/PreAuthShell";

// Pedir el enlace de recuperación. La lógica vive acá (cliente); el `page.tsx` es
// un shell SERVER que lee el nombre del negocio.
//
// RESPUESTA UNIFORME: NO se distingue si el correo existe. Better Auth ya devuelve
// lo mismo en ambos casos (simula el token para el inexistente), y acá no se agrega
// ningún chequeo cliente que pudiera revelar qué correos tienen cuenta. Pase lo que
// pase con el envío, se muestra "revisa tu bandeja". Lo ÚNICO que se distingue es un
// fallo de RED (la petición no llegó al servidor) — que no revela nada del correo.
export default function RecuperarClaveForm({ nombre }: { nombre: string }) {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email) return;
    setError(null);
    setLoading(true);
    try {
      // El callbackURL al que Better Auth redirige TRAS validar el token. El correo
      // lleva `/api/auth/reset-password/<token>?callbackURL=/recuperar-clave/nueva`;
      // BA valida y redirige a `/recuperar-clave/nueva?token=` (válido) o `?error=`.
      await authClient.requestPasswordReset({ email, redirectTo: "/recuperar-clave/nueva" });
      setEnviado(true);
    } catch {
      // Fallo de RED, no una respuesta del servidor: decirlo honestamente en vez de
      // afirmar "revisa tu bandeja" sobre algo que no se envió.
      setError("No se pudo conectar. Verifica tu conexión e inténtalo de nuevo.");
      setLoading(false);
    }
  };

  if (enviado) {
    return (
      <PreAuthShell titulo="Revisa tu bandeja" nombre={nombre}>
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Si <span className="font-medium text-foreground">{email}</span> tiene una cuenta,
            te enviamos un enlace para crear una contraseña nueva. Vence en 1 hora.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Revisa también la carpeta de spam.
          </p>
          <Link href="/login" className={`${PREAUTH_BOTON} block text-center`}>
            Volver al inicio de sesión
          </Link>
        </div>
      </PreAuthShell>
    );
  }

  return (
    <PreAuthShell titulo="Recuperar contraseña" nombre={nombre}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-foreground">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            aria-invalid={!!error}
            className={PREAUTH_INPUT}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Te enviaremos un enlace para crear una contraseña nueva.
          </p>
        </div>

        {error && <AvisoError>{error}</AvisoError>}

        <button type="submit" disabled={loading || !email} className={PREAUTH_BOTON}>
          {loading ? "Enviando…" : "Enviar enlace"}
        </button>

        <Link
          href="/login"
          className="block text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Volver al inicio de sesión
        </Link>
      </form>
    </PreAuthShell>
  );
}
