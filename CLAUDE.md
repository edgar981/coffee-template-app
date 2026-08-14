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

## Backlog técnico

**EL registro único de deuda conocida.** Existe porque antes vivía repartida
entre cuerpos de PR y secciones sueltas de este archivo: nadie podía responder
"¿qué falta y en qué orden?" sin releer tres merges. Una deuda que no está acá,
para efectos prácticos, no está.

Reglas de la lista, para que siga sirviendo:

- **Va ordenada, y el orden es la decisión.** Reordenar es una decisión del
  owner, no del que agrega el item.
- **Cada entrada dice el COSTO YA PAGADO**, no solo el problema. "Costó el
  diagnóstico de una tarde" es lo que hace que la decisión de priorizar no se
  tome en abstracto.
- **Un item que se completa se BORRA de acá** y su decisión, si tiene, se
  documenta en la sección que le corresponda. Esto no es un historial.

### 1. Invitaciones pendientes: invisibles y sin cancelar

`POST /api/users/invite` crea la fila y **no hay forma de verla ni de anularla**.
No existe listado ni `DELETE`, así que una invitación pendiente sólo se conoce
por el correo que salió.

**Costo YA pagado, y es lo que le da la prioridad:** el propio POST rechaza
invitar si hay una viva (`usedAt: null`, sin expirar), así que **un correo mal
tecleado bloquea esa dirección durante 48 horas sin ninguna salida desde el
panel** — ni reenviar, ni corregir, ni cancelar. La única salida hoy es SQL, que
es exactamente el hueco que la tanda de desactivar usuarios vino a cerrar un
nivel más arriba.

Forma acordada (owner, 2026-08-06): sección **"Invitaciones pendientes"** en la
MISMA página de Usuarios —no una pantalla nueva— con listar + cancelar. Es la
tanda siguiente inmediata.

### 2. `InventoryLog` no registra QUIÉN ajustó el stock

Es la única mutación auditable del panel sin columna de actor: `Payment` guarda
`registrado_por` + `registrado_por_nombre` y `Comprobante` guarda `subido_por` y
`verificado_por` con sus nombres, pero un ajuste de inventario no deja rastro de
la persona.

Aditiva y con el patrón que ya existe: `ajustado_por` + `ajustado_por_nombre`,
`String?`, snapshot y **sin FK** — igual que los otros dos, para que el historial
sobreviva a que el usuario se vaya. Se llena de aquí en adelante; las filas
viejas quedan en `null`, que es honesto (nadie sabe quién las hizo).

Se descubrió haciendo el descubrimiento de la tanda de usuarios: la premisa era
que borrar un usuario dejaría referencias colgando, y resultó que **el historial
ya está blindado** porque todo es snapshot… salvo acá, donde directamente no hay
nada que blindar.

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

### 5. H6 — el design-system no tiene primitiva de diálogo

`/admin/pedidos` opera sus doce flujos con los **modales shadcn de
`/admin/ordenes`**, reusados tal cual, y `/admin/clientes-v2` hace lo mismo con
`ConfirmDeleteDialog` y `CustomerFormModal`. Es una mezcla visual dentro de dos
pantallas que por fuera son Duna OS — y ya no es un caso, es el patrón de toda
vertical nueva mientras la primitiva no exista.

**Por qué se decidió reusar y no construir** (owner, tras discovery): los siete
flujos resultaron reutilizables —seis invocables sin tocar nada, y el séptimo
(`ControlComprobantes`) salió a `hooks/useControlComprobantes.ts` con un
movimiento mecánico—. Ninguno importaba nada de la página vieja. Construir el
diálogo ahora habría significado **reescribir ~1.000 líneas ya probadas en
producción** (Schedule 522 · RegisterPayment 250 · ConfirmDelete 187 ·
ConfirmDespachoSinPago 40) para obtener el mismo comportamiento con otro chrome.

**El argumento que decidió, y que conviene retener:** mientras la pantalla vieja
siga existiendo, reescribir esos flujos deja **dos implementaciones de los mismos
seis conviviendo** —incluidos el orden pago→sello y la confirmación de despacho sin
cobro—. Es la divergencia que este repo ya pagó tres veces (`razonDelServidor`,
`cruzoMinimo`, el "Confirmado" fósil de la referencia). Reescribir algo que sigue
existiendo en otro lado no es progreso.

