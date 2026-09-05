'use client';

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
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
import { derivarPaleta, contraste, RAICES_DEFECTO } from '@/lib/config/palette-derive';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';

// ─── Bloque COLORES DE LA TIENDA — vive en /admin/tienda, SOBRE el selector de página ────────────
//
// La paleta es la PIEL de TODO el storefront (nav, footer, cada página), ortogonal a las páginas —
// por eso su bloque va SOBRE `TiendaPaginas`, no dentro de una pestaña—. El cliente elige 3 RAÍCES
// —fondo·tinta·acento—; el motor deriva las demás y las inyecta el layout del storefront.
//
// Adopta el CONTRATO de borrador de las secciones vecinas (§ TiendaSeccionEditor): read↔edit +
// AUTOGUARDADO del borrador (`useAutoguardado`) + píldora "Sin publicar" + Publicar/Descartar +
// `ConfirmDescartarDialog`. Una sola conducta en la pantalla —Tienda es "lo que se publica"; la
// paleta se mudó de SiteSetting (donde guardar=publicar al instante) a `content.tema` para ganar
// ese flujo (§ doctrina: la frontera borrador/no-borrador es de PANTALLA).
//
// DOS diferencias con las secciones, ambas por la validación DURA de la paleta (hex-6, todo-o-nada):
//  · el autoguardado dispara SÓLO en estados VÁLIDOS (§ el guard `esValido`): un acento a medio
//    teclear no es un guardado parcial, es un 400 — el error inline lo cubre y guarda solo al volver
//    a ser válido;
//  · "Usar el tema por defecto" es un RESET DIRECTO —publica las 3 raíces en NULL al instante (misma
//    clase que el toggle de página: config, no contenido en revisión)—, con CONFIRMACIÓN porque borra
//    el trabajo sin publicar y resetea lo publicado sin vuelta atrás.
//
// HÍBRIDO (owner): BASES curadas para fondo+tinta (garantizan el contraste bg↔texto) + picker LIBRE
// para el acento. El PISO de contraste y el auto-flip cubren lo derivado; el aviso, lo que el cliente
// elige. Avisa, NO bloquea — es su tienda.

// Los defaults de código (§ globals.css `--sf-*`) = la paleta de Nayoli. Raíces null → estos.
// FUENTE ÚNICA con los correos (§ email-colors): mismo `RAICES_DEFECTO` de palette-derive.
const DEFAULT_RAICES = RAICES_DEFECTO;

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

const HEX6 = /^#[0-9a-fA-F]{6}$/;

