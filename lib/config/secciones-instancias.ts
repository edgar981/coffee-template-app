// LAS SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1, ampliado por § SECCIONES-TIPOS-2,
// § SECCIONES-TIPOS-3 y § SECCIONES-CARRUSEL-1) — el mecanismo que deja que el contenido declare
// INSTANCIAS de un catálogo CURADO de NUEVE tipos genéricos: cuatro de campos planos (Texto, Imagen
// con texto, Banner, Video) y cinco REPEATER (Preguntas, Columnas, Filas, Collage, Carrusel, §
// InstanciaItemsDef más abajo) — y las mezcle en `orden` con las bandas de siempre. Lo que entra acá
// es el modelo, el resolver y el schema; la UI de agregar vive en `components/admin/editor/` (ver
// `docs/editor-tienda/AGREGAR-SECCIONES.md`).
//
// MÓDULO HOJA A PROPÓSITO: no importa NADA de `site-content-defaults.ts`. Ese archivo SÍ importa
// de acá (`resolverSeccionesHome`, `resolverOrdenCompleto`, tipos) para resolver la clave meta
// `seccionesHome`/`orden` — si este archivo importara de vuelta `BandaId`/`BANDA_IDS`/
// `resolverVariante` desde `site-content-defaults.ts`, los dos módulos se necesitarían uno al otro
// en tiempo de EVALUACIÓN (no sólo de tipos), un ciclo de imports real entre dos módulos con
// `const` de nivel superior — el modo de falla donde uno de los dos lee el `export` del otro antes
// de que se haya inicializado. Por eso `resolverOrdenCompleto` recibe `bandaIds` POR PARÁMETRO en
// vez de importar `BANDA_IDS`, y el escalar `alto` del Banner declara su propio set cerrado de 3
// valores en vez de importar `ALTURAS_HERO`/`resolverVariante` (duplica ~3 líneas triviales; el
// costo de evitarlo —un ciclo entre los dos archivos más grandes de `lib/config/`— es mayor).
//
// DEFAULTS NEUTROS DE VERTICAL (§ CLAUDE.md, "El código compartido no NACE siendo Nayoli/demo"):
// los seis tipos son un catálogo CURADO que cualquier tienda puede usar, café o no — sus textos de
// ejemplo son genéricos, sin una sola palabra de café, y ninguna imagen trae un valor por defecto
// (el hueco "Agregar foto" del editor es el estado inicial correcto, no un placeholder robado de
// otra sección).
//
// EL CONTENIDO SE VE EN VIVO (§ SECCIONES-INSTANCIAS-VIVO-1) — REGLA PARA EL PRÓXIMO TIPO: cualquier
// componente de `components/storefront/secciones/` lee su instancia de `useSiteContent().
// seccionesHome[id]`, NUNCA sólo de una prop fija — `EditorPuenteVivo.tsx` actualiza ESE contexto en
// cada tecla del panel (vía `fusionarContenidoInstancia`, `lib/storefront/editor-puente.ts`), y un
// componente que sólo mirara su prop del servidor (`page.tsx`, resuelta UNA vez) quedaría mudo hasta
// el siguiente reload — exactamente el defecto que este slice cierra. El dispatcher
// (`SeccionInstancia.tsx`) hace esa lectura UNA vez, por eso los tres tipos de hoy no repiten el
// mecanismo cada uno — mismo patrón que `BrandStory.tsx` leyendo `brandStory` antes de elegir su
// variante, en vez de cada variante leyendo el contexto por su cuenta.

// `lib/movimiento/catalogo.ts` es un módulo HOJA independiente (§ MOVIMIENTO-MARCO-GSAP-1,
// ANIMACION_SECCION más abajo) — no crea el ciclo que el docstring de arriba previene, porque ese
// catálogo no importa NADA de vuelta de este archivo ni de `site-content-defaults.ts`.
import { CLAVES_ANIMACION, MOVIMIENTO_NINGUNA, type ElementoMovimiento } from '../movimiento/catalogo';

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// ─── EL TIPO Y SU PREFIJO DE ID ─────────────────────────────────────────────────────────────────

export const SECCION_INSTANCIA_TIPOS = ['texto', 'imagenTexto', 'banner', 'preguntas', 'columnas', 'filas', 'collage', 'video', 'carrusel'] as const;
export type SeccionInstanciaTipo = (typeof SECCION_INSTANCIA_TIPOS)[number];

const TIPOS_SET: ReadonlySet<string> = new Set(SECCION_INSTANCIA_TIPOS);

export function esSeccionInstanciaTipo(v: unknown): v is SeccionInstanciaTipo {
  return typeof v === 'string' && TIPOS_SET.has(v);
}

// `INSTANCIA_PREFIJO` es lo que hace que un id de instancia NUNCA pueda chocar con un `BandaId`
// (`hero`, `marquesina`… ninguno empieza por esto) ni con cualquier id de banda futuro — el
// contrato no depende de enumerar las bandas acá (sería el import circular de arriba), depende de
// que TODO id de banda sea una palabra plana sin ':'. Dos puntos, no un punto: `parsearRutaCampo`
// (`lib/storefront/campo-editable.ts`, fuera de `touches:`) separa una ruta de campo en el PRIMER
// punto (`seccion.campo`), así que un id de instancia con punto rompería ese parseo; con ':' el id
// entero sigue siendo la parte "sección" sin ambigüedad.
export const INSTANCIA_PREFIJO = 'inst:';

export function esInstanciaId(id: string): boolean {
  return id.startsWith(INSTANCIA_PREFIJO) && id.length > INSTANCIA_PREFIJO.length;
}

// ─── EL DESCRIPTOR — ÚNICA FUENTE por tipo, de la que derivan resolver + schema + editor ────────

export type CampoInstanciaTipo = 'requerido' | 'opcional';

/** El set cerrado de un escalar de instancia (alineación, lado, alto) — MISMA forma que
 *  `VariantesDef.claves`/`.canonica` de `site-content-defaults.ts`, sin importarla (ver el
 *  docstring de cabecera: módulo hoja). */
export interface EscalarInstanciaDef {
  claves: readonly string[];
  canonica: string;
}

/** El descriptor de los campos de CADA ÍTEM de un tipo REPEATER (§ SECCIONES-TIPOS-2: Preguntas,
 *  Columnas, Filas) — MISMA forma que `InstanciaDescriptor.campos`/`.imagenes`, un nivel más
 *  adentro. Sin `escalares` propio: ningún ítem de los tres tipos curados de esta tanda necesita un
 *  set cerrado por-ítem (a diferencia de la INSTANCIA, que sí puede tenerlo — `lado`/`alto`). */
export interface InstanciaItemDescriptor {
  campos: Record<string, CampoInstanciaTipo>;
  imagenes?: readonly string[];
}

