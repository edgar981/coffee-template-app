"use client";

// § COMPRA-FIDELIDAD-3 — el campo con RÓTULO FLOTANTE (`.scratch/checkout-rediseno/refero.md` §2,
// la maqueta interactiva `.scratch/checkout-rediseno/maqueta.html`). Es la MEJORA DE BASE del
// camino de compra: vale para las TRES claves de `content.compra.pasos` (`'comun'|'ficha'|
// 'tejido'`), también la común — lo que cambia por clave es sólo el TRATAMIENTO (forma de la caja,
// mayúsculas del rótulo), nunca la mecánica (cuándo flota, cuándo se valida, qué anuncia un lector
// de pantalla).
//
// LA VALIDACIÓN NO VIVE ACÁ. El llamador decide CUÁNDO mostrar un error (tocado || intento de
// enviar, § `app/(storefront)/checkout/page.tsx`, `errorVisible`) y pasa el mensaje ya resuelto —
// este componente sólo lo RENDERIZA. Es la misma división que ya regía `Field` (el componente que
// éste reemplaza): las reglas de validación de CLAUDE.md no cambian, sólo CUÁNDO y DÓNDE se ve el
// mensaje.
//
// REVALIDACIÓN EN CADA TECLA mientras hay error: es el LLAMADOR quien la logra, recalculando
// `error` en cada render a partir del estado ya tocado — este componente no lo sabe, sólo pinta lo
// que le llega.

import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import type { ClaveCompraPasos } from '@/lib/config/site-content-defaults';

