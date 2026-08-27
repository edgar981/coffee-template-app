"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PREAUTH_INPUT, PREAUTH_BOTON, AvisoError } from "@/components/admin/PreAuthShell";

// ─── Form de CONTRASEÑA NUEVA (pre-auth) ─────────────────────────────────────
//
// Las dos puertas que terminan en "elige una contraseña" —aceptar-invitación y
// recuperar-clave— tienen el MISMO formulario: contraseña + confirmación, con
// validación en vivo, el ojo que alterna ambas, y el mínimo de Better Auth. Sólo
// cambia QUÉ hace el submit (canjear el invite vs resetear) y las etiquetas del
// botón. Por eso el form vive una vez y el consumidor pasa su `onSubmit`.
//
// El `onSubmit` LANZA en error. Un error normal se muestra inline; un
// `ErrorTerminal` (el enlace se murió: invitación con `code:"enlace"`, o token
// vencido/usado al resetear) escala a la terminal de enlace-muerto vía `onTerminal`
// —no tiene sentido dejar reintentar contra un token que ya no sirve—.

/** Mismo mínimo que exige Better Auth al registrar. */
export const MIN_PASSWORD = 8;

/** Error cuyo tratamiento NO es inline: el enlace está muerto y la pantalla debe
 *  cambiar a la terminal de "enlace no disponible". */
export class ErrorTerminal extends Error {}

export function FormClaveNueva({ onSubmit, onTerminal, ctaLabel, ctaLoadingLabel }: {
  /** Qué hace el submit con la contraseña. Lanza en error; en éxito navega (no
   *  retorna a este form, así que el `loading` queda puesto hasta que la página se
   *  va). `ErrorTerminal` → `onTerminal`; cualquier otro Error → aviso inline. */
  onSubmit: (password: string) => Promise<void>;
  /** El enlace se murió: la pantalla cambia a la terminal con este mensaje. */
  onTerminal: (mensaje: string) => void;
  ctaLabel: string;
  ctaLoadingLabel: string;
}) {
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [showPassword, setShowPassword]       = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  // Validación EN VIVO, antes del submit: se entera al escribir y no al chocar
  // contra el botón. Sólo se reclama cuando ya hay algo que comparar.
  const noCoinciden = confirmPassword.length > 0 && password !== confirmPassword;
  const muyCorta    = password.length > 0 && password.length < MIN_PASSWORD;
  const listo       = password.length >= MIN_PASSWORD && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !listo) return;

    setError(null);
    setLoading(true);
    try {
      await onSubmit(password);
      // Éxito: `onSubmit` navega. NO se baja `loading` — la navegación viene y el
      // botón debe seguir bloqueado hasta que la página se vaya.
    } catch (err) {
      if (err instanceof ErrorTerminal) { onTerminal(err.message); return; }
      setError(err instanceof Error ? err.message : "No se pudo completar.");
      setLoading(false);
    }
  };

  return (
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
          {/* `tabIndex={-1}`: Tab va de un campo al siguiente, no a un control de
              solo visualización. Rige las DOS contraseñas: un solo ojo alterna
              ambas, así que no pueden quedar en estados distintos. */}
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
        {loading ? ctaLoadingLabel : ctaLabel}
      </button>
    </form>
  );
}