/** La declaración REPEATER de un tipo (§ SECCIONES-TIPOS-2) — gemela de `RepeaterConfig`
 *  (`components/admin/tienda-secciones.ts`) pero del lado del MODELO, no del editor: ese archivo
 *  no se importa acá (módulo hoja, § el docstring de cabecera). `min`/`max` son de CURADURÍA/
 *  FORMA, no técnicos — los impone el EDITOR (no deja agregar sobre `max` ni quitar bajo `min`); el
 *  RESOLVER no los enforce (SOFT: resuelve lo que haya, igual que `resolverItems` no trunca ni
 *  rellena un repeater de sección). `min:0` es el repeater "puro" (Preguntas, Filas): hide-on-empty
 *  sin piso, como Testimonios. `min:2` (Columnas) es la ÚNICA razón por la que "de dos a seis
 *  columnas" es cierto — sin el `min` en el editor, nada impediría una sola columna. */
export interface InstanciaItemsDef {
  descriptor: InstanciaItemDescriptor;
  min: number;
  max?: number;
}

export interface InstanciaDescriptor {
  /** Campos de TEXTO plano de la INSTANCIA (no de sus ítems) — incluye los destinos de CTA, que son
   *  texto libre acá — el set cerrado de destinos válidos lo valida el SCHEMA de escritura, no el
   *  descriptor ni el resolver; mismo criterio que `brandStory.ctaDestino` en `site-content-
   *  schema.ts`). */
  campos: Record<string, CampoInstanciaTipo>;
  /** Cuáles de los campos de arriba son URLs de imagen (para `imagenesDe`/el borrado de blobs). */
  imagenes?: readonly string[];
  /** Escalares clampados a un set cerrado (alineación, lado, alto). */
  escalares?: Record<string, EscalarInstanciaDef>;
  /** Campos BOOLEANOS de instancia (§ SECCIONES-CARRUSEL-1) — gemelo de `SeccionDef.booleanos`
   *  (site-content-defaults.ts) un nivel más adentro, duplicado por el módulo-hoja de siempre (§ el
   *  docstring de cabecera): sólo se sobreescriben con un booleano EXPLÍCITO guardado — ausente,
   *  `null` o basura caen al default del TIPO, el MISMO mecanismo que ya rige `visible` más abajo
   *  (`resolverInstancia`). Sin esto, cada campo booleano de instancia (p. ej. `carrusel.autoplay`)
   *  exigiría un `if (tipo === 'carrusel')` hardcodeado en el resolver — el mismo hardcoding que
   *  `escalares` evita del lado de los strings clampados. */
  booleanos?: readonly string[];
  /** Presente ⇒ el tipo es un REPEATER (Preguntas/Columnas/Filas/Collage/Carrusel): además de `campos` (la cabecera
   *  de la instancia, p. ej. su `titulo`), guarda un array `items` cuyo contenido describe este
   *  campo. Ausente ⇒ el tipo es de campos planos nomás (Texto/ImagenTexto/Banner). */
  items?: InstanciaItemsDef;
  /** § MOVIMIENTO-EDITOR-EXPOSICION-1 — presente ⇒ este tipo ADMITE el ajuste «Animación», y el
   *  valor dice a qué CLASE de elemento del catálogo de movimiento (`lib/movimiento/catalogo.ts`)
   *  se aplica — lo que el selector del editor usa para filtrar sus tarjetas
   *  (`catalogoMovimientoDeElemento`), y lo que cada componente de sección YA sabe de memoria (no
   *  lo lee de acá en runtime: el registro declara QUE existe el ajuste y CUÁL es su elemento, para
   *  que el editor no tenga que adivinarlo por tipo; el componente de storefront, que conoce su
   *  propia estructura, decide el NODO exacto que envuelve). El escalar de ALMACENAMIENTO sigue
   *  siendo `escalares.animacion` (abajo, `ANIMACION_SECCION`) — éste es sólo el ROTULADO semántico
   *  de para qué sirve. Ausente ⇒ el tipo no ofrece el ajuste; los nueve tipos de hoy lo declaran. */
  animacionElemento?: ElementoMovimiento;
}

const ALINEACIONES_TEXTO = { claves: ['izquierda', 'centro', 'derecha'], canonica: 'centro' } as const;
// EL EJE `animacion` (§ MOVIMIENTO-MARCO-GSAP-1) — ESCALAR clampado, MISMA forma que
// `ALINEACIONES_TEXTO` arriba: `claves` es «Ninguna» (`MOVIMIENTO_NINGUNA`, la canónica) más cada
// id del catálogo de `lib/movimiento/catalogo.ts` — un módulo tan HOJA como éste (cero imports de
// vuelta a `secciones-instancias.ts` ni a `site-content-defaults.ts`), así que importarlo acá NO
// abre el ciclo que el docstring de cabecera existe para evitar. Elegir un id SIN motor todavía
// (`implementada:false`) no es basura — `CLAVES_ANIMACION` los incluye a propósito (§ su
// docstring) — así que esta línea no necesita saber cuáles tienen motor; eso lo decide
// `motorDisponible` en tiempo de RENDER, no en tiempo de VALIDACIÓN.
//
// SÓLO EN "texto" POR AHORA — la demostración de este slice (§ el spec, punto 4: "este slice NO
// cablea el ajuste en cada sección… lo demuestra cableándolo en UNA sección de prueba"). Sumar el
// eje a los otros ocho tipos (y a las bandas del home, en `site-content-defaults.ts`) es la
// extensión que la exposición en el editor necesita, y no antes — mismo criterio que cualquier
// escalar nuevo del REGISTRY: se declara donde se demuestra, se extiende cuando hay un segundo uso
// real que lo pida.
const ANIMACION_SECCION = { claves: CLAVES_ANIMACION, canonica: MOVIMIENTO_NINGUNA } as const;
const LADOS_IMAGEN_TEXTO = { claves: ['izquierda', 'derecha'], canonica: 'izquierda' } as const;
// Gemelo de `ALTURAS_HERO`/`CLASES_ALTURA_HERO` (`site-content-defaults.ts`) — mismos TRES pasos,
// misma canónica 'justo'; duplicado acá por el módulo-hoja de arriba. El COMPONENTE (no este
// archivo) sigue usando `claseAlturaHero` de verdad para traducir el valor a una clase Tailwind —
// esa función SÍ se importa desde el componente (`components/storefront/secciones/Banner.tsx`),
// que no es leído de vuelta por `site-content-defaults.ts`, así que ahí no hay ciclo que evitar.
const ALTURAS_BANNER = { claves: ['justo', 'alto', 'pantalla'], canonica: 'justo' } as const;
// § SECCIONES-TIPOS-3 — los DOS escalares de "collage" (una grande + una grilla de chicas): cuántas
// columnas usa la grilla de chicas ('dos' = una fila de dos, 'cuatro' = 2×2) y de qué lado va la
// grande. `lado` REUSA `LADOS_IMAGEN_TEXTO` a propósito (mismas dos claves, misma canónica) — dos
// constantes idénticas para el mismo concepto ("¿la pieza principal va a la izquierda o a la
// derecha?") habrían sido la misma trampa que `CATEGORIAS ≠ CATEGORIA_LABELS` (§ CLAUDE.md).
const DISPOSICIONES_COLLAGE = { claves: ['dos', 'cuatro'], canonica: 'dos' } as const;
// El escalar de "video": fondo en bucle silenciado (con título/texto/botón ENCIMA, como un Banner
// de video) o un reproductor contenido con botón de Reproducir (sin autoplay, con sonido al tocar).
const MODOS_VIDEO = { claves: ['fondo', 'reproducir'], canonica: 'fondo' } as const;

