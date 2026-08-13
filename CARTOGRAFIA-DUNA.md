# Cartografía de la arquitectura de Carlos — duna-orders / duna-operator-ui / duna-owner-ui

**Fecha:** 2026-08-05 · **Alcance:** solo lectura, sin juicio de calidad · **Autor del código mapeado:** Carlos Duque (914 / 104 / 78 commits, autor único en los tres repos)

---

## 0. Procedencia y límites de este mapa

**De dónde salió el código.** Los repos de la org `duna-solutions` (`duna-operator-ui`, `duna-owner-ui`, `duna-orders`) están **vacíos**: 0 KB, cero branches, creados hoy 2026-08-05 entre las 23:41 y 23:47 UTC, con `pushed_at == created_at`. Son cáscaras. El código vive en la cuenta personal `duquecarlos`, y de ahí se clonó.

Esto **no es trivia de acceso, es dato de (g)**: la org es un espejo declarado pero no poblado. Hoy la fuente de verdad del código es una cuenta personal, y el trasvase org←personal está pendiente. Cualquier plan que asuma que `duna-solutions` ya es el hogar del código está asumiendo algo falso.

**Qué leí.** Los tres repos completos en `main`, con historial (`duna-orders` desde 2026-05-17, 910 commits). Los documentos de decisión del propio repo — `DECISIONS.md` (478 KB), `CHANGELOG.md` (297 KB), `ROADMAP.md` (118 KB), `ARCHITECTURE-M8.md`, y el runbook de Meta — más el código fuente.

**Un cuarto repo que no puedo ver.** Existe `duna-admin-ui` y **no tengo acceso, por decisión explícita** registrada en `DECISIONS.md` (2026-08-05): *"Edgar receives READ on duna-orders, duna-owner-ui, duna-operator-ui; NO access to duna-admin-ui."* La API de admin sí la leí desde el backend (`web/admin_api/`): es la única superficie que lee **entre tenants**, cerrada por default con un tercer token independiente. Su UI queda como hueco declarado de este mapa.

**Sobre `coffee-template-app`.** Para construir la tabla de (d) hacía falta la semántica de nuestro núcleo (`condicion_pago`, `AutomationRun`, `InventoryLog` viven ahí y en ningún otro lado). Lo leí **en solo lectura** — `prisma/schema.prisma` y `CLAUDE.md`. No se tocó ni un archivo.

**Advertencia de método.** `ARCHITECTURE.md` y `README.md` de `duna-orders` están **desactualizados**: describen el bot como "Phase 5, no parte del piloto actual", al operador sobre Streamlit y la persistencia sobre Google Sheets. Nada de eso es cierto hoy — el bot está en producción, el operador tiene su propio Next.js y la persistencia es Postgres. Todo lo que sigue está verificado **contra el código**, no contra esos dos documentos. `DECISIONS.md` y `CHANGELOG.md` sí van al día.

---

## (a) El reparto real entre los tres

### La hipótesis de nombres: confirmada, con un matiz que importa

| Hipótesis | Veredicto |
|---|---|
| `orders` = backend | **Sí**, y bastante más que un backend: es el monolito entero — dominio, persistencia, parser LLM, motor conversacional, integraciones WhatsApp y **las tres APIs HTTP** (operator, owner, admin). Los dos UIs no tienen backend propio. |
| `operator` = panel operativo | **Sí.** Cola de pedidos, detalle, edición de borrador, verificación de comprobantes, panel de conversaciones, takeover del bot. |
| `owner` = panel del dueño | **Sí** en intención. **Pero hoy es una maqueta**: su login es un mock y sus lecturas sirven fixtures por defecto. Ver (c). |

El matiz: `duna-orders` no es "el backend de los dos paneles". Es el sistema completo, y los paneles son dos clientes delgados de Next.js que solo hacen `fetch` autenticado contra él. Ninguno de los dos toca la base de datos.

### Cómo se hablan

**Solo HTTP, en una sola dirección.** No hay base de datos compartida entre los UIs y el backend, no hay colas, no hay eventos. Cada UI habla con su propio prefijo de la API del monolito, con su propio token:

```
duna-operator-ui  ──HTTP+Bearer──▶  duna-orders  /operator/*   (lectura y ESCRITURA)
duna-owner-ui     ──HTTP+Bearer──▶  duna-orders  /owner/*      (solo LECTURA)
duna-admin-ui     ──HTTP+Bearer──▶  duna-orders  /admin/*      (cross-tenant; UI no accesible)
WhatsApp (Meta)   ──webhook────────▶  duna-orders  /webhooks/meta/whatsapp
WhatsApp (Twilio) ──webhook────────▶  duna-orders  /webhooks/twilio/whatsapp
```

El token nunca llega al navegador: vive en `process.env` del servidor de Next y se usa desde Server Components / Server Actions / Route Handlers. Los UIs son server-side por diseño, no SPAs.

### Dónde vive la verdad de cada dato

**Toda en Postgres (Neon), y solo ahí.** `duna-orders` es dueño único de las 26 tablas. Los UIs son estrictamente sin estado — no hay caché local, no hay store de cliente, no hay tabla propia.

Dos excepciones que conviene tener presentes:

