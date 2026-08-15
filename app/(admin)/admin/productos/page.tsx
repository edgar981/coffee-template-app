'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Package, Plus } from 'lucide-react';
import { OrderCard } from '@duna/design-system/components/OrderCard';
import { SearchField } from '@duna/design-system/components/SearchField';
import { SkeletonOrderCards } from '@duna/design-system/components/SkeletonOrderCard';
import { ItemsTable } from '@duna/design-system/components/ItemsTable';
import { formatCOP } from '@duna/core/utils';
import { formatFecha } from '@duna/core/format-fecha';
import { toast } from 'sonner';
import { getProducts, deleteProduct, updateProduct } from '@/lib/api/products';
import { getInventoryLogs } from '@/lib/api/inventory';
import { accionEstadoProducto, alternativaAlEliminar } from '@duna/core/product-form';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { useEsMovil } from '@/hooks/useEsMovil';
import { ProductFormModal } from '@/components/admin/ProductFormModal';
import { AdjustStockModal } from '@/components/admin/AdjustStockModal';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { ImageLightbox } from '@/components/admin/ImageLightbox';
import { CATEGORIAS } from '@/constants/product';
import {
  CARRILES_PRODUCTOS, aplicarCarril, aplicarCategoria, conteosProductos,
  carrilPorKey, buscarProductos, type CarrilKey,
} from '@/lib/productos/filtros';
import { nivelStock, etiquetaStock, claseStock } from '@/lib/productos/stock';
import type { Product, ProductCategory } from '@/types/product';
import type { InventoryLog } from '@/types/inventory';

// ═══ PRODUCTOS · la tercera vertical del rediseño Duna OS ════════════════════
//
// Se construye SOLO con primitivas de @duna/design-system. Cero valores nuevos:
// ni un color, ni un espaciado, ni un radio inventado acá. Los huecos que
// aparecieron se llenaron EN EL SISTEMA, cada uno en su commit — el marco de
// imagen, el control segmentado, la ranura de medio de `order-card` y la rejilla
// de tarjetas.
//
// Vivió en `/admin/productos-v2` mientras convivía con la pantalla vieja; heredó
// `/admin/productos` al retirarse aquélla, y los enlaces a `-v2` los atiende
// `lib/redirect-productos` (§ proxy.ts). Mismo camino que Pedidos y Clientes.
//
// ── EL TOGGLE DECIDE EL LAYOUT (decisión del owner) ─────────────────────────
//
// Lista → `duna-split`: la anatomía de siempre, lista de 400px + panel que se
// queda. Cuadrícula → ancho completo y el detalle sube como sheet.
//
// El costo de tener DOS layouts lo paga quien ELIGIÓ el modo, y cada modo
// responde una pregunta distinta: cuadrícula = ver muchos, lista = trabajar sobre
// uno. En angosto la distinción desaparece —el detalle ya es sheet en los dos—,
// así que el toggle sólo cambia la forma de la lista.
//
// Las dos alternativas se descartaron con motivo: meter la cuadrícula DENTRO de
// los 400px del split la convierte en una lista con fotos (el toggle dejaría de
// ofrecer una elección real), y mandar los dos modos a ancho completo rompe la
// anatomía compartida sin necesidad, porque Lista sí cabe en el split.
//
// ── `?producto=` CAMBIÓ DE SIGNIFICADO, Y ES EL CAMBIO MÁS SILENCIOSO ───────
//
// En la pantalla vieja abría el MODAL DE EDITAR; acá SELECCIONA, coherente con
// `?pedido=` y `?cliente=`. La ruta es la misma y lo que cambia es el sentido del
// parámetro, así que ningún redirect lo atiende (§ redirect-productos): los
// `admin:cmdk-recents` congelados en el navegador de cada operador, y el enlace de
// SKU de Analítica, seleccionan en vez de editar. Es aceptable —seleccionar es
// menos destructivo que abrir un formulario, y desde Analítica es hasta más
// correcto—, y la edición queda a un clic en el detalle.
//
// ── LO QUE ESTA PANTALLA NO MUESTRA, Y POR QUÉ ──────────────────────────────
//
// No hay "% de margen" en la tarjeta. Es cifra de NEGOCIO, no de operación: no
// cambia ninguna decisión del día y ya vive en la tabla de rentabilidad por SKU
// de Analítica (§ backlog — los totales de negocio son de Analítica). La pantalla
// vieja lo pintaba en cada card. El COSTO sí está, pero en el detalle, que es
// donde se edita la ficha.
//
// Tampoco hay barra de stock: `.duna-stock-meter` necesita un denominador que el
// dominio no tiene (§ lib/productos/stock).