export const DESCRIPTOR_INSTANCIA: Record<SeccionInstanciaTipo, InstanciaDescriptor> = {
  texto: {
    campos: {
      antetitulo: 'opcional',
      titulo: 'requerido',
      texto: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
    },
    escalares: { alineacion: ALINEACIONES_TEXTO, animacion: ANIMACION_SECCION },
    // «texto → título/párrafo» (§ el spec) — el componente aplica al TÍTULO (§ Texto.tsx), el nodo
    // que ya demostraba `EjemploSeccionTexto.tsx` del slice anterior.
    animacionElemento: 'texto',
  },
  imagenTexto: {
    campos: {
      antetitulo: 'opcional',
      titulo: 'requerido',
      texto: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      imagen: 'opcional',
    },
    imagenes: ['imagen'],
    escalares: { lado: LADOS_IMAGEN_TEXTO, animacion: ANIMACION_SECCION },
    // «imagen → la foto» (§ el spec de MOVIMIENTO-EDITOR-EXPOSICION-1): el elemento más prominente
    // de este tipo es la foto, no el texto — y es el mismo target que reusa `filas` por delegación
    // (§ DESCRIPTOR_INSTANCIA.filas, abajo).
    animacionElemento: 'imagen',
  },
  banner: {
    campos: {
      titulo: 'requerido',
      texto: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      ctaSecundarioLabel: 'opcional',
      ctaSecundarioDestino: 'opcional',
      imagen: 'opcional',
    },
    imagenes: ['imagen'],
    escalares: { alto: ALTURAS_BANNER, animacion: ANIMACION_SECCION },
    // Foto de fondo a sangre, el elemento más prominente — mismo criterio que `imagenTexto`.
    animacionElemento: 'imagen',
  },
  // § SECCIONES-TIPOS-2 — los tres REPEATER: la cabecera es sólo `titulo` (opcional, como el resto)
  // y el contenido real vive en `items`. `min`/`max` son sólo del EDITOR (§ `InstanciaItemsDef`).
  preguntas: {
    campos: { titulo: 'opcional' },
    escalares: { animacion: ANIMACION_SECCION },
    // «tarjetas → los ítems» (§ el spec): cada pregunta del acordeón es una "tarjeta" que entra en
    // cascada, igual que cualquier otro repeater — § Preguntas.tsx envuelve el CONTENEDOR de la
    // lista, no cada `<button>` por separado.
    animacionElemento: 'tarjetas',
    items: {
      descriptor: { campos: { pregunta: 'requerido', respuesta: 'requerido' } },
      min: 0,
    },
  },
  columnas: {
    campos: { titulo: 'opcional' },
    escalares: { animacion: ANIMACION_SECCION },
    animacionElemento: 'tarjetas',
    items: {
      descriptor: {
        campos: { imagen: 'opcional', titulo: 'requerido', texto: 'opcional', enlace: 'opcional' },
        imagenes: ['imagen'],
      },
      // "de dos a seis columnas" (§ el spec) — el PISO es lo que hace la frase cierta, no una
      // casualidad del seed. Ver el default de abajo, que nace con exactamente 2.
      min: 2,
      max: 6,
    },
  },
  // «filas» DELEGA el elemento 'imagen', no 'tarjetas': cada fila YA es una `imagenTexto` sintética
  // (§ Filas.tsx, que reusa `SeccionImagenTexto` literal por fila) — así que la misma animación que
  // "imagen con texto" aplica a la FOTO de cada fila, pasando `instancia.animacion` a cada
  // sintética. Tratarla como 'tarjetas' habría exigido una SEGUNDA implementación del wrapping en
  // vez de reusar la que ImagenTexto.tsx ya tiene.
  filas: {
    campos: { titulo: 'opcional' },
    escalares: { animacion: ANIMACION_SECCION },
    animacionElemento: 'imagen',
    items: {
      descriptor: {
        campos: { imagen: 'opcional', titulo: 'requerido', texto: 'opcional', ctaLabel: 'opcional', ctaDestino: 'opcional' },
        imagenes: ['imagen'],
      },
      min: 0,
    },
  },
  // § SECCIONES-TIPOS-3 — "collage": una pieza grande + una grilla de chicas (§ DISPOSICIONES_COLLAGE
  // arriba), de tres a seis ítems (el PISO de 3 es lo que hace cierta "una grande y dos o cuatro
  // chicas" — con menos no hay ni para la disposición más chica). Cada ítem es foto O VIDEO (`url` +
  // `tipo` + `poster`, los TRES campos declarados como string PLANO — a diferencia de
  // `GaleriaItem`/`w`/`h` de `site-content-defaults.ts`, acá NO se preserva proporción natural: cada
  // celda del mosaico tiene un alto FIJO por su rol (grande/chica) y recorta con `object-cover`, así
  // que no hace falta leer dimensiones al subir ni cargar el resolver con passthrough. `tipo` queda
  // SIN clampar a 'imagen'|'video' —ningún escalar de ÍTEM de este catálogo se clampa, sólo los de
  // INSTANCIA (`escalares`, arriba)— y el componente trata cualquier valor que no sea exactamente
  // 'video' como imagen, la misma red soft que el resto del archivo.
  collage: {
    campos: { titulo: 'opcional' },
    items: {
      descriptor: {
        campos: { url: 'opcional', tipo: 'opcional', poster: 'opcional', enlace: 'opcional', leyenda: 'opcional' },
        imagenes: ['url', 'poster'],
      },
      min: 3,
      max: 6,
    },
    escalares: { disposicion: DISPOSICIONES_COLLAGE, lado: LADOS_IMAGEN_TEXTO, animacion: ANIMACION_SECCION },
    // El mosaico es una colección de piezas (la grande + la grilla de chicas) — `C01` las hace
    // entrar en cascada igual que cualquier otro repeater, § Collage.tsx.
    animacionElemento: 'tarjetas',
  },
  // § SECCIONES-TIPOS-3 — "video": UN campo plano, `imagen` (reusa el mismo nombre que el resto del
  // catálogo para una media subida — § `imagenesDeInstancia`, que no necesita saber que acá siempre
  // es un video) + su `poster` (obligatorio al escribir, § el `.refine()` de `site-content-
  // schema.ts` — sin él la portada queda sin nada que mostrar mientras el video carga, o en el modo
  // ahorro de datos del teléfono). `ctaLabel`/`ctaDestino` sólo rinden en modo 'fondo' (el botón
  // ENCIMA del video); en 'reproducir' el "botón" es el de Reproducir, no un CTA.
  video: {
    campos: {
      titulo: 'opcional',
      texto: 'opcional',
      ctaLabel: 'opcional',
      ctaDestino: 'opcional',
      imagen: 'opcional',
      poster: 'opcional',
    },
    imagenes: ['imagen', 'poster'],
    escalares: { modo: MODOS_VIDEO, animacion: ANIMACION_SECCION },
    // El video ES la pieza visual de este tipo, el mismo rol que la foto en `imagenTexto`/`banner`
    // — reusa su MISMO elemento del catálogo (I01/I02 operan con transform/clip-path, agnósticos de
    // si el nodo es `<img>` o `<video>`). Sólo aplica en modo 'fondo' (§ Video.tsx); en
    // 'reproducir' el video ya trae su propio gesto de arranque y no tiene sentido animarlo de
    // entrada.
    animacionElemento: 'imagen',
  },
  // § SECCIONES-CARRUSEL-1 — "carrusel": de DOS a SEIS diapositivas (el PISO es lo que hace cierta
  // "de dos a seis" — con una sola no hay nada que deslizar). `campos: { titulo: 'opcional' }` —
  // UN cabecera opcional, MISMO patrón que Preguntas/Columnas/Filas/Collage (título/texto/botón de
  // CADA diapositiva viven en `items`; la cabecera es sólo una etiqueta del BLOQUE entero, no una
  // sexta diapositiva). NO estaba en el plan original (el spec no la pide) — se agregó porque
  // `components/admin/TiendaPaginas.tsx` (fuera de `touches:`) asume que TODA `InstanciaContent`
  // tiene `.titulo` a nivel de instancia (lo usa como label de la tarjeta/asa de orden y como
  // encabezado del panel de edición, con fallback a `nombreInstancia` si está vacío) — medido con
  // `npm run typecheck`, que sin este campo falla en CUATRO sitios de ese archivo. Agregar la MISMA
  // cabecera opcional que ya tienen los otros cuatro repeater es más consistente con el catálogo
  // que inventar un caso especial, y la render el storefront (`Carrusel.tsx`) como un título
  // centrado ANTES del carrusel a sangre — nunca dentro de una diapositiva. `alto` REUSA
  // `ALTURAS_BANNER` tal cual (mismos tres pasos, misma canónica 'justo'; el spec: "alto Justo/Alto/
  // Pantalla como el banner") — es el MISMO objeto, no una copia, porque ya vive en este módulo (no
  // hay ciclo de imports que evitar reusándolo directo). `autoplay` es el PRIMER booleano de
  // INSTANCIA del catálogo (§ `InstanciaDescriptor.booleanos`, arriba): apagado por defecto (el
  // spec), y la lógica de PAUSA (hover/foco/toque) y de nunca correr con `prefers-reduced-motion`
  // vive en el COMPONENTE (`Carrusel.tsx`) — este descriptor sólo declara que el campo EXISTE y se
  // persiste como booleano explícito, igual que `visible`.
  // «carrusel» aplica 'texto' sobre su CABECERA (`titulo`, § arriba), no sobre las diapositivas: un
  // carrusel sólo muestra una diapositiva a la vez (Embla las desliza, no las revela todas
  // juntas), así que «tarjetas escalonadas» no tiene nada coherente que escalonar ahí — la cabecera
  // opcional, en cambio, es texto plano como cualquier título de sección, y entra con el mismo
  // T01-T05 que `texto`/`preguntas`/`columnas`/`collage` ya ofrecen para la suya.
  carrusel: {
    campos: { titulo: 'opcional' },
    booleanos: ['autoplay'],
    escalares: { alto: ALTURAS_BANNER, animacion: ANIMACION_SECCION },
    animacionElemento: 'texto',
    items: {
      descriptor: {
        campos: { imagen: 'opcional', titulo: 'requerido', texto: 'opcional', ctaLabel: 'opcional', ctaDestino: 'opcional' },
        imagenes: ['imagen'],
      },
      min: 2,
      max: 6,
    },
  },
};

