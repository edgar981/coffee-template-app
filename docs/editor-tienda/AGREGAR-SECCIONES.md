# Agregar secciones al home — el mecanismo (§ SECCIONES-INSTANCIAS-1) y la UI (§ EDITOR-AGREGAR-SECCION-1)

Este documento describe el MECANISMO que SECCIONES-INSTANCIAS-1 construyó (el modelo, el
resolver, el schema, el render y el plumbing del editor en vivo) y la UI que EDITOR-AGREGAR-
SECCION-1 le agregó encima: el botón "Agregar sección", la biblioteca con vista previa, las
tarjetas con asa/menú, y el formulario de edición. El estado "sin UI de admin todavía" quedó
cerrado — lo que sigue describe el mecanismo (sin cambios) y, en su propia sección, la UI.

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
