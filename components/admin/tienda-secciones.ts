// LA CONFIGURACIÓN por sección del editor de la tienda. Datos PUROS (sin JSX, sin 'use client')
// para que el page server los importe y los pase como props al editor cliente. Lo que se
// PARAMETRIZA es exactamente esto —campos, imágenes, toggle de visibilidad, y la identidad de la
// sección (`seccion` + `titulo`)—; TODO lo demás (autoguardado, publicar/descartar, read↔edit,
// beforeunload, indicador, layout sticky) vive en la CÁSCARA (`TiendaSeccionEditor`). Si una
// sección nueva necesitara algo fuera de esta config, es señal de que la cáscara se está forzando.

export type SeccionVista = 'hero' | 'brandStory' | 'subscriptionCTA' | 'testimonials' | 'nosotrosHistoria';

// Las PÁGINAS del storefront que el editor agrupa. La "página" es una agrupación de CONFIG (no un
// anidado en el dato, § modelo): cada sección declara a qué página pertenece. El selector del editor
// muestra una pestaña por página. `home` no se apaga; `nosotros` sí (§ paginas.nosotros.visible).
export type PaginaKey = 'home' | 'nosotros';
export const PAGINAS: { key: PaginaKey; label: string; apagable: boolean }[] = [
  { key: 'home',     label: 'Home',     apagable: false },
  { key: 'nosotros', label: 'Nosotros', apagable: true },
];

export type CampoTexto = { name: string; label: string; opcional?: boolean; textarea?: boolean; hint: string };
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
};

export interface RepeaterConfig {
  itemsKey: string;
  /** Nombre SINGULAR del ítem, para los botones y el renglón ("Agregar testimonio", "Testimonio 1"). */
  itemLabel: string;
  campos: CampoItem[];
  /** Tope de ítems. Al llegar, "Agregar" se deshabilita con un hint (mismo trato que el max de una
   *  lista). Ausente = sin tope (testimonios). */
  max?: number;
}

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
};

const SUBSCRIPTION: SeccionConfig = {
  seccion: 'subscriptionCTA',
  pagina: 'home',
  titulo: 'Suscripción',
  ocultable: true,
  imagenes: [], // sección de solo texto
  // Los beneficios son "Beneficio 1…4", NO "slot 1…4": el nombre dice lo que son, y el hint del
  // primero encuadra el grupo —opcionales, los vacíos no dejan hueco—. El número sólo distingue los
  // cuatro inputs (a11y). El CTA lleva label editable; su destino (/suscripciones) es estructura.
  campos: [
    { name: 'eyebrow',   label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',    label: 'Título',         hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'subtitulo', label: 'Subtítulo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'bullet1',   label: 'Beneficio 1', opcional: true, hint: 'Hasta 4. Deja vacíos los que no uses — la lista se cierra sin huecos.' },
    { name: 'bullet2',   label: 'Beneficio 2', opcional: true, hint: 'Opcional.' },
    { name: 'bullet3',   label: 'Beneficio 3', opcional: true, hint: 'Opcional.' },
    { name: 'bullet4',   label: 'Beneficio 4', opcional: true, hint: 'Opcional.' },
    { name: 'ctaLabel',  label: 'Botón',       hint: 'Su destino es /suscripciones (fijo). Vacío: se usa el texto por defecto.' },
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

// El ORDEN es el orden en la pantalla. Las de la home primero (en el orden de la home), después las
// de /nosotros; el editor las agrupa por `pagina` en pestañas.
export const SECCIONES_TIENDA: SeccionConfig[] = [HERO, BRAND_STORY, SUBSCRIPTION, TESTIMONIOS, NOSOTROS_HISTORIA];
