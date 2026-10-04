# Agregar secciones al home — el mecanismo (§ SECCIONES-INSTANCIAS-1)

Este documento describe el MECANISMO que este slice construyó: el contenido puede declarar
INSTANCIAS de un catálogo curado de tres tipos genéricos (Texto, Imagen con texto, Banner) y
mezclarlas en el orden del home junto con las bandas de siempre. **No hay UI de admin todavía
para agregar una instancia desde el panel** — ese es el trabajo de la tanda siguiente. Lo que
existe hoy es el modelo, el resolver, el schema, el render y el plumbing del editor en vivo,
todo sin UI que lo dispare.

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

## El plan — qué falta para "agregar sección" desde el panel

1. **El editor de `/admin/tienda` gana un selector de "+ Agregar sección"** que ofrece el
   catálogo curado (Texto / Imagen con texto / Banner), crea un id con `INSTANCIA_PREFIJO` +
   un sufijo único, y escribe la instancia en el borrador vía el mismo flujo de
   borrador/publicar que cualquier sección.
2. **El editor de contenido de una instancia** reusa `TiendaSeccionEditor`-como-patrón, armado
   DINÁMICAMENTE desde `DESCRIPTOR_INSTANCIA[tipo]` en vez de un `SeccionConfig` fijo escrito a
   mano — es la razón de que el descriptor declare `campos`/`imagenes`/`escalares` en una forma
   genérica, lista para ese consumo.
3. **El reorden** (`TiendaPaginas.tsx`, `lib/admin/orden-secciones.ts`) ensancha su tipo de
   `BandaId[]` a `string[]` para aceptar instancias — ver el docstring de cabecera de
   `orden-secciones.ts` para por qué NO se hizo en este slice (rompería la compilación de
   `TiendaPaginas.tsx` hoy, que no está en `touches:`) y por qué el mecanismo de abajo (mover un
   valor dentro de un array corto) no necesita cambiar, sólo su tipo.
4. **`StoreNav.tsx`** pasa `tipoInstancia` a `tratamientoNav` cuando `orden[0]` resuelve a una
   instancia — una línea, una vez que ese archivo entre a `touches:` de la tanda que construye
   el punto 1.
5. **Borrar una instancia**: quitarla de `seccionesHome` (borrador) y de `orden` si estaba
   explícita — el resolver ya tolera un id huérfano en `orden` (se descarta), así que no hace
   falta limpiar `orden` atómicamente con `seccionesHome`.

Ninguno de estos cinco puntos requiere cambiar el modelo, el resolver o el schema que este
slice construyó — son, los cinco, trabajo de UI sobre un mecanismo que ya existe.
