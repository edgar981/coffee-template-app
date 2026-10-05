# El centro de ayuda del editor (§ EDITOR-AYUDA-1, § EDITOR-AYUDA-RECORRIDO-1)

Este documento es para quien TOQUE el editor después de hoy, no para el dueño de la tienda — las
guías mismas ya están escritas en su idioma (`lib/admin/ayuda-editor.ts`). Lo que sigue es el
contrato: dónde vive el contenido, cómo se conecta a los niveles del panel, y qué hacer cuando el
editor cambie para que una guía no quede describiendo algo que ya no existe.

**Dos piezas, dos propósitos.** El centro de ayuda (§ arriba) es la REFERENCIA — se consulta
cuando algo puntual se olvidó. El recorrido guiado (§ más abajo, "El recorrido guiado") es el
REPASO de la capacitación — un paseo corto, de principio a fin, para quien recién abrió el editor
o quiere refrescar el panorama completo. No son la misma pieza con dos entradas: una se busca, la
otra se sigue.

## Por qué existe

Pedido del owner (2026-10-04): quien capacitó a alguien en el editor no puede estar al lado cada
vez que se le olvida un paso. «Ayuda» en el riel abre un centro de ayuda DENTRO del propio panel
— buscador, guías cortas por tema, preguntas frecuentes, atajos de teclado — y cada nivel del
panel tiene un «?» que lleva directo a la guía de ese tema.

## Dónde vive el contenido

Todo el contenido es DATO PURO en `lib/admin/ayuda-editor.ts` — sin React, sin `'use client'`,
igual que `tienda-secciones.ts`/`secciones-instancias.ts`. Los componentes (`components/admin/
editor/AyudaCentro.tsx`, `IlustracionAyuda.tsx`) sólo lo RENDERIZAN; no hay copy en el JSX.

- **`GUIAS_AYUDA`** — las nueve guías (`TemaAyudaId`): Primeros pasos, Editar textos, Fotos y
  videos, Secciones, El hero, Estilo, Encabezado/menú y pie, Ver en el teléfono y tableta,
  Publicar. Cada una tiene `titulo`, `resumen` (una línea, para la fila y el resultado de
  búsqueda), `pasos` (texto corto + una `secuencia` opcional de etiquetas para la mini
  ilustración), `palabrasClave` (para el buscador) y `niveles` (qué «?» del panel la abre).
- **`PREGUNTAS_FRECUENTES`** — id, pregunta, respuesta, palabras clave opcionales.
- **`ATAJOS_TECLADO`** — sólo los que EXISTEN de verdad, medidos en el código
  (`EditorTiendaPantallaCompleta.tsx` y `EditorPuenteVivo.tsx` implementan el MISMO par —
  deshacer/rehacer, dentro y fuera del lienzo). No se inventan atajos para parecer completos.

## Cómo un «?» encuentra su guía — `temaDeNivel`, no un mapa a mano

