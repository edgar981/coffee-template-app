'use client';

import { useState, useEffect, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Maximize2 } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ProductCard from '@/components/storefront/ProductCard';
import { Logo } from '@/components/storefront/Logo';
import TrustBadges from '@/components/storefront/home/TrustBadges';
import { EscalaDesktop } from '@/components/admin/EscalaDesktop';
import { CartProvider } from '@/lib/cartStore';
import type { Product } from '@/types/product';
import { paletaEditableSchema } from '@/lib/config/palette-schema';
import { derivarPaleta, contraste } from '@/lib/config/palette-derive';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { useDescarteDeDrawer } from '@/hooks/useDescarteDeDrawer';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';

// ─── Sección COLORES DE LA TIENDA (commit 4) ─────────────────────────────────
//
// El cliente elige 3 RAÍCES —fondo·tinta·acento—; el motor deriva las demás y las
// inyecta el layout del storefront. Reusa la MISMA cáscara que Datos del negocio
// (lectura↔edición, `useDescarteDeDrawer`, `useAccionGuardada`, `ConfirmDescartarDialog`,
// PATCH + `router.refresh()`) — un solo flujo de edición en la pantalla, no dos.
//
// HÍBRIDO (owner): BASES curadas para fondo+tinta (garantizan el contraste bg↔texto) +
// picker LIBRE para el acento (es el color de marca, y una tienda casi siempre tiene el
// suyo). El PISO de contraste y el auto-flip cubren lo derivado; el aviso, lo que el
// cliente elige. Avisa, NO bloquea — es su tienda.

// Los defaults de código (§ globals.css `--sf-*`) = la paleta de Nayoli. Raíces null → estos.
const DEFAULT_RAICES = { fondo: '#faf7f4', tinta: '#1a0f08', acento: '#8b4513' };

// Bases fondo+tinta CURADAS (todas ≥AA de texto sobre fondo, medido). El cliente elige una;
// el acento va aparte. La PRIMERA es NEUTRA a propósito (gris cálido): un rubro concreto de
// primera —'Café' liderando— pondría la marca de Nayoli como punto de partida de todo cliente
// nuevo. 'Crema' (la base de Nayoli) va después, y su nombre ya no evoca el rubro.
//
// DISPARADOR de una QUINTA base: NO es "otra base más". Las cuatro son lienzos CLAROS (fondo
// claro, texto oscuro), y el reparto —acento libre carga la identidad, base callada— las sostiene
// para v1. El único faltante real es un lienzo OSCURO, y ése NO es una base: es MODO OSCURO del
// storefront —los componentes asumen fondo claro, así que un fondo oscuro exige que cada uno
// maneje el lienzo invertido, como el dark-mode del panel—. Se agrega cuando un cliente pida
// tienda oscura, no antes.
const BASES: { label: string; fondo: string; tinta: string }[] = [
  { label: 'Neutro',  fondo: '#f6f5f3', tinta: '#1c1a18' },
  { label: 'Crema',   fondo: '#faf7f4', tinta: '#1a0f08' },
  { label: 'Taupe',   fondo: '#f5f4f2', tinta: '#1b1a17' },
  { label: 'Pizarra', fondo: '#f5f6f7', tinta: '#191a1c' },
];

interface Form { fondo: string; tinta: string; acento: string }
type Settings = ReturnType<typeof useSiteSettings>;

const HEX6 = /^#[0-9a-fA-F]{6}$/;

// El seed de cada raíz cae al default cuando el valor guardado NO es un hex válido —null,
// undefined, cadena VACÍA o basura—, no sólo cuando es nullish. `?? default` atrapaba SÓLO
// null/undefined, así que un `''` guardado se colaba a `form`: el campo de texto nacía
// VACÍO y en rojo mientras el input de color lo enmascaraba con su propio fallback (los dos
// leen el mismo `form.acento`, pero sólo el color tenía respaldo). Espeja a `cssPaleta`, que
// ya trata `''` como "sin paleta" (`if (!acento) return null`).
function raizValida(v: string | null, def: string): string {
  return v && HEX6.test(v) ? v : def;
}

