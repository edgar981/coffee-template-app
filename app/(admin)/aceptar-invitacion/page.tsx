"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, LinkIcon } from "lucide-react";
import {
  PreAuthShell, PREAUTH_INPUT, PREAUTH_BOTON, AvisoError,
} from "@/components/admin/PreAuthShell";

/** Mismo mínimo que exige Better Auth al registrar. */
const MIN_PASSWORD = 8;

function AceptarInvitacionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [showPassword, setShowPassword]       = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  // Enlace TERMINAL (vencido, usado, inválido o cuenta ya existente). Cuando se
  // sabe, el formulario deja de tener sentido: no hay contraseña que arregle un
  // token muerto, así que se reemplaza por un final con marca en vez de dejar
  // al invitado reintentando contra un campo que nunca va a pasar.
  const [enlaceMuerto, setEnlaceMuerto] = useState<string | null>(
    // Sin token en la URL ya se sabe de entrada, sin ir al servidor.
    token ? null : "Este enlace de invitación no es válido.",
  );

  // Validación EN VIVO, antes del submit: el invitado se entera al escribir y no
  // al chocar contra el botón. Solo se reclama cuando ya hay algo que comparar.
  const noCoinciden = confirmPassword.length > 0 && password !== confirmPassword;
  const muyCorta    = password.length > 0 && password.length < MIN_PASSWORD;
  const listo       = password.length >= MIN_PASSWORD && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !listo) return;

    setError(null);
    setLoading(true);

    try {
      const res  = await fetch("/api/users/accept-invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // El servidor marca con `code: "enlace"` lo que es terminal.
        if (data?.code === "enlace") setEnlaceMuerto(data.error);
        else setError(data?.error || "No se pudo completar el registro.");
        setLoading(false);
        return;
      }
    } catch {
      setError("No se pudo conectar. Verifica tu conexión.");
      setLoading(false);
      return;
    }

    // El toast SÍ va acá: aterriza en /login, que es otra pantalla — es el único
    // lugar donde un toast hace lo que debe (confirmar algo ya terminado).
    toast.success("Cuenta creada. Ahora puedes iniciar sesión.");
    router.push("/login");
  };

  if (enlaceMuerto) {
    return (
      <PreAuthShell titulo="Invitación no disponible">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{enlaceMuerto}</p>
          <p className="text-xs text-muted-foreground/80">
            Pídele a quien te invitó que te envíe una invitación nueva.
          </p>
          <Link href="/login" className={`${PREAUTH_BOTON} block text-center`}>
            Ir al inicio de sesión
          </Link>
        </div>
      </PreAuthShell>
    );
  }

  return (
    <PreAuthShell titulo="Crea tu contraseña">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-foreground">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              aria-invalid={muyCorta}
              aria-describedby="pw-ayuda"
              className={`${PREAUTH_INPUT} pr-10`}
            />
            {/* `tabIndex={-1}`: Tab va de un campo al siguiente, no a un control
                de solo visualización. Rige las DOS contraseñas: un solo ojo
                alterna ambas, así que no pueden quedar en estados distintos. */}
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
          <p
            id="pw-ayuda"
            className={`mt-1.5 text-xs ${muyCorta ? "text-destructive" : "text-muted-foreground"}`}
          >
            Mínimo {MIN_PASSWORD} caracteres.
          </p>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-foreground">
            Confirmar contraseña
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            aria-invalid={noCoinciden}
            className={PREAUTH_INPUT}
          />
          {noCoinciden && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              Las contraseñas no coinciden.
            </p>
          )}
        </div>

        {error && <AvisoError>{error}</AvisoError>}

        <button type="submit" disabled={loading || !listo} className={PREAUTH_BOTON}>
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </PreAuthShell>
  );
}

// useSearchParams() requires a Suspense boundary to prerender (Next.js CSR
// bailout). The form reads the invite ?token=, so it lives inside the boundary.
export default function AceptarInvitacionPage() {
  return (
    <Suspense fallback={null}>
      <AceptarInvitacionForm />
    </Suspense>
  );
}