Cada guía declara `niveles: string[]` — los niveles del panel cuyo «?» debe abrir ESA guía.
`temaDeNivel(nivel)` DERIVA el mapa inverso (nivel → guía) de esa misma lista; no hay un segundo
mapa escrito a mano que pudiera divergir (la misma regla que ya rige en este repo: "cuando dos
declaraciones describen el mismo conjunto, o una deriva de la otra o hay un test que las ata").

`NIVELES_PANEL` — el conjunto contra el que `ayuda-editor.test.ts` valida que ninguna guía apunte
a un nivel inexistente — se arma de CUATRO fuentes:

| Fuente | De dónde sale | Por qué no se deriva solo |
| --- | --- | --- |
| `'inicio'`, `'estilo'` | literales fijos | son niveles META sin registry propio |
| `'encabezado'`, `'menu'`, `'footer'` | literales fijos, calcan `CromoKey` (`TiendaPaginas.tsx`) | `CromoKey` no se exporta hoy |
| `'titular'`, `'subtitulo'`, `'botones'`, `'indicador'` | literales fijos, calcan `ZonaHeroKey` (`TiendaSeccionEditor.tsx`) | tampoco se exporta |
| el resto | `SECCIONES_TIENDA.map(c => c.seccion)` | SÍ se deriva — una sección nueva entra sola |

Un nivel de contenido que NO es el hero (brandStory, presentaciones, testimonios, el cromo…) cae
en la guía genérica **Secciones**, no en una guía propia — habría sido ~14 guías casi idénticas
para ~14 secciones que se editan todas igual (tocar, escribir, publicar).

## Dónde vive el «?» en el panel — tres sitios, tres mecanismos

El «?» no es un solo componente reusado tres veces: cada nivel lo muestra por el camino que ya
tenía para mostrar algo más, no uno nuevo.

1. **Cualquier sección de contenido o de cromo (hero incluido)** — la miga GLOBAL «‹ Inicio»
   (`TiendaPaginas.tsx`, una sola instancia para los ~15 niveles) ganó un `onAyuda` opcional en
   `Migas.tsx`. El llamador resuelve `temaDeNivel(nivelActivo)` una sola vez; el componente no
   sabe de temas, sólo recibe un callback.
2. **El nivel de elemento del hero** (Titular/Subtítulo/Botones/Indicador) — la miga LOCAL «‹
   Hero» de `TiendaSeccionEditor.tsx` (otra instancia de `Migas`, § su propio docstring) recibe
   el mismo `onAyuda`, fijo a `'hero'` — las cuatro zonas comparten una sola guía.
3. **Inicio y Estilo** (los dos únicos niveles SIN miga, porque no hay "arriba" al que volver) —
   cada uno monta su propio botón `duna-btn--icon` junto a su título, directo en
   `TiendaPaginas.tsx`. El de Estilo vive en un envoltorio `position:relative` ALREDEDOR de
   `<PaletaSeccion>`, no DENTRO: ese componente está fuera de `touches:` de este slice y se queda
   bespoke, mismo criterio que ya lo mantenía así antes de este slice.

Los tres casos llaman a la MISMA función (`abrirAyuda`, dueña de `ayudaAbierta` dentro de
`TiendaPaginas`), que hace dos cosas: fija qué guía mostrar (estado LOCAL de este componente) y
avisa al padre (`onAbrirAyuda`, `EditorTiendaPantallaCompleta.tsx`) para que ponga `modo: 'ayuda'`
— `modo` es del padre, no de `TiendaPaginas` (mismo patrón que ya regía `'tema'`).

## Cuándo actualizar una guía — la regla es DEL MISMO SLICE

**Quien cambie el comportamiento del editor actualiza la guía correspondiente en el MISMO
slice**, no en uno aparte "de documentación" después. Una guía que describe un paso que el
editor ya no hace es peor que no tener guía — le dice al dueño de la tienda algo falso con toda
la autoridad de "esto es lo que hace tu panel".

Casos concretos, para que sea mecánico y no haya que redescubrir el criterio cada vez:

- **Cambia un nombre visible** (un botón, un label, una composición) → buscar ese texto literal
  en `ayuda-editor.ts` (`grep` simple) y actualizarlo en el paso/pregunta que lo cite.
- **Se agrega o se quita una composición del hero, una zona, un paso de "Alto"/"Oscurecer"** →
  revisar la guía `'hero'` entera, no sólo el paso que parece tocado — los pasos narran una
  secuencia y uno solo desactualizado rompe la lectura de los demás.
- **Se agrega una sección NUEVA a `SECCIONES_TIENDA`** → no hace falta tocar nada acá: cae sola
  en los `niveles` de la guía `'secciones'` (§ arriba, la tabla de `NIVELES_PANEL`) y el test lo
  confirma solo.
- **Se agrega un atajo de teclado NUEVO** → agregarlo a `ATAJOS_TECLADO` en el MISMO commit que lo
  cablea, nunca antes (un atajo documentado que todavía no existe es la misma mentira al revés).
- **Un nivel del panel se RENOMBRA o se ELIMINA** (p. ej. si "Botones" del hero se separa en dos
  zonas) → `ayuda-editor.test.ts` falla solo si la guía sigue nombrando un nivel que ya no está en
  `NIVELES_PANEL` — córralo (`npm test -- lib/admin/ayuda-editor.test.ts`) antes de dar el cambio
  por terminado.

## El recorrido guiado (§ EDITOR-AYUDA-RECORRIDO-1)

Pedido del owner (2026-10-04, el mismo pedido que abrió `EDITOR-AYUDA-1`): quien capacita a alguien
en el editor no puede repetir la capacitación cada vez que esa persona vuelve a abrirlo. El
recorrido es ese repaso — siete partes, una a la vez, con una frase corta cada una — pensado para
durar alrededor de un minuto si se lee sin apurarse.

### Dónde vive el contenido

**`lib/admin/recorrido-editor.ts`** — dato puro (sin React) + la geometría pura del resaltado:

- **`PASOS_RECORRIDO`** — los siete pasos, EN ORDEN: lienzo, panel, el hero y sus zonas, agregar
  sección, estilo, teléfono, publicar. Cada uno es `{ id, titulo, frase }`; `id` ES el valor del
  atributo que lo ubica en el DOM (§ abajo) — no hay un segundo campo que pudiera divergir.
- **`ATRIBUTO_RECORRIDO`** (`'data-tour'`) — el nombre del atributo. Un solo nombre, compartido por
  quien lo ESCRIBE (`TiendaPaginas.tsx`, `Riel.tsx`, `ResumenPublicar.tsx`,
  `EditorTiendaPantallaCompleta.tsx`) y quien lo LEE (`RecorridoEditor.tsx`).
- **`objetivoDisponible`**, **`calcularFranjas`**, **`posicionGlobo`** — la geometría del
  resaltado: si un objetivo mide algo, dónde van las cuatro franjas que lo rodean, y dónde cae el
  globo sin salirse de la pantalla. Puras, testeadas sin montar nada (`recorrido-editor.test.ts`).
- **`CLAVE_RECORRIDO_VISTO`** + **`recorridoEstaVisto`** — la marca de "ya se ofreció", en
  `localStorage` por navegador. El `get`/`set` real vive en el componente
  (`EditorTiendaPantallaCompleta.tsx`), envuelto en `try/catch` — mismo patrón que
  `CLAVE_DISPOSITIVO_EDITOR`/`dispositivoDesdeStorage` (`editor-iframe.ts`): sin storage (modo
  privado), se ofrece de nuevo la próxima vez y nada se rompe.

### Cómo se resalta una parte — el "hueco" por sustracción, no por recorte

`RecorridoEditor.tsx` busca `[data-tour="<id del paso>"]`, mide su `getBoundingClientRect()`, y
dibuja CUATRO franjas opacas (arriba/abajo/izquierda/derecha del objetivo) que rodean ese
rectángulo. Lo que queda SIN franja encima es, por construcción, la parte real de la pantalla —
nunca se toca el z-index del elemento resaltado ni el de su árbol. Un anillo (sólo borde, sin
relleno) marca el contorno; el globo (título + frase + «N de M» + Siguiente/Anterior/Saltar) se
coloca abajo del objetivo si entra, si no arriba, si no a la derecha, si no a la izquierda, y si
ninguno entra, centrado.

### Un paso SIN objetivo disponible se salta SOLO

Es el ÚNICO mecanismo de salto — el recorrido nunca fuerza `modo`/`pagina`/`nivelActivo` para que
un paso aparezca; refleja el editor tal como está. `objetivoDisponible` trata un rect 0×0 igual
que un elemento ausente del DOM (`display:none` colapsa el rect, no lo retira del árbol) — las dos
cosas cuentan como "no disponible ahora". Dos casos reales, nombrados para que no se re-diagnostiquen:

- **"El hero y sus zonas" / "Agregar sección"** no existen fuera de Inicio de la página home (sin
  un nivel abierto). Si el recorrido arranca con una sección ya abierta, estos dos pasos se saltan.
- **"Publicar"** (`ResumenPublicar.tsx`) sólo EXISTE en el DOM cuando hay algo pendiente de
  publicar (`if (pendientes === 0) return null`). En un editor recién abierto, sin cambios, ese
  paso se salta siempre — comportamiento CORRECTO, no un hueco: resaltar un botón ausente sería
  peor que omitirlo. Verificado de punta a punta en el arnés real (§ abajo): avanzar desde el
  último paso disponible, sin "Publicar" en pantalla, cierra el recorrido solo — el mismo camino
  que el botón "Terminar".

Al agregar un OCTAVO punto al recorrido algún día, la pregunta no es "¿existe siempre?" sino
"¿qué pasa cuando no existe?" — si la respuesta es "se salta y no rompe nada", ya está cubierto por
este mecanismo; si la respuesta es "hay que forzar el estado del editor", es una decisión nueva que
no existe hoy.

### Los dos puntos de entrada

1. **La oferta** (`OfertaRecorrido.tsx`, "¿Ves un recorrido de un minuto? Ver / Ahora no") — SÓLO
   la primera vez que una cuenta abre el editor en ESE navegador. La marca de "visto" se escribe al
   OFRECER, no al elegir un botón: una vez que el banner apareció, no vuelve a aparecer, elija lo
   que elija el dueño.
2. **"Ver el recorrido (1 min)"** dentro del centro de ayuda (`AyudaCentro.tsx`, arriba de las
   guías) — SIEMPRE disponible, sin condición. Reusa `FilaSeccion`, el mismo componente que ya
   pinta cada guía.

Los dos llaman al MISMO `iniciarRecorrido` (`EditorTiendaPantallaCompleta.tsx`), que normaliza el
punto de partida a `modo: 'paginas'` / `pagina: 'home'` — para que el lienzo y el panel muestren la
lista de Inicio en vez de Estilo/Ayuda — sin tocar `nivelActivo` (interno de `TiendaPaginas`, sin
forma de resetearlo desde afuera): si una sección ya estaba abierta, los pasos que la necesitan se
saltan solos (§ arriba), nunca se fuerza a cerrarla.

### Teclado y movimiento reducido

Flecha derecha/izquierda avanzan/retroceden (saltando los pasos sin objetivo); Esc cierra desde
cualquier punto, igual que "Saltar". `@media (prefers-reduced-motion: reduce)` en `editor.css`
apaga cualquier animación/transición de las cuatro clases del recorrido — hoy el salto entre pasos
ya es instantáneo (sin transición), así que la regla es una guarda para una futura entrada animada,
no un fix de algo que hoy se mueve.

### Cuándo actualizar — la misma regla que las guías

**Un paso que resalta algo que ya no existe, o cuyo `id`/archivo se renombró, lo atrapa
`recorrido-editor.test.ts`** (corre contra el CÓDIGO de cada archivo, sin comentarios — el repo no
tiene jsdom para `*.test.tsx`, así que no se puede verificar contra el DOM renderizado). Si un
`data-tour` se mueve de archivo o cambia de idioma de escritura (literal / `{cond ? 'id' :
undefined}` / por indirección vía prop), actualizar el mapa `PATRON_DEL_PASO` del test en el MISMO
commit — no basta con que el atributo siga existiendo en ALGÚN lado del repo.

### Verificación de sesión real

Arnés de punta a punta (`.scratch/arnes-recorrido.ts`, no comiteado): Postgres efímero, `migrate
deploy` + seed canónico, `next build`/`next start`, Playwright con sesión real
(`admin@sierranativa.co`), viewport 1440×900. 16/16 verificaciones: el ofrecimiento aparece la
primera vez y no reaparece tras recargar; los siete pasos (con sus títulos) se recorren con flecha
derecha, incluidos "Agregar sección"/"El hero y sus zonas" (sólo existen en Inicio de home);
"Anterior" retrocede; avanzar sin "Publicar" disponible cierra solo; "Ver el recorrido" desde Ayuda
reabre en el paso 1; Esc cierra a mitad de camino; "Saltar" cierra desde el principio. Capturas en
`.scratch/capturas-recorrido/` (no comiteadas): el ofrecimiento, el paso 1 (lienzo), el paso 3
(hero, con su ring sobre la fila del panel) y el paso 5 (estilo, con el globo cayendo a la derecha
del riel angosto). La dimensión del resaltado (franjas/geometría) se verificó además por PÍXEL,
no sólo visualmente: sampleado el PNG del paso 1, el área fuera del objetivo da un gris medio
(`rgb(122,121,118)`) consistente con 55% de opacidad oscura sobre el fondo crema — confirma que el
velo SÍ pinta, más allá de lo que un ojo humano puede jurar mirando una captura comprimida.

## Qué NO hacer

- **No agregar una guía por sección de contenido.** El criterio ya está escrito arriba
  («Secciones» es la respuesta genérica); una guía por sección sería ~15 guías casi idénticas que
  nadie va a mantener sincronizadas.
- **No escribir tecnicismos del código** («iframe», «borrador JSON», «slug», «modo editor»). El
  lector de esto es quien VENDE, no quien programa — «se guarda solo», «lo que ve un cliente»,
  «elegís un archivo».
- **No inventar un atajo, un formato aceptado o un tope de peso que no esté en el código.** Cada
  afirmación de este archivo (JPG/PNG/WebP, MP4/WebM/.mov, los dos atajos, el tope de video) se
  verificó contra `constants/upload.ts` y los dos `onKeyDown` reales antes de escribirse — no se
  repite de memoria la próxima vez que cambien esos límites, se vuelve a verificar.
