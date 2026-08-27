@AGENTS.md

## PRECONDICIÓN — verificación local sobre dev server reiniciado EN FRÍO

Toda verificación manual en local se corre contra un dev server **reiniciado con
`.next` limpio**. No sobre el que quedó abierto de la sesión anterior.

```bash
rm -rf .next && npm run dev
```

**El motivo es que un artefacto rancio no se ve como un artefacto rancio: se ve
como un bug en el código nuevo.** Y el diagnóstico que provoca es caro, porque
todo lo demás está correcto — la fuente, el dato, la config— así que se busca el
error en el único sitio donde no está.

Incidente 2026-08-04 (segundo fantasma de HMR de la semana): la campana no
notificaba una orden del storefront. La fuente tenía el emisor
(`app/api/checkout/route.ts`), pero `.next/dev/server/app/api/checkout/route.js`
lo traía con **cero** apariciones, mientras el MISMO servidor había compilado
`inventory/adjust` dos minutos después **sí** con el código nuevo. Un módulo
nuevo importado por una ruta ya compilada es el caso que más lo dispara.

Cómo se confirma en 10 segundos, antes de abrir cualquier otra hipótesis —
grepear el ARTEFACTO, no la fuente:

```bash
grep -c "miFuncionNueva" .next/dev/server/app/api/<ruta>/route.js
```

Cero apariciones con la fuente correcta = artefacto rancio, no bug. La fuente
nunca es evidencia de lo que el servidor está ejecutando; ése es el mismo modo de
falla que la regla de las bases de datos (§ Bases de datos): **lo que está escrito
no prueba lo que está corriendo**.

Aplica también al `AutomationSetting` de las automatizaciones y a cualquier
toggle: antes de declarar que algo "no dispara", verificar que esté ENCENDIDO en
la base, no en la memoria de quien lo miró. Una fila existente siempre gana sobre
el `defaultActivo` del registry — por diseño.

**Regla de reporte: al declarar una suite verde hay que decir explícitamente qué
capa quedó fuera** (ver § Las tres capas de verificación). Omitirlo es lo que
convirtió un dato correcto en una impresión falsa el 2026-08-04.

**Regla de reporte: todo reporte CIERRA con el estado de `main` local contra
`origin/main`** — cuántos commits adelante y cuántos atrás, aunque sea cero.

Es una línea y se pone siempre, no sólo cuando hay algo que decir. El día que se
pone sólo "cuando corresponde", vuelve a depender de que alguien se acuerde — y
acordarse es justo lo que falla. El 2026-08-05 un merge gateado se quedó local un
turno entero sin que nadie lo mencionara, y el turno siguiente el reporte habló de
"un merge sin pushear" cuando eran dos. No costó un incidente de milagro: `main`
divergido es cómo empiezan los que sí cuestan (§ Bases de datos, § GATE DE CAPA 3
— las tres son la misma pregunta, *¿qué está corriendo?*, en tres capas
distintas).

```bash
git log --oneline origin/main..main | wc -l   # adelante
git log --oneline main..origin/main | wc -l   # atrás
```

Y el push a `main` **se sigue pidiendo cada vez**, con lo que el deploy incluye
dicho en el reporte (decisión del owner, 2026-08-05: la liturgia del deploy
declarado se queda porque es barata y ya pagó). Reportar el desfase no es
autorización para cerrarlo.

### GATE DE CAPA 3 = rama declarada + server frío + verificación del artefacto

**Ningún gate manual del owner arranca sin las tres.** No es ceremonia: es el
protocolo, y las tres son la MISMA pregunta —¿qué está corriendo?— hecha en los
tres puntos donde se puede mentir.

1. **Rama declarada.** Quien monta el gate dice contra qué rama y qué commit se
   va a probar, antes de que el owner toque nada.
2. **Server frío** (`rm -rf .next && npm run dev`) y navegador recargado.
3. **Evidencia del artefacto compilado**, pegada en el reporte: el `grep -c` de
   arriba sobre el símbolo que el cambio introduce, dando distinto de cero. Y,
   cuando el cambio REEMPLAZA algo, también el grep del símbolo VIEJO dando cero
   — que el nuevo esté no prueba que el viejo se haya ido.

**El grep del símbolo viejo tiene que usar algo que el cambio BORRE, no algo que
REUBIQUE.** Es la parte que se hace mal sola. Verificando el PATCH parcial, el
primer intento grepeó `Number(body.precio)` y dio 1 — con toda la pinta de que el
código viejo seguía vivo. No lo estaba: el fix conserva a propósito el manejo de
cada valor PRESENTE, así que esa expresión ahora vive DENTRO de `datosDelPatch`.
El discriminador real era el patrón que el fix elimina de veras (el objeto
literal incondicional, `nombre: body.nombre` → 0). Un discriminador flojo miente
en las dos direcciones: da falso positivo de "artefacto rancio", y —peor— puede
dar cero por una refactorización de nombres sin que el cambio esté.

**LÍMITE CONOCIDO: rutas de cliente detrás de sesión.** El paso 3 no lo puede
hacer quien monta el gate. `/admin/*` pasa por `proxy.ts`, que responde 307 sin
sesión, así que en un build frío la página **no compila** hasta que la cargue
alguien logueado — y el artefacto no existe para grepear. En esos gates:

- quien monta el gate declara rama, server frío, y entrega el `grep` ya escrito;
- **quien tiene la sesión corre el grep en su PRIMERA carga**, antes de probar;
- y su checklist incluye **confirmar que VE el comportamiento nuevo**, no sólo
  que "funciona". Una pantalla que funciona igual que antes es indistinguible de
  una pantalla que sigue siendo la de antes — que es exactamente el modo de falla
  del 2026-08-04, donde el veredicto pareció válido porque nada se veía roto.

Incidente que lo instaura, 2026-08-04: el owner corrió el gate del PATCH parcial
(§ El PATCH de producto es PARCIAL de verdad) contra un dev server que servía la
OTRA rama, porque el fix vivía en una rama propia y nadie lo dijo. Desactivó un
producto y **ejecutó el bug original contra `development`**: la fila se vació y
el endpoint intentó borrar la portada del store (la salvó `isDeletable` por el
prefijo `dev/`, que en producción no aplica). El costo no fue solo el dato — fue
que por un rato el fix pareció roto y su test del carril pareció mentiroso,
cuando el test nunca se había ejercido.

**Un gate que no declara su build no está probando el código; está probando lo
que haya quedado.** Y el modo de falla es peor que no probar: devuelve un
veredicto con toda la apariencia de ser válido.

### Una siembra para gate CADUCA al cruzar la medianoche de Bogotá

Cuando un gate visual necesita datos —y se siembran con el método reversible
(manifiesto de ids, borrado por id exacto, § la tanda de concentración)—, esa
siembra tiene **fecha de vencimiento** si la pantalla mide "hoy". Una tarjeta,
frase o curva de scope HOY filtra por la ventana `[startOfZonedDay, +1d)` de
Bogotá; los datos sembrados con `createdAt`/`fecha` de AYER caen fuera de esa
ventana en cuanto el reloj cruza las 00:00 de Bogotá. El gate entonces ve los
estados-vacíos ("$0", "sin pedidos hoy") y **eso se lee como un bug de la
pantalla nueva cuando es sólo la siembra rancia** — la misma familia que el
artefacto rancio (§ PRECONDICIÓN): *lo que se sembró ayer no prueba la pantalla
de hoy.*

Instaurada el 2026-08-23 (rediseño del Dashboard "Hoy"): se sembró a las ~09:00
Bogotá, se verificó verde (hero $200k, curva con datos), y el gate corrió al día
siguiente contra una siembra que ya era de ayer — hero en $0. La verificación de
la siembra había sido correcta; caducó.

**Regla: si el gate no corre el MISMO día de Bogotá en que se sembró, hay que
resembrar antes** (borrar la anterior por su manifiesto para no acumular dos, y
volver a sembrar — el script ancla a `startOfZonedDay(now)`, así que re-correrlo
produce el día correcto). Y al entregar una siembra para gate, decir en qué día
de Bogotá se hizo.

## Las tres capas de verificación

Cada una mide algo que las otras no pueden, y **ninguna sustituye a las otras**.
Al reportar verde hay que nombrar la capa: "143/143" sin decir cuál no dice nada
sobre las otras dos.

| capa | cómo se corre | qué cubre |
| --- | --- | --- |
| **Reglas puras** | `npm test` (node nativo + tsx, SIN base) | predicados y cálculos: `isLowStock`, `cruzoMinimo`, `entregaVencidaSinCobro`, `moliendaAceptada`, insights, storage… |
| **Cadenas del motor** | `npm run test:integracion` (Postgres efímero) | evento → handler → run → INSERT en `Notification`, idempotencia y gates |
| **UI y flujos completos** | checklist manual del owner | pantallas, interacciones, y todo lo que cruza el navegador |

El corte no es arbitrario: **una regla pura que se testea con base es lenta sin
ganar nada, y una cadena que se testea con mocks no prueba que escriba.** El
2026-08-04 la suite pura reportaba 143/143 mientras la cadena de la campana no
escribía una sola fila; eso no fue un test mentiroso, fue una capa faltante.

### `tsc` NO es la capa que envía — para JSX/TSX la autoridad es `next build`

`tsc --noEmit` y `next build` usan **parsers distintos**: tsc el de TypeScript, el build
el de **SWC**. Un JSX que tsc ACEPTA puede romper el build, así que para cualquier cambio
que toque JSX/TSX la verificación autoritativa es `next build`, no `tsc` — un `tsc` verde
no prueba que el artefacto compile.

Caso concreto (2026-08-24): un comentario `{/* … */}` suelto en el TOP-LEVEL de un
`return` —sin un elemento JSX que lo contenga— no es JSX válido; SWC lo lee como expresión
`{…}` y se traga el elemento siguiente ("Expected '</', got 'ident'"). `tsc` dio **0
errores** y `next build` falló. Misma familia que la campana: un artefacto que pasa una
capa puede fallar en otra, y la que importa es la que envía.

### Verificar PROPAGACIÓN de un dato editable exige modo PRODUCCIÓN — dev engaña

**Un loader que LEE la base no garantiza que el valor se VEA.** Next PRERENDERIZA las rutas
estáticas al build: una ruta que lee un dato de la base sin forzar dinámica se hornea con el
valor del BUILD, y después el dato correcto en la base **convive con el dato viejo en pantalla —
sin error, sin nada rojo**. Es la familia del artefacto rancio (§ PRECONDICIÓN) subida un nivel:
no es el `.next` local, es el prerender de producción.

**La regla, la más cara del día (2026-08-25): verificar propagación exige modo PRODUCCIÓN
(`npm run build` + `npm start` + curl), NUNCA dev.** `next dev` renderiza TODO dinámico, así que
esconde el defecto: en dev el cambio SÍ se ve, y el checklist se reporta "pasa" sobre una
mentira. **Dev engaña sobre el modo de render.** El discriminador barato, antes de cualquier
prueba de runtime: **grepear el símbolo de la ruta en la salida de `next build`** —`ƒ` re-lee por
request, `○`/`●` está horneada—.

El incidente que la instaura: el checklist de propagación estaba en el gate de las DOS tandas de
contenido editable (SiteSetting y SiteContent) y **se reportó pasado sin probarse**. El storefront
salía `○` (estático) y editar el negocio o el hero no se veía en producción. Se probó tarde, con
`npm start` + curl: la home servía el default del build aunque la fila cambiara. El fix
(`force-dynamic`, § Config del contenido — la propagación) es de una línea; el costo fue el
diagnóstico y el defecto vivo en producción entre dos merges.

### El carril de integración

```bash
npm run test:integracion
```

**Prerequisito único: Postgres instalado localmente** (`brew install postgresql@14`).
El script lo dice con esa línea si falta. No hace falta Docker, ni credenciales,
ni red.

Qué hace `scripts/test-integracion.sh`: `initdb` en un temp propio → arranca en
**:55432** (puerto propio; 5432 suele estar ocupado) → `CREATE DATABASE` →
`migrate deploy` → corre `tests/integracion/**` → para el cluster y borra el
datadir. El teardown va en `trap` para que un test que revienta no deje el
cluster colgado ocupando el puerto.

Decisiones que NO son estilo:

- **Base efímera local, nunca `development`.** La comparten el `.env` local y los
  previews (§ Bases de datos): un `deleteMany` mal escrito borraría datos que
  alguien está mirando. Y se descartó la rama efímera de Neon a propósito —
  exigía una API key de larga vida con poder de crear y destruir ramas **en el
  proyecto donde vive `production`**, que es justo lo que la doctrina de este
  repo existe para no repartir.
- **Binario, no Docker.** Docker puede estar instalado con el daemon apagado, y
  entonces el comando falla pidiendo abrir Docker Desktop.
- **`-k ''` (solo TCP).** El datadir vive bajo un temp cuyo path supera los 103
  bytes que Postgres admite para un socket unix; sin esto no arranca.
- **`--test-concurrency=1`.** `node --test` paraleliza los ARCHIVOS y todos
  comparten una base: sin esto se pisan entre sí y fallan por razones ajenas al
  código.
- **Fixtures propios, NO `prisma/seed.ts`.** Ese seed arma una tienda de demo; un
  test que dependa de él falla el día que alguien ajusta la demo. Cada test
  declara las filas exactas que su cadena necesita.
- **`soloActiva(key)` en cada test.** `runScheduledAutomations` barre TODAS las
  programadas y varias declaran su hora en reloj de Bogotá: sin apagar el resto,
  un test que corriera a las 9:00 dispararía otras dos, y a las 7:00 intentaría
  mandar un correo real. Un test que pasa según la hora del día no es un test.

**SKEW DE VERSIÓN, aceptado con su condición** (owner, 2026-08-04): el carril
corre Postgres 14.20 local y producción corre la versión de Neon. Se acepta
porque el alcance son cadenas del motor —CRUD, uniques, enums—, no SQL exótico, y
porque las 34 migraciones aplican limpias en 14. **Si el carril crece hacia SQL
específico de versión, esta decisión se revisa.**

**Lo que el carril NO cubre, y sigue siendo del checklist manual:** UI, handlers
HTTP completos, y el resto de la suite. Ampliarlo es una decisión, no un
descuido.

## REGLA · un número de layout sólo vale si viene de la pantalla donde se TRABAJA

Antes de optimizar espacio —altura de cabecera, densidad de una lista, tamaño de
tarjeta— hay que **confirmar EN QUÉ pantalla se está midiendo y si es la de uso
real**. No es una precaución: es la misma familia que § el artefacto rancio y que
la regla de las bases —**lo que está escrito no prueba lo que está corriendo**—,
sólo que acá lo que engaña es *dónde se miró*.

**El 2026-08-20 mordió TRES veces en una sola sesión**, y las tres con el mismo
código sin cambiar:

1. La dieta de cabecera de Pedidos se midió y se justificó contra un laptop
   escalado. Los levers estaban bien calculados —52px + 20px, medidos con la CSS
   real— y aun así **el resultado se sintió apretado y se revirtió entero**. El
   número era correcto; la pantalla, no.
2. El mismo día, el owner reportó ver 5 tarjetas en el laptop solo y 3½ con el
   monitor conectado, **misma build**. La diferencia era la resolución escalada.
3. Y el peor: el `window.innerHeight` de 380px que casi funda un rediseño de la
   tarjeta resultó ser **la pantalla del laptop MIENTRAS el monitor está
   conectado — una pantalla que el owner no mira**, porque con el monitor puesto
   trabaja en el monitor. El cálculo derivado ("bajar la tarjeta de 108 a ~64px")
   estaba hecho contra un viewport que nadie usa, y se descartó entero.

**Lo que hace cara a esta trampa es que el número se ve impecable.** Un
`innerHeight` es un dato primario, medido en vivo, sin margen de error — y aun así
puede responder por una pantalla equivocada. El modelo entonces AJUSTA
perfectamente (viewport ÷ slot reprodujo las dos observaciones del owner al
decimal) y esa precisión se lee como validación, cuando lo único que valida es la
aritmética.

**El procedimiento, en dos preguntas que van ANTES de cualquier cálculo:**

- **¿de qué pantalla física salió este número?** (no "de la consola" — de cuál
  monitor, con qué escalado, con qué conectado);
- **¿es ésa la pantalla donde el trabajo ocurre?** Con dos pantallas conectadas,
  la respuesta por defecto es la SECUNDARIA sólo si alguien lo confirma; nadie
  trabaja en la que no mira.

**Y la consecuencia de producto, que es la que sobrevive a este incidente:** la
tarjeta de pedido **NO se toca** (decisión del owner, 2026-08-20). El hilo del
espacio de Pedidos se cierra con el rango→ícono ya mergeado; el "objetivo en
píxeles" que justificaría un rediseño de la tarjeta **no existe todavía**, porque
nunca se midió en la pantalla de uso real. El día que se retome, empieza por ahí.

## Toast = éxito, inline = error — la división de vehículos

Regla del admin, y aplica a **todo diálogo con mutación**:

- **`toast.success`** para el ÉXITO. Efímero está bien: la acción cerró y no hay
  nada que hacer con la información.
- **`<ErrorDialogo>`** para el ERROR, DENTRO del diálogo. Persistente, porque hay
  algo que corregir y el operador sigue parado ahí.

El contrato de cierre ya garantizaba lo difícil —el diálogo queda ABIERTO y con
los datos intactos cuando falla—, pero el motivo aparecía en una esquina de la
pantalla y se desvanecía solo. **La atención está capturada por el modal, que es
exactamente lo que un modal hace**; el error tiene que vivir donde está mirando.

El precedente es del propio repo: login y aceptar-invitación ya usaban error
inline (`AvisoError` en `PreAuthShell`) con el argumento de que "en pre-auth el
toast se pierde". Dentro de un diálogo aplica igual.

- **El patrón es `components/admin/ErrorDialogo.tsx`**: el componente y su hook
  (`useErrorDialogo`). Es un hook por el mismo motivo que `useAccionGuardada` —
  lo que se olvida no es MOSTRAR el error, es LIMPIARLO. Un error que sobrevive a
  un reintento exitoso afirma un fallo que ya no existe, y eso es peor que no
  tener error inline.
- **Se limpia en dos momentos**: al reintentar (primera línea del submit) y al
  cerrar. Los modales cuyo cuerpo se desmonta al cerrar (`{target && <Body
  key=… />}`) lo obtienen gratis; los que mantienen el `Dialog` montado lo hacen
  explícito en `onOpenChange`.
- **LA COLOCACIÓN NO ES DECORATIVA.** Va como hermano flexible a la IZQUIERDA de
  los botones, ocupando espacio horizontal que la fila ya tenía libre — nunca
  como banner encima. Un banner que aparece al fallar empuja el layout y mueve
  los botones justo cuando el cursor está sobre el que se acaba de clickear: el
  error que explica el fallo no puede ser, además, la causa del siguiente. Como
  la altura de la fila la fija el botón (h-9 ≈ 36 px) y el texto es `xs`, uno o
  dos renglones entran sin mover nada.
- **Excepción declarada**: el Detalle de Orden tiene su botón `w-full` y no deja
  espacio al lado, así que ahí el error va DEBAJO — que es lo que mantiene quieto
  al botón, porque su posición la fija el contenido de arriba. Ese diálogo además
  tiene `max-h-[85vh]` con scroll, que absorbe el crecimiento.
- **`mostrar(e, fallback)` centraliza sacar el mensaje del servidor.** Mientras
  fue un `e instanceof Error ? e.message : '…'` repetido en cada catch, cada
  modal podía tragarse el mensaje por su cuenta — y varios lo hacían.
- **Lo que NO migra**: validaciones client-side previas al submit (son otro
  mecanismo y ya tienen su propio aviso), errores de página no-modales, y las
  escrituras optimistas cuyo diálogo ya cerró (el toggle de Automatizaciones, el
  panel del dashboard) — ahí no hay diálogo donde poner nada, y su toast lleva
  "Reintentar".

**`razonDelServidor` vive en `lib/api/errors.ts`** y lo usan todos los helpers de
mutación. Los endpoints responden `{ error }` con la frase que dice qué corregir
("Aparece en 3 órdenes; desactívalo…", "Deja al menos una molienda disponible");
un `throw new Error('Error al guardar')` genérico borra exactamente esa frase.
Estaba duplicado como función local en `lib/api/products.ts` y por eso tres
mutaciones seguían tragándose el mensaje — dos definiciones del mismo helper es
cómo vuelve a pasar.

## Todo `DialogContent` lleva `DialogDescription`

Radix lo exige: sin descripción (o sin un `aria-describedby={undefined}`
explícito que diga "no lleva") avisa por consola. **No es ruido de librería** —
sin ella el lector de pantalla anuncia un diálogo sin decir de qué trata, y el
título solo rara vez alcanza ("Orden CN-123456" no dice qué se puede hacer ahí).

- **Va `sr-only`, salvo que el texto aporte a la vista.** El contenido del
  diálogo ya lo explica al que ve, y una línea de chrome bajo el título compite
  con la respuesta — que en el detalle de orden es justo lo que el diálogo existe
  para dar primero. El precedente es del repo: el ⌘K (`components/ui/command.tsx`)
  ya la monta así. `AutomationConfigDialog` la usa VISIBLE porque ahí el texto es
  el disparador de la automatización, que sí es información.
- **La descripción dice qué se puede HACER, no qué es.** "Estado de entrega y de
  pago, con las acciones disponibles" sirve; "Diálogo de orden" no.
- `AlertDialog` tiene su propio `AlertDialogDescription`, que ya se usaba en los
  dos confirms.

- **`ImageLightbox` es la ÚNICA excepción**, y va por la otra rama:
  `aria-describedby={undefined}`. Su contenido ES la imagen, ya descrita por el
  `alt` que va en el título; una descripción sólo podría repetir ese texto, y un
  lector de pantalla anunciando dos veces lo mismo es peor que el silencio. La
  excepción se DECLARA en el código — un diálogo sin descripción y sin el
  `undefined` explícito es indistinguible de un descuido.

**La regla está cumplida en los diez `DialogContent` del repo** (2026-08-06).
Verificable de un vistazo, y conviene correrlo al agregar un diálogo nuevo:

```bash
for f in $(grep -rl "<DialogContent" --include="*.tsx" . | grep -v node_modules); do
  grep -q "DialogDescription\|aria-describedby" "$f" || echo "PENDIENTE: $f"
done
```

## Doble-submit — `useAccionGuardada`, no una receta a recordar

Toda mutación disparada por un control va por el hook de
`hooks/useAccionGuardada.ts`. **No se escribe la guarda a mano**: existe como
primitiva justamente porque escribirla a mano salía mal.

```tsx
const guarda = useAccionGuardada();
const handleSave = () => guarda.ejecutar(async () => { /* … */ });
// <Button disabled={guarda.enVuelo}>{guarda.enVuelo ? 'Guardando…' : 'Guardar'}</Button>
```

Para listas con una acción por fila (el tablero de Entregas), `useAccionesPorFila`
hace lo mismo **por id**: bloquear la tabla entera mientras una entrega se
despacha sería una traba, no una guarda.

La guarda son DOS mitades y **no son redundantes**:

- **el ref (síncrono)** corta la re-entrada del mismo tick. Es lo ÚNICO que la
  cierra: `disabled` depende de un re-render, así que dos clicks seguidos leen
  ambos el estado en `false` y pasan los dos;
- **el estado** deshabilita el control y le pone texto intermedio. Sin esa señal
  el operador vuelve a clickear — en el incidente del 2026-08-04 los dos clicks
  llegaron con **2,5 s de diferencia**: no fue un doble-click, fue volver a
  clickear porque el botón no decía nada.

**Por qué es un hook y no un patrón documentado:** la auditoría del 2026-08-04
encontró ocho modales con la mitad de estado y sin la síncrona. La receta estaba
escrita y aun así se aplicó a medias ocho veces. Con el hook, tener una mitad sin
la otra deja de ser posible.

Excepción legítima: un control puede conservar su propio estado si lleva
información que un booleano no tiene — Productos mantiene `fase`
(`'subiendo' | 'guardando'`) para nombrar la ETAPA en el botón, y usa el hook para
la guarda. Lo que no se conserva es un ref de re-entrada propio.

Se bloquean también las otras dos salidas mientras la mutación viaja: Cancelar
`disabled`, y el Dialog sin cerrar por click-fuera ni Esc. Cerrar a mitad no
cancela nada en el server y deja al operador sin saber si se aplicó.

**Que el server sea idempotente no exime al botón.** El ajuste de inventario
`tipo: 'ajuste'` fija valor absoluto, así que el doble-submit no corrompió stock —
pero `entrada`/`devolucion`/`salida` son delta y ahí sí duplican. La guarda es del
botón, no del tipo de operación.

### Las DOS puertas del stock, y por qué las dos dejan asiento

El stock se edita por dos lugares y **los dos se mantienen** (decisión del owner,
2026-08-05): `/api/inventory/adjust` (Ajustar Stock) es la operación de
inventario, y el campo Stock del modal de producto es la corrección de ficha.
Cerrar la segunda sería quitarle al operador una corrección legítima.

Lo que no se mantiene es que una de las dos fuera **silenciosa**. El PATCH
escribía `stock` directo, sin asiento, así que el kardex se desfasaba del stock
real sin una sola fila que lo explicara. **Dos puertas al mismo dato con una sola
dejando firma es cómo el kardex deja de ser confiable.** No se cierra la puerta:
se le pone la firma.

Se descubrió reconstruyendo el incidente del PATCH destructivo: el stock fue
28 → 0 → 28 y el kardex no registró nada. La cadena cerró de casualidad porque el
owner retecleó el mismo número; con otro habría quedado desfasada para siempre.

- **El asiento se escribe si el body TRAE `stock` Y el valor CAMBIÓ.** Las dos
  condiciones, y la segunda no es una optimización: sin ella cada guardado del
  modal dejaría un asiento fantasma de N → N —editar la descripción no es un
  movimiento de inventario— y el kardex se volvería ilegible por exceso, que es
  otra forma de no ser confiable. La comparación va contra el valor YA
  normalizado por `datosDelPatch`, no contra lo que vino en el body: un `'28'`
  string tampoco es un movimiento.
- **Motivo fijo `'Edición de producto'`, tipo `'ajuste'`** — el tipo de valor
  ABSOLUTO, que es exactamente lo que hace ese campo: fija el stock, no lo mueve
  por un delta.
- **`SELECT … FOR UPDATE`, por lo mismo que en `aplicarAjusteInventario`.** Y hay
  una razón extra acá: como el lock es de la misma fila, **las dos puertas
  comparten la cola**. Eso es lo que hace que sea UNA cadena y no dos que se
  pisan. Testeado con las dos corriendo en paralelo.
- **Todo producto nace con su asiento inaugural** (`'Stock inicial'`, 0 → N), y va
  incluso con stock 0. Sin él, un producto nacido con 42 tiene un kardex que
  empieza en el aire y ningún recorrido lo reconcilia con el stock real — el mismo
  agujero de la puerta silenciosa, en el origen.
- **La escritura vive en `lib/product-update.ts`** (`aplicarPatchProducto`,
  `crearProductoConAsiento`) y no en los route handlers, por el criterio de
  siempre: el carril no monta HTTP, así que la única forma de afirmar esto contra
  una base real es que sea una función. `tests/integracion/kardex-edicion-producto.test.ts`
  se escribió contra el código silencioso y se lo vio fallar 8 de 8. **No borrar
  ese archivo.**
- **Sin cambios de UI**: el modal sigue igual, y el operador no tiene que decidir
  nada nuevo. La firma es del sistema, no una casilla más.

**HUECO CONOCIDO, no arreglado en esta tanda:** `aplicarAjusteInventario` devuelve
`cruzoElMinimo` y su llamador emite el evento `stock_bajo`; el PATCH **no**. O sea
que bajar el stock por debajo del mínimo desde el modal deja su asiento pero **no
avisa por la campana**. Es la misma clase de puerta silenciosa que esta tanda
cierra, una capa más arriba. Se anota acá y no en el backlog porque pertenece a
esta decisión; arreglarlo es mover el cálculo de `cruzoMinimo` dentro de
`aplicarPatchProducto` y emitir post-commit, igual que hace el ajuste.

### La FRONTERA del patrón: guarda donde el silencio invita al reintento

El patrón se cerró entero el 2026-08-04 (Invitar usuario, los dos controles de
fila de Órdenes, el cambio de rol, y marcar una notificación). **El item salió del
backlog y NO se repone**: la categoría está cerrada, y para que siga cerrada hay
que decir dónde TERMINA — si no, cada control nuevo reabre la discusión.

La regla no es "toda mutación lleva guarda". Es: **guarda donde el silencio invita
al reintento.** El modo de falla que el patrón ataca no es el doble click en
abstracto, es la secuencia *el control no dice nada → el operador vuelve a
clickear*. Donde esa secuencia no puede ocurrir, la guarda no agrega seguridad:
agrega ceremonia, y una ceremonia sin motivo es lo que hace que la próxima persona
la copie donde sí importaba y la omita donde no.

Dos controles quedaron DELIBERADAMENTE fuera, y conviene que estén escritos para
no re-auditarlos cada seis meses:

- **El toggle de Automatizaciones.** Escritura optimista: el switch se mueve en el
  acto y el valor es absoluto. No hay silencio — el control responde antes que el
  server. Y un doble click en un switch es prender-apagar: intención legítima del
  operador, no un submit duplicado. Ponerle una guarda haría que el segundo
  movimiento se descarte en silencio, que es peor que lo que arregla.
- **"Guardar" de `AutomationConfigDialog`.** Cierra el diálogo en el mismo click,
  así que no existe un segundo click que dar.

El criterio para decidir un caso nuevo, en una línea: **¿puede el operador clickear
otra vez sin que nada haya cambiado en pantalla?** Si sí, lleva las dos mitades. Si
la pantalla ya respondió —cerró, se movió, cambió de estado— no.

### La mitad SERVIDOR: el kardex tiene que ENCADENAR

El ajuste manual vive en `lib/inventory.ts` (`aplicarAjusteInventario`), no en el
route handler — se extrajo para poder testear su concurrencia, que es donde
estaba el defecto.

**El `SELECT … FOR UPDATE` del principio de la transacción no es opcional.**
Postgres corre en READ COMMITTED: sin el lock, dos peticiones concurrentes leen
el mismo stock antes de que cualquiera escriba, las dos registran el mismo
`stock_anterior`, y el kardex afirma **dos movimientos donde hubo uno**. Con
tipos delta se aplican además los dos, y el asiento de la segunda miente sobre
cuánto había. Mismo patrón que el POST de pagos.

El invariante que lo define, y que el test afirma: **partiendo del stock inicial,
los asientos deben poder recorrerse en cadena** — cada uno arranca donde terminó
el anterior. Un kardex que no encadena no es un log impreciso, es un libro
equivocado.

Se arregló con el test primero: `tests/integracion/ajuste-concurrente.test.ts` se
escribió contra el código defectuoso y se lo vio fallar reproduciendo la firma
real del incidente del 2026-08-04 (`7→28, 7→28`, dos filas idénticas a 749 ms).
**No borrar ese archivo al refactorizar `lib/inventory.ts`**: es la única cosa que
prueba que el lock hace algo.

Efecto secundario que también se cierra: el CRUCE del mínimo se evalúa ahora con
los dos valores de la MISMA transacción, así que dos movimientos concurrentes ya
no pueden creerse ambos "el que cruzó" y hacer que la campana avise dos veces del
mismo hecho.

La deuda que queda de esta familia vive en § Backlog técnico, no acá.

### La TERCERA puerta de stock: el despacho, y el ORDEN DE ADQUISICIÓN de locks

El descuento al **despachar** (preparando → en_ruta) tenía el MISMO hueco que las dos
puertas de arriba, y se pasó por alto porque su lectura del estado vivía FUERA de la
transacción: el PATCH de shippings leía el `current` sin lock ([route.ts:47] histórico) y
decidía `justDispatched` sobre esa lectura. Dos "Marcar en ruta" concurrentes del mismo
envío —un reintento de red, dos pestañas, o una automatización futura sobre ese endpoint—
leían ambos `preparando` + `stock_descontado_at` null → los dos descontaban → **doble
descuento y dos asientos 'venta'**. Corrupción silenciosa en el libro que la auditoría
existe para creer. El marcador de idempotencia no protegía: se chequeaba sobre la lectura
pre-transacción, no re-leído bajo lock.

Se cerró extrayendo la transacción a **`packages/core/src/shipping-transition.ts`**
(`aplicarTransicionEnvio`) —por el mismo motivo que `aplicarAjusteInventario`: para
afirmar su concurrencia en el carril—, que lockea, RE-LEE fresco bajo el lock, y recién
ahí decide los gates. `tests/integracion/despacho-concurrente.test.ts` se escribió contra
el código sin el lock y se lo vio producir DOS (stock 4 en vez de 7). **No borrar.**

**EL ORDEN DE ADQUISICIÓN DE LOCKS ES `ORDEN → SHIPPING`, SIEMPRE**, y esto es regla de
sistema, no de este fix: el despacho **lockea la fila de la ORDEN** (`SELECT 1 FROM
"Order" … FOR UPDATE`), NO la del shipping. Todo el eje de fulfillment adquiere en ese
orden —`transitionOrder` al cancelar (`order.update → shipping.update`), la verificación
de comprobante (`comprobantes.ts:149`)—, así que serializa sin invertir. **Lockear el
SHIPPING primero deadlockearía con cancelar:** un despacho-impago toca la orden
(`markContraentregaAtDispatch`) DESPUÉS del shipping, y cancelar la toca ANTES — órdenes
opuestas, deadlock en producción. El próximo que agregue un escritor de shipping DEBE
lockear la orden, no el shipping. Está escrito en la cabecera de `shipping-transition.ts`.

**Censo de puertas de stock (2026-08-20), para que ninguna quede sin nombrar:** las que
DESCUENTAN/RESTITUYEN pasan las tres por un lock — el ajuste (`aplicarAjusteInventario`,
FOR UPDATE del producto), la edición de ficha (`aplicarPatchProducto`, ídem) y ahora el
despacho/fallo (`aplicarTransicionEnvio`/`restockShippingStock`, bajo el lock de la
orden, en sus dos llamadores: este PATCH y `transitionOrder`). `ensureShipping` (POST)
CREA un shipping sin el lock de la orden, pero no mueve stock ni transiciona estado
—es idempotente— así que no es de esta clase; queda nombrado.

## El tooltip del panel — `DunaTooltip`, chip invertido, sólo DATO

Cerrado el 2026-08-18 (era el § Backlog #29). El panel tenía DOS formas para lo
mismo —`title` nativo (lento ~1.5s, sin estilo, sin tema) y el Radix shadcn del
sidebar—, y dos formas para lo mismo es cómo la próxima pantalla elige sin criterio.

- **La primitiva es ADMIN-LEVEL, no del paquete.** `components/admin/DunaTooltip.tsx`
  envuelve el Radix de `components/ui/tooltip.tsx` con la ergonomía de un
  `content: string`. NO va en `@duna/design-system` porque el paquete **no tiene
  Radix ni un solo `'use client'`** —es presentacional puro—, y meter ahí una
  primitiva con conducta rompería la opción C. El precedente es `DunaSheet`, que
  **también es admin-level** por lo mismo. El día de Fase B (el paquete adopta
  conducta) se muda.
- **La superficie es un CHIP INVERTIDO** (`.admin-tooltip`, `app/(admin)/duna.css`):
  `--duna-ink` de fondo, `--duna-bg` de texto, que flipean JUNTOS entre temas (chip
  oscuro en claro, claro en oscuro; ~17:1 en los dos). Los tokens viven en `:root`,
  así que el Portal a `<body>` los hereda; la familia (Hanken) se resuelve contra
  `html.admin`. **El re-estilo del `TooltipContent` cubre de una vez a los ~10 Radix
  del panel Y a lo que envuelve `DunaTooltip`** — cambiar el `Content`, no migrar.
- **El alcance es por NATURALEZA DEL CONTENIDO, no por pantalla.** **DATO** (el
  tooltip es el único sitio donde vive esa info) migra a `DunaTooltip`; **ETIQUETA**
  (repite lo que el ícono/link ya dice) migra por goteo al tocar su pantalla;
  **REDUNDANTE** (la info ya está en pantalla, o el ícono es inequívoco) **se borra**.
  El censo real dio **8 DATO** migrados y **2 redundantes** limpiados —el `title` de
  `usuarios` duplicaba el motivo que YA se muestra inline; el "Recargar" sobre ⟳ pasó
  a `aria-label` (se va el tooltip, queda el nombre accesible del botón icónico)—.
- **CUIDADO con el censo: un prop que se llama `title` casi nunca es un tooltip.**
  `OrderCard title=` es el ENCABEZADO visible de la tarjeta; `ConfirmDeleteDialog`/
  `CommandDialog title=` son títulos de diálogo (a11y). Ninguno forwardea a un
  `title=` nativo. Confundirlos infló el primer censo a ~29 "tooltips" cuando los
  nativos reales eran una fracción. Se verifica mirando el ELEMENTO, no el prop.
- **Un componente COMPARTIDO no debe forwardear `title` al atributo nativo.** A
  `StatusBadge` (lo usa el storefront) se le **quitó el prop `title`** —único
  consumidor era Comprobantes, migrado al call-site con `DunaTooltip`—: dejar el prop
  deja la puerta abierta para que el próximo consumidor se lleve un tooltip nativo.
- **Botón deshabilitado → span-wrap.** Radix no dispara el hover sobre un `disabled`
  (a diferencia del `title` nativo), así que el trigger es un `<span>` que envuelve al
  botón (precedente de Entregas). Los casos: el "Marcar en ruta" a medias, y —lo que NO
  fue— `usuarios`, cuyo motivo se lee inline. (El tercero era el toggle "Por método" del
  strip de Pagos, que murió con el strip — § Pagos, la frase y la curva.)
- **La prueba viva** vive en `reference.html`, pero **espeja `.admin-tooltip` con
  estilos inline** (no ejercita la clase real). Ese hueco, y la promoción de la
  superficie al paquete como `.duna-tooltip`, están anotados con `.duna-sheet`/
  `.duna-scrim` (§ Duna OS en ANGOSTO — el mismo "CSS que alguien cablea"). El hueco
  de VISIBILIDAD en táctil del total del bucket se CERRÓ el 2026-08-20 —el total se
  alcanza por la frase al acotar, no por el hover— (§ Pagos — la FRASE y la CURVA).

## Los DOS modelos de scroll del panel conviven A PROPÓSITO — es el estado FINAL

Cerrado el 2026-08-23 (era el § Backlog #22, "la consolidación del alto fijo global").
El panel tiene dos modelos de scroll, y **eso no es deuda transitoria esperando una
consolidación: es el diseño permanente.**

| Modelo | Pantallas | Por qué |
| --- | --- | --- |
| **Alto fijo** (`.duna-pantalla-fija` ≥1080 con split; `.duna-sin-split` ≥960 sin split) | Pedidos, Clientes, Productos, Inventario, Pagos | tienen forma de LISTA: una respuesta o cabecera fija sobre un cuerpo que scrollea |
| **Document-scroll** | Dashboard, Analítica, Automatizaciones, Configuración, Perfil | son CONTENIDO/FORMULARIO heterogéneo: no hay una lista homogénea que fijar |

**Por qué se cerró el ítem sin hacerlo:** #22 proponía UNA cosa —subir el alto fijo al
chrome para TODAS las páginas y retirar el opt-in—. Pero **cinco** pantallas quieren
document-scroll legítimamente (dos excepciones formales —Analítica, Automatizaciones— más
Dashboard, Configuración y Perfil, que son contenido y formularios). Forzarles alto fijo
fijaría el chrome y scrollearía el contenido, justo al revés de lo que sirve. La
consolidación no se puede ejecutar, y no porque falte trabajo: **porque su premisa es
falsa.** Lo que parecía un intermedio resultó ser el estado final.

- **El opt-in por página ES el diseño permanente**, no un andamio. Una vertical de LISTA
  futura opta con el marcador que ya existe (`.duna-pantalla-fija` / `.duna-sin-split`); una
  de contenido no pone nada y queda en document-scroll. No hay un "shell global" pendiente.
- **Las excepciones ya no son excepciones a un disparador** —eran "Analítica/Automatizaciones
  NO adoptan el alto fijo, o el disparador nunca se cumple"—. Con el ítem cerrado, son
  simplemente pantallas de contenido: Analítica porque sus respuestas (los Titulares) viven
  DENTRO de bloques que crecen; Automatizaciones porque su rejilla cabe en un viewport; y
  Dashboard/Configuración/Perfil por lo mismo. Si alguna cambiara de anatomía a "respuesta
  fija sobre lista" (como la frase de Pagos), optaría al alto fijo —pero eso es un rediseño
  de esa pantalla, no una consolidación del shell—.
- **#25 SIGUE VIVO y aparte.** #22 decía que "absorbía a #25" (el gateo por VALOR 1080 vs 960
  duplicado), pero sólo lo habría absorbido si el chrome proveía la altura global. Cerrado
  #22 sin hacerse, la cadena de altura duplicada sigue ahí y **#25 queda con su disparador
  intacto: una TERCERA página sin split.** No se cierra con éste.

## El rail agrupa en SECCIONES — lista PLANA con tag, no anidada

`ADMIN_NAV` (`constants/admin-nav.ts`) es una lista PLANA de ítems, y la agrupación del
rail (Hoy · **Operación**: Pedidos·Productos·Clientes·Inventario·Pagos · **Crecimiento**:
Analítica·Automatizaciones) se expresa con un campo **`seccion?`** por ítem, NO con una
lista anidada. Es la decisión, y la razón es la forma de los consumidores:

- **Los encabezados NO PUEDEN ser un destino** porque no son elementos del array. El ⌘K
  mapea ítems (cada uno con `path`); una sección jamás llega a ser un `CommandItem`. Una
  lista anidada pondría ese riesgo.
- **Los cuatro consumidores planos quedan intactos:** MobileNav (`slice(0,4)`), el ⌘K, `admin-titulo`
  (`.find(path)`) y `atencion/registro` (`.map(path)`) IGNORAN el tag. **Sólo el Sidebar lo
  lee** para pintar el encabezado al primer ítem de cada sección (agrupado CONTIGUO: comparar
  con el previo). Una lista anidada los habría roto a los cuatro (todos tendrían que aplanar).
- **El agrupado NO reordena.** Las secciones agrupan el orden que ya existe; mover un ítem es
  otra decisión (y movería la partición posicional de la barra móvil).
- **El ⌘K NO se agrupa por sección** (owner): funciona plano bajo "Ir a", y agruparlo sería
  cambio sin motivo. Los `CommandGroup heading` de cmdk no son seleccionables, así que el día
  que se agrupe tampoco serían destino — pero hoy no se toca.
- **El encabezado es `.admin-nav-seccion`** (`duna.css`), admin-level por la regla del segundo
  consumidor (un solo archivo lo usa). Va sólo en el rail EXPANDIDO —el colapsado es icon-only—.

## Backlog técnico

**EL registro único de deuda conocida.** Existe porque antes vivía repartida
entre cuerpos de PR y secciones sueltas de este archivo: nadie podía responder
"¿qué falta y en qué orden?" sin releer tres merges. Una deuda que no está acá,
para efectos prácticos, no está.

Reglas de la lista, para que siga sirviendo:

- **Va ordenada, y el orden es la decisión.** Reordenar es una decisión del
  owner, no del que agrega el item.
- **El orden es la POSICIÓN; el número es el NOMBRE.** Un item se ubica por
  prioridad, no por su número —que es un id estable—. Por eso la lista puede tener
  el 22 después del 25: el 22 es su nombre, y su lugar al final dice que es lo
  último.
- **Cada entrada dice el COSTO YA PAGADO**, no solo el problema. "Costó el
  diagnóstico de una tarde" es lo que hace que la decisión de priorizar no se
  tome en abstracto.
- **Un item que se completa se BORRA de acá** y su decisión, si tiene, se
  documenta en la sección que le corresponda. Esto no es un historial.
- **PODAR LEYENDO TÍTULOS NO SIRVE — hay que verificar contra el CÓDIGO.** El
  título de un item describe el PROBLEMA, no si sigue vivo: un item resuelto de
  paso en otra tanda conserva su título de "pendiente" y parece deuda. Pasó TRES
  veces —**#16** (la campana ya migró a `--duna-sol`), **#36** (la tabla ya es
  `.duna-lista`) y **#2** (el actor de `InventoryLog` ya está: columnas, escritura
  por las dos puertas, lectura en el kardex, test de carril)—: los tres estaban
  HECHOS y el título los hacía parecer vivos. Antes de borrar, reescribir o dar por
  vivo un item que describe un DEFECTO concreto, se GREPEA el símbolo contra el
  código —igual que la regla del artefacto (§ PRECONDICIÓN): lo que el item DICE no
  prueba lo que el código HACE—. Los items que esperan una DECISIÓN de producto (no
  un defecto) no necesitan este grep.

### 46. El editor VISUAL — editar sobre la vista, no llenar campos

El dueño quiere clicar el texto EN la vista en vivo y editarlo ahí, como una plantilla, en vez de
llenar campos. Viable porque los componentes se renderizan en el panel (§ La PANTALLA), sin tocar
ni anotar el storefront público.

La FORMA ya está descrita (discovery 2026-08-25): **`EditableText`** —un wrapper que en la tienda
es passthrough (texto pelado, cero overhead) y en el editor renderiza `contentEditable` + captura
el input → callback `(campo, valor)`—; **controles NO-texto** para lo que no se teclea (imagen de
fondo, visibilidad de sección, orden de un repeater — quedan FUERA de la edición-sobre-la-vista);
y **el form ENCOGIDO** a esos controles no-texto (el texto se edita en la vista). O sea DOS
editores conviviendo —texto en la vista, no-texto en controles—, que es diseño nuevo.

**Lo que NO resuelve** (escrito para no re-descubrirlo): el COLOR de "historias" (y todo acento) es
TEMA, no contenido — depende de la capa de tema-por-cliente (§ Mejoras post-multitenant), no del
editor visual.

**Costo YA pagado: ninguno.** El sticky (2026-08-25) ya resolvió el síntoma real —editar sin perder
la vista de la vista—, así que esto es UX (editar en el lugar), no un defecto. Y trae la maña de
`contentEditable` (cursor, pegado, IME, el conflicto controlado/no-controlado de React) + acopla
más el componente que Fase B va a extraer.

**DISPARADOR: cuando el owner use el editor con las CUATRO secciones y BUSCAR el campo siga siendo
el estorbo.** Hoy, con UNA sección y el sticky puesto, no hay evidencia de que lo sea.

### 3. La ventana de 45 s del polling de la campana

`POLL_MS = 45_000`. El badge se computa sobre el snapshot del cliente, así que una
notificación de severidad `alerta` puede tardar **hasta un poll** en teñir el
badge de rojo: durante esa ventana el conteo puede quedar en primario aunque en
la base ya haya una alerta.

**Decisión aceptada para la v1** (owner, 2026-08-04): no es un bug, es el costo
del polling sin push. Se anota porque es exactamente el tipo de rareza que en dos
meses alguien reporta como defecto y vuelve a costar un diagnóstico. La salida
real es push (SSE/websocket), que está **fuera de alcance de la v1** por decisión
explícita.

### 4. `reference.html` usa etiquetas de DOMINIO que el DS no puede mantener

La prueba viva del design-system ilustra `steps` y la timeline con las etiquetas
reales de esta vertical (Recibido · Preparando · En camino · Entregado, y el
vocabulario del Recorrido). El paquete es **agnóstico de negocio por diseño**, así
que no tiene forma de saber cuándo el dominio cambia una secuencia — y por tanto
nada garantiza que no vuelvan a divergir.

**Costo YA pagado:** el fósil **"Confirmado"** sobrevivió **un mes** dentro de la
referencia y del comentario de `primitives/status.ts` después de que la migración
`20260710152313_merge_confirmado_into_pagado` borrara ese estado del dominio.
Salió a la luz sólo porque el owner comparó la referencia contra la pantalla de
Pedidos y preguntó por qué una mostraba cinco pasos y la otra cuatro. Y no era
cosmético: esa etapa significaba **pago acreditado**, que contradice la decisión
—ya fijada con test— de que el pago no es una posición del camino, porque en
contraentrega el pedido se prepara, se despacha y se entrega sin pagar.

Se arregló en `5a520ea` (los dos sitios a la secuencia real, con el descargo de que
las etiquetas las trae el dominio). **Eso corrige el dato, no el mecanismo:** hoy
coinciden porque alguien las miró.

La salida barata que se evaluó y se descartó por ahora es un test en la APP que
afirme que `ETAPAS_PEDIDO` es lo que la referencia muestra —invirtiendo la
dependencia, ya que la app sí conoce al DS—, pero leer HTML con regex es frágil de
otra manera y cambia el modo de falla en vez de quitarlo.

**DISPARADOR:** la próxima vez que el dominio cambie una secuencia canónica, o que
otra pantalla fije la suya, migrar los ejemplos de la referencia a etiquetas
**evidentemente de muestra** (Paso 1 · Paso 2 · …) con el descargo. Enseña menos,
pero no puede caducar.

### 18. El detalle pierde la POSICIÓN DE SCROLL al cruzar el umbral del split

Cruzar 1080 remonta el detalle de una superficie a la otra (panel `.duna-split__panel`
↔ sheet `.duna-sheet__body`, `app/(admin)/admin/pedidos/page.tsx`), y esos son
**scrollers de DOM distintos**: quien venía scrolleado a la sección Pago vuelve
arriba de todo. Salió del mismo diagnóstico que la pérdida del borrador de notas
—el remontaje panel↔sheet—, pero NO es lo mismo: el borrador era estado de React y
se elevó al padre; el scroll **no es estado de React**, así que elevarlo no lo
arregla. Es restauración de scroll (guardar `scrollTop` del scroller que se va y
aplicarlo al que llega), otro mecanismo.

**Costo YA pagado: ninguno reportado.** Sólo pasa al redimensionar la ventana
cruzando 1080 con el detalle abierto Y scrolleado — un caso raro. El borrador, que
SÍ era pérdida de contenido, ya se arregló en la misma tanda.

**DISPARADOR: si aparece en uso real.** El shell de scroll-por-columna ya rehízo esos
scrollers (en producción desde `1b10988`) sin implementar la restauración, así que el
"momento natural" pasó sin decidirla — y el caso sigue sin reportarse. Es el mismo
disparador que su hermano #19: cuando alguien lo tope de verdad, se guarda el
`scrollTop` del scroller que se va y se aplica al que llega.

### 19. `confirmando` de `useDescarteDeDrawer` muere en el remontaje del detalle

El detalle usa `useDescarteDeDrawer` para la guarda de salida del enlace de cliente
(`app/(admin)/admin/pedidos/page.tsx`), y su estado interno `confirmando` vive
DENTRO del detalle, así que cruzar el umbral del split lo remonta y lo pierde —igual
que el borrador, pero este NO se elevó.

**Costo YA pagado: ninguno.** La ventana es mínima: `confirmando` sólo es no-nulo
mientras el diálogo de descarte está ABIERTO a mitad de una navegación, y
redimensionar la ventana cruzando 1080 exactamente en ese instante no es un caso
real. No es contenido del operador: si se pierde, el diálogo se cierra y la
navegación no ocurre — un no-op, no una pérdida.

**DISPARADOR: si aparece en uso real**, o si el hook gana estado que sí importe
conservar. Entonces se eleva al padre como el borrador, o el detalle recibe una
identidad estable entre contenedores.

### 20. Comprimir la PORTADA en la subida — alcance IMAGEN (el de vídeo murió con el tope)

**LA MITAD QUE DOLÍA SE CERRÓ** (tanda del #48/#20, la subida directa a Blob): el tope de
4 MB **murió con el endpoint viejo `/api/upload`**; las subidas van DIRECTO del navegador a
Blob, hasta **200 MB** (§ La subida DIRECTA a Blob). "El peso bloquea la subida" ya no pasa,
y por eso este ítem dejó de ser sobre el TOPE.

Lo que QUEDA es sólo **COMPRIMIR**: las portadas se suben SIN recomprimir, así que el
original pesa lo que pese. Next las SIRVE reducidas, pero en cada frío de caché descarga el
ORIGINAL entero para re-codificar.

**DISPARADOR CORREGIDO (owner) — NO es el tope de subida, es que el STOREFRONT SE VEA LENTO.**
Ése es el hecho observable que justificaría comprimir. Comprimir en el navegador es otra
capacidad —pérdida de calidad, tiempo, formatos— y no se adelanta a un síntoma que no
existe. Cuando el storefront arrastre (CDN/peso empezando a importar), se comprime en la
SUBIDA (redimensionar/recomprimir en el cliente antes de subir). **Las portadas YA subidas
no encogen retroactivamente** —sólo las nuevas—; un backfill es decisión aparte (toca
imágenes de producto vivas).

**Costo YA pagado:** el 500 `TimeoutError` de `/admin/productos` en local (2026-08-17).
Medido con curl directo al blob: el cuerpo baja a ~50 KB/s → >15 s para 1.4 MB, mientras los
headers vuelven en <1 s (por eso un HEAD engaña). Es **ambiental** (throughput a Blob desde
esa red), no código. En producción, servido desde el edge, hoy no muerde — que es por qué el
disparador es la lentitud OBSERVADA, no la teórica.

**EL ALCANCE DE VÍDEO SE CERRÓ — su disparador se volvió IMPOSIBLE (owner, 2026-08-27).** El disparador
de comprimir-vídeo era el asset de 180 MB, y el **TOPE DE GALERÍA de 20 MB** (§ Backlog #48) hace que ese
asset ya no pueda existir. Comprimir tampoco lo habría arreglado: MEDIDO, la DURACIÓN manda —3 min aun
comprimidos siguen siendo ~87 MB (1080p @ 4 Mbps = 29 MB/min)—. Así que **este ítem es sólo de IMAGEN**
(las portadas de 1.4 MB, arriba). El único residuo de vídeo —re-codificar un clip CORTO de bitrate alto
con WebCodecs (medido viable) para colar algo más largo bajo los 20 MB— es marginal, no tiene costo pagado
ni caso pedido, y vive en el § #48, no acá.

### 21. El dev heredado del reset apunta a blobs de PRODUCCIÓN

Medido en `development` (2026-08-17): **3 de 4 portadas** apuntan a
`…blob.vercel-storage.com/productos/…` (blobs REALES de producción); la cuarta a
`dev/productos/` (reemplazada en dev tras el reset). Es exactamente lo que
documenta § Storage: el reset desde production copia **filas, no archivos**, así
que las URLs heredadas siguen sirviendo los blobs de producción.

**Costo YA pagado: ninguno.** Hoy es inofensivo porque esas URLs sólo se LEEN
(mostrar la imagen). El riesgo es de escritura: una operación de **borrado o
reemplazo desde dev** tocaría un archivo real de producción. La guarda
`isDeletable` (prefijo `dev/`) existe justamente para esto —convierte en no-op el
borrado de un blob que no sea `dev/`—, pero es una red, no una prueba de que todo
path la respete.

**DISPARADOR: al construir o tocar cualquier flujo que borre o reemplace
imágenes.** Ahí se verifica qué hace `lib/storage` en `delete`/reemplazo contra una
URL de prefijo `productos/` heredada, y que la guarda cubra ese path — antes de
darle al operador un botón que pueda alcanzar un archivo de producción.

### 25. Las reglas del alto fijo están gateadas a un VALOR (1080), no a un ROL

El alto fijo de las pantallas de split se activa en `@media (min-width: 1080px)`
(§ duna.css, `.duna-pantalla-fija`). Pero 1080 no es el umbral del alto fijo: es lo
que el SPLIT necesita para dar 320px de panel (§ el piso `--duna-panel-min`). Una
pantalla sin split —Inventario— no tiene panel, así que su alto fijo corresponde al
ROL "hay chrome de escritorio con rail", que es 960. El valor 1080 quedó incrustado
donde debería haber un rol.

**Costo YA pagado:** al construir el alto fijo de Inventario (#24) hubo que
DUPLICAR la cadena de reglas (main → page root → región) en un bloque `@media
(min-width: 960px)` con un marcador propio (`.duna-sin-split`), en vez de reusar la
de 1080 —moverla a 960 habría cambiado las páginas de split, que sí necesitan 1080—.
Dos copias de la misma cadena, gateadas distinto, es exactamente cómo una diverge de
la otra en un ajuste futuro.

**DISPARADOR: cuando una TERCERA página sin split necesite la región.** Ahí la
duplicación deja de ser una excepción y pasa a ser un patrón, y toca invertir el
gateo: que el umbral sea un parámetro del ROL (split → 1080, sin split → 960), no un
literal repetido por bloque. Con dos consumidores (split + Inventario) todavía es más
barato duplicar que generalizar; con tres, no.

### 26. El date-range picker no navega a años ANTERIORES al año-piso

`startMonth` del `DateRangePicker` es el 1-ene del año ANTERIOR al actual
(`anioPisoPicker`, `lib/metrics/periodo.ts`), lo justo para que TODO preset sea
navegable —incluido "Mes pasado" en enero, que apunta a diciembre del año anterior—.
Pero es un piso de dos años como máximo: en cuanto el negocio acumule datos de **más
de un año calendario**, habrá meses con datos por debajo del piso que el picker no
podrá mostrar ni navegar, aunque un rango tecleado sí los filtre.

El dropdown de AÑO que trae `captionLayout="dropdown"` es hoy casi inerte por lo mismo
—con datos de un solo año muestra ese año y el anterior (vacío)—. Su valor aparece
cuando haya varios años.

**Costo YA pagado: ninguno** — todo el dato es de un año. Es un piso deliberado, no una
herida. La forma alineada a año calendario (no "12 meses atrás" rodante) es a propósito:
mantiene el dropdown de año y la navegabilidad por mes coherentes.

**DISPARADOR: cuando el negocio tenga datos de más de un año calendario.** Ahí el piso
pasa a salir del PRIMER AÑO CON DATOS (opción A, ya diseñada, no re-diseñar): endpoint
`GET /api/meta/primer-anio` → `year(MIN(Order.createdAt))` con fallback al año actual, +
un hook compartido `usePisoAnio()` que las tres páginas (Pedidos, Pagos, Inventario)
consumen y pasan por la prop **`pisoAnio` que el picker YA acepta**. Piso común, una
query MIN, una ruta. La forma está resuelta; falta la evidencia —el segundo año— que la
justifique. Se descartó construirla ahora (owner, 2026-08-18): con un solo año sería
infraestructura por adelantado para un dropdown de una sola opción.

### 27. `setLoading(true)` dentro del efecto de refetch de Pagos

`app/(admin)/admin/pagos/page.tsx` corre `setLoading(true)` síncrono en el cuerpo del
`useEffect` que re-consulta al cambiar el rango. El lint lo marca
(`react-hooks/set-state-in-effect`, "cascading renders") — es **warning, no error**, y
el build no se cae.

**Costo YA pagado: ninguno.** El patrón funciona (muestra "Cargando…" al cambiar el
rango) y es pre-existente: venía del código shadcn y la tanda de lenguaje Duna
(2026-08-18) NO lo tocó a propósito —el alcance era el re-skin, no el fetch—. Se anota
para no re-descubrirlo.

**DISPARADOR CORREGIDO: cuando algo MUEVA la consulta de Pagos** —paginación,
agregación server-side, cambiar de `getPayments` a otra cosa, o el cambio que sea que
toque el `useEffect`/el endpoint—. Ahí el `loading` pasa a DERIVARSE (como en Analítica
y la card semanal: `data?.algo !== esperado`), apoyado en que el endpoint hace eco de lo
que resolvió — el mismo mecanismo que ya evita este warning en esas dos pantallas.

El disparador original decía "cuando entre el strip", asumiendo que el strip tocaría el
fetch. **No lo tocó**: el strip agrupa `pagos` client-side (una fuente, § el bucketeo),
y sus filtros —método y bucket— también son client-side, así que el `useEffect` quedó
intacto. Fue el mismo error que #18 —atar un disparador a un evento que después no
ocurre—: el disparador correcto es el HECHO (mover la consulta), no la tanda que se
suponía que lo traería. Cambiar el fetch sólo por el lint sigue siendo tocar dos cosas
cuando el hecho real va a tocar una.

### 32. El logo de Duna no entra en el PDF: va como TEXTO

El informe de Pagos cierra su pie con **"Generado con Duna"** en texto plano. El logo
EXISTE —`public/brand/duna-logo-horizontal-v1.svg` y `duna-mark-v1.svg`— pero **jsPDF no
dibuja SVG**: meterlo exige rasterizarlo (y elegir resolución, y versionar un PNG que
`public/` vuelve inmutable) o transcribir sus paths a operadores de PDF. Es una decisión
propia, no un renglón de pie, y por eso no se coló en la tanda del informe.

**Costo YA pagado: ninguno.** El texto cumple: es la única marca del producto en un
documento que el operador manda a su contador, y se ve de dónde salió.

**EL RAIL YA USA EL LOCKUP REAL** (2026-08-23): el rail expandido muestra
`duna-logo-horizontal-v1.svg` (mark + "DUNA" con su lettering propio, escalado) + el
negocio debajo (`Sidebar.tsx`, `BrandLockup`). Se pensó que era "la misma decisión" que
el PDF y que se resolverían juntas, pero **son dos trabajos distintos**: el rail muestra
el SVG directo (`<img>`), y el PDF NO puede —jsPDF no dibuja SVG—. Así que el asset se
comparte, pero el PDF sigue necesitando su propia implementación.

**LO QUE QUEDA, y es todo lo que queda de este ítem:** rasterizar el logo a **PNG** para
el informe de Pagos (elegir resolución, versionar el PNG —`public/` es inmutable— y
dibujarlo con jsPDF en vez del "Generado con Duna" de texto). El pie de texto cumple
mientras tanto; no bloquea nada.

**DISPARADOR: al tocar el informe de Pagos, o una tanda de acabado de marca.** El asset
ya está decidido (es el del rail); falta sólo el PNG y su render en el PDF.

### 34. El padding del sheet es responsabilidad REPARTIDA — cuatro consumidores lo cablean

`DunaSheet` no monta el padding de su cuerpo: lo pone el CONSUMIDOR envolviendo su
contenido en `.duna-sheet__body` (el scroller con padding). Cuatro sitios lo hacen a mano
—el detalle de Pedidos, Productos y Clientes, y ahora MobileNav—, y **MobileNav ya se
olvidó una vez** (su título y sus botones salían pegados a los bordes; se arregló envolviendo
como los otros tres). El quinto consumidor lo va a olvidar igual.

**Costo YA pagado:** el hueco de padding del sheet de MobileNav, un turno de diagnóstico
—descartar que fuera de la primitiva antes de ver que era del consumidor—. Bajo, pero real,
y es exactamente el modo de falla que se repite: una responsabilidad que el consumidor tiene
que recordar es una que alguien no recuerda.

**La decisión, que es de SISTEMA y por eso va aparte:** que `DunaSheet` monte
`.duna-sheet__body` ÉL MISMO alrededor de sus children, y se quite el wrap manual de los
otros tres consumidores (si no, doble padding). Con eso el padding deja de ser algo que
recordar. Ojo con el detalle al hacerlo: los tres de detalle envuelven un `detalleNodo`
que YA es el scroller —`overflow-y: auto`—, así que hay que verificar que mover el `__body`
a la primitiva no cambie qué elemento scrollea (el sheet tiene `max-height` y el cuerpo es
el que debe scrollear).

**DISPARADOR (hecho observable): cuando un QUINTO consumidor de `DunaSheet` olvide el
`__body`** y aparezca el hueco de padding —contenido pegado a los bordes del sheet, el
defecto que MobileNav ya tuvo una vez—. NO "la próxima vez que se toque la primitiva": lo
que dispara es el DEFECTO, no un toque genérico. Antes de eso, con cuatro consumidores es
más barato el wrap repetido que el refactor de la primitiva + sus tres call sites.

### 35. Los carriles de Pedidos son NUEVE — la barra empezó a leerse como lista

Con "Listas para despachar", Pedidos tiene NUEVE carriles (Todos · Necesitan atención · En
preparación · Listas para despachar · En camino · Entregados · Por verificar · Por cobrar ·
Cancelado), y a 1280 con rail expandido ocupan **dos filas** (los 9 pills suman 1059px sobre
~992px de contenido; medido).

**El problema no es el ancho: es la LECTURA.** Nueve etiquetas dejan de leerse como una
barra de filtros y empiezan a leerse como una lista —el operador ESCANEA para encontrar la
suya, que es lo contrario de lo que un carril hace (estar a la vista de un vistazo)—. Cada
carril entró por buena razón; **nadie revisó la suma.**

**Costo YA pagado: ninguno medido** —es legibilidad, no un defecto—, y por eso va acá abajo.

**DISPARADOR: cuando haya uso real de Nayoli.** Ahí se mira cuáles carriles se tocan y
cuáles no —un carril que nadie usa se retira CON EL DATO, como se hizo con la cola de
reposición de Inventario—. No antes: hoy no hay evidencia de cuáles sobran, y podar por
intuición es cómo se quita el que sí importaba. La forma probable, si hiciera falta antes
del dato: agrupar los de fulfillment (preparación · listas · camino · entregados) bajo un
control distinto de los de cobro, o mover los acumuladores (Todos · Entregados · Cancelado)
fuera de la barra.

### 37. DOS controles de período en el panel, con la misma forma y distinta naturaleza

Tras la tanda 2, Analítica y Pagos/Inventario usan los MISMOS `.duna-pill` para elegir
período — la forma ya está unificada— pero siguen siendo **dos controles distintos**:
`SelectorPeriodo` (Analítica) elige entre CUATRO PERÍODOS NOMBRADOS (`PeriodoKey`, que
el endpoint entiende y hace eco), y `PresetsPeriodo` (Pagos, Inventario) elige un
RANGO (`desde`/`hasta`).

**NO se unificaron a propósito** (owner, 2026-08-20): unificarlos hoy exigiría que uno
pierda lo suyo — o Analítica cambia su contrato con el endpoint, o los presets pierden
el rango. Que compartan apariencia sin compartir naturaleza es aceptable **mientras la
diferencia sea real**; lo que no era aceptable era que se vieran distintos haciendo lo
mismo, y eso ya se cerró.

**Costo YA pagado: ninguno.** Es una duplicación de CONCEPTO, no de código: no hay dos
implementaciones del mismo control, hay dos controles.

**DISPARADOR: si el chip de Analítica gana RANGO EXPLÍCITO.** Ese es el momento en que
los dos controles pasan a hacer lo mismo y la duplicación se vuelve real. Y no es una
hipótesis suelta: es la MISMA decisión pendiente que bloquea el destino de la gráfica
de Pedidos del carrusel (§ la gráfica no tiene destino). Las dos se resuelven juntas o
ninguna.

### 38. `Customer.total_compras` — CERRADO: NO se dropea (decisión + censo, 2026-08-27)

**DECISIÓN (owner): la columna NO se retira.** Una columna que nadie lee no cuesta nada; dropearla
exigiría tocar TRES cosas (schema + seed + mocks) por un riesgo de CONFUSIÓN, no de datos. Y la trampa
del nombre —que era el único problema real— **ya queda documentada acá**, que es lo que la desactiva. Si
algún día se toca el schema de `Customer` por OTRA razón, la columna sale de paso; hasta entonces, se deja.

**LA TRAMPA, documentada para que no vuelva a engañar:** la COLUMNA `Customer.total_compras` es data de
demo que nadie lee para mostrar. Pero `GET /api/customers` devuelve un campo del MISMO nombre cuyo valor
NO viene de esa columna —`route.ts:69` lo sobrescribe con `paidTotalByCustomer()`, dinero real—. Así que
`cliente.total_compras` en un componente es el campo del API (dinero real), NUNCA la columna. Misma familia
que el ex-`Product.agotado` (columna inerte, dropeada en el #10), pero peor: el mismo identificador en las dos capas.

**CENSO POR CONTENIDO (2026-08-27), para que el próximo NO lo re-mida:**
- **Lecturas para mostrar de la COLUMNA: CERO.** La lista/perfil pintan el campo de la RESPUESTA (el
  override de `route.ts:69`), no la columna.
- **Escrituras de runtime: CERO.** `customer.create` (route.ts:96-108) no la incluye ni por spread; el
  PATCH tampoco. Cae al `@default(0)`.
- **La toca sólo el SEED:** `prisma/seed.ts:269` desde `lib/mock/customers.ts` (plomería de demo).
- **El campo/tipo del API homónimo (= `paidTotalByCustomer`) es OTRA cosa** y se queda; `types/customer.ts:21`
  es ESE campo, no la columna.

Si algún día SÍ se dropea: las tres (schema + `seed.ts:269` + `lib/mock`) van JUNTAS o el seed rompe; no
necesita expand/contract (nadie la lee).

### 39. Dos voces para el mismo umbral: `def.disparador` (diálogo) y `def.frase` (tarjeta)

El rediseño de Automatizaciones (2026-08-21) dejó DOS textos que describen el mismo
disparo con voces distintas: `def.disparador` es el string técnico que lee el
DIÁLOGO de Ajustes (`AutomationConfigDialog`, `DialogDescription`) —"Órdenes por
cobrar despachadas hace más de los días configurados"— y `def.frase(config)` es la
frase de la TARJETA con el valor inyectado —"Avisa cuando lleva 3 días despachado
sin cobrar"—.

**Fue la decisión correcta NO unificarlas ahora** (censo, 2026-08-21): convertir
`disparador` en función habría tocado el diálogo shadcn, que se dejó intacto (su
migración a `DunaDialog` es otra tanda). Así que la tarjeta ganó `frase` aparte.

**Costo YA pagado: ninguno.** Las dos son correctas hoy. Pero es una divergencia
esperando: si alguien edita una y no la otra, la tarjeta y el diálogo dirán cosas
distintas del mismo umbral, y nada lo delata —son dos campos del mismo registry, sin
test que los ate—.

**DISPARADOR: al migrar `AutomationConfigDialog` a `DunaDialog`** (que es también el
disparador del ítem que dejó la sub-decisión de H6: "cuando se toque el diálogo por
otra razón"). En esa tanda las dos voces se unifican —el diálogo pasa a leer
`frase(config)` como la tarjeta, y `disparador` se retira— así que quedan una sola.
No antes: hoy `disparador` es lo que el diálogo intacto consume.

### 41. Un pago sobre una orden CANCELADA: ¿se devolvió o se quedó?

El modelo no lo registra. Cancelar NO toca el `Payment` (§ El eje de COBRO), así que un
pago sobre una orden cancelada **sigue contando como ingreso** — y así lo cuentan las
cuatro superficies (Dashboard, Analítica, Clientes, Pagos) desde que `REVENUE_ORDER_SCOPE`
dejó de excluir cancelados (§ El Dashboard "Hoy"). Eso es correcto **mientras no haya
reembolsos modelados**: si la plata entró y no se devolvió, es ingreso del dueño.

Pero **de eso depende si la cifra es cierta.** Si un pago sobre una orden cancelada fue
DEVUELTO al cliente, hoy sigue sumando como ingreso y nadie lo resta — no hay estado de
`Payment` que diga "reembolsado", ni un asiento que revierta. El día que exista una
cancelación-con-reembolso real, el ingreso reportado (y los dos correos de automatización)
estarán inflados por esa plata que ya no está.

**Costo YA pagado: ninguno.** Medido en dev: los únicos pagos sobre cancelados son **2 de
prueba** ($56k), sin evidencia de cuál error es peor —contar una devolución como ingreso, o
esconder plata que sí entró—. Por eso la decisión de INCLUIR cancelados es la correcta hoy:
sin reembolsos modelados, esconderlos desincronizaría del libro de Pagos.

**DISPARADOR: el primer caso real de cancelación-con-pago en Nayoli.** Ahí se decide si un
pago sobre orden cancelada necesita un estado (reembolsado / retenido) y si el ingreso lo
resta. Las cuatro superficies leen la misma definición, así que el cambio es en UN sitio
(`REVENUE_ORDER_SCOPE` + el nuevo estado del `Payment`), no en cuatro.

### 48. VÍDEO en la galería de /nosotros — CONSTRUIDO (tanda B, 2026-08-26)

Un vídeo en una sección NO es un campo más —el modelo guardaba URLs de imagen, el upload validaba
JPG/PNG/WebP, y `next/image` no reproduce vídeo—. La tanda B (18 commits) lo construyó sobre la subida
directa a Blob de la tanda A. El diseño enviado:

- **Ítem MIXTO imagen|vídeo** en el repeater de la galería: `tipo: 'imagen'|'video'` **declarado** (no
  deducido de la extensión, § el modelo), `poster` por vídeo, `w`/`h` para la proporción de la celda.
- **Poster SUBIDO, no generado**, y sale de un FRAME del propio vídeo (scrubber, `canvas.toBlob` sobre el
  objectURL local — no contamina, medido) o de una imagen a mano (§ PosterScrubber). El alta junta los
  dos y sube al final, el póster PRIMERO (huérfano de 200 KB, no de 20 MB). "Cambiar vídeo" re-deriva su
  póster (un póster de un vídeo que ya no está es incoherente).
- **Rama de render**: imagen → `next/image`; vídeo → `<video muted loop playsInline preload="none">` +
  IntersectionObserver que reproduce al entrar en vista (MEDIDO: `autoplay` con `preload="none"` descarga
  igual). Reduced-motion → póster + controls. Badge de play PERSISTENTE, tinta sobre fondo tenue (un
  vídeo que no arranca se ve idéntico a una foto). El póster ocupa la celda a la proporción del VÍDEO
  (`object-cover`), así el masonry no salta.
- **Formato → CÓDEC, no contenedor; el .mov se re-envasa; el peso se acota por TOPE DE GALERÍA**: las
  subsecciones de abajo, que son el corazón de la tanda.

**EL GATE DEL VÍDEO ES EL CÓDEC, NO EL CONTENEDOR.** El allowlist por
CONTENEDOR (mp4/webm) NO garantiza que el visitante lo vea: el eje que decide la reproducibilidad es el
CÓDEC. Medido con `video.canPlayType(...)` (Chrome 148, macOS): un **HEVC-en-mp4 pasa el contenedor** (su
`file.type` es `video/mp4`) y da `probably` en ese Mac —macOS le presta el decodificador— pero vacío en un
Windows/Firefox stock; el `<video>` **no da error, muestra el PÓSTER QUIETO**, y el operador probando en su
Mac nunca se entera. Y **`canPlayType` no sirve de test**: sub-reporta MOV/H.264 (vacío para
`video/quicktime; codecs="avc1"` aunque Chrome a veces lo reproduce) y sobre-reporta HEVC.

La respuesta construida: **leer el CÓDEC del archivo en el navegador antes de subir** (`lib/video-codec.ts`,
parser PROPIO ~110 líneas —camina las cajas ISO-BMFF `moov→trak→mdia→minf→stbl→stsd` leyendo sólo cabeceras
con `Blob.slice()`, NO mp4box.js (~340 KB para leer 4 caracteres)—). **AVC** (avc1/avc3) pasa; **HEVC**
(hvc1/hev1) y **ProRes** (ap4h/apcn/…) se rechazan con mensaje accionable (`mensajeCodecRechazado`); un
veredicto **ILEGIBLE** (webm, archivo raro, truncado) cae a la RED DEL CONTENEDOR —rechazar por no poder
leer bloquearía archivos válidos por un parser incompleto (decisión del owner)—.

**El .mov se ACEPTA y se CONVIERTE SOLO — no se pide una conversión manual.** Firefox no reproduce el
contenedor .mov (Chrome sólo por sniffing), así que guardarlo dejaría al visitante de Firefox viendo el
póster fijo. Rechazarlo tampoco servía: **no hay ruta práctica de conversión en Mac** —QuickTime da .mov,
iMovie exige crear un proyecto (el owner no supo ni abrir el video), avconvert es la Terminal—; tres
instrucciones, ninguna que el operador logre. La salida es re-envasar el .mov a .mp4 EN EL NAVEGADOR, sin
re-codificar (`lib/video-remux.ts`, mp4box): sube su .mov y el navegador lo convierte. **MEDIDO sobre el
.mov real de 180 MB: ~4 s, salida .mp4 que reproduce.**

- **mp4box PINNEADO a 0.5.2** — el 2.4.1 (reescritura con rolldown) cambió `initializeSegmentation` y su
  `onSegment` NO emitía media en este flujo (medido: init-solo, cero frames). Import DINÁMICO (~31 KB gzip,
  code-splitteado por Next) → sólo viaja al subir un .mov. Sin tipos → `types/mp4box.d.ts`.
- **VIDEO-ONLY** (audio dropeado): la galería es muted. **NO comprime** —salida ≈ entrada—, y por eso el
  peso NO se arregla con el remux sino con el TOPE DE GALERÍA (abajo). El remux es local; streaming de la
  entrada, salida en memoria.
- **TOPE DE GALERÍA = 20 MB (`MAX_VIDEO_GALERIA_BYTES`), y NO es arbitrario:** una galería de finca son
  loops CORTOS, no un documental —es la forma del contenido—, y es lo que hace que un cliente en MÓVIL lo
  vea (166 MB tardan minutos; 20 MB cargan en segundos). Comprimir NO resolvería lo que duele: 3 min aun
  comprimidos siguen siendo ~87 MB (medido: 1080p @ 4 Mbps = 29 MB/min) — la DURACIÓN manda. El **#20**
  queda para aceptar clips cortos de bitrate ALTO, no vídeos largos. El tope aplica a lo que se SUBE
  (post-remux); en el pick hay un pre-chequeo generoso (1.5×) para no gastar el remux en un archivo
  obviamente grande. El mensaje pide un clip corto Y dice el orden de magnitud ("15 a 30 segundos").
- **El tope de remux de 250 MB SE RETIRÓ** (con él, la lógica de `navigator.deviceMemory`): con el tope de
  galería, al remux nunca le llega nada mayor a ~30 MB (~60–90 MB de memoria, seguro en cualquier móvil),
  así que su riesgo de OOM desapareció y el tope quedó sin caso.
- **El .mov NUNCA se sube como .mov:** se convierte antes, así que `video/quicktime` **NO** está en el token
  ni en `TIPOS_VIDEO` (queda en `CONTENEDORES_REMUXEABLES`, aceptado-para-convertir; afirmado en
  `constants/upload.test.ts`). El token sigue firmando sólo mp4/webm.
- **EL PARSER DE CÓDEC CORRE ANTES DEL REMUX:** un .mov con **HEVC** se rechaza sin intentar convertir —el
  remux copia el códec, no lo arregla—. Y su valor principal es independiente del .mov: un **HEVC-en-mp4**
  pasa el check de contenedor (`file.type: video/mp4`) y no se reproduce; el parser lo caza.
- **El mensaje de HEVC NO promete conversión** (no hay una que el operador logre): dice lo que SÍ se puede,
  grabar en "Más compatible" la próxima vez. Es la lección de las tres instrucciones fallidas.
- **La etapa "Convirtiendo el video…"** va nombrada, antes de "Subiendo póster" y "Subiendo video" (tres
  etapas). El remux es local, así que va primero sin romper el póster-primero anti-huérfano.

**HUECOS NOMBRADOS, menores:** el WebM pasa por contenedor (EBML, otro formato; códecs web-amigables); un mp4
que el parser no pueda leer pasa por la red del contenedor (un HEVC-en-mp4 malformado se colaría, raro).

### 49. Las TRES tarjetas de plan de Suscripción son ESTRUCTURA — no editables (todavía)

El editor de Suscripción (§ SubscriptionCTA) hace editable el TEXTO de la sección (eyebrow, título,
subtítulo, beneficios, label del CTA), pero **las tres tarjetas de plan NO**: siguen viniendo de
`SUBSCRIPTION_PLANS` (`lib/mock/subscriptions.ts`), como estructura.

**OJO — NO son datos falsos, y hay que dejarlo escrito para que nadie las confunda con los testimonios
fabricados (§ SiteContent — el repeater):** el "mock" está en el PATH (`lib/mock/`), no en el CONTENIDO. Son la propuesta real de Nayoli
(Plan 250 g / 500 g / Familiar, bolsas de su propio café), **SIN precio ni descuento** —el tipo
`Subscription` no tiene campo de precio, y el CTA abre WhatsApp "me interesa", no cobra—. No hay ningún
claim que Nayoli no honre. A diferencia de los testimonios, acá no hay nada que vaciar.

**Por qué quedaron fuera del editor** (decisión del owner): `SUBSCRIPTION_PLANS` es **fuente
COMPARTIDA con la página `/suscripciones`** (dos consumidores). Hacerlas editables en SiteContent las
haría DIVERGIR de esa página, o exigiría que `/suscripciones` también lea de SiteContent — una decisión
más grande que "el texto de la home".

**Costo YA pagado: ninguno.** Las tarjetas se ven bien y dicen la verdad.

**DISPARADOR: cuando alguien quiera editar los planes.** Ahí se decide (a) si `/suscripciones` también
lee de SiteContent —para no divergir—, y (b) que son un repeater propio con DOS restricciones de layout
ya conocidas: **el `sm:grid-cols-3` y el flag `popular` (i===1) asumen EXACTAMENTE tres** planes, así
que variar el número es rediseño de esa rejilla, no sólo modelo.

### 51. Lightbox de imágenes en la galería de /nosotros — ampliar una foto al clic

Hoy una foto de la galería no se puede ampliar. Es la expectativa normal de una galería (clic → foto
grande), pero es CAPACIDAD NUEVA. La primitiva `ImageLightbox` (`components/admin/ImageLightbox.tsx`,
`{src, alt, onClose}`) EXISTE pero es **admin-level** —estilada para el panel, tema oscuro incluido—, así
que **no es reuso gratis**: o se extrae a un lugar compartido/neutral, o se escribe un lightbox propio del
storefront (overlay + imagen + cerrar con Esc/click-fuera + foco atrapado).

**Alcance: SÓLO imágenes.** El vídeo reproduce inline; un "lightbox de vídeo" (reproductor ampliado) es
otra pieza. Sólo las celdas-IMAGEN abren; las de vídeo no.

**Costo YA pagado: ninguno** —es una mejora, no un defecto—. Estimado **BAJO-MEDIO** (~40–60 líneas si es
propio del storefront; menos si se extrae la primitiva) + su a11y (teclado, foco). **DISPARADOR: que
alguien quiera ver una foto en grande.**

### 52. "Ingresar con WhatsApp" en el login — capacidad que no existe

La maqueta del rediseño del login dibujaba un "Ingresar con WhatsApp". **NO se dibujó** (rediseño del
2026-08-27): en la PUERTA, un botón/enlace de un método de acceso que no existe es un **enlace muerto**
que bloquea a quien cree que ése es su camino —exactamente lo que el rediseño del login existe para no
tener, y la misma razón por la que el reset se construyó ANTES de cablear su enlace—. Hoy no hay login
por WhatsApp: ni el flujo (OTP/número → sesión), ni el canal de Meta conectado (§ los prerequisitos de
go-live de WhatsApp, que están para las AUTOMATIZACIONES, no para auth).

**Costo YA pagado: ninguno.** Es una capacidad no construida, no un defecto.

**DISPARADOR: cuando exista un login por WhatsApp/OTP cableado** (un flujo real que cree sesión). Ese
día se dibuja el botón, apuntando a algo real. No antes.

## Config del negocio — `SiteSetting` (los planos editables)

Tanda del 2026-08-24. Los datos PLANOS del negocio dejaron de vivir en código
(`siteConfig`) y pasaron a `SiteSetting` (base), editables en Configuración. Lo que sigue
es la implementación y sus decisiones; el encuadre de producto (qué se adelantó del
multi-tenant y qué queda) vive en § Datos de negocio editables (Mejoras post-multitenant).

**LA FRONTERA negocio ≠ tienda, que hay que tener escrita antes que nada:** esta pantalla
es **CONFIGURACIÓN DEL NEGOCIO** —su IDENTIDAD: nombre, tagline, WhatsApp, Instagram,
remitente de correos, correo de reportes—. NO es la sección **"Tienda"** de `duna-os.html`,
que es el **CONTENIDO del storefront** (hero, fotos, títulos de producto) y sigue pendiente
como trabajo aparte. Confundirlas lleva a meter fotos de producto en un formulario de
identidad, o a creer que "Tienda" ya está hecha porque el negocio es editable. No lo está.

### El modelo: fila única, born en `public`, SIN `tenant_id`

`SiteSetting` es un SINGLETON: `id String @id @default("default")` + un CHECK
(`SiteSetting_singleton`, `"id" = 'default'`) que hace **imposible** una segunda fila. No
tiene `tenant_id` **a propósito** — agregarlo ahora fijaría la arquitectura multi-tenant
desde un lado sin el acuerdo con Carlos. Es una **mina inerte al revés**: el día del
multi-tenant, la fila `default` pasa a una por tenant y el CHECK se reemplaza por el scope;
mientras tanto, una sola fila no puede mentir sobre a qué negocio pertenece porque sólo hay
uno.

**LA FILA LA GARANTIZA LA MIGRACIÓN, no el seed** (`20260824120000_add_site_setting`:
CREATE TABLE + INSERT en el mismo `migration.sql`). Es el punto que hace desplegable la
tanda: el build corre `migrate deploy` pero **NO** el seed, así que si la fila naciera en
`prisma/seed.ts` producción arrancaría sin ella y todo lector `findUniqueOrThrow` reventaría.
El seed hace un `upsert` idempotente de los mismos valores para el dev que se re-siembra.

### Los DOS loaders — y por qué son dos

Leer `SiteSetting` tiene dos entradas, y la separación NO es estilo:

- **`readSiteSettings` (`lib/config/site-settings-read.ts`)** — el lector RAW: `findUniqueOrThrow`
  + proyección, **SIN `server-only` ni `react/cache`**. Lo usan los contextos que NO son
  renders: route handlers, `buildBrand`, el motor de automatizaciones, y **el CARRIL**.
- **`getSiteSettings` (`lib/config/site-settings.ts`)** — envuelve al RAW con `cache()` y lleva
  `import 'server-only'`. Es para RENDERS (layouts, páginas server): dedupe por request.

**Por qué el RAW existe y por qué nada de la cadena del carril puede tocar `getSiteSettings`:**
`server-only` **no resuelve en tsx/node** (es un alias del build de Next), así que un test del
carril que importe —aunque sea transitivamente— un módulo con `import 'server-only'` revienta
al importar. El carril importa `buildBrand` (directo) y toda la cadena de automatizaciones
(que llega a `defaultTeamRecipients`/el canal email). Por eso `buildBrand`, los recipients y el
guard del PATCH leen el RAW, nunca el cacheado. Un `import type` desde el archivo server-only SÍ
es seguro (se borra en compilación) — así lo consumen los dos providers.

**FALLA RUIDOSO, jamás fallback a los valores de código.** Los dos loaders usan
`findUniqueOrThrow`: si la fila no existe, revienta. Un fallback a `siteConfig` mostraría datos
rancios sin que nada falle —el peor modo, el mismo de § el artefacto rancio—. La fila la
garantiza la migración, así que su ausencia es un deploy roto y debe fallar fuerte.

### Dos providers CLIENTE separados, y el gate en paralelo

Los lectores cliente reciben la config por contexto, no la fetchean. Son **DOS providers
distintos** —`components/storefront/SiteSettingsProvider` y `components/admin/SiteSettingsProvider`—
porque son dos layouts, dos árboles que no se tocan, y el admin tiene sesión/gate que el
storefront no. Compartir uno ataría dos cosas independientes.

- **Storefront**: el layout server lee `getSiteSettings()` y lo inyecta; StoreFooter/checkout/
  suscripciones usan `useSiteSettings()`.
- **Admin**: el layout-GATE (`app/(admin)/admin/layout.tsx`) lo lee en un `Promise.all` **con
  `getSession`, NO después de la query de usuario**. No había Promise.all que reusar (el gate es
  cadena dependiente sesión→usuario); el paralelismo posible es sesión ∥ config, porque la config
  es independiente de la sesión. Ponerla tras la query de usuario duplicaría la latencia del gate
  en cada request. Los 5 lectores cliente (perfil, pedidos, pagos, clientes, ScheduleDeliveryModal)
  usan `useSiteSettings()`.

**Las pantallas PRE-AUTH se partieron** (login, aceptar-invitación): PreAuthShell muestra
"Panel de {nombre}" y es **client-rendered** (lo montan dos páginas `'use client'`), así que no
puede leer el loader server-only. Cada página pasó a **shell SERVER** (lee `getSiteSettings`,
pasa `nombre` por prop) + **form CLIENTE** (toda la lógica: estados, submit, redirect, el flujo
del token). Se descartó un provider de grupo —consultaría la base en cada request anónimo de
/login— y quitar el nombre —la línea de contexto está a propósito y deja de ser decorativa con
más de un tenant— (owner).

### ADMIN_EMAIL se retiró; el destinatario de reportes vive en la base

`ADMIN_EMAIL` tenía DOBLE función —login del OWNER del seed Y destinatario runtime de los
reportes al equipo— y esa doble función era la trampa (§ total_compras: un nombre, dos hechos).
Se partió en dos, cada uno con su nombre:

- **`SEED_OWNER_EMAIL`** — sólo el login del seed (local; no va a Vercel).
- **`SiteSetting.adminEmail`** — el destinatario runtime, editable en Configuración.
  `defaultTeamRecipients`/`parseRecipients` (canal email) lo leen del RAW; `buildBrand` lee de ahí
  el remitente/marca de los correos al cliente.

**EL GUARD del PATCH `/api/automations/[key]`** (`reporteSinDestinatario`): encender un reporte
`email`+`equipo` sin destinatario efectivo (config `destinatarios` vacía Y `adminEmail` vacío)
devuelve **400** con un mensaje que dice DÓNDE ponerlo (Ajustes de la automatización, o el correo
del negocio en Configuración). **Impide el estado inconsistente en la puerta, no lo reporta
después**: sin el guard, la automatización queda ENCENDIDA y luego OMITE en silencio en cada
corrida. El guard reusa `parseRecipients`, así que la puerta y el envío no divergen sobre qué
cuenta como destinatario. Afirmado en el carril (`reporte-destinatario.test.ts`, visto fallar sin
el bloqueo; demuestra el OMITIDO que previene). **No borrar ese test.**

**NOTA de deploy, verificada por el owner:** al momento del deploy de SiteSetting, `resumen_diario`
y `reporte_semanal` estaban ambos `activo=false` en producción (cero filas encendidas). Así que
`adminEmail` naciendo NULL **no dejó a nadie sin destinatario** — no hubo que backfillear el correo
ni apagar ningún reporte. El guard cubre de aquí en adelante.

### El editor NACE EN LECTURA — edición deliberada

La sección "Datos del negocio" arranca mostrando los valores como TEXTO; un "Editar"
(secundario) los vuelve editables; Guardar o Cancelar y vuelve a lectura. Razón: son datos que
se cambian dos o tres veces al año — un formulario siempre abierto expone a un accidente algo que
casi nunca se toca, y "sólo se guarda al dar Guardar" no basta (el operador no debería tener que
saberlo).

- **REUSA la maquinaria de descarte, no inventa una.** No hay patrón lectura↔edición in-place
  (cliente/producto editan por modal), pero `useDescarteDeDrawer` es genérico (su `onCerrar` es "la
  salida real" — acá, salir de edición) y `ConfirmDescartarDialog` es su UI. Cancelar con cambios
  PREGUNTA; sin cambios vuelve directo. Lo único nuevo es la vista de lectura + un `editando` bool.
- **Edición POR SECCIÓN**, no por campo: un "Editar" abre los 8 campos.
- **`adminEmail` lleva etiqueta EXPLÍCITA** ("Correo donde llegan los reportes del equipo"): es el
  único campo cuyo nombre no se explica solo.
- **Validación compartida con el PATCH** (`siteSettingsEditableSchema`, sin `server-only`): aviso
  temprano por campo en el cliente, el server MANDA. El write es COMPLETO (el editor manda todo el
  formulario), así que NO aplica la trampa del PATCH parcial (§ El PATCH de producto es PARCIAL).
- **Al guardar, `router.refresh()`** re-corre el layout server → los otros lectores del admin
  (WhatsApp de pedidos, Perfil, correos) ven los valores nuevos sin recargar a mano.

**Configuración recuperó su nombre.** Era "Equipo y usuarios" mientras SÓLO mostraba equipo
(llamarla "Configuración" con una sola cosa adentro habría sido la promesa vacía que el rediseño
evita). Con el editor del negocio hay contenido real, así que vuelve a "Configuración" con DOS
secciones (Datos del negocio · Equipo y usuarios), y el UserMenu + el título de pestaña vuelven a
"Configuración"/Settings. **SIN sub-rutas todavía**: dos secciones caben en una página; el hub con
sub-routes es la era multi-tenant. Y **"Agregar usuario" bajó a secundario**: en lectura la
pantalla no tiene primario sólido, y al editar "Guardar cambios" es el único ancla — sin dos
primarios compitiendo (§ un solo primario sólido por vista).

### Qué QUEDA en `siteConfig`

Sólo lo ESTRUCTURADO: `tienda.emailColors` (paleta hex de los correos, la lee `buildBrand`),
`footerNav` y `legalNav` (los lee StoreFooter). Y las FUNCIONES puras —`whatsappUrl`,
`formatWhatsappDisplay`, `instagramUrl`— que no son datos de tenant. Todo lo demás (`brand`,
`contacto`, los planos de `tienda`) se retiró. `whatsappUrl` recibe el número (una sola fuente:
`SiteSetting.whatsapp`); `formatWhatsappDisplay` DERIVA el display del número, sin un segundo
campo que pudiera divergir.

## Config del contenido — `SiteContent` (el storefront editable)

Tanda del 2026-08-25 (hero primero). El CONTENIDO editorial del storefront —la home— dejó de
vivir en el JSX y pasó a `SiteContent` (base), editable en `/admin/tienda`. Es la sección
**"Tienda"** que el § negocio≠tienda dejó pendiente: lo que el CLIENTE ve, distinto de la
IDENTIDAD del negocio (Configuración).

### HARD vs SOFT — el contraste con SiteSetting, a PROPÓSITO

| | **SiteSetting** (identidad) | **SiteContent** (contenido) |
| --- | --- | --- |
| cadencia | 2×/año | semanal |
| loader | **HARD**: `findUniqueOrThrow`, falla ruidoso | **SOFT**: `findUnique` → defaults, nunca lanza |
| migración | CREATE **+ INSERT** (la fila la garantiza la migración) | CREATE, **SIN INSERT** |
| el vacío es… | un error (deploy roto) | un **estado LEGÍTIMO** del editor |

Sin fila, SiteContent renderiza los **defaults del código** (los literales de hoy) → no hace
falta sembrar la fila. SiteSetting falla ruidoso, así que SÍ necesitó el INSERT. Mismo patrón
de "config editable", modos de falla OPUESTOS.

### El modelo: JSON doc, dos loaders SOFT, provider propio

- `SiteContent` singleton (`id='default'` + CHECK, sin `tenant_id`), `content Json`. Los
  DEFAULTS (los literales del hero) + el REGISTRY viven en `lib/config/site-content-defaults.ts`
  (PURO — capa 1 lo prueba).
- Dos loaders como SiteSetting: `readSiteContent` (RAW, sin server-only, para route handlers/
  carril) y `getSiteContent` (cached/server-only, para renders) — PERO SOFT (`findUnique`,
  sin fila devuelve los defaults resueltos).
- Provider PROPIO del storefront (`SiteContentProvider`), separado del de SiteSettings: dos
  datos con cadencia y modo de falla distintos.

### La FRONTERA fina de "defaults-como-fallback" — requerido ≠ opcional

Es la contraparte de § los defaults-como-fallback, y merece quedar escrita porque es sutil:

- **REQUERIDO vacío → cae al DEFAULT.** La página lo NECESITA (un hero sin titular no existe).
- **OPCIONAL vacío → SE OMITE** (el elemento desaparece), **NO cae al default.** Si cayera, un
  campo opcional **no sería OCULTABLE** y la distinción requerido/opcional no significaría nada.

**La regla, en una línea: el fallback aplica a lo que la página NECESITA, no a lo que el dueño
puede ELEGIR no mostrar.** El editor lo dice en el placeholder de CADA campo —requerido:
"Vacío: se usa el texto por defecto"; opcional: "Vacío: no se muestra"— para que el vacío nunca
sea una adivinanza. La mecánica vive en `resolverSiteContent` (`site-content-defaults.ts`): un
requerido vacío toma el default; un opcional PRESENTE-aunque-vacío se respeta (→ se omite).

### Visibilidad por sección — `visible` + `ocultable` declarado, hide-on-empty

- **`visible` booleano por sección; qué sección EXPONE el toggle es `ocultable`** (declarado en
  el REGISTRY), no un `if` en el renderer. **Hero `ocultable:false`** —una home sin encabezado
  no es un caso de v1— → su editor no ofrece ocultar.
- **REPEATER → hide-on-empty**: array vacío → la sección NO se renderiza (gana sobre `visible`).
  Testimonios es el primero (construido; § el repeater, abajo).
- **La EXCEPCIÓN a los defaults (§Q4): sin defaults para un CLAIM falso.** Los defaults valen
  para copy; NO para prueba social fabricada (reseñas, ratings, premios). Testimonios nace SIN
  defaults y hide-on-empty (§ el repeater, abajo) — vuelve con testimonios reales o no vuelve.

`seccionEsVisible(def, sec)` combina las tres reglas; probada en capa 1 con un repeater
sintético (deja la mecánica lista para las secciones que faltan, aunque el hero no la ejercite).

**LAS SECCIONES EDITABLES HOY SON CUATRO:** hero (portada, `ocultable:false`), brandStory (Historia,
`ocultable:true`, 4 imágenes fijas), **subscriptionCTA** (Suscripción, `ocultable:true`, **solo
texto**), y **testimonials** (Testimonios, `ocultable:true`, la 1ª sección **REPEATER**). Suscripción
es la más simple —casi enteramente datos sobre la cáscara genérica (`TiendaSeccionEditor`)— y aporta
dos cosas al modelo:
- **Bullets OPCIONALES como repeater-pobre**: `bullet1..4` opcionales que el componente junta con un
  `.filter` → "hasta 4 sin hueco" (vaciar uno cierra la lista), sin arrastrar el repeater real (que la
  plataforma ya tiene; se usa si se quieren 5+ beneficios —un repeater de strings—). Se etiquetan
  "Beneficio 1…4" (el nombre dice lo que son; el hint del primero encuadra el grupo), NO "slot 1…4".
- **Contenido editable ≠ estructura compartida**: las 3 tarjetas de plan quedan FUERA del editor
  —son `SUBSCRIPTION_PLANS`, fuente compartida con `/suscripciones` (§ Backlog #49)—. El editor toca
  el texto de la home, no una fuente que otra página también lee.

### El REPEATER — la plataforma (Testimonios la estrena; sirve también a la galería de /nosotros)

Testimonios es la 1ª sección de LISTA. La maquinaria es PLATAFORMA, agnóstica de sección —cambia sólo
la config de campos por ítem—, así que la galería de /nosotros (§ La GALERÍA de /nosotros) la reusa
cambiando los descriptores (imagen por ítem en vez de texto+rating). Dos mitades:
- **El resolver de arrays** (`resolverItems` + la rama repeater de `resolverSiteContent`): resuelve el
  array de items guardado; los campos string requerido/opcional se normalizan, los NO declarados (un
  rating numérico) pasan tal cual. `mezclarBorrador` pisa la sección entera, así que el borrador carga
  el array completo (sin merge por ítem).
- **El `RepeaterEditor`** (`components/admin/RepeaterEditor.tsx`): agregar/quitar/editar/reordenar
  (**flechas**, § Backlog #50) ítems COLAPSABLES (renglón-resumen + expandir). Rating = estrellas
  clicables. NO NOMBRA NINGÚN CAMPO CONCRETO: opera sobre `descriptor.name`/`.tipo` y los roles
  `resumen` (principal/detalle). CONTROLADO por la cáscara: todo cambio —incluidos agregar y quitar—
  pasa por `onChange → cambiar`, el mismo autoguardado que un campo plano.
- **El tipo `imagen` y el `max`** (tanda 2 de /nosotros): un campo `tipo:'imagen'` sube por
  `pedirImagen` (el `pedir` del uploader compartido de la cáscara, § useSubidaImagen) —el repeater no
  tiene uploader propio: un `<input>`, un `subiendo`—; con un campo imagen, "Agregar" sube primero (un
  ítem-imagen vacío es una foto rota) y el renglón colapsado muestra una miniatura. `max` (opcional)
  deshabilita "Agregar" con hint al llegar al tope. Ambos son OPCIONALES: testimonios (sin imágenes,
  sin tope) no cambió.
- **Borrar CONFIRMA, en la PLATAFORMA.** La papelera reusa `ConfirmDescartarDialog` (no borra directo):
  borrar una foto o un testimonio destruye trabajo y no hay deshacer campo por campo. Va en el
  RepeaterEditor, no en el tipo imagen —un testimonio borrado destruye igual—. El artículo del copy
  sale de `RepeaterConfig.genero` ("¿Eliminar esta foto?" / "¿Eliminar este testimonio?"). Va con el
  primario, no rojo: quitar un ítem del borrador no destruye un registro persistido (§ ConfirmDeleteDialog);
  y es ESCALONADO —quitar una foto publicada no borra su blob hasta PUBLICAR (§ la galería, el blob), reversible
  con Descartar hasta entonces—.

**Un repeater tiene DOS razones para no mostrarse, y la PRECEDENCIA está fijada (afirmada en capa 1):
items vacío OCULTA aunque `visible` sea true** (hide-on-empty gana sobre el toggle). En la cáscara,
`noSeMuestra = toggle-apagado ∨ lista-vacía` pinta el placeholder de la vista/tarjeta —sin él un
repeater vacío deja la vista en BLANCO, que se lee como roto—; el aviso distingue el porqué. El badge
"Oculta" sigue atado sólo al toggle.

**Testimonios (§ #44, CERRADO): defaults con `items: []` VACÍOS, los tres fabricados BORRADOS del
código.** Citaban productos que Nayoli no vende; eran prueba social fabricada horneada en el JSX. La
sección EXISTE y su editor está listo; con items vacíos la home la oculta. El owner recarga los
testimonios REALES —o los tres actuales como placeholder hasta hablar con Luis— **como DATO por el
editor** (borrador→publicar), NUNCA en defaults. Es la excepción a defaults-como-fallback: los defaults
valen para copy, no para un CLAIM falso (reseñas, ratings, premios). Si vuelve a entrar contenido
fabricado, es DATO que el owner controla y reemplaza antes del primer cliente real —ya no un invariante
del código—.

**HALLAZGO DE MÉTODO — en un repeater los DEFAULTS no sirven para verificar el render.** El resolver
SIEMPRE usa los items GUARDADOS (el default del array queda muerto), y eso es a propósito: es lo que
protege el invariante de #44 —un default de lista jamás puede mostrarse, así que nadie puede hornear
reseñas falsas "de relleno"—. La contrapartida: **verificar el render de un repeater NO se puede hacer
tocando los defaults** (son inertes); exige **sembrar datos REVERSIBLES** en la base (§ la verificación
del display de 5 estrellas se hizo así: seed → check → restore). Es la vuelta de tuerca de
"defaults-como-fallback": valen para copy, y en un repeater no valen para nada.

### Las imágenes

- **Reusa `/api/upload` con `prefix: 'contenido'`** (whitelist `PREFIJOS_UPLOAD`: 'productos' |
  'contenido'; un valor fuera cae al default, nunca a una ruta arbitraria). El campo es un
  STRING: acepta path estático (`/images/…`) o URL de Blob —`next/image` sirve ambos,
  `storage.delete` es no-op sobre estáticos—. **Los 8 assets NO se migran**: los defaults los
  referencian estáticos.
- **Tope 4 MB** (body serverless de Vercel; un 8 MB se rechaza con 400). Orden **SUBIR→GUARDAR**;
  mientras sube todo se bloquea y el botón nombra la etapa —no hay "creyó que guardó y no
  subió"—. El PUT borra el blob viejo REEMPLAZADO (diff, como productos).
- **#20 (subida sin comprimir) sigue ABIERTO**, y el hero full-screen lo hace más visible: una
  imagen de 4 MB servida sin comprimir pesa. Se señala; su fix es el disparador de #20.

### El editor y el rail

- El editor (`TiendaHeroSeccion`) REUSA la cáscara lectura↔edición de `DatosNegocioSeccion`
  (`useDescarteDeDrawer` + `ConfirmDescartarDialog`); DIFIERE sólo en la imagen, que toma la
  etapa `'subiendo'|'guardando'` de `ProductFormModal`. Compone dos patrones, no inventa.
- **Rail: "Tienda" SUELTO** (sin `seccion`) tras Crecimiento. Un grupo de un ítem es un
  encabezado que no agrupa (regla del owner). **Semilla de un grupo "Tienda"** cuando exista una
  2ª pantalla de storefront-admin (las páginas legales, § `legalNav` vacío). RESERVA de gate: un
  ítem suelto tras dos grupos etiquetados puede leerse como sobrante ("Hoy" funciona porque va
  primero); si no cuadra, la salida es el grupo de un ítem. El conteo del tripwire de
  `admin-titulo` pasó 8→9 a propósito.
- **Los hrefs de los CTA son ESTRUCTURA** (`HERO_HREFS`): labels editables, destinos FIJOS. Un
  href libre dejaría el botón principal apuntando a una ruta inexistente. DISPARADOR si se pide
  editarlos: un selector entre rutas CONOCIDAS, no un campo libre.

### La PANTALLA — vista previa EN VIVO + editor con autoguardado (`/admin/tienda`)

Tanda del 2026-08-25. `/admin/tienda` edita el CONTENIDO editorial del storefront (hoy el hero
de la home; distinto de Configuración, que edita la IDENTIDAD del negocio, § negocio≠tienda). El
flujo FINAL, tras evaluar y retirar un iframe intermedio (ver "por qué se retiró", abajo):

- **BORRADOR / PUBLICADO — guardar deja de publicar.** `SiteContent` tiene `content` (PUBLICADO,
  lo que lee la tienda en vivo) y `borrador Json?` (el trabajo sin publicar). El editor escribe el
  BORRADOR; **Publicar** copia la sección del borrador a `content`; **Descartar** la limpia sin
  publicar. El borrador es un mapa PARCIAL por sección (`{ [seccion]: draft }`) para que publicar
  una NO arrastre otra a medias —afirmado en el carril—. La escritura (con la mitad servidor
  extraída para el carril, como `aplicarAjusteInventario`) vive en `lib/config/site-content-write.ts`.
  **SIN lock cross-operación**, y es DECISIÓN con argumento: el race guardar↔publicar necesita dos
  writes en la ventana de milisegundos entre el read y el write de publicar, que un operador
  humano —aun con dos pestañas— no alcanza; el fallo es visible en la preview y recuperable, no un
  libro corrompido como el despacho. DISPARADOR del lock (advisory, la fila es SOFT): automatización
  que escriba borradores, o editores concurrentes de verdad.

- **AUTOGUARDADO — el guardado no es un gesto.** El borrador se persiste solo mientras el dueño
  edita (debounce 1s + flush en blur/unmount); **Publicar es el único botón**. La lógica delicada
  (debounce, encolado, reintento) vive en un COORDINADOR puro framework-agnóstico
  (`lib/autoguardado.ts`), probado con relojes falsos y VISTO FALLAR sin el mecanismo —una ráfaga
  de teclas = un guardado; editar durante un guardado EN VUELO no se pierde; el fallo reintenta
  solo—; el hook `useAutoguardado` sólo lo envuelve. El indicador "Guardando…/Guardado/No se pudo
  guardar" (con Reintentar) es PERSISTENTE, no un toast por tecla; **"Guardado" sólo cuando NADA
  pendiente ni en vuelo** (garantía del coordinador — un "Guardado" con algo encolado sería la
  mentira que evita). **beforeunload SÓLO en 'error'** (§ decisión): pendiente/guardando es común
  y su pérdida es una frase recuperable; un guardado que FALLÓ y no persiste es el caso grave. La
  imagen va FUERA del debounce (sube al elegirla; el autoguardado del texto se BLOQUEA mientras
  sube, y lo tecleado durante la subida queda en `formRef` y se guarda al terminar — no se pierde).
  El schema es SOFT/todo-opcional → no hay validación que bloquee el autoguardado. El copy es corto
  ("Borrador guardado.") — la píldora "Sin publicar" carga el peso.

- **LA VISTA PREVIA ES EN VIVO — componentes REALES, no un iframe.** `VistaTiendaEnVivo` renderiza
  el componente REAL del storefront (`HeroSection`) DENTRO del panel, alimentado por el estado del
  FORM: se teclea y la vista cambia en el MISMO render, sin guardar→recargar. Tres piezas:
  - **Provider LOCAL que pisa cualquiera de arriba:** `<SiteContentProvider value={{ ...DEFAULTS,
    hero: form }}>` es el ÚNICO SiteContentProvider del subárbol admin (no hay otro), así que
    HeroSection lee el FORM EN VIVO, no el borrador persistido; el value es un objeto NUEVO por
    render → la vista sigue al form.
  - **`PreviewProvider` (`useIsPreview=true`) → ESTÁTICO:** en preview HeroSection usa
    `initial={false}` → renderiza en "visible" SIN animación de entrada (contenido asentado desde
    el primer render; NO queda invisible esperando una intersección de `whileInView`, que dentro de
    un contenedor escalado no llega), y la flecha en bucle se apaga. `useIsPreview` sobrevivió al
    retiro del `?preview` con este sentido nuevo; la sección futura con `whileInView` (BrandStory)
    aplica el mismo `initial={preview ? false : …}`.
  - **Escala:** render a ancho DESKTOP (1280) + `transform: scale(paneW/1280)`, RO sobre el PANE
    (ignora el aviso de ancho 0), recalcula al colapsar el rail. El `92vh` del hero resuelve contra
    el viewport REAL del admin (~800px fijo) → **proporcional POR CONSTRUCCIÓN**. Un RO extra sobre
    el CONTENIDO da su alto para dimensionar el pane.

- **LECTURA = TARJETA; EDICIÓN = VISTA GRANDE.** En lectura cada sección es una TARJETA compacta
  —miniatura de la vista + título + badge de estado + "Editar"—; al entrar en edición esa sección
  crece en su lugar a la vista grande + form (split vista | form), y las otras se quedan como
  tarjetas. Resuelve dos síntomas de una: en lectura (cuando MENOS se necesita) cada sección ya no
  ocupa toda la pantalla, y —la clave— **el scroll interno DESAPARECE en lectura**. El scroller que
  atrapaba la página vivía en el pane grande (`overflow-y:auto` + `max-height`); la tarjeta es alto
  fijo + `overflow:hidden`, sin scroller propio. Los editores son INDEPENDIENTES (cada sección con
  su `editando`): forzar una sola abierta sería estado elevado para prevenir algo que nadie hace por
  accidente. Edición independiente: **"Editar"** abre, **"Listo"** cierra (flush del pendiente).
- **LA MINIATURA es la MISMA vista, sólo encuadrada distinto** (no una segunda representación que
  pueda divergir — la razón por la que se retiró el iframe). `VistaTiendaEnVivo` gana un modo
  `compacto`: **scale-to-FIT de la sección ENTERA** en una caja 16:9, centrada (letterbox mínimo —
  hero y BrandStory son ~16:9). NO es una franja superior: como las secciones CENTRAN su contenido
  (`items-center` + `py`), una franja lideraría con el padding; el fit muestra la composición real
  (el hero: imagen + título; BrandStory: bloque de texto + collage). La vista es INERTE
  (`pointer-events:none`) para que el clic abra Editar, no navegue por sus links. La sección OCULTA
  no renderiza miniatura (se auto-oculta → vacío): muestra el aviso muted "No se muestra en la
  tienda". El costo (montar el componente real por tarjeta) es el MISMO que la lectura ya pagaba.
- **STICKY sólo en EDICIÓN.** La vista grande queda STICKY mientras el form scrollea (la columna de
  campos es más larga): al bajar por los campos el hero sigue arriba y cambia con cada tecla. El
  elemento `.tienda-vivo__vista` (sticky) **sólo se renderiza en la rama de edición**, así que al
  dar "Listo" se DESMONTA y no queda ningún elemento pinneado sin razón. Sticky contra la VENTANA
  (la página es document-scroll, no `.duna-sin-split` → el scroll es el documento; la cadena de alto
  fijo #42 no aplica, y ningún ancestro tiene overflow que rompa el sticky). CAP al viewport
  (`max-height` + `overflow-y:auto` en el pane grande) por si el hero escalado excede la ventana en
  pantallas cortas; en el caso normal no se activa. Enlace **"Ver la tienda"** (`/`, pestaña nueva)
  para la home completa. **El hero NO cambia de comportamiento al editar** (autoguardado, sticky,
  publicar, descartar, indicador, imagen única, campos): sólo su LECTURA pasó a tarjeta, como todas.

- **POR QUÉ SE RETIRÓ EL IFRAME.** Un iframe SIEMPRE tiene guardar → recargar → renderizar: el
  dueño teclea, espera el guardado, espera la recarga, y recién ve el cambio. Medido: el render de
  la home en PROD eran ~157ms, y el retraso percibido era casi todo ESPERA DELIBERADA (debounce +
  espera del reload), no el render — o sea el iframe nunca fue lento; el ciclo guardar-recargar era
  el problema, y no se arregla con un debounce más corto. La vista en vivo lo elimina de raíz: la
  vista es el mismo render que el form. Con el iframe se fueron el doble-buffer, `?preview=1`,
  `StorefrontFrame`, el gate de sesión `?borrador=1` (`debeLeerBorrador`), `readSiteContentBorrador`
  y la regla noindex de `?preview` (censo por contenido = 0 en el commit del retiro). El
  storefront volvió a un div plano conservando `bg-[#faf7f4] font-inter` (verificado: la tienda no
  cambió de aspecto). El **borrado de blobs generalizado se QUEDA** —in-use = content ∪ borrador
  (§ el borrado de blobs), independiente del mecanismo de preview—.

- **PRECONDICIÓN de Fase B enlazada:** la vista en vivo importa `HeroSection` DIRECTO (Fase A, una
  app). Fase B debe extraer los componentes del storefront a `packages/storefront-ui`, NO dejarlos
  en `apps/storefront` (una app no importa de otra), o la vista en vivo se cae — está escrito con
  su censo en § Monorepo / Fase B, junto con el disparador de Fase B (despliegues independientes o
  el 2º cliente).

- **DISPARADOR — la home COMPLETA en la vista:** hoy la vista muestra la SECCIÓN activa (hero), no
  la home entera (que arrastraría los fetches de FeaturedProducts/etc.). Cuando haya VARIAS
  secciones y el dueño necesite ver cómo queda una ENCIMA de otra, la vista pasa a la home
  completa. Hoy con una sección no aplica; el enlace "Ver la tienda" cubre el ínterin.

  **SEGUNDO ARGUMENTO a favor de esta vista, y el que RETIRA el cartel "Sección oculta":** con la
  home completa, apagar "Mostrar en la tienda" muestra el RESULTADO REAL —las secciones vecinas
  juntándose, que es lo que el dueño quiere ver—, y el cartel deja de tener razón de ser. Hoy la
  vista es de UNA sección, así que "la tienda sin esta sección" sería un pane VACÍO —que se lee
  como roto, no como intención—; por eso, mientras la vista sea de una sección, el cartel es lo
  HONESTO (§ el aviso muted "No se muestra en la tienda"), no un placeholder de relleno. Queda
  escrito para no re-diagnosticarlo: el cartel no es una carencia a arreglar suelta, es correcto
  hasta que exista la home completa, y ahí desaparece por innecesario.

- **El editor VISUAL (editar sobre la vista) — al backlog** (§ Backlog): se evaluó y se dejó para
  su propia tanda.

### La propagación al storefront — el storefront es DINÁMICO (defecto medido y arreglado)

El storefront **era ESTÁTICO** —`○ /` y todas sus rutas salvo el detalle de producto—, y eso
rompía la propagación: el layout lee SiteSetting y SiteContent de la BASE, pero Next las HORNEA
al build, así que en producción editar el hero o el nombre del negocio **no se veía hasta un
rebuild**. Afectaba a las DOS tandas (SiteSetting y SiteContent), no sólo al hero.

El fix: **`export const dynamic = 'force-dynamic'` en el layout del storefront** — cada request
re-lee (dos queries de una fila, baratas). Medido en modo producción (`npm start` + curl): antes
la home servía el default del build aunque la fila cambiara; después muestra la fila. (§ Las tres
capas — "dev engaña sobre el modo de render" es la regla que este defecto instaura.)

**TRADEOFF con su DISPARADOR:** `force-dynamic` en v1 —correcto y seguro para una tienda de este
tamaño—. Se descartó ISR (estático + `revalidatePath` en cada escritura de settings/content) por
más superficie que equivocar sin ganancia real. **DISPARADOR de volver a estático + ISR: si el
tráfico del storefront lo pide** (CDN/costo empiezan a importar). Hasta entonces, dinámico.

### La PÁGINA /nosotros — páginas por CONFIG, no anidado en el dato

Tanda del 2026-08-26. El storefront gana una SEGUNDA página editable, `/nosotros` (la historia
larga en la tanda 1; la galería en la tanda 2, § La GALERÍA de /nosotros abajo; el vídeo es la
tanda 3). Es una **capacidad para cualquier cliente: quien no la use, la apaga.** Decisiones de la
tanda 1 (la página, el toggle, el nav, el selector):

- **El "#47 CANCELADO" es la razón de que esta página exista.** Se iba a hacer variable la galería
  del collage de la HOME (backlog #47); con la galería en /nosotros, **el collage de la home se
  queda en CUATRO fotos fijas —el anzuelo, no el álbum—** y #47 se borró. La galería variable se
  construyó en /nosotros (§ La GALERÍA de /nosotros, tanda 2), donde tiene espacio; ahí se estrenó el
  **tipo `'imagen'` del `RepeaterEditor`** (§ el repeater), no en la home.

- **PÁGINAS POR CONFIG, no anidado en el dato.** Las secciones de /nosotros son claves MÁS del mismo
  `content` JSON (`nosotrosHistoria`), no un `content.pages.nosotros` anidado. La "página" es un tag
  de config: `SeccionConfig.pagina` ('home'|'nosotros'). Así **el resolver, el mapa de borrador y el
  write path NO cambian** (son key-agnósticos) — un anidado en el dato les habría metido una
  dimensión de página a los tres. El resolver itera por `registro` (las secciones), no por
  `defaultsBase`, para que la meta `paginas` no entre al loop de secciones (`SeccionKey` la excluye
  del tipo del REGISTRY).

- **La META de páginas es `content.paginas` (`{ nosotros: { visible } }`), NO una sección.** No lleva
  `campos` ni la resuelve el loop de secciones; `resolverPaginas` la resuelve aparte. Es el flag que
  gatea el redirect y el nav.

- **DEFAULT ENCENDIDA, y el argumento que lo cierra:** el contenido por defecto es copy REAL de
  Nayoli (el texto de brandStory), no un claim fabricado → **no repite el caso de los testimonios
  (#44)**, así que nace viva. (OJO — el enlace de hoy NO es un 404: header y footer apuntan a
  `/#nuestra-historia`, un ANCLA a la sección de la home que funciona; la tanda re-apunta el ancla a
  la página, no arregla un 404 que no existe.)

- **Apagada → REDIRECT 302/307 a la home, no 404.** La página EXISTE y sólo está apagada; un 404
  diría que no existe. El `redirect()` de Next emite **307 (temporal)** —equivalente al 302 para
  navegar a una página GET; un 302 literal exigiría middleware sin ganancia—. La ruta (server) lee
  el flag y redirige antes de renderizar.

- **El NAV es DATA-DRIVEN.** `StoreNav` (header) y `StoreFooter` son los dos `'use client'` DENTRO de
  `SiteContentProvider` (el layout los envuelve), así que leen el flag por `useSiteContent()` —sin
  pasar props—. El enlace "Nosotros" / "Nuestra Historia" aparece con la página ENCENDIDA y
  **desaparece apagada** (el header lo omite del array; el footer filtra la entrada, y su columna
  "Empresa" no queda vacía porque lleva el bloque de WhatsApp aparte). Re-apuntar de `/#nuestra-
  historia` a `/nosotros` **arregla de yapa el active-state muerto** (`pathname.startsWith('/#…')`
  nunca matcheaba). Eran las ÚNICAS dos anclas `/#` del nav; no hay más rotas.

- **El toggle de encender/apagar va DIRECTO a lo publicado** (`setPaginaVisible`, escritura optimista),
  NO por el flujo borrador/publicar de secciones —encender/apagar es config, no contenido en
  revisión—. Mismo race aceptado que el flujo borrador (§ site-content-write, escala humana).

- **El editor GANA un selector de página, SIN GATE.** `TiendaPaginas` agrupa `SECCIONES_TIENDA` por
  `pagina` en pestañas (pill con semántica de tab). El selector se renderiza SIEMPRE: el config
  define siempre ≥2 páginas, así que un gate "≥2 páginas" nunca se ejercería —código muerto que no
  discrimina nada—. El día que un deployment pueda tener UNA sola página (un tenant sin /nosotros),
  el guard entra ahí, con el caso real. El selector del editor es independiente del flag de
  visibilidad: se edita /nosotros aunque esté apagada, para prepararla antes de encenderla.

### La GALERÍA de /nosotros — la 2ª sección REPEATER, y el tipo `imagen`

Tanda 2 del 2026-08-26. /nosotros gana una galería de fotos de la finca. Decisiones:

- **SECCIÓN PROPIA (`nosotrosGaleria`), no imágenes dentro de la historia.** Se oculta sola
  (hide-on-empty) y su vacío es legítimo; la historia con fotos no podría —vaciarlas ocultaría el
  relato—. Y **disuelve la colisión del #47**: como sección propia, la galería es un repeater LIMPIO
  como Testimonios (defaults vacíos, hide-on-empty), sin el híbrido texto+fotos que mató al #47. Por
  eso mover la galería a /nosotros la volvió más SIMPLE, no sólo la reubicó.

- **MASONRY (CSS `columns`), NO grid con recorte al cuadrado.** El argumento NO es visual: el recorte
  a un aspect fijo **decide por el dueño qué parte de su foto importa** —una panorámica sin sus lados
  deja de serlo—. Cada celda toma la proporción NATURAL de su foto, capturada en la subida (`w`/`h`
  del ítem; sin dims → 4/3). SIN patrón por rangos —la galería ES el contenido, no el collage
  escalonado de la home—.
  - **Las dims se capturan en la subida** (`useSubidaImagen` lee `createImageBitmap(file)` → `{w,h}`;
    falla suave a `undefined`). El descriptor de imagen declara DÓNDE guardarlas (`CampoItem.dims =
    { w:'w', h:'h' }`); `conImagen` las escribe al agregar Y al cambiar, y las LIMPIA si la foto nueva
    no se pudo medir (dejar la proporción vieja daría una celda del tamaño equivocado). `w`/`h` son
    `GaleriaItem` opcionales, passthrough del resolver (como `stars`), y **DECLARADOS en el schema** —
    zod descarta lo no declarado, así que sin eso se perderían en silencio al guardar (test propio)—.
  - **ORDEN POR COLUMNA, decisión escrita en el código:** CSS `columns` llena la 1ª columna
    arriba-abajo, luego la 2ª → el orden fluye por COLUMNA, no por fila. Aceptable en una galería (sin
    secuencia narrativa); si algún día se espera orden por FILAS, hay que cambiar a un grid-masonry
    (JS/lib), no un ajuste de estilos. **En móvil (`columns-1`) el orden vuelve a ser EXACTAMENTE el
    del array** (verificado). brandStory NO cambia: ahí el aspect fijo es correcto porque es un
    COLLAGE compuesto, no una galería.

- **TOPE 12, y NO es técnico.** `next/image` lazy-loadea de fábrica, así que el peso inicial no crece
  con N —el navegador no descarga lo que está bajo el fold—. El tope es de CURADURÍA: una galería de
  30 fotos no la mira nadie, y sin límite el operador sube todo lo que tiene; 12 son dos pantallas de
  grid, suficiente para contar una finca. Vive en `RepeaterConfig.max`; al llegar, "Agregar" se
  deshabilita con hint (mismo trato que cualquier max de lista). El costo del original pesado sigue
  siendo el **#20** (subida sin comprimir) — más visible con más fotos, no un tope nuevo.

- **EL ALT es OPCIONAL con FALLBACK CONTEXTUAL, no requerido.** Un campo requerido que el operador no
  entiende se llena con basura ("foto1"), peor para un lector de pantalla que un fallback derivado.
  Opcional + hint que dice PARA QUÉ sirve ("Describe la foto para quien no puede verla"), y el
  fallback describe el CONTEXTO, no el índice: **"Foto de la galería de {negocio}"**, no "Galería 3".

- **EL `{negocio}` DEL FALLBACK LLEGA POR PROP, no por `useSiteSettings()`.** La vista en vivo del
  editor monta `NosotrosGaleria` en el árbol del ADMIN, que **no tiene** el `SiteSettingsProvider` del
  storefront —usar el hook ahí LANZARÍA—. La página server pasa `negocio={settings.nombre}`; sin prop
  (el preview) el alt cae a un genérico, que en un preview no importa. Ninguna sección de la
  home/nosotros usa `useSiteSettings()` por esta misma razón; la galería no es la excepción.

- **LA PLATAFORMA: `useSubidaImagen` (uploader extraído) + tipo `imagen` en el RepeaterEditor.** El
  uploader vivía inline en `TiendaSeccionEditor`; se extrajo a un hook para que lo COMPARTAN la
  cáscara (campos-imagen fijos) y el repeater (foto por ítem) —duplicarlo sería dos validaciones del
  mismo dato—. Se instancia UNA vez (la cáscara) y se comparte por `subida.pedir`: un `<input>`, un
  `subiendo`. Un repeater con campo `imagen` AGREGA subiendo primero (un ítem-imagen vacío es una foto
  rota). Detalle del hook: entrega la url con `subiendo` ya en false, porque un ítem de galería
  atraviesa `cambiar` (que descarta el marca-sucio durante una subida).

- **EL BORRADO DE BLOBS POR ÍTEM sale GRATIS de `imagenesDe`.** `REGISTRY.nosotrosGaleria.imagenes =
  ['url']` nombra el campo-imagen DENTRO de cada ítem; `imagenesDe` (repeater-aware) itera los items y
  junta cada `item.url`. El set-diff de `blobsHuerfanos` cubre reemplazos y quitados —una foto
  reubicada NO se borra—. Afirmado en el carril (primer repeater con imágenes que pasa por el write).

- **El `titulo` de la galería es OPCIONAL** (a diferencia de Testimonios, donde es requerido): una
  galería puede ir SIN heading —las fotos son el contenido—, así que vaciarlo lo omite en vez de caer
  al default. Es el discriminador en el resolver que un test fija.

- **NO entra en esta tanda: el proceso ni el equipo.** El mínimo que sirve para una página "Nosotros"
  es historia + galería. Proceso/equipo son secciones ADITIVAS —con la plataforma ya construida, cada
  una es config + un componente— pero no hay evidencia de que se pidan. **El VÍDEO sigue declarado
  para la tanda 3** (§ Backlog #48: es capacidad nueva —formato aparte, subida directa a Blob, poster,
  rama de render—, no un campo más).

## Mejoras post-multitenant

**NO es el backlog técnico.** El backlog es deuda que ya está costando; esto son
mejoras que esperan un HITO —la arquitectura multitenant de Duna— y que hacerlas
antes significaría construirlas dos veces. Un item de acá no se prioriza contra
uno del backlog: están en escalas distintas.

Cada entrada dice **de qué decisión salió**, porque una mejora sin su origen se
vuelve una idea suelta que nadie sabe si sigue vigente.

### Pagos en línea (Wompi) — cobros automáticos

Hoy todos los pagos se confirman a mano (Nequi, Daviplata, efectivo, transferencia)
y la evidencia entra por el flujo de comprobantes. Wompi integraría el cobro en línea
automático: un pago acreditado por el PSP escribiría el `Payment` sin que un operador
lo teclee, y el estado de la orden lo movería el webhook, no el modal de Registrar
Pago.

Origen: retirar la nota "Pagos en línea próximamente" de la pantalla de Pagos
(owner, 2026-08-18). Era una promesa de producto suelta en una pantalla de operación,
no una deuda; su lugar es la hoja de ruta, no un cartel en el ledger.

Va después del multitenant, y no es solo prioridad: el cobro automático toca la MISMA
frontera que § "Decisión — Cuándo un pedido está pagado" —el `Payment` como único
escritor del eje de cobro— y el puente con Carlos. Un webhook de PSP es un tercer
escritor de dinero; entra cuando esa autoridad esté resuelta, no antes. El disparador
real es **la decisión de pasarela**, que hoy no está tomada (Wompi es el candidato,
no un hecho).

### Reporte PDF descargable de Analítica

**La evidencia densa pertenece a un documento, no a la pantalla.** La tabla de
rentabilidad completa, las series mensuales y los desgloses por cliente son
material para leer sentado, archivar o mandarle al contador; la pantalla existe
para responder cuatro preguntas en 30 segundos.

Origen: el pase de jerarquía del 2026-08-05 (§ Analítica — LA RESPUESTA PRIMERO).
Ese pase plegó el detalle en vez de eliminarlo, y al hacerlo dejó explícito que
hay dos consumos distintos del mismo dato con formatos distintos. El PDF es el
segundo consumo, y **se decidió NO construirlo entonces** para no volver a mezclar
los dos.

Va después del multitenant porque el reporte lleva identidad de tienda
(encabezado, logo, período, moneda) y hoy no existe el modelo que la sostenga —
sería un template hardcodeado a Nayoli que habría que rehacer entero.

**LO QUE CAMBIÓ (2026-08-19): el pipeline YA EXISTE.** El informe de Pagos dejó
montado el patrón entero —modelo puro ≠ layout ≠ bytes, jsPDF en `import()`
dinámico, tope declarado, cabecera con negocio y fecha— así que este reporte ya
no arranca de cero: es escribir SU modelo (§ El INFORME (PDF)). Lo que sigue
gateado al multitenant es sólo la IDENTIDAD —hoy el negocio sale de
`siteConfig.brand.nombre`, que es de un tenant único—, no la capacidad.

### Snapshot del costo en `OrderItem`

Columna `costo_unitario` nullable, llenada de aquí en adelante (migración
aditiva). Convierte el margen futuro en un hecho contable y deja el histórico
como está.

Origen: el rediseño de Analítica del 2026-08-05, donde se descubrió que
`OrderItem` no snapshotea costo y el margen histórico sólo puede estimarse contra
el costo ACTUAL del catálogo (§ El COSTO no está snapshoteado). No depende
técnicamente del multitenant, pero **sí de la sesión de costos reales con el
cliente**: snapshotear el costo del seed sólo congelaría un dato inventado.

### La capa de TEMA por cliente — colores, fuentes, animaciones son configuración

El tema de cada cliente es CONFIGURACIÓN, no código por cliente (decisión del owner, 2026-08-25,
al hacer viable la vista en vivo): la estructura es una base común (Hero, Productos, Historia…) y
cada cliente elige QUÉ secciones muestra (la visibilidad ya construida, § SiteContent) y CON QUÉ
tema se pintan (colores, imágenes, fuentes, animaciones). **El componente es UNO y sirve a todos**
—por eso la vista en vivo escala: renderiza el mismo componente que producción—.

Hoy el tema está HARDCODED: los colores literales viven en los componentes (`text-[#d4a97a]`,
`bg-[#1a0f08]` en HeroSection) y en `globals.css`/`tokens.css`. La capa mueve esos literales a
tokens por-cliente (`--acento`, `--fondo-hero`, …) editables + una superficie para elegirlos.

Consecuencia que el discovery del editor visual dejó clara, escrita para no re-descubrirla:
**editar el COLOR de "historias" (el énfasis del titular) NO se resuelve con el editor visual —es
TEMA, no contenido— y depende de ESTA capa.** El editor visual da el TEXTO; el color es aparte.

Va después del multitenant porque el tema por-cliente necesita el modelo de tenant (hoy no existe);
adelantarlo sería configuración por un solo cliente. **DISPARADOR: el SEGUNDO cliente.** Con Nayoli
sola, los colores literales están bien.

### Datos de negocio editables — `siteConfig` → `SiteSetting`

**LOS CAMPOS PLANOS YA SON EDITABLES** (tanda del 2026-08-24). nombre, tagline,
descripcionFooter, whatsapp, instagram, emailRemitente, emailReplyTo y adminEmail viven
en `SiteSetting` (base) y se editan en **Configuración**. La implementación completa
—modelo, loaders, providers, pre-auth, editor, retiro de ADMIN_EMAIL— está en
**§ Config del negocio — `SiteSetting` (los planos editables)**.

**Se APARTÓ de la doctrina previa a propósito** (owner): esta sección decía "NO se
adelanta hasta el acuerdo de esquema con Carlos". El owner decidió construir el editable
AHORA, con la forma que **NO fija** la arquitectura multi-tenant: fila única
`id='default'`, SIN `tenant_id`, born en `public`. La decisión de ESQUEMA multi-tenant
sigue esperando el acuerdo; lo que se adelantó es la capacidad de editar, no el modelo de
tenancy.

**Lo que QUEDA post-multitenant:**
- el **`tenant_id` / multi-schema**: la fila `default` pasa a una por tenant, scopeada; el
  loader gana el `storeId`. Es el único cambio de esquema, y es el que va con Carlos.
- los **ESTRUCTURADOS editables** (`emailColors`, `footerNav`, `legalNav`): son editores
  ricos, no inputs de texto — siguen en `siteConfig` (código) hasta que valga la pena.
- el resto del inventario de tenant (§ Identidad, `app/manifest.ts`, el title/description
  de la raíz) sigue en código.

## Imágenes en `public/`

Los archivos de imagen en `public/` son inmutables: nunca sobrescribir
contenido bajo el mismo nombre. Todo reemplazo de imagen usa un nombre
nuevo (sufijo `-v2`, `-v3` o timestamp) y se actualizan las referencias
(DB, seed, código). Motivo: la URL es la clave de caché del navegador y
del optimizador de Next — mismo nombre con contenido nuevo = cachés
sirviendo la versión vieja indefinidamente. Cuando exista upload de
imágenes en el admin, el nombre debe incluir hash o timestamp
automáticamente.

Esa última frase ya está CUMPLIDA para las imágenes subidas desde el admin
— ver la sección de abajo. Las estáticas de `public/` siguen exactamente
con esta regla: no se migran y se renombran a mano.

## Decisión — Cuándo un pedido está pagado

**Fecha:** 2026-08-17. **Estado:** IMPLEMENTADA (`6359bb3` core + `420d5a9` UI).
**Naturaleza:** regla de producto de Duna, no configuración por tenant.
Un pedido está pagado cuando la plata entró. Eso no varía por negocio, así que
**no lleva flag**. Lo que varía es el método de pago, que ya es un dato del modelo.

### 1. El problema

Hoy `Registrar Pago` crea el `Payment` y mueve la orden a `pagado` en la misma
transacción (`packages/core/src/orders.ts:216`). El comprobante es un eje
independiente que **nunca** mueve la orden, por diseño declarado
(`packages/core/src/comprobantes.ts:11`).

De ahí salen dos síntomas que el owner reportó:

| # | Síntoma | Causa |
|---|---|---|
| a | Un comprobante RECIBIDO (sin veredicto) convive con una orden que ya dice "Pagado" | El `Payment` se escribió al registrar, antes de mirar la evidencia |
| b | Rechazar un comprobante deja la orden "Pagada" | El rechazo no toca el `Payment`, y el `Payment` es lo que paga |

**No son bugs.** El código ejecuta fielmente el modelo. El defecto es que la UI le
pide al operador que afirme un hecho contable —"la plata entró"— en el momento en
que solo ha visto una imagen. La decisión de cobro se toma antes que el juicio
sobre la evidencia, y el juicio posterior ya no puede cambiarla.

Medido en development: cero plata fantasma. Todas las órdenes pagadas tienen
`Payment` real.

### 2. La regla

**El `Payment` nace del veredicto cuando hay comprobante de por medio. Nace
directo cuando no lo hay.**

| Camino | Qué pasa |
|---|---|
| Llega un comprobante (WhatsApp, tienda, adjunto suelto) | Se guarda como RECIBIDO. La orden **no** se paga. Entra al carril "Por verificar" |
| El operador **verifica** | **Crea el `Payment`** → la orden pasa a `pagado` |
| El operador **rechaza** | La orden sigue pendiente. No hay `Payment` que revertir |
| Efectivo / contraentrega | `Payment` directo, sin comprobante. **Sin cambio** |
| `Registrar Pago` sin adjunto | `Payment` directo. **Sin cambio** |

#### El matiz: el comprobante adjuntado desde Registrar Pago nace VERIFICADO

Cuando el operador adjunta la foto **dentro** de `Registrar Pago`, está afirmando
que ya vio la plata; la foto documenta lo que acaba de afirmar. Ese comprobante
nace **VERIFICADO**, con el mismo actor y timestamp del pago.

Si naciera RECIBIDO entraría al carril "Por verificar" y le pediría al operador
que juzgue una decisión que él mismo acaba de tomar. Ese es el doble trabajo que
esta decisión existe para evitar.

#### Invariante que se conserva

`registerOrderPaymentTx` sigue siendo el **único** escritor de dinero. Verificar
entra como su **tercer llamador**, no como un camino paralelo. "El eje de cobro se
escribe una sola vez, por el `Payment`" sigue en pie.

Bajo esta regla, `Payment` + comprobante RECHAZADO es una **combinación
imposible**.

### 3. La fecha

Al verificar se registra **cuándo entró la plata**, no cuándo se miró la foto.

`Payment.fecha` ya está reservada para esto: el schema distingue `fecha` (fecha de
pago del negocio, `schema.prisma:308`) de `createdAt` (timestamp de auditoría).
Hoy **ningún formulario la expone** — siempre cae al default `now()`.

Sin exponerla, `fecha` pasaría a significar "instante de verificación", y eso
correría "Ventas hoy", la serie mensual de Analítica, el envejecimiento de la
cartera y el libro de Pagos. Un pago que entró el lunes y se verificó el jueves
aparecería como ingreso del jueves.

**Con el campo expuesto, ninguna consulta cambia de definición.** El operador
tiene el dato delante: la transferencia trae su fecha.

- Campo en el flujo de verificación y en `Registrar Pago`.
- Default: hoy. Editable.
- Aditivo: **sin migración**, la columna ya existe. Falta el input y threadearlo
  por `RegisterPaymentTxInput` hasta el `payment.create`, que hoy la omite.

#### 3.b El método: al verificar, EFECTIVO no es un default malo — es imposible

Mismo principio que la fecha: al verificar hay que capturar el **hecho real** en
ese momento, no heredar un valor rancio. Pero el método tiene una vuelta de tuerca
que lo hace más fuerte que un nudge.

Hoy el modal es editable ([`RegisterPaymentModal.tsx:187`](components/admin/RegisterPaymentModal.tsx:187)) y preselecciona el método
declarado (`metodoPagoPrevisto ?? metodo_pago`, [`page.tsx:758`](app/(admin)/admin/pedidos/page.tsx:758)). Para una orden creada
efectivo eso deja el select en **EFECTIVO**, y si el operador guarda sin tocarlo,
el libro de Pagos reporta una transferencia como efectivo. La capacidad de
corregir existe; el default rancio y la ausencia de aviso son el hueco.

**La regla NO es "cambiar el default". Es una RESTRICCIÓN:** cuando el `Payment`
nace de **verificar un comprobante**, EFECTIVO es un valor **imposible** — un
comprobante existe porque hubo transferencia, y el efectivo no deja foto. En ese
flujo:

- **EFECTIVO se excluye de las opciones del select.** No es elegible.
- **El default sale del método declarado sólo si es de transferencia.** Si el
  declarado era efectivo, **no hay preselección** — el operador elige, porque el
  dato viejo era, por construcción, el equivocado.

Una restricción es más barata que un nudge y **no depende de que el operador lea**.
El default malo puede pasar inadvertido; una opción que no está no se puede elegir.

**Alcance:** esto aplica SÓLO al Payment nacido de verificar. En el `Registrar
Pago` DIRECTO (sin comprobante) EFECTIVO sigue siendo válido y de primera clase —
es la contraentrega en efectivo, que no tiene nada que fotografiar. La exclusión
es del flujo con comprobante, no del método.

### 4. Qué NO se adopta del modelo de Carlos

El modelo de `duna-orders` no puede producir estos dos síntomas: allá "pagado ⟺
existe un comprobante verificado" es fuente única. Aun así **no se copia**, por una
razón concreta:

Carlos excluye el efectivo del gate (`payment_methods.py:25-29`): una orden en
efectivo se cierra pagada **por ausencia de bloqueo**, sin ningún artefacto
positivo de pago. Nosotros tenemos efectivo y contraentrega como casos reales que
necesitan dejar asiento. Nuestra tabla `Payment` es lo que lo permite, y por eso
el split proof/payment se queda.

#### Vocabulario: reservado, no adoptado

`insufficient` y `superseded` **no entran ahora**. La razón se descubrió leyendo su
implementación:

- `superseded` **no es un veredicto del operador**: lo escribe el sistema cuando un
  recibo hermano se verifica (`comprobante_store.py:689-722`).
- `insufficient` existe porque hay **recibos complementarios** (modelo MR-1 de pago
  parcial), que nosotros no tenemos.

Adoptar los nombres sin el mecanismo crearía dos estados con **cero escritores** —
la misma trampa de los ex-backlog #8/#10 (`Customer.activo`/`Product.agotado`),
columnas inertes que por eso mismo se acabaron dropeando.

**Se reservan por escrito:** el día que exista pago parcial, esos son los nombres.
Nadie inventa otros.

#### Divergencias registradas (para el día del puente)

Hoy **no hay puente**: son dos stacks separados, sin API compartida, sin webhook,
sin tabla común. El veredicto del operador de Carlos no llega a nuestra base, y un
pedido de tienda es invisible para su lado (`duna-orders` es WhatsApp-only y no
tiene noción de canal de origen).

Cuando el puente exista, el punto de traducción **no es solo el vocabulario**:

| | Carlos | Nosotros |
|---|---|---|
| Entidad del dinero | ninguna — el pago **es** el comprobante | `Payment` + `Comprobante`, tablas separadas |
| "Pagado" se deriva de | existe un comprobante `verified` | existe un `Payment` |
| Efectivo | sin artefacto, pasa por ausencia de bloqueo | `Payment` con asiento |
| Veredicto | único, mutable in-place, monótono | (a definir al construir el puente) |
| Canal | solo WhatsApp | whatsapp · directo · tienda |

#### Autoridad, cuando haya puente

**El panel no puede depender de que exista un operador de WhatsApp.** La tienda ya
es un canal vivo sin ese lado, y vienen más. Verificar tiene que poder hacerse
desde el admin siempre; el operador es un atajo, no la única puerta.

**Un solo veredicto.** Si el operador verifica, el admin lo ve verificado y **no
tiene nada que hacer** — nunca re-verifica lo ajeno. El admin puede sobreescribir
si discrepa; ahí es donde `superseded` cobra sentido. Esto es un ruling pendiente
para el contrato con Carlos, no trabajo de hoy.

### 5. Alcance — lo que quedó

Dos commits: `6359bb3` (core + endpoints + carril) y `420d5a9` (UI + fecha). El
detalle vive en el código; acá el mapa:

- **`decidirComprobante`** (`packages/core/src/comprobantes.ts`) — sobre orden
  PENDIENTE abre transacción, hace `SELECT … FOR UPDATE` sobre la orden y llama a
  `registerOrderPaymentTx` (tercer llamador) en la MISMA transacción que sella;
  sobre orden ya pagada sólo sella. Devuelve `{ comprobante, pagoCreado }`.
- **El route de comprobantes** dispara `order.pagado` cuando `pagoCreado` (tercer
  emisor); veta EFECTIVO (`EfectivoConComprobanteError`) y fecha futura
  (`FechaFuturaError`, impuesta en `registerOrderPaymentTx` — cubre los tres
  llamadores). El `monto` sale de `order.total` de la fila bloqueada, nunca del body.
- **`RegisterPaymentTxInput.fecha`** threadeada al `payment.create`; la fecha viaja
  como clave de día y el server la ancla al inicio del día en Bogotá (`dayKeyStart`)
  — sin migración, la columna ya existía.
- **UI:** el `'cobrar'` de la página abre el modal, que ahora hace UNA llamada de
  verify (se retiró el two-step; en verify mode la orden se refresca del servidor).
  Campo "Fecha en que entró el pago" (default hoy, tope hoy, `DateField` con
  `maxDia`), EFECTIVO fuera del select con comprobante en el flujo, y el adjunto de
  Registrar Pago nace VERIFICADO. El doble-submit pasa por el ref síncrono de
  `useAccionGuardada`.
- **Timing, no estructura:** `isPorCobrar` / cartera / analítica se vacían al
  verificar en vez de al registrar; con la `fecha` expuesta no mueve ninguna cifra.
- **Tests:** `comprobante-verificacion.test.ts` invirtió el invariante viejo y
  agregó la prueba del FOR UPDATE (vista fallar con dos Payments), la del emisor
  (vista fallar sin el disparo) y la de fecha futura; `cobro-sincronizado.test.ts`
  pasó a "único helper". No se afectó `assertEstadoNoEsCobro` ni sus puertas HTTP.

### 6. Lo que no se hace

- **Ningún backfill.** Las tres órdenes con `Payment` + comprobante RECHAZADO son
  datos de prueba en development (pantallazos con X, adjuntados a mano). No hay
  historia real que preservar ni revisar.
- **Ningún flag por tenant.** Configurar la definición de "pagado" sería
  configurar la contabilidad, no la presentación.
- **Ningún estado de vocabulario nuevo.** `insufficient` y `superseded` quedan
  reservados, sin escritores.
- **Ningún puente con Carlos.** Sigue gateado a que exista un piloto vivo.

### 7. Abierto

- **Pago parcial**: no existe en nuestro modelo. Cuando exista, entra con el
  vocabulario reservado. No se especula ahora.
- **El ruling de autoridad** (quién gana si los dos lados verifican) se escribe
  cuando el puente esté en el horizonte, con Carlos.
- **La tanda A** (carril "Por verificar") ya está en `main` (`2ba7589`); era
  compatible con las dos versiones del modelo y no dependía de esta decisión.

## El eje de COBRO se escribe una sola vez, por el Payment

`Order.estado` tiene DOS ejes y NO son lo mismo: **COBRO** (`pagado`/`pendiente`)
y **CANCELACIÓN** (`cancelado`). El de cancelación es libre —una transición que
un control puede pedir—; el de **cobro NO lo es**: es consecuencia de que exista
(o no) un `Payment` en la otra tabla. Escribirlo a mano es afirmar un hecho
contable sin el asiento que lo respalda.

El defecto que lo instaura (2026-08-07, `fix/cobro-derivado-payment`): el selector
"Cambiar Estado" del detalle Y el de la fila escribían `estado` crudo por el PATCH,
que trataba el campo como libre. Las DOS direcciones rompían el sistema, y las dos
nacían de la misma raíz:

- **pendiente→pagado sin crear `Payment`** → **plata fantasma**: la orden contaba
  como cobrada sin un pago que la respaldara. Es exactamente el caso real que una
  contraentrega habilita —plata cobrada en la calle, y alguien la marca "pagado"
  con el selector en vez de Registrar Pago—.
- **pagado→pendiente dejando el `Payment` vivo** → un pago **huérfano**: la orden
  decía `pendiente` con el cobro ya registrado.

**La regla: el ÚNICO escritor del eje de cobro es el path de dinero**
(`registerOrderPaymentTx` → `transitionOrder`, en la MISMA transacción que crea el
`Payment`). Registrar Pago es el único camino a `pagado`; la reversión/anulación
será su propio acto con asiento (tanda futura, fuera de alcance). Es la misma
doctrina del §3.1 de Comprobantes —"sólo el Payment mueve la orden a pagado"—,
ahora impuesta en la capa de escritura.

- **La garantía es por IMPOSIBILIDAD, no por disciplina de callers.**
  `assertEstadoNoEsCobro` (`lib/orders.ts`) rechaza `pagado`/`pendiente` crudo en
  las DOS puertas HTTP —el `PATCH /api/orders/[id]` y `createOrderWithCustomer`—
  con `CobroEstadoNoEscribibleError` → **422**. `cancelado` y `undefined`/`null`
  (no se toca / default del alta) pasan. `registerOrderPaymentTx` llama a
  `transitionOrder` DIRECTO —no por HTTP—, así que no pasa por la guarda: por eso
  el path de dinero sigue pudiendo poner `pagado`. **No mover la guarda dentro de
  `transitionOrder`**: rompería el path de dinero, que es el único que debe poder.
- **`Order.estado` NO se arranca: sigue siendo el espejo del cobro.** Se lee crudo
  (`=== 'pagado'`/`'pendiente'`) en ~17 archivos —StatusBadge, cartera, analítica,
  scopes del dashboard, automatizaciones, notificaciones—. Como su único escritor
  del eje de cobro es el `Payment`, el espejo es fiel por construcción. Derivarlo
  desde la relación `payments` en cada lectura habría sido reescribir esos 17
  sitios sin ganar nada.
- **UI: el selector de estado murió en la fila Y en el detalle** (los DOS
  controles, coherentes). En su lugar, **"Cancelar orden" con confirmación** —un
  único `ConfirmDeleteDialog` owned por la página sirve a los dos (el detalle
  dispara `onCancelar`)—. Un dropdown al que le queda una sola opción es un botón.
  El "Guardar Cambios" del detalle ya sólo manda `notas`, con lo que **desaparece
  de raíz el bug de la copia congelada de `estado`** (ya no reenvía un estado que
  pudiera revertir un pago).
- **`ConfirmDeleteDialog` ganó `busyLabel?` opcional.** Cancelar es ROJO por
  severidad —es terminal, anula el envío, reintegra stock— pero "Eliminando…"
  mentiría (el registro se conserva), así que va `busyLabel="Cancelando…"`. El
  default deriva de `confirmKind` como siempre; los demás call sites no cambian.
- **Cancelar NO toca el `Payment`** (comportamiento conservado y DECLARADO):
  `transitionOrder` en `cancelado` anula el envío y reintegra el stock despachado,
  pero deja el pago intacto. Qué se hace con un `Payment` sobre una orden cancelada
  es una decisión de negocio aparte (pendiente con Luis) — acá sólo se documenta.
- **El test del carril NO se borra** (`tests/integracion/cobro-sincronizado.test.ts`).
  Afirma el invariante Order↔Payment en sus dos mitades —`pagado ⇒ hay pago` (no
  plata fantasma) y `hay pago ⇒ no pendiente` (no huérfano)— tras crear, cobrar,
  cancelar, y tras cada intento ilegal, replicando la secuencia del route handler
  (`patchComoLaRuta`: guarda → transacción). Fue la capa que faltó en el
  diagnóstico: un test de UI no ve la desincronización y uno con mocks tampoco —
  hay que releer las dos tablas. Se lo vio fallar 5/5 en las direcciones del bug
  con la guarda neutralizada.

**HUECO CONOCIDO (no arreglado): `Order.estado` no tiene historial.** Sólo hay
`updatedAt` (un timestamp = la última escritura); no existe tabla de transiciones
de estado —`InventoryLog` es la única auditable, y es de stock—. Por eso el
residuo del bug en dev (CN-958842, `pagado` con 0 pagos) se pudo probar que salió
del dropdown viejo (los 0 pagos lo delatan: el path de dinero jamás produce ese
estado) pero **no** se pudo reconstruir si una reversión previa ocurrió y se
re-pisó. La ausencia de historial ES el argumento del fix: el control flipeaba el
cobro sin garantía y sin traza. Anotado; darle historial a `Order.estado` es una
decisión, no parte de este arreglo.

## Comprobantes de pago — la EVIDENCIA no es la plata

Decisión de arquitectura (documento Duna §3.1), construida en su versión canónica
desde el día uno. `Payment` y `Comprobante` son **dos tablas** porque son dos
hechos distintos, y las dos combinaciones que sólo existen si están separados son
casos reales, no teóricos:

- **comprobante SIN pago** — el cliente mandó la foto por WhatsApp y nadie la
  verificó todavía;
- **pago SIN comprobante** — efectivo contraentrega, no hay nada que fotografiar.

Un campo `Payment.comprobante_url` haría **imposible el primero**, que es
justamente el que esta tanda existe para resolver. No se colapsa "porque hoy casi
siempre van juntos".

### El comprobante NO mueve la orden

**El único que pasa una orden a `pagado` sigue siendo el Payment.** Ninguna
función de `lib/comprobantes.ts` escribe `Order.estado`, y el carril lo afirma.
Un comprobante es evidencia SOBRE la plata; si su estado moviera la orden, una
foto se convertiría en un asiento contable.

Consecuencia que conviene tener escrita: **sellar la evidencia sin registrar el
pago deja la orden `pendiente`**, y eso es correcto — la plata no entró. Que la
UI cobre primero es una decisión del FLUJO, no una garantía de la capa de datos.

### La verificación CREA la plata, no al revés

`accionAlVerificar(order.estado)` (capa 1) decide qué hace el botón Verificar:

- orden `pendiente` → **`cobrar`**: abre Registrar Pago pre-llenado, y el sello
  viene DESPUÉS del Payment;
- orden ya pagada → **`sellar`**: sólo estampa quién y cuándo.

**El ORDEN no es reversible.** Si el sello falla tras un pago exitoso queda una
orden pagada con un comprobante `RECIBIDO` — un segundo click lo cierra, porque
ahí ya cae en `sellar`. Al revés (sellar y que el pago falle) dejaría una
evidencia afirmando un cobro que nunca ocurrió. La misma asimetría rige el
adjunto del modal de pago: **primero la plata, después la evidencia**, y si la
subida falla el toast dice que el pago SÍ quedó registrado.

### El dato vive en la PÁGINA, no dentro del diálogo

Incidente del gate del 2026-08-06, y es la lección más cara de esta tanda.
Adjuntar un comprobante desde el detalle terminó así: **el diálogo se cerró y
reabrió solo, y quedó "Sin soportes" — sin miniatura y sin error**. La base decía
otra cosa: la fila estaba escrita, `RECIBIDO`, y el blob subido bajo
`dev/comprobantes/`.

**Tres síntomas, UNA causa: el detalle se remontó con el POST en vuelo.**

1. La página se remonta → `orders` vuelve a `[]` → `selected` (derivado de
   `orders.find`) pasa a `null` → el diálogo se cierra.
2. `getOrders()` re-corre y resuelve ANTES de que el POST commitee → la orden
   vuelve sin comprobantes → el diálogo reabre vacío.
3. La continuación del `await` —el `onUpdate` del éxito y el `mostrar` del
   catch— cae sobre un componente muerto: ni evidencia ni error.

El "cerrar y reabrir solo" no era una violación del contrato de cierre: era
`open={!!selected}` siguiendo a un `orders` que se vació y se volvió a llenar.

**La regla que queda: una mutación jamás debe depender de que el diálogo que la
disparó siga montado.** Las mutaciones de comprobantes viven en `Ordenes` —el
componente de la ruta, dueño de `orders`— y el detalle sólo RENDERIZA, recibiendo
un `ControlComprobantes` por props. Un remonte deja de poder tragarse una subida;
el peor caso pasa a ser que el modal reabra ya con el comprobante puesto.

Dos refuerzos que van con la regla:

- **Al abrir, la verdad la trae el SERVIDOR** (`GET /api/orders/[id]/comprobantes`
  → merge). Es lo que cura el caso en que algo se perdió igual: el modal abierto
  se ACTUALIZA en vez de mostrar un vacío que la base contradice. Depende sólo de
  `order.id`, así que el merge que provoca no lo vuelve a disparar.
- **`onOpenChange` recibe el estado NUEVO y hay que leerlo.** Estaba como
  `onOpenChange={closeDetail}`, y `closeDetail` ignoraba el argumento y cerraba
  siempre — cualquier `onOpenChange(true)` habría borrado el parámetro de la URL.
  Nada se cierra sin que Radix lo pida.

**Y el disparador del remonte quedó sin confirmar.** El candidato que encaja con
los tres síntomas es una recarga completa de Fast Refresh —este proyecto las
registra (`⚠ Fast Refresh had to perform a full reload`)— porque el gate se corrió
sobre un dev server al que se le editaron archivos DEBAJO, rompiendo la
precondición del server frío. No se pudo confirmar y no se afirma. **El arreglo no
depende de saberlo**, que es justamente por qué se arregló así: lo que se cerró no
es el disparador sino la fragilidad que lo volvió invisible.

### La caja de comprobantes VACÍA es una línea

El bloque grande —borde, encabezado, texto explicativo, línea de formatos— se
gana con evidencia. Vacía colapsa a `Comprobantes (0) · Adjuntar`, porque el caso
normal de una orden es no tener soportes y ahí ese bloque ocupaba más que la
sección que sí responde algo. Los formatos pasan al `title` del botón: los
encuentra quien va a adjuntar y no los lee quien no.

**El botón Adjuntar SE QUEDA en el detalle** (decisión del owner): el flujo
`RECIBIDO`-antes-del-pago es el caso de uso central, y adjuntar desde Registrar
Pago coexiste sin reemplazarlo. **El error va FUERA de la caja**, para que se vea
igual con la caja colapsada — que es justo cuando falla la primera subida.

### Las DOS puertas de Registrar Pago, y el enlace del sello

El modal es consciente de por dónde entró, y no es cosmético: son dos
conversaciones distintas con el operador.

- **Por "Verificar"** (`verificando={comprobante}`): el soporte YA existe y lo que
  falta es la plata. Se muestra CUÁL se está verificando —miniatura, nombre,
  peso— y **se OCULTA el campo Adjuntar**. Ofrecer adjuntar ahí invitaría a subir
  un segundo soporte de la misma plata y pondría al operador a decidir algo que
  no tiene que decidir.
- **Directo** (sin la prop): el adjunto opcional, como siempre.

**El enlace del sello es real, no una apariencia.** El detalle guarda el
comprobante en `enVerificacion` al pulsar Verificar, se lo pasa al modal, y en el
`onSaved` del pago llama a `decidir(…, 'verificar')` — que es el mismo `PATCH
/api/comprobantes/[id]` que escribe `verificado_por`, `verificado_por_nombre` y
`verificado_at`. El carril afirma la cadena entera contra Postgres real
(`comprobante-verificacion.test.ts`: el Payment queda, el sello estampa quién y
cuándo, y la orden la movió el Payment). Guardar el OBJETO y no sólo el id es lo
que permite mostrarlo; el sello usa su `id`.

Si el sello falla tras un pago exitoso, el error dice exactamente qué pasó ("el
pago quedó registrado, pero no se pudo sellar… vuelve a pulsar Verificar") — y
ese segundo click ya cae en `sellar`, porque la orden pasó a pagada.

### Rechazar CONFIRMA, y el copy declara el camino

El mecanismo de corrección ya existía —rechazar y adjuntar el correcto— pero
nada lo decía, así que era invisible justo cuando hace falta. La confirmación
reusa `ConfirmDeleteDialog` con **`confirmKind='default'`**: ámbar y no rojo,
porque no destruye nada.

> Quedará marcado como rechazado y NO se elimina: el archivo se conserva como
> constancia de que se revisó. Podrás adjuntar el comprobante correcto en esta
> misma orden.

**`decidir` LANZA en vez de tragarse el error**, y quién lo muestra depende de por
dónde se pidió: rechazar va detrás del confirm, que tiene su propio error inline y
se queda abierto al fallar; verificar no tiene diálogo propio y lo manda al
`ErrorDialogo` de la sección. Una sola implementación, dos vehículos — la misma
división de siempre, parametrizada en vez de duplicada.

### Sin borrado físico, incluido el RECHAZADO

`RECHAZADO` conserva la fila **y el blob**. Un comprobante rechazado ES la prueba
de que se rechazó; borrarlo dejaría una orden sin explicación de por qué su pago
nunca entró. Es la regla no-delete del repo, aplicada al caso donde más tienta
saltársela.

**Un veredicto no se reescribe** (`puedeDecidirse`): sólo un `RECIBIDO` se decide.
Re-verificar pisaría quién decidió y cuándo, que es el dato de auditoría que hace
útil a la tabla. La transición es condicional en UNA sentencia (`updateMany` con
el estado en el `where`), así que dos veredictos concurrentes no pueden ambos
escribir su nombre — el segundo recibe 409. Testeado en el carril.

### La imagen vive en Blob; la fila guarda un puntero

Bajo el prefijo `comprobantes/` a través de `lib/storage.ts`, con su `dev/` por
entorno. **Jamás bytes en Postgres**: hincharían los backups y las copias de rama
por un dato que un CDN sirve mejor.

- **`SUBIR → INSERTAR`, nunca al revés.** Si la subida funciona y el insert falla
  queda un blob huérfano, que es basura barata; al revés quedaría una fila
  apuntando a una imagen inexistente y el operador vería un comprobante roto sin
  saber si el cliente lo mandó. Misma asimetría que el borrado de imágenes de
  producto.
- **La subida va FUERA de la transacción** — `storage.put` habla con un servicio
  externo, y meterlo adentro dejaría una transacción de Postgres abierta durante
  una llamada de red.
- **No hay columna `nombre_archivo`**: `storage.put` ya construye el pathname con
  el nombre saneado, así que la URL lo lleva (`nombreArchivo`). Una columna sería
  un segundo lugar donde el mismo dato puede decir otra cosa.

### PDF es un formato de primera clase, y por eso son DOS listas

`TIPOS_COMPROBANTE` acepta JPG, PNG, WebP **y PDF**; `TIPOS_PERMITIDOS` (imágenes
de producto) sigue sin PDF. No es una lista ampliada: **Bancolombia entrega sus
soportes de transferencia en PDF**, y rechazarlos obligaría al cliente a
fotografiar una pantalla para mandar algo peor — mientras que una portada de
catálogo en PDF sería un bug (`next/image` no la renderiza). Unificarlas lo
volvería posible.

- **Un PDF NO va al lightbox ni a un visor embebido**: chip de documento con
  nombre y peso, y abre en pestaña nueva. Un PDF dentro de un `<img>` no falla
  ruidosamente — se queda en blanco, y el operador concluye que el comprobante
  llegó roto cuando el archivo está perfecto. El navegador ya tiene un buen visor;
  embeber uno propio es competir con él y perder.
- **El flujo de verificación es IDÉNTICO para los dos tipos.** Lo único que
  cambia es cómo se mira el archivo.
- **`validarArchivoComprobante` es UNA función** que corren el formulario (aviso
  temprano, para no gastar una subida de 4 MB) y el endpoint (la que MANDA). El
  tope se comparte con el de imágenes porque el límite real no es de producto: el
  body de una función serverless de Vercel se corta en 4.5 MB.

### Presentación

- **`RECHAZADO` va NEUTRO, no rojo.** El rojo del admin está reservado a lo que
  exige una acción, y un comprobante rechazado ya se resolvió. Pintarlo de alerta
  dejaría una orden vieja gritando para siempre por algo cerrado.
- **En la lista de Pagos hay un INDICADOR, no una acción**: "Por verificar" en
  ámbar cuando queda algo sin mirar, neutro cuando ya se revisó, y **nada**
  cuando no hay soportes — el efectivo no tiene qué
  fotografiar, así que su vacío no es una falta. Verificar y ampliar viven en el
  detalle de la orden, que es donde está el contexto.
- Los comprobantes cuelgan de la ORDEN, no del Payment, también en ese payload.

### Fuera de alcance de esta tanda (declarado)

Recepción automática por WhatsApp —la entidad queda lista para que ese canal la
alimente cuando llegue el bot—, verificación en lote, y notificaciones de
comprobante pendiente. `tienePendienteDeVerificar` es la definición única que ese
aviso futuro debe consumir, para que la campana y la lista no diverjan.

## La subida DIRECTA a Blob (client upload)

Tanda del 2026-08-26 (del #48/#20). Las imágenes de CONTENIDO —portadas y galería de producto,
hero, brandStory, la galería de /nosotros— suben DIRECTO del navegador a Blob, sin pasar por la
función serverless. El endpoint viejo `/api/upload` (server put) y su cliente `uploadImagen` se
RETIRARON: dejar los dos sería dos caminos y el tope de 4 MB sobreviviendo donde nadie lo espera.

**POR QUÉ, en una línea:** `storage.put` corría DENTRO de la función, así que el archivo viajaba en
el body — y Vercel corta el body en ~4.5 MB. La subida directa saltea eso: el archivo va browser→Blob,
hasta 200 MB (un plano de finca de un par de minutos sin recortar antes).

### La SEGURIDAD es todo lo que hay — el gate del token

Como el archivo NO pasa por el server, **el gate de sesión del endpoint del token es lo ÚNICO que
impide que un tercero suba a tu Blob.** `POST /api/upload/token` llama a `handleUpload` (§
`@vercel/blob/client`), y en `onBeforeGenerateToken` (server, ANTES de firmar):

- **Valida sesión + rol** (OWNER/MANAGER; throw → no hay token). Va DENTRO del callback, no arriba,
  porque el mismo route sirve también el webhook `upload-completed` que Blob manda SIN sesión.
- **Devuelve las restricciones, que quedan CODIFICADAS EN EL TOKEN** (Blob las impone al subir, no
  son un chequeo previo salteable): `allowedContentTypes` (hoy sólo imágenes — un token de hoy NO
  puede subir un mp4; el vídeo amplía esto), `maximumSizeInBytes` (200 MB), `validUntil` (60 min,
  para que una subida lenta por multipart no se quede sin token a mitad).
- **El PATHNAME queda acotado** por `pathnameSubidaValido` (`lib/storage.ts`): exige
  `[dev/]<prefijo>/<archivo>` —el `dev/` DEBE coincidir con el entorno (mismo aislamiento que
  `isDeletable`: una subida de dev no aterriza en producción), prefijo ∈ whitelist, un solo segmento
  saneado (sin traversal)—. Es el único control de DÓNDE escribe, porque el archivo no pasa por el
  server. Afirmado en capa 1 (`lib/storage.test.ts`). `getPayloadFromClientToken` decodifica un token
  y prueba que trae esas restricciones.

**El navegador no ve `VERCEL_ENV`**, así que pregunta el prefijo de entorno con un GET al mismo route
(gateado) y lo cachea, para armar el pathname con el `dev/` correcto.

### La FRONTERA del proveedor gana una cara CLIENTE

Antes sólo `lib/storage.ts` importaba `@vercel/blob` (server). Ahora la subida directa suma
`@vercel/blob/client`: `handleUpload` (server) se queda en `lib/storage.ts` (`emitirTokenSubida`), y
`upload` (navegador) vive en el helper cliente `lib/api/upload.ts` (`subirDirecto`). **Al cambiar de
proveedor se reimplementan las DOS caras.** `sanitizeFilename` se extrajo a `lib/storage-path.ts`
(puro, sin SDK) para que el cliente sanee el nombre IGUAL que el server valida.

### La migración fue TOTAL — comprobantes NO, a propósito

Todos los call sites de imagen de CONTENIDO migraron a `subirDirecto` (`useSubidaImagen`,
`ProductFormModal`); `uploadImagen` y `/api/upload` se borraron. **Los COMPROBANTES se quedan en
server-put** (`storage.put` directo en su route): son otro subsistema —pruebas de pago, con PDF,
atadas a la orden, su 4 MB propio— y nunca usaron `uploadImagen`. No es "dos caminos para lo mismo":
es un subsistema distinto. `storage.put` y `MAX_UPLOAD_BYTES` (4 MB) siguen vivos para ellos.

### El PROGRESO va PEGADO AL BOTÓN, no en un sticky

Una subida de minutos no puede bloquear la edición: el autoguardado corre SIEMPRE (también durante
una subida — el ítem que sube no está en el borrador hasta que llega su url, así que nunca se guarda a
medias). La barra de progreso (`BarraProgreso`) va **pegada al botón que disparó la subida** —"Agregar
foto"/"Cambiar imagen"— donde el ojo ya está; cada editor rastrea cuál control la disparó
(`subiendoDesde`/`subiendoCampo`) para no ponerla en todos. El indicador de GUARDADO (Guardando…/error)
vive en la cabecera, sin sticky.

**POR QUÉ EL PROGRESO NO VA EN UN STICKY DENTRO DE LA TARJETA** (defecto pagado, 2026-08-26): un sticky
sobre una `.duna-card` (`--duna-surface`) necesitaría ese color —no `--duna-bg`— y AUN ASÍ sería una
franja cortando la sección. El sticky del head de `.duna-lista` funciona porque sus filas van sobre el
fondo de PÁGINA, no sobre una superficie elevada. **Esa es la distinción a recordar la próxima vez que
alguien quiera pinnear algo dentro de una tarjeta.** (Y la vista previa sí es sticky, pero SÓLO ≥1080:
en angosto el grid apila y una vista pinneada tapaba el form — `.tienda-vivo__vista` gateado a ≥1080.)

## Storage de imágenes de producto

Las imágenes que se suben desde el admin NO viven en `public/`: en Vercel
el filesystem es de solo lectura en runtime, así que escribir ahí es
imposible, no una opción descartada.

- **Proveedor v1 = Vercel Blob, y SOLO a través de `lib/storage.ts`.**
  Ningún otro archivo del repo importa `@vercel/blob` (verificable con un
  grep, y es la condición que hace barata la revisión de proveedor). El
  adaptador expone una interfaz propia y mínima: `storage.put(file, opts)
  → { url }` y `storage.delete(url)`. No devuelve ni acepta un solo tipo
  del SDK.
- **La decisión de proveedor es REVISABLE.** R2 es candidato al pasar a la
  arquitectura multitenant de Duna (misma cuenta de Cloudflare, egreso
  gratis). El costo de ese cambio debe mantenerse en "reimplementar
  `lib/storage.ts`" y nunca en tocar call sites; si alguna vez hace falta
  tocar un call site para cambiar de proveedor, la abstracción se rompió y
  eso es el bug.
- **El prefijo del pathname es el futuro SCOPE POR TIENDA.** Hoy default
  `productos/`, parámetro del adaptador (`PutOptions.prefix`), no una
  constante incrustada en cada llamada. El día del multitenant pasa a
  `<storeId>/productos/` sin tocar quien lo llama.
- **Aislamiento por entorno, porque el store es UNO SOLO.** Blob no tiene
  ramas como Neon. El adaptador antepone `dev/` a todo lo que no sea
  `VERCEL_ENV === 'production'`. Local y previews escriben en
  `dev/productos/`; producción en `productos/`. **Esta condición es AHORA
  la única de su tipo en el repo**: el build tenía la misma y se retiró el
  2026-08-04 (cada entorno migra su base). No "unificarlas" leyendo una
  versión vieja de este doc — Blob tiene UN store y por eso necesita el
  prefijo; Neon tiene una base por entorno y por eso no necesita la
  condición. Limpiar pruebas jamás puede tocar un blob real. El cálculo
  del prefijo está testeado (`lib/storage.test.ts`); es deliberadamente
  conservador: sin `VERCEL_ENV` se asume NO producción, de modo que el
  error posible es ensuciar `dev/`, nunca el prefijo real.
- **El nombre lo hace único el proveedor** (`addRandomSuffix: true`), que
  es como se cumple de fábrica la regla de hash automático de la sección
  anterior. La URL es entonces una clave de caché inmutable.
- **El store es PUBLIC — decisión deliberada.** Las URLs son legibles por
  cualquiera con el link, que es lo correcto para imágenes de catálogo (van
  a un storefront abierto) y lo que permite que `next/image` las optimice
  sin credenciales. **NO usar este adaptador para documentos, adjuntos ni
  datos de clientes** sin revisar antes esta decisión.
- **El borrado del blob viejo lo hace el SERVER**, en el `PATCH` y el
  `DELETE` de `/api/products/[id]`, comparando contra la imagen que ya
  tenía el producto. No se recibe del cliente a propósito: si el borrado se
  disparara con una URL enviada por el navegador, cualquier admin podría
  borrar cualquier blob del store mandando otra. Va siempre DESPUÉS de
  confirmar el cambio en DB y sin poder tumbarlo — un blob huérfano es
  basura barata; un producto apuntando a una imagen ya borrada, no.
- **`storage.delete` ignora lo que no administra** (`isManaged`): una URL
  relativa de `public/` o externa es un no-op. Los productos sembrados nacen
  apuntando a `/images/*.webp`, así que esta guarda es la que impide que
  editar uno de ellos intente borrar un estático — la regla de
  inmutabilidad de `public/` queda imposible de violar desde el admin.
- **Al reemplazar portadas del seed, revisar `imagenes[]` por estáticas
  residuales**: subir la portada nueva cambia `imagen` a un blob pero deja la
  ruta `/images/*.webp` sembrada dentro de `imagenes[]`, y como ya son URLs
  distintas la dedupe (correctamente) no las colapsa → el detalle muestra dos
  miniaturas. Es metadata, no storage: se limpia con `imagenes: []` y no borra
  nada del store. Los 4 de Nayoli se limpiaron así el 2026-08-03.
- **Y un entorno NO-PRODUCTION solo puede borrar bajo su propio `dev/`**
  (`isDeletable`). Un blob del prefijo real se trata como si no fuera
  nuestro: no-op, pero CON log (no es rutina, es una señal). Producción
  borra sin restricción de prefijo — sus blobs son suyos.

  El motivo no es teórico: la base `development` se re-crea por **reset
  desde `production`**, así que después de cada reset las filas de dev
  apuntan a los blobs REALES que producción está sirviendo. Sin esta
  guarda, probar un reemplazo de imagen en local dispara el borrado del
  `PATCH` sobre esa URL heredada y tumba la imagen del catálogo en vivo.
  Ojo con el razonamiento fácil: el aislamiento de `put` NO cubre este caso
  — lo que se borra no es lo que subimos, es lo que vino en la copia de la
  base. El `dev/` que se permite borrar sale de `envPrefix`, el mismo que
  decide dónde se escribe, para que no puedan divergir. Testeado en
  `lib/storage.test.ts`.
- **Env vars:** el código depende SOLO de `BLOB_READ_WRITE_TOKEN` (el SDK
  lo lee por convención). El connect del store también creó `BLOB_STORE_ID`
  y `BLOB_WEBHOOK_PUBLIC_KEY` en Production y Preview; no se referencian en
  ningún lado.
- **El borrado es de consistencia eventual**: tras borrar, la URL puede
  seguir respondiendo 200 en el edge un par de segundos. No es un fallo del
  borrado — no escribir tests ni verificaciones que asuman un 404 inmediato.

## El PATCH de producto es PARCIAL de verdad

`PATCH /api/products/[id]` escribe **solo los campos que el body TRAE**. La
selección vive en `lib/product-update.ts` (`datosDelPatch` + `trae`) y no dentro
del route handler, por el mismo criterio que `lib/inventory.ts`: **se extrae lo
que tiene el defecto para poder afirmarlo en un test.**

Incidente 2026-08-04 (encontrado al construir el editor de moliendas, arreglado
en tanda propia): el endpoint aplicaba un fallback a CADA campo
(`body.descripcion || ''`, `Number(body.precio) || 0`, `body.sku || null`). **Un
fallback sobre una clave ausente no es un default, es un borrado.**

Lo disparaba un botón visible del admin, no un cliente exótico: "Desactivar", la
acción secundaria del `ConfirmDeleteDialog`, manda `{ activo: false }` y nada
más. Ese click vaciaba la descripción, ponía precio, costo y stock en CERO,
borraba SKU, variante, origen, tostado y peso, y dejaba `imagen: ''` con
`imagenes: []`. Sobrevivían `nombre`, `categoria` y `slug` **porque su valor
`undefined` lo ignora Prisma** — y son justo los que se ven en la lista de
Productos, que es lo que mantuvo el daño invisible.

Y después venía lo irreversible: el borrado de blobs del propio endpoint veía la
portada y la galería enteras como "retiradas" y las borraba del store. En
producción `isDeletable` no frena nada (producción borra sin restricción de
prefijo), así que desactivar un producto le borraba las imágenes de verdad. **La
base tiene respaldos; los blobs no.**

- **Presencia de la clave, no verdad del valor.** `''`, `0`, `false` y `null` son
  ediciones legítimas —vaciar un SKU, poner el costo en cero— y tienen que poder
  escribirse. `undefined` cuenta como AUSENTE: es lo que manda un cliente que arma
  el body con campos opcionales (`variante: form.variante || undefined`), así que
  un `Object.hasOwn` a secas no alcanza.
- **El manejo de cada valor PRESENTE quedó idéntico.** Esta tanda arregló la
  ausencia, no la semántica. Única excepción anotada: `imagenes`, que es la que
  dispara el borrado de blobs.
- **Un `slug` vacío NO borra el slug.** La columna es única y sostiene la URL del
  producto en la tienda.
- **El diff de blobs es BASE-ANTES contra BASE-DESPUÉS, nunca contra el body**, y
  por eso se defiende solo desde que el update es parcial: un PATCH que no habla
  de imágenes deja las dos lecturas idénticas. Reescribirlo para decidir desde
  `body` reabre el agujero — era el update el que mentía, no el diff.
- **Los campos que el endpoint nunca escribió siguen sin escribirse**
  (`variedad`, `proceso`, `altitudMin`, `altitudMax`, `molienda`, `notas`,
  `notasCata`, `descripcionCorta`, `bestseller`, `badge`, `agotado`). Agregarlos
  es una decisión de producto, no parte de este arreglo.
- **El test va en el CARRIL, no en la suite pura**
  (`tests/integracion/patch-producto-parcial.test.ts`), y la razón importa: lo que
  se afirma no es la forma del objeto que se construye sino lo que la fila TIENE
  DESPUÉS de escribir. Un test con mocks habría pasado en verde contra el código
  defectuoso —el objeto que se armaba era exactamente el que Prisma escribió—; lo
  que delata el bug es releer la fila. Se escribió contra el código roto y se lo
  vio fallar 6 de 7. **No borrar ese archivo**; la aserción es sobre la fila
  COMPLETA (`deepEqual` neutralizando `updatedAt`) a propósito, para que una
  columna nueva del schema quede cubierta el día que alguien la agrega.

### El gemelo de CLIENTES — la misma regla, la misma forma (ex-Backlog #5)

`PATCH /api/customers/[id]` tenía **exactamente** el mismo defecto —escribía todos
los campos sin condición, con un fallback sobre cada clave (`body.email || null`,
`canal || 'directo'`)— y se cerró el 2026-08-27 con la misma forma, no una nueva:

- **`datosDelPatch` de clientes vive en `packages/core/src/customer-update.ts`** y
  **REUSA `trae` de `product-update`** —presencia de la clave, no verdad del valor—
  en vez de inventar un segundo chequeo de presencia. El manejo de cada valor
  PRESENTE quedó idéntico al del route de antes (`'' → null` en opcionales, `canal`
  a `'directo'` sólo si viene vacío, el teléfono canonizado con
  `normalizeCustomerPhone`).
- **Era una MINA, no una herida:** el único control que llama a este PATCH —el
  modal de cliente— manda el formulario COMPLETO, así que ningún campo se perdía.
  El arreglo la desactivó ANTES de que exista un control que mande un campo suelto
  —cualquier acción rápida de fila que edite un solo dato—: ese día,
  `{ ciudad: 'X' }` cambia sólo la ciudad y no vacía el resto del cliente.
- **El test va en el CARRIL** (`tests/integracion/patch-cliente-parcial.test.ts`),
  por la misma razón: se afirma la fila DESPUÉS de escribir, no la forma del
  objeto. Se lo vio fallar contra los fallbacks de hoy (un campo suelto borraba los
  demás); con el arreglo, pasa. **No borrar ese archivo.**

  (El ejemplo original era el toggle de `activo` de la salida-A del ex-#8; esa
  columna se retiró el mismo 2026-08-27 —migración `drop_customer_activo`, salida-B
  del #8— así que el caso vive ahora en cualquier otro campo suelto.)

### Activar y desactivar: cada dirección por su puerta

Las dos acciones existen y **no viven en el mismo lugar**, que es una decisión y
no una asimetría accidental:

- **Desactivar** sigue dentro del diálogo de ELIMINAR, como la alternativa no
  destructiva que se ofrece "en su lugar". Ahí tiene sentido: es la respuesta al
  409 de un producto con ventas.
- **Activar** vive en el badge "Inactivo" de la card (y de la fila, en vista
  Tabla), que se vuelve una manija clickeable y abre su propia confirmación.

El primer intento puso las dos detrás del ícono de basura y duró un solo gate.
**Una papelera que además activa promete una cosa y esconde la contraria** — es
la misma regla que hace que `CustomerLink` renderice texto plano cuando no hay
perfil al que ir ("no dead link, no cursor-pointer promising a navigation that
won't happen"), aplicada al caso simétrico. Reactivar quedaba reachable pero no
descubrible: nadie busca "activar" dentro de "Eliminar".

- **`accionEstadoProducto` resuelve el par** (verbo, `activo`, toast) y
  **`alternativaAlEliminar` filtra por dirección**, derivándose de la primera. Que
  sea una derivación y no una segunda condición es el punto: el invariante "del
  flujo de eliminar nunca sale una activación" es una propiedad del filtro, no una
  convención que haya que recordar. Ambas testeadas en `npm test` (capa 1).
- **Para un producto ya inactivo el diálogo de eliminar no ofrece alternativa**, y
  su texto dice dónde está la manija. Un botón menos, pero ninguna salida menos.
- **`confirmKind` en `ConfirmDeleteDialog`**: `'destructive'` (default, los tres
  call sites de siempre) o `'default'` para una confirmación que no borra nada —
  ámbar en vez de rojo, y el verbo del `confirmLabel` como texto intermedio en vez
  de "Eliminando…". Se reusa el diálogo por lo que ya resuelve (candado único,
  error del servidor a la vista, no se cierra si falla); lo único que faltaba era
  no pintar de rojo algo que no destruye. El nombre del componente quedó corto —
  hoy confirma acciones sensibles, no solo borrados.
- **La affordance es una constante compartida** (`BADGE_ACTIVABLE`), como
  `THUMB_INSPECCIONABLE`, para que cuadrícula y tabla no diverjan en cuánto se
  nota que el badge se puede clickear. Hover de TINTE, nunca relleno: el badge es
  neutro y lo sigue siendo (Amber Minimal).
- **Sólo "Inactivo" es clickeable, "Activo" no.** No es descuido: desactivar ya
  tiene su lugar, y un tercer camino al mismo dato es cómo se llega a dos puertas
  que se desincronizan.

## Galería de producto — `imagen` vs `imagenes[]`

Semántica (decisión del owner): **`Product.imagen` es LA portada** en todos sus
usos —cards del catálogo, cards del admin, hero del detalle— e
**`imagenes[]` son tomas ADICIONALES** que solo aparecen en la galería del
detalle del storefront. v1 **sin reordenamiento**: el orden es el de subida.

- **La composición y la dedupe viven en `lib/product-gallery.ts`**
  (`galeriaCompleta`), compartidas por el detalle y el admin. Si cada vista
  armara su propia lista, el orden y los duplicados divergirían entre lo que el
  operador edita y lo que el cliente ve.
- **Los seeds traen la portada DUPLICADA dentro de `imagenes[]`, y está así a
  propósito.** `prisma/seed-products.ts` trae `imagenes: ["<la misma URL que
  imagen>"]`, herencia de la semántica anterior, donde `imagenes[]` era "la
  galería completa, portada incluida" e `imagen` solo el fallback. **Ese dato NO se migró y no hace
  falta migrarlo**: `galeriaCompleta` dedupea al renderizar, así que un producto
  recién sembrado se ve exactamente como siempre (lista de 1 → sin fila de
  miniaturas).
  **Ojo: el duplicado deja de serlo cuando se reemplaza la portada.** En
  producción, al subir las portadas reales, `imagen` pasó a un blob y el
  `/images/*.webp` sembrado quedó como una toma DISTINTA dentro de `imagenes[]`
  — dos miniaturas por producto. El owner decidió limpiar (`imagenes: []` en los
  4, 2026-08-03; ver la sección de storage). Es solo metadata: no se borró ningún
  blob ni ningún estático. La limpieza no se deshace sola: en `prisma/seed.ts`
  `imagen`/`imagenes` van SOLO en el `create` del upsert, así que re-sembrar no
  vuelve a meter la estática.
- **NO "arreglar" el dato ni quitar la dedupe creyendo que sobra.** La dedupe es
  una **garantía defensiva** contra cualquier fuente futura —un import, un seed
  nuevo, una edición manual, un backfill— no un parche para esos 4 registros.
  Limpiar la base no la vuelve innecesaria; solo elimina la única evidencia de
  por qué existe. Testeada en `lib/product-gallery.test.ts`.
- **El dato se auto-normaliza al editar, sin backfill:** el formulario del admin
  carga la galería excluyendo la portada, así que guardar un producto sembrado
  deja su `imagenes[]` sin el duplicado. Es el efecto correcto de la semántica
  nueva y no cambia nada en pantalla (`galeriaCompleta` ya daba el mismo
  resultado). No es motivo para quitar la dedupe: los productos que nadie edite
  siguen con el duplicado, y las fuentes futuras también pueden traerlo.
- **El tope es `MAX_GALERIA_IMAGENES` (6) y cuenta ADICIONALES**, no la portada:
  un producto muestra como máximo 7 miniaturas. Se valida en el cliente (aviso
  temprano) y en el POST y el PATCH (la que manda).
- **El borrado de blobs de galería lo hace el SERVER por diff**: compara el
  array previo de la BASE contra el nuevo (`blobsRetirados`) y borra lo que
  salió. El cliente jamás manda "borra esta URL" — si lo hiciera, cualquier
  admin podría borrar cualquier blob del store enviando otra. Una toma promovida
  a portada se excluye del borrado: seguía en uso. El `DELETE` del producto
  borra portada + galería completa.
- Un producto puede tener portada estática de `public/` y galería en Blob: las
  guardas del adaptador (`isManaged`) hacen no-op las relativas, así que
  conviven sin migrar nada.

## Opciones de molienda — el editor del admin

`Product.moliendasOpciones` (Json) se edita en el modal de producto, sección
**"Opciones de molienda para el cliente"**. El label es largo a propósito: son
DOS campos distintos y confundirlos es fácil — `Product.molienda` (String) es
ficha técnica ("esta bolsa es molienda Media") y **no lo toca este editor**; hoy
sigue sin UI, y eso está anotado, no es un descuido de esta tanda.

**Editar esta lista es OPERAR LA TIENDA, no llenar un campo de la ficha.** Con el
fix híbrido-por-cardinalidad, la cantidad de opciones DISPONIBLES decide el
comportamiento de la card del catálogo: una → agrega directo; varias → manda al
detalle a elegir (`decidirMolienda`, `lib/moliendas-opciones.ts`). Por eso el
editor lleva una línea muted que lo dice; sin ella el operador mueve un toggle y
la tienda cambia sin que nada lo anuncie.

- **Las reglas de escritura son puras y viven al lado de las de lectura**
  (`sanitizeOpciones` + `validarOpciones`, testeadas en `npm test` — capa 1). Las
  corren el modal (aviso temprano) y el POST/PATCH (la que MANDA). Son tres:
  nombre no vacío; único por producto **comparando sin mayúsculas ni espacios**
  (`moliendaAceptada` busca por nombre EXACTO, así que dos filas que el ojo lee
  iguales se comportarían distinto — una compraría y la otra daría 400); y **al
  menos una disponible**.
- **La regla de "al menos una disponible" es la que cierra una trampa real**:
  siete opciones con cero disponibles deja `decidirMolienda` en `agotada` y
  `moliendaAceptada` rechazando todas, o sea un producto vivo en el catálogo e
  incompraable — el mismo modo de falla del bug de go-live. Para dejar de vender
  un producto existe `activo`, no una lista de opciones muertas.
- **Lista VACÍA es válida y es el default del alta.** Un producto sin opciones no
  pide molienda y su card agrega directo; las reglas solo aplican desde la primera
  fila.
- **`sanitizeOpciones` NO descarta las filas sin nombre** (a diferencia de
  `sanitizeGaleria` con las URLs vacías): las conserva para que
  `validarOpciones` las REPORTE. Tirarlas en silencio haría que una fila a medias
  desapareciera al guardar y el operador la diera por creada.
- **La escritura sigue la regla general del endpoint** (§ El PATCH de producto es
  PARCIAL de verdad): `moliendasOpciones` es un campo más de `datosDelPatch` y se
  escribe sólo si el body TRAE la clave. Acá importa el doble, porque ese endpoint
  también lo llama el "Desactivar" con un body de un solo campo
  (`{ activo: false }`): escribirlo sin condición vaciaría la lista por desactivar
  un producto, y eso no es perder un campo — es cambiarle el comportamiento a su
  card. Cuando se construyó este editor la guarda vivía en un bloque propio del
  handler, porque el endpoint todavía pisaba todo lo demás; al volverse general la
  regla, el caso especial dejó de serlo. **La VALIDACIÓN, en cambio, se queda en el
  handler**: produce un 400, y eso es del protocolo HTTP, no de qué campos se
  escriben. Las dos mitades comparten las funciones puras, así que no pueden
  discrepar sobre qué es una lista válida.
- **Renombrar o quitar una opción NO reescribe historia.** Las órdenes guardan la
  molienda como STRING (`OrderItem.moliendaSeleccionada`) y ninguna vista la
  re-deriva del producto: el detalle de la orden, el checkout y las plantillas de
  correo imprimen el string tal cual. Verificado al construir el editor; si alguna
  vista futura quisiera "resolver" ese string contra `moliendasOpciones`, eso sería
  el bug.
- **Los 400 de `/api/products` llegan al operador con su texto.** `createProduct` y
  `updateProduct` propagan el `error` del servidor (como ya hacía `deleteProduct`
  con su 409): un "Error al guardar" genérico borraría justo la frase que dice qué
  corregir.
- **Quitar una molienda es DESHACIBLE hasta guardar** (decisión del owner, contra
  clicks accidentales). La X no borra la fila: la marca, la deja tachada a la
  vista y cambia el botón por "Deshacer" en el mismo lugar. La asimetría es lo que
  lo justifica — un click accidental borraba una opción con su método ya escrito y
  rehacerla es teclear de nuevo; con la marca cuesta un segundo click. Y el
  operador ve lo que va a pasar ANTES de que pase, que es lo que un `confirm()` no
  da. Los conteos de la sección hablan del RESULTADO de guardar, no de lo que hay
  en pantalla.
- **El borrado diferido es lo que hace seguros los índices.** Nada se reindexa
  mientras el modal está abierto: agregar apendiza y quitar solo marca. Por eso el
  Set de índices marcados y las `key` por índice de las filas son correctos. El día
  que se agregue reordenamiento, las dos cosas necesitan un id propio.
- **Se valida y se guarda solo lo que SOBREVIVE.** Una fila marcada para quitar no
  puede bloquear el guardado por estar sin nombre ni contar para "al menos una
  disponible". Como `validarOpciones` numera sobre las vivas y el editor pinta la
  lista completa, los índices de los problemas se remapean — sin eso el borde rojo
  cae en la fila de al lado apenas hay una marcada por encima.
- v1 **sin reordenamiento** y sin catálogo global de moliendas: siguen siendo Json
  por producto, igual que la galería.

## Identidad: cada producto declara la suya

El admin mostraba el favicon de Café Nayoli aunque su chrome ya fuera Duna. La
causa no era un archivo mal puesto: **todo lo de identidad vivía en la raíz**
(`app/layout.tsx` + las convenciones de archivo `app/favicon.ico`, `app/icon.svg`,
`app/apple-icon.png`), y Next las aplica a **toda la app**, no sólo al storefront.
Ninguno de los tres layouts de grupo declaraba nada propio, y ninguna página del
repo exportaba `metadata`.

Es la misma frontera que ya rige la política de tema: **storefront y admin son
productos distintos que comparten repo temporalmente**, así que cada uno declara
sus metadatos en el layout de su grupo.

| metadato | storefront | admin |
| --- | --- | --- |
| `title` | `Café Nayoli` (raíz) | `Panel Duna`, `%s · Panel Duna` |
| `description` | copy de Nayoli (raíz) | "Panel de operación Duna." |
| `themeColor` | `#F9F6F4` (raíz) | `#F9F6F0` claro / `#171717` oscuro |
| favicon / icon / apple | `public/` + `metadata.icons` del grupo | `/brand/*-duna.*` |
| manifest | Nayoli — **sigue global**, ver abajo | *(hereda el de Nayoli)* |

- **`title.absolute`, no `title.default`.** Un `default` de segmento hijo SIGUE
  pasando por el `template` del padre: la pestaña del panel salía
  **"Panel Duna · Café Nayoli"**. Se vio en el `<head>` real, no en la teoría.
  `absolute` es la forma que Next define para ignorar el template heredado.
- **Los íconos del storefront salieron de `app/` a `public/`.** Declararlos en el
  admin NO alcanzaba: `metadata.icons` de un hijo agrega sus links pero **no
  retira** los que la raíz emite por convención de archivo, así que el `<head>`
  del panel seguía trayendo el `favicon.ico` de Nayoli. Con los archivos en
  `public/` y declarados desde `app/(storefront)/layout.tsx`, las URLs y los bytes
  son los mismos de siempre (`/favicon.ico` responde 200 para los pedidos ciegos
  de crawlers) y dejan de aplicar fuera del storefront. Ojo con el intermedio que
  NO sirve: moverlos a `app/(storefront)/` los hace servir con URL hasheada
  (`/icon-utz4wr.svg`) y `/favicon.ico` pasa a 404.
- **Los títulos de sección los DERIVA `ADMIN_NAV`** (`lib/admin-titulo.ts`, capa 1):
  la pestaña dice exactamente lo que dice el sidebar. Una segunda lista dejaría
  que renombrar "Analítica" en el menú no moviera la pestaña — y el título de
  pestaña es justo el texto que nadie mira hasta que está mal. Como las páginas
  del admin son `'use client'` y un componente de cliente no puede exportar
  `metadata`, cada sección lleva un `layout.tsx` de cuatro líneas.
- **El detalle de orden NO lleva título propio**: es un modal sobre
  `/admin/ordenes` (`?order=CN-…`), no una ruta. No se inventa un
  "CN-132453 · Panel Duna" para algo que no existe como página.
- **CASO BORDE del `themeColor`, y no es un bug**: `prefers-color-scheme` sigue la
  preferencia del SISTEMA, no el toggle de tres estados del panel. Con el sistema
  en claro y el panel forzado a oscuro, la barra del navegador queda clara. Es
  límite de un `themeColor` estático en metadata; **no vale sincronizarlo por JS**
  — la mejora es marginal y el costo (un meta tag mutando en cliente) no.

**PENDIENTE DECLARADO — el manifest sigue siendo de Nayoli en las dos
superficies.** `app/manifest.ts` se sirve en `/manifest.webmanifest` y lo enlazan
todas las rutas, así que instalar el panel como PWA diría "Café Nayoli". No se
arregló en esta tanda a propósito: darle manifest propio al admin exige decidir
nombre, colores de instalación e íconos PNG 192/512 en marca Duna, que hoy no
existen (sólo hay SVG e ICO) — y eso es una decisión de asset, no una corrección
de fuga. Tampoco existen `openGraph` ni `twitter` en ningún lado: es una ausencia,
no una fuga.

**NOTA PARA EL TEMPLATE — esto es CONTENIDO DE TENANT.** El `title`, la
`description` y el `themeColor` de la raíz, los íconos del storefront y todo
`app/manifest.ts` son de la TIENDA, no de Duna. Van al inventario de la fase 1
(`SiteSetting`) el día del multitenant. Lo que queda del lado del producto es lo
que declara `app/(admin)/layout.tsx`.

## Política de tema (dark mode)

El storefront es light-only (paleta de marca fija). El admin soporta
dark mode con toggle. La política de tema se define en el layout de
cada grupo de rutas, nunca global — storefront y admin son productos
distintos que comparten repo temporalmente.

Implementación: `app/(storefront)/layout.tsx` monta
`StorefrontThemeProvider` (`forcedTheme="light"`);
`app/(admin)/layout.tsx` monta `AdminThemeProvider`
(`defaultTheme="system"` + `enableSystem`, toggle en TopBar). El root
layout NO monta ThemeProvider. `color-scheme` sigue al tema vía CSS
(`html` claro por defecto, `.dark` oscuro — solo el admin aplica
`.dark`).

### El CHROME del panel ES del design-system (color y tipografía)

Cerrado el 2026-08-15 (era el § Backlog #1). Las pantallas del rediseño se veían
Duna y el LIENZO sobre el que flotaban no: el chrome consumía los tripletes de la
app. Ya no — y sin tocar los ~718 usos de las clases de color del panel.

- **Los roles caen al token del DS por FALLBACK**, en `@theme` de globals.css:
  `--color-x: var(--duna-x, hsl(var(--x)))`. Donde `--duna-*` está definido —el
  grupo `(admin)` carga `tokens.css` vía `duna.css`— gana el token; donde no —el
  storefront— cae al triplete de siempre. **`@theme` es GLOBAL** (Tailwind v4 no
  lo scopea), así que la seguridad del storefront NO viene de un scope: viene de
  que `--duna-*` no exista ahí. Es CONDICIÓN, medida sobre el artefacto de
  producción: Next parte el CSS por grupo de rutas y el chunk que DEFINE los
  tokens del DS no lo enlaza ninguna página del storefront. Si algún día una ruta
  pública cargara ese chunk, el fallback dispararía y el storefront cambiaría de
  fondo — ésa es la línea que hay que re-verificar si cambia el bundling.
- **El mapeo es por ROL, no por valor.** `accent` y `sidebar-accent` →
  `--duna-wash-hover` (son fondo de hover del nav, no superficie); `destructive` →
  `--duna-bad` (terracota); los `*-foreground` de superficie → `--duna-ink`.
- **SIN contraparte, y por eso conservan su color propio:** `--chart-1..5` (no hay
  escala de gráficas en el DS), `--accent-amber` (el `--duna-sol` significa
  ATENCIÓN, no acento) y `--ring`/`--sidebar-primary`/`--sidebar-ring` (el
  `--duna-ring` es un box-shadow, no un color HSL — se migran con los controles).
- **`--duna-muted` se OSCURECIÓ** (#7C776B → #746F64) porque el mapeo de
  `muted-foreground` lo habría dejado bajo AA — y el defecto ya vivía en el propio
  DS (`.duna-sub`, `.duna-caption`). Se movió su gemelo, la flecha del `.duna-select`.
- **La tipografía también migró:** el body del panel pasó a Hanken
  (`--duna-font-ui`) y el wordmark "DUNA" de JetBrains Mono a Spline Sans Mono
  (`--duna-font-mono`). **Instrument Sans y JetBrains Mono se retiraron** de
  `fonts.ts`, que queda con las tres del sistema.
- **El puente de familias y las clases de `next/font` viven en `<html>`**, no en
  `.admin-shell`: lo portaleado a `<body>` (diálogos, dropdowns) queda fuera del
  div y no heredaba la tipografía. Las clases las monta el SCRIPT INLINE del layout
  del grupo —el mismo que marca `html.admin`, antes del primer paint— y NO el
  layout raíz, porque ahí el storefront cargaría las cinco familias del panel
  (promesa de `fonts.ts`). El puente `--duna-font-*` se movió a `html.admin`.

## Bases de datos (Neon) — qué es cada endpoint

Cuatro ramas, cuatro roles. El hostname es el identificador; el NOMBRE de la
rama no lo es (ver la regla de abajo).

| Rama (Neon) | Endpoint | Rol |
| --- | --- | --- |
| `production` | `ep-ancient-frog-ac1v1hg5` | **PRODUCCIÓN.** La que sirve Vercel **en el entorno Production únicamente** (pooled en `DATABASE_URL`, directo en `DIRECT_DATABASE_URL`). Desde el 2026-08-02 Preview YA NO hereda estas vars — ver la fila de abajo. |
| `development` | `ep-still-sound-acfmedf2` | Base de desarrollo. La usan el `.env` local (pooled + directo) **y los PREVIEW deploys**: desde el 2026-08-02 el entorno Preview de Vercel tiene entradas PROPIAS de `DATABASE_URL` y `DIRECT_DATABASE_URL` apuntando acá. Ramificada de production, 33/33 migraciones. |
| `quarantine-prod-snapshot-jul24` | `ep-solitary-mouse-ac140cla` | Snapshot CONGELADO del 2026-07-24. **No tocar ni decomisar sin decisión explícita del owner.** No es producción ni desarrollo: no leerla para diagnosticar nada. |
| `backup-pre-purge-ago03` | `ep-super-frost-acy9dryk` | Snapshot CONGELADO del 2026-08-03, child de production, tomado justo antes de la purga pre-lanzamiento (ver abajo). Es el ÚNICO respaldo de las 120 órdenes borradas. **No tocar ni decomisar** mientras la purga siga siendo reversible por decisión del owner. |

**REGLA DURA — verificar el ROL en la CONSOLA de Neon antes de cualquier
operación destructiva o de escritura masiva** (reset de rama, `migrate reset`,
borrado o reescritura en lote, seeds, restore, decomisar una rama).

No sirve como evidencia del rol: el nombre de la rama, lo que diga `.env`, un
comentario en el código, ni lo que alguien recuerde. Los tres fallaron el
2026-08-02: `ep-ancient-frog` estaba etiquetado en sesión como "la rama de
desarrollo" y era producción; el diagnóstico se hizo contra
`ep-solitary-mouse` creyéndola producción y fabricó un incidente falso ("faltan
6 migraciones" con producción en 33/33); y por poco se ejecuta un "reset de la
rama de dev desde el parent" que habría **borrado producción**.

Para verificar el rol desde fuera de la consola, la única fuente válida es el
`process.env` DEL deployment (así se resolvió el 2026-08-02: un route handler
temporal, gateado a OWNER, que devolvía `new URL(...).hostname` — nunca la
cadena de conexión — y `VERCEL_ENV`).

### Purga pre-lanzamiento del 2026-08-03 — EXCEPCIÓN ÚNICA, no precedente

Se borró TODO lo transaccional de producción: 120 órdenes, 151 OrderItems, 89
Payments, 99 Shippings, 20 Customers, 8 InventoryLogs. Sobrevivieron intactos
productos, stock, usuarios/sesiones de Better Auth, `AutomationSetting` y
`DashboardPreference`. Motivo: la base traía únicamente data de demo (seed) y
pruebas manuales, y el cliente arranca con historial en cero.

**La regla de no-borrado SIGUE VIGENTE para operación normal.** Los paths de la
app cancelan, no borran, y eso es lo correcto: una orden es un registro
financiero. Esta purga fue una excepción de una sola vez, con respaldo previo y
aprobación explícita del owner. No es precedente para "limpiar" nada.

Lo que hizo segura la operación, por si alguna vez hay que repetirla:

- **Respaldo ANTES**, en una rama propia (`backup-pre-purge-ago03`), y una
  aserción en la transacción de que toda orden a borrar existía en él y que
  producción no tenía nada posterior al snapshot. Sin esa cobertura verificada,
  la purga aborta.
- **Cerrojos por hostname, no por confianza.** El primer intento de esta sesión
  llegó con la cadena de `backup-pre-purge-ago03` etiquetada como producción —
  el mismo modo de falla del 2026-08-02. Se detectó comparando el hostname
  contra la tabla de arriba y el contenido contra `development`. Un wipe con esa
  cadena habría destruido el respaldo dejando producción sucia.
- **Todo en UNA transacción**, con aserciones de que las tablas a conservar no
  cambiaron de conteo. Cualquier fallo → `ROLLBACK`.

**Los criterios "obvios" de data de prueba NO servían.** El seed genera órdenes
con prefijo `CN-9#####` (no solo `SN-`) e identidades realistas tomadas de
`MOCK_CUSTOMERS` (`valentina.torres@gmail.com`, teléfonos `+5731…` válidos): ni
"nombres QA" ni "@example.com" las tocan. Y como las órdenes reales se numeran
`CN-` + 6 dígitos aleatorios, ~1 de cada 9 reales empieza por `CN-9` — borrar
por prefijo habría destruido órdenes legítimas. Los marcadores que sí
discriminan son `Payment.registrado_por_nombre = 'Seed'` y la coincidencia de
identidad contra `MOCK_CUSTOMERS`. Si alguna vez hay que volver a clasificar
data de prueba, empezar por ahí y no por el número de orden.

Las identidades no-fixture que quedaban (Juan Henao, Luis / lUIS Cagua, Carlos,
`CN-299035`) las resolvió el owner el 2026-08-03: **todas del círculo de pruebas**
(él, su socio Carlos, el dueño de Nayoli). No había clientes reales.

**PENDIENTE — el stock NO se tocó y sus números son falsos.** Quedó en 42/28/42/28
(los valores del seed). No se puso en cero a propósito: cero apagaría el
storefront, y el número real exige **conteo físico del cliente**. Ajustar en la
sesión con el cliente, antes de abrir ventas. Hasta entonces, cualquier métrica
de inventario o alerta de stock bajo está leyendo datos inventados.

## Env vars en Vercel — SIN comillas

El dashboard de Vercel **no parsea** el valor: lo guarda literal. Las comillas
de un archivo `.env` son sintaxis que el parser de dotenv quita; pegar una línea
de `.env` en el dashboard deja **las comillas dentro del valor**.

Incidente 2026-08-03: `EMAIL_FROM` quedó como `"Café Nayoli
<no-reply@duna.solutions>"` con comillas literales. Resend rechazaba el
remitente y `/api/users/invite` devolvía un 500 sin nada en runtime logs (ese
catch venía sin binding — ya está instrumentado). Costó una tarde porque el
síntoma no apunta a la causa: se lee como problema de la API key o del dominio.

- **Regla: en el dashboard, el valor va crudo.** `Café Nayoli
  <no-reply@duna.solutions>`, no `"Café Nayoli <no-reply@duna.solutions>"`.
- Aplica a TODAS, no solo al correo. Una API key entre comillas da un 401 que
  se lee como "key inválida" en vez de "key mal pegada".
- `lib/email.ts` recorta comillas envolventes de `EMAIL_FROM` y
  `RESEND_API_KEY` y **avisa por log** cuando lo hace. La limpieza es una red,
  no un permiso: si aparece ese `[env]` en los logs, hay que arreglar el
  dashboard igual — aceptarlo en silencio dejaría la config mal para siempre.
- El formato de `EMAIL_FROM` se valida (`algo@dominio.com` o
  `Nombre <algo@dominio.com>`) y se loguea con `console.error` si no matchea,
  **sin lanzar**: el regex podría ser más estricto que Resend, y tumbar un envío
  que funcionaba es peor que uno que falla dejando rastro.

### `sslmode=verify-full` explícito en las cadenas de Postgres

Las dos cadenas (`DATABASE_URL` pooled y `DIRECT_DATABASE_URL` directa) llevan
`sslmode=verify-full`, no `require`. **No cambia el comportamiento: lo congela.**

`pg-connection-string` hoy trata `prefer`, `require` y `verify-ca` como alias de
`verify-full`, y avisa que en pg v9 / pg-connection-string v3 van a adoptar la
semántica de libpq — que es MÁS DÉBIL. O sea que dejar `require` es aceptar que
un upgrade futuro degrade la verificación del certificado en silencio. Escribir
`verify-full` deja lo que ya pasa, dicho.

**PENDIENTE DEL OWNER: las cuatro filas del dashboard de Vercel** (Production y
Preview × pooled y directa). El `.env` local ya está; producción y preview siguen
con `require` hasta que se editen a mano, y aplica la regla de arriba — el valor
va crudo, sin comillas.

Sobre el warning que lo destapó, para no volver a investigarlo: **el driver nunca
se movió.** `pg` (8.21.0) y `pg-connection-string` (2.13.0) están así desde el
commit inicial; lo único que cambió en el vecindario fue `@prisma/adapter-pg`
7.8.0 → 7.9.1 en `2a0f1d4`. El aviso sale de `pg-connection-string/index.js` y
tiene guarda de una sola vez (`deprecatedSslModeWarning.warned`), así que **se
emite una vez por proceso de Node**: sólo se ve en arranques en frío. Pareció
nuevo el 2026-08-05 porque el protocolo del gate (§ GATE DE CAPA 3) nos tenía
reiniciando en frío cinco veces seguidas — no porque hubiera una regresión. Es el
mismo modo de falla de siempre en este repo: **lo que se ve cambiar no es
necesariamente lo que cambió.**

## Monorepo (Fase A) — `@duna/core` y la cadena de build

Workspace npm (`"workspaces": ["packages/*"]`). En Fase A hay **UNA sola app** (la
raíz) que consume `packages/core` (schema + cliente Prisma + data-access de dominio)
y `packages/design-system`. La topología de dos apps (`apps/admin` + `apps/storefront`)
es Fase B.

La cadena de build, verificada contra un preview real (no "debería"):

- **Cliente Prisma:** el generador `prisma-client` (Prisma 7, TS ESM) escribe a
  `packages/core/src/generated/prisma` (gitignored). Lo dispara el **`postinstall`
  de la raíz** con `npm run generate -w @duna/core` (corre en el cwd de core, donde
  su `prisma.config.ts` resuelve el schema) — determinista, no depende de que npm
  corra solo el postinstall del workspace.
- **`buildCommand`:** `npm run db:deploy -w @duna/core && next build`. El
  `migrate deploy` corre en el contexto de core y encuentra las **36 migraciones en
  `packages/core/prisma/migrations`** (fuente única del schema). `vercel.json` sigue
  con `buildCommand: "npm run build"`.
- **`transpilePackages: ['@duna/core']`** en `next.config.ts` es OBLIGATORIO: core
  envía TS fuente y Next debe transpilarlo; sin esto el build de producción no
  compila el paquete de workspace.
- **El seed NO vive en core** (importa Better Auth + data demo de Nayoli): se queda
  en `prisma/` raíz, `npm run db:seed`. `packages/core/prisma.config.ts` no lo
  referencia.

**PRECONDICIÓN de Fase B — el split dominio-vs-vista de los type composites.** En
Fase A los módulos de core resuelven `@/types/*` vía el alias `@/`→raíz (roce
type-only, funcional: verificado en build y runtime). **Ese alias DESAPARECE al
partir en `apps/admin` + `apps/storefront`**, así que ANTES de Fase B hay que hacer
el split: los enums de dominio (`OrderStatus`, `OrderChannel`, `CondicionPago`,
`ShippingEstado`, `ProductCategory`…) → core; los composites de vista
(`Order`/`Product`/`Shipping`, que embeben `Comprobante`/`PaymentMethod`) → app; y
`ComprobanteEstado`/`MetodoPago` desde el enum Prisma (`@duna/core`), no desde los
type files de vista. Se difirió de Fase A a propósito: es un refactor de modelado,
no un move, y el gate de Fase A (deploy real) no lo necesita.

**PRECONDICIÓN de Fase B — los componentes del storefront se extraen a `packages/storefront-ui`,
NO se quedan en `apps/storefront`.** Gemela de la de arriba. El panel (`apps/admin`) importa
`HeroSection` —y las demás secciones de la home— para la **VISTA PREVIA EN VIVO** del editor de
`/admin/tienda`: renderiza los componentes REALES del storefront alimentados por el estado del
formulario (sin iframe; se teclea y la vista cambia en el mismo render). **En un workspace una app
NO importa de otra app, sólo de `packages/*`**, así que si Fase B dejara esos componentes en
`apps/storefront` el panel no podría importarlos y la vista en vivo se caería —habría que volver al
iframe o publicar un paquete npm versionado—. Por eso van a `packages/storefront-ui`, que consumen
las DOS apps. Se construyó la vista en vivo en Fase A contra el import directo (una sola app), a
propósito: extraer el paquete antes es front-loadear esta precondición de una fase sin fecha, y es
un refactor entangled que merece la tanda de Fase B.

**Lo que ese paquete ARRASTRA (censado ahora para que Fase B no lo re-diagnostique):** a diferencia
del design-system —presentacional PURO, sin un solo `'use client'`— `storefront-ui` es **UI
ACOPLADA**: lleva `'use client'` + **framer-motion** (conducta), **`next/image`** como peer-dep de
`next` (las dos apps lo tienen), y el **provider `SiteContentProvider` (client) al paquete** mientras
el **loader `readSiteContent` (server/prisma) se queda en la app** y le pasa el dato. Y **ASUME que
la app consumidora carga el `globals.css`** —el `@import` de las fuentes (Inter/Playfair) y los
tokens `@theme`—, igual que el design-system asume que sus tokens están cargados. Los colores
literales de la vertical viajan con el componente hasta la capa de tema-por-cliente (§ Mejoras
post-multitenant), no antes.

**DISPARADOR de Fase B** (owner, 2026-08-25): **despliegues independientes de verdad** —que el
panel y la tienda se deployeen por separado— **O el segundo cliente**, lo que llegue primero. Hasta
entonces Fase A (una app) alcanza, y las dos precondiciones de arriba (split de tipos, extracción de
`storefront-ui`) se ejecutan como parte de esa tanda, no antes.

## Migraciones y deploy

- **CADA ENTORNO MIGRA SU PROPIA BASE.** `npm run build` corre `prisma
  migrate deploy` (en Fase A, vía `npm run db:deploy -w @duna/core`) antes de
  `next build`, **sin condición** (desde el
  2026-08-04). Production migra `ep-ancient-frog`; Preview migra
  `ep-still-sound`; un `npm run build` local migra la base de tu `.env`
  (hoy también `ep-still-sound`). Lo que hace correcta a la política es
  que cada entorno tiene YA su propia base — no al revés. Si algún día
  Preview volviera a apuntar a producción, esta línea es una bomba: la
  condición se retiró PORQUE las cuatro filas de env vars existen.
- Si la migración falla, el build falla y el deploy queda bloqueado —
  jamás envolver ese paso en `|| true` (un deploy bloqueado con error
  claro es mejor que un entorno corriendo contra un schema sin migrar).
- **`DIRECT_DATABASE_URL` es ahora prerequisito en Preview, no solo en
  Production.** La lee `prisma.config.ts`, que cae a `DATABASE_URL` si
  falta — y esa es la POOLED: PgBouncer rompe los advisory locks de
  `migrate deploy`. Un Preview sin esa var no falla al configurarse, falla
  al migrar. Hoy existe (es una de las cuatro filas).
- **Tradeoff real: las migraciones de ramas en vuelo conviven en
  `development`.** Dos ramas abiertas con migraciones distintas las
  aplican las dos a la misma base, y una migración de una rama que nunca
  se mergea se queda ahí. Con UN dev el riesgo es bajo y el síntoma es
  local, no en producción. **La limpieza no es una tarea nueva: es el
  reset periódico de `development` desde `production` que ya existe** —
  ese reset devuelve dev al estado de migraciones de producción y con eso
  se lleva por delante las de ramas muertas. Ojo con el efecto conocido
  de ese reset: deja las filas de dev apuntando a blobs REALES de
  producción (ver la sección de storage y la guarda `isDeletable`).
  Una rama que siga viva simplemente re-aplica su migración en el
  siguiente preview deploy, porque `migrate deploy` corre en cada build.
- **Efecto secundario bueno: muere el P2022 crónico de las previews.**
  Antes, una preview cuya rama traía una migración nueva reventaba en
  runtime hasta que `main` la aplicara; ahora la aplica ella misma a
  `development` en su propio deploy. Ese era el costo aceptado de la
  condición y deja de pagarse.
- **La red gratis del 7.9.1:** el primer preview posterior a este cambio
  estrena el `migrate deploy` del CLI 7.9.1 contra `development` — es
  decir, contra una base desechable y ANTES de que producción lo corra.
  Esa cobertura no existía cuando se mergeó el upgrade (`2a0f1d4`), y es
  un argumento para no volver a condicionar el paso.
- **Preview YA NO comparte base con producción** — desde el 2026-08-02 el
  dashboard de Vercel tiene entradas SEPARADAS de `DATABASE_URL` y
  `DIRECT_DATABASE_URL` para Production (`ep-ancient-frog`) y para Preview
  (`ep-still-sound`). Preview y local escriben los dos en `development`,
  así que ni las previews ni las pruebas locales son ya escrituras en
  vivo; antes del 2026-08-02 ambas lo eran.

  **Esta sección afirmó lo contrario entre el 2026-08-02 y el 2026-08-04**
  ("preview hereda las env vars de producción", "preview escribe en
  producción"): el cambio se hizo en el dashboard de Vercel y la doc no se
  actualizó. Queda anotado porque el modo de falla es el de siempre acá —
  la doc, el nombre de la rama y la memoria NO son evidencia del rol de una
  base. Lo que cerró esto fue la evidencia primaria: las cuatro filas de env
  vars en Vercel.
- `vercel.json#buildCommand` ANULA el script `build` de package.json —
  incidente 2026-07-25: decía `prisma generate && next build` y el
  `migrate deploy` condicionado nunca corrió en Vercel. Debe quedarse en
  `"npm run build"` (o eliminarse): package.json es la única fuente del
  build; `prisma generate` ya corre en `postinstall`. Todo cambio al
  pipeline de build se verifica en los LOGS del deploy de Vercel, no
  solo en el repo.
- **Jamás `prisma migrate reset` contra Neon** — borra toda la base. Ni
  siquiera contra `development`: es una operación destructiva y cae bajo la
  regla de verificar el rol en la consola primero.
- Migraciones nuevas deben ser aditivas/compatibles con el código
  anterior (columnas nullable o con default, enums nuevos) mientras un
  deploy viejo conviva con el schema nuevo; si algún día hay que romper,
  usar expand → migrate → contract en deploys separados.
- La env var `DIRECT_DATABASE_URL` (conexión directa de Neon, sin
  `-pooler`) debe existir en los entornos de Vercel que migran (hoy:
  Production). La lee `prisma.config.ts` — que consume SOLO el CLI de
  Prisma; el runtime usa `DATABASE_URL` (pooled) vía lib/prisma.ts.
  Prisma 7 no tiene `directUrl` en el config: esta separación de env
  vars es el equivalente.

### LA VENTANA del `migrate deploy` — un DROP COLUMN no es atómico con el código

`npm run build` corre `migrate deploy` **antes** de `next build`, contra la base de
PRODUCCIÓN, **mientras el deploy VIEJO sigue sirviendo tráfico**. La migración toca
la base viva; el código nuevo NO está en línea hasta que el build termina y Vercel
hace el swap (~1–3 min después). Entre esos dos instantes:

- una migración **ADITIVA** (columna nullable/con default, enum nuevo) es
  inofensiva: el código viejo no la conoce y no la consulta;
- un **DROP COLUMN** (o un rename, o un `NOT NULL` nuevo) abre una **VENTANA** en la
  que el código VIEJO consulta una columna que **ya no existe** → Postgres devuelve
  42703 y ese endpoint da 500 durante TODO el build.

O sea: meter el DROP y el código-que-deja-de-leerla **en el mismo deploy NO es
atómico** — el código nuevo llega DESPUÉS del drop, no con él. Para una columna que
lee un path con tráfico (p. ej. `Product.agotado`, que el catálogo público leía en
cada request), esa ventana es una caída real, no teórica.

**LA REGLA, y hay que tenerla ANTES del go-live, no después:** un cambio de schema
que ROMPE (drop / rename / `NOT NULL` nuevo) va en **DOS deploys — code-first**:

1. **Deploy 1 (contraer el CÓDIGO):** quitar toda lectura/escritura de la columna.
   La columna SIGUE en la base, sin uso. Cuando este deploy está EN LÍNEA, ya ningún
   código la toca.
2. **Deploy 2 (contraer el SCHEMA):** la migración DROP + el campo fuera de
   `schema.prisma`. Segura, porque el código vivo (Deploy 1) ya no la referencia.

**La ÚNICA excepción es "sin tráfico":** un storefront pre-lanzamiento no tiene
requests que caigan en la ventana, así que ahí el drop y su código pueden ir en UN
commit/deploy sin costo — es lo que se hizo con `Customer.activo` y `Product.agotado`
el 2026-08-27, con la condición ESCRITA (en cada migración) de que era pre-lanzamiento.
En cuanto el storefront reciba tráfico real, la excepción CADUCA y vuelve la regla de
los dos deploys.

Es el refinamiento concreto de "expand → migrate → contract en deploys separados"
(arriba): el **porqué** es la ventana, y el **cuándo importa** es el tráfico.

## Design system del admin — chips de stat cards

Los icon chips de las stat cards del **DASHBOARD** son NEUTROS por defecto; el
color es ESTADO, no decoración, y aparece SOLO cuando el valor lo justifica. Esto
REEMPLAZA la variante pastel-multicolor (owner, 2026-07-27) para el dashboard: se
evaluó en producción y el color decorativo contradecía la regla del panel —color
= estado accionable, nunca decoración—. Un tile ámbar/verde/violeta sin relación
con su contenido entrena al operador a ignorar el color justo donde sí importa.

El mapeo lo gobierna `chipTono(widget, value)` (`constants/dashboard-widgets.ts`,
puro), NO un color hardcodeado por widget:

- **Neutro** (`STAT_CHIP.neutral`, `bg-muted`): todo tile sin estado, y todo tile
  de estado cuyo valor es 0 o cuya fuente cayó. Una alerta que vale 0 no es una
  alerta; una cola vacía no pide nada.
- **Ámbar** (`tono: 'atencion'`): colas de trabajo con valor > 0 — Por cobrar,
  Órdenes Pendientes.
- **Rojo** (`tono: 'alerta'`, `STAT_CHIP.alert`): riesgo real con valor > 0 —
  Alertas de Stock. Sigue siendo la única alerta roja del panel; el rojo escaso.

**La TENDENCIA no colorea el chip**: su color (verde alza / rojo baja) vive en el
`TrendPill` de `StatCard`. Duplicarlo en el chip volvería el rojo frecuente
(cualquier mes a la baja) y diluiría la alerta de stock.

El mapa `STAT_CHIP` (paleta pastel + `alert` + `neutral`) sigue en
`constants/stat-chip.ts`. **El pastel NO se borró**: lo consumen todavía las stat
cards de Clientes y CustomerProfile y los íconos de la campana
(`constants/automations.ts`). Migrar esas superficies a la regla de estado es un
PR aparte (deuda declarada) — hasta entonces conviven dashboard-por-estado y
esas-páginas-pastel a propósito. El resto de las reglas cromáticas (un sólido por
vista, hover de tinte, badges muted/neutros, trends de texto) no dependían de la
decisión de 2026-07-27 y siguen.

## El Dashboard "Hoy" — el rediseño, y sus decisiones de MODELO

Rediseño del 2026-08-23. La pantalla dejó de ser un grid de métricas surtidas y pasó a
responder **una pregunta —¿cómo va HOY?—** con dos cifras arriba (el dinero y los
pedidos), la curva del día, lo más vendido, y las tarjetas accionables. Lo que sigue son
las decisiones de MODELO, que es donde esta vertical tiene más que las otras.

### La BASE DE INGRESOS: una definición, cuatro superficies

`REVENUE_ORDER_SCOPE` (`@duna/core/metrics/prisma-scopes`) es `{ order: { numero_orden
startsWith 'CN-' } }` — **CN- a secas, CANCELADOS INCLUIDOS**. Antes excluía cancelados y
el Dashboard era la ÚNICA superficie que reportaba menos que el libro de Pagos: **$259k
contra los $315k** de Analítica y Clientes (`paidTotalByCustomer`, que ya los incluía).

La razón es doctrinal (§ El eje de COBRO): **cancelar NO toca el `Payment`**, así que la
plata entró. Un reembolso sería otro hecho, y hoy no se modela (backlog abajo). Con el
cambio, las **CUATRO** superficies dicen el mismo número: Dashboard, Analítica, Clientes y
—de facto, porque no hay pagos `SN-`— Pagos.

**CONSECUENCIA DECLARADA, porque llega por correo sin que nadie toque la pantalla:** el
scope lo comparten los **dos reportes de automatización** (`lib/automations/reportes.ts` —
resumen diario y reporte semanal), así que también empezaron a sumar los pagos sobre
cancelados: **+$56.000 en dev, sin que nadie tocara esa pantalla**. Es el MISMO principio,
no daño colateral; un scope local del Dashboard habría sido una cuarta definición de
"ingreso" el mismo día que se cerró la tercera. Afirmado en el carril
(`revenue-scope-canceladas.test.ts`, visto fallar con el scope viejo).

### Los DOS EJES: el dinero incluye cancelados, el conteo NO

La pantalla mide **dos conjuntos distintos**, y no comparten filtro a propósito:

- **DINERO** (el hero, y "lo más vendido hoy") → **INCLUYE** cancelados. La plata entró.
- **CONTEO de órdenes** (la curva y su encabezado "N pedidos hoy") → **EXCLUYE** cancelados
  (`NOT_CANCELLED`, = la tarjeta `pedidos_hoy`, así que la suma de la curva cuadra con el
  conteo y no hay card≠lista dentro de la propia pantalla).

La razón: **una orden cancelada es plata que entró pero NO un pedido que contar.** Son
ejes distintos, afirmados por separado en el carril (`dashboard-hoy.test.ts`, visto fallar
con los ejes invertidos: el conteo daría 3 en vez de 2, el top-hoy $50k en vez de $65k).

### La ASIMETRÍA recibir ≠ crear — por qué las dos frases no son simétricas

Hero: **"Pagos recibidos hoy."** · Curva: **"Pedidos creados hoy."** NO son simétricas, y
es correcto: son **dos hechos distintos**. El dinero se RECIBE (un pago llega, de un
pedido de cualquier día); un pedido se CREA (hoy, esté pagado o no). "Pedidos recibidos"
sería falso para el pedido que el admin teclea en "Nuevo pedido" —a ése nadie lo recibe—,
y el volumen manual **no se puede medir** (el origen es code-path, no columna; `canal`
mezcla admin con checkout directo), así que no se apuesta a "es bajo": se usa copy cierta
para todos. La asimetría de los verbos es la que dice la verdad. El hero en $0 va **sin
subtítulo** (no hay filtro que sospechar, a diferencia de Pagos).

### El BUG DE ZONA: `slice(0,10)` sobre un ISO UTC muerde en la tarde

`insightUltimoEvento` derivaba el día del último evento con `data.ultimoEvento.slice(0,10)`
—el día del ISO en **UTC**—. Para un evento entre **19:00 y 23:59 Bogotá** (= 00:00–04:59
UTC del día siguiente) eso da el día EQUIVOCADO, y como es horario de venta muerde seguido:
producía una contradicción VISIBLE —el conteo decía 0 y el insight "Última orden creada
hoy" sobre una orden que en Bogotá fue ayer—. Se deriva con `zonedDayKey(new Date(...),
BUSINESS_TZ)`, y el filtro horario de Pedidos usa `zonedHour` (el reloj que YA usaban las
automatizaciones) — la misma ancla que el `EXTRACT(HOUR … AT TIME ZONE)` de la curva.
Test de capa 1 con el borde 23:47 Bogotá, visto fallar.

**LOS SLICES BENIGNOS, para que nadie "arregle" los que estaban bien:** el censo del
patrón encontró tres que NO son el bug, y confundirlos rompe algo que anda —

- `cartera.ts:85` (`dayKeyMas`): `slice(0,10)` sobre un ISO, pero desplaza un **day-key**
  por aritmética de calendario anclada a UTC en AMBOS extremos (round-trip) — no deriva el
  día de un instante real. Correcto.
- los `slice(0,7)` (mes) del repo: todos sobre `zonedDayKey(...)` YA en Bogotá → correctos.
- `insights.test.ts`: formateo de test, no lógica.

El discriminador del bug real es **slice de un INSTANTE (Payment.fecha/Order.createdAt)**,
no de un day-key ya zonificado. Sólo `insights.ts` lo tenía.

### La CURVA: pedidos por HORA — línea en tinta, área en ámbar, NO dibuja el futuro

Mide **pedidos por hora**, no ingresos, y la razón es de dato: **`Order.createdAt` tiene
hora real; `Payment.fecha` NO** —los pagos que pasan por el campo "fecha en que entró el
pago" se anclan a 00:00 Bogotá, así que **no hay hora del dinero**—. Día sin pedidos:
**DECLARA, no dibuja** (`curvaDibuja`), y el estado vacío **reserva el mismo alto**
(`ALTO_CURVA`) que la curva para que declarar→dibujar no salte el layout.

**EL EJE EMPIEZA EN MEDIANOCHE Y TERMINA EN AHORA: `[0 .. HORA ACTUAL]`** (2026-08-24,
reemplaza al eje-jornada del mismo día). Origen FIJO en la hora 0; el borde derecho es
**AHORA** (nunca el futuro), y el marcador de ahora queda SIEMPRE ahí.

**El vacío de la DERECHA y el de la IZQUIERDA NO son la misma decisión invertida — son dos
cosas distintas.** El de la derecha (horas que aún no ocurrieron) SÍ sería mentira —dibujar
ceros de horas que no pasaron—, y por eso el borde derecho es AHORA y no dibuja ni reserva
el futuro. El de la izquierda (medianoche → primera actividad) es **DATO**: esas horas
pasaron y tuvieron cero pedidos, así que se muestran. "Hoy es lo que ha PASADO", y una hora
pasada sin pedidos tiene el dato "cero"; una hora futura no tiene dato.

- **Dos beneficios del origen fijo**, y son la razón de preferirlo al eje-jornada: la curva
  **SUBE desde la base** en vez de nacer en su pico contra el borde izquierdo, y el eje **no
  cambia de origen cada día**, así que se lee por HÁBITO (medianoche siempre a la izquierda).
- **EL SPAN MÍNIMO SE RETIRÓ** (`MIN_SPAN`, y con él `primeraActividad` del cálculo). Su
  razón —que un punto solo no quedara degenerado contra el borde— desaparece con el origen
  fijo: a las 8:30 con un pedido a las 8, el eje es `[0..8]`, la curva sube desde medianoche.
  `inicioEje` ya no depende de los datos: es 0 por definición (`ventanaCurvaHoy`, capa 1).
- **LO DESCARTADO, con su razón** (para no volver a proponerlo): **eje fijo 0–23** —el
  origen 0 es el mismo, pero el 0–23 dejaba media pantalla vacía a la DERECHA (el futuro);
  el eje actual `[0..ahora]` corta ahí—; **comprimir por la primera actividad** (el
  eje-jornada, su predecesor de un día) —hacía nacer la curva en su pico contra el borde y
  cambiaba el origen cada día—; **hora de apertura fija** —escondería la madrugada de un
  retail 24h bajo el borde izquierdo—.
- **La ETIQUETA del borde derecho = la HORA ACTUAL** ("10 a.m."): rotula dónde está el día.
  `ticksDeVentana(inicioEje, horaFin)` pone los dos bordes + interiores a paso 6/3/1 según
  el span, y **cae un interior a < 1.5 h del borde "ahora"** para que su etiqueta no se
  encime. Al hook se le pasa `n` = horas de la ventana; su índice `0..n-1` se mapea a hora
  con `inicioEje + i` — por eso NO se toca (§ compartido con Pagos).
- **A las 00:30** el eje es `[0 .. 0]`: un solo punto, `n=1`. `pathDe` (<2 puntos) no dibuja
  curva → queda **sólo el marcador de ahora**, y el `denom = max(1, n−1)` evita que el span
  cero rompa la escala. No es una declaración: "sin pedidos" sería falso habiendo datos.

**EL EJE AVANZA CON EL RELOJ sin re-renderizar la pantalla:** el estado `horaActual` vive
DENTRO de `CurvaPedidosHoy` con un `setInterval` alineado al borde de hora, así que al
cambiar la hora sólo se re-renderiza ESTA curva —no el Dashboard—, igual que el eyebrow con
su reloj de minuto. Sin esto, a las 11:05 el marcador seguiría diciendo "10 a.m." hasta
recargar. El pulso del marcador es CSS, sin estado.

**SIN TARJETA** (2026-08-24): la curva vive sobre el fondo de la página, como el hero (el
vistazo del día es cardless; las tiles, "lo más vendido" y "órdenes recientes" siguen en
cards). La separación con el hero es el espacio (`space-y-6`) + la cabecera "N pedidos hoy".

**COLOR — el discriminador es el SITIO** (§ EXCEPCIÓN DECLARADA: el ámbar es marca/dato o
estado según el sitio):
- **LÍNEA en TINTA a .5** (`--duna-ink`, `strokeOpacity 0.5`): es la MEDIDA ÚNICA, no una
  serie, así que nunca `--duna-serie-*`; atenuada para que los marcadores canten.
- **ÁREA en ÁMBAR**, gradiente `--duna-sol` 10%→0% (superficie de DATO = firma, no estado;
  el % se afina por tema en el gate). Antes era tinta al 5%.
- **Marcador de AHORA en SOL** (círculo r=6 + anillo r=11 que PULSA saliendo del punto —
  `.curva-ahora-pulso`, animación CSS sin estado React; estático con reduced-motion) en la
  hora actual — el sol marca AHORA, no posición; **PICO en TINTA** (r=3). Dos marcadores
  distintos cierran el riesgo de leer el sol como "el máximo".

`useCurvaHover` (hover/scrub/tap-fuera) es compartido con Pagos y NO se tocó; el hover se
GUARDA a las horas transcurridas (el futuro no tiene dato). Las reglas puras
(`bucketsPorHora`, `curvaDibuja`, `relojLabel`) en `lib/dashboard/hoy.ts`; las consultas
en `lib/dashboard/hoy-server.ts`, afirmadas en el carril; plegadas en el ÚNICO
`Promise.all` de `/api/dashboard/stats`.

### El CLIC POR HORA — y el × del tag, excepción declarada

La curva navega al hacer clic: **Pedidos ganó filtro horario** (`?hora=H`, client-side —
`getOrders()` ya trae todo, cero cambios de consulta; `filtrarPorHora` con `zonedHour`), así
que un clic en las 3 p.m. lleva al conjunto EXACTO (órdenes creadas en esa hora), no a un
superconjunto. **Cerró el ex-Backlog #40** —su disparador era justo "si Pedidos gana filtro
horario"—. El conteo del encabezado también navega (`?desde=hoy&hasta=hoy`, card=lista
medido).

**El tag de alcance horario ("a las 3 p.m.") lleva × PROPIO, la EXCEPCIÓN a la convención
"tags sin ×".** Esa convención existe porque cada alcance tiene su CONTROL local para
quitarlo (el rango con el date picker, etc.); el horario NO tiene control en Pedidos —llega
desde la curva—, así que sin su × la única salida sería "Ver todos", que también borra el
rango. Está escrito con su razón en el código para que nadie lo "unifique" quitándoselo.

### Lo RETIRADO — y qué se cerró

El marco del día no necesita lo multi-día ni lo duplicado, así que se retiró:

- **el carrusel** (Ventas/Pedidos, multi-día) y **la distribución** (pie anual) — sus
  preguntas ya las responde Analítica; con ellos, `getDashboardChart`, `/api/dashboard/chart`,
  `lib/metrics/distribuciones`, `DASHBOARD_COLORS`;
- **`--chart-*` ENTERO** (@theme + los dos temas): la curva nueva es tinta, así que la escala
  perdió su último consumidor y se retiró entera. (NO cerró un ítem de backlog: nunca lo fue —
  código sin uso, no una deuda numerada. La frase original decía "cerró el Backlog #8", un número
  equivocado: el #8 siempre fue `Customer.activo`, hoy ya dropeado.);
- **`components/ui/table.tsx`** (cero consumidores) y los **pastels muertos de STAT_CHIP**
  (`chipTono` sólo alcanza amber/neutral/alert);
- la tabla cruda de **Órdenes recientes → `.duna-lista`** — **cerró el Backlog #36** (el
  `w-full` que anulaba el `overflow-x` y superponía columnas en móvil).

Y **#16** (la campana): de `accent-amber` a los tres roles del sol; `--accent-amber` quedó
muerto y se retiró.

### `useCurvaHover` — un mecanismo, dos curvas

El hover/scrub/tap-fuera de las curvas de tinta vive en `components/admin/useCurvaHover.ts`,
compartido por PagosCurva y CurvaPedidosHoy. Duplicarlo habría sido un segundo mecanismo;
por eso PagosCurva se refactorizó para adoptarlo (su `onClick`-ACOTA se queda — el Dashboard
no lo lleva, la curva es lectura + navegación por hora, sin acotar en sitio). Pointer events
(mouse + dedo), `touch-action: pan-y`, descarte por `pointerdown`-fuera.

### Lo que ya está escrito, enlazado

- **La siembra para gate CADUCA al cruzar la medianoche de Bogotá** (§ GATE DE CAPA 3): una
  siembra de scope HOY sembrada ayer cae fuera de la ventana y el gate ve estados-vacíos que
  parecen bugs de la pantalla nueva.
- **El número a la derecha va en MEDIO, nunca al borde** (§ Listas tabulares): el `Total` de
  Órdenes recientes a 96px, sin reordenar el dinero al final.

## Equipo y usuarios, y Perfil — las dos últimas pantallas del panel

Tanda del 2026-08-23. Con esto **todas las verticales del admin están en lenguaje
Duna**; no queda una pantalla heredada del template.

### Configuración DEJA de ser un hub: la ruta hospeda el equipo

El hub de tarjetas de `/admin/configuracion` se retiró: cinco de sus seis secciones
eran "Próximamente" —la promesa vacía que el resto del rediseño quita—. La única
real, la gestión de equipo, **subió de `/configuracion/usuarios` a
`/admin/configuracion`** y la subruta vieja redirige (§ `lib/redirect-config`).

- **TÍTULO ≠ RUTA, y es la decisión.** El título de pestaña y el ítem del UserMenu
  dicen **"Equipo y usuarios"** (lo que la pantalla HACE); la RUTA se queda en
  `/admin/configuracion` (el UserMenu ya apuntaba ahí, y mover rutas cuesta
  redirects). Llamar "Configuración" a una pantalla que sólo muestra equipo sería la
  misma promesa vacía que las placeholders retiradas. El eyebrow SÍ dice
  "Configuración" —nombra el ÁREA, no la pantalla—.
- **El UserMenu cambió de label Y de ícono** (`Settings`→`Users`), por el mismo
  principio: un ítem "Configuración" abriendo un roster es la promesa vacía otra vez.
- **El redirect es el más simple de los seis** (path plano, sin traducción de query):
  `/configuracion/usuarios` nunca usó query params. Sigue teniendo módulo + test por
  la misma razón que los otros —el redirect es la deuda del retiro y se afirma como
  unidad—. La cadena de `proxy.ts` pasó a SEIS; `redirect-config.test.ts` corre la
  cadena completa. Censo por contenido al retirar: **cero enlaces vivos** a la ruta.
- **DISPARADOR — el hub VUELVE con el multi-tenant.** Cuando haya secciones reales
  que agrupar (negocio, facturación, integraciones), `/admin/configuracion` vuelve a
  ser hub y **el equipo baja a un sub-route con su nombre intacto** ("Equipo y
  usuarios" ya es el nombre, así que no hay nada que renombrar). El movimiento inverso
  del de esta tanda.

### El rol es CATEGORÍA — `RoleBadge` va NEUTRO

`RoleBadge` salió de la rampa pastel (violeta el Gerente, celeste el Empleado) a
`.duna-badge--neutral`. Un rol es una categoría, no un estado, así que lo distingue
la ETIQUETA (Dueño / Gerente / Empleado), no el tinte —el "color que identifica" en
un badge es justo lo que Amber Minimal prohíbe—. El componente es compartido (equipo,
perfil, modal de invitar); migrarlo los cubre a los tres.

### #1 cerrado — invitaciones pendientes visibles y cancelables

`GET /api/users/invite` (listar) y `DELETE /api/users/invite/[id]` (cancelar),
OWNER-only, con la sección "Invitaciones pendientes" en la pantalla de equipo.

- **Una pendiente es sin aceptar Y sin vencer** (`usedAt: null` + `expiresAt > ahora`)
  — la MISMA pareja que el POST usa para bloquear una dirección, así que lo que se
  lista es exactamente lo que se puede cancelar para desbloquearla.
- **Las VENCIDAS no se listan a propósito:** ya no bloquean (el POST las ignora), así
  que re-invitar simplemente funciona. Mostrarlas sería un estado sin acción detrás.
- **Cancelar sólo toca la SIN aceptar** (`deleteMany` con `usedAt: null` en el
  `where`, en una sentencia): si la persona aceptó entre el listado y el clic, el
  usuario existe y borrar esa fila perdería el registro de que se usó.
- **La consulta se extrajo a `lib/invitations.ts` para el carril** (no monta HTTP): el
  defecto de un filtro así vive en el `where`, no en el mapeo, y un test con mocks
  pasa en verde contra un filtro roto. `invitaciones-pendientes.test.ts` se vio fallar
  quitando `usedAt: null`. **No borrar.**
- **La sección vacía no gasta un bloque:** el caso normal es que no haya ninguna
  pendiente, así que sólo se renderiza para OWNER y con ≥1.

### Perfil — la cuenta, limpia, y la contraseña que SÍ existe

Se quitó lo que fingía: la contraseña "hace 30 días" (dato inventado) con su botón
"Cambiar" que abría un toast "próximamente", el botón de cámara sin `onClick`, el
banner de gradiente. La "Organización" pasó a salir de `siteConfig.brand` —una sola
fuente del tenant— y de paso corrigió un dato FALSO: decía "Bogotá, Colombia" cuando
Nayoli está en Supatá.

- **`authClient.changePassword` con `revokeOtherSessions: true`.** Better Auth lo trae
  de fábrica (`emailAndPassword` activo); es un formulario inline que llena el usuario.
  Cambiar la clave cierra las demás sesiones, la actual sobrevive.
- **El caso "invitado que nunca fijó contraseña" NO EXISTE**, y por eso `changePassword`
  aplica a toda cuenta: la aceptación de invitación EXIGE contraseña (`signUpEmail`) y
  no hay proveedores sociales (sólo `emailAndPassword`). Toda cuenta es de credencial.
- **Validación client antes de viajar** (mínimo 8 = el default de Better Auth, nueva ==
  confirmación, nueva != actual); el server MANDA sobre la contraseña ACTUAL, lo único
  que sólo él verifica. Su fallo se traduce a una frase en español —no el "Invalid
  password" de Better Auth— y el error inline se limpia al reintentar.

### `InviteUserModal` es un DunaSheet — y `ConfirmDeleteDialog` NO se tocó

El modal de invitar era un modal shadcn hand-rolled (overlay propio, `rounded-2xl`)
con un DEFECTO real: **no cerraba al clicar fuera**. Migró a **`DunaSheet`
`anclaje="lado"`** —la primitiva que ya montan los otros cinco formularios del panel
(Ajustar stock, Programar entrega, Nuevo pedido, Producto, Cliente)—, que trae de
Radix el click-fuera, Escape, foco atrapado y scroll-lock.

- **NO a `DunaDialog`, a `DunaSheet`.** La nota vieja decía "migra a `DunaDialog`", y
  estaba mal: `DunaDialog` es la superficie CENTRADA, y su único caso es la
  CONFIRMACIÓN (se monta sobre `AlertDialog`, § H6). Un formulario no es una
  confirmación; su primitiva es el drawer lateral, como los otros cuatro form-sheets.
- **La guarda de descarte VIENE con la migración, no es un extra.** Al ganar el
  click-fuera, un formulario a medias podía perderse en silencio; `useDescarteDeDrawer`
  lo convierte en "¿descartar?" — la misma conducta que los otros form-sheets. Sin
  ella, la migración habría ABIERTO un camino de pérdida de datos que antes no existía.
- **`ConfirmDeleteDialog` de esa pantalla NO se migró, y es una decisión.** Es
  COMPARTIDO —Pedidos, Productos, Clientes, Inventario (`AdjustStockModal`) y el
  descarte lo montan—, así que migrarlo arrastraría media app a un gate visual que no
  es el de esta tanda. Sólo el de invitar era hand-rolled y con defecto propio; el
  confirm shadcn es coherente y vive en su propio disparador (§ H6). **Migrar una
  primitiva compartida por su consumidor menos importante es cómo se arrastra una
  vertical a una tanda ajena.**

## Dashboard personalizable — registry de widgets

Los indicadores del dashboard (su FORMA es editorial, ver abajo) son un CATÁLOGO
(`constants/dashboard-widgets.ts`, `key` estable snake_case) con selección ordenada
persistida por usuario (`DashboardPreference.widgets` = array de keys; API
`/api/dashboard/prefs`). Toda entrada/salida pasa por `sanitizeWidgetKeys` (solo keys
reales del registry, sin duplicados, orden preservado) → una key retirada o un payload
malicioso nunca llega al grid. El binding key→dato vive en el dashboard (junto a los
datos); el registry es presentación pura + deep-links que reusan los helpers compartidos
(card=lista). SOLO los indicadores son personalizables: los gráficos y Órdenes Recientes
son fijos, fuera del sistema (v1).

- **Costura MULTITENANT (documentada, NO construida):** hoy no hay modelo de
  tienda/tenant. Cuando exista: (a) cada `WidgetDef` gana un filtro por vertical
  de negocio (el catálogo se scopea por vertical), (b) `DashboardPreference` gana
  la clave de tienda y su índice único pasa a compuesto (`userId + storeId`), y
  (c) `defaultVisible` se reemplaza por un set de default POR VERTICAL. La forma
  (registry + preferencia ordenada) ya es genérica del template "Comercio
  Digital"; el contenido (los widgets concretos) es de esta vertical.
- `DashboardPreference.userId` referencia `user.id` (Better Auth) pero SIN
  relación Prisma a propósito — una relación exigiría un campo inverso en el
  modelo `user` de Better Auth, que no se toca. Índice único; la app scopea por
  sesión.
- TODO (no implementado): el endpoint de stats calcula TODAS las métricas aunque
  el usuario muestre pocas tarjetas. Optimizar a cálculo selectivo por las keys
  visibles queda anotado, no hecho.

### La FORMA de los indicadores es EDITORIAL — columnas con filete, pleca = estado

Rediseño del 2026-08-24. Los indicadores de "Hoy" dejaron de ser CAJAS (`.stat-card`) y
pasaron a la forma editorial: columnas separadas por filetes verticales, con filete
arriba y abajo del bloque; cada una cifra grande (display 1.7rem, tracking -.02em) ·
pleca · etiqueta · contexto muted. Sin ícono, sin chip. Cada indicador NAVEGA a su
pantalla; cero acciones. `components/admin/Indicador.tsx` reusa `resolveStatLine` para el
contexto (insight y sub siguen compitiendo por un solo renglón, como en la stat card).

- **La PLECA bajo la cifra ES el estado** (§ Amber Minimal: color = estado): ámbar si algo
  pendiente (`tono: 'atencion'` con valor > 0), rojo si un problema (`'alerta'`), y NADA
  —sin pleca, sin color— si el indicador sólo informa. La pleca SIEMPRE se renderiza
  (transparente cuando no hay estado) para reservar su alto: así una columna con estado y
  una sin estado alinean su etiqueta a la misma línea. `estadoTile(w, value)` (puro, capa
  1) devuelve el estado; es la lógica de `chipTono` sin el mapeo a clase de chip.
- **El ícono y su chip pastel SE RETIRARON**: la pleca hace ese trabajo, y el chip era el
  color decorativo que Amber Minimal viene quitando. `icono` y `color` (`STAT_CHIP.neutral`)
  del registry SE QUEDAN —los pinta el CUSTOMIZER, que no tiene datos en vivo—; sólo el chip
  del GRID desapareció. El customizer quedó intacto.
- **Admin-level, no primitiva del paquete**: `.admin-indicadores`/`.admin-indicador`
  (`duna.css`, prefijo `admin-`, un solo consumidor). Reemplaza a `.stat-card`.

**EL REFLUJO: columnas FIJAS por breakpoint, NO auto-fit — decisión, no re-litigar.** V3
respira con 4-6 y el catálogo tiene 13. Hoy el default son 4 y nadie ha personalizado, así
que limitar por adelantado sería decidir contra un uso que no existe: se ACEPTA que con más
envuelva a varias filas y pierda la calma editorial. Conteo FIJO (4 ≥960 / 2 600-959 / 1
<600) + `nth-child` para los filetes: con `auto-fit` (columnas variables) los filetes no se
pueden targetear por fila —no hay selector "primera de la fila visual"— y la primera de cada
fila envuelta queda con un filete izquierdo suelto, sin corte entre filas. Todas las reglas
de borde usan `nth-child` (misma especificidad) para que el reset por tier lo resuelva el
orden de fuente. **DISPARADOR:** si alguien elige 9+ y la pantalla se vuelve ilegible, ahí se
decide (limitar el customizer, o una segunda forma para listas largas). No antes.

**MÓVIL a 1 columna bajo 600, cifra a 1.7rem SIN reducir.** A 2 columnas un monto de 8 dígitos
("$ 1.284.500" ≈ 166px contra ~135px de columna) se corta incluso reducido, y un dato
recortado es peor que una lista más larga. El breakpoint es el nuestro (960 para 4→2, 600
para 2→1), no el 700 de la maqueta. El skeleton reusa las MISMAS clases → reserva el alto real
por construcción y la pantalla no salta al cargar (como el de Pagos).

**EL TRENDPILL SE RETIRÓ** (con `StatCard`, `computeTrend`, `lib/metrics/trend.ts`). El ±%
mes-contra-mes es una COMPARATIVA que el sistema no calcula en general, y la forma editorial no
le da slot; arrastraba un chip que ocupa espacio para decir que no hay dato ("sin comparativa").
Vivía en 4 widgets opt-in, ninguno por defecto. Consecuencia: `ingresos_mes` y `ordenes_mes`
conservan la tendencia en su INSIGHT (que ya narra el hecho); `promedio_por_orden` y
`clientes_recurrentes` pierden el MoM%. Vuelve por su propia razón si se pide.

**EL CENSO DEL RETIRO, y su lección.** Sin consumidor tras la migración, verificado por GREP:
`.stat-card`, `StatCard.tsx` entero (componente + `statCardLink` + `STAT_CARD_*` + `TrendPill`),
`STAT_CHIP.amber`/`.alert`, `chipTono` y `lib/metrics/trend.ts`. La lección: el comentario de
`StatCard.tsx` afirmaba TRES consumidores (`statCardLink` en Clientes, Inventario, Entregas) y
el grep dio CERO. **El censo se hace por CONTENIDO, no por comentario** — un comentario no es
evidencia de lo que se consume. Sobrevive `resolveStatLine` (su consumidor se mudó a
`Indicador`), `STAT_CHIP.neutral`, e `icono`/`color` (customizer). `.card-hover` (globals.css)
también quedó sin consumidores y se DEJÓ, anotado — fuera del alcance de este retiro.

## Matching de clientes (teléfono no es único)

`Customer.telefono` NO tiene unique constraint — un teléfono puede ser compartido
por varias personas (decisión de producto; el duplicado consciente es legal). Por
eso el matching por teléfono puede devolver VARIOS. La ambigüedad se resuelve con
una regla DETERMINISTA, compartida por el endpoint de lookup (orden del banner) y
el auto-adjunte silencioso del server cuando NO llega decisión explícita (checkout
del storefront o clients viejos): **más órdenes primero; empate → actividad más
reciente (última orden, luego `updatedAt`)**. Vive en `rankPhoneMatches`
(`lib/orders.ts`). Arbitrario-pero-documentado > `findFirst` accidental.

La creación de órdenes (`createOrderWithCustomer`, path único) acepta la decisión
EXPLÍCITA del admin: `cliente_id` (adjunta a ese cliente, sin matching) o
`forzarClienteNuevo` (crea nuevo pese al match) — mutuamente excluyentes (zod 400).
Sin decisión, aplica la regla determinista. El teléfono se normaliza siempre en
todo write+lookup (`normalizeCustomerPhone` en `lib/whatsapp-link.ts`). NO fusionar
duplicados automáticamente — el merge es decisión humana (feature futura); las
órdenes ya apuntan por `cliente_id`.

## "Por cobrar" vs "Órdenes Pendientes" (dos tarjetas, un conjunto)

Se ven contradictorias ("Por cobrar $0" junto a "Órdenes Pendientes 20") y NO lo
son: son un conjunto y su recorte.

- `pendiente` = todas las órdenes sin pago registrado, **sin ventana temporal**.
- **Por cobrar** ⊂ pendiente: además CONTRAENTREGA y ya despachada
  (`en_ruta`/`entregado`) — la plata que el mensajero anda cobrando.
  `POR_COBRAR_WHERE` / `isPorCobrar`, misma definición en card y lista.
- **Órdenes Pendientes** = `pendiente` MENOS por-cobrar. Por construcción,
  `pendingOrders + porCobrar` = todo `pendiente`.
- Por tanto "$0 por cobrar" con 20 pendientes solo dice que ninguna pendiente es
  contraentrega despachada — con órdenes ANTICIPADO es el estado NORMAL, no un
  bug. (Verificado 2026-07-29 en dev: las 20 eran ANTICIPADO.)

Ninguna de las dos tiene scope de "hoy", aunque "Por cobrar" viva en la fila
*Hoy* del panel. Se les puso el sufijo "(acumulado)" y se les QUITÓ (owner,
2026-07-29): son métricas de **estado actual** — un saldo vigente y un conteo
vigente — y un saldo no lleva declaración de período; la etiqueta sugería una
ventana temporal inexistente. Lo que sostiene la coherencia del par es el
**cross-reference** del sub en vivo de Pendientes ("· N por cobrar aparte"), que
dice que ese recorte está descontado. Si alguna vez a una de las dos se le mete
ventana temporal de verdad, ahí sí corresponde declararla — el mecanismo existe y
está testeado (`WidgetDef.scopeSuffix` + `resolveStatLine`, hoy sin consumidores
a propósito). No re-agregar "(acumulado)" leyendo una versión vieja de este doc.

**La deuda de `SN-` se CERRÓ** (2026-08-13, tanda del rango). Decía "el fix es de
los dos lados a la vez, o de ninguno", y así fue: la lista de pedidos dejó de
mostrarlas (`soloOrdenesReales` — son fixtures del seed, no pedidos) y con eso la
cartera pudo excluirlas también, porque su inclusión existía SÓLO para no
contradecir a la lista. Se anota el cierre y no se borra la entrada porque el
criterio sigue vigente para el próximo conteo que se desalinee: **card=lista se
arregla de los dos lados**.

**Y "Órdenes Pendientes" ya no existe como tarjeta**: cambió de pregunta a
"Necesitan atención" al retirarse el eje de cobro como carril. El par que esta
sección describe —un conjunto y su recorte— pasó a ser superconjunto/subconjunto,
y el sub de la tarjeta lo dice ("Incluye N por cobrar").

## Capa de insights de las stat cards (hechos, no consejos)

`WidgetDef.insight` es opcional y opt-in: la mayoría de tarjetas no lo declara y
se ve igual que siempre. Las reglas viven en `lib/metrics/insights.ts` — puras,
deterministas y con tests (`npm test`). Restricciones que son del diseño, no del
estilo:

- **Solo meses CERRADOS.** El mes en curso está incompleto; compararlo como si
  estuviera cerrado diría "a la baja" todos los días 1.
- **Guarda de muestra** `MIN_ORDENES_INSIGHT` (15, placeholder TODO(cliente)): por
  debajo de ese volumen un % es ruido, y un insight ruidoso entrena al operador a
  ignorar la línea entera.
- **Texto = hecho** ("3 meses consecutivos a la baja"), nunca instrucción ni causa
  inventada. Muted, sin icono ni color — el rojo es de Alertas de Stock.
- La serie mensual del insight usa la MISMA definición que el valor de su
  tarjeta. Un insight calculado sobre otro conjunto que el número que acompaña es
  peor que no tener insight.

## La orden se opera desde la orden — columna compuesta y centro de mando

Dos problemas de superficie sobre un modelo que NO cambió (Order / Payment /
Shipping separados sigue siendo correcto y quedó revalidado por diseño).

### La columna "Entrega" COMPONE, y por eso es pura

`Shipping.estado` crudo no distingue una orden programada con fecha y mensajero
de una que nadie tocó: las dos dicen "Preparando". **El dato para separarlas ya
existía** —`hasScheduleData` / `isScheduledShipping`, los predicados que gatean
el despacho en el board— y la columna simplemente no lo consumía.

`estadoEntrega` (`lib/entrega-estado.ts`, capa 1) los **consume, jamás los
redefine**. Es la regla dura de esta tanda: `isScheduledShipping` es EL gate de
despacho (cliente y servidor) y una segunda opinión sobre qué es "lista para
despacho" haría que la lista y el botón discreparan.

Vive en `lib/` y no dentro del componente porque **el vocabulario ES la decisión
de producto**: un `if` cambiado dentro del JSX rompería la respuesta a "¿dónde va
este pedido?" sin que nada lo notara. Mismo criterio que `lib/metrics/titulares.ts`.

| caso | etiqueta | tono |
| --- | --- | --- |
| orden cancelada · entrega anulada | *(celda vacía)* | — |
| sin registro de envío · envío creado y vacío | Sin programar | neutro |
| preparando con fecha, sin mensajero | Programada · 14 may 2026 | ámbar |
| preparando con mensajero, sin fecha | Falta fecha | ámbar |
| mensajero + fecha (`isScheduledShipping`) | Lista para despacho · 14 may 2026 | azul |
| `en_ruta` | En ruta | azul |
| `entregado` | Entregada · *(fecha REAL de entrega)* | verde |
| `fallido` | Fallida | rojo |

- **Los dos "Sin programar" comparten etiqueta A PROPÓSITO** (decisión del owner):
  desde la lista, "no existe el Shipping" y "existe y está vacío" son la misma
  respuesta —nadie la programó— y la columna Acciones ya distingue ("Preparar
  envío" vs "Programar entrega"). El matiz **existe para diagnóstico y vive en el
  `title`** del badge, no en el vocabulario. Etiquetarlo sería gastar una palabra
  en una distinción que no cambia ninguna decisión desde esa pantalla.
- **Las dos mitades parciales NO son intercambiables.** Con fecha ya hay un
  compromiso con el cliente y se imprime; sin fecha no hay nada que prometerle, y
  rotularla "Programada" sin fecha que mostrar sería una etiqueta que miente.
- **"Sin programar" va NEUTRO y no ámbar.** Es el estado normal de toda orden
  recién creada: pintarlo de ámbar teñiría la lista entera, que es exactamente lo
  que Amber Minimal prohíbe. El ámbar queda para las dos programaciones a medias,
  que sí son una brecha.
- **El semáforo sigue viviendo SOLO en `StatusBadge`.** La etiqueta compuesta no
  es un valor del enum, así que el badge ganó `tone` + `label` (y `title`) en vez
  de un mapa de colores propio en la vista. Un segundo mapa es cómo dos pantallas
  terminan pintando el mismo hecho de distinto color.
- **Un estado desconocido CALLA** (celda vacía) en vez de caer en "Sin programar":
  mandar a programar algo que quizá ya salió es peor que no decir nada.
- **Badge secundario: sólo "Por cobrar"**, nunca "Contraentrega" a secas — se
  etiqueta la EXCEPCIÓN (contraentrega despachada sin cobro, la plata en la
  calle), no el default. Es la misma regla que ya mantenía la lista de Órdenes sin
  la píldora de condición de pago, y por eso esa decisión NO se reabrió.
- **Y va SÓLO en la lista, no en el detalle** (owner, 2026-08-06). En la sección
  Pago del detalle el mismo hecho ya está dicho dos veces —"Saldo pendiente" con
  su monto, y "Contraentrega" en la línea de abajo—; el chip era una tercera. En
  una fila de la lista no hay ninguna de las dos, y "despachada sin cobrar" no se
  deduce de las columnas. **Etiquetar la excepción es útil donde no hay contexto;
  donde lo hay, es ruido** — que es la misma regla de Amber Minimal leída al
  derecho, no una inconsistencia entre las dos vistas.
- **El board de Entregas no cambió de badges**: sigue siendo la vista de flota
  (una fila por envío, con su checklist muted). Esta columna es la vista de orden.

### El modal de programar recibe el ID DE LA ORDEN, no lo deduce

Bug encontrado en el gate del centro de mando (2026-08-06): "Editar entrega"
desde el detalle fallaba con "No se pudieron cargar los datos de la orden",
mientras el detalle de atrás mostraba mensajero, zona y fecha — o sea que el
Shipping SÍ tenía datos de programación.

`ScheduleBody` pedía su contexto con `shipping.orden_id`. Ese campo es sólido en
el board (su fuente es `/api/shippings`, donde el Shipping es la fila RAÍZ), pero
en el detalle el Shipping viaja **anidado dentro de la orden** y lo reemplazan
tres respuestas distintas —el PATCH de entregas, el POST de pago, el PATCH de
orden—. Basta que una lo entregue recortado para que la URL quede
`/api/orders/undefined/delivery-context` y su 404 se traduzca a un fallo de carga
genérico.

**Es el riesgo de "modal que asume el contexto de su página" en su forma menos
visible: no falta una prop, falta un CAMPO DENTRO de una prop** — y por eso el
compilador no ayuda y la revisión tampoco.

- **`ScheduleTarget` gana `ordenId` opcional**, con `shipping.orden_id` como
  default. Quien monta el modal desde una ORDEN pasa el id que ya tiene en mano
  (`order.id`); el board sigue sin pasar nada y no cambió una línea. Se adaptó el
  modal, no se duplicó — la regla de la tanda.
- **El motivo del fallo se propaga.** `getDeliveryContext` usaba un
  `throw new Error` genérico y el modal pintaba un texto fijo: "no autorizado",
  "orden no encontrada" y "el payload no traía el id" se veían idénticos, y esa
  indistinción es lo que volvió caro el diagnóstico. Ahora va por
  `razonDelServidor`, igual que el resto de las mutaciones.
- **El caso sin id se DERIVA, no se setea en el efecto** (`useState(!!ordenId)` +
  una rama de render): un `setState` síncrono dentro del efecto dispara renders
  en cascada y el lint lo marca — mismo criterio que el `loading` derivado de
  Analítica.

### El chip dice el ESTADO; la columna dice el CUÁNDO

Ajuste del mismo día. El chip de Entrega llevaba la fecha pegada
("Lista para despacho · 14 may 2026") y la columna Fecha mostraba la CREACIÓN.

- **La fecha sale del chip.** Colgada de la etiqueta hacía que cada fila creciera
  distinto y obligaba a leer una frase entera para encontrar un dato que se
  escanea en vertical. El tooltip del chip conserva lo que ya tenía.
- **La columna pasa a llamarse "Programada"** y muestra la fecha de la ENTREGA:
  la programada, o la REAL si ya se entregó. Cuál va no es un detalle — una
  entrega hecha se mide por cuándo llegó, y mostrar la prometida diría la fecha
  equivocada justo en la fila que alguien va a citar. Mismo criterio que la
  columna del board. Vive en `fechaEntrega` (capa 1).
- **La fecha de creación queda sólo en el detalle.** No mueve ninguna decisión
  del día. **Ojo con el efecto lateral:** el filtro de rango del encabezado sigue
  filtrando por FECHA DE CREACIÓN, que ahora es una columna invisible — un rango
  aplicado puede recortar la lista por un dato que ya no está a la vista.

### La FILA ofrece el siguiente paso, no un menú

Ajuste posterior al gate del centro de mando (owner, 2026-08-06). Con el detalle
operando la orden completa, la fila dejó de necesitar un repertorio.

- **Orden de columnas: Orden · Cliente · Canal · Total · Estado · Entrega ·
  Fecha · Acciones.** Los DOS ciclos de la orden —pago y entrega— quedan
  adyacentes y se leen sin cruzar la tabla; Acciones cierra la fila, que es donde
  la mano la busca. Antes Entrega estaba al final, después de Acciones: el dato
  más nuevo en el sitio donde nadie mira.
- **"Editar entrega" MURIÓ.** En su lugar la TRANSICIÓN única que el estado
  permite: "Programar entrega" / "Marcar En Ruta" / "Marcar Entregado". Es la
  TERCERA montura de `useTransicionEntrega` (board, detalle, fila) — y la razón
  de que extraerlo fuera correcto se ve acá: una tercera copia inline de la
  transición que mueve stock habría sido insostenible.
- **Cuál acción va en cada estado lo decide `accionFilaEntrega`**
  (`lib/entrega-estado.ts`, capa 1), no un `if` en el JSX. Consume el MISMO
  `isScheduledShipping`: si la fila decidiera por su cuenta cuándo se puede
  despachar, prometería una transición que el servidor devuelve en 400.
- **Reprogramar NO está en la fila, y es deliberado.** Una entrega fallida se
  reprograma después de ver POR QUÉ falló, y eso está en el detalle. La fila es
  el carril rápido del caso normal; los casos raros tienen su sitio.
- **El "Marcar En Ruta" bloqueado se MUESTRA deshabilitado diciendo qué falta**
  (`missingToDispatch`), no se esconde — una acción ausente manda al operador a
  buscarla a otra pantalla. Lo que falta se completa en el detalle.
- **Guarda D+R en el botón nuevo**, con texto intermedio propio por verbo
  ("Despachando…", "Marcando…"): el `disabled` sale del estado del hook y el ref
  síncrono de `useAccionesPorFila` corta el segundo click del mismo tick. Sin el
  texto el botón se queda mudo mientras viaja, que es la mitad que hace que el
  operador vuelva a clickear.
- **"Ver detalle" terciario al final de Acciones.** La fila entera ya abría el
  detalle y el número se lee como link, pero **ninguna de las dos cosas se
  anuncia**. La redundancia ES la señal: un operador que no descubre el detalle
  no usa nada de lo que vive adentro, y ahí vive ahora la operación completa.

### El detalle de la orden es el CENTRO DE MANDO

Tenía estado y notas; programar, despachar, entregar y reprogramar vivían sólo en
Entregas, y el pago sólo como botón de fila. Ahora el ciclo completo —crear →
programar → despachar → entregar (o reprogramar) → cobrar— se opera desde el
diálogo de UNA orden.

- **No se reimplementó una sola mutación.** `ScheduleDeliveryModal` y
  `RegisterPaymentModal` ya eran agnósticos de página (el primero se hizo así al
  compartirlo entre Órdenes y Entregas) y se montan desde el detalle tal cual. El
  detalle queda ABIERTO debajo y se refresca solo, porque la orden abierta se
  deriva de la lista por `numero_orden`.
- **Las transiciones se extrajeron a `hooks/useTransicionEntrega.ts`** (despachar
  / entregado / fallido + la confirmación de despacho sin pago, hoy
  `components/admin/ConfirmDespachoSinPago.tsx`) **y el board de Entregas las
  consume desde ahí.** Vivían inline en esa página; dejar una copia en el detalle
  era repetir el modo de falla de `razonDelServidor` y `cruzoMinimo` —dos
  definiciones del mismo helper es cómo vuelven a divergir— con el agravante de
  que acá lo que divergiría es una transición de estado con movimiento de stock.
  El board quedó idéntico en aspecto y conducta: **sólo cambió de dónde sale su
  lógica**, y por eso su regresión entra al mismo checklist que lo nuevo.
- **`ordenPagada` lo aporta quien llama, no lo deriva el hook.** El board lo lee
  del `order` anidado del Shipping; el detalle, de la orden que ya tiene en mano
  —y el payload de `/api/orders` trae el Shipping SIN ese anidado. Derivarlo
  dentro del hook habría hecho que toda orden pagada abriera el diálogo de
  "despachar sin pago" desde el detalle: la confirmación equivocada, en el sitio
  donde el operador la va a aceptar sin leerla.
- **El hook toma `onError`.** En una PÁGINA el error va por toast; dentro de un
  diálogo va INLINE, donde está mirando el operador. Es la misma división de
  vehículos de siempre, ahora parametrizada en vez de duplicada.
- **El `estado` del Select ya no es una copia congelada de la orden.** Antes era
  `useState(order.estado)` y funcionaba porque el detalle se CERRABA al registrar
  un pago. Ahora no se cierra: con la copia vieja, "Guardar Cambios" después de
  cobrar reenviaría `pendiente` y **revertiría el pago**. Se resolvió con
  `estadoElegido ?? order.estado` — la orden manda salvo que el operador haya
  elegido otra cosa. Es el bug que introduce dejar un modal abierto, y no existía
  antes de esta tanda.
- **Las acciones que no aplican NO están, no se deshabilitan** — un botón muerto
  es una pregunta. La única excepción es "Marcar En Ruta" con la programación a
  medias: ahí se deshabilita DICIENDO qué falta (`missingToDispatch`), porque
  esconderla mandaría al operador a buscarla en otra pantalla. Mismo criterio y
  mismo texto que el board.
- **Densidad**: arriba las dos respuestas (entrega y pago) con sus acciones;
  contacto, dirección, productos y la edición manual de estado/notas viven en
  pliegues. El `Pliegue` salió de Analítica a `components/admin/Pliegue.tsx` — el
  mismo widget escrito dos veces se separa en cuanto uno de los dos se ajusta.
- **Se retiró el timeline de dos puntos** (pendiente → pagado): la sección Pago
  dice el mismo hecho Y ofrece la acción. Dos representaciones del mismo dato es
  justo la redundancia que este pase vino a quitar.
- **Sin subpágina.** El diálogo ya es `max-h-[85vh]` con scroll y los dos flujos
  que faltaban son modales que se apilan encima.
- **Ni un gate del servidor se relajó.** El detalle es otra puerta a los MISMOS
  endpoints: `POST /api/shippings` sigue rechazando la orden cancelada, y el
  `PATCH` sigue exigiendo mensajero + fecha y el `confirmarSinPago` explícito. Lo
  que el cliente decide es qué botón ofrecer, no qué se permite.

## El retiro de Clientes — la última convivencia, y lo que destapó

Retiro del 2026-08-14, mismo método que el de `/admin/ordenes`: migrar lo vivo →
redirect → renombrar → borrar → limpiar huérfanos, con el redirect en el MISMO
deploy que el borrado, nunca después. Con esto el panel queda **sin una sola
convivencia viejo↔nuevo** y el menú vuelve a una entrada por sección.

### La población congelada estaba en el NAVEGADOR, no en la base

Es la diferencia con el retiro anterior y conviene tenerla escrita, porque el
método se copia y la razón no es la misma.

`/admin/ordenes` necesitaba su redirect por `Notification.href` — enlaces
congelados en una columna. Acá esa población es **cero y no puede crecer**:
medido (8 notificaciones, ninguna de cliente) y `AUTOMATION_HREF` no tiene entrada
de cliente, así que ninguna puede escribirse.

La que sí existe: **el ⌘K persiste sus recientes en `localStorage`
(`admin:cmdk-recents`) y ahí el `href` es a la vez el dato guardado y la clave de
dedupe.** Un cliente elegido antes del retiro queda como `/admin/clientes/<id>` en
la máquina de ese operador — sin backfill posible, porque no es nuestra base.

Es la misma población que el retiro anterior cubrió **sin nombrarla**. Queda
nombrada para que el próximo no la redescubra: **toda pantalla alcanzable por ⌘K
tiene enlaces congelados en los navegadores de quienes la usaron.**

### El formulario duplicado se resolvió por SUSTRACCIÓN

Había dos implementaciones inline de alta/edición —una por pantalla vieja— y ya
habían divergido: el mismo campo etiquetado **"Canal"** en la lista y **"Origen"**
en el perfil. La extracción llevaba tandas pendiente porque tocaba dos pantallas
en producción.

No hizo falta: `CustomerFormModal` ya existía y la pantalla nueva ya lo usaba, con
la etiqueta única declarada. Las dos implementaciones murieron con sus pantallas.
**Cuando una duplicación vive sólo en código que se va a retirar, el retiro ES el
arreglo** — y esperar a que lo sea es más barato que migrar dos pantallas vivas.

### El perfil deja de ser una ruta, y lo que eso cuesta está MEDIDO

La vieja tenía `/admin/clientes/<id>`; la nueva usa el panel del split
(`?cliente=`), que en angosto sube como sheet. Se verificó qué se pierde en vez de
suponerlo:

- **compartir el enlace**: igual — `?cliente=` sobrevive a un refresh;
- **abrir en pestaña nueva**: no se pierde porque no existía. La fila vieja era un
  `<div onClick={router.push}>`, que nunca admitió clic del medio;
- **título de pestaña**: tampoco se pierde. `/admin/clientes/<id>` no tenía layout
  propio, así que heredaba "Clientes" — nunca dijo el nombre del cliente.

### Y el hallazgo que no venía en el plan: el historial cruzaba clientes

Al verificar que el número que se borraba (`comprasPagadas`) fuera el MISMO que el
que queda —y no uno parecido— apareció que no lo era. La causa no era el borde que
se buscaba (órdenes sin `cliente_id`: hay **cero**), sino el `OR` por snapshot de
teléfono: `Customer.telefono` **no es único a propósito**, así que dos clientes que
comparten número se prestaban pedidos y plata. Medido: 2 de 13 en `development`.

Y el panel nuevo ya lo mostraba: su cifra "Pedidos" cuenta por FK y su historial
listaba de más, así que decía "1 pedido" con dos filas debajo. **Dos números del
mismo hecho que no cuadran no enseñan a desconfiar del que está mal: enseñan a
desconfiar de los dos.**

La regla vive ahora en `lib/clientes/detalle.ts` (`pedidosDelCliente`) con su test
de carril, que **se vio fallar con el `OR` restaurado** — 2 de 5. **No borrar
`tests/integracion/historial-cliente.test.ts`**: es lo único que impide que el
conjunto se vuelva a ensanchar.

Dato que salió del propio test y que conviene retener: **`Customer.email` SÍ es
`@unique`**, así que de las dos ramas de snapshot sólo la del teléfono podía
cruzar. Se quitaron las dos igual —la FK es la respuesta—, pero el defecto vivía
entero en una.

**La lección de método, que es la que se repite:** *verificar que el número que se
borra es el mismo que el que queda* no fue burocracia. Fue lo que destapó un
defecto de datos que llevaba vivo desde antes del rediseño.

## El retiro de `/admin/ordenes` — y el vocabulario que NO se unificó

La pantalla vieja de pedidos se retiró el 2026-08-14, primera vez que el rediseño
BORRA algo en producción en vez de agregar al lado. Lo que hay que retener no es
el borrado sino el orden, porque el modo de falla de un retiro no es "algo se ve
mal": es **un enlace que funcionaba llevando a un 404**.

**Tres pasos, y el orden es la decisión.** Primero migrar todo lo que apunta a la
ruta; después el redirect; recién entonces borrar. El redirect entra ANTES o EN EL
MISMO deploy que el borrado, jamás después — el instante en que la ruta muere es
exactamente el instante en que lo necesita.

### Los enlaces congelados son otra población, y necesitan otro mecanismo

`Notification.href` es una columna `String` que se escribe al crear la fila y no
se vuelve a tocar. Medido en `development` el día del retiro: **8 notificaciones,
4 apuntando a `/admin/ordenes?order=`**. No hay backfill.

De ahí que hagan falta LAS DOS cosas, y que confundirlas sea el error:

- cambiar `hrefOrden()` arregla las notificaciones **NUEVAS** — lo prueban los dos
  tests de `tests/integracion/cadenas-*`;
- el **redirect** (`lib/redirect-ordenes` + `proxy.ts`) atiende a las **VIEJAS** —
  lo prueban sus tests de capa 1.

Una función que devuelve un href **no es un enlace: es una fábrica de datos**. Está
dicho en el docstring de `hrefOrden` para que nadie crea que con cambiarla alcanza.

### El redirect: pura en `lib/`, plomería en `proxy.ts`

`?order=`→`?pedido=`, `?cobrar=1`→`?f=por_cobrar`, y `estado`/`desde`/`hasta`
viajan **tal cual** (la pantalla nueva ya los entiende como alcances). Todo lo
demás se descarta y cae a la lista: **nunca un 404**. Quien llega venía de un
enlace que funcionaba; una lista de más se vuelve a filtrar, un 404 lo deja sin
nada.

- **`?cobrar=0` NO se traduce**, y la ausencia es deliberada: significaba
  "pendiente MENOS por-cobrar", el recorte del widget que cambió de PREGUNTA a
  "Necesitan atención". Mandarlo a `f=atencion` afirmaría que son el mismo
  conjunto.
- **En `proxy.ts` y no en `next.config.ts`**: los `redirects()` de la config
  arrastran el query pero **no renombran sus claves**, y renombrar es justo lo que
  hay que hacer.
- **307, no 308.** Un permanente se cachea en el navegador sin forma cómoda de
  deshacerlo; en un panel el costo es un operador que no llega a una ruta hasta
  limpiar caché. No hay SEO que ganar — el sitio va `noindex`.

### Un retiro que deja un dato de sólo escritura está incompleto

`notas_internas` sólo se podía leer y editar en la pantalla vieja, y el sistema
las SIGUE escribiendo: el modal de crear, y `POST /api/orders/[id]/address`, que
les anexa una línea de auditoría por cada dirección agregada a mano. Borrar sin
más habría dejado el campo de sólo escritura — deuda **creada por el borrado**, no
heredada. Por eso el pliegue de notas entró en la misma tanda, mostrando el campo
COMPLETO: filtrar las líneas de auditoría para dejar "sólo lo que el operador
escribió" sería editorializar un registro.

### LA SECCIÓN ES "PEDIDOS" Y LA ENTIDAD ES "ORDEN" — a propósito

El menú, los vacíos, los conteos y los botones dicen **pedido**. El dato sigue
diciendo **orden**: `numero_orden`, el prefijo `CN-`, `OrderStatus`, "Cancelar
orden", "Orden cancelada".

**No es un descuido a medio arreglar.** Unificar la entidad tocaría el schema, el
prefijo de todos los números ya emitidos, copy en una docena de sitios y
probablemente datos — superficie desproporcionada, y metida dentro del retiro lo
habría convertido en un lío con dos cosas que verificar a la vez.

Queda escrito para que el próximo no lo lea como inconsistencia y lo "arregle"
parcialmente, que es como se llega a tener las dos palabras mezcladas SIN criterio.
Si algún día se unifica, es su propia tanda y empieza por decidir qué pasa con los
`CN-` ya emitidos.

## Controles de formulario — el select es NATIVO, y el error va inline

Tanda del 2026-08-14, cerrando el hueco que H6 topó. El backlog pierde su ítem;
lo que sigue es la decisión.

### Nativo, y las tres razones en orden de peso

`<select>` y `<input type="checkbox">` de verdad, estilizados por fuera. No una
lista compuesta.

- **No trae conducta al paquete**, que es la razón decisiva. Una lista compuesta
  necesita foco atrapado, y eso convertiría a `@duna/design-system` en un paquete
  con comportamiento — el cambio de naturaleza que la opción C evitó en la tanda
  de móvil y otra vez en H6. Un control con conducta merece decidirse solo.
- **Accesible de fábrica**: teclado, lector de pantalla, `<option disabled>`.
- **En un teléfono abre la rueda del sistema**, y este panel se opera desde el
  móvil.

**Se verificó ANTES de decidir, no después:** ninguna de las diez opciones del
panel lleva más que texto. Las dos que lo parecían —producto y molienda en Nuevo
pedido— son una sola cadena con sufijo (`Café Nariño (Agotado)`), que un
`<option>` pinta idéntico.

**EL LÍMITE, DICHO:** la lista desplegada la pinta el sistema operativo y no se
puede tipografiar. La objeción obvia —que en tema oscuro salga clara— **ya estaba
resuelta antes de esta tanda** por `color-scheme`, que se declara junto a los
temas justamente para alinear los controles nativos. Lo que se acepta es que la
lista abierta no lleve Hanken Grotesk el segundo que está abierta.

La FLECHA sí es nuestra, y su gris es un **gemelo declarado** de `--duna-muted`:
un `data:` URI no puede leer una custom property. Se evaluó `mask` +
`background-color`, que sí seguiría el token, y se descartó porque exige un
envoltorio por cada select (un `<select>` es reemplazado y no admite
pseudo-elementos).

### El inválido se engancha a `aria-invalid`, no a una clase

Y ésa es la propiedad que vale: **no se puede pintar un campo de inválido sin
anunciarlo**. Con una clase, el borde rojo y el atributo son dos afirmaciones
separadas, y la que se olvida siempre es la del lector de pantalla.

No es teórico: había **cero** `aria-invalid` en los cuatro flujos, y el error del
teléfono en Programar entrega ya existía VISUALMENTE. El mensaje existía para el
ojo y no para quien no ve.

### Una sola convención de error de campo

Había tres. La que queda es **inline bajo el campo, con token del sistema**.

- **El `toast.error` de validación previa MUERE.** Un toast aparece lejos del
  campo, tapa otra cosa y se va solo; el inline vive al lado del problema y
  persiste. Es la misma división que ya regía los errores de servidor (§ Toast =
  éxito, inline = error) — la validación previa era la última que usaba el
  vehículo equivocado.
- **El botón apagado con el motivo en el pie NO muere**: es complementario. Uno
  dice por qué no puedo guardar, el otro cuál campo.
- **La ranura no existe sin mensaje.** Misma lección que `ErrorDialogo`: un
  contenedor vacío que reserva su hueco empuja el formulario justo cuando el error
  aparece.
- **El error aparece con el primer INTENTO**, no antes: marcar en rojo un
  formulario recién abierto le echa en cara algo que todavía no se hizo mal.

### Dos placeholders que NO son el mismo caso

`disabled hidden` en la opción vacía de producto, molienda y departamento: no
elegir no es una respuesta válida, así que no debe poder re-elegirse.

**"Por definir" del método de pago no lleva ninguno de los dos**, y es
deliberado: ahí no elegir SÍ es una decisión válida —el pedido nace pendiente— así
que es una opción de verdad. Tratarlas igual habría convertido una decisión en un
estado sin salida.

### La FECHA sí cambia de criterio, y el select no — la diferencia es COMPETENCIA

El mismo argumento no da el mismo resultado en los dos controles, y por qué es lo
que hay que retener.

**El `<select>` se queda nativo.** Su lista aparece un segundo, la pinta el
sistema operativo, y **no compite con ninguna otra lista del panel**. Nadie ve dos
formas de elegir de una lista en la misma sesión.

**La FECHA no.** El panel ya tenía un date picker Duna —el "Rango de fechas" de
Pedidos— mientras Programar entrega seguía con un `<input type="date">`: dos
formas distintas para la misma tarea, las dos VISIBLES. Eso pesa más que la rueda
nativa en móvil, que es el costo que se acepta.

O sea: la regla no es "nativo siempre" ni "custom siempre". Es **¿hay otra forma
del mismo control ya visible en el panel?** Si la hay, gana la coherencia; si no,
gana el nativo.

**ES EL MISMO `Calendar`, PERO NO ERA UNA COPIA** (verificado antes de tocar):
`mode="single"` contra `mode="range"`, y cuatro cosas cambian. La que más importa
es que **el tiempo va al revés** — el rango filtra registros pasados y prohíbe el
futuro; una fecha de entrega es un compromiso futuro, así que copiar sus límites
habría hecho imposible programar para mañana. Y **no se agregaron límites que no
había**: el input nativo no tenía `min` ni `max`, y una migración de FORMA no es
el sitio para estrenar una regla de negocio.

Dos trampas que dejó al pasar: `PopoverContent` no aceptaba `container` y
portaleaba a `<body>` —tercera vez que el límite del puente de fuentes muerde— y
`formatFecha` con un `Date` de medianoche local imprime el día ANTERIOR fuera de
UTC-5, porque esa función ancla las fechas de reloj de pared en UTC a propósito.
Se le pasa la cadena.

### `textarea.duna-input` YA EXISTÍA

No era un hueco: era una primitiva con un solo consumidor que los otros dos
textareas nunca usaron y resolvieron a mano con Tailwind crudo. Vale como
recordatorio de que "el sistema no lo tiene" hay que verificarlo, no suponerlo.

### La medición viva se atrapó a sí misma

La del contraste del error de campo leía `backgroundColor` del `body`, que
TRANSICIONA al cambiar de tema, así que devolvía el color interpolado: reportó
2.87:1 sobre un token que da 6.02. Ahora lee TOKENS —las custom properties no se
animan— y exige el peor de los dos fondos donde un campo puede vivir, página y
superficie.

**Una medición que miente es peor que ninguna, porque se la cree.** Es la misma
familia que el `el.click()` que saltaba el hit-testing: la herramienta de
verificación también se verifica.

### REGLA · toda medición POR TEMA lleva una aserción de cordura

Una aserción que **falla si el tema no es el que se cree estar midiendo**. Va
dentro de la medición, no al lado:

```js
const claro = lum(hex(T('--duna-bg'))) > 0.5;
if ((tema === 'light') !== claro) throw new Error('CORDURA: …');
```

La instaura el peor engaño de la tanda de Productos (owner, 2026-08-15). La tabla
del mapeo rol-por-rol del chrome salió ENTERA con los valores oscuros en la
columna clara: se leyeron los tokens **antes** de fijar el tema, y la página venía
en oscuro de una prueba anterior. Los deltas daban ~230 en vez de ~2.

**Lo que lo hace el peor de los seis de esa tanda es que se veía plausible** —una
tabla llena de números coherentes entre sí— y habría fundado el commit que
re-apunta los 718 usos de color del panel. Los otros cinco (hoja cacheada,
`grep -c` contando líneas, un discriminador que el cambio REUBICABA, un tab en
`viewport 0x0`, un flag afirmando un delta que la página no mostraba) se
delataban solos al mirar el resultado; éste no.

Aplica también a los contrastes: medir en un tema y suponer el otro es el mismo
error con menos pasos, y § la cinta del tile mostró que **cuál caso rompe se
INVIERTE con el tema**.

## H6 — los diálogos son Duna, y la frontera que eso cruzó

Tanda del 2026-08-14. H6 sale del backlog; lo que sigue es la decisión.

### La mezcla cambió de dirección, y fue una DECISIÓN

Cuatro de los seis diálogos migrados se montan también desde pantallas que NO son
Duna OS: `ConfirmDeleteDialog` desde Productos y Usuarios, `ScheduleDeliveryModal`
y `ConfirmDespachoSinPago` desde Entregas. Migrarlos mete superficies Duna dentro
de pantallas Amber Minimal.

**Se aceptó, y las tres razones importan** (owner):

- la mezcla YA existía en la dirección contraria y estaba aceptada;
- **un diálogo nuevo en una pantalla vieja se lee como promesa** ("esto ya se
  rediseñó"); un modal viejo en una pantalla nueva se lee como deuda ("esto quedó
  sin terminar"). No son simétricos;
- diferir haría que Productos naciera con modales shadcn y hubiera que volver a
  tocarla: **difieres para no mezclar y terminas mezclando en más sitios**.

**DISPARADOR: desaparece cuando Entregas, Productos y Usuarios migren.** No hay
nada que hacer hasta entonces.

### Dos superficies, no una — y la centrada va sobre `AlertDialog`

El drawer es `.duna-sheet` con otro anclaje: misma superficie, mismo velo, mismo
cuerpo, sólo cambia el borde del que sale. El dialog centrado es superficie NUEVA
—no ancla, no lleva grip, radio menor, aparece con escala en vez de deslizarse—
porque algo que flota tiene que ser chico o se lee como una página.

**`DunaDialog` se monta sobre `AlertDialog` y no sobre `Dialog`**, y eso no es un
detalle de implementación: la centrada tiene un solo caso —la confirmación— y con
`AlertDialog` vienen `role="alertdialog"`, que tocar fuera NO descarte, y que el
foco arranque en cancelar. Si algún día hace falta una centrada que no sea
confirmación, es otra costura; mezclarlas haría que la diferencia de conducta
dependiera de recordar una bandera.

### Lo que las costuras NO traen, y es deliberado

**Ninguna bloquea mientras la mutación viaja.** El `is-saving` de la maqueta es
sólo la mitad VISIBLE de la guarda de doble-submit; la que corta la re-entrada del
mismo tick es el ref síncrono de `useAccionGuardada` (§ Doble-submit). Una
superficie que bloquee y haga creer que la guarda ya está puesta reabre el agujero
que ese hook cerró.

**Y el checkbox de confirmación del destructivo NO se adoptó** (owner): con un
solo destructivo real —"Cancelar orden"— agregar fricción a la única acción
irreversible, sin datos de cancelaciones accidentales, no se justifica. La
fricción proporcional ya existe: confirmación + candado + copy. **DISPARADOR: si
aparecen cancelaciones accidentales, se agrega.**

### El destructivo es TINTE, y qué cuenta como destructivo

`--duna-bad` se INVIERTE entre temas y no tiene par de texto, así que el
`color:#fff` de la maqueta es blanco sobre salmón claro en oscuro — la misma
regresión que esa nota documentó con `--ok-ink`. Se usa el par que ya pasa AA
(`--duna-bad-soft` + `--duna-bad-ink`), medido en vivo en la prueba viva: 5.36:1
claro · 4.73:1 oscuro, **contra el fondo compuesto**, porque el tinte es
semitransparente y medir contra la superficie pura daría un número optimista.

**Destructivo = quita algo que no se puede recuperar desde el panel.** No lo son
"Marcar fallido" (registra un hecho; la entrega se reprograma) ni "Rechazar
comprobante" (conserva fila y archivo, y el copy lo promete). La maqueta pinta el
rechazo de rojo; es la cuarta instancia del patrón "alcance de la maqueta que no se
adopta".

### Lo que se topó y no se decidió: los campos — CERRADO

Los drawers nacieron con superficie Duna y **campos shadcn adentro**, porque el
sistema no tenía select. Era una mezcla DENTRO de la superficie nueva, distinta de
la que se aceptó entre pantallas, y no se eligió: se encontró. Se cerró en la
tanda siguiente (§ Controles de formulario), y el orden fue el correcto: migrar el
envoltorio no exigía inventar un valor y migrar los campos sí.

## Duna OS en ANGOSTO — un solo breakpoint, y el detalle sube

Tanda del 2026-08-14. Cerró los dos huecos del § Backlog #9, que por eso ya no
está en la lista. Lo que sigue es la decisión, no el historial.

**El defecto era una acción sin respuesta, no un layout apretado.** `duna-split`
apilaba y el panel quedaba DEBAJO de la lista: tocar una tarjeta actualizaba el
detalle fuera de la pantalla y había que scrollear a ciegas para descubrir que
algo había pasado. Misma clase que el botón mudo que obligó a `useAccionGuardada`
(§ Doble-submit).

### UN solo breakpoint: 960

Había TRES para la misma pregunta —el 960 de `duna-split`, el `lg`=1024 de la
navegación (default de Tailwind, elegido por nadie) y el 820 de la maqueta— y se
unificó en el único con un motivo **derivado y escrito** (`400 + 24 + ~420 +
32×2 = 908`, redondeado al primer valor cómodo por encima).

**Debajo: el panel es sheet Y la navegación es la barra inferior. Encima: rail y
split.** La franja 960–1024 que quedaba con barra inferior y panel al lado se
ELIMINÓ, no se documentó: un rango con dos sistemas de navegación a la vez es una
excepción que alguien tendría que recordar.

El número vive en **tres sitios y ninguno puede leer a los otros**, así que la
regla es que se mueven juntos:

| sitio | qué expresa |
| --- | --- |
| `primitives.css` (`@media max-width: 959.98px`) | la forma: split, barra, hueco |
| `primitives/layout.ts` (`DUNA_MQ_MOVIL`) | **dónde se renderiza** el detalle — el CSS no puede mover un nodo |
| `app/globals.css` (`--breakpoint-duna: 960px`) | el chrome del admin, como variante `duna:` |

**El `.98` NO es cosmético.** El breakpoint con nombre de Tailwind genera
`min-width: 960px`; con `max-width: 960px` del otro lado, a EXACTAMENTE 960
aplicaban las dos mitades —barra inferior y rail a la vez—. Es la franja de dos
navegaciones otra vez, de un píxel de ancho y por eso peor: nadie la reproduce a
mano. **Salió de grepear el CSS compilado, no de leer la fuente** — el mismo
principio de siempre: lo que está escrito no prueba lo que está corriendo.

### El sistema pone la FORMA; el consumidor pone la CONDUCTA

Decisión del owner, y es la frontera del paquete. `.duna-sheet`, `.duna-scrim`,
`.duna-mobnav`, `--duna-safe-b` y las animaciones son CSS. **El foco atrapado,
Escape, click-fuera y el bloqueo de scroll los pone Radix**, montado en
`components/admin/DunaSheet.tsx`, que es la única costura.

El argumento que decidió: **este paquete no tiene una sola pieza con
comportamiento** —los cinco componentes que envía son presentación pura— así que
un sheet con foco atrapado sería la primera, o sea un cambio de NATURALEZA del
paquete metido dentro de una tanda de móvil. Y reimplementar el foco atrapado
—justo la parte que todo el mundo hace mal— para obtener lo que
`components/ui/sheet.tsx` ya da en producción es el mismo movimiento que H6 ya
rechazó.

**Esta tanda NO construyó media H6.** H6 queda con su precio y su disparador sin
cambio.

**DISPARADOR (hecho observable): cuando aparezca un TERCER consumidor de sheet o scrim
FUERA del admin** —hoy `.duna-sheet`/`.duna-scrim` son CSS admin-level que alguien cablea
bien; un consumidor no-admin es lo que fuerza a moverlas al paquete (con su conducta, para
que no-admin las use)—. NO "al tocar el DS": ese toque genérico no dispara nada. El otro
camino a la absorción sigue siendo que el paquete adopte comportamiento (H6, o Fase B con su
propia app); lo que se reescribe es el disparador de ESTE lado, que era vago.

**`.admin-tooltip` es el MISMO caso, con un paso menos hecho** (owner, 2026-08-18):
la superficie del tooltip (`app/(admin)/duna.css`) es CSS que alguien cablea, con
la conducta (Radix) en `components/admin/DunaTooltip.tsx` — igual que `.duna-sheet`
sobre `DunaSheet.tsx`. Se absorbe en el paquete con las otras cuando adopte
comportamiento. La diferencia: su CSS **todavía no está en el paquete** —vive
admin-level como `.admin-tooltip`, no como `.duna-*`—, mientras que la de sheet/scrim
ya está en `primitives.css`. Así que el primer paso (mover la superficie al paquete
como `.duna-tooltip`, CSS presentacional, sin depender de que adopte conducta) queda
pendiente acá, no como decisión nueva.

**Consecuencia ACTUAL, que es un H10 en versión sutil:** el bloque de tooltip de
`reference.html` **espeja `.admin-tooltip` con estilos inline** (como el bloque de la
serie), así que la prueba viva **NO ejercita la clase real**. Si `.admin-tooltip`
cambia, la referencia sigue mostrando lo viejo y **miente** sin que nada lo delate —
una superficie sin consumidor real en la prueba viva, que es exactamente lo que un
H10 es. Mover la superficie al paquete y hacer que la referencia use la clase real
cierra el H10 y la absorción a la vez.

### El scroll-lock es lo que decide el gate, y no es el del drawer viejo

`react-remove-scroll` (entra con `@radix-ui/react-dialog`) previene a nivel de
**evento** —`touchmove`/`wheel` con `preventDefault`— y **nunca toca `position`
ni `scrollTop`**, así que la posición de la lista se preserva por construcción.

Dos cosas que conviene tener escritas porque las dos son creencias comunes y las
dos son falsas:

- **`body { overflow: hidden }` no salta al tope en iOS Safari: FALLA AL
  BLOQUEAR.** El fondo se sigue moviendo detrás del modal. Era lo que hacía el
  drawer del Sidebar, o sea que ese bloqueo estaba a medias desde siempre.
- **El salto al tope es del workaround `position: fixed`**, que sí pierde la
  posición si no se restaura a mano. No se usa, y no hace falta.

### Lo que MURIÓ, y por qué se nombra

La hamburguesa y su drawer se borraron enteros. Con ellos se fueron: el bloqueo
de scroll a mano, el backdrop `bg-black/50` —que era una **tercera** definición
del velo junto a `.duna-scrim` y `overlayClasses`— y el efecto de `AdminChrome`
que forzaba el cierre al cruzar a escritorio, que existía sólo para que ese
bloqueo no quedara colgado.

**Lo que se rescató: el botón de Buscar ocupa el slot de la hamburguesa.** Vivía
dentro del rail, y el rail tampoco existe en angosto — borrarla a secas dejaba al
teléfono sin forma de abrir el ⌘K. Se va lo que se reemplazó; se queda lo que se
habría perdido.

### La barra y el sheet se derivan de `ADMIN_NAV`

Nunca de la maqueta, que dibuja ocho secciones de las cuales **cuatro no existen**
(Tienda, WhatsApp, Sistema, Ajustes) y **omite Entregas**, que sí. El corte es
POSICIONAL —los primeros cuatro a la barra, el resto al sheet— y no una bandera en
el registry: el orden ya lo dice el array, que es el mismo que el operador ve en
el rail, así que las dos navegaciones no pueden contradecirse sobre qué es
principal.

**El sheet NO lleva bloque de usuario** aunque la maqueta lo dibuje: la identidad
ya vive en la topbar por debajo del breakpoint, y sería el segundo sitio para lo
mismo.

### Dos huecos del sistema que aparecieron construyendo

- **`--duna-safe-b` no existía.** El indicador de inicio del teléfono se dibuja
  ENCIMA de la página, así que sin él el slot que la mano alcanza primero queda
  debajo de una barra del sistema. Con fallback `0px` EXPLÍCITO: `env()` sin
  fallback invalida el `calc()` entero, o sea que falla hacia "sin margen", que es
  justo lo que el token existe para cerrar.
- **`prefers-reduced-motion` estaba scopeado a `.duna *`**, y el sheet y el scrim
  se PORTALEAN fuera de ese wrapper. Van nombrados en la regla. El modo de falla
  era silencioso en la peor dirección: la regla existe, el archivo la declara, y
  aun así la superficie animaba. **Cualquier primitiva futura que se portalee
  entra a esa lista.**

Y un tercero que ya estaba escrito y esta tanda hizo morder: **lo portaleado a
`<body>` queda fuera de `.admin-shell` y no ve el puente de familias
tipográficas** (§ `duna.css`). `DunaSheet` lo esquiva portaleando al propio
puente. **El arreglo sistémico que esa nota propone —las variables de fuente en
`<html>`— sigue pendiente y sigue siendo el correcto para H6**, que va a portalear
varias superficies.

### `.duna-scrim` era un H10, y esta tanda lo cierra

Estaba escrita en las primitivas, con **cero consumidores y ausente de
`reference.html`**. Una primitiva que nunca se ejerce no está probada: está
declarada. El bloque nuevo de la prueba viva la ejerce.

**Lo que esa página NO puede probar**, dicho para que nadie lo dé por probado: ahí
el `<body>` ES `.duna`, así que el escape de scope que obligó a nombrar las dos
superficies en `prefers-reduced-motion` no se reproduce. Si alguien quitara esos
nombres, la referencia seguiría respetándolo y la app no. **Eso se verifica en la
app.**

## Analítica — cuatro preguntas de dueño, no un grid de métricas

Rediseño del 2026-08-05 (decisión del owner). La página dejó de ser el grid
heredado del template y responde CUATRO preguntas, cada una atada a una decisión:
**rentabilidad** (¿estoy ganando o solo vendiendo? → qué SKU sostener),
**cartera** (¿cuánta plata mía está en la calle? → a quién cobrar),
**trayectoria** (¿el negocio crece? → si el rumbo sirve) y **clientes y canales**
(¿quién y por dónde? → dónde concentrar).

**El principio de corte: si una sección no cambia ninguna decisión, es
decoración.** Es lo que justifica que murieran cosas que "funcionaban".

### LA RESPUESTA PRIMERO, LA EVIDENCIA DESPUÉS

Segundo pase, mismo día, tras usar la página (owner). **Las preguntas estaban
bien; la presentación era de analista, no de dueño.** Cada bloque abría con la
EVIDENCIA —una tabla de cinco columnas, un chart de dos líneas, tres tarjetas de
buckets— y dejaba que el lector dedujera la respuesta.

> Cada bloque LIDERA con una frase en lenguaje natural y un número. El detalle
> denso se pliega.

**NADA se eliminó en ese pase: todo se re-jerarquizó.** La tabla por SKU sigue
completa detrás de "Ver detalle por producto"; la línea de margen sigue en el
chart detrás de "Ver margen". Es el patrón de insights de las stat cards
(§ Capa de insights) aplicado a la página que se construyó sin él, y hereda sus
dos reglas: **texto = hecho** (nunca instrucción ni causa inventada) y **preferir
callar a afirmar sin base**.

La prueba de aceptación es de 30 segundos: abrir la página y responder en voz
alta las cuatro preguntas **sin abrir un solo pliegue**. Si una exige abrir algo
o leer una tabla, ese bloque falló.

- **Las frases viven en `lib/metrics/titulares.ts`, puras y testeadas**, no en el
  JSX. La redacción ES la decisión de producto de este pase: dentro de un
  componente, cambiar un `if` de plural rompería la respuesta a "¿gané plata?"
  sin que nada lo notara.
- **`hayVentas` viaja aparte del margen** porque cero y "no hubo ventas" son
  hechos distintos: margen 0 CON ventas significa que se vendió justo al costo
  —alarmante—, y sin ventas sólo significa que no pasó nada. Colapsarlos haría
  que un mes tranquilo se leyera como uno catastrófico.
- **La pérdida se nombra pérdida** ("perdiste $X"), no un negativo con signo. Un
  signo hay que decodificarlo, y es justo el caso en que leerlo mal cuesta caro.
- **El bucket VIEJO de la cartera sube al titular.** Es el único dato de la
  página que puede exigir una llamada hoy mismo, y antes había que leer y
  comparar tres tarjetas para descubrirlo.
- **La advertencia del costo estimado se queda en el header, NO dentro del
  pliegue.** Esconderla tras "Ver detalle" la haría invisible justo para quien
  más la necesita: el que no abre el detalle.
- **El estado de los pliegues es local y NO se persiste.** La página debe abrir
  siempre en su forma corta, porque es esa forma la que responde en 30 segundos;
  un pliegue recordado volvería la pantalla del analista el default de alguien.
- **La línea de margen de la trayectoria nace APAGADA.** Dos series con escalas
  distintas obligan a comparar antes de leer, y "¿el negocio crece?" lo responde
  la de ingresos sola. La leyenda del chart sólo aparece con las dos series: con
  una sola no distingue nada.

`/api/analytics` se REESCRIBIÓ EN SU SITIO; no hay `/v2`. No es preferencia de
estilo: el endpoint viejo tenía su propia definición de "ingreso" (sumaba
`Order.total` en vez del libro de pagos) y un `/v2` lo habría dejado vivo, sin
consumidores que lo mantuvieran honesto — que es exactamente cómo
`razonDelServidor` y `cruzoMinimo` terminaron duplicados y divergiendo. Además
ninguna de sus salidas sobrevivía intacta, así que no había convivencia que
comprar.

Los cinco defectos que tenía, por si alguien los reintroduce creyéndolos
inofensivos: no excluía `SN-` en ninguna métrica; bucketeaba los meses en JS con
el reloj del SERVIDOR (`new Date(...).getMonth()`), no en SQL con Bogotá;
`margenBruto` promediaba el % del CATÁLOGO sin ponderar por ventas —un número que
no miraba una sola orden—; `tasaRetencion` dividía entre TODOS los clientes,
incluidos los que nunca compraron; y `categoryData` ya era payload muerto.
**Sobrevivió intacto `/api/analytics/weekly`**: era la única parte que ya cumplía
el estándar (día bucketeado en SQL, Bogotá, solo `CN-`, no canceladas).

### El COSTO no está snapshoteado — y eso es una decisión escrita, no un detalle

`OrderItem` guarda `precio_unitario` y `subtotal`, **no el costo al momento de la
venta**. El margen histórico se calcula por tanto contra `Product.costo` ACTUAL:
si el costo cambió, el margen de una venta vieja se recalcula con el de hoy.
Aproximación aceptada a esta escala, y por eso la página lo DECLARA ("margen
estimado con el costo actual del catálogo") en vez de presentarlo como contable.

**Mejora futura propuesta, NO ejecutada:** una columna `costo_unitario` en
`OrderItem` (migración aditiva, nullable) llenada de aquí en adelante. Convierte
el margen futuro en un hecho y deja el histórico como está.

Tres consecuencias que se descubrieron construyéndolo y que NO son obvias:

- **El margen va sobre MERCANCÍA, sin envío.** Los ingresos del cálculo son suma
  de `OrderItem.subtotal`, no de `Payment.monto`. El pago incluye el costo de
  envío y el costo de la mercancía no, así que restar uno del otro **inflaría el
  margen por cada despacho**. El envío es un costo trasladado, no utilidad. Por
  eso el chart de trayectoria dibuja dos líneas con bases distintas y lo dice.
- **`producto_id` es NULLABLE**, así que hay líneas sin costo resoluble. Se
  resuelven por FK → nombre exacto → **residual DECLARADO**. Jamás con costo 0:
  un costo 0 se renderiza como **margen 100%** y convierte un dato que falta en la
  mejor noticia del mes. Un nombre AMBIGUO (`Product.nombre` no es único — solo
  `slug` y `sku` lo son) cuenta como costo faltante, no como una moneda al aire;
  mismo criterio que el `null` de `sugerirZona`.
- **Un margen negativo se muestra en rojo y NO se recorta a cero.** Vender por
  debajo del costo es justo lo que esta página existe para mostrar; un
  `Math.max(0, …)` ahí borraría el único hallazgo que importa. Es la única
  excepción de color semántico de la tabla (Amber Minimal).

**El margen se calcula SOLO sobre órdenes pagadas, y el período se mide por la
fecha del PAGO.** Si incluyera pendientes, la misma orden sería utilidad en el
bloque 1 y cartera en el bloque 2 — **la página se contradiría a sí misma**.
Consecuencia que conviene tener escrita: cuando una orden pendiente se cobra entra
al margen del mes EN QUE SE PAGÓ, no del mes en que se creó. Es coherente con el
libro de pagos del dashboard, y es lo que explica que un mes muestre margen de
ventas viejas. **Si alguna vez eso confunde, la respuesta es la nota, no cambiar
la base.**

### La CARTERA no excluye `SN-`, y el criterio es lo que hay que recordar

Es la única excepción de exclusión en toda la página, y no es un olvido:

> **La cartera es una lista de TRABAJO, no una medición.** Su contrato es
> card=lista y su fuente es la misma que la página de Órdenes. El resto de la
> página es analítica y sí excluye `SN-`.

Cada bucket linkea a `/admin/ordenes`, que tampoco filtra `SN-`; un conteo que no
cuadre con la lista a la que lleva es peor que uno que incluye una orden de demo.
La nota de la sección se lo dice al operador en una línea. **En producción no hay
`SN-` desde la purga del 2026-08-03**, así que la incoherencia es solo de
`development`; la exclusión en Órdenes queda como la deuda que ya era (§ "Por
cobrar" vs "Órdenes Pendientes" — se arregla de los dos lados a la vez o de
ninguno).

**Cartera = órdenes `pendiente`, y su saldo ES `Order.total`.** No hay pagos
parciales: `registrarPago` snapshotea el monto del total server-side y transiciona
a `pagado` (`lib/orders.ts`). Por eso no hay aritmética de saldos. Si algún día
existen pagos parciales, ESTA es la línea que deja de ser cierta.

**Los buckets de edad se expresan con el filtro que YA existe.** Un bucket de
envejecimiento es un rango de FECHA DE CREACIÓN, y `parseFilters` de Órdenes ya
soporta `desde`/`hasta` como day keys de `createdAt` en Bogotá, inclusivos por
ambos extremos. No se construyó un filtro por edad porque no hacía falta — el
deep link es EXACTO, no aproximado, y `cartera.test.ts` lo afirma recorriendo día
por día que el rango del query contiene justo las edades de su bucket. Los cortes
(7 y 15 días) son constantes `TODO(cliente)`.

### Lo demás, en corto

- **Las reglas puras viven en `lib/metrics/`** (`margen.ts`, `cartera.ts`,
  `concentracion.ts`, `periodo.ts`, `titulares.ts`) con tests en capa 1, por el criterio de
  siempre: se extrae lo que tiene la decisión para poder afirmarlo. El endpoint
  agrega en SQL y **llama a las mismas funciones que la página**, así que el total
  del header, las filas de la tabla y la línea del chart no pueden discrepar.
- **`types/analytics.ts` REUSA los tipos de los predicados**, no los redeclara: dos
  tipos que nunca se comparan pueden divergir sin que el compilador avise.

### Qué mueve el chip de período, y qué NO

Cuatro chips, sin date-picker: **Este mes · Mes pasado · Últimos 3 meses · Este
año**. Viven en el HEADER de la página, no dentro de un bloque — colgarlos de una
sección haría creer que sólo mueven esa.

**"Últimos 3 meses" es una ventana MÓVIL que incluye el mes en curso, NO el
trimestre calendario** (owner, 2026-08-05). La pregunta real es "cómo me ha ido
últimamente"; un trimestre calendario responde otra cosa — el 1 de abril
mostraría enero-marzo y ocultaría todo lo reciente.

| bloque | ¿respeta el chip? | por qué |
| --- | --- | --- |
| Rentabilidad | **sí** | por fecha de PAGO |
| Concentración de clientes | **sí** | por fecha de PAGO — misma base que rentabilidad |
| Canales | **sí**, pero por fecha de CREACIÓN | una orden "llega" cuando se crea, no cuando se paga |
| Cartera | no | saldo VIGENTE; un saldo no lleva período (§ "Por cobrar") |
| Trayectoria | no | ES la serie larga: recortarla con el chip la vaciaría |
| Recurrencia | no | métrica de la BASE de clientes, y debe cuadrar con la página de Clientes |
| Actividad semanal | no | su pregunta se responde mirando UNA semana; trae su propio navegador |

**Clientes y canales estuvieron CLAVADOS en "año en curso" durante el primer
pase, y era un defecto silencioso**: el chip decía "Mes pasado" y esas dos
secciones seguían mostrando el año entero sin que nada en pantalla lo delatara.
Por eso se afirma en el carril y no en el checklist manual — **un humano no puede
ver que un número no se movió.** `analitica.test.ts` cubre las dos direcciones:
los tres que se mueven y los cuatro que no.

La diferencia de base de Canales (creación vs pago) está DICHA en su subtítulo
("órdenes creadas"), no deducida. Dos bloques bajo el mismo chip contando cosas
distintas es correcto sólo si cada uno declara qué cuenta.
- **La concentración tiene guarda de muestra** (`MIN_CLIENTES_CONCENTRACION` = 6):
  con 5 clientes el top-5 da 100% por aritmética, y ese 100% se lee como alarma
  cuando solo dice que el negocio tiene cinco clientes. La LISTA se muestra igual;
  lo que se calla es el titular. Misma familia que `MIN_ORDENES_INSIGHT`.
- **La recurrencia usa la fórmula unificada** con el sub "N de M", idéntica a la
  de la página de Clientes. El dashboard pasó de `kpis.tasaRetencion` a
  `recurrencia.pct` — es el MISMO número, en un campo que dice qué es.
- **Los insights de la escalera se aplicaron a la serie larga** tal cual
  (`widgetInsight`), incluido el descarte del mes en curso y el corte de
  prehistoria. Muted y sin color, como en las stat cards.
- **Canales pasó de pie a barras**: son 2–4 categorías y lo que se compara son
  magnitudes, que una barra responde de un vistazo y un pie obliga a estimar
  ángulos.
- **`loading` es DERIVADO, no seteado en el effect** (`data?.periodo.key !==
  periodo`), apoyado en que el endpoint hace eco del período que resolvió — el
  mismo mecanismo del `week` de la card semanal. Un `setLoading(true)` síncrono
  dentro del effect dispara renders en cascada y el lint lo marca.
- **Fuera de alcance por decisión**: estacionalidad, cohortes y forecasting (sin
  historia ni volumen), snapshot de costo, filtro por edad en Órdenes, y
  export/PDF/comparativas configurables.

### EL CONTRATO DEL PERÍODO · cada bloque DECLARA su alcance, junto a su titular

Cerrado el 2026-08-20 (tanda 1 del rediseño de Analítica). **Es un defecto, no un
rediseño:** el chip vive arriba de la página y la mitad de los bloques no lo
respeta —por diseño, y las divergencias están bien—, así que **un control que
parece aplicar y no aplica miente**. Ya había costado un defecto silencioso
(clientes y canales clavados en el año en curso sin que nada lo delatara), que es
por qué la tabla de arriba se afirma en el carril: *un humano no puede ver que un
número no se movió.*

**NINGUNA base de cálculo se tocó.** Las divergencias son deliberadas y ya estaban
declaradas EN EL CÓDIGO; lo que faltaba era subirlas a la PANTALLA. La tanda es
texto.

- **La declaración vive JUNTO AL TITULAR de cada bloque, nunca como descargo
  global.** Un descargo global obliga a mapear siete bloques contra una lista
  lejana, y sería un segundo sitio que puede divergir de lo que cada bloque hace.
- **Y NO es una prop de `Bloque`.** El bloque 4 tiene TRES alcances distintos
  —concentración (período, por pago), recurrencia (acumulado) y canales (período,
  por creación)—, así que una ranura por bloque obligaría a mentir por
  simplificación justo en el más mezclado. Vive en cada panel, que es donde ya
  estaba en cinco de siete.
- **El patrón ya existía y sólo se completó.** El censo del descubrimiento
  encontró que Cartera ("saldo vigente, no depende del período"), Recurrencia
  ("acumulado, no depende del período"), Concentración, Canales y la card semanal
  YA lo declaraban, y visible. Faltaban dos. **Conviene tenerlo escrito porque el
  reporte inicial de esa sesión dijo lo contrario** —afirmó que sólo Canales lo
  decía— y sobre esa premisa falsa se habría reescrito lo que ya estaba bien.

**EL CASO GRAVE ERA TRAYECTORIA**, y su forma es la que hay que reconocer: la
serie IGNORA el chip (son siempre 12 meses) y su alcance vivía **dentro del
pliegue**, o sea cerrado por defecto. Con "Mes pasado" elegido, un chart de 12
meses **contradice al chip a la vista** y la única explicación estaba donde el
propio diseño garantiza que nadie mira — la prueba de aceptación de esta página es
"responder las cuatro preguntas SIN abrir un solo pliegue". La asimetría lo
delataba: sus dos hermanos que también ignoran el chip lo declaran en línea.

**Y "no depende del período" NO alcanzaba para una serie.** La fórmula funciona en
Cartera y Recurrencia porque ahí es obvio: **un saldo vigente y un acumulado no
TIENEN período.** Una serie temporal sí lo tiene, así que decir sólo que no
depende del chip deja al operador preguntándose por qué. Tiene que decir las tres
cosas —**cuál es el alcance, que es fijo, y para qué**—: *"Pagos recibidos por mes
(incluye envío) · siempre los últimos 12 meses, para ver la tendencia."* El
`incluye envío` se CONSERVA a propósito: es la base declarada que hace que esa
línea no sea comparable peso a peso con la del margen.

**El caso menor era Rentabilidad, y es el que más silenciosamente confunde**
(owner): SÍ respeta el chip, pero mide por **fecha de PAGO**, así que un mes puede
mostrar margen de ventas viejas cobradas ahora. La doctrina ya anticipaba esa
confusión y decía que "la respuesta es la nota, no cambiar la base" — **la nota no
existía en pantalla.** Ahora abre la línea: *"Del período, por fecha de pago · …"*.
El titular nombra el período ("Este mes…"); esto dice **qué fecha lo decide**.

**Límite conocido, declarado:** la línea de Rentabilidad va dentro de `hayVentas`,
así que un período sin ventas no la muestra. Es aceptable —sin cifra de margen no
hay nada que malinterpretar, y el titular ya dice "no hubo ventas **cobradas**"—
pero queda escrito para que no se lea como olvido.

**Las frases NO se extraen a `lib/`** (decisión del owner): son literales de UI sin
decisión, y `lib/` es para lo que TIENE una decisión que afirmar (§ titulares.ts,
que sí vive ahí porque su redacción cambia con la gramática del período). La
consecuencia es que esta tanda **no tiene superficie de capa 1** y su verificación
es el gate visual — dicho, no omitido.

### LA FORMA · el lenguaje Duna, y el document-scroll como DECISIÓN

Tanda 2 del rediseño (2026-08-20). Re-skin: la anatomía —Titular + pliegue— no se
re-litigó y **ninguna base de cálculo se tocó**.

**El censo que definió el alcance:** la pantalla **no importaba ni un componente
shadcn**. Sus únicas dependencias no-Duna eran `recharts` y `constants/dashb-styles`,
y de los ~73 usos de color raw, **~62 YA caían a tokens Duna por el fallback de
`@theme`** (§ el chrome ES del DS) — no eran deuda. Sólo tres cosas quedaban sin
contraparte, y ésas son las que migraron.

- **Las superficies adoptan su ROL**, no una imitación: `.duna-eyebrow` (la línea del
  bloque, que tres utilidades sueltas imitaban con un `/60` y un `/70`), `.duna-card`,
  `.duna-title` para el Titular, `.duna-skel` para el esqueleto.
- **`recharts` SE QUEDA.** Reescribir dos gráficas con ejes, tooltip y leyenda a SVG a
  mano sería reimplementar una librería — lo que H6 ya rechazó. `PagosCurva` es
  bespoke por ser *una curva interactiva específica*, no un chart genérico: no son el
  mismo problema, y tratarlos igual habría duplicado trabajo por parecido de nombre.

**LA SERIE IDENTIFICA; UNA MEDIDA SOLA NO TIENE QUÉ IDENTIFICAR.** Es la aplicación de
§ La serie categórica, y no es obvia, así que queda escrita con sus tres casos:
Trayectoria son DOS categorías (ingresos vs margen) → `--duna-serie-1/2`; Canales son
2–4 categorías → la escala completa; **la Semanal es una medida ÚNICA (órdenes por
día) → TINTA**, igual que la curva de Pagos. Cuando esta pantalla se escribió el DS no
tenía escala de gráficas —la doctrina la declaraba como rol SIN contraparte— y desde
Pagos sí la tiene. `ANALITICS_COLORS` quedó sin consumidores y **se retiró con su
censo escrito**; `--chart-1..5` SOBREVIVE en el Dashboard (`DashboardChartCarousel`,
`DASHBOARD_COLORS`), que es otra vertical y migra con ella.

**El `accent-amber` de esta pantalla NO fue a `--duna-sol`**, y es el matiz que
importa del gemelo de #16: ese ámbar significa ATENCIÓN, y lo que había era **el
nombre de un producto que navega a su ficha**. El rol es ENLACE → `.duna-link`, que
además trae su foco con `--duna-ring` y resolvió uno de los cuatro `ring-ring`. Los
otros tres fueron a `.admin-foco` (admin-level, prefijo `admin-` y no `duna-` por la
regla del segundo consumidor), porque **la utilidad `ring-*` de Tailwind espera un
COLOR y `--duna-ring` es un BOX-SHADOW**: no puede consumirlo.

#### El re-skin no CREA defectos de contraste: les quita el disfraz

El gate destapó que el cursor de hover de la Semanal se confundía con las barras en
oscuro. **No lo causó la migración.** El cursor es un prop aparte de recharts con
default hardcodeado y ciego al tema —medido en la fuente instalada:
`getCursorRectangle.js` da `fill: '#ccc'` **sin opacidad** para barras, `Cursor.js` da
`stroke: '#ccc'` para línea—, así que ese bloque claro estuvo mal en oscuro **desde
siempre**: lo camuflaban las barras ámbar. Al pasar las barras a tinta dejó de
distinguirse.

**Es el mismo patrón que el picker roto que los presets tapaban**, y conviene tenerlo
como expectativa y no como sorpresa: **un re-skin destapa los defectos que el color
viejo enmascaraba.** Aparecen DURANTE la migración y se leen como regresiones suyas;
casi nunca lo son. La forma de saberlo es medir el default, no suponerlo.

El arreglo: `--duna-wash-hover` para el cursor de barras y la guía punteada de Pagos
para el de línea. **El token no es un préstamo: es el de HOVER para un cursor de
HOVER**, o sea su significado exacto — lo contrario del caso que se rechazó para el
relleno del área de la curva, donde el mismo token habría significado otra cosa.

#### El grid-list dentro de un pliegue NO lleva encabezado sticky

La tabla de "Ver detalle por producto" era un `<table>` crudo y su defecto **no era
sólo que le faltara el reflujo**: `overflow-x-auto` y `w-full` **no pueden convivir**
(el mecanismo completo está en § Backlog #36, que documenta a su gemela del
Dashboard). Migró a `.duna-lista`.

Lo que esa migración destapó, y es de SISTEMA: **`.duna-lista__head` nace `position:
sticky` de fábrica**, porque sus dos consumidores viven en la REGIÓN de una pantalla
de alto fijo. Analítica es document-scroll y su lista vive dentro de un pliegue, así
que **sin scroller propio el sticky resuelve contra el DOCUMENTO y se despega de su
tabla** — se pinnearía bajo la topbar, lejos de las filas que rotula. Se neutraliza
con `.duna-lista--en-pliegue`, y el selector va **COMPUESTO (0,2,0)**: contra la clase
base el desempate sería el orden de archivo, que es la lección ya pagada de
`.duna-skel.duna-skel`.

**La primitiva NO se parametriza todavía.** Hacer el sticky opt-in tocaría a Pagos e
Inventario, donde hoy es correcto; **un TERCER consumidor sin scroller sería la señal**
de que debe parametrizarlo. Y acá no hace falta por otra razón medida: la lista son
los productos CON VENTAS del período, o sea como mucho el catálogo entero —**4
productos hoy**—, y un encabezado sticky existe para cuando el scroll se lleva la
referencia.

### DIBUJA O DECLARA · un gráfico de un punto es decoración fingiendo ser dato

Tanda 2b (2026-08-20). Trayectoria pintaba **ejes, grilla y un punto suelto** mientras
su propio titular decía "Muestra aún pequeña para tendencias": **la pantalla se
contradecía a sí misma** —declaraba que no hay tendencia y dibujaba una—. Es la misma
regla que la curva de Pagos ya fijaba (bajo 4 buckets no dibuja y lo declara), en la
pantalla que no la tenía.

**UN SOLO JUEZ, y ésa es toda la decisión.** `dibujaTendencia` (`lib/metrics/insights.ts`)
deriva el dibujo del MISMO `insightMuestraCorta` que produce el titular, así que la
contradicción pasa a ser **imposible por construcción**.

**Deliberadamente SIN umbral propio.** Un `MIN_PUNTOS` como el de Pagos serían **dos
jueces del mismo hecho**, y dos definiciones del mismo criterio es cómo divergen — el
modo de falla que este repo ya pagó con `razonDelServidor` y `cruzoMinimo`. Pagos
necesita el suyo porque su eje es genérico (día/semana/mes) y **no tiene** guard de
muestra; Analítica sí lo tiene. Copiar el número habría sido copiar la letra sin el
motivo.

**NO APLICA a las otras dos gráficas, y la razón es de NATURALEZA, no de umbral:**

- la **Actividad semanal** siempre tiene **siete días** —una semana no puede traer
  menos buckets—, así que su caso degenerado no es "pocos puntos" sino "los siete en
  cero", que es un vacío y ya tiene su propio fallback honesto;
- los **Canales** son **CATEGORÍAS, no una serie temporal**: un solo canal es un hecho
  legítimo ("todo llega por WhatsApp"), no una tendencia afirmada sobre nada.

Forzarles la regla sería exactamente el error que la sección anterior nombra: aplicar
la letra donde no está el motivo.

- **El toggle "Ver margen" desaparece con la curva.** Un control que superpone una
  línea sobre un gráfico que no se dibuja es un control muerto: promete algo que no
  puede ocurrir. Misma regla que "las acciones que no aplican NO están".
- **La línea que reemplaza al gráfico explica la AUSENCIA, no repite el hecho** — el
  titular ya lo dice. Y aclara que la cifra sigue siendo exacta: lo que falta es
  historia con qué compararla, no confianza en el dato.
- **El test se vio FALLAR 5 de 6** con la regla neutralizada al comportamiento viejo
  (`return true`). El sexto es el caso que sí dibuja, y que pase es correcto.
  **No borrar** `lib/metrics/insights.test.ts`: sus casos afirman las DOS mitades a la
  vez —lo que dice el guard y lo que hace el dibujo—, así que si alguien le diera a
  `dibujaTendencia` un umbral propio, se caen. Es justo lo que se les pide.
- **El borde que obliga a la guarda explícita `!data?.serie?.length`:** con
  `null`/`undefined` el guard devuelve `null` —correcto para un insight, "no tengo
  nada que decir"— y delegar a secas leería ese `null` como "no hay objeción,
  dibuja", o sea que **sin serie dibujaría**. Con `{ serie: [] }` en cambio el guard
  SÍ opina (un array vacío es truthy y no entra en esa rama). Dos entradas, el mismo
  `false`, caminos distintos: por eso el test afirma las dos.

### EL DINERO PAGADO POR CLIENTE · una definición, dos alcances

Tanda 3 (2026-08-21). Cierra el § Backlog #6, que por eso ya no está en la lista.

**El descubrimiento fue el hallazgo:** había **DOS caminos al mismo hecho**, y no
diferían sólo en el período —que era la premisa con que entró la tanda—.
`paidTotalByCustomer` (lista y perfil de Clientes) **no filtraba nada**, y la
concentración de Analítica excluía **`SN-` Y canceladas**. Medido en dev antes de
tocar nada: **$315.000 contra $259.000** para los mismos clientes, por **2 pagos
sobre órdenes canceladas**. Dos pantallas afirmando el dinero de la misma persona
con números distintos — el modo de falla de § "Por cobrar vs Órdenes Pendientes",
que se arregla **de los dos lados o de ninguno**.

**LAS DOS DECISIONES DE PRODUCTO** (owner), que son las que desbloquearon todo:

- **LAS ÓRDENES CANCELADAS SÍ CUENTAN.** El cliente pagó y la plata entró. Cancelar
  **no toca el `Payment`** —doctrina ya declarada—, así que esconderlo haría que la
  suma por cliente **no cuadre con el libro de Pagos**, que sí la muestra. Un
  reembolso sería OTRO hecho, y hoy no se modela.
- **LAS `SN-` NO CUENTAN, EN NINGÚN LADO.** Eso no es definición de negocio: es
  limpieza de datos de prueba. Clientes las incluía.

**El período pasó a ser un PARÁMETRO, no una segunda implementación**
(`paidTotalByCustomer(rango?)`). Es la forma que hace imposible la divergencia: una
definición, dos alcances.

- **Quitar un filtro de exclusión se lee como descuido si no dice por qué**, así que
  la ausencia del filtro de canceladas está DECLARADA en los dos sitios (el helper y
  el call site de Analítica). Un lector futuro que lo vea vacío no tiene de dónde
  saber que es una decisión.
- **`TENANT_ORDER_PREFIX` convive con `soloOrdenesReales`, y NO son lo mismo.** Aquél
  excluye por NEGACIÓN ("todo lo que no sea `SN-`") y conserva una orden SIN número;
  éste incluye por AFIRMACIÓN. **Las dos están bien donde están:** para una LISTA la
  permisiva —esconder una orden que no dice cómo se llama es peor que mostrarla—;
  para una SUMA de dinero la estricta —un total no puede incluir algo que no se sabe
  qué es—. Se usó la estricta porque es la que ya aplican las tres consultas hermanas
  de Analítica, y la otra le habría dado a la concentración un alcance distinto del de
  sus vecinas: una divergencia nueva DENTRO de una pantalla, peor que la que se cerró.
- **El helper conserva su contrato `Map<id, total>`.** Los nombres los resuelve
  Analítica aparte, porque su consumidor principal (`/api/customers`) YA los tiene y
  ensuciar el contrato sería pagar el precio en el sitio equivocado. **No se resuelven
  sólo para el top 5**, y la razón no es obvia: `concentracionIngresos` **desempata por
  NOMBRE** para que el orden no cambie entre recargas sin que cambie un dato, y con
  nombres de relleno ese desempate caería en el orden de inserción del Map, que no es
  estable.

**LAS DOS PRUEBAS SON DOS A PROPÓSITO**, y es la lección de método de esta tanda:
`dinero-pagado-cliente.test.ts` afirma la DEFINICIÓN (el helper cuenta bien) y la
aserción nueva de `analitica.test.ts` afirma el CABLEADO (que Analítica lo USA).
**Una sola no alcanza:** un helper correcto que nadie consume deja la pantalla igual
de mal que antes. Las dos se vieron fallar contra el comportamiento viejo — la del
helper en sus tres casos de hecho, la del cableado restaurando la exclusión.

**Y el discriminador afirma el HECHO, no la forma.** Un test con mocks pasaba en
verde contra el código defectuoso: el defecto no estaba en el mapeo —los dos sumaban
bien lo que cargaban— sino en QUÉ FILAS cargaba cada uno. Sólo releer contra una base
real lo delata, y por eso va en el carril.

#### Lo que NO entró, con su razón

- **Clientes totales: ya está en pantalla.** Es el denominador de la línea de
  recurrencia ("N de **M** clientes"). Exponerlo aparte serían **dos representaciones
  del mismo número en la misma pantalla** — exactamente la duplicación que el #6
  existía para evitar, y peor que el caso original porque las dos estarían a la vista
  a la vez. Si algún día "cuántos clientes tengo" debe ser respuesta de primer orden,
  eso es **re-jerarquizar esa línea**, no agregar una cifra.
- **Histórico de pedidos: no entra a Analítica.** Ya está resuelto y con test
  (`pedidosDelCliente`, FK pura, § el retiro de Clientes), y su sitio es el PERFIL: el
  histórico de un cliente se lee mirando a esa persona, no respondiendo "¿cómo va el
  negocio?". Traerlo acá habría sido simetría por simetría.

### LA CONCENTRACIÓN · declarar el padrón, y caracterizar sin aconsejar

Tanda 3b (2026-08-21). Tres arreglos que van juntos porque **el porcentaje no se
puede leer sin los tres**. Ninguna base de cálculo se tocó: `pct` es el mismo número.

**1 · EL PADRÓN VA EN LA FRASE.** Decía *"el 63% de tus ingresos viene de 5
clientes"* y el único conteo a la vista era el de **recurrencia** —el padrón entero,
acumulado— en el MISMO párrafo. Medido en dev: **63% calculado sobre 10 pagadores,
junto a un "18 clientes" de otra métrica**. Cada cifra era correcta en su frase; lo
que engañaba era la vecindad. **Es el defecto del § contrato del período en versión
numérica: un número correcto al lado de otro que parece su denominador.** Ahora el
titular carga el suyo —*"5 de los 10 clientes que pagaron"*— y la recurrencia vive en
su propia línea, con etiqueta.

**2 · EL PISO SUBE DE 6 A 15.** El viejo era `TOP_CONCENTRACION + 1`, o sea el mínimo
que evita el 100% trivial: cerraba el caso **degenerado** y no el **casi-degenerado**,
porque con 6 clientes el top-5 es **cinco sextos** del padrón y *"tus 5 mejores son el
90%"* seguía siendo aritmética con forma de hallazgo.

| piso | el top-5 es… del padrón |
| --- | --- |
| 6 (viejo) | 83% |
| 10 | 50% — "la mitad tiene más de la mitad" es casi tautología |
| **15** | **33% — un tercio: puede concentrar sin serlo por definición** |

**Y el argumento que lo decide sobre 20 o 25 es otro** (owner): **15 ES
`MIN_ORDENES_INSIGHT`**, así que la página tiene **UN** número de muestra suficiente y
no dos parecidos que alguien tenga que recordar cuál es cuál. Se **importa** en vez de
re-teclearse, y hay un test que afirma la IDENTIDAD y no el valor, para que mover uno
mueva el otro. Cierra su `TODO(cliente)`.

**3 · LA BANDA CARACTERIZA EL HECHO, y eso NO es interpretar.** La frase neutra **ya
interpretaba por omisión**: el mismo tono para 63% y para 5% le dice al operador que
significan lo mismo, y no es cierto. La doctrina prohíbe la **INSTRUCCIÓN**
("deberías diversificar"), no la **caracterización** — igual que Pagos dice "no entró
ningún pago" en vez de mostrar un cero mudo.

**EL UMBRAL ES RELATIVO, NUNCA ABSOLUTO**, y es lo que hay que retener: uno absoluto
("≥70% es concentrado") miente según el tamaño del padrón — el mismo 63% es casi
neutro con 10 clientes y una alarma con 500. Se compara contra la **parte
proporcional** del top (`top.length / clientes`). Medido en dev el día de la tanda:
el **63,2%** que la página mostraba era contra un proporcional del **50%** —ratio
**1,26**—, o sea **apenas por encima de un reparto perfectamente parejo**, presentado
con tono de alarma. Ése es el defecto que las bandas cierran.

**LA ESTRUCTURA NO CAMBIA ENTRE BANDAS; SÓLO EL ADJETIVO** (owner). Es la propiedad
que permite compararlas de un vistazo entre períodos: lo que cambia tiene que ser UNA
palabra, no el orden de la frase.

- `ratio ≥ 1,5` → *"Tus ingresos están **concentrados**: el 78% viene de 5 de los 25 clientes que pagaron"*
- `ratio ≤ 1,1` → *"Tus ingresos están **repartidos**: el 35% viene de 5 de los 25 clientes que pagaron"*
- en medio → *"El 63% viene de 5 de los 25 clientes que pagaron"* — el hecho, sin adjetivo

La banda del medio **no es indecisión**: es preferir callar a afirmar sin base, con
precedente en el vecindario (`insightEnBanda`). Dos tests la fijan: uno se cae si
alguien reescribe una banda con otro sujeto, y otro barre verbos de consejo en las
tres — la frontera queda afirmada, no confiada a que alguien la recuerde.

Los cortes **1,5 / 1,1 son `TODO(cliente)`**, como los de la cartera. Lo que **no** es
placeholder es la **forma relativa**.

**DOS FIXTURES SE ACTUALIZARON, y conviene el matiz: no se rompieron.** Usaban 10 y 7
clientes, y bajo el piso nuevo dejaron de sostener la afirmación que hacían — que es
exactamente el cambio. Está dicho en cada uno, para que el próximo no los "arregle"
bajando el piso.

**CONSECUENCIA MEDIDA, aceptada antes del gate:** con los **10 pagadores** de hoy el
bloque **CALLA** en los cuatro períodos. Es correcto —10 pagadores no sostienen una
afirmación sobre el top-5— y el owner lo aprobó sabiéndolo: *prefiere verlo callar que
verlo hablar sobre nada.*

### La gráfica de PEDIDOS del carrusel no tiene destino, a propósito

La gráfica de **Ventas** del carrusel del dashboard es clickeable y lleva a
`/admin/pagos?desde&hasta` —bin-ea por `Payment.fecha`, el MISMO destino que la stat
card "Ventas hoy"—. La de **Pedidos NO es clickeable** (2026-08-17, cierre del ex
backlog #7): mide LÍNEAS de producto de órdenes pagadas, no órdenes, así que ningún
destino de Pedidos ni de Pagos coincide con ese conjunto —un enlace
parecido-pero-distinto invita a concluir que la gráfica está mal cuando lo que
estaría mal es el destino—. Se hizo no-clickeable en vez de forzar un filtro
`pagado` que hoy no existe (el carril de estado de cobro se retiró).

**DISPARADOR — se decide al rediseñar Analítica, no antes:** si la gráfica de
Pedidos merece un destino propio que mida lo suyo (líneas de producto pagadas de ese
día), esa es la pantalla que lo define. Hasta entonces no-clickeable es la respuesta
correcta, no una deuda. Esto NO vuelve al backlog.

**EL DISPARADOR SE AFINÓ, y ahora es un HECHO y no una tanda** (owner, 2026-08-20,
tanda 1 de Analítica). El rediseño de Analítica EMPEZÓ y la gráfica **sigue sin
destino**, así que el disparador de arriba se cumplió sin resolver nada — el mismo
error que ya se corrigió en el § Backlog #27 (atar un disparador a una tanda que
después no hace lo que se suponía).

El destino natural existe y está identificado: **Rentabilidad mide EXACTAMENTE el
mismo conjunto** —`OrderItem` de órdenes `pagado`, período por `Payment.fecha`—.
Lo que falta no es el bloque: es que **el chip pueda representar UN DÍA.** Hoy
tiene cuatro presets fijos (`PeriodoKey`), y un clic en el 14-ago no tiene preset
que lo exprese.

**Y "el mes que contiene el día" NO es la salida:** es el parecido-pero-distinto
que esta misma sección rechaza dos veces. La tercera se rechazó explícitamente.

**DISPARADOR REAL: cuando el chip de período pueda representar un día** (rango
explícito o equivalente). Esa decisión se aplazó a propósito en la tanda 1 —
enriquecer un control que la mitad de la pantalla ignoraba habría agrandado la
mentira, y por eso el contrato del período iba primero—. Con el contrato ya
cerrado, el rango explícito es discutible; el enlace sale de ahí, no antes.

**SEGUNDO CASO de la misma regla (2026-08-20, retiro de Entregas):** el widget
`despachos_hoy` quedó NO-CLICKABLE cuando se retiró su viejo destino `/admin/entregas`.
Cuenta envíos que SALIERON hoy (`stock_descontado_at` de hoy); Pedidos no tiene ese
conjunto —`camino` (en_ruta) es un superconjunto de todo tiempo, y `?desde/?hasta` filtra
por creación, no por despacho—. Mismo criterio: sin destino que COINCIDA, no-clickeable,
no un `?f=camino` parecido-pero-distinto. La regla ya tiene dos instancias; es doctrina,
no un caso suelto.

## Sugerencia de zona de entrega (heurística de dirección)

`sugerirZona` (`lib/zona-config.ts`) propone la zona leyendo la nomenclatura de
la dirección — sin geocoding ni red. Es una SUGERENCIA: pre-selecciona el Select
del modal "Programar entrega" y nada más; `zona` siempre es lo que el operador
dejó en el Select. Aparece SOLO en ese modal, nunca mientras se escribe la
dirección en Nueva Orden (fuera de alcance por decisión del owner, 2026-07-29).
Misma forma que el resto del template: resolver genérico + `ZONA_CONFIG` de la
vertical (que el día del multitenant migra a DB scopeada por tienda).

- **Sin ciudad no hay sugerencia** (`null` explícito). Por eso Nueva Orden captura
  Ciudad y Departamento — **ambos OPCIONALES**: la orden manual tiene que poder
  crearse rápido sin ellos, y sin ciudad el modal simplemente no sugiere.
- **`departamento` se VALIDA pero NO se persiste**: `Order` no tiene columna. Es
  deliberado y confirmado por el owner (2026-07-29) — mismo criterio que
  `deliveryAddressSchema` (`lib/validation/address.ts`), donde el departamento
  solo deriva el tier de envío en checkout. **No agregar la columna** hasta que
  algo consuma el dato; un futuro "esto está a medias" NO es un bug.
- **Los umbrales de `ZONA_CONFIG` son placeholder del cliente.** El rango de
  calle 26–99 devuelve `null` A PROPÓSITO (no inventar cortes), y por el umbral
  `carreraOccidenteDesde: 68` una dirección tan común como "Ak 58" tampoco
  sugiere. `Shipping.zona_sugerida` existe justamente para calibrar esto: la
  corrección del operador se DERIVA de `zona_sugerida != zona` — no agregar un
  campo "corregida" que pueda desincronizarse de esa comparación.
- `null` = "no me consta". Preferir callar antes que sugerir mal: una sugerencia
  equivocada que el operador acepta sin mirar cuesta más que ninguna.

## Principio rector del admin — defaults inteligentes sobre opciones explícitas

Decisión del owner, y es de PRODUCTO, no de estilo: **el admin optimiza por
defaults inteligentes, no por opciones. Menos decisiones por operación, no más.**

Cuando el sistema puede inferir un valor con confianza razonable, lo pre-llena y
se calla. NO se agrega un chip que anuncie la inferencia, ni un ajuste de
configuración para desactivarla, ni un toggle de "recordar mi elección". Todo eso
convierte una decisión ahorrada en dos decisiones nuevas —usarla y configurarla—,
que es exactamente lo contrario de lo que se buscaba.

Las tres reglas que hacen que un default sea seguro:

- **Solo llena huecos.** Un default JAMÁS pisa un valor que ya existe. Si el
  campo trae algo, es porque alguien lo puso; una elección humana no se
  sobreescribe sola.
- **Es sugerencia, no decisión.** Lo que se guarda es siempre lo que quedó en el
  campo. El default no viaja al server como dato propio ni se persiste aparte.
- **Preferir callar a adivinar mal.** Sin base para inferir → se deja vacío. Un
  default equivocado que el operador acepta sin mirar cuesta más que ninguno
  (mismo criterio que el `null` de `sugerirZona`).

Ejemplos vivos, los dos en el modal de "Programar entrega": la zona sugerida por
la dirección (`sugerirZona`) y el **mensajero pre-llenado con el último usado**.

El mensajero sale del **último `Shipping` que tenga uno** — cero columnas nuevas,
cero tabla de preferencias, y el dato se mantiene solo porque ES el historial de
despachos. Se resuelve en `/api/orders/[id]/delivery-context` (la fetch que el
modal ya hacía) y no en el cliente, porque el modal se abre desde Órdenes y desde
Entregas y solo una de las dos tiene la lista de envíos cargada; en el server las
dos entradas ven lo mismo, sin endpoint nuevo. Una tienda usa uno o dos
mensajeros durante meses: teclear el mismo nombre en cada entrega es una decisión
que el admin no debería pedir.

**El gate `isScheduledShipping` no cambia.** Pre-llenar un campo no programa nada:
una entrega sigue estando "lista para despachar" solo con mensajero Y fecha, y la
fecha la sigue poniendo una persona.

## Principio rector del admin (Amber Minimal)

El color es información, no decoración. Reglas de sistema (se implementan en los
lugares compartidos, nunca ad-hoc por página; ref. tweakcn Amber Minimal, ~95%
neutro):

- **Un solo primario sólido por vista.** El ámbar sólido (`--primary`, variante
  `default` del Button) es LA acción principal de la página, máx. una (Nueva Orden,
  Nuevo Producto…). Toda acción de fila/tarjeta va `outline`/`ghost` neutra con
  hover de TINTE (`--accent`, ya suave — no rellena). Destructivas de fila:
  variante `destructiveGhost` (tinte rojo suave); el sólido `destructive` se
  reserva al confirm del `ConfirmDeleteDialog`.
- **Estados = semáforo muted** (mapa único en `components/ui/StatusBadge.tsx`):
  ámbar=espera, verde=ok, rojo=alerta, azul=en curso (el único tono informativo),
  gris=neutro. Categorías (zona, canal) van neutras (outline/gris), nunca color
  semántico.
- **EL SOL NO MARCA POSICIÓN.** El indicador de página actual del rail es TINTA
  —superficie elevada (`--duna-surface` + `--duna-shadow-1`) con texto/ícono de
  `--duna-ink` y una barra de 2px de tinta a la izquierda—, NO ámbar. El ámbar/sol
  significa ATENCIÓN; usarlo también para "estás aquí" ponía el mismo color a decir
  dos cosas en la misma lista —el activo era ámbar y el punto de atención de Pedidos
  también—. Ahora **activo = tinta, atención = sol** (el `.duna-nav-dot`, que se
  queda), y se distinguen. Vive en `components/admin/Sidebar.tsx` (NavRow).
- **EL PAR SUPERFICIE + BARRA-DE-TINTA significa "ESTO ESTÁ PUESTO", en TODO el panel.**
  `--duna-surface` (elevada con `--duna-shadow-1`) + una barra de 2px de `--duna-ink` a
  la izquierda es una AFIRMACIÓN del sistema —"esto está puesto / activo / elegido"— y va
  igual dondequiera que ése sea el significado: el activo del rail ("estás aquí") y las
  tarjetas elegidas de "Tu panel" en el drawer de Personalizar son la MISMA afirmación con
  la misma forma. Es TINTA a propósito: no compite con el sol (ATENCIÓN) ni con
  `--duna-bad` (PROBLEMA) —"puesto" no es un estado accionable—. El día que otra superficie
  tenga que decir "esto está puesto", usa este par; no inventa uno.
- **Una sola utilidad de fecha visible**: `formatFecha` (`lib/format-fecha.ts`,
  `14 may 2026`, es-CO/America-Bogota). No `toLocaleDateString` ad-hoc en vistas.
- **Icon chips en familia cálida** — ver la sección de chips arriba
  (`constants/stat-chip.ts`).

El `--accent` de admin-light era `#B45309` (marrón de marca) y volvía marrón todo
hover de outline/ghost/dropdown/select: ahora es un tinte cálido suave. El marrón
vive como `--primary` y en los charts, no como fondo de hover.

### EXCEPCIÓN DECLARADA: el ámbar es MARCA/DATO o ESTADO según el SITIO

`#F59E0B` (= `--duna-sol`) significa ATENCIÓN en el panel, y por eso retiramos el pastel
decorativo, el accent-amber de la campana y el activo del rail. PERO hay sitios donde el
mismo hex NO es estado, y para que un censo de ámbar no los marque como violación, la
regla es una y es de SITIO, no de color:

> **EL SITIO DECIDE.** El ámbar es MARCA / DATO en las superficies de **marca y de dato**
> —el logo, el ÁREA de una gráfica, el marcador de AHORA de la curva del día—; es ESTADO
> en las superficies de **estado** —badges, pills, puntos de atención, fondos de fila, la
> campana, el stat-chip—. Y los dos se ven distinto, lo que hace la regla VERIFICABLE por
> dos ejes que coinciden: **el ámbar-dato es un lavado TENUE (5–10%) o un asset; el
> ámbar-estado es SATURADO (`--duna-sol-soft`/`-ink`, con borde).** Un censo pregunta
> "¿lavado bajo una gráfica / elemento de un logo, o chip/punto/badge saturado?" y
> responde sin criterio.

- **EL LOGO** (decisión del owner, 2026-08-23): el mark trae el sol; un logo es la firma
  del producto, no un semáforo, y pedir una variante sin el sol sería quitarle lo que lo
  hace el logo. Ya vivía en el mark colapsado; el lockup expandido lo lleva a la vista
  siempre.
- **LA DUNA DEL LOGIN — identidad de la puerta, y el caso PRIMARIO de esta rama**
  (decisión del owner, 2026-08-27): las tres pantallas pre-auth (login · aceptar-invitación
  · recuperar-clave) llevan al fondo una duna con un sol que la recorre lentamente (§ el
  componente `DunaPie`). Es MARCA en su forma más pura —la marca contando su metáfora—, una
  TERCERA naturaleza distinta del DATO (curvas del panel) y del ESTADO (badges): **el orden
  de la regla es marca (el logo y ESTA duna) → estado (badges/pills/puntos) → dato (curvas
  del panel).** La curva es **FIJA y dibujada a mano, SIN datos detrás**: el `pathDe` del
  panel deriva su trazo de los buckets, y reusarlo acá obligaría a inventarlos. Se parece a
  las del panel a propósito (línea de tinta a .5 + lavado de sol) y ESO es lo que la hace
  marca. El sol **NO pulsa** —en el panel el pulso significa "ahora", y acá no hay un ahora
  que marcar; sería decoración—: la identidad la lleva el DESPLAZAMIENTO. **Un censo futuro
  que encuentre "una curva con sol y sin datos" tiene que saber que está BIEN: es identidad,
  no un gráfico al que le falten los datos.**
  - **EL SOL SE PONE Y SALE, NO VA Y VIENE** (decisión del owner): la cresta se extiende
    fuera del viewBox por los dos lados, y el sol la cruza en UN sentido —se pone por un
    borde y sale por el otro, con el salto del loop cayendo en las colas invisibles—. Se
    descartó el ping-pong (ir y venir) a propósito: **un sol que va y viene se lee como un
    ELEMENTO ANIMADO; uno que cruza y se pone cuenta el PASO DEL TIEMPO, que es la metáfora
    de la marca.** El rato fuera de pantalla no es un costo —es lo que hace un sol—. Por eso
    el random del arranque SÍ se acota a la parte visible (la primera impresión debe tener
    sol), pero el recorrido no.
  - **El CRUCE VISIBLE tarda 180 s** (~3 min, lento de verdad). Como el path es más largo que
    lo visible por las colas, el `dur` TOTAL se DERIVA para mantener ese cruce (`dur = 180 ·
    total/visible`); hoy son **220 s** totales. Si alguien alarga las colas sin recalcular el
    `dur`, el sol cruzaría la pantalla más rápido —el número que importa es el visible, no el
    total—. (Nota de verificación: `getScreenCTM`/`getBoundingClientRect` NO capturan el
    transform de `animateMotion` en Chromium; el movimiento se comprueba con capturas, no con
    esas APIs.)
- **EL ÁREA DE LAS GRÁFICAS** (decisión del owner, 2026-08-24): el relleno bajo la curva
  de Hoy y la de Pagos pasó de tinta al 5% a un gradiente ámbar 10%→0% (`--duna-sol`). Es
  una superficie de DATO, no un badge — el ámbar acá es firma, no atención. Analítica NO
  se toca (sus líneas son de SERIE y un lavado ámbar debajo chocaría). La opacidad se
  afina por tema en el gate: en oscuro un ámbar al 10% puede glowear o desaparecer.
- **EL MARCADOR DE AHORA** de la curva del día va en SOL, y acá el sol SÍ dice algo: **no
  marca POSICIÓN (el activo del rail es tinta), marca AHORA** — el momento vivo que avanza
  con el reloj y sólo existe en la pantalla del día. Por eso Pagos, que es un libro de
  período, no lo usa. Y va con **anillo** (r=11 al 30%) sobre el punto (r=6): dos
  marcadores distintos —ahora en sol con anillo, pico en tinta— cierran el riesgo de que
  el sol se lea como "aquí está el máximo".

**El residuo es la habituación** —el ojo que ve ámbar en cada gráfica podría dejar de
reaccionar al ámbar que sí pide algo—; se mitiga manteniendo el lavado TENUE (si el área
sube de ~10%, se revisa) y el estado SATURADO. Si algún día el ámbar-dato y el
ámbar-estado dejaran de distinguirse a la vista, el discriminador se rompe y hay que
saberlo: hoy se distinguen.

## La serie categórica — color que IDENTIFICA, no que califica

`--duna-serie-1…5` (`tokens/tokens.css`, claro y oscuro) es un ROL NUEVO en la
paleta, y su novedad es el punto: hasta ahora todo color del sistema significaba
ESTADO —sol=atención, ok=confirmado, bad=problema, más la tinta neutra—. Una serie
de gráfico no es ninguno de esos: no califica un hecho, sólo **distingue una
categoría de otra** (los métodos de pago del modo método de Pagos, p. ej.). No cabía en
ningún rol existente, así que es su propio rol.

- **La serie NUNCA se usa donde haya estado.** Ni en badges, ni en pills, ni en
  puntos de atención, ni en un semáforo. **Sólo en gráficos con categorías.** Un
  color de serie en un badge reintroduce exactamente la ambigüedad que Amber Minimal
  cierra —"¿esto es una categoría o me está diciendo algo?"—. El sitio de la serie
  es el área/línea/barra de un chart y su leyenda, nada más.
- **serie-5 es el NEUTRO por diseño** (el residual "Otro"): una categoría cajón-de-
  sastre no debe gritar más que las nombradas.
- **El criterio para una serie-6, escrito para que no se pierda:** se mide contra
  **sol, ok y bad en los DOS temas** (ΔE2000). Si compite con un estado, **se mueve
  la SERIE, no el estado — el estado manda.** Ya pasó: la serie-4 nació teal
  (`#356E78`) en la maqueta y competía con `ok` verde (ΔE2000 18.4 claro / 16.3
  oscuro, el par más ajustado de la paleta y contra un estado); se movió a cyan
  (`#2496AB` / `#52C0D6`), que sube ese par a 24.7 / 22.8.
- **El piso medido de la paleta contra estados es ~22 ΔE2000 en ambos temas.** Hoy
  el par más ajustado es **serie-1↔ok = 22.1 (oscuro)** —una crema casi blanca
  contra un verde menta, sin riesgo real—. Ése es el número contra el que una serie
  nueva se compara: si baja de ~22, hay que moverla. Los números viven también en el
  bloque de `reference.html` que ejercita las cinco.
- **Se ejercitan las CINCO juntas, en el mismo cuadro de 9px**, en `reference.html`:
  lo que hay que poder ver de un vistazo es que se distinguen ENTRE SÍ y de los
  estados al tamaño real de un chart, no una por una.

## Listas tabulares del panel — grid-list por defecto, no `<table>`

**El patrón por defecto de una lista de datos del panel es el grid-list**
(`.duna-lista`, `packages/design-system/primitives/primitives.css`): filas que son
`display: grid`, con encabezado `position: sticky` y **sin envoltorio de overflow
propio**. NO es cosmético:

- **En móvil REFLUYE** (a dos columnas) en vez de scrollear horizontal. El scroll
  horizontal de una tabla de datos es pésimo al tacto —se pierde la columna de
  referencia—; un grid-list re-fluye a un bloque. Como el encabezado se oculta en el
  reflujo, cada celda con `data-label` trae su columna INLINE (un caption muted encima
  del valor, sólo <960): así "38" no queda sin decir si es cantidad o saldo. Sólo las
  celdas con `data-label` lo muestran; una identidad o un spacer no lo lleva.
- **El sticky del encabezado funciona en un scroller COMPARTIDO.** Cuando algo scrollea
  ENCIMA de la lista en el mismo scroller —el strip de Pagos—, el `overflow-x` del
  envoltorio de un `<table>` capturaba el sticky y se lo llevaba al scrollear. **Medido,
  no deducido** (repro con strip + tabla + wrap: el thead se despega). El grid-list, sin
  overflow propio, deja el sticky pegado al scroller de la región. Cuando la lista es el
  hijo ÚNICO de la región (Inventario), ella misma ES el scroller y su `__head` pega
  contra ella —el patrón sticky canónico—; medido en los dos casos.

**Extraída al DS como `.duna-lista` el 2026-08-18** (era admin-level como `.admin-lista`
mientras tuvo un solo consumidor). La regla que se cumplió: una clase entra al paquete con
nombre `duna-` cuando hay un SEGUNDO consumidor —Pagos + el kardex de Inventario—, no
antes; con uno solo, admin-level, para no aparentar una primitiva que no está en el
paquete. **`DunaTable` se retiró** en la misma tanda (su único consumidor era el kardex);
ya no hay dos patrones para lo mismo.

### El número alineado a la derecha va en MEDIO, nunca al borde

Regla de ORDEN de columnas, común a las tres listas del panel (2026-08-23). El dinero y
los conteos se alinean a la derecha (`.duna-lista__r`, unidades bajo unidades), pero su
columna va **en el medio de la fila, seguida de más columnas** — **nunca la última**. Las
tres lo cumplen: Pagos (`Monto` 4ª de 8, con Método/Referencia/Registrado después),
Inventario (`Cantidad`/`Antes→Después` 3ª–4ª de 7, con Motivo/Quién/Fecha después) y
Órdenes recientes del Dashboard (`Total` 4ª de 5, con Estado después).

**Mover el dinero al final crearía una SEGUNDA convención** —una lista con el número al
borde derecho contra dos con el número en medio— y casi pasa: el `Total` de Órdenes se veía
"flotado a la derecha" y la salida tentadora era ponerlo último. No era el orden: era el
ANCHO. `Total` estaba a 112px (contra los 96px de `Monto` en Pagos), así que la cifra
right-aligned tenía más aire vacío a su izquierda. **Se igualó a 96px** —el mismo ancho del
dinero en las tres— y el flote se fue sin tocar el orden ni la alineación.

**Residuo aceptado:** la columna que sigue al número en Órdenes es un BADGE (Estado),
donde Pagos e Inventario tienen TEXTO. El mismo gap de 12px se lee un poco más apretado
junto a un chip con borde; es inherente a que esa lista tiene estado donde las otras tienen
metadatos, y separarlo (reorden o Estado a la derecha) divergiría de las otras dos. Se deja.

## Pagos — la FRASE y la CURVA (tercer y último rediseño)

Cerrado el 2026-08-19. La pantalla abre diciendo la RESPUESTA y el gráfico **no
scrollea**. Reemplazó al strip de barras y a la cabecera de título + stat.

### La anatomía: qué es fijo y qué scrollea

**Zona fija:** la frase (+ subtítulo) · los filtros · el gráfico. **Región (1fr):** el
libro y NADA MÁS, así que es su hijo ÚNICO —el caso sticky canónico, medido: el
encabezado del grid-list queda a delta 0 del tope al scrollear—.

**El gráfico fijo cuesta alto de cabecera, y ése es el presupuesto de la pantalla.**
La zona fija debe dejar **≥5 filas de libro** en la pantalla restrictiva. La cuenta se
hace con la fórmula, no a ojo:
`filas = floor((viewport − topbar 64 − padding 24 − zona fija − head 40) / fila 46)`.
**Medido hoy: zona fija 281px → umbral de 639px de viewport para 5 filas.** **Nunca se
recorta la lista.**

Los levers, en orden, con lo que YA se ejerció y lo que queda:
- **la tarjeta del gráfico — ejercida (−44)**. Ver el hallazgo de abajo.
- **el alto de la curva — ejercido (170 → 140 → 110, −60)**. **100 es el piso de
  legibilidad**: por debajo los picos se comprimen y la curva se lee como textura, no
  como magnitud.
- **el eyebrow del rango — ejercido**: ya se lee en el date picker.
- *quedan*: el hint (22px), los gaps (8px) y H de 110 a 100.

**HALLAZGO, y es lo que hay que retener para el próximo gráfico que alguien monte:** una
tarjeta con borde, padding y cabecera propios alrededor de un gráfico que YA vive en la
zona fija es **chrome sobre chrome** —y su cabecera ("Ingresos por día") duplicaba el
hint de abajo ("Un punto por día · clic para acotar…")—. **Un gráfico puede ir directo
sobre el fondo**, y ése es el PRIMER recorte cuando un presupuesto no cierra: vale más
que bajar el alto (44 contra 30) y **no toca el gráfico**, sólo su envoltorio. Acá se
ejerció por eso: con la tarjeta el umbral eran 713px de viewport, que deja fuera a un
portátil con resolución escalada. El `__head` sobrevive SÓLO en el modo método, donde el
eyebrow es la única etiqueta del eje (no hay hint que lo duplique).

### La frase reemplaza al título, al descargo y al stat

`lib/pagos/frase.ts` (puro, capa 1). "Este mes entraron **$ 315.000** en **11 pagos**."

- **Sale en TRAMOS, no en un string**: la cifra y el conteo van en semibold, y un string
  obligaría al componente a re-partirlo con un regex — donde la tipografía se
  desincroniza de la gramática.
- **La CONCORDANCIA es del ALCANCE, no del monto**: singular con un bucket o con un
  solo día ("El jue 14 ago entró…"), plural con un período. Por eso vive en `lib/` y no
  en el JSX: un `if` cambiado ahí rompe la frase sin que nada lo note.
- **El VACÍO es la MISMA frase** ("Este mes no entró ningún pago por Daviplata"), nunca
  un "sin resultados" que hace dudar del filtro. Su subtítulo lo dice: "No es un error
  del filtro: simplemente no hubo".
- El sujeto reusa `PERIODO_SUJETO` (§ Analítica) — un chip y una oración piden gramática
  distinta.
- **El "mejor día" sólo si la curva DIBUJA y no hay bucket recortado**: dentro de un solo
  día no hay días que comparar, y sin curva no hay de dónde leer ese pico (§ preferir
  callar).

### La curva

- **Catmull-Rom → Bézier**: pasa POR los puntos, que es lo que hace que el marcador del
  pico caiga exactamente sobre la curva. **Los controles se ACOTAN a la caja**: con picos
  y ceros la spline se pasa de largo y el área se dibujaría bajo el eje — se lee como un
  negativo que no existe.
- **El área va en ÁMBAR** (gradiente `--duna-sol` 10%→0%), desde 2026-08-24. Antes era
  tinta al 5%; el owner llevó el área de las gráficas a ámbar como firma de dato (§
  EXCEPCIÓN DECLARADA: el ámbar es marca/dato o estado según el SITIO — un lavado tenue
  bajo una gráfica es dato, no atención). El % del tope se afina por tema en el gate.
- **Los TRES marcadores siguen en TINTA**: pico (relleno + cifra abreviada), hoy (hueco),
  selección (anillo). Pagos es un libro de PERÍODO, no tiene "ahora", así que —a
  diferencia de la curva de Hoy— no lleva marcador de sol. El ámbar entra sólo por el
  área.
- **El ancho se MIDE** (ResizeObserver) y no se asume: un viewBox estirado deformaría
  trazo y tipografía. Va por **callback ref**, no por `useRef` + efecto `[]` — ver el
  defecto de abajo.
- El eje posiciona cada etiqueta bajo SU punto (máx ~8 visibles); un flex las repartiría
  parejo y mentirían de posición. El hint declara escala e interacción, que no es obvia.
- **EL TOTAL DEL BUCKET ES ALCANZABLE EN TÁCTIL — cerrado el 2026-08-20 (era backlog
  #30), sin código.** El ítem asumía que el hover era la ÚNICA vía al total, y estaba mal
  diagnosticado. Gate en teléfono real del owner: **tocar un punto ACOTA** —el `mousemove`
  sintetizado del tap setea el punto y el `click` dispara `onBucket`—, así que **la frase
  de arriba pasa a "El jue 14 ago entró $X en N pagos" y el libro se filtra a ese día**. El
  total no vive sólo en el tooltip: vive en la frase, que es persistente y no depende de un
  hover. La silueta sin cifras que el ítem temía no ocurre. (El gate destapó dos defectos
  PROPIOS —el tooltip que se queda pegado en táctil, y los botones de tema del sheet móvil—;
  son otros ítems, no éste.)
- **La curva NO se apila por método** (una curva apilada no existe), y por eso murieron
  el toggle "Por método" y la leyenda de exclusiones. **CAPACIDAD PERDIDA, escrita:** ya
  no se puede EXCLUIR un canal de la vista de tiempo. Decidido y aceptado — el desglose
  por método vive en el modo método y en el select.
- **Bespoke admin, no primitiva del DS**: no hay primitiva de chart, y con un consumidor
  no se justifica.

### El DEFECTO del observer, que va a volver si alguien copia este gráfico

En modo método → "Limpiar filtros", la curva dejaba de dibujar y el eje aparecía apilado.
**Medido, no deducido:** al observar, el RO avisa el ancho; **al desmontarse el nodo avisa
`width: 0`**; con el nodo nuevo **no vuelve a avisar** —sigue mirando el viejo—. Como el
bloque se remonta al cambiar de eje (`key={modo}`), un efecto con deps `[]` lee la caja
UNA vez y nunca se entera. Con `ancho` en 0 no hay curva, y cada etiqueta del eje cae en
`left: 0` (por eso se veían encimadas: no era un eje de un solo bucket).

**La forma correcta: callback ref** —se engancha y desengancha con cada nodo— **y se
IGNORA la notificación de ancho 0**, que no es una medida sino el nodo saliendo del DOM.
Es más robusto que agregar `modo` a las deps: no depende de que alguien mantenga la lista.

**Y por qué "Hoy" NO lo reproducía**, que es lo que lo volvió difícil de creer: con ese
preset cambia el RANGO → refetch → `setLoading(true)` desmonta el componente entero → el
remonte ACCIDENTAL re-enganchaba el observer. Clickeando un punto el rango no cambia, no
hay remonte, y ahí sí rompe. **La diferencia nunca fue × vs "Limpiar filtros": es si el
rango cambió.** No es observable en capa 1 —el repo no tiene harness de render— así que
su verificación es capa 3; no se inventó un harness para simularlo.

### Reglas que se conservan del strip

- **Una FUENTE alimenta frase, gráfico y libro**: `pagos` (el recorte del rango, ya en
  SQL). El filtro es composición client-side de **método** (el select) y **bucket** (clic
  en un punto). El gráfico no re-consulta —por eso esta tanda NO tocó el fetch (§ #27)—.
- **La escalera y el anclaje viven en `lib/pagos/bucketeo.ts`** (puro, capa 1): ahora
  **TRES peldaños con tope de 92 PUNTOS** (día → semana → mes). Tres y no cinco porque una
  CURVA admite muchos más puntos que una barra (uno cada ~10px se lee; una barra de 10px
  no): el día llega a un trimestre y el mes cubre 7½ años, así que trimestre y año
  quedaron sin trabajo. **Los DOS extremos DECLARAN** en vez de dibujar algo que no
  informa: >92 meses y <4 puntos. **Las semanas se anclan al CALENDARIO (lunes Bogotá)**,
  no al inicio del rango, o la misma semana suma distinto según por dónde se entró. El
  primer y último punto pueden ser PARCIALES y se DECLARAN en el eje.
- **El chip del bucket se conserva** en la fila de filtros como etiqueta legible + ×, y su
  etiqueta se entiende SOLA ("jue 27 ago", "semana del 10 ago"), nunca "1 seleccionado".
  Con la curva siempre visible el anillo ya muestra la selección, así que **no se duplica
  en el gráfico**.
- **Colores `--duna-serie-1…5` SÓLO en el modo método** (serie-5 = OTRO, el neutro). La
  curva es tinta; nunca estado.

### El eje cambia cuando el recorte es 1 bucket, y EL EJE NUNCA SE FILTRA A SÍ MISMO

El gráfico tiene DOS ejes intercambiables: **tiempo** (4–92 puntos, la curva) y **método**
(cuando el recorte activo es UN bucket —"Hoy", un rango de 1 día, o un clic en un punto/
fecha—, una barra por método). **Un bucket → modo método, NUNCA el mensaje de colapso**;
entre 2–3 buckets no hay forma en ningún eje → se declara ("dos o tres períodos no dibujan
una tendencia — la frase de arriba ya lo dice mejor"); >92 meses tampoco.

**LA REGLA, y es general para cualquier gráfico con ejes intercambiables:** el eje que
se está mostrando NO se filtra a sí mismo. El modo tiempo filtra por MÉTODO (el select);
el modo método filtra por TIEMPO (el bucket). En modo método el select NO recorta las
barras —serían una sola, que no informa—: se muestran las cinco y se resalta la activa,
y **una nota lo DECLARA** ("el desglose es del período; la tabla está filtrada a X"),
sólo cuando el caso ocurre —cinco barras sobre una fila filtrada se leería como fallo—.

**Cada filtro vive en su propio control, y ahí está el "nunca un segundo indicador":**
el TIEMPO en el chip (clic en un punto o en una celda de fecha lo escribe), el MÉTODO en
el select (clic en barra de método o en una celda de método lo escribe). No se inventa un
tercer sitio; cada uno reemplaza al anterior de su tipo (toggle: clic en el activo lo
quita). En modo método el toggle "Por método" se **oculta** (el eje YA es método) —no se
deshabilita, que sugeriría algo que activar—.

- **Celdas navegables** (`duna-lista`): la fecha y el método de cada fila son caminos a
  esos mismos filtros (chip de tiempo / select), con afordancia `.duna-link` —sin color
  nuevo—. Filtrar por una fecha colapsa el recorte a 1 día → el gráfico entra al eje de
  método solo, por el mismo estado.
- **El recorte de tiempo (`RecorteTiempo`) lleva su `escala` y su `etiqueta`**, para que
  un clic en un punto (bucket a la escala de la curva) y uno en fecha (siempre 'dia') tengan
  la misma forma y el chip se pinte solo.

### El INFORME (PDF) — la primera acción de un libro de sólo lectura

Cerrado el 2026-08-19. Pagos se definió como libro de sólo lectura y el informe **no
rompe esa definición**: descargar no escribe. Pero es su PRIMERA acción, y por eso el
botón va **secundario, nunca primario** —esta pantalla no tiene una acción principal que
ofrecer— y vive al final de la fila de filtros, empujado a la derecha: es una ACCIÓN, y
mezclarlo entre los controles del recorte lo haría parecer un filtro más.

**Se genera en el CLIENTE, y el argumento es de FUENTE ÚNICA.** El modelo se arma con
`filtered` y la misma frase que la pantalla ya tiene; un endpoint sería una **segunda
lectura del mismo recorte** —justo lo que esta pantalla se construyó para no tener— y
podría devolver un conjunto distinto del que el operador está mirando. El costo aceptado
es que sólo puede imprimir lo que ya está en memoria, que hoy es el rango completo
(`/api/payments` no tiene `take`).

**TRES CAPAS: modelo ≠ layout ≠ bytes.** `lib/pagos/informe.ts` dice QUÉ lleva el
documento y no renderiza nada —por eso se afirma en capa 1 sin generar un PDF—;
`informe-pdf.ts` lo pone en páginas; los bytes los pone **jsPDF**, cargado con `import()`
DINÁMICO para que sus ~129 KB gzip no viajen en el bundle de Pagos (verificado sobre el
artefacto: el manifest de la ruta lista 7 chunks y ninguno lo contiene).

**jsPDF y no pdf-lib**, pese a pesar ~40 KB más (owner, apartándose de la recomendación
de esta sesión): pdf-lib lleva cuatro años sin publicar. El FORMATO PDF está congelado,
pero el ENTORNO no —navegadores, bundlers y APIs de descarga sí se mueven—, y una
librería quieta no recibe el parche cuando algo de eso cambia. El costo entonces no son
40 KB: es un botón roto sin nadie a quien reportarle, y acá no hay equipo que forkee una
dependencia abandonada. **Se descartó el writer a mano** de `duna-owner-ui` (1.873 líneas
propias, con sus dos trampas de bytes documentadas): su repo tiene 4 dependencias y el
nuestro 47 — la austeridad no es nuestra restricción, y un writer de PDF para un botón de
descarga es superficie que no queremos mantener.

**EL TOPE ES DEL DOCUMENTO, NO DE LA CONSULTA: 1.000 filas** (≈25 páginas, el límite de
lo que alguien abre). Corta conservando las PRIMERAS y **lo declara EN EL PDF**, no en la
pantalla: quien lo abra tres días después no vio ningún aviso. La nota dice las DOS cosas
—que el detalle está topado y que el resumen y el desglose NO lo están— porque que el
desglose sume más que el detalle es la clase de discrepancia que hace dudar del documento
entero, y quien la note no tiene a quién preguntarle.

#### UN DOCUMENTO NECESITA MÁS CONTEXTO QUE LA PANTALLA, NO MENOS

El spec de esta tanda decía *"nada que no esté en la pantalla"* y **estaba mal**: ese
criterio vale para los NÚMEROS, no para el CONTEXTO. Un PDF sin nombre de negocio, sin
fecha de generación y sin paginación es una tabla volcada — quien lo encuentra impreso no
sabe de qué negocio es, de cuándo, ni si le falta una hoja. Nada de eso es un dato del
recorte: son **metadatos del documento**, y su ausencia no se nota hasta que el documento
sale de la pantalla, que es exactamente lo que un informe existe para hacer.

La regla, generalizada: **la pantalla puede callar lo que el operador ya sabe porque está
mirándola; un documento no puede callar nada, porque se lee lejos y sin poder preguntar.**

De ahí sale también el caso más fino de la tanda: **el desglose por método se muestra
SIEMPRE, aunque el select filtre**, y rotulado. Con el detalle acotado a Nequi, el
"Total" del resumen es sólo de Nequi, y **sin ese bloque nadie sabe que hay más plata
fuera de ese número**. En pantalla el operador puede quitar el filtro y ver el contexto;
en un PDF no puede. Se resuelve ETIQUETANDO, no ocultando: una bajada que nombra el
método (*"Del período completo, sin el filtro de método. El detalle de abajo desarrolla
sólo Nequi."*) y la fila en NEGRITA —el peso es el puntero, el significado lo da la
bajada—. Un filtro de GRUPO ("Cualquier digital") marca sus TRES filas: marcar una sola
mentiría sobre qué desarrolla el detalle.

El array del desglose **se DERIVA, no se consulta**: `filtered` se partió en dos pasos y
la relación quedó explícita —`enBucket` (rango + bucket, sin método) ⊇ `filtered`—, así
que las dos cifras del documento salen del mismo array en memoria.

Detalles que son decisión: la participación **no se re-basea** por el filtro (re-basear
escondería que se mira un recorte, misma regla que tenía la leyenda del strip); los
métodos **sin un solo pago se omiten** —una línea en "$ 0 · 0 %" es ruido— salvo que el
select filtre a uno que quedó en cero, que SÍ se muestra porque si no el desglose no
nombraría en ninguna parte al método del que habla el documento; y la marca de tiempo usa
`formatFecha`, la utilidad única de fecha del panel, no un segundo formato.

#### DOS LECCIONES DE VERIFICACIÓN, las dos pagadas en esta tanda

**1. Un test de MODELO no ve una capa que no lo lee.** Al insertar las secciones nuevas,
la edición del renderer se llevó por delante el bucle de filas y el PDF salió con el
encabezado del detalle y NINGUNA fila. El test del modelo afirmaba `m.filas` y **pasó** —
correctamente, porque el modelo sí las producía—. El discriminador tiene que vivir donde
vive el bug: `informe-pdf.test.ts` afirma el CONTEO DE PÁGINAS (300 filas pasan de una
página), corre en capa 1 porque jsPDF funciona en node, y **se lo vio fallar con el bucle
neutralizado**.

**2. Un discriminador que mide contra lo NOMINAL da verde sobre lo roto.** Las columnas se
superponían porque el cálculo de posiciones devolvía una más que las columnas, y cada
celda se recortaba contra su ancho nominal en vez de contra el espacio real hasta la
columna siguiente. Mi primer test lo medía **también contra el nominal** y pasaba con la
geometría rota. Ahora afirma contra dónde empieza la columna siguiente —lo que se ve en el
papel— y falla con la fórmula vieja. Es la misma familia que el `grep` del símbolo
reubicado (§ GATE DE CAPA 3): **verificar contra lo que el código DICE en vez de contra lo
que el usuario VE deja pasar justo el defecto que se buscaba.**

## La PANTALLA de Automatizaciones — el rediseño Duna

Rediseño del 2026-08-21. La pantalla existe para que el operador **confíe en que
las automatizaciones funcionan cuando no pasa nada** —una que hace bien su trabajo
es invisible, y esa invisibilidad es la única duda que importa: "¿está prendida y
no hay casos, o está rota?"—. Esto es la PANTALLA; el motor tiene su propia sección
abajo.

### La anatomía

- **Rejilla de tarjetas** (3/2/1), **document-scroll** — las 8 caben casi de una, así
  que el alto fijo sería complejidad sin pago. Es una de las cinco pantallas de
  contenido que van document-scroll a propósito (§ Los DOS modelos de scroll conviven
  a propósito — el estado final, ya no un disparador que cumplir).
- **Cabecera eyebrow + título + nota.** Los tres stats viejos (activos / disponibles
  / ejecuciones totales) se retiraron: dos duplicaban lo que las tarjetas dicen y el
  tercero era un acumulado incomparable.
- **Dos grupos con su hecho de nacimiento** ("nacen encendidas" / "nacen apagadas"),
  que es la regla de `defaultActivo` por canal hecha visible.
- **Roll-up de fallo condicional** (rojo, `--duna-bad`): el ÚNICO vital que sobrevive,
  y sólo aparece con ≥1 fallo. Una tarjeta con fallo puede quedar fuera de vista; el
  roll-up en la cabecera no. Cero ámbar en la pantalla.

### La tarjeta: nombre + switch + disparo-con-valor + silencio + señal de vida

- **`.duna-switch`**, sin chip pastel ni etiqueta "Activa/Inactiva" (la dice el
  switch). El **chip pastel se retiró CON su uso, no con su constante**: el campo
  `color` del registry y el import de `STAT_CHIP` se fueron, pero `STAT_CHIP` VIVE
  —la comparten StatCard y dashboard-widgets—. Quien lea "el pastel se retira" no
  debe buscar la constante.
- **`def.icono` EL CAMPO SE QUEDA** (sólo se fue su render en la tarjeta): lo lee la
  campana por tipo (`NotificationBell`, `AUTOMATION_MAP[tipo].icono`). El censo lo
  atrapó; **NO proponer su retiro** —sería `Customer.activo` al revés: un campo que
  SÍ se renderiza, en otra superficie—.
- **LA FRASE CON EL VALOR CONFIGURADO.** La tarjeta dice "Avisa cuando lleva **3**
  días despachado sin cobrar", no "hace días": **un ajuste que no se ve en la tarjeta
  deja al operador sin saber cómo está configurada su automatización.** Es `def.frase
  (config)`, función del config, y se afirma en capa 1 que LEE el config (un valor
  distinto del default debe aparecer; se vio fallar quemando la frase a literal).
  `def.disparador` NO se convirtió en función —lo lee el diálogo de Ajustes, que
  queda intacto—; son dos voces del mismo hecho, y su unificación está en el §
  Backlog #39 con disparador = la migración del diálogo a DunaDialog.
- **La regla de silencio es un HECHO declarado** (`def.silencio`, la FORMA: una vez /
  espera / diaria / semanal); el intervalo del cooldown vive en Ajustes.
- **Señal de vida, 4 estados excluyentes** (`estadoDeVida`, derivada de `activo` + el
  último run que cuenta): viva / sin_casos / fallo / apagada. **"Sin casos" va a
  secas**: NO hay dato honesto de "desde cuándo vigila" —`AutomationSetting` sólo
  tiene `createdAt` (primer toggle) y `updatedAt` (se mueve con cualquier config), y
  las default-on nunca tocadas ni tienen fila—. No se inventa la fecha ni se agrega
  columna.

### Los DOS accesos, distintos porque son dos cosas distintas

La maqueta los unía en un drawer; **se siguió la decisión escrita, no su forma.**

- **"Ver lo que hizo" → ACORDEÓN INLINE** (`Pliegue`): es LECTURA, el catálogo sigue
  visible. El historial se pide al ABRIR (el `Pliegue` sólo monta sus children
  abierto → fetch lazy, no se piden los 8 si no se abre ninguno). El fallo de carga
  se hace visible con "Reintentar" (§ Backlog #33), no se traga.
- **"Ajustes" → DIÁLOGO** (`AutomationConfigDialog`, shadcn, intacto): es EDICIÓN.
  Sólo en las que tienen campos —un diálogo vacío es una pregunta sin respuesta—.

### El historial: el corte, y los dos números que no son el mismo a propósito

- **EL CORTE es ENVIADO + FALLIDO** (`ESTADOS_HISTORIAL`, `lib/automations/historial`).
  Fuera DUPLICADO (**un silencio deliberado no es un hecho** — un historial que lista
  cien "se calló" ahoga la pregunta "¿qué hizo por mí?"), OMITIDO ("por qué no se
  disparó", diferido al backlog) y PENDIENTE_CANAL (WhatsApp, no se renderiza). El
  corte se afirma en el CARRIL —visto fallar con un DUPLICADO y un OMITIDO sembrados,
  que devuelven 5 en vez de 2—, porque un test con mocks pasaría contra el `where`
  defectuoso.
- **50 Y 5 NO SON EL MISMO NÚMERO, A PROPÓSITO.** `CAP_HISTORIAL = 50` acota la
  CONSULTA (barato, y deja servida una futura vista de historial completo); el
  **vistazo son 5**, cortadas en el cliente, porque 50 entradas apiladas vuelven la
  tarjeta de miles de píxeles y al empujar el catálogo rompen lo que motivó elegir
  acordeón sobre drawer. Cuando hay más de 5 se declara con separador —"Las 5 más
  recientes · ha actuado más veces"—, sin prometer una vista que no existe. **No
  unificar 50 y 5.**
- **El "sobre qué" sale del `payload`** que el run ya guarda (el mensaje humano, con
  `href` al pedido), no de un join del `targetId`.

### `waOperativo` — el gate único de WhatsApp

- **Una definición** (`lib/automations/whatsapp-operativo.ts`), **dos consumidores**:
  el SENDER (el envío real a Meta irá en su rama `true`) y el RENDER (el endpoint
  omite las 4 de WhatsApp mientras sea `false`). Dos lecturas separadas de las env
  vars divergirían —una se renderizaría como operativa mientras la otra no envía—;
  es el modo de falla de `razonDelServidor` y `cruzoMinimo`.
- **El código de WhatsApp sigue VIVO** —handlers, plantillas, el pipeline entero—;
  lo único gateado es el RENDER. Con `false` (todo entorno real hoy: sin credenciales
  de Meta) la pantalla muestra 8, no 12; es ocultar capacidades no-operativas, no
  roadmap (precedente Wompi).

### `items-start` en la rejilla, y lo descartado

La rejilla usa `align-items: start` para que abrir un acordeón crezca **sólo esa
tarjeta**. El efecto lateral —las cerradas de una fila difieren ~una línea (la regla
de silencio envuelve o no, ~18–36px)— es el precio correcto frente a lo descartado:

- **`stretch`** iguala las cerradas pero estira las vecinas al alto de la abierta
  (~440px con 5 entradas) → ~250px de VACÍO en cada una, en la interacción principal;
- **`min-height` = la más alta cerrada** miente en 2 de las 3 anchuras (a 2 y 1
  columnas se envuelve menos) y se desajusta con cualquier cambio de copy;
- **`stretch` condicional** (igualar salvo con un acordeón abierto en la fila) NO es
  viable en CSS puro —las filas del grid no son direccionables— y con JS es
  complejidad de layout por ~una línea.

Está escrito en el CSS de la rejilla para que nadie lo "arregle" a `stretch`.

## Automatizaciones — arquitectura y prerequisitos de go-live

El CATÁLOGO vive en el código (`constants/automations.ts`): key estable
snake_case, canal, tipo (`evento` | `programada`), audiencia, disparador,
estrategia de idempotencia, `configSchema` (zod con defaults) y plantillas.
La DB guarda SOLO la decisión del owner: `AutomationSetting` (activo +
overrides de config) y `AutomationRun` (bitácora de toda ejecución, y el
gate de idempotencia). Mismo patrón que el registry de widgets: la FORMA
es del template "Comercio Digital", el CONTENIDO es de esta vertical.

- El motor (`lib/automations/engine.ts`) es fire-and-forget respecto al
  negocio: `runEventAutomations` se llama SIEMPRE post-commit y jamás
  lanza. Una automatización rota no puede tumbar una venta, un despacho
  ni un ajuste de inventario. Todo error se vuelve run `FALLIDO` + log.
- El orden es despachar → registrar, no al revés. Deja una ventana teórica
  de duplicado si el proceso muere en medio; se acepta porque el orden
  inverso cambia ese riesgo por uno peor (marcar como hecho algo que nadie
  recibió). **Perder un mensaje es peor que repetirlo.**
- Los disparadores de CONDICIÓN (stock bajo) se evalúan en el EVENTO que
  cambia el valor y disparan solo al CRUZAR el umbral, usando el helper
  compartido `isLowStock` — NO una comparación propia. Si el aviso usara un
  criterio distinto del que pinta la card de Alertas de Stock, la card y la
  lista dejarían de reconciliar.

### Prerequisitos de go-live del canal WhatsApp (Meta)

`lib/automations/channels/whatsapp.ts` es un stub deliberado: todo el
pipeline corre y el run queda `PENDIENTE_CANAL` con el mensaje renderizado
en `payload`. Antes de conectar el adaptador real:

- **`PENDIENTE_CANAL` es un LOG, nunca una cola.** Un run en ese estado
  registra lo que se habría enviado; no es un mensaje esperando turno. Al
  conectar Meta, el backlog acumulado se marca EXPIRADO — no se despacha.
  Solo los eventos NUEVOS usan el canal real. Enviar el backlog sería
  mandarle a un cliente la confirmación de una orden que ya recibió hace
  semanas, o recordarle un pago que ya hizo: ruido que quema la reputación
  del número y dispara reportes de spam en Meta. La migración de go-live es
  por tanto un `UPDATE` de estado, no un reproceso.
- **Política de reintentos de runs `FALLIDO` — PREREQUISITO, no opcional.**
  Hoy un `FALLIDO` cuenta como "ya corrió" y no se reintenta: para los
  `una_vez` (recordatorio de pago) eso quema esa orden para siempre. Con el
  canal en stub el costo es cero; con Meta conectado es plata perdida.
  Ojo con la interacción: la política de reintentos debe distinguir un
  `FALLIDO` reciente (reintentable) de uno viejo, o resucitará mensajes
  igual de rancios que el backlog `PENDIENTE_CANAL`. El mismo criterio de
  frescura que ya aplica `recordatorio_pago` con `maxEdadDias`.
- **`reactivacion_cliente` tiene DOBLE prerequisito** y no debe activarse
  hasta cumplir ambos: (a) canal Meta conectado, y (b) campo de
  consentimiento de marketing en `Customer`, capturado en el checkout. Es
  la única plantilla MARKETING (las otras son UTILITY): exige opt-in previo
  y tiene otro costo; categorizarla UTILITY para saltarse el opt-in es la
  causa #1 de suspensión de plantillas. Conecta con las páginas legales
  pendientes (Ley 1581) — ver `siteConfig.legalNav`, hoy vacío.
- **PRECONDICIÓN de brand (Fase A, 2026-08-09) — antes de activar cualquier
  automatización `email` + `audiencia: 'cliente'`, PARAMETRIZAR su canal con
  `brand`, igual que se hizo con notifications en Fase A.** Hoy el canal email de
  automatizaciones (`lib/automations/channels/email.ts`) inyecta `buildBrand()`
  localmente para satisfacer la firma de `sendCustomerEmail`, PERO ese path de
  cliente está MUERTO (cero automatizaciones `email`+`cliente` en el catálogo; las
  dos de email son `audiencia: 'equipo'`, identidad del panel vía `EMAIL_FROM`).
  Cuando ese path se active y el motor se mueva a `packages/core` (Fase B / go-live
  WhatsApp), el `brand` debe THREADEARSE por el evento —igual que
  `notifyOrderCreated(orderId, brand)`— no leerse de `siteConfig` dentro del motor:
  core no conoce el tenant. Deuda anotada, no oculta.

### `defaultActivo` se decide por el DESTINATARIO del canal

Regla general del catálogo, no caso por caso — así una automatización nueva se
clasifica sola:

- **canal `interno`** (la campana; le habla al OPERADOR en su propio panel) →
  **nace ENCENDIDA**. No cuesta por mensaje, no depende de terceros, no requiere
  consentimiento de nadie. Una campana que hay que configurar antes de que sirva
  es una campana que nadie enciende.
- **canales `whatsapp` / `email`** (le hablan al CLIENTE o salen de la casa) →
  **nacen APAGADAS**, con opt-in del owner. Cuestan plata, dependen de
  credenciales de terceros y pueden quemar la reputación del número.

`defaultActivo` es solo el ARRANQUE: una fila en `AutomationSetting` (el toggle
de la página) siempre manda. Al aplicar la regla el 2026-08-04 se encendieron las
tres internas que estaban en `false` (`stock_bajo`, `contraentrega_sin_cobrar`,
`envio_estancado`) — `stock_bajo` estaba completa desde `b94e17e` y esa era la
única razón de que la campana no mostrara nada.

**DECISIÓN (owner, 2026-08-25) — las cinco internas que en PRODUCCIÓN quedaron apagadas se
dejan apagadas: por decisión, ya no por herencia.** Medido por el owner en producción: de las
9 filas de `AutomationSetting` sólo `contraentrega_sin_cobrar` está `activo=true`; siguen en
`false` `stock_bajo`, `orden_recibida`, `entrega_fallida`, `envio_estancado` y
`entrega_sin_cobro`. NO es defecto de código y no las apagó nadie: la migración
`20260727120000` copió el estado `activa` de la tabla vieja `Automation`, y como una fila
existente gana sobre el `defaultActivo` (§ PRECONDICIÓN, por diseño), la doctrina "nacen
encendidas" quedó INERTE para las filas heredadas —por eso el toggle del 2026-08-04 de arriba
no alcanzó las de producción—. Se evaluó encenderlas y se decidió que **NO, por ahora**. Si
vuelve a proponerse, que sea con SU PROPIA razón —probablemente el go-live de Nayoli, cuando el
operador quiera vigilancia real—, y entonces es una operación de **DATOS desde el panel** (una
por una), **NUNCA un `UPDATE` en migración** (pisaría la elección del owner); aplica § Bases de
datos (verificar el ROL en la consola de Neon antes de tocar producción). Cerró el ex-Backlog
#43.

### Campana del operador — notificaciones internas

La campana **no es un subsistema**: es el canal `interno` del motor de
automatizaciones (`lib/automations/channels/interno.ts` escribe la fila
`Notification`; la mitad cliente es `components/admin/NotificationBell.tsx`). Un
aviso nuevo = una entrada más en el catálogo, no detección paralela. Si un
criterio de la campana difiriera del que usan las cards, las vistas dejarían de
reconciliar.

- **El origen de una orden NO es `Order.canal`.** `canal` es el canal de VENTA
  (cómo llegó el cliente) y el admin puede elegir `directo` en Nueva Orden — el
  MISMO valor que escribe el checkout. Filtrar por él notificaría las órdenes
  manuales. El discriminador es el **code path**: el evento `order.creada` lleva
  un `origen: 'storefront' | 'admin'` que declara el endpoint que la creó
  (`lib/automations/reglas.ts`). No se persiste: nadie lo consume después del
  evento, y una columna nueva sería un dato que puede mentir. **No "simplificar"
  esto a un filtro por `canal`.**
  El filtro es "todo lo que no es admin", no "solo storefront", para que un canal
  de entrada futuro notifique de fábrica — el silencio debe ser la excepción
  explícita. Testeado en `lib/automations/reglas.test.ts`.
- **`contraentrega_sin_cobrar` y `entrega_sin_cobro` se solapan A PROPÓSITO.** Una
  misma orden puede disparar las dos y no es un duplicado: la primera mide desde
  el DESPACHO en días ("la plata está en la calle"), la segunda desde la ENTREGA
  en horas ("el mensajero volvió y no liquidó"). La segunda es la ESCALADA de la
  primera; fusionarlas pierde justo esa señal. Si sobra ruido, se apaga UNA en su
  toggle.
- **El umbral del caso "entregado sin cobrar" es placeholder**:
  `HORAS_ENTREGA_SIN_COBRO = 24`, TODO(cliente) — el real sale de la sesión con el
  cliente. Es el default del `configSchema`, así que el owner ya puede ajustarlo
  desde "Configurar" sin developer; cambiar la constante solo mueve el arranque de
  una tienda nueva.
- **`fecha_entrega` es una columna de TEXTO, no DateTime.** El `where` la filtra
  con `lt` lexicográfico (válido: la escribe siempre el servidor con
  `toISOString()`, la UI nunca la manda) pero eso es un PRE-FILTRO; quien decide es
  `entregaVencidaSinCobro` en JS sobre las filas cargadas. Sin fecha o con una
  impareseable NO avisa — un aviso fabricado sobre un dato roto manda al operador
  a revisar una orden que quizá ya se cobró.
- **`entrega_fallida` usa `cooldown`, no `una_vez`, y es deliberado**: una entrega
  fallida se reprograma (`fallido → preparando`) y puede volver a fallar. Cada
  intento perdido es un hecho nuevo; el cooldown corto solo absorbe un doble PATCH
  del mismo intento.
- **El cruce del mínimo vive en `cruzoMinimo`** (`lib/metrics/inventory-filters.ts`,
  construido sobre `isLowStock`), y lo llaman los DOS emisores — el ajuste de
  inventario y el descuento al despachar. Estaba duplicado en ambos; el día que una
  copia se desincronizara, la campana y la card de Alertas de Stock dejarían de
  reconciliar. El disparador es el CRUCE, nunca el estado "está bajo" (que sería
  cierto en cada venta posterior). Ojo: dentro de la ventana de cooldown, un
  segundo movimiento a la baja tampoco avisa — eso lo hace el cooldown, no la regla
  de cruce.
- **El rojo del badge lo enciende `severidad: 'alerta'` del registry**, no el mero
  hecho de haber algo sin leer (Amber Minimal: el color es información). Tres
  órdenes nuevas dejan la campana en el primario.
- **`PENDIENTE_CANAL` no aplica acá**: el canal interno está conectado de verdad,
  así que sus runs son `ENVIADO`. Esa política es del stub de WhatsApp.

### La supresión deja rastro — `DUPLICADO` y sus dos asimetrías

Un silencio deliberado escribe una fila `AutomationRun` con estado `DUPLICADO`.
Antes se retornaba sin escribir nada y, desde la base, "callé porque ya estaba
hecho" y "callé porque estoy roto" eran el mismo vacío de cero filas — eso costó
una tarde entera de diagnóstico. Misma filosofía que el borrado OMITIDO del blob
y que `Objetivo.omitir`: **una guarda que actúa en silencio absoluto no se puede
auditar.**

Dos asimetrías que NO son descuidos y conviene no "corregir":

- **Sólo la escriben las estrategias `cooldown`.** En `una_vez`/`diaria`/`semanal`
  el periodo es fijo, así que el unique `(automationKey, targetId, periodo)` ya
  está ocupado por el run original y una fila de supresión chocaría con P2002.
  Tampoco hace falta: ese run existente ES la explicación del silencio, visible
  con una query por target. Para esos casos queda un `console.log`.
- **Las filas `DUPLICADO` NO alimentan la ventana de cooldown** (`estaEnCooldown`
  las excluye). Si contaran, cada silencio dejaría la evidencia que causa el
  siguiente: con el cron horario, un producto bajo mínimo suprimiría
  indefinidamente y la automatización quedaría **muda para siempre** — peor que el
  bug que esto arregla. Lo fija la "tercera pata" de
  `tests/integracion/supresion-con-rastro.test.ts`, con el ENVIADO envejecido más
  allá de la ventana y la fila `DUPLICADO` reciente; es la única disposición en la
  que la exclusión y el filtro por tiempo dan resultados distintos. **No borrar ese
  test.**

`FALLIDO` sigue contando para la ventana a propósito (§ el comentario de
`estaEnCooldown`): si el canal está caído, reintentar cada minuto sólo multiplica
el ruido.

### El cron NO vive en vercel.json

El plan de Vercel es Hobby: los cron jobs se ejecutan una vez al día, así
que un `crons` horario en `vercel.json` NO haría lo que dice. El disparo
horario vive en **GitHub Actions**
(`.github/workflows/automations-cron.yml`, `schedule: '0 * * * *'`) que
hace POST a `/api/cron/automations` con `Authorization: Bearer
${CRON_SECRET}`. El bloque `crons` queda COMENTADO en `vercel.json` con la
nota de activarlo al pasar a Pro y retirar el workflow entonces.
`CRON_SECRET` debe existir con el MISMO valor en las env vars de Vercel y
en los Actions secrets del repo. (Esto no contradice la regla de
`vercel.json`: lo prohibido es `buildCommand`, no `crons`.)
