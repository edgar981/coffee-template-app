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

## 2026-09-07 — Eje 4 · personalidad de FORMA: el mecanismo y los radios (primera mitad)
`22f15ba` (Merge slice/eje-4-forma-mecanismo-1)

Cuarto eje del storefront, GEMELO EXACTO del de fuentes: un set CERRADO de tres personalidades —**Suave** (la de Nayoli), **Recta** (esquina viva y regla tipográfica) y **Mínima** (radio corto y parejo, sin divisores de banda)— sin editor libre. Vive en `content.tema.forma`, cuarto eje de la regleta del panel. **Suave es el null y NUNCA se guarda:** sin `<style>` las utilidades caen a su valor de hoy, así que Nayoli es byte-idéntica sin depender de ninguna siembra. Los nombres esquivan a propósito los cinco del set de fuentes: dos ejes con la misma etiqueta y distinto default serían una trampa en el picker.
**ESTA MITAD MUEVE SOLO LOS RADIOS DE TARJETA**, y por una razón mecánica: en Tailwind v4 `rounded-2xl` compila a `var(--radius-2xl)`, así que `--radius-3xl/2xl/xl` se mueven con CERO cambio de JSX. Los otros cinco tokens (`--sf-radio-lg`, `--sf-pildora`, `--sf-borde`, `--sf-divisor`, `--sf-trazo`) se emiten INERTES: nadie los lee todavía, y cablearlos es la segunda mitad. Suave va en **rem** con los valores exactos de hoy (1.5/1/0.75rem), no en px: a root 16px son idénticos, pero en rem la identidad es literal y no depende de que nadie toque el root.
**`:root` SCOPEADO, NO `@theme`:** `@theme` es global en Tailwind v4 y alcanzaría al ADMIN, que usa esos mismos radios. El `<style>` vive en el layout del grupo `(storefront)` —documento separado del `(admin)`—, así que el override no sale de la tienda. Y **NO se tocan `--radius-lg/md/sm`**: ésos son del panel (globals.css:98-100, no :118 como decía la propuesta).
**LA CLAVE VIAJA POR SEIS SITIOS, NO CINCO.** El censo nombró cinco (paletaEditableSchema, TemaContent, DEFAULTS.tema, resolverTema, el wire-map de la ruta) y el primer intento del build encontró un SEXTO que faltaba: el tipo del parámetro de `guardarTemaBorrador` (site-content-write.ts), **el límite de ESCRITURA**. Sin él, `forma` se cae al guardar —el bug #65-B otra vez— o el build rompe con TS2345. El worker PARÓ antes de escribir en vez de ampliar su alcance por su cuenta, que es exactamente lo que debía hacer.
**EL CENSO CORRIGIÓ A LA PROPUESTA, y el código ganó:** la sesión de diseño acierta en todo sitio que nombra pero subestima (se saltó los archivos a nivel página). rounded-full: censó 16, hay 35 (15 píldoras + 18 círculos + 2 muertos). Glifos de lucide: censó 17, hay 27. Y `--sf-borde`/`--sf-divisor` NO EXISTEN: hoy los dos roles comparten `--sf-linea` (44 usos), así que la segunda mitad tiene que CREARLOS separando el único token que hay.
Regla: § el eje de FORMA (set cerrado de 3) · segunda mitad: cablear los 5 tokens inertes.

## 2026-09-08 — Eje 4 · personalidad de FORMA: los 5 tokens cableados a la superficie (segunda mitad)
`aa83c8c` (Merge slice/eje-4-forma-superficie-2)

Segunda y última mitad del eje 4. B1 (`22f15ba`) dejó `forma-style.ts` emitiendo CINCO tokens INERTES; esta mitad los CABLEA a toda la superficie del storefront, cero decisión de diseño nueva (los valores de las tres personalidades ya estaban en `formas.ts`). **La fuente de verdad fue el CENSO (EJE-4-FORMA-CENSO-1), no la propuesta**, que subestimaba: el worker re-midió y cableó 15 píldoras `rounded-full`→`.sf-pildora` (fallback ∞, los 18 CÍRCULOS y 2 muertas NO se tocan —un círculo con radio corto se ve roto—), 16 `rounded-lg`→`.sf-radio-lg` (token propio porque `--radius-lg` es del PANEL, globals.css:98-100, intocable), los bordes 1px de tarjeta/control→`.sf-borde` y los divisores de banda→`.sf-divisor-*` **separando el único `--sf-linea` que servía a los dos roles** (57 usos medidos), y el trazo de ícono vía `html:not(.admin) .lucide` —el selector que alcanza a lucide y DEJA FUERA el `<svg>` inline de Logo—. La fuga cream de NosotrosGaleria (`rgba(250,247,244,0.82)` == `--sf-fondo` al 82%) se tokenizó con `color-mix`, byte-idéntica.
**SUAVE (null) ES BYTE-IDÉNTICA, y ahora es TODA la superficie, no solo los radios de tarjeta como B1.** Cada utilidad cae a su fallback = el literal de hoy (píldoras ∞, borde 1px, divisor 1px, trazo 2). Recta cambia a esquina viva + bordes 1.5px + trazo 1.25; Mínima a radios cortos + sin divisores de banda + trazo 1.5. Gate verde 916/916 capa-1 + `next build`; gate visual del owner PASADO sobre el preview (`slice/eje-4-forma-superficie-2`, e70ece7). Merge `--no-ff` mecánico, tree del merge == tree de la rama gateada, deploy disparado.
**TRES COSAS DEJADAS FUERA A PROPÓSITO, con razón medida — dos van a un slice de remates (§ abajo):**
  - **EL BADGE cambia de FORMA pero NO de tipografía.** La propuesta pedía versalitas + tracking .12em para Recta; `formas.ts` no tiene tokens de tipografía, así que el badge cableó su SHAPE vía `.sf-pildora` (Suave pill, Recta rectángulo, Mínima chip) pero las versalitas quedaron sin mecanismo. **El owner decidió COMPLETARLO** → EJE-4-BADGE-TIPOGRAFIA-1 (remate).
  - **"Agotado" sigue gris frío** (`ProductCard.tsx:164`, `text-gray-400`): ningún token `--sf-*` iguala un gris frío sin cambiar el render de Suave (toda la paleta es cálida). **El owner decidió un TOKEN NEUTRO NUEVO** → EJE-4-FUGA-AGOTADO-COLOR-1 (remate).
  - **Los bordes de énfasis (8 `border-2` + 1 `border-l-2`, 2px) NO se cablearon:** su anchura no cabe en el token de una sola anchura sin romper Suave. Límite conocido, registrado, sin remate por ahora.