- **El catálogo de productos vive en la base**, pero el **nombre del negocio y su metadata** viven en un **archivo JSON estático del repo** (`data/demo_restaurant_catalog.json`, bloque `business`). No hay tabla de tenants. Lo dice el propio código: *"There is no tenants table."*
- **La política de comprobante y los métodos de pago ofrecidos son configuración EN CÓDIGO**, por tenant, en diccionarios de Python (`services/comprobante_policy.py`, `services/payment_methods.py`). No hay tabla de configuración por tenant.

### ¿Por qué DOS UIs separadas?

La respuesta corta: **por audiencia y por superficie de permiso, no por deploy ni por reutilización de código.**

La evidencia:

1. **Auth distinto de verdad.** Tokens independientes y separadamente revocables. El propio código lo declara como propiedad de seguridad buscada: *"an INDEPENDENT secret (duna_operator_api_token) so the read (owner) and write (operator) surfaces have separately revocable keys."*
2. **Superficie asimétrica.** `/operator/*` escribe (aprobar, rechazar, editar ítems, verificar comprobantes, mandar mensajes, takeover). `/owner/*` es **íntegramente de lectura** — balance, analítica, cohortes, reconciliación. No hay un solo endpoint de escritura en el router de owner.
3. **Deploy: hoy ninguno de los dos deploya.** No hay `vercel.json`, ni Dockerfile, ni `wrangler.jsonc`, ni workflow de CI en ninguno de los dos repos. `next.config.ts` está vacío en ambos. Corren en local (`-p 3001` el de operator, 3000 el de owner).
4. **Código: cero compartido.** No hay monorepo, ni paquete común, ni design system compartido. Cada uno reimplementa lo suyo. Comparten el patrón (Next 16 + React 19 + Tailwind 4 + Vitest) y nada del código.

O sea: la separación es **de producto** — dos personas distintas, dos trabajos distintos, dos llaves distintas. Que además vivan en repos distintos es consecuencia, no causa.

---

## (b) Modelo de tenant

### Cómo se identifica un restaurante

**`tenant_id`: un `String(120)` denormalizado en las 26 tablas.** No es una FK — no hay tabla a la que apuntar. Es una etiqueta que cada fila lleva encima.

La decisión de nombrarlo `tenant_id` y no `restaurant_id` es explícita y está en `ARCHITECTURE.md`: mantener el núcleo agnóstico del vertical, para que sirva a restaurantes, cafés, vendedores de e-commerce y distribuidores pequeños sin atar el modelo.

El tenant del piloto es `el-fogon-colombiano` ("El Fogón Colombiano", `business_type: restaurant`, `COP`).

### Dónde vive esa identidad — cuatro sitios distintos

Y este es el hallazgo estructural de (b): **la identidad de un tenant está repartida en cuatro lugares heterogéneos**, ninguno de los cuales es una tabla de tenants.

| Qué | Dónde vive | Tipo |
|---|---|---|
| El identificador | columna `tenant_id` en las 26 tablas | dato |
| Nombre del negocio, tipo, moneda, catálogo | `data/demo_restaurant_catalog.json`, bloque `business` | **archivo del repo** |
| Canal de mensajería (proveedor, `phone_number_id`, `credential_ref`) | tabla `tenant_channels` | dato |
| Política de comprobante, métodos de pago ofrecidos, ruteo de preguntas | diccionarios de Python | **código fuente** |

El comentario de `tenant_display.py` lo dice sin rodeos: *"There is no tenants table, and `tenant_channels` carries provider/credential routing but no display name. The ONLY place a human-readable business name exists today is the catalog's `business` block."*

### El aislamiento entre tenants: derivado, nunca aceptado

La propiedad de seguridad está bien construida y conviene reconocerla: **el `tenant_id` se DERIVA del token en la dependencia de FastAPI, nunca se acepta del request.** Ningún endpoint de operator ni de owner recibe `tenant_id` como parámetro. Una llave no puede actuar sobre otro tenant porque no hay dónde escribir el tenant ajeno.

La excepción declarada es `/admin/*`, la única superficie cross-tenant, cerrada por default (503 sin token) con su propio secreto.

### Cómo se agrega un cliente nuevo hoy

**Manual, por línea de comandos, sin provisioning.** No hay endpoint de alta, no hay flujo de onboarding, no hay UI. La secuencia real, reconstruida del runbook de Meta y los scripts:

1. **Verificación en Meta Business Manager** — externo, de días a semanas. Es el gate crítico.
2. **Crear el WABA y registrar el número por Coexistence** (el dueño conserva su número y su app nativa de WhatsApp).
3. **Poner credenciales en el entorno** (`META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`).
4. **Suscribir el webhook** y — paso aparte, y el runbook advierte que es el que se olvida — **suscribir la app al WABA** vía `curl` a `/{WABA_ID}/subscribed_apps`. Sin esto Meta nunca hace POST y *"the symptom is silence"*.
5. **Registrar el canal:** `python scripts/seed_meta_channel.py --tenant <t> --display-e164 <+E164> --yes`
6. **Sembrar el operador:** `python scripts/create_operator.py` (la tabla `operators` nace vacía; sin esto el operador recibe un 401 genérico).
7. **Escribir el catálogo a mano** como JSON en `data/`, con el bloque `business`.
8. **Editar código Python** si el tenant necesita otra política de comprobante o de métodos de pago.

