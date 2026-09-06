# DECISIONS

Libro append-only. Las entradas son verdad al momento de escribirse; son
historia, no estado actual. El estado se mide del código y de git, fresco.
Una entrada nunca se reescribe; una corrección se APPENDEA.

**Relación con CLAUDE.md:** CLAUDE.md guarda la REGLA resultante (la doctrina);
este libro guarda la ELECCIÓN y su porqué — qué opciones había, cuál se tomó, qué
se descartó y por qué. No se duplica doctrina acá; cada entrada apunta a la
sección de CLAUDE.md donde vive la regla.

**Fecha = el commit que MATERIALIZÓ la decisión en `main`** (git log, no memoria).
Las entradas de backfill de abajo se escribieron el 2026-09-06 leyendo git; donde
CLAUDE.md fecha distinto de git, git manda (se anota la diferencia en la entrada).

---

## 2026-09-02 — Presentaciones: campos PLANOS con slots, no repeater
`3588aee` (Merge feat/tanda-c1-presentaciones — GrindChooser → SiteContent, C1)

**Elección:** modelar la sección Presentaciones como CAMPOS PLANOS con slots, no como un repeater de ítems.
**Descartado el repeater:** sus defaults JAMÁS se muestran (invariante #44, que impide hornear prueba social falsa), así que no puede dar los defaults BYTE-IDÉNTICOS que Nayoli necesita sin fila; los campos planos sí.
**Evolución (`e61ee2c`, 2026-09-03):** el "exactamente 2" de C1 era una restricción de NAYOLI, no del producto — el 2º cliente (pastelería) lo movió a 2-4 → 2 slots REQUERIDOS + 2 OPCIONALES, campos planos igual. El modelado no cambió, sólo se sumaron slots.
Regla: § La BIFURCACIÓN de cardinalidad · § Presentaciones 2-4.

## 2026-09-02 — Taxonomía DERIVADA del catálogo, no declarada
`268f3ea` (Merge feat/tanda-c3-taxonomia-derivada)

**Elección:** las categorías se DERIVAN del catálogo (`categoriasDelCatalogo`), no de un set cerrado ni de un editor de taxonomía.
**Opciones:** (a) un editor de taxonomía / enum `ProductCategory`; (b) derivar del catálogo.
**Descartado el editor:** el import ya hace que el cliente escriba sus categorías; un editor se las pediría DOS veces. Y un enum café-shape no sirve al 2º cliente (no-café). `ProductCategory` y `CATEGORIA_LABELS` se BORRARON.
Regla: § La taxonomía se DERIVA del catálogo.

## 2026-09-03 — El destino de las tarjetas de Presentaciones pasa de estructura a DATO
`979283e` (Merge feat/combobox-categorias-y-destino-presentaciones)

**Elección:** el destino de cada tarjeta ("¿Cómo tomas tu café?") pasa de un path FIJO (`PRESENTACIONES_HREFS`) a DATO editable (`categoria1/2`).
**Por qué REVIERTE C1 con dato nuevo:** C1 decidió "el path es ESTRUCTURA" asumiendo un set CERRADO de categorías —premisa válida entonces—. C3 (2026-09-02) mató esa premisa (taxonomía derivada, texto libre), así que el destino tiene que seguir al dato. No fue un error viejo: fue dato nuevo.
**El defecto que lo forzó:** el owner escribió "Café grano" en un producto y el link fijo "Café en Grano" dejó de traer nada — un link fijo hacia un texto que el cliente escribe libremente se rompe solo.
Regla: § El combobox de categoría · El DESTINO como DATO.

## 2026-09-03 — Rating fabricado: BORRADO, no configurable
`93883cb` (Merge feat/cuenta-bancaria-y-rating)

**Elección:** el "4.9 · 124 reseñas" (literal, sin sistema de reseñas) se BORRÓ; NO se volvió configurable.
**Opciones:** (a) borrarlo; (b) hacerlo un campo editable.
**Descartado editarlo:** un rating editable sin reseñas reales es una HERRAMIENTA para fabricar prueba social (familia #44, publicidad engañosa en Colombia). Las reseñas reales son un sistema con su propio modelo (§ Backlog #64), no un campo.
Regla: § El RATING fabricado se BORRÓ — y el censo periódico de datos falsos.

## 2026-09-03 — Cuenta bancaria del checkout = DATO del tenant, "no a medias"
`93883cb` (Merge feat/cuenta-bancaria-y-rating)

**Elección:** la cuenta de transferencia —antes HARDCODEADA ("Bancolombia · 123-456789-00") en la ruta del dinero— pasa a 4 campos editables en SiteSetting; VACÍO = el método "Transferencia" NO se muestra.
**Descartado un default de relleno:** una instrucción de pago incompleta es peor que un método menos (precedente del CTA de suscripciones que se oculta sin whatsapp). El seed NO trae cuenta (queda NULL) — la verdad, no una cuenta falsa.
Regla: § La cuenta de transferencia del checkout es DATO del tenant.
_Nota de fecha: CLAUDE.md la fecha "2026-09-04"; git la materializó el 2026-09-03._

## 2026-09-03 — pagoMovilNumero: campo PROPIO, sin fallback a whatsapp
`9f437fd` (Merge feat/checkout-scroll-y-metodos-pago)

**Elección:** el número de Nequi/Daviplata es un campo PROPIO (`pagoMovilNumero`), no un fallback a `SiteSetting.whatsapp`.
**Descartado el fallback:** perpetuaría por la puerta de atrás la conflación CONTACTO↔PAGO (contacto y pago vuelven a ser el mismo dato y nadie se entera). En su lugar la MIGRACIÓN backfillea `pagoMovilNumero = whatsapp` UNA vez: Nayoli queda igual y los dos datos quedan separados desde el día 1.
Regla: § Los MÉTODOS de pago son DATO del tenant.
_Nota de fecha: CLAUDE.md la fecha "2026-09-04"; git la materializó el 2026-09-03._

## 2026-09-05 — El editor de /admin/tienda dibuja por BLOQUES (sesión de diseño, adoptada entera)
`b97be30` (Merge feat/editor-bloques)

**Elección:** rediseñar la cáscara del editor para dibujar por BLOQUES (una pieza que POSEE sus imágenes y textos), adoptando ENTERA una sesión de diseño con mockup navegable.
**Por qué adoptar entera y no parchar:** el ciclo de parches-sobre-parches se cortó parando a diseñar. `grupo` (config declarada dos veces para un encabezado que no agrupaba nada) se retiró; una tarjeta dejó de quedar PARTIDA entre dos loops.
**Cómo se hizo segura la migración:** el bloque derivado por defecto renderiza idéntico → migración NO atómica, verificada (las secciones idénticas por el camino de bloques) antes de migrar ninguna.
Regla: § El editor de la tienda dibuja por BLOQUES.

## 2026-09-05 — Lista plana COMPACTA: el DATO sin huecos, no sólo el render
`b97be30` (Merge feat/editor-bloques)

**Elección:** al quitar un slot de una familia (`bullet1..4`) se COMPACTA el DATO (los de abajo suben), no se deja un hueco.
**Descartado dejar huecos:** haría coincidir editor y storefront sólo en lo RENDERIZADO (el storefront filtra vacíos), no en el DATO; el operador que borra la fila del medio quedaría con un agujero invisible. El modelo sigue siendo campos planos (#44 intacto) — esto es presentación.
Regla: § El editor de la tienda dibuja por BLOQUES (lista plana compacta).

## 2026-09-05 — Space Grotesk EXCLUIDA del set de fuentes para clientes
`60e7f78` (Merge feat/tanda-c2-tema-identidad)

**Elección:** el set cerrado de 5 pares tipográficos que un cliente puede elegir NO ofrece Space Grotesk (ni Hanken/Spline); "Moderno" usa Sora.
**Por qué:** Space Grotesk es la tipografía de DUNA (el design system del panel); un cliente vistiendo su tienda como el panel borra la separación producto/cliente. Afirmado con test (ningún par ofrece las familias de Duna).
Regla: § Las FUENTES son content.tema.fuentePar.

## 2026-09-05 — Wordmark-solo por defecto; el mark es opt-in por despliegue
`60e7f78` (Merge feat/tanda-c2-tema-identidad)

**Elección:** `Logo.conMark` nace en FALSE (wordmark-solo, sin hueco); el mark (la flor de Nayoli) es opt-in por despliegue vía env `NEXT_PUBLIC_STOREFRONT_MARK=1`.
**Opciones:** (a) mark siempre; (b) un `const = true` en código compartido; (c) opt-in por env.
**Descartado el `const`:** un fork mostraría la flor de Nayoli sin pedirlo. El env (mismo patrón que `NOINDEX`) no es un literal en código compartido. La identidad PORTABLE es el WORDMARK (nombre de SiteSetting); el mark es asset por-despliegue.
Regla: § El WORDMARK carga la identidad; el MARK es asset por-despliegue.

## 2026-09-06 — El "escenario" para Colores y tipografía (el layout sigue a la cardinalidad del control)
`3990bee` (Merge feat/paleta-escenario)

**Elección:** la pieza de la paleta deja el split `.tienda-vivo--editando` (las otras 4 secciones lo conservan intacto) y pasa a un ESCENARIO — preview a ancho ÚTIL completo + controles en una REGLETA acoplada a su borde inferior.
**Por qué difiere de las otras 4 (doctrina, no gusto):** EL LAYOUT SIGUE A LA CARDINALIDAD DEL CONTROL. Acá son 10 controles CERRADOS sin texto libre → caben en una regleta de alto acotado; las otras son superficie ABIERTA (textareas, imágenes, tarjetas) de alto IMPREDECIBLE → necesitan su columna propia (el split). Un layout no se copia entre pantallas por parecido; sale de la forma del control.
Regla: § La PALETA es content.tema → EL EDITOR ES UN ESCENARIO.

## 2026-09-06 — Defectos de configuración: aviso APARTE, nunca en la cola del día
`b3b2b10` (Merge feat/avisos-configuracion — #65 Fase 1)

**Elección:** los defectos de CONFIGURACIÓN van en un AVISO APARTE del Dashboard, NUNCA dentro de "Necesita tu atención".
**Por qué:** esa cola es la del OPERADOR y SE VACÍA; un defecto de configuración se arregla UNA vez y no vuelve, así que la convertiría en un ACUMULADOR —una cola que nunca llega a cero deja de mirarse—. Y son de otro DESTINATARIO: la cola es del operador, la configuración del DUEÑO.
Regla: § El AVISO DE CONFIGURACIÓN del Dashboard.

## 2026-09-06 — Suscripciones: capacidad APAGABLE (opción 2); (1) y (3) al backlog
`d003d69` (Merge feat/cuenta-suscripciones)

**Elección:** de las tres formas para #49 —(1) planes como DATO de SiteContent, (2) apagar la capacidad ENTERA, (3) modelo OPERATIVO en la base— se tomó la (2): la suscripción es una capacidad APAGABLE (`content.paginas.suscripciones.visible`).
**Por qué (2) y no (3):** una suscripción hoy es SÓLO un mensaje de WhatsApp —sin Order/Payment/checkout, sin modelo en la base—, así que (3) no corresponde. **(1) espera** al cliente que venda suscripciones Y quiera planes distintos de los de Nayoli → backlog #49; el código muerto transaccional → backlog #68.
Regla: § La SUSCRIPCIÓN es una capacidad APAGABLE.

## 2026-09-06 — /cuenta BORRADA: andamiaje muerto con datos falsos
`d003d69` (Merge feat/cuenta-suscripciones; commit `a63acb4`)

**Elección:** BORRAR la ruta `/cuenta` (andamiaje de cuenta de cliente SIN construir que cargaba `MOCK_ORDERS` como historial + un auth stub con un usuario horneado), no dejarla redirigiendo.
**Opciones:** (a) borrarla; (b) gatearla con 404/redirect.
**Descartado dejarla redirigiendo:** ya redirigía a `/` en su primera línea, con el enlace del nav comentado desde v1 — un route que sólo existe para REDIRIGIR es un hack que oculta código muerto y mantiene vivos sus servicios mock. Se borró con censo de dependencias (`auth.service.ts`, `customers.service.ts` y 5 stubs de `order.service.ts`, todos sin importadores; `getOrderByNumber` sobrevive porque /rastrear-pedido es dato REAL).
Regla: § El RATING fabricado se BORRÓ — y el censo periódico (la tercera aparición).

## 2026-09-06 — Suscripciones como PESTAÑA, no como ajuste global
`d003d69` (Merge feat/cuenta-suscripciones; commit `fbbbb16`)

**Elección:** el interruptor de Suscripciones vive DENTRO de su pestaña del selector (patrón de Nosotros, render genérico de página apagable), no suelto arriba del selector.
**Por qué:** dos clases de página sin explicación enseñan mal el modelo — una PÁGINA es una PESTAÑA. Su pestaña sin secciones editables es HONESTA (los planes están en código hasta #49) y se llena sola cuando se construya la opción 1. El toggle de Nosotros NO se movió.
Regla: § La SUSCRIPCIÓN es una capacidad APAGABLE (punto 5).

---

## 2026-09-06 — NO adoptamos: cola plana (`queue/pending.txt`) ni el modo "corre sin parar"

_Primera entrada NUEVA (no backfill)._

**Contexto:** al adoptar dos artefactos del protocolo de orquestación de Carlos (este `DECISIONS.md` y la sección "Quién decide qué" de CLAUDE.md), se evaluaron otros dos y se DESCARTARON. Se adopta lo que aporta, no el seed completo — este repo ya tiene su doctrina.
**No adoptamos `queue/pending.txt`** (una cola plana de pendientes): el BACKLOG con DISPARADORES de CLAUDE.md es más rico. Una cola plana no sabe de disparadores; un ítem del backlog no es "lo próximo", es "lo próximo CUANDO pase X" (el 2º cliente, un tercer caso, tráfico real). Una cola plana pierde esa condición.
**No adoptamos el modo "corre sin parar":** choca con la disciplina de gates. El non-stop vale para censos / docs / tests; pero **todo lo que llega a un PREVIEW PARA en el gate del owner (capa 3)**. Un orquestador que no para se saltaría el gate visual, que es justo la capa que esta época existe para proteger (§ GATE DE CAPA 3).
