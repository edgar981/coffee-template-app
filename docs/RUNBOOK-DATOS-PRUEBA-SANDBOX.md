# Runbook — llevar una compra de prueba hasta el final (sandbox de Wompi)

**Por qué existe este documento.** El owner pidió (2026-09-18) los datos de prueba del
sandbox *medidos*, no leídos de un reporte, y preguntó dónde estaban registrados. La
respuesta, medida antes de escribir esta línea: **en ningún lado del repositorio.** Los
spikes anteriores de este programa (`API-DIRECTA-SPIKE-NEQUI-FALLA-1` y los que cita
`API-DIRECTA-SPIKES-ASIENTO-1` en `DECISIONS.md`) dejaron su **conclusión** en prosa —
"la tarjeta 4242… aprobó", "el sandbox rechazó sin `customer_email`"— pero **no el cuerpo
de las llamadas que la produjo**: el número de tarjeta y el vencimiento sobrevivieron
dentro de la prosa por casualidad; el CVV, el nombre del titular y si se pedía documento,
no. Cada persona que necesitara reproducir una compra de prueba tenía que volver a
medirlo desde cero.

**Este documento es el dato reusable, no un resumen de reportes.** Cada fila de abajo sale
de una llamada real contra `https://sandbox.wompi.co`, corrida el **2026-09-18**, con las
llaves de sandbox del `.env` local (prefijo `pub_test_`/`prv_test_`, verificado antes de
disparar nada — ver §1). Lo que no se pudo medir se marca como tal; no hay ningún valor
inventado ni copiado de la documentación pública de Wompi (esa documentación **ya mintió
varias veces en este programa** — ver `DECISIONS.md`, "la doc de Wompi no es fuente de
verdad" — así que acá no cuenta como fuente).

---

## 1 · Variables de entorno que hacen falta

### Del lado del SERVIDOR (nunca viajan al navegador)

| variable | para qué |
| --- | --- |
| `WOMPI_PUBLIC_KEY` | firma la tokenización de tarjeta (viaja al navegador SÓLO como valor, no como env var de build) y la consulta de `/v1/merchants/info` |
| `WOMPI_PRIVATE_KEY` | autoriza crear la transacción (`POST /v1/transactions`) y consultarla por referencia |
| `WOMPI_INTEGRITY_SECRET` | calcula la firma de integridad de cada transacción que este repo crea (`firmarIntegridadWompi`, `lib/pagos/wompi-firma.ts`) |
| `WOMPI_EVENTS_SECRET` | verifica la firma del webhook (`app/api/webhooks/wompi/route.ts`) — no hace falta para el flujo manual de este runbook, sólo si vas a probar el webhook en sí |

Las cuatro **ya están presentes en el `.env` local** de este repo (verificado con
`grep -n WOMPI .env`, sin transcribir valores). Con prefijo `pub_test_`/`prv_test_` —
**sandbox**, no producción.

### Del lado del CLIENTE (`NEXT_PUBLIC_*`, se HORNEAN en el build)

| variable | para qué | medido en `.env`/`.env.example` |
| --- | --- | --- |
| `NEXT_PUBLIC_PASARELA_HABILITADA=1` | enciende la CAPACIDAD de pagar con la pasarela (checkout la oculta sin esto) — `services/checkout.service.ts:61` | **ausente** (grep sobre `.env` y `.env.example`, cero apariciones) |
| `NEXT_PUBLIC_PASARELA_MODO_API_DIRECTA=1` | elige captura de tarjeta por API directa en vez del widget alojado por Wompi — `services/checkout.service.ts:82` | **ausente**, mismo grep |

**Ninguna de las dos está en `.env.example`.** Quien quiera probar el checkout completo
con captura de tarjeta (no sólo este runbook, que habla directo con Wompi) tiene que
agregarlas a mano a su `.env` local.

**`NEXT_PUBLIC_*` se hornea en el build — no es una lectura en caliente de
`process.env`.** Es una regla de Next.js, no de este repo: el valor se inyecta en el
bundle de JavaScript en tiempo de build. Dos consecuencias prácticas:
- en local, cambiar el valor exige **reiniciar `next dev`** (no basta con guardar el
  archivo);
- en un despliegue de Vercel, **un redeploy que reusa el caché de build NO vuelve a leer
  la variable** — si se cambia `NEXT_PUBLIC_PASARELA_HABILITADA` en el dashboard de
  Vercel, hace falta un build fresco (`Redeploy` sin "Use existing Build Cache", o un
  commit nuevo) para que el bundle servido refleje el cambio nuevo.

### `CRON_SECRET`

Ya está en el `.env` local (`dev-local-cron-secret-no-usar-en-produccion`). Autoriza
`POST /api/cron/automations`, que es donde vive el reconciliador de Wompi — ver §6.

---

## 2 · Contra qué pasarela pega cada despliegue

`esDespliegueDemo()` (`next.config.ts:7`, leído directo del código):

```ts
export function esDespliegueDemo(): boolean {
  return process.env.VERCEL_ENV !== "production" || process.env.NOINDEX === "1";
}
```

El SERVIDOR (creación/consulta de transacción, reconciliador) deriva el host de esta
función: `true` → `https://sandbox.wompi.co`; `false` → `https://production.wompi.co`
(`app/api/checkout/route.ts:517` y los otros call sites listados en el propio código).

**En local, sin `VERCEL_ENV` seteada, `esDespliegueDemo()` da `true` siempre** — el
servidor local SIEMPRE pega contra sandbox, sea cual sea el prefijo de las llaves que
tengas en `.env`. El chequeo de arranque (`instrumentation.ts`,
`verificarLlavePasarelaCoherente`) además IMPIDE que un despliegue demo arranque con una
llave pública que empiece con `pub_prod_` — así que en la práctica las dos cosas
coinciden, pero son DOS mecanismos distintos (uno decide el host, el otro veta una
combinación peligrosa al arrancar).

**La TOKENIZACIÓN de tarjeta (navegador→Wompi) usa un mecanismo DIFERENTE para elegir el
host**: `baseUrlPasarelaDesdeLlave` (`services/checkout.service.ts`) mira el PREFIJO de
`WOMPI_PUBLIC_KEY` (`pub_prod_` → producción; cualquier otra cosa → sandbox), no
`esDespliegueDemo()`. Los dos coinciden mientras las llaves del despliegue sean
coherentes con su estado (que es justo lo que el chequeo de arranque garantiza) — está
anotado en el propio código como una ventana transicional aceptada, no medido en esta
corrida porque no hay forma de tener una demo con llaves productivas sin romper esa
guarda.

---

## 3 · La cadena completa — qué se mide y en qué orden

1. **`GET /v1/merchants/info`** (cabecera `x-merchant-public-key`) → catálogo de métodos
   habilitados + las DOS aceptaciones (`acceptance_token`, `accept_personal_auth`).
2. **`POST /v1/tokens/cards`** (sólo tarjeta; Nequi no tokeniza) → token opaco de la
   tarjeta.
3. **`POST /v1/transactions`** (llave privada) → `201 PENDING` (o un rechazo — ver §7).
4. **`GET /v1/transactions?reference=...`** (llave privada), repetido hasta un estado
   TERMINAL: `APPROVED`, `DECLINED`, `VOIDED` o `ERROR`. **`PENDING` no es el resultado —
   es el resultado a medias.** El estado final es lo único que un runbook de prueba puede
   dar por bueno.

Los pasos 1–4 se corrieron de punta a punta, contra el sandbox real, el 2026-09-18. Cada
fila de las tablas de abajo nombra la llamada que la produjo.

---

## 4 · La tarjeta que APRUEBA

**Profundidad medida: DESENLACE FINAL** (no sólo tokenización) — ver la tabla de §10, que existe
justamente porque no toda fila de este documento llega tan lejos (§12 lo deja explícito para
Mastercard, que no llega a ninguna de las dos).

| campo | valor usado en esta corrida |
| --- | --- |
| número | `4242424242424242` |
| vencimiento | `12/29` (mes `12`, año `29`) |
| CVV | `123` |
| nombre del titular | `APRUEBA TEST` |

**Medido**: tokenización → `201`, `brand: "VISA"`. Creación de la transacción → `201
PENDING`. Poll por referencia: 2–3 intentos (cada uno separado ~2 s) hasta `APPROVED`.
Detalle de la transacción ya terminal: `status_message: null`,
`payment_method.extra.processor_response_code: "00"`.

**Bonus medido, fuera del alcance que pedía este slice pero útil**:
`payment_method.extra.three_ds_auth` llegó con `{"current_step":"AUTHENTICATION",
"current_step_status":"COMPLETED"}` — la rama SIN DESAFÍO de 3DS que
`lib/pagos/tres-ds.ts` declaraba explícitamente "no medida contra el sandbox". Esto mide
sólo esa forma puntual, no `step_data` (el campo del DESAFÍO, que esta corrida nunca
disparó porque esta tarjeta no lo pide).

**No medido**: CVV y nombre del titular se probaron con UN solo valor cada uno (`123` /
`APRUEBA TEST`); el proveedor los aceptó, pero no se probó si CUALQUIER CVV de 3 dígitos
o CUALQUIER texto de titular sirven igual, o si sólo estos combinan con el número mágico.
El dato que sí parece designado por el sandbox es el NÚMERO de tarjeta (ver el
contraste con Nequi en §6); nombre y CVV se comportaron como campos de texto libre en
esta corrida.

---

## 5 · La tarjeta que DECLINA

**Profundidad medida: DESENLACE FINAL.**

| campo | valor usado en esta corrida |
| --- | --- |
| número | `4111111111111111` |
| vencimiento | `12/29` |
| CVV | `123` |
| nombre del titular | `DECLINA TEST` |

**Medido**: tokenización → `201`, `brand: "VISA"`. Creación → `201 PENDING`. Poll: 2
intentos hasta `DECLINED`. Detalle terminal: `status_message: "La transacción fue
rechazada (Sandbox)"`, `processor_response_code: "12"`.

Se probó UN solo candidato a "tarjeta que declina" (no había uno ya documentado en este
programa) y funcionó al primer intento — no hizo falta buscar un segundo.

---

## 6 · Nequi — el hallazgo que el spike anterior dejó abierto, y uno más fuerte

**Profundidad medida: DESENLACE FINAL, para los dos números** (`APPROVED` y `ERROR` son estados
terminales — Nequi no tokeniza, así que acá no hay una etapa de "sólo tokenización" que declarar
por separado).

**Lo que citaba el spec de este slice** (`API-DIRECTA-SPIKE-NEQUI-FALLA-1`): el teléfono
`3991111111` fue aceptado para CREAR la transacción (`201 PENDING`), pero ese spike nunca
consultó si llegaba a un estado terminal.

**Cerrado en esta corrida**: se creó una transacción NUEVA con ese mismo número y se
pollea hasta terminal. Resultado, **reproducido en DOS corridas separadas del spike, con
el mismo resultado las dos veces**: `201 PENDING` → 2 polls → **`APPROVED`**.

**El hallazgo nuevo, y es el que responde a la sospecha del owner** ("¿un número real de
Nequi no sirve y sólo responden los designados?"): se probó un SEGUNDO número, elegido
al azar y nunca usado antes en ningún spike de este programa — `3001234567`. La creación
también dio `201 PENDING` (el proveedor NO rechaza en la creación por el número), pero el
poll resolvió a **`ERROR`**, con el propio sandbox diciendo por qué:

```json
"status": "ERROR",
"status_message": "Número no válido en Sandbox"
```

**CONCLUSIÓN MEDIDA, no plausible: en el sandbox, un número de Nequi arbitrario NO llega
a un desenlace útil — el proveedor lo rechaza explícitamente con ese mensaje, en el
ESTADO TERMINAL, no en la creación.** `3991111111` es, hasta donde esta corrida midió, un
número DESIGNADO que sí resuelve. No se enumeró el conjunto completo de números
designados por el sandbox — sólo se probaron estos dos — así que si `3991111111` deja de
servir algún día, la respuesta es repetir este mismo procedimiento con otro candidato, no
asumir que cualquier número de 10 dígitos que empiece por 3 sirve.

| número | resultado |
| --- | --- |
| `3991111111` | `201 PENDING` → `APPROVED` (medido dos veces, mismo resultado) |
| `3001234567` | `201 PENDING` → `ERROR` ("Número no válido en Sandbox") |

---

## 7 · `customer_email` — requerido para CUALQUIER método, top-level

Ya medido y cerrado por `API-DIRECTA-SPIKE-NEQUI-FALLA-1` (citado en el spec de este
slice): sin el campo, el sandbox rechazaba con `422 {"customer_email": ["No está
presente"]}`; agregándolo, `201`. El código de producción (`fd6dedf`,
`PASARELA-FALTA-EL-CORREO-1`) ya lo manda siempre, así que esta corrida no repitió el
caso SIN el campo.

**Lo que esta corrida sí midió**: el valor usado en las 5 transacciones creadas fue
`sandbox-test@duna.solutions`, top-level (junto a `reference`, no anidado), y las 5
fueron aceptadas. A diferencia del número de Nequi, el correo se comportó como un campo
de forma libre — cualquier dirección con forma válida sirvió, no hubo un valor
"designado" que hiciera falta adivinar.

---

## 8 · El `acceptance_token` es DE UN SOLO USO — hallazgo nuevo de esta corrida

**No estaba documentado en ningún spike anterior de este programa.** Al reusar el MISMO
par de aceptaciones (`acceptance_token` + `accept_personal_auth`) obtenido en el paso 1
para una SEGUNDA creación de transacción, el sandbox respondió:

```json
{"error":{"type":"INPUT_VALIDATION_ERROR",
          "messages":{"acceptance_token":["El token de aceptación ya fue usado"]}}}
```

**Por qué esto no rompe el checkout real de este repo, pero sí un intento manual
ingenuo**: `POST /api/checkout` (la creación inicial del intento) pide un par de
aceptaciones FRESCO en cada llamada (`obtenerBloqueAceptacionPasarela`,
`app/api/pasarela/aceptaciones/route.ts`) y se lo devuelve al navegador; el `PATCH`
posterior que crea la transacción reenvía ESE MISMO par, una sola vez. Un checkout normal
—una compra por sesión— nunca choca con esto. **Donde SÍ choca: reintentar manualmente un
segundo intento de compra sin volver a golpear `POST /api/checkout` (o sin recargar la
página de checkout) primero.** Ese segundo intento va a fallar con el 422 de arriba, y no
es un bug del checkout — es este límite del proveedor.

**Para reproducir cualquier medición de este runbook**: pedí un par de aceptaciones
nuevo (`GET /v1/merchants/info`) inmediatamente antes de CADA creación de transacción, no
uno solo al principio de la sesión.

---

## 9 · El documento (tipo/número) — ¿lo pide la creación con tarjeta?

**Medido: NO, no a este monto.** Ninguna de las tres creaciones de transacción de tarjeta
de esta corrida (tarjeta que aprueba, la que declina, y la corrida anterior de la que
aprueba) incluyó `legal_id_type`/`legal_id_number` ni ningún campo de documento — el
cuerpo que se mandó es el mismo que arma `lib/pagos/wompi-api.ts` (`crearTransaccion`),
que no declara esos campos — y las tres transacciones se crearon igual (`201`).

**No medido**: si un monto mayor dispara una exigencia de documento (un umbral tipo
KYC). Esta corrida usó `5.000.000` centavos (**$50.000 COP**) en las cinco transacciones,
un monto bajo. Si algún día una transacción real de mayor valor es rechazada pidiendo un
documento que hoy el flujo no envía, ESO es una medición nueva, no una contradicción de
ésta.

---

## 10 · Qué mueve un intento a su estado FINAL — los tres mecanismos, y cuál midió esta corrida

Un `PaymentIntent` nace `EN_VUELO` cuando `POST /api/checkout` (el `PATCH`, en realidad)
crea la transacción contra Wompi. Hay TRES formas de que deje de estarlo — leídas del
código, **no las tres se ejercitaron en esta corrida**:

1. **El webhook** (`app/api/webhooks/wompi/route.ts`) — Wompi llama a una URL pública
   cuando la transacción cambia de estado, y esa ruta cierra el `PaymentIntent`. Necesita
   un despliegue con URL pública y el evento configurado del lado de Wompi; **no se
   ejercitó en esta corrida** (esta corrida habló directo con la API REST de Wompi, sin
   pasar por ninguna ruta de este repo).
2. **El reconciliador** (`packages/core/src/pagos/reconciliador.ts`), disparado por
   `POST /api/cron/automations` — en producción, el workflow de GitHub Actions lo llama
   una vez por hora (ver `CLAUDE.md`, "El cron NO vive en vercel.json"); localmente se
   puede disparar a mano con `Authorization: Bearer ${CRON_SECRET}` (el valor ya está en
   `.env` local). **Tampoco se ejercitó en esta corrida** — no se levantó el servidor de
   Next para probarlo; queda como lectura de código, no medición.
3. **Consultar `GET /v1/transactions?reference=...` directo contra Wompi** — el mecanismo
   que ESTA corrida sí usó, repetidamente, para llevar cada transacción hasta su estado
   terminal (§3, paso 4). Es la forma más barata de verificar manualmente que una
   transacción de prueba llegó a buen puerto, sin depender de que el webhook o el cron
   estén corriendo.

**Para alguien que siga este runbook y quiera ver una orden real de este repo pasar a
`pagado`**, hoy hace falta el mecanismo 1 o el 2 — el 3 sólo confirma el lado de Wompi,
no cierra el `PaymentIntent` de este repo. Eso queda fuera del alcance medido acá.

---

## 11 · Resumen — la tabla que alguien copia y pega

**La columna "profundidad" es la que el gate visual del owner del 2026-09-18 (§12) obligó a
agregar**: una fila de esta tabla sin decir hasta dónde llegó su medición se lee igual de
confiable tenga desenlace final o sólo tokenización, y eso es exactamente lo que dejó a alguien
gateando una pantalla con la Mastercard de §12 sin saber si el defecto era suyo o del dato.

| dato | valor medido | profundidad | fuente |
| --- | --- | --- | --- |
| tarjeta que aprueba | `4242424242424242`, exp `12/29`, CVV `123`, titular `APRUEBA TEST` | desenlace final (`APPROVED`) | §4, esta corrida |
| tarjeta que declina | `4111111111111111`, exp `12/29`, CVV `123`, titular `DECLINA TEST` | desenlace final (`DECLINED`) | §5, esta corrida |
| tarjeta Mastercard | brand `MASTERCARD`, últimos 4 dígitos `4444` (consistente con el número de prueba público `5555555555554444` — el PAN completo nunca lo tuvo este repo, § §12 de abajo) | desenlace final (`ERROR`, dos veces) | §12, medido 2026-09-18 contra transacciones ya existentes en `development` |
| Nequi que aprueba | `3991111111` | desenlace final (`APPROVED`) | §6, esta corrida (2 veces) + `API-DIRECTA-SPIKE-NEQUI-FALLA-1` (creación) |
| Nequi que NO sirve | cualquier número no designado (probado: `3001234567` → `ERROR`, "Número no válido en Sandbox") | desenlace final (`ERROR`) | §6, esta corrida |
| `customer_email` | cualquier dirección con forma válida (usado: `sandbox-test@duna.solutions`) | creación (`201`) para las 5 transacciones de esta corrida | §7, esta corrida |
| documento (tarjeta) | no se pide a $50.000 COP | creación (`201`), sin campo de documento | §9, esta corrida |
| `acceptance_token` | de un solo uso — pedir uno nuevo antes de CADA creación | comportamiento del proveedor al reusarlo | §8, esta corrida |
| host del servidor | sandbox si `esDespliegueDemo()`, medido leyendo `next.config.ts:7` | lectura de código, no de una llamada | §2 |

---

## 12 · Mastercard — MEDIDA (2026-09-18, `CHECKOUT-OTRO-METODO-SIN-SALIDA-1`): rechazada por el
sandbox, sin código de procesador — y la distinción que evita leerla de más

**Historia de esta sección.** Nació como observación de gate sin medir (§ el asiento de
`CHECKOUT-GATE-VISUAL-HALLAZGOS-1`, 2026-09-18): el owner pagó con una Mastercard de prueba en el
deployment real y vio «Tu pago no fue aprobado», sin que nadie volviera a consultar esa
transacción. El spec de `CHECKOUT-OTRO-METODO-SIN-SALIDA-1` pidió MEDIR esa observación contra el
proveedor antes de escribir nada — y de paso trajo una cifra ya calculada ("las doce transacciones
aprobadas de toda la base son la misma VISA 4242424242424242", "las dos transacciones de la
tarjeta 5555555555554444 devuelven ERROR…") que **no tenía asiento en ningún lado del repo**: no
está en `DECISIONS.md`, no está en este runbook, y no venía de ningún spike encontrado. Se
verificó de cero, contra `development` (la base de este entorno, § `CLAUDE.md` — Bases de datos) y
el sandbox real de Wompi, sin fabricar ni un spike nuevo de tokenización: se leyeron los
`PaymentIntent` YA EXISTENTES en la base (21 filas, medidas con
`npx tsx --env-file=.env .scratch/query-payment-intents.ts`) y se consultó CADA UNO con
`pspTransactionId` contra `GET /v1/transactions/{id}` (llave `prv_test_`, sandbox — verificado el
prefijo antes de disparar nada, § §1 de arriba).

**Lo medido, transacción por transacción — 14 filas con `pspTransactionId`, contra el sandbox
real, 2026-09-18:**

| referencia | estado en `PaymentIntent` | status de Wompi | status_message | processor_response_code | brand · últimos 4 |
| --- | --- | --- | --- | --- | --- |
| CN-522747 | FALLIDO / ERROR | `ERROR` | «La tarjeta usada no es admitida para el ambiente Sandbox» | (ninguno) | MASTERCARD · `4444` |
| CN-226488 (2do intento) | FALLIDO / ERROR | `ERROR` | «La tarjeta usada no es admitida para el ambiente Sandbox» | (ninguno) | MASTERCARD · `4444` |
| CN-226488 (1er intento) | FALLIDO / DECLINED | `DECLINED` | «La transacción fue rechazada (Sandbox)» | `12` | VISA · `1111` |
| CN-787363 | FALLIDO / ERROR | `ERROR` | «Número no válido en Sandbox» | (ninguno) | — (NEQUI, no tarjeta) |
| las 10 restantes | APROBADO / APPROVED | `APPROVED` | (ninguno) | `00` | VISA · `4242`, las 10 |

**CONFIRMADO contra lo que el spec citó, con una corrección medida:** las DOS transacciones de
Mastercard (brand `MASTERCARD`, últimos 4 `4444` — consistente con el número público
`5555555555554444`, aunque el PAN completo nunca lo tuvo este repo, § `FormularioTarjeta.tsx`:
"LOS DATOS DE LA TARJETA NUNCA SALEN HACIA NUESTRO SERVIDOR", así que los últimos 4 son lo único
que el proveedor entrega y lo único que se puede afirmar como medido) SÍ devuelven `ERROR` con ese
mensaje textual exacto y SIN `processor_response_code` — coincide. La VISA que declina con código
`12` también coincide (es el primer intento de CN-226488, `4111111111111111` — el mismo candidato
"declina" de §5). **Lo que NO coincide: las transacciones APROBADAS son 10, no doce** — contadas
sobre las 21 filas completas de `PaymentIntent` de esta base, sin excluir ninguna. Las 10 SÍ son,
las diez, la misma VISA `4242424242424242` (§4) — eso sí coincide. La cifra de "doce" que traía el
spec no se pudo reproducir contra esta base y se corrige acá con la medida real; no hay una
segunda base de datos donde buscar las dos que faltan (§ `CLAUDE.md`, Bases de datos: `development`
es la única que este entorno de checkout usa).

**LA DISTINCIÓN QUE HACE ÚTIL EL DATO, para que nadie lo lea de más — «ese número» ≠ «esa red»:**
lo medido es que **ESE NÚMERO** (el que tokenizó las dos transacciones de arriba, con últimos 4
`4444`) no es de los designados de esta cuenta de sandbox — exactamente el mismo patrón que §6 ya
midió para Nequi (`3001234567` → `ERROR` "Número no válido en Sandbox", mientras `3991111111` sí
resuelve). **NO está medido que la red Mastercard esté deshabilitada para esta cuenta** — eso
exigiría probar con OTRO número Mastercard designado por el sandbox (que Wompi publica en su
consola de comercio de pruebas), y **este slice no lo hizo**: no se tokenizó ningún número nuevo,
sólo se consultaron transacciones YA CREADAS por sesiones de checkout anteriores. Son dos
afirmaciones distintas y sólo la primera está medida.

**Qué se le dice a quien venga mañana:** la ÚNICA tarjeta con desenlace medido hasta `APPROVED` en
todo este runbook sigue siendo la VISA `4242424242424242` de §4 (y sus 9 repeticiones en la base,
arriba). Un número que tokeniza bien no es un número que aprueba — tokenizar y cobrar son dos
etapas distintas del proveedor (§8 de arriba, el `acceptance_token`, ya mostró que "se creó algo"
no significa "se resolvió bien"), y esa confusión es justo la que costó la corrida del owner: una
Mastercard que sí tokenizó (si tokenizó — no medido acá tampoco, sólo se vio el desenlace) terminó
en `ERROR` al crear la transacción, no al tokenizar.

**Lo que sigue sin medirse, y por qué no se mide acá:** si un SEGUNDO número Mastercard (distinto
de `…4444`) resolvería distinto. Repetir la cadena de §3 con ese número es la única forma de
saberlo, y no es parte de este slice — nombrarlo es lo que corresponde, no adivinarlo.