Los pasos 7 y 8 son los que hacen que esto **no sea provisioning sino una rama de deploy**: dar de alta un cliente hoy incluye editar archivos del repositorio y desplegar de nuevo.

Hay además una convención de onboarding no verificable por el sistema, registrada en `DECISIONS.md`: los productos por porción **deben** catalogarse con `unit="porción"` y sufijo `xN` en el nombre (`"Empanadas de carne x3"`) o *"the disclosure silently no-ops"*. Es una regla que vive en la cabeza de quien hace el alta.

**Y el supuesto que lo enmarca todo:** `single-tenant-per-deployment`. Está escrito así en tres módulos distintos. La multi-tenancy real está diferida y hay un *watch* explícito: `"hoy"` se deriva de `settings.default_timezone`, una configuración **global**, así que dos tenants en husos distintos compartirían el corte del día. Aceptable en piloto, dice la nota; a revisar antes de multi-tenant real.

---

## (c) Identidad y auth

### Tres superficies, tres secretos, ninguna identidad compartida

| Superficie | Quién se loguea | Mecanismo backend | Sesión en el UI |
|---|---|---|---|
| `/operator/*` | Un humano del restaurante (`cocina01`) | **Login real**: `operators` + `operator_sessions`, argon2id, token opaco | `iron-session`, cookie cifrada |
| `/owner/*` | El dueño | **No hay auth de owner.** Bearer estático ligado a un tenant | Cookie de bandera, credencial **mock** |
| `/admin/*` | Interno (Carlos) | Bearer estático, cross-tenant, cerrado por default | UI no accesible |

### El operador: auth real y bien construida

Es la pieza madura. `POST /operator/auth/login` devuelve `{token, operator_id, display_name, expires_at, tenant_display_name}`.

- `operators.password_hash` es **argon2id**, nunca expuesto por el modelo de dominio.
- `operator_sessions` guarda **solo el hash SHA-256** del token opaco, nunca el token. Expiración **deslizante** por inactividad; `revoked_at` da revocación instantánea.
- `operator_login_attempts` es **append-only**: el contador de bloqueo por fuerza bruta es un `COUNT(*)` de filas recientes, no un contador incrementado — sin lecturas-modificaciones-escrituras, sin incrementos perdidos bajo uvicorn multi-worker. Por `(tenant, username)`, nunca por IP, *"all login traffic is one source IP"*.
- Un operador pertenece a **un solo tenant**, por construcción (índice único parcial sobre `(tenant_id, username)`).
- Nunca se borran filas de `operators` — solo `active=false` — para que las referencias históricas (`verified_by`, `operator_id` en transiciones) siempre resuelvan.

En el UI: `iron-session` con `SESSION_SECRET` obligatorio (falla ruidosamente, *"never fall back to an insecure default secret"*), `secure` en producción, y el `maxAge` de la cookie **sigue al `expires_at` del backend** en vez de tener su propia idea de cuándo caduca.

Convive con un **principal de servicio estático** (bearer sin humano detrás): `operator_id` queda `NULL` y así se distingue en la auditoría.

### El owner: es una maqueta, y el propio código lo declara

Este es el hallazgo más importante de (c). El login del owner **no autentica nada**:

- La credencial es un literal en el bundle: `MOCK_USERNAME = "elfogon"`, `MOCK_PASSWORD = "duna2026"`.
- La cookie **es una bandera, no un token** — contiene la constante `"1"`. Cualquiera que pueda ponerse una cookie en su propio navegador pasa la guarda.
- No hay scoping por tenant detrás: toda lectura es del `MOCK_TENANT`.

El archivo lo dice de frente: *"THIS FILE IS THE WHOLE OF THE 'AUTH'… IT CLAIMS NO SECURITY"*, y fija la condición de salida: *"the pilot does not go in front of a real owner until the real one is behind it."*

Está construido como una **costura deliberada**: `owner-session.ts` tiene ya la forma de la versión real, y cuando llegue el auth de verdad *"THIS MODULE IS THE ONLY ONE THAT DIES"*. Es una maqueta con la frontera dibujada, no un descuido — pero es una maqueta.

**Los datos también son mock por defecto.** Ambos UIs traen un interruptor `DUNA_*_API_SOURCE` que arranca en `"mock"`; solo con `"live"` hacen `fetch` real. El de owner es más honesto todavía: cada lectura reporta su propia procedencia (`source`, `fellBack`), así que una pantalla puede estar en vivo con un número que se cayó al fixture, y eso se ve.

### ¿Comparten identidad owner y operator?

**No, y en ningún nivel.** Secretos distintos y separadamente revocables; cookies distintas (`duna_owner_session` vs. la de iron-session); librerías distintas (`iron-session` vs. `cookies()` de Next a pelo — `duna-owner-ui` ni siquiera tiene `iron-session` en sus dependencias); modelos distintos (el operador es una **fila** en `operators`, el owner es un **token ligado a un tenant** sin fila que lo represente).

