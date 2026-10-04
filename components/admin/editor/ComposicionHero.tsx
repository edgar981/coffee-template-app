'use client';

import type { CSSProperties } from 'react';
import { VistaNueva } from '@/components/admin/editor/VistaNueva';
import type { ComposicionOpcion } from '@/components/admin/tienda-secciones';

// LA VISTA «¿Cómo se arma tu hero?» (§ EDITOR-TIENDA-COMPOSICION-1, REDISENO.md § 4/§ 6/§ 9) — abre
// desde el botón «Composición: <nombre>» del panel del hero (`TiendaSeccionEditor.tsx`). Las cuatro
// composiciones reales van lado a lado (apiladas, el ancho de la hoja no da para una fila), cada una
// con su MINIATURA ESQUEMÁTICA, su nombre y las zonas que trae.
//
// POR QUÉ ESQUEMÁTICA Y NO EL COMPONENTE REAL (§ el permiso explícito del spec, REDISENO.md § 9): el
// lienzo del editor es hoy un <iframe> a la página real (§ EDITOR-TIENDA-IFRAME-VISTA-1) — la vista
// previa en vivo por React (`VistaTiendaEnVivo.tsx`) quedó RETIRADA de ese camino (verificado: cero
// imports en `TiendaSeccionEditor.tsx`/`TiendaPaginas.tsx`, sólo sobrevive en
// `admin-tienda-preset.test.ts`). Montar las CUATRO variantes del hero (HeroCurtina/HeroFicha/
// HeroMedia/HeroMediaMarquesina) a la vez dentro de esta hoja para compararlas de verdad exigiría
// reconstruir esa vía retirada, sólo para esta hoja — el costo que el propio spec autoriza esquivar.
//
// LA ELECCIÓN SÍ ES REAL: clic → `onElegir(value)` escribe `hero.variante` en el borrador por el
// MISMO `cambiar()` que cualquier campo de texto. El lienzo (el iframe) cambia al instante SIN que
// este archivo toque el puente: `onCambio` ya manda el `form` completo por `postMessage` en cada
// cambio (§ TiendaSeccionEditor.tsx:onCambio → TiendaPaginas.tsx:manejarCambioSeccion →
// VistaTiendaIframe.enviarCambio), y `HeroSection.tsx` ya elige el Layout según `hero.variante` — no
// hay nada nuevo que cablear para que el cambio se vea.
//
// LO QUE NO SE MUESTRA NO SE BORRA, Y ES GRATIS: cada composición lee los MISMOS nombres de campo de
// `content.hero` (`titulo`, `subtitulo`, `fraseAlPie`…); sólo RENDERIZA un subconjunto distinto. El
// dato sigue en `content.hero.titulo` tanto si la composición activa lo pinta como si no — por eso
// «se guarda, y volver lo recupera» no necesita ninguna migración: es una propiedad del modelo, no
// algo que este componente deba implementar. Lo único que este componente calcula es el AVISO (qué
// zonas con contenido real dejarían de verse), para que el dueño no lo descubra recién al publicar.
export interface ComposicionHeroProps {
  abierto: boolean;
  onCerrar: () => void;
  opciones: ComposicionOpcion[];
  /** El valor actual del escalar `variante` (ya resuelto por `resolverSiteContent` — nunca vacío). */
  activa: string;
  /** Los valores YA FUSIONADOS que las zonas de TEXTO necesitan para decidir "Se guarda: X" — el
   *  `form` de la sección más los campos cruzados que viven en otra sección (hoy, `texto`/
   *  `productoSlug` de la marquesina, § `CampoTexto.seccionCruzada`): el caller los funde ANTES de
   *  pasarlos acá para que este componente no necesite saber qué campo es cruzado y cuál no. */
  valores: Record<string, unknown>;
  onElegir: (valor: string) => void;
}

/** `true` si ALGUNO de los campos de la zona tiene contenido real (string no vacío). Sólo se
 *  invoca sobre zonas de TEXTO (`textoVisible !== false`) — el caller filtra por eso antes. */
function zonaTieneContenido(campos: string[], valores: Record<string, unknown>): boolean {
  return campos.some((c) => String(valores[c] ?? '').trim() !== '');
}

const CAJA_MINIATURA: CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden',
  borderRadius: 'var(--duna-r-s)', background: 'var(--duna-wash-hover)',
  border: '1px solid var(--duna-border)',
};

function barra(ancho: number, alto = 6): CSSProperties {
  return { width: `${ancho}%`, height: alto, borderRadius: 'var(--duna-r-full)', background: 'var(--duna-ink)', opacity: 0.35 };
}

const PILDORA: CSSProperties = {
  width: '28%', height: 10, borderRadius: 'var(--duna-r-full)', background: 'var(--duna-ink)', opacity: 0.55,
};

/** La miniatura ESQUEMÁTICA de una composición — sin una sola clase CSS nueva (`app/(admin)/
 *  duna.css` no está en `touches:` de este slice): sólo tokens `--duna-*` ya declarados, en `style`
 *  inline. No pretende ser un pixel-perfect del storefront real; es fiel a la POSICIÓN de cada
 *  zona (texto centrado vs. a un lado, tarjeta flotante, cinta de marquesina) — lo que distingue
 *  una composición de otra a simple vista — medida contra el código real de cada variante
 *  (§ `ZONAS_*` en tienda-secciones.ts, no la maqueta). */