// ─── LOS DEFAULTS — NEUTROS, sin café, sin imagen ───────────────────────────────────────────────

// `visible` (§ SECCIONES-INSTANCIAS-VIVO-1) es un ESCALAR DE INSTANCIA, como `visible` lo es de
// SECCIÓN en `site-content-defaults.ts` ("Escalar de SECCIÓN —como `visible`—, no un `campos`"): NO
// vive en `InstanciaDescriptor.campos` (ese mapa es sólo para los campos de TEXTO/CTA que
// `resolverInstancia` resuelve requerido/opcional) ni en `escalares` (ésos clampan a un set cerrado
// de strings) — es un booleano aparte, resuelto a mano en `resolverInstancia`, igual que
// `resolverSiteContent` resuelve `visible` de una banda ANTES de entrar al loop de `campos`.

export interface InstanciaTextoContent {
  tipo: 'texto';
  antetitulo: string;
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
  alineacion: string;
  // § MOVIMIENTO-MARCO-GSAP-1 — id del catálogo de `lib/movimiento/catalogo.ts`, o
  // `MOVIMIENTO_NINGUNA` ('', la canónica). Escalar clampado como `alineacion` — nunca un string
  // libre: `resolverInstancia` lo normaliza a un id real del catálogo o a «Ninguna».
  animacion: string;
  visible: boolean;
}

export interface InstanciaImagenTextoContent {
  tipo: 'imagenTexto';
  antetitulo: string;
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
  imagen: string;
  lado: string;
  animacion: string;
  visible: boolean;
}

export interface InstanciaBannerContent {
  tipo: 'banner';
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
  ctaSecundarioLabel: string;
  ctaSecundarioDestino: string;
  imagen: string;
  alto: string;
  animacion: string;
  visible: boolean;
}