**Costo YA pagado:** hoy, ninguno más que la mezcla visual. Es deuda de forma, no
de comportamiento — y por eso está al final de esta lista.

**DISPARADOR — sin cambio de fondo, con la redacción corregida:** NO es "cuando
haga falta un diálogo" (ya hacen falta varios y se resolvieron reusando). Es
**cuando las pantallas viejas mueran**: ése es el momento en que reescribir deja de
duplicar. Ahí la primitiva se construye y los flujos se migran una sola vez.

Decía "cuando `/admin/ordenes` muera", y ese literal caducó al entrar la segunda
vertical: **Clientes tiene el mismo patrón** —`/admin/clientes-v2` opera con el
`ConfirmDeleteDialog` y con `CustomerFormModal`, modales shadcn, mientras
`/admin/clientes` sigue en producción—. Nombrar UNA pantalla hacía que el
disparador se leyera como cumplido en cuanto muriera esa, con las demás
convivencias todavía vivas. La regla es la misma para todas: la primitiva se
construye cuando ya no queda una implementación vieja de esos flujos con la cual
duplicar.

### Lo que la maqueta ya resuelve, y cómo cambia el cálculo

Existe **diseño de referencia** de los diálogos (`duna-modales.html`), y define:

- **DOS formas, no una.** Drawer lateral para los cinco flujos con formulario;
  dialog centrado para las dos confirmaciones.
- **`btn-danger`** (`var(--bad)`), que es la variante destructiva que faltaba.
- **`is-saving`**: bloquea el modal ENTERO mientras la mutación viaja.
- **Checkbox de confirmación** en el destructivo.

**Esto cambia el cálculo en las dos direcciones, y por eso hay que re-dimensionar
cuando se abra, no antes:**

- **Sube el piso.** Re-estilar el wrapper shadcn NO alcanza: el drawer lateral es
  otra FORMA, no otro color. La primitiva tiene que existir de verdad.
- **Baja el techo.** Y esto es lo que corrige la estimación anterior de "reescribir
  ~1.000 líneas": los seis flujos ya son **componentes invocables** —lo verificó el
  discovery— así que lo que cambia es su ENVOLTORIO, no su contenido. No es
  reescribir los flujos; es cambiarles el marco.

Tres cosas que conviene tener decididas ANTES de empezar, porque a mitad de la
migración salen mal:

1. **Radix o a mano.** El diálogo necesita foco atrapado, Escape, click-fuera,
   bloqueo de scroll y `aria-modal`. Todo eso lo da hoy Radix
   (`components/ui/dialog.tsx` son 128 líneas de wrapper). O el paquete **toma
   dependencia de `@radix-ui/react-dialog`** y deja de ser sin dependencias, o
   **reimplementa el foco atrapado**, que es justo la parte que se hace mal.
2. **`is-saving` NO reemplaza a `useAccionGuardada`.** Es la mitad VISIBLE de la
   guarda de doble-submit; la que de verdad corta la re-entrada del mismo tick es
   el ref síncrono (§ Doble-submit). Una primitiva que bloquee el modal y haga
   creer que la guarda ya está puesta reabriría el agujero que ese hook cerró.
3. **El checkbox de confirmación es un CAMBIO DE COMPORTAMIENTO**, no una
   consecuencia gratis del rediseño: hoy `ConfirmDeleteDialog` no lo tiene. Suma
   un paso a "Cancelar orden". Es una decisión de producto que viaja con H6 y hay
   que tomarla como tal.

**La maqueta NO está en el repo** (verificado: no existe `duna-modales.html`,
trackeado ni sin trackear). Vive fuera, y eso es exactamente lo que se pierde — es
la misma familia del ítem 4 de esta lista, pero peor, porque acá el repo ni
siquiera puede verla. **Al abrir H6, lo primero es que la maqueta entre**, como
entró `reference.html`: sin eso, la primitiva no tiene contra qué verificarse.

### Lo que la maqueta pide y el DOMINIO NO TIENE

Se leyó y se contrastó campo por campo. **La maqueta no es sólo una forma: trae
decisiones de PRODUCTO que hoy no existen.** Separarlas importa, porque
"implementar la maqueta" significaría, sin decirlo, construir varias features:

