# Agregar secciones al home — el mecanismo (§ SECCIONES-INSTANCIAS-1), la UI de la LISTA (§ EDITOR-AGREGAR-SECCION-1) y la del LIENZO (§ EDITOR-AGREGAR-SECCION-LIENZO-1)

Este documento describe el MECANISMO que SECCIONES-INSTANCIAS-1 construyó (el modelo, el
resolver, el schema, el render y el plumbing del editor en vivo), la UI que EDITOR-AGREGAR-
SECCION-1 le agregó encima en la LISTA (el botón "Agregar sección", la biblioteca con vista
previa, las tarjetas con asa/menú, y el formulario de edición), y el segundo disparador hacia el
MISMO mecanismo que EDITOR-AGREGAR-SECCION-LIENZO-1 agregó sobre el LIENZO (el «+» entre
secciones de la vista previa real). El estado "sin UI de admin todavía" quedó cerrado — lo que
sigue describe el mecanismo (sin cambios) y, en sus propias secciones, las dos UI.

## El contrato

- **`content.seccionesHome`**: mapa `id → instancia`, clave META (fuera del REGISTRY, como
  `tema`/`esquemas`), KEY-AGNÓSTICA — no hay un set cerrado de ids, lo decide quien agrega una.
- **El id lleva el prefijo `inst:`** (`INSTANCIA_PREFIJO`, `lib/config/secciones-instancias.ts`):
  ningún `BandaId` empieza así, así que un id de instancia nunca puede chocar con una banda —
  el contrato no depende de enumerar las bandas conocidas, depende de que toda banda sea una
  palabra plana sin `:`.
- **`content.orden` mezcla bandas e instancias.** El id de una instancia entra a `orden` SÓLO
  si esa instancia existe de verdad en `seccionesHome` (`resolverOrdenCompleto`, el resolver es
  SOFT: un id con el prefijo pero sin instancia real se descarta, un tipo desconocido o basura
  también). Las instancias que existen pero no están explícitas en `orden` se agregan AL FINAL,
  después de las bandas — el mismo comportamiento que ya tenían las bandas que faltan.
- **Sin una sola instancia, todo es byte-idéntico a antes de este slice.** `resolverOrdenCompleto`
  con `instanciaIds: []` es el MISMO algoritmo que la vieja `resolverOrden`, sobre el mismo
  dominio. Medido: `npm run verificar:nayoli:visual` reproduce la MISMA cifra exacta,
  dígito a dígito, que el piso ya documentado como `NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`
  (165052/4608000 px AA en `home`, caja `[105,862]–[1183,3581]`; 163/361 px en las otras 5
  rutas; los 2 hovers IDÉNTICO) — cero píxeles de más atribuibles a este slice.

## El catálogo curado — tres tipos, cada uno con su descriptor único

`lib/config/secciones-instancias.ts` es la ÚNICA fuente por tipo (`DESCRIPTOR_INSTANCIA`), de la
que derivan el resolver (`resolverInstancia`), el sub-schema zod en `site-content-schema.ts`
(unión discriminada por `tipo`) y lo que un editor futuro necesitará (campos + cuáles son
imagen + escalares con su set cerrado). Un test de paridad (`secciones-instancias.test.ts`)
falla si el descriptor y el schema se desincronizan.

| Tipo | Campos | Imagen | Escalar |
| --- | --- | --- | --- |
| `texto` | antetítulo, título (requerido), texto, CTA | — | `alineacion` (izquierda/centro/derecha) |
| `imagenTexto` | antetítulo, título (requerido), texto, CTA | `imagen` (opcional, sin default) | `lado` (izquierda/derecha) |
| `banner` | título (requerido), texto, CTA, CTA secundario | `imagen` (opcional, sin default) | `alto` (justo/alto/pantalla, reusa `claseAlturaHero`) |