function desdeSettings(s: Settings): Form {
  return {
    fondo:  raizValida(s.paletaFondo,  DEFAULT_RAICES.fondo),
    tinta:  raizValida(s.paletaTinta,  DEFAULT_RAICES.tinta),
    acento: raizValida(s.paletaAcento, DEFAULT_RAICES.acento),
  };
}

// Productos de MUESTRA para la vista previa. Nombres GENÉRICOS a propósito —no cafés de Nayoli—
// para que nadie los confunda con productos reales. Sin imagen (ProductCard cae a su fondo de
// superficie). Uno `bestseller` + `badge` para que el chip de acento (bg acento + texto
// `acento-txt`, el flip) se vea SIN hover —el botón "agregar" es hover-only y bajo
// `pointer-events:none` no aparece, así que el badge es quien muestra el acento en estático—.
const PRODUCTOS_MUESTRA: Product[] = [
  {
    id: 'muestra-1', nombre: 'Producto de muestra', slug: 'muestra-1',
    categoria: 'cafe_bolsa', precio: 45000, costo: 20000, sku: null, stock: 12,
    activo: true, disponible: true, descripcion: 'Producto de ejemplo para la vista previa de la paleta.',
    bestseller: true, badge: 'Destacado', notas: ['Suave', 'Equilibrado'],
  },
  {
    id: 'muestra-2', nombre: 'Otro producto de muestra', slug: 'muestra-2',
    categoria: 'cafe_bolsa', precio: 38000, costo: 18000, sku: null, stock: 8,
    activo: true, disponible: true, descripcion: 'Segundo producto de ejemplo para la vista previa.',
    notas: ['Frutal', 'Cítrico'],
  },
  {
    id: 'muestra-3', nombre: 'Tercer producto de muestra', slug: 'muestra-3',
    categoria: 'cafe_bolsa', precio: 52000, costo: 24000, sku: null, stock: 6,
    activo: true, disponible: true, descripcion: 'Tercer producto de ejemplo para la vista previa.',
    notas: ['Chocolate', 'Nuez'],
  },
];

/** EL FRAGMENTO: un pedazo de tienda que se lee como pantalla, con COMPONENTES REALES del
 *  storefront —no un croquis—: una barra con el wordmark (`Logo`), la franja de garantías
 *  (`TrustBadges`) y tres `ProductCard`, sobre `--sf-fondo` y alimentados por la paleta DERIVADA
 *  del form. INERTE (`pointer-events:none` en la raíz: sin carrito, sin navegación, sin hover — en
 *  el inline el clic lo captura el wrapper de ampliar; en el overlay es sólo para ver).
 *
 *  Es UNA sola pieza: la renderizan tanto el preview inline (`EscalaDesktop` grande) como el
 *  overlay de ampliar (`EscalaDesktop` compacto). NO diverge entre los dos —lo único que cambia es
 *  el MODO de EscalaDesktop, que va afuera—, así que no hay segunda representación que mienta.
 *
 *  Layout de ESCRITORIO interno (`max-w-6xl` centrado, TrustBadges en sus 4 columnas a 1280,
 *  tarjetas en `repeat(3,1fr)`): a 1280 se ve natural, no dos tarjetas gigantes escaladas.
 *
 *  Qué se monta sin fetch (censo del gate): `Logo` por PROP sin providers; `TrustBadges` estático;
 *  `StoreNav` quedó FUERA (3 providers + chrome inerte). `ProductCard` sólo necesita `CartProvider`
 *  local e inerte (§ Las tres capas — montar un componente en otro árbol de providers). */
function FragmentoTienda({ raices, nombre }: { raices: Form; nombre: string }) {
  const p = derivarPaleta(raices);
  const vars = Object.fromEntries(Object.entries(p).map(([k, v]) => [`--sf-${k}`, v])) as CSSProperties;
  return (
    <div className="font-inter" style={{ ...vars, background: 'var(--sf-fondo)', pointerEvents: 'none' }}>
      {/* Barra superior con el wordmark real (centrada como el nav) */}
      <div className="mx-auto max-w-6xl px-6 py-4">
        <Logo nombre={nombre} />
      </div>
      {/* Franja de garantías real (su propio `border-y` la separa; a 1280 usa sus 4 columnas) */}
      <TrustBadges />
      {/* Tres tarjetas reales en fila de escritorio, bajo un CartProvider local inerte */}
      <CartProvider>
        <div className="mx-auto max-w-6xl px-6 py-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {PRODUCTOS_MUESTRA.map(pr => <ProductCard key={pr.id} product={pr} />)}
        </div>
      </CartProvider>
    </div>
  );
}

