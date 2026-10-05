"use client";

import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";

import {
  TAMANOS_ELEMENTO, LABEL_TAMANO_ELEMENTO,
  type EstiloElementoResuelto, type AlineacionElemento,
} from "@/lib/config/estilo-elemento";
import { PARES_FUENTES } from "@/lib/config/fuentes";
import { ROLES_COLOR_ELEMENTO } from "@/lib/config/palette-derive";

// EL CONTROL GEMELO DE LA BARRA FLOTANTE, del lado del PANEL (§ EDITOR-TIENDA-BARRA-FLOTANTE-1,
// docs/editor-tienda/REDISENO.md § 3: "el panel muestra lo mismo con más espacio"). Se monta DENTRO
// de `TiendaSeccionEditor.tsx`, debajo de cada campo de texto que `metaElementoEstilo('hero', …)`
// declara estilizable — HARDCODEADO a `seccion==='hero'` en el call site (no vía `SeccionConfig`/
// `tienda-secciones.ts`, fuera de `touches:` de este slice), así que este componente recibe TODO lo
// que necesita por props, sin leer `useSiteContent()` ni ningún estado propio: es presentación pura
// controlada, como el resto de los controles de esa cáscara (`onChange`-arriba).
//
// LOS MISMOS CUATRO EJES que la barra flotante (`EditorPuenteVivo.tsx`) ofrece dentro del iframe,
// las MISMAS reglas de `estilo-elemento.ts` (nunca duplicadas acá): «Por defecto» primero, «la otra
// del par», la colección curada; cinco pasos con nombre; tres alineaciones; «Por defecto» → roles
// de la paleta → «Avanzado › Personalizado». Difieren sólo en la FORMA del control (selects/botones
// reales del design-system en vez del HTML con estilos literales que vive en el iframe — ese
// documento es el storefront público, no puede traer Tailwind/el design-system del panel).
//
// SIN `fuenteParActivo`: `TiendaSeccionEditor.tsx` edita la SECCIÓN `hero`, no `tema` (esa vive en
// `PaletaSeccion.tsx`, un editor bespoke aparte), y no recibe el par activo del tenant por prop —
// threadearlo exigiría tocar `TiendaPaginas.tsx`, fuera de `touches:` de este slice. La lista
// "colección curada" muestra entonces las DIEZ claves siempre, sin excluir la que resulte ser la
// activa — inocuo: elegirla explícitamente resuelve a la MISMA fuente que "Por defecto" ya daría,
// sólo que deja de guardarse como `null` (dejaría de seguir un futuro cambio de combinación). La
// barra flotante (dentro del iframe, que SÍ lee `tema.fuentePar` vía `useSiteContent()`) excluye la
// activa de verdad.
export default function EstiloElementoControles({
  valor,
  rolesLegibles,
  sinAlinear = false,
  onCambiar,
  onQuitar,
}: {
  valor: EstiloElementoResuelto;
  /** Los roles de `ROLES_COLOR_ELEMENTO` que se leen bien sobre el fondo de esta zona —
   *  `undefined` muestra los SEIS (el panel no conoce el fondo real de la zona, a diferencia de la
   *  barra flotante dentro del iframe; mostrar todos es la red segura, nunca ocultar de más). */
  rolesLegibles?: readonly string[];
  /** § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — `metaElementoEstilo(seccion,elemento)?.sinAlinear`
   *  del llamador: oculta el grupo de alineación cuando no tiene efecto visible (p. ej. la frase en
   *  bucle de la marquesina, sin espacio sobrante que un `text-align` pueda desplazar). */
  sinAlinear?: boolean;
  onCambiar: (sub: "fuente" | "tamano" | "color" | "alinear", valor: string) => void;
  onQuitar: () => void;
}) {
  const tieneAlgo =
    valor.fuente !== null || valor.tamano !== null || valor.color !== null || valor.alinear !== null;
  const colorEsCustom = typeof valor.color === "string" && valor.color.startsWith("custom:");
  const roles = rolesLegibles ?? ROLES_COLOR_ELEMENTO.map((r) => r.clave);

  return (
    <div
      className="duna-field__hint"
      style={{ marginTop: 8, padding: "10px 12px", border: "1px solid var(--duna-border)", borderRadius: "var(--duna-r-s)", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 160px" }}>
          <span style={{ fontSize: 11, color: "var(--duna-muted)" }}>Letra</span>
          <select
            className="duna-input duna-select"
            value={valor.fuente ?? ""}
            onChange={(e) => onCambiar("fuente", e.target.value)}
          >
            <option value="">Por defecto</option>
            <option value="otra-del-par">La otra del par</option>
            {PARES_FUENTES.map((p) => (
              <option key={p.clave} value={p.clave}>{p.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 140px" }}>
          <span style={{ fontSize: 11, color: "var(--duna-muted)" }}>Tamaño</span>
          <select
            className="duna-input duna-select"
            value={valor.tamano ?? ""}
            onChange={(e) => onCambiar("tamano", e.target.value)}
          >
            <option value="">Por defecto</option>
            {TAMANOS_ELEMENTO.map((t) => (
              <option key={t} value={t}>{LABEL_TAMANO_ELEMENTO[t]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — SE OMITE con `sinAlinear`: un control sin
          efecto visible es peor que no ofrecerlo. */}
      {!sinAlinear && (
        <div role="group" aria-label="Alineación" style={{ display: "flex", gap: 6 }}>
          {(
            [
              { v: "izquierda" as AlineacionElemento, Icon: AlignLeft, label: "Izquierda" },
              { v: "centro" as AlineacionElemento, Icon: AlignCenter, label: "Centro" },
              { v: "derecha" as AlineacionElemento, Icon: AlignRight, label: "Derecha" },
            ] as const
          ).map(({ v, Icon, label }) => (
            <button
              key={v}
              type="button"
              aria-pressed={valor.alinear === v}
              title={label}
              onClick={() => onCambiar("alinear", v)}
              className={`duna-btn duna-btn--ghost duna-btn--sm${valor.alinear === v ? " is-on" : ""}`}
            >
              <Icon aria-hidden size={14} />
            </button>
          ))}
        </div>
      )}

      <div>
        <span style={{ fontSize: 11, color: "var(--duna-muted)", display: "block", marginBottom: 4 }}>Color</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            aria-pressed={valor.color === null}
            onClick={() => onCambiar("color", "")}
            className={`duna-btn duna-btn--ghost duna-btn--sm${valor.color === null ? " is-on" : ""}`}
          >
            Por defecto
          </button>
          {ROLES_COLOR_ELEMENTO.filter((r) => roles.includes(r.clave)).map((r) => (
            <button
              key={r.clave}
              type="button"
              title={`${r.label} — ${r.descripcion}`}
              aria-pressed={valor.color === r.clave}
              onClick={() => onCambiar("color", r.clave)}
              style={{
                width: 22, height: 22, borderRadius: "50%", padding: 0, cursor: "pointer",
                background: `var(${r.variable})`,
                border: valor.color === r.clave ? "2px solid var(--duna-ink)" : "1px solid var(--duna-border)",
              }}
            >
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>{r.label}</span>
            </button>
          ))}
        </div>
        <details style={{ marginTop: 6 }} open={colorEsCustom}>
          <summary style={{ fontSize: 11, color: "var(--duna-muted)", cursor: "pointer" }}>Avanzado</summary>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--duna-muted)" }}>Personalizado</span>
            <input
              type="color"
              value={colorEsCustom ? (valor.color as string).slice("custom:".length) : "#000000"}
              onChange={(e) => onCambiar("color", `custom:${e.target.value}`)}
              style={{ width: 28, height: 22, padding: 0, border: "none", background: "none" }}
            />
          </label>
        </details>
      </div>

      {tieneAlgo && (
        <button type="button" onClick={onQuitar} className="duna-btn duna-btn--ghost duna-btn--sm" style={{ alignSelf: "flex-start" }}>
          Quitar estilo
        </button>
      )}
    </div>
  );
}
