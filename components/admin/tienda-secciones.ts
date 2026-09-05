// LA CONFIGURACIÓN por sección del editor de la tienda. Datos PUROS (sin JSX, sin 'use client')
// para que el page server los importe y los pase como props al editor cliente. Lo que se
// PARAMETRIZA es exactamente esto —campos, imágenes, toggle de visibilidad, y la identidad de la
// sección (`seccion` + `titulo`)—; TODO lo demás (autoguardado, publicar/descartar, read↔edit,
// beforeunload, indicador, layout sticky) vive en la CÁSCARA (`TiendaSeccionEditor`). Si una
// sección nueva necesitara algo fuera de esta config, es señal de que la cáscara se está forzando.

export type SeccionVista = 'hero' | 'brandStory' | 'presentaciones' | 'subscriptionCTA' | 'testimonials' | 'nosotrosHistoria' | 'nosotrosGaleria';

// Las PÁGINAS del storefront que el editor agrupa. La "página" es una agrupación de CONFIG (no un
// anidado en el dato, § modelo): cada sección declara a qué página pertenece. El selector del editor
// muestra una pestaña por página. `home` no se apaga; `nosotros` sí (§ paginas.nosotros.visible).
export type PaginaKey = 'home' | 'nosotros';
export const PAGINAS: { key: PaginaKey; label: string; apagable: boolean }[] = [
  { key: 'home',     label: 'Home',     apagable: false },
  { key: 'nosotros', label: 'Nosotros', apagable: true },
];

// `categoria: true` → el campo es un DESTINO de categoría: la cáscara lo renderiza con el
// CategoriaCombobox (la lista real del catálogo) y avisa si el valor ya no existe (§ el destino de
// Presentaciones es DATO). Excluye `textarea`.
// `tituloDe` → nombre del campo cuyo VALOR EN VIVO rotula este campo: el destino se lee «En grano»
// lleva a: usando el título editable de la MISMA tarjeta, no "Presentación 1" (posición, que el
// owner no sabe si es izq o der). Vacío el título → cae al `label` estático (el fallback).
// (`grupo` se RETIRÓ: era config declarada dos veces —una en imágenes, otra en campos— para armar un
// encabezado duplicado; la agrupación por tarjeta la expresan ahora los BLOQUES, § BloqueConfig.)
export type CampoTexto = { name: string; label: string; opcional?: boolean; textarea?: boolean; categoria?: boolean; tituloDe?: string; hint: string };
export type CampoImagen = { name: string; label: string };

// Descriptor de un campo DE ÍTEM (para el RepeaterEditor). `tipo` es GENÉRICO (no nombra ningún
// campo concreto): texto / textarea / rating / imagen. `resumen` es el ROL del campo en el renglón
// colapsado —principal (título) y detalle (fragmento)—, así el editor arma el resumen sin saber qué
// campo es. `defaultValor` es el valor inicial de un ítem nuevo (un rating nace en 5; un texto o una
// imagen en ''). Todo serializable: el config cruza server→client como prop, así que NADA de
// funciones. El `'imagen'` sube por el uploader compartido de la cáscara (§ useSubidaImagen); un
// repeater con un campo 'imagen' agrega SUBIENDO primero (un ítem-imagen vacío es una foto rota).
export type CampoItem = {
  name: string;
  label: string;
  tipo: 'texto' | 'textarea' | 'rating' | 'imagen';
  opcional?: boolean;
  hint?: string;
  defaultValor?: number;
  resumen?: 'principal' | 'detalle';
  /** Sólo `tipo:'imagen'`: en qué campos del ítem guardar el ancho/alto natural de la foto (para la
   *  proporción de la celda en la galería). El uploader los lee; sin esto no se capturan dims. */
  dims?: { w: string; h: string };
};