// § SECCIONES-TIPOS-2 — los tres REPEATER. Cada ítem es su propia interfaz (no un `Record<string,
// unknown>` crudo): quien lea `instancia.items[i].pregunta` en un componente del storefront lo hace
// con el tipo correcto, igual que cualquier otro campo de instancia.
export interface InstanciaPreguntaItem {
  pregunta: string;
  respuesta: string;
}
export interface InstanciaPreguntasContent {
  tipo: 'preguntas';
  titulo: string;
  items: InstanciaPreguntaItem[];
  animacion: string;
  visible: boolean;
}

export interface InstanciaColumnaItem {
  imagen: string;
  titulo: string;
  texto: string;
  enlace: string;
}
export interface InstanciaColumnasContent {
  tipo: 'columnas';
  titulo: string;
  items: InstanciaColumnaItem[];
  animacion: string;
  visible: boolean;
}

export interface InstanciaFilaItem {
  imagen: string;
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
}
export interface InstanciaFilasContent {
  tipo: 'filas';
  titulo: string;
  items: InstanciaFilaItem[];
  animacion: string;
  visible: boolean;
}

// § SECCIONES-TIPOS-3 — "collage" y "video" (ver DESCRIPTOR_INSTANCIA arriba para el porqué de cada
// campo). `InstanciaCollageItem.tipo`/`.poster` son strings PLANOS, sin clampar — NUNCA
// `'imagen' | 'video'` como `GaleriaItem.tipo`: ningún escalar de ÍTEM de este catálogo se clampa, y
// declararlo acá como union prometería una garantía que `resolverItemsInstancia` no da.
export interface InstanciaCollageItem {
  url: string;
  tipo: string;
  poster: string;
  enlace: string;
  leyenda: string;
}
export interface InstanciaCollageContent {
  tipo: 'collage';
  titulo: string;
  items: InstanciaCollageItem[];
  disposicion: string;
  lado: string;
  animacion: string;
  visible: boolean;
}

export interface InstanciaVideoContent {
  tipo: 'video';
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
  imagen: string;
  poster: string;
  modo: string;
  animacion: string;
  visible: boolean;
}

// § SECCIONES-CARRUSEL-1 — "carrusel": SIN `titulo` de cabecera (ver el descriptor, arriba) — el
// título/texto/botón de CADA diapositiva viven en `InstanciaCarruselItem`; `titulo` acá es la
// CABECERA opcional del bloque entero (§ el descriptor, arriba — agregada por la asunción de
// `TiendaPaginas.tsx`), NUNCA una séptima diapositiva. `autoplay` es un booleano DE INSTANCIA (no
// de ítem): avanza el carrusel entero, no cada diapositiva por separado.
export interface InstanciaCarruselItem {
  imagen: string;
  titulo: string;
  texto: string;
  ctaLabel: string;
  ctaDestino: string;
}
export interface InstanciaCarruselContent {
  tipo: 'carrusel';
  titulo: string;
  items: InstanciaCarruselItem[];
  alto: string;
  autoplay: boolean;
  animacion: string;
  visible: boolean;
}

export type InstanciaContent =
  | InstanciaTextoContent
  | InstanciaImagenTextoContent
  | InstanciaBannerContent
  | InstanciaPreguntasContent
  | InstanciaColumnasContent
  | InstanciaFilasContent
  | InstanciaCollageContent
  | InstanciaVideoContent
  | InstanciaCarruselContent;

