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

---

## 2026-09-06 — Planes de suscripción como DATO de SiteContent (opción 1 de #49)
`728bb45` (Merge feat/planes-suscripcion-dato)

Cierra el hilo que la entrada de la opción 2 (2026-09-06, `d003d69`) dejó abierto: "(1) espera al cliente que venda suscripciones… → backlog #49".

**Elección:** los planes y pasos de suscripción pasan de `SUBSCRIPTION_PLANS`/`SUBSCRIPTION_STEPS` (mock/constante, RETIRADOS) a dos secciones de SiteContent (`suscripcionPlanes`, `suscripcionPasos`), campos PLANOS + lista plana compacta, rango 1-4 (piso 1). La fuente única la leen /suscripciones y el teaser de la home → no divergen (era el temor de #49).
**PRECIO = TEXTO OPCIONAL, no número.** Descartado el número: perdería la moneda, el "/mes" y el "desde $X" —del cliente— y un precio inventado sería dato falso en la ruta del dinero (familia § el rating fabricado). Vacío se OMITE. El campo ENSEÑA el formato (`formatCOP`) pero NO valida. La tarjeta usa el tratamiento de precio de ProductCard (16px verbatim); descartados `text-3xl` (inventado) y `text-4xl` (desborda la caja de 252px con precios largos — medido, no elegido por nombre).
**DESTAQUE = UN índice de sección (`destacadoSlot`), no un boolean por plan.** Descartado el boolean: dos en `true` es un estado malo posible; dos índices no existe. Unifica `plan.popular` (página) e `i===1` (teaser). Índice colgante → se DECLARA, no destaca nada.
**TEASER recorta a 3** (medido: la media columna de la home no da para 4 legibles); el destacado fuera del recorte REEMPLAZA al último, no va primero —ir primero rompería el byte-idéntico—.
**CTA en la FRONTERA del preview** (`whatsapp || preview`): un componente cuyo CTA cuelga de un dato que el árbol del admin no tiene MIENTE en el preview; se ve pero queda inerte por EscalaDesktop, y en la tienda real el guard sigue siendo el dato.
**FRECUENCIA se queda dentro de `descripcion`:** es una frase, no un dato que el sistema use; sacarla a campo sería una columna sin escritor (la mina inerte de `esSuscripcion`/`total_compras`).
Regla: § Backlog #49 (CONSTRUIDO).

## 2026-09-07 — #68 código muerto de suscripción transaccional: BORRADO, no cableado
`c503d5e` (Merge slice/sub-txn-dead-code-2)

**Elección:** se BORRA el residuo transaccional de suscripción —`SUBSCRIPTIONS_ENABLED`, `SUBSCRIPTION_DISCOUNT`, `Product.esSuscripcion?`, y un 4º residuo que el censo #68 no nombraba: la opción de carrito `suscripcion` (write-only, leída por nadie)—. Medido 100% muerto: `SUBSCRIPTIONS_ENABLED` es el literal `false`, `SUBSCRIPTION_DISCOUNT` queda inalcanzable tras él, y `esSuscripcion` tiene 3 lecturas y 0 escritores. No toca schema ni migración: `esSuscripcion` es campo SÓLO de TypeScript, NO tiene columna Prisma.
**Por qué BORRAR y no CABLEAR:** una suscripción hoy es sólo un mensaje de WhatsApp; su vida operativa —órdenes recurrentes, cobro— es PROYECTO APARTE con su propio disparador. El código muerto NO reserva el lugar de esa capacidad: no le ahorra nada al proyecto que la construya cuando su disparador se cumpla, y mientras tanto cada persona que lo lee tiene que averiguar de nuevo que no hace NADA. Familia del rating fabricado: lo inerte que se ve vivo es deuda que se paga en cada lectura.
**Corrección al asiento #68 anterior:** implicaba que un borrado podría tocar el schema; NO puede —no hay columna—, así que no hubo ventana de migrate ni runbook. Gate capa-1 890/890, next build 0. Gate visual del owner PASADO sobre el preview: sin hueco donde vivían el badge/"/mes" del ProductCard, el toggle oculto del detalle, ni el "/mes" de la fila de precio (todos gateados por una condición SIEMPRE falsa, así que el render era byte-idéntico —revisado, no por suerte—). Merge `--no-ff`, tree del merge == tree de la rama, deploy a producción disparado.
Regla: § Backlog #68 (BORRADO).

## 2026-09-07 — #8 WhatsApp vacío: aviso al dueño + el checkout no promete el canal
`2b6c9f7` (Merge slice/avisos-dormant-8-whatsapp)

Segundo dormido del censo de avisos (§ #65) construido. `SiteSetting.whatsapp` puede estar VACÍO —es el estado con el que NACE todo tenant nuevo: el seed neutro inserta `''` (migración 20260824120000), y el schema de escritura sólo impide DES-configurarlo, no el estado inicial— y aun así el checkout le prometía al comprador confirmación "por WhatsApp".
**DETECCIÓN:** `avisosDeConfiguracion` gana un 4º argumento (SiteSettings, ya en mano en el admin) y emite `negocio-whatsapp` cuando el número está vacío o es sólo espacios. Aterriza en `/admin/configuracion` (la convención de deep-link `?seccion&tarjeta` es del editor de CONTENIDO, no de SiteSetting; el límite queda escrito y con test).
**GATE (veracidad del storefront):** las dos promesas de WhatsApp del checkout se escriben ENTERAS por rama (no "prefijo fijo + cola variable", que metería un separador `<!-- -->` y rompería el byte-idéntico con el número puesto). Sin canal, la frase no lo ofrece —la misma guarda de verdad de `SuscripcionPlanes` y el footer—; el resto de la oración, que sigue siendo cierto, se queda.
**PLAZO (mismo renglón, decisión del owner):** "en menos de 2 horas hábiles" → "lo más pronto posible" en las dos ramas. Un plazo horneado es una promesa que el negocio no eligió y el template no garantiza por cliente.
**GEMELO (censado, NO tocado, por instrucción del owner):** la guarda de "todos los métodos apagados" (checkout, "Escríbenos para coordinar el pago") NO lee `whatsapp` y no renderiza enlace; mismo hueco conceptual, cableado a nada. Se resuelve aparte (necesita un DESTINO que ofrecer, no un borrado): § AVISOS-DORMANT-8-TWIN-1.
Regla: § Backlog #8 (CONSTRUIDO).

## 2026-09-07 — El gemelo de #8: la guarda "sin métodos de pago" gana un DESTINO
`355e8d5` (Merge slice/avisos-dormant-8-twin-1)

Cierra el gemelo que #8 censó y dejó a propósito. La guarda de `availablePayments.length === 0` decía "Escríbenos para coordinar el pago" SIN leer `whatsapp` y SIN enlace: mismo hueco conceptual que las promesas que #8 gateó, pero cableado a nada.
**Por qué NO se gateó como #8:** esa frase ES el fallback —no tiene otra a la que caer—, así que apagarla dejaría el paso de pago MUDO, justo lo que la guarda existe para evitar. Cerrar el hueco pedía un DESTINO, no un borrado.
**Elección (opción 1 del owner):** con canal, se NOMBRA —"No hay un método de pago disponible ahora mismo. Escríbenos por WhatsApp para coordinar el pago y completar tu pedido."—; sin canal, copy mínima y honesta que no inventa un canal ni expone la mala configuración al comprador: "No podemos completar tu pedido en este momento. Vuelve a intentarlo más tarde." Descartado dejarla vaga: vago no es honesto —el comprador tiene que adivinar por dónde escribir—, familia de la cuenta bancaria falsa y el rating fabricado.
**AVISO `checkout-sin-salida`:** el Dashboard avisa el combo severo —ningún método MOSTRABLE (§ metodos-pago: ON *y* con datos) Y `whatsapp` vacío—. Usa `isBogota: true`, o sea el dead-end TOTAL: nadie, en ninguna ciudad, tendría con qué pagar.
**LO QUE NO CUBRE, y por qué no es un aviso:** el caso PARCIAL —sólo Efectivo mostrable, que deja sin salida al comprador FUERA de Bogotá—. "Sólo entrego en Bogotá, sólo efectivo" es una forma LEGÍTIMA de operar, y un aviso que le grita al dueño por operar como decidió es ruido (mismo criterio que descartó "comparar contra los defaults" en los dormidos #3/#4). El problema real es que el comprador de fuera se entera AL FINAL: eso no lo arregla una alerta al dueño sino que la tienda diga A DÓNDE ENTREGA antes del checkout. Queda como decisión de producto: § cobertura de entrega visible.
Regla: § Backlog #8 (gemelo CERRADO).

## 2026-09-07 — Cuatro pares tipográficos nuevos (eje 3): el set cerrado pasa de 5 a 9
`b3df709` (Merge slice/pares-fuentes-4-nuevos-1)

Extensión ADITIVA del eje 3, de la sesión de diseño "Forma y composición · cinco ejes" (adoptada entera por el owner). Cada par llena un hueco de CARÁCTER DE NEGOCIO que los cinco actuales no tenían, no "otra serif elegante": **Robusta** (Oswald + Archivo) la condensada de cartel, para quien vende en bulto con el precio grande; **Técnico** (IBM Plex Mono + IBM Plex Sans) el registro de la hoja de cata —lote, altitud, fecha de tueste—, el hueco más raro dado el rubro; **Relato** (Familjen Grotesk + Source Serif 4) el ÚNICO con cuerpo serif, e invertido, para quien vende contando; **Cercano** (Quicksand + Mulish) la geometría redonda de cafetería de barrio. Nayoli es BYTE-IDÉNTICA: Editorial es el default y nunca se guarda (null), así que su fila no cambia.

**TÉCNICO VA RECORTADO, y es el único par que sube de peso.** IBM Plex Mono no tiene versión variable en Google Fonts —son 3 archivos estáticos—, así que a pesos plenos son ~118 KB (+33 sobre Editorial). Con el display en `400;600` queda ~94 KB (+9). Se recorta porque mucha compra en Colombia es por datos móviles. **Y alcanza, medido:** el storefront usa el rol DISPLAY en UN SOLO peso, 400 — cero usos de `font-playfair`/`font-display` con clase de peso en todo el repo, cero reglas `font-weight` en globals.css.

**DOS AFIRMACIONES DE LA CABECERA QUEDABAN FALSAS Y SE CORRIGIERON.** Decía "Ninguno pesa más — no hay nada que marcar" (falso: Técnico sube) y "PESOS por ROL, iguales a los de hoy: display 400;500;600" (ya no es universal). Además las cifras de red de los cuatro nuevos quedaron marcadas como ESTIMADAS: vienen de la propuesta, no de medir contra el CDN como las cinco actuales. Un número que se lee medido y no lo es es dato falso.
**LA PROPUESTA SE CORRIGIÓ CON MEDICIÓN:** decía que `linkFuentesTodas()` pasaría de 8 a 16 specs; medido, pasa de **9 a 17** (5 pares → 9 únicos con Inter deduplicado, + 8 nuevos). Se usó el número medido. El invariante que importaba se mantiene: Inter sigue siendo el único dedup y ningún par nuevo comparte familia.

**LA MATRIZ par×personalidad NO VA AL PICKER — es documentación de onboarding, no UI.** La elección de par y personalidad se hace en la sesión de alta; un aviso que dice "se puede ver peor" sin impedir nada se ignora, y un aviso que suena sin problema deja de leerse. **Nada se prohíbe en código:** el set cerrado ya garantiza que nada se rompe, sólo que algo se vea peor. La personalidad de forma es el eje 4, aún no construido; esto se registra ahora para que llegue con su documentación hecha.

  DESCARTADOS (2, del documento):
  · **Técnico + Suave** — un titular mono ya es rectangular; radios de 24px y píldoras lo contradicen en cada esquina.
  · **Cercano + Recta** — la esquina viva le quita a Quicksand justo lo que la hace elegible, y en versalitas pierde la curva que la distingue de Poppins.

  CON RESERVA, del documento (3):
  · **Robusta + Suave** — la píldora de 999px contra un titular vertical comprimido son dos ritmos en desacuerdo; el badge redondo le quita el filo que es su razón de ser.
  · **Relato + Mínima** — sin divisores ni sombra, la mancha serif necesita más aire del que dan los radios cortos; funciona si el cliente escribe párrafos, no si pone listas.
  · **Cercano + Mínima** — el radio corto alcanza, pero sin sombra ni divisores la página queda blanda, porque el par tampoco aporta filo.

  LA FRICCIÓN QUE YA EXISTÍA Y NADIE HABÍA NOMBRADO (del documento):
  · **Editorial + Recta** — Playfair es de contraste alto y trazo fino; con esquina 0, borde 1.5px e íconos de trazo 1.25 la página se vuelve toda fina y pierde jerarquía. Nayoli está en Suave, así que no la afecta — pero el picker debería decirlo.

  DERIVADOS POR EL ORQUESTADOR, **no tomados del documento** (2), por decisión del owner de completarlos. Mismo mecanismo que Editorial+Recta: **Recta impone el lenguaje de la etiqueta impresa** —esquina 0, borde 1.5px, versalitas con .12em— y eso contradice el carácter de las serif cuyo valor es la suavidad o la serenidad:
  · **Cálido + Recta** — la calidez de Fraunces viene del REMATE; la esquina viva y las versalitas la endurecen. Es el mismo choque que Cercano+Recta pero menos extremo: Fraunces conserva su identidad serif, así que es reserva y no descarte.
  · **Clásico + Recta** — Lora es serif de LIBRO, serena; el registro de etiqueta dura la saca de su lugar. A diferencia de Editorial no se vuelve fina (su trazo es más parejo), así que el problema es de REGISTRO, no de jerarquía.

  NOTA DE CONTEO, honesta: el documento afirma "cinco llevan reserva" pero no las desglosa todas. La lista de arriba no cuadra exactamente con ese número, y no se forzó para que cuadre — se registra cada cruce con su razón y su PROCEDENCIA, que es lo que sirve en el onboarding; el número suelto no.
Regla: § el set cerrado de pares tipográficos (9) · la matriz vive en el ledger, no en el picker.
