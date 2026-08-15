'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Package, X } from 'lucide-react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { MoliendasOpcionesEditor } from '@/components/admin/MoliendasOpcionesEditor';
import { ImageLightbox } from '@/components/admin/ImageLightbox';
import { createProduct, updateProduct } from '@/lib/api/products';
import { uploadImagen } from '@/lib/api/upload';
import { CATEGORIAS, EMPTY_PRODUCT_FORM, TOSTADOS } from '@/constants/product';
import { ACCEPT_IMAGENES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS } from '@/constants/upload';
import { MAX_GALERIA_IMAGENES } from '@duna/core/product-gallery';
import { puedeGuardarProducto, obligatoriosFaltantes } from '@duna/core/product-form';
import { sanitizeOpciones, validarOpciones, revisarEdicion, type MoliendaOpcion } from '@duna/core/moliendas-opciones';
import type { Product, ProductCategory, ProductForm, RoastLevel } from '@/types/product';

// ═══ ALTA Y EDICIÓN DE PRODUCTO ══════════════════════════════════════════════
//
// DRAWER de Duna. La superficie, la cabecera y el pie salen del design-system; el
// foco atrapado, Escape, click-fuera y el bloqueo de scroll los pone Radix a
// través de `DunaSheet`.
//
// ── ES EXTRACCIÓN, NO REESCRITURA ───────────────────────────────────────────
//
// El formulario vivía INLINE en `/admin/productos`: ~230 líneas de JSX dentro de
// la página, con ocho piezas de estado local, dos refs de object URLs y toda la
// orquestación del guardado. Era el único de los flujos de esta vertical que no
// se podía invocar desde otro lado — al revés que los de órdenes, que Pedidos
// pudo montar tal cual.
//
// Cada decisión que el inline tenía documentada se conserva y se dice por qué,
// porque varias costaron algo: el orden subir→guardar, los object URLs en refs
// (el bug de Strict Mode), la `fase` que nombra la etapa, el diff de galería, y
// la galería que se EDITA excluyendo la portada.
//
// LO QUE SÍ CAMBIA es el vehículo de los errores de validación previa: el
// `toast.error` MURIÓ (§ Controles de formulario). Un toast aparece lejos del
// campo, tapa otra cosa y se va solo; el inline vive al lado del problema y
// persiste hasta que se corrige.
//
// ── SE MONTA EN LA PÁGINA, NUNCA EN UN PANEL ────────────────────────────────
//
// Un panel de detalle se desmonta al cambiar de registro, y una mutación montada
// ahí puede perder su continuación — es el incidente del 2026-08-06 con los
// comprobantes. Acá arriba el peor caso es que el panel reabra ya con el cambio
// aplicado. Mismo reparto que `CustomerFormModal`.
//
// ── LA PANTALLA VIEJA NO SE TOCA ────────────────────────────────────────────
//
// Su formulario inline sigue vivo hasta el retiro, así que por un tiempo hay DOS
// implementaciones del alta de producto. Es deliberado y es el precedente de
// Clientes: cuando una duplicación vive sólo en código que se va a retirar, el
// RETIRO es el arreglo, y esperar a que lo sea sale más barato que migrar una
// pantalla viva. Queda ESCRITO —no descubierto— que pueden divergir: cualquier
// regla nueva del formulario va en `@duna/core/product-form` o en
// `@duna/core/moliendas-opciones`, que las dos comparten, y NO en el JSX de una.

/** Ancho del preview de portada: dos miniaturas. Todo en tokens, sin px sueltos. */
const ANCHO_PORTADA = 'calc(var(--duna-thumb-w) * 2)';