// El seed de cada raíz para el FORM (que renderiza pickers, y por eso siempre necesita un hex) cae al
// default cuando el valor guardado en `content.tema` NO es un hex válido —null (fábrica), undefined,
// vacío o basura—, no sólo cuando es nullish. El `content.tema` ya viene resuelto por `resolverTema`
// (hex-o-null), así que en la práctica se recibe hex o null; esta función mapea el null de fábrica al
// hex de defecto para que el picker tenga algo que mostrar. La distinción fábrica/custom NO sale de
// acá —sale de si la raíz venía en null— (§ `esFabrica` en el componente).
function raizValida(v: string | null, def: string): string {
  return v && HEX6.test(v) ? v : def;
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

/** El preview INLINE: el fragmento escalado por ancho (`EscalaDesktop` grande). AMPLIABLE SÓLO en
 *  edición (`onAmpliar` presente) — en lectura el owner no está afinando nada, así que el chip y el
 *  cursor-zoom no tienen razón de ser y no aparecen. El botón de ampliar es un HERMANO absoluto que
 *  cubre el preview —NO un wrapper—: envolver el fragmento en un `<button>` anidaría los
 *  `<a>`/`<button>` del ProductCard dentro de un botón, que es HTML inválido. El fragmento es
 *  `pointer-events:none`, así que el clic pasa al botón de encima. */
function PreviewTiendaReal({ raices, nombre, onAmpliar }: { raices: Form; nombre: string; onAmpliar?: () => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <EscalaDesktop style={{ borderRadius: 14, overflow: 'hidden' }}>
        <FragmentoTienda raices={raices} nombre={nombre} />
      </EscalaDesktop>
      {onAmpliar && (
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
      )}
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

/** Un aviso de contraste, PEGADO al control que lo causa (§ Fix 3) — ámbar (`--duna-sol-ink` =
 *  atención), no rojo: avisa, no bloquea (es su tienda). */
function Aviso({ children }: { children: string }) {
  return (
    <p className="duna-caption" role="status"
       style={{ color: 'var(--duna-sol-ink)', lineHeight: 1.4, marginTop: 'var(--duna-space-2)', marginBottom: 0 }}>
      ⚠ {children}
    </p>
  );
}

export default function PaletaSeccion() {
  const settings = useSiteSettings(); // sólo para el `nombre` del wordmark del preview

  const [cargando, setCargando]           = useState(true);
  const [errorCarga, setErrorCarga]       = useState<string | null>(null);
  const [form, setForm]                   = useState<Form | null>(null);
  const [esFabrica, setEsFabrica]         = useState(true);   // el tema draft-merged son las 3 raíces en null (defaults de código)
  const [hayBorrador, setHayBorrador]     = useState(false);
  const [editando, setEditando]           = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [procesando, setProcesando]       = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [confirmandoFabrica, setConfirmandoFabrica]   = useState(false);
  const [ampliado, setAmpliado]           = useState(false);

  const formRef = useRef<Form | null>(null); formRef.current = form;

  // AUTOGUARDADO del borrador del tema — la MISMA máquina que las secciones (§ useAutoguardado). Sólo
  // se ensucia con una paleta VÁLIDA (§ `cambiar`); un PUT con un hex a medias sería un 400.
  const guardarTema = useCallback(async (raices: Form) => {
    const res = await fetch('/api/site-content/tema', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paletaFondo: raices.fondo, paletaTinta: raices.tinta, paletaAcento: raices.acento }),
    });
    if (!res.ok) throw new Error('No se pudo guardar');
  }, []);
  const auto = useAutoguardado(guardarTema);

  // Carga el tema draft-merged (GET /api/site-content → `contenido.tema` + `sinPublicar.tema`). El
  // FORM siempre tiene hexes (el picker los necesita); la distinción fábrica/custom sale de si la
  // raíz venía en null.
  const cargar = useCallback(async (inicial = false) => {
    try {
      const r = await fetch('/api/site-content');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const t = (d.contenido?.tema ?? {}) as { fondo?: string | null; tinta?: string | null; acento?: string | null };
      setForm({
        fondo:  raizValida(t.fondo  ?? null, DEFAULT_RAICES.fondo),
        tinta:  raizValida(t.tinta  ?? null, DEFAULT_RAICES.tinta),
        acento: raizValida(t.acento ?? null, DEFAULT_RAICES.acento),
      });
      setEsFabrica(t.fondo == null);          // sin raíces guardadas = fábrica (defaults de código)
      setHayBorrador(!!d.sinPublicar?.tema);
      if (inicial) setCargando(false);
    } catch {
      if (inicial) { setErrorCarga('No se pudieron cargar los colores.'); setCargando(false); }
    }
  }, []);
  useEffect(() => { cargar(true); }, [cargar]);

  // beforeunload SÓLO en 'error' (§ decisión), igual que las secciones: pendiente/guardando es común
  // y recuperable; un guardado que FALLÓ y no persiste es el caso grave.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  const esValido = (f: Form) => HEX6.test(f.fondo) && HEX6.test(f.tinta) && HEX6.test(f.acento);

  // Un cambio de raíz: pisa el form y —SI queda válido— marca borrador y ensucia el autoguardado. Si
  // el acento quedó inválido (a medio teclear), NO se guarda: el error inline lo cubre, y el PRÓXIMO
  // cambio que lo devuelva a hex válido dispara el autoguardado SOLO, sin que el operador toque nada
  // más. El picker de BASE y el `type=color` siempre producen hex válido.
  const cambiar = (parcial: Partial<Form>) => {
    const nf = { ...(formRef.current as Form), ...parcial };
    setForm(nf);
    setEsFabrica(false);                 // elegir colores = tema custom
    if (esValido(nf)) { setHayBorrador(true); auto.marcarSucio(nf); }
  };

  const elegirBase = (b: (typeof BASES)[number]) => cambiar({ fondo: b.fondo, tinta: b.tinta });
  const cerrarEdicion = () => { auto.flush(); setEditando(false); };

  // Publicar / Descartar el borrador del tema (POST /api/site-content/tema). Publicar deja lo editado
  // en vivo; descartar recarga el form a lo publicado (el preview también vuelve).
  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    setErrorServidor(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content/tema', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorServidor(d?.error ?? (accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.'));
        return;
      }
      if (accion === 'publicar') { setHayBorrador(false); toast.success('Publicado — ya está en vivo.'); }
      else { await cargar(); toast.success('Cambios descartados — volviste a lo publicado.'); }
    } finally { setProcesando(false); }
  };

  // Volver a FÁBRICA: publica las 3 raíces en NULL al instante (RESET DIRECTO, misma clase que el
  // toggle de página — config, no contenido en revisión). NULL, no los hexes de Nayoli: publicar los
  // hexes los pasaría por el motor de derivación y dejaría una APROXIMACIÓN; el null → sin <style> →
  // los `--sf-*` exactos de globals.css (§ byte-idéntico). CONFIRMA porque borra el trabajo sin
  // publicar Y resetea lo publicado sin vuelta atrás. (Cubre "me perdí" → fábrica; NO "volver a mi
  // tema custom anterior", que es historial y sigue descartado — § Backlog #55.)
  const resetFabrica = async () => {
    setConfirmandoFabrica(false);
    setErrorServidor(null); setProcesando(true);
    try {
      const put = await fetch('/api/site-content/tema', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paletaFondo: null, paletaTinta: null, paletaAcento: null }),
      });
      if (!put.ok) { const d = await put.json().catch(() => null); setErrorServidor(d?.error ?? 'No se pudo aplicar el tema por defecto.'); return; }
      const post = await fetch('/api/site-content/tema', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'publicar' }),
      });
      if (!post.ok) { const d = await post.json().catch(() => null); setErrorServidor(d?.error ?? 'No se pudo aplicar el tema por defecto.'); return; }
      await cargar();
      toast.success('Volviste al tema por defecto.');
    } finally { setProcesando(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="duna-card duna-card__pad" role="status">
        <span className="duna-sr-only">Cargando los colores de la tienda…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '440px', aspectRatio: '3 / 4', borderRadius: 14 }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudieron cargar los colores.'}</p>
      </div>
    );
  }

  // Derivados (form ya no es null). El mapa COMPLETO lo da `derivarPaleta`; con un acento inválido
  // (a medio teclear) los derivados salen basura, así que lo dependiente del acento se muestra sólo
  // cuando es válido (el error inline cubre el ínterin).
  const baseActiva = BASES.find(b => b.fondo === form.fondo && b.tinta === form.tinta);
  const acentoInvalido = !HEX6.test(form.acento);
  const derivada = derivarPaleta(form);
  const acentoTxt = derivada['acento-txt'];
  // Los 19 DERIVADOS (todo menos las 3 raíces editables), en el orden en que los produce el motor.
  const derivados = Object.keys(derivada).filter(k => k !== 'fondo' && k !== 'tinta' && k !== 'acento');
  const razon = (a: string, b: string) => contraste(a, b).toFixed(1); // "8.4" — la razón que contraste() calcula
  // Los AVISOS de contraste van PEGADOS al control que los causa (§ Fix 3), no en una pila bajo el
  // preview. Base → texto sobre fondo; Acento → texto del botón (auto-flip) y acento contra fondo.
  const avisoBaseTexto   = !acentoInvalido && contraste(form.tinta, form.fondo) < 4.5;
  const avisoBotonTexto  = !acentoInvalido && contraste(acentoTxt, form.acento) < 4.5;
  const avisoAcentoFondo = !acentoInvalido && contraste(form.acento, form.fondo) < 1.35;

  const puedePublicar = auto.estado === 'guardado' && !procesando;
  const enError = auto.estado === 'error';
  const mostrarEstado = editando || auto.estado !== 'guardado';
  const estadoTexto = auto.estado === 'guardando' ? 'Guardando…' : auto.estado === 'error' ? 'No se pudo guardar' : 'Guardado';
  const indicadorEstado = mostrarEstado ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
      <span className={enError ? 'duna-field__error' : 'duna-caption'} style={{ margin: 0 }} role={enError ? 'alert' : undefined}>
        {estadoTexto}
      </span>
      {enError && (
        <button type="button" onClick={() => auto.reintentar()} className="duna-btn duna-btn--ghost duna-btn--sm">Reintentar</button>
      )}
    </div>
  ) : null;

  // El botón de fábrica se ofrece cuando hay algo NO-fábrica que resetear (tema custom o un borrador).
  const puedeResetear = !esFabrica || hayBorrador;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">Colores de la tienda</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
          </div>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            El fondo, la tinta del texto y el acento de marca — la piel de todo el storefront. Eliges
            tres colores y el resto de la paleta se calcula sola; publica cuando esté listo.
          </p>
          {editando && indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
        {/* LECTURA: Editar. EDICIÓN: Cerrar / Descartar / Publicar. Publicar y Descartar esperan al
            autoguardado (`!puedePublicar`) porque MUTAN; "Cerrar" NO muta (el borrador queda), así que
            nunca se deshabilita. Publicar además se apaga con el acento inválido: no se publica un form
            que muestra un valor que no es hex. */}
        {!editando ? (
          <button type="button" onClick={() => setEditando(true)} className="duna-btn duna-btn--secondary" style={{ flexShrink: 0 }}>
            <Pencil /> Editar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
            <button type="button" onClick={cerrarEdicion} className="duna-btn duna-btn--secondary">Cerrar</button>
            {hayBorrador && (
              <button type="button" onClick={() => setConfirmandoDescarte(true)} className="duna-btn duna-btn--ghost" disabled={!puedePublicar}>
                Descartar
              </button>
            )}
            {hayBorrador && (
              <button type="button" onClick={() => accionBorrador('publicar')} className="duna-btn duna-btn--primary" disabled={!puedePublicar || acentoInvalido}>
                {procesando ? 'Publicando…' : 'Publicar'}
              </button>
            )}
          </div>
        )}
      </div>

      {editando ? (
        // EDICIÓN: la vista previa pasa a la COLUMNA del split (sticky ≥1080), como las secciones
        // (§ Fix 3); los controles van como TRES piezas sobre el panel recesado (§ Fix 2, mismo
        // lenguaje que el editor de secciones). "Ampliar" se conserva.
        <div className="tienda-vivo tienda-vivo--editando" style={{ marginTop: 'var(--duna-space-4)' }}>
          <div className="tienda-vivo__vista">
            <PreviewTiendaReal raices={form} nombre={settings.nombre} onAmpliar={() => setAmpliado(true)} />
          </div>

          <div className="tienda-vivo__form">
            <div className="tienda-form">
              {/* PIEZA 1 · BASE (fondo + tinta): cada base con su muestra "Aa" (tinta sobre fondo) y su
                  razón de contraste escrita (`contraste()` ya la calcula). El aviso de "texto sobre
                  fondo" se pega ACÁ, donde se elige la base. */}
              <div className="tienda-form__bloque">
                <span className="duna-field__label">Base (fondo y texto)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginTop: '6px' }}>
                  {BASES.map(b => {
                    const activa = baseActiva?.label === b.label;
                    return (
                      <button
                        key={b.label} type="button" onClick={() => elegirBase(b)} aria-pressed={activa}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px 8px',
                          borderRadius: 'var(--duna-r-l)', cursor: 'pointer',
                          border: `1px solid ${activa ? 'var(--duna-ink)' : 'var(--duna-border)'}`,
                          background: activa ? 'var(--duna-surface)' : 'transparent',
                          boxShadow: activa ? 'var(--duna-shadow-1)' : 'none',
                        }}
                      >
                        {/* La muestra "Aa": tinta sobre fondo — la prueba REAL de legibilidad de la base. */}
                        <span aria-hidden style={{
                          display: 'grid', placeItems: 'center', width: 34, height: 30, borderRadius: 8,
                          background: b.fondo, color: b.tinta, border: '1px solid var(--duna-border)',
                          fontWeight: 700, fontSize: 14, lineHeight: 1,
                        }}>Aa</span>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                          <span className="duna-body" style={{ fontSize: 13, fontWeight: activa ? 600 : 500 }}>{b.label}</span>
                          <span className="duna-caption" style={{ margin: 0 }}>Contraste {razon(b.tinta, b.fondo)}:1</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {avisoBaseTexto && <Aviso>El texto principal puede costar de leer sobre este fondo. Prueba una base más contrastada.</Aviso>}
              </div>

              {/* PIEZA 2 · ACENTO (picker libre): con el auto-flip del texto del botón DECLARADO
                  ("blanco, 8.4:1" en vez de invisible). Los avisos del acento van pegados ACÁ. */}
              <div className="tienda-form__bloque">
                <label className="duna-field__label" htmlFor="pal-acento">Acento de marca</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: '6px' }}>
                  <input
                    id="pal-acento" type="color"
                    value={HEX6.test(form.acento) ? form.acento : '#8b4513'}
                    onChange={e => cambiar({ acento: e.target.value })}
                    style={{ width: 44, height: 36, padding: 0, border: '1px solid var(--duna-border)', borderRadius: 'var(--duna-r-m)', background: 'none', cursor: 'pointer' }}
                    aria-label="Elegir color de acento"
                  />
                  <input
                    className="duna-input" style={{ width: 130, fontFamily: 'var(--duna-font-mono)' }}
                    value={form.acento} onChange={e => cambiar({ acento: e.target.value })}
                    aria-invalid={acentoInvalido || undefined}
                  />
                </div>
                {acentoInvalido ? (
                  <p className="duna-field__error" style={{ marginTop: '4px', marginBottom: 0 }}>Usa un hex de 6 dígitos, p. ej. #8b4513.</p>
                ) : (
                  // AUTO-FLIP DECLARADO: el texto del botón de acento es FIJO (el cliente no lo elige) —
                  // blanco o tinta, el que más contraste—. Se dice cuál y con cuánto, en vez de dejarlo
                  // como un valor invisible que el operador no puede verificar.
                  <p className="duna-caption" style={{ marginTop: '6px', marginBottom: 0 }}>
                    Texto del botón: <b>{acentoTxt.toLowerCase() === '#ffffff' ? 'blanco' : 'oscuro'}</b> · contraste {razon(acentoTxt, form.acento)}:1
                  </p>
                )}
                {avisoBotonTexto && <Aviso>El texto del botón puede costar de leer sobre este acento. Prueba un acento más oscuro o más claro.</Aviso>}
                {avisoAcentoFondo && <Aviso>El acento casi no se distingue del fondo: los botones y detalles pueden perderse.</Aviso>}
              </div>

              {/* PIEZA 3 · LO QUE SE CALCULA SOLO: los 19 derivados, COLAPSADOS, visibles pero NO
                  editables. `derivarPaleta` ya devuelve el mapa completo; esto es renderizarlo. */}
              {!acentoInvalido && (
                <div className="tienda-form__bloque">
                  <details>
                    <summary style={{ cursor: 'pointer' }}>
                      <span className="duna-field__label">Lo que se calcula solo</span>
                    </summary>
                    <p className="duna-caption" style={{ marginTop: '4px' }}>
                      El resto de la paleta se deriva de tus tres colores. No se edita.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-2)' }}>
                      {derivados.map(nombre => (
                        <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span aria-hidden style={{ width: 22, height: 22, borderRadius: 6, background: derivada[nombre], border: '1px solid var(--duna-border)', flexShrink: 0 }} />
                          <span style={{ minWidth: 0 }}>
                            <span className="duna-caption" style={{ display: 'block', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
                            <span style={{ display: 'block', fontFamily: 'var(--duna-font-mono)', fontSize: 11, color: 'var(--duna-muted)' }}>{derivada[nombre]}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {errorServidor && <p className="duna-field__error" role="alert" style={{ margin: 0 }}>{errorServidor}</p>}

              {/* Escape hatch a FÁBRICA — reset DIRECTO con confirmación; empujado a la derecha (es un
                  reset, no el par publicar/descartar). Sólo con algo que resetear. */}
              {puedeResetear && (
                <div style={{ display: 'flex' }}>
                  <button
                    type="button" onClick={() => setConfirmandoFabrica(true)} disabled={procesando}
                    className="duna-btn duna-btn--ghost" style={{ marginLeft: 'auto' }}
                  >
                    Usar el tema por defecto
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="duna-card duna-card__pad" style={{ marginTop: 'var(--duna-space-4)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-5)', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 300px', maxWidth: 440 }}>
              <PreviewTiendaReal raices={form} nombre={settings.nombre} />
            </div>
            <p className="duna-sub" style={{ margin: 0, maxWidth: '24rem' }}>
              {esFabrica
                ? <>Estás usando los colores de fábrica. Edita para elegir los tuyos.</>
                : <>Base <b>{baseActiva?.label ?? 'personalizada'}</b>, con tu acento. Así se ve tu tienda.</>}
            </p>
          </div>
        </div>
      )}

      <ConfirmDescartarDialog
        abierto={confirmandoDescarte}
        onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
        onSeguir={() => setConfirmandoDescarte(false)}
        titulo="¿Descartar los cambios sin publicar?"
        descripcion="Volverás a los colores publicados. El borrador se perderá y no se puede recuperar."
        confirmLabel="Descartar borrador"
        seguirLabel="Conservar"
      />

      <ConfirmDescartarDialog
        abierto={confirmandoFabrica}
        onDescartar={resetFabrica}
        onSeguir={() => setConfirmandoFabrica(false)}
        titulo="¿Volver al tema por defecto?"
        descripcion="La tienda vuelve a los colores de fábrica al instante. Se descarta cualquier cambio sin publicar y no se puede deshacer."
        confirmLabel="Usar el tema por defecto"
        seguirLabel="Conservar mis colores"
      />

      {/* Ampliar: el mismo fragmento en grande con las raíces actuales (form) → vivo por construcción. */}
      <AmpliarOverlay abierto={ampliado} onCerrar={() => setAmpliado(false)} raices={form} nombre={settings.nombre} />
    </>
  );
}