/** El preview INLINE: el fragmento escalado por ancho (`EscalaDesktop` grande), AMPLIABLE al clic.
 *  El botón de ampliar es un HERMANO absoluto que cubre el preview —NO un wrapper—: envolver el
 *  fragmento en un `<button>` anidaría los `<a>`/`<button>` del ProductCard dentro de un botón,
 *  que es HTML inválido. El fragmento es `pointer-events:none`, así que el clic pasa al botón de
 *  encima; `cursor: zoom-in` + el chip "Ampliar" hacen visible que se abre grande. */
function PreviewTiendaReal({ raices, nombre, onAmpliar }: { raices: Form; nombre: string; onAmpliar: () => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <EscalaDesktop style={{ borderRadius: 14, overflow: 'hidden' }}>
        <FragmentoTienda raices={raices} nombre={nombre} />
      </EscalaDesktop>
      <button
        type="button" onClick={onAmpliar} aria-label="Ampliar la vista previa de la tienda"
        style={{ position: 'absolute', inset: 0, cursor: 'zoom-in', border: 0, background: 'none', padding: 0, borderRadius: 14 }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 8px', borderRadius: 8, background: 'rgba(20,18,16,0.62)', color: '#fff',
            fontSize: 11, fontWeight: 600, backdropFilter: 'blur(2px)',
          }}
        >
          <Maximize2 size={13} /> Ampliar
        </span>
      </button>
    </div>
  );
}

/** El overlay de AMPLIAR: el MISMO fragmento (vivo por construcción — las mismas raíces) en el
 *  `Dialog` del admin (Esc, clic-afuera, foco atrapado, X, scroll-lock, todo de Radix — NO
 *  ImageLightbox, que es image-only). `EscalaDesktop` COMPACTO lo encaja entero en la caja
 *  (scale-to-fit, letterbox), como una foto en un visor. */
function AmpliarOverlay({ abierto, onCerrar, raices, nombre }: { abierto: boolean; onCerrar: () => void; raices: Form; nombre: string }) {
  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar(); }}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[92vw] max-w-[1400px] p-4 sm:p-6"
      >
        <DialogTitle className="sr-only">Vista previa ampliada de los colores de la tienda</DialogTitle>
        {/* Alto EXPLÍCITO (vh), no `height:100%`: compacto necesita una caja de alto definido para
            el scale-to-fit, y una cadena de `100%` a través del padding del Dialog es frágil. */}
        <EscalaDesktop compacto style={{ width: '100%', height: '82vh', overflow: 'hidden' }}>
          <FragmentoTienda raices={raices} nombre={nombre} />
        </EscalaDesktop>
      </DialogContent>
    </Dialog>
  );
}