**Defaults neutros de vertical, sin una palabra de café** (§ CLAUDE.md, "El código compartido no
NACE siendo Nayoli/demo"): los textos de ejemplo son genéricos y ninguna imagen trae un valor
por defecto — el hueco "+ Agregar foto" del editor es el estado inicial correcto.

Módulo HOJA a propósito (ver su docstring de cabecera): no importa nada de
`site-content-defaults.ts`, para que los dos módulos no se necesiten uno al otro en tiempo de
evaluación — sería un ciclo de imports real entre los dos archivos más grandes de `lib/config/`.

## Los tres componentes

`components/storefront/secciones/{Texto,ImagenTexto,Banner}.tsx` + el dispatcher
`SeccionInstancia.tsx` (gemelo del registro `BANDAS` de `page.tsx`, pero por TIPO en vez de por
id fijo, porque el id es arbitrario y el tipo no). Cada uno:

- usa los MISMOS tokens que cualquier banda (`--sf-banda`/`--sf-sobre-banda(-suave)` con sus
  fallbacks de siempre, `sf-pildora`/`--sf-accion*` para el CTA, `sf-radio-imagen`/
  `sf-sombra-imagen` para las fotos) — un esquema asignado vía `content.esquemas[id]` (la MISMA
  clave key-agnóstica que las bandas, pasada por `page.tsx`) tiñe una instancia exactamente
  igual que a cualquier banda, sin código nuevo en `esquema-style.ts` para eso;
- usa `RevelarBloque` para la entrada de bloque de siempre;
- marca sus campos con `CampoEditable`/`HuecoImagenOpcional` — SÓLO visibles en modo editor, listos
  para cuando exista una UI que los edite en vivo (el puente ya sabe fusionar un mensaje de
  instancia, § abajo), pero hoy nadie los dispara.

## Darkness/uniformidad para el nav — el mecanismo existe, su wiring no (límite conocido)

`bandaOscuraCanonica`/`bandaUniforme` (`site-content-defaults.ts`) y `bandaEsOscura`/
`tratamientoNav` (`esquema-style.ts`) ganaron un parámetro OPCIONAL `tipoInstancia` que, cuando
se pasa, delega a `instanciaOscuraCanonica`/`instanciaEsUniforme` (banner = oscuro y uniforme,
como el hero·curtina; imagenTexto = NO uniforme, bi-tonal por layout, como el hero·ficha; texto
= claro y uniforme). Es BACKWARD-COMPATIBLE (parámetro opcional, `bandaId` ensanchado de
`BandaId` a `string`) y no cambia el comportamiento de ningún llamador de hoy.

**`StoreNav.tsx` (fuera de `touches:` de este slice) sigue sin pasar `tipoInstancia`** — su
propio `resolverOrden(orden)[0]` re-filtra `orden` a sólo bandas (la vieja `resolverOrden`, sin
tocar), así que una instancia que terminara primera en la secuencia visual queda invisible para
el cálculo de darkness del nav. Es un límite conocido, documentado también en `DECISIONS.md`
(open follow-up), no una laguna sin nombrar.

## El puente en vivo — plomería receptora, inerte hasta que exista el editor

`lib/storefront/editor-puente.ts` gana `fusionarContenidoInstancia` (gemela de
`fusionarContenidoSeccion`, apuntando a `content.seccionesHome[id]`) y `EditorPuenteVivo.tsx`
reconoce `esInstanciaId(seccion)` antes de la verificación `esSeccionDelRegistro`, extrayendo el
sub-schema de la unión discriminada vía `.shape.seccionesHome.unwrap().valueType` (zod 4 — NO
`.valueSchema`, el nombre de zod 3). El branch de reordenamiento en vivo (`seccion === 'orden'`)
usa `resolverOrdenCompleto` en vez de la vieja `resolverOrden`, así que arrastrar una instancia
en una UI futura movería también su nodo `[data-editor-seccion]`.

**Sin UI de admin que emita estos mensajes todavía** — toda esta mitad es receptora, verificada
por un test de capa 1 que ejercita el MISMO patrón de extracción zod que usa el componente
(`editor-puente.test.ts`), para que un upgrade de zod que vuelva a renombrar esa propiedad lo
rompa en capa 1, no en silencio dentro de un componente sin test propio (`.tsx`, fuera del glob
del gate).

## `mergePresetEnContent` preserva instancias — incluso en el primer apply

Un preset (`themes.ts`) nunca declara instancias (son contenido del dueño, no composición de
catálogo). Antes de este slice, `out.orden = fusionar('orden', [...preset.orden])` habría
perdido cualquier instancia en el PRIMER `aplicarPreset` sobre un tenant que ya tuviera una (sin
`presetSnapshot` todavía, la fusión de tres vías no puede distinguir "el dueño agregó una
instancia" de "nunca hubo nada que preservar"). Ahora `nuevo` incluye explícitamente cualquier
instancia presente en `content.orden` actual, así que sobrevive en el primer apply Y en los
siguientes. Tres tests en `themes.test.ts` lo afirman, incluido el caso sin snapshot.

## La UI (§ EDITOR-AGREGAR-SECCION-1) — qué se construyó

**El botón "+ Agregar sección"** vive al final de la lista del nivel «Inicio» (siempre visible,
con el texto cambiando a "Llegaste al máximo de N secciones agregadas" en el tope,
`TOPE_INSTANCIAS_HOME`) y, por Shopify, también entre cada par de tarjetas — un separador que
sólo se revela con `onMouseEnter`/`onFocus` (`components/admin/editor/SeparadorAgregar.tsx`): sin
CSS nuevo (`duna.css` no está en `touches:` de este slice), el hover/foco se resuelve con estado
de React, no con una regla `:hover`.

**La biblioteca** (`components/admin/editor/BibliotecaSecciones.tsx`) abre dentro de `VistaNueva`
(su segundo consumidor real, tras "Medios") con un buscador y una tarjeta por tipo del catálogo
—`CATALOGO_INSTANCIAS`, § abajo—, cada una con una vista previa del **componente real**
(`SeccionTexto`/`SeccionImagenTexto`/`SeccionBanner`) montado con sus `DEFAULTS_INSTANCIA`, bajo
`varsDeTienda(tema)` del tenant y un `SiteContentProvider`/`PreviewProvider` locales — el MISMO
patrón que `PaletaSeccion.tsx` (`FragmentoTienda`) ya usa para su preview, no una invención nueva.

**DESVIACIÓN MEDIDA del spec, documentada:** el spec pide la vista previa "al pasar el mouse o
con foco" (hover-reveal); se construyó SIEMPRE VISIBLE en cada tarjeta. La hoja es angosta
(`min(480px, calc(100% - 2.75rem))`, § `VistaNueva`/`DunaSheet --lado`) y un hover-reveal
competiría por el mismo espacio que la lista, además de no existir en táctil (sin hover). Mostrarla
siempre cumple el mismo propósito ("ver antes de elegir") sin depender de un gesto ausente en un
teléfono — el "siempre visible" implica trivialmente "al pasar el mouse o con foco", nunca menos.

**Elegir un tipo** (`agregarSeccion`, `TiendaPaginas.tsx`) genera el id (`nuevoIdInstancia`),
crea la instancia (`crearInstancia`, una copia de `DEFAULTS_INSTANCIA[tipo]`), la inserta en
`orden` DESPUÉS de la posición pedida (el id tras el que se abrió la biblioteca, o al final desde
el botón de pie de lista), autoguarda `orden` Y `seccionesHome` A LA VEZ (mismo "lote" que un
reorden normal, § `restaurarOrden`/`restaurarSeccionesHome`), recarga el iframe (necesario:
`Home` es un Server Component, y el puente en vivo sólo REORDENA nodos que YA EXISTEN — nunca los
crea), y abre el nivel de la sección nueva.

**Cada tarjeta de instancia** (`components/admin/editor/InstanciaTarjeta.tsx`) tiene asa
(drag + flechas, el MISMO `AsaOrdenProps`/`asaDeSeccion` que una banda — `id: string` ensanchado,
§ abajo), un menú "⋯" con Duplicar/Eliminar (`InstanciaAccionesMenu.tsx`, patrón
`ProductoAccionesMenu.tsx`), y "Editar". **Duplicar** copia la instancia con un id nuevo justo
debajo en `orden`; **Eliminar** abre el `ConfirmDeleteDialog` de siempre (nunca una segunda
implementación de confirmación) y, al confirmar, quita el id de `orden` Y de `seccionesHome`.

**EL "OJO" (toggle de visibilidad) NO SE CONSTRUYÓ, y es una DESVIACIÓN DEL SPEC, medida y
documentada, no un olvido.** El spec pedía "asa, ojo y un menú"; el ojo de una banda
(`config.ocultable` → `form.visible`) persiste porque esa sección YA declara `visible` en su
sub-schema de `site-content-schema.ts`. Agregar un `visible` por instancia exige declararlo en
los TRES sub-schemas de `seccionesHomeEditableSchema` (`instanciaTextoEditableSchema`/
`instanciaImagenTextoEditableSchema`/`instanciaBannerEditableSchema`) — `lib/config/site-
content-schema.ts` **no está en `touches:` de este slice**. Sin esa declaración, `z.object`
STRIPPEA el campo en silencio al guardar (§ CLAUDE.md, "El schema editable STRIPPEA lo no
declarado") y un botón de "ojo" que no persiste sería peor que no tenerlo — una apariencia de
control sin efecto real. Ver el open follow-up en `DECISIONS.md`.

**El formulario de edición** (`components/admin/editor/InstanciaEditorForm.tsx`) es BESPOKE,
armado dinámicamente desde `DESCRIPTOR_INSTANCIA[tipo]` — "reusa `TiendaSeccionEditor`-como-
PATRÓN" significó esto: la misma FORMA visual de campo (duna-field, el mismo trato de imagen con
miniatura+Cambiar+Quitar), no literalmente la función `renderCampo` de ese archivo, que tiene
casos especiales por NOMBRE de campo ajenos a este catálogo (p. ej. `campo.name === 'alto'`
también escribe `alturaLlena`, un campo que ninguna instancia tiene). Es CONTROLADO: sin estado ni
autoguardado propio — cada tecla llama a `onCambiar` con el objeto COMPLETO, y `TiendaPaginas.tsx`
es la única dueña de `seccionesHomeLocal` y su autoguardado (mismo criterio que 'orden': UN
autoguardado para el mapa completo, nunca uno por instancia).

**El reorden** (`lib/admin/orden-secciones.ts`) ensanchó `moverBandaAIndice`/
`moverBandaEnDireccion`/`moverBandaConDestino` a `<T extends string>` (preserva el tipo exacto por
llamador: `BandaId[]` sigue dando `BandaId[]`) y sumó `ordenarSeccionesConInstancias` —gemela de
`ordenarPorBanda`, que se queda intacta— para mezclar bandas e instancias en un solo `.map` de
render. `ordenLocal` en `TiendaPaginas.tsx` pasó de `BandaId[] | null` a `string[] | null`.

**`VistaTiendaIframe.tsx`** ensanchó `irASeccion`/`enviarCambio` de `SeccionVista` a `string`: el
cast `as (seccion: string, …) => void` que 'orden'/'tema'/el cromo necesitaban (porque ese archivo
estaba fuera de `touches:` cuando se escribieron) ya no hace falta para código nuevo.

**El resumen de publicar** (`lib/admin/resumen-cambios.ts`) ganó `cambiosSeccionesHome`: a
diferencia de 'orden' (un solo ítem, "cambiado"), produce UNA FILA POR INSTANCIA que cambió, con
`clave` = el id de la instancia (no `'seccionesHome'`) y la palabra en FEMENINO
("nueva"/"editada"/"eliminada", porque el sujeto es "una sección") — «Inicio · Imagen con texto ·
nueva».

**`StoreNav.tsx`** (`tipoInstancia` → `tratamientoNav` cuando `orden[0]` resuelve a una
instancia) **NO entró a `touches:` de este slice y sigue sin construirse** — límite conocido
heredado de SECCIONES-INSTANCIAS-1, sin cambios: una instancia que termine primera en la
secuencia visual sigue siendo invisible para el cálculo de darkness del nav. No se amplió el
alcance para cerrarlo.

## Hallazgo del arnés real: una instancia NO se actualiza en vivo (sin recargar) — fuera de `touches:`

El arnés de sesión real (`.scratch/verificar-agregar-seccion.ts`, gitignored) escribió el título
de la instancia nueva y esperó verlo EN VIVO en el iframe, sin recargar — el mismo contrato que ya
cumple cualquier banda (editar el título del hero se ve al teclear, sin F5). **Falló**: el título
seguía mostrando el default hasta forzar una recarga del iframe.

**Causa, confirmada por lectura de código, no supuesta:** `app/(storefront)/page.tsx` (Server
Component, fuera de `touches:`) pasa `instancia={seccionesHome[id]}` como PROP fija al dispatcher
`SeccionInstancia`, y los tres componentes (`Texto`/`ImagenTexto`/`Banner.tsx`, también fuera de
`touches:`) leen esa prop directamente para `titulo`/`texto`/`imagen`/CTA — nunca
`useSiteContent().seccionesHome[id]`. Toda BANDA hace lo contrario: `page.tsx` sólo le pasa `style`
(el esquema de color) y el componente lee su propio contenido del hook `useSiteContent()`, que SÍ
es reactivo al mensaje `postMessage` que el puente en vivo aplica. El mecanismo RECEPTOR que
SECCIONES-INSTANCIAS-1 dejó "inerte hasta que exista UI" (`fusionarContenidoInstancia`,
`EditorPuenteVivo.tsx`) SÍ se dispara correctamente con la UI de esta tanda — el mensaje llega, se
valida contra el sub-schema, y se fusiona en el context — pero ningún componente del storefront lo
LEE para una instancia, así que el context se actualiza sin que nada lo muestre.

**Confirmado que el código de ESTA tanda no es la causa:** `cambiarInstancia`/
`enviarInstanciaIframe` (`TiendaPaginas.tsx`) espejan EXACTO el camino ya existente de una banda
(`manejarCambioSeccion`/`enviarCambio`) — mismo tipo de mensaje, mismo payload (el objeto completo).
El defecto vive enteramente en los TRES componentes heredados y el Server Component que los monta,
los cuatro fuera de `touches:` de este slice.

**No se corrigió** (fuera del alcance declarado; `components/storefront/secciones/*.tsx` y
`app/(storefront)/page.tsx` no están en `touches:`). El arnés se ajustó para verificar
PERSISTENCIA (recarga forzada del iframe tras el autoguardado) en vez de "en vivo sin recargar" —
la mutación en sí SÍ guarda y publica correctamente; lo que no funciona es sólo el reflejo
instantáneo en el iframe mientras se edita. Abierto en `DECISIONS.md` como
`SECCION-INSTANCIA-SIN-LIVE-UPDATE-1`.

## Guarda de re-entrada síncrona en `agregarSeccion`/`duplicarInstancia`/`eliminarInstancia`

`tipoInsertando` (estado de React) por sí solo no cierra la re-entrada del MISMO tick —
§ CLAUDE.md "Doble-submit — la mitad SÍNCRONA": dos clicks seguidos sobre la misma tarjeta de la
biblioteca, o un "Duplicar" disparado dos veces antes del primer re-render, leerían ambos el
mismo valor de estado (`false`) y pasarían los dos. Se agregó `mutacionCompuestaEnVueloRef`
(`useRef<boolean>`), compartido por las TRES mutaciones compuestas porque son mutuamente
exclusivas (las tres escriben la misma fila vía `aplicarMutacionCompuesta`): chequeado y puesto en
`true` de forma SÍNCRONA al inicio de cada función, liberado en un `finally`. `tipoInsertando`
se queda como la mitad VISIBLE (tarjetas deshabilitadas + "Agregando…") para `agregarSeccion`;
`duplicarInstancia` no la necesita porque el ítem de menú que la dispara se cierra solo al
elegirse (§ CLAUDE.md, "La FRONTERA del patrón: guarda donde el silencio invita al reintento" —
un control que ya desapareció de la pantalla no invita a un segundo click).

## El «+» del LIENZO (§ EDITOR-AGREGAR-SECCION-LIENZO-1) — el mismo gesto, desde la vista previa

`EDITOR-AGREGAR-SECCION-1` dejó el «+ Agregar sección» como un control de la LISTA (el separador
entre tarjetas y el botón de pie). Este slice agrega el mismo gesto sobre el LIENZO —la vista
previa real dentro del `<iframe>`, al estilo Shopify—: acercar el mouse al borde entre dos
secciones (o después de la última) revela una línea con una pastilla «+», que abre la MISMA
biblioteca en la MISMA posición.

**Dibujado DENTRO del documento del iframe, por `EditorPuenteVivo.tsx` — nunca por el storefront
ni por `VistaTiendaIframe.tsx`.** Es chrome EFÍMERO superpuesto por JS, la misma familia que la
selección en contexto, el campo flotante y la barra de estilo que ese archivo ya construye —
nunca un marcado que `app/(storefront)/page.tsx` (fuera de `touches:`) tenga que emitir.

### Insertado como SIBLING real — no un overlay medido

A diferencia del campo flotante o la barra de estilo (que SÍ necesitan `getBoundingClientRect` +
`ResizeObserver` porque flotan SOBRE un nodo ajeno), el separador «+» se inserta DIRECTO en el DOM
como hermano entre dos `[data-editor-seccion]` (`nodo.insertAdjacentElement('afterend', …)`). Sigue
el flujo del documento gratis — sin medir, sin `ResizeObserver`, sin listeners de `scroll`/`resize`:
si una sección crece o la ventana cambia de ancho, el separador se mueve solo porque es parte del
layout.

Es seguro por la MISMA razón que el branch `seccion === 'orden'` ya reordena nodos con
`appendChild`: `Home` es un Server Component, su árbol nunca se reconcilia del lado del cliente, así
que insertar nodos ajenos a React en ese contenedor no entra en conflicto con ningún re-render
futuro — no hay ninguno.

**Descubierto por DOM, no por `useSiteContent().orden`.** El context queda RANCIO tras un reorden
en vivo (el branch `'orden'` mueve nodos sin tocar el context, por diseño — ningún band lee
`content.orden` reactivamente). `hero` (`ocultable:false`, siempre presente en home) es el ANCLA
para encontrar el contenedor compartido — el MISMO truco que ya usa el branch de reorden para saber
dónde mover. En `nosotros`/`suscripciones` (sin `hero`, sin `orden`/`seccionesHome`) no hay
contenedor que encontrar, y el mecanismo no pone nada — no hay biblioteca que ofrecer ahí.

`sincronizarSeparadoresAgregar(navegando)` retira TODOS los separadores viejos y, si el modo
Navegar está apagado, los vuelve a poner en el orden actual del DOM. Se llama en tres momentos: al
activarse el puente, tras cada reordenamiento en vivo (`seccion === 'orden'`, las posiciones
cambiaron), y al alternar el modo Navegar (que los retira del todo — un visitante real, aunque sea
el propio dueño probando la tienda, no debe ver afordancias de edición).

### El clic no pasa por React — mismo mecanismo que la zona del hero y el campo-imagen

El botón insertado NO lleva `onClick`. Lo resuelve el MISMO listener de captura sobre `document`
que ya intercepta todo clic en modo selección (`[data-editor-zona-campo]`/
`[data-editor-campo-imagen]`/`[data-editor-campo]`), leyendo el atributo
`ATRIBUTO_EDITOR_AGREGAR_SECCION` (`lib/storefront/editor-puente.ts`) directo del nodo clickeado y
posteando el mensaje — consistente con cómo YA funciona todo lo demás que este componente inserta o
marca. Se revisa PRIMERO en la cadena (antes de zona/campo-imagen/campo): el separador vive FUERA
de cualquier sección marcada, así que nunca ambigua con los otros, pero documentar el orden deja
claro que es la capa más externa del lienzo.

### El DÉCIMO mensaje del puente — `despuesDe` YA es el id que `abrirBiblioteca` necesita

`TIPO_MENSAJE_AGREGAR_SECCION` (`{ tipo, despuesDe }`, iframe→panel) es el único de los diez
mensajes del puente que NO reusa `TIPO_MENSAJE_CONTENIDO_SECCION` — no hay contenido que fusionar,
sólo una posición que abrir. `despuesDe` viaja como el marcador `data-editor-seccion` de la sección
que precede al borde clickeado, y es EXACTAMENTE el id que `TiendaPaginas.tsx` (`abrirBiblioteca`/
`ordenLocal`) necesita, sin traducir: medido contra `tienda-secciones.ts`,
`marcadorDeSeccion(seccion) === bandaId` para las ocho bandas con `bandaId` (todas salvo
`spotlight`, cuyo `bandaId` es `'featured'`, el mismo marcador que comparte). `seccionDesdeMarcador
('featured')` en cambio resolvería a `'spotlight'` —el nombre de `SeccionVista`, no el
`bandaId`—, así que este mensaje NO pasa por esa función: hacerlo introduciría el bug que esta
nota previene.

`VistaTiendaIframe.tsx` gana el prop `onAgregarSeccion?: (despuesDe: string) => void` y reenvía el
mensaje TAL CUAL (sin resolver); `TiendaPaginas.tsx` lo conecta directo a `abrirBiblioteca` — la
MISMA función que ya usan el separador y el botón de la lista, así que el «+» del lienzo nunca
puede abrir la biblioteca en una posición distinta de la que su equivalente de lista abriría.

### Teclado y afordancia

El botón es un `<button>` real insertado en el flujo normal del documento: alcanzable con Tab
igual que cualquier otro control de la página, sin tabindex especial. Visible en hover O foco
(`:hover`/`:focus-within` sobre el envoltorio, `:focus-visible` sobre el propio botón) — la misma
regla de revelado que `SeparadorAgregar.tsx` (el separador de la lista) aplica con estado de React,
acá con CSS puro inyectado por el propio componente (el mismo `<style>` que ya pinta el outline
punteado de la selección). Sólo existe mientras el modo Navegar está apagado: con Navegar encendido
la tienda se usa como un visitante real, y el afordance desaparece con el resto de la selección en
contexto.

### Lo que NO cambió

Ni `BibliotecaSecciones.tsx` ni `agregarSeccion` (`TiendaPaginas.tsx`) se tocaron: el «+» del
lienzo es un SEGUNDO disparador hacia el MISMO mecanismo que `EDITOR-AGREGAR-SECCION-1` ya
construyó, no una segunda implementación. `SeparadorAgregar.tsx` (el de la lista) tampoco cambió —
los dos separadores conviven, cada uno en su superficie.

### Verificación

Capa 1: `esMensajeAgregarSeccion` (forma/validación) en `lib/storefront/editor-puente.test.ts`. El
"ida y vuelta" (iframe→panel→`abrirBiblioteca`, sin resolver el marcador) no se puede ejercitar por
ejecución sin jsdom (mismo límite que el resto de este mecanismo, § CLAUDE.md "El glob NO incluye
`*.test.tsx`") — se afirma leyendo el ARCHIVO FUENTE real de los tres componentes
(`EditorPuenteVivo.tsx`/`VistaTiendaIframe.tsx`/`TiendaPaginas.tsx`) en
`lib/admin/editor-iframe.test.ts`, el mismo patrón que ya usan los tests de
`app/(admin)/editor/layout.tsx` en ese archivo.

**`npm run verificar:nayoli:visual` midió la MISMA cifra exacta, dígito a dígito, que el piso ya
documentado como `NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`** (165052/4608000 px AA en `home`, caja
`[105,862]–[1183,3581]`; 163/361 px en las otras 5 rutas; los 2 hovers IDÉNTICO) — cero píxeles de
más atribuibles a este slice. Todo lo que este slice construye vive detrás de `activo` (el gate de
modo editor, server-side), así que un visitante real no ejecuta ni un byte de este mecanismo. La
sesión real con el arnés (Playwright, build de producción + Postgres efímero) ejercitó el escenario
completo — hover entre Hero y Destacado, clic en el «+», biblioteca abierta, Banner insertado justo
ahí — con capturas.

## TRES tipos más — Preguntas, Columnas, Filas, y el REPEATER a nivel de INSTANCIA (§ SECCIONES-TIPOS-2)

El catálogo pasó de tres tipos de campos planos a **seis**: los tres de siempre (Texto/ImagenTexto/
Banner) más **Preguntas** (acordeón pregunta/respuesta), **Columnas** (de dos a seis, con imagen
opcional/título/texto/enlace) y **Filas** (filas de imagen con texto que alternan de lado). La
UNIDAD DE EXTENSIÓN del mecanismo es nueva: hasta esta tanda `InstanciaDescriptor` sólo sabía de
`campos` planos + `escalares`; ahora declara, opcionalmente, `items` (`InstanciaItemsDef`) — un
descriptor de ÍTEM (`InstanciaItemDescriptor`, misma forma que `campos`/`imagenes`, un nivel más
adentro) más `min`/`max`, los límites que el EDITOR impone (nunca el resolver — SOFT, como
siempre). `DESCRIPTOR_INSTANCIA.{preguntas,columnas,filas}` son los tres primeros en declarar
`items`; los tres de siempre siguen sin tocar.

### El modelo — `items` se resuelve APARTE de `campos`, mismo criterio que `resolverSiteContent`

`resolverInstancia` gana una rama: si `descriptor.items`, `out.items` se resuelve con
`resolverItemsInstancia` (función LOCAL, duplicada de `resolverItems` de `site-content-defaults.ts`
por el módulo-hoja de siempre — ver el docstring de cabecera del archivo). SOFT en los dos sentidos:
un `items` que no es array da `[]` (nunca inventa ítems), un ítem no-objeto se descarta, cada campo
declarado se normaliza a string. `min`/`max` NO los aplica el resolver — son de CURADURÍA del
editor, igual que el tope de la galería de /nosotros.

**`instanciaEsVisible` gana la mitad de hide-on-empty**, GEMELA de `seccionEsVisible` para una
sección repeater del REGISTRY: `items:[]` oculta la instancia aunque `visible` sea `true`
explícito — mismo orden de precedencia (hide-on-empty GANA sobre el toggle). Una instancia de
Preguntas sin preguntas, o de Columnas/Filas sin ítems, no tiene nada que mostrar.

**`imagenesDeInstancia` gana la mitad REPEATER-AWARE**, gemela de `imagenesDe`
(`site-content-blobs.ts`) para una sección repeater del REGISTRY: además de los campos-imagen a
nivel de INSTANCIA (`descriptor.imagenes`, como ya tenían ImagenTexto/Banner), ahora también junta
los campos-imagen de CADA ítem (`descriptor.items.descriptor.imagenes`) — Columnas y Filas
declaran `imagen` por ítem. Sin esto, una foto de columna o de fila en USO se vería huérfana al
borrado de blobs la próxima vez que se reemplazara. `tests/integracion/secciones-instancias.test.ts`
afirma el viaje completo (reemplazar la imagen de UN ítem en el borrador no la borra hasta publicar;
publicar SÍ deja huérfana la vieja) sobre `columnas`, que cubre el caso representativo (es el único
de los tres con `min`/`max` DEL editor y con imagen por ítem — Preguntas no tiene imagen, Filas
comparte el mismo mecanismo que Columnas sin el piso/tope).

**`instanciaEsUniforme` gana `filas` al lado de `imagenTexto`** (las dos NO uniformes, para el
cálculo de darkness del nav flotante): Filas reusa `ImagenTexto` fila por fila, así que es AÚN más
heterogénea que una sola `imagenTexto` — nunca un solo tono de borde a borde. `instanciaOscuraCanonica`
no cambió: ninguno de los tres tipos nuevos es oscuro por canónica (sólo `banner` lo es).

### Los campos de cada tipo

| Tipo | Cabecera (instancia) | Campos del ÍTEM | `min`/`max` del editor |
| --- | --- | --- | --- |
| `preguntas` | `titulo` (opcional) | `pregunta`*, `respuesta`* | 0 / sin tope |
| `columnas` | `titulo` (opcional) | `imagen`, `titulo`*, `texto`, `enlace` | **2 / 6** |
| `filas` | `titulo` (opcional) | `imagen`, `titulo`*, `texto`, `ctaLabel`, `ctaDestino` | 0 / sin tope |

(* = `requerido` en el descriptor — asterisco en el editor, nunca enforcement del resolver.)

`DEFAULTS_INSTANCIA` siembra los tres con **DOS ítems de ejemplo**, texto neutro (sin café, sin
Nayoli) y SIN imagen — ni uno (que haría a la biblioteca mostrar una tarjeta vacía por
hide-on-empty) ni tres (no hace falta más para que el patrón de cada tipo — la alternancia de
Filas, el mínimo de Columnas — ya se vea al agregar la sección). **Esto NO es el caso de #44**
(prueba social fabricada): una pregunta o una columna de ejemplo no afirman nada falso del negocio,
al revés que un testimonio o una reseña — es el mismo "Un título para esta sección" que Texto/
ImagenTexto/Banner ya traían, llevado a un repeater.

`enlace` (Columnas) es la ÚNICA novedad de schema: **la columna ENTERA es el link** (no hay un
"enlaceLabel" separado), así que `resolverCtaSeccion(col.titulo, col.enlace, paginas)` se reusa
pasándole el TÍTULO como label — el mismo criterio OR/callar-si-no-hay-destino que cualquier otro
CTA de sección, sin inventar una segunda función. El schema (`instanciaColumnaItemSchema`) valida
`enlace` contra el MISMO `MENU_CTA_DESTINOS` que todo `ctaDestino`.

### El editor — `InstanciaItemsEditor.tsx`, NO `RepeaterEditor.tsx`

`components/admin/RepeaterEditor.tsx` (el repeater genérico que ya usan Testimonios/galería) **no
está en `touches:` de este slice** y, más allá de eso, le falta justo lo que Columnas necesita: un
PISO (`min`) que impida bajar de dos — sólo tiene `max`. Se escribió un editor PROPIO,
`components/admin/editor/InstanciaItemsEditor.tsx`, con el MISMO patrón visual (renglón-resumen
colapsado + expandir, flechas para reordenar, papelera con confirmación vía `ConfirmDescartarDialog`
— nunca un borrado directo) pero agnóstico de nombre de campo (como `InstanciaEditorForm.tsx` ya lo
es para los campos planos): lee `descriptor.campos`/`imagenes` y arma el formulario del ítem desde
ahí, con dos listas CERRADAS por NOMBRE (`enlace`/`ctaDestino` → select de destino;
`respuesta`/`texto` → textarea) — no hay más de estos seis nombres en los tres tipos de hoy, así que
una lista fija alcanza sin una config aparte.

- **"Agregar" con campo-imagen SUBE PRIMERO** (mismo criterio que `RepeaterEditor`): Columnas/Filas
  abren el selector de archivos real al agregar; un ítem-imagen vacío sería una foto rota. Preguntas
  (sin imagen) agrega directo.
- **La papelera se DESHABILITA en el piso** (`items.length <= min`): es lo que hace cierto "de dos a
  seis columnas" — sin este guard en el EDITOR, nada impediría bajar a una.
- **Comparte el uploader** de la cáscara (`InstanciaEditorForm`'s `subida`, un solo `<input
  type=file>`) — no instancia uno propio.

### Preguntas — NO reusa `PreguntasFrecuentes.tsx`: DESVIACIÓN MEDIDA del spec

El spec pedía "reusá el marcado y la accesibilidad de `PreguntasFrecuentes` (pasándole props, no
copiándolo)". Medido ANTES de escribir código: `components/storefront/PreguntasFrecuentes.tsx`
(la FAQ de `/suscripciones`) vive **fuera** de `components/storefront/secciones/` — el único
directorio de este slice en `touches:` para el storefront — y además **hoy no es desplegable**: es
una lista estática que SIEMPRE muestra pregunta y respuesta (`suscripcionFaq.items.map` sin ningún
`useState` de expand/collapse). Satisfacer el spec al pie de la letra (pasarle props a esa función
para que la nueva sección la reusara) habría exigido **editar un archivo fuera de `touches:`** —
fuera del alcance que la aprobación cubre.

`components/storefront/secciones/Preguntas.tsx` es, por tanto, un componente PROPIO: reusa el
MISMO vocabulario visual (la tarjeta `bg-[var(--sf-tarjeta)]` con `sf-borde border-[var(--sf-linea)]`,
el mismo patrón `--sf-sobre-tarjeta(-suave)` para el texto DENTRO de la tarjeta — el par floreado
contra `--sf-tarjeta`, no `--sf-sobre-banda`, siguiendo el precedente de `TestimonialSection.tsx`) y
AGREGA la parte que el spec pedía y que `PreguntasFrecuentes` no tiene: cada pregunta es un
`<button aria-expanded aria-controls>` con su panel `role="region" aria-labelledby`, el patrón de
acordeón accesible que ya usa `FiltrarOrdenar.tsx` en otra parte del storefront.

**Open follow-up, para la próxima vez que se toque `PreguntasFrecuentes.tsx`:** ese archivo podría
refactorizarse para aceptar `titulo`/`items` por props y volverse desplegable también, y entonces
`SeccionPreguntas` pasaría a llamarlo en vez de duplicar el vocabulario visual — unificando las dos
FAQ del storefront en una sola implementación. No se hizo acá porque el archivo está fuera de
`touches:`; queda anotado en `DECISIONS.md`.

### Columnas — en móvil SE APILAN, no un carrusel (decisión medida)

"De dos a seis columnas" en una pantalla angosta exige una respuesta, y el spec pedía decir cuál y
por qué. **Se apilan** (`grid-cols-1` → `md:grid-cols-{2..6}`, lookup LITERAL —
`GRID_COLS_COLUMNAS`— para que el JIT de Tailwind vea las clases, mismo criterio que
`gridColsPresentaciones`): es exactamente lo que YA hacen Presentaciones (2-4) y la galería de
/nosotros (hasta 12) en la misma situación. **Ningún componente del storefront de hoy implementa un
carrusel horizontal** (scroll-snap, indicador de página, gestos táctiles, accesibilidad de scroll)
— construir uno sería un mecanismo nuevo para un problema que apilar ya resuelve sin código extra,
desproporcionado para esta tanda.

### Filas — reusa `SeccionImagenTexto`, LITERALMENTE, fila por fila

"Reusá el componente de Imagen con texto" se tomó al pie de la letra: `SeccionFilas` NO reimplementa
el layout imagen+texto — por cada ítem, arma un objeto `InstanciaImagenTextoContent` SINTÉTICO
(mismos campos que la interfaz real, `lado` alternando por PARIDAD del índice —nunca un campo que
el dueño elija, el spec dice "alternan de lado fila por fila"— y `antetitulo: ''`, que Filas no
tiene) y lo pasa a `<SeccionImagenTexto id={`${id}.items.${i}`} instancia={sintetica} style={style}
/>` tal cual. Es el MISMO componente que renderiza una instancia `imagenTexto` real — no una copia.

El `id` sintético (`${id}.items.${i}`) es la parte que lo hace funcionar sin que `Filas.tsx` sepa
nada de `campo-editable.ts`: `ImagenTexto.tsx` ya construye sus rutas de campo como `${id}.titulo`/
`${id}.imagen`, así que con ese id la ruta resultante es `${id}.items.${i}.titulo` —exactamente la
forma `items.N.subcampo` que `fusionCampoEditable`/`parsearRutaCampo` (fuera de `touches:`) ya saben
leer, sin que este slice toque esos archivos.

**El `style` (el esquema de color) se pasa a CADA fila**, no a un `<section>` envolvente propio:
Filas no tiene UN `<section>` compartido — cada `SeccionImagenTexto` trae el suyo — así que para
que el título opcional y las N filas compartan el mismo tinte, `style` viaja a cada llamada.

### Lo que NO entró en esta tanda

Ninguno de los tres tipos nuevos tiene campo de VIDEO (el spec no lo pidió para ninguno): la mitad
"...y videos incluidos en la limpieza de blobs" del checklist general queda VACUAMENTE satisfecha
—no hay campo de video que limpiar—, no ignorada.

### Verificación

Capa 1 (`lib/config/secciones-instancias.test.ts`, `site-content-schema.test.ts`,
`site-content-blobs.test.ts`) y carril (`tests/integracion/secciones-instancias.test.ts`, el viaje
completo de `columnas` con ítems + imagen por ítem) — ver sus propios asientos de prueba para el
detalle. `npm run gate` verde en las dos capas.

**`npm run verificar:nayoli` (byte-exacto, HTML+CSS) NO dio diff vacío — medido, y la causa NO es
este slice.** El primer y segundo punto de divergencia (`lang="en"` vs `"es"`, `quality=75` vs `85`)
se verificaron contra `git log` y resultaron ser de COMMITS ANTERIORES a este slice
(`25e2671 METADATA-ICONOS-Y-LANG-POR-TIENDA-1`, 2026-10-01, y la config de `next.config.ts`) — la
rama venía con drift acumulado de `slice/corte-reescritura-prototipo-1` desde antes de que esta
tanda empezara. La prueba de que el HTML/CSS real de Nayoli no cambia por este slice es la OTRA
mitad, la que SÍ tiene un piso documentado: **`npm run verificar:nayoli:visual` midió la MISMA
cifra exacta, dígito a dígito, que `NAYOLI-HOME-DRIFT-RAMA-PREEXISTENTE-1`** (165052/4608000 px AA
en `home`; 163/361 px en las otras 5 rutas; los 2 hovers IDÉNTICO) — cero píxeles de más
atribuibles a `SECCIONES-TIPOS-2`. Confirmado también por lectura: cero apariciones de `inst:` y de
las clases nuevas (`grid-cols-5`, `rotate-180` sobre el chevron de Preguntas) en el HTML/CSS de
Nayoli renderizado — los tres tipos nuevos nunca se ejecutan sin una instancia, y Nayoli no tiene
ninguna.

La sesión real con el arnés (Playwright, build de producción + Postgres efímero,
`.scratch/verificar-secciones-tipos-2.ts`) agregó los TRES tipos desde la biblioteca, verificó los
dos ítems de ejemplo, editó el título, agregó un tercer ítem (con su imagen para Columnas/Filas,
vía el selector de archivos real) y publicó — con capturas en escritorio y teléfono, Chromium y
WebKit, y a mitad de scroll (las tres secciones usan `RevelarBloque`/`whileInView`). **Hallazgo de
método, para el próximo arnés que capture una página completa con contenido animado: un
`fullPage: true` de un solo resize NO dispara los `IntersectionObserver` de framer-motion para todo
el alto de la página — hace falta un SCROLL REAL en pasos del viewport antes de la captura
(`scrollearYAsentar`, la técnica que `scripts/verificar-nayoli-visual.ts` ya documentaba y este
arnés no había copiado en su primer intento — la primera corrida mostró grandes huecos en blanco,
incluido en "featured", una banda que este slice ni toca).
