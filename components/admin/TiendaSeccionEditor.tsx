'use client';

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef, Fragment } from 'react';
import { toast } from 'sonner';
import { Upload, Plus, ImageIcon, X, Film, ArrowUp, ArrowDown, Check, ChevronsUpDown } from 'lucide-react';
import { useAutoguardado } from '@/hooks/useAutoguardado';
import { ConfirmDescartarDialog } from '@/components/admin/ConfirmDescartarDialog';
import RepeaterEditor from '@/components/admin/RepeaterEditor';
import PosterScrubber from '@/components/admin/PosterScrubber';
import BarraProgreso from '@/components/admin/BarraProgreso';
import { CategoriaCombobox } from '@/components/admin/CategoriaCombobox';
import { SelectorTransicion } from '@/components/admin/SelectorTransicion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from '@/components/ui/command';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';
import { useSubidaImagen } from '@/components/admin/useSubidaImagen';
import { esSesionVencida, MSG_SESION_VENCIDA } from '@/lib/api/upload';
import { getProducts } from '@/lib/api/products';
import type { Product } from '@/types/product';
import { cn } from '@duna/core/utils';
import type { SeccionConfig, CampoTexto, CampoImagen, CampoBooleano, SeccionVista } from '@/components/admin/tienda-secciones';
import { gatePorCampo, SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { ComposicionHero } from '@/components/admin/editor/ComposicionHero';
import { FilaSeccion } from '@/components/admin/editor/FilaSeccion';
import { IconoFila } from '@/components/admin/editor/IconoFila';
import { Migas } from '@/components/admin/editor/Migas';
import { AyudaCampo } from '@/components/admin/editor/AyudaCampo';
import EstiloElementoControles from '@/components/admin/editor/EstiloElementoControles';
import { metaElementoEstilo, resolverEstiloElemento, ESTILO_ELEMENTO_VACIO, type EstiloElementoResuelto } from '@/lib/config/estilo-elemento';
import type { TemaAyudaId } from '@/lib/admin/ayuda-editor';
import { bloquesResueltos, type BloqueResuelto } from '@/lib/tienda/bloques';
import { slotOpcional, slotVacio } from '@/lib/tienda/puente-tarjetas';
import { quitar as quitarDeLista, mover as moverEnLista, ultimoLleno } from '@/lib/tienda/lista-plana';
import { opcionesDestaque } from '@/lib/storefront/planes-suscripcion';
import { fusionCampoEditable } from '@/lib/storefront/campo-editable';
import {
  TIPO_MENSAJE_SESION_VENCIDA, esMensajeSeccionClick, esMensajeCampoCambio, esMensajeCampoImagenClick,
  esMensajeCamposCambio,
} from '@/lib/storefront/editor-puente';
import { remuxMovAMp4 } from '@/lib/video-remux';
import { ejesSpotlight, etiquetaEjesSpotlight, parcialAlCambiarPinSpotlight } from '@/lib/config/spotlight';
import { DEFAULTS, veloComboDeCampos, camposDeVeloCombo, type SuscripcionPlanesContent } from '@/lib/config/site-content-defaults';
import { sonIguales, type PasoHistorial } from '@/lib/admin/historial-editor';
import type { EstadoAutoguardado } from '@/lib/autoguardado';
import {
  MAX_SUBIDA_DIRECTA_MB, ACCEPT_IMAGENES, TIPOS_PERMITIDOS, TIPOS_VIDEO, ACCEPT_VIDEO,
  MSG_VIDEO_NO_ADMITIDO, CONTENEDORES_REMUXEABLES, MAX_VIDEO_HERO_BYTES, MSG_VIDEO_HERO_LARGO,
} from '@/constants/upload';

// LA CÁSCARA del editor de una sección de la tienda, GENÉRICA. Todo lo que NO es específico de la
// sección vive acá —read↔edit + autoguardado + publicar/descartar + el indicador +
// beforeunload-en-error—; lo específico (campos, imágenes, toggle, identidad) llega por `config`
// (§ tienda-secciones). Segundo consumidor de este patrón: no se duplica la lógica de autoguardado
// ni la de publicación —un bug arreglado en un sitio y no en el otro sería el peor modo de falla—.
//
// LA VISTA EN VIVO YA NO ES LOCAL (§ EDITOR-TIENDA-IFRAME-VISTA-1): hasta ese slice, cada sección
// montaba su propia `VistaTiendaEnVivo` —una SEGUNDA implementación del cálculo de colores/
// tipografía/forma que la página real ya resuelve, la causa de fondo de más de un bug (§ DISENO.md,
// § 1.3)—. `TiendaPaginas` monta UN solo `VistaTiendaIframe` que navega a la ruta REAL del
// storefront en modo borrador; esta cáscara es SÓLO form —"Editar" abre los campos, "Listo" cierra,
// el autoguardado dispara como siempre— y notifica al padre por TRES callbacks opcionales para que
// el iframe compartido se desplace, se actualice en vivo o se recargue:
//   - `onAbrir` — desplaza+resalta el iframe hasta esta sección.
//   - `onCambio` (§ EDITOR-TIENDA-POSTMESSAGE-1) — manda el form COMPLETO por `postMessage` en CADA
//     cambio (tipear, subir una imagen, descartar…), sin recargar. Es el camino PRINCIPAL ahora: el
//     iframe refleja el borrador en vivo sin que el documento navegue.
//   - `onCambioPublicado` — recarga el iframe (con scroll preservado, § `VistaTiendaIframe`), SÓLO
//     tras Publicar/Descartar exitosos. Antes TAMBIÉN corría en cada asentamiento del autoguardado;
//     eso era el "refresca con cada cambio" que el owner reportó, y `onCambio` lo reemplaza para ese
//     caso — recargar en cada tecla nunca fue necesario para que el iframe se viera al día.
// `config`, `carga`, `categorias`/`categoriasListas` y `resaltar` no cambiaron de contrato.
//
// LA DIRECCIÓN INVERSA, iframe→lista (§ EDITOR-TIENDA-SELECCION-1): un clic DENTRO del iframe
// manda un `postMessage` que `TiendaPaginas` resuelve a esta sección y llama por `ref` —el
// componente expone `TiendaSeccionEditorHandle.seleccionar()` (`forwardRef`/`useImperativeHandle`,
// ver más abajo)—. Es un mecanismo APARTE del deep-link (`resaltar`): ese corre UNA vez por montaje
// (`deepLinkHecho`); éste debe poder repetirse —clickear la MISMA sección dos veces en el iframe
// tiene que volver a desplazarla las dos veces—, así que usa un CONTADOR (`pedidoExterno`), no un
// booleano ni el mismo flag.

type Datos = Record<string, unknown>; // strings/booleans planos + el array de items de un repeater

// ── EL CATÁLOGO REAL, PARA EL PICKER DE PRODUCTO (§ DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1) ─────
//
// MISMO patrón que `cargarEsquemaTemaReal` arriba, por la MISMA razón: `TiendaPaginas.tsx` (el
// padre) YA fetchea el catálogo completo —para derivar `categorias`, § `categoriasDelCatalogo`— pero
// queda FUERA de `touches:` de este slice (no se le puede agregar la prop que baje el catálogo
// entero a cada editor sin tocarlo), así que este editor hace su PROPIO fetch, compartido entre las
// N instancias montadas en la misma carga de página vía una promesa a nivel de módulo — nunca un
// fetch por instancia. Se usa SÓLO en la sección `spotlight` (el único picker de producto hoy); las
// demás secciones nunca llaman a `cargarCatalogoReal`.
//
// `getProducts()` (no `getCatalog()`): el picker necesita ver TODO el catálogo —incluidos
// inactivos/agotados, que el dueño puede querer destacar igual— y `getProducts` es el endpoint ADMIN
// (con sesión), el mismo que ya usa `TiendaPaginas.tsx` para derivar categorías.
let promesaCatalogoReal: Promise<Product[]> | null = null;
function cargarCatalogoReal() {
  if (!promesaCatalogoReal) {
    promesaCatalogoReal = getProducts().catch(() => []);
  }
  return promesaCatalogoReal;
}

// ── EL COMBOBOX DE PRODUCTO · elegir de la lista por nombre + foto, nunca un slug a mano ──────────
//
// MISMO ensamblaje que `CategoriaCombobox` (Popover + Command de cmdk, § su docstring: "no es una
// primitiva nueva, es lo que shadcn ya trae"), portaleado al MISMO puente (`useContenedorDunaPortal`)
// por la MISMA razón (aparece sobre el sheet del editor). La diferencia es la FORMA de la lista: acá
// cada fila lleva una MINIATURA además del nombre —"selector con nombre y foto", el gate del
// owner—, así que es un componente separado en vez de una opción más de `CategoriaCombobox` (las dos
// listas, productos-con-foto y categorías-de-texto, no comparten forma de fila).
//
// Vive en ESTE archivo (no en uno propio) porque `touches:` de este slice no declara un path nuevo
// para una primitiva — es LOCAL a `TiendaSeccionEditor.tsx`, su único consumidor hoy (el campo
// `producto: true` del picker de Spotlight). El día que un segundo consumidor lo necesite, se
// extrae, mismo criterio que ya aplicó `CategoriaCombobox` antes de existir como archivo propio.
function ProductoCombobox({ value, onChange, productos, productosListos, id, placeholder = 'Elige un producto', ariaDescribedby }: {
  value: string;
  onChange: (v: string) => void;
  /** El catálogo REAL (§ cargarCatalogoReal, arriba). Puede venir vacío mientras el fetch no resolvió. */
  productos: Product[];
  /** Si el catálogo YA cargó — el aviso de "ya no existe" no se muestra hasta saberlo (mismo
   *  criterio que `categoriasListas` de `CategoriaCombobox`: un fetch fallido no puede afirmar que
   *  un producto no existe). */
  productosListos: boolean;
  id?: string;
  placeholder?: string;
  ariaDescribedby?: string;
}) {
  const contenedor = useContenedorDunaPortal();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');

  const seleccionado = productos.find((p) => p.slug === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtrados = q ? productos.filter((p) => p.nombre.toLowerCase().includes(q)) : productos;

  const elegir = (slug: string) => { onChange(slug); setQuery(''); setAbierto(false); };

  return (
    <Popover open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        {/* `duna-input` para medir y verse EXACTAMENTE como los campos de al lado (como
            `CategoriaCombobox`/`DateField`): es un campo, no un botón que abre algo. */}
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={abierto}
          aria-describedby={ariaDescribedby}
          className="duna-input"
          style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {seleccionado ? (
              <>
                <span className="duna-tile" style={{ width: 24, height: 24, flexShrink: 0 }}>
                  {seleccionado.imagen
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={seleccionado.imagen} alt="" />
                    : <ImageIcon aria-hidden width={12} height={12} />}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seleccionado.nombre}</span>
              </>
            ) : (
              <span style={{ color: 'var(--duna-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value || placeholder}
              </span>
            )}
          </span>
          <ChevronsUpDown style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" container={contenedor} style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '16rem' }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar producto…" value={query} onValueChange={setQuery} />
          <CommandList>
            {!productosListos && <CommandEmpty>Cargando catálogo…</CommandEmpty>}
            {productosListos && filtrados.length === 0 && <CommandEmpty>Ningún producto coincide.</CommandEmpty>}
            {value && (
              <CommandGroup>
                <CommandItem value="__quitar__" onSelect={() => elegir('')}>
                  <X className="mr-2 h-4 w-4" /> Quitar
                </CommandItem>
              </CommandGroup>
            )}
            {filtrados.length > 0 && (
              <CommandGroup heading="Productos">
                {filtrados.map((p) => (
                  <CommandItem key={p.slug} value={p.slug} onSelect={() => elegir(p.slug)}>
                    <span className="duna-tile" style={{ width: 20, height: 20, marginRight: 8, flexShrink: 0 }}>
                      {p.imagen
                        ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imagen} alt="" />
                        : <ImageIcon aria-hidden width={10} height={10} />}
                    </span>
                    <Check className={cn('mr-2 h-4 w-4', value === p.slug ? 'opacity-100' : 'opacity-0')} />
                    {p.nombre}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// EL HANDLE IMPERATIVO (§ EDITOR-TIENDA-SELECCION-1): la dirección iframe→lista de la selección en
// contexto. `TiendaPaginas` guarda un ref por sección (ver su docstring) y llama a `seleccionar()`
// cuando llega un `postMessage` de "clic DENTRO del iframe" que resuelve a ESTA sección. No se reusa
// el `resaltar` del deep-link (§ más abajo, "DEEP-LINK"): ese mecanismo corre UNA sola vez por sección
// montada (`deepLinkHecho`), a propósito — reusarlo para un clic repetible habría significado que
// clickear la MISMA sección dos veces en el iframe sólo funcionara la primera.
export interface TiendaSeccionEditorHandle {
  /** Abre esta sección si está cerrada (como "Editar") y la desplaza a la vista dentro de la
   *  columna de la lista — REPETIBLE: cada llamada vuelve a desplazar, a diferencia del deep-link. */
  seleccionar: () => void;
  /** § EDITOR-TIENDA-SHELL-1 — gemelo de `seleccionar` para el PANEL CON NIVELES: cierra la edición
   *  como lo haría el botón "Cerrar" de esta misma cáscara (mismo `cerrarEdicion`, mismo `auto.flush`),
   *  pero llamado desde AFUERA — el «‹ volver» de las migas del nivel «Inicio» (`TiendaPaginas.tsx`)
   *  necesita poder colapsar la sección activa al salir de su nivel, para que volver a Inicio no deje
   *  una tarjeta a medio abrir en la lista. */
  cerrar: () => void;
  /** § EDITOR-TIENDA-CAMPO-EDITABLE-1 — llamado por cada tecla del campo flotante que resuelve a
   *  ESTA sección. Abre la edición si está cerrada (SIN desplazar — a diferencia de `seleccionar`,
   *  el dueño ya está mirando el campo DENTRO del iframe, no hace falta llevarle la vista a la
   *  lista) y aplica el mismo `cambiar()` que usa el `onChange` del input de la lista, vía
   *  `fusionCampoEditable` (soporta tanto un campo PLANO como uno de ítem de repeater). Un `campo`
   *  que `fusionCampoEditable` no puede aplicar (ruta inválida, índice fuera de rango) se IGNORA. */
  escribirCampo: (campo: string, valor: string) => void;
  /** § EDITOR-BARRA-ESTILO-ESCALONADO-1 — gemelo PLURAL de `escribirCampo`: llamado por un
   *  `TIPO_MENSAJE_CAMPOS_CAMBIO` que resuelve a ESTA sección (zonas del hero, "Quitar" de la barra
   *  de estilo — un solo gesto que escribe VARIOS campos reales a la vez). Abre la edición igual que
   *  `escribirCampo`, encadena `fusionCampoEditable` sobre un acumulador local (el segundo campo del
   *  lote funde sobre el resultado del primero, nunca sobre el `form` de ANTES del gesto) y aplica
   *  el resultado completo con UNA sola escritura — un lote, un paso de deshacer, nunca uno por
   *  campo. Un `campo` del lote que no se puede aplicar se IGNORA, igual que `escribirCampo`. */
  escribirCampos: (campos: Array<{ campo: string; valor: string }>) => void;
  /** § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — gemelo de `escribirCampo` SIN el `abrirEdicion()`: lo usa
   *  OTRA sección para escribir un campo propio (§ `CampoTexto.seccionCruzada`, tienda-secciones.ts)
   *  sin que esta tarjeta se expanda sola. Quien dispara el clic real (p. ej. el hero, por sección-
   *  click DOM o por su propio grupo «Marquesina» en el panel) ya decidió qué tarjeta abrir; abrir
   *  TAMBIÉN la de esta sección sería una segunda tarjeta expandiéndose sin que nadie lo pidiera.
   *  Aplica el MISMO `cambiar()` vía `fusionCampoEditable` — un único escritor/autoguardado de esta
   *  sección, sea cual sea la tarjeta desde la que se edite. */
  escribirCampoSinAbrir: (campo: string, valor: string) => void;
  /** § EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1 — llamado por el clic en una imagen/video marcada que
   *  resuelve a ESTA sección. Abre la edición si está cerrada (SIN desplazar, mismo criterio que
   *  `escribirCampo`) y dispara el MISMO flujo de subida que el control equivalente de la lista
   *  ("Cambiar"/"Cambiar video"/"Cambiar póster" — nunca un selector propio): el `<input type="file">`
   *  oculto que ese flujo abre sólo existe en el DOM una vez que la sección está en edición, así que
   *  si había que abrirla, el disparo se DIFIERE al próximo render (§ el comentario de
   *  `campoImagenPendienteRef`). Un `campo` sin flujo equivalente en el modo actual (p. ej.
   *  `imagenPoster` fuera de modo video) no hace nada. */
  abrirSelectorImagen: (campo: string) => void;
  /** § EDITOR-TIENDA-DESHACER-1 — llamado por `TiendaPaginas` tras un "Publicar" EN LOTE
   *  (`publicarVariasSecciones`, `app/api/site-content/route.ts`) que incluyó esta sección. Sólo
   *  baja la píldora "Sin publicar" LOCAL (`hayBorrador=false`) — el `form` ya mostraba exactamente
   *  lo que se acaba de publicar (es lo que el borrador YA tenía), así que no hay nada que
   *  re-sembrar. Mismo efecto que la rama `accion==='publicar'` de `accionBorrador`, sin el toast
   *  (el lote muestra UN solo toast, no uno por sección). */
  marcarPublicado: () => void;
  /** § EDITOR-TIENDA-DESHACER-1 — llamado por `TiendaPaginas` tras un "Descartar" EN LOTE
   *  (`descartarVariasSecciones`) que incluyó esta sección: re-siembra el `form` con el valor YA
   *  PUBLICADO que el padre bajó de su ÚNICO refetch (`recargarDoc()`, una vez para todo el lote —
   *  nunca N fetches, uno por sección). Mismo efecto que la rama `accion==='descartar'` de
   *  `accionBorrador`, salvo que el refetch lo hace el padre una sola vez para todas. */
  restaurarDesdePublicado: (valor: Record<string, unknown>) => void;
}

// § EDITOR-TIENDA-ORDEN-1 — el asa de arrastre + flechas de teclado de la lista lateral (SÓLO las
// bandas de la home, § `config.bandaId`). `TiendaPaginas` es DUEÑA del array de orden; esta cáscara
// sólo pinta el asa y notifica — igual que el toggle de visibilidad de arriba, que manda a `cambiar`
// en vez de tocar el borrador él mismo. `posicion`/`total` son 1-based, para el aria-label.
export interface AsaOrdenProps {
  posicion: number;
  total: number;
  /** Esta fila es la que se está arrastrando ahora mismo (para atenuarla visualmente). */
  arrastrando: boolean;
  onDragStart: () => void;
  /** El drag entró sobre ESTA fila — reordena en el acto (reorder-on-dragover, sin librería). */
  onDragEnter: () => void;
  onDragEnd: () => void;
  onMoverArriba: () => void;
  onMoverAbajo: () => void;
}

interface TiendaSeccionEditorProps {
  config: SeccionConfig;
  /** § EDITOR-TIENDA-ORDEN-1 — ausente para las páginas sin `content.orden` (nosotros/suscripciones:
   *  no tienen este campo persistido, § BANDA_IDS en site-content-defaults.ts). Con el asa presente,
   *  la fila COLAPSADA la pinta junto al título. */
  orden?: AsaOrdenProps;
  /** Las categorías DERIVADAS del catálogo, para los campos-destino (§ el destino de Presentaciones es
   *  DATO). Sólo las usa la sección con un campo `categoria: true`; las demás las ignoran. */
  categorias?: string[];
  /** Si el catálogo ya cargó — el aviso "no existe" NO se muestra hasta saberlo (un fetch fallido no
   *  puede afirmar que una categoría no existe). */
  categoriasListas?: boolean;
  /** DEEP-LINK del aviso de config del Dashboard (§ Backlog #65): abrir la edición de ESTA sección y
   *  resaltar+scrollear el bloque del `slot` (reusa el puente vista→formulario). `null` = sin deep-link.
   *  `slot` null = abrir la sección sin resaltar un bloque (para secciones sin tarjetas, futuro). */
  resaltar?: { seccion: string; slot: number | null } | null;
  /** EL CONTENIDO lo carga TiendaPaginas UNA vez y baja la rebanada de esta sección (§ fetch 6→1): antes
   *  cada editor fetcheaba `/api/site-content` COMPLETO y usaba sólo su slice — N requests idénticos. El
   *  editor SIEMBRA su `form` local desde `valor` (una vez), y de ahí es dueño de su form. `recargar`
   *  re-lee el doc COMPLETO y devuelve lo fresco, para re-sembrar tras "Descartar" (el wrinkle del refetch). */
  carga: {
    valor?: Datos;          // valor draft-merged de esta sección; undefined = aún cargando
    sinPublicar: boolean;   // el flag `sinPublicar[seccion]` bajado por el padre
    listo: boolean;         // el padre terminó de cargar el doc
    error: boolean;         // el fetch del padre falló
    recargar: () => Promise<{ contenido?: Record<string, unknown>; sinPublicar?: Record<string, boolean> }>;
  };
  /** Se llama al abrir esta sección (manual, deep-link o selección en contexto) — el padre
   *  (`TiendaPaginas`) lo usa para desplazar+resaltar el iframe compartido hasta el marcador de esta
   *  sección (§ EDITOR-TIENDA-IFRAME-VISTA-1). Ausente = sin iframe que notificar (no debería ocurrir
   *  fuera de un test). */
  onAbrir?: (seccion: SeccionVista) => void;
  /** § EDITOR-TIENDA-SHELL-1 — gemelo de `onAbrir`: se llama al CERRAR la edición (botón "Cerrar" de
   *  esta cáscara, o el `cerrar()` del handle llamado por el padre). El panel con niveles
   *  (`TiendaPaginas.tsx`) lo usa para volver al nivel «Inicio» cuando el dueño cierra la sección
   *  desde ADENTRO del form, sin pasar por las migas — las dos salidas deben llevar al mismo sitio.
   *  Ausente = sin nivel que avisar (no debería ocurrir fuera de un test). */
  onCerrar?: (seccion: SeccionVista) => void;
  /** Se llama tras Publicar/Descartar exitosos — el padre recarga el iframe compartido preservando
   *  el scroll. YA NO se llama al asentar el autoguardado (§ `onCambio`, abajo, lo reemplaza para el
   *  contenido en vivo) — recargar en CADA asentamiento era el "refresca con cada cambio" que el
   *  owner reportó (§ EDITOR-TIENDA-POSTMESSAGE-1). */
  onCambioPublicado?: () => void;
  /** Se llama con el FORM COMPLETO en cada cambio (tipear, subir una imagen, descartar…) — el padre
   *  lo reenvía al iframe compartido por `postMessage`, SIN recargar (§ EDITOR-TIENDA-POSTMESSAGE-1).
   *  Ausente = sin iframe que notificar (no debería ocurrir fuera de un test). */
  onCambio?: (seccion: SeccionVista, datos: Datos) => void;
  /** § EDITOR-TIENDA-DESHACER-1 — un LOTE de ediciones de esta sección se asentó (el autoguardado
   *  pasó de 'guardando' a 'guardado' con un valor real distinto del que tenía al empezar el lote,
   *  § `aplicarCambioForm`). El padre (`TiendaPaginas`) lo empuja al historial COMPARTIDO — esta
   *  cáscara no sabe nada de la pila de deshacer/rehacer, sólo construye el PASO con sus propios
   *  closures (`restaurarForm`). Ausente = sin historial que alimentar (no debería ocurrir fuera
   *  de un test). */
  onPaso?: (paso: PasoHistorial) => void;
  /** § EDITOR-TIENDA-DESHACER-1 — reporta, en cada cambio, si ESTA sección tiene borrador y en qué
   *  estado está su autoguardado — el padre agrega esto con las demás secciones + 'orden' para el
   *  "N cambios sin publicar"/"Guardando…" de la barra. Ausente = sin agregado que alimentar. */
  onEstado?: (seccion: SeccionVista, info: { hayBorrador: boolean; estado: EstadoAutoguardado }) => void;
  /** § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — el valor EN VIVO de las secciones ajenas que esta
   *  declara vía `CampoTexto.seccionCruzada` (hoy, sólo `hero` lee `valoresCruzados.marquesina`
   *  para mostrar su grupo «Marquesina»). El padre (`TiendaPaginas`) lo arma con el `form` que la
   *  sección REAL ya reporta por `onCambio`, con el doc inicial como piso antes del primer cambio.
   *  Ausente/sin la clave = sin valor que mostrar (campo vacío) — no debería ocurrir fuera de un test. */
  valoresCruzados?: Partial<Record<SeccionVista, Record<string, unknown>>>;
  /** § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — escribe UN campo de OTRA sección (`seccionCruzada`). El
   *  padre lo resuelve al handle real (`seccionRefs.current.get(seccion)?.escribirCampoSinAbrir(...)`)
   *  — esta cáscara nunca toca su propio `form` para un campo cruzado. Ausente = sin a dónde escribir
   *  (no debería ocurrir fuera de un test). */
  onEscribirCruzado?: (seccion: SeccionVista, campo: string, valor: string) => void;
  /** § EDITOR-AYUDA-1 — el «?» de la miga local «‹ Hero» (sólo el nivel de elemento la muestra;
   *  el nivel «sección» de esta misma cáscara usa la miga GLOBAL de `TiendaPaginas`, que no pasa
   *  por acá). El padre ya resolvió el tema de ayuda; esta cáscara sólo lo invoca con `'hero'`
   *  fijo — nunca con el nombre de la zona, porque las cuatro comparten la misma guía. Ausente =
   *  sin «?» (no debería ocurrir fuera de un test). */
  onAyuda?: (tema: TemaAyudaId) => void;
  /** § EDITOR-VISUAL-NIVELES-AJUSTE-1 — avisa al padre cuando el nivel de ELEMENTO (sólo hero,
   *  `elementoActivo` más abajo) se abre/cierra, para que `TiendaPaginas.tsx` pueda CALLAR su
   *  propia miga global «‹ Inicio» mientras ésta dibuja la suya («‹ Hero») — medido: las dos
   *  migas convivían a la vez (`.scratch/capturas-niveles-ajuste`, el nivel Titular). MISMO
   *  patrón que `onAbrir`/`onCerrar`: la instancia avisa, el padre sólo escucha. Se monta para
   *  TODAS las secciones (sólo el hero lo dispara; las demás nunca tienen `elementoActivo`).
   *  Ausente = el padre no puede enterarse (no debería ocurrir fuera de un test). */
  onElementoActivoChange?: (activo: boolean) => void;
}

// ── EL NIVEL «elemento», SÓLO HERO (§ EDITOR-VISUAL-NIVELES-1, REDISENO.md § 3/§ 4) ────────────────
//
// Las CUATRO zonas de texto del hero de hoy (§ `ZONA_HERO_NOMBRES`, más abajo) — Titular, Subtítulo,
// Botones, Indicador. «Fondo» NO es una de ellas a propósito: el prototipo tampoco la trata como
// zona navegable (`K.ZONES` nunca incluye `'fondo'`, medido en `prototipo-editor.html`) — tiene su
// propio bloque inline en el nivel Hero (miniatura + Cambiar + punto focal + Oscurecer), nunca un
// nivel de elemento con texto/estilo/Quitar, porque no tiene texto que estilizar.
type ZonaHeroKey = 'titular' | 'subtitulo' | 'botones' | 'indicador';

/** campo (texto o booleano) → la zona a la que pertenece, para que un clic en el LIENZO (un mensaje
 *  `campo-cambio` del puente, § `escribirCampo`) abra el mismo nivel que un clic en el PANEL —
 *  "al tocar una zona en el panel o en la página", el spec. `titularVisible` gatea DOS campos
 *  (`titulo`/`tituloEnfasis`), y `ctasVisibles` otros dos (`ctaPrimarioLabel`/`ctaSecundarioLabel`):
 *  el prototipo trata "Botón" como una zona con un solo texto; acá son dos campos reales del modelo,
 *  así que la zona "Botones" los agrupa a los dos — la desviación medida que el spec anticipa
 *  ("cuando difieren en QUÉ hace… se conserva la función con el estilo del prototipo"). */
const ZONA_HERO_DE_CAMPO: Record<string, ZonaHeroKey> = {
  titularVisible: 'titular', titulo: 'titular', tituloEnfasis: 'titular',
  subtituloVisible: 'subtitulo', subtitulo: 'subtitulo',
  ctasVisibles: 'botones', ctaPrimarioLabel: 'botones', ctaSecundarioLabel: 'botones',
  cueDesliza: 'indicador',
};

/** El nivel de elemento de cada zona: su título, su ayuda, QUÉ campos de `config.campos` muestra
 *  (reusando `renderCampo` tal cual — label, input/textarea, `AyudaCampo`, y el control de estilo
 *  gemelo de la barra flotante cuando el campo lo declara, § `metaElementoEstilo`) y qué booleano
 *  apaga "Quitar". `indicador` no tiene campos — no hay texto que mostrar, sólo el interruptor —,
 *  igual que el prototipo (`hasText: sel !== 'cue'`). */
const ELEMENTO_HERO_DEFS: Record<ZonaHeroKey, {
  titulo: string;
  hint: string;
  campos: string[];
  boolName: 'titularVisible' | 'subtituloVisible' | 'ctasVisibles' | 'cueDesliza';
}> = {
  titular: { titulo: 'Titular', hint: 'El mensaje principal del hero.', campos: ['titulo', 'tituloEnfasis'], boolName: 'titularVisible' },
  subtitulo: { titulo: 'Subtítulo', hint: 'El texto bajo el titular.', campos: ['subtitulo'], boolName: 'subtituloVisible' },
  botones: { titulo: 'Botones', hint: 'Los dos botones del hero, juntos.', campos: ['ctaPrimarioLabel', 'ctaSecundarioLabel'], boolName: 'ctasVisibles' },
  indicador: { titulo: 'Indicador', hint: 'La línea animada al pie que invita a bajar, con la etiqueta «Desliza».', campos: [], boolName: 'cueDesliza' },
};

const TiendaSeccionEditor = forwardRef<TiendaSeccionEditorHandle, TiendaSeccionEditorProps>(function TiendaSeccionEditor({ config, categorias = [], categoriasListas = false, resaltar = null, carga, onAbrir, onCerrar, onCambioPublicado, onCambio, onPaso, onEstado, orden, valoresCruzados, onEscribirCruzado, onAyuda, onElementoActivoChange }, ref) {
  const { seccion } = config;
  const defaults = DEFAULTS[seccion] as unknown as Record<string, string | boolean>;

  // El catálogo REAL (§ cargarCatalogoReal, arriba) — SÓLO para `spotlight`, el único picker de
  // producto hoy; las demás secciones nunca disparan este fetch. `productosListos` distingue
  // "cargando" de "catálogo vacío de verdad" (mismo criterio que `categoriasListas`, arriba).
  const [catalogoReal, setCatalogoReal] = useState<Product[]>([]);
  const [productosListos, setProductosListos] = useState(false);
  useEffect(() => {
    if (seccion !== 'spotlight') return;
    let vivo = true;
    cargarCatalogoReal().then((v) => { if (vivo) { setCatalogoReal(v); setProductosListos(true); } });
    return () => { vivo = false; };
  }, [seccion]);

  const [form, setForm]               = useState<Datos | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [editando, setEditando]       = useState(false);
  // § EDITOR-VISUAL-PANEL-1 — el CHEVRON de la fila del Hero en el nivel Inicio (el spec: "el hero
  // desplegable en sus zonas y el valor de cada una"). SÓLO presentación: no toca `form` ni dispara
  // autoguardado — despliega una vista previa de las zonas con su valor ACTUAL, y tocar una zona abre
  // la sección completa (`abrirEdicion`), igual que tocar la fila misma. No se persiste ni se resetea
  // al cerrar: es un detalle de la lista, no del documento.
  const [zonasAbiertas, setZonasAbiertas] = useState(false);
  // § EDITOR-VISUAL-NIVELES-1 — EL NIVEL «elemento», SÓLO HERO (REDISENO.md § 3: "Inicio › Hero ›
  // Titular"). `null` = nivel Hero (composición/zonas/alto/fondo); una de las cuatro claves = el
  // panel baja a mostrar SÓLO ese campo + sus controles de estilo + «Quitar» (§ `renderElementoHero`,
  // más abajo). Vive ACÁ y no en `TiendaPaginas` a propósito: `TiendaPaginas` sólo conoce
  // secciones/cromo/instancias (§ `nivelActivo`), no zonas de una sección en particular — hacerle
  // aprender de zonas habría significado tocar su mecanismo de migas globales («‹ Inicio») por un
  // nivel que sólo existe DENTRO del hero. La miga local «‹ Hero» (`Migas`, reusada tal cual) vive
  // bajo esta misma cáscara; la miga global «‹ Inicio» de `TiendaPaginas` sigue arriba, y sigue
  // cerrando la sección entera (su `cerrar()` también resetea esto, ver `cerrarEdicion`) — PERO
  // (§ EDITOR-VISUAL-NIVELES-AJUSTE-1) deja de DIBUJARSE mientras ésta muestra la suya: las dos a
  // la vez eran "dos migas", medido. `TiendaPaginas` sigue sin aprender de ZONAS — sólo se entera
  // de si HAY un elemento activo o no, vía `onElementoActivoChange` abajo.
  const [elementoActivo, setElementoActivo] = useState<'titular' | 'subtitulo' | 'botones' | 'indicador' | null>(null);
  // Avisa al padre en cada cambio — mismo patrón que `onAbrir`/`onCerrar` (§ arriba): la instancia
  // avisa, el padre sólo escucha. No se llama a mano en cada `setElementoActivo(...)` (hay siete
  // call sites: abrir/cerrar edición, el puente del lienzo, cada zona, Quitar, la miga local) —
  // un efecto sobre el VALOR cubre los siete sin tener que tocar cada uno.
  useEffect(() => { onElementoActivoChange?.(elementoActivo !== null); }, [elementoActivo, onElementoActivoChange]);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  // El CONTROL al que pertenece `errorServidor` —el nombre del campo-imagen (hero, brandStory…), o
  // `null` para un error SIN control propio en este editor (publicar/descartar, o un ítem del
  // repeater, que no tiene una ubicación direccionable acá). Sólo así el mensaje puede pintarse JUNTO
  // al control que lo disparó (§ PANEL-ERROR-SUBIDA-VISIBLE-1) sin heredar el campo de un error viejo
  // cuando el dueño toca un control distinto o pide publicar/descartar.
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [procesando, setProcesando]   = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  // § EDITOR-TIENDA-COMPOSICION-1 — la vista «¿Cómo se arma tu hero?» (sólo hero, `config.composiciones`).
  const [composicionAbierta, setComposicionAbierta] = useState(false);
  // § EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1 — el autoguardado de ESTA sección acaba de fallar con
  // 401 (§ `guardarSeccion`, abajo). Aparte de `auto.estado` (que sólo sabe "error", no POR QUÉ):
  // es el mismo criterio que ya separa `esSesionVencida`/`MSG_SESION_VENCIDA` del coordinador
  // genérico de subidas (`useSubidaImagen`) en este mismo archivo — el COORDINADOR no necesita
  // conocer la razón del fallo para debounce/encolar/reintentar, sólo el LLAMADOR que hizo el fetch.
  const [sesionVencida, setSesionVencida] = useState(false);

  const formRef = useRef<Datos | null>(null); formRef.current = form;

  // ── EL RESALTE de tarjeta, SÓLO Presentaciones ────────────────────────────────────────────────
  // `tarjetaActiva` es el SLOT que el deep-link del aviso de config (§ más abajo) pide resaltar; el
  // bloque del form se marca "puesto" (`is-activo`) y recibe scroll. HASTA ESTE SLICE también lo
  // escribía un clic DENTRO de la vista previa local (el puente vista→formulario, § Backlog #46) —
  // ese disparador se fue CON la vista previa local (§ EDITOR-TIENDA-IFRAME-VISTA-1, arriba): no hay
  // más `VistaTiendaEnVivo`/`data-sf-tarjeta` que clickear acá. La dirección iframe→form (clic en la
  // tarjeta DENTRO del iframe compartido) es selección en contexto, `EDITOR-TIENDA-SELECCION-1` —
  // slice 4 del plan, fuera de `touches:` de éste.
  const puenteTarjetas = seccion === 'presentaciones';
  const [tarjetaActiva, setTarjetaActiva] = useState<number | null>(null);
  // Los BLOQUES-tarjeta del form, por SLOT — el destino del scroll. Callback ref que limpia al
  // desmontar (un nodo viejo tras remontaje es el defecto del observer, § EscalaDesktop).
  const bloquesRef = useRef<Map<number, HTMLElement>>(new Map());

  // ── LA PIEZA OPCIONAL (rule 3) — SÓLO Presentaciones ──────────────────────────────────────────
  // Una tarjeta opcional (slot 3-4) con TODOS sus campos en blanco NO aparece: se ofrece con "+
  // Agregar tarjeta". Al agregarla se EXPANDE (su bloque se monta) y no se vuelve a colapsar sola;
  // "Quitar" vacía sus campos y la devuelve a "+ Agregar". Los slots siguen siendo campos PLANOS
  // fijos (presentación del editor, no un repeater). INVARIANTE: una tarjeta VISIBLE nunca está vacía
  // (§ slotVacio) → su bloque siempre está montado y expandido, nunca detrás de "+ Agregar".
  // Cuántas filas mostrar en CADA lista plana (rule 2), POR LISTA (clave = su primer slot). Es un Map
  // porque una sección puede tener VARIAS listas —los beneficios POR PLAN de Suscripción (§ Backlog
  // #49): una lista por plan—, y "+ Agregar" en la de un plan no debe mover la de otro. Ausente para
  // una clave → deriva del último lleno; "+ Agregar" / "×" la mueven. Se resetea al abrir/cerrar.
  const [mostradosLista, setMostradosLista] = useState<Map<string, number>>(new Map());
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const colapsado = (slot: number): boolean =>
    puenteTarjetas && slotOpcional(config, slot)
    && slotVacio(form as Record<string, unknown>, slot) && !expandidos.has(slot);
  const expandir = (slot: number) => setExpandidos(prev => new Set(prev).add(slot));
  // "Quitar" (rule 3): vacía los campos de la tarjeta y la saca de los expandidos → vuelve a colapsar.
  const quitarTarjeta = (slot: number) => {
    cambiar({ [`label${slot}`]: '', [`copy${slot}`]: '', [`categoria${slot}`]: '', [`imagen${slot}`]: '' });
    setExpandidos(prev => { const n = new Set(prev); n.delete(slot); return n; });
  };

  // Muestra un error de SUBIDA: lo guarda, lo ata al CONTROL que lo disparó (si se conoce), y lo
  // anuncia con un toast (aviso flotante) — así se ve SIN hacer scroll, además de quedar junto al
  // control (§ PANEL-ERROR-SUBIDA-VISIBLE-1). El rechazo por sesión (§ esSesionVencida) suma un
  // enlace para volver a entrar — un "Reintenta" ahí no arregla nada, la sesión sigue vencida.
  const anunciarError = useCallback((msg: string, campo: string | null) => {
    setErrorServidor(msg);
    setErrorCampo(campo);
    toast.error(msg, esSesionVencida(msg)
      ? { action: { label: 'Iniciar sesión', onClick: () => { window.location.href = '/login'; } } }
      : undefined);
  }, []);

  // Qué campo-imagen FIJO ESTÁ EN VUELO (pidiendo el archivo o subiéndolo) — el uploader compartido es
  // UNA sola instancia para toda la cáscara (hero, brandStory, presentaciones…) y el repeater, así que
  // su `onError` no sabe por sí solo a qué control atribuir un fallo. Este ref lo dice: se fija al
  // EMPEZAR una acción propia de esta cáscara (`marcarCampoActivo`) y se CONSUME (vuelve a null) en
  // cuanto esa acción concluye —éxito o error—, para que un fallo del REPEATER (que llama a
  // `subida.pedir`/`.elegir` directo, sin pasar por acá) nunca herede el campo de una acción anterior
  // de la cáscara y quede pegado al control equivocado.
  const campoActivoRef = useRef<string | null>(null);
  const marcarCampoActivo = (campo: string) => {
    campoActivoRef.current = campo;
    setSubiendoCampo(campo);
    setErrorServidor(null); setErrorCampo(null); // una acción nueva no debe mostrar el error viejo pegado a OTRO control
  };

  // El uploader compartido (§ useSubidaImagen): la cáscara lo instancia y lo comparte con el
  // RepeaterEditor por `subida.pedir`. Un solo <input>, un solo `subiendo`. Su `onError` es lo único
  // que ve TODOS los fallos de validación de `pedir`/`elegir` (los del repeater incluidos, § arriba);
  // `null` (limpieza previa a una subida, § useSubidaImagen.alElegir) no consume el ref —el fallo real
  // de ESA MISMA acción puede llegar después y necesita seguir viendo el campo correcto—.
  const subida = useSubidaImagen({
    onError: (msg) => {
      if (msg === null) { setErrorServidor(null); setErrorCampo(null); return; }
      const campo = campoActivoRef.current;
      campoActivoRef.current = null;
      anunciarError(msg, campo);
    },
  });

  // Qué campo-imagen FIJO está subiendo (hero: `imagen`; brandStory: `imagen1..4`), para pegarle la
  // barra de progreso a ESE botón —no a todos—. Se limpia cuando la subida termina. (Las fotos del
  // repeater las rastrea el RepeaterEditor con su propio `subiendoDesde`.)
  const [subiendoCampo, setSubiendoCampo] = useState<string | null>(null);
  useEffect(() => { if (!subida.subiendo) setSubiendoCampo(null); }, [subida.subiendo]);

  // ── EL VIDEO DEL HERO (§ HERO-VIDEO-COMO-DATO-1) — SÓLO se usa cuando `seccion === 'hero'` ─────
  // La secuencia es la MISMA que `subirVideoYPoster` de RepeaterEditor —video elegido y RETENIDO
  // hasta elegir el póster (cancelar no deja un video huérfano), remux si es .mov, EL PÓSTER SUBE
  // PRIMERO (si el video grande falla después, el huérfano es una imagen chica, no un video de
  // varios MB)—, adaptada a un CAMPO PLANO: el hero no es una lista, así que no hay índice de ítem
  // ni RepeaterEditor que reusar. NO se extrae un hook compartido con RepeaterEditor en este slice
  // —serían dos formas (ítem de array vs campo plano) por una única sección nueva; queda anotado en
  // el reporte del slice como algo medido y no resuelto, no como un descuido—.
  const [heroVideoPendiente, setHeroVideoPendiente] = useState<File | null>(null);
  const [heroConvirtiendo, setHeroConvirtiendo] = useState(false);
  const [heroSubiendoPaso, setHeroSubiendoPaso] = useState<'convirtiendo' | 'póster' | 'vídeo' | null>(null);
  const heroOcupado = subida.subiendo || heroConvirtiendo;
  const heroTextoPaso = () => (heroSubiendoPaso === 'convirtiendo' ? 'Convirtiendo el video…' : `Subiendo ${heroSubiendoPaso}… ${subida.progreso ?? 0}%`);

  // El TOPE del video del hero es EL SUYO (§ MAX_VIDEO_HERO_BYTES, 8 MB — menos de la mitad que la
  // galería: el hero SIEMPRE está en el viewport, así que no hay forma de diferir la descarga si se
  // quiere que reproduzca). `subida.elegir`/`alElegirHold` (§ useSubidaImagen.ts, GENÉRICO y fuera
  // de `touches:` de este slice) validan tipo + CÓDEC + el tope de la GALERÍA (20 MB, hardcodeado
  // ahí) al elegir — no conocen al hero. Este chequeo cierra ENCIMA con el tope y el mensaje
  // CORRECTOS del hero: un archivo entre 8 y 20 MB lo rechaza ACÁ con el mensaje del hero; uno por
  // encima de 20 MB (o de 30 MB pre-remux para un .mov) ya lo rechazó `alElegirHold` ANTES de
  // llegar acá, con el mensaje GENÉRICO de la galería — un residuo de REDACCIÓN, documentado en
  // DECISIONS.md, no un hueco de TAMAÑO: en ningún caso sube al storage un video de hero por
  // encima de su propio tope.
  const agregarVideoHero = () => {
    marcarCampoActivo('imagen'); // desde ACÁ (el picker) ya es del hero: un rechazo de tipo/códec/tamaño debe verse junto a su control, no sólo al pie
    subida.elegir(f => {
      const esMov = (CONTENEDORES_REMUXEABLES as readonly string[]).includes(f.type);
      const limite = esMov ? MAX_VIDEO_HERO_BYTES * 1.5 : MAX_VIDEO_HERO_BYTES;
      if (f.size > limite) { anunciarError(MSG_VIDEO_HERO_LARGO, 'imagen'); return; }
      setHeroVideoPendiente(f);
    }, { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };

  const subirVideoYPosterHero = async (video: File, poster: File) => {
    marcarCampoActivo('imagen');
    try {
      let videoFinal = video;
      if ((CONTENEDORES_REMUXEABLES as readonly string[]).includes(video.type)) {
        setHeroSubiendoPaso('convirtiendo');
        setHeroConvirtiendo(true);
        try { videoFinal = await remuxMovAMp4(video); }
        finally { setHeroConvirtiendo(false); }
        // El tope EXACTO del hero sobre lo que se SUBE (post-remux): un .mov que pasó el
        // pre-chequeo (1.5×) pero cuya salida video-only sigue > 8 MB se rechaza acá.
        if (videoFinal.size > MAX_VIDEO_HERO_BYTES) throw new Error(MSG_VIDEO_HERO_LARGO);
      }
      setHeroSubiendoPaso('póster');
      const { url: posterUrl } = await subida.subir(poster, { kind: 'imagen' });
      setHeroSubiendoPaso('vídeo');
      const { url: videoUrl } = await subida.subir(videoFinal, { kind: 'imagen-o-video' });
      // LOS TRES A LA VEZ (§ el orden es la garantía): nunca un estado persistido con video sin
      // póster, ni con `imagenTipo` desincronizado de qué url hay en `imagen`.
      const nf = { ...(formRef.current as Datos), imagen: videoUrl, imagenPoster: posterUrl, imagenTipo: 'video' };
      aplicarCambioForm(nf); auto.flush();
      campoActivoRef.current = null; // éxito: no queda pegado a un error de otro control
    } catch (err) {
      anunciarError(err instanceof Error ? err.message : 'No se pudo subir el video. Reintenta.', 'imagen');
    } finally {
      setHeroVideoPendiente(null);
      setHeroSubiendoPaso(null);
    }
  };

  const elegirPosterParaHero = () => {
    const v = heroVideoPendiente;
    if (!v) return;
    marcarCampoActivo('imagen');
    subida.elegir(poster => subirVideoYPosterHero(v, poster), { tipos: TIPOS_PERMITIDOS, accept: ACCEPT_IMAGENES, msgError: 'Formato no admitido. Usa JPG, PNG o WebP.' });
  };

  // Volver a IMAGEN: cae al valor por defecto de `imagen` —el mismo gesto que "Por defecto" ya
  // ofrece para las demás imágenes fijas—, porque `imagen` guarda hoy la URL del VIDEO y no sirve
  // como imagen. Nunca deja `imagenTipo:'video'` apuntando a una url que no es video, ni viceversa.
  // `imagenMovil`/`imagenMovilPoster` (§ HERO-VIDEO-MOVIL-1) se vacían con el mismo gesto: son
  // DORMIDOS fuera del modo video (`fuentesVideoHero` sólo los consulta con `esVideo`), pero
  // dejarlos puestos dejaría un video de teléfono "fantasma" esperando a que alguien vuelva a
  // encender el video de escritorio — el mismo criterio que ya aplica `imagenPoster` acá.
  const volverAImagenHero = () => {
    const nf = { ...(formRef.current as Datos), imagenTipo: 'imagen', imagen: defaults.imagen, imagenPoster: '', imagenMovil: '', imagenMovilPoster: '' };
    aplicarCambioForm(nf); auto.flush();
  };

  // ── EL VIDEO DE TELÉFONO DEL HERO (§ HERO-VIDEO-MOVIL-1) — MISMA secuencia que el de escritorio
  // arriba (video retenido hasta elegir el póster, remux si es .mov, póster-antes-que-video), sobre
  // un SEGUNDO par de campos planos (`imagenMovil`/`imagenMovilPoster`). SÓLO tiene sentido con
  // `imagenTipo === 'video'` ya puesto (renderMediaHeroMovil, más abajo, no se muestra si no) — a
  // diferencia del video de escritorio, acá no hay toggle imagen↔video: es, de por sí, un AGREGADO
  // opcional sobre un hero que ya es video.
  const [heroVideoMovilPendiente, setHeroVideoMovilPendiente] = useState<File | null>(null);
  const [heroMovilConvirtiendo, setHeroMovilConvirtiendo] = useState(false);
  const [heroMovilSubiendoPaso, setHeroMovilSubiendoPaso] = useState<'convirtiendo' | 'póster' | 'vídeo' | null>(null);
  const heroMovilOcupado = subida.subiendo || heroMovilConvirtiendo;
  const heroMovilTextoPaso = () => (heroMovilSubiendoPaso === 'convirtiendo' ? 'Convirtiendo el video…' : `Subiendo ${heroMovilSubiendoPaso}… ${subida.progreso ?? 0}%`);

  // MISMO TOPE que el video de escritorio (§ MAX_VIDEO_HERO_BYTES): el video de teléfono vive en el
  // mismo viewport siempre visible, así que no hay razón para un presupuesto distinto.
  const agregarVideoMovilHero = () => {
    marcarCampoActivo('imagenMovil');
    subida.elegir(f => {
      const esMov = (CONTENEDORES_REMUXEABLES as readonly string[]).includes(f.type);
      const limite = esMov ? MAX_VIDEO_HERO_BYTES * 1.5 : MAX_VIDEO_HERO_BYTES;
      if (f.size > limite) { anunciarError(MSG_VIDEO_HERO_LARGO, 'imagenMovil'); return; }
      setHeroVideoMovilPendiente(f);
    }, { tipos: TIPOS_VIDEO, accept: ACCEPT_VIDEO, msgError: MSG_VIDEO_NO_ADMITIDO });
  };

  const subirVideoYPosterMovilHero = async (video: File, poster: File) => {
    marcarCampoActivo('imagenMovil');
    try {
      let videoFinal = video;
      if ((CONTENEDORES_REMUXEABLES as readonly string[]).includes(video.type)) {
        setHeroMovilSubiendoPaso('convirtiendo');
        setHeroMovilConvirtiendo(true);
        try { videoFinal = await remuxMovAMp4(video); }
        finally { setHeroMovilConvirtiendo(false); }
        if (videoFinal.size > MAX_VIDEO_HERO_BYTES) throw new Error(MSG_VIDEO_HERO_LARGO);
      }
      setHeroMovilSubiendoPaso('póster');
      const { url: posterUrl } = await subida.subir(poster, { kind: 'imagen' });
      setHeroMovilSubiendoPaso('vídeo');
      const { url: videoUrl } = await subida.subir(videoFinal, { kind: 'imagen-o-video' });
      // LOS DOS A LA VEZ (§ el orden es la garantía, como el video de escritorio): nunca un estado
      // persistido con `imagenMovil` sin su propio póster.
      const nf = { ...(formRef.current as Datos), imagenMovil: videoUrl, imagenMovilPoster: posterUrl };
      aplicarCambioForm(nf); auto.flush();
      campoActivoRef.current = null;
    } catch (err) {
      anunciarError(err instanceof Error ? err.message : 'No se pudo subir el video. Reintenta.', 'imagenMovil');
    } finally {
      setHeroVideoMovilPendiente(null);
      setHeroMovilSubiendoPaso(null);
    }
  };

  const elegirPosterParaMovilHero = () => {
    const v = heroVideoMovilPendiente;
    if (!v) return;
    marcarCampoActivo('imagenMovil');
    subida.elegir(poster => subirVideoYPosterMovilHero(v, poster), { tipos: TIPOS_PERMITIDOS, accept: ACCEPT_IMAGENES, msgError: 'Formato no admitido. Usa JPG, PNG o WebP.' });
  };

  // Quitar el video de teléfono: vacía los DOS campos a la vez — nunca un `imagenMovil` sin su
  // póster, ni al revés. El hero vuelve a mostrar sólo el video de escritorio en todo viewport.
  const quitarVideoMovilHero = () => {
    const nf = { ...(formRef.current as Datos), imagenMovil: '', imagenMovilPoster: '' };
    aplicarCambioForm(nf); auto.flush();
  };

  // § EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1 — la ventana del iframe, capturada del propio
  // `MessageEvent.source` de CUALQUIER mensaje iframe→panel que YA llega por el puente (§ editor-
  // puente.ts): todo mensaje de ese sentido trae, por especificación, la ventana que lo mandó. Deja
  // avisarle DIRECTO al campo flotante sin el `ref` imperativo que sólo `VistaTiendaIframe.tsx`
  // tiene (fuera de `touches:` de este slice) — mismo patrón que `TiendaPaginas.tsx` ya usa para su
  // propio listener de `TIPO_MENSAJE_CAMPO_IMAGEN_CLICK`, sin tocar ese archivo. Se re-captura en
  // CADA mensaje (no "sólo si está vacío"): un cambio de página remonta el `<iframe>`
  // (`key={pagina}`, `VistaTiendaIframe.tsx`) y la ventana vieja deja de ser la correcta.
  const iframeVentanaRef = useRef<Window | null>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.source) return;
      if (
        esMensajeSeccionClick(e.data) || esMensajeCampoCambio(e.data) || esMensajeCampoImagenClick(e.data)
        // § EDITOR-BARRA-ESTILO-ESCALONADO-1 — el mensaje COMPUESTO (zonas del hero, "Quitar" de la
        // barra de estilo) es TAMBIÉN un mensaje iframe→panel del campo flotante; sin esta rama, un
        // gesto compuesto no re-capturaría la ventana y el aviso de sesión vencida quedaría mandando
        // al `source` de un mensaje singular ANTERIOR (o a ninguno, tras un cambio de página).
        || esMensajeCamposCambio(e.data)
      ) {
        iframeVentanaRef.current = e.source as Window;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Avisa sesión vencida/recuperada — AL PANEL (`sesionVencida`, el estado de arriba) y, si el
  // campo abierto en el iframe es de ESTA sección, AL CAMPO FLOTANTE (postMessage directo a la
  // ventana capturada arriba; el iframe decide si le corresponde, § `EditorPuenteVivo.tsx`).
  // `sesionVencidaRef` evita re-mandar el MISMO valor en cada guardado EXITOSO —que corre cada
  // ~1 s mientras se tipea— cuando nunca hubo nada que avisar.
  const sesionVencidaRef = useRef(false);
  const avisarSesionVencida = useCallback((vencida: boolean) => {
    if (sesionVencidaRef.current === vencida) return;
    sesionVencidaRef.current = vencida;
    setSesionVencida(vencida);
    iframeVentanaRef.current?.postMessage(
      { tipo: TIPO_MENSAJE_SESION_VENCIDA, seccion, vencida, mensaje: vencida ? MSG_SESION_VENCIDA : undefined },
      window.location.origin,
    );
  }, [seccion]);

  // El 401 es el MISMO gate de sesión que ya firma el token de subida (`esSesionVencida`,
  // `lib/api/upload.ts`) — acá en el PUT de autoguardado. `avisarSesionVencida` reusa el MISMO
  // texto (`MSG_SESION_VENCIDA`, nunca copiado) para que el mensaje al campo flotante y el que
  // lanza esta función digan exactamente lo mismo.
  const guardarSeccion = useCallback(async (data: Datos) => {
    const res = await fetch('/api/site-content', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [seccion]: data }),
    });
    if (res.status === 401) {
      avisarSesionVencida(true);
      throw new Error(MSG_SESION_VENCIDA);
    }
    if (!res.ok) throw new Error('No se pudo guardar');
    avisarSesionVencida(false);
  }, [seccion, avisarSesionVencida]);
  const auto = useAutoguardado(guardarSeccion);

  // SIEMBRA del form desde el dato que bajó el padre (§ fetch 6→1). Una sola vez —guarda `form === null`—;
  // de ahí en más el editor es DUEÑO de su form (edita/autoguarda local), así que un re-render del padre
  // (p. ej. otro editor descartó y el doc se recargó) NO pisa los cambios de esta sección. `cargando`/
  // `errorCarga` DERIVAN del estado del padre — ya no hay fetch propio.
  useEffect(() => {
    if (form !== null || !carga.listo || carga.valor === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- siembra única del form desde el dato bajado por el padre (guarda `form === null`); no hay fetch que esperar
    setForm(carga.valor); setHayBorrador(carga.sinPublicar);
  }, [carga.listo, carga.valor, carga.sinPublicar, form]);
  const cargando = form === null && !carga.error;
  const errorCarga = carga.error ? 'No se pudo cargar el contenido.' : null;

  // § EDITOR-TIENDA-POSTMESSAGE-1 — EL CAMBIO EN VIVO, sin recargar. Antes, el iframe compartido
  // recargaba CADA VEZ que el autoguardado asentaba (la transición 'guardando'→'guardado') — el
  // "refresca con cada cambio" que el owner reportó. Ahora un solo `useEffect` sobre `form` cubre
  // los ~10 call sites que lo tocan (`cambiar`, `ponerImagen`, los videos del hero, descartar…) sin
  // instrumentar cada uno: la fuente de verdad es el STATE, no el gesto que lo produjo. `onCambio`
  // manda el form COMPLETO (no un diff) porque así es como `TiendaSeccionEditor` ya lo guarda —y
  // porque `fusionarContenidoSeccion` (el otro lado del puente) espera la sección completa, igual
  // que el PUT del autoguardado.
  //
  // La SIEMBRA inicial (form pasa de `null` al primer valor real, arriba) NO cuenta como un cambio
  // del dueño: mandarla sería re-aplicarle al iframe el mismo contenido que YA tiene (ruido, no un
  // bug) — se salta con un ref que marca "ya sembrado", UNA vez por montaje de esta sección.
  const sembradoRef = useRef(false);
  useEffect(() => {
    if (form === null) return;
    if (!sembradoRef.current) { sembradoRef.current = true; return; }
    onCambio?.(seccion, form);
  }, [form, seccion, onCambio]);

  // beforeunload SÓLO en 'error' (§ decisión): pendiente/guardando es común y recuperable.
  useEffect(() => {
    if (auto.estado !== 'error') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [auto.estado]);

  // ── § EDITOR-TIENDA-DESHACER-1 — EL PUNTO ÚNICO de mutación del form, para el historial ────────
  //
  // Antes había ~8 sitios que repetían `setForm(nf); setHayBorrador(true); auto.marcarSucio(nf);`
  // (texto vía `cambiar`, cada video del hero, `ponerImagen`/`usarPorDefecto`/`vaciarImagen`) — un
  // lote de historial necesita UN solo lugar que sepa "acá empieza un cambio del dueño", así que los
  // ocho se consolidaron acá. `loteAntesRef` guarda el valor de ANTES del PRIMER cambio desde el
  // último asentamiento (null = no hay lote abierto); el efecto de abajo, sobre `auto.estado`, lo
  // consume cuando el lote se asienta y empuja el paso.
  const loteAntesRef = useRef<Datos | null>(null);
  // `true` mientras un `deshacer()`/`rehacer()` está aplicando su propio valor (`restaurarForm`,
  // abajo): sin esta guarda, la restauración volvería a disparar el mismo efecto de abajo y
  // empujaría un paso NUEVO al historial por cada deshacer/rehacer — la pila de `historial-editor.ts`
  // ya lleva su propia cuenta de qué deshacer/rehacer; duplicarla acá la corrompería.
  const aplicandoHistorialRef = useRef(false);
  const aplicarCambioForm = (nf: Datos) => {
    if (loteAntesRef.current === null) loteAntesRef.current = formRef.current as Datos;
    // § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — `formRef.current` se actualiza ACÁ, no sólo en
    // el cuerpo del render (`formRef.current = form`, más abajo): esa asignación sólo corre en el
    // PRÓXIMO render, así que dos llamadas SÍNCRONAS a `cambiar()`/`escribirCampoSinAbrir()` en el
    // mismo tick (p. ej. "Quitar estilo" de un campo cruzado, cuatro escrituras de subcampo
    // seguidas vía `onEscribirCruzado`) leerían la MISMA base vieja y la segunda pisaría a la
    // primera — sólo la ÚLTIMA sobreviviría. Con esto, cada llamada ve el resultado de la anterior.
    formRef.current = nf;
    setForm(nf);
    setHayBorrador(true);
    auto.marcarSucio(nf);
  };

  // Un cambio de campo/toggle: pisa el form, marca borrador y ensucia el autoguardado — SIEMPRE,
  // incluso durante una subida. Una subida directa puede durar minutos y NO puede pausar la edición:
  // el texto se sigue guardando con la url VIEJA (o sin el ítem nuevo, que se crea al terminar), y la
  // url nueva llega en el flush post-subida. Nunca se guarda un ítem a medias (§ subirDirecto).
  const cambiar = (parcial: Datos) => {
    aplicarCambioForm({ ...(formRef.current as Datos), ...parcial });
  };

  // Deshacer/rehacer: aplica un valor COMPLETO de esta sección por el MISMO camino que cualquier
  // edición (§ el principio de EDICION-INLINE.md § 2.1 — "nunca un segundo camino de datos") y lo
  // persiste YA (`auto.flush()`), en vez de esperar el debounce: un deshacer que tarda 1s en
  // guardarse se siente roto aunque funcione.
  const restaurarForm = (valor: Datos) => {
    aplicandoHistorialRef.current = true;
    aplicarCambioForm(valor);
    auto.flush();
  };

  // EL PASO DE HISTORIAL: cuando el autoguardado se ASIENTA ('guardando'→'guardado', incluida la
  // recuperación de un 'error' anterior) y el lote abierto cambió algo de verdad (§ `sonIguales` —
  // sin esto, tipear y borrar lo mismo empujaría un paso vacío), se empuja `{deshacer, rehacer}` con
  // los dos extremos del lote. Suprimido (`aplicandoHistorialRef`) cuando el propio asentamiento lo
  // disparó un deshacer/rehacer — ver el comentario de arriba.
  const prevEstadoAutoRef = useRef(auto.estado);
  useEffect(() => {
    const prevEstado = prevEstadoAutoRef.current;
    prevEstadoAutoRef.current = auto.estado;
    if (prevEstado === auto.estado || auto.estado !== 'guardado') return;
    const antes = loteAntesRef.current;
    loteAntesRef.current = null;
    const fueHistorial = aplicandoHistorialRef.current;
    aplicandoHistorialRef.current = false;
    if (fueHistorial || antes === null) return;
    const despues = formRef.current as Datos;
    if (sonIguales(antes, despues)) return;
    onPaso?.({ deshacer: () => restaurarForm(antes), rehacer: () => restaurarForm(despues) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo importa CUÁNDO `auto.estado`
    // cambia; `onPaso`/`restaurarForm` leen refs y no memoizan, incluirlas reharía correr este
    // efecto en cada render sin ganar nada (mismo criterio que el resto del archivo).
  }, [auto.estado]);

  // § EDITOR-TIENDA-DESHACER-1 — el AGREGADO de "N cambios sin publicar"/"Guardando…" de la barra
  // del editor vive en `TiendaPaginas` (el padre no puede leer el estado interno de cada sección
  // montada); esta sección sólo REPORTA el suyo en cada cambio real de `hayBorrador`/`auto.estado`.
  useEffect(() => {
    onEstado?.(seccion, { hayBorrador, estado: auto.estado });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onEstado` no memoiza (closure fresca
    // en cada render del padre); lo que importa es CUÁNDO `hayBorrador`/`auto.estado` cambian.
  }, [seccion, hayBorrador, auto.estado]);

  const set = (name: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => cambiar({ [name]: e.target.value });

  // Pide una subida al uploader compartido y pisa el campo-imagen con la url resultante. El
  // marcar-sucio + flush van EXPLÍCITOS (no por `cambiar`), como en el uploader original: subir,
  // luego guardar. El callback corre con `subiendo` ya en false (§ useSubidaImagen), así que
  // marcarSucio no se descarta.
  const ponerImagen = (campo: string) => {
    marcarCampoActivo(campo); // para pegarle la barra Y un eventual error a este botón
    subida.pedir(url => {
      campoActivoRef.current = null; // éxito: no queda pegado a un error de otro control
      const nf = { ...(formRef.current as Datos), [campo]: url };
      aplicarCambioForm(nf); auto.flush();
    });
  };

  const usarPorDefecto = (campo: string) => {
    const nf = { ...(formRef.current as Datos), [campo]: defaults[campo] };
    aplicarCambioForm(nf); auto.flush();
  };

  // Vacía un campo-imagen OPCIONAL (§ CampoImagen.opcional, HISTORIA-COMO-MUESTRARIO-1) — DISTINTO de
  // `usarPorDefecto`: ésa pisa con `defaults[campo]` (para brandStory, un asset REAL de Nayoli, no una
  // cadena vacía — "Por defecto" y "Quitar" son dos destinos distintos). `''` es lo que
  // `REGISTRY.<seccion>.campos[campo] === 'opcional'` ya trata como AUSENTE al resolver (se OMITE,
  // nunca cae al default — § site-content-defaults.ts, "la frontera fina de defaults-como-fallback"):
  // este botón sólo agrega el CONTROL para escribir ese vacío, no cambia qué hace el resolver con él.
  const vaciarImagen = (campo: string) => {
    const nf = { ...(formRef.current as Datos), [campo]: '' };
    aplicarCambioForm(nf); auto.flush();
  };

  // Abrir/cerrar edición RESETEA el estado efímero del editor —tarjeta activa del puente y grupos
  // expandidos a mano—. El componente NO se desmonta al cerrar (es otra rama del mismo render, § la
  // pantalla), así que `useState(new Set())` no vuelve a correr; sin este reset, un grupo opcional
  // que abrí a mano seguiría abierto al reabrir. El colapso DERIVA de los datos (vacío → colapsado);
  // la expansión manual vive sólo mientras el editor está abierto (§ Fix 2).
  // `heroVideoPendiente`/`heroSubiendoPaso` se resetean igual que `expandidos`/`tarjetaActiva`: es
  // estado efímero de UI (el `File` elegido nunca se persistió), así que reabrir empieza limpio. Un
  // upload YA en vuelo (heroOcupado) sigue corriendo en segundo plano —fire-and-forget, como el
  // resto de las mutaciones de esta cáscara— y su `finally` limpia estos mismos estados al terminar.
  // `campoActivoRef` se limpia en las dos puntas (abrir/cerrar): es un ref de vida CORTA —sólo vale
  // mientras la acción que lo fijó está en vuelo (§ marcarCampoActivo)— y un ciclo cerrar→reabrir no
  // debe dejarlo apuntando a un control de una sesión de edición anterior.
  // `onAbrir` (§ EDITOR-TIENDA-IFRAME-VISTA-1): abrir NO muta nada —ni autoguardado ni borrador—,
  // así que notificar al padre acá es seguro incluso si el iframe todavía no cargó.
  const abrirEdicion = () => { setEditando(true); setExpandidos(new Set()); setTarjetaActiva(null); setMostradosLista(new Map()); setElementoActivo(null); setHeroVideoPendiente(null); setHeroSubiendoPaso(null); setHeroVideoMovilPendiente(null); setHeroMovilSubiendoPaso(null); campoActivoRef.current = null; onAbrir?.(seccion); };
  const cerrarEdicion = () => { auto.flush(); setEditando(false); setExpandidos(new Set()); setTarjetaActiva(null); setMostradosLista(new Map()); setElementoActivo(null); setHeroVideoPendiente(null); setHeroSubiendoPaso(null); setHeroVideoMovilPendiente(null); setHeroMovilSubiendoPaso(null); campoActivoRef.current = null; onCerrar?.(seccion); };

  // EL VALOR REMOTO (iframe→lista) es SIEMPRE un string en el mensaje (§ `MensajeCampoCambio.valor`,
  // editor-puente.ts) — nunca cambia de forma para no tocar `VistaTiendaIframe.tsx`/`TiendaPaginas.
  // tsx` (fuera de `touches:` de este slice). Un campo BOOLEANO de ESTA sección (§ `CampoBooleano`,
  // `config.booleanos` — hoy sólo el hero, § EDITOR-TIENDA-ZONAS-1: las zonas "+ Titular"/"Quitar"/
  // el segundo campo del velo postean `'true'`/`'false'` por este MISMO canal) necesita COERCIÓN: si
  // se dejara pasar como string, `cambiar()` guardaría `titularVisible:'false'` —truthy SIEMPRE— y
  // el PUT de autoguardado (`z.boolean().optional()`, site-content-schema.ts) lo rechazaría. Se
  // detecta por NOMBRE contra `config.booleanos` —la MISMA lista que ya declara cuáles son
  // booleanos, no una segunda—, así que sirve para CUALQUIER sección futura que postee un booleano
  // por este canal, no sólo para el hero de hoy. Los demás campos (texto, escalares como `alto`/
  // `veloIntensidad`) siguen por `fusionCampoEditable`, sin tocar.
  //
  // `base` es OPCIONAL (default `formRef.current`, § EDITOR-TIENDA-CAMPO-EDITABLE-1) — lo pasa
  // EXPLÍCITO `escribirCampos` (§ EDITOR-BARRA-ESTILO-ESCALONADO-1, abajo) para encadenar el
  // SEGUNDO campo de un lote sobre el resultado del PRIMERO: `formRef.current` sólo se
  // re-sincroniza en el render SIGUIENTE a un `setForm` (§ el docstring retirado de
  // `postarEscalonado`, `EditorPuenteVivo.tsx`), así que leerlo dos veces en el MISMO tick para dos
  // campos del mismo mensaje pisaría el primero con el segundo — el defecto que el mensaje
  // compuesto existe para cerrar.
  const parcialDeCampoRemoto = (campo: string, valor: string, base: Datos = (formRef.current ?? {}) as Datos): Datos | null => {
    if (config.booleanos?.some((b) => b.name === campo)) return { [campo]: valor === 'true' };
    return fusionCampoEditable(base, campo, valor);
  };

  // ── EL CAMPO FLOTANTE (§ EDITOR-TIENDA-CAMPO-EDITABLE-1) — iframe→lista, un campo por tecla ────
  // Llamado desde `TiendaPaginas` cuando un `TIPO_MENSAJE_CAMPO_CAMBIO` resuelve a ESTA sección
  // (§ `TiendaSeccionEditorHandle.escribirCampo`, arriba). Abre la edición si estaba cerrada —SIN
  // desplazar, a diferencia de `seleccionar`: el dueño ya está mirando el campo DENTRO del iframe—
  // y aplica el MISMO `cambiar()` que el `onChange` de un input de la lista, con el parcial que
  // `fusionCampoEditable` arma a partir del `form` actual (soporta tanto un campo plano como uno de
  // ítem de repeater). Un `campo` que no se puede aplicar (ruta inválida, índice fuera de rango) se
  // IGNORA — el próximo mensaje (la próxima tecla) lo reintenta igual.
  const escribirCampo = (campo: string, valor: string) => {
    if (!editando) abrirEdicion();
    // § EDITOR-VISUAL-NIVELES-1 — "al tocar una zona… EN LA PÁGINA" (el spec) abre su nivel de
    // elemento, SIN tocar el puente del iframe (`EditorPuenteVivo.tsx`/`editor-puente.ts`, fuera de
    // `touches:` de este slice): un clic en el titular DENTRO del lienzo ya llega acá como el PRIMER
    // `TIPO_MENSAJE_CAMPO_CAMBIO` de esa zona (una tecla, o el "+Titular"/"Quitar" del lienzo —
    // § `mensajesVisibilidadZona`, que postea el mismo canal con el nombre del booleano), así que
    // basta con leer QUÉ campo llegó para saber a qué zona pertenece — ningún mensaje nuevo.
    if (seccion === 'hero') {
      const zona = ZONA_HERO_DE_CAMPO[campo];
      if (zona) setElementoActivo(zona);
    }
    const parcial = parcialDeCampoRemoto(campo, valor);
    if (parcial) cambiar(parcial);
  };

  // ── EL CAMBIO COMPUESTO (§ EDITOR-BARRA-ESTILO-ESCALONADO-1) — iframe→lista, UN gesto/VARIOS
  // campos a la vez ───────────────────────────────────────────────────────────────────────────────
  // Gemelo PLURAL de `escribirCampo`, llamado cuando un `TIPO_MENSAJE_CAMPOS_CAMBIO` resuelve a
  // ESTA sección (zonas del hero, "Quitar" de la barra de estilo — § `TiendaSeccionEditorHandle.
  // escribirCampos`, arriba). Encadena `parcialDeCampoRemoto` sobre un ACUMULADOR LOCAL —nunca sobre
  // `formRef.current` repetido— para que el segundo campo del lote funda sobre el resultado del
  // primero, y aplica el RESULTADO COMPLETO con UNA sola llamada a `aplicarCambioForm`: un lote, un
  // paso de historial, sin depender de que React re-renderice entre un campo y el siguiente (el
  // defecto que motivó el `setTimeout` escalonado que este mensaje reemplaza). Un `campo` del lote
  // que no se puede aplicar se IGNORA y el resto sigue — mismo criterio que `escribirCampo`.
  const escribirCampos = (campos: Array<{ campo: string; valor: string }>) => {
    if (campos.length === 0) return;
    if (!editando) abrirEdicion();
    let acumulado = (formRef.current ?? {}) as Datos;
    for (const { campo, valor } of campos) {
      if (seccion === 'hero') {
        const zona = ZONA_HERO_DE_CAMPO[campo];
        if (zona) setElementoActivo(zona);
      }
      const parcial = parcialDeCampoRemoto(campo, valor, acumulado);
      if (parcial) acumulado = { ...acumulado, ...parcial };
    }
    aplicarCambioForm(acumulado);
  };

  // § EDITOR-TIENDA-MARQUESINA-EN-HERO-1 — gemelo SIN `abrirEdicion()` (§ el docstring del handle,
  // arriba): la escritura remota de un campo `seccionCruzada` no debe expandir ESTA tarjeta — quien
  // disparó el clic ya decidió abrir la OTRA (la que declara el campo visible). El mismo
  // `fusionCampoEditable` + `cambiar()` de siempre: un único escritor/autoguardado de esta sección.
  const escribirCampoSinAbrir = (campo: string, valor: string) => {
    const parcial = parcialDeCampoRemoto(campo, valor);
    if (parcial) cambiar(parcial);
  };

  // ── EL CLIC EN IMAGEN/VIDEO (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1) — iframe→lista ───────────
  // Nunca una segunda implementación de "elegir y subir": dispara el MISMO flujo que su botón
  // equivalente en la lista (`ponerImagen`/`agregarVideoHero`/`agregarVideoMovilHero`, ya definidos
  // arriba). Para el HERO, "cambiar la imagen" significa algo distinto según el campo Y el modo
  // actual (imagen/video) — se resuelve con el MISMO criterio que ya usan los botones de
  // `renderMediaHero`/`renderMediaHeroMovil`, sin inventar un cuarto camino:
  //   - `imagen`: en modo imagen, "Cambiar" (`ponerImagen`); en modo video, "Cambiar video"
  //     (`agregarVideoHero`) — es el elemento que el clic tocó.
  //   - `imagenPoster`: sólo tiene flujo PROPIO en modo video ("Cambiar póster",
  //     `ponerImagen('imagenPoster')`); fuera de modo video no existe ese botón, así que no hace nada.
  //   - `imagenMovil`/`imagenMovilPoster`: comparten el MISMO flujo ("Agregar/Cambiar video para
  //     teléfono", `agregarVideoMovilHero` — el par se sube siempre junto, § su propio comentario),
  //     sólo con video de escritorio ya puesto.
  // Cualquier otro campo-imagen (otras secciones, sin la dualidad del hero) cae al flujo genérico
  // `ponerImagen(campo)` — el mismo que usaría su botón "Cambiar" en la lista.
  const dispararSelectorImagen = (campo: string) => {
    if (subida.subiendo || heroConvirtiendo || heroMovilConvirtiendo) return; // una subida ya en vuelo
    if (seccion === 'hero') {
      const esVideo = (formRef.current as Datos | null)?.imagenTipo === 'video';
      if (campo === 'imagen') { if (esVideo) agregarVideoHero(); else ponerImagen('imagen'); return; }
      if (campo === 'imagenPoster') { if (esVideo) ponerImagen('imagenPoster'); return; }
      if (campo === 'imagenMovil' || campo === 'imagenMovilPoster') { if (esVideo) agregarVideoMovilHero(); return; }
    }
    ponerImagen(campo);
  };

  // El `<input type="file">` que `dispararSelectorImagen` dispara SÓLO existe en el DOM dentro de la
  // rama de EDICIÓN (§ más abajo, "EL PANEL RECESADO"): si la sección estaba cerrada, hay que abrirla
  // primero y esperar al RE-RENDER donde ese input ya está montado antes de hacer `.click()` —
  // llamarlo en el MISMO tick que `abrirEdicion()` apuntaría a un ref todavía `null`. Este ref es el
  // puente entre los dos pasos (abrir → disparar en el próximo render), mismo principio que
  // `desplazarPendienteRef` usa un poco más abajo para "seleccionar".
  const campoImagenPendienteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editando) return;
    const pendiente = campoImagenPendienteRef.current;
    if (!pendiente) return;
    campoImagenPendienteRef.current = null;
    dispararSelectorImagen(pendiente);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dispararSelectorImagen` se redefine en
    // cada render (lee `formRef`/funciones no memoizadas); sólo importa CUÁNDO `editando` pasa a true.
  }, [editando]);

  const abrirSelectorImagen = (campo: string) => {
    if (!editando) { campoImagenPendienteRef.current = campo; abrirEdicion(); return; }
    dispararSelectorImagen(campo);
  };

  // § EDITOR-TIENDA-DESHACER-1 — las dos mitades de "Publicar/Descartar TODO" (§ el docstring de
  // `TiendaSeccionEditorHandle`, arriba). NUNCA pasan por `aplicarCambioForm`: no son una edición
  // del dueño, son el padre informando el RESULTADO de un publish/discard que YA ocurrió en el
  // servidor — empujar un paso de historial acá dejaría "deshacer" revirtiendo una publicación en
  // vez de una edición, que es otra cosa (§ el alcance declarado del historial, sólo ediciones).
  const marcarPublicado = () => setHayBorrador(false);
  const restaurarDesdePublicado = (valor: Record<string, unknown>) => {
    setForm(valor as Datos);
    setHayBorrador(false);
  };

  // ── LA SELECCIÓN EN CONTEXTO (§ EDITOR-TIENDA-SELECCION-1) — iframe→lista ─────────────────────
  // `rootRef` apunta a la raíz de CUALQUIERA de las dos ramas de render (la tarjeta cerrada o el
  // encabezado de la edición abierta, § los dos `ref={rootRef}` del render abajo): es lo que
  // `seleccionar()` desplaza a la vista DENTRO de la columna de la lista, que es su propio scroller
  // (`overflowY:auto`, `TiendaPaginas.tsx`) — `scrollIntoView` resuelve contra ÉSE, no contra la
  // ventana, sin que este componente necesite saber nada de ese scroller.
  //
  // `pedidoExterno` es un CONTADOR, no un booleano: cada clic DENTRO del iframe debe volver a
  // desplazar aunque la sección ya esté abierta y aunque sea la MISMA que la vez anterior — un
  // booleano que ya está en `true` no dispara un segundo efecto. El efecto hace DOS cosas según el
  // estado al momento del pedido: si está cerrada, la abre (como "Editar"; el scroll llega en el
  // SIGUIENTE efecto, cuando `editando` ya cambió — abrir YA agranda el bloque, scrollear antes
  // apuntaría a la posición de la tarjeta COLAPSADA); si ya está abierta, sólo desplaza.
  //
  // `procesadoHastaRef`/`desplazarPendienteRef` — EL BUG QUE ESTO ARREGLA, encontrado por EJECUCIÓN
  // (no por lectura): el efecto depende de `editando` ADEMÁS de `pedidoExterno`, así que CUALQUIER
  // cambio de `editando` lo vuelve a correr — también el de "Cerrar" MANUAL, horas después de que el
  // último pedido externo ya se atendió. Sin esta guarda, cerrar una sección que alguna vez se abrió
  // por selección en contexto la REABRÍA sola en el acto (`pedidoExterno` seguía siendo no-cero, así
  // que `!editando` volvía a leer "hay que abrir"). `procesadoHastaRef` recuerda el ÚLTIMO pedido ya
  // atendido —si `pedidoExterno` no cambió desde entonces, un cambio de `editando` es OTRA cosa (un
  // cierre manual), y el efecto no hace nada—; `desplazarPendienteRef` es el puente entre los DOS
  // pasos de abrir-y-luego-desplazar (abrir dispara un re-render con `editando` nuevo, y recién ahí,
  // con el pedido YA marcado procesado, se cumple la condición para desplazar).
  const rootRef = useRef<HTMLDivElement>(null);
  const [pedidoExterno, setPedidoExterno] = useState(0);
  const procesadoHastaRef = useRef(0);
  const desplazarPendienteRef = useRef(false);
  const seleccionar = useCallback(() => setPedidoExterno(n => n + 1), []);
  useEffect(() => {
    if (pedidoExterno !== procesadoHastaRef.current) {
      procesadoHastaRef.current = pedidoExterno;
      if (!editando) { desplazarPendienteRef.current = true; abrirEdicion(); return; }
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (desplazarPendienteRef.current && editando) {
      desplazarPendienteRef.current = false;
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `abrirEdicion` se redefine cada render
    // (no está memoizada); incluirla reharía correr este efecto en cada tecla sin razón. Lo que
    // importa es EL PEDIDO (`pedidoExterno`) y si YA está editando (`editando`), ambos en deps.
  }, [pedidoExterno, editando]);
  // `escribirCampo`/`abrirSelectorImagen` NO están memoizadas (como `cambiar`/`abrirEdicion`, de las
  // que dependen): van en las deps de `useImperativeHandle` igual, así que el handle se recompone en
  // cada render y SIEMPRE expone la versión fresca — más barato que encadenar `useCallback`s sobre
  // closures que ya de por sí se redefinen cada render.
  useImperativeHandle(
    ref,
    () => ({ seleccionar, cerrar: cerrarEdicion, escribirCampo, escribirCampos, escribirCampoSinAbrir, abrirSelectorImagen, marcarPublicado, restaurarDesdePublicado }),
    [seleccionar, escribirCampo, escribirCampos, escribirCampoSinAbrir, abrirSelectorImagen, marcarPublicado, restaurarDesdePublicado],
    // `cerrarEdicion` no está en las deps (igual que `abrirEdicion`, ya excluida arriba): se redefine
    // en cada render y el handle se recompone en cada render igual (ver el comentario de arriba).
  );

  // ── DEEP-LINK del aviso de config del Dashboard (§ Backlog #65) ────────────────────────────────
  // El enlace del aviso aterriza EN EL DEFECTO: abre la edición de ESTA sección y resalta+scrollea el
  // bloque del slot, reusando la MISMA maquinaria del puente (`tarjetaActiva` → `is-activo`, `bloquesRef`
  // → scrollIntoView). Abrir edición NO muta (no autosave, no borrador, no "Sin publicar") → no pelea el
  // contrato de borrador. Una sola vez, tras cargar el contenido:
  //  1. edición cerrada → abrirla y marcar el slot (como abrirEdicion, pero SIN nullear tarjetaActiva);
  //  2. edición abierta → el bloque ya montó (una tarjeta con defecto está SIEMPRE visible, § el invariante),
  //     scrollear a él. Guardado por ref para no re-disparar al editar/cambiar de página.
  const esObjetivo = resaltar != null && resaltar.seccion === seccion;
  const objetivoSlot = esObjetivo && puenteTarjetas ? resaltar!.slot : null;
  const deepLinkHecho = useRef(false);
  useEffect(() => {
    if (!esObjetivo || cargando || deepLinkHecho.current) return;
    if (!editando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link: abrir edición desde el enlace del aviso (sin mutar); el bloque se monta en el próximo render y el re-run scrollea. `objetivoSlot` puede ser null (sección sin tarjetas) → sin resaltar, sólo abre.
      setEditando(true); setExpandidos(new Set()); setMostradosLista(new Map()); setTarjetaActiva(objetivoSlot);
      onAbrir?.(seccion); // el deep-link también desplaza el iframe compartido, como un "Editar" manual
      return;
    }
    // Edición abierta: sin slot (sección sin tarjetas) con abrir alcanza; con slot, scrollear al bloque.
    if (objetivoSlot == null) { deepLinkHecho.current = true; return; }
    const nodo = bloquesRef.current.get(objetivoSlot);
    if (!nodo) return; // el bloque aún no montó; el próximo render (deps: form/editando) lo tendrá
    deepLinkHecho.current = true;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    nodo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onAbrir`/`seccion` son estables por render (seccion es prop fija, onAbrir se memoiza en el padre); agregarlos no cambia el disparo, sólo evita un lint ruidoso.
  }, [esObjetivo, objetivoSlot, cargando, editando, form]);

  // EL LAZY-MOUNT de la tarjeta de lectura (IntersectionObserver sobre `VistaTiendaEnVivo` a 1280px)
  // SE RETIRÓ CON SU CAUSA (§ EDITOR-TIENDA-IFRAME-VISTA-1): la tarjeta de lectura ya no monta un
  // componente pesado del storefront por sección — sólo título + estado + "Editar". El iframe
  // compartido de `TiendaPaginas` es la única vista en vivo, montada una vez por página.

  const accionBorrador = async (accion: 'publicar' | 'descartar') => {
    // Publicar/descartar NO tienen un control-imagen propio: su error se queda SOLO al pie
    // (`errorCampo=null`) — nunca pegado a un campo de una subida anterior que ya no aplica.
    setErrorServidor(null); setErrorCampo(null); setProcesando(true);
    try {
      const res = await fetch('/api/site-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, seccion }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorServidor(d?.error ?? (accion === 'publicar' ? 'No se pudo publicar.' : 'No se pudo descartar.'));
        setErrorCampo(null);
        return;
      }
      if (accion === 'publicar') {
        setHayBorrador(false);
        toast.success('Publicado — ya está en vivo.');
      } else {
        // Descartar re-lee lo PUBLICADO. Con el GET lifted, se pide el refetch COMPARTIDO al padre (que
        // devuelve el doc fresco) y se re-siembra el form de ESTA sección desde él → la vista en vivo
        // vuelve a lo publicado. Se re-siembra directo del retorno (no se espera el prop) y sólo esta
        // sección: el borrador de las otras no se toca (su `form !== null` bloquea la re-siembra por prop).
        const fresco = await carga.recargar();
        setForm((fresco.contenido?.[seccion] ?? {}) as Datos);
        setHayBorrador(false);
        toast.success('Cambios descartados — volviste a lo publicado.');
      }
      // Las DOS mutan lo que el visitante ve (publicar lo escribe; descartar lo revierte a lo
      // publicado) — el iframe compartido recarga en los dos casos (§ EDITOR-TIENDA-IFRAME-VISTA-1).
      onCambioPublicado?.();
    } finally { setProcesando(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="duna-card duna-card__pad" role="status">
        <span className="duna-sr-only">Cargando el contenido de la tienda…</span>
        <div className="duna-skel" aria-hidden style={{ width: '100%', maxWidth: '640px', aspectRatio: '16 / 9', borderRadius: 'var(--duna-r-m)' }} />
      </div>
    );
  }
  if (errorCarga || !form) {
    return (
      <div className="duna-card duna-card__pad">
        <p className="duna-field__error" role="alert">{errorCarga ?? 'No se pudo cargar.'}</p>
      </div>
    );
  }

  const subiendo = subida.subiendo;
  // El mapa de atenuación (§ PANEL-EDITOR-HERO-TOGGLES-1, item 1 — el PATRÓN GENERAL, reusable por
  // todo editor): qué campo de texto está gateado por qué interruptor de esta sección. Puro y barato
  // (arrays chicos), se recalcula por render — no vale un useMemo para esto.
  const gates = gatePorCampo(config);
  const puedePublicar = auto.estado === 'guardado' && !procesando;
  const enError = auto.estado === 'error';
  // `oculta` = el TOGGLE apagado (para el badge "Oculta"). `repeaterVacio` = una lista sin ítems, que
  // también hace que la sección no se renderice (hide-on-empty). `noSeMuestra` cubre las dos para el
  // placeholder de la vista/tarjeta: sin él, un repeater vacío deja la vista en BLANCO, que se lee como
  // roto. El mensaje distingue el porqué (toggle vs lista vacía).
  const oculta = config.ocultable && form.visible === false;
  const items = config.repeater ? form[config.repeater.itemsKey] : undefined;
  const repeaterVacio = !!config.repeater && !(Array.isArray(items) && items.length > 0);
  const noSeMuestra = oculta || repeaterVacio;
  const avisoNoSeMuestra = oculta
    ? 'Actívala con el interruptor para verla aquí.'
    : 'La lista está vacía — agrega el primero para verla aquí.';
  // En EDICIÓN se muestra siempre (incluido "Guardado", que confirma que no hay nada pendiente); en
  // la TARJETA sólo cuando hay algo que decir (`estado !== 'guardado'` o una subida en curso).
  const mostrarEstado = editando || auto.estado !== 'guardado';
  // § EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1 — con `sesionVencida`, el texto es el MISMO que ya usa
  // la subida de imágenes (`MSG_SESION_VENCIDA`, reusado): un "No se pudo guardar" genérico ahí
  // mentiría sobre la causa, y "Reintentar" prometería algo que no se va a lograr mientras la
  // sesión siga vencida (§ abajo, el link reemplaza al botón).
  const estadoTexto = auto.estado === 'guardando' ? 'Guardando…'
    : auto.estado === 'error' ? (sesionVencida ? MSG_SESION_VENCIDA : 'No se pudo guardar')
    : 'Guardado';

  // UNA sola definición del indicador, renderizada en las DOS ramas. Vivía sólo en el editor, y eso
  // dejaba INVISIBLE un guardado que fallara DESPUÉS de cerrar: el reintento seguía corriendo y el
  // beforeunload seguía guardando, pero el operador no veía nada (§ un guardado que falla sin
  // decirlo). Dos copias divergirían, así que se comparte, no se duplica.
  const indicadorEstado = mostrarEstado ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
      <span className={enError ? 'duna-field__error' : 'duna-caption'} style={{ margin: 0 }} role={enError ? 'alert' : undefined}>
        {estadoTexto}
      </span>
      {enError && (sesionVencida
        ? <a href="/login" className="duna-link">Iniciar sesión</a>
        : <button type="button" onClick={() => auto.reintentar()} className="duna-btn duna-btn--ghost duna-btn--sm">Reintentar</button>
      )}
    </div>
  ) : null;

  // ── BLOQUES (§ tienda-secciones · BloqueConfig): la sección se dibuja por BLOQUE. Un `seccion`
  //    (encabezado, o el derivado por defecto) apila imágenes + campos; una `tarjeta` es una PIEZA con
  //    su miniatura y sus campos, direccionada por SLOT (el destino del puente). Los encabezados de
  //    grupo se retiraron: la agrupación por tarjeta la da el bloque, no un `grupo` declarado dos veces.

  // EL ESTILO POR ELEMENTO (§ EDITOR-TIENDA-BARRA-FLOTANTE-1) — "el panel muestra lo mismo con más
  // espacio": estos dos helpers escriben el MISMO `form.estilos` que la barra flotante escribe vía
  // `postMessage` → `fusionCampoEditable` (campo-editable.ts), pero DIRECTO — el panel ya tiene el
  // `form` en memoria, así que pasar por la ruta con puntos (pensada para un mensaje con un `campo`
  // STRING) sería una vuelta innecesaria. Construyen el objeto a mano, con el MISMO `cambiar()`
  // partial-merge que usa cualquier otro campo.
  const escribirEstiloElemento = (elemento: string, sub: 'fuente' | 'tamano' | 'color' | 'alinear', valorCrudo: string) => {
    const estilosActuales = (form.estilos as Record<string, EstiloElementoResuelto> | undefined) ?? {};
    const actual = estilosActuales[elemento] ?? ESTILO_ELEMENTO_VACIO;
    // '' (la opción "Por defecto"/"Quitar") se normaliza a `null` ACÁ — así `form.estilos` siempre
    // tiene la MISMA forma que `resolverEstiloElemento` produciría, y el chequeo "¿hay algo puesto?"
    // (`EstiloElementoControles`, "Quitar estilo") no se engaña con una cadena vacía que no es `null`.
    const valor = valorCrudo === '' ? null : valorCrudo;
    cambiar({ estilos: { ...estilosActuales, [elemento]: { ...actual, [sub]: valor } } });
  };
  const quitarEstiloElemento = (elemento: string) => {
    const estilosActuales = (form.estilos as Record<string, EstiloElementoResuelto> | undefined) ?? {};
    cambiar({ estilos: { ...estilosActuales, [elemento]: ESTILO_ELEMENTO_VACIO } });
  };

  // GEMELO de los dos de arriba, para un elemento estilizable que vive en una sección CRUZADA
  // (§ EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — hoy, `marquesina.texto` dentro de la tarjeta del
  // hero). NO puede armar el objeto a mano como `escribirEstiloElemento` — el `form` de ESA sección
  // no es éste —, así que va por el MISMO canal que la barra flotante usa para CUALQUIER sección:
  // `onEscribirCruzado` con la ruta de tres partes `estilos.<elemento>.<subcampo>`, la que
  // `fusionCampoEditable` (campo-editable.ts) ya sabe aplicar — sin pasar por `postMessage` (están
  // en el mismo documento, como el resto de `onEscribirCruzado`).
  const escribirEstiloCruzado = (destino: SeccionVista, elemento: string, sub: 'fuente' | 'tamano' | 'color' | 'alinear', valorCrudo: string) => {
    onEscribirCruzado?.(destino, `estilos.${elemento}.${sub}`, valorCrudo);
  };
  // "Quitar" manda los CUATRO subcampos, uno por llamada — el canal cruzado no tiene un mensaje
  // COMPUESTO como `mensajesQuitarEstiloElemento` (ese vive del lado del iframe). Es seguro porque
  // `aplicarCambioForm` (arriba) sincroniza `formRef.current` en CADA llamada —de la sección
  // DESTINO, no de ésta—, así que la segunda escritura ve el resultado de la primera en vez de
  // pisarlo; sin esa sincronización, sólo la ÚLTIMA de las cuatro habría sobrevivido.
  const quitarEstiloCruzado = (destino: SeccionVista, elemento: string) => {
    for (const sub of ['fuente', 'tamano', 'color', 'alinear'] as const) {
      onEscribirCruzado?.(destino, `estilos.${elemento}.${sub}`, '');
    }
  };

  // UN CAMPO de texto/destino. El combobox de destino vive DONDE su campo esté declarado (dentro de la
  // tarjeta, con bloques). Sin encabezado de grupo.
  const renderCampo = (campo: CampoTexto) => {
    const id = `${seccion}-${campo.name}`;
    // § EDITOR-TIENDA-BARRA-FLOTANTE-1: ¿este campo es un elemento de texto ESTILIZABLE? Sólo
    // `seccion==='hero'` hoy declara alguno — `metaElementoEstilo` ya lo acota, así que no hace
    // falta repetir el `if (seccion === 'hero')` acá.
    const metaEstilo = metaElementoEstilo(seccion, campo.name);
    const estiloActual = (form.estilos as Record<string, EstiloElementoResuelto> | undefined)?.[campo.name] ?? ESTILO_ELEMENTO_VACIO;
    // `veloCombo` (§ EDITOR-TIENDA-ZONAS-1) NO es un campo real: su VALOR se COMPONE de
    // `veloVisible`+`veloIntensidad` (`veloComboDeCampos`) para mostrar «Nada·Suave·Medio·Fuerte» en
    // vez de los dos controles viejos. Detectado por NOMBRE, mismo criterio que
    // `opcionesDinamicas:'destaquePlanes'` de abajo — un literal, no un mecanismo genérico, porque es
    // el único campo compuesto que existe hoy.
    const esVeloCombo = campo.name === 'veloCombo';
    const value = esVeloCombo
      ? veloComboDeCampos(form.veloVisible !== false, String(form.veloIntensidad ?? 'media'))
      : String(form[campo.name] ?? '');
    // Aviso: el destino elegido ya no está en el catálogo (sólo si el catálogo YA cargó).
    const destinoInexistente = !!campo.categoria && categoriasListas && value.trim() !== '' && !categorias.includes(value);
    // Gemelo de `destinoInexistente`, para un PIN de producto (§ `campo.producto`, arriba): el slug
    // guardado ya no matchea ningún producto del catálogo real.
    const productoInexistente = !!campo.producto && productosListos && value.trim() !== '' && !catalogoReal.some((p) => p.slug === value);
    // La COMBINACIÓN del producto elegido (§ `campo.mostrarEjes`, DESTACADO-PRESENTACION-POR-TAMANO-1):
    // derivada con la MISMA función que arma la matriz en la tienda (`ejesSpotlight`) — nunca un
    // texto propio de este editor que pudiera divergir de lo que el visitante ve.
    const productoConEjes = campo.mostrarEjes ? catalogoReal.find((p) => p.slug === value) : undefined;
    const ejesProducto = productoConEjes ? ejesSpotlight(productoConEjes) : null;
    // Rótulo POR TÍTULO: «En grano» lleva a: usando el título en vivo de la misma tarjeta.
    const tituloTarjeta = campo.tituloDe ? String(form[campo.tituloDe] ?? '').trim() : '';
    const etiqueta = campo.tituloDe && tituloTarjeta ? `«${tituloTarjeta}» lleva a:` : campo.label;
    // Opciones del select: estáticas (`opciones`) o DERIVADAS del form (`opcionesDinamicas`, hoy los
    // planes que existen para el destaque, § opcionesDestaque). El form ES el contenido de la sección.
    const opciones = campo.opcionesDinamicas === 'destaquePlanes'
      ? opcionesDestaque(form as unknown as SuscripcionPlanesContent)
      : campo.opciones;
    // ATENUACIÓN (§ el patrón general, item 1): un campo gateado por un interruptor de sección
    // APAGADO no se esconde ni queda editable-sin-nota — se atenúa, con la nota de abajo. El dato
    // SIGUE editable (el input no se deshabilita): apagar el interruptor no debe impedir prepararlo
    // para cuando el dueño lo vuelva a encender, o para otro tema que sí lo muestre.
    const nombreGate = gates.get(campo.name);
    const atenuado = nombreGate !== undefined && form[nombreGate] === false;
    return (
      <div key={campo.name} className={`duna-field${campo.textarea ? ' duna-form__full' : ''}`} style={atenuado ? { opacity: 0.6 } : undefined}>
        <label className="duna-field__label" htmlFor={id}>{etiqueta}</label>
        {campo.categoria ? (
          <CategoriaCombobox id={id} value={value} categorias={categorias}
                             onChange={v => cambiar({ [campo.name]: v })} ariaDescribedby={`${id}-hint`} />
        ) : campo.producto ? (
          <ProductoCombobox id={id} value={value} productos={catalogoReal} productosListos={productosListos}
                             onChange={v => {
                               // § EDITOR-ARREGLOS-TITULAR-DESTACADO-1 — bug 2 del owner: cambiar el
                               // PIN de Destacado (`productoSlug`) limpia `nombreCafe` DE PASO — ese
                               // nombre editorial pertenece al café con el que se escribió, no al
                               // campo a secas (§ `parcialAlCambiarPinSpotlight`, spotlight.ts). Los
                               // otros tres punteros del grupo (presentación/tamaño/cuarto) son el
                               // MISMO café en otra talla y NO disparan esto — `nombreCafe` está
                               // diseñado para no cambiar ahí.
                               if (seccion === 'spotlight' && campo.name === 'productoSlug') {
                                 cambiar(parcialAlCambiarPinSpotlight(v));
                               } else {
                                 cambiar({ [campo.name]: v });
                               }
                             }} ariaDescribedby={`${id}-hint`} />
        ) : campo.transicionMarquesina && campo.opciones ? (
          // § EDITOR-TIENDA-TRANSICIONES-TARJETAS-1 — fila de tarjetas con mini animación en vez del
          // `<select>` nativo (que la rama de abajo sigue dando a todo OTRO campo con `opciones`).
          // `campo.opciones` (NO el `opciones` ya resuelto arriba, que también cubre `opcionesDinamicas`
          // — rama que `transicionMarquesina` nunca toma) porque es el único de los dos cuyo TIPO
          // garantiza el `hint` por opción que esta tarjeta necesita.
          <SelectorTransicion
            id={id}
            opciones={campo.opciones.map((o) => ({ value: o.value, label: o.label, hint: o.hint ?? '' }))}
            valor={value}
            onElegir={(v) => cambiar({ [campo.name]: v })}
            ariaDescribedby={`${id}-hint`}
            ariaLabel={etiqueta}
          />
        ) : opciones ? (
          // SELECT NATIVO (§ Controles de formulario) — `destacadoSlot`, con opciones derivadas.
          // `alto`/`veloCombo` (§ EDITOR-TIENDA-ZONAS-1) escriben MÁS de un campo real a la vez —
          // ver el `esVeloCombo` de arriba — nunca el `set(campo.name)` genérico, que pisaría un
          // solo campo y dejaría al otro desincronizado.
          <select
            id={id} className="duna-input duna-select" value={value} aria-describedby={`${id}-hint`}
            onChange={(e) => {
              const v = e.target.value;
              if (campo.name === 'alto') cambiar({ alto: v, alturaLlena: v === 'pantalla' });
              else if (esVeloCombo) cambiar(camposDeVeloCombo(v));
              else cambiar({ [campo.name]: v });
            }}
          >
            {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : campo.textarea ? (
          <textarea id={id} className="duna-input" rows={2} value={value} onChange={set(campo.name)} placeholder={campo.placeholder} aria-describedby={`${id}-hint`} />
        ) : (
          <input id={id} className="duna-input" value={value} onChange={set(campo.name)} placeholder={campo.placeholder} aria-describedby={`${id}-hint`} />
        )}
        {atenuado && (
          <p className="duna-field__hint" role="status" style={{ marginBottom: 0 }}>Este tema no lo muestra.</p>
        )}
        {destinoInexistente && (
          <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)', marginBottom: 0 }}>
            Ningún producto tiene la categoría «{value}» todavía — la tarjeta no traerá resultados.
          </p>
        )}
        {productoInexistente && (
          <p className="duna-field__hint" role="status" style={{ color: 'var(--duna-sol-ink)', marginBottom: 0 }}>
            Este producto ya no existe en el catálogo — elige uno de la lista.
          </p>
        )}
        {ejesProducto && (
          <p className="duna-field__hint" style={{ marginBottom: 0 }}>
            → {etiquetaEjesSpotlight(ejesProducto)}
          </p>
        )}
        <AyudaCampo texto={campo.hint} id={`${id}-hint`} />
        {/* § EDITOR-TIENDA-BARRA-FLOTANTE-1 — "el panel muestra lo mismo con más espacio": el MISMO
            control que la barra flotante del iframe, debajo del campo al que pertenece. Sin
            `rolesLegibles` (el panel no conoce el fondo real de la zona del storefront, a diferencia
            del iframe) — se muestran los seis roles siempre. */}
        {metaEstilo && (
          <EstiloElementoControles
            valor={estiloActual}
            sinAlinear={!!metaEstilo.sinAlinear}
            onCambiar={(sub, v) => escribirEstiloElemento(campo.name, sub, v)}
            onQuitar={() => quitarEstiloElemento(campo.name)}
          />
        )}
      </div>
    );
  };

  // ── CAMPOS CRUZADOS (§ EDITOR-TIENDA-MARQUESINA-EN-HERO-1, `CampoTexto.seccionCruzada`) ──────────
  // Un campo declarado con `seccionCruzada` vive en OTRA sección del REGISTRY: se MUESTRA en esta
  // tarjeta, agrupado por la sección a la que pertenece de verdad, pero su valor y su escritura NUNCA
  // pasan por el `form`/autoguardado de ESTA sección — se leen de `valoresCruzados` y se escriben vía
  // `onEscribirCruzado`, que el padre (`TiendaPaginas`) resuelve al handle REAL
  // (`escribirCampoSinAbrir`). Así sigue habiendo un único escritor de la sección destino, sea cual
  // sea la tarjeta desde la que se edite. Deliberadamente SIMPLE (label + hint + input/textarea): los
  // campos cruzados de hoy (`marquesina.texto`/`.productoSlug`) son texto llano, sin categoria/
  // producto/opciones — si alguno los ganara, se amplía acá, no se duplica `renderCampo` entero.
  const camposCruzados = config.campos.filter((c) => c.seccionCruzada);
  const gruposCruzados = new Map<SeccionVista, CampoTexto[]>();
  for (const c of camposCruzados) {
    const destino = c.seccionCruzada!;
    const lista = gruposCruzados.get(destino) ?? [];
    lista.push(c);
    gruposCruzados.set(destino, lista);
  }
  const renderCampoCruzado = (destino: SeccionVista, campo: CampoTexto) => {
    const id = `${seccion}-cruzado-${destino}-${campo.name}`;
    const value = String(valoresCruzados?.[destino]?.[campo.name] ?? '');
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onEscribirCruzado?.(destino, campo.name, e.target.value);
    // § EDITOR-TIENDA-ESTILO-MARQUESINA-TICKER-1 — ¿este campo cruzado es TAMBIÉN un elemento
    // estilizable? `metaElementoEstilo` se consulta contra `destino` (la sección DUEÑA real, p. ej.
    // `marquesina`), nunca contra `seccion` (la que lo muestra, `hero`) — la misma distinción que
    // `camposDeSeccionEditor` (panel-controles.ts) ya usa para atribuir el campo a su dueño.
    const metaEstiloCruzado = metaElementoEstilo(destino, campo.name);
    const estilosCruzados = valoresCruzados?.[destino]?.estilos;
    const estiloCruzadoActual = resolverEstiloElemento(
      estilosCruzados && typeof estilosCruzados === 'object' && !Array.isArray(estilosCruzados)
        ? (estilosCruzados as Record<string, unknown>)[campo.name]
        : undefined,
    );
    return (
      <div key={campo.name} className={`duna-field${campo.textarea ? ' duna-form__full' : ''}`}>
        <label className="duna-field__label" htmlFor={id}>{campo.label}</label>
        {campo.textarea ? (
          <textarea id={id} className="duna-input" rows={2} value={value} onChange={onChange} placeholder={campo.placeholder} aria-describedby={`${id}-hint`} />
        ) : (
          <input id={id} className="duna-input" value={value} onChange={onChange} placeholder={campo.placeholder} aria-describedby={`${id}-hint`} />
        )}
        <AyudaCampo texto={campo.hint} id={`${id}-hint`} />
        {metaEstiloCruzado && (
          <EstiloElementoControles
            valor={estiloCruzadoActual}
            sinAlinear={!!metaEstiloCruzado.sinAlinear}
            onCambiar={(sub, v) => escribirEstiloCruzado(destino, campo.name, sub, v)}
            onQuitar={() => quitarEstiloCruzado(destino, campo.name)}
          />
        )}
      </div>
    );
  };

  // UN INTERRUPTOR de sección (§ CampoBooleano) — switch, mismo patrón visual que el toggle de
  // visibilidad de abajo (`config.ocultable`), pero gatea UNA capacidad en vez de la sección entera.
  // El valor inicial ya lo trae el form (sembrado del preset, o del default si el preset no lo tocó —
  // `resolverSiteContent` resuelve todo booleano declarado a un valor real): el preset pone el punto
  // de partida, el dueño lo overridea con el switch.
  const renderBooleano = (campo: CampoBooleano) => {
    const on = form[campo.name] !== false;
    return (
      <div key={campo.name}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={campo.label}
            onClick={() => cambiar({ [campo.name]: !on })}
            className={`duna-switch${on ? ' is-on' : ''}`}
          >
            <span className="duna-switch__thumb" />
          </button>
          <span className="duna-field__label" style={{ margin: 0 }}>{campo.label}</span>
        </div>
        {campo.hint && <div style={{ marginTop: 'var(--duna-space-2)' }}><AyudaCampo texto={campo.hint} /></div>}
      </div>
    );
  };

  // LA LISTA DE ZONAS DEL HERO (§ EDITOR-VISUAL-NIVELES-1, antes EDITOR-TIENDA-ZONAS-1, REDISENO.md
  // § 2/§ 4) — filas al estilo del prototipo (`.zr`/`.zi`/`.zt`/`.zadd`): ícono + nombre + VALOR en
  // gris, y «+ Agregar» sólo cuando está vacía. Reemplaza al renglón "Mostrar los botones / Quitar"
  // (switch + frase larga) que el owner señaló en la aprobación como "el formulario viejo" — mismo
  // dato (`cambiar({[boolName]: …})`), sólo cambia la presentación Y agrega la navegación al nivel de
  // elemento (abajo, `renderElementoHero`): una zona LLENA se TOCA para editarla; una VACÍA se agrega
  // Y se abre a la vez, para que el dueño pueda escribir de inmediato.
  //
  // `alturaLlena`/`veloVisible` NO entran a esta lista — § el pedido del spec los REEMPLAZA por el
  // segmentado de `alto` ("Justo·Alto·Pantalla completa") y el de `veloCombo` ("Nada·Suave·Medio·
  // Fuerte"), § `renderAltoYFondo` más abajo. `config.booleanos` SIGUE declarando los seis nombres
  // (bookkeeping de `panel-controles.ts`); esta lista sólo filtra CUÁLES pinta.
  const ZONA_HERO_ORDEN: { key: ZonaHeroKey; gl: string }[] = [
    { key: 'titular', gl: 'T' },
    { key: 'subtitulo', gl: '¶' },
    { key: 'botones', gl: '▭' },
    { key: 'indicador', gl: '↓' },
  ];
  /** El estado de UNA zona a partir del `form` actual — compartido entre esta lista y el chevron de
   *  la fila colapsada (`!editando`, más abajo), para que las dos lecturas del mismo dato no puedan
   *  divergir. */
  const zonaHeroEstado = (key: ZonaHeroKey): { on: boolean; valor: string } => {
    const on = form[ELEMENTO_HERO_DEFS[key].boolName] !== false;
    if (key === 'titular') return { on, valor: on ? (String(form.titulo ?? '').trim() || '—') : 'Vacío' };
    if (key === 'subtitulo') return { on, valor: on ? (String(form.subtitulo ?? '').trim() || '—') : 'Vacío' };
    if (key === 'botones') return { on, valor: on ? (String(form.ctaPrimarioLabel ?? '').trim() || '—') : 'Vacíos' };
    return { on, valor: on ? 'Desliza' : 'Vacío' }; // indicador: sin texto propio (§ ELEMENTO_HERO_DEFS)
  };
  const renderZonasHero = () => (
    <div className="admin-bloque">
      <span className="duna-field__label" style={{ display: 'block', marginBottom: 'var(--duna-space-2)' }}>Zonas</span>
      {ZONA_HERO_ORDEN.map(({ key, gl }) => {
        const def = ELEMENTO_HERO_DEFS[key];
        const { on, valor } = zonaHeroEstado(key);
        // Vacía → el switch pasa a 'true' Y se abre el elemento, en el MISMO click: el dueño quiere
        // escribir, no sólo encender un interruptor y tener que tocar de nuevo. Llena → sólo abre.
        const abrir = () => { if (!on) cambiar({ [def.boolName]: true }); setElementoActivo(key); };
        return (
          <div key={key} className={`editor-zr${on ? '' : ' is-empty'}`}>
            <button type="button" className="editor-zr__main" onClick={abrir}>
              <span className="editor-zr__icon" aria-hidden>{gl}</span>
              <span className="editor-zr__text"><b>{def.titulo}</b><span>{valor}</span></span>
            </button>
            {!on && (
              <button type="button" className="editor-zr__add" onClick={abrir}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  // EL NIVEL DE ELEMENTO (§ EDITOR-VISUAL-NIVELES-1, REDISENO.md § 3: "«‹ Hero», el campo de texto a
  // lo ancho, y debajo los MISMOS controles de la barra flotante… y «Quitar» al pie"). REUSA
  // `renderCampo` tal cual —no una segunda forma de pintar un campo—: cada campo de la zona ya trae
  // su label, su `AyudaCampo`, y (cuando `metaElementoEstilo` lo declara) el control de estilo gemelo
  // de la barra flotante. `Migas` es la MISMA primitiva que `TiendaPaginas` usa para «‹ Inicio» —su
  // propio docstring ya preveía este uso ("cuando el nivel «elemento» exista, este mismo componente
  // sirve sin cambios")—, con `nivelAnterior="Hero"` en vez de "Inicio": la miga GLOBAL de arriba
  // (TiendaPaginas) sigue diciendo «‹ Inicio» sin cambios — cierra la SECCIÓN entera; ésta es una
  // SEGUNDA miga, local a esta cáscara, que sólo sube un nivel dentro del hero.
  const renderElementoHero = () => {
    const key = elementoActivo as ZonaHeroKey;
    const def = ELEMENTO_HERO_DEFS[key];
    const camposElemento = def.campos
      .map((n) => config.campos.find((c) => c.name === n))
      .filter((c): c is CampoTexto => !!c);
    return (
      <>
        <Migas nivelAnterior="Hero" actual={def.titulo} onVolver={() => setElementoActivo(null)} onAyuda={onAyuda ? () => onAyuda('hero') : undefined} />
        <h2 className="editor-pv-title">{def.titulo}</h2>
        <p className="editor-pv-sub">{def.hint}</p>
        {camposElemento.length > 0 ? (
          <div className="duna-form" style={{ marginTop: 'var(--duna-space-4)' }}>{camposElemento.map(renderCampo)}</div>
        ) : (
          // El Indicador no tiene texto propio (§ ELEMENTO_HERO_DEFS) — mismo caso que el prototipo
          // (`hasText: sel !== 'cue'`): sólo el interruptor, sin campo que ofrecer.
          <p className="duna-sub" style={{ marginTop: 'var(--duna-space-4)' }}>
            No tiene texto propio — sólo se agrega o se quita del hero.
          </p>
        )}
        <div className="editor-elemento-quitar">
          <button
            type="button"
            className="duna-btn duna-btn--danger duna-btn--sm"
            onClick={() => { cambiar({ [def.boolName]: false }); setElementoActivo(null); }}
          >
            Quitar {def.titulo.toLowerCase()}
          </button>
        </div>
      </>
    );
  };

  // "ALTO" Y "FONDO" DEL HERO, COMO SEGMENTADO (§ EDITOR-VISUAL-NIVELES-1, REDISENO.md § 3: "Alto
  // (segmentado Justo · Alto · Pantalla completa), Fondo (miniatura + Cambiar + punto focal +
  // «Oscurecer para leer mejor» segmentado)"). Un segmentado GENÉRICO —reusado para los dos ejes— en
  // vez del `<select>` nativo que `renderCampo` sigue dando a cualquier OTRO campo de opciones: acá
  // el set es chico (3 y 4) y el valor es el MISMO «modo, no conteo» que ya justifica `.duna-seg` en
  // la barra (dispositivo, § CLAUDE.md "el segmentado cambia el MODO de ver lo mismo"). `puntoFocal`
  // NO se vuelve segmentado —nueve opciones no caben en una fila de palabras— y se queda con
  // `renderCampo` (select nativo, la regla general de siempre).
  const renderSegmentadoHero = (etiqueta: string, hint: string | undefined, opciones: { value: string; label: string }[], valor: string, onElegir: (v: string) => void) => (
    <div className="duna-field">
      <span className="duna-field__label">{etiqueta}</span>
      <div className="duna-seg editor-seg-full" role="group" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={valor === o.value}
            onClick={() => onElegir(o.value)}
            className={`duna-seg__item${valor === o.value ? ' is-on' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <AyudaCampo texto={hint} />
    </div>
  );
  const renderAltoYFondo = () => {
    const campoAlto = config.campos.find((c) => c.name === 'alto');
    const campoVeloCombo = config.campos.find((c) => c.name === 'veloCombo');
    const campoPuntoFocal = config.campos.find((c) => c.name === 'puntoFocal');
    const campoImagen = config.imagenes.find((i) => i.name === 'imagen');
    const campoImagenMovil = config.imagenes.find((i) => i.name === 'imagenMovil');
    const valorAlto = String(form.alto ?? campoAlto?.opciones?.[0]?.value ?? 'justo');
    const valorVelo = veloComboDeCampos(form.veloVisible !== false, String(form.veloIntensidad ?? 'media'));
    return (
      <>
        {campoAlto?.opciones && (
          <div className="admin-bloque">
            {renderSegmentadoHero(campoAlto.label, campoAlto.hint, campoAlto.opciones, valorAlto, (v) => cambiar({ alto: v, alturaLlena: v === 'pantalla' }))}
          </div>
        )}
        <div className="admin-bloque">
          <span className="duna-field__label" style={{ display: 'block', marginBottom: 'var(--duna-space-2)' }}>Fondo</span>
          {campoImagen && renderMiniatura(campoImagen)}
          {campoImagenMovil && renderMiniatura(campoImagenMovil)}
          {campoPuntoFocal && <div className="duna-form" style={{ marginTop: 'var(--duna-space-3)' }}>{renderCampo(campoPuntoFocal)}</div>}
          {campoVeloCombo?.opciones && (
            <div style={{ marginTop: 'var(--duna-space-3)' }}>
              {renderSegmentadoHero(campoVeloCombo.label, campoVeloCombo.hint, campoVeloCombo.opciones, valorVelo, (v) => cambiar(camposDeVeloCombo(v)))}
            </div>
          )}
        </div>
      </>
    );
  };

  // El error de subida JUNTO AL CONTROL que lo disparó (§ PANEL-ERROR-SUBIDA-VISIBLE-1): sólo se
  // pinta si `errorCampo` es ESTE campo —nunca un error de publicar/descartar ni uno del repeater
  // (§ accionBorrador/RepeaterEditor.onError, que dejan `errorCampo=null`)—. El rechazo por sesión
  // suma el enlace para volver a entrar, igual que el toast que ya disparó `anunciarError`.
  const errorInline = (campo: string) => {
    if (errorCampo !== campo || !errorServidor) return null;
    return (
      <p className="duna-field__error" role="alert" style={{ margin: 0 }}>
        {errorServidor}
        {esSesionVencida(errorServidor) && <> <a href="/login" className="duna-link">Iniciar sesión</a></>}
      </p>
    );
  };

  // LA MEDIA DE FONDO DEL HERO — imagen (por defecto) o VIDEO (§ HERO-VIDEO-COMO-DATO-1). Vive
  // APARTE de `renderMiniatura` (no como una rama más ahí adentro) porque el hero es la ÚNICA
  // sección con esta dualidad —el resto de `imagenes` del REGISTRY son SIEMPRE imagen— y porque no
  // se inventa lenguaje nuevo: reusa el vocabulario del video del repeater (miniatura=póster con
  // badge de película, "Cambiar vídeo"/"Cambiar póster", `PosterScrubber`, `BarraProgreso`).
  const renderMediaHero = (img: CampoImagen) => {
    const esVideo = form.imagenTipo === 'video';
    const url = String(form[img.name] ?? '');
    const poster = String(form.imagenPoster ?? '');
    const miniatura = esVideo ? poster : url;
    const esDefault = url === String(defaults[img.name] ?? '');
    // Dos vías comparten el mismo campo lógico ("imagen"): el alta/cambio de video COMPLETO
    // (subiendoCampo==='imagen', con `heroSubiendoPaso` nombrando la etapa) y el reemplazo SUELTO
    // del póster por `ponerImagen('imagenPoster')` (una subida atómica de imagen más, como
    // cualquier otro campo-imagen de la cáscara — sin etapas propias).
    const enVideoFlow = heroOcupado && subiendoCampo === 'imagen';
    const enPosterSuelto = subida.subiendo && subiendoCampo === 'imagenPoster';
    const subiendoEste = enVideoFlow || enPosterSuelto;
    return (
      <div key={img.name} className="duna-field" style={{ marginBottom: 'var(--duna-space-4)' }}>
        <span className="duna-field__label">{img.label}</span>
        {heroVideoPendiente && !heroOcupado ? (
          <PosterScrubber
            video={heroVideoPendiente}
            onPoster={(p) => subirVideoYPosterHero(heroVideoPendiente, p)}
            onSubirImagen={elegirPosterParaHero}
            onCancelar={() => setHeroVideoPendiente(null)}
          />
        ) : (
          <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
            <span className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)', position: 'relative' }}>
              {miniatura
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={miniatura} alt="" />
                : <ImageIcon aria-hidden width={20} height={20} />}
              {esVideo && (
                <Film className="h-3 w-3" style={{ position: 'absolute', right: 4, bottom: 4, color: '#fff', filter: 'drop-shadow(0 0 2px rgba(0,0,0,.8))' }} aria-label="vídeo" />
              )}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                {esVideo ? (
                  <>
                    <button type="button" onClick={agregarVideoHero} disabled={heroOcupado || !!heroVideoPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Film className="h-3.5 w-3.5" /> Cambiar video
                    </button>
                    <button type="button" onClick={() => ponerImagen('imagenPoster')} disabled={heroOcupado} className="duna-btn duna-btn--ghost duna-btn--sm">
                      <Upload className="h-3.5 w-3.5" /> Cambiar póster
                    </button>
                    <button type="button" onClick={volverAImagenHero} disabled={heroOcupado} className="duna-btn duna-btn--ghost duna-btn--sm">
                      Usar una imagen
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => ponerImagen(img.name)} disabled={heroOcupado} className="duna-btn duna-btn--secondary duna-btn--sm">
                      <Upload className="h-3.5 w-3.5" /> Cambiar
                    </button>
                    {!esDefault && (
                      <button type="button" onClick={() => usarPorDefecto(img.name)} disabled={heroOcupado} className="duna-btn duna-btn--ghost duna-btn--sm">
                        Por defecto
                      </button>
                    )}
                    <button type="button" onClick={agregarVideoHero} disabled={heroOcupado || !!heroVideoPendiente} className="duna-btn duna-btn--ghost duna-btn--sm">
                      <Film className="h-3.5 w-3.5" /> Usar un video
                    </button>
                  </>
                )}
              </div>
              {/* El slot cubre DOS campos —`imagen` (video/imagen completos) e `imagenPoster` (el
                  reemplazo suelto del póster, § arriba)—: cualquiera de los dos puede haber fallado. */}
              {errorInline('imagen') ?? errorInline('imagenPoster') ?? (
                <span className="duna-field__hint" style={{ margin: 0 }}>
                  {subiendoEste
                    ? (enVideoFlow ? heroTextoPaso() : `Subiendo póster… ${subida.progreso ?? 0}%`)
                    : esVideo ? 'MP4, WebM o MOV.' : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
                </span>
              )}
              {subiendoEste && heroSubiendoPaso !== 'convirtiendo' && <BarraProgreso pct={subida.progreso ?? 0} />}
            </div>
          </div>
        )}
      </div>
    );
  };

  // LA SEGUNDA VERSIÓN, VERTICAL, para teléfono (§ HERO-VIDEO-MOVIL-1) — bloque APARTE de
  // `renderMediaHero` (no una rama más ahí adentro), mismo criterio que separó a ésa de
  // `renderMiniatura`: es un AGREGADO opcional, no una tercera dualidad. OCULTO del todo fuera del
  // modo video (`esVideo` falso): ofrecer "video para teléfono" sobre un hero que hoy es una imagen
  // no tiene a qué aplicarse — `fuentesVideoHero` (lib/config/hero-video.ts) nunca lo consulta en
  // ese caso.
  const renderMediaHeroMovil = (img: CampoImagen) => {
    const esVideo = form.imagenTipo === 'video';
    if (!esVideo) return null;
    const url = String(form.imagenMovil ?? '');
    const poster = String(form.imagenMovilPoster ?? '');
    const tieneVideoMovil = url.trim() !== '';
    const miniatura = tieneVideoMovil ? (poster || url) : '';
    // Dos vías comparten el mismo campo lógico "imagenMovil": el alta/cambio del video COMPLETO
    // (subiendoCampo==='imagenMovil', con `heroMovilSubiendoPaso` nombrando la etapa) — a diferencia
    // del video de escritorio, acá no hay reemplazo SUELTO del póster: el par se sube siempre junto.
    const subiendoEste = heroMovilOcupado && subiendoCampo === 'imagenMovil';
    return (
      <div key={img.name} className="duna-field" style={{ marginBottom: 'var(--duna-space-4)' }}>
        <span className="duna-field__label">{img.label}</span>
        {heroVideoMovilPendiente && !heroMovilOcupado ? (
          <PosterScrubber
            video={heroVideoMovilPendiente}
            onPoster={(p) => subirVideoYPosterMovilHero(heroVideoMovilPendiente, p)}
            onSubirImagen={elegirPosterParaMovilHero}
            onCancelar={() => setHeroVideoMovilPendiente(null)}
          />
        ) : (
          <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
            <span className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)', position: 'relative' }}>
              {miniatura
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={miniatura} alt="" />
                : <ImageIcon aria-hidden width={20} height={20} />}
              {tieneVideoMovil && (
                <Film className="h-3 w-3" style={{ position: 'absolute', right: 4, bottom: 4, color: '#fff', filter: 'drop-shadow(0 0 2px rgba(0,0,0,.8))' }} aria-label="vídeo" />
              )}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
                <button type="button" onClick={agregarVideoMovilHero} disabled={heroMovilOcupado || !!heroVideoMovilPendiente} className="duna-btn duna-btn--secondary duna-btn--sm">
                  <Film className="h-3.5 w-3.5" /> {tieneVideoMovil ? 'Cambiar video' : 'Agregar video para teléfono'}
                </button>
                {tieneVideoMovil && (
                  <button type="button" onClick={quitarVideoMovilHero} disabled={heroMovilOcupado} className="duna-btn duna-btn--ghost duna-btn--sm">
                    Quitar
                  </button>
                )}
              </div>
              {errorInline('imagenMovil') ?? errorInline('imagenMovilPoster') ?? (
                <span className="duna-field__hint" style={{ margin: 0 }}>
                  {subiendoEste
                    ? heroMovilTextoPaso()
                    : 'MP4, WebM o MOV, vertical (9:16). Opcional: sin él, el teléfono muestra el video de arriba, recortado.'}
                </span>
              )}
              {subiendoEste && heroMovilSubiendoPaso !== 'convirtiendo' && <BarraProgreso pct={subida.progreso ?? 0} />}
            </div>
          </div>
        )}
      </div>
    );
  };

  // MINIATURA (rule 1: la representación GRANDE es la vista previa; el form sólo identifica la foto y
  // ofrece "Cambiar"). Marco `.duna-tile` (DS): con foto la muestra recortada; VACÍO pinta un ícono
  // muted, NUNCA un `<img src="">` roto (§ Backlog #66).
  const renderMiniatura = (img: CampoImagen) => {
    // El hero es la ÚNICA sección con dualidad imagen/video (§ HERO-VIDEO-COMO-DATO-1): su campo
    // `imagen` se desvía a su propio render ANTES de la rama genérica de abajo, que sigue sirviendo
    // tal cual a brandStory/presentaciones (sólo imagen, siempre).
    if (seccion === 'hero' && img.name === 'imagen') return renderMediaHero(img);
    // El video de teléfono (§ HERO-VIDEO-MOVIL-1) tiene su propio bloque aparte; su póster NUNCA
    // renderiza standalone —va DENTRO de ese bloque, mismo criterio que `imagenPoster` arriba—.
    if (seccion === 'hero' && img.name === 'imagenMovil') return renderMediaHeroMovil(img);
    if (seccion === 'hero' && img.name === 'imagenMovilPoster') return null;
    const val = String(form[img.name] ?? '');
    const esDefault = val === String(defaults[img.name] ?? '');
    const subiendoEste = subiendo && subiendoCampo === img.name;
    // "Quitar" (§ CampoImagen.opcional, HISTORIA-COMO-MUESTRARIO-1): sólo para una foto OPCIONAL que
    // TIENE valor — vaciar una ya vacía no hace nada, y una REQUERIDA no puede quedar sin foto.
    const puedeQuitar = !!img.opcional && val !== '';
    return (
      <div key={img.name} className="duna-field" style={{ marginBottom: 'var(--duna-space-4)' }}>
        <span className="duna-field__label">{img.label}</span>
        <div style={{ display: 'flex', gap: 'var(--duna-space-3)', alignItems: 'flex-start', marginTop: 'var(--duna-space-1)' }}>
          <div className="duna-tile" style={{ width: 'calc(var(--duna-thumb-w) * 2)' }}>
            {val
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={val} alt="" />
              : <ImageIcon aria-hidden width={20} height={20} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)' }}>
              <button type="button" onClick={() => ponerImagen(img.name)} className="duna-btn duna-btn--secondary duna-btn--sm" disabled={subiendo}>
                <Upload /> Cambiar
              </button>
              {!esDefault && (
                <button type="button" onClick={() => usarPorDefecto(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                  Por defecto
                </button>
              )}
              {puedeQuitar && (
                <button type="button" onClick={() => vaciarImagen(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo}>
                  Quitar
                </button>
              )}
            </div>
            {errorInline(img.name) ?? (
              <span className="duna-field__hint" style={{ margin: 0 }}>
                {subiendoEste ? `Subiendo… ${subida.progreso ?? 0}%` : `JPG, PNG o WebP · máx ${MAX_SUBIDA_DIRECTA_MB} MB`}
              </span>
            )}
            {subiendoEste && <BarraProgreso pct={subida.progreso ?? 0} />}
          </div>
        </div>
      </div>
    );
  };

  // UNA CELDA del collage: una miniatura CLICABLE (clic = Cambiar) que ocupa su cuadro del 2×2; la
  // POSICIÓN la da el grid (rule 1: la posición se VE como en la tienda). Vacía → placeholder muted
  // (§ #66). "Por defecto"/flechas/"Quitar" abajo, según corresponda.
  //
  // "Quitar" y las flechas operan sobre el ARRAY completo del bloque, no sobre `img.name` solo
  // (§ HISTORIA-FOTOS-PANEL-Y-GIRO-1, gate del owner: "no deja eliminar la primera foto, sólo las
  // otras 3, o re posicionar las mismas"). El gate de "Quitar" YA NO es `CampoImagen.opcional` —ese
  // campo sigue describiendo si el slot cae al DEFAULT o se OMITE al resolver (sin cambio, §
  // REGISTRY.brandStory.campos en site-content-defaults.ts)—: acá es el CONTEO de fotos con valor en
  // el bloque, recibido por prop desde `renderBloqueCollage`.
  const renderCeldaCollage = (
    img: CampoImagen, i: number, total: number, puedeQuitar: boolean,
    quitarFoto: (i: number) => void, moverFoto: (i: number, dir: -1 | 1) => void,
  ) => {
    const val = String(form[img.name] ?? '');
    const esDefault = val === String(defaults[img.name] ?? '');
    const subiendoEste = subiendo && subiendoCampo === img.name;
    return (
      <div key={img.name} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-1)', minWidth: 0 }}>
        <button type="button" onClick={() => ponerImagen(img.name)} className="duna-tile" style={{ width: '100%' }} disabled={subiendo} aria-label={`Cambiar ${img.label}`}>
          {val
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={val} alt="" />
            : <ImageIcon aria-hidden width={20} height={20} />}
        </button>
        {errorInline(img.name)}
        {!subiendoEste && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-1)' }}>
            {!esDefault && (
              <button type="button" onClick={() => usarPorDefecto(img.name)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo} style={{ alignSelf: 'flex-start' }}>
                Por defecto
              </button>
            )}
            <button type="button" onClick={() => moverFoto(i, -1)} disabled={subiendo || i === 0} aria-label="Subir" className="duna-btn duna-btn--ghost duna-btn--sm">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => moverFoto(i, 1)} disabled={subiendo || i === total - 1} aria-label="Bajar" className="duna-btn duna-btn--ghost duna-btn--sm">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            {puedeQuitar && (
              <button type="button" onClick={() => quitarFoto(i)} className="duna-btn duna-btn--ghost duna-btn--sm" disabled={subiendo} style={{ alignSelf: 'flex-start' }}>
                Quitar
              </button>
            )}
          </div>
        )}
        {subiendoEste && <BarraProgreso pct={subida.progreso ?? 0} />}
      </div>
    );
  };

  // Bloque COLLAGE (rule 1): las fotos en un 2×2 para que la posición se VEA como en la tienda.
  // "Quitar" COMPACTA (las de abajo suben, § lib/tienda/lista-plana.ts) y sólo se ofrece si queda ≥1
  // foto con contenido tras quitar ésta — la ÚLTIMA que queda no se puede quitar (la sección necesita
  // al menos una). Reordenar hace SWAP con el vecino (mismo patrón que `RepeaterEditor.mover`). Las
  // dos operan sobre el ARRAY de valores del bloque y reescriben los CUATRO campos a la vez, así que
  // cualquier foto —incluida la primera— puede terminar en cualquier slot.
  const renderBloqueCollage = (bloque: Extract<BloqueResuelto, { tipo: 'collage' }>) => {
    const nombres = bloque.imagenes.map(im => im.name);
    const valores = nombres.map(n => String(form[n] ?? ''));
    const conContenido = valores.filter(v => v.trim() !== '').length;
    const escribir = (nuevos: string[]) => cambiar(Object.fromEntries(nombres.map((n, idx) => [n, nuevos[idx]])));
    const quitarFoto = (i: number) => escribir(quitarDeLista(valores, i));
    const moverFoto = (i: number, dir: -1 | 1) => escribir(moverEnLista(valores, i, dir));
    return (
      <div>
        {bloque.titulo && <span className="duna-field__label">{bloque.titulo}</span>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--duna-space-3)', marginTop: 'var(--duna-space-2)', maxWidth: '280px' }}>
          {bloque.imagenes.map((img, i) => renderCeldaCollage(
            img, i, bloque.imagenes.length, valores[i].trim() !== '' && conContenido > 1, quitarFoto, moverFoto,
          ))}
        </div>
      </div>
    );
  };

  // LAS ETIQUETAS (notas de cata) de `spotlight` — SÓLO LECTURA (§ DESTACADO-PANEL-COMPLETO-Y-
  // BOTONES-PDP-1, el gate del owner: "faltan las etiquetas"). NO es un campo editable nuevo: el
  // dato YA se muestra en la tienda como chips (`Spotlight.tsx`, `activo.notasCata`) leído del
  // producto pineado — duplicarlo acá como texto propio del destacado sería la MISMA trampa que
  // `CLAUDE.md` ya nombra para `total_compras` (un dato que vive en dos lados puede divergir). Lo
  // que faltaba era que el PANEL dijera algo cuando no hay nada que mostrar: antes el bloque de
  // notas simplemente desaparecía de la vista previa sin explicación. CONVIENE escribirlas desde acá
  // tiene su propio costo —abriría una SEGUNDA puerta de escritura al mismo campo que "Productos" ya
  // edita, con las dos pantallas pudiendo divergir sobre cuál ganó— así que NO se construye sin medir
  // que el dueño lo pida; por ahora sólo LEE y, si faltan, enlaza a editarlas en su lugar de siempre.
  const renderEtiquetasSpotlight = () => {
    if (!productosListos) return null;
    const slugPin = String(form.productoSlug ?? '').trim();
    if (!slugPin) return null;
    const pin = catalogoReal.find((p) => p.slug === slugPin);
    if (!pin) return null; // sin match: ya lo dice el aviso del campo de arriba, no se duplica acá.
    const notas = pin.notasCata ?? [];
    return (
      <div className="duna-field duna-form__full">
        <span className="duna-field__label">Etiquetas (notas de cata)</span>
        {notas.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-1)' }}>
            {notas.map((n) => (
              <span key={n} className="duna-badge duna-badge--neutral">{n}</span>
            ))}
          </div>
        ) : (
          <p className="duna-field__hint" style={{ marginTop: 'var(--duna-space-1)' }}>
            «{pin.nombre}» no tiene notas de cata todavía. <a href="/admin/productos" className="duna-link">Editarlas en Productos.</a>
          </p>
        )}
      </div>
    );
  };

  // Bloque SECCIÓN: imágenes (miniatura, § rule 1) + campos. Sin encabezados de grupo (se retiraron).
  const renderBloqueSeccion = (bloque: Extract<BloqueResuelto, { tipo: 'seccion' }>) => (
    <>
      {bloque.imagenes.map(renderMiniatura)}
      {bloque.campos.length > 0 && (
        <div className="duna-form">
          {bloque.campos.map(renderCampo)}
          {seccion === 'spotlight' && renderEtiquetasSpotlight()}
        </div>
      )}
    </>
  );

  // Bloque TARJETA: una pieza (miniatura + campos), direccionada por slot. El encabezado (una CAJA
  // contenida — el "esto está puesto" del DS aplica limpio, § doctrina) es el destino del scroll del
  // puente + el resalte. Una pieza OPCIONAL vacía NO se monta (colapsado) → se ofrece con "+ Agregar
  // tarjeta" (abajo); "Quitar" la vacía y la devuelve a esa oferta.
  const renderBloqueTarjeta = (bloque: Extract<BloqueResuelto, { tipo: 'tarjeta' }>) => {
    if (colapsado(bloque.slot)) return null;
    return (
      <div
        ref={el => { const m = bloquesRef.current; if (el) m.set(bloque.slot, el); else m.delete(bloque.slot); }}
        className={`bloque-tarjeta${tarjetaActiva === bloque.slot ? ' is-activo' : ''}`}
      >
        <div className="bloque-tarjeta__head">
          <span className="duna-field__label">{bloque.titulo}</span>
          {bloque.opcional && (
            <button type="button" onClick={() => quitarTarjeta(bloque.slot)} className="duna-btn duna-btn--ghost duna-btn--sm">Quitar</button>
          )}
        </div>
        {bloque.imagen && renderMiniatura(bloque.imagen)}
        {bloque.campos.length > 0 && (
          <div className="duna-form">{bloque.campos.map(renderCampo)}</div>
        )}
      </div>
    );
  };

  // Bloque LISTA (rule 2): los beneficios como lista plana COMPACTA. Filas para los llenos + "+
  // Agregar" + "×". Se COMPACTA al quitar (§ lista-plana); editar en el sitio escribe el slot.
  const renderBloqueLista = (bloque: Extract<BloqueResuelto, { tipo: 'lista' }>) => {
    const { slots, itemLabel, hint } = bloque;
    const clave = slots[0];                                // identidad de ESTA lista (su primer slot)
    const valores = slots.map(s => String(form[s] ?? ''));
    const base = ultimoLleno(valores) + 1;                 // filas para llegar al último lleno
    const mostrados = Math.min(slots.length, Math.max(mostradosLista.get(clave) ?? base, base));
    const quitarFila = (i: number) => {
      const nv = quitarDeLista(valores, i);
      cambiar(Object.fromEntries(slots.map((s, idx) => [s, nv[idx]])));
      setMostradosLista(m => new Map(m).set(clave, Math.max(0, mostrados - 1)));
    };
    const singular = itemLabel;
    const label = singular.charAt(0).toUpperCase() + singular.slice(1);
    return (
      <div>
        <span className="duna-field__label">{label}s</span>
        {hint && <AyudaCampo texto={hint} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-2)', marginTop: 'var(--duna-space-2)' }}>
          {Array.from({ length: mostrados }, (_, i) => (
            <div key={slots[i]} style={{ display: 'flex', gap: 'var(--duna-space-2)', alignItems: 'center' }}>
              <input
                className="duna-input"
                value={valores[i]}
                onChange={e => cambiar({ [slots[i]]: e.target.value })}
                aria-label={`${label} ${i + 1}`}
              />
              <button type="button" onClick={() => quitarFila(i)} className="duna-btn duna-btn--ghost duna-btn--icon" aria-label={`Quitar ${singular} ${i + 1}`}>
                <X />
              </button>
            </div>
          ))}
        </div>
        {mostrados < slots.length && (
          <div style={{ marginTop: 'var(--duna-space-2)' }}>
            <button type="button" onClick={() => setMostradosLista(m => new Map(m).set(clave, mostrados + 1))} className="duna-btn duna-btn--secondary duna-btn--sm">
              <Plus /> Agregar {singular}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Los bloques resueltos, y las tarjetas OPCIONALES aún colapsadas → la oferta "+ Agregar tarjeta".
  // UN CAMPO `seccionCruzada` SE QUITA del bloque `seccion` que `bloquesResueltos` ya resolvió (§ la
  // red de seguridad, lib/tienda/bloques.ts: sin `bloques` declarados, ese bloque único trae TODOS los
  // campos — los cruzados incluidos) — se renderiza aparte, en su propio grupo (§ `gruposCruzados`,
  // arriba), nunca los dos a la vez. Sólo el `seccion` necesita el filtro: ningún `tarjeta`/`lista`/
  // `collage` de hoy declara un campo `seccionCruzada` entre los suyos.
  // § EDITOR-VISUAL-NIVELES-1 — PARA EL HERO, además, los campos/imágenes que `renderZonasHero`/
  // `renderAltoYFondo` (arriba) YA dibujan por su cuenta se SACAN del bloque `seccion` genérico — sin
  // este filtro, `titulo`/`alto`/`imagen`… se pintarían DOS VECES (una en su bloque propio, otra en
  // el `.duna-form` genérico de abajo). Las demás secciones no declaran ninguno de estos nombres
  // (son propios de `HERO.campos`/`HERO.imagenes`), así que el filtro es un no-op para ellas.
  const CAMPOS_HERO_YA_DIBUJADOS = new Set(['titulo', 'tituloEnfasis', 'subtitulo', 'ctaPrimarioLabel', 'ctaSecundarioLabel', 'alto', 'veloCombo', 'puntoFocal']);
  const IMAGENES_HERO_YA_DIBUJADAS = new Set(['imagen', 'imagenMovil', 'imagenMovilPoster']);
  const bloques = bloquesResueltos(config).map((b) => {
    if (b.tipo !== 'seccion') return b;
    let campos = b.campos.filter((c) => !c.seccionCruzada);
    let imagenes = b.imagenes;
    if (seccion === 'hero') {
      campos = campos.filter((c) => !CAMPOS_HERO_YA_DIBUJADOS.has(c.name));
      imagenes = imagenes.filter((i) => !IMAGENES_HERO_YA_DIBUJADAS.has(i.name));
    }
    return { ...b, campos, imagenes };
  });
  const tarjetasColapsadas = bloques.filter((b): b is Extract<BloqueResuelto, { tipo: 'tarjeta' }> => b.tipo === 'tarjeta' && colapsado(b.slot));
  const agregarTarjeta = () => { const primera = tarjetasColapsadas[0]; if (primera) expandir(primera.slot); };

  // ── LECTURA: la sección es una FILA compacta (§ EDITOR-VISUAL-PANEL-1, REDISENO.md § 3: "lista
  //    compacta... sin tarjetas grandes con botón Editar"), SIN miniatura propia (§ EDITOR-TIENDA-
  //    IFRAME-VISTA-1): la vista en vivo es el iframe compartido de `TiendaPaginas`, no una
  //    reconstrucción por sección. Publicar/Descartar viven en la vista expandida. El asa (§
  //    EDITOR-TIENDA-ORDEN-1, prop `orden`) y el ojo (`config.ocultable`) SÓLO viven en esta fila
  //    colapsada — reordenar/ocultar es una acción de LISTA, no de edición; con la sección abierta,
  //    el switch de "Mostrar en la tienda" de la vista expandida (más abajo) sigue siendo el único
  //    control de visibilidad.
  //
  //    `FilaSeccion` reemplaza a `.tienda-tarjeta` (la tarjeta grande con borde + párrafo + botón) —
  //    el MISMO componente que usan `InstanciaTarjeta.tsx`/`EncabezadoSeccion.tsx`/`MenuSeccion.tsx`/
  //    `FooterSeccion.tsx`, para que las filas de Encabezado, las bandas, las secciones agregadas y
  //    el Pie se vean como UNA sola lista (§ CLAUDE.md, "las secciones... con el hero desplegable en
  //    sus zonas... «+ Agregar sección»... Pie de página" — todas filas iguales).
  //
  //    El indicador de ESTADO (`indicadorEstado`) y el badge "Oculta" se retiran de esta fila: el
  //    primero sólo aplica mientras una subida está EN VUELO desde esta misma tarjeta, cosa que ya no
  //    puede pasar colapsada (la subida vive dentro de la edición); el segundo lo reemplaza el ojo
  //    tachado + la fila atenuada (`dim`, § CLAUDE.md "se dicen con el ojo, no con frases"). La
  //    distinción FINA de `avisoNoSeMuestra` (toggle apagado vs. lista vacía) se pierde en esta
  //    vista — DESVIACIÓN declarada: sigue completa dentro de la edición (abajo, `noSeMuestra`).
  if (!editando) {
    const esHero = seccion === 'hero';
    // § EDITOR-VISUAL-PANEL-1/EDITOR-VISUAL-NIVELES-1 — las ZONAS del hero, para el chevron de la
    // fila (el spec: "el hero desplegable en sus zonas y el valor de cada una"). El "Fondo" se queda
    // como glifo propio (▣, no navega a un elemento — § ELEMENTO_HERO_DEFS, no tiene uno); las CUATRO
    // zonas de TEXTO reusan `ZONA_HERO_ORDEN`/`zonaHeroEstado` (la MISMA fuente que `renderZonasHero`,
    // abajo, usa dentro de la sección abierta) para que el valor mostrado acá y ahí no puedan
    // divergir. Tocar una de las cuatro zonas de texto ABRE la sección Y baja directo a su nivel de
    // elemento (§ EDITOR-VISUAL-NIVELES-1: "al tocar una zona en el panel… abre su propio nivel");
    // "Fondo" sólo abre la sección (no tiene nivel de elemento propio, vive inline en "Alto y Fondo").
    const zonasHero = esHero ? [
      { key: 'fondo' as const, gl: '▣', nombre: 'Fondo', valor: form.imagenTipo === 'video' ? 'Video' : 'Foto' },
      ...ZONA_HERO_ORDEN.map(({ key, gl }) => {
        const def = ELEMENTO_HERO_DEFS[key];
        const { valor } = zonaHeroEstado(key);
        return { key, gl, nombre: def.titulo, valor };
      }),
    ] : [];
    const abrirZonaDesdeChevron = (key: string) => {
      abrirEdicion();
      if (key !== 'fondo') setElementoActivo(key as ZonaHeroKey);
    };
    return (
      <div ref={rootRef}>
        <FilaSeccion
          icono={<IconoFila tipo={esHero ? 'hero' : 'generico'} />}
          titulo={config.titulo}
          hayBorrador={hayBorrador}
          dim={noSeMuestra}
          ocultable={config.ocultable}
          visible={form.visible !== false}
          onCambiarVisible={() => cambiar({ visible: form.visible === false })}
          orden={orden}
          onAbrir={abrirEdicion}
          chevronAbierto={esHero ? zonasAbiertas : undefined}
          onChevron={esHero ? () => setZonasAbiertas((v) => !v) : undefined}
        />
        {esHero && zonasAbiertas && (
          <div className="editor-kids">
            {zonasHero.map((z) => (
              <button key={z.key} type="button" className="editor-kid" onClick={() => abrirZonaDesdeChevron(z.key)}>
                <span className="editor-kid__gl" aria-hidden>{z.gl}</span>
                <span className="editor-kid__nm">{z.nombre}</span>
                <span className="editor-kid__sb">{z.valor}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── EDICIÓN: sólo el form — la vista en vivo es el iframe compartido de `TiendaPaginas`, no una
  //    columna local. El hero conserva su comportamiento exacto.
  //
  // Las DOS piezas que se montan en CUALQUIERA de las dos ramas de abajo (nivel de elemento, o la
  // sección completa) — calculadas UNA vez para que las dos ramas no puedan divergir en su copy/props.
  const dialogoDescarte = (
    <ConfirmDescartarDialog
      abierto={confirmandoDescarte}
      onDescartar={() => { setConfirmandoDescarte(false); accionBorrador('descartar'); }}
      onSeguir={() => setConfirmandoDescarte(false)}
      titulo="¿Descartar los cambios sin publicar?"
      descripcion="Volverás a lo que está publicado. El borrador se perderá y no se puede recuperar."
      confirmLabel="Descartar borrador"
      seguirLabel="Conservar"
    />
  );
  // § EDITOR-TIENDA-COMPOSICION-1 — `valores` funde el form de ESTA sección con los dos campos
  // cruzados de la marquesina (`texto`/`productoSlug`, § CampoTexto.seccionCruzada): viven en
  // `valoresCruzados.marquesina`, no en `form`, y la zona "Marquesina" los necesita para decidir si
  // "Se guarda" aplica al cambiar de composición.
  const dialogoComposicion = seccion === 'hero' && config.composiciones && (
    <ComposicionHero
      abierto={composicionAbierta}
      onCerrar={() => setComposicionAbierta(false)}
      opciones={config.composiciones}
      activa={String(form.variante ?? config.composiciones[0]?.value ?? '')}
      valores={{
        ...form,
        texto: valoresCruzados?.marquesina?.texto,
        productoSlug: valoresCruzados?.marquesina?.productoSlug,
      }}
      onElegir={(valor) => { cambiar({ variante: valor }); setComposicionAbierta(false); }}
    />
  );

  // § EDITOR-VISUAL-NIVELES-1 — CON `elementoActivo` (sólo hero), el nivel de ELEMENTO REEMPLAZA a
  // todo lo de abajo (título de sección, Cerrar/Publicar/Descartar, el aviso "No se muestra", los
  // bloques) — igual que en el prototipo, donde cada `pv.*` es una pantalla aparte, no un acordeón
  // dentro de otra. Las acciones de PUBLICAR siguen disponibles: viven en la barra superior GLOBAL
  // (`EditorTiendaPantallaCompleta.tsx`, el botón "Publicar" con su resumen), no por sección — nada
  // se pierde al no repetirlas acá. `rootRef` se mueve al wrapper que esté montado en cada rama (la
  // "selección en contexto", § su docstring grande, sólo necesita apuntar a ALGO de esta sección).
  if (seccion === 'hero' && elementoActivo) {
    return (
      <>
        <div ref={rootRef}>{renderElementoHero()}</div>
        {dialogoDescarte}
        {dialogoComposicion}
      </>
    );
  }

  return (
    <>
      <div ref={rootRef} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexWrap: 'wrap' }}>
            <h2 className="duna-title">{config.titulo}</h2>
            {hayBorrador && <span className="duna-badge duna-badge--attention">Sin publicar</span>}
            {oculta && <span className="duna-badge duna-badge--neutral">Oculta</span>}
          </div>
          <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
            Edita y los cambios se guardan solos; publica cuando estén listos. Mira el resultado en
            la vista de la tienda.{' '}
            <a href="/" target="_blank" rel="noreferrer" className="duna-link">Ver la tienda</a>
          </p>
          {/* El indicador de GUARDADO (Guardando… / Guardado / error) va en la cabecera, SIN sticky: el
              guardado es rápido y el error es persistente (el operador sube a verlo). El PROGRESO de la
              subida NO vive acá —vive pegado al botón que la disparó (§ la barra por-botón)—. Un sticky
              acá cortaría la tarjeta: sobre una superficie necesitaría `--duna-surface` y aun así
              partiría la sección; el sticky del head de `.duna-lista` funciona porque sus filas van
              sobre el fondo de PÁGINA, no sobre una tarjeta — esa es la distinción. */}
          {indicadorEstado && <div style={{ marginTop: 'var(--duna-space-2)' }}>{indicadorEstado}</div>}
        </div>
        {/* ASIMETRÍA DELIBERADA: Publicar y Descartar esperan al autoguardado (`!puedePublicar`)
            porque MUTAN —publicar con algo pendiente publicaría un borrador viejo—. "Cerrar" NO muta:
            sólo vuelve a la tarjeta, el cambio queda en el borrador. Por eso NUNCA se deshabilita —en
            estado de error (que reintenta solo cada 5 s) apagarlo dejaría al operador sin salida— y no
            hace falta esperar el flush: cerrar no DESMONTA nada (es otra rama del mismo componente, el
            coordinador vive en su ref), y el PUT es fire-and-forget de todos modos. */}
        <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
          <button type="button" onClick={cerrarEdicion} className="duna-btn duna-btn--secondary">Cerrar</button>
          {hayBorrador && (
            <button type="button" onClick={() => setConfirmandoDescarte(true)} className="duna-btn duna-btn--ghost" disabled={!puedePublicar}>
              Descartar
            </button>
          )}
          {hayBorrador && (
            <button type="button" onClick={() => accionBorrador('publicar')} className="duna-btn duna-btn--primary" disabled={!puedePublicar}>
              {procesando ? 'Publicando…' : 'Publicar'}
            </button>
          )}
        </div>
      </div>

      <div className="tienda-vivo__form" style={{ marginTop: 'var(--duna-space-4)' }}>
            {/* Oculta: la sección se auto-oculta en el storefront (self-gate) y el iframe compartido
                no muestra nada de ella — este aviso es lo único que lo dice acá. */}
            {noSeMuestra && (
              <div className="duna-card duna-card__pad" style={{ marginBottom: 'var(--duna-space-4)' }}>
                <p className="duna-title" style={{ margin: 0 }}>No se muestra en la tienda</p>
                <p className="duna-sub" style={{ marginTop: '4px' }}>{avisoNoSeMuestra}</p>
              </div>
            )}
            {/* El PANEL RECESADO (--duna-bg) que CONTIENE las piezas; cada bloque es una PIEZA elevada
                (--duna-surface) → los bloques se leen separados, no como un formulario plano (§ Fix 2). */}
            <div className="admin-bloques">
              <input ref={subida.inputRef} type="file" accept={ACCEPT_IMAGENES} onChange={subida.alElegir} hidden disabled={subiendo} />
              {/* Segundo input para el flujo "elegir sin subir" (alta de vídeo); su `accept` lo fija
                  `subida.elegir` por llamada (vídeo o imagen del póster). */}
              <input ref={subida.inputHoldRef} type="file" onChange={subida.alElegirHold} hidden />

              {config.ocultable && (
                <div className="admin-bloque">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-3)' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.visible !== false}
                      aria-label="Mostrar esta sección en la tienda"
                      onClick={() => cambiar({ visible: form.visible === false })}
                      className={`duna-switch${form.visible !== false ? ' is-on' : ''}`}
                    >
                      <span className="duna-switch__thumb" />
                    </button>
                    <span className="duna-field__label" style={{ margin: 0 }}>Mostrar en la tienda</span>
                  </div>
                  {/* Sin `notaVisibilidad`: el operador apaga y ve el resultado en la vista en vivo. El
                      label + el switch bastan (mismo criterio que el toggle de página). CON ella (hoy,
                      sólo Marquesina, § EDITOR-TIENDA-MARQUESINA-EN-HERO-1): el switch por sí solo no
                      basta para entender qué hace, porque otra tarjeta ya muestra su texto/producto. */}
                  {config.notaVisibilidad && (
                    <div style={{ marginTop: 'var(--duna-space-2)' }}><AyudaCampo texto={config.notaVisibilidad} /></div>
                  )}
                </div>
              )}

              {/* LA COMPOSICIÓN del hero (§ EDITOR-TIENDA-COMPOSICION-1, REDISENO.md § 4/§ 6): el
                  botón «Composición: <nombre>» abre la vista nueva «¿Cómo se arma tu hero?» — va
                  ANTES de la lista de zonas porque decide cuáles existen. Sólo el hero la declara
                  (`config.composiciones`); las otras tres secciones con `variante` siguen sin este
                  control (§ PENDIENTE_PANEL, panel-controles.ts). */}
              {seccion === 'hero' && config.composiciones && (
                <div className="admin-bloque">
                  <button
                    type="button"
                    onClick={() => setComposicionAbierta(true)}
                    className="duna-btn duna-btn--secondary"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                  >
                    <span>
                      Composición: {config.composiciones.find((o) => o.value === String(form.variante ?? ''))?.label
                        ?? config.composiciones[0]?.label}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}

              {/* Los INTERRUPTORES de sección (§ CampoBooleano, PANEL-EDITOR-HERO-TOGGLES-1) — una
                  pieza con todos los de esta sección, aparte del toggle de visibilidad de arriba.
                  EXCEPTO el hero (§ EDITOR-TIENDA-ZONAS-1, REDISENO.md § 2: "los interruptores del
                  hero desaparecen del panel"): sus seis switches se reemplazan por la lista de zonas
                  de abajo — MISMO dato, MISMO `cambiar()`, sólo la presentación cambia de switch a
                  fila-con-acción. `config.booleanos` SIGUE declarando los seis (§ panel-controles.ts,
                  que deriva "controlado" de esa misma lista) — lo único que cambia es qué JSX los
                  consume. */}
              {config.booleanos && config.booleanos.length > 0 && (
                seccion === 'hero' ? renderZonasHero() : (
                  <div className="admin-bloque">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--duna-space-4)' }}>
                      {config.booleanos.map(renderBooleano)}
                    </div>
                  </div>
                )
              )}

              {/* § EDITOR-VISUAL-NIVELES-1 — "Alto" (segmentado) y "Fondo" (miniatura + Cambiar +
                  punto focal + Oscurecer segmentado), en ese orden, DESPUÉS de las zonas — el spec. */}
              {seccion === 'hero' && renderAltoYFondo()}

              {/* Cada bloque es una PIEZA. La `tarjeta` YA es su propia caja (`.bloque-tarjeta`), así
                  que no se re-envuelve —doble caja—; los demás van en la pieza genérica. */}
              {bloques.map((b, i) => (
                <Fragment key={i}>
                  {b.tipo === 'tarjeta'
                    ? renderBloqueTarjeta(b)
                    : (
                      <div className="admin-bloque">
                        {b.tipo === 'lista' ? renderBloqueLista(b)
                          : b.tipo === 'collage' ? renderBloqueCollage(b)
                          : renderBloqueSeccion(b)}
                      </div>
                    )}
                </Fragment>
              ))}
              {/* Los GRUPOS CRUZADOS (§ EDITOR-TIENDA-MARQUESINA-EN-HERO-1, arriba): una pieza por
                  sección destino, titulada con SU `titulo` real (derivado de SECCIONES_TIENDA, nunca
                  un literal que pudiera divergir si esa sección cambia de nombre). Van DESPUÉS de los
                  bloques propios de esta sección — son un agregado, no la identidad de la tarjeta. */}
              {Array.from(gruposCruzados.entries()).map(([destino, campos]) => {
                const tituloGrupo = SECCIONES_TIENDA.find((s) => s.seccion === destino)?.titulo ?? destino;
                return (
                  <div className="admin-bloque" key={destino}>
                    <p className="duna-field__label" style={{ margin: 0, marginBottom: 'var(--duna-space-3)' }}>{tituloGrupo}</p>
                    <div className="duna-form">
                      {campos.map((c) => renderCampoCruzado(destino, c))}
                    </div>
                  </div>
                );
              })}
              {/* La oferta de la pieza opcional (rule 3): agrega la PRIMERA tarjeta colapsada. Se
                  esconde cuando no queda ninguna (las 4 visibles). Sólo Presentaciones tiene tarjetas. */}
              {tarjetasColapsadas.length > 0 && (
                <div>
                  <button type="button" onClick={agregarTarjeta} className="duna-btn duna-btn--secondary">
                    <Plus /> Agregar tarjeta
                  </button>
                </div>
              )}

              {/* Sección de LISTA (repeater): cada cambio del RepeaterEditor —editar, agregar, quitar,
                  mover— pasa por `cambiar`, el mismo marcar-sucio + autoguardado que un campo plano. */}
              {/* El repeater NO se envuelve en una PIEZA (`.admin-bloque`): sus ítems ya son
                  `.duna-card`, y una pieza alrededor los dejaría pieza-dentro-de-pieza. Lo que SÍ
                  lleva, desde § EDITOR-PANEL-PIEL-1, es el marcador `.editor-repeater` — protege esos
                  ítems del aplanado que el panel blanco exige para los DEMÁS grupos (editor.css): sin
                  él, sus `.duna-card` quedarían sin borde, blanco sobre el panel ahora también
                  blanco. */}
              {config.repeater && (
                <div className="editor-repeater">
                  <RepeaterEditor
                    items={Array.isArray(form[config.repeater.itemsKey]) ? (form[config.repeater.itemsKey] as Record<string, unknown>[]) : []}
                    descriptores={config.repeater.campos}
                    itemLabel={config.repeater.itemLabel}
                    genero={config.repeater.genero}
                    max={config.repeater.max}
                    maxVideo={config.repeater.maxVideo}
                    pedirImagen={subida.pedir}
                    elegir={subida.elegir}
                    subir={subida.subir}
                    // `campo=null` EXPLÍCITO: un ítem del repeater no tiene una ubicación propia en
                    // este editor (§ arriba) — nunca hereda el campo de una acción previa de la
                    // cáscara (hero/miniatura/collage). Degrada a "junto al pie" + el toast, no a
                    // un control equivocado.
                    onError={(msg) => anunciarError(msg, null)}
                    subiendo={subiendo}
                    progreso={subida.progreso}
                    onChange={nuevos => cambiar({ [config.repeater!.itemsKey]: nuevos })}
                  />
                </div>
              )}

              {/* Sólo los errores SIN control propio (publicar/descartar, § accionBorrador; un ítem
                  del repeater, § RepeaterEditor.onError arriba): los de un campo-imagen de la
                  cáscara ya se pintan JUNTO a su control (`errorInline`), y repetirlos acá sería
                  el mismo aviso dos veces. */}
              {errorServidor && !errorCampo && (
                <p className="duna-field__error" role="alert" style={{ marginTop: 'var(--duna-space-3)' }}>
                  {errorServidor}
                  {esSesionVencida(errorServidor) && <> <a href="/login" className="duna-link">Iniciar sesión</a></>}
                </p>
              )}
            </div>
      </div>

      {dialogoDescarte}
      {dialogoComposicion}
    </>
  );
});

TiendaSeccionEditor.displayName = 'TiendaSeccionEditor';

export default TiendaSeccionEditor;