/** Lo que la tarjeta pone en la ranura de estado — o nada. */
function badgeStock(p: Product): { label: string; tone: 'attention' | 'problem' } | undefined {
  const etiqueta = etiquetaStock(p);
  if (!etiqueta) return undefined;
  return { label: etiqueta, tone: nivelStock(p) === 'agotado' ? 'problem' : 'attention' };
}

export default function ProductosPage() {
  return <Suspense fallback={null}><Productos /></Suspense>;
}

function Productos() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const [productos, setProductos] = useState<Product[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const esMovil = useEsMovil();

  // EL MODO DE VISTA ES ESTADO LOCAL, no de la URL. Es una preferencia de quien
  // mira, no parte de QUÉ se está mirando: un enlace no debería imponerle a otro
  // operador la forma en que ve su catálogo. Es la misma línea que deja la
  // búsqueda fuera de la URL y el carril adentro.
  const [vista, setVista] = useState<'cuadricula' | 'lista'>('cuadricula');

  // El carril, la categoría y la selección viven en la URL: el detalle es
  // enlazable y sobrevive a un refresh.
  const carril    = (carrilPorKey(params.get('f') ?? '')?.key ?? 'todos') as CarrilKey;
  const categoria = params.get('cat');
  const seleccion = params.get('producto');

  // LA BÚSQUEDA NO VA A LA URL: es una consulta en curso, no un estado que valga
  // la pena compartir, y cada tecla dejaría una entrada en el historial.
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    let vivo = true;
    getProducts()
      .then(d => { if (vivo) { setProductos(d); setError(null); } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar productos'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  // El orden importa y es el mismo que en Pedidos: la búsqueda es la BASE, la
  // categoría acota, y el carril se aplica encima. Los conteos de los pills se
  // calculan sobre lo que hay DEBAJO del alcance puesto, así que "Por reponer · 2"
  // dice dos entre los encontrados de esa categoría.
  const encontrados = useMemo(() => buscarProductos(productos, busqueda), [productos, busqueda]);
  const enAlcance   = useMemo(() => aplicarCategoria(encontrados, categoria), [encontrados, categoria]);
  const visibles    = useMemo(() => aplicarCarril(enAlcance, carril), [enAlcance, carril]);
  const cuentas     = useMemo(() => conteosProductos(enAlcance), [enAlcance]);

  // LO ELEGIDO SE BUSCA EN LA LISTA COMPLETA, no en la recortada: un `?producto=`
  // que caiga fuera del carril o de la búsqueda en curso tiene que abrir igual.
  // Acá muerde fácil porque la búsqueda es estado LOCAL — teclear con un producto
  // abierto le vaciaría el panel al operador sin que la URL cambiara.
  const elegido = useMemo(
    () => productos.find(p => p.id === seleccion) ?? null,
    [productos, seleccion],
  );

  // EL KARDEX DE ESE PRODUCTO lo trae el servidor al abrirse — la lista no lo
  // carga. Es la mitad de cliente de la frontera con Inventario: acá el kardex es
  // del producto que se está mirando; el completo (la auditoría) se queda allá.
  // Depende sólo del id, y el fallo lleva el id al que pertenece, así que un error
  // viejo deja de corresponder al cambiar de producto.
  const [kardex, setKardex] = useState<{ id: string; logs: InventoryLog[] } | null>(null);
  const [falloKardex, setFalloKardex] = useState<{ id: string; msg: string } | null>(null);

  const idElegido = elegido?.id ?? null;
  useEffect(() => {
    if (!idElegido) return;
    let vivo = true;
    getInventoryLogs(idElegido)
      .then(logs => { if (vivo) setKardex({ id: idElegido, logs }); })
      .catch(e => { if (vivo) setFalloKardex({ id: idElegido, msg: e instanceof Error ? e.message : 'Error al cargar los movimientos' }); });
    return () => { vivo = false; };
  }, [idElegido]);

  const kardexVigente  = kardex?.id === idElegido ? kardex.logs : null;
  const errorKardex    = falloKardex?.id === idElegido ? falloKardex.msg : null;
  const cargandoKardex = !!idElegido && !kardexVigente && !errorKardex;

  // ═══ MUTACIONES · viven en LA PÁGINA, no en el panel ═══════════════════════
  //
  // El panel se desmonta al cambiar de producto, así que una mutación montada ahí
  // puede perder su continuación (§ el gate del 2026-08-06). Acá arriba el peor
  // caso es que el panel reabra ya con el cambio aplicado.
  const [editando, setEditando]         = useState<Product | null>(null);
  const [creando, setCreando]           = useState(false);
  const [borrando, setBorrando]         = useState<Product | null>(null);
  const [activarTarget, setActivarTarget] = useState<Product | null>(null);
  const [ajustando, setAjustando]         = useState<Product | null>(null);
  const [lightbox, setLightbox]         = useState<{ src: string; alt: string } | null>(null);
  const formAbierto = creando || !!editando;

  const guardado = useCallback((p: Product, modo: 'creado' | 'actualizado') => {
    setProductos(prev => modo === 'creado' ? [p, ...prev] : prev.map(x => x.id === p.id ? p : x));
    toast.success(modo === 'creado' ? 'Producto creado' : 'Producto actualizado');
    // El kardex del producto editado puede haber ganado un asiento: el campo Stock
    // del formulario es la SEGUNDA puerta y deja firma (§ Las DOS puertas). Se
    // invalida para que el panel lo vuelva a pedir en vez de mostrar el de antes.
    setKardex(k => k?.id === p.id ? null : k);
  }, []);

  // EL AJUSTE CIERRA LA FICHA: cambia el stock del producto Y agrega un asiento a
  // su kardex. Las dos cosas se aplican acá en vez de re-pedir la lista — el log
  // que devuelve el endpoint es el mismo que el GET traería, y el orden del kardex
  // es descendente, así que encabeza.
  const ajustado = useCallback(({ product, log }: { product: Product; log: InventoryLog }) => {
    setProductos(prev => prev.map(p => p.id === product.id ? product : p));
    setKardex(k => k?.id === product.id ? { id: k.id, logs: [log, ...k.logs] } : k);
    toast.success('Inventario actualizado');
  }, []);

  const navegar = useCallback((cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) q.delete(k); else q.set(k, v);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const cambiarEstado = async (p: Product, activo: boolean) => {
    // PATCH de UN campo, que es exactamente el caso que el endpoint tiene que
    // respetar (§ El PATCH de producto es PARCIAL de verdad): escribe `activo` y
    // no toca nada más. Antes del arreglo, este llamado vaciaba la ficha entera y
    // le borraba los blobs.
    const actualizado = await updateProduct(p.id, { activo });
    setProductos(prev => prev.map(x => x.id === p.id ? actualizado : x));
  };

  // El detalle se escribe UNA vez: vive en el panel (ancho + lista) o en el sheet,
  // nunca en los dos. Dos juegos de props del mismo componente es cómo una de las
  // dos superficies se queda sin un dato y nadie lo ve hasta abrirlo en un
  // teléfono.
  const detalleNodo = elegido ? (
    <Detalle
      producto={elegido}
      kardex={kardexVigente}
      cargandoKardex={cargandoKardex}
      errorKardex={errorKardex}
      onEditar={() => setEditando(elegido)}
      onEliminar={() => setBorrando(elegido)}
      onActivar={() => setActivarTarget(elegido)}
      onAjustar={() => setAjustando(elegido)}
      onVerImagen={(src, alt) => setLightbox({ src, alt })}
    />
  ) : null;

  // EL DETALLE SUBE COMO SHEET en angosto SIEMPRE, y en cuadrícula TAMBIÉN en
  // ancho: la rejilla ocupa el ancho completo, así que no hay columna al lado
  // donde ponerlo.
  const detalleEnSheet = esMovil || vista === 'cuadricula';

  const alternativa = alternativaAlEliminar(borrando);
  const accionActivar = accionEstadoProducto(activarTarget);

  return (
    // `.duna` es el reset de superficie del sistema (familia, tinta, tamaño base).
    <div className="duna">
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-4)', marginBottom: 'var(--duna-space-5)' }}>
        {/* SIN conteo bajo el título: el pill "Todos" ya lo dice, y ahí además
            FILTRA. Una cifra que repite a un control accionable le quita sitio a
            la respuesta sin agregar una. */}
        <h1 className="duna-display-m" style={{ minWidth: 0 }}>Productos</h1>
        <button
          type="button"
          className="duna-btn duna-btn--primary"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => setCreando(true)}
        >
          <Plus /> Nuevo producto
        </button>
      </header>

      {/* ── Buscador · la primitiva del sistema. Ella pinta el campo; QUÉ
          significa empatar con un producto vive en `lib/productos/filtros`. ── */}
      <div style={{ maxWidth: 'var(--duna-list-w)', marginBottom: 'var(--duna-space-4)' }}>
        <SearchField
          value={busqueda}
          onChange={setBusqueda}
          label="Buscar un producto"
          placeholder="Nombre o SKU…"
        />
      </div>

      {/* ── Carriles + alcance de categoría + modo de vista ───────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-5)' }}>
        {CARRILES_PRODUCTOS.map(c => (
          <button
            key={c.key}
            type="button"
            className={`duna-pill${carril === c.key ? ' is-on' : ''}`}
            aria-pressed={carril === c.key}
            onClick={() => navegar({ f: c.key === 'todos' ? null : c.key })}
          >
            {c.label}
            {/* EL NÚMERO SÓLO EN LAS COLAS (§ lib/carriles). `conteosProductos` ni
                siquiera calcula los acumuladores, así que la ausencia es del dato
                y no del render. El cero SÍ se muestra: "no hay nada por reponer"
                es una respuesta. */}
            {cuentas[c.key] !== undefined && (
              <span className="duna-mono" style={{ marginLeft: 'var(--duna-space-inline)' }}>{cuentas[c.key]}</span>
            )}
          </button>
        ))}

        {/* LA CATEGORÍA ES UN ALCANCE, no un carril: se combina con cualquiera de
            los cuatro pills en vez de apagarlos. Un select y no cuatro pills más
            porque son seis categorías y la fila pasaría a diez. */}
        <select
          className="duna-input duna-select duna-input--sm"
          // `width: auto` porque `.duna-input` es `width: 100%` (anatomía de
          // formulario); acá el control mide lo que dice su opción más larga.
          style={{ width: 'auto', marginLeft: 'var(--duna-space-2)' }}
          aria-label="Filtrar por categoría"
          value={categoria ?? ''}
          onChange={e => navegar({ cat: e.target.value || null })}
        >
          {/* Acá NO elegir SÍ es una respuesta válida —"todas"— así que el vacío es
              una opción de verdad y no lleva `disabled hidden`. */}
          <option value="">Todas las categorías</option>
          {(Object.entries(CATEGORIAS) as [ProductCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="duna-seg" role="group" aria-label="Modo de vista" style={{ marginLeft: 'auto' }}>
          <button type="button" aria-label="Cuadrícula" aria-pressed={vista === 'cuadricula'}
                  className={`duna-seg__item${vista === 'cuadricula' ? ' is-on' : ''}`}
                  onClick={() => setVista('cuadricula')}>
            <LayoutGrid />
          </button>
          <button type="button" aria-label="Lista" aria-pressed={vista === 'lista'}
                  className={`duna-seg__item${vista === 'lista' ? ' is-on' : ''}`}
                  onClick={() => setVista('lista')}>
            <List />
          </button>
        </div>
      </div>

      {error && <div className="duna-note" role="alert">{error}</div>}

      {/* LA CARGA OCUPA EL SITIO DE LA LISTA, con su forma. La fila de un producto
          ES una `order-card`, así que el hueco que reserva es el correcto. */}
      {!error && cargando && (
        <div className="duna-split">
          <div className="duna-split__list"><SkeletonOrderCards label="Cargando productos…" /></div>
        </div>
      )}

      {!error && !cargando && visibles.length === 0 && (
        <div className="duna-card duna-card__pad">
          {/* Tres vacíos distintos, y decir cuál evita que el operador crea que
              perdió algo: no hay productos · la búsqueda no encontró · el carril
              (o la categoría) está vacío. */}
          <p className="duna-sub" style={{ margin: 0 }}>
            {productos.length === 0
              ? 'Todavía no hay productos en el catálogo.'
              : encontrados.length === 0
                ? `Ningún producto coincide con "${busqueda.trim()}".`
                : 'Ningún producto en este carril.'}
          </p>
        </div>
      )}

      {/* ── CUADRÍCULA · ancho completo ───────────────────────────────────── */}
      {!error && !cargando && visibles.length > 0 && vista === 'cuadricula' && (
        <div className="duna-cards">
          {visibles.map(p => (
            <TarjetaProducto
              key={p.id}
              producto={p}
              seleccionado={p.id === seleccion}
              onAbrir={() => navegar({ producto: p.id })}
              onActivar={() => setActivarTarget(p)}
            />
          ))}
        </div>
      )}

      {/* ── LISTA · el split de siempre ───────────────────────────────────── */}
      {/* `|| elegido` — la otra mitad de buscar en la lista completa: sin él, un
          producto abierto se quedaría sin dónde pintarse en cuanto la búsqueda o
          el carril vaciaran la lista. */}
      {!error && !cargando && (visibles.length > 0 || elegido) && vista === 'lista' && (
        <div className="duna-split">
          <div className="duna-split__list">
            {visibles.map(p => (
              <OrderCard
                key={p.id}
                title={p.nombre}
                id={p.sku ?? undefined}
                amount={formatCOP(p.precio)}
                // El medio: la primitiva del sistema, con el reemplazo puesto por
                // el consumidor cuando no hay foto.
                media={<Miniatura producto={p} />}
                channel={<span className={`${claseStock(p)} duna-caption`}>{textoStock(p)}</span>}
                status={badgeStock(p)}
                // SIN `steps`, y la ausencia es la respuesta: un producto no tiene
                // un camino que recorrer.
                steps={undefined}
                selected={p.id === seleccion}
                onClick={() => navegar({ producto: p.id })}
              />
            ))}
          </div>

          {!detalleEnSheet && (
            <div className="duna-split__panel">
              {!elegido && (
                <div className="duna-card duna-card__pad">
                  <p className="duna-sub" style={{ margin: 0 }}>Elige un producto para ver su ficha.</p>
                </div>
              )}
              {detalleNodo}
            </div>
          )}
        </div>
      )}

      {/* EL MISMO DETALLE, en sheet. Va FUERA de los bloques de arriba para que un
          enlace profundo abra aunque la lista visible esté vacía, y el nodo es UNO
          para que las dos superficies no puedan discrepar. */}
      <DunaSheet
        abierto={detalleEnSheet && !!elegido}
        onCerrar={() => navegar({ producto: null })}
        titulo={elegido ? elegido.nombre : 'Ficha del producto'}
        descripcion="Precio, existencias, movimientos de inventario y las acciones disponibles."
      >
        <div className="duna-sheet__body">{detalleNodo}</div>
      </DunaSheet>

      {/* ═══ DIÁLOGOS · montados en la PÁGINA ═══════════════════════════════ */}
      <ProductFormModal
        open={formAbierto}
        product={editando}
        onOpenChange={(abierto) => { if (!abierto) { setCreando(false); setEditando(null); } }}
        onSaved={guardado}
      />

      <ConfirmDeleteDialog
        open={!!borrando}
        onOpenChange={(o) => { if (!o) setBorrando(null); }}
        title="Eliminar producto"
        entityLabel={borrando ? [borrando.nombre, borrando.sku].filter(Boolean).join(' · ') : ''}
        consequence={borrando && !borrando.activo
          ? 'Se eliminará permanentemente del catálogo. Esta acción no se puede deshacer. Ya está inactivo: no aparece en la tienda y su historial sigue intacto. Para devolverlo al catálogo, usa el badge "Inactivo" de su tarjeta.'
          : 'Se eliminará permanentemente del catálogo. Esta acción no se puede deshacer. Si tiene ventas registradas, desactívalo para conservar el historial.'}
        confirmLabel="Eliminar producto"
        successMessage="Producto eliminado"
        onConfirm={async () => {
          if (!borrando) return;
          // LANZA si el servidor rechaza (el 409 de "aparece en N órdenes"): el
          // diálogo se queda abierto y muestra el motivo, que es su contrato.
          await deleteProduct(borrando.id);
          setProductos(prev => prev.filter(p => p.id !== borrando.id));
          if (seleccion === borrando.id) navegar({ producto: null });
          setBorrando(null);
        }}
        // La alternativa NO destructiva, y sólo en una dirección: de acá nunca sale
        // una activación (§ `alternativaAlEliminar`, derivado y testeado). Activar
        // vive en el badge "Inactivo", que es el affordance que la promete.
        secondaryAction={alternativa && {
          label:          alternativa.label,
          onAction:       () => borrando ? cambiarEstado(borrando, alternativa.activo) : Promise.resolve(),
          successMessage: alternativa.successMessage,
        }}
      />

      {/* Activar, disparado por el badge "Inactivo". Confirma —poner un producto
          en la tienda es una acción hacia afuera— pero NO destruye nada, así que
          `confirmKind="default"` lo pinta ámbar y no rojo. */}
      <ConfirmDeleteDialog
        open={!!activarTarget}
        onOpenChange={(o) => { if (!o) setActivarTarget(null); }}
        title="Activar producto"
        entityLabel={activarTarget ? [activarTarget.nombre, activarTarget.sku].filter(Boolean).join(' · ') : ''}
        consequence="Volverá al catálogo de la tienda y los clientes podrán comprarlo. Podrás desactivarlo de nuevo cuando quieras."
        confirmLabel="Activar producto"
        confirmKind="default"
        successMessage={accionActivar?.successMessage}
        onConfirm={async () => { if (activarTarget) await cambiarEstado(activarTarget, true); }}
      />

      {/* EL MISMO modal que monta Inventario. Acá entra CON producto, así que
          muestra el contexto en vez del selector: ofrecer una lista invitaría a
          ajustar otro producto desde la ficha de éste, y el error sería
          silencioso — el toast diría "inventario actualizado" igual. */}
      <AdjustStockModal
        open={!!ajustando}
        producto={ajustando}
        onOpenChange={(o) => { if (!o) setAjustando(null); }}
        onAplicado={ajustado}
      />

      <ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt} onClose={() => setLightbox(null)} />
    </div>
  );
}

