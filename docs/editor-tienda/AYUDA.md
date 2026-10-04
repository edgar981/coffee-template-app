# El centro de ayuda del editor (§ EDITOR-AYUDA-1)

Este documento es para quien TOQUE el editor después de hoy, no para el dueño de la tienda — las
guías mismas ya están escritas en su idioma (`lib/admin/ayuda-editor.ts`). Lo que sigue es el
contrato: dónde vive el contenido, cómo se conecta a los niveles del panel, y qué hacer cuando el
editor cambie para que una guía no quede describiendo algo que ya no existe.

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