export interface RepeaterConfig {
  itemsKey: string;
  /** Nombre SINGULAR del ítem, para los botones y el renglón ("Agregar testimonio", "Testimonio 1"). */
  itemLabel: string;
  /** Género del `itemLabel`, sólo para el artículo del copy de confirmación ("esta foto" vs "este
   *  testimonio"). Default masculino. */
  genero?: 'f' | 'm';
  campos: CampoItem[];
  /** Tope de ítems (las FOTOS, si el repeater acepta vídeo). Al llegar, "Agregar foto" se deshabilita
   *  con un hint. Ausente = sin tope (testimonios). */
  max?: number;
  /** Tope de VÍDEOS, SEPARADO del de fotos (§ galería: 12 fotos + 3 vídeos — el tope de vídeo es por
   *  PESO, no por composición). Presente → el repeater acepta vídeo (botón "Agregar vídeo", ítems
   *  `tipo:'video'`). Ausente → sólo fotos. */
  maxVideo?: number;
}

// ── BLOQUES · un tercer modo de dibujar la sección en el editor ──────────────────────────────────
// Un BLOQUE es una PIEZA de la tienda (una tarjeta, el encabezado, el collage) y POSEE sus imágenes y
// sus campos (por NOMBRE — el descriptor sigue teniendo los campos planos; el bloque sólo los AGRUPA).
// La presentación deja de ser el reflejo de la declaración (dos loops imágenes/campos): pasa a ser lo
// que los bloques dicen. El MODELO no se toca (campos planos, defaults, #44). Una sección SIN `bloques`
// cae a un bloque `seccion` derivado con TODO —la red de seguridad: renderiza como antes (§ bloques.ts)—.
// Cada `tipo` gana su renderer en su tanda.
export type BloqueConfig =
  // Bloque plano: encabezado (eyebrow/título) o el bloque derivado por defecto.
  | { tipo: 'seccion'; imagenes?: string[]; campos?: string[] }
  // Una TARJETA: su imagen (miniatura) + sus campos, direccionada por `slot` (el mapeo del puente es
  // por slot, no por posición). `opcional` → la pieza no aparece hasta que se agrega (rule 3).
  | { tipo: 'tarjeta'; slot: number; titulo: string; imagen?: string; campos: string[]; opcional?: boolean }
  // Una LISTA PLANA sobre slots fijos (los beneficios): filas para los llenos, "+ Agregar" y "×". Se
  // COMPACTA (rule 2 · § lista-plana). `slots` son los nombres de campo; `itemLabel` el singular.
  | { tipo: 'lista'; slots: string[]; itemLabel: string; hint?: string }
  // Un COLLAGE 2×2 de miniaturas (Historia): la posición se VE en el grid, como en la tienda (rule 1).
  | { tipo: 'collage'; titulo?: string; imagenes: string[] };

export interface SeccionConfig {
  seccion: SeccionVista;
  /** A qué página del storefront pertenece (§ PAGINAS). El editor agrupa por esto. */
  pagina: PaginaKey;
  titulo: string;
  campos: CampoTexto[];
  imagenes: CampoImagen[];
  /** Si la sección expone el toggle de visibilidad (§ REGISTRY.ocultable). El hero es false. */
  ocultable: boolean;
  /** Presente → sección de LISTA: la cáscara renderiza el RepeaterEditor para este array de ítems,
   *  además de los `campos` planos de sección. */
  repeater?: RepeaterConfig;
  /** Cómo se DIBUJA la sección en el editor (§ BloqueConfig). Ausente → un bloque `seccion` derivado
   *  con todas las imágenes y campos (idéntico a antes). Cada bloque posee sus campos por NOMBRE. */
  bloques?: BloqueConfig[];
}