// Tipado POR CLAVE (no `Record<SeccionInstanciaTipo, InstanciaContent>`): así `DEFAULTS_INSTANCIA.texto`
// sigue siendo `InstanciaTextoContent` para quien lo lea (p. ej. un test que compara
// `DEFAULTS_INSTANCIA.texto.antetitulo`), en vez de la unión completa sin narrow.
export const DEFAULTS_INSTANCIA: {
  texto: InstanciaTextoContent;
  imagenTexto: InstanciaImagenTextoContent;
  banner: InstanciaBannerContent;
  preguntas: InstanciaPreguntasContent;
  columnas: InstanciaColumnasContent;
  filas: InstanciaFilasContent;
  collage: InstanciaCollageContent;
  video: InstanciaVideoContent;
  carrusel: InstanciaCarruselContent;
} = {
  texto: {
    tipo: 'texto',
    antetitulo: '',
    titulo: 'Un título para esta sección',
    texto: 'Escribe acá el texto que quieras mostrar en este bloque.',
    ctaLabel: '',
    ctaDestino: '',
    alineacion: ALINEACIONES_TEXTO.canonica,
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  imagenTexto: {
    tipo: 'imagenTexto',
    antetitulo: '',
    titulo: 'Un título para esta sección',
    texto: 'Escribe acá el texto que acompaña a la imagen.',
    ctaLabel: '',
    ctaDestino: '',
    imagen: '',
    lado: LADOS_IMAGEN_TEXTO.canonica,
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  banner: {
    tipo: 'banner',
    titulo: 'Un título para este banner',
    texto: '',
    ctaLabel: '',
    ctaDestino: '',
    ctaSecundarioLabel: '',
    ctaSecundarioDestino: '',
    imagen: '',
    alto: ALTURAS_BANNER.canonica,
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  // § SECCIONES-TIPOS-2 — los tres REPEATER nacen con DOS ítems de ejemplo, texto neutro y SIN
  // imagen (ninguna imagen trae default — mismo criterio que arriba). No es el estado "vacío" de
  // Testimonios/#44 (eso es para prueba social FABRICADA; una pregunta de ejemplo o una columna de
  // ejemplo no afirman nada falso del negocio) — es el mismo "Un título para esta sección" que ya
  // traen Texto/ImagenTexto/Banner, llevado a un repeater: sin esto, la biblioteca mostraría una
  // tarjeta vacía (hide-on-empty) y una instancia recién agregada aparecería en blanco. Dos ítems,
  // no uno, para que la tarjeta recién agregada YA muestre el patrón (la alternancia de Filas, el
  // mínimo de dos de Columnas) sin que el dueño tenga que agregar un segundo antes de verlo.
  preguntas: {
    tipo: 'preguntas',
    titulo: '',
    items: [
      { pregunta: 'Una pregunta frecuente', respuesta: 'Escribe acá la respuesta a esta pregunta.' },
      { pregunta: 'Otra pregunta frecuente', respuesta: 'Escribe acá la respuesta a esta pregunta.' },
    ],
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  columnas: {
    tipo: 'columnas',
    titulo: '',
    items: [
      { imagen: '', titulo: 'Una columna', texto: 'Escribe acá el texto de esta columna.', enlace: '' },
      { imagen: '', titulo: 'Otra columna', texto: 'Escribe acá el texto de esta columna.', enlace: '' },
    ],
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  filas: {
    tipo: 'filas',
    titulo: '',
    items: [
      { imagen: '', titulo: 'Un título para esta fila', texto: 'Escribe acá el texto de esta fila.', ctaLabel: '', ctaDestino: '' },
      { imagen: '', titulo: 'Otro título para esta fila', texto: 'Escribe acá el texto de esta fila.', ctaLabel: '', ctaDestino: '' },
    ],
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  // § SECCIONES-TIPOS-3 — "collage" nace con TRES ítems de ejemplo (el PISO, no dos como los demás
  // repeaters): con menos, una instancia recién agregada no cumpliría su propio mínimo. Sin media
  // (ninguna imagen/video trae default, § el docstring de cabecera) — sólo la leyenda, para que la
  // tarjeta recién agregada muestre el patrón de caption sin que el dueño tenga que escribir nada.
  collage: {
    tipo: 'collage',
    titulo: '',
    items: [
      { url: '', tipo: '', poster: '', enlace: '', leyenda: 'Una leyenda corta' },
      { url: '', tipo: '', poster: '', enlace: '', leyenda: 'Otra leyenda corta' },
      { url: '', tipo: '', poster: '', enlace: '', leyenda: 'Una leyenda más' },
    ],
    disposicion: DISPOSICIONES_COLLAGE.canonica,
    lado: LADOS_IMAGEN_TEXTO.canonica,
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  video: {
    tipo: 'video',
    titulo: 'Un título para este video',
    texto: '',
    ctaLabel: '',
    ctaDestino: '',
    imagen: '',
    poster: '',
    modo: MODOS_VIDEO.canonica,
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
  // § SECCIONES-CARRUSEL-1 — "carrusel" nace con DOS diapositivas de ejemplo (el PISO, como
  // Columnas): sin media (ninguna imagen trae default) y `autoplay: false` (apagado por defecto,
  // § el spec) — el dueño lo enciende si quiere avance automático.
  carrusel: {
    tipo: 'carrusel',
    titulo: '',
    items: [
      { imagen: '', titulo: 'Una diapositiva', texto: 'Escribe acá el texto de esta diapositiva.', ctaLabel: '', ctaDestino: '' },
      { imagen: '', titulo: 'Otra diapositiva', texto: 'Escribe acá el texto de esta diapositiva.', ctaLabel: '', ctaDestino: '' },
    ],
    alto: ALTURAS_BANNER.canonica,
    autoplay: false,
    animacion: MOVIMIENTO_NINGUNA,
    visible: true,
  },
};

// ─── EL RESOLVER — SOFT, por el MISMO contrato que `resolverSiteContent` (requerido vacío → el
//     default; opcional presente-aunque-vacío → se respeta; escalar basura → la canónica) ───────

function resolverEscalarInstancia(def: EscalarInstanciaDef, v: unknown): string {
  return typeof v === 'string' && def.claves.includes(v) ? v : def.canonica;
}

/** Resuelve el ARRAY `items` de un tipo REPEATER — gemela LOCAL de `resolverItems`
 *  (`site-content-defaults.ts`), duplicada por el módulo-hoja (§ el docstring de cabecera): un
 *  valor que no es array da `[]` (nunca inventa ítems); cada ítem no-objeto se descarta; cada
 *  campo declarado se normaliza a string, sin passthrough de campos no declarados (a diferencia de
 *  su gemela, ningún ítem de este catálogo tiene un campo no-string como `stars`, así que no hace
 *  falta preservarlo). SOFT, nunca lanza — `min`/`max` del `InstanciaItemsDef` son del EDITOR, no
 *  de este resolver. */
function resolverItemsInstancia(itemCampos: Record<string, CampoInstanciaTipo>, storedItems: unknown): Record<string, string>[] {
  if (!Array.isArray(storedItems)) return [];
  const out: Record<string, string>[] = [];
  for (const item of storedItems) {
    if (!esObj(item)) continue;
    const resuelto: Record<string, string> = {};
    for (const campo of Object.keys(itemCampos)) {
      const val = item[campo];
      resuelto[campo] = typeof val === 'string' ? val : '';
    }
    out.push(resuelto);
  }
  return out;
}

/** Resuelve UNA instancia guardada. `null` si `stored` no es un objeto o su `tipo` no es uno de
 *  los tres del catálogo — "tipo desconocido o basura → se descarta" (§ el spec de este slice):
 *  una instancia que no se puede reconocer no se inventa, se omite entera (nunca a medias). */
export function resolverInstancia(stored: unknown): InstanciaContent | null {
  if (!esObj(stored) || !esSeccionInstanciaTipo(stored.tipo)) return null;
  const tipo = stored.tipo;
  const descriptor = DESCRIPTOR_INSTANCIA[tipo];
  const defaults = DEFAULTS_INSTANCIA[tipo] as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { tipo };

  for (const [campo, kind] of Object.entries(descriptor.campos)) {
    const val = stored[campo];
    if (kind === 'requerido') {
      out[campo] = typeof val === 'string' && val.trim() !== '' ? val : defaults[campo];
    } else {
      out[campo] = campo in stored ? (typeof val === 'string' ? val : defaults[campo]) : defaults[campo];
    }
  }

  if (descriptor.escalares) {
    for (const [campo, def] of Object.entries(descriptor.escalares)) {
      out[campo] = resolverEscalarInstancia(def, stored[campo]);
    }
  }

  // § SECCIONES-CARRUSEL-1 — BOOLEANOS de instancia: MISMO mecanismo que `visible` más abajo (sólo
  // se sobreescriben con un booleano EXPLÍCITO guardado; ausente/basura cae al default del tipo).
  if (descriptor.booleanos) {
    for (const campo of descriptor.booleanos) {
      out[campo] = typeof stored[campo] === 'boolean' ? stored[campo] : defaults[campo];
    }
  }

  // § SECCIONES-TIPOS-2 — REPEATER: el array `items` se resuelve APARTE del loop de `campos` de
  // arriba (que es sólo la cabecera plana de la instancia, p. ej. `titulo`), igual que
  // `resolverSiteContent` resuelve `sec[def.repeater.itemsKey]` aparte de su loop de campos.
  if (descriptor.items) {
    out.items = resolverItemsInstancia(descriptor.items.descriptor.campos, stored.items);
  }

  // `visible` (§ SECCIONES-INSTANCIAS-VIVO-1) — MISMO mecanismo que `resolverSiteContent` para una
  // banda ("visible sólo se sobreescribe con un booleano explícito"): sin un booleano explícito en
  // `stored`, cae al default del TIPO (siempre `true` hoy, pero leído de `defaults` y no
  // hardcodeado, por si algún tipo futuro del catálogo necesitara nacer oculto).
  out.visible = typeof stored.visible === 'boolean' ? stored.visible : defaults.visible;

  return out as unknown as InstanciaContent;
}

/** Resuelve TODA la meta `seccionesHome` — el mapa id→instancia, KEY-AGNÓSTICO (como `esquemas`/
 *  `variantesBandas`): no hay un set fijo de ids que enumerar, lo decide el dueño al agregar una.
 *  Dos guardas SOFT, las dos "se descarta, no se inventa": una clave sin el prefijo de instancia
 *  no es una instancia de este mecanismo (podría ser basura de otra fuente, o un id que alguien
 *  escribió a mano sin el prefijo) y se ignora; una instancia cuyo `resolverInstancia` da `null`
 *  (tipo desconocido/forma rota) también se ignora. Nunca lanza. */
export function resolverSeccionesHome(stored: unknown): Record<string, InstanciaContent> {
  const out: Record<string, InstanciaContent> = {};
  if (!esObj(stored)) return out;
  for (const [id, val] of Object.entries(stored)) {
    if (!esInstanciaId(id)) continue;
    const resuelto = resolverInstancia(val);
    if (resuelto) out[id] = resuelto;
  }
  return out;
}

// ─── EL ORDEN COMPLETO — bandas ∪ instancias, mismo algoritmo que `resolverOrden` ───────────────

/**
 * Generaliza `resolverOrden` (`site-content-defaults.ts`) a un dominio de ids ABIERTO: bandas
 * MÁS instancias, declaradas por el LLAMADOR (`bandaIds`/`instanciaIds`) en vez de un
 * `BANDA_IDS` importado — ver el docstring de cabecera para el porqué (evitar el ciclo de
 * imports). MISMO contrato que su gemela: filtra `stored` a ids conocidos (una banda, o una
 * instancia que de verdad existe en `seccionesHome` — "el id entra a `orden` sólo si su
 * instancia existe"), DEDUPLICA (primera aparición gana), y agrega al final lo que falte —
 * primero las bandas que falten en su orden canónico, luego las instancias que falten en el
 * orden en que `instanciaIds` las trae (el orden de inserción de `Object.entries`, que en JS
 * preserva el orden de escritura de claves string). SOFT, nunca lanza.
 *
 * `instanciaIds: []` (el caso de HOY, sin una sola instancia) hace que esta función sea
 * EXACTAMENTE `resolverOrden`: mismo algoritmo sobre el mismo dominio — "sin la clave nueva, toda
 * tienda es byte-idéntica" se cumple por construcción, no por un camino especial para el caso
 * vacío.
 */
export function resolverOrdenCompleto(
  stored: unknown,
  bandaIds: readonly string[],
  instanciaIds: readonly string[],
): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  const validos = new Set<string>([...bandaIds, ...instanciaIds]);
  if (Array.isArray(stored)) {
    for (const v of stored) {
      if (typeof v === 'string' && validos.has(v) && !vistos.has(v)) {
        out.push(v);
        vistos.add(v);
      }
    }
  }
  for (const id of bandaIds) if (!vistos.has(id)) out.push(id);
  for (const id of instanciaIds) if (!vistos.has(id)) out.push(id);
  return out;
}

// ─── EL CATÁLOGO CURADO, EN PALABRAS (§ EDITOR-AGREGAR-SECCION-1) ───────────────────────────────
//
// La biblioteca de «Agregar sección» NO enumera los tres tipos a mano: lee ESTE array, así que un
// cuarto tipo que algún día se agregue a `SECCION_INSTANCIA_TIPOS`/`DESCRIPTOR_INSTANCIA` sin sumar
// su entrada acá queda ausente de la biblioteca (y el test de paridad de abajo lo dice) — nunca una
// biblioteca vieja mostrando menos tipos de los que el catálogo real tiene.

export interface CatalogoInstanciaEntry {
  tipo: SeccionInstanciaTipo;
  /** El nombre en palabras que ve el dueño en la tarjeta de la biblioteca — nunca el `tipo` crudo. */
  nombre: string;
  /** Una frase corta, sin jerga, de qué es — lo que decide entre dos tarjetas parecidas. */
  frase: string;
}

/** Tope de instancias que un home puede llevar (§ EDITOR-AGREGAR-SECCION-1, el spec: "Al tope de
 *  instancias, el botón lo dice en palabras y no agrega"). No es técnico —el mecanismo (un mapa
 *  JSON + un array de ids) no tiene un límite real cercano a este número—: es de CURADURÍA, la
 *  misma razón que acota la galería de /nosotros a 12 fotos (§ CLAUDE.md, "Es de CURADURÍA: una
 *  galería de 30 fotos no la mira nadie"). Un home con decenas de secciones agregadas, además de
 *  las bandas fijas, deja de ser una página y pasa a ser una lista. */
export const TOPE_INSTANCIAS_HOME = 20;

export const CATALOGO_INSTANCIAS: readonly CatalogoInstanciaEntry[] = [
  { tipo: 'texto', nombre: 'Texto', frase: 'Un bloque de texto, con un botón opcional.' },
  { tipo: 'imagenTexto', nombre: 'Imagen con texto', frase: 'Una foto a un lado y el texto al otro.' },
  { tipo: 'banner', nombre: 'Banner', frase: 'Una foto de fondo a sangre con un mensaje encima.' },
  { tipo: 'preguntas', nombre: 'Preguntas', frase: 'Una lista de preguntas que se abren al tocarlas.' },
  { tipo: 'columnas', nombre: 'Columnas', frase: 'De dos a seis columnas, cada una con foto, título y texto.' },
  { tipo: 'filas', nombre: 'Filas', frase: 'Filas de foto y texto que alternan de lado.' },
  { tipo: 'collage', nombre: 'Collage', frase: 'Un mosaico de fotos y videos: una pieza grande y varias chicas.' },
  { tipo: 'video', nombre: 'Video', frase: 'Un video de fondo con mensaje, o un video con botón de reproducir.' },
  { tipo: 'carrusel', nombre: 'Carrusel', frase: 'De dos a seis diapositivas que se deslizan, cada una con foto, título, texto y botón.' },
];

/** El nombre en palabras de un tipo — la MISMA fuente que la biblioteca, para que la tarjeta de la
 *  lista y la tarjeta de la biblioteca nunca digan cosas distintas del mismo tipo. */
export function nombreInstancia(tipo: SeccionInstanciaTipo): string {
  return CATALOGO_INSTANCIAS.find((c) => c.tipo === tipo)?.nombre ?? 'Sección';
}

// ─── CREAR UNA INSTANCIA NUEVA ───────────────────────────────────────────────────────────────────

/** Un id NUEVO, con el prefijo de instancia, que no choca contra ninguno de `existentes`. No usa
 *  sólo `Date.now()`: dos instancias agregadas en el mismo milisegundo (plausible desde un test, o
 *  un doble-submit que la guarda de UI no haya atajado) no deben competir por el mismo id — el
 *  sufijo random más el bucle de colisión lo garantizan sin tocar `INSTANCIA_PREFIJO`. */
export function nuevoIdInstancia(existentes: Iterable<string>): string {
  const vistos = existentes instanceof Set ? existentes : new Set(existentes);
  let id: string;
  do {
    id = `${INSTANCIA_PREFIJO}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  } while (vistos.has(id));
  return id;
}

/** Una instancia nueva del tipo elegido: una COPIA de sus defaults neutros (§ el docstring de
 *  cabecera — sin café, sin imagen), nunca la misma referencia que `DEFAULTS_INSTANCIA[tipo]`. Dos
 *  instancias del mismo tipo no deben compartir objeto: editar una no puede mutar la otra ni el
 *  propio default compartido por todo el catálogo. */
export function crearInstancia(tipo: SeccionInstanciaTipo): InstanciaContent {
  return { ...DEFAULTS_INSTANCIA[tipo] } as InstanciaContent;
}

// ─── LAS IMÁGENES — para `imagenesDe` (site-content-blobs.ts) ───────────────────────────────────

/** Los campos de imagen de CADA instancia realmente presente en `seccionesHome` (ya resuelto, o
 *  crudo — acepta lo que `imagenesDe` ya tiene en mano en cualquiera de los dos casos, porque sólo
 *  lee strings por nombre de campo, nunca re-resuelve nada). Vive acá y no en `site-content-
 *  blobs.ts` porque es el ÚNICO módulo que sabe qué campo de cada TIPO es una imagen. */
export function imagenesDeInstancia(inst: unknown): string[] {
  const out: string[] = [];
  if (!esObj(inst) || !esSeccionInstanciaTipo(inst.tipo)) return out;
  const descriptor = DESCRIPTOR_INSTANCIA[inst.tipo];
  if (descriptor.imagenes) {
    for (const campo of descriptor.imagenes) {
      const v = inst[campo];
      if (typeof v === 'string' && v.trim() !== '') out.push(v);
    }
  }
  // § SECCIONES-TIPOS-2 — REPEATER-AWARE, MISMA forma que `imagenesDe` (site-content-blobs.ts) para
  // una sección repeater del REGISTRY: la imagen vive en CADA ítem (Columnas/Filas), no al nivel de
  // la instancia. Sin esto, una foto de columna/fila en USO se vería huérfana al borrado de blobs.
  const camposItem = descriptor.items?.descriptor.imagenes;
  if (camposItem) {
    const items = inst.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!esObj(item)) continue;
        for (const campo of camposItem) {
          const v = item[campo];
          if (typeof v === 'string' && v.trim() !== '') out.push(v);
        }
      }
    }
  }
  return out;
}

// ─── DARKNESS/UNIFORMIDAD — para el día que el nav sepa de instancias (§ DECISIONS.md, abierto) ──

/** ¿Un `banner`/`video`/`carrusel` cuenta como banda OSCURA cuando no tiene esquema asignado? SÍ —
 *  las tres son foto/video de fondo con velo, la MISMA forma que el hero 'curtina' (fondo oscuro
 *  por construcción). `texto`/`imagenTexto`/`collage` son CLAROS por default (fondo de página,
 *  como el resto de las bandas claras). § SECCIONES-TIPOS-3: `video` usa SIEMPRE su canónica
 *  ('fondo', con velo) acá — esta función, como para `banner`/su `alto`, no bifurca por el escalar
 *  propio de la instancia (`modo`), la misma simplificación aceptada que ya rige `alto` de banner.
 *  § SECCIONES-CARRUSEL-1: `carrusel` es SIEMPRE foto de fondo con velo, en CADA diapositiva — no
 *  hay una variante "clara" que bifurcar, así que entra sin matiz, como `banner`. */
export function instanciaOscuraCanonica(tipo: SeccionInstanciaTipo): boolean {
  return tipo === 'banner' || tipo === 'video' || tipo === 'carrusel';
}

/** ¿Un `imagenTexto`/`filas` es una banda UNIFORME (un solo tono) para el nav flotante? NO — las
 *  dos son bi-tonales por LAYOUT (imagen a un lado, fondo de página al otro), la misma razón que
 *  vuelve no-uniforme al hero 'ficha' (§ `bandaUniforme`, `site-content-defaults.ts`). `filas` es
 *  ADEMÁS más heterogénea que `imagenTexto` (§ SECCIONES-TIPOS-2: reusa su componente fila por
 *  fila, alternando de lado — nunca un solo tono de borde a borde). `texto`/`banner`/`preguntas`/
 *  `columnas`/`collage`/`video`/`carrusel` son UN solo fondo de un extremo al otro → uniformes:
 *  `collage` es una grilla de celdas de MEDIA sobre un único fondo de sección (como `columnas`, no
 *  como `imagenTexto`, que parte el fondo mismo en dos mitades de color distinto); `video` es
 *  siempre un único plano, en sus dos modos (§ SECCIONES-TIPOS-3). `carrusel` (§ SECCIONES-
 *  CARRUSEL-1) es el MISMO caso que `banner`, repetido por diapositiva: cada una es foto a sangre
 *  con velo, nunca dos mitades de color — por eso cae en el default `true` sin necesitar su propia
 *  excepción, igual que `preguntas`/`columnas`/`collage`/`video` ya caen ahí. */
export function instanciaEsUniforme(tipo: SeccionInstanciaTipo): boolean {
  return tipo !== 'imagenTexto' && tipo !== 'filas';
}

// ─── EL OJO (§ SECCIONES-INSTANCIAS-VIVO-1) ──────────────────────────────────────────────────────

/** ¿Debe renderizarse esta instancia para el VISITANTE? Gemela de `seccionEsVisible`
 *  (`site-content-defaults.ts`), AHORA CON la mitad de repeater (§ SECCIONES-TIPOS-2: Preguntas/
 *  Columnas/Filas) — mismo orden de precedencia que su gemela: hide-on-empty GANA sobre el toggle
 *  (un `visible:true` con `items:[]` sigue sin mostrarse; no hay nada que mostrar). El dispatcher
 *  (`SeccionInstancia.tsx`) la usa para su self-gate, igual que `BrandStory.tsx`/`SubscriptionCTA.tsx`
 *  usan `seccionEsVisible` para el suyo. */
export function instanciaEsVisible(instancia: InstanciaContent): boolean {
  if (instancia.visible === false) return false;
  const items = DESCRIPTOR_INSTANCIA[instancia.tipo].items;
  if (items) {
    const arr = (instancia as unknown as Record<string, unknown>).items;
    return Array.isArray(arr) && arr.length > 0;
  }
  return true;
}
