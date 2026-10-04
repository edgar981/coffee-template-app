'use client';

import { PRESETS, type PresetTema } from '@/lib/config/themes';
import { PARES_FUENTES } from '@/lib/config/fuentes';

// COMBINACIONES (§ EDITOR-TIENDA-SHELL-1, REDISENO.md § 6): «tarjetas con la paleta y el par de
// letras reales de cada preset (Corte, Pliego, Patio, Vitrina…). Un clic recolorea la tienda entera
// con transición.»
//
// ALCANCE DELIBERADAMENTE ACOTADO — y es una DESVIACIÓN medida, no una lectura literal del spec.
// `PresetTema` (`lib/config/themes.ts`) es MÁS que paleta+tipografía: también carga esquema por
// banda, orden de bandas, variante de sección, los toggles de hero/nav/carrito… y ese archivo declara,
// en su propio encabezado, una decisión YA tomada y escrita en DECISIONS.md (§ "EL CLIENTE EDITA SU
// CONTENIDO, NO SU COMPOSICIÓN", retiro de `EJE-5-ORDEN-EDITOR-1`/`EJE-5-VARIANTES-EDITOR`): esos
// ejes de COMPOSICIÓN se arman en el onboarding de Duna, nunca desde un picker del panel del cliente
// — "la rigidez es la garantía de que ninguna tienda de Duna se ve mal". Un botón acá que aplicara el
// `PresetTema` COMPLETO (vía `aplicarPreset`/`mergePresetEnContent`) reabriría exactamente la
// capacidad que esa decisión retiró.
//
// Por eso cada tarjeta aplica SÓLO `raices` + `fuentePar` + `forma` — los MISMOS TRES EJES que esta
// pantalla YA deja editar uno por uno (la base curada + el picker de acento, el picker de tipografía,
// el picker de forma): una combinación es un ATAJO sobre esos tres controles, con el mismo verbo que
// "recolorea la tienda" describe, no una puerta nueva a la composición. `aplicarCombinacion`
// (PaletaSeccion.tsx) es el único escritor — este componente es presentación pura.
export function Combinaciones({ onElegir }: { onElegir: (preset: PresetTema) => void }) {
  return (
    <div>
      <span className="duna-field__label">Combinaciones</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, marginTop: 6 }}>
        {PRESETS.map((preset) => {
          const par = PARES_FUENTES.find((p) => p.clave === (preset.fuentePar ?? 'editorial'));
          return (
            <button
              key={preset.clave}
              type="button"
              onClick={() => onElegir(preset)}
              title={`Aplicar la combinación ${preset.label}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 6,
                padding: 8,
                borderRadius: 'var(--duna-r-m)',
                border: '1px solid var(--duna-border)',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span aria-hidden style={{ display: 'flex', width: '100%', height: 28, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--duna-border)' }}>
                <span style={{ flex: 2, background: preset.raices.fondo }} />
                <span style={{ flex: 1, background: preset.raices.tinta }} />
                <span style={{ flex: 1, background: preset.raices.acento }} />
              </span>
              <span
                aria-hidden
                style={{ fontFamily: par?.titulo, fontSize: 15, lineHeight: 1, color: 'var(--duna-ink)' }}
              >
                Ag
              </span>
              <span className="duna-body" style={{ fontSize: 11, fontWeight: 600 }}>{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Combinaciones;