export default function PaletaSeccion() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();
  // El refresco post-guardado re-lee el layout (los `settings` nuevos). Hasta que llega ese
  // RSC, `useSiteSettings()` devuelve los VIEJOS → la tarjeta pintaría la paleta anterior un
  // instante (el flash que el owner vio). `useTransition` marca ese refresco: mientras
  // `refrescando`, la lectura muestra el SKELETON en vez de la paleta vieja.
  const [refrescando, startTransition] = useTransition();

  const [editando, setEditando]           = useState(false);
  const [form, setForm]                   = useState<Form>(() => desdeSettings(settings));
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [ampliado, setAmpliado]           = useState(false);

  const salir = () => { setEditando(false); setErrorServidor(null); };
  const descarte = useDescarteDeDrawer({ enVuelo: guarda.enVuelo, onCerrar: salir });
  const sucio = editando && JSON.stringify(form) !== JSON.stringify(desdeSettings(settings));
  useEffect(() => { descarte.marcarCambios(sucio); }, [sucio, descarte]);

  const abrir = () => { setForm(desdeSettings(settings)); setErrorServidor(null); setEditando(true); };

  // Avisos de contraste — dicen QUÉ pasa, no un ratio. Cubren lo que el cliente ELIGE
  // (fondo/tinta y el acento); lo derivado ya lo protege el piso + el auto-flip.
  const acentoTxt = derivarPaleta(form)['acento-txt'];
  const avisos: string[] = [];
  if (HEX6.test(form.acento)) {
    if (contraste(form.tinta, form.fondo) < 4.5)
      avisos.push('El texto principal puede costar de leer sobre este fondo. Prueba una base más contrastada.');
    if (contraste(acentoTxt, form.acento) < 4.5)
      avisos.push('El texto del botón puede costar de leer sobre este acento. Prueba un acento más oscuro o más claro.');
    if (contraste(form.acento, form.fondo) < 1.35)
      avisos.push('El acento casi no se distingue del fondo: los botones y detalles pueden perderse.');
  }

  const acentoInvalido = editando && !HEX6.test(form.acento);

  const elegirBase = (b: (typeof BASES)[number]) => setForm(f => ({ ...f, fondo: b.fondo, tinta: b.tinta }));

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);
    const payload = { paletaFondo: form.fondo, paletaTinta: form.tinta, paletaAcento: form.acento };
    const parsed = paletaEditableSchema.safeParse(payload);
    if (!parsed.success) { setErrorServidor(parsed.error.issues[0]?.message ?? 'Colores inválidos'); return; }

    guarda.ejecutar(async () => {
      const res = await fetch('/api/site-settings/palette', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorServidor(data?.error ?? 'No se pudo guardar. Intenta de nuevo.');
        return;
      }
      toast.success('Colores de la tienda guardados.');
      setEditando(false);
      startTransition(() => router.refresh());
    });
  };

  // "Usar el tema por defecto": PATCH con las 3 raíces en null → el storefront vuelve a los
  // defaults de código (§ cssPaleta con null → sin inyección). Cubre "me perdí" volviendo a
  // FÁBRICA —no a un tema custom anterior; eso es § Backlog #55, la paleta al flujo de borrador—.
  // Sólo se ofrece si hay un tema custom guardado: con el default ya puesto, "Cancelar" ya vuelve.
  const tieneCustom = settings.paletaFondo != null || settings.paletaTinta != null || settings.paletaAcento != null;

  const usarDefault = () => {
    setErrorServidor(null);
    guarda.ejecutar(async () => {
      const res = await fetch('/api/site-settings/palette', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paletaFondo: null, paletaTinta: null, paletaAcento: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorServidor(data?.error ?? 'No se pudo aplicar el tema por defecto. Intenta de nuevo.');
        return;
      }
      toast.success('Volviste al tema por defecto.');
      setEditando(false);
      startTransition(() => router.refresh());
    });
  };

  const baseActiva = BASES.find(b => b.fondo === form.fondo && b.tinta === form.tinta);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="duna-title">Colores de la tienda</h2>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            El fondo, la tinta del texto y el acento de marca. Eliges tres colores y el resto
            de la paleta del storefront se calcula sola.
          </p>
        </div>
        {!editando && (
          <button type="button" onClick={abrir} className="duna-btn duna-btn--secondary" style={{ flexShrink: 0 }}>
            <Pencil /> Editar
          </button>
        )}
      </div>

      <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
        {editando ? (
          <form onSubmit={guardar} className="duna-form" noValidate style={{ gap: 'var(--duna-space-5)' }}>
            {/* BASES (fondo + tinta) */}
            <div className="duna-form__full">
              <span className="duna-field__label">Base (fondo y texto)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginTop: '6px' }}>
                {BASES.map(b => {
                  const activa = baseActiva?.label === b.label;
                  return (
                    <button
                      key={b.label} type="button" onClick={() => elegirBase(b)}
                      aria-pressed={activa}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px',
                        borderRadius: 'var(--duna-r-l)', cursor: 'pointer',
                        border: `1px solid ${activa ? 'var(--duna-ink)' : 'var(--duna-border)'}`,
                        background: activa ? 'var(--duna-surface)' : 'transparent',
                        boxShadow: activa ? 'var(--duna-shadow-1)' : 'none',
                      }}
                    >
                      <span style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--duna-border)' }}>
                        <i style={{ width: 16, height: 20, background: b.fondo }} />
                        <i style={{ width: 16, height: 20, background: b.tinta }} />
                      </span>
                      <span className="duna-body" style={{ fontSize: 13, fontWeight: activa ? 600 : 500 }}>{b.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACENTO (picker libre) */}
            <div className="duna-field">
              <label className="duna-field__label" htmlFor="pal-acento">Acento de marca</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: '6px' }}>
                <input
                  id="pal-acento" type="color"
                  value={HEX6.test(form.acento) ? form.acento : '#8b4513'}
                  onChange={e => setForm(f => ({ ...f, acento: e.target.value }))}
                  style={{ width: 44, height: 36, padding: 0, border: '1px solid var(--duna-border)', borderRadius: 'var(--duna-r-m)', background: 'none', cursor: 'pointer' }}
                  aria-label="Elegir color de acento"
                />
                <input
                  className="duna-input" style={{ width: 130, fontFamily: 'var(--duna-font-mono)' }}
                  value={form.acento} onChange={e => setForm(f => ({ ...f, acento: e.target.value }))}
                  aria-invalid={acentoInvalido || undefined}
                />
              </div>
              {acentoInvalido && <p className="duna-field__error" style={{ marginTop: '4px' }}>Usa un hex de 6 dígitos, p. ej. #8b4513.</p>}
            </div>

            {/* PREVIEW + avisos */}
            <div className="duna-form__full">
              <span className="duna-field__label">Vista previa</span>
              <div style={{ marginTop: '6px', maxWidth: 440 }}>
                <PreviewTiendaReal raices={form} nombre={settings.nombre} onAmpliar={() => setAmpliado(true)} />
              </div>
              {avisos.length > 0 && (
                <div role="status" style={{ marginTop: 'var(--duna-space-3)', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {avisos.map((a, i) => (
                    <p key={i} className="duna-caption" style={{ color: 'var(--duna-sol-ink)', lineHeight: 1.4 }}>⚠ {a}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="duna-form__full" style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
              <button type="submit" className="duna-btn duna-btn--primary" disabled={guarda.enVuelo || acentoInvalido}>
                {guarda.enVuelo ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={descarte.intentarCerrar} className="duna-btn duna-btn--ghost" disabled={guarda.enVuelo}>
                Cancelar
              </button>
              {errorServidor && <p className="duna-field__error" role="alert" style={{ margin: 0 }}>{errorServidor}</p>}
              {/* Escape hatch a FÁBRICA (§ el botón de fábrica). Empujado a la derecha —es un
                  reset, distinto del par guardar/cancelar—. Sólo con un tema custom guardado. */}
              {tieneCustom && (
                <button
                  type="button" onClick={usarDefault} disabled={guarda.enVuelo}
                  className="duna-btn duna-btn--ghost" style={{ marginLeft: 'auto' }}
                >
                  Usar el tema por defecto
                </button>
              )}
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-5)', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 300px', maxWidth: 440 }}>
              {/* Durante el refresco post-guardado, skeleton en vez de la paleta VIEJA (§ el flash).
                  Aspecto de TARJETA (portrait), como la forma del ProductCard del preview. */}
              {refrescando
                ? <div className="duna-skel" aria-hidden style={{ width: '100%', aspectRatio: '3 / 4', borderRadius: 14 }} />
                : <PreviewTiendaReal raices={desdeSettings(settings)} nombre={settings.nombre} onAmpliar={() => setAmpliado(true)} />}
            </div>
            <p className="duna-sub" style={{ margin: 0, maxWidth: '24rem' }}>
              {settings.paletaAcento
                ? <>Base <b>{baseActiva?.label ?? 'personalizada'}</b>, con tu acento. Así se ve tu tienda.</>
                : <>Estás usando los colores de fábrica. Edita para elegir los tuyos.</>}
            </p>
          </div>
        )}
      </div>

      <ConfirmDescartarDialog
        abierto={descarte.confirmando}
        onDescartar={descarte.descartar}
        onSeguir={descarte.seguirEditando}
      />

      {/* Ampliar: el mismo fragmento en grande, con las raíces del modo VISIBLE (form en edición,
          guardadas en lectura) → vivo por construcción, sin snapshot. */}
      <AmpliarOverlay
        abierto={ampliado}
        onCerrar={() => setAmpliado(false)}
        raices={editando ? form : desdeSettings(settings)}
        nombre={settings.nombre}
      />
    </>
  );
}
