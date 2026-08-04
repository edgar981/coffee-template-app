"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff } from "lucide-react";
import { siteConfig } from "@/lib/config/site";

// ─── Puerta del PRODUCTO DUNA ────────────────────────────────────────────────
// El admin es producto Duna; el storefront es la marca del cliente. Esta
// pantalla es la puerta del producto, así que la marca primaria es Duna y la
// tienda aparece como una línea secundaria — leída de `siteConfig`, nunca
// escrita a mano: el día que el template sirva a otro cliente, esta pantalla ya
// es multitenant sin tocarla.

const INPUT =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm " +
  "transition-colors placeholder:text-muted-foreground/60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Error INLINE, no toast: en pre-auth el toast aparece lejos del formulario y
  // se va solo, justo cuando el operador está mirando los campos para corregir.
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      {/* Profundidad sutil: un solo tinte radial del primario a muy baja opacidad,
          para que el fondo no sea un plano muerto. Sale de tokens, así que se
          adapta a claro y oscuro, y se queda MUY por debajo de la card — el
          contraste de la página lo sigue haciendo la card, no el fondo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_32rem_at_50%_0%,hsl(var(--primary)/0.07),transparent_70%)]"
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <div className="mb-9 flex flex-col items-center text-center">
          {/* Logo de Duna. Dos archivos, uno por fondo: el negativo (claro) va
              sobre oscuro y el normal sobre claro. Se conmuta con `dark:` y no
              con JS para que no haya un parpadeo del logo equivocado antes de
              hidratar. Los assets de public/ son inmutables: se usan los que
              ya existen, no se sobrescribe ninguno. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/duna-logo-horizontal-v1.svg"
            alt="Duna"
            className="h-7 w-auto object-contain dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/duna-logo-horizontal-negative-v1.svg"
            alt="Duna"
            className="hidden h-7 w-auto object-contain dark:block"
          />

          {/* El logo respira: el título arranca bien abajo, no pegado. */}
          <h1 className="mt-8 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            Acceso al Panel
          </h1>
          {/* La tienda es CONTEXTO, no la marca de esta pantalla: muted, chica y
              debajo. Sale de config — cero nombre de cliente escrito acá. */}
          <p className="mt-1.5 text-sm text-muted-foreground">
            Panel de {siteConfig.brand.nombre}
          </p>
        </div>

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
              className={INPUT}
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
                className={`${INPUT} pr-10`}
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

          {/* Error del sistema: destructive en TINTE, nunca relleno sólido.
              `role="alert"` para que el lector de pantalla lo anuncie al fallar. */}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
