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

### 1. La ventana de 45 s del polling de la campana

`POLL_MS = 45_000`. El badge se computa sobre el snapshot del cliente, así que una
notificación de severidad `alerta` puede tardar **hasta un poll** en teñir el
badge de rojo: durante esa ventana el conteo puede quedar en primario aunque en
la base ya haya una alerta.

**Decisión aceptada para la v1** (owner, 2026-08-04): no es un bug, es el costo
del polling sin push. Se anota porque es exactamente el tipo de rareza que en dos
meses alguien reporta como defecto y vuelve a costar un diagnóstico. La salida
real es push (SSE/websocket), que está **fuera de alcance de la v1** por decisión
explícita.

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

## Migraciones y deploy

- **CADA ENTORNO MIGRA SU PROPIA BASE.** `npm run build` corre `prisma
  migrate deploy` antes de `next build`, **sin condición** (desde el
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

Los icon chips de stat cards usan pastel multicolor = decisión deliberada
del owner (confirmada 2026-07-27 tras evaluar la variante ámbar en
preview); rojo/destructive reservado a alertas reales; el resto de las
reglas de restricción cromática (un sólido por vista, hover de tinte,
badges muted/neutros, trends de texto) SÍ aplican y no dependen de esta
decisión. El mapa (paleta pastel + `alert`) vive en
`constants/stat-chip.ts` (`STAT_CHIP.<tono>`) y lo consumen el registry de
widgets y las stat cards de cada página; retunear/revertir es cambiar SOLO
ese mapa (y qué key usa cada tarjeta). No colapsar a ámbar por leer una
versión vieja de este doc.

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