export interface OpcionCampoFlotante {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CampoFlotanteProps {
  /** El `id` ESTABLE del campo — lo usa el llamador para enfocar/saltar al primer campo que falta
   *  (§ CHECKOUT-LISTO-PARA-VENDER-1) y `<label htmlFor>` para asociarlo. */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  /** `'select'` renderiza un `<select>` nativo (§ CLAUDE.md, "el select es NATIVO" — la lista
   *  desplegada la pinta el sistema, el rótulo flotante sólo gobierna la CAJA, no esa lista).
   *  `'textarea'` crece con el contenido y admite `contador` (§ refero.md §2, "Notas"). */
  tipo?: 'text' | 'email' | 'tel' | 'select' | 'textarea';
  /** Opciones del `<select>` — ignorado fuera de `tipo:'select'`. La primera entrada vacía
   *  (`value:''`) es la que mantiene el rótulo en reposo hasta elegir (§ refero.md §2,
   *  "Departamento"). */
  opciones?: OpcionCampoFlotante[];
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal' | 'search' | 'url' | 'none';
  /** El prefijo fijo DENTRO del campo (§ refero.md §2, "WhatsApp: el prefijo «+57» va fijo dentro
   *  del campo"). Sólo tiene efecto con `tipo:'tel'`. */
  prefijo?: string;
  /** `(opcional)` en el rótulo, sin asterisco — regla del repo para campos no requeridos. */
  opcional?: boolean;
  /** El mensaje de error YA DECIDIDO por el llamador (`errorVisible`). `undefined` = sin error o
   *  todavía no toca mostrarlo. */
  error?: string;
  /** El ✓ de 16px que refero.md §2 reserva a correo y WhatsApp tras validar — el llamador decide
   *  cuándo el valor ya es válido; este componente sólo lo pinta. */
  valido?: boolean;
  /** El texto de ayuda que comparte el espacio con el error (§ refero.md §2) — se oculta mientras
   *  el error está a la vista, nunca los dos a la vez. */
  ayuda?: string;
  /** La CLAVE de `content.compra.pasos`, ya clampada (`composicionPasos`). Decide el tratamiento:
   *  `'comun'` = caja neutra de hoy; `'ficha'` = subrayado sin caja, versal (Onix); `'tejido'` =
   *  papel con borde punteado que se vuelve sólido en foco (Las Chamisas). */
  linea: ClaveCompraPasos;
  disabled?: boolean;
  requerido?: boolean;
  /** Sólo `tipo:'textarea'` — el contador "0/N" de refero.md §2. */
  maxLength?: number;
  className?: string;
}

/** `true` si el valor NO está vacío — el único criterio para que el rótulo flote por valor (el
 *  foco también lo hace flotar, momentáneamente, aunque esté vacío). */
function tieneValor(v: string): boolean {
  return v.trim() !== '';
}

export default function CampoFlotante({
  id, label, value, onChange, onBlur, onFocus, tipo = 'text', opciones, autoComplete, inputMode,
  prefijo, opcional, error, valido, ayuda, linea, disabled, requerido = !opcional, maxLength, className,
}: CampoFlotanteProps) {
  const [foco, setFoco] = useState(false);
  const arriba = foco || tieneValor(value);
  const errorId = `${id}-error`;
  const ayudaId = `${id}-ayuda`;
  const describedBy = [ayuda ? ayudaId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const reactId = useId();
  const contadorId = `${id}-contador-${reactId}`;

  const esFicha = linea === 'ficha';
  const esTejido = linea === 'tejido';
  const muestraOk = !!valido && !error && tieneValor(value);

  // LA CAJA — tres tratamientos, una sola mecánica. `comun` y `tejido` son cajas; `ficha` es un
  // subrayado sin caja (§ refero.md "Cómo cambia en Onix": "El campo es solo un subrayado, sin
  // caja y con esquinas rectas").
  // § COMPRA-FIDELIDAD-4 — `--chk-tinta-suave`/`--chk-error` las define UNA vez el checkout en la
  // raíz de su árbol (`app/(storefront)/checkout/page.tsx`, el único consumidor de este
  // componente) y acá se CONSUMEN por nombre, heredadas por cascada de CSS — no redefinidas. Ver
  // el comentario de cabecera de esa página para el porqué de las dos (ninguna puede derivarse de
  // `--sf-texto-suave`/un literal Tailwind sin reproducir el defecto que esta tanda cierra).
  const cajaClases = esFicha
    ? `bg-transparent rounded-none border-0 border-b px-0 ${error ? 'border-b-2 border-[var(--chk-error)]' : foco ? 'border-b-2 border-[var(--sf-tinta)]' : 'border-b border-[var(--sf-linea)]'}`
    : esTejido
      ? `rounded-xl px-4 bg-[var(--sf-superficie)] ${error ? 'border-2 border-[var(--chk-error)]' : foco ? 'border-2 border-[var(--sf-tinta)]' : tieneValor(value) ? 'border-2 border-[var(--sf-linea)]' : 'border-2 border-dashed border-[var(--sf-linea)]'}`
      : `rounded-xl px-4 bg-[var(--sf-fondo)] border ${error ? 'border-[var(--chk-error)]' : foco ? 'border-[var(--sf-tinta)] ring-2 ring-[var(--sf-tinta)]/20' : 'border-[var(--sf-linea)]'}`;

  const alturaClase = tipo === 'textarea' ? 'min-h-24' : 'h-14';
  const prefijoActivo = !!prefijo && tipo === 'tel';
  const padLeft = prefijoActivo ? (esFicha ? 'pl-9' : 'pl-11') : '';
  const padTop = tipo === 'textarea' ? (esFicha ? 'pt-5' : 'pt-6') : (esFicha ? 'pt-4 pb-1' : (arriba ? 'pt-6 pb-1.5' : ''));

  const inputClases = `peer w-full ${alturaClase} ${padTop} ${padLeft} outline-none text-base text-[var(--sf-tinta)] disabled:opacity-55 disabled:cursor-not-allowed ${esFicha ? 'bg-transparent' : ''} ${className ?? ''}`;

  // EL RÓTULO — reposo centrado vs flotando arriba-izquierda, con la MISMA transición en los tres
  // tratamientos (transform/color, nunca font-size — § refero.md §2). `ficha` va en versal con
  // tracking; los otros dos en caja normal.
  const labelBase = `absolute pointer-events-none origin-left transition-[top,transform,color] duration-150 ease-out select-none`;
  const labelPosicion = arriba
    ? (esFicha ? 'top-1' : 'top-2') + ' scale-[0.72]'
    : (esFicha ? 'top-1/2 -translate-y-1/2 scale-100' : 'top-1/2 -translate-y-1/2 scale-100');
  const labelColor = error ? 'text-[var(--chk-error)]' : foco ? 'text-[var(--sf-tinta)]' : 'text-[var(--chk-tinta-suave)]';
  const labelLeft = esFicha ? 'left-0' : (prefijoActivo && !arriba ? 'left-11' : 'left-4');
  const labelTipografia = esFicha ? 'uppercase tracking-[0.12em] text-sm' : 'text-base';

  const contenidoAyudaOError = error ? (
    <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--chk-error)]">
      <span aria-hidden="true" className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--chk-error)] text-[9px] font-bold leading-none text-white">!</span>
      <span>{error}</span>
    </p>
  ) : ayuda ? (
    <p id={ayudaId} className="mt-1.5 text-xs text-[var(--chk-tinta-suave)]">{ayuda}</p>
  ) : null;

  const manejarFoco = () => { setFoco(true); onFocus?.(); };
  const manejarBlur = () => { setFoco(false); onBlur?.(); };

  return (
    <div className="w-full">
      <div className={`relative ${cajaClases}`}>
        {prefijoActivo && (
          // `top-1/2` centra el prefijo en TODA la caja — correcto en reposo (sin rótulo flotado,
          // nada más a la vista), pero con la caja LLENA (comun/tejido) el rótulo ya ocupa la
          // franja superior y el centro vertical queda demasiado cerca: las dos cadenas se tocan
          // (medido en la primera captura del arnés, "Celular / WhatsApp" + "+57"). `ficha` no lo
          // sufre —el rótulo flotado va en `top-1`, lejos del centro de un subrayado alto—, así
          // que sólo las otras dos bajan el prefijo a la altura del VALOR cuando flota.
          <span
            aria-hidden="true"
            className={`absolute text-base text-[var(--sf-texto-suave)] transition-opacity duration-150 ${arriba ? 'opacity-100' : 'opacity-0'} ${esFicha ? 'left-0 top-1/2 -translate-y-1/2' : `left-4 ${arriba ? 'bottom-2' : 'top-1/2 -translate-y-1/2'}`}`}
          >
            {prefijo}
          </span>
        )}
        <label htmlFor={id} className={`${labelBase} ${labelPosicion} ${labelColor} ${labelLeft} ${labelTipografia}`}>
          {label}{opcional && <em className="ml-1 font-normal not-italic opacity-70">(opcional)</em>}
        </label>
        {tipo === 'select' ? (
          <select
            id={id} name={id} value={value} disabled={disabled} required={requerido}
            onChange={(e) => onChange(e.target.value)}
            onFocus={manejarFoco} onBlur={manejarBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            autoComplete={autoComplete}
            className={`${inputClases} appearance-none`}
          >
            {opciones?.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
          </select>
        ) : tipo === 'textarea' ? (
          <textarea
            id={id} name={id} value={value} disabled={disabled} required={requerido}
            onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
            onFocus={manejarFoco} onBlur={manejarBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={maxLength ? `${describedBy ?? ''} ${contadorId}`.trim() : describedBy}
            autoComplete={autoComplete}
            className={`${inputClases} resize-none`}
          />
        ) : (
          <input
            id={id} name={id} type={tipo} value={value} disabled={disabled} required={requerido}
            onChange={(e) => onChange(e.target.value)}
            onFocus={manejarFoco} onBlur={manejarBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            autoComplete={autoComplete} inputMode={inputMode}
            className={inputClases}
          />
        )}
        {!esFicha && tipo === 'select' && (
          <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rotate-45 border-b-[1.5px] border-r-[1.5px] border-[var(--sf-texto-suave)]" />
        )}
        {muestraOk && (
          <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white ${esFicha ? 'right-0' : tipo === 'select' ? 'right-9' : 'right-4'}`}>
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        {contenidoAyudaOError}
        {tipo === 'textarea' && typeof maxLength === 'number' && (
          <p id={contadorId} className="mt-1.5 shrink-0 text-xs text-[var(--sf-texto-suave)]" aria-hidden="true">
            {value.length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