No hay tabla de usuarios común, ni roles, ni un modelo de identidad unificado. **Un "dueño" no es una entidad en la base de datos de Duna.**

---

## (d) Modelo de datos y tabla de mapeo — la pieza central

### El modelo de duna-orders: 26 tablas

Agrupadas por rol:

**Núcleo de negocio (6)** — `products`, `customers`, `orders`, `order_items`, `stock_movements`, `order_status_transitions`

**Motor conversacional (6)** — `conversation_sessions`, `conversation_turns`, `conversation_accumulated_drafts`, `conversation_customer_claims`, `customer_reply_outbox`, `deferred_inbound`

**Ingesta y mensajería (4)** — `meta_inbound_intake`, `processed_messages`, `outbound_messages`, `tenant_channels`

**Pago (3)** — `comprobantes`, `order_comprobante_reask`, `order_close_without_comprobante`

**Identidad (3)** — `operators`, `operator_sessions`, `operator_login_attempts`

**Observabilidad (4)** — `parse_log`, `draft_corrections`, `ui_events`, (+ el rastro en `order_status_transitions`)

Relaciones con FK real: solo cinco. `order_items → orders` (CASCADE), `order_items → order_items` (padre-hijo para adiciones, **sin** CASCADE a propósito), `order_status_transitions → orders`, `conversation_turns → conversation_sessions`, `conversation_accumulated_drafts → conversation_sessions`, `customer_reply_outbox → conversation_sessions`, `operator_sessions → operators`. El resto de las relaciones son **por convención**, no por constraint — `orders.customer_id` y `comprobantes.order_id` no son FK.

### La tabla de mapeo

Leyenda: **≡** coincide · **⚠** el nombre coincide pero la semántica difiere · **◑** existe solo en un lado