export function ProductFormModal({ open, product, onOpenChange, onSaved }: {
  open: boolean;
  /** `null` = alta. Con producto, edición. */
  product: Product | null;
  onOpenChange: (o: boolean) => void;
  onSaved: (p: Product, modo: 'creado' | 'actualizado') => void;
}) {
  const titulo = product ? 'Editar producto' : 'Nuevo producto';
  // LA GUARDA VIVE ACÁ para poder cerrar la TERCERA salida. `DunaSheet` delega el
  // cierre al consumidor, así que sin este gate el Esc y el clic-fuera cierran el
  // drawer a mitad del guardado — y acá el costo es mayor que perder la certeza:
  // el submit vive en el CUERPO, así que cerrar lo desmonta y el `catch` escribe
  // su estado sobre un componente muerto. El error desaparece EN SILENCIO, que es
  // el modo de falla del gate del 2026-08-06 en miniatura.
  const guarda = useAccionGuardada();
  return (
    <DunaSheet
      abierto={open}
      onCerrar={() => { if (!guarda.enVuelo) onOpenChange(false); }}
      anclaje="lado"
      titulo={titulo}
      descripcion="Ficha del producto: precio, costo, stock, imágenes y las opciones de molienda que verá el cliente."
    >
      <div className="duna-modal__head">
        <div className="duna-title">{titulo}</div>
      </div>
      {/* El cuerpo sólo existe mientras está abierto, así que se re-siembra del
          producto actual en cada apertura sin un solo efecto — y el error inline
          se limpia solo al cerrar. Mismo patrón que `CustomerFormModal`. */}
      {open && <Cuerpo product={product} guarda={guarda} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
    </DunaSheet>
  );
}

/** Siembra el formulario desde un producto existente. */
function buildForm(p: Product): ProductForm {
  return {
    nombre:      p.nombre,
    descripcion: p.descripcion,
    categoria:   p.categoria,
    precio:      String(p.precio),
    costo:       String(p.costo),
    // `?? ''` y no `p.sku` a secas: la columna es nullable y `ProductForm` es de
    // strings. Un `null` acá llega como `value={null}` a un input controlado y
    // React lo reporta en consola. Era el ÚNICO nullable sin fallback.
    sku:          p.sku ?? '',
    stock:        String(p.stock),
    stock_minimo: String(p.stock_minimo ?? 5),
    activo:       p.activo,
    peso_gramos:  String(p.peso_gramos ?? ''),
    variante:     p.variante ?? '',
    origen:       p.origen ?? '',
    tostado:      p.tostado ?? '',
    slug:         p.slug,
    imagen:       p.imagen ?? '',
  };
}

function Cuerpo({ product, guarda, onClose, onSaved }: {
  product: Product | null;
  guarda: ReturnType<typeof useAccionGuardada>;
  onClose: () => void;
  onSaved: (p: Product, modo: 'creado' | 'actualizado') => void;
}) {
  const [form, setForm] = useState<ProductForm>(() => product ? buildForm(product) : EMPTY_PRODUCT_FORM);

  // Fase del guardado. Se conserva como enum y no como booleano porque lleva
  // información que un booleano no tiene: nombra la ETAPA para el texto del botón.
  // La guarda de re-entrada la pone el hook compartido; acá el costo de un
  // doble-submit no es un toast repetido — es una SEGUNDA subida a Blob, que deja
  // un blob huérfano que nadie va a borrar.
  const [fase, setFase] = useState<null | 'subiendo' | 'guardando'>(null);
  const error = useErrorDialogo();

  // Se INTENTÓ guardar. Los errores de campo no aparecen antes: marcar en rojo un
  // formulario recién abierto le echa en cara algo que todavía no se hizo mal.
  const [intentado, setIntentado] = useState(false);

  // ── Portada ───────────────────────────────────────────────────────────────
  // Imagen elegida pero AÚN NO SUBIDA. El upload ocurre al guardar, no al
  // seleccionar: un formulario abandonado a medias no puede dejar blobs huérfanos.
  const [imagenFile, setImagenFile]       = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string>(() => product?.imagen ?? '');
  const [errorArchivo, setErrorArchivo]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URL vivo, en un ref y NO en estado. Un object URL retiene el File en
  // memoria hasta que se revoca — pero el revoke NO puede vivir en un efecto con
  // el preview en las dependencias: con Strict Mode React monta, desmonta y vuelve
  // a montar, y ese cleanup revocaba la URL recién creada. El preview sobrevivía
  // sólo si el navegador alcanzaba a cargar el blob antes del revoke. Con el ref,
  // revocar es explícito: al reemplazar la selección y al desmontar de verdad.
  const objectUrlRef = useRef<string>('');
  const revocarObjectUrl = () => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = ''; }
  };

  // ── Galería (tomas ADICIONALES del detalle del storefront) ─────────────────
  // La galería que se EDITA excluye la portada aunque el registro la repita: se
  // muestra lo que de verdad son tomas adicionales (ver `galeriaCompleta`).
  const [galeriaActual, setGaleriaActual] = useState<string[]>(
    () => (product?.imagenes ?? []).filter(u => u && u !== product?.imagen),
  );
  const [galeriaPendiente, setGaleriaPendiente] = useState<{ file: File; preview: string }[]>([]);
  const galeriaInputRef = useRef<HTMLInputElement>(null);
  const galeriaUrlsRef  = useRef<string[]>([]);
  const revocarGaleria = (urls?: string[]) => {
    const objetivo = urls ?? galeriaUrlsRef.current;
    objetivo.forEach(u => URL.revokeObjectURL(u));
    galeriaUrlsRef.current = galeriaUrlsRef.current.filter(u => !objetivo.includes(u));
  };

  // ÚNICO efecto del componente: soltar las URLs vivas cuando el cuerpo se va. En
  // el ciclo doble de Strict Mode los refs todavía están vacíos, así que no revoca
  // nada. El cuerpo se desmonta al cerrar el drawer, que es justo el momento.
  useEffect(() => () => { revocarObjectUrl(); revocarGaleria(); }, []);

  // ── Moliendas ─────────────────────────────────────────────────────────────
  // Se normaliza al cargar: la columna es Json, así que un registro viejo o
  // sembrado a mano puede traer campos faltantes o basura.
  const [moliendas, setMoliendas] = useState<MoliendaOpcion[]>(
    () => sanitizeOpciones(product?.moliendasOpciones),
  );
  // Quitar es DESHACIBLE hasta guardar: la X marca, no borra. Lo barato lo hace el
  // borrado diferido —la lista no se reindexa mientras el drawer está abierto—,
  // así que un Set de ÍNDICES es estable.
  const [moliendasQuitadas, setMoliendasQuitadas] = useState<Set<number>>(new Set());
  const toggleQuitada = (i: number) => setMoliendasQuitadas(prev => {
    const s = new Set(prev);
    if (s.has(i)) s.delete(i); else s.add(i);
    return s;
  });
  const { vivas: moliendasVivas, problemas } = revisarEdicion(moliendas, moliendasQuitadas);
  const problemasMoliendas = intentado ? problemas : [];

  // Imagen abierta en el lightbox de inspección. Se monta FUERA del drawer.
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const totalGaleria = galeriaActual.length + galeriaPendiente.length;
  const faltantes    = obligatoriosFaltantes(form);
  const cupoLleno    = totalGaleria >= MAX_GALERIA_IMAGENES;

  const campo = <K extends keyof ProductForm>(key: K) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  /** Los MISMOS límites que el server (constants/upload): aviso temprano para no
   *  gastar una subida que el endpoint va a rechazar igual. Devuelve el motivo. */
  function motivoDeRechazo(file: File): string | null {
    if (!(TIPOS_PERMITIDOS as readonly string[]).includes(file.type)) {
      return `"${file.name}": formato no admitido. Usa JPG, PNG o WebP.`;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return `"${file.name}" pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo es ${MAX_UPLOAD_MB} MB.`;
    }
    return null;
  }

  const onPickImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const motivo = motivoDeRechazo(file);
    if (motivo) { setErrorArchivo(motivo); e.target.value = ''; return; }
    setErrorArchivo(null);
    // Reemplaza la selección anterior: se suelta su object URL antes de crear el
    // nuevo, para que elegir varias veces no acumule blobs retenidos.
    revocarObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImagenFile(file);
    setImagenPreview(url);
  };

  const quitarPortada = () => {
    revocarObjectUrl();
    setImagenFile(null);
    setImagenPreview('');
    setErrorArchivo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setForm(f => ({ ...f, imagen: '' }));
  };

  const onPickGaleria = (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegidos = [...(e.target.files ?? [])];
    e.target.value = '';                 // permite volver a elegir el mismo archivo
    if (elegidos.length === 0) return;

    const cupo = MAX_GALERIA_IMAGENES - totalGaleria;
    if (cupo <= 0) {
      setErrorArchivo(`La galería ya tiene el máximo de ${MAX_GALERIA_IMAGENES} imágenes.`);
      return;
    }
    const validos: { file: File; preview: string }[] = [];
    let motivo: string | null = null;
    for (const file of elegidos) {
      if (validos.length >= cupo) { motivo = `Sólo caben ${cupo} más — el máximo de la galería es ${MAX_GALERIA_IMAGENES}.`; break; }
      const rechazo = motivoDeRechazo(file);
      if (rechazo) { motivo = rechazo; continue; }
      const preview = URL.createObjectURL(file);
      galeriaUrlsRef.current.push(preview);
      validos.push({ file, preview });
    }
    setErrorArchivo(motivo);
    if (validos.length > 0) setGaleriaPendiente(prev => [...prev, ...validos]);
  };

  const quitarPendiente = (preview: string) => {
    revocarGaleria([preview]);
    setGaleriaPendiente(prev => prev.filter(p => p.preview !== preview));
  };
  // Quitar una guardada NO borra nada acá: sale del array y el SERVER se encarga
  // del blob al guardar, comparando contra lo que tenía la base. Si el operador
  // cancela el formulario, no se perdió nada.
  const quitarGuardada = (url: string) => setGaleriaActual(prev => prev.filter(u => u !== url));

  const guardar = () => guarda.ejecutar(async () => {
    // Se limpia al REINTENTAR, no sólo al cerrar: un error que sobrevive a un
    // reintento exitoso afirma un fallo que ya no existe.
    error.limpiar();
    setIntentado(true);
    if (faltantes.length > 0) return;

    if (totalGaleria > MAX_GALERIA_IMAGENES) {
      setErrorArchivo(`La galería admite máximo ${MAX_GALERIA_IMAGENES} imágenes adicionales.`);
      return;
    }

    // Opciones de molienda: el MISMO predicado del endpoint, y ANTES de subir
    // nada — una lista inválida hace que el POST/PATCH devuelva 400, y llegar
    // hasta ahí habría dejado los blobs ya subidos sin producto que los
    // referencie. Guardar es lo que hace EFECTIVO el quitar: viajan sólo las vivas.
    const moliendasLimpias = sanitizeOpciones(moliendasVivas);
    if (validarOpciones(moliendasLimpias).length > 0) return;   // el editor ya los pinta

    // Orden deliberado: SUBIR → GUARDAR. Si la subida falla no se toca el
    // producto; si el producto falla, el blob nuevo queda huérfano (basura barata)
    // pero la imagen vieja sigue siendo la buena. El blob REEMPLAZADO lo borra el
    // server dentro del PATCH, que es quien sabe cuál era el anterior.
    let imagenUrl = form.imagen;
    const galeriaSubidas: string[] = [];
    let etapa: 'subiendo' | 'guardando' = 'subiendo';

    try {
      if (imagenFile || galeriaPendiente.length > 0) {
        setFase('subiendo');
        if (imagenFile) imagenUrl = (await uploadImagen(imagenFile)).url;
        // En serie y no en paralelo: son pocas y así el primer fallo corta sin
        // dejar a medias un lote de blobs sin producto que los referencie.
        for (const { file } of galeriaPendiente) galeriaSubidas.push((await uploadImagen(file)).url);
      }

      const data = {
        nombre:       form.nombre,
        descripcion:  form.descripcion,
        categoria:    form.categoria as ProductCategory,
        precio:       Number(form.precio),
        costo:        Number(form.costo),
        sku:          form.sku,
        stock:        Number(form.stock),
        stock_minimo: Number(form.stock_minimo),
        activo:       form.activo,
        peso_gramos:  form.peso_gramos ? Number(form.peso_gramos) : undefined,
        variante:     form.variante || undefined,
        origen:       form.origen   || undefined,
        tostado:      (form.tostado || undefined) as RoastLevel | undefined,
        slug:         form.slug,
        imagen:       imagenUrl,
        // Lo que ya estaba (menos lo que el operador quitó) + lo recién subido.
        // El orden es el de subida: v1 no tiene reordenamiento.
        imagenes:     [...galeriaActual, ...galeriaSubidas],
        // Renombrar o quitar una opción no reescribe historia: las órdenes ya
        // guardaron su molienda como string (`OrderItem.moliendaSeleccionada`).
        moliendasOpciones: moliendasLimpias,
      };

      etapa = 'guardando';
      setFase('guardando');
      if (product) onSaved(await updateProduct(product.id, data), 'actualizado');
      else         onSaved(await createProduct(data), 'creado');
    } catch (e) {
      error.mostrar(e, etapa === 'subiendo' ? 'No se pudo subir la imagen' : 'No se pudo guardar el producto');
      return;
    } finally {
      setFase(null);
    }

    // Cierre SÓLO tras confirmación del servidor. Si falla, el drawer se queda
    // abierto con los datos intactos y el motivo a la vista.
    onClose();
  });

  const bloqueado = !!fase;

  return (
    <>
      <div
        className="duna-modal__body"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--duna-space-4)' }}
      >
        <div className="duna-field" style={{ gridColumn: '1 / -1' }}>
          <label className="duna-field__label" htmlFor="pf-nombre">Nombre *</label>
          {/* `aria-invalid` es a la vez el hook de estilo y el anuncio: no se puede
              pintar un campo de inválido sin que un lector de pantalla lo sepa. */}
          <input className="duna-input" id="pf-nombre" {...campo('nombre')} disabled={bloqueado}
                 aria-invalid={(intentado && !form.nombre.trim()) || undefined}
                 aria-describedby={intentado && !form.nombre.trim() ? 'pf-nombre-err' : undefined}
                 placeholder="Ej: Café Sierra 250 g" />
          {intentado && !form.nombre.trim() && <p className="duna-field__error" id="pf-nombre-err">El nombre es requerido.</p>}
        </div>

        <div className="duna-field">
          <label className="duna-field__label" htmlFor="pf-categoria">Categoría *</label>
          <select className="duna-input duna-select" id="pf-categoria" value={form.categoria} disabled={bloqueado}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value as ProductCategory }))}
                  aria-invalid={(intentado && !form.categoria) || undefined}
                  aria-describedby={intentado && !form.categoria ? 'pf-cat-err' : undefined}>
            {/* `disabled hidden`: no elegir no es una respuesta válida acá, así que
                el placeholder no debe poder re-elegirse. */}
            <option value="" disabled hidden>Seleccionar</option>
            {(Object.entries(CATEGORIAS) as [ProductCategory, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {intentado && !form.categoria && <p className="duna-field__error" id="pf-cat-err">Elige una categoría.</p>}
        </div>

        <div className="duna-field">
          <span className="duna-field__label">SKU</span>
          <input className="duna-input" {...campo('sku')} disabled={bloqueado} placeholder="SN-001" />
        </div>

        <div className="duna-field">
          <label className="duna-field__label" htmlFor="pf-precio">Precio de venta *</label>
          <input className="duna-input" id="pf-precio" type="number" {...campo('precio')} disabled={bloqueado}
                 aria-invalid={(intentado && !form.precio.trim()) || undefined}
                 aria-describedby={intentado && !form.precio.trim() ? 'pf-precio-err' : undefined}
                 placeholder="85000" />
          {intentado && !form.precio.trim() && <p className="duna-field__error" id="pf-precio-err">El precio es requerido.</p>}
        </div>

        <div className="duna-field">
          <span className="duna-field__label">Costo</span>
          <input className="duna-input" type="number" {...campo('costo')} disabled={bloqueado} placeholder="35000" />
        </div>

        {/* STOCK · la SEGUNDA puerta, y deja asiento en el kardex. No es un campo
            más de la ficha: escribirlo con un valor distinto registra un
            movimiento `ajuste` con motivo "Edición de producto" (§ Las DOS puertas
            del stock). La pista lo dice para que nadie lo descubra en el kardex. */}
        <div className="duna-field">
          <label className="duna-field__label" htmlFor="pf-stock">Stock actual</label>
          <input className="duna-input" id="pf-stock" type="number" {...campo('stock')} disabled={bloqueado}
                 aria-describedby="pf-stock-hint" placeholder="50" />
          <p className="duna-field__hint" id="pf-stock-hint">Cambiarlo deja un movimiento en el kardex.</p>
        </div>

        <div className="duna-field">
          <span className="duna-field__label">Stock mínimo</span>
          <input className="duna-input" type="number" {...campo('stock_minimo')} disabled={bloqueado} placeholder="10" />
        </div>

        <div className="duna-field">
          <span className="duna-field__label">Variante</span>
          <input className="duna-input" {...campo('variante')} disabled={bloqueado} placeholder="250 g, 500 g…" />
        </div>

        <div className="duna-field">
          <span className="duna-field__label">Origen</span>
          <input className="duna-input" {...campo('origen')} disabled={bloqueado} placeholder="Huila, Nariño…" />
        </div>

        <div className="duna-field">
          <label className="duna-field__label" htmlFor="pf-tostado">Nivel de tostado</label>
          <select className="duna-input duna-select" id="pf-tostado" value={form.tostado} disabled={bloqueado}
                  onChange={e => setForm(f => ({ ...f, tostado: e.target.value as RoastLevel }))}>
            {/* Acá NO elegir SÍ es válido —el tostado es opcional—, así que el
                vacío es una opción de verdad y no lleva `disabled hidden`. Es la
                misma distinción que "Por definir" en el método de pago. */}
            <option value="">Sin especificar</option>
            {(Object.entries(TOSTADOS) as [RoastLevel, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="duna-field">
          <span className="duna-field__label">Peso (gramos)</span>
          <input className="duna-input" type="number" {...campo('peso_gramos')} disabled={bloqueado} placeholder="250" />
        </div>

        <div className="duna-field" style={{ gridColumn: '1 / -1' }}>
          <span className="duna-field__label">Descripción</span>
          <textarea className="duna-input" rows={3} {...campo('descripcion')} disabled={bloqueado}
                    placeholder="Descripción del producto…" />
        </div>

        <MoliendasOpcionesEditor
          opciones={moliendas}
          onChange={setMoliendas}
          quitadas={moliendasQuitadas}
          onToggleQuitada={toggleQuitada}
          problemas={problemasMoliendas}
          disabled={bloqueado}
        />

        {/* ── PORTADA ────────────────────────────────────────────────────────
            El preview es local hasta que se guarda: seleccionar no sube nada. Al
            reemplazar la de un producto existente, el server borra el blob
            anterior en el PATCH. */}
        <div className="duna-field" style={{ gridColumn: '1 / -1' }}>
          <span className="duna-field__label">Portada</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--duna-space-4)' }}>
            <div style={{ width: ANCHO_PORTADA, flexShrink: 0 }}>
              {imagenPreview ? (
                <button type="button" className="duna-tile"
                        onClick={() => setLightbox({ src: imagenPreview, alt: 'Portada del producto' })}
                        aria-label="Ver la portada en grande">
                  {/* `img` y no `next/image`: un `blob:` local no lo puede
                      optimizar el servidor de imágenes. Para una URL ya guardada
                      da lo mismo acá — es un preview de 88px. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagenPreview} alt="Vista previa de la portada" />
                </button>
              ) : (
                // El marco es la FORMA (del paquete) y el reemplazo es CONTENIDO
                // (del consumidor): el tile no sabe qué es un producto.
                <div className="duna-tile"><Package aria-hidden="true" /></div>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <input ref={fileInputRef} type="file" accept={ACCEPT_IMAGENES} onChange={onPickImagen}
                     disabled={bloqueado} className="duna-input" />
              <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-2)' }}>
                JPG, PNG o WebP · máx. {MAX_UPLOAD_MB} MB. Se sube al guardar.
              </p>
              {(imagenFile || imagenPreview) && (
                <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm"
                        style={{ marginTop: 'var(--duna-space-2)' }}
                        onClick={quitarPortada} disabled={bloqueado}>
                  <X /> Quitar portada
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── GALERÍA · tomas ADICIONALES ────────────────────────────────────
            La portada de arriba no se lista acá: en el detalle del storefront va
            primero y éstas después. v1 sin reordenamiento — el orden es el de
            subida. */}
        <div className="duna-field" style={{ gridColumn: '1 / -1' }}>
          <span className="duna-field__label">Galería</span>
          <p className="duna-field__hint">
            Tomas adicionales del detalle en la tienda · {totalGaleria}/{MAX_GALERIA_IMAGENES}
          </p>

          {totalGaleria > 0 && (
            <div className="duna-tiles">
              {galeriaActual.map(url => (
                <div key={url} style={{ position: 'relative' }}>
                  <button type="button" className="duna-tile" aria-label="Ver esta imagen de la galería en grande"
                          onClick={() => setLightbox({ src: url, alt: 'Imagen de la galería' })}>
                    <Image src={url} alt="" fill sizes="80px" style={{ objectFit: 'cover' }} />
                  </button>
                  <span className="duna-tile__ribbon duna-tile__ribbon--end">
                    <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm"
                            onClick={() => quitarGuardada(url)} disabled={bloqueado}
                            aria-label="Quitar de la galería"><X /></button>
                  </span>
                </div>
              ))}
              {galeriaPendiente.map(({ preview, file }) => (
                <div key={preview} style={{ position: 'relative' }}>
                  <button type="button" className="duna-tile" aria-label={`Ver ${file.name} en grande`}
                          onClick={() => setLightbox({ src: preview, alt: file.name })}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={file.name} />
                  </button>
                  {/* "Sin subir" es un HECHO del estado, y por eso va como badge
                      neutro y no como alerta: todavía no pasó nada malo. */}
                  <span className="duna-tile__ribbon">
                    <span className="duna-badge duna-badge--neutral">Sin subir</span>
                  </span>
                  <span className="duna-tile__ribbon duna-tile__ribbon--end">
                    <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm"
                            onClick={() => quitarPendiente(preview)} disabled={bloqueado}
                            aria-label={`Quitar ${file.name}`}><X /></button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <input ref={galeriaInputRef} type="file" accept={ACCEPT_IMAGENES} multiple onChange={onPickGaleria}
                 disabled={bloqueado || cupoLleno} className="duna-input" />
          <p className="duna-field__hint">
            {cupoLleno
              ? `Máximo alcanzado (${MAX_GALERIA_IMAGENES}). Quita alguna para agregar otra.`
              : `JPG, PNG o WebP · máx. ${MAX_UPLOAD_MB} MB cada una. Se suben al guardar.`}
          </p>
          {/* EL ERROR DE ARCHIVO ES INLINE, no un toast: vive al lado del control
              que lo produjo y persiste hasta que se corrige. El `toast.error` de
              validación previa murió con § Controles de formulario. */}
          {errorArchivo && <p className="duna-field__error">{errorArchivo}</p>}
        </div>
      </div>

      <div className="duna-modal__foot">
        {/* El error del SERVIDOR, inline y a la izquierda de los botones — nunca
            como banner encima: un banner que aparece al fallar empuja el layout y
            mueve el botón que se acaba de clickear. */}
        <ErrorDialogo mensaje={error.mensaje} className="duna-modal__aviso" />
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={onClose} disabled={bloqueado}>
            Cancelar
          </button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={guardar}
                  disabled={!puedeGuardarProducto(form, bloqueado)}>
            {fase === 'subiendo' ? 'Subiendo imagen…' : fase === 'guardando' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {/* Un botón muerto sin explicación no distingue "te falta un campo" de "la
            app está rota". Se calla mientras se guarda: ahí el texto del botón ya
            cuenta lo que pasa. */}
        {!bloqueado && faltantes.length > 0 && (
          <p className="duna-field__hint" style={{ flexBasis: '100%', textAlign: 'right', margin: 0 }}>
            {faltantes.length === 1 ? 'Falta' : 'Faltan'}: {faltantes.join(', ')}
          </p>
        )}
      </div>

      {/* Inspección de una miniatura. Se monta FUERA del formulario para que su
          Dialog no quede anidado dentro del drawer — dos superficies anidadas se
          pelean el foco y el Esc cerraría las dos. */}
      <ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt} onClose={() => setLightbox(null)} />
    </>
  );
}
