'use client';

import { useState, useEffect, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
import ProductCard from '@/components/storefront/ProductCard';
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

function desdeSettings(s: Settings): Form {
  return {
    fondo:  s.paletaFondo  ?? DEFAULT_RAICES.fondo,
    tinta:  s.paletaTinta  ?? DEFAULT_RAICES.tinta,
    acento: s.paletaAcento ?? DEFAULT_RAICES.acento,
  };
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Producto de MUESTRA para la vista previa. Nombre GENÉRICO a propósito —no un café de
// Nayoli— para que nadie lo confunda con un producto real. Sin imagen (ProductCard cae a su
// fondo de superficie). `bestseller` + `badge` para que el chip de acento (bg acento + texto
// `acento-txt`, el flip) se vea SIN hover —el botón "agregar" es hover-only y bajo
// `pointer-events:none` no aparece, así que el badge es quien muestra el acento en estático—.
const PRODUCTO_MUESTRA: Product = {
  id: 'muestra',
  nombre: 'Producto de muestra',
  slug: 'producto-de-muestra',
  categoria: 'cafe_bolsa',
  precio: 45000,
  costo: 20000,
  sku: null,
  stock: 12,
  activo: true,
  disponible: true,
  descripcion: 'Producto de ejemplo para la vista previa de la paleta.',
  bestseller: true,
  badge: 'Destacado',
  notas: ['Suave', 'Equilibrado'],
};

/** La vista previa es el `ProductCard` REAL del storefront —el mismo componente que ve el
 *  cliente, no un croquis— alimentado por la paleta DERIVADA de las raíces del form e INERTE
 *  (`pointer-events:none`: sin carrito, sin navegación, sin hover). Muestra fondo (el marco),
 *  superficie (la tarjeta), línea, tinta (el nombre), acento-texto (el origen) y el acento con
 *  su texto volteado (el badge). El botón "agregar" es hover-only del propio ProductCard; bajo
 *  `pointer-events:none` no se ve, y el badge lo suple. Censo: las secciones con contenido de
 *  VistaTiendaEnVivo (hero/brandStory/subscriptionCTA) son OSCURAS y no muestran el acento. */
function PreviewTiendaReal({ raices }: { raices: Form }) {
  const p = derivarPaleta(raices);
  const vars = Object.fromEntries(Object.entries(p).map(([k, v]) => [`--sf-${k}`, v])) as CSSProperties;
  return (
    <div
      className="font-inter"
      style={{ ...vars, background: 'var(--sf-fondo)', borderRadius: 14, padding: 22, pointerEvents: 'none' }}
    >
      <div style={{ maxWidth: 300, margin: '0 auto' }}>
        <ProductCard product={PRODUCTO_MUESTRA} />
      </div>
    </div>
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
                <PreviewTiendaReal raices={form} />
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
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-5)', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 300px', maxWidth: 440 }}>
              {/* Durante el refresco post-guardado, skeleton en vez de la paleta VIEJA (§ el flash).
                  Aspecto de TARJETA (portrait), como la forma del ProductCard del preview. */}
              {refrescando
                ? <div className="duna-skel" aria-hidden style={{ width: '100%', aspectRatio: '3 / 4', borderRadius: 14 }} />
                : <PreviewTiendaReal raices={desdeSettings(settings)} />}
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
    </>
  );
}