- **PAGO PARCIAL.** Monto editable, "saldo pendiente", un comprobante de "abono", y
  el hint *"si registras menos que el saldo, el pedido queda con pago parcial"*.
  Hoy NO existe: `registrarPago` snapshotea `Order.total` server-side y transiciona
  a `pagado` (§ La CARTERA — "si algún día existen pagos parciales, ESTA es la línea
  que deja de ser cierta"). `RegisterPaymentModal` ni siquiera acepta monto. Es la
  discrepancia más cara de la maqueta y toca cartera, analítica y el eje de cobro.
- **PSE y Tarjeta** como métodos. `MetodoPago` es NEQUI · DAVIPLATA · EFECTIVO ·
  TRANSFERENCIA · OTRO.
- **Monto y método POR COMPROBANTE** ("Transferencia PSE · $124.000"). `Comprobante`
  no tiene ninguno de los dos: es la EVIDENCIA, no la plata (§3.1).
- **Motivo de cancelación** guardado en el historial. No hay columna, y
  `OrderStatusTransition` no tiene campo de motivo (§ el hueco de historial de
  `Order.estado`).
- **Aviso al cliente por WhatsApp al cancelar.** El canal es un STUB
  (`PENDIENTE_CANAL`) y no hay automatización de cancelación.
- **"El pago queda marcado para devolución manual".** Cancelar NO toca el `Payment`
  — es comportamiento conservado y declarado, y qué hacer con un pago sobre una
  orden cancelada sigue siendo una decisión de negocio pendiente.
- **Motivo del rechazo "que se le envía al cliente".** La columna existe y se
  escribe (`Comprobante.notas_verificacion`), pero NO se le envía nada a nadie: hoy
  sólo se muestra en el panel. La mitad de esto ya está.
- **Tres franjas horarias.** `shipping-config` tiene dos (`am`, `pm`).
- **Mensajeros como entidad** con avatar y carga ("Camilo tiene 2 entregas hoy").
  `Shipping.mensajero` es un String libre.
- **"Guardar borrador"** y **"Pedir otro comprobante"**: no existen.
- **Vocabulario**: "Aprobar" por verificar, "Sin pagar" por el badge de cobro ya
  decidido (Pagado · Contraentrega · Sin acreditar).

Y un FÓSIL, el mismo que ya se corrigió una vez: el fondo de la maqueta dibuja
**cinco** `steps`. La secuencia canónica son **cuatro** (§ backlog 4).

### Y lo que la maqueta contradice del DESIGN SYSTEM

Sus tokens son una copia del DS que ya DERIVÓ, así que copiarlos tal cual
reintroduce diferencias en silencio:

- **`--bad-ink` distinto**: `#96422F` (maqueta) contra `#A0472F` (DS); en oscuro
  `#E08A72` contra `#D07C66`.
- **No existe `--ok-ink`**, y los badges usan `--ok` y `--bad` COMO TEXTO. El DS
  tiene las variantes `-ink` precisamente porque el fill no pasa AA como texto:
  copiarlo es una regresión de contraste.
- **`--shadow-3` distinta** (`24px 64px .18` contra `16px 48px .14`).
- **Sin escala de espaciado ni de tipografía**: la maqueta usa px y rem sueltos que
  no caen en la escala del DS (`.m-title` 1.15rem contra `--duna-text-title`
  1.1875rem; `.eyebrow` .66rem contra `--duna-text-caption` .6875rem…).
- Y el prefijo: escribe `var(--bad)`, que en el paquete es **`--duna-bad`**.

**La maqueta se lee como INTENCIÓN DE FORMA, no como fuente de valores.** Los
valores los tiene el DS, y son los que ya están en producción.

**El hueco de la variante destructiva de botón queda RESUELTO POR DISEÑO**
(`btn-danger` = `var(--bad)`) y se implementa junto con H6. Hasta entonces "Marcar
Fallido" y "Cancelar orden" en `/admin/pedidos` van con `--ghost` — defendible,
porque la severidad la lleva el confirm y marcar fallido registra un hecho en vez
de destruir algo, pero es un interino, no la forma final.

Al implementarlo, el valor sale del DS (`--duna-bad`), no de la maqueta — ver la
lista de derivas de arriba.

### 6. `PATCH /api/customers/[id]` NO es parcial, y su cliente dice que sí

El endpoint escribe **todos** los campos sin condición, con fallbacks sobre claves
ausentes: `email: body.email || null`, `ciudad: … || null`, `canal: body.canal ||
'directo'`, `activo: body.activo ?? true`. Es **exactamente** el patrón que costó
el incidente del 2026-08-04 en productos (§ El PATCH de producto es PARCIAL de
verdad): *un fallback sobre una clave ausente no es un default, es un borrado*.

Y encima `lib/api/customers.ts` lo tipa `updateCustomer(id, data:
Partial<CustomerForm>)`. **La firma invita a mandar un campo suelto**, y ese body
—por ejemplo `{ activo: false }`— vaciaría correo, teléfono, ciudad, dirección y
notas, y pondría el origen en `directo`. Sobreviviría `nombre` sólo porque su
`undefined` lo ignora Prisma, que es el mismo mecanismo que mantuvo invisible el
daño en productos.

**Costo YA pagado: ninguno todavía, y por eso está acá y no arriba.** Verificado
que los tres call sites de hoy —la lista vieja, el perfil viejo y
`CustomerFormModal`— mandan el formulario COMPLETO. Es una mina puesta, no una
herida abierta. Lo que sí está pagado es el gemelo: la misma forma en productos
vació descripciones, precios y SKU, y le borró las imágenes del store a un
producto por desactivarlo.

**DISPARADOR — y es la razón de que esto esté escrito:** **antes de agregar
cualquier control que mande un campo suelto** (el caso obvio es un toggle de
`activo`, que hoy no existe en ninguna de las tres pantallas; también un "cambiar
origen" desde la fila, o cualquier acción rápida del panel nuevo). Ese control es
el que arma la mina. No hace falta esperar a que alguien lo escriba para
arreglarlo, pero sí es el momento en que dejar de arreglarlo pasa a ser un bug.

La forma del arreglo ya está resuelta y probada al lado: `datosDelPatch` + `trae`
de `lib/product-update.ts` (presencia de la clave, no verdad del valor; `undefined`
cuenta como ausente), y el test va en el CARRIL —lo que se afirma es lo que la
fila TIENE DESPUÉS de escribir, y un test con mocks pasaría en verde contra el
código defectuoso—.

### 7. Los totales de NEGOCIO son de Analítica, no de las pantallas de operación

Clientes totales, compras recibidas, histórico de pedidos: **cifras de negocio**.
No pertenecen a una pantalla de operación, y por eso salieron de
`/admin/clientes-v2` (owner, 2026-08-13).

**El criterio, que es lo que hay que recordar** — una pantalla de operación
responde *¿qué hago ahora?*; una de análisis responde *¿cómo va el negocio?*. Una
cifra que no cambia ninguna decisión del día es de la segunda. Y hay un test más
duro todavía: **si la cifra ya está en un carril, el carril gana**, porque ahí
además FILTRA. El pill es accionable; la stat sólo se mira. Dos representaciones
del mismo número, y una de ellas muerta.

Esto ES lo que hace que el panel se lea como un sistema: Pedidos y Clientes
comparten anatomía —título · buscador · carriles · split— en vez de ser dos
pantallas parecidas con adornos distintos.

**Costo YA pagado: ninguno**, y por eso está acá abajo. Es una decisión de dónde
vive cada cosa, tomada antes de que costara — no una herida. Lo que sí evita es el
gemelo del ítem 4: dos sitios afirmando el mismo total y divergiendo el día que
uno cambie de definición (§ "Por cobrar" vs "Órdenes Pendientes", donde la
divergencia sí llegó a producirse).

**DISPARADOR: cuando se rediseñe la vertical de Analítica.** Ahí entran, con la
base y el período que esa página ya sabe declarar (§ Analítica — qué mueve el chip
de período y qué NO). Antes de eso no se reponen en ninguna pantalla de operación
"porque se ven bien": ése es exactamente el movimiento que esta decisión revierte.

**Aplicado en las DOS pantallas del rediseño** (Pedidos y Clientes), y eso importa
más que el ahorro de una línea: la meta era que las dos tuvieran la misma
anatomía, así que dejar el conteo en una sola habría cumplido la letra y no el
motivo.

**EFECTO SECUNDARIO QUE HAY QUE MIRAR AL COPIAR ESTE MOVIMIENTO:** ese subtítulo
era el ÚNICO aviso de carga de la lista en las dos pantallas (`{cargando ?
'Cargando…' : …}`), así que quitarlo las dejaba MUDAS mientras viaja el fetch. Una
pantalla en blanco es indistinguible de "no hay nada" — justo la confusión que los
tres estados vacíos de cada pantalla existen para evitar. El aviso bajó a la
LISTA, que es donde está el hueco. Quitar una cifra puede llevarse por delante un
estado que vivía pegado a ella.

### 8. El carrusel del dashboard no lleva a lo que muestra

Al hacer clic en un día, sus DOS gráficas navegan a los pedidos **creados** ese
día. Ninguna de las dos mide eso:

- **Ventas** mide **plata recibida** ese día, por `Payment.fecha`. Un pago de hoy
  sobre una orden de la semana pasada está en la barra y no en la lista.
- **Pedidos** mide **líneas de producto** por peso, sobre órdenes ya **pagadas**.
  El enlace lleva a órdenes de cualquier estado, y cuenta órdenes, no líneas.

**Costo YA pagado: ninguno todavía**, y por eso está acá abajo. Es un enlace que
lleva a un conjunto plausible pero distinto — el modo de falla es que alguien
concluya que la gráfica está mal cuando lo que está mal es el destino.

Se descubrió haciendo el diff funcional para el retiro de `/admin/ordenes`
(2026-08-13), y **se migró TAL CUAL a `/admin/pedidos` por decisión del owner**:
arreglarlo pide un destino en **Pagos** para la gráfica de Ventas, que es otra
pantalla y otra decisión. El defecto quedó escrito en el propio componente, donde
pasa.

**DISPARADOR: cuando se rediseñe Analítica o Pagos.** Ahí la gráfica de Ventas
gana un destino que mide lo suyo, y la de Pedidos decide si lleva a las órdenes
pagadas de ese día o deja de ser clickeable.

### 9. Duna OS en MÓVIL — el panel partido no sabe qué hacer con su panel

**Son dos huecos del SISTEMA, no de una pantalla.** Por eso van juntos y por eso
van a `packages/design-system`: `duna-split` lo consumen hoy Pedidos y Clientes, y
lo va a consumir toda vertical futura con el mismo layout.

#### 9.1 · El panel, en móvil, no responde

Debajo de 960px `duna-split` apila a una columna y el panel pierde el `sticky`
(está en el `@media` de `primitives.css`, con su porqué: pegado taparía la lista).
Lo que el sistema **nunca decidió** es qué pasa al TOCAR una tarjeta: el panel se
actualiza fuera de la pantalla, así que el operador toca y **no ocurre nada
visible**. Tiene que scrollear a ciegas para descubrir que sí pasó algo.

Eso no es una incomodidad de layout: es **una acción sin respuesta**, que es la
misma clase de defecto que el botón mudo que obligó a `useAccionGuardada`.

**DIRECCIÓN: bottom sheet, no página.** Mantiene el contexto —la lista queda
detrás, cerrar devuelve al mismo sitio, sin navegación ni botón atrás— y `?pedido=`
sigue siendo compartible, que es lo que hoy hace enlazable al detalle. Una página
aparte rompería las tres cosas a la vez.

#### 9.2 · La navegación móvil

Hoy es el drawer con hamburguesa de `Sidebar` (`mobileOpen` + backdrop, `lg:hidden`).
Pasa a **barra inferior** (Hoy · Pedidos · Clientes · Productos · Más) más un sheet
de "Todas las secciones" con el resto y el toggle de tema.

Comparte primitiva con 9.1: el sheet es el mismo mecanismo, y ésa es la razón de
que las dos sean UNA tanda y no dos.

#### Lo que ya existe, y lo que falta

El sistema **ya reservó el vocabulario** sin construir la pieza: `--duna-scrim`
está documentado como "velo de overlays/drawers/**sheets**" y `--duna-r-xl` como
"esquinas de **sheet**/superficies grandes". Los tokens están; la primitiva no.

**LA MAQUETA NO ESTÁ EN EL REPO** (verificado: los únicos dos HTML son
`reference.html` y `duna-modales.html`, y ninguno contiene el sheet de "Todas las
secciones" ni una barra inferior). Es la misma familia del ítem 4 y de H6, y ya
sabemos cómo termina: **al abrir esta tanda, lo primero es que la maqueta entre**.
Sin eso la primitiva no tiene contra qué verificarse.

#### Costo ya pagado

**Ninguno todavía, y por una razón que caduca:** el panel no tiene usuarios. Pero a
diferencia de las minas de esta lista, esto **ya está desplegado y roto en dos
pantallas** — no espera a que alguien escriba el control que lo arme. El día que
alguien abra el panel en un teléfono, está.

#### DISPARADOR: después del retiro de `/admin/ordenes`

Tanda propia, y las dos razones importan:

- el retiro tiene el gate más delicado del proyecto y mezclarle navegación móvil
  juntaría dos riesgos en una sola verificación;
- **haciéndola después, la primitiva móvil se diseña con DOS consumidores reales**
  —Pedidos y Clientes ya terminadas— en vez de con uno. Es exactamente el
  argumento que hizo barata la segunda vertical: una primitiva diseñada contra un
  solo caso inventa la forma equivocada con la mitad de la información.

## Mejoras post-multitenant

**NO es el backlog técnico.** El backlog es deuda que ya está costando; esto son
mejoras que esperan un HITO —la arquitectura multitenant de Duna— y que hacerlas
antes significaría construirlas dos veces. Un item de acá no se prioriza contra
uno del backlog: están en escalas distintas.

Cada entrada dice **de qué decisión salió**, porque una mejora sin su origen se
vuelve una idea suelta que nadie sabe si sigue vigente.

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

### Snapshot del costo en `OrderItem`

Columna `costo_unitario` nullable, llenada de aquí en adelante (migración
aditiva). Convierte el margen futuro en un hecho contable y deja el histórico
como está.

Origen: el rediseño de Analítica del 2026-08-05, donde se descubrió que
`OrderItem` no snapshotea costo y el margen histórico sólo puede estimarse contra
el costo ACTUAL del catálogo (§ El COSTO no está snapshoteado). No depende
técnicamente del multitenant, pero **sí de la sesión de costos reales con el
cliente**: snapshotear el costo del seed sólo congelaría un dato inventado.

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

## Dashboard personalizable — registry de widgets

Las stat cards del dashboard son un CATÁLOGO (`constants/dashboard-widgets.ts`,
`key` estable snake_case) con selección ordenada persistida por usuario
(`DashboardPreference.widgets` = array de keys; API `/api/dashboard/prefs`).
Toda entrada/salida pasa por `sanitizeWidgetKeys` (solo keys reales del registry,
sin duplicados, orden preservado) → una key retirada o un payload malicioso nunca
llega al grid. El binding key→dato vive en el dashboard (junto a los datos); el
registry es presentación pura + deep-links que reusan los helpers compartidos
(card=lista). SOLO las stat cards son personalizables: los gráficos y Órdenes
Recientes son fijos, fuera del sistema (v1).

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

**Deuda conocida (NO arreglada a medias):** ninguno de los dos conteos excluye
las órdenes `SN-` de demo, así que hoy "Pendientes" cuenta 1 de más. Arreglarlo
solo en la tarjeta rompería el invariante card=lista (la lista de Órdenes tampoco
filtra `SN-`): el fix es de los dos lados a la vez, o de ninguno.

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
- **Trends en texto** (flecha + % coloreado verde/rojo, sin pill/fondo); el "vs
  mes anterior" en muted. Un solo lugar: `TrendPill` en `StatCard`.
- **Una sola utilidad de fecha visible**: `formatFecha` (`lib/format-fecha.ts`,
  `14 may 2026`, es-CO/America-Bogota). No `toLocaleDateString` ad-hoc en vistas.
- **Icon chips en familia cálida** — ver la sección de chips arriba
  (`constants/stat-chip.ts`).

El `--accent` de admin-light era `#B45309` (marrón de marca) y volvía marrón todo
hover de outline/ghost/dropdown/select: ahora es un tinte cálido suave. El marrón
vive como `--primary` y en los charts, no como fondo de hover.

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