const HERO: SeccionConfig = {
  seccion: 'hero',
  pagina: 'home',
  titulo: 'Hero de la home',
  ocultable: false,
  imagenes: [{ name: 'imagen', label: 'Imagen de fondo' }],
  campos: [
    { name: 'eyebrow',            label: 'Línea superior',      opcional: true, hint: 'La línea en mayúsculas sobre el titular. Vacío: no se muestra.' },
    { name: 'titulo',             label: 'Titular',             hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'tituloEnfasis',      label: 'Énfasis del titular', opcional: true, hint: 'La palabra en cursiva, en su propia línea bajo el titular. Vacío: no se muestra.' },
    { name: 'subtitulo',          label: 'Subtítulo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'ctaPrimarioLabel',   label: 'Botón principal',     hint: 'Su destino es /tienda (fijo). Vacío: se usa el texto por defecto.' },
    { name: 'ctaSecundarioLabel', label: 'Botón secundario',    opcional: true, hint: 'Su destino es /suscripciones (fijo). Vacío: no se muestra.' },
  ],
};

const BRAND_STORY: SeccionConfig = {
  seccion: 'brandStory',
  pagina: 'home',
  titulo: 'Nuestra Historia',
  ocultable: true,
  // El collage 2×2 del storefront: imagen1 arriba-izq, imagen2 arriba-der, imagen3 abajo-izq,
  // imagen4 abajo-der. Las cuatro son requeridas (el collage es rígido; vacío → default).
  imagenes: [
    { name: 'imagen1', label: 'Imagen 1 · arriba izquierda' },
    { name: 'imagen2', label: 'Imagen 2 · arriba derecha' },
    { name: 'imagen3', label: 'Imagen 3 · abajo izquierda' },
    { name: 'imagen4', label: 'Imagen 4 · abajo derecha' },
  ],
  campos: [
    { name: 'eyebrow',  label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',   label: 'Título',         hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'parrafo1', label: 'Primer párrafo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'parrafo2', label: 'Segundo párrafo', opcional: true, textarea: true, hint: 'Vacío: no se muestra.' },
  ],
  // BLOQUES: el COLLAGE 2×2 (la posición de cada foto se ve en el grid, como en la tienda) + el texto.
  bloques: [
    { tipo: 'collage', titulo: 'Fotos (así se ubican en la tienda)', imagenes: ['imagen1', 'imagen2', 'imagen3', 'imagen4'] },
    { tipo: 'seccion', campos: ['eyebrow', 'titulo', 'parrafo1', 'parrafo2'] },
  ],
};

// Presentaciones ("¿Cómo tomas tu café?"): DOS tarjetas de cardinalidad FIJA → campos PLANOS con
// imágenes (patrón brandStory), NO un repeater. Cada tarjeta es nombre + descripción + imagen + el
// DESTINO (`categoria`, editable con el combobox de categorías reales; § el destino de Presentaciones
// es DATO). El destino dejó de ser estructura porque un path fijo se rompe cuando el cliente renombra
// la categoría.
const PRESENTACIONES: SeccionConfig = {
  seccion: 'presentaciones',
  pagina: 'home',
  titulo: 'Presentaciones',
  ocultable: true,
  imagenes: [
    { name: 'imagen1', label: 'Imagen' },
    { name: 'imagen2', label: 'Imagen' },
    { name: 'imagen3', label: 'Imagen' },
    { name: 'imagen4', label: 'Imagen' },
  ],
  // 2 a 4 tarjetas: 1-2 REQUERIDAS (defaults de Nayoli), 3-4 OPCIONALES (vacías → la tarjeta no se
  // muestra; con título O imagen aparece). Los campos siguen PLANOS; los BLOQUES los agrupan por
  // tarjeta (§ bloques, abajo). El hint de los slots 3-4 encuadra la pieza opcional.
  campos: [
    { name: 'eyebrow', label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',  label: 'Título',         hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'label1',     label: 'Nombre',      hint: 'Ej. "En grano". Vacío: se usa el texto por defecto.' },
    { name: 'copy1',      label: 'Descripción', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'categoria1', label: 'Presentación 1 · lleva a', categoria: true, tituloDe: 'label1', hint: 'La categoría del catálogo que abre esta tarjeta. Elige de la lista o escribe una.' },
    { name: 'label2',     label: 'Nombre',      hint: 'Ej. "Molido". Vacío: se usa el texto por defecto.' },
    { name: 'copy2',      label: 'Descripción', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'categoria2', label: 'Presentación 2 · lleva a', categoria: true, tituloDe: 'label2', hint: 'La categoría del catálogo que abre esta tarjeta. Elige de la lista o escribe una.' },
    { name: 'label3',     label: 'Nombre',      opcional: true, hint: 'Ej. "Tortas".' },
    { name: 'copy3',      label: 'Descripción', opcional: true, textarea: true, hint: 'Opcional.' },
    { name: 'categoria3', label: 'Presentación 3 · lleva a', categoria: true, tituloDe: 'label3', opcional: true, hint: 'La categoría del catálogo que abre esta tarjeta.' },
    { name: 'label4',     label: 'Nombre',      opcional: true, hint: 'Ej. "Postres".' },
    { name: 'copy4',      label: 'Descripción', opcional: true, textarea: true, hint: 'Opcional.' },
    { name: 'categoria4', label: 'Presentación 4 · lleva a', categoria: true, tituloDe: 'label4', opcional: true, hint: 'La categoría del catálogo que abre esta tarjeta.' },
  ],
  // BLOQUES: un encabezado (eyebrow/título) + una TARJETA por slot. Cada tarjeta posee su imagen y sus
  // tres campos (nombre/descripción/destino); el combobox de destino vive DENTRO de su tarjeta. Slots
  // 3-4 OPCIONALES: la pieza no aparece hasta "+ Agregar tarjeta". El `slot` es la identidad del puente.
  bloques: [
    { tipo: 'seccion', campos: ['eyebrow', 'titulo'] },
    { tipo: 'tarjeta', slot: 1, titulo: 'Tarjeta 1', imagen: 'imagen1', campos: ['label1', 'copy1', 'categoria1'] },
    { tipo: 'tarjeta', slot: 2, titulo: 'Tarjeta 2', imagen: 'imagen2', campos: ['label2', 'copy2', 'categoria2'] },
    { tipo: 'tarjeta', slot: 3, titulo: 'Tarjeta 3', imagen: 'imagen3', campos: ['label3', 'copy3', 'categoria3'], opcional: true },
    { tipo: 'tarjeta', slot: 4, titulo: 'Tarjeta 4', imagen: 'imagen4', campos: ['label4', 'copy4', 'categoria4'], opcional: true },
  ],
};

const SUBSCRIPTION: SeccionConfig = {
  seccion: 'subscriptionCTA',
  pagina: 'home',
  titulo: 'Suscripción',
  ocultable: true,
  imagenes: [], // sección de solo texto
  // Los beneficios son campos PLANOS `bullet1..4`; los BLOQUES los presentan como una LISTA (abajo). El
  // CTA lleva label editable; su destino (/suscripciones) es estructura.
  campos: [
    { name: 'eyebrow',   label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',    label: 'Título',         hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'subtitulo', label: 'Subtítulo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'bullet1',   label: 'Beneficio', opcional: true, hint: 'Un beneficio de la suscripción.' },
    { name: 'bullet2',   label: 'Beneficio', opcional: true, hint: 'Un beneficio de la suscripción.' },
    { name: 'bullet3',   label: 'Beneficio', opcional: true, hint: 'Un beneficio de la suscripción.' },
    { name: 'bullet4',   label: 'Beneficio', opcional: true, hint: 'Un beneficio de la suscripción.' },
    { name: 'ctaLabel',  label: 'Botón',       hint: 'Su destino es /suscripciones (fijo). Vacío: se usa el texto por defecto.' },
  ],
  // BLOQUES: encabezado + la LISTA de beneficios + el botón. Los beneficios pasan de 4 inputs fijos a
  // una lista plana que se cierra sin huecos (rule 2 · § lista-plana).
  bloques: [
    { tipo: 'seccion', campos: ['eyebrow', 'titulo', 'subtitulo'] },
    { tipo: 'lista', slots: ['bullet1', 'bullet2', 'bullet3', 'bullet4'], itemLabel: 'beneficio', hint: 'Hasta 4. La lista se cierra sin huecos.' },
    { tipo: 'seccion', campos: ['ctaLabel'] },
  ],
};

const TESTIMONIOS: SeccionConfig = {
  seccion: 'testimonials',
  pagina: 'home',
  titulo: 'Testimonios',
  ocultable: true,
  imagenes: [], // sección de solo texto (el avatar es la inicial del nombre)
  // Campos de SECCIÓN: el encabezado. La LISTA va en `repeater`.
  campos: [
    { name: 'eyebrow', label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',  label: 'Título',         hint: 'Vacío: se usa el texto por defecto.' },
  ],
  // La LISTA de testimonios. `resumen` arma el renglón colapsado: nombre (principal) + la cita
  // (detalle). `stars` es el rating (estrellas clicables, nace en 5). city/product son opcionales.
  repeater: {
    itemsKey: 'items',
    itemLabel: 'Testimonio',
    genero: 'm', // "¿Eliminar este testimonio?"
    campos: [
      { name: 'name',    label: 'Nombre',       tipo: 'texto',    resumen: 'principal', hint: 'Quién lo dice.' },
      { name: 'city',    label: 'Ciudad',       tipo: 'texto',    opcional: true, hint: 'Opcional.' },
      { name: 'text',    label: 'Testimonio',   tipo: 'textarea', resumen: 'detalle',  hint: 'Lo que dice, en sus palabras.' },
      { name: 'product', label: 'Producto',     tipo: 'texto',    opcional: true, hint: 'Opcional. El producto que menciona, si aplica.' },
      { name: 'stars',   label: 'Calificación', tipo: 'rating',   defaultValor: 5, hint: 'De 1 a 5 estrellas.' },
    ],
  },
};

// La página /nosotros: la historia larga (sólo texto; la galería variable es su propia sección,
// tanda 2). `ocultable:false` — el ocultar es a nivel de PÁGINA (el toggle de encender/apagar), no
// de esta sección.
const NOSOTROS_HISTORIA: SeccionConfig = {
  seccion: 'nosotrosHistoria',
  pagina: 'nosotros',
  titulo: 'Historia',
  ocultable: false,
  imagenes: [],
  campos: [
    { name: 'eyebrow',  label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',   label: 'Título',         hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'parrafo1', label: 'Primer párrafo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'parrafo2', label: 'Segundo párrafo', opcional: true, textarea: true, hint: 'Vacío: no se muestra.' },
    { name: 'parrafo3', label: 'Tercer párrafo',  opcional: true, textarea: true, hint: 'Vacío: no se muestra.' },
  ],
};

// La GALERÍA de /nosotros: la 2ª sección REPEATER, y la que estrena el tipo `imagen` por ítem. El
// encabezado (eyebrow/titulo) es OPCIONAL —una galería puede ir sin heading—. La LISTA de fotos va
// en `repeater`, con TOPE 12 (curaduría: dos pantallas de grid cuentan una finca; sin tope el
// operador sube todo lo que tiene). Cada ítem: `url` (tipo imagen, sube por el uploader compartido) +
// `alt` opcional. El `alt` es el `resumen.principal` del renglón colapsado —muestra la descripción,
// o "Foto N" si está vacía—; la miniatura la pone el propio campo imagen.
const NOSOTROS_GALERIA: SeccionConfig = {
  seccion: 'nosotrosGaleria',
  pagina: 'nosotros',
  titulo: 'Galería',
  ocultable: true,
  imagenes: [], // sin imágenes FIJAS de sección: las fotos viven en los ítems del repeater
  campos: [
    { name: 'eyebrow', label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',  label: 'Título',         opcional: true, hint: 'El encabezado de la galería. Vacío: no se muestra (las fotos van sin título).' },
  ],
  repeater: {
    itemsKey: 'items',
    itemLabel: 'Foto',
    genero: 'f', // "¿Eliminar esta foto?"
    max: 12,      // fotos
    maxVideo: 3,  // vídeos (tope por PESO — con autoplay-on-view los tres bajan al entrar; § render)
    campos: [
      { name: 'url', label: 'Foto',        tipo: 'imagen', dims: { w: 'w', h: 'h' }, hint: 'JPG, PNG o WebP.' },
      { name: 'alt', label: 'Descripción', tipo: 'texto', opcional: true, resumen: 'principal', hint: 'Describe la foto para quien no puede verla. Vacío: se usa una descripción genérica.' },
    ],
  },
};

// El ORDEN es el orden en la pantalla. Las de la home primero (en el orden de la home), después las
// de /nosotros; el editor las agrupa por `pagina` en pestañas.
export const SECCIONES_TIENDA: SeccionConfig[] = [HERO, BRAND_STORY, PRESENTACIONES, SUBSCRIPTION, TESTIMONIOS, NOSOTROS_HISTORIA, NOSOTROS_GALERIA];