Regla: § el eje de FORMA (set cerrado de 3) · CERRADO salvo los dos remates (badge-tipografía, token neutro de Agotado).

## 2026-09-08 — Eje 4 · los dos remates: tipografía del badge + token neutro de "Agotado" (CIERRE)
`6882e28` (Merge slice/eje-4-remates)

Cierra el eje 4. B2 dejó DOS cosas con su valor de diseño DECIDIDO pero sin mecanismo; el owner las aprobó al gatear B2 ("1. Completalo. 2. token neutro nuevo."). Ninguna es decisión de diseño nueva. **Primer worker en Sonnet 5** (ORCH-WORKER-MODEL-1): $7.33 y ~10 min, contra $31.53 y 29 min de B2 en Opus — el cambio de modelo se pagó en el primer slice.
**REMATE 1 — la TIPOGRAFÍA del badge.** `formas.ts` gana dos tokens gemelos de los 8 de forma: `badgeCaja` (text-transform) y `badgeTracking` (letter-spacing), emitidos por `varsDeForma` (serializados solos por `cssForma`). Una utilidad `.sf-badge` los lee con fallback `none`/`normal` = la caja de HOY, así que **Suave es byte-idéntica**. Recta = `uppercase` + `.12em`; Mínima = `uppercase` + `.05em`. Va SÓLO en los badges de ETIQUETA —`product.badge` de la tarjeta y del detalle, "Más Popular" de Suscripción— **NUNCA en un chip/control** (las notas de cata de ProductCard, los filtros, el contador del carrito): un filtro en versalitas se lee como grito. El worker clasificó y aplicó sólo a los tres badges.
**LA CAJA VA AMARRADA A LA PERSONALIDAD, y es DECISIÓN DEL OWNER (2026-09-08).** El owner dudó del mix (Suave natural, Recta/Mínima mayúscula) y preguntó si un dueño en Suave que pasa a Recta "perdería" las minúsculas. **No las pierde:** `text-transform` NO toca el texto guardado —el badge sigue almacenado como se escribió; la personalidad sólo cambia cómo se PINTA, y volver a Suave lo devuelve intacto—. Aclarado eso, el owner ELIGIÓ mantenerlo: la caja es parte del paquete cerrado de la personalidad (como la forma o el radio; no hay "Recta pero minúscula", igual que no hay "Recta con esquina redonda"). Se descartaron "la personalidad no cambia la caja" y "las tres en mayúscula" (esta última rompería la byte-identidad de Nayoli).
**MECANISMO uppercase, NO small-caps real (decisión de mecanismo del worker, medida).** La propuesta decía "versalitas". `font-variant-caps: small-caps` depende de que la fuente traiga glifos de versalita, y el storefront puede llevar cualquiera de los 5 pares de `content.tema.fuentePar` (Sora, Poppins, Fraunces, Lora, Work Sans…) — sin soporte el navegador sintetiza de forma inconsistente entre motores. `uppercase` es determinista en cualquier par. El spec delegó el mecanismo; el owner gateó el pixel.
**REMATE 2 — el TOKEN NEUTRO de "Agotado".** `ProductCard:164` pintaba "Agotado" con `text-gray-400`, un gris FRÍO horneado que B2 no pudo tokenizar (la paleta es toda cálida; el `--sf-texto-suave` más cercano es marrón y cambiaría el render). Se agrega `--sf-neutro` en el `:root` del storefront: **un gris frío a propósito, FUERA de las familias cálidas y de la RECETA de `derivarPaleta`** (un cliente con paleta custom no lo mueve — es neutro de sistema, no de marca). Default = `var(--color-gray-400)`, el MISMO valor que Tailwind v4 compila para `text-gray-400` (`oklch(70.7% 0.022 261.325)`), así que referenciarlo en vez de repetir el oklch es **byte-idéntico** y sigue a Tailwind si su gray-400 cambiara de versión. Cableado sólo en "Agotado". Gate verde; merge `--no-ff` mecánico, tree del merge == tree de la rama gateada, deploy disparado.
**FOLLOW-UP MEDIDO, no tocado (EJE-4-EMPTYSTATE-GRISES-1):** el empty-state del detalle (`tienda/[slug]:355-356`, "Producto Agotado") tiene dos grises fríos más —`text-gray-600` (título) y `text-gray-400` (subtexto)—. Es OTRO elemento (un bloque de dos tonos), fuera del ruling de la fuga de la tarjeta; su tokenización es decisión de diseño aparte, pendiente del owner.
Regla: § el eje de FORMA (set cerrado de 3) · CERRADO. La caja del badge es parte de la personalidad (decisión del owner).