| Nuestro núcleo | En Duna | ¿? | Lectura |
|---|---|:---:|---|
| **Order** | `orders` | ⚠ | **La diferencia más cara del mapa.** Ver desglose abajo. |
| **Product** | `products` | ⚠ | Coinciden nombre, precio, stock, activo, categoría, unidad. Difieren en para qué existen: Duna tiene `aliases` (JSON) y `options`/`variant_group` **para que el parser LLM reconozca el producto en texto informal**; nosotros tenemos `slug`, `sku`, `imagenes`, `notasCata` para vender en vitrina. **Duna no tiene `costo`** — no puede calcular margen; toda nuestra Analítica de rentabilidad es inconstruible sobre su modelo. Su `current_stock` es `Numeric(14,3)`, el nuestro `Int`. |
| **Customer** | `customers` | ⚠ | **Invariantes contradictorios.** Duna: teléfono **único por tenant**, con doble índice — el crudo y un `phone_key` canónico derivado (dígitos, indicativo forzado) para que `+573001234567` y `3001234567` no sean dos clientes. Nosotros: `telefono` **deliberadamente NO único** — "un teléfono puede ser compartido por varias personas (decisión de producto)", y la ambigüedad la resuelve `rankPhoneMatches`. Fusionar los dos modelos obliga a elegir cuál invariante muere. Además: nosotros tenemos `email` único, Duna **no tiene email en absoluto**; nosotros llevamos contadores (`numero_ordenes`, `total_compras`), Duna lleva `first_order_at`/`last_order_at`. |
| **Payment** | `comprobantes` | ⚠ | **El oro del mapa.** Nuestro `Payment` es **la plata**: `monto`, `metodo` (enum), `fecha`, `registrado_por`; "la existencia de la fila ES el pago recibido" y mueve la orden a `pagado` en la misma transacción. El `comprobante` de Duna es **la foto del pago**: `media_bytes` (`LargeBinary`, la imagen dentro de Postgres), `media_content_type`, `size_bytes`. **No tiene monto.** Y tiene lo que nosotros no: un flujo de **verificación humana** (`status: received → verified`, `verified_by`, `verified_at`). Nosotros registramos dinero; ellos registran **evidencia de dinero que un operador debe validar mirándola**. |
| **Payment.estado / Order.estado='pagado'** | — | ⚠◑ | Duna **no tiene columna de estado de pago en ninguna parte**. Está escrito como decisión: *"`payment_status` is DERIVED from the existence of rows here, so there is no payment_status column on orders."* Nosotros lo tenemos materializado en `Order.estado`. |
| **`Order.condicion_pago`** (`ANTICIPADO`/`CONTRAENTREGA`) | `comprobante_policy` (`blocking`/`tracked`/`none`) | ⚠ | Parientes conceptuales — los dos deciden *si se despacha sin haber cobrado* — pero **en planos distintos**. El nuestro es **por orden**, es una **columna**, y es inmutable una vez la orden tiene Shipping o Payment. El de ellos es **por tenant**, vive **en un diccionario de Python**, y por tanto no es dato: no se puede consultar, ni auditar, ni cambiar sin desplegar. Su default es `blocking`. |
| **`MetodoPago`** (enum) | `payment_method` (String) + `PaymentMethod` (Literal) | ⚠ | Mismo dominio colombiano y casi el mismo conjunto: Nequi, Daviplata, transferencia, efectivo. **Ellos añaden Bre-B**, nosotros no. Ellos separan dos ejes que nosotros no distinguimos: métodos *representables* (persistibles, append-only) vs. *ofrecidos* (lo que el bot le muestra al cliente, por tenant). Y tienen el concepto de **familia transferencia** — el subconjunto que produce comprobante, con efectivo deliberadamente excluido. |
| **Shipping** | — | ◑ | **Solo nuestro.** Duna no tiene entidad de envío: `fulfillment_type`, `delivery_zone`, `delivery_address`, `delivery_date` son **columnas de la orden**. No hay mensajero, ni transportadora, ni número de guía, ni `zona_sugerida`, ni `stock_descontado_at`. Su modelo es domicilio de restaurante en el día; el nuestro es despacho de e-commerce con transportadora nacional y rastreo. **Y el descuento de stock ocurre en momentos distintos**: ellos al confirmar la orden, nosotros al despachar (`en_ruta`). |
| **InventoryLog** | `stock_movements` | ⚠ | Mismo propósito, kardex. Pero el nuestro guarda `stock_anterior` y `stock_nuevo` — y nuestro invariante escrito es que **los asientos deben poder recorrerse en cadena**. El de Duna guarda solo `quantity_delta`: **su kardex no es encadenable**, no hay antes/después. A cambio tiene `reference_id` apuntando a la orden que lo causó. Nuestra `cantidad` es `Int`, su `quantity_delta` es `Numeric(14,3)`. |
| **Notification** | — | ◑ | **Solo nuestro.** La campana del operador. Duna no tiene bandeja de notificaciones persistida. Su equivalente funcional es **derivado, no almacenado**: el panel de conversaciones calcula `attention_reasons` al vuelo, con siete razones cerradas (`reply_owed_stale`, `slot_loop`, `degraded_parses`, `outbound_degraded`, `takeover_active`, `materialization_failed`, `reply_failed`). No confundir con `customer_reply_outbox` ni `outbound_messages`: esos van **al cliente**, no al operador. |
| **AutomationSetting / AutomationRun** | — | ◑ | **Solo nuestro**, y sin equivalente estructural. Nuestro motor es "ante el evento X, manda el mensaje Y una vez por período", con registro de catálogo en código, bitácora por ejecución y gate de idempotencia por `(key, target, periodo)`. Lo más cercano en Duna —el sweeper conversacional + `customer_reply_outbox`— responde otra pregunta: "¿a este turno se le debe respuesta, y qué se le dice?". **Son máquinas distintas, no la misma con otro nombre.** |
| — | `conversation_sessions` · `conversation_turns` · `conversation_accumulated_drafts` · `conversation_customer_claims` | ◑ | **Solo de Duna.** El motor conversacional. No tenemos nada remotamente parecido. |
| — | `customer_reply_outbox` · `deferred_inbound` · `meta_inbound_intake` · `processed_messages` · `outbound_messages` | ◑ | **Solo de Duna.** Ingesta idempotente, outbox con reintentos y backoff, deduplicación por `wamid`. |
| — | `tenant_channels` | ◑ | **Solo de Duna.** El registro tenant↔canal, en ambas direcciones. **Es la pieza que hace multi-tenant al canal.** |
| — | `operators` · `operator_sessions` · `operator_login_attempts` | ◑ | **Solo de Duna.** Nosotros usamos Better Auth (`user`/`session`/`account`/`verification` + `Invitation` + `Role`), que es otro modelo entero. |
| — | `order_status_transitions` | ◑ | **Solo de Duna**, y vale la pena señalarlo: rastro completo de cada cambio de estado con `from`/`to`/`occurred_at`/`source`/`operator_id`. **Nosotros no tenemos auditoría de estado de orden.** |
| — | `parse_log` · `draft_corrections` · `ui_events` | ◑ | **Solo de Duna.** Observabilidad del parser (con tokens y costo), captura de la corrección del operador como ground-truth para evaluación, y telemetría de UI cuya **forma es la garantía de privacidad** — sin columnas de texto libre ni JSON, así que no puede contener un mensaje de cliente aunque alguien lo intentara. |
| **DashboardPreference** | — | ◑ | Solo nuestro. |
| **`tenant_id`** | en las **26** tablas | ◑ | **La asimetría estructural del mapa.** Duna lo lleva en todas; nuestro núcleo **no lo tiene en ninguna**. Nuestro `CLAUDE.md` ya marca las costuras previstas (`DashboardPreference` compuesto, prefijo de storage por tienda, `ZONA_CONFIG` a DB por tienda) pero no está construido. |

### El desglose de Order — donde está la diferencia cara

Los dos se llaman *orden* y son **objetos distintos del negocio**:

