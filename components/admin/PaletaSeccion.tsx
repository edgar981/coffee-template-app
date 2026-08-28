'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useSiteSettings } from '@/components/admin/SiteSettingsProvider';
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
// el acento va aparte. La primera es la de Nayoli (Café).
const BASES: { label: string; fondo: string; tinta: string }[] = [
  { label: 'Café',    fondo: '#faf7f4', tinta: '#1a0f08' },
  { label: 'Neutro',  fondo: '#f6f5f3', tinta: '#1c1a18' },
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

/** El fragmento de tienda RECONOCIBLE (no swatches): titular, párrafo, franja, precio,
 *  BOTÓN con su texto auto-volteado, y un enlace. Se pinta con la paleta DERIVADA de las
 *  raíces del form — es lo mismo que verá el cliente, con el botón mostrando el flip. */
function PreviewTienda({ raices }: { raices: Form }) {
  const p = derivarPaleta(raices);
  const vars = Object.fromEntries(Object.entries(p).map(([k, v]) => [`--sf-${k}`, v])) as CSSProperties;
  const S = (k: string) => `var(--sf-${k})`;
  return (
    <div style={vars}>
      <div style={{ background: S('fondo'), border: `1px solid ${S('linea')}`, borderRadius: 12, padding: '20px 22px' }}>
        <p style={{ color: S('texto-suave'), fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 8px' }}>Edición limitada</p>
        <h4 style={{ color: S('tinta'), fontSize: 22, lineHeight: 1.1, margin: '0 0 8px', fontWeight: 700 }}>Lo bueno se hace despacio.</h4>
        <p style={{ color: S('texto'), fontSize: 14, lineHeight: 1.55, margin: '0 0 14px', maxWidth: '42ch' }}>
          Cada pieza pasa por manos que la conocen. Elegimos los materiales y cuidamos el detalle.
        </p>
        <div style={{ background: S('superficie'), borderRadius: 8, padding: '7px 11px', fontSize: 13, color: S('texto'), margin: '0 0 16px' }}>
          Envío gratis desde <b style={{ color: S('acento-texto') }}>$80.000</b>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: S('tinta'), fontSize: 20, fontWeight: 700 }}>$ 48.000</span>
          {/* EL BOTÓN — bg acento, texto `acento-txt` (auto-flip). Acá el cliente ve que su
              acento (incluso un neón) tiene texto legible, o que su elección se ve rara. */}
          <button type="button" style={{ background: S('acento'), color: S('acento-txt'), border: 0, borderRadius: 9, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'default' }}>
            Agregar al carrito
          </button>
        </div>
        <a style={{ display: 'inline-block', marginTop: 14, fontSize: 13, fontWeight: 600, color: S('acento-texto'), borderBottom: `2px solid ${S('tostado')}`, paddingBottom: 1, textDecoration: 'none' }}>
          Ver detalles →
        </a>
      </div>
    </div>
  );
}

export default function PaletaSeccion() {
  const settings = useSiteSettings();
  const router   = useRouter();
  const guarda   = useAccionGuardada();

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
      router.refresh();
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
                <PreviewTienda raices={form} />
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
              <PreviewTienda raices={desdeSettings(settings)} />
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