## 2026-09-08 — Eje 5b · esquemas por sección: el MOTOR (mitad A, inerte y byte-idéntico)
`0211eec` (Merge slice/eje-5b-motor-1)

Primera mitad del eje 5b (esquemas de color por sección), gemela en espíritu de la mitad 1 del eje 4: construye "la pieza de ingeniería" que el doc marca como el trabajo real —no los tokens— y la deja ENTERA INERTE. El eje lo cablea la mitad B.
**LA PIEZA DE INGENIERÍA — `pisoContraste` gana DIRECCIÓN.** Hoy floreaba el texto contra UNA sola superficie (`fondo`) y sólo OSCURECÍA; un esquema cuya superficie es `tinta` o `acento` quedaba sin piso de contraste. Ahora la dirección se elige por la LUMINANCIA de la superficie —clara → oscurece (lo de hoy); oscura → aclara—. **El call site de producción (`derivarPaleta`) NO se tocó → byte-idéntico** (Nayoli corre `fondo`, que es claro).
**`derivarEsquema(raíces, id)` — los CUATRO esquemas de las MISMAS 3 raíces, cero color nuevo:** `crema` (default, = `derivarPaleta` de hoy, afirmado deep-equal), `superficie` (#f0e7de), `oscuro` (#1a0f08) y `acento` (#8b4513). **El acento como superficie es la firma que Duna no tenía** —nunca pintaba una banda entera de `--sf-acento`— y es la mitad del salto visual del efecto Pitch. Confirmado válido por ejecución (texto ≥4.5:1).
**EL TEXTO DE LAS BANDAS OSCURAS VA CÁLIDO Y BRILLANTE, no floor raso a 4.5 (decisión de mecanismo, 2ª pasada).** El primer intento floreó el texto de oscuro/acento a ~4.5:1 raso (apenas legible); el doc pide el tono de marca. El mecanismo REUSA candidatos claros ya derivados de las 3 raíces (familia `tostado`/`tostado-3`, fallback `acento-txt`) como texto sobre banda oscura, en vez de re-florear el rol de texto oscuro. Alcanza las figuras del doc: oscuro texto 8.49:1 / suave 4.52:1, acento 7.10:1 / 4.51:1 (crema 9.97/7.70 y superficie 8.71/6.73 no cambiaron). El tono real es capa 3 del owner en 5b-B (§ EJE-5B-SCHEME-WARMTH-CHECK-1).
**LOS DOS TOKENS NUEVOS, `--sf-tarjeta` y `--sf-sobre`, INERTES.** Entran a la RECETA y `palette-style` los emite automático; su fallback en `globals.css` es `#ffffff` (= el `bg-white`/`text-white` de hoy), así que cuando 5b-B cablee `bg-white → var(--sf-tarjeta)` y `text-white → var(--sf-sobre)`, Nayoli sin fila queda byte-idéntica. En este slice NINGÚN componente los lee (verificado por grep: 0 consumidores; los `data-sf-tarjeta` del puente son otro símbolo). Conteo de tokens actualizado 22→24 (los comentarios stale que decían 20/21 se corrigieron; la aserción `=== 22` de `palette-style.test.ts` que rompió el primer gate pasó a 24 —era el subconteo de touches del orquestador, enmendado—).
**BYTE-IDENTIDAD (mergeado SIN gate visual, pre-aprobado por el owner):** `derivarEsquema('crema')` deep-equal a `derivarPaleta`; call site de `pisoContraste` intacto; tokens inertes con fallback blanco; `derivarEsquema` sin llamador. Gate verde 929/929 + next build. Merge `--no-ff` mecánico, tree del merge == tree de la rama, deploy disparado.
**EL MODELO (decisión del owner, para 5b-B):** el esquema es un mapa POSICIÓN → esquema en SiteContent (cada banda del home —editable O estructural— puede tomar uno; default = el ritmo de hoy exacto; sin picker en el editor). NO en `SeccionDef`: el eje 5 (orden como dato) exige el home como lista de bandas, y modelar sobre `SeccionDef` obligaría a rehacerlo (la trampa C1); además partir las bandas en dos clases ("una tiene SeccionDef") no se le explica al dueño. `VariantesDef`/`sobreOscuro` NO nacen: el nav leerá el esquema de la primera banda (una sola declaración de la dirección).
Regla: § el eje de ESQUEMAS por sección · mitad A (motor inerte) hecha; mitad B cablea la superficie + el wrapper por banda + el nav. Alcance: toda la superficie del storefront (owner).

## 2026-09-08 — Eje 5b · esquemas por sección: el EFECTO en el HOME (mitad B) — GATE PASADO
`e251517` (Merge slice/eje-5b-home-1)

Segunda mitad del eje 5b: cablea el efecto ("una banda declara su esquema de color") a las 7 bandas del home. El MOTOR (`0211eec`, inerte) ya tenía `derivarEsquema` + los tokens; esta mitad los conecta. **Gate visual del owner PASADO** sobre el preview (Nayoli byte-idéntica con el mapa vacío; el efecto sembrado con el runbook reversible `nayoli-esquemas-gate` sobre development).
**EL DATO — `content.esquemas`, mapa POSICIÓN→esquema, clave meta.** Gemelo de `tema`/`paginas`: `resolverEsquemas` (SOFT, key-agnóstico, basura→canónica) lo resuelve aparte del loop de secciones, `SeccionKey` lo excluye. Nace VACÍO (ninguna banda tiene entrada → todas caen a su literal de hoy → Nayoli byte-idéntica sin fila). Sin picker en el editor: se compone en el onboarding (decisión del owner, como las 3 raíces vs las derivadas). Declarado en el schema editable (#65-B). **MODELO: posición→esquema, NO en `SeccionDef`** —el eje 5 (orden como dato) exige el home como lista de bandas, y modelar sobre `SeccionDef` obligaría a rehacerlo (la trampa C1); además el home mezcla secciones REGISTRY con estructurales (franja de confianza, destacados) y partirlas en dos clases no se le explica al dueño (owner)—.
**EL WRAPPER — vars del esquema en la RAÍZ de cada banda, SIN divs nuevos.** `esquema-style.ts` (gemelo de `palette-style`) toma la clave del esquema y devuelve un `style` con las vars que `derivarEsquema` produce; `page.tsx` lo pasa a la `<section>` raíz de cada banda (`style={bandaStyle(bandaId)}`). Las custom properties heredan a los descendientes → scopea el esquema a esa banda sin un `<div>` extra (cero riesgo de layout).
**LA BYTE-IDENTIDAD — el default es "SIN override", no "asignar el esquema de hoy".** El fondo de cada banda pasa a `bg-[var(--sf-banda,<su-token-de-hoy>)]`; `--sf-banda` NO tiene default global, así que sin esquema cae a su literal EXACTO (tinta, **tinta-2**, fondo — cada uno idéntico; resuelve que tinta-2 = tinta+19% acento, un oscuro cálido distinto del `oscuro`=#1a0f08, se preserve sin un 5º esquema). Y resuelve la tensión del texto: hoy el texto del hero es BLANCO PURO (~18:1), no el cálido 8.49:1 del esquema `oscuro`; como el default es sin-override, Nayoli conserva su blanco, y el texto cálido aparece sólo cuando un tenant asigna el esquema.
**EL TEXTO SOBRE BANDA ES BANDA-SCOPED, y la distinción es la lección** (cerró 3 huecos de contraste medidos): un texto que se apoya en el fondo de la banda va `--sf-sobre-banda`(-suave) —floreado contra la banda MISMA (`p.texto`/`texto-suave`), auto-flipea con el esquema—; un texto sobre una TARJETA (`--sf-tarjeta`) va `--sf-sobre` —floreado contra la tarjeta—; un texto sobre una superficie FIJA que el esquema no mueve (el gradiente `--sf-tinta/80` de las tiles de GrindChooser) va BLANCO FIJO. Confundir `--sf-sobre` (scoped a tarjeta) con texto-sobre-banda daba 1.00–1.07:1 en ciertos esquemas; la franja de confianza en acento pasó de 1.00:1 (ícono fundido con el fondo) a ≥4.5:1. **Verificado por ejecución la matriz 8 bandas × 4 esquemas: cada texto ≥4.5:1.**
**EL NAV lee el ESQUEMA de la primera banda** (hero): sobre banda oscura el texto va claro, sobre clara oscuro. No hay `sobreOscuro`/`VariantesDef` (greenfield): una sola declaración de la dirección, el esquema. Byte-idéntico para Nayoli (hero canónico = tinta = oscuro → nav como hoy).
**Alcance de ESTA mitad: el HOME.** El resto de la superficie (/nosotros, /suscripciones, chrome, páginas funcionales — la deuda de literales que el owner eligió pagar entera) va en 5b-C, byte-idéntico. Merge `--no-ff` mecánico tras el gate, tree del merge == tree gateado, deploy disparado (producción sin `esquemas` → byte-idéntica).
Regla: § el eje de ESQUEMAS por sección · el HOME cableado (dato + wrapper + nav + texto banda-scoped); 5b-C = el resto de la superficie.

## 2026-09-08 — Eje 5b · toda la superficie (5b-C1): tokenizar los literales de las páginas (byte-idéntico)
`cd99ee5` (Merge slice/eje-5b-c1-paginas)

Primera mitad del "toda la superficie" que el owner eligió: NINGÚN `bg-white`/`text-white` horneado queda en el storefront. Esta pasada toma las PÁGINAS —checkout, tienda, tienda/[slug], rastrear-pedido, PreguntasFrecuentes, /suscripciones— y cambia sus literales por los tokens que el MOTOR ya emite (`--sf-tarjeta` para superficies de tarjeta, `--sf-sobre` para texto sobre banda oscura, `--sf-acento-txt` para tinta sobre acento). **Byte-idéntico** (verificado por CSS compilado y gate 950/950): esos tokens tienen default global `#ffffff`/su valor de hoy, así que Nayoli no cambia un pixel. El checkout se tocó SÓLO cosmético (2 fondos de tarjeta, 2 colores de botón); cero lógica, validación o monto.
**NO es "seguir la paleta", es DEUDA + terreno listo (corrección medida):** `derivarPaleta` fija `out.tarjeta`/`out.sobre` a `#ffffff` INCONDICIONAL (no derivados de las raíces); sólo `derivarEsquema` (per-banda, `content.esquemas`) los re-deriva. Estas páginas NO participan de `content.esquemas`, así que sus `--sf-tarjeta`/`--sf-sobre` quedan en blanco incluso con paleta custom — la tokenización paga la deuda de "cero literal horneado" y deja el terreno por si estas páginas adoptan esquema por banda, pero NO les da hoy un color por-tenant (sólo `--sf-acento-txt` auto-flipea). Se escribe para no asumir un payoff que hoy no ocurre.
**DOS literales quedaron SIN tokenizar, a propósito** (no caían claro en tarjeta/banda/acento): `checkout/page.tsx:236` `bg-emerald-600` (badge de "paso completado", un color de ESTADO fijo, ajeno a la paleta) y `tienda/page.tsx:122` `bg-white/30` (overlay del contador de filtros, fondo dual según estado). No son superficies de paleta; forzarlos a un token sería inventar una clasificación. Quedan como literales legítimos (decisión del owner: dejarlos).
Merge `--no-ff` mecánico tras el OK del owner (byte-idéntico), tree del merge == tree gateado, deploy (producción byte-idéntica).
Regla: § toda la superficie · páginas hechas (byte-idéntico); falta 5b-C2 = el chrome (footer/nav/carrito/buscador).

## 2026-09-08 — Eje 5b · toda la superficie (5b-C2): el CHROME tokenizado — EJE CERRADO
`0d0fa0d` (Merge slice/eje-5b-c2-chrome)

Última mitad de "toda la superficie": el CHROME —carrito (`CartDrawer`), buscador (`NavSearch`), nav (`StoreNav`) y footer (`StoreFooter`)— pierde sus últimos `bg-white`/`text-white` horneados, todos → `--sf-tarjeta`/`--sf-sobre` (default global #ffffff = hoy). **Byte-idéntico** (cada línea cambiada es un swap de color, verificado; gate 950/950 + next build). El chrome es global/portaleado —NUNCA recibe esquema por banda—, así que sus tokens quedan en su valor de hoy para siempre: es puro pago de la deuda de literales, uniformidad, no un efecto.
**El footer usa `--sf-sobre` también como TINT DE FONDO** (los botones-ícono sociales, `bg-white/10`→`bg-[var(--sf-sobre)]/10`): el footer es siempre oscuro, así que su color "claro" ES `--sf-sobre`, sirva de texto o de tint. No hizo falta un token nuevo.
**ERROR DE PATH del orquestador, atrapado por el worker y anotado como lección:** el spec del chrome puso `components/storefront/layout/StoreFooter.tsx` (no existe; el real es `components/storefront/StoreFooter.tsx`); el grep del orquestador contra el path inexistente dio un FALSO 0 y casi deja el footer sin tokenizar. El worker midió el path real (14 literales), NO tocó el archivo inexistente, y paró para reportar en vez de adivinar los 2 tints ambiguos — se cerró en un slice de continuación (`EJE-5B-FOOTER`, `9fd8d0c`) con el path corregido. Un path es una compuerta: un grep contra un path mal escrito miente en silencio.
**CON ESTO EL EJE 5b QUEDA CERRADO:** motor (`0211eec`) + efecto en el home (`e251517`) + páginas (`cd99ee5`) + chrome (`0d0fa0d`). El storefront no tiene un solo `bg-white`/`text-white` horneado (salvo 2 literales de ESTADO dejados a propósito, § 5b-C1). Una sección declara su esquema de color (`content.esquemas`, sin picker, compuesto en onboarding), con acento como superficie; Nayoli byte-idéntica (mapa vacío). Merge `--no-ff` mecánico tras el gate del owner, tree del merge == tree gateado, deploy (producción byte-idéntica).
Regla: § el eje de ESQUEMAS por sección · CERRADO (motor + home + páginas + chrome; toda la superficie tokenizada).

## 2026-09-08 — Eje 5 · el ORDEN de las secciones del home como DATO (byte-idéntico)
`7384b7e` (Merge slice/eje-5-orden)

Primera parte del eje 5 (composición): el orden de las 7 bandas del home deja de ser JSX fijo y pasa a `content.orden`, una clave META cerrada (gemela de `paginas`/`tema`/`esquemas`, excluida de `SeccionKey`, resuelta aparte del loop). `page.tsx` pasó de 7 componentes en JSX fijo a un registro `BANDAS` (bandaId→render) + un `.map` sobre `resolverOrden(orden)`. **Desbloqueado por el eje 5b:** reordenar ya no rompe el color —cada banda lleva su esquema por id vía `content.esquemas`—, que era la fricción real que tenía trabado a este cambio (§ el doc: "reordenar rompe el color" sin la capacidad 1).
**`resolverOrden` es SOFT y SIEMPRE COMPLETO:** filtra a los ids conocidos, deduplica, y AGREGA en el orden default cualquier banda que falte → un `orden` parcial o basura resuelve a las 7 bandas, ninguna se cae. `orden` es sólo SECUENCIA, no visibilidad (eso es `paginas`/`visible`). Default = la secuencia de hoy (`hero, trustBadges, featured, brandStory, presentaciones, subscriptionCTA, testimonials`; Newsletter sigue oculta/fuera) → **Nayoli byte-idéntica**, verificado por ejecución (fetch a `/`, el orden de aparición coincide). Sin picker (compuesto en onboarding, como `esquemas`).
**LA FRICCIÓN de props-por-id (doc):** no todas las bandas toman los mismos props — GrindChooser (id `presentaciones`) lleva `negocio`; las demás sólo `style`. El registro `BANDAS` lo resuelve con un render por id.
**UNA MINA INERTE que este slice DESTAPÓ y se arregla de inmediato (no se difiere), por doctrina del owner:** el nav leía `heroEsOscuro(esquemas.hero)` asumiendo que la primera banda es el hero y es oscura — un default nacido de una COINCIDENCIA (hero siempre primero, siempre oscuro) que este mismo slice acaba de romper (ahora `orden[0]` puede ser cualquier banda). Código correcto por un accidente que ya no está garantizado = la familia de `esSuscripcion`/`total_compras`, que este repo detona tarde. Este slice cambió el nav a leer `esquemas[orden[0]]` (byte-idéntico para Nayoli, `orden[0]='hero'`), pero el FALLBACK de `heroEsOscuro` para una banda sin esquema sigue asumiendo oscuro — se corrige en el slice inmediato EJE-5-ORDEN-NAV-CANONICA (default explícito por banda + test, no una suposición heredada). NO se difiere al editor futuro.
Merge `--no-ff` mecánico tras el OK del owner (byte-idéntico), tree del merge == tree gateado, deploy (producción byte-idéntica). Falta del eje 5: (e) las variantes de composición (hero·ficha, presentaciones·índice).
Regla: § el eje de COMPOSICIÓN · el orden es DATO (`content.orden`, registro + .map); falta el default canónico del nav (mina, se arregla ya) y las variantes.

## 2026-09-08 — Eje 5 · la MINA del nav desactivada: canónica de darkness por banda, explícita + test
`e05b565` (Merge slice/eje-5-orden-nav-canonica)

Cierra la mina inerte que el orden-como-dato destapó (decisión del owner: arreglar AHORA, no diferir al editor). `heroEsOscuro` decidía el color del texto del nav flotante; para una banda SIN esquema asumía SIEMPRE `raices.tinta` (oscura) — correcto sólo por la COINCIDENCIA de que la primera banda era siempre el hero (canónica tinta). El orden como dato rompió esa garantía (`orden[0]` puede ser cualquier banda), así que una banda CLARA primera sin esquema habría dado nav claro-sobre-claro. Es la familia `esSuscripcion`/`total_compras`: correcto por un accidente que ya no está, detonable tarde.
**EL FIX, explícito y con test (no una suposición heredada):** `heroEsOscuro` → `bandaEsOscura(bandaId, esquemas, fondo, tinta, acento)`. CON esquema → el contraste real del fondo derivado (como antes). SIN esquema → la CANÓNICA declarada de la banda: `BANDAS_OSCURAS = {hero, brandStory, subscriptionCTA}` (las de fondo `tinta`/`tinta-2`); el resto cae a CLARO (`fondo`), que es el default correcto —la mayoría de las bandas son claras—, no "oscuro" heredado. El set vive en `site-content-defaults.ts` (junto a `BANDA_IDS`), con test que afirma la canónica de cada banda (sin esquema) y que con esquema sigue al esquema. StoreNav usa `bandaEsOscura(orden[0], …)`. Byte-idéntico para Nayoli (`orden[0]='hero'`, canónica oscura = hoy), verificado por ejecución; gate 969/969.
**LÍMITE RESPETADO (condición del owner "si es más que un cambio chico, PARÁ"):** la canónica de fondo por banda queda declarada en DOS lugares —el fallback `var(--sf-banda,<token>)` en el JSX de cada componente, y `BANDAS_OSCURAS` acá—. Unificarlas a un dato compartido único es más que un cambio chico; el worker NO lo hizo y lo dejó como follow-up (EJE-5-ORDEN-CANONICOS-COMPARTIDOS). La duplicación está documentada (comentario que ata el set a los tokens), así que es explícita, no silenciosa — que es justo lo contrario de la mina que este slice cerró.
Merge `--no-ff` mecánico tras la orden del owner, tree del merge == tree gateado, deploy (byte-idéntico).
Regla: § el eje de COMPOSICIÓN · orden como dato + nav robusto (canónica explícita); falta (e) las variantes de composición.

## 2026-09-09 — Eje 5 (e) · variantes de composición: el MECANISMO + presentaciones·índice — EJE 5 CERRADO
`2f79505` (Merge slice/eje-5-variantes-presentaciones)

La última parte del eje 5: una sección puede declarar VARIANTES DE COMPOSICIÓN —el mismo contenido, OTRO esqueleto—. No es color (`content.tema`/`esquemas`) ni contenido (los `campos`): es una propiedad de la SECCIÓN, así que vive como un slot propio en `SeccionDef`, **hermano exacto de `repeater`** (su propia rama en el resolver, su propio normalizador; el loop de `campos` no se toca y el borrador/publicar por sección lo arrastra gratis). `VariantesDef { claves, canonica }` + `resolverVariante(def, v)` SOFT (fuera del set → la canónica; NUNCA lanza), gemelo de `resolverForma`/`resolverFuentePar`. `REGISTRY.presentaciones.variantes = { claves: ['mosaico','indice'], canonica: 'mosaico' }`. El campo `variante` es escalar de sección (como `visible`), declarado en el schema editable o **#65-B lo strippea** (el test derivado lo exige). Se cablea SÓLO presentaciones; el mecanismo es genérico pero `hero.variantes` va con su propio slice (no existe `HeroFicha` todavía — declararlo sería capacidad muerta).
**`VariantesDef` NACE SIN `sobreOscuro`, y es doctrina, no omisión.** El doc de diseño lo dibujó con un `sobreOscuro?: Record<string,boolean>` que el nav leería para saber si la primera banda es oscura. Sería un SEGUNDO origen de verdad sobre la oscuridad de una banda, y esa verdad ya es ÚNICA y EXPLÍCITA desde `EJE-5-ORDEN-NAV-CANONICA`: `bandaEsOscura` (por esquema asignado, o la canónica `BANDAS_OSCURAS` sin esquema). Repetirla en la variante reintroduciría exactamente la familia de suposición heredada (`esSuscripcion`/`total_compras`) que ese slice existió para cerrar — una mina, un día después de desactivar la anterior. Para presentaciones·índice es además IRRELEVANTE: `presentaciones` es una banda CLARA en las DOS variantes (el fondo de banda es `bg-[var(--sf-banda,var(--sf-fondo))]` en ambas; lo oscuro del mosaico es sólo el overlay de cada TILE, no la banda), y `presentaciones` no está en `BANDAS_OSCURAS` → `bandaEsOscura` ya la trata como clara. **Cero cambio al nav.** (El hero·ficha SÍ cambia la oscuridad de su banda; ése es el problema central de SU slice, a resolver ahí explícito, NO con `sobreOscuro` heredado.)
**LA VARIANTE ÍNDICE de Presentaciones** (adoptada del doc): de dos cortinas oscuras gemelas a un índice —filas numeradas (01, 02… por POSICIÓN visible, no el `slot`), encabezado alineado a la IZQUIERDA, foto chica al margen, divisor entre ítems—. **Ya no hay texto blanco sobre foto en ninguna de las dos primeras pantallas**, que era la textura que hacía que dos fincas se leyeran clonadas. Aguanta 2-4 filas (reusa `tarjetasDePresentaciones`, ignora `gridColsPresentaciones` — es una LISTA, no un grid). **TOKENS on-band, no la tile oscura del mosaico:** la fila se apoya en la banda (clara por defecto pero SIGUE AL ESQUEMA si `presentaciones` recibe uno), así que usa `--sf-sobre-banda`/`--sf-sobre-banda-suave` (auto-flipean, § esquema-style), con los fallbacks que Newsletter ya usa sobre banda clara (`--sf-tinta`/`--sf-texto`) — NO el blanco fijo de las bandas oscuras. Conserva `data-sf-tarjeta` (el puente vista→formulario del editor, § #46). `GrindChooser` pasó a DISPATCHER (gate de visibilidad + `VARIANTES[variante] ?? mosaico`); `GrindChooserMosaico` es la extracción VERBATIM del cuerpo de hoy; `GrindChooserIndice` es nuevo. `page.tsx` NO se tocó — el dispatch vive dentro de GrindChooser.
**BYTE-IDÉNTICO para Nayoli** (default `variante='mosaico'` = el GrindChooser de hoy, verificado línea por línea vs HEAD; producción no tiene `variante` sembrada → renderiza mosaico). Pero **NO fue un merge byte-idéntico puro como los de 5b/orden: el índice es DISEÑO NUEVO de cara al cliente**, así que fue a GATE VISUAL del owner (capa 3), no a merge automático. Se sembró la variante en DEV con un runbook reversible (`dev-protocol/runbooks/nayoli-variante-indice-gate/`, siembra `content.presentaciones.variante='indice'`, restore = byte-idéntico) para verla sobre la rama del slice. Suite + `next build` verdes; post-check PASS; MERGE_OK_BY_APPROVAL (7 archivos, todos en `touches:`).
**CON ESTO EL EJE 5 (composición) QUEDA CERRADO:** (d) orden como dato (`7384b7e`) + la mina del nav (`e05b565`) + (e) variantes de composición (`2f79505`). Merge `--no-ff` mecánico tras el GATE VISUAL del owner, tree del merge == tree gateado, deploy (producción byte-idéntica).
Follow-ups: `EJE-5-VARIANTES-HERO` (hero curtina/ficha — su darkness-vs-variante es el problema central, resuelto explícito ahí, sin `sobreOscuro`) y `EJE-5-VARIANTES-EDITOR` (picker de variante en /admin/tienda, gemelo del editor de reordenar, cuando se pida).
Regla: § el eje de COMPOSICIÓN · CERRADO (orden + nav canónico + variantes); una sección declara `variantes` (hermano de `repeater`), sin `sobreOscuro` porque `bandaEsOscura` es la verdad única de darkness.

## 2026-09-09 — Eje 5 (e) · variante hero·ficha + el nav sólo flota sobre banda UNIFORME
`7dd9206` (Merge slice/eje-5-variantes-hero: `38bc307` hero·ficha + `95f58bc` nav-uniforme)

La 2ª variante de composición —hero curtina/ficha— sobre el mecanismo que presentaciones·índice estrenó, MÁS la corrección de la suposición del nav que el gate visual destapó. Dos commits, una unidad.
**hero·ficha (EJE-5-VARIANTES-HERO):** el hero gana `variantes: { claves: ['curtina','ficha'], canonica: 'curtina' }`. `HeroSection` pasó a dispatcher; `HeroCurtina` es la extracción VERBATIM de hoy (byte-idéntico); `HeroFicha` es nuevo —ficha partida: tipografía en tinta sobre crema, foto a sangre a la derecha SIN degradado, énfasis en la misma línea, regla corta de separador; banda CLARA (`--sf-fondo`, el flip respecto de la curtina `--sf-tinta`), tokens on-band con fallbacks claros—. La darkness del nav se hizo variant-aware acá (MINA #2): `bandaEsOscura` ganó el parámetro `variante` y su canónica sin-esquema pasó a `bandaOscuraCanonica(bandaId, variante)` —hero·curtina oscura, hero·ficha clara—, porque ficha rompe la coincidencia "el hero siempre es oscuro".
**EL GATE VISUAL ENCONTRÓ UN DEFECTO REAL, y su fix es la lección (EJE-5-NAV-UNIFORME):** la ficha es una banda BI-TONAL (crema izq / foto oscura der), y el nav transparente-flotante quedó ilegible (texto oscuro sobre la foto). El owner eligió "nav sólido" PERO ordenó corregir la SUPOSICIÓN, no parchear la ficha: **el nav transparente sólo funciona sobre una banda UNIFORME** (la curtina lo es, una banda con esquema lo es, la ficha no). La variante DECLARA su uniformidad (`VariantesDef.noUniformes`, hero: `['ficha']`) y el nav cae a SÓLIDO cuando la primera banda no es uniforme. Es la 3ª de la misma familia (heroEsOscuro→bandaEsOscura, la canónica del nav, y ahora la uniformidad): un default correcto por una coincidencia del hero original, que otra composición rompe.
**`noUniformes` EN LA VARIANTE ES CORRECTO DONDE `sobreOscuro` NO LO ERA, y la distinción es exacta:** la DARKNESS tiene fuente DINÁMICA —un esquema oscurece/aclara cualquier banda, se computa por contraste—, así que una darkness cruda en la variante sería un 2º origen que puede DISCREPAR del esquema (la mina que se rechazó). La UNIFORMIDAD no tiene fuente dinámica —un esquema no parte ni une una banda; es puro LAYOUT que sólo la variante conoce—, así que la variante es su fuente ÚNICA. Ejes distintos, cada uno donde es correcto.
**LA UNIFICACIÓN (pedido del owner: darkness y uniformidad son parientes sobre el mismo hecho):** `tratamientoNav(bandaId, variante, esquemas, raíces) → { flotante, textoClaro }` es la ÚNICA regla que StoreNav lee —no dos booleanos que el nav combina a mano—. No uniforme → `{flotante:false}` (nav sólido, texto oscuro); uniforme → flota con `textoClaro = bandaEsOscura(...)`. `bandaEsOscura` queda como el computador de darkness, consumido por `tratamientoNav`. Futuras composiciones partidas (un hero de tres tonos, otro split) sólo declaran `noUniformes` y caen a sólido solas.
**Byte-idéntico para Nayoli:** hero·curtina → uniforme → `{flotante:true, textoClaro:true}` = el `isHome && !scrolled` de hoy; el hero y su nav transparente NO cambian un byte. Gate visual del owner: PASÓ (ficha con nav sólido legible + curtina de Nayoli con nav transparente intacto). Merge `--no-ff` mecánico tras el gate, tree del merge == tree gateado, deploy.
Con esto las DOS variantes mínimas del doc (presentaciones·índice + hero·ficha) están shippeadas. Follow-up restante del eje 5: `EJE-5-VARIANTES-EDITOR` (picker de variante en /admin/tienda, gemelo del editor de reordenar).
Regla: § el nav flotante · sólo sobre banda UNIFORME (`tratamientoNav` unifica uniformidad+darkness; la variante declara `noUniformes`, no darkness —ésa se computa—).

## 2026-09-10 — Eje 5 · el panel NO lleva selector de COMPOSICIÓN (rigidez del doc); editores RETIRADOS
(sin commit de código — decisión; corrige follow-ups mal enmarcados en asientos previos)

EL CLIENTE EDITA SU CONTENIDO, NO SU COMPOSICIÓN. Los tres ejes de composición —esquema por banda, orden de bandas, variante de sección— se COMPONEN EN ONBOARDING (Duna, por dato: los runbooks que ya siembran `content.esquemas`), NO se pican desde `/admin/tienda`. Es la decisión explícita del doc adoptado (propuesta-ejes-4-5-v2, §352-357): "el editor del panel no lleva selector de esquema ni de orden, aunque el dato exista... La rigidez es la garantía de que ninguna tienda de Duna se ve mal." Es la MISMA línea que ya separa las 3 raíces de paleta (configurables) de las 20 derivadas (no), y la que hizo `esquemas` SIN picker desde el eje 5b.
**RETIRADOS por contradecir el doc:** `EJE-5-ORDEN-EDITOR-1` (editor de reordenar) y `EJE-5-VARIANTES-EDITOR` (picker de variante). Los asientos previos del eje 5 los nombraban como follow-ups "cuando se pida" —enmarcados como PICKERS DEL CLIENTE en el panel—, y esa superficie es justo la que el doc dice NO tocar. NO se construyen. (Si algún día Duna necesita componer tenants a escala —self-serve—, eso es una HERRAMIENTA DE ONBOARDING Duna-side, no un picker en el panel del cliente; su disparador es el multi-tenant, no el eje 5. Para Nayoli sola, los runbooks alcanzan.)
**LA LECCIÓN DE MÉTODO (la razón de asentar esto):** un nombre de follow-up en el registro (`EJE-5-ORDEN-EDITOR-1`) se leía como trabajo pendiente, pero CONTRADECÍA el doc. Se atrapó releyendo el doc ANTES de construir —el tripwire contra el REGISTRO/la instrucción, no sólo contra el terreno (§ el artefacto, la base, y el spec)—: "sigue con eso" habría construido justo lo que el doc prohíbe. Un follow-up que describe una CAPACIDAD hay que verificarlo contra la fuente antes de darlo por vivo, igual que un item de backlog se grepea contra el código.
**CON ESTO EL EJE 5 (composición) QUEDA CERRADO DEL TODO:** orden como dato + nav canónico/uniforme + las dos variantes mínimas (presentaciones·índice, hero·ficha). La composición es dato sembrado en onboarding; el panel del cliente edita contenido. No quedan follow-ups del eje 5.
Regla: § composición = onboarding, no panel · el editor del cliente NO lleva selector de esquema/orden/variante (rigidez del doc: la garantía de que ninguna tienda se ve mal).