| Eje | Nuestro `Order` | El `orders` de Duna |
|---|---|---|
| **Quién la crea** | Una persona (admin) o el checkout. Es una **intención completa**. | Un **reactor** la materializa desde una conversación que el cliente ya confirmó. |
| **Estado inicial** | `pendiente` — ya es una orden de verdad | `draft` — **todavía no es una orden**; espera aprobación del operador |
| **El vocabulario** | `pendiente → pagado …` — eje **de cobro** | `draft → approved → in_preparation → ready → delivered \| picked_up` (+ `cancelled`) — eje **de cocina y entrega** |
| **Qué significa "confirmado"** | Que se pagó | Decisión explícita del repo: **"confirmation ≠ order creation"**. Que el cliente confirme por WhatsApp **no crea** la orden; crea un borrador que un humano debe aprobar. |
| **Idempotencia** | `idempotencyKey` opcional | Índice único parcial sobre `conversation_id`: **una conversación, una orden**, garantizado por la base |
| **Texto original** | no existe | `raw_message` **NOT NULL** — la orden **carga el mensaje del cliente** |
| **Cierre** | `entregado` | **Dos cierres mutuamente excluyentes** según el `fulfillment_type`: `delivered` para domicilio, `picked_up` para recoger. `cancelled` **no es un cierre**, es un aborto. |
| **Solo en el suyo** | — | `conversation_id`, `raw_message`, `eta_minutes`, `packaging_fee`, `confirmation_message` |
| **Solo en el nuestro** | `numero_orden`, `condicion_pago`, `metodoPagoPrevisto`, `deliverySlot`, `canal` | — |

Y una consecuencia que se ve al superponerlos: **nuestro eje de cobro y su eje de cocina son ortogonales**. Su orden puede estar `ready` sin que nadie sepa si se pagó (eso lo responde la existencia de un comprobante verificado). Nuestra orden puede estar `pagado` sin que nadie sepa si se preparó. Un `Order` unificado necesita **los dos ejes a la vez**, no uno de los dos ni una mezcla.

---

## (e) El canal WhatsApp — del mensaje a la fila

### El camino completo

```
Cliente escribe por WhatsApp
   │
   ▼
[1] Webhook  POST /webhooks/meta/whatsapp   (o /webhooks/twilio/whatsapp)
    · Firma X-Hub-Signature-256 verificada ANTES de tocar nada
    · INSERT en meta_inbound_intake — UNA FILA POR MENSAJE, no por POST
    · UNIQUE(message_id) = el wamid ⇒ la redelivery no escribe y no dispara efecto
    · Guarda el CUERPO CRUDO, no los campos extraídos
    · NO resuelve tenant: el webhook no hace lecturas. Responde y corta.
   │
   ▼
[2] Consumidor (meta_inbound_consumer) — proceso aparte, despertado por el webhook
    · Reclama la fila con lease (claimed_at/claimed_by); un worker muerto se recupera
    · Resuelve el tenant: value.metadata.phone_number_id ─▶ tenant_channels ─▶ tenant_id
    · Sin match ⇒ estado 'skipped', tenant queda NULL para siempre
   │
   ▼
[3] Sesión de conversación
    · UNA conversación abierta por (tenant, teléfono) — índice único parcial sobre status='open'
    · El turno entra en conversation_turns (UNIQUE por tenant+message_sid)
    · Si otro turno del mismo cliente está en vuelo ⇒ deferred_inbound (se drena después)
    · conversation_customer_claims da el lease por cliente: sin dos procesos sobre la misma persona
   │
   ▼
[4] Parser LLM  (Anthropic, con fallback)
    · Empareja texto informal contra el catálogo del tenant (products.aliases)
    · Emite señales de diálogo: done_adding_items, is_question, is_confirming,
      is_canceling, address_complete, question_category, latest_inbound_confirms_order
    · Todo queda en parse_log: modelo, versión de prompt, latencia, tokens, costo, texto crudo
   │
   ▼
[5] Borrador acumulado  (conversation_accumulated_drafts, 1:1 con la conversación)
    · El carrito vivo, en JSON, versionado. Se MERGE turno a turno
    · Las señales del parser se proyectan aquí para que el sweeper las lea
   │
   ▼
[6] Capa CUÁNDO (sweeper) + capa QUÉ (evaluador)
    · CUÁNDO: ¿toca responder ya? (debounce, t_max 8s, backoff, last_replied_turn)
    · QUÉ: ¿qué se dice? (pedir dato faltante, responder pregunta, resumen y confirmar)
    · Si un operador tomó la conversación (manual_takeover_at) ⇒ el bot se CALLA
   │
   ▼
[7] customer_reply_outbox ─▶ Twilio / Meta ─▶ el cliente
    · UNIQUE(tenant, conversation_id, turn_sequence): una respuesta por turno
    · Reintentos con attempt_count / next_attempt_at
    · Al enviarse el resumen se sella su firma SHA-256
   │
   ▼
[8] El cliente confirma  ⇒  session.status = 'customer_confirmed'
    ⚠ AQUÍ TODAVÍA NO HAY ORDEN
   │
   ▼
[9] Materializador (conversation_order_materializer) — reactor propio, ciclo propio
    · Lee el borrador final + la identidad del cliente ⇒ DraftOrderRequest
    · OrderService.create_draft — el ÚNICO escritor de Order
    · ⇒ ***FILA EN `orders`, status='draft'***
    · Idempotencia doble: índice único sobre conversation_id (duro) +
      session.resulting_order_id (marcador suave)
    · Un fallo permanente marca materialization_failed_at y sale del set de pendientes
   │
   ▼
[10] El operador aprueba en duna-operator-ui
    · Si el método es de la familia transferencia y la política es 'blocking':
      NO se aprueba sin comprobante verificado
    · draft → approved → in_preparation → ready → delivered | picked_up
    · Al confirmar se escriben los stock_movements
```