function MiniaturaComposicion({ valor }: { valor: string }) {
  if (valor === 'ficha') {
    return (
      <div style={CAJA_MINIATURA} aria-hidden>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '45%', background: 'var(--duna-ink)', opacity: 0.12 }} />
        <div style={{ position: 'absolute', left: '6%', top: '50%', transform: 'translateY(-50%)', width: '38%', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={barra(55, 4)} />
          <div style={barra(90, 8)} />
          <div style={barra(75, 5)} />
          <div style={PILDORA} />
        </div>
      </div>
    );
  }
  if (valor === 'media') {
    return (
      <div style={CAJA_MINIATURA} aria-hidden>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--duna-wash-active)' }} />
        <div style={{ position: 'absolute', left: '6%', bottom: '14%', width: '46%', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--duna-surface)', padding: 6, borderRadius: 'var(--duna-r-s)' }}>
          <div style={barra(40, 4)} />
          <div style={barra(85, 7)} />
          <div style={PILDORA} />
        </div>
        <div style={{ position: 'absolute', right: '6%', bottom: '8%', ...barra(22, 4) }} />
        <div style={{ position: 'absolute', left: '50%', bottom: '4%', transform: 'translateX(-50%)', width: 20, height: 2, background: 'var(--duna-ink)', opacity: 0.4 }} />
      </div>
    );
  }
  if (valor === 'sticky') {
    return (
      <div style={CAJA_MINIATURA} aria-hidden>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--duna-wash-active)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '42%', height: 10, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ ...barra(140, 6), opacity: 0.5, marginLeft: 4 }} />
        </div>
        <div style={{ position: 'absolute', left: '50%', bottom: '10%', transform: 'translateX(-50%)', width: '34%', background: 'var(--duna-surface)', borderRadius: 'var(--duna-r-s)', padding: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={barra(60, 4)} />
          <div style={barra(40, 4)} />
        </div>
        {/* LA ZONA «TITULAR/SUBTÍTULO/BOTÓN» (§ EDITOR-TIENDA-ZONAS-STICKY-TITULAR-1) — abajo a la
            izquierda, sobre el indicador "Desliza". Nace APAGADA (§ el docstring de cabecera de
            `HeroMediaMarquesina.tsx`): esta miniatura muestra la FORMA que la zona toma cuando el
            dueño la enciende, no su estado por defecto — "fiel a la POSICIÓN de cada zona", como el
            resto de este componente. */}
        <div style={{ position: 'absolute', left: '6%', bottom: '8%', width: '26%', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={barra(85, 5)} />
          <div style={barra(60, 3)} />
          <div style={{ width: '45%', height: 2, background: 'var(--duna-ink)', opacity: 0.3 }} />
        </div>
      </div>
    );
  }
  // 'curtina' (canónica) y cualquier valor fuera del set (no debería ocurrir): texto centrado.
  return (
    <div style={CAJA_MINIATURA} aria-hidden>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--duna-wash-active)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={barra(28, 4)} />
        <div style={barra(55, 8)} />
        <div style={barra(42, 5)} />
        <div style={PILDORA} />
      </div>
    </div>
  );
}

export function ComposicionHero({ abierto, onCerrar, opciones, activa, valores, onElegir }: ComposicionHeroProps) {
  const actual = opciones.find((o) => o.value === activa) ?? opciones[0];
  return (
    <VistaNueva
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="¿Cómo se arma tu hero?"
      descripcion="Elige la composición. Lo que la nueva no muestra se guarda — volver a esta la recupera."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
        {opciones.map((op) => {
          const esActiva = op.value === activa;
          const nombresNuevos = new Set(op.zonas.map((z) => z.label));
          // Lo que la composición ACTUAL muestra y la NUEVA no — sólo zonas de TEXTO con contenido
          // real: un booleano de feature (indicador/velo) sin efecto en la nueva no es contenido
          // perdido, es un ajuste sin blanco (§ `textoVisible`, tienda-secciones.ts).
          const seGuarda = (actual?.zonas ?? [])
            .filter((z) => z.textoVisible !== false && !nombresNuevos.has(z.label) && zonaTieneContenido(z.campos, valores))
            .map((z) => z.label);
          return (
            <button
              key={op.value}
              type="button"
              onClick={() => { if (!esActiva) onElegir(op.value); }}
              disabled={esActiva}
              className="bloque-tarjeta"
              style={{ textAlign: 'left', cursor: esActiva ? 'default' : 'pointer', display: 'block', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--duna-space-3)' }}>
                <span className="duna-field__label" style={{ margin: 0 }}>{op.label}</span>
                {esActiva && <span className="duna-badge duna-badge--neutral">Actual</span>}
              </div>
              <MiniaturaComposicion valor={op.value} />
              <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-3)', marginBottom: 0 }}>
                Trae: {op.zonas.map((z) => z.label).join(' · ')}
              </p>
              {!esActiva && seGuarda.length > 0 && (
                <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-1)', marginBottom: 0 }}>
                  Se guarda: {seGuarda.join(', ')}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </VistaNueva>
  );
}

export default ComposicionHero;
