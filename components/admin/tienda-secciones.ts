// LA CONFIGURACIÓN por sección del editor de la tienda. Datos PUROS (sin JSX, sin 'use client')
// para que el page server los importe y los pase como props al editor cliente. Lo que se
// PARAMETRIZA es exactamente esto —campos, imágenes, toggle de visibilidad, y la identidad de la
// sección (`seccion` + `titulo`)—; TODO lo demás (autoguardado, publicar/descartar, read↔edit,
// beforeunload, indicador, layout sticky) vive en la CÁSCARA (`TiendaSeccionEditor`). Si una
// sección nueva necesitara algo fuera de esta config, es señal de que la cáscara se está forzando.

export type SeccionVista = 'hero' | 'brandStory' | 'subscriptionCTA';

export type CampoTexto = { name: string; label: string; opcional?: boolean; textarea?: boolean; hint: string };
export type CampoImagen = { name: string; label: string };

// Descriptor de un campo DE ÍTEM (para el RepeaterEditor). `tipo` es GENÉRICO (no nombra ningún
// campo concreto): texto / textarea / rating. `resumen` es el ROL del campo en el renglón colapsado
// —principal (título) y detalle (fragmento)—, así el editor arma el resumen sin saber qué campo es.
// `defaultValor` es el valor inicial de un ítem nuevo (un rating nace en 5; un texto en ''). Todo
// serializable: el config cruza server→client como prop, así que NADA de funciones.
export type CampoItem = {
  name: string;
  label: string;
  tipo: 'texto' | 'textarea' | 'rating';
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
}

export interface SeccionConfig {
  seccion: SeccionVista;
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

// El ORDEN es el orden en la pantalla (y en la home): hero, historia, suscripción.
export const SECCIONES_TIENDA: SeccionConfig[] = [HERO, BRAND_STORY, SUBSCRIPTION];
