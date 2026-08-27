"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff } from "lucide-react";
import {
  PreAuthShell, PREAUTH_INPUT, PREAUTH_BOTON, AvisoError,
} from "@/components/admin/PreAuthShell";

// Por qué el gate rebota a /login. Autenticó bien, pero no puede entrar al panel:
// la copia lo DICE, en vez de un rebote mudo que se lee como un bug.
function mensajeMotivo(motivo: string | null): string | null {
  if (motivo === "sin_acceso") return "Iniciaste sesión, pero tu cuenta no tiene acceso al panel. Contacta al administrador del negocio.";
  if (motivo === "inactivo")   return "Tu cuenta está desactivada. Contacta al administrador del negocio.";
  return null;
}

// La lógica del login vive acá (cliente); el `page.tsx` es un shell SERVER que lee
// el nombre del negocio de SiteSetting y lo pasa. Todo lo interactivo —estados,
// submit, redirect al panel— se conserva sin cambio respecto de la versión previa.
export default function LoginForm({ nombre }: { nombre: string }) {
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Aviso del gate (rol insuficiente / cuenta desactivada), del `?motivo=` con el
  // que rebotó. Se limpia al reintentar: si vuelve a rebotar, el gate re-agrega el
  // motivo a la URL y el aviso reaparece —no queda uno rancio mientras se teclea—.
  const [avisoAcceso, setAvisoAcceso] = useState<string | null>(() => mensajeMotivo(searchParams.get("motivo")));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAvisoAcceso(null);
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/admin/dashboard",
    });

    if (authError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    // En éxito NO se baja `loading`: viene la navegación al panel y el botón
    // debe seguir bloqueado hasta que la página se vaya.
  };

  return (
    <PreAuthShell titulo="Acceso al Panel" nombre={nombre}>
      <form onSubmit={handleLogin} className="space-y-5" noValidate>
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
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-foreground">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              aria-invalid={!!error}
              className={`${PREAUTH_INPUT} pr-10`}
            />
            {/* `tabIndex={-1}` a propósito: Tab va de contraseña al botón de
                entrar, no a un control de solo visualización. Sigue siendo
                alcanzable con el mouse y anunciado por su aria-label. */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* El error del intento actual manda; si no hay, el aviso del gate (rol/
            desactivada) con el que se llegó. `avisoAcceso` se limpia al reintentar,
            así que nunca compiten. */}
        {(error || avisoAcceso) && <AvisoError>{error ?? avisoAcceso}</AvisoError>}

        <button type="submit" disabled={loading} className={PREAUTH_BOTON}>
          {loading ? "Ingresando…" : "Iniciar sesión"}
        </button>

        {/* La ÚNICA otra puerta cuando no se puede entrar. Apunta a un flujo REAL
            (/recuperar-clave), construido en esta tanda — no a un enlace muerto. */}
        <Link
          href="/recuperar-clave"
          className="block text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </PreAuthShell>
  );
}