### La costura que más importa para la plataforma unificada

**El punto [9] es la costura.** Todo lo de [1] a [8] es un mundo que nuestro núcleo no tiene y que no puede improvisar: idempotencia por `wamid`, leases por cliente, un carrito que se acumula entre turnos, un parser con su propio log de costo, y una máquina de cuándo-responder separada de qué-responder.

Y lo que hay que ver es que **[9] ya es una frontera limpia**: el materializador es un servicio aparte, con su propio reactor, que consume una conversación terminal y llama a **un único escritor** (`OrderService.create_draft`). No está entretejido con el bot. Eso es exactamente lo que hace pensable tratar WhatsApp como un canal de nuestro `Order`: el contrato entre el motor conversacional y la orden ya está reducido a una llamada.

Tres asimetrías concretas contra nuestro modelo, para tenerlas anotadas:

1. **Su orden nace en `draft` y espera a un humano.** La nuestra nace ya siendo una orden. Un canal WhatsApp sobre nuestro `Order` necesita un estado previo a `pendiente` que hoy no existe.
2. **La confirmación del cliente no es la creación de la orden.** Está decidido y está construido así. Si en la plataforma unificada la confirmación creara la orden, se pierde el gate del operador — que es justo lo que hace confiable un pedido parseado por un LLM.
3. **Nuestro `AutomationRunEstado.PENDIENTE_CANAL` existe porque nuestro canal de WhatsApp es un stub.** El de ellos está conectado de verdad. Esa es la asimetría de activos más grande entre los dos sistemas.

---

## (f) Stack e infraestructura

| | **duna-orders** | **duna-operator-ui** | **duna-owner-ui** | **nuestro núcleo** |
|---|---|---|---|---|
| Lenguaje | Python ≥3.11 (ruff→py313) | TypeScript 5 | TypeScript 5 | TypeScript 5 |
| Framework | FastAPI 0.136.3 + uvicorn 0.48.0 | Next 16.2.9 | Next 16.2.9 | Next 16.2.6 |
| UI | Streamlit (legado) | React 19.2.4 + Tailwind 4 | React 19.2.4 + Tailwind 4 | React 19.2.4 + Tailwind 4 |
| ORM | **SQLAlchemy 2.0** | — | — | **Prisma 7** |
| Migraciones | **Alembic** (51 archivos) | — | — | **Prisma Migrate** (~34) |
| DB | **Neon Postgres** (us-east-1) | — | — | **Neon Postgres** (4 ramas) |
| Sesiones | argon2id + token opaco en DB | `iron-session` 8 | `cookies()` a pelo (mock) | **Better Auth** |
| LLM | `anthropic` + `openai` | — | — | — |
| Mensajería | `twilio` 9.10.9 + Meta Graph v22.0 | — | — | stub |
| Tests | pytest (~4254 en el gate) | Vitest 2 | Vitest 2 | node:test + carril PG |
| **Deploy** | **local: uvicorn + cloudflared** | **ninguno** | **ninguno** | **Vercel** |

### Cuánto difiere del nuestro

**Lo que coincide y es aprovechable:** Neon Postgres en los dos lados. Next 16 + React 19.2.4 + Tailwind 4 en los tres frontends — misma generación exacta, incluso el mismo patch de React. La disciplina de migraciones aditivas. El dominio colombiano (COP, Nequi/Daviplata, Bogotá).

**Lo que no coincide, en orden de costo:**

1. **Python/SQLAlchemy/Alembic vs. TypeScript/Prisma.** No es una diferencia de gusto: son dos motores de migración que no se hablan, sobre la misma marca de base de datos. Unificar significa que uno de los dos deja de ser la fuente del schema.
2. **Deploy: ellos no tienen.** Nosotros estamos en Vercel con cuatro ramas de Neon separadas por entorno, `migrate deploy` en cada build y cron en GitHub Actions. Ellos corren **en la máquina de Carlos**: uvicorn local, túnel cloudflared para exponer el webhook a Meta, contra Neon. No hay Dockerfile, ni CI, ni configuración de host en ninguno de los tres repos.
3. **Modelos de sesión incompatibles.** Better Auth (nuestro) contra sesiones propias en tabla (suyo). No hay migración trivial entre los dos.

### El hallazgo de infraestructura que manda

Está en la última entrada de `DECISIONS.md` (2026-08-05), y es medición, no estimación:

> El round-trip **Bogotá → Neon mide ~96 ms de mediana**, y **un turno emite 46 statements**. Eso son **~4,4 segundos de red pura por turno**, antes de que la aplicación haga nada.

La conclusión registrada es que **ningún refactor alcanza eso, porque no es una forma del código**: *"CO-LOCATION IS THE FIX."* Se descartaron por evidencia las alternativas baratas (el debounce nunca estuvo en la ruta crítica; el intervalo del sweeper lo puentea el webhook). **Hetzner Ashburn está promovido a la cabeza de la cola.**

Es el dato de infraestructura más consecuente del mapa: hay un movimiento de hosting ya decidido y pendiente, motivado por una medición, y ese movimiento condiciona cualquier decisión de dónde vive la plataforma unificada.

