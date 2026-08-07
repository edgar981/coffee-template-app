'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
import { toast } from 'sonner';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import { ErrorDialogo, useErrorDialogo } from '@/components/admin/ErrorDialogo';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/lib/api/products';
import type { Product, ProductCategory, ProductForm, RoastLevel } from '@/types/product';
import { CATEGORIAS, EMPTY_PRODUCT_FORM, TOSTADOS } from '@/constants/product';
import { formatCOP } from '@/lib/utils';
import { uploadImagen } from '@/lib/api/upload';
import { ACCEPT_IMAGENES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, TIPOS_PERMITIDOS } from '@/constants/upload';
import { MAX_GALERIA_IMAGENES } from '@/lib/product-gallery';
import { puedeGuardarProducto, obligatoriosFaltantes, accionEstadoProducto, alternativaAlEliminar } from '@/lib/product-form';
import { ImageLightbox, THUMB_INSPECCIONABLE } from '@/components/admin/ImageLightbox';
import { MoliendasOpcionesEditor } from '@/components/admin/MoliendasOpcionesEditor';
import { sanitizeOpciones, validarOpciones, revisarEdicion, type MoliendaOpcion } from '@/lib/moliendas-opciones';

// ─── Constants ───────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'table';

// ─── Page ────────────────────────────────────────────────────────────────────

// useSearchParams() (the ?producto= deep link) needs a Suspense boundary — same
// pattern as the Órdenes page.
export default function Productos() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <ProductosInner />
    </Suspense>
  );
}

function ProductosInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState<ProductCategory | 'all'>('all');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [form, setForm]           = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [view, setView]           = useState<ViewMode>('grid');
  // Product pending deletion (drives the shared confirm dialog).
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await getProducts();
    setProductos(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
      || p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || p.categoria === catFilter;
    return matchSearch && matchCat;
  });

  // Imagen abierta en el lightbox de inspección (portada o galería, guardada o
  // pendiente). `null` = overlay cerrado.
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  // Imagen elegida pero AÚN NO SUBIDA. El upload ocurre al guardar, no al
  // seleccionar: un formulario que se abandona a medias no puede dejar blobs
  // huérfanos en el store. El preview es un object URL local, gratis y revocable.
  const [imagenFile, setImagenFile]       = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string>('');
  // Fase del guardado, para que el botón diga qué está pasando DURANTE toda la
  // mutación y no solo durante la subida. Antes esto era un `subiendo` que
  // cubría únicamente el upload: al entrar al write de la base el botón volvía a
  // "Guardar" habilitado, así que el tramo más largo se veía como si no pasara
  // nada — y admitía un segundo clic que dispararía una segunda mutación.
  const [fase, setFase] = useState<null | 'subiendo' | 'guardando'>(null);
  // `fase` se queda porque lleva información que un booleano no tiene: nombra la
  // ETAPA ('subiendo' / 'guardando') para el texto del botón. La guarda de
  // re-entrada la pone el hook compartido. Acá el costo de un doble-submit no es
  // un toast repetido — es una SEGUNDA subida a Blob, que deja un blob huérfano
  // que nadie va a borrar (el PATCH solo sabe borrar el que el producto tenía
  // antes, no el gemelo que se subió en paralelo).
  const guarda = useAccionGuardada();
  const error  = useErrorDialogo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Object URL vivo, en un ref y no en estado. Un object URL retiene el File en
  // memoria hasta que se revoca, así que hay que revocarlo — pero NO desde un
  // efecto con `imagenPreview` en las dependencias: con Strict Mode (activo por
  // defecto en el app router) React monta, desmonta y vuelve a montar, y ese
  // cleanup revocaba la URL recién creada. El preview sobrevivía solo si el
  // navegador alcanzaba a cargar el blob antes del revoke; cuando perdía la
  // carrera, el slot quedaba vacío. Con el ref, revocar es explícito: al
  // reemplazar la selección y al desmontar de verdad.
  const objectUrlRef = useRef<string>('');

  const revocarObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
  };

  // ── Galería (tomas adicionales del detalle del storefront) ────────────────
  // `galeriaActual` son URLs YA guardadas; `galeriaPendiente` son archivos aún
  // sin subir, con su preview local. Mismo trato que la portada: el upload
  // ocurre al guardar. Quitar una guardada solo la saca del array — el blob lo
  // borra el SERVER en el PATCH, comparando contra lo que tenía la base.
  const [galeriaActual, setGaleriaActual]       = useState<string[]>([]);
  const [galeriaPendiente, setGaleriaPendiente] = useState<{ file: File; preview: string }[]>([]);
  const galeriaInputRef = useRef<HTMLInputElement>(null);
  // Mismo motivo que `objectUrlRef`: los object URLs de la galería viven en un
  // ref para poder revocarlos sin depender del ciclo de render.
  const galeriaUrlsRef = useRef<string[]>([]);

  const revocarGaleria = (urls?: string[]) => {
    const objetivo = urls ?? galeriaUrlsRef.current;
    objetivo.forEach(u => URL.revokeObjectURL(u));
    galeriaUrlsRef.current = galeriaUrlsRef.current.filter(u => !objetivo.includes(u));
  };

  // Único efecto: soltar las URLs vivas cuando la página se va. En el ciclo doble
  // de Strict Mode los refs todavía están vacíos, así que no revoca nada.
  useEffect(() => () => { revocarObjectUrl(); revocarGaleria(); }, []);

  const limpiarImagen = () => {
    revocarObjectUrl();
    setImagenFile(null);
    setImagenPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const limpiarGaleria = () => {
    revocarGaleria();
    setGaleriaPendiente([]);
    setGaleriaActual([]);
    if (galeriaInputRef.current) galeriaInputRef.current.value = '';
  };

  // ── Opciones de molienda del CLIENTE (`Product.moliendasOpciones`) ────────
  // Estado propio y no dentro de `form`, igual que la galería: `ProductForm` es
  // de campos de texto y este es una lista de objetos. Lo que se guarda es
  // exactamente este array — sin ids de cliente que después haya que limpiar.
  //
  // NO confundir con `form.molienda`: ese campo (ficha técnica) no lo toca este
  // editor y hoy no tiene UI, que es una ausencia conocida y anotada.
  const [moliendas, setMoliendas] = useState<MoliendaOpcion[]>([]);
  // Quitar una molienda es DESHACIBLE hasta guardar (decisión del owner): la X no
  // borra la fila, la marca. Lo que la hace barata es que el borrado sea diferido
  // —la lista no se reindexa mientras el modal está abierto—, así que un Set de
  // ÍNDICES es estable: agregar solo apendiza y nada se corre de lugar.
  //
  // El motivo es la asimetría del error: un click accidental en la X borraba una
  // opción con su método escrito, y rehacerla es teclear de nuevo; con la marca,
  // el mismo click accidental cuesta un segundo click. Y el operador ve lo que va
  // a pasar ANTES de que pase, que es lo que un `confirm()` no da.
  const [moliendasQuitadas, setMoliendasQuitadas] = useState<Set<number>>(new Set());

  const toggleQuitada = (i: number) => setMoliendasQuitadas(prev => {
    const siguiente = new Set(prev);
    if (siguiente.has(i)) siguiente.delete(i); else siguiente.add(i);
    return siguiente;
  });

  // Qué se va a guardar y qué está mal, con los índices ya traducidos a la lista
  // que el editor pinta. Vive en `lib/moliendas-opciones` y está testeado: el
  // remapeo es un off-by-one que no rompe el guardado, solo señala la fila
  // equivocada, y por eso nadie lo ve hasta que confunde a alguien.
  const { vivas: moliendasVivas, problemas } = revisarEdicion(moliendas, moliendasQuitadas);

  // Los problemas se pintan recién DESPUÉS del primer intento de guardar: marcar
  // en rojo una fila que el operador acaba de crear —y todavía no alcanzó a
  // nombrar— es regañarlo por estar escribiendo. Una vez que se muestran, se
  // recalculan en vivo, así que corregir apaga el rojo sin volver a guardar.
  const [moliendasRevisadas, setMoliendasRevisadas] = useState(false);
  const problemasMoliendas = moliendasRevisadas ? problemas : [];

  const totalGaleria = galeriaActual.length + galeriaPendiente.length;
  // Obligatorios vacíos, para el aviso bajo el botón deshabilitado.
  const faltantes = obligatoriosFaltantes(form);

  const onPickGaleria = (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegidos = [...(e.target.files ?? [])];
    e.target.value = '';                 // permite volver a elegir el mismo archivo
    if (elegidos.length === 0) return;

    const cupo = MAX_GALERIA_IMAGENES - totalGaleria;
    if (cupo <= 0) {
      toast.error(`La galería ya tiene el máximo de ${MAX_GALERIA_IMAGENES} imágenes.`);
      return;
    }

    const validos: { file: File; preview: string }[] = [];
    for (const file of elegidos) {
      if (validos.length >= cupo) {
        toast.error(`Solo caben ${cupo} más — el máximo de la galería es ${MAX_GALERIA_IMAGENES}.`);
        break;
      }
      // Mismos límites por archivo que la portada (constants/upload).
      if (!(TIPOS_PERMITIDOS as readonly string[]).includes(file.type)) {
        toast.error(`"${file.name}": formato no admitido. Usa JPG, PNG o WebP.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`"${file.name}" pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo es ${MAX_UPLOAD_MB} MB.`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      galeriaUrlsRef.current.push(preview);
      validos.push({ file, preview });
    }
    if (validos.length > 0) setGaleriaPendiente(prev => [...prev, ...validos]);
  };

  const quitarPendiente = (preview: string) => {
    revocarGaleria([preview]);
    setGaleriaPendiente(prev => prev.filter(p => p.preview !== preview));
  };

  // Quitar una guardada NO borra nada acá: sale del array y el server se encarga
  // del blob al guardar. Si el operador cancela el formulario, no se perdió nada.
  const quitarGuardada = (url: string) =>
    setGaleriaActual(prev => prev.filter(u => u !== url));

  const onPickImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Aviso temprano con los MISMOS límites del server (constants/upload), para
    // no gastar una subida que el endpoint va a rechazar igual.
    if (!(TIPOS_PERMITIDOS as readonly string[]).includes(file.type)) {
      toast.error('Formato no admitido. Usa JPG, PNG o WebP.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`La imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo es ${MAX_UPLOAD_MB} MB.`);
      e.target.value = '';
      return;
    }
    // Reemplaza la selección anterior: se suelta su object URL antes de crear el
    // nuevo, para que elegir archivo varias veces no acumule blobs retenidos.
    revocarObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImagenFile(file);
    setImagenPreview(url);
  };

  // Un producto nuevo NACE sin opciones: es el caso permisivo (no pide molienda,
  // la card agrega directo) y el default que no le cambia la tienda a nadie.
  const limpiarMoliendas = () => {
    setMoliendas([]);
    setMoliendasQuitadas(new Set());
    setMoliendasRevisadas(false);
  };

  const openNew  = () => { setEditing(null); setForm(EMPTY_PRODUCT_FORM); limpiarImagen(); limpiarGaleria(); limpiarMoliendas(); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    limpiarImagen();
    limpiarGaleria();
    // Se normaliza al cargar: la columna es Json, así que un registro viejo o
    // sembrado a mano puede traer campos faltantes o basura. El editor trabaja
    // siempre sobre la forma canónica.
    limpiarMoliendas();
    setMoliendas(sanitizeOpciones(p.moliendasOpciones));
    setImagenPreview(p.imagen ?? '');
    // La galería que se EDITA excluye la portada aunque el registro la repita:
    // se muestra lo que de verdad son tomas adicionales (ver galeriaCompleta).
    setGaleriaActual((p.imagenes ?? []).filter(u => u && u !== p.imagen));
    setForm({
      nombre:      p.nombre,
      descripcion: p.descripcion,
      categoria:   p.categoria,
      precio:      String(p.precio),
      costo:       String(p.costo),
      // `?? ''` y no `p.sku` a secas: la columna es nullable y `ProductForm` es
      // de strings. Un `null` acá llega como `value={null}` a un input
      // controlado, y React lo reporta en consola. Era el ÚNICO nullable sin
      // fallback en este mapeo.
      sku:         p.sku ?? '',
      stock:       String(p.stock),
      stock_minimo: String(p.stock_minimo ?? 5),
      activo:      p.activo,
      peso_gramos: String(p.peso_gramos ?? ''),
      variante:    p.variante ?? '',
      origen:      p.origen ?? '',
      tostado:     p.tostado ?? '',
      slug:        p.slug,
      imagen:      p.imagen ?? '',
    });
    setShowForm(true);
  };

  // Deep link from the command palette: `?producto=<id>` opens that product in the
  // SAME edit modal the page already uses (openEdit) — no separate detail route.
  // The param is consumed once (cleared after opening) so it doesn't re-fire.
  useEffect(() => {
    const id = searchParams.get('producto');
    if (!id) return;
    const producto = productos.find(p => p.id === id);
    if (!producto) return;        // wait until the list has loaded
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the edit modal in response to the ?producto= deep link
    openEdit(producto);
    router.replace('/admin/productos', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, searchParams]);
  const handleSave = () => guarda.ejecutar(async () => {
    error.limpiar();
    if (!form.categoria) { toast.error('Selecciona una categoría'); return; }

    // Guarda cliente del tope; la que MANDA es la del endpoint.
    if (totalGaleria > MAX_GALERIA_IMAGENES) {
      toast.error(`La galería admite máximo ${MAX_GALERIA_IMAGENES} imágenes adicionales.`);
      return;
    }

    // Opciones de molienda. Aviso temprano con el MISMO predicado del endpoint
    // (`validarOpciones`), y ANTES de subir nada: una lista inválida hace que el
    // POST/PATCH devuelva 400, y llegar hasta ahí habría dejado los blobs ya
    // subidos sin producto que los referencie.
    //
    // Guardar es lo que hace EFECTIVO el quitar: viajan solo las vivas. Hasta
    // acá, la X era reversible.
    const moliendasLimpias = sanitizeOpciones(moliendasVivas);
    const problemas = validarOpciones(moliendasLimpias);
    if (problemas.length > 0) {
      setMoliendasRevisadas(true);   // desde acá el rojo se recalcula en vivo
      toast.error(problemas[0].mensaje);
      return;
    }

    // Orden deliberado: subir → guardar. Si la subida falla no se toca el
    // producto; si el producto falla, el blob nuevo queda huérfano (basura
    // barata) pero la imagen vieja sigue siendo la buena. El blob REEMPLAZADO lo
    // borra el server dentro del PATCH, que es quien sabe cuál era el anterior.
    //
    // Las dos etapas van bajo UNA sola `fase`, así el botón queda deshabilitado
    // y diciendo qué pasa de punta a punta. `etapa` solo sirve para que el
    // mensaje de error nombre la que falló.
    let imagenUrl = form.imagen;
    const galeriaSubidas: string[] = [];
    let etapa: 'subiendo' | 'guardando' = 'subiendo';

    try {
      if (imagenFile || galeriaPendiente.length > 0) {
        setFase('subiendo');
        if (imagenFile) imagenUrl = (await uploadImagen(imagenFile)).url;
        // En serie y no en paralelo: son pocas y así el primer fallo corta sin
        // dejar a medias un lote grande de blobs sin producto que los referencie.
        for (const { file } of galeriaPendiente) {
          galeriaSubidas.push((await uploadImagen(file)).url);
        }
      }

      const data = {
        nombre:      form.nombre,
        descripcion: form.descripcion,
        categoria:   form.categoria as ProductCategory,
        precio:      Number(form.precio),
        costo:       Number(form.costo),
        sku:         form.sku,
        stock:       Number(form.stock),
        stock_minimo: Number(form.stock_minimo),
        activo:      form.activo,
        peso_gramos: form.peso_gramos ? Number(form.peso_gramos) : undefined,
        variante:    form.variante   || undefined,
        origen:      form.origen     || undefined,
        tostado:     (form.tostado   || undefined) as RoastLevel | undefined,
        slug:        form.slug,
        imagen:      imagenUrl,
        // Lo que ya estaba (menos lo que el operador quitó) + lo recién subido.
        // El orden es el de subida: v1 no tiene reordenamiento.
        imagenes:    [...galeriaActual, ...galeriaSubidas],
        // Renombrar o quitar una opción no reescribe historia: las órdenes ya
        // guardaron su molienda como string (`OrderItem.moliendaSeleccionada`).
        moliendasOpciones: moliendasLimpias,
      };

      // El cierre ocurre SOLO tras confirmación del server. Si falla, el modal
      // se queda abierto con los datos intactos y el error a la vista.
      etapa = 'guardando';
      setFase('guardando');
      if (editing) {
        const updated = await updateProduct(editing.id, data);
        setProductos(prev => prev.map(p => p.id === editing.id ? updated : p));
        toast.success('Producto actualizado');
      } else {
        const created = await createProduct(data);
        setProductos(prev => [created, ...prev]);
        toast.success('Producto creado');
      }
    } catch (e) {
      error.mostrar(e, etapa === 'subiendo' ? 'No se pudo subir la imagen' : 'No se pudo guardar el producto');
      return;
    } finally {
      setFase(null);
    }

    // El toast de éxito ya se disparó arriba: el operador lo ve aparecer con el
    // modal todavía en pantalla, y recién después se cierra.
    limpiarImagen();
    limpiarGaleria();
    limpiarMoliendas();
    setShowForm(false);
  });

  // Hard delete, run by the confirm dialog. The server rejects (409) any product
  // that appears in an order; that message bubbles up to the dialog, which stays
  // open and points the operator to "Desactivar" instead.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteProduct(deleteTarget.id);
    setProductos(prev => prev.filter(p => p.id !== deleteTarget.id));
  };

  // La alternativa NO destructiva del mismo diálogo, en las DOS direcciones:
  // desactivar conserva el registro y su historial sacándolo del catálogo, y
  // activar lo devuelve. El inverso vive acá y no en un toggle del modal para que
  // el par sea una sola decisión, en un solo lugar.
  //
  // Manda un PATCH de UN campo, que es exactamente el caso que el endpoint tiene
  // que respetar: escribe `activo` y no toca nada más (§ El PATCH de producto es
  // PARCIAL de verdad). Antes del arreglo, este mismo llamado vaciaba la ficha y
  // le borraba los blobs.
  const confirmCambiarEstado = async (activo: boolean, id?: string) => {
    const objetivo = id ?? deleteTarget?.id;
    if (!objetivo) return;
    const updated = await updateProduct(objetivo, { activo });
    setProductos(prev => prev.map(p => p.id === objetivo ? updated : p));
  };

  // La alternativa del diálogo de ELIMINAR: desactivar, y sólo eso. Activar salió
  // de acá — vive en el badge, que es el affordance que la promete.
  const alternativaBorrado = alternativaAlEliminar(deleteTarget);

  // Producto que el operador pidió ACTIVAR desde su badge "Inactivo". Estado
  // aparte de `deleteTarget` a propósito: son dos intenciones distintas y
  // mezclarlas en un solo target obligaría a un modo, que es justo la forma en que
  // un diálogo termina mostrando el verbo equivocado.
  const [activarTarget, setActivarTarget] = useState<Product | null>(null);
  const accionActivar = accionEstadoProducto(activarTarget);

  const confirmActivar = async () => {
    if (!activarTarget) return;
    await confirmCambiarEstado(true, activarTarget.id);
  };

  const field = <K extends keyof ProductForm>(key: K) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">{productos.length} productos en catálogo</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo Producto
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={catFilter} onValueChange={v => setCatFilter(v as ProductCategory | 'all')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(Object.entries(CATEGORIAS) as [ProductCategory, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(['grid', 'table'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-xs ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {v === 'grid' ? 'Cuadrícula' : 'Tabla'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando productos...</div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={setDeleteTarget} onActivar={setActivarTarget} />
          ))}
        </div>
      ) : (
        <ProductTable productos={filtered} onEdit={openEdit} onDelete={setDeleteTarget} onActivar={setActivarTarget} />
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) error.limpiar(); setShowForm(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            <DialogDescription className="sr-only">
              Ficha del producto: precio, costo, stock, imágenes y las opciones de molienda que verá el cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nombre *</Label>
              <Input {...field('nombre')} className="mt-1" placeholder="Ej: Café Sierra 250g" />
            </div>
            <div>
              <Label>Categoría *</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as ProductCategory }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORIAS) as [ProductCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU</Label>
              <Input {...field('sku')} className="mt-1" placeholder="SN-001" />
            </div>
            <div>
              <Label>Precio de Venta *</Label>
              <Input type="number" {...field('precio')} className="mt-1" placeholder="85000" />
            </div>
            <div>
              <Label>Costo</Label>
              <Input type="number" {...field('costo')} className="mt-1" placeholder="35000" />
            </div>
            <div>
              <Label>Stock Actual</Label>
              <Input type="number" {...field('stock')} className="mt-1" placeholder="50" />
            </div>
            <div>
              <Label>Stock Mínimo</Label>
              <Input type="number" {...field('stock_minimo')} className="mt-1" placeholder="10" />
            </div>
            <div>
              <Label>Variante</Label>
              <Input {...field('variante')} className="mt-1" placeholder="250g, 500g, etc." />
            </div>
            <div>
              <Label>Origen</Label>
              <Input {...field('origen')} className="mt-1" placeholder="Huila, Nariño..." />
            </div>
            <div>
              <Label>Nivel de Tostado</Label>
              <Select value={form.tostado} onValueChange={v => setForm(f => ({ ...f, tostado: v as RoastLevel }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TOSTADOS) as [RoastLevel, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peso (gramos)</Label>
              <Input type="number" {...field('peso_gramos')} className="mt-1" placeholder="250" />
            </div>
            <div className="col-span-2">
              <Label>Descripción</Label>
              <textarea
                {...field('descripcion')}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-20 resize-none"
                placeholder="Descripción del producto..."
              />
            </div>
            {/* Opciones de molienda del CLIENTE. Editar esto no es llenar un
                campo de la ficha: la cantidad de opciones DISPONIBLES decide si
                la card del catálogo agrega directo o manda al detalle. Va
                deshabilitado mientras la mutación viaja — misma mitad de estado
                que el botón Guardar. */}
            <MoliendasOpcionesEditor
              opciones={moliendas}
              onChange={setMoliendas}
              quitadas={moliendasQuitadas}
              onToggleQuitada={toggleQuitada}
              problemas={problemasMoliendas}
              disabled={!!fase}
            />

            {/* Imagen. El preview es local hasta que se guarda: seleccionar no
                sube nada (ver `imagenFile`). Al reemplazar la de un producto
                existente, el server borra el blob anterior en el PATCH. */}
            <div className="col-span-2">
              <Label>Imagen</Label>
              <div className="mt-1 flex items-start gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  {imagenPreview ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ src: imagenPreview, alt: 'Portada del producto' })}
                      aria-label="Ver la portada en grande"
                      className={`block h-full w-full ${THUMB_INSPECCIONABLE}`}
                    >
                      {/* Preview: `img` y no `next/image` a propósito — un `blob:`
                          local no lo puede optimizar el servidor de imágenes. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagenPreview} alt="Vista previa" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_IMAGENES}
                    onChange={onPickImagen}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    JPG, PNG o WebP · máx. {MAX_UPLOAD_MB} MB. Se sube al guardar.
                  </p>
                  {(imagenFile || imagenPreview) && (
                    <Button
                      variant="ghost" size="sm"
                      className="mt-1 h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => { limpiarImagen(); setForm(f => ({ ...f, imagen: '' })); }}
                    >
                      <X className="mr-1 h-3 w-3" /> Quitar imagen
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Galería — tomas ADICIONALES. La portada de arriba no se lista
                acá: en el detalle del storefront va primero y estas después.
                v1 sin reordenamiento: el orden es el de subida. */}
            <div className="col-span-2">
              <Label>Galería</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tomas adicionales del detalle en la tienda · {totalGaleria}/{MAX_GALERIA_IMAGENES}
              </p>

              {totalGaleria > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {galeriaActual.map(url => (
                    <figure key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: url, alt: 'Imagen de la galería' })}
                        aria-label="Ver esta imagen de la galería en grande"
                        className={`absolute inset-0 ${THUMB_INSPECCIONABLE}`}
                      >
                        <Image src={url} alt="" fill sizes="80px" className="object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarGuardada(url)}
                        aria-label="Quitar de la galería"
                        className="absolute right-1 top-1 rounded-md bg-background/85 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </figure>
                  ))}
                  {galeriaPendiente.map(({ preview, file }) => (
                    <figure key={preview} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-dashed border-primary/50 bg-muted">
                      {/* `img` y no next/image: un `blob:` local no lo puede
                          optimizar el servidor de imágenes. */}
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: preview, alt: file.name })}
                        aria-label={`Ver ${file.name} en grande`}
                        className={`block h-full w-full ${THUMB_INSPECCIONABLE}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt={file.name} className="h-full w-full object-cover" />
                      </button>
                      <span className="absolute inset-x-0 bottom-0 bg-background/85 py-0.5 text-center text-[10px] text-muted-foreground">
                        Sin subir
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarPendiente(preview)}
                        aria-label={`Quitar ${file.name}`}
                        className="absolute right-1 top-1 rounded-md bg-background/85 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </figure>
                  ))}
                </div>
              )}

              <input
                ref={galeriaInputRef}
                type="file"
                accept={ACCEPT_IMAGENES}
                multiple
                onChange={onPickGaleria}
                disabled={totalGaleria >= MAX_GALERIA_IMAGENES}
                className="mt-2 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent disabled:opacity-50"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {totalGaleria >= MAX_GALERIA_IMAGENES
                  ? `Máximo alcanzado (${MAX_GALERIA_IMAGENES}). Quita alguna para agregar otra.`
                  : `JPG, PNG o WebP · máx. ${MAX_UPLOAD_MB} MB cada una. Se suben al guardar.`}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 pt-2">
            <div className="flex w-full items-center justify-end gap-3">
            <ErrorDialogo mensaje={error.mensaje} />
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            {/* El predicado vive en `lib/product-form` y está testeado: inline
                nadie podía cubrirlo, y un requisito de más ahí bloquea el ALTA
                sin romper la edición. */}
            <Button onClick={handleSave} disabled={!puedeGuardarProducto(form, !!fase)}>
              {fase === 'subiendo' ? 'Subiendo imagen…' : fase === 'guardando' ? 'Guardando…' : 'Guardar'}
            </Button>
            </div>
            {/* Un botón muerto sin explicación no distingue "te falta un campo"
                de "la app está rota" — mismo patrón muted del aviso de mensajero
                en el modal de entregas. Se calla mientras se guarda: ahí el
                estado del botón ya cuenta lo que pasa. */}
            {!fase && faltantes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {faltantes.length === 1 ? 'Falta' : 'Faltan'}: {faltantes.join(', ')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — themed replacement for window.confirm(). A product
          with sales history can't be deleted (server 409); la alternativa NO
          destructiva se ofrece en su lugar, y va en las DOS direcciones: activo →
          "Desactivar", inactivo → "Activar". Cuál corresponde lo decide
          `accionEstadoProducto`, que está testeado — ofrecer el estado en el que el
          producto YA está es lo que dejaba productos atrapados en Inactivo. */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Eliminar producto"
        entityLabel={deleteTarget
          ? [deleteTarget.nombre, deleteTarget.sku].filter(Boolean).join(' · ')
          : ''}
        // El texto sigue al estado. Para uno ya inactivo no hay alternativa que
        // ofrecer, así que la descripción hace el trabajo que hacía el botón:
        // decir que su historial está a salvo y que volver al catálogo se hace
        // desde su badge, no desde acá.
        consequence={deleteTarget && !deleteTarget.activo
          ? 'Se eliminará permanentemente del catálogo. Esta acción no se puede deshacer. Ya está inactivo: no aparece en la tienda y su historial sigue intacto. Para devolverlo al catálogo, usa el badge "Inactivo" de su tarjeta.'
          : 'Se eliminará permanentemente del catálogo. Esta acción no se puede deshacer. Si tiene ventas registradas, desactívalo para conservar el historial.'}
        confirmLabel="Eliminar producto"
        successMessage="Producto eliminado"
        onConfirm={confirmDelete}
        secondaryAction={alternativaBorrado && {
          label:          alternativaBorrado.label,
          onAction:       () => confirmCambiarEstado(alternativaBorrado.activo),
          successMessage: alternativaBorrado.successMessage,
        }}
      />

      {/* Activar, disparado por el badge "Inactivo". Confirma —poner un producto
          en la tienda es una acción hacia afuera— pero NO es destructivo, así que
          `confirmKind="default"` lo pinta ámbar y no rojo. Reusa el mismo diálogo
          por lo que ya resuelve: candado único, mensaje del servidor a la vista y
          no se cierra si falla. */}
      <ConfirmDeleteDialog
        open={!!activarTarget}
        onOpenChange={(o) => { if (!o) setActivarTarget(null); }}
        title="Activar producto"
        entityLabel={activarTarget
          ? [activarTarget.nombre, activarTarget.sku].filter(Boolean).join(' · ')
          : ''}
        consequence="Volverá al catálogo de la tienda y los clientes podrán comprarlo. Podrás desactivarlo de nuevo cuando quieras."
        confirmLabel="Activar producto"
        confirmKind="default"
        successMessage={accionActivar?.successMessage}
        onConfirm={confirmActivar}
      />

      {/* Inspección de una miniatura. Se monta fuera del formulario para que su
          Dialog no quede anidado dentro del otro — dos Dialog anidados se pelean
          el foco y el Esc cerraría los dos. */}
      <ImageLightbox
        src={lightbox?.src ?? null}
        alt={lightbox?.alt}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Affordance del badge "Inactivo", que es una MANIJA y no una etiqueta: es lo que
// promete la acción que antes vivía escondida detrás del ícono de basura. Una
// constante compartida por la cuadrícula y la tabla —igual que
// `THUMB_INSPECCIONABLE`— para que las dos vistas no puedan divergir en cuánto se
// nota que se puede clickear. Hover de TINTE (`--accent`), nunca relleno sólido:
// el badge es neutro y lo sigue siendo (Amber Minimal).
const BADGE_ACTIVABLE =
  'cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface ProductCardProps {
  product:   Product;
  onEdit:    (p: Product) => void;
  onDelete:  (p: Product) => void;
  onActivar: (p: Product) => void;
}

function ProductCard({ product: p, onEdit, onDelete, onActivar }: ProductCardProps) {
  const lowStock = p.stock <= (p.stock_minimo ?? 5);
  const margin   = p.precio && p.costo
    ? Math.round(((p.precio - p.costo) / p.precio) * 100)
    : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all group">
      <div className="h-36 bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center relative">
        {p.imagen ? (
          <Image
            src={p.imagen}
            alt={p.nombre}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <Package className="w-12 h-12 text-amber-300" />
        )}
        {lowStock && (
          <span className="absolute top-2 right-2 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Stock bajo
          </span>
        )}
        {/* No es una etiqueta: es LA manija para devolver el producto al catálogo.
            Antes esa acción sólo existía dentro del diálogo de eliminar, o sea que
            el ícono de basura prometía una cosa y escondía la contraria. */}
        {!p.activo && (
          <button
            type="button"
            onClick={() => onActivar(p)}
            aria-label={`Activar ${p.nombre}`}
            title="Activar producto"
            className={`absolute top-2 left-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground ${BADGE_ACTIVABLE}`}
          >
            Inactivo
          </button>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-sm leading-tight">{p.nombre}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{p.sku || 'Sin SKU'} • {p.variante ?? '—'}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold text-foreground">{formatCOP(p.precio)}</span>
          {margin !== null && (
            <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
              {margin}% margen
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Stock: <strong className={lowStock ? 'text-red-500' : 'text-foreground'}>{p.stock}</strong></span>
          <span className="capitalize">{p.categoria.replace('_', ' ')}</span>
        </div>
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onEdit(p)}>
            <Edit2 className="w-3 h-3 mr-1" /> Editar
          </Button>
          <Button size="sm" variant="destructiveGhost" className="h-7 w-7 p-0" onClick={() => onDelete(p)} aria-label={`Eliminar ${p.nombre}`}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ProductTableProps {
  productos: Product[];
  onEdit:    (p: Product) => void;
  onDelete:  (p: Product) => void;
  onActivar: (p: Product) => void;
}

function ProductTable({ productos, onEdit, onDelete, onActivar }: ProductTableProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Producto', 'SKU', 'Categoría', 'Precio', 'Costo', 'Stock', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productos.map(p => {
              const lowStock = p.stock <= (p.stock_minimo ?? 5);
              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.nombre}</p>
                    {p.variante && <p className="text-xs text-muted-foreground">{p.variante}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku || '—'}</td>
                  <td className="px-4 py-3 text-xs capitalize">{p.categoria.replace('_', ' ')}</td>
                  <td className="px-4 py-3 font-semibold">{formatCOP(p.precio)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCOP(p.costo)}</td>
                  <td className="px-4 py-3">
                    <span className={lowStock ? 'text-red-500 font-semibold' : ''}>{p.stock}</span>
                    {lowStock && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                  </td>
                  {/* Mismo trato que en la cuadrícula: "Inactivo" es manija, no
                      etiqueta. Sin esto, quien trabaja en vista Tabla se queda con
                      el callejón sin salida que esta tanda vino a cerrar. */}
                  <td className="px-4 py-3">
                    {p.activo ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Activo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onActivar(p)}
                        aria-label={`Activar ${p.nombre}`}
                        title="Activar producto"
                        className={`text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 ${BADGE_ACTIVABLE}`}
                      >
                        Inactivo
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(p)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="destructiveGhost" className="h-7 w-7 p-0" onClick={() => onDelete(p)} aria-label={`Eliminar ${p.nombre}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
        <Package className="w-8 h-8 text-amber-400" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Sin productos aún</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Agrega tu primer producto al catálogo para empezar a gestionar tu inventario.
      </p>
      <Button onClick={onNew} className="gap-2"><Plus className="w-4 h-4" /> Agregar Producto</Button>
    </div>
  );
}