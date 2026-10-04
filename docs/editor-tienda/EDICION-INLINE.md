# Edición de texto DIRECTO sobre la página — diseño (sin código)

**Fecha:** 2026-10-02
**Rama:** `slice/corte-reescritura-prototipo-1`
**Ledger:** `EDITOR-TIENDA-EDICION-INLINE-DISENO-1`
**Autoriza:** gate del owner del 2026-10-01 (§ 12 de `DISENO.md`, el mismo que pidió la vista propia de
pantalla completa): *"aun no se siente como un editor inline"*. Confirmado explícitamente como pieza de
diseño APARTE por § 9.1 de `DISENO.md`: *"Editar DENTRO del iframe … es una pieza de diseño que este
documento no cubre … Queda pendiente de su propio documento de diseño."*
**Este documento no cambia código.** Es el documento que § 9.1 pidió. Ninguna de las piezas de abajo
está construida; el owner lo revisa antes de que exista un solo slice de implementación.

---

## 0 · Qué ya existe, y qué es nuevo

El editor (`EDITOR-TIENDA-IFRAME-VISTA-1` → `EDITOR-TIENDA-SELECCION-1`, §§ 10–14 de `DISENO.md`) ya
resuelve DOS de los tres pedidos del owner: la tienda real dentro de un `<iframe>` (sin reconstrucción
paralela) y la selección en contexto (clic en una sección DENTRO del iframe → esa sección se abre en la
lista lateral, con resalte). **Lo que falta es el tercero: escribir el texto directamente sobre la
página, sin pasar por el formulario de la lista.** Hoy un clic en el hero resalta "Portada" y la abre en
la lista — el dueño todavía tiene que mover los ojos al costado para teclear. Este documento diseña
cómo ese mismo clic, en cambio, deja escribir ahí mismo.

**Se construye SOBRE el puente ya existente, no al lado de él.** `lib/storefront/editor-puente.ts` +
`components/storefront/EditorPuenteVivo.tsx` ya resuelven panel→iframe (cambios de texto/imagen se ven
sin recargar, § 13 de `DISENO.md`) e iframe→panel (clic en una sección → se abre en la lista, § 14). La
pieza que falta es menor de lo que parece: un TERCER mensaje del mismo puente (iframe→panel: "el campo
X cambió a Y"), y una forma de que el iframe sepa, nodo por nodo, qué campo es cada texto — que hoy NO
sabe (§ 1.4).

---

## 1 · Censo medido — qué texto visible sale de un campo, y cuál no

**Método:** `REGISTRY` (`lib/config/site-content-defaults.ts`) declara, por sección, qué `campos` son
`'requerido'`/`'opcional'` — la fuente única que ya usan el resolver, el schema de guardado y el editor
de la lista (`components/admin/tienda-secciones.ts`, `SeccionConfig.campos`/`.imagenes`). Contado
programáticamente contra ese REGISTRY (no a mano): las 15 secciones de home/nosotros/suscripciones
declaran **152 campos** en total. De ellos:

| clase | cuántos | por qué quedan fuera de "texto libre" |
| --- | --- | --- |
| **Imagen** (`imagen`, `imagenPoster`, `imagen1..4`, `imagenFondo`…) | 18 | Son URLs de blob — el clic abre el selector de archivo (§ 4), no un campo de texto. |
| **Selector/pointer** (`categoria1..4`, `ctaDestino`, `ctaSecundarioDestino`, `destacadoSlot`, `productoSlug`+grupo) | 13 | Se eligen de una lista cerrada (combobox de categorías reales, combobox de productos, select de planes) — tipear ahí no tiene sentido; siguen siendo del formulario de la lista. |
| **Texto libre** (título, subtítulo, párrafo, label, badge, nombre, descripción…) | **121** | Candidatos reales a edición directa. |

Más **7 plantillas de campo de ítem de repeater** (`testimonials`: name/city/text/product = 4;
`nosotrosGaleria`: `alt` = 1, `url` es imagen; `suscripcionFaq`: question/answer = 2), de cardinalidad
VARIABLE (hasta 12 fotos, sin tope de testimonios/preguntas) — no se pueden contar como un número fijo
de nodos: dependen de cuántos ítems tenga el borrador en cada momento.

### 1.1 · Home (`app/(storefront)/page.tsx`)

| Sección (`SeccionVista`) | Campos de TEXTO libre | Imagen | Selector/pointer | Texto NO editable en esta sección |
| --- | --- | --- | --- | --- |
| `hero` | eyebrow, titulo, tituloEnfasis, subtitulo, ctaPrimarioLabel, ctaSecundarioLabel, fraseAlPie (7) | imagen, imagenPoster, imagenMovil, imagenMovilPoster (4) | — | El indicador **"Desliza"** (`HeroMediaMarquesina.tsx`) es un literal fijo del código — no hay campo. |
| `marquesina` | texto (1) | imagen (1) | — | — |
| `trustBadges` | **0** | — | — | Las 4 insignias (ícono + texto: "Origen 100% colombiano"…) son el array `BADGES` fijo de `TrustBadges.tsx` — sólo el switch "Mostrar" es dato. |
| `brandStory` | eyebrow, titulo, parrafo1, parrafo2, ctaLabel (5) | imagen1..4 (4) | ctaDestino (1) | — |
| `origen` | eyebrow, titulo, lede, 4×datoLabel, 4×datoValor, 3×statEtiqueta (14) | imagen1, imagen2 (2) | — | — |
| `presentaciones` | eyebrow, titulo, label1..4, copy1..4, ctaLabel (10) | imagen1..4 (4) | categoria1..4, ctaDestino (5) | Con `variante:'riel'` (§ 3.1), las tarjetas visibles son productos del CATÁLOGO — `label*`/`copy*` no tienen efecto aunque existan en el REGISTRY. |
| `subscriptionCTA` | eyebrow, titulo, subtitulo, bullet1..4, ctaLabel, ctaSecundarioLabel (9) | imagenFondo (1) | ctaSecundarioDestino (1) | — |
| `testimonials` | eyebrow, titulo (2) + por ítem: name, city, text, product (4) | — | — | `stars` es numérico (clic de estrellas), no texto. |
| `spotlight` | eyebrow, titulo, badge, nombreCafe, notaPrecio (5) | — | productoSlug+grupo (4) | Nombre del producto, descripción, notas de cata y **precio** se LEEN del `Product` pineado — vienen del catálogo, nunca de `SiteContent` (§ 3.1, mismo motivo por el que el precio queda fuera de todo este diseño). |
| `featured` (= la banda que ocupa `spotlight`) | — | — | — | Sin `SeccionConfig` propia aparte de `spotlight` (§ el docstring de `SeccionConfig.bandaId`). |

Además, visibles en TODA página de home (y de nosotros/suscripciones, porque viven en el layout, no en
`page.tsx`): el **nav** (`StoreNav`) y el **pie** (`StoreFooter`). Sus textos SÍ son `SiteContent`
(`content.menu`/`content.footer`) y `SiteSetting` (`nombre`/`tagline`), pero se editan HOY por un
formulario APARTE (`MenuSeccion.tsx`/`FooterSeccion.tsx`/`DatosNegocioSeccion.tsx`, "cromo transversal",
§ 1.1 de `DISENO.md`) — **ninguno vive en `SECCIONES_TIENDA`**, así que hoy no son alcanzables desde el
iframe (ni por selección en contexto, ni por edición directa). Censado aparte en § 1.4.

### 1.2 · `/nosotros`

| Sección | Campos de TEXTO libre | Imagen | Selector/pointer |
| --- | --- | --- | --- |
| `nosotrosHistoria` | eyebrow, titulo, parrafo1, parrafo2, parrafo3 (5) | imagen (1) | — |
| `nosotrosGaleria` | eyebrow, titulo (2) + por ítem: alt (1) | por ítem: url (1) | — |
| `nosotrosCierre` | titulo, parrafo, ctaLabel (3) | imagenFondo (1) | ctaDestino (1) |

Nav y pie, igual que en home (§ 1.1).

### 1.3 · `/suscripciones`

| Sección | Campos de TEXTO libre | Imagen | Selector/pointer |
| --- | --- | --- | --- |
| `suscripcionPlanes` | eyebrow, titulo, tituloEnfasis, subtitulo, planesTitulo, planesSubtitulo, ctaLabel (7) + por plan (1-4): nombre, descripcion, precio, ben_1..4 (hasta 8 × 4 planes = 32) | — | destacadoSlot (1) |
| `suscripcionPasos` | titulo (1) + por paso (fijos, 4): label, desc (8) | — | — |
| `suscripcionFaq` | titulo (1) + por ítem: question, answer (2) | — | — |

**El precio de un plan (`precio1..4`) ES texto libre de `SiteContent`** (a diferencia del precio de un
producto, que es del catálogo) — pero § 9.1 lo excluye igual: la decisión del owner fue "el precio NO se
edita desde el editor", sin distinguir precio-de-plan de precio-de-producto. Se mantiene afuera por
alcance (§ 5), no porque el mecanismo no pudiera.

Nav y pie, igual que en home (§ 1.1).

### 1.4 · Lo que NO sale de un campo editable desde el iframe hoy

| Texto visible | Fuente real | Por qué no es candidato de ESTE diseño |
| --- | --- | --- |
| Nombre/descripción/notas de cata/precio de cualquier producto en `/tienda`, `/tienda/[slug]`, el riel de Presentaciones, Spotlight | `Product` (Prisma, `/admin/productos`) | Catálogo — § 9.1 lo excluye explícitamente ("el precio sigue siendo dato del catálogo"), y por extensión cualquier otro campo del producto: no hay `SiteContent` que editar ahí. |
| Las 4 insignias de `trustBadges` | `BADGES` (array fijo, `TrustBadges.tsx`) | Estructura de código — ampliarlas a dato editable es, según su propio comentario, "una decisión aparte". |
| "Desliza" (hero-media) | Literal fijo (`HeroMediaMarquesina.tsx`) | Microcopy de UI, nunca se declaró como campo. |
| Los nombres de las PÁGINAS en el nav ("Tienda", "Suscripciones", "Nosotros") | `content.menu` | SÍ es `SiteContent`, pero se edita por `MenuSeccion.tsx`, fuera de `SECCIONES_TIENDA` — no alcanzable desde el iframe hoy (§ 6, riesgo de alcance). |
| El texto del pie (columnas, enlaces, tarjeta) | `content.footer` | Mismo caso: `FooterSeccion.tsx`, fuera de `SECCIONES_TIENDA`. |
| Nombre del negocio / tagline (wordmark del nav y del pie) | `SiteSetting.nombre`/`.tagline` | Otro modelo, otra pantalla (`Configuración`, § negocio≠tienda de `CLAUDE.md`) — nunca fue parte de `SiteContent`. |

---

## 2 · Mecanismo

### 2.1 · El principio que gobierna todo lo de abajo

**El nodo contentEditable (o el campo flotante) NUNCA es la fuente de verdad. Es un INPUT MÁS para el
mismo `form` que ya tiene la lista lateral.** Cada tecleo manda `{seccion, campo, valor}` al panel por
`postMessage`; el panel llama al MISMO setter (`cambiar(campo, valor)`) que ya usa el `onChange` del
input de la lista; el `useEffect` que YA existe (`TiendaSeccionEditor`, disparado sobre `form`,
§ 13.2 de `DISENO.md`) vuelve a mandar el contenido resuelto HACIA ABAJO, y `SiteContentProvider`
(stateful, ya construido) re-renderiza TODOS los consumidores desde el valor canónico — nunca se lee
`innerHTML`, nunca el DOM manda sobre el dato. Es el mismo contrato que pedía el punto 2 del encargo, y
es lo que YA construyó `EDITOR-TIENDA-POSTMESSAGE-1`: este diseño no inventa un segundo camino de
datos, extiende el que existe con un tercer mensaje.

### 2.2 · `contentEditable` directo vs. campo flotante — medido, no supuesto

`CLAUDE.md` § El editor VISUAL, FASE 2 ya evaluó y RECHAZÓ `contentEditable` directo, en el mecanismo
VIEJO (`VistaTiendaEnVivo`, el componente renderizado SIEMPRE a 1280px y escalado con `transform:
scale(paneW/1280)` — ratios ~0.30–0.44, un título de 30px cayendo a 9–13px). Ese rechazo **no se
hereda automáticamente** al mecanismo NUEVO, y hay que decirlo explícitamente para no repetir la
pregunta: el iframe de `EDITOR-TIENDA-DISPOSITIVOS-1` renderiza el documento a su ANCHO LITERAL
(1280/768/393px reales) y sólo aplica `transform: scale()` al **contenedor del `<iframe>`** cuando el
dispositivo elegido no entra en el canvas disponible (§ 12.2 de `DISENO.md`) — el documento DENTRO del
iframe nunca sabe que está siendo escalado desde afuera, y el navegador traduce clic/caret/selección
correctamente sobre una transformación CSS real de contenido real (es el mismo hecho que ya hace
funcionar "Ir a la sección"/el resalte en los tres modos, § 12.2, último párrafo). Así que la OBJECIÓN
original (texto ilegible por estar renderizado chico) no aplica en Escritorio sin escalar (el caso por
defecto), y aplica sólo PARCIALMENTE en Tablet/Teléfono escalados — y ahí la reducción es modesta (un
documento de 393px de ancho real escalado para caber en un canvas de admin, no un documento de 1280px
aplastado a una fracción). **Aun así, esto es una MEDICIÓN que falta hacer, no una garantía**: el slice
que construya esto debe medir legibilidad real en los tres anchos antes de fijar el mecanismo —
exactamente el tipo de verificación por ejecución que el resto de este plan ya exige (§ 6).

Independientemente de la legibilidad, hay CUATRO problemas de `contentEditable` DIRECTO que no dependen
de la escala y que SÍ son del diseño (no de la medición):

1. **Nodos duplicados.** `marquesina.texto` se renderiza en **dos** `<span>` distintos para el loop sin
   costura (`Marquesina.tsx:107-108` Y `HeroMediaMarquesina.tsx:717-718`, el mismo campo, dos
   composiciones distintas). Un `contentEditable` nativo editaría UNO de los dos; el otro quedaría
   desincronizado hasta el próximo re-render con el dato canónico.
2. **Nodos animados.** Los tres contadores de `origen` (`statNumero1..3`) NO muestran el valor del
   campo: muestran un número que una animación (`useContadorAnimado`, cuenta de 0 al valor final al
   entrar en vista, `once:true`) va CALCULANDO. Un clic ahí cae sobre un nodo cuyo texto en pantalla no
   es el dato — editable directo sería editar un número a medio contar.
3. **HTML/pegar.** `contentEditable` acumula `<span>`/`<div>`/`<br>` en el DOM real con cualquier pegado
   con formato; para mantener el campo como STRING plano (lo que el schema zod exige) hay que leer
   SIEMPRE `.textContent`, nunca `.innerHTML` — viable, pero una fuente más de "lo que se ve en pantalla
   un instante no es lo que se va a guardar".
4. **Deshacer inconsistente.** El historial de undo de `contentEditable` varía entre navegadores y no es
   el mecanismo confiable que ya tienen los `<input>`/`<textarea>` nativos.

**Variantes de composición multiplican el costo, en CUALQUIERA de los dos mecanismos.** 5 de las 15
secciones declaran `variantes` (`hero`: 4; `brandStory`: 2; `presentaciones`: 3; `subscriptionCTA`: 2) —
CADA variante es un componente DISTINTO que renderiza el mismo campo (`HeroCurtina`/`HeroFicha`/
`HeroMedia`/`HeroMediaMarquesina`, cada uno su propio JSX para `hero.titulo`). Marcar un campo como
editable en una variante y no en las demás deja la edición directa rota en silencio para el tenant que
use esa variante — CORTE (la rama activa) ya usa varias de las no-canónicas (`riel`, `sticky`,
`centrada`, `linea`), así que esto no es un caso de borde teórico.

**Recomendación: campo flotante, DENTRO del documento del iframe (no `contentEditable` sobre el nodo
real).** Es la variante del ítem ya evaluado en `CLAUDE.md` § El editor VISUAL, FASE 2 ("el campo
flotante para el TEXTO") — pero esa evaluación lo rechazaba por el costo de traducir coordenadas PANEL↔
documento-escalado; acá ese costo desaparece porque el overlay vive DENTRO del MISMO documento que el
nodo (mismo origen, mismo árbol — exactamente el argumento que § 4.1.1 de `DISENO.md` ya usa para pintar
el resalte adentro del iframe en vez de calcularlo desde afuera). Mecánica:

- Clic en un nodo marcado `[data-editor-campo]` (y Navegar apagado, mismo gate que hoy) →
  `EditorPuenteVivo` mide el nodo con `getBoundingClientRect()` (DENTRO del iframe, sin traducir nada) y
  monta, en su lugar, un `<input>` o `<textarea>` (según `textarea: true`/`false`, el mismo booleano que
  `CampoTexto` ya declara por campo) posicionado encima, con la MISMA tipografía/tamaño/color/alineación
  (leídos con `getComputedStyle` del nodo real) — visualmente indistinguible del texto que tapa.
- El nodo real se oculta (`visibility: hidden`, conserva su layout) mientras el overlay está activo —
  nunca texto duplicado en pantalla.
- Cada `input`/cambio manda `{seccion, campo, valor}` al panel (sin debounce propio: el puente ya mide
  2.4–5ms por mensaje, § 13.2 — más barato que cualquier debounce que agregue latencia percibida). El
  panel actualiza `form` y el ciclo normal hace el resto.
- `Enter` en un campo `textarea:false` (título, nombre, label) COMMITEA y cierra el overlay (no inserta
  salto de línea); en uno `textarea:true` inserta el salto, como cualquier `<textarea>`.
- `Escape`, clic afuera, o Tab cierran el overlay y restauran el nodo real (que para entonces ya
  refleja el valor nuevo, por el ciclo del puente).
- **Deshacer**: nativo del navegador DENTRO del campo (es un `<input>`/`<textarea>` real, no
  `contentEditable`) — sin mecanismo nuevo. El "Descartar" de la sección sigue siendo el undo de
  SECCIÓN completa, sin cambios.
- **Nodos duplicados** (`marquesina.texto`): sólo UNO de los dos `<span>` lleva `data-editor-campo`; el
  overlay escribe en el `form` como cualquier campo, y el OTRO `<span>` — que nunca tuvo overlay encima —
  se actualiza solo, porque renderiza del mismo `useSiteContent()` que el ciclo panel→iframe ya alimenta.
  Ningún caso especial: el campo flotante nunca tocó el DOM del segundo nodo.
- **Nodos animados** (contadores de `origen`): el overlay se posiciona sobre el nodo en su estado YA
  asentado (la animación corre una vez al entrar en vista, `once:true`); el campo sigue siendo el string
  del dato, nunca el número intermedio de la animación. Nuance a verificar por ejecución en el slice que
  lo construya: si el contador, al recibir un valor nuevo por el ciclo panel→iframe, vuelve a animar
  desde 0 o salta directo al nuevo número — ninguna de las dos es incorrecta, pero hay que decidir cuál
  se quiere y comprobarla contra el código real de `useContadorAnimado`, no asumirla.

### 2.3 · Marcar el nodo — el costo real de esta pieza

**Hoy NINGÚN componente de sección sabe que está en modo editor.** Medido contra el código (no
supuesto): `app/(storefront)/page.tsx` envuelve cada banda en `<div data-editor-seccion={id}>` DESDE
AFUERA (`bandaNodo()`, `page.tsx:119-127`) — el componente de adentro (`HeroSection`, `Origen`…) recibe
exactamente el mismo `style` que recibía antes del iframe, nada más. Para marcar un CAMPO (no la
sección entera) hace falta que el JSX que renderiza `hero.titulo` sepa, desde ADENTRO del componente,
que está en modo editor — eso no existe hoy y hay que construirlo.

- **La señal llega por un CONTEXT nuevo, sibling de `SiteContentProvider`, no por prop.** `layout.tsx`
  YA calcula `enModoEditor` (una sola vez, `modoEditorActivo()`, `layout.tsx:130`) y ya se lo pasa a
  `EditorPuenteVivo activo={enModoEditor}` — agregar un `<ModoEditorProvider value={enModoEditor}>`
  hermano ahí es gratis en cómputo. **No se agrega al `Ctx` de `SiteContentProvider`**: ese contexto
  expone `SiteContentData` DIRECTO (no un objeto `{content, …}`) y lo leen ~40 componentes
  destructurando campos (`const { trustBadges, navTratamiento } = useSiteContent();`) — cambiar su forma
  tocaría los 40. Un contexto nuevo y chico (`useModoEditorActivo(): boolean`) no toca ninguno.
- **El costo real está en el PER-CAMPO, no en la plomería.** 121 campos de texto libre + 7 plantillas de
  repeater (§ 1), repartidos en ~15 componentes de sección Y sus variantes (hasta 4 implementaciones del
  mismo campo, § 2.2) — cada JSX que hoy escribe `{hero.titulo}` pasa a escribir algo como
  `<CampoEditable campo="hero.titulo" multilinea={false}>{hero.titulo}</CampoEditable>`, un componente
  COMPARTIDO (storefront, nuevo) que: con `useModoEditorActivo()` en `false` devuelve `children` tal
  cual (cero bytes, cero atributos, byte-idéntico a hoy — mismo contrato que `data-editor-seccion`); con
  `true`, envuelve con `data-editor-campo="hero.titulo"` + `data-editor-linea={multilinea?'multiple':'unica'}`.
  **Esto toca `app/(storefront)/` y `components/storefront/` — Tier 1 por la lista YA vigente de
  `CLAUDE.md`, en cada uno de esos ~15+ archivos** (igual que `EDITOR-TIENDA-SELECCION-1` ya tocó
  `Contenido.tsx` por el mismo motivo). Es la razón concreta por la que § 6 recomienda un plan por
  slices ACOTADO por sección, no un slice único que toque las 15.
- **Suscripciones repite el obstáculo de `Contenido.tsx`.** `suscripciones/Contenido.tsx` ya no puede
  recibir el booleano por prop ni por `useSearchParams()` (§ 14.3 de `DISENO.md`, medido); el `Context`
  SÍ lo resuelve de raíz —a diferencia del marcador de sección, que tuvo que resolverse con DOM
  imperativo por ser "sólo un `<div>` envolvente"— porque `ModoEditorProvider` se monta en el layout del
  storefront, que SÍ es ancestro de `Contenido.tsx` vía el árbol de React normal (el problema de § 14.3
  era espec íficamente `useSearchParams()`/prop, no contextos). Esto es una mejora de paso sobre el
  mecanismo de selección, no una complicación nueva.

### 2.4 · Un solo campo abierto a la vez, y qué pasa con el resalte de selección

Con Navegar apagado, el listener de clic YA existente (`EditorPuenteVivo.tsx:136-149`) decide hoy "abrir
la sección en la lista" para CUALQUIER clic dentro de `[data-editor-seccion]`. Con el campo flotante
agregado, la regla se refina: si el clic cae dentro de un `[data-editor-campo]`, en vez de (o además de)
mandar `seccion-click`, se abre el overlay de ESE campo Y se manda `seccion-click` igual (para que la
lista también se abra y muestre el resto de los campos de esa sección, como hoy) — un clic en el hero
sigue abriendo "Portada" en la lista, y AHORA ADEMÁS deja escribir ahí mismo. Sólo un overlay puede
estar activo a la vez (clic en otro campo cierra el anterior, comiteando su valor).

---

## 3 · Guardado

**Reusa el borrador → publicar de hoy, sin un segundo mecanismo.** El campo flotante escribe en el MISMO
`form` que la lista; el autoguardado (debounce 1000ms, `lib/autoguardado.ts`) persiste exactamente igual
que si se hubiera tecleado en el input de la lista — "al salir del campo, con pausa" ya es su
comportamiento actual, y no cambia.

- **Cuándo se guarda:** el mismo ciclo de siempre — se escribe en memoria en cada tecla (vía el puente,
  2.4–5ms, sin red), y el PUT a `/api/site-content` sale 1000ms después de la ÚLTIMA tecla (el debounce
  del coordinador de autoguardado, no uno nuevo por campo).
- **Deshacer:** dos niveles, ninguno nuevo. Dentro del campo —undo nativo del navegador (es un
  `<input>`/`<textarea>` real, § 2.2—; de la sección completa —"Descartar", que revierte el borrador
  entero a lo publicado, como hoy—.
- **Sesión vencida (§ 4.6 de `DISENO.md`):** se reusa el MISMO mensaje (`MSG_SESION_VENCIDA`,
  `esSesionVencida`) para el 401 del PUT de autoguardado — sin cambio sobre lo ya diseñado ahí. **Lo que
  SÍ es nuevo:** mientras el dueño teclea DENTRO del iframe, su atención no está en el panel — el banner
  de sesión vencida que `DISENO.md` § 4.6 ya diseñó para el panel puede pasar inadvertido. Se recomienda
  que el overlay MISMO muestre un aviso inline corto (reusando el mismo texto) si su valor no pudo
  guardarse por 401 — la misma doctrina de `CLAUDE.md` § Toast = éxito, inline = error, aplicada donde
  está la atención real del operador, no donde el mecanismo viejo asumía que estaría.

---

## 4 · Imágenes

**Sí, un clic en una imagen marcada abre el selector de archivo — pero el selector sigue siendo el del
panel, no uno nuevo dentro del iframe.** La subida (`useSubidaImagen`, Blob directo, progreso, tope de
tamaño) vive ENTERA en `TiendaSeccionEditor`/la lista lateral; duplicarla dentro del iframe sería una
segunda implementación del mismo mecanismo — la clase de problema que todo este programa (§ 0 de
`DISENO.md`) existe para evitar.

- Un nodo `<img>`/fondo marcado `data-editor-campo="hero.imagen"` (mismo atributo que el texto, sin
  distinción de tipo en el marcador — el panel ya sabe por el REGISTRY si ese campo es imagen) intercepta
  el clic igual que un campo de texto, pero en vez de montar un `<input>` manda un mensaje nuevo
  (`TIPO_MENSAJE_CAMPO_IMAGEN_CLICK`) al panel.
- El panel abre la SECCIÓN en la lista (igual que `seccion-click`) y dispara programáticamente el MISMO
  `<input type="file">` oculto que el control "Cambiar imagen" de esa sección ya monta — el dueño ve el
  selector de archivos del sistema operativo, exactamente como si hubiera clickeado el botón en la lista.
- La subida corre por el camino de SIEMPRE; cuando termina, la URL nueva llega al iframe por el MISMO
  ciclo panel→iframe que ya sincroniza texto — no hace falta nada nuevo del lado del iframe más allá del
  marcador y el mensaje de clic.
- **Mientras sube**, el nodo real de la imagen (dentro del iframe) no cambia hasta que el ciclo
  panel→iframe le entregue la URL nueva — el "Subiendo…"/progreso vive en la lista, como hoy; el iframe
  no necesita su propio indicador.

---

## 5 · Fuera de alcance explícito

- **El precio, de cualquier origen** (§ 9.1 del owner: "No agreguemos lo de poder cambiar el precio del
  producto desde el editor"). Se extiende, por consistencia, a `precio1..4` de `suscripcionPlanes`
  (§ 1.3): aunque técnicamente ES `SiteContent` (texto libre), la decisión del owner no distinguió
  precio-de-producto de precio-de-plan, y tratarlos distinto sin pedirlo sería inferir una excepción que
  nadie pidió.
- **El catálogo** (nombre/descripción/notas de cata de un `Product`): sigue siendo de `/admin/productos`,
  nunca de este editor — no hay campo de `SiteContent` que tocar ahí (§ 1.4).
- **Reordenar** (fila 6 de § 6 de `DISENO.md`, `EDITOR-TIENDA-ORDEN-1`): sigue siendo su propio slice,
  sin relación con edición de texto.
- **Nav y pie** (`content.menu`/`content.footer`): quedan FUERA de este diseño por alcance — no porque
  el mecanismo no aplicara (sí aplicaría, son `SiteContent` como cualquier otra sección), sino porque hoy
  viven fuera de `SECCIONES_TIENDA`/el iframe por completo (§ 1.4, § 1.1 de `DISENO.md`: "cromo
  transversal… sin vista previa en vivo"). Extender la selección en contexto Y la edición directa a esas
  dos secciones es una decisión aparte, con su propio costo (tocarían `StoreNav.tsx`/`StoreFooter.tsx`,
  que hoy tampoco saben que están en modo editor) — se nombra acá para que no se asuma incluido.
- **Las TRES insignias de `trustBadges`** y el texto "Desliza": sin campo que editar — ampliarlos a dato
  es, en sí, otra decisión de producto (§ 1.4), no una pieza de este mecanismo.
- **Campos selector/pointer** (categoría, destino de CTA, producto, plan destacado): siguen editándose
  SOLO por el combobox de la lista — un clic en esos nodos abre la sección en la lista (como hoy), nunca
  un overlay de texto.

---

## 6 · Riesgos, y plan por slices

### 6.1 · Nayoli y el tráfico público — byte-idéntico

Igual que todo lo de este programa: `useModoEditorActivo()` en `false` (el 99.99% del tráfico) hace que
`<CampoEditable>` devuelva `children` sin envoltorio — el mismo contrato que ya cumple
`data-editor-seccion` (§ 12.3/14.6 de `DISENO.md`: `verificar:nayoli:visual`/`guarda:color` en 0px salvo
el piso ya heredado). Cada slice de este plan se verifica con el MISMO arnés, sobre las rutas que toca.

### 6.2 · Seguridad del modo editor

**Sin cambios de superficie.** El gate sigue siendo el mismo (`modoEditorActivo()`, sesión OWNER/MANAGER
server-side, § 5.2/§ 11 de `DISENO.md`) — este diseño no agrega una puerta nueva, sólo más mensajes sobre
el MISMO canal `postMessage` mismo-origen ya gateado. El único riesgo nuevo y real: **un campo flotante
mal saneado podría ser el primer sitio del repo donde contenido tecleado por el dueño viaja de vuelta al
DOM sin pasar por un `<input>` controlado de React** — se cierra por diseño (§ 2.2: el overlay ES un
`<input>`/`<textarea>` real, nunca `contentEditable`, así que no hay HTML que sanear: el valor siempre
es `event.target.value`, un string plano).

### 6.3 · El modo de falla si una variante queda sin instrumentar

Medido en § 2.2: 5 secciones con variantes, hasta 4 implementaciones del mismo campo. Si un slice marca
`hero.titulo` sólo en `HeroCurtina` y CORTE usa `HeroMedia`, el síntoma es **silencioso** — el clic en ese
título simplemente no abre nada (cae al comportamiento de "clic fuera de cualquier marcador", § 14.1 de
`DISENO.md`: se frena, no pasa nada). No es un crash, es una capacidad que parece no estar — el
checklist de verificación de cada slice (§ 6.4) debe probar TODAS las variantes activas en el preset que
se esté verificando, no sólo la canónica.

### 6.4 · Plan por slices

Cada fila toca `app/(storefront)/` y/o `components/storefront/` — Tier 1, sesión OBSERVED primero, visto
bueno del owner, después el slice de escritura (igual que todo lo demás de `DISENO.md` § 6).

| # | Slice | Alcance | Criterio de verificación por ejecución |
| --- | --- | --- | --- |
| 1 | `EDITOR-TIENDA-CAMPO-EDITABLE-1` **— ENTREGADO, alcance AMPLIADO por encargo del owner, § 8** | La plomería: `ModoEditorProvider`/`useModoEditorActivo()`, el componente `CampoEditable`, el TERCER mensaje del puente (`TIPO_MENSAJE_CAMPO_CAMBIO`) y su manejo en `EditorPuenteVivo`/el panel. **El campo flotante YA SE CONSTRUYÓ en este slice** (no se dejó para el 2: el spec de esta tanda lo pidió completo, § 8) — overlay posicionado/tipografiado desde el nodo real, un solo campo abierto a la vez, Escape/Tab/clic-afuera cierran, Enter commitea en campo de una línea. SIN aplicarlo a ninguna sección real todavía (verificado con dos nodos de ARNÉS inyectados a mano, § 8). | `npm run gate` verde; `verificar:nayoli:visual`/`guarda:color` sin un píxel nuevo; verificado por ejecución (Playwright, sesión real, Escritorio y Teléfono) — ver § 8. |
| 2 | `EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1` **— ENTREGADO, § 9** | Instrumenta **las 4 variantes** de `hero` (Curtina/Ficha/Media/MarquesinaSticky) — el caso con más multiplicidad, primero, para medir el costo real antes de comprometerse al resto. Incluye la MEDICIÓN de legibilidad pendiente (§ 2.2) en los tres anchos de dispositivo. | Verificado por ejecución, sesión real, preset CORTE (que usa variantes no-canónicas): clic en título/subtítulo/CTA en CADA una de las 4 variantes abre el overlay correcto; capturas en Escritorio/Tablet/Teléfono confirmando legibilidad; el campo duplicado de `marquesina`/`HeroMediaMarquesina` NO diverge tras tipear (ambas copias muestran el valor nuevo) — ver § 9. |
| 3 | `EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1` **— ENTREGADO, § 10** | El mensaje/flujo de imagen (§ 4): clic en una imagen marcada abre el selector real del panel. | Clic en `hero.imagen` dentro del iframe abre el picker de archivos del sistema; la subida y el resultado se ven sin recargar, igual que hoy desde la lista. |
| 4 | `EDITOR-TIENDA-CAMPO-EDITABLE-RESTO-1..N` **— ENTREGADO salvo `suscripcionFaq`, § 10 (home) y § 11 (/nosotros, /suscripciones)** | El resto de home/nosotros/suscripciones, UNA o pocas secciones por slice (brandStory, origen, presentaciones×3 variantes, subscriptionCTA×2, testimonials+repeater, spotlight, nosotrosHistoria, nosotrosGaleria+repeater, nosotrosCierre, suscripcionPlanes, suscripcionPasos, suscripcionFaq+repeater) — el orden y el agrupado los decide quien planifique la implementación, no este documento. `suscripcionFaq` queda SIN tocar: vive en `PreguntasFrecuentes.tsx`, compartido con `/preguntas-frecuentes` y `/tienda`, fuera de `touches:` de `EDITOR-TIENDA-CAMPO-EDITABLE-PAGINAS-1` — necesita su propio slice. | Mismo patrón que el slice 2, por sección: todas sus variantes, todos sus campos de texto libre, `verificar:nayoli:visual` sin píxel nuevo — ver § 10/§ 11. |
| 5 | `EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1` **— ENTREGADO, § 12** | El aviso inline de sesión vencida DENTRO del overlay (§ 3). | Reproducido por ejecución: sesión invalidada a mitad de edición → el overlay muestra el aviso, el panel sigue mostrando el suyo, ninguno de los dos pierde el valor ya tecleado. |

**Nav/pie (§ 5) y reordenar (fila 6 de `DISENO.md` § 6) quedan fuera de este plan**, con su propio
disparador si algún día se deciden.

---

## 7 · Preguntas para el owner

1. **¿El plan por slices de § 6.4 es el orden correcto, o preferís un alcance distinto para el primer
   slice de verdad (más allá de la plomería)?** Recomiendo empezar por `hero` (slice 2) porque es la
   sección con MÁS variantes (4) — mide el costo real de instrumentar una sección antes de comprometer
   el resto del plan, y es la sección que el dueño va a tocar primero en casi cualquier sesión de
   edición.
2. **¿Los campos selector/pointer (categoría, destino de CTA, producto, plan destacado) deben, al
   clickearse dentro del iframe, abrir la sección en la lista (como cualquier otro clic, comportamiento
   de hoy) o quedar completamente INERTES (ni siquiera abren la lista)?** Recomiendo que abran la
   sección en la lista — es el comportamiento que YA existe (§ 14 de `DISENO.md`) y no inventa una
   tercera categoría de clic; sólo los campos de TEXTO libre ganan el overlay encima.
3. **¿Nav y pie entran en el alcance de "editor inline" en algún momento, o se quedan permanentemente
   en su formulario aparte (`MenuSeccion`/`FooterSeccion`)?** No bloquea nada de § 6.4 (son
   independientes), pero cambia si vale la pena diseñar `CampoEditable` pensando en que algún día lo
   consuma `StoreNav.tsx`/`StoreFooter.tsx` también. Sin una respuesta, este diseño asume que NO, por
   ahora (§ 5).

---

**Línea agregada a § 9.1 de `DISENO.md`** (ver el diff de ese archivo): el párrafo "La edición de texto
DIRECTO sobre la página es diseño NUEVO, pendiente" ahora cierra con *"— diseñado en
`docs/editor-tienda/EDICION-INLINE.md` (`EDITOR-TIENDA-EDICION-INLINE-DISENO-1`); sigue sin construirse,
y sigue necesitando su propia aprobación de escritura."*

---

## 8 · Lo que `EDITOR-TIENDA-CAMPO-EDITABLE-1` entregó, y las respuestas de § 7

Aprobado por el owner el 2026-10-02 con las recomendaciones de este mismo documento: empezar por
`hero` (pregunta 1, § 7 — pero DIFERIDO a `EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1`, fila 2, sin tocar en
este slice); los campos selector/pointer abren la sección en la lista, nunca inertes (pregunta 2, § 7
— sin cambio de código en ESTE slice: ningún campo selector lleva `CampoEditable` todavía, así que la
respuesta rige para cuando la fila 2+ los toque); nav y pie quedan FUERA (pregunta 3, § 7 — confirmado,
sin cambio sobre lo ya escrito en § 5).

**El spec de este slice AMPLIÓ el alcance de la fila 1 de § 6.4**: donde la fila decía "sin overlay
todavía — sólo marca el nodo", el encargo pidió el campo flotante COMPLETO en este mismo slice —
"the final version got to look like the one from Shopify but with roids" (el pedido del owner que
autorizó esta tanda). Lo entregado, contra lo planeado:

- **`ModoEditorProvider`/`useModoEditorActivo()`** (`components/storefront/ModoEditor.tsx`): hermano
  de `SiteContentProvider`, montado en `app/(storefront)/layout.tsx` con el MISMO `enModoEditor` que
  ya recibe `EditorPuenteVivo`. Tal como planeaba la fila 1.
- **`CampoEditable`** (`components/storefront/CampoEditable.tsx`): marca el nodo con
  `data-editor-campo`/`data-editor-linea` SÓLO en modo editor; fuera de él, `children` tal cual. Tal
  como planeaba la fila 1 — pero el MARCADOR no es lo único construido (ver el punto siguiente).
- **EL CAMPO FLOTANTE SE CONSTRUYÓ ACÁ, NO EN LA FILA 2.** Vive dentro de
  `EditorPuenteVivo.tsx` (§ 2.2 de este documento ya anticipaba que podía vivir "en `EditorPuenteVivo`
  o un componente suyo" — terminó siendo DENTRO del mismo archivo, un sub-árbol JSX portaleado con
  `createPortal`, no un componente separado, porque `touches:` de este slice no nombraba un archivo
  nuevo para eso). Mecánica, verificada por ejecución (§ abajo): clic en un nodo marcado (Navegar
  apagado) mide `getBoundingClientRect()`/`getComputedStyle()` DEL NODO REAL y monta un
  `<input>`/`<textarea>` con la MISMA geometría/tipografía (`estiloCampoFlotante`, puro,
  `lib/storefront/campo-editable.ts`); el nodo real pasa a `visibility:hidden` (conserva su layout);
  un solo campo abierto a la vez (abrir OTRO cierra el anterior, restaurando su `visibility`); Escape/
  Tab/clic-afuera cierran sin preguntar (cada tecla YA viajó por el puente, así que no hay nada que
  "descartar"); Enter commitea y cierra en un campo de una línea, inserta salto en uno multilínea.
  Pegar es SIEMPRE texto plano, GRATIS, por ser un `<input>`/`<textarea>` real (nunca
  `contentEditable`) — no hizo falta código para esto, confirma lo que § 2.2 ya preveía.
- **El tercer mensaje** (`TIPO_MENSAJE_CAMPO_CAMBIO`, `lib/storefront/editor-puente.ts`): manda
  `{seccion, campo, valor}` en CADA tecla, sin debounce propio. `VistaTiendaIframe.tsx` lo reenvía a
  `TiendaPaginas.tsx` (misma resolución de marcador que ya usa la selección en contexto,
  `seccionDesdeMarcador`), que llama a `TiendaSeccionEditorHandle.escribirCampo(campo, valor)` — NUEVO
  en el handle, junto a `seleccionar()` — que abre la sección si estaba cerrada y aplica el MISMO
  `cambiar()` que ya usa el `onChange` de la lista, con el parcial que arma `fusionCampoEditable`
  (soporta campo plano Y de ítem de repeater, aunque ningún repeater lo use todavía). El ciclo
  panel→iframe de `EDITOR-TIENDA-POSTMESSAGE-1` hace el resto: la validación zod contra el schema de
  guardado ocurre ahí, SIN código nuevo — un campo que el schema no conoce se STRIPEA al volver
  (comportamiento ya existente de `z.object()`, § CLAUDE.md), nunca se construyó una validación
  aparte para esto.
- **"El precio se ignora"**: no hay código que lo decida — es una consecuencia de que NINGÚN campo de
  precio lleva `CampoEditable` todavía (no hay secciones instrumentadas). La exclusión sigue siendo
  disciplina de la fila 2+, tal como § 5 ya la declara.
- **SIN aplicarlo a ninguna sección real**: ni `HeroSection` ni ningún otro componente de
  `components/storefront/home|nosotros|suscripciones` importa `CampoEditable`. Verificado por grep
  (cero resultados) y por ejecución: la home pública (sin `?editor=1`) no lleva un solo
  `[data-editor-campo]` en su HTML.

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

Arnés ad-hoc en `.scratch/verificar-campo-editable.ts` (no committed): como ninguna sección real usa
`CampoEditable` todavía, el arnés INYECTA dos nodos de prueba (`data-editor-campo="hero.eyebrow"` /
`"hero.titulo"`) dentro de `[data-editor-seccion="hero"]` — un ancla real que SIEMPRE existe
(`ocultable:false`) — y ejercita el mecanismo DOM-puro de `EditorPuenteVivo` sobre ellos, sin tocar
código de producto. **14/14 verificaciones en verde**, en Escritorio (1280) y Teléfono (393, el ancho
LITERAL de `EDITOR-TIENDA-DISPOSITIVOS-1`):

| verificación | resultado |
| --- | --- |
| fuera de modo editor, la home no lleva `[data-editor-campo]` | 0 nodos |
| clic en el nodo de prueba abre el overlay (`[data-editor-overlay="hero.eyebrow"]`) | 1 overlay |
| el nodo real pasa a `visibility:hidden` mientras edita | `hidden` |
| el overlay alinea al píxel con el nodo real (medido DENTRO del iframe, Escritorio) | Δtop/Δleft/Δwidth/Δheight = 0.00px |
| el panel abre "hero" en la lista (antes cerrada) | `#hero-eyebrow` aparece |
| tipear en el overlay llega al input `#hero-eyebrow` del panel, sin recargar el iframe | valor idéntico |
| clic en OTRO nodo marcado cierra el anterior (restaura `visibility`) y abre el nuevo | viejo=0, nuevo=1 |
| Escape cierra el overlay y restaura la visibilidad | 0 overlays, `visibility=""` |
| MISMO mecanismo en Teléfono (393px literal) — overlay alineado al píxel | Δ = 0.00px |

**HALLAZGO DE MÉTODO, del propio arnés (no del mecanismo):** el primer intento midió el overlay con
`locator(...).boundingBox()` de Playwright (coordenadas de la PÁGINA de arriba, atravesando el
`transform:scale()` del stage de dispositivo) contra el nodo medido con `getBoundingClientRect()`
DENTRO del iframe (sin escalar) — dio un Δ de cientos de píxeles que parecía un defecto de
alineación. Era comparar dos sistemas de coordenadas distintos, no un bug del overlay: medido
DENTRO del iframe para los dos lados, el Δ es exactamente 0.00px. Corregido antes de reportar nada
como verde.

### Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3200/3200** (+20 sobre los 3180 previos: 13 de `campo-editable.test.ts`, 6 de los casos nuevos de `editor-puente.test.ts`, 1 de `editor-iframe.test.ts`) |
| `npm run test:integracion` | **308/308**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run guarda:color` / `npm run verificar:nayoli:visual` | MISMA cifra exacta que el piso ya heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) — cero píxeles de drift nuevo |

**Cierra la fila 1 de § 6.4 (`EDITOR-TIENDA-CAMPO-EDITABLE-1`).**

---

## 9 · Lo que `EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1` entregó

Instrumentó las CUATRO variantes del hero (Curtina/Ficha/Media/MarquesinaSticky, `HeroSection.tsx`) y la
banda suelta `Marquesina.tsx` (comparte el campo `marquesina.texto` con la composición "sticky", § 2.2
punto 1) con `CampoEditable`, sin tocar la plomería que `EDITOR-TIENDA-CAMPO-EDITABLE-1` ya construyó
(`ModoEditorProvider`, el componente, el overlay dentro de `EditorPuenteVivo.tsx`, el tercer mensaje):
cada JSX que escribía `{hero.titulo}` pasó a `<CampoEditable campo="hero.titulo">{hero.titulo}</CampoEditable>`,
sin cambiar un solo `className`.

- **Los SEIS campos comunes** (eyebrow/titulo/tituloEnfasis/subtitulo/los dos CTA) se marcaron en las
  TRES variantes que los comparten (Curtina/Ficha/Media), cada uno con la `multilinea` que declara
  `tienda-secciones.ts` (`subtitulo`:`multiple`, el resto `unica`).
- **`hero.fraseAlPie`** se marcó SÓLO en Media y en la composición "sticky" (`HeroMediaMarquesina.tsx`)
  — Curtina/Ficha no lo leen (§ 1.1), y no se le agregó un marcador que nunca tendría efecto.
- **El campo DUPLICADO** (`marquesina.texto`, dos `<span>` por el loop sin costura, EN CADA una de las
  DOS composiciones que lo leen — `Marquesina.tsx` y `HeroMediaMarquesina.tsx`): sólo el PRIMER `<span>`
  de cada composición lleva el marcador; el gemelo se actualiza solo, desde el mismo `useSiteContent()`
  — ningún caso especial de sincronización, tal como anticipaba § 2.2.
- **Los campos selector/pointer** (`puntoFocal`, `veloIntensidad`, `tickerVelocidad`) NO se tocaron —
  siguen abriendo sólo la sección en la lista, como pregunta la § 7.2 ya resuelta por la fila 1.
- **El precio** sigue sin campo que lo toque — no hay precio en el hero.

### Deviación MEDIDA sobre el propio spec: "preset CORTE" NO cubre las 4 variantes

El criterio de verificación de § 6.4 decía *"preset CORTE (que usa variantes no-canónicas)"*, dando a
entender que un preset bastaba para ejercitar lo necesario. **Medido contra `lib/config/themes.ts`,
no asumido**: CORTE fija `hero:'sticky'`; NINGÚN preset del catálogo fija `'ficha'` ni `'media'` —
Nayoli/sin-preset usa la canónica `'curtina'`. Dos de las cuatro variantes nunca se habían renderizado
contra un navegador real antes de este slice. Se fijó `hero.variante` (y, para media/sticky,
`hero.fraseAlPie`/`marquesina.visible`) DIRECTO en la fila `SiteContent` de una base efímera (un script
de una línea, no un preset) para poder verificar las cuatro en una sola sesión.

### DOS HALLAZGOS DE MÉTODO DEL ARNÉS (no del mecanismo) — para que el próximo arnés de este puente no los repita

1. **El dispositivo elegido se RECUERDA en `localStorage`, por navegador** (`lib/admin/editor-iframe.ts`,
   `CLAVE_DISPOSITIVO_EDITOR`) — una navegación fresca (`page.goto('/editor/tienda')`) NO lo resetea a
   Escritorio, hereda lo último elegido EN ESE MISMO navegador. El primer intento de este arnés asumía
   el reset (como el arnés de la fila 1, que nunca cambiaba de dispositivo dentro de la misma sesión);
   dejar una fase en Teléfono y entrar a la siguiente asumiendo Escritorio hizo que "ficha·Escritorio"
   corriera en realidad a 393px, y el `eyebrow` cayó bajo el `StoreNav` (`position:fixed`, z-50) —
   parecía un defecto de layout de `ficha`, y era el arnés probando el ancho equivocado. Se corrigió
   fijando Escritorio EXPLÍCITO al entrar a cada fase, nunca asumiendo el default.
2. **El autoguardado snapshotea el FORM COMPLETO de la sección, no un delta por campo** — cada tecla
   persiste el `hero` ENTERO en `content.borrador.hero`, y ese borrador sin publicar le gana a una
   escritura DIRECTA a `content.hero` (la que este arnés usa para cambiar de variante) en la lectura
   fusionada del editor. Encadenar fases SIN publicar entre medio dejaba la variante/frase nueva
   enmascaradas por el borrador viejo de la fase anterior — 4 fallos en el primer intento completo
   (`hero.fraseAlPie` ausente en media, el conteo de marcadores del ticker en 1 en vez de 2 bajo
   sticky). Se corrigió publicando la sección abierta al final de cada fase, antes de la siguiente
   escritura directa. Ninguno de los dos hallazgos tocó código de producto — los dos eran supuestos
   del arnés sobre un mecanismo (persistencia de dispositivo, forma del borrador) que ya se comportaba
   así desde slices anteriores.

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

Arnés `.scratch/verificar-campo-editable-hero.ts` (no committed, gitignored), cuatro fases contra una
build de PRODUCCIÓN (`next build` + `next start`) con sesión real (`admin@sierranativa.co`):
Curtina (default del seed) → Ficha → Media → Sticky (preset CORTE + `marquesina.visible:true` a
propósito, para ejercitar las DOS composiciones de `marquesina.texto` en la misma carga). **96/96
verificaciones en verde**, tras corregir los dos hallazgos de método de arriba:

| verificación (por variante × dispositivo) | resultado |
| --- | --- |
| existe el nodo `[data-editor-campo="hero.X"]` para cada campo aplicable | sí, en las 4 variantes |
| clic abre su `[data-editor-overlay="hero.X"]` | 1, siempre |
| overlay alineado al píxel con el nodo real, medido DENTRO del iframe | Δtop/Δleft/Δwidth = 0.00px en Escritorio/Tablet/Teléfono, las 4 variantes |
| ticker duplicado (`marquesina.texto`): DOS marcadores en la página (uno por composición), editar desde CUALQUIERA actualiza las 4 copias visibles | count=2; antes=4 ocurrencias del texto viejo, después=4 del nuevo — 0 divergencia |
| Publicar → releer en una pestaña nueva, SIN sesión, SIN `?editor=1` | el nuevo `hero.titulo` aparece en la home pública |
| fuera de modo editor, la home pública | 0 `data-editor-campo` |

**Legibilidad (la medición pendiente de § 2.2) — confirmada por inspección visual, 8 capturas
representativas de las 27 que el arnés guardó** (`.scratch/capturas-campo-editable-hero/`, no
committed): el overlay vive DENTRO del mismo documento/stage que el texto real que reemplaza, así que
hereda el MISMO `transform:scale()` que el stage le aplica al dispositivo elegido (medido: el recorte
de Escritorio sale a ~0.47× el tamaño lógico que reporta `getBoundingClientRect()`, Tablet a ~0.79×,
Teléfono sin reducir) — el overlay nunca es MÁS NI MENOS legible que el texto que tapa, porque los dos
escalan juntos. Las 8 capturas inspeccionadas (titulo y subtitulo de Curtina en Escritorio, titulo de
Curtina/Ficha en Tablet/Teléfono, fraseAlPie de Media, el ticker de Sticky en Tablet/Teléfono) muestran
texto nítido y legible en los tres anchos — ningún caso de texto cortado, solapado o ilegible.

### Gate

| capa | resultado |
| --- | --- |
| `npm run gate` (`tsc --noEmit` + `npm test` + `npm run test:integracion`) | GREEN |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3214/3214** (+14 sobre los 3200 previos: 8 en `lib/storefront/campo-editable.test.ts` — render de las 3 variantes sin ticker, curtina/ficha/media —, 6 en `lib/config/hero-marquesina.test.ts` — sticky + `Marquesina.tsx`) |
| `npm run test:integracion` | **308/308**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run guarda:color` / `npm run verificar:nayoli:visual` | MISMA cifra exacta que el piso ya heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) — cero píxeles de drift nuevo |

**Cierra la fila 2 de § 6.4 (`EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1`).**

---

## 10 · Lo que `EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1` entregó

El flujo de § 4: clic en una imagen o video marcado dentro del iframe abre el selector de archivos
REAL del panel (nunca uno propio del iframe), la subida corre por el camino de siempre
(`useSubidaImagen`, Blob directo), y el resultado se ve en el iframe SIN RECARGAR — el mismo ciclo
`onCambio` → `enviarCambioIframe` → `postMessage` → `fusionarContenidoSeccion` que ya movía el
campo de TEXTO (§ 8/§ 9), ahora disparado por una subida en vez de un tecleo.

- **Cuarto mensaje del puente** (`TIPO_MENSAJE_CAMPO_IMAGEN_CLICK`, `lib/storefront/editor-
  puente.ts`): iframe→panel, `{seccion, campo}`, SIN `valor` — una imagen nunca se edita tecleando.
- **Un marcador DOM PROPIO** (`ATRIBUTO_EDITOR_CAMPO_IMAGEN = 'data-editor-campo-imagen'`,
  `lib/storefront/campo-editable.ts`), DISTINTO de `ATRIBUTO_EDITOR_CAMPO` (el de texto) — a
  propósito, y NO lo que § 4 de este documento recomendaba ("mismo atributo que el texto, el panel
  decide por el REGISTRY"): esa recomendación habría obligado a `EditorPuenteVivo.tsx` a resolver
  tipos contra el REGISTRY en cada clic; un atributo propio deja que CAMPOEDITABLE declare su tipo
  una sola vez, en el punto donde ya se sabe (`tipo="imagen"` en el JSX de la sección), y que el
  puente sólo mire CUÁL de los dos atributos matchea — más simple, afirmable en capa 1 sin tocar el
  REGISTRY. Documentado como la decisión de implementación que es, no como una desviación del
  REQUERIMIENTO (el spec de esta tanda no prescribía el mecanismo interno).
- **`CampoEditable` gana `tipo?: 'texto'|'imagen'`** (default `'texto'`, sin tocar ningún call site
  existente). Para `'imagen'` envuelve con `<span style="display:contents">` — NUNCA el `<span>`
  inline del texto: `display:contents` es invisible para el LAYOUT (imprescindible para no romper
  el `fill` de `<Image>`/el `absolute inset-0` del `<video>`, que exigen que su padre tenga
  `position`/`display:block`) pero sigue siendo un ancestro válido para `closest()` en el click
  handler — el mismo patrón que `.puente-tarjetas` (`display:contents`) ya usaba para lo mismo.
- **`EditorPuenteVivo.tsx`**: el click handler revisa `[data-editor-campo-imagen]` ANTES de
  `[data-editor-campo]` — un campo-imagen nunca abre el overlay de texto (y cierra uno que hubiera
  quedado abierto). El `seccion-click` se sigue mandando igual, así que la sección también se abre
  en la lista — comportamiento ya resuelto por la fila 1, sin tocar.
- **`TiendaSeccionEditorHandle` gana `abrirSelectorImagen(campo)`** (`TiendaSeccionEditor.tsx`): abre
  la sección si estaba cerrada (como `escribirCampo`) y dispara el MISMO flujo de subida que el
  control equivalente de la lista — nunca un selector propio. Para el HERO, el campo Y el modo
  actual (imagen/video) deciden cuál flujo (`ponerImagen`/`agregarVideoHero`/`agregarVideoMovilHero`
  — los MISMOS que ya usan los botones "Cambiar"/"Cambiar video" de `renderMediaHero`); cualquier
  otra sección cae al genérico `ponerImagen(campo)`, dejando el mecanismo listo para la fila 4 sin
  más cambios acá.
- **El disparo se DIFIERE un render si la sección estaba cerrada** (`campoImagenPendienteRef` +
  `useEffect` sobre `editando`): el `<input type="file">` oculto que `ponerImagen`/`agregarVideoHero`
  disparan sólo existe en el DOM dentro de la rama de EDICIÓN de la cáscara — llamarlo en el MISMO
  tick que `abrirEdicion()` apuntaría a un ref todavía `null`. Mismo principio que
  `desplazarPendienteRef` ya usa para "seleccionar" (dos pasos: abrir, y en el render siguiente,
  actuar).
- **`TiendaPaginas.tsx` gana su PROPIO listener de `window.addEventListener('message', …)`**
  para este mensaje — a diferencia de los otros tres, que `VistaTiendaIframe.tsx` centraliza y
  reenvía por props. `VistaTiendaIframe.tsx` NO está en `touches:` de este slice, así que extenderlo
  habría sido ensanchar el alcance; el mensaje llega igual porque `window.postMessage` desde el
  iframe se dispara contra `window.parent` — el MISMO objeto `window` donde vive `TiendaPaginas`,
  no algo privado de `VistaTiendaIframe` — así que un segundo listener independiente lo recibe sin
  tocar ese archivo. Mismo chequeo de origen que el resto del puente; sin comparar `e.source` contra
  el iframe real porque este componente no tiene esa referencia (sólo el handle imperativo de
  `VistaTiendaIframe`, que no expone el nodo DOM) — el chequeo de origen ya es la verificación que
  la doctrina del puente exige.

### DEVIACIÓN MEDIDA, encontrada construyendo (no en el spec): el velo del hero interceptaba el clic

Las CUATRO variantes pintan un overlay decorativo ("el velo", un degradado) ENCIMA del medio
(`<Image>`/`<video>`), en el MISMO `absolute inset-0` de su contenedor, DESPUÉS en el DOM. Sin
`pointer-events-none`, el navegador le entrega el hit-test al velo —el ÚLTIMO en pintar, en la
misma caja—, nunca al medio que está debajo: un clic en "la imagen" nunca llegaba al marcador de
`CampoEditable`. Medido por ejecución (Playwright): el primer intento no producía NI SIQUIERA
`seccion-click` (que no depende de nada nuevo de este slice) al clickear sobre el hero. Se corrigió
agregando `pointer-events-none` al velo en las TRES variantes que lo pintan (`HeroCurtina.tsx`,
`HeroMedia.tsx`, `HeroMediaMarquesina.tsx` — `HeroFicha.tsx` no tiene velo). Es neutro para un
visitante real: el velo nunca tuvo propósito interactivo, y de hecho esto CIERRA un defecto latente
—los controles nativos del `<video>` en reduced-motion (`controls={!!reduce}`) tampoco podían
recibir clics antes de este fix, sin que nadie lo hubiera notado—.

### DEVIACIÓN MEDIDA, encontrada construyendo: el póster NO puede ser un nodo clickeable aparte

El plan inicial (§ 4, y el primer intento de esta implementación) marcaba `hero.imagenPoster` como
un `<CampoEditable>` PROPIO sobre el `<picture>` del póster, separado del `<video>`, para el caso
`hayVideoMovil` (video de escritorio + video de teléfono, ambos configurados). **Medido por
ejecución que es físicamente imposible de alcanzar por clic**: el `<picture>` y el `<video>` son los
dos `absolute inset-0` en la MISMA caja, y el `<video>` SIEMPRE pinta encima (va después en el DOM)
— el navegador le entrega el hit-test al video, nunca al picture, en TODO punto de esa caja. Un
marcador de `hero.imagenPoster` ahí era un selector FANTASMA: existe en el DOM, inalcanzable por el
puntero (y Playwright lo habría rechazado con "element is covered" si se hubiera forzado el click
exacto sobre el `<img>`). El fix: UN SOLO `<CampoEditable campo="hero.imagen">` envolviendo el
FRAGMENTO completo (picture + video) — `CampoEditable` ya acepta cualquier `ReactNode` como
children, no sólo un elemento único, así que envolver un `<>…</>`  no pidió cambiar el componente.
La ambigüedad resultante (clic en esa caja siempre abre el flujo de ESCRITORIO, nunca el de
teléfono) es la misma que § 2.2 de este documento ya aceptaba por escrito para el `<video>` con
`<source media>` múltiples — no es nueva, sólo se confirma que también aplica al póster.

### DEVIACIÓN MEDIDA: `hero.imagenMovil`/`hero.imagenMovilPoster` NO ganan marcador propio

Consecuencia directa de la deviación anterior: como el `<picture>`/`<video>` del caso `hayVideoMovil`
comparten UN marcador (`hero.imagen`), no existe un nodo DOM separado al que atar
`hero.imagenMovil`/`hero.imagenMovilPoster`. Resolver esto por viewport (qué `<source media>` está
activo) exigiría JS de resolución de media query en el click handler — EXPLÍCITAMENTE fuera de
alcance, ya anotado en § 2.2: "dos `<source media>` en el mismo nodo no se pueden distinguir por
clic sin JS extra". El campo sigue siendo editable desde el formulario de la lista, como siempre; el
clic inline sólo alcanza `hero.imagen`/`hero.imagenPoster` (los dos en el caso `hayVideoMovil`,
fusionados en uno).

### HALLAZGOS DE MÉTODO DEL ARNÉS (no del mecanismo) — para que el próximo arnés de este puente no los repita

1. **`locator.click({ position })` dentro de un `<iframe>` cuyo ANCESTRO tiene `transform:scale()`
   (§ el stage de dispositivo, `EDITOR-TIENDA-DISPOSITIVOS-1`) no traduce el offset.** Medido: con
   `position` explícito el clic no llegaba a NINGÚN marcador — ni siquiera `seccion-click`, que no
   depende de nada nuevo de este slice. El click al CENTRO por DEFAULT (sin `position`, el que ya
   usaba la fila 1/2 para el campo de texto) sí llega. El fix del arnés: componer el punto a mano
   (rect del `<iframe>` en la página de arriba × la escala real) y clickear con `page.mouse.click`
   en coordenadas de PÁGINA, nunca de frame. No afecta a un visitante real —no hay Playwright de
   por medio—, y no afecta al click por defecto (sin `position`) que la fila 1/2 ya verificó.
2. **El medio llena TODO el hero y el texto se centra DENTRO del mismo hero** (`items-center`/
   `items-end`) — sus centros de masa casi siempre coinciden. Clickear "la imagen" en su centro
   (el default de Playwright) clickea en realidad el texto que pinta encima. El arnés clickea un
   punto lejos del bloque de texto (angosto, `max-w-xl/2xl`): extremo derecho, altura media.
3. **`display:contents` no tiene caja propia** — `getBoundingClientRect()` da 0×0×0×0, así que hay
   que medir/clickear el DESCENDIENTE con caja real (`<img>`/`<video>`), nunca el marcador
   `CampoEditable` mismo.

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

Arnés `.scratch/verificar-campo-editable-imagen.ts` (no committed, gitignored), contra una build de
PRODUCCIÓN (`next build` + `next start`) con sesión real (`admin@sierranativa.co`). **20/20
verificaciones en verde**:

| verificación | resultado |
| --- | --- |
| SANITY: el campo de texto (slice anterior) sigue abriendo su overlay | sí |
| MODO IMAGEN (curtina, default del seed): clic en `hero.imagen` dispara un `filechooser` REAL | sí |
| el `<input>` disparado acepta `ACCEPT_IMAGENES` ("image/jpeg,image/png,image/webp") | sí |
| el clic en la imagen NO abre ningún overlay de texto | 0 overlays |
| la sección "Portada" se abre sola (el input oculto sólo existe en edición) | sí |
| seleccionar un archivo REAL — subida completa a Vercel Blob | URL `*.public.blob.vercel-storage.com/dev/contenido/...` |
| la subida se ve SIN RECARGAR — el `<img>` del iframe cambia de `src` vía `postMessage` | sí, sin navegación |
| MODO VIDEO (fijado por SQL, `.scratch/set-hero-imagen.ts`): clic en `hero.imagen` dispara filechooser — "Cambiar video", no "Cambiar imagen" | sí |
| el `<input>` disparado acepta `ACCEPT_VIDEO` ("video/\*"), no el de imagen | sí |
| sin video de teléfono: NO hay marcador suelto `hero.imagenPoster` (vive en el atributo `poster=`) | 0 |
| MODO VIDEO + video de TELÉFONO: UN SOLO marcador `hero.imagen` cubre el PAR picture+video | sí |
| ese marcador dispara el flujo de VIDEO (ambigüedad desktop/móvil documentada) | `accept="video/*"` |
| `hero.imagenMovil` NO tiene marcador DOM propio (deviation confirmada) | 0 |
| fuera de modo editor, la home pública NO lleva `data-editor-campo-imagen` | 0 |

**Sobre Blob real:** este proceso de shell no tiene `BLOB_READ_WRITE_TOKEN` en su propio
`process.env` (confirmado sin inspeccionar ningún `.env*`, por instrucción del dispatch), pero
`next build`/`next start` cargan `.env` por su cuenta (Next.js lo hace siempre) — así que el
PROCESO HIJO (la build real) sí tuvo el token, y la verificación de MODO IMAGEN completó una subida
REAL a Vercel Blob (namespace `dev/`, aislado de producción por `envPrefijo`, § Storage de CLAUDE.md)
con propagación en vivo confirmada por el `postMessage` de tipo `editor-tienda:contenido-seccion`
trayendo la URL nueva. No fue necesario mockear nada del protocolo de Blob.

### Gate

| capa | resultado |
| --- | --- |
| `npm run gate` (`tsc --noEmit` + `npm test` + `npm run test:integracion`, UN comando, árbol final) | GREEN |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3232/3232** (+18 sobre los 3214 previos: 4 en `lib/storefront/editor-puente.test.ts` — `esMensajeCampoImagenClick` —, 14 en `lib/storefront/campo-editable.test.ts` — el marcador de imagen en las 4 variantes × 3 escenarios, más el caso picture+video fusionado) |
| `npm run test:integracion` | **308/308**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run guarda:color` | MISMA cifra exacta que el piso heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) |
| `npm run verificar:nayoli:visual` (main vs. rama, doble build) | MISMA cifra exacta que `guarda:color`, en las 8 claves |

**Cero píxeles de drift nuevo**: `CampoEditable` sigue devolviendo `children` sin envoltorio fuera de
modo editor (ahora en las dos ramas, texto e imagen); `pointer-events-none` en el velo no cambia un
solo píxel visible (es un degradado transparente de por sí); las cuatro variantes quedan
byte-idénticas fuera del iframe del editor, confirmado por el diff de píxeles (dos arneses
independientes, misma cifra heredada) y por el arnés de ejecución (0 `data-editor-campo-imagen` en
la home pública).

**Cierra la fila 3 de § 6.4 (`EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1`).**

---

## 11 · Lo que `EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1` entregó

Instrumentó el RESTO de la home — historia (columnas/centrada), el origen, presentaciones
(mosaico/índice/riel), el destacado, suscripción (bloque/línea), testimonios (con su repeater),
sellos de confianza y la marquesina suelta —, cerrando de una vez la fila 4 de § 6.4
(`EDITOR-TIENDA-CAMPO-EDITABLE-RESTO-1..N`), sin tocar la plomería (`ModoEditorProvider`,
`CampoEditable`, el overlay/mensajes del puente) que las filas 1-3 ya construyeron.

- **Patrón repetido 53 veces** (`grep -c "<CampoEditable campo=" components/storefront/home/*.tsx`,
  sumado; CUENTA SITIOS DE CÓDIGO, no campos de `SiteContent` — algunos cubren varios campos reales
  por slot/ítem, § abajo): cada JSX que escribía `{seccion.campo}` pasó a `<CampoEditable
  campo="seccion.campo">{seccion.campo}</CampoEditable>`, con `multilinea` siguiendo el
  `textarea:true`/`false` que ya declara `tienda-secciones.ts` por campo — sin inventar una segunda
  fuente de esa decisión.
- **Las tarjetas de cardinalidad variable (Presentaciones, los bullets de Suscripción) marcan por
  SLOT, no por posición visible** (`op.slot` / un `{slot,valor}` que sobrevive al `.filter()`): una
  tarjeta 3 vacía y una 4 llena deja a la 4ª como la segunda VISIBLE, y su campo editable sigue
  siendo `presentaciones.label4`, no `label2` — verificado en capa 1 con la config fuera-de-orden, y
  por ejecución en el harness de abajo.
- **TrustBadges NO gana ningún marcador** — censado contra el REGISTRY: la sección declara CERO
  campos de texto libre (`BADGES` es estructura de código, § su docstring); el único dato es el
  switch `visible`, que ya se edita por la lista.
- **Marquesina y FeaturedProducts no se tocan** (ya completos / dispatchers puros, respectivamente) —
  salvo un hueco real que SÍ se cerró: `marquesina.imagen` (el fondo) nunca había ganado su marcador
  de IMAGEN en `EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1` (esa fila sólo cubrió `marquesina.texto`). Se
  agrega acá.

### Los DOS casos especiales del documento (§ 2.2/2.3 de este archivo)

- **El contador de Origen** (`OrigenContador`, `Origen.tsx`): el campo flotante tiene que editar el
  STRING del dato (`origen.statNumeroN`), nunca el número a medio contar ni el formateado con
  separador de miles — `nodo.textContent` es lo que el overlay usa como valor inicial
  (`EditorPuenteVivo.abrirCampo`), y `Math.round(valorActual).toLocaleString("es-CO")` da "1.600"
  para un dato guardado como `"1600"`: cerrar el overlay sin tocar nada habría escrito "1.600" de
  vuelta, y `Number("1.600")` lo lee como `1.6`, no `1600` — corrompiendo el dato en el primer clic.
  Se resuelve con `useModoEditorActivo()` sumado a la condición de "no animar" de
  `useContadorAnimado` (igual que `preview`/movimiento reducido, sin tocar esa función) Y mostrando
  el `valor` CRUDO en vez del formateado mientras `editando` es `true`. Fuera de modo editor, cero
  cambio de comportamiento.
- **`TextoEnCascada`** (usado por Origen para eyebrow/título/párrafo): a diferencia del resto de la
  home, este componente toma `texto` como PROP, no `children` — no hay nodo de hijos que un
  consumidor externo pueda envolver con `<CampoEditable>`. Gana un `campo?`/`multilinea?` opcional
  propio: cuando se pasa, el marcador se monta DENTRO del `MotionEtiqueta` ya "asentado" (el
  elemento con la tipografía/geometría finales), nunca envolviendo desde afuera el fragmento que
  incluye el `<noscript>` de la red sin-JS. Sin `campo` (todo consumidor existente, hoy ninguno
  fuera de Origen), byte-idéntico.

### DEVIACIÓN MEDIDA, encontrada construyendo: la imagen VACÍA de una tarjeta siempre-visible no tenía NINGÚN nodo que clickear

El plan ingenuo —envolver `{op.img && <Image .../>}` con `<CampoEditable tipo="imagen">`— falla para
`GrindChooserMosaico`/`GrindChooserIndice`: **medido contra `DEFAULTS.presentaciones`, las tarjetas 1
y 2 (SIEMPRE visibles, nunca opcionales) nacen con `imagen1`/`imagen2` VACÍOS** — Nayoli hoy. Con el
marcador sólo alrededor del `<Image>` condicional, una imagen vacía no deja NINGÚN nodo en el DOM, y
el dueño no tendría cómo clickear para AGREGAR la primera foto desde la página — sólo podría hacerlo
desde el formulario de la lista, exactamente el estorbo que este programa existe para evitar.

El fix: el marcador envuelve un `<div className="absolute inset-0">` SIEMPRE presente (con el
`<Image>` condicional COMO SU HIJO, no como el hijo directo de `CampoEditable`) — ese `<div>` ocupa
el mismo hueco que ya pintaba `bg-[var(--sf-linea)]` del `<Link>` contenedor, inerte sin imagen, así
que no cambia un píxel visible; sólo gana área clickeable. Aplicado en `GrindChooserMosaico.tsx` y
`GrindChooserIndice.tsx` (las dos tarjetas 1-2, y las 3-4 cuando se agregan). **No aplicado** a
`brandStory.imagen2/3/4` ni a `subscriptionCTA.imagenFondo`: esos campos usan un `.filter()`
(`imagenesLlenas`) o un `&&` que, si está vacío, OMITE el bloque entero (no sólo la imagen) —
retrofitear el mismo patrón ahí tocaría la estructura condicional de la sección completa, no sólo la
imagen, y **Nayoli los tiene todos llenos** (ningún caso real que verificar hoy). Queda como
`CAMPO-EDITABLE-IMAGEN-SLOT-VACIO-OPCIONAL-1` en los open follow-ups de abajo.

### DEVIACIÓN MEDIDA, encontrada construyendo: el gradiente de GrindChooserMosaico se llevaba el clic de la imagen

Mismo defecto que ya cerró `EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1` para el velo del hero, en un
sitio nuevo: `GrindChooserMosaico.tsx` pinta un degradado (`absolute inset-0 bg-gradient-to-t…`)
ENCIMA del área de imagen, en la MISMA caja, sin `pointer-events-none`. Mientras no había nada
clickeable debajo no importaba; en cuanto el fix de arriba agregó un marcador de imagen SIEMPRE
presente debajo del degradado, el degradado se llevó el clic — medido por ejecución (el
`filechooser` nunca disparaba). Se agrega `pointer-events-none` al degradado. Neutro para un
visitante real (nunca tuvo propósito interactivo); `GrindChooserIndice` no tiene degradado
equivalente y no necesitó el mismo fix.

### Gate

| capa | resultado |
| --- | --- |
| `npm run gate` (`tsc --noEmit` + `npm test` + `npm run test:integracion`, UN comando, árbol final) | GREEN |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3281/3281** (+49 sobre el piso de 3232 que § 10 reportó al cerrar `EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1`) |
| `npm run test:integracion` | **308/308**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run guarda:color` | MISMA cifra exacta que el piso heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) |
| `npm run verificar:nayoli:visual` (main vs. rama, doble build) | MISMA cifra exacta que `guarda:color`, en las 8 claves |

**EL DELTA (+49) SE MIDE POR EJECUCIÓN AISLADA, NUNCA POR `grep -c '^test('` SOBRE EL SOURCE** —
una trampa de método que vale la pena nombrar porque se cayó en ella dos veces mientras se escribía
este asiento. `lib/storefront/campo-editable.test.ts` tiene, desde la fila 2 (HERO-1), varios tests
generados por `for (const … of ARRAY) { test(…) }` — un `grep` de `test(` cuenta SITIOS de llamada
en el código, no ejecuciones, y un sitio dentro de un `for` de 4 elementos corre 4 veces por una
sola línea de grep. El número correcto sale de `git show HEAD:… > temp.ts` (import corregido a ruta
relativa) + `node --import tsx --test temp.ts` sobre el HEAD de este slice (dio **35**, no los 15
que el grep de source sugería) contra el mismo comando sobre el archivo final (**84**) — delta real
**+49**, y `3232 + 49 = 3281` cierra EXACTO con el total medido abajo. El piso que § 10 dejó (3232)
era correcto desde el principio.

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

Arnés `.scratch/verificar-campo-editable-home.ts` (no committed, gitignored) + el helper genérico
`.scratch/set-content.ts` (merge por SECCIÓN sobre `SiteContent.content`, igual mecanismo que
`set-hero-imagen.ts`/`set-hero-variante.ts` de las filas 2-3, generalizado a cualquier sección en vez
de sólo `hero`), contra una build de PRODUCCIÓN (`next build` + `next start`) con sesión real
(`admin@sierranativa.co`). **42/42 verificaciones en verde**, en DOS configuraciones:

- **Nayoli, sin preset** (historia=columnas, presentaciones=mosaico, suscripción=bloque,
  destacado=apagado — encendiendo sólo `origen.visible` y cargando un testimonio, ambos OFF/vacío
  por defecto): texto + imagen de Historia; texto + el contador (valor crudo) + imagen de Origen;
  texto + imagen-vacía-clickeable de Presentaciones; texto de Suscripción (bullet, sin `<input id>`);
  texto del repeater de Testimonios (fila colapsada, sin `<input id>`); publicar cada sección y
  releer la home pública SIN sesión confirma que lo publicado coincide, los 5 valores.
- **Las variantes que sólo CORTE pide** (fijadas por SQL directo sobre `content.*.variante`/
  `content.variantesBandas.featured`, sin aplicar el preset completo — igual decisión que
  `EDITOR-TIENDA-CAMPO-EDITABLE-HERO-1` tomó para `hero.variante`): texto de BrandStoryCentrada
  (`ctaLabel`), texto + marcador de imagen de SubscriptionCTALinea (`ctaSecundarioLabel` +
  `imagenFondo`), texto de Spotlight (`eyebrow`, con `variantesBandas.featured:'spotlight'` +
  `productoSlug` pineado a un producto real del seed).
- **Fuera de modo editor**: la home pública no lleva ni `data-editor-campo=` ni
  `data-editor-campo-imagen=` — byte-idéntico.

Capturas con el campo abierto (overlay visible, el marcador alineado al nodo real): historia,
origen (el contador), presentaciones, destacado — en `.scratch/capturas-campo-editable-home/` (no
committed).

**Cierra la MITAD de home de la fila 4 de § 6.4 (`EDITOR-TIENDA-CAMPO-EDITABLE-RESTO-1..N`), no la
fila entera** — la frase anterior de este asiento decía que cerraba la fila 4 completa, y era
PREMATURA: `nosotrosHistoria`/`nosotrosGaleria`/`nosotrosCierre`/`suscripcionPlanes`/
`suscripcionPasos`/`suscripcionFaq` seguían sin un solo `CampoEditable` (verificado por grep,
cero resultados en `components/storefront/nosotros/` y `components/storefront/suscripciones/` al
cerrar este slice). Las cierra `EDITOR-TIENDA-CAMPO-EDITABLE-PAGINAS-1`, abajo — salvo
`suscripcionFaq`, que queda como el único hueco nombrado de toda la fila 4. La fila 5
(`EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1`, el aviso de sesión vencida dentro del overlay) **se
cerró después, en § 12** — esta frase describía el estado al cerrar ESTE slice (`-HOME-1`), no el
estado de hoy. Nav/pie (§ 5, fuera de alcance de todo este plan) siguen sin construir.

---

## 11 · `EDITOR-TIENDA-CAMPO-EDITABLE-PAGINAS-1` — /nosotros y /suscripciones

Instrumentó /nosotros (historia, galería con su repeater, cierre) y /suscripciones (planes —sin
precios— y pasos), cerrando la fila 4 de § 6.4 salvo `suscripcionFaq` (§ el hueco de alcance,
abajo). Mismo patrón que `EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1`: ningún cambio a la plomería
(`ModoEditorProvider`, `CampoEditable`, el overlay/mensajes del puente, `fusionCampoEditable`) —
ya soportaba repeaters, imágenes y campos planos sin ajustes.

### El hueco de alcance: `suscripcionFaq` NO se instrumentó — `PreguntasFrecuentes.tsx` no está en `touches:`

`app/(storefront)/suscripciones/Contenido.tsx` monta `<PreguntasFrecuentes />` para la sección
`suscripcionFaq` (un repeater), pero ese componente vive en `components/storefront/
PreguntasFrecuentes.tsx` — **compartido con `/preguntas-frecuentes` y `/tienda`** (verificado por
grep: 3 importadores) — y ese archivo NO estaba en `touches:` de este slice. Instrumentarlo habría
ampliado el alcance aprobado sin autorización nueva, así que se dejó SIN tocar; el marcador de
SECCIÓN (`data-editor-seccion="suscripcionFaq"`, ya existente desde `EDITOR-TIENDA-SELECCION-1`)
sigue intacto, y el repeater se sigue editando desde la lista del panel. Documentado inline en
`Contenido.tsx` para que no se lea como un olvido. **Sigue como el único hueco de la fila 4 de
§ 6.4** — su propio slice (`EDITOR-TIENDA-CAMPO-EDITABLE-FAQ-1` o el nombre que se le dé) toca
`PreguntasFrecuentes.tsx` cuando se apruebe.

### Los dos casos especiales medidos construyendo

- **El ÍNDICE ORIGINAL de un repeater sobrevive al filtro** (`nosotrosGaleria`, mismo criterio que
  `presentaciones`/los bullets de Suscripción en HOME-1): `items.map((f,idx)=>({f,idx})).filter(…)`
  en vez de `items.filter(…)`, para que un ítem con hueco en medio (url vacía en el índice 0 y 2,
  llena en 1 y 3) siga marcando `items.1.url`/`items.3.url` — nunca `items.0`/`items.1` por
  posición entre los visibles. `alt`/`poster`/`tipo` de un ítem NO llevan marcador: ninguno es un
  nodo de TEXTO visible (atributos del `<video>`/`<img>`, o un selector), así que no hay children
  que envolver.
- **El PRECIO de los planes NO lleva `CampoEditable`, a propósito** (§ el spec de este slice,
  aprobación del owner, 2026-10-02): es la única exclusión explícita de contenido-que-sí-se-ve en
  toda la fila 4. Afirmado en capa 1 (el texto sigue viéndose, sin marcador) y por ejecución (clic
  donde se ve el precio no abre ningún overlay).

### DEVIACIÓN MEDIDA, encontrada construyendo: el velo de NosotrosCierre se llevaba el clic de la imagen — Y el centro de la imagen coincide con el texto

Dos hallazgos superpuestos en el mismo componente, los dos por EJECUCIÓN real (no por grep de
clases), porque el primero ESCONDÍA al segundo:

1. **El velo decorativo (gradiente `--sf-velo`) no tenía `pointer-events-none`** — EXACTAMENTE el
   defecto que `EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1` ya cerró para el gradiente de
   `GrindChooserMosaico`: pinta DESPUÉS de la imagen, en la MISMA caja `absolute inset-0`, y se
   lleva el hit-test. Se agregó `pointer-events-none` a esa clase.
2. **Con el velo arreglado, el clic SEGUÍA sin disparar el filechooser** — medido con
   `document.elementFromPoint` dentro del iframe: el punto CENTRAL de la imagen (`ratioX:0.5` del
   harness, el mismo que usan todas las demás imágenes de la fila 4) cae sobre el `<span
   data-editor-campo="nosotrosCierre.parrafo">`, no sobre el velo ni la imagen. **Causa: la imagen
   es full-bleed (`absolute inset-0`, ancho completo de la sección) y el texto (`max-w-3xl
   mx-auto text-center`) es una columna angosta CENTRADA en el MISMO punto medio** — el centro de
   ambos coincide. **No se tocó el componente para esto**: el margen lateral del full-bleed (fuera
   de la columna de texto, p. ej. a 10% del ancho de la imagen en vez de al 50%) SÍ es parte de la
   imagen y no tiene ningún texto encima — es el punto que un dueño real clickearía con el mouse, y
   es el que el arnés usa ahora para este campo (`clickCampoImagen(…, { ratioX: 0.1 })`). El
   `titulo`/`parrafo`/`ctaLabel` SIGUEN clickeables para su propio overlay de texto —nada ahí
   cambió—; sólo cambió DÓNDE el arnés clickea la IMAGEN.

**HALLAZGO ADICIONAL, fuera de `touches:`, NO corregido — `SubscriptionCTALinea.tsx` reusa la MISMA
composición (imagen full-bleed + contenido ancho superpuesto) y su propio arnés (`EDITOR-TIENDA-
CAMPO-EDITABLE-HOME-1`, FASE 6) nunca clickeó realmente su `imagenFondo`: sólo contó el marcador
(`.count()===1`), nunca esperó un `filechooser`.** Verificado leyendo ese script committed-como-
scratch (no se ejecutó de nuevo, no está en `touches:` de este slice): el mismo patrón de clic
fallido que NosotrosCierre tenía ANTES de este hallazgo podría estar presente ahí también, sin que
el "42/42 en verde" de ese cierre lo hubiera detectado — su aserción nunca ejercitó la ruta del
filechooser. Queda nombrado como `CAMPO-EDITABLE-IMAGEN-CENTRO-TAPADO-POR-TEXTO-1` en los open
follow-ups (abajo); su verificación y, si aplica, su fix son de quien tenga `SubscriptionCTALinea.tsx`
en su propio `touches:`.

### Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3302/3302** (+21 sobre los 3281 que § 10 (HOME-1) reportó al cerrar) |
| `npm run test:integracion` | **308/308**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run guarda:color` | MISMA cifra exacta que el piso heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo; las otras 5 rutas (incluidas `ruta-nosotros`/`ruta-suscripciones`, nuevas en el fixture de 6 rutas) 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) |
| `npm run verificar:nayoli:visual` (main vs. rama, doble build) | MISMA cifra exacta que `guarda:color`, en las 8 claves |

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

Arnés `.scratch/verificar-campo-editable-paginas.ts` (no committed, gitignored), mismo mecanismo
que `verificar-campo-editable-home.ts` **adaptado a páginas con pestaña propia**: `TiendaPaginas`
sólo resuelve un campo hacia su sección si la página ACTIVA coincide (`secciones =
SECCIONES_TIENDA.filter(c => c.pagina === pagina)`), así que cada fase cambia de pestaña
(`button[role="tab"]:has-text("Nosotros"|"Suscripciones")`) ANTES de clickear dentro del iframe —
un paso que `verificar-campo-editable-home.ts` no necesitaba (home es la pestaña por defecto).
**45/45 verificaciones en verde**, contra una build de PRODUCCIÓN (`next build` + `next start`)
con sesión real (`admin@sierranativa.co`):

- **Historia**: `eyebrow` (texto) + el panel ve el valor; imagen VACÍA (DEFAULTS de Nayoli) SIN
  marcador — confirmado por AUSENCIA, no se intenta clickear nada.
- **Galería**: `eyebrow`; 4 ítems sembrados con hueco en medio (índices 0/2 sin url) — los dos SIN
  marcador; índice 1 (imagen) dispara filechooser real; índice 3 (el 2º ítem VISIBLE) marca
  `items.3.url`, su índice real.
- **Cierre**: `titulo` (texto) + el panel ve el valor; `imagenFondo` dispara filechooser real
  clickeando el margen lateral del full-bleed (§ el hallazgo de arriba) — el velo no se lo lleva.
- **Planes**: `titulo` + `nombre2`; el hueco en medio de los beneficios del plan 2 (`ben2_2`
  vacío, sembrado) deja al segundo beneficio VISIBLE marcando `ben2_3`, su N real; el PRECIO
  (`precio1`, cargado por SQL) NO tiene marcador de texto NI de imagen.
- **Pasos**: `paso1Label`.
- Publicar cada sección y releer `/nosotros`/`/suscripciones` SIN sesión confirma que lo
  publicado coincide — los 6 valores editados, más el precio (sembrado por SQL, nunca por overlay)
  visible sin marcador también en la página pública.
- **Fuera de modo editor**: ninguna de las dos páginas lleva `data-editor-campo=` ni
  `data-editor-campo-imagen=` — byte-idéntico.

**Cierra la fila 4 de § 6.4, salvo `suscripcionFaq`** (§ el hueco de alcance, arriba). La fila 5
(`EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1`) se cierra en § 12. Nav/pie (§ 5) y `suscripcionFaq`
quedan como las piezas sin construir de `EDICION-INLINE.md`.

---

## 12 · Lo que `EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1` entregó

Cierra la fila 5 de § 6.4: el aviso inline de sesión vencida, dentro del overlay, sin tocar la
plomería que las filas 1-4 ya construyeron (`ModoEditorProvider`, `CampoEditable`, el overlay/
mensajes del puente, `fusionCampoEditable`).

- **El QUINTO mensaje del puente** (`TIPO_MENSAJE_SESION_VENCIDA`, `lib/storefront/editor-
  puente.ts`), panel→iframe: `{seccion, vencida, mensaje?}`. **NO viaja por el `ref` imperativo de
  `VistaTiendaIframe.tsx`** (fuera de `touches:` de este slice, igual que `TIPO_MENSAJE_CAMPO_
  IMAGEN_CLICK` no pasaba por ahí en `EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1`): el panel
  (`TiendaSeccionEditor.tsx`) captura la ventana del iframe del propio `MessageEvent.source` de
  CUALQUIER mensaje iframe→panel que YA le llega (`esMensajeSeccionClick`/`esMensajeCampoCambio`/
  `esMensajeCampoImagenClick`, re-capturada en cada mensaje para sobrevivir al remonte del
  `<iframe>` entre páginas) y le contesta DIRECTO ahí — standard `MessageEvent.source`, sin
  necesitar un segundo camino al iframe ni tocar `VistaTiendaIframe.tsx`/`TiendaPaginas.tsx`.
- **El TEXTO viaja en el mensaje, no se reimporta del lado del iframe.** `guardarSeccion` detecta
  el 401 del PUT de autoguardado (`res.status === 401`) y lanza `new Error(MSG_SESION_VENCIDA)` —
  el MISMO texto/función que ya usa la subida de imágenes (`esSesionVencida`/`MSG_SESION_VENCIDA`,
  `lib/api/upload.ts`), **reusado, nunca copiado**. El mensaje al iframe manda ese string ya
  resuelto (`mensaje: MSG_SESION_VENCIDA`) para que `EditorPuenteVivo.tsx` (storefront, PÚBLICO) no
  tenga que importar `lib/api/upload.ts` —arrastraría `@vercel/blob/client` al bundle de CADA
  visitante, § "el peso es un costo real"—.
- **El coordinador genérico (`lib/autoguardado.ts`) NO se tocó.** La razón del fallo (401 vs. red
  vs. 500) es un concern del LLAMADOR (`guardarSeccion`), no del coordinador — mismo criterio que
  ya separa `esSesionVencida`/`MSG_SESION_VENCIDA` del coordinador genérico de subidas
  (`useSubidaImagen`) en el mismo archivo. `guardarSeccion` guarda su propio estado
  (`sesionVencida`, con un `sesionVencidaRef` que evita re-mandar el mismo valor en cada guardado
  EXITOSO) ORTOGONAL a `auto.estado` — dos conceptos distintos (QUÉ pasó vs. POR QUÉ), nunca dos
  fuentes del mismo hecho.
- **El panel reemplaza "No se pudo guardar" + "Reintentar" por `MSG_SESION_VENCIDA` + "Iniciar
  sesión"** cuando `auto.estado==='error' && sesionVencida` — mismo argumento que ya cerró
  `PANEL-ERROR-SUBIDA-VISIBLE-1`: un "Reintentar" sobre un 401 no arregla nada mientras la sesión
  siga vencida.
- **El campo flotante muestra el aviso SÓLO si pertenece a su propia sección** (compara
  `campoAbiertoRef.current.ruta.seccion === mensaje.seccion`): un guardado fallido de OTRA sección
  (si hubiera dos editores con campos simultáneos, hoy sólo uno puede estar abierto a la vez) no
  debe aparecer junto a un campo que no tiene nada que ver con ese guardado. Se limpia al cerrar el
  campo o abrir OTRO, y se retira (`vencida:false`) en el PRÓXIMO guardado exitoso — sin que el
  dueño tenga que hacer nada en esa pestaña: el reintento automático del coordinador (cada 5 s, sin
  cambio) lo logra solo en cuanto la sesión se renueva.
- **El chip del aviso, estilo LITERAL** (nunca un token `--duna-*`/`--sf-*`): el documento es el
  storefront, y este chrome es EFÍMERO del editor superpuesto por JS — mismo criterio que
  `COLOR_RESALTE` de `VistaTiendaIframe.tsx` (fuera de `touches:`).

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

Arnés `.scratch/verificar-campo-editable-sesion.ts` (no committed, gitignored) + el helper
`.scratch/revocar-sesion.ts` (borra la fila `Session` del usuario, DIRECTO en la base — el MISMO
mecanismo que `tests/integracion/modo-editor-gate.test.ts`, "sesión revocada"), contra una build
de PRODUCCIÓN (`next build` + `next start`). **13/13 verificaciones en verde**:

| verificación | resultado |
| --- | --- |
| clic en `hero.titulo` abre su overlay; tipear llega al panel | sí, el mismo valor en el input de la lista |
| sesión revocada server-side (fila `Session` borrada) a mitad de edición → el PUT de autoguardado falla 401 | — |
| el PANEL muestra `MSG_SESION_VENCIDA`, con "Iniciar sesión", SIN "Reintentar" | count=1 / count=1 / count=0 |
| el CAMPO FLOTANTE (dentro del iframe) muestra el MISMO texto, junto al overlay | texto idéntico, byte a byte |
| el valor tecleado sigue en el overlay Y en el panel | los dos, sin pérdida |
| "volver a entrar" — login REAL en una SEGUNDA pestaña del MISMO contexto (cookie compartida), SIN tocar la pestaña 1 | — |
| el reintento automático (cada 5 s, sin cambio) guarda solo: el panel vuelve a "Guardado" y el aviso del campo se retira | Guardado=1, sesión-vencida-todavía-visible=0, aviso-campo=0 |
| publicado y releído SIN sesión: el `h1` de la home trae el valor tecleado durante todo el episodio | sí |

### Gate

| capa | resultado |
| --- | --- |
| `npm run gate` (`tsc --noEmit` + `npm test` + `npm run test:integracion`, UN comando, árbol final) | GREEN |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3307/3307** (+5 sobre los 3302 que § 11 (PAGINAS-1) reportó al cerrar — las 5 nuevas de `esMensajeSesionVencida`, `lib/storefront/editor-puente.test.ts`) |
| `npm run test:integracion` | **308/308**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run guarda:color` | MISMA cifra exacta que el piso heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja [105,862]–[1183,3581]; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) |
| `npm run verificar:nayoli:visual` (main vs. rama, doble build) | MISMA cifra exacta que `guarda:color`, en las 8 claves |

**Cero píxeles de drift nuevo**: `TIPO_MENSAJE_SESION_VENCIDA` y el chip del aviso sólo existen
DENTRO de `campoAbierto`/`avisoSesion` (modo editor, con un campo abierto Y un guardado fallido) —
fuera de ese caso, byte-idéntico a antes.

### DEVIACIÓN MEDIDA sobre el propio `touches:`: `lib/autoguardado.ts`/`lib/autoguardado.test.ts` listados, no tocados

`touches:` de este slice los nombraba a los dos. **Medido, no asumido, que no hacía falta
tocarlos**: el coordinador (`crearAutoguardado`) ya distingue "éxito"/"fallo" y reintenta solo —
eso es TODO lo que `guardarSeccion` necesita de él. La RAZÓN del fallo (401 vs. cualquier otro) es
conocimiento exclusivo del LLAMADOR que hizo el `fetch`, y el repo YA separa esa responsabilidad
así en el mismo archivo (`esSesionVencida`/`MSG_SESION_VENCIDA` viven en `lib/api/upload.ts`,
fuera de `useSubidaImagen`, el coordinador de subidas). Extender `Autoguardado<T>` para exponer el
mensaje de error habría sido, además, inútil para este slice sin TAMBIÉN tocar `hooks/
useAutoguardado.ts` (el hook que envuelve al coordinador y que `TiendaSeccionEditor.tsx` consume)
— y ESE archivo tampoco está en `touches:`. `components/admin/EditorTiendaPantallaCompleta.tsx`
(también listado) tampoco hizo falta: no tiene ninguna relación con el autoguardado de una
sección ni con el puente — es la barra superior del editor de pantalla completa (página/
dispositivo), ajena a este mecanismo.

---

## 13 · Lo que `EDITOR-TIENDA-CAMPO-EDITABLE-CIERRE-1` entregó — cierra los tres huecos nombrados

Cierra los tres follow-ups que `-HOME-1`/`-PAGINAS-1` dejaron nombrados (§ 11/§ 12, arriba):
`EDITOR-TIENDA-CAMPO-EDITABLE-FAQ-1` (la FAQ de /suscripciones), `CAMPO-EDITABLE-IMAGEN-SLOT-VACIO-
OPCIONAL-1` (los seis sitios donde una imagen opcional vacía dejaba al JSX sin ningún nodo que
marcar) y `CAMPO-EDITABLE-IMAGEN-CENTRO-TAPADO-POR-TEXTO-1` (la medición pendiente sobre
`SubscriptionCTALinea.tsx`). Sin tocar la plomería de las filas 1-5 (`ModoEditorProvider`,
`CampoEditable`, el overlay/mensajes del puente, `fusionCampoEditable`) — las tres piezas se
construyeron sobre esa base, igual que todas las anteriores.

### La FAQ (`PreguntasFrecuentes.tsx`) — el único hueco de ALCANCE

Estaba fuera de `touches:` de `-PAGINAS-1` porque el componente es compartido con `/tienda` y
`/preguntas-frecuentes` (3 importadores). Esta tanda lo tenía en su propio `touches:`, así que se
instrumentó entero: `suscripcionFaq.titulo` (texto plano) y, por cada ítem del repeater,
`suscripcionFaq.items.N.question`/`.answer` — la MISMA convención por-índice que `testimonials`/
`nosotrosGaleria`, y sin la preservación de índice-original que esos dos necesitan (`items.map`
recorre el array completo sin hide-on-empty POR ÍTEM, así que la posición visible y el índice real
siempre coinciden; no hay huecos en medio que preservar). `app/(storefront)/suscripciones/
Contenido.tsx` gana sólo un ajuste de comentario —la frase que decía "la FAQ no lo ganó en esta
tanda" ya no era cierta— sin tocar el mecanismo posicional de marcado de sección (`ATRIBUTO_EDITOR_
SECCION` vía `closest()`) que ya cubría a `<main>` desde `EDITOR-TIENDA-SELECCION-1`.

### El HUECO "Agregar foto" — `HuecoImagenOpcional`, un componente nuevo en `CampoEditable.tsx`

Los seis sitios nombrados por `-HOME-1` (`brandStory.imagen2/3/4` en sus DOS variantes —columnas y
centrada—, `subscriptionCTA.imagenFondo` en `SubscriptionCTALinea`, `nosotrosHistoria.imagen`,
`nosotrosCierre.imagenFondo`) comparten la misma forma del defecto: un campo de imagen OPCIONAL
vacío hace que el `.filter()`/`&&`/la bifurcación de la sección entera OMITA el bloque completo, no
sólo la imagen — así que no quedaba NINGÚN nodo donde clickear para agregar la primera foto desde
la página; sólo se podía desde el formulario de la lista.

- **`HuecoImagenOpcional({campo, className})`** (`components/storefront/CampoEditable.tsx`, export
  nombrado junto al `default`): se gatea a sí mismo con `useModoEditorActivo()` —devuelve `null`
  fuera de modo editor, el MISMO contrato que `CampoEditable`— y envuelve un `<div className={...
  className}>` (el tamaño/posición los decide el llamador, igual que el nodo de imagen real que
  reemplaza) con un `<CampoEditable tipo="imagen">` por dentro: el MISMO mensaje al puente
  (`TIPO_MENSAJE_CAMPO_IMAGEN_CLICK`) y el MISMO flujo de subida real del panel que ya usa cualquier
  imagen llena — no hay diferencia de MECANISMO entre "cambiar una foto que ya existe" y "agregar la
  primera".
- **LO VISIBLE es un CHIP CHICO centrado ("+ Agregar foto"), no un rectángulo opaco** — la caja
  clickeable ocupa todo el espacio que ocuparía la imagen real (consistente con cómo se comporta esa
  imagen), pero el fondo sólido/la imagen de abajo siguen viéndose detrás del chip. Estilo LITERAL
  (`border-black/30`, `bg-white/90`…), nunca un token `--sf-*`/`--duna-*` — mismo criterio que el
  chip de sesión vencida de `EditorPuenteVivo.tsx` (§ 12): es chrome del EDITOR sobre el documento
  del visitante, no contenido de ese documento.
- **brandStory (columnas Y centrada)**: tras el `.map()` de las imágenes llenas, un segundo `.map()`
  —sólo cuando `activo`— sobre las OPCIONALES vacías (`imagen1` nunca puede estar ahí: es requerida,
  el resolver la rellena con el default). En Centrada el hueco se agrega FUERA del cálculo de
  rotación/apertura del scroll-scrub (`imagenesLlenas`/`totalVisible`/los cuatro `useTransform`
  siguen sin tocar) — es un invite ESTÁTICO, no una figura más del collage.
- **`SubscriptionCTALinea`/`NosotrosCierre`**: el `{tieneImagenFondo && (...)}` pasó a
  `{tieneImagenFondo ? (...) : <HuecoImagenOpcional .../>}` — el fondo SÓLIDO de siempre se queda
  cuando no hay foto; sólo se agrega el hueco encima.
- **`NosotrosHistoria`** es el único de los seis donde el cambio toca la ESTRUCTURA de la
  bifurcación, no sólo una rama: `if (!tieneImagen)` pasó a `if (!tieneImagen && !activo)` — en modo
  editor, sin imagen TAMBIÉN entra a la composición de DOS columnas (la misma que con imagen), con
  el hueco en la segunda en vez del `<Image>` real. Fuera de modo editor la condición sigue cayendo
  exactamente en la rama de una sola columna de siempre.
- **`SubscriptionCTABloque` NO ganó ningún hueco** — medido, no asumido: ese componente no lee
  `imagenFondo` en absoluto (la variante canónica de Nayoli nunca tuvo esa capacidad, § el docstring
  de `-HOME-1`), así que no hay ninguna rama vacía que llenar.

### El clic tapado — medido, no sólo heredado del follow-up

`CAMPO-EDITABLE-IMAGEN-CENTRO-TAPADO-POR-TEXTO-1` pedía verificar por ejecución si
`SubscriptionCTALinea.tsx` (y, de aplicar, `SubscriptionCTABloque.tsx`) repetía el defecto que
`NosotrosCierre` ya había cerrado. `SubscriptionCTABloque` no aplica (no tiene imagen, arriba). Para
`SubscriptionCTALinea`, DOS hallazgos, los dos confirmados con `document.elementFromPoint` dentro de
un arnés de Playwright contra una build de producción real (no se infirió de la clase CSS):

1. **El velo (`bg-linear-to-b … to-[var(--sf-velo)]`) NO tenía `pointer-events-none`** —
   exactamente el mismo defecto que `NosotrosCierre`/`GrindChooserMosaico` ya tenían cerrado, nunca
   corregido acá porque nadie lo había medido. Se agregó `pointer-events-none`. Neutro para un
   visitante real: el velo nunca tuvo propósito interactivo.
2. **Con el velo arreglado, el CENTRO de la imagen sigue sin ser alcanzable**: el bloque de
   contenido (`<div className="relative z-10 … flex … sm:justify-between">`, texto a la izquierda +
   botones a la derecha) no es `absolute`, pero su banda vertical —inmediatamente después del
   padding superior (`py-20`)— coincide con el centro de una franja corta, y `z-10` lo pone encima
   del fondo. **No se tocó el componente**: el margen superior/inferior (`py-20`, fuera de esa
   banda) SÍ es sólo imagen, y es donde un dueño real clickearía para cambiarla. El arnés de
   verificación usa ese punto (`ratioY: 0.05`), tanto para el hueco vacío como para la imagen ya
   cargada.

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

Arnés `.scratch/verificar-campo-editable-cierre.ts` (no committed, gitignored), contra una build de
PRODUCCIÓN (`next build` + `next start`) con sesión real (`admin@sierranativa.co`). **33/33
verificaciones en verde**:

| fase | verificación | resultado |
| --- | --- | --- |
| FAQ | `titulo` + `items.0.question` + `items.1.answer` abren su overlay, el panel ve el valor | sí, los tres |
| FAQ | "Publicar" aplica, y los tres valores aparecen en `/suscripciones` SIN sesión | sí |
| brandStory·columnas | imagen1 (requerida, llena) marca el nodo REAL; imagen2/3/4 (vacías) marcan el HUECO | sí, los 4 |
| brandStory·columnas | clic en el hueco `imagen3` dispara un `filechooser` real | sí |
| brandStory·centrada | imagen2/3/4 (mismos valores vacíos, variante cambiada por SQL) marcan el HUECO | sí, los 3 |
| brandStory·centrada | clic en el hueco `imagen2` dispara un `filechooser` real | sí |
| SubscriptionCTALinea | imagenFondo vacía (DEFAULTS) marca el HUECO; clic (margen superior) dispara `filechooser` | sí |
| SubscriptionCTALinea | imagenFondo CARGADA: clic (esquina sup-izq, lejos del texto) dispara `filechooser` — el velo con `pointer-events-none` no se lo lleva | sí |
| NosotrosHistoria | imagen vacía (DEFAULTS) marca el HUECO; clic dispara `filechooser` real, confirmado por el `postMessage` real (`editor-tienda:campo-imagen-click`, `seccion:'nosotrosHistoria'`) | sí |
| NosotrosCierre | imagenFondo vacía (titulo sembrado) marca el HUECO; clic (margen lateral) dispara `filechooser` | sí |
| Fuera de modo editor | `/`, `/nosotros`, `/suscripciones`: cero `data-editor-campo`/`-imagen`, cero texto "Agregar foto" | sí, las 3 rutas |

**HALLAZGO DE MÉTODO DEL ARNÉS (no del mecanismo) — el más caro de esta tanda, dos capas de scroll
que no son la misma.** El editor de pantalla completa tiene DOS niveles de scroll independientes, y
el arnés sólo sabía manejar el de adentro:

1. **El documento DENTRO del iframe scrollea con `scrollTop`/`window.scrollTo`, pero
   `Element.scrollIntoView()` midió CERO efecto ahí** (con o sin `behavior:'instant'`) — se mide a
   mano (offset documento-absoluto del marcador menos medio viewport del iframe) y se centra con
   `window.scrollTo` directo.
2. **La página EXTERIOR del admin —`window.scrollBy` sobre ESA página midió CERO efecto también—,
   porque `/editor/tienda` usa un layout de ALTO FIJO (§ CLAUDE.md, "Los DOS modelos de scroll del
   panel") con una REGIÓN interna (`overflow-y` con `scrollHeight>clientHeight`) que scrollea, no el
   documento.** El síntoma, antes de encontrar esto: un punto calculado correctamente en coordenadas
   del iframe (confirmado con `elementFromPoint` DENTRO del iframe, apuntando al nodo correcto)
   producía `puntoPagina.y` cerca de 0 o fuera de la banda VISIBLE del contenedor exterior, y el clic
   físico (`page.mouse.click`) no dejaba NINGÚN rastro dentro del iframe —confirmado con un listener
   de `click` en captura sobre `document` del frame, array vacío tras el clic—. El fix: encontrar el
   ANCESTRO real del `<iframe>` con scroll propio y mover SU `scrollTop` hasta que el punto caiga
   dentro de su banda visible (`[top+margen, top+clientHeight-margen]`), no sólo dentro del viewport
   del navegador. Esto es un defecto del ARNÉS —el mecanismo de clic en imagen ya estaba probado
   contra esta misma página en `-PAGINAS-1` (imágenes CARGADAS de `NosotrosCierre`)—, no del código
   de producto: una vez centrado el punto en la banda correcta, el mismo `page.mouse.click` de
   siempre disparó el `filechooser` en el primer intento.

### Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3345/3345** (era 3334/3334 al cierre de `EDITOR-TIENDA-DESHACER-1`; +11 — reconciliado por EJECUCIÓN, no por grep de `test(`: el delta exacto de 11 ejecuciones nuevas se verificó sumando call-sites fuera de loop (1+1+3+2=7) más las 4 ejecuciones del loop de BrandStory (2 call-sites × 2 iteraciones) = 11, 3334+11=3345 cierra exacto) |
| `npm run test:integracion` | **323/323**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run guarda:color` | MISMA cifra exacta que el piso heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) |
| `npm run verificar:nayoli:visual` (main vs. rama, doble build) | MISMA cifra exacta que `guarda:color`, en las 8 claves |

**Cero píxeles de drift nuevo.** `HuecoImagenOpcional` sigue devolviendo `null` fuera de modo
editor, en los seis sitios; el `pointer-events-none` del velo de `SubscriptionCTALinea` no cambia un
solo píxel visible (es un degradado transparente de por sí); el ajuste de comentario en
`Contenido.tsx` no es código ejecutable.

**Cierra los tres follow-ups nombrados: `EDITOR-TIENDA-CAMPO-EDITABLE-FAQ-1`,
`CAMPO-EDITABLE-IMAGEN-SLOT-VACIO-OPCIONAL-1` y `CAMPO-EDITABLE-IMAGEN-CENTRO-TAPADO-POR-TEXTO-1`.**
Con esto, el plan por slices de § 6.4 queda completo salvo nav/pie (§ 5, fuera de alcance explícito
de todo este documento, sin disparador propio).

## 14 · Lo que `EDITOR-TIENDA-CAMPO-ANCLADO-1` entregó — el campo anclado al DOCUMENTO

Cierra los errores 1, 3 y 4 de `docs/editor-tienda/REDISENO.md` § 1, reproducidos en un arnés de
Playwright ANTES de tocar código (contra el HEAD sin arreglar) y vueltos a correr contra el código
arreglado — **19/19 verificaciones**, las tres causas coincidieron EXACTAMENTE con lo medido en la
lectura. Se mantiene la decisión de § 2.2 (campo flotante, nunca `contentEditable`); lo que cambia
es cómo se ancla y qué mide.

- **DOCUMENTO, no PANTALLA.** `estiloCampoFlotante` (`lib/storefront/campo-editable.ts`) pasó de
  `position: fixed` (coordenadas de VIEWPORT, leídas una vez al abrir) a `position: absolute`
  (coordenadas de DOCUMENTO: `rect.top + window.scrollY`, `rect.left + window.scrollX`). Con esto el
  navegador mueve el overlay junto con el resto del documento al scrollear, SIN que haga falta
  re-medir sólo por eso — medido: tras scrollear 700px hasta la Galería de /nosotros, la distancia
  overlay↔nodo real se mantuvo en 0px (antes: crecía exactamente el scroll aplicado).
- **El BLOQUE, no el `<span>`.** `elementoDeBloque` (`EditorPuenteVivo.tsx`, impuro — usa
  `getComputedStyle`) sube UN nivel desde el nodo marcado: si el padre directo NO es `inline`, es el
  bloque (el caso general — un `<p>`/`<h1>`/`<h2>` con el `CampoEditable` como único hijo); si el
  padre SIGUE siendo inline (el caso de `marquesina.texto`, envuelto en un `<span>` extra dentro del
  `flex` del ticker), se queda en el nodo — subir SIN TOPE daba el ANCHO DE LAS DOS COPIAS del
  ticker, no el de una línea. `leerTipografia` ahora copia `whiteSpace` del bloque (no del span):
  un `\n` que el bloque colapsa (`white-space: normal`) también se colapsa en el `<textarea>`, que
  por UA stylesheet trae `pre-wrap` — medido contra `nosotrosHistoria.parrafo3` con un salto de
  línea real: antes, overlay 476.5×79.5px (necesitaba scrollbar: 88px de contenido en 80 de caja)
  contra 512×87.75px del `<p>` real; después, 512×87.75px exacto, sin scrollbar.
- **RE-MEDIDO vivo, por atributo — nunca por nodo guardado.** Un `ResizeObserver` sobre el BLOQUE +
  `scroll`/`resize` de `window` (los tres en `abrirCampo`, con su limpieza en `limpiarMedicionRef`)
  recalculan `estilo` ante cualquier cambio de tamaño del bloque — incluido el que el propio tecleo
  produce, porque el bloque real sigue renderizando el valor en vivo aunque esté
  `visibility:hidden`. Esto absorbe el "crece solo, sin barra" para CUALQUIER campo multilínea, sin
  lógica de auto-grow aparte.
- **LA MARQUESINA, dos copias ocultas por RENDER, no por nodo.** `CampoEditableGemelo`
  (`CampoEditable.tsx`) deja de renderizar la copia gemela POR COMPLETO mientras
  `useRutaEnEdicion() === campo` — una condición de render, no una regla CSS/atributo que un
  remount pudiera dejar de matchear. `useRutaEnEdicion()` lee `ATRIBUTO_RUTA_EN_EDICION`
  (`document.documentElement`, escrito/borrado por `EditorPuenteVivo.tsx` en `abrirCampo`/
  `cerrarCampo`) vía `useSyncExternalStore` + `MutationObserver` — **sin Provider nuevo**: uno que
  envolviera tanto a `EditorPuenteVivo` como al resto de la página habría exigido tocar
  `app/(storefront)/layout.tsx`, fuera de `touches:`. Gated por `useModoEditorActivo()` para que el
  `MutationObserver` nunca se cree fuera de modo editor (cero listeners para el 99.99% del tráfico).
- **EL TICKER DE `HeroMediaMarquesina.tsx` SE CONGELA mientras se edita — no sólo visualmente.**
  `duracionTicker` (y por tanto el `key={duracionTicker}` que remonta el track) se recalcula en
  CADA tecla porque `marquesina.texto` cambia en cada tecla; la guarda `editandoTicker` (derivada
  de `useRutaEnEdicion() === 'marquesina.texto'`) SALTA esa recalculación entera mientras se edita
  — sin esto, el nodo marcado se habría reemplazado varias veces por segundo y el overlay habría
  perdido su referencia. `animate`/`transition` del track caen a `estatico || editandoTicker`.
  Verificado que el ticker VUELVE A CORRER al cerrar (el `transform` cambia con el tiempo: `none` →
  `matrix(1,0,0,1,-128.214,0)` entre dos lecturas separadas por 1.5s).
- **`VistaTiendaIframe.tsx`: un clic que nace DENTRO del iframe no lo vuelve a desplazar.**
  `clicDesdeIframeRef` marca `{seccion, marca}` apenas llega un `seccion-click` por `postMessage`
  (ANTES de notificar al padre); `irASeccion` lo CONSUME (si es la MISMA sección y está fresco,
  `< 500ms`) y no desplaza/resalta esa vez — un "Editar" real desde la lista, o un deep-link, nunca
  pasan por ese mensaje y siguen desplazando como siempre. Verificado: abrir un campo en una
  sección recién cargada (antes disparaba `scrollIntoView` vía `abrirEdicion→onAbrir`) deja
  `window.scrollY` sin cambios.
- **El aviso de sesión vencida (chip bajo el overlay) pasó de `position:fixed` a `absolute`** — es
  hijo del MISMO sistema de coordenadas que el overlay (`campoAbierto.estilo.top/left`, ya en
  documento); con `fixed` habría quedado mal ubicado en cuanto el documento scrolleara.

### El arnés — reproducción ANTES, verificación DESPUÉS

`.scratch/verificar-campo-anclado.ts` (no committed, gitignored). Mismo mecanismo de Postgres
efímero + `next build` + `next start` + sesión real que los arneses anteriores de esta rama. Corrido
DOS veces: contra el código sin tocar (reproduce los tres errores, 12/18 y luego 12/19 en verde
según la fase de ajuste del propio arnés) y contra el código arreglado (19/19). Sin
`reducedMotion: 'reduce'` a propósito en la fase del ticker — con esa opción, `useReducedMotion()`
deja el ticker SIEMPRE estático y la verificación de "vuelve a correr" no podría afirmar nada
(nunca corrió para empezar).

### Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3378/3378** |
| `npm run test:integracion` | **323/323**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run verificar:nayoli:visual` (main vs. rama, doble build) | MISMA cifra exacta que el piso heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1` + el crédito de `PIE-HECHO-POR-DUNA-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS (0px) |

**Cero píxeles de drift nuevo.** Fuera de modo editor, `CampoEditableGemelo` devuelve `children` tal
cual (cero wrapper) y el `useRutaEnEdicion()` que usa nunca crea su `MutationObserver` — los 263
tests de `campo-editable.test.ts` (incluidos los de byte-identidad "SIN modo editor") siguen en
verde sin tocarlos más que en la forma del `estiloCampoFlotante`/`TipografiaCampo` (geometría
`absolute` + `whiteSpace`).

**Cierra `EDITOR-TIENDA-CAMPO-ANCLADO-1`.**

## 15 · Lo que `EDITOR-BARRA-ESTILO-CLIC-1` entregó — la barra flotante deja de ser inalcanzable

`EDITOR-TIENDA-BARRA-FLOTANTE-1` (§ arriba, DECISIONS.md 2026-10-04) construyó `BarraEstiloElemento`
en su PROPIO portal (`createPortal(…, document.body)`), aparte del overlay de texto. El listener de
clic en captura de `EditorPuenteVivo.tsx` (§ 2, el que intercepta TODO clic salvo el del overlay)
sólo dejaba pasar el overlay —por un REF (`overlayNodoRef.current.contains(destino)`), no por
atributo—, así que ningún clic en la barra llegaba nunca al `onClick` de React: la intercepción
corría primero (`preventDefault`+`stopPropagation`), y como el nodo clickeado no matchea ningún
`[data-editor-*]` que las ramas de abajo ya conocen, cada clic en la barra caía en "clic afuera de
cualquier campo" y **cerraba el campo sin aplicar nada**. Alinear, los colores por rol y "Quitar" no
respondían; letra/tamaño "funcionaban" sólo porque `selectOption()` de Playwright no dispara un clic
real sobre el `<select>` (confirmado al reproducir con `.click()` + elegir, no sólo `selectOption()`).

### El arreglo — un atributo compartido, no una excepción más

`ATRIBUTO_EDITOR_CHROME`/`esClicEnChromeEditor` (nuevos, `lib/storefront/editor-puente.ts`): el
listener de clic hace `destino?.closest('[data-editor-chrome]')` **ANTES** de `preventDefault`/
`stopPropagation` — si lo encuentra, el clic sigue su curso NATIVO y ni el campo ni la selección se
tocan. Reemplaza al `overlayNodoRef` (que se retiró, dead code tras la generalización) y se suma a
los TRES nodos de chrome propio del editor: el overlay (`comun` del `<input>`/`<textarea>`), el
aviso de sesión vencida, y la barra flotante entera. Un control nuevo del editor hereda la excepción
con sólo llevar el atributo — el listener no necesita volver a tocarse.

- **`esClicEnChromeEditor` recibe el DESTINO, no hace el DOM query** (`{closest(…): unknown}`): la
  decisión queda testeable sin jsdom (el repo no lo tiene) con un objeto mínimo.
- **El separador «+» NO lleva este atributo** — su comportamiento correcto ES ser interceptado y
  traducido a `postMessage` (vive en su propia rama, después de `preventDefault`), no dejarlo pasar
  tal cual; mezclarlo con `ATRIBUTO_EDITOR_CHROME` le habría quitado su despacho.

### Verificado por ejecución (Playwright, sesión real, DB efímera — nunca `development`/producción)

`.scratch/verificar-barra-estilo-clic.ts` (no committed, gitignored), CHROMIUM y WEBKIT: clic real
(`.click()`) en Alinear/Centro, un color por rol, y Quitar; Letra/Tamaño abiertos con `.click()` real
(no sólo `selectOption()`) y elegidos con `selectOption()` (clickear una opción del popover nativo
del SO no es automatizable de forma confiable en headless). **31/32 en verde** en los dos motores —
cada control RESPONDE y el campo NUNCA se cierra al interactuar con la barra, el defecto que este
slice existe para arreglar.

**El único fallo es un hallazgo DISTINTO, documentado para no confundirlo con una regresión de este
fix:** en WEBKIT, "Quitar" limpia `fuente` pero no `tamano`/`color`/`alinear` (confirmado leyendo el
`style` inline del `<h1>` real tras el clic + 3s de polling: `text-align`/`color`/`font-size`
quedan puestos). Es una carrera de `postarEscalonado` (los 4 mensajes escalonados de "Quitar") con
el round-trip del panel, específica de WebKit — nunca antes expuesta porque, pre-fix, el clic en
"Quitar" jamás llegaba a disparar `quitar()` en ningún motor. Coined
`EDITOR-BARRA-ESTILO-QUITAR-WEBKIT-RACE-1`; no se toca en este slice (el mecanismo vivo,
`postarEscalonado`, es de `EDITOR-TIENDA-BARRA-FLOTANTE-1`, y el defecto no es de intercepción).

### Gate

| capa | resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **3669/3669** (+8 sobre los 3661 previos: `editor-puente.test.ts` +5, `editor-iframe.test.ts` +3) |
| `npm run test:integracion` | **346/346**, sin cambio (ningún archivo de `tests/integracion/` está en `touches:`) |
| `npm run gate` | GREEN |
| `npx next build` | compiló sin error |
| `npx eslint` sobre los archivos de `touches:` tocados | `editor-puente.ts`/`editor-puente.test.ts`/`editor-iframe.test.ts`: 0 problemas nuevos; `EditorPuenteVivo.tsx`: 2 errores + 2 warnings PRE-EXISTENTES (confirmado contra `git show HEAD:…`), **uno menos** que antes (se retiró el `ref` callback de `overlayNodoRef`, ya sin consumidor) |
| `npm run verificar:nayoli:visual` (main vs. rama, doble build) | MISMA cifra exacta que el piso heredado (`NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`): `ruta-home` 165052/4608000 px (AA) · 174711 crudo, caja `[105,862]–[1183,3581]`; las otras 5 rutas 163/361 px c/u; los 2 hovers IDÉNTICOS |

**Cierra `EDITOR-BARRA-ESTILO-CLIC-1`.**