/** El texto del stock: el número, y la palabra sólo si hay excepción que decir. */
function textoStock(p: Product): string {
  const etiqueta = etiquetaStock(p);
  if (nivelStock(p) === 'agotado') return 'Agotado';
  return etiqueta ? `${p.stock} · ${etiqueta.toLowerCase()}` : `${p.stock} en existencia`;
}

/** La miniatura de una fila: el marco del sistema, con el reemplazo del consumidor. */
function Miniatura({ producto }: { producto: Product }) {
  return (
    <div className="duna-tile duna-tile--sm">
      {producto.imagen
        ? <Image src={producto.imagen} alt="" fill sizes="44px" style={{ objectFit: 'cover' }} />
        : <Package aria-hidden="true" width={17} height={17} />}
    </div>
  );
}

// ─── LA TARJETA DE LA CUADRÍCULA ─────────────────────────────────────────────
//
// COMPOSICIÓN, no primitiva: `duna-card` + `duna-tile` + tokens. El sistema no
// tiene "tarjeta de producto" y no debe tenerla — no sabe qué es un producto.
//
// Muestra lo que DUNA-DS.md pide: imagen, nombre, precio, cuántas quedan con el
// número en color diferencial, y el chip de estado. NO muestra el margen (cifra
// de negocio, § el encabezado) ni una barra (§ lib/productos/stock).
function TarjetaProducto({ producto: p, seleccionado, onAbrir, onActivar }: {
  producto: Product;
  seleccionado: boolean;
  onAbrir: () => void;
  onActivar: () => void;
}) {
  const badge = badgeStock(p);
  return (
    // La tarjeta NO es un <button>: lleva DENTRO el badge "Inactivo", que es una
    // manija con su propia acción, y un control dentro de un botón es HTML
    // inválido y un lío de foco. El clic va en una capa propia, y el nombre es el
    // control accesible — igual que la fila de `order-card` cuando tiene botones.
    <div className={`duna-card duna-card--hoverable${seleccionado ? ' is-selected' : ''}`}
         style={{ padding: 'var(--duna-space-3)', position: 'relative',
                  borderColor: seleccionado ? 'var(--duna-ink)' : undefined }}>
      <div className="duna-tile">
        {p.imagen
          ? <Image src={p.imagen} alt="" fill sizes="(max-width: 640px) 100vw, 25vw" style={{ objectFit: 'cover' }} />
          : <Package aria-hidden="true" width={28} height={28} />}
        {badge && (
          <span className="duna-tile__ribbon">
            <span className={`duna-badge duna-badge--${badge.tone}`}>
              <span className="duna-badge__dot" />{badge.label}
            </span>
          </span>
        )}
        {/* NO es una etiqueta: es LA manija para devolver el producto al catálogo.
            Sólo "Inactivo" es clickeable — desactivar ya tiene su lugar en el
            diálogo de eliminar, y un tercer camino al mismo dato es cómo se llega
            a dos puertas que se desincronizan. */}
        {!p.activo && (
          <span className="duna-tile__ribbon duna-tile__ribbon--end duna-hit__sobre">
            <button type="button" className="duna-badge duna-badge--neutral"
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={onActivar} title="Activar producto"
                    aria-label={`Activar ${p.nombre}`}>
              Inactivo
            </button>
          </span>
        )}
      </div>

      <div style={{ marginTop: 'var(--duna-space-3)', minWidth: 0 }}>
        {/* El nombre ES el control: un `<button>` que estira su área de clic sobre
            toda la tarjeta con un pseudo-elemento, así el nombre es lo que anuncia
            el lector de pantalla y el clic sigue siendo de la tarjeta entera. */}
        <button type="button" onClick={onAbrir}
                className="duna-hit"
                style={{ font: 'inherit', color: 'inherit', background: 'none', border: 'none',
                         padding: 0, textAlign: 'left', fontWeight: 'var(--duna-w-semi)', cursor: 'pointer' }}>
          {p.nombre}
        </button>
        <div className="duna-num" style={{ fontWeight: 'var(--duna-w-semi)', marginTop: 'var(--duna-space-hairline)' }}>
          {formatCOP(p.precio)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
          <span className={`${claseStock(p)} duna-caption`}>{textoStock(p)}</span>
          {p.sku && <span className="duna-mono">{p.sku}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── EL DETALLE ──────────────────────────────────────────────────────────────
//
// Recibe el producto de la LISTA y su kardex del servidor por separado: la ficha
// se pinta de inmediato con lo que la lista ya tiene, y lo que exige el viaje
// (los movimientos) aparece cuando llega. Así abrir un producto no deja el panel
// en blanco.
//
// El panel RENDERIZA y llama hacia arriba: no es dueño de ninguna mutación.
function Detalle({ producto: p, kardex, cargandoKardex, errorKardex, onEditar, onEliminar, onActivar, onAjustar, onVerImagen }: {
  producto: Product;
  kardex: InventoryLog[] | null;
  cargandoKardex: boolean;
  errorKardex: string | null;
  onEditar: () => void;
  onEliminar: () => void;
  onActivar: () => void;
  onAjustar: () => void;
  onVerImagen: (src: string, alt: string) => void;
}) {
  const badge = badgeStock(p);
  const galeria = (p.imagenes ?? []).filter(u => u && u !== p.imagen);
  const moliendas = (p.moliendasOpciones ?? []).filter(o => o.disponible);

  const ficha: { label: string; valor?: string | null }[] = [
    { label: 'Categoría', valor: CATEGORIAS[p.categoria] ?? p.categoria },
    { label: 'SKU',       valor: p.sku },
    { label: 'Variante',  valor: p.variante },
    { label: 'Origen',    valor: p.origen },
    { label: 'Peso',      valor: p.peso_gramos ? `${p.peso_gramos} g` : null },
    { label: 'Costo',     valor: formatCOP(p.costo) },
  ];

  return (
    <div className="duna-card duna-card__pad">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-3)' }}>
        <div style={{ width: 'calc(var(--duna-thumb-w) * 2)', flexShrink: 0 }}>
          {p.imagen ? (
            <button type="button" className="duna-tile"
                    onClick={() => onVerImagen(p.imagen!, p.nombre)}
                    aria-label={`Ver la portada de ${p.nombre} en grande`}>
              <Image src={p.imagen} alt="" fill sizes="88px" style={{ objectFit: 'cover' }} />
            </button>
          ) : (
            <div className="duna-tile"><Package aria-hidden="true" width={24} height={24} /></div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="duna-title">{p.nombre}</div>
          <div className="duna-num" style={{ fontWeight: 'var(--duna-w-semi)', marginTop: 'var(--duna-space-hairline)' }}>
            {formatCOP(p.precio)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            {badge && (
              <span className={`duna-badge duna-badge--${badge.tone}`}>
                <span className="duna-badge__dot" />{badge.label}
              </span>
            )}
            {!p.activo && (
              <button type="button" className="duna-badge duna-badge--neutral"
                      style={{ cursor: 'pointer', border: 'none' }}
                      onClick={onActivar} aria-label={`Activar ${p.nombre}`}>
                Inactivo
              </button>
            )}
          </div>
        </div>
      </div>

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Existencias ──────────────────────────────────────────────────── */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-2)' }}>Existencias</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        <div className="duna-stat">
          <div className={`duna-stat__v duna-num ${claseStock(p)}`}>{p.stock}</div>
          <div className="duna-stat__l">Disponibles</div>
        </div>
        <div className="duna-stat">
          <div className="duna-stat__v duna-num">{p.stock_minimo ?? 5}</div>
          <div className="duna-stat__l">Mínimo</div>
        </div>
        {/* LA ACCIÓN VA JUNTO AL DATO QUE CAMBIA, no al pie con "Editar producto":
            ajustar stock es una operación de INVENTARIO —deja asiento en el
            kardex— y no una edición de la ficha. Ponerla abajo con las otras dos
            la haría parecer una variante de editar. */}
        <button type="button" className="duna-btn duna-btn--secondary duna-btn--sm"
                style={{ alignSelf: 'center' }} onClick={onAjustar}>
          Ajustar stock
        </button>
      </div>

      {/* ── Ficha ────────────────────────────────────────────────────────── */}
      <div className="duna-eyebrow" style={{ margin: 'var(--duna-space-5) 0 var(--duna-space-2)' }}>Ficha</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--duna-space-3)' }}>
        {ficha.map(({ label, valor }) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div className="duna-caption">{label}</div>
            {/* El guion dice "no tenemos ese dato". En blanco se lee como si algo
                no hubiera cargado. */}
            <div className="duna-body-sm" style={{ color: 'var(--duna-ink)', overflowWrap: 'anywhere' }}>
              {valor || '—'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Moliendas · sólo las DISPONIBLES, que son las que ve el cliente ── */}
      {moliendas.length > 0 && (
        <>
          <div className="duna-eyebrow" style={{ margin: 'var(--duna-space-5) 0 var(--duna-space-2)' }}>
            Moliendas disponibles
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
            {moliendas.map(o => <span key={o.nombre} className="duna-tag">{o.nombre}</span>)}
          </div>
        </>
      )}

      {/* ── Galería ──────────────────────────────────────────────────────── */}
      {galeria.length > 0 && (
        <>
          <div className="duna-eyebrow" style={{ margin: 'var(--duna-space-5) 0 var(--duna-space-2)' }}>Galería</div>
          <div className="duna-tiles">
            {galeria.map(url => (
              <button key={url} type="button" className="duna-tile duna-tile--sm"
                      onClick={() => onVerImagen(url, `${p.nombre} — toma adicional`)}
                      aria-label="Ver esta imagen en grande">
                <Image src={url} alt="" fill sizes="44px" style={{ objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </>
      )}

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Movimientos · EL KARDEX DE ESTE PRODUCTO ──────────────────────────
          La mitad de cliente de la frontera con Inventario: acá el kardex es del
          producto que se está mirando; el COMPLETO —la vista de auditoría, todos
          los productos— se queda en Inventario. Son la misma tabla contestando
          dos preguntas distintas.

          Se usa `ItemsTable` tal cual: sus filas {label, meta, amount} son
          exactamente {motivo, fecha, ±N}. No hizo falta primitiva nueva. */}
      <div className="duna-eyebrow" style={{ marginBottom: 'var(--duna-space-3)' }}>Movimientos</div>
      {errorKardex && <div className="duna-note" role="alert">{errorKardex}</div>}
      {cargandoKardex && <p className="duna-sub" style={{ margin: 0 }}>Cargando los movimientos…</p>}
      {!cargandoKardex && !errorKardex && kardex?.length === 0 && (
        <p className="duna-sub" style={{ margin: 0 }}>Este producto no tiene movimientos registrados.</p>
      )}
      {kardex && kardex.length > 0 && (
        <ItemsTable
          rows={kardex.map(l => ({
            label:  l.motivo || TIPO_MOVIMIENTO[l.tipo] || l.tipo,
            meta:   `${formatFecha(l.createdAt)} · ${l.stock_anterior} → ${l.stock_nuevo}`,
            // El signo lo pone el TIPO, no la cantidad: la columna guarda siempre
            // un positivo, y un ajuste FIJA el valor en vez de moverlo, así que no
            // lleva signo. Sin esto, una salida de 5 se leería como una entrada.
            amount: signoDelMovimiento(l),
          }))}
        />
      )}

      <hr className="duna-divider" style={{ margin: 'var(--duna-space-5) 0' }} />

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
        <button type="button" className="duna-btn duna-btn--secondary" onClick={onEditar}>
          Editar producto
        </button>
        <button type="button" className="duna-btn duna-btn--ghost" onClick={onEliminar}>
          Eliminar
        </button>
      </div>
    </div>
  );
}

/** Nombre del movimiento cuando no tiene motivo escrito. */
const TIPO_MOVIMIENTO: Record<string, string> = {
  entrada:    'Entrada',
  salida:     'Salida',
  ajuste:     'Ajuste',
  venta:      'Venta',
  devolucion: 'Devolución',
};

/** Cuánto se movió, con su signo. `ajuste` FIJA un valor absoluto: no es un delta
 *  y por eso se muestra el resultado, no un `+N` que no ocurrió. */
function signoDelMovimiento(l: InventoryLog): string {
  if (l.tipo === 'ajuste') return String(l.stock_nuevo);
  const suma = l.tipo === 'entrada' || l.tipo === 'devolucion';
  return `${suma ? '+' : '−'}${l.cantidad}`;
}
