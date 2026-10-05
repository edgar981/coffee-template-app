'use client';

import { useId } from 'react';

// § EDITOR-PANEL-PIEL-1 — LA MUESTRA DE COLOR GRANDE (el spec: "la parte que debería mostrar el
// color del badge está muy pequeño, apenas se nota"). Reemplaza los tres `<input type="color">`
// sueltos del editor —color del badge (EncabezadoSeccion.tsx), acento (PaletaSeccion.tsx), color de
// elemento (EstiloElementoControles.tsx)—, todos a 28-34px sin más que el propio input nativo.
//
// EL PATRÓN DE LA MUESTRA («a sangre», `<label>` con la muestra + el `<input type="color">`
// INVISIBLE encima) ya existe en la barra flotante del storefront
// (`components/storefront/EditorPuenteVivo.tsx`, el picker de «Personalizado» dentro de
// «Avanzado») — SE COPIÓ el patrón, ese archivo no se tocó (no está en `touches:` de este slice;
// además es HTML con estilos LITERALES porque vive en el documento del storefront, no puede traer
// clases del design-system del panel).
//
// LA ESTRUCTURA —sugerencias con nombre llano primero, «Por defecto» siempre, el color libre
// («Personalizado») DENTRO de «Avanzado»— es la misma que ya aprobó el owner para esa barra
// (2026-10-02): roles con nombre llano, «Por defecto» siempre, color libre «Personalizado» dentro
// de «Avanzado», SIN aviso de contraste (no se agrega ninguno acá).
export interface SugerenciaColor {
  /** Nombre llano — p. ej. "Fondo" · "Tinta" · "Acento" — nunca un id interno ni una clave de rol. */
  nombre: string;
  hex: string;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function Muestra({
  hex, id, onChange, ariaLabel,
}: { hex: string; id?: string; onChange: (hex: string) => void; ariaLabel: string }) {
  return (
    <label className="editor-muestra-color__swatch">
      <input
        id={id}
        type="color"
        value={HEX6.test(hex) ? hex : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      <span aria-hidden style={{ background: hex }} />
    </label>
  );
}

export interface MuestraColorProps {
  id?: string;
  /** El hex de 6 dígitos a mostrar en la muestra — el CALLER ya resuelve el fallback cuando el
   *  campo está vacío/inválido, igual que hacían los tres `<input type="color">` que esto
   *  reemplaza (p. ej. `HEX6_BADGE.test(form.badgeColor) ? form.badgeColor : '#d8a378'`). */
  value: string;
  /** Se llama con un hex de 6 dígitos, al tipear o al elegir del picker nativo. */
  onChange: (hex: string) => void;
  ariaLabel: string;
  invalido?: boolean;
  /** Atajos con nombre llano — hoy, las raíces de la paleta (Fondo/Tinta/Acento). Se omite donde no
   *  aplican: el acento no se sugiere a sí mismo. */
  sugerencias?: SugerenciaColor[];
  /** Presente sólo donde el campo tiene un «sin elegir» real (el badge, que vacío cae al acento de
   *  marca). El acento mismo no lo tiene — siempre es un hex concreto — así que ese sitio lo omite. */
  onPorDefecto?: () => void;
  /** El botón «Por defecto» se pinta activo cuando el campo está hoy en ese estado — lo decide el
   *  caller (acá `value` ya es el hex RESUELTO, así que esta muestra no puede saberlo por sí sola). */
  esPorDefecto?: boolean;
}

/** `MuestraColor` — swatch de 32px al menos + hex al lado, con sugerencias opcionales y el color
 *  libre dentro de «Avanzado › Personalizado». Sin `sugerencias` ni `onPorDefecto` (p. ej. el acento
 *  de marca, que no se sugiere a sí mismo) la muestra ES el control entero — nada que ocultar detrás
 *  de un disclosure cuando no hay nada más que elegir. */
export function MuestraColor({
  id, value, onChange, ariaLabel, invalido, sugerencias, onPorDefecto, esPorDefecto,
}: MuestraColorProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const tieneSugerencias = !!sugerencias && sugerencias.length > 0;
  const coincideSugerencia = tieneSugerencias
    && sugerencias!.some((s) => s.hex.toLowerCase() === value.toLowerCase());

  const muestraYHex = (
    <div className="editor-muestra-color__fila">
      <Muestra hex={value} id={inputId} onChange={onChange} ariaLabel={ariaLabel} />
      <input
        className="duna-input editor-muestra-color__hex"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${ariaLabel} — código hexadecimal`}
        aria-invalid={invalido || undefined}
      />
    </div>
  );

  // Sin sugerencias ni «Por defecto»: no hay nada que ofrecer antes del color libre, así que la
  // muestra se ve directo — un «Avanzado» colapsado sería esconder el único control que existe.
  if (!tieneSugerencias && !onPorDefecto) {
    return <div className="editor-muestra-color">{muestraYHex}</div>;
  }

  return (
    <div className="editor-muestra-color">
      {onPorDefecto && (
        <button
          type="button"
          onClick={onPorDefecto}
          className={`editor-muestra-color__sugerencia${esPorDefecto ? ' is-on' : ''}`}
        >
          <span aria-hidden className="editor-muestra-color__sugerencia-sw editor-muestra-color__sugerencia-sw--defecto" />
          Por defecto
        </button>
      )}
      {tieneSugerencias && (
        <div className="editor-muestra-color__sugerencias">
          {sugerencias!.map((s) => (
            <button
              key={s.nombre}
              type="button"
              onClick={() => onChange(s.hex)}
              className={`editor-muestra-color__sugerencia${!esPorDefecto && s.hex.toLowerCase() === value.toLowerCase() ? ' is-on' : ''}`}
            >
              <span aria-hidden className="editor-muestra-color__sugerencia-sw" style={{ background: s.hex }} />
              {s.nombre}
            </button>
          ))}
        </div>
      )}
      <details className="editor-muestra-color__avanzado" open={!esPorDefecto && !coincideSugerencia}>
        <summary>Avanzado</summary>
        <div className="editor-muestra-color__personalizado">
          <span className="editor-muestra-color__personalizado-label">Personalizado</span>
          {muestraYHex}
        </div>
      </details>
    </div>
  );
}

export default MuestraColor;