---

## (g) Lo caro de cambiar

Ordenado por cuánto restringe el diseño.

### 1. Un cliente real en producción, sobre WhatsApp en vivo

`el-fogon-colombiano` es un piloto **corriendo**, con conversaciones reales entrando por el número de WhatsApp del dueño. La última entrada de `DECISIONS.md` documenta un incidente del 2026-08-05 en que un test alcanzó `settings.database_url` e **insertó una fila en la tabla `meta_inbound_intake` de producción** (`message_id wamid.INLINE`), removida a mano por Carlos.

Lo que esto restringe: **hay una base de producción cuyo esquema no se puede romper**, y el modo de falla ya está demostrado. Las 51 migraciones de Alembic son historia aplicada, no una propuesta.

Matiz importante sobre el dato: `DECISIONS.md` registra *"demo / el-fogon-colombiano data only, no real customer PII until pilots fire"*, y un gate previo contó **731 filas de clientes en un solo tenant**. Las dos cosas pueden ser ciertas a la vez (volumen de smoke y demo), y **no pude verificar el contenido actual de la base** — no tengo, ni pedí, credenciales. La distinción entre "hay 731 clientes reales" y "hay 731 filas de prueba" es exactamente el tipo de cosa que en nuestro propio repo costó una purga cuidadosa; **hay que preguntárselo a Carlos, no deducirlo.**

### 2. Coexistence: el número es del dueño, no nuestro

Está en el runbook: *"the owner keeps their number and the native WhatsApp app; the Cloud API runs alongside it. Do not migrate the number away from the owner's phone."*

Restringe más de lo que parece: no hay un número de Duna que se pueda reapuntar. Cada tenant trae el suyo, con su verificación de Meta Business Manager de por medio — **de días a semanas, y fuera de nuestro control**. Cualquier plan de onboarding hereda ese gate. Y la salida de emergencia ya está diseñada: Twilio queda registrado y funcional en paralelo, el corte es **por tenant** vía la fila de `tenant_channels`, y el rollback es desactivar esa fila.

### 3. `single-tenant-per-deployment` es un supuesto atravesado en el código

Aparece declarado en al menos tres módulos, y su consecuencia práctica es que la configuración por tenant vive en **diccionarios de Python** y en **un JSON del repo**, no en la base. Con el *watch* ya anotado de la zona horaria global.

Restringe: el `tenant_id` en las 26 tablas es la mitad hecha del trabajo, y es la mitad difícil. La otra mitad —config por tenant como **dato**— está por construir, y es justo la que un producto multi-cliente necesita para dar de alta sin desplegar.

### 4. La decisión de co-locación ya tomada

Los 4,4 s de red por turno están medidos y Hetzner Ashburn ya está en cabeza de cola. Una decisión de plataforma que vaya en otra dirección tendría que discutir contra una medición, no contra una preferencia.

### 5. El gate del operador como principio de producto

*"Confirmation ≠ order creation"* no es un detalle de implementación: es la razón de que un pedido interpretado por un LLM sea confiable. La orden nace en `draft`, la aprueba un humano, y el comprobante bloquea la aprobación por default. Toda la máquina de `draft_corrections` existe para capturar esa corrección humana como ground-truth.

Restringe: es tentador, en un diseño unificado, dejar que el bot cree la orden directamente. Eso desmonta el gate.

### 6. Lo que NO es restricción — y por eso es negociable

Vale la pena decirlo explícitamente, porque es donde hay margen:

- **Los dos UIs no tienen deploy, ni CI, ni configuración de host.** No hay inercia de infraestructura que romper en el frontend.
- **`duna-owner-ui` es una maqueta con auth mock y datos fixture.** No hay usuarios reales detrás, ni datos que migrar. Es el repo más barato de reorientar de los tres, con diferencia.
- **Los repos de la org están vacíos.** El trasvase de código está por hacer; hacerlo hacia una estructura distinta cuesta lo mismo que hacerlo hacia la actual.
- **No hay código compartido entre los tres.** No hay monorepo que desarmar, ni paquete común, ni design system que reconciliar.
- **Streamlit es legado.** Sigue en `requirements.txt` y hay un `streamlit_app.py`, pero el operador real ya vive en Next.

---

## Anexo — huecos declarados de este mapa

Cosas que **no** pude verificar, dichas para que no se lean como verificadas:

1. **`duna-admin-ui`** — sin acceso por decisión explícita. Solo vi su API desde el backend.
2. **El contenido real de la base de producción** — sin credenciales, y no las pedí. Todo lo que digo sobre volumen y naturaleza del dato sale de documentos del repo, que pueden estar desactualizados. **Es la primera pregunta para Carlos.**
3. **Si el piloto está sirviendo pedidos reales hoy mismo** — el código está listo y el runbook describe el cutover, pero el estado operativo de este momento no se deduce del repositorio.
4. **`ARCHITECTURE.md` y `README.md` de `duna-orders` están obsoletos** y no los usé como fuente. Si alguien más los lee, va a sacar un mapa distinto y equivocado.

---

*Sin recomendaciones, por encargo. El diseño viene después y con Carlos en la mesa.*
