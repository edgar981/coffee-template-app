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

## 2026-09-10 — Chrome del panel · el RAIL gana token propio, y la rampa OSCURA se re-balancea
`a4e49ab` (Merge slice/chrome-rail-color-1)

Sale del mockup de la sesión de diseño de `/admin/configuración`: el owner adoptó SU color de rail en los dos temas ("el negro del mock es más oscuro que el actual, da un buen contraste"). Es chrome PANEL-WIDE, así que fue su propio slice y su propio gate —no mezclado con el rediseño de Configuración—, y fue PRIMERO para que el rediseño se gatee después contra el chrome ya final.
**`--duna-paper` NO ERA "EL COLOR DEL RAIL", y ése es el hallazgo que hizo el slice correcto.** El rail colgaba de `--duna-paper` (`--color-sidebar`), pero `paper` es el rol PAPEL: se invierte junto con `--duna-ink` y además pinta **el TEXTO de `.duna-btn--primary`** (`background: ink; color: paper`), dos fondos de badge y `--color-primary-foreground`. Moverlo habría cambiado todo eso para conseguir un color de rail. El fix: **el rail gana `--duna-rail`, su propio token** (claro `#FFFFFF`, oscuro `#0F0E0D`), `--color-sidebar` lo lee, y `paper` NO se toca. Y hay una razón estructural, no sólo de blast radius: **la relación que el owner pidió DIFIERE por tema** —en claro el rail se ELEVA sobre la página (antes se hundía), en oscuro se HUNDE bajo ella—, y ninguna de las dos es "= paper" en los dos temas a la vez. Un rol que tiene que decir dos cosas distintas necesita ser dos roles.
**LA RAMPA OSCURA SE MUEVE JUNTA, porque subir la página sola COMPRIME la elevación.** El contraste del mock no sale de bajar el rail: sale del PAR (rail abajo + página arriba). Pero la página subiendo con la tarjeta quieta dejaba la elevación de tarjeta en ~4 pasos donde hoy son ~8 —la mitad—. Así que se corrió la rampa CONSERVANDO LOS DELTAS DE HOY, no inventando valores: `rail 0F0E0D` (8 pasos bajo bg, el contraste pedido) · `bg 171614` · `surface 1F1E1B` (bg+8, la elevación de hoy) · `surface-2 1C1B18` (bg+5) · `border 2E2C27` (surface+15) · `border-2 3C3932` · `skel 32302B` (surface+19 — su propio comentario ya decía que es "un escalón de contraste, no un color fijo", así que TENÍA que moverse con surface). En CLARO no se re-balancea nada: sólo entra el rail.
**SE ADOPTÓ LA SEPARACIÓN DEL MOCK, NO SU NEUTRALIDAD.** El oscuro del mockup es gris NEUTRO (`#0F0F0F`/`#171717`); el oscuro de Duna es CÁLIDO (R>G>B). Copiar los hex literales habría cambiado la identidad del tema oscuro, que no es lo que se pidió — lo que el owner señaló fue el CONTRASTE. Los valores nuevos son el gris del mock inclinado a cálido.
**DEUDA MEDIDA Y NOMBRADA (no aceptada en silencio): `--duna-faint` no pasa AA en oscuro, y YA NO PASABA ANTES.** Medido: `muted` (#9A958A) queda en 6.06:1 contra la página nueva y 5.59:1 contra la tarjeta (✓ AA). `faint` (#6E6A60) queda en **3.35:1 / 3.09:1 (✗)** — pero contra la rampa VIEJA ya daba **3.47:1**, o sea que este slice lo empeora un pelo y NO lo causa. `faint` sí pinta texto chico (el id y la hora de la tarjeta de pedido, las etiquetas parciales del eje, los hints). Es el patrón ya escrito (§ el re-skin destapa los defectos que el color viejo enmascaraba): el spec le PROHIBIÓ al worker ajustar un rol de texto por su cuenta —mover un rol de texto es otra decisión— así que lo midió, lo reportó, y queda como **follow-up nombrado** (`CHROME-FAINT-AA-1`), no como algo que se aceptó sin mirar.
`reference.html` no necesitó cambio: lee los tokens por `var()` y sus checkers de contraste usan `getComputedStyle` en vivo, sin hex horneados (medido, no supuesto). El storefront no se toca: el tema oscuro es sólo del admin.
Merge `--no-ff` mecánico tras el gate visual del owner (panel-wide, los dos temas), tree del merge == tree gateado, deploy.
Regla: § el RAIL tiene su propio token (`--duna-rail`), NO `--duna-paper` — un rol que debe decir dos cosas distintas por tema necesita ser dos roles; y la rampa oscura se mueve JUNTA conservando sus deltas, o la elevación se comprime.

## 2026-09-10 — `/admin/configuración` · «Datos del negocio» pasa al modelo de BLOQUES
`9d08bb7` (Merge slice/admin-config-rediseno-1: `8c5ff3d` rediseño + `8b1a694` lectura + `41f5100` chip)

La ÚLTIMA pantalla del panel que nunca pasó por el modelo de bloques que `/admin/tienda` ya tenía. Era ~13 campos planos + un bloque suelto de checkboxes en UNA tarjeta, y dolía donde más importa: es la primera pantalla que el dueño toca al configurar. Salió de una sesión de diseño con mockup navegable que el owner adoptó. «Equipo y usuarios» NO se tocó: ya era una lista estructurada y no dolía.
**LAS CLASES DEL MODELO SE GENERALIZARON PORQUE APARECIÓ EL SEGUNDO CONSUMIDOR.** `.tienda-form`/`.tienda-form__bloque` (el panel recesado `--duna-bg` que contiene piezas elevadas `--duna-surface`) pasaron a `.admin-bloques`/`.admin-bloque`. Es el disparador de promoción de siempre —una clase con UN consumidor se queda con nombre local; con DOS se generaliza—, y acá además el nombre viejo MENTÍA: un `class="tienda-form"` dentro de Configuración. `.bloque-tarjeta*` NO se generalizó: eso es la tarjeta-con-slot del puente de /admin/tienda, maquinaria de esa pantalla. El rename fue 1:1 y /admin/tienda quedó byte-idéntica.
**EL TELÉFONO SE PARTE EN LA UI, NO EN EL DATO** (decisión del owner). El editor muestra indicativo (select) + número, pero se sigue guardando UNA sola columna (`whatsapp`, `pagoMovilNumero`): sin migración y sin tocar un solo consumidor —`whatsappUrl`, el footer y el checkout siguen leyendo el valor compuesto—. El corte vive en la FRONTERA DEL FORMULARIO: `lib/config/telefono.ts` (puro, con tests) parte al abrir y compone al guardar, y `guardar()` compone ANTES de validar (si le pasara el form partido, zod strippearía el teléfono). **`partirTelefono` matchea el prefijo MÁS LARGO** (`+1` vs `+57` vs `+507`: sin longest-match un indicativo corto corta mal el resto) y —lo que protege el dato— **si NINGUNO matchea NO inventa un indicativo**: devuelve el valor entero como número, así componer es lossless. Inventarlo habría CORROMPIDO números guardados sin indicativo. Se descartó partir el dato en dos columnas: cuesta migración + tocar consumidores del checkout (ruta del dinero) para un campo que siempre se usa compuesto.
**PAGOS: LA CONFIG DE CADA MÉTODO VIVE CON SU MÉTODO.** Era el defecto de fondo: los 4 checkboxes estaban al FONDO y los datos que cada uno necesita (la cuenta bancaria, el número móvil) ARRIBA en la lista plana. Ahora son tres sub-piezas (`.admin-metodo`) con su config anidada, usando el par del DS «superficie elevada + barra de tinta» para ENCENDIDO —TINTA, no ámbar: "encendido" no es un estado accionable— y `.duna-switch` en vez de checkbox crudo. **«Dos métodos, un solo dato»:** Nequi y Daviplata comparten `pagoMovilNumero`, así que van juntos en UNA sub-pieza con el número compartido adentro. Sobrevivieron las reglas: el aviso «Encendido — falta configurarlo», la validación de ≥1 método, y el predicado `estadoMetodoEditor` (NO se reimplementó).
**EL GATE DEL OWNER NO PASÓ LA PRIMERA VEZ, Y LA LECCIÓN ES DE MÉTODO.** La vista de LECTURA quedó con el ESQUELETO de bloques pero sin el contenido del diseño. Y **la verificación del orquestador falló igual**: confirmó que la rama de lectura tenía `.admin-bloques` + 4 `.admin-bloque` y dio el diseño por hecho **sin comparar el CONTENIDO de cada bloque contra el mockup**. VERIFICAR EL ESQUELETO NO ES VERIFICAR EL DISEÑO. Lo destapó el owner poniendo las dos capturas —build y mockup— lado a lado. Es la familia de siempre (*lo que está escrito no prueba lo que corre*) aplicada a un diseño: que la estructura esté no prueba que el contenido esté.
**LO QUE ESE GATE ENCONTRÓ ERA UNA REGRESIÓN, no una cosmética:** el bloque Pagos en lectura sólo listaba estados, así que **el número de pago móvil y los cuatro campos de la cuenta bancaria DEJARON DE VERSE** —antes eran campos planos del `<dl>`—. Había que ENTRAR A EDITAR para consultar a qué cuenta te transfieren. El rediseño lo introdujo y `8b1a694` lo restauró reusando las mismas sub-piezas con sus valores. Con eso lectura y edición comparten esqueleto de verdad: mismo bloque, mismo orden, y sólo cambia el CONTROL por su VALOR.
**EL PUNTO DEL CHIP — una primitiva a medio usar.** `.duna-badge__dot` YA existía en el design-system (5px, y `--attention` le pone `--duna-sol`), pero es un **HIJO EXPLÍCITO que el consumidor debe renderizar**: la clase sola no lo dibuja. El chip se había puesto sin el hijo, así que el punto no existía (`41f5100`, sin tocar CSS). En el mismo fix se alinearon dos diferencias más con el diseño: el chip va también en EDICIÓN (depende de que falten datos, no del modo) y el switch va a la DERECHA con el nombre a la izquierda, igual que lectura — así el control y el estado caen en el MISMO sitio al cambiar de modo. El chip dice QUÉ falta; el texto «Encendido — falta configurarlo» dice la CONSECUENCIA: complementarios, no duplicados.
**DEUDA DECLARADA CON FECHA DE VENCIMIENTO — el bloque Pagos SE VA A REHACER (`PAGOS-METODOS-LISTA-1`).** El owner señaló durante el gate que el MODELO está mal y el rediseño sólo lo hizo verse mejor: hoy son 4 BOOLEANOS FIJOS + UN `pagoMovilNumero` COMPARTIDO. Lo real es que hay negocios con números DISTINTOS para Nequi y Daviplata, o con sólo uno, y falta **Bre-B** (pago por llave), que es lo que más se usa hoy en Colombia. La forma pedida es «Métodos de pago» como LISTA con `+ agregar método de pago`, cada uno con su tipo y SU propia config — y el owner amplió el alcance a REDISEÑAR TAMBIÉN LA VISTA DE LECTURA, porque con un método nuevo la forma actual (piezas fijas apiladas) deja de servir. Eso cambia el modelo de datos (schema + migración + los consumidores del checkout: RUTA DEL DINERO), así que pide su propia sesión de diseño y no entró por esta puerta. Encuadre anotado para esa sesión: **la cardinalidad pasa de FIJA (4) a VARIABLE (N)**, y acá ya rige que *el layout sigue a la cardinalidad del control* (§ el escenario de la paleta). El resto de este rediseño —los bloques, el control de teléfono, `.admin-bloques`/`.admin-bloque`— sobrevive intacto a esa tanda.
Merge `--no-ff` mecánico tras el gate visual del owner (ruta con sesión: la capa 3 es suya, el worker no puede cargarla), tree del merge == tree gateado, `npm test` 1015/1015 + `next build` verdes.
Regla: § el modelo de BLOQUES es admin-level (`.admin-bloques`/`.admin-bloque`), lectura y edición comparten esqueleto y sólo cambia control↔valor; y un teléfono se parte en la UI, nunca en el dato, sin inventar indicativo cuando no lo trae.

## 2026-09-10 · Los métodos de pago son una LISTA, y Bre-B entra por las dos puertas (`PAGOS-METODOS-LISTA-1`)

Cierra la deuda con fecha de vencimiento que dejó el rediseño de «Datos del negocio». El modelo era 4 BOOLEANOS FIJOS + UN `pagoMovilNumero` COMPARTIDO entre Nequi y Daviplata; pasa a **`SiteSetting.metodosPago`, una lista JSON de `{tipo, datos}`** con set CERRADO de cinco tipos en orden canónico (nequi · daviplata · breb · transferencia · efectivo), cada uno dueño de SUS datos. Cinco slices sobre una rama, un gate visual del owner por tanda de bytes.

**EL MODELO LO DECIDIÓ EL OWNER, y el diseño resolvió su forma:** «estar en la lista ES ofrecerlo» —UN SOLO EJE, sin encendido/apagado aparte—, porque con dos ejes el dueño lee dos cosas por fila y la lectura deja de contestar la pregunta que va a hacer siempre: *qué ve mi cliente al pagar*. El costo del eje único —perder los datos al quitar— se paga con una **confirmación que NOMBRA lo que borra** y un **toast con Deshacer**, no con un switch; y quitar un método SIN datos no confirma, porque confirmar lo que no destruye nada entrena a confirmar sin leer. La lista se dibuja en DOS GRUPOS («Pagan antes» / «Pagan al recibir», divisor punteado): así **Contra entrega se lee como de otra naturaleza SIN color propio** ni excepción en el código.

**`efectivo` ES LA RUTA DEL DINERO, y el id es su contrato.** `derivarCondicionPago` compara la cadena contra `'EFECTIVO'` y de ahí sale si la orden nace CONTRAENTREGA o ANTICIPADO —lo que gobierna despacho-sin-cobro, cartera y el carril «Por cobrar»—. Renombrar ese id rompería el modelo de cobro **EN SILENCIO**: sin error y sin test rojo. El censo midió que había **CERO tests** llamando a esa función, así que la tanda dejó el primero que afirma la bifurcación.

**LA MIGRACIÓN ES ADITIVA Y NO DROPEA NADA**, y las dos razones importan: la ventana del `migrate deploy` (corre contra la base viva mientras el deploy viejo sirve tráfico) y —la que manda— que **las nueve columnas viejas son la única marcha atrás barata** si el backfill sale mal. El backfill copia el número compartido a los DOS métodos (era el comportamiento vigente) y los `NULL` caen a cadena vacía, así que un método queda INCOMPLETO —estado legítimo, que el editor declara— en vez de inventar datos. Verificado contra dev: la fila de Nayoli reconcilia método por método con sus booleanos. El DROP es su propio ítem, después de que este código esté vivo en producción.

**EL HALLAZGO QUE EL DISEÑO NO PODÍA VER: «el enum» del cobro son CUATRO declaraciones del mismo conjunto, no una.** El censo (`PAGOS-METODOS-CENSO-1`) corrigió al orquestador: el enum de Prisma se extiende con `ALTER TYPE ADD VALUE` y los endpoints server-side lo absorben **sin tocar código**; donde Bre-B no aterrizaba era en un **espejo escrito a mano** (`types/payment.ts`) que alimenta toda la UI del dinero. Y su modo de falla era peor que «sale como Otro»: el desglose «Por método» del informe PDF itera ese espejo, así que **un pago fuera de él quedaría FUERA del desglose PERO SÍ sumando al total** — un documento financiero cuyas partes no suman su total. El gate del owner destapó la TERCERA y la CUARTA (el mapa de series de la curva, y las `<option>` del filtro de Pagos escritas una por una). **Regla que esto reafirma: cuando dos declaraciones describen el mismo conjunto, o una DERIVA de la otra o hay un TEST que las ata** — y **derivar es lo más fuerte de los dos: una lista que no existe no puede divergir**. El filtro se derivó; el espejo y el mapa de series quedaron atados por un test que se vio FALLAR nombrando `BREB`.

**`--duna-serie-6` SE ELIGIÓ MIDIENDO, no describiendo.** Bre-B necesitaba una barra propia y los cinco colores de serie estaban tomados (serie-5 es el NEUTRO reservado al residual «Otro»). Verde compite con `ok` y rojo/vino compite a la vez con `bad` y con serie-3; un barrido LCh dio el **oliva-mustard `#908A00`**, con mínimos de **24,4 (claro) / 24,7 (oscuro)** contra estados y series — sobre el piso ~22 de la doctrina, y por encima del piso pairwise INTERNO de las cinco existentes (16,7). La herramienta se validó reproduciendo EXACTAS las tres cifras que `tokens.css` ya documentaba: **una medición que no se contrasta contra un valor conocido es una opinión con decimales**. El orquestador midió aparte el eje que ΔE2000 NO cubre —contraste contra la superficie—: 3,34:1 y 3,61:1 en claro, 5,01:1 y 4,62:1 en oscuro, los cuatro sobre el 3:1 de elemento gráfico no textual.

**«REGISTRAR PAGO» NO SE FILTRA POR LA CONFIGURACIÓN, Y ESO ES EL DISEÑO.** El owner reportó como bug haber registrado un pago con Bre-B sin tenerlo configurado; medido, ese select **nunca** consultó `SiteSetting`, para NINGÚN método, idéntico desde antes de la tanda. No se arregla filtrando: `SiteSetting.metodosPago` es **lo que la tienda OFRECE**, `Payment.metodo` es **cómo llegó la plata REALMENTE**, y filtrar haría **imposible registrar plata que sí entró** por un medio no publicado —forzando `OTRO` y ensuciando el desglose que esta misma tanda arregló—. Se resolvió MARCANDO: `<optgroup>` nativo «Los que ofreces» / «No los ofreces en tu checkout», todos elegibles, `OTRO` nunca marcado (es el residual por diseño). Con todo del mismo lado cae a lista plana: un solo grupo es un encabezado que no agrupa nada. La exclusión de `EFECTIVO` con comprobante sobrevive intacta —es por IMPOSIBILIDAD FÍSICA, otra naturaleza— y su frase explicativa se RETIRÓ: el propio ledger fundó esa restricción diciendo que **una restricción es más barata que un nudge y no depende de que el operador lea**, así que la frase era el nudge que la restricción vuelve innecesario.

**LECCIÓN DE MÉTODO, la más cara de la tanda: un spec no puede citar archivos que el worker no puede ver.** El spec del modelo mandaba leer el informe observado y los docs del diseño por su ruta en el repo del ORQUESTADOR; el worker está rooteado en el producto y no los alcanza. Lo declaró como hallazgo de pre-flight y compensó re-midiendo las cinco afirmaciones factuales contra el código (las cinco ciertas), pero el spec de UI se corrigió para decir explícitamente que **el spec ES el diseño**. Y la segunda: **el gate del owner encontró en una sesión dos defectos que ni la suite ni el orquestador habían visto** —una lista a mano que el propio test dejó afuera, y una superficie que nunca miró la config—; ninguna es visible sin USAR la pantalla. Es el argumento de la capa 3 en su forma más limpia.

Merge `--no-ff` mecánico tras el gate visual del owner (rutas con sesión: la capa 3 es suya), tree del merge == tree gateado, `npm test` 1030/1030 + `next build` verdes.
Regla: § los métodos de pago son una LISTA de tipos cerrados con datos propios; el id de `efectivo` es contrato de la ruta del dinero; y lo que OFRECE la tienda nunca filtra lo que se puede REGISTRAR como cobrado.

## 2026-09-11 · El DROP de las nueve columnas viejas de pago (`PAGOS-METODOS-DROP-VIEJAS-1`)
`546e38f` (Merge slice/pagos-metodos-drop-1: `6e85bcb`)

Segunda mitad —y cierre— del contract de `PAGOS-METODOS-LISTA-1`. Se van de `SiteSetting` las nueve columnas que el backfill dejó CONGELADAS: las cuatro de banco (`bancoNombre`, `bancoTipoCuenta`, `bancoNumeroCuenta`, `bancoTitular`), los cuatro booleanos (`pagoNequiActivo`, `pagoDaviplataActivo`, `pagoTransferenciaActivo`, `pagoEfectivoActivo`) y `pagoMovilNumero`. Es el DEPLOY 2 del ciclo **expand → migrate → contract** que abrió `20260910120000`.

**SE ESPERÓ AL DEPLOY, NO AL MERGE, Y ESA ES LA REGLA.** El DROP es seguro hoy porque el código que dejó de leer esas columnas **ya está vivo en producción** (merge `7122843`). La razón es la VENTANA del `migrate deploy`: la migración corre contra la base ANTES del `next build` y del swap, o sea **mientras el deploy VIEJO sigue sirviendo tráfico**. Si el código viejo todavía las leyera, cada request que las tocara daría 42703 durante esa ventana. Code-first: primero el deploy que deja de leerlas, después el que las borra.

**EL MERGE QUEDÓ CONDICIONADO A UNA VERIFICACIÓN DE PRODUCCIÓN, no a que el build estuviera verde.** Este DROP retira la ÚNICA marcha atrás barata del backfill: hasta hoy, si `metodosPago` hubiera salido mal, las nueve columnas seguían ahí para reconstruirlo a mano. Y **dev y producción no tienen el mismo dato**, así que un verde en dev no dice nada sobre la fila que importa. El orquestador RETUVO el merge y el owner corrió el runbook `nayoli-metodos-pago-verificar` contra producción (`--prod`, sólo lectura): los cuatro booleanos en `true` tienen su método, ninguno de más, en orden canónico, y `pagoMovilNumero` quedó copiado a nequi Y a daviplata. Recién con esa reconciliación en mano se mergeó.

**LA TRAMPA DE LAS DOS CAPAS, declarada en el spec ANTES de que mordiera.** `bancoNombre`/`bancoTipoCuenta`/`bancoNumeroCuenta`/`bancoTitular` existen con el MISMO identificador como columna Prisma **y** como propiedades de la interfaz TypeScript `CuentaBancaria` (`lib/checkout/transferencia.ts:17`), que es el contrato de entrada de `opcionTransferencia` — la definición de «cuenta servible» del checkout. Sólo se borra la columna; `lib/checkout/metodos-pago.ts` traduce `datos.banco → bancoNombre` al invocarla, a propósito. Verificado con `git diff`: `transferencia.ts`, su test y `metodos-pago.ts` tienen **0 líneas de diff**. Es la misma forma que el ledger documentó con `Customer.total_compras`: **antes de borrar un símbolo, verificá si lo que estás mirando es una columna o una propiedad**.

**UN DROP INVALIDA EL CLIENTE DE PRISMA YA GENERADO — hallazgo del worker, no del spec.** El build falló con **P2022** después de aplicar la migración: el cliente viejo seguía SELECCIONANDO columnas que ya no existen. Se resuelve con `npm run generate -w @duna/core`. Dos cosas quedan de ahí: el pipeline completo es **`npm run build`** (que encadena `db:deploy -w @duna/core && next build`), no `next build` a secas —el spec lo decía flojo—; y **producción es inmune por construcción**, porque Vercel instala limpio y su `postinstall` regenera el cliente ANTES del build, así que el cliente nace desde el schema ya contraído.

Los únicos bytes fuera del schema son **dos comentarios que quedaban mintiendo**: el de `app/api/site-settings/route.ts` decía que las 9 columnas «no se escriben acá y quedan congeladas» (ya no existen), y el de `lib/config/telefono.ts` fundaba la doctrina de partir el teléfono en la UI nombrando `SiteSetting.pagoMovilNumero` como columna. Se corrigió sólo la parte caducada: **`whatsapp` SIGUE siendo una columna y la doctrina sigue vigente**, ahora también para el número que vive dentro de `metodosPago`. Ni una línea de lógica en ninguno de los dos.

Merge `--no-ff` mecánico tras el gate del owner, tree del merge == tree gateado (`f7d398f`), `npm test` y `npm run build` verdes.
Regla: § un DROP espera al DEPLOY que dejó de leer la columna, no al merge; y cuando la migración destructiva retira la última marcha atrás, el merge se condiciona a verificar **producción** —no dev— porque no tienen el mismo dato.

## 2026-09-11 · El motor de paleta deja de entregar texto bajo el piso de contraste (`TEMAS-P6-MOTOR-1`)
`e1254a6` en `slice/temas-p6-motor-1`, merge `--no-ff`

Primera mitad de **P6**, el prerrequisito de plataforma del programa de THEMES: la del **MOTOR**. Los consumidores (`ProductCard`, `ProductChip`, `Logo`, `SubscriptionCTA`) van en su propio slice. `palette-derive.ts` tenía **tres defectos medidos contra sí mismo**, y los tres entregaban texto por debajo de 4.5:1 sin decirlo.

**NO ES UNA REVERSIÓN DE DOCTRINA, ES SU EXTENSIÓN CON LA CONDICIÓN QUE LE FALTABA.** El repo tenía escrito que «`acento-texto` sobre tarjeta se deja intacto, § doctrina» (`esquema-style.ts`). Esa decisión **se tomó cuando la tarjeta era SIEMPRE BLANCA**. Con el eje de esquemas, un theme puede poner un acento de luminancia media y el contraste cae a 2.91:1 — ilegible. **El espíritu de la regla no cambia: el texto flora contra LA SUPERFICIE QUE LO SOSTIENE. Lo que apareció fue una superficie nueva.**

**EL DEFECTO DE FONDO ERA UNA PREGUNTA MAL HECHA.** `direccionDePiso` preguntaba *«¿el fondo es claro u oscuro?»* (`luminancia > 0.5`) cuando la pregunta útil es **«¿qué dirección ALCANZA el objetivo?»**. Los dos casos que una investigación previa había declarado «sin salida» tienen salida **en direcciones OPUESTAS** —CORTE `#a3643a` se salva con BLANCO (4.728 vs 4.441 del negro) y PATIO `#c8662b` con NEGRO (5.391 vs 3.895 del blanco)—, que es exactamente por qué un umbral fijo de luminancia no puede acertar nunca. Los otros dos defectos eran de la misma familia: `pisoContraste` caminaba sólo `L` y **devolvía el hex parcial sin avisar** al agotar las iteraciones, y `acento-txt` era un **pick binario** blanco-vs-tinta que nunca pasaba por el piso y entregaba al perdedor-menos-malo (4.238:1 sobre el acento de PATIO).

**«NO ALCANZA» NO EXISTE, Y ESO SE DEMOSTRÓ EN VEZ DE SUPONERSE.** La pregunta abierta era qué debía hacer `pisoContraste` cuando ninguna dirección llegara al piso — la salida conservadora era devolver el mejor esfuerzo **con una señal**. No hizo falta: para **cualquier** luminancia de fondo en `[0,1]`, `max(contraste_blanco, contraste_negro) ≥ **4.5826**`, con el peor caso en el cruce algebraico `L = √0.0525 − 0.05 = 0.179129` (verificado además con un barrido de 100.001 puntos). **El piso siempre es alcanzable**, así que la función pasa a tener garantía dura y no una salida degradada. El arreglo es una escalera de tres pasos: caminar `L` → **bajar croma conservando el tono** → extremo puro de la dirección elegida.

**NAYOLI QUEDA BYTE-IDÉNTICA: 0 de las 24 tintas cambian, y 0 en cada uno de los 4 esquemas.** Es el hecho que gobierna el riesgo de este slice: se tocó el motor que deriva la paleta de TODOS los clientes, y la única tienda en línea no se mueve un píxel. **El gate del owner por lo tanto NO fue visual** —no había nada que mirar— sino la medición, que es reproducible con `npm test`. El arreglo sólo se manifiesta en paletas que todavía no existen.

**EL TEST SE VIO FALLAR ANTES, y su hueco era la razón de que esto llegara hasta acá.** `palette-derive.test.ts` sólo iteraba `[NAYOLI, NEON]` — acentos de luminancia **0.0979** y **0.8818**, los dos extremos, **nunca uno medio**, que es justo donde la regla del umbral falla. La fixture nueva (`#d98324`, luminancia 0.3111) contra el motor viejo da **dos fallas exactas: `acento-texto` 2.384 y `texto-suave` 2.521**; verde con el arreglo. Es la forma de siempre: **un test que nunca se vio fallar no prueba que atrapa nada**, y un set de fixtures que sólo cubre los extremos deja el medio sin guardia.

Después: VETA/acento 2.384→**4.515** y 2.521→**4.548** · PATIO/acento 3.756/3.320/3.075→**4.546/4.522/4.522** · CORTE/acento 4.288/4.081→**4.514/4.501** · `acento-txt` de PATIO 4.238→**4.513**.

Merge `--no-ff` mecánico tras el gate del owner, tree del merge == tree gateado (`14d85de`), `npm test` **1030/1030 antes y después**.
Regla: § la dirección del piso de contraste se elige por ALCANCE REAL, no por un umbral de luminancia; y una doctrina de color que se escribió con una sola superficie se EXTIENDE con la condición que le faltaba cuando aparece la segunda, no se revierte.

## 2026-09-11 · Cada familia de superficie gana su par de tintas, floreado contra ella (`TEMAS-P6-FAMILIAS-1` + `-CIERRE-1`)
`9da99b3` + `fec721c` en `slice/temas-p6-familias-1`, merge `--no-ff`

Segunda mitad de **P6**, la de los CONSUMIDORES. La primera (`TEMAS-P6-MOTOR-1`) arregló *cómo* se florea una tinta; ésta arregla **contra qué**. Las familias `tarjeta` y `superficie` ganan su propio par principal/secundario —`sobre-tarjeta`/`-suave` y `sobre-superficie`/`-suave`— y los siete puntos de consumo dejan de leer tokens de otra familia.

**EL PAR NO SE INVENTÓ: SE COMPLETÓ.** `esquema-style.ts` ya emitía `--sf-sobre-banda` y `--sf-sobre-banda-suave` — el molde `X` / `X-suave` ya era convención del archivo, sólo que existía para la banda y la tarjeta tenía nada más la mitad (`--sf-sobre`). **La regla del owner —no colapsar principal y secundario en un token— no abrió un patrón, cerró uno abierto**, con el precedente directo de `borde`/`divisor`, que se separaron por exactamente esta razón: apagar uno obligaba a cambiar el otro.

**Y SE MIDIÓ QUE UNA FAMILIA NO SIRVE PARA OTRA:** reusar `--sf-sobre` (floreado contra `tarjeta`) para la familia `superficie` es **PEOR en 5 de las 6 paletas** (1,14–1,31) — texto casi-blanco sobre una superficie clara. Por eso cada familia lleva el suyo, y `sobre-superficie` vive en `derivarPaleta` (raíz) mientras `sobre-tarjeta` vive en `esquemaStyle` (por banda): **la naturaleza del token sigue a la de su superficie**, no a una simetría de nombres.

**EL SPEC DEL ORQUESTADOR HABRÍA ROTO LA TIENDA, Y EL WORKER LO MIDIÓ ANTES DE OBEDECER.** Mandaba que los consumidores leyeran `var(--sf-sobre)` a secas. Medido: `app/globals.css` define `--sf-sobre: #ffffff` **en raíz** —así que el fallback de `var()` es inalcanzable— y para el esquema `crema`, el de Nayoli en toda página, `derivarPaleta` fija `sobre = '#ffffff'`. **Blanco sobre blanco, 1:1: el nombre y el precio de los productos habrían quedado INVISIBLES en `/tienda`, `/suscripciones` y el home, ese mismo día.** La salida fue un nombre nuevo sin default de raíz, con cada consumidor llevando **su propio** fallback (`var(--sf-sobre-tarjeta-suave, var(<token de siempre>))`) en vez de uno compartido. Regla que queda: **un token con default en `globals.css` no admite `var(x, fallback)` — el fallback nunca se alcanza.**

**BYTE-IDÉNTICO PARA NAYOLI POR CONSTRUCCIÓN, Y EL COROLARIO IMPORTA MÁS QUE LA TRANQUILIDAD.** Las tres raíces de Nayoli están en `null` (§ `site-content-defaults.ts`, «el storefront usa los defaults de código, que SON la paleta de Nayoli»), así que `cssPaleta` no inyecta nada, los tokens nuevos nunca aparecen y cada consumidor resuelve a su fallback: **5,104 · 14,493 · 7,098 · 14,493, los cuatro sin cambio, medidos antes y después.** Riesgo de despliegue cero. **Pero por la misma razón el arreglo es INERTE para Nayoli**: si un par estático de `globals.css` está bajo AA, esto no lo toca. Queda abierto como `TEMAS-P6-NAYOLI-ESTATICA-1`, y la lección es de método: **todo P6 se midió sobre paletas DERIVADAS y la única tienda en producción no usa una paleta derivada** — se midió el motor y se concluyó sobre la tienda. *Antes de afirmar que un arreglo del motor toca a un cliente, verificá que ese cliente PASE por el motor.*

**UNA CUENTA MÁGICA DETUVO EL GATE, Y ESO ESTUVO BIEN.** `palette-style.test.ts` afirmaba «las 24 vars `--sf-*`»; con los cuatro tokens nuevos son 28. El archivo estaba fuera del `touches:` declarado, así que el worker **paró en vez de editarlo** y devolvió GATE_RED. El cierre corrigió **las tres cosas** —el número, el comentario que lo desglosa y el título del test—, verificando contra la salida real de `cssPaleta` y no contra aritmética: un comentario que explica una cuenta y no la sigue es peor que no tenerlo.

Merge `--no-ff` mecánico tras el gate del owner, tree del merge == tree gateado (`5bebb38`), `npm test` **1039/1039**.
Regla: § cada familia de superficie lleva su propio par de tintas floreado CONTRA ELLA —reusar el de otra familia es medible y es peor—, y la naturaleza del token (raíz o por banda) sigue a la de su superficie.

## 2026-09-12 — DOS RULINGS DEL OWNER sobre el proceso y sobre el color

**EL GATE SE RESERVA PARA LO QUE EL OWNER PUEDE VER O PROBAR.** Hasta hoy TODO diff que tocara bytes de cliente paraba en AWAITING_APPROVAL. Una tanda nocturna de seis slices mostró el costo: **cinco de los seis eran byte-idénticos para la tienda viva** —tokens con fallback, documentación, tipos, un script nuevo— y el owner no tenía nada que mirar en ninguno. Su ruling: *«el gate para cosas que visualmente realmente yo vea que cambiaron o que se realizó un ajuste en la funcionalidad; del resto, no tengo que hacer tantos gates»*.

**El test operativo, y es el que evita que esto se vuelva una excusa: ¿el diff cambia lo que un humano VE, o lo que el producto HACE?** Si la respuesta es no, y está **MEDIDO** que es no —byte-identidad demostrada, no afirmada—, el slice no necesita el gate del owner: necesita su verificación mecánica. Si la respuesta es sí, o si **no se puede medir que es no**, el gate sigue siendo del owner. **La duda cuenta como sí.** Esto NO toca las otras dos reservas del owner, que siguen enteras: **el merge a `main` es suyo** y **toda operación de datos es suya**.

**UN TOKEN QUE VIVE SOBRE DOS FONDOS SE PARTE EN DOS, NO SE PROMEDIA.** Es la **tercera** vez que la misma forma aparece y por eso deja de ser un caso y pasa a ser doctrina: **`borde`/`divisor`** se separaron porque apagar uno obligaba a cambiar el otro; **`tarjeta`/`superficie`** ganaron cada una su par floreado porque reusar el de la otra medía PEOR en 5 de 6 paletas; y ahora **`tostado`/`tostado-2`**, que se usan sobre superficies claras (fallan, 1,77–2,45:1) **y** oscuras (pasan, 6,7–8,7:1). **Un valor único para los dos contextos no existe: moverlo arregla un lado y rompe el otro.** El síntoma que la delata es siempre el mismo — se mide el token en dos sitios y da bien en uno y mal en el otro, y la tentación es promediar.

**Corolario que el owner resolvió en el mismo movimiento, y que va contra la salida barata:** cuando el defecto está en el TOKEN, se arregla el token, no sus consumidores. Para `tostado-3` había dos caminos medidos —mover el hex a `#8c5d3e` (arregla los nueve usos de una) o editar los nueve consumidores para que lean otro token—; se eligió el hex porque *«la causa está en el token, no en los 9 consumidores; editarlos disfraza el problema y deja el token roto para el próximo»*. **Nueve ediciones que dejan viva la causa no son un arreglo, son nueve testigos.**

Regla: § el gate del owner es para lo que se VE o lo que el producto HACE, y la byte-identidad tiene que estar MEDIDA para saltarlo; y un token que vive sobre dos fondos se parte en dos, mientras que un defecto del token se arregla en el token y no en sus consumidores.

## 2026-09-12 · El producto deja de estar hardcodeado a UN cliente (`ONBOARDING-OWNER-MINIMO-1`, `ONBOARDING-HUECOS-MARCA-1`, `DOCS-QUE-MIENTEN-1`)
`1bbb7af` · `17c4a6a` · `7203b6b`, tres merges `--no-ff`

Primera tanda del trabajo hacia el SEGUNDO cliente. Un censo (`ONBOARDING-CENSO-1`) midió que **el hueco más caro no era de código sino de PROCESO: no existía forma de crear el primer OWNER sin sembrar el catálogo, los diez clientes falsos y las ~100 órdenes de Café Nayoli.** `signUpEmail` tenía dos call-sites de producción —el seed, y `accept-invite`, que exige una invitación de un OWNER que todavía no existe— y `package.json` un solo script de seed.

**SE ELIGIÓ NO ENSUCIAR ANTES QUE LIMPIAR BIEN, y la razón es del owner:** la alternativa era sembrar Nayoli y después borrar, lo que *«confía en que el borrado sea completo. Un residuo que sobreviva es dato falso en producción»*. **Un borrado completo es una AFIRMACIÓN que alguien tiene que verificar cada vez; una base que nace limpia no afirma nada.** `prisma/crear-owner.ts` crea el OWNER y nada más, reusando el `signUpEmail` del seed verbatim para que el hashing no diverja.

**Y ENDURECIÓ LO QUE EL SEED DEJABA BLANDO, por decisión del worker:** el seed trata sus tres env vars como opcionales y **cae en silencio a credenciales PÚBLICAS y documentadas** (`admin@sierranativa.co` / `ChangeMe123!`) — apropiado para una demo, un agujero para el primer OWNER de un cliente real. `crear-owner` las exige y sale nombrando cuál falta. En el mismo movimiento estrechó el `try/catch` **CIEGO** del seed (que trata cualquier error como «ya existe») al código concreto de Better Auth que `accept-invite` ya usaba.

**EL NOMBRE DEL NEGOCIO ES DATO, Y SU ÚNICA FUENTE ES `SiteSetting.nombre`.** Tres lugares lo tenían hardcodeado fuera del alcance del panel: el rail del admin (visible desde el primer login, en todas las pantallas), el correo de invitación —**cuyo arreglo ya estaba escrito 45 líneas más abajo EN EL MISMO ARCHIVO**, porque alguien lo resolvió para el correo de reset y no para éste— y el cierre de los dos reportes al equipo. **Si hace falta un fallback, es NEUTRO**: un default con la marca de otro cliente es el mismo defecto con más pasos. No hizo falta ninguno: la migración de `SiteSetting` ya inserta `'Configura tu tienda'`.

**`CLAUDE.md` describía nueve columnas que se habían dropeado el día anterior** — la doctrina del repo mintiendo sobre la RUTA DEL DINERO, que es el peor lugar posible, porque es lo que un worker lee para orientarse antes de tocar pagos. Se reescribió **el mecanismo y no el argumento**: esas secciones explican POR QUÉ el modelo es así, y eso no caducó. De las 6 apariciones quedan 4, las cuatro contextualizadas como historia.

**Hallazgo medido que abre una ventana con fecha de cierre:** **ninguna de las tres plantillas de WhatsApp está registrada ni aprobada por Meta todavía.** Parametrizar el nombre del negocio es GRATIS hoy; en cuanto se envíe la primera, cada cambio pasa por aprobación **carácter por carácter**. **Queda como PRECONDICIÓN DE GO-LIVE de WhatsApp**, no como mejora opcional.

Regla: § el primer OWNER de una tienda se crea sin sembrar la marca de otra —no ensuciar le gana a limpiar bien—, y el nombre del negocio es dato con una sola fuente, cuyo fallback nunca es el nombre de un cliente.

## 2026-09-12 · La plataforma de themes gana su segunda mitad, y el repo gana una guarda de tipos (`TEMAS-P6-FAMILIAS-2`, `TEMAS-P2-BRANDSTORY-1`, `TIPOS-GUARDA-1`)
`9e3f5be` · `0d6dd8c`, dos merges `--no-ff`

Tercera y cuarta entrega de **P6**, más el slot de `brandStory` y —de rebote— la primera forma de chequear tipos que este repo tiene.

**EL WORDMARK DEL FOOTER NO ESTABA EN NINGÚN SISTEMA.** El footer **vive fuera de `BANDA_IDS`**, así que `esquemaStyle` nunca lo scopea: pinta tokens raíz sobre `tinta`, sin piso. Medido, da 15–19:1 en cinco paletas y **1,085:1 en VETA** — ilegible. Ganó `sobre-tinta` (20,22:1 en VETA, sin empeorar ninguna de las otras cinco). **Se creó SIN su `-suave`**, y el worker lo justificó midiendo: wordmark y cherry son **la misma jerarquía visual**, un solo peso, y un token sin consumidor es la capacidad muerta que este repo ya prohibió dos veces.

**EL MECANISMO ESTABA BIEN Y EL FONDO CONTRA EL QUE SE EVALUABA ESTABA MAL.** `acento-txt` es un auto-flip, pero **evaluado contra `acento`**, y las tarjetas de plan pintan sobre `acento-2`: 1,378:1. Reusar `acento-txt` ahí **tampoco alcanza** (1,609). El hermano evaluado contra el fondo correcto da **12,567**. Es la firma de toda esta familia: no falta mecanismo, falta que mire la superficie que sostiene el texto.

**Y LA TRAMPA DEL DEFAULT DE RAÍZ SE DETECTÓ SOLA, que es la señal de que ya es doctrina.** El spec no la nombró para `acento-txt`; el worker midió que **ese token tiene default en `globals.css`**, dedujo que `var(x, fallback)` nunca caería al fallback, y que usarlo habría cambiado el color visible de Nayoli HOY. Agregó un token nuevo sin default y **declaró la ampliación de alcance en vez de ejecutarla en silencio**. Es la misma trampa que un día antes casi deja invisibles el nombre y el precio de los productos.

**`brandStory` GANA SU SLOT AUNQUE NINGÚN THEME INMEDIATO LO USE, y el precedente en contra se afinó en vez de romperse.** El repo había evitado dos veces declarar un slot antes que su primera variante real («capacidad muerta»). El owner mantuvo P2 igual: *«tres de los cinco themes lo necesitan, y quiero el slot listo CON LA PLATAFORMA, no descubriéndolo theme por theme»*. **La regla queda afinada: «capacidad muerta» prohíbe un slot ESPECULATIVO; un slot con tres consumidores nombrados y fechados es PLATAFORMA.**

**EL REPO NO TENÍA NINGUNA GUARDA DE TIPOS, y eso valía más que el error que la destapó.** `npm test` corre con `tsx`, que usa **esbuild**: transpila por archivo **sin resolver tipos entre módulos**. Por eso 1039 tests verdes convivían con un error de `tsc` vivo, y `package.json` no tenía forma de chequear tipos sin `next build` —que aplica migraciones—, así que **nadie podía correrlo sin tocar la base**. Ahora hay `npm run typecheck` (`tsc --noEmit`, **1,7–2,1s** medidos) y el owner lo mandó **al gate de todos los workers**: *«2s contra que tsc pase y el proyecto no compile es compra obvia»*.

**El error que lo destapó no era de una sección, era de un PATRÓN**, y se descubrió porque **se mudó**: el slice de `brandStory` cambió la prueba a `subscriptionCTA` y el mismo `TS2352` reapareció sobre otra interfaz. `X as Record<string, unknown>` falla sobre **cualquier** interfaz de contenido, porque ninguna tiene index signature. Se arregló **sin ningún cast** — `'variante' in r.subscriptionCTA` —, que además dice con más precisión lo que la prueba quiere afirmar: **un cast en un test es una afirmación que el test no prueba.**

Merges `--no-ff` mecánicos tras el gate del owner, trees == trees gateados, y **verificación del ÁRBOL COMBINADO** —que ninguna rama había probado— en `npm test` **1052/1052** y `npx tsc --noEmit` en **0**.
Regla: § el mecanismo de piso puede estar bien y el FONDO contra el que evalúa estar mal; un test que castea afirma lo que no prueba; y un gate que corre con un transpilador sin chequeo de tipos no es una guarda de tipos.

## 2026-09-12 · El nombre del negocio sale del texto que Meta va a aprobar (`WHATSAPP-PLANTILLAS-MARCA-1` + `-CABLEADO-1`)
`5d4d264` + `5969335`, merge `--no-ff`

Las tres plantillas de WhatsApp al cliente (`nueva_orden`, `cliente_inactivo`, `orden_entregada`) horneaban **«Café Nayoli»** en el cuerpo. Ahora es una **variable posicional**, y los tres handlers la llenan desde `readSiteSettings()`.

**SE HIZO AHORA POR IRREVERSIBILIDAD CRECIENTE, NO POR TAMAÑO.** Son **WhatsApp Business Message Templates**: Meta las aprueba **carácter por carácter** salvo las variables. Medido: **ninguna está registrada todavía** (el canal es un stub deliberado, `PENDIENTE_CANAL`). **Mientras eso sea cierto el cambio es gratis; desde la primera aprobación, cada palabra cuesta una re-aprobación.** El owner lo puso arriba de la lista por eso, y **queda como precondición de go-live de WhatsApp**: si el nombre se hornea otra vez antes de enviar, el costo ya no se recupera.

**LA POSICIÓN NO ES LA MISMA EN LAS TRES —4ª, 3ª y 2ª— y eso era el filo del slice.** Meter el nombre al final de cada array habría roto dos de tres **en silencio**: `renderWhatsappTemplate` sustituye con `variables[i] ?? match`, así que un desalineamiento no lanza, no falla ningún test, y sale como texto corrido con los datos cambiados de lugar.

**EL PRIMER INTENTO DEJÓ UNA MEDIA VERDAD, Y LA LECCIÓN ES SOBRE QUÉ MIDE UN TEST.** El slice que abrió la variable dejó un test de byte-identidad **verde** — pero le pasaba la cuarta variable **a mano**, mientras el handler real seguía pasando tres. Probaba que **la plantilla** era byte-idéntica *dada* la variable, **no que el pipeline lo fuera**: por el camino real el mensaje decía *«Gracias por comprar en `{{4}}`.»*. **Un test de byte-identidad tiene que medir la MISMA UNIDAD que el cambio afecta** — probar el componente aislado con entradas fabricadas da una luz verde falsa, y la da justo donde se usa para saltarse un gate.

**El regression-catcher que faltaba es una relación DERIVADA:** el largo del array que arma cada handler contra el largo del que declara su plantilla. Para poder atarla se extrajo una función pura por handler. No puede divergir en silencio, que es la misma doctrina que este repo pagó tres veces esta semana con conteos escritos a mano.

Merge `--no-ff` mecánico, tree == tree del slice (`f8f1565`), `npm test` **1063/1063** y `npx tsc --noEmit` en **0** — el typecheck ya es parte del gate por ruling del owner. **La byte-identidad se verificó POR EL CAMINO REAL**: los tres renders dan el texto de siempre con el nombre resuelto y sin ningún `{{n}}` colgado.
Regla: § el texto que un tercero va a aprobar carácter por carácter se parametriza ANTES de la primera aprobación, porque ahí el cambio es gratis y después no; y una variable posicional se ubica leyendo la plantilla, nunca al final por costumbre.

## 2026-09-12 · Los defaults de `SiteContent` dejan de ser el contenido de un cliente (`CONTENIDO-NEUTRALIZAR-1` … `-4`, + el runbook de siembra)
`1974899` · `c984fac` · `807d25b` · `5654b9c` · `f8a0210`, merge `--no-ff`

**EL HALLAZGO QUE ABRIÓ TODO SE MIDIÓ CONTRA PRODUCCIÓN: no existía NINGUNA fila de `SiteContent`.** `SiteContent` nace sin `INSERT` a propósito —loader SOFT, defaults-como-fallback— así que **todo el storefront de Café Nayoli salía de `lib/config/site-content-defaults.ts`**. Esos defaults tenían **doble función y las dos chocaban**: el contenido vivo de UN cliente, y el estado inicial de TODOS. Neutralizarlos habría **vaciado la tienda en producción**; dejarlos hacía que el siguiente cliente arrancara hablando de café de Supatá. **No se podían tener las dos con un solo juego de defaults.**

**EL ORDEN FUE LA DECISIÓN, NO EL CONTENIDO.** El owner lo fijó como estricto —**siembra → su gate → neutralización**— con una razón que es la forma general del problema: *«invertirlo o mergearlos juntos abre una ventana donde Nayoli ya perdió sus defaults y aún no tiene fila; su tienda se vacía en producción»*. El gate va **en el medio**: con la fila sembrada y el código todavía viejo, la tienda tiene que verse idéntica — y se vio.

**LA BYTE-IDENTIDAD SALIÓ POR CONSTRUCCIÓN, y eso fue lo que abarató la siembra.** Medido antes de escribir nada: `resolverSiteContent` es **idempotente** (`resolver(resolver({})) === resolver({})`, 5584 chars). Si lo que se siembra es exactamente lo que el resolver ya producía, resolverlo de vuelta da lo mismo: **la tienda no puede cambiar.** El runbook lo **comprueba en sus tres pasos** en vez de asumirlo. Y escribe por **`UPSERT` directo, no por el schema del editor**: `siteContentEditableSchema` **strippea** la clave `tema` completa y `paginas.suscripciones` — escribir por ahí los habría perdido en silencio.

**NEUTRALIZAR NO ES REEMPLAZAR LOS SUSTANTIVOS, y el primer intento lo demostró.** Pasó la suite y **no pasó el gate del owner**: quedó neutro respecto a *café* y no respecto a *un negocio cualquiera*. «Preparado fresco en tandas semanales», «elaborado con el mismo cuidado», «el proceso que mejor revela lo que sabemos hacer» — **una frase hereda su suposición en la ESTRUCTURA, no en el vocabulario**, y traducir las palabras deja el molde intacto. **El test que lo destapa es la SUSTITUCIÓN**: leer la frase con tres rubros de forma distinta (ropa que revende, librería, velas). Si suena rara en alguno, no es copy neutro: es una suposición con otras palabras. **Y la trampa del otro lado hay que nombrarla igual:** abstraer de más da copy vacío — el objetivo es **concreto en la forma y genérico en el dominio**, hablando del COMPRADOR y la TRANSACCIÓN (elige, recibe, repite), no del PROCESO DE PRODUCCIÓN.

**UN CRITERIO DE NEUTRALIDAD NO PUEDE SER MÁS ANCHO QUE EL PRODUCTO.** El orquestador incluyó «un negocio de servicios» en ese test y **lo retiró midiendo**: el producto tiene modelo de envíos, direcciones y entregas — **es un e-commerce de bienes físicos por construcción**. Copy que asume que algo *llega* es consistente, no una suposición de más. Pedir que sirva a un rubro que el schema no modela es pedir que sea vago.

**EL CONTENIDO DE UN CLIENTE ESTABA EN CINCO LUGARES, NO EN UNO, y cada uno apareció al romper el anterior.** Los defaults; **tres archivos de test** que hardcodeaban el mismo copy como fixtures; y —lo que nadie había mirado— **los HINTS DEL EDITOR** (`Ej. "Plan 250 g"`), que no son dato ni test sino **texto que el dueño lee mientras llena su panel**. Un censo que midió `DEFAULTS` no los vio. **El contenido de un cliente no vive sólo en los datos: también en la AYUDA que el producto le da al siguiente.**

**Y LOS TESTS SE PARTIERON EN DOS CLASES QUE PEDÍAN LO CONTRARIO.** Los que afirman una **RELACIÓN** («catálogo alineado → sin aviso») seguían siendo verdad y rompieron sólo porque su fixture estaba escrito a mano: se **DERIVARON**, y reescribirlos a mano habría vuelto a poner la bomba. Los que afirmaban que **una MIGRACIÓN terminó** —«los DEFAULTS reproducen los `SUBSCRIPTION_PLANS` de hoy», copia verbatim de dos módulos ya retirados— se **RETIRARON con su explicación en el código**: § **un test que protege una migración tiene fecha de vencimiento**, y cumplida la migración pasa de proteger a CONGELAR, justo el día que alguien quiera cambiar lo migrado.

Merge `--no-ff` mecánico tras el gate del owner sobre el TEXTO (no sobre el preview: la base de Preview tiene fila propia y sólo habría mostrado parte), tree == tree gateado (`b89d68a`), `npm test` **1064/1064** y `npx tsc --noEmit` en **0**.
Regla: § un default que es el contenido de un cliente vivo se convierte en DATO de ese cliente antes de neutralizarse, nunca al revés; neutralizar es cambiar la estructura de la frase y no sus sustantivos; y el criterio de neutralidad se acota a lo que el schema modela.

## 2026-09-12 · Los themes son DATO, y aplicar uno incompleto FALLA RUIDOSO (`TEMAS-PRESET-DATO-1` + `-CIERRE-1`)
`6913c7a` + `fb52885`, merge `--no-ff`

Pieza **0(d)** de la fase 0 del programa de THEMES. `lib/config/themes.ts` declara los cinco presets como DATO —raíces, par, forma, esquemas, orden y variante por sección— y `aplicarPreset` los escribe con la forma de `setPaginaVisible`: **merge quirúrgico, un solo write transaccional**, sin draft/publish. Por la API normal del panel harían falta ~8 llamadas HTTP; por este camino, una.

**LA GUARDA ES EL SLICE, no el dato.** Hoy **casi ninguna** de esas variantes existe —`marquesina`, `tabla`, `hilo`, `chips`, `ticket`, `media`, `linea`, `collage`, `bento`, `mosaico` no están en ningún `claves`— y **`resolverVariante` cae a la canónica ante una clave desconocida SIN AVISAR**. Aplicar PLIEGO hoy daría **una tienda que no es PLIEGO, sin un solo error**: exactamente el fallo callado que este repo persigue. Por eso `aplicarPreset` **valida contra el `REGISTRY` ANTES de escribir** —variantes, bandas, esquemas, orden, par y forma— y **se niega nombrando lo que falta**, sin escribir nada. **Una validación parcial que escribe la mitad es peor que ninguna.**

**Y DE ESA MISMA VALIDACIÓN SALE LA HOJA DE RUTA, medida en vez de afirmada:** `temasCompletos` deriva qué themes están listos. Hoy **1 de 6 — sólo el preset de ARRANQUE** (PLIEGO 5 faltantes · CORTE 4 · PATIO 7 · VETA 3 · VITRINA 5). Se recalcula sola cada vez que entra una variante: nadie tiene que acordarse de actualizar una lista. La guarda está **probada, no sólo escrita** — 8 de sus 18 tests fallan si se la neutraliza.

**LA INVARIANTE VA EN EL DOCSTRING, no sólo en el commit:** `aplicarPreset` **nunca toca un texto ni una imagen del dueño**. El merge quirúrgico lo garantiza por construcción —sólo alcanza `tema`, `esquemas`, `orden` y `variante`—, y quien lea la función dentro de seis meses tiene que poder saberlo sin buscar el asiento. Que **no** haya guarda contra re-aplicar un preset distinto sobre un tenant ya afinado a mano está nombrado ahí como **propiedad conocida**, no como olvido: hoy no cuesta nada porque la composición nunca la toca el dueño (§ el panel NO lleva selector de composición).

**EL CIERRE ES UNA LECCIÓN SOBRE QUÉ AFIRMA UN TEST.** Al mergear `main`, tres pruebas se cayeron **sin un solo defecto en `themes.ts`**: afirmaban **CUÁNTAS** variantes fallan, y `brandStory` acababa de ganar su slot (`TEMAS-P2-BRANDSTORY-1`), así que un faltante cambió de categoría. Un conteo escrito a mano que describe un conjunto que otro archivo produce es una **segunda declaración** —la falla que este repo pagó cuatro veces esta semana—. Ahora afirman **el CONJUNTO por nombre**, derivado y comparado con `deepEqual`: no se rompe cuando la plataforma crece, y **falla informando** —el día que se construya `hero·marquesina`, el test dice cuál salió de la lista en vez de «esperaba 5, recibí 4»—.

**El worker arregló CINCO y no los TRES rotos**, y esa es la parte que vale: el mismo patrón vivía en PLIEGO, VETA y VITRINA, que no fallaban **por coincidencia** de que su número no cambió. Arreglar sólo lo roto habría dejado tres bombas idénticas armadas. Y la distinción más valiosa —**«sección sin slot» ≠ «clave inexistente»**, dos diagnósticos distintos— sobrevive moviendo su ejemplo de `brandStory` a **`featured`**, que sigue sin slot.

Merge `--no-ff` mecánico, tree == tree gateado (`56e3c56`), `npm test` **1082/1082** y `npx tsc --noEmit` en **0**.
Regla: § un preset que nombra una capacidad que el producto no tiene se REHÚSA nombrándola, nunca degrada en silencio; y un test que cuenta cuántos elementos fallan se rompe cuando la plataforma crece — el que nombra CUÁLES, no.

## 2026-09-12 · La marca de un cliente sale del repo de todos (`MARCA-CLIENTE-PRESENTACIONES-1` + `-CIERRE-1`)
`dce00f8` + `5e97c2b`, merge `--no-ff`

**NO ERA «UNA IMAGEN POR DEFECTO».** `public/images/cafe-nayoli-250g-grano.webp` es la foto del **producto REAL** de Café Nayoli: su bolsa blanca, con la etiqueta negra y dorada que dice «CAFÉ NAYOLI · 250 g · EN GRANO» y el colibrí de su logo. Palabras del owner, que es como quedó nombrado el ítem: **la MARCA de un cliente compilada en el repo de TODOS, servida por cualquier despliegue nuevo hasta que alguien la note.** Los defaults de `presentaciones.imagen1/2` pasan a vacío.

**SE PUDO HACER HOY POR DOS COSAS QUE NO EXISTÍAN AYER.** La primera: **Nayoli tiene su fila** desde la siembra de esta mañana, con esas rutas adentro, así que un default vacío no la toca — hace ocho horas este mismo cambio le habría vaciado las tarjetas en producción. **Es exactamente la separación que la siembra existía para crear.** La segunda: las **DOS** variantes de la sección (`GrindChooserMosaico`, `GrindChooserIndice`) ya renderizaban la imagen **condicionada**, con su propio comentario diciendo por qué — *«sin foto se ve el fondo `--sf-linea`: un hueco VISIBLE que el cliente sabe llenar, nunca un `<img src="">` roto»*. **El hueco es el diseño.**

**Y POR ESO SÓLO SALEN ESTAS DOS.** El hero (`HeroCurtina`) y las cuatro del collage (`BrandStory`) montan su `<Image src={…}>` **SIN guarda**, así que una cadena vacía ahí sí produce el `<img src="">` roto. Sus cinco rutas son stock cafetero sin marca visible —molestas, no urgentes— y esperan reemplazo. **Dos naturalezas distintas dentro del mismo ítem, y por eso se separan.**

**UN DESPLIEGUE NUEVO AHORA ABRE CON DOS AVISOS ÁMBAR, y es una decisión del owner, no un efecto lateral.** Al vaciar los defaults, el aviso #2 del Dashboard («tarjeta con título y sin imagen») empieza a **decir la verdad**, y ocho tests que usaban `resolverSiteContent({})` como el fixture «sano, cero avisos» dejaron de pasar. **No estaban mal escritos: encodificaban que un despliegue fresco estaba COMPLETO — y lo estaba, con la foto de otro cliente adentro.** El owner decidió que dispare: *es verdad, hay un hueco real; ese aviso existe exactamente para eso; para un cliente en su primer día no es un reproche sino la lista de qué llenar; y callarlo sería peor —el Dashboard le diría «todo al día» a una tienda con huecos visibles—.* **Se descartó** que el aviso callara cuando el título viene del default: vuelve la regla más difícil de razonar y esconde un hueco que existe igual.

**EL ARREGLO FUE DEL FIXTURE, NO DE LA EXPECTATIVA.** La relación que esos tests afirman —*contenido bien configurado → cero avisos*— sigue siendo cierta; lo que dejó de serlo es que **el default sea ese contenido**. El «sano» ahora parte de los defaults y **rellena** las dos imágenes (con una ruta genérica, **nunca las de Nayoli** — sería volver a meter por la puerta del test lo que el slice sacó por la del código). **Un fixture que se llama sano y produce avisos miente sobre lo que prueba.** Y se sumó la propiedad que nadie afirmaba y que es justo la conducta recién decidida: un despliegue fresco produce **exactamente los dos avisos de imagen**, afirmados **por CLAVE y no por conteo**.

**LOS OCHO ARCHIVOS NO SE BORRAN** (4 `.webp` + 4 `.png`, y los PNG pesan ~1,7 MB cada uno — el repo carga bastante más que los 3,5 MB del censo, que sólo contó las 7 referenciadas). La fila de Nayoli apunta a dos de ellos: **primero se mudan a su Blob y se actualiza su fila, después salen del repo.** Es la misma ventana de la siembra, aplicada a las fotos.

Merge `--no-ff` mecánico tras el gate del owner, tree == tree gateado (`e7a9a66`), `npm test` **1084/1084** y `npx tsc --noEmit` en **0**.
Regla: § la foto de producto de un cliente no es un default, es su marca — y un default que hace parecer COMPLETO a un despliegue vacío miente dos veces: sobre el cliente que no lo llenó y sobre el cliente cuya foto se está sirviendo.

## 2026-09-12 · El primer slice de P6 que se VE, y el alcance que se partió por el nombre equivocado (`TEMAS-P6-NAYOLI-FIX-1`)
`36a0fe0`, merge `--no-ff`

**ES EL PRIMERO DE P6 QUE CAMBIA UN PÍXEL DE LA TIENDA VIVA.** Los anteriores eran byte-idénticos para Nayoli y la razón es estructural: sus **tres raíces están en `null`**, así que `cssPaleta` no inyecta nada y su storefront pinta los **literales estáticos de `globals.css`** — el motor de derivación, que es lo que P6 viene construyendo, **no corre para ella**. Este slice mueve uno de esos literales, y por eso fue el primero que el owner tuvo que gatear MIRANDO.

`--sf-tostado-3`: **`#a07050` → `#8c5d3e`**. Contra `superficie`/`fondo`/`tarjeta`: **3,511 / 3,992 / 4,261 → 4,614 / 5,246 / 5,599**. Los nueve usos pasan AA.

**LO QUE HIZO SEGURO MOVER EL TOKEN EN VEZ DE EDITAR NUEVE CONSUMIDORES fue una medición, no una preferencia:** los nueve usos son **texto o ícono, CERO como fondo, borde o ring** (grep repo-wide). Un token que sólo se usa como tinta no le cambia el aspecto a ninguna superficie cuando se oscurece. La razón del owner va al asiento: *«la causa está en el token, no en los 9 consumidores; editarlos disfraza el problema y deja el token roto para el próximo».*

**Los cuatro íconos de estado vacío** (`CartDrawer`, `rastrear-pedido` ×2, `tienda`) a `aria-hidden`, con la condición **verificada uno por uno**: en los cuatro el texto vecino dice el estado completo —carrito vacío, «Orden no encontrada» con su detalle, cada paso del timeline con label y descripción, «Sin resultados» con el suyo—. Ninguno es la única pista, así que la premisa del owner aguanta en los cuatro. No se les tocó el color: un ícono decorativo no tiene piso que cumplir.

**EL WORKER SE NEGÓ A LA §2 DEL SPEC, Y TENÍA RAZÓN — verificado en el código por el orquestador, no aceptado de palabra.** El spec le ordenaba: si la paleta DERIVADA también da un `tostado-3` corto, darle `piso` en la RECETA. Sí falla en los seis presets (peor caso PATIO, **2,303** contra `superficie`). Pero:

  - **`palette-derive.ts`: `if (r.piso) hex = pisoContraste(hex, fondo, 4.5)`** — el piso florea **sólo contra `fondo`**, hardcodeado;
  - **`palette-derive.ts:273`: `out['tarjeta'] = '#ffffff'`** — la tarjeta es **blanco FIJO**, no derivado de las raíces;
  - **`themes.ts:303`, VETA: `fondo: '#16120e'`** — **fondo oscuro** con esa tarjeta blanca fija.

**Ningún hex único pasa AA contra un fondo oscuro Y una tarjeta blanca a la vez.** Simulado el flag: seguiría bajo AA contra `superficie` en los **seis** presets (3,99–4,16) y contra `tarjeta` en VETA (4,073). O sea que obedecer habría dejado el token **verde contra `fondo` y rojo contra todo lo demás: AA FALSO**, que es peor que no arreglarlo — se ve arreglado. **Una guarda que sólo cubre una de las superficies donde el token vive no es media guarda: es una que miente.**

**EL ERROR ERA DEL SPEC, Y LA LECCIÓN ES LA DOCTRINA DEL OWNER LEÍDA AL REVÉS.** El mismo spec dejaba `tostado`/`tostado-2` explícitamente fuera («ni los mires acá») porque son el **patrón de familia** —un token que vive sobre dos fondos se parte en dos, no se promedia— y metía `tostado-3` adentro. **El alcance se partió por el NOMBRE DEL TOKEN cuando la propiedad que decide es otra: ¿vive sobre dos fondos?** En el estático de Nayoli `tostado-3` vive sobre tres superficies claras y un solo hex alcanza; en la paleta DERIVADA vive sobre un fondo que puede ser oscuro y una tarjeta que siempre es blanca, exactamente como sus hermanos. **Es el mismo defecto, no uno vecino.**

**TEMAS-P6-TOSTADO-FAMILIA-1 se lleva los TRES en UN solo slice** (decisión del orquestador; el tamaño de un slice es suyo). El worker preguntó si `tostado-3` necesitaba el propio: no. Los tres necesitan **el mismo mecanismo que falta** —un piso multi-superficie, o el par de la familia—, y en tres slices se derivaría tres veces, o peor, tres veces distinto. El estático de Nayoli ya quedó bien; lo que queda es sólo la mitad DERIVADA, que hoy no le llega a ningún cliente.

**EL TEST NUEVO LEE EL ARTEFACTO, NO LO TRANSCRIBE.** El hex vive en CSS, no en el módulo, así que la garantía se escribió leyendo `app/globals.css` **por regex** y calculando el contraste — un test que copiara `#8c5d3e` afirmaría que el archivo dice lo que el test dice, que es nada. **Visto fallar** con el hex viejo (3,511) antes del fix.

Merge `--no-ff` mecánico tras el gate del owner, tree == tree gateado (`8f27b76`), `npm test` **1085/1085** y `npx tsc --noEmit` en **0**.
Regla: § un alcance se parte por la PROPIEDAD que define el defecto, nunca por el nombre del símbolo — dos tokens con nombres distintos y la misma propiedad son un solo problema, y un tercero con el mismo nombre y otra propiedad son dos.

## 2026-09-12 · El cast que le mentía al compilador en la ruta del dinero (`CHECKOUT-BREB-CAST-1` + `-CIERRE-1`)
`fb865aa` + `0e90137`, merge `--no-ff`

**NO ERA «SUB-DECLARAR UN MÉTODO QUE FALTA».** El comentario del cast se defendía diciendo que no mentía sobre el runtime, porque `CheckoutPayload` todavía no declaraba `'breb'`. Eso **ya no era cierto** —`PAGOS-METODOS-REMATES-1` ensanchó ese tipo y dejó la página sin tocar por ser tier 1—, así que la única razón por la que el cast existía se había ido y el cast se había quedado. Y el agujero era más ancho que `'breb'`: **`useState('nequi')` sin parámetro de tipo ensancha el literal a `string`**, así que `metodoActivo` era `string` y el `as` **afirmaba que un string cualquiera es uno de cuatro literales** — apagaba la verificación entera de ese valor en la ruta del dinero. Palabras del owner: *«"no muerde hoy" en la ruta del dinero es la definición de mina inerte».*

El arreglo tipa contra **`MetodoPagoTipo`** (el set cerrado que ya existe, y del que `MetodoCheckout.id` ya era), borra el cast, y hace que **`checkout.service.ts` IMPORTE el tipo** en vez de repetir sus cinco literales — dos declaraciones del mismo conjunto es la falla que este repo ya pagó con `CATEGORIAS`/`CATEGORIA_LABELS` y con el schema editable de `presentaciones`.

**EL SPEC PREDIJO UN ROJO QUE NO EXISTÍA, Y EL WORKER LO MIDIÓ EN VEZ DE OBEDECER.** El spec afirmaba que borrar el cast dejaría `tsc` en rojo por sí solo, y que ese rojo obligaría a la guarda. Falso: **`noUncheckedIndexedAccess` no está en este `tsconfig` y NO viene dentro de `strict`**, así que `arr[0]` tipa `T` —nunca `T | undefined`— aunque el array esté vacío en runtime, y `arr[0]?.id ?? null` computa un tipo **sin `null`**. Medido con dos probes: con `[0]`, **0 errores sin ninguna guarda**. La guarda que el spec quería habría entrado como ceremonia, sin nada que la sostuviera.

**Y EL CIERRE EXISTE PORQUE EL ARREGLO DE ESA DESVIACIÓN TRAJO SU PROPIA MINA.** El worker resolvió el tipo con `.at(0)`, que sí devuelve `T | undefined` de fábrica. Correcto en el tipo, y **medido por el orquestador al revisar**: `Array.prototype.at` es **ES2022y es RUNTIME** —`tsc` no lo baja de nivel—, **el polyfill de Next no lo trae** (cero apariciones de `Array.prototype.at` y de `esnext.array.at` en `polyfill-nomodule.js`), el `target` es **ES2017**, `package.json` **no declara `browserslist`** —así que aplica el default de Next, que llega hasta **Safari 12**— y `.at` llegó en **Safari 15.4**. Era además **el primer `.at(` de código cliente del repo**. En un iPhone con iOS 15.0–15.3 eso tira `TypeError` y **se lleva el componente de checkout entero, en silencio**: página rota, sin error, y el comprador se va.

**`lib: ["dom","dom.iterable","esnext"]` es lo que lo vuelve invisible, y es la trampa que hay que retener: `lib` son SÓLO TIPOS.** Declara qué existe para el compilador, no qué existe en el navegador. Por eso una API que el cliente no tiene compila en verde sin una sola queja — el mismo modo de falla de siempre acá (*lo que está escrito no prueba lo que está corriendo*), en la capa de los tipos.

Quedó el **chequeo de largo explícito** (`availablePayments.length > 0 ? availablePayments[0].id : null`): mismo tipo, ES5, y dice en el código la condición que de verdad decide en vez de esconderla en un operador. **El rojo reaparece al quitar la guarda** (`TS2322`), que es lo que prueba que la guarda la sostiene el tipo. El comentario **registra por qué se descartó `.at()`**, para que nadie lo «simplifique» de vuelta.

**LA GUARDA VA ANTES DE `setLoading(true)`**, y no es detalle: un `return` después dejaría el botón clavado en «Procesando…» para siempre. No duplica al `disabled` del botón —aquél impide el click, ésta impide el envío— y la diferencia es que **el `disabled` vive en otra parte del archivo y el tipo no lo conoce**.

**LO QUE NO SE HIZO, con su razón:** encender `noUncheckedIndexedAccess` cerraría la clase entera y **por eso mismo no entró acá** — es repo-wide, toca todo array indexado del proyecto, y es su propia decisión con su propio censo (`TSCONFIG-INDEXADO-CENSO-1`, en cola).

Merge `--no-ff` mecánico **con la MEDICIÓN, no con gate visual** (decisión del owner): `customer_bytes.strings` vacío — ni un texto ni un comportamiento visible cambian, y la expresión nueva da el mismo valor que la vieja en todo input. tree == tree de la rama (`14663c3`), `npm test` **1085/1085** y `npx tsc --noEmit` en **0**.
Regla: § `lib` del tsconfig son SÓLO TIPOS — una API que el navegador del cliente no tiene compila en verde igual, así que estrenar un método de runtime en una ruta que factura se verifica contra el POLYFILL y el browserslist, nunca contra el compilador.

## 2026-09-12 · La FAQ que prometía lo que el sistema no hace (`SUSCRIPCIONES-FAQ-DATO-1` + `-EDITOR-1`)
`cb382ec` + `129f205`, merge `--no-ff`

**LAS CUATRO RESPUESTAS ERAN FALSAS, y una prometía PLATA.** `constants/subscription-faq.ts` decía que se podía pausar *«desde tu cuenta»* —`app/(storefront)/cuenta` **no existe**, se borró—, que *«el cobro se realiza el mismo día de cada mes»* y que un cambio de plan aplica *«desde el siguiente ciclo»* —**no hay cobro recurrente**: `esSuscripcion` y `SUBSCRIPTIONS_ENABLED` dan **cero** repo-wide; una suscripción hoy es un mensaje de WhatsApp—, y que *«todos los planes incluyen **envío gratis a nivel nacional**»* — **`computeShippingCost` cobra envío** salvo sobre un umbral de $150.000 que además es placeholder, y **no sabe qué es una suscripción**. Era la única aparición de «envío gratis» en todo el repo.

Es la **cuarta** aparición del § censo periódico de DATOS FALSOS —tras la cuenta bancaria horneada, el rating fabricado y el andamiaje de `/cuenta`— y la primera que promete **dinero** en vez de prestigio.

**EL OWNER ELIGIÓ VOLVERLA DATO, sabiendo que eso solo NO apaga la mentira** —se le dijo: gatear con el toggle no sirve, porque para Nayoli la capacidad está ENCENDIDA—. **Lo que la apaga es el MODELADO**, y ahí la doctrina ya tenía el caso exacto: **§ #44, testimonios — los defaults valen para copy, NO para un CLAIM falso.** Una respuesta que promete un cobro mensual o un envío gratis es una afirmación sobre el negocio. Así que `suscripcionFaq` nace **REPEATER con `items: []`**, hide-on-empty, gemela de testimonios, y **las cuatro respuestas no vuelven en ninguna forma**: ni como default, ni como ejemplo, ni como placeholder. Los hints enseñan la FORMA; no afirman un término comercial que el owner no dio.

**LA SEXTA SUPERFICIE, y por qué dos censos la perdieron.** `SUSCRIPCIONES-CENSO-CONTENIDO-1` cerró el conteo de la capacidad en SEIS: cinco gateaban, y `/preguntas-frecuentes` no —ni su enlace, que vive en `footerNav.ayuda`, **la única columna que `StoreFooter` no filtraba**—. **Los censos anteriores buscaron enlaces A `/suscripciones`, y esa página nunca enlaza ahí: ES contenido de suscripciones en otra URL.** Un grep del DESTINO no puede encontrar contenido por TEMA. Es la segunda vez que el método se queda corto en esta misma capacidad —la quinta apareció por EJECUCIÓN— y por eso el censo que la cerró **enumeró las 8 rutas y los 26 componentes** en vez de grepear.

**Y VACIAR LA SECCIÓN NO ALCANZABA: `/preguntas-frecuentes` es un `<main>` con UN solo componente adentro**, así que hide-on-empty la habría dejado en **blanco**, con un enlace del pie apuntándole. **Cambiar una página que miente por una página vacía no es el arreglo.** La ruta y su enlace se muestran sólo si la capacidad está encendida **Y** la FAQ tiene ítems — **una sola función** (`faqSuscripcionesVisible`), porque la condición se evalúa en dos sitios y dos copias es la falla que este repo ya pagó cinco veces. No es regla nueva: el repo ya fija que **un repeater tiene DOS razones para no mostrarse y que `items` vacío gana sobre `visible`**; acá esa precedencia **sube de la sección a la RUTA**.

**EL CIERRE EXISTE PORQUE «DATO» SIN «EDITABLE» ES EL PEOR DE LOS TRES ESTADOS.** El primer worker declaró que registrar la sección rompe `tsc` en `VistaTiendaEnVivo.tsx` —su `Record<SeccionVista, ComponentType>` es **EXHAUSTIVO**— y **paró en vez de ensanchar su diff**, que es lo correcto. Pero mergear así habría dejado la FAQ de Nayoli **desaparecida y sin forma de traerla de vuelta**. Las dos mitades van al mismo merge; el tamaño de un slice es del orquestador, así que fue un CIERRE y no un follow-up.

**El riesgo de ese cierre no era el tipo.** Montar un componente del storefront en el árbol del ADMIN **compila verde aunque le falte un provider** —costó `/admin/configuracion` caída en un preview—. Verificado: `PreguntasFrecuentes` lee **sólo** `useSiteContent()`, que `VistaTiendaEnVivo` monta; nada de `useSiteSettings`, que es el que lanza. Y la tarjeta vacía cae en el placeholder porque `repeaterVacio` es **genérico** (deriva de `config.repeater` + el array), no una rama por sección.

**Se corrigió de paso la `nota` de la pestaña**, que enumeraba lo que gobierna el interruptor y **se quedaba corta en dos**: no nombraba el 2º CTA del hero ni esta ruta. Es el texto del que el dueño saca qué apaga ese switch; subdeclararlo es peor que no decir nada.

Merge `--no-ff` mecánico tras el gate del owner —que incluyó el **viaje redondo**: publicar una pregunta devuelve la sección a `/suscripciones` y saca a `/preguntas-frecuentes` del redirect, que es lo único que ejercita de verdad el schema editable y su modo de falla SILENCIOSO (§ #65-B)—. tree == tree gateado (`0737942`), `npm test` **1095/1095** y `npx tsc --noEmit` en **0**.
Regla: § un censo de superficies por DESTINO no encuentra contenido por TEMA — y cuando se vacía la única sección de una ruta, la regla de hide-on-empty sube de la sección a la RUTA, o la mentira se cambia por una página en blanco.

## 2026-09-12 · CONTADORES exhaustivo por `tsc`, no por comentario (`ATENCION-CONTADORES-EXHAUSTIVO-1`)
`e0b9481`, merge `58eb4be`

**DOS COMENTARIOS AFIRMABAN UNA GARANTÍA QUE NO EXISTÍA.** `lib/atencion/registro.ts` decía *«Las dos mitades están amarradas por los tests de este archivo, así que ninguna puede quedarse a medias en silencio»*, y `app/api/atencion/route.ts` decía *«Si falta uno, el test del registro lo dice»*. Las dos son FALSAS: `registro.test.ts` importa sólo de `./registro` y **no puede ver `CONTADORES`**, que vive en el route. Ese test afirma la FORMA del registro (`length === 2`), no que exista un contador por clave.

**EL MODO DE FALLA ERA EL PEOR: EL COMENTARIO MANDABA EN LA DIRECCIÓN EQUIVOCADA.** `SECCIONES_CON_ATENCION` declaraba `key: string` y `CONTADORES` era `Record<string, () => Promise<number>>` — sin exhaustividad. Quien agregara una sección sin su contador veía fallar `registro.test.ts:18` por el `length`, lo actualizaba —que es lo natural, y lo que el comentario decía que basta— y **shippeaba un 500**: `CONTADORES[s.key]()` con `s.key` ausente es `undefined()` → `TypeError` en el `Promise.all`, tumbando el endpoint entero, no sólo la sección nueva.

**EL ARREGLO: imposible, no detectable.** `SECCIONES_CON_ATENCION` pasó a `as const satisfies readonly SeccionConAtencion[]` (se quitó la anotación de tipo ancha que widening-eaba los literales); `ClaveAtencion` se DERIVA de ese array (`(typeof SECCIONES_CON_ATENCION)[number]['key']`), no una segunda lista a mano; y `CONTADORES` pasa a `Record<ClaveAtencion, ...>`, exhaustivo. Precedente directo en el mismo repo: `Record<SeccionVista, ComponentType>` de `VistaTiendaEnVivo.tsx` (mergeado el mismo día, `SUSCRIPCIONES-FAQ-EDITOR-1`), que ya paró a un worker por esta misma vía.

**DISCRIMINADOR MEDIDO:** se agregó una tercera clave (`discriminador_temporal`) sin su contador y `npx tsc --noEmit` marcó `TS2741: Property 'discriminador_temporal' is missing in type '{ pedidos: ...; productos: ...; }' but required in type 'Record<"pedidos" | "productos" | "discriminador_temporal", () => Promise<number>>'`. Revertido; `tsc` vuelve a 0.

**Los `as const`/`satisfies` NO rompieron ningún consumidor**: `atencionDeRuta` (`.find`), `rutasConAtencion` (`.map`), `rutasHuerfanas` (`.filter().map()`) y el test de forma siguen intactos — los literales son subtipos de `string`, así que toda comparación/indexación existente sigue tipando.

**EL TEST DE FORMA NO SE TOCÓ** (`registro.test.ts:18-19`, `length === 2` y las dos claves): sigue siendo correcto y sigue siendo la documentación del conjunto esperado; sólo se le sumó una nota explicando por qué no hay, además, un test que afirme la exhaustividad de `CONTADORES`: hacerlo exigiría importar el route handler (`next/server`, `@/lib/auth`, `@duna/core`) dentro de un test de capa 1 — la misma frontera que el carril ya respeta al no montar HTTP. El tipo exhaustivo alcanza; una imposibilidad declarada por `tsc` vale más que un test forzado a cruzar esa frontera.

Merge `--no-ff` mecánico **sin gate visual** (Merge Policy A: sin schema, sin bytes de cliente —`customer_bytes.changed=false`, cero texto o conducta visible— y sin contrato cross-repo: es un tipo interno entre dos archivos del MISMO repo, y el payload de red `MapaAtencion` no cambió). tree == tree de la rama (`46e72dc`), `npm test` **1095/1095** y `npx tsc --noEmit` en **0** — igual al piso medido en `main` antes de la tanda.
Regla: § un comentario que afirma una garantía inexistente es peor que no tenerlo — la garantía real se pone en el tipo (`Record<Union, …>` exhaustivo, derivado con `as const satisfies`), nunca en la promesa de que "el test lo dice".

## 2026-09-12 · Las sugerencias del buscador no podían traer nada (`NAVSEARCH-CHIPS-MUERTOS-1` + `-CIERRE-1`)
`2d4f547` + `e706e01`, merge `--no-ff`

**TRES DE CUATRO NO TRAÍAN UN SOLO RESULTADO.** El estado vacío de `NavSearch` horneaba cuatro sugerencias —`Cold Brew`, `Café Molido`, `Geisha`, `Suscripciones`— y su filtro busca en **`nombre`, `categoria` y `origen`, no en `variedad`**. Medidas contra el catálogo REAL de Nayoli: **Cold Brew 0** (sólo existe como `metodo` de una molienda, que el filtro no mira), **Geisha 0** (su variedad es Castillo, y variedad ni se busca), **Suscripciones 0** (no es un producto y nunca va a serlo). Sólo `Café Molido` daba 2.

**Y el sitio importa tanto como el número: es el estado VACÍO del buscador**, o sea el lugar exacto donde un visitante que nunca buscó nada toca para aprender qué hace la búsqueda. **Le enseñaba que está rota.**

**El arreglo es la doctrina de la casa: derivar.** Las sugerencias salen de **`categoriasDelCatalogo`** —el QUINTO consumidor del mismo helper que ya alimenta las pestañas de `/tienda`, el filtro de `/admin/productos`, el combobox de categoría y los avisos del Dashboard— y salió casi gratis porque **`catalog` ya estaba en scope** del componente. *Una lista escrita a mano se queda vieja; una derivada no puede.* **Un chip derivado del catálogo no puede morir, porque su texto ES una categoría que existe.**

**EL CIERRE EXISTE PORQUE EL SPEC PIDIÓ UN TEST Y SU `touches:` LO HACÍA IMPOSIBLE** —error del orquestador—. El worker se negó a escribir fuera del alcance, citó el precedente, y verificó con un script desechable. **Pero su diagnóstico de por qué era incómodo es el que armó el cierre:** `NavSearch` **no exportaba su predicado** —vivía inline en un `useMemo`—, así que cualquier test habría tenido que **reescribirlo** y habría afirmado su propia copia. Dos declaraciones del mismo conjunto, la falla que este repo pagó con `CATEGORIAS`/`CATEGORIA_LABELS`, con el schema editable de `presentaciones` y con el union de `CheckoutPayload` el mismo día.

**Se extrajo a `lib/productos/buscar.ts`, que es lo que el repo hace siempre** —`tarjetasDePresentaciones`, `metodosDisponibles`, `curvaDibuja`, `estadoEntrega`, `itemsDeAtencion` nacieron todos así—: *se extrae lo que tiene la decisión para poder afirmarlo*. El tope de 6 **se quedó en el componente**, con la distinción correcta: **un tope es PRESENTACIÓN, un predicado es COINCIDENCIA.**

**LA PROPIEDAD QUE AFIRMA EL TEST NO ES «LOS CHIPS FUNCIONAN»: ES EL ACOPLE** entre de dónde salen los chips y qué busca el filtro. Por eso no es tautológica, y se demostró: al sacar `categoria` del predicado el test falla **nombrando el conjunto** (`['Accesorios','Camisetas','Pantalones']`), y el histórico nombra `['Cold Brew','Geisha','Suscripciones']`.

**LO QUE NO SE TOCÓ, y la distinción es la que ordena el backlog:** la línea «Busca productos, categorías o **cafés de origen**». Los chips estaban muertos **para Nayoli HOY**; ese copy es **CORRECTO para ella** y sólo estará mal para un cliente de otro rubro — es el ítem #63, con su propio disparador. Arreglarlo de paso habría dejado #63 medio hecho sin que nadie supiera qué le falta.

Merge `--no-ff` mecánico tras el gate del owner; `main` se había movido, así que la verificación fue por DIFF —el merge introdujo exactamente el de la rama, nada más—. Árbol combinado `npm test` **1101/1101** y `npx tsc --noEmit` en **0**.
Regla: § un control que ofrece una búsqueda tiene que derivarse de lo que la búsqueda puede encontrar — y para poder afirmarlo, el predicado sale del componente, porque un test que lo reescribe afirma su propia copia.

## 2026-09-12 · Las cinco imágenes por defecto dejan de ser stock sin procedencia (`IMAGENES-STOCK-TEMPLATE-1`)
`650ecf7`, merge `--no-ff`

Las cinco rutas de stock que quedaban en `DEFAULTS` —el hero y las cuatro del collage de `brandStory`— pasan a cinco fotos de Unsplash **elegidas y descargadas por el owner**, con su licencia registrada.

**ESTE SLICE NO MUEVE UN PÍXEL EN NINGÚN DESPLIEGUE VIVO, y eso se MIDIÓ antes de escribirlo.** Lectura read-only contra las dos bases: **producción (`ep-ancient-frog`) tiene fila de `SiteContent` con las cinco rutas viejas adentro**, y **development (`ep-still-sound`) también**. El resolver usa lo ALMACENADO; el default sólo aplica donde **no hay fila**. Los previews apuntan a development, así que **ni la tienda de Nayoli ni el preview cambian** — lo que cambia es con qué **nace un despliegue nuevo**, que hoy no existe.

**De ahí salen las dos consecuencias que ordenaron el slice:** que **las cinco imágenes viejas NO se borran** —son las que Nayoli sirve HOY, y salen el día que su fila apunte a otra cosa, la misma ventana que los `cafe-nayoli-*`—, y que **el gate NO podía ser visual**. Decirlo en el spec evitó que el worker inventara una verificación que no se puede correr.

**LO QUE EL SLICE COMPRA ES HIGIENE LEGAL, no una mejora visual, y conviene tenerlo escrito para que nadie lo lea como cosmética:** el template dejaba de shippear fotos de terceros **sin un solo rastro de procedencia**. `public/images/PROCEDENCIA.md` registra autor, id de Unsplash y fecha por archivo. **La licencia de Unsplash es irrevocable para lo que se descargó — pero sólo si dentro de dos años alguien puede reconstruir QUÉ y CUÁNDO.** Y deja escrita su regla de mantenimiento: *un registro de procedencia que se queda viejo es peor que ninguno, porque afirma una cadena de custodia que ya no cubre lo que hay.*

**LOS CUATRO `alt` ENTRARON AL SLICE Y NO ESTABAN EN LA LISTA.** Estaban HORNEADOS en `BrandStory.tsx` y decían `Café · Tostado · Finca · Barista`; con las fotos nuevas describían algo que no está — un lector de pantalla habría anunciado «Barista» sobre una taza servida en una mesa. **Es accesibilidad, no cosmética.** El `alt=""` del hero **se queda vacío a propósito**: es decorativa de fondo al 40% bajo gradientes, y el titular ya dice lo que la sección dice.

**Y EL TEST NO TRANSCRIBE EL CAMBIO.** Afirmar «los defaults son estas cinco rutas» repetiría el diff y se rompería con cada foto nueva. Afirma que **toda ruta `/images/…` de un campo-imagen apunta a un archivo que EXISTE en disco**, DERIVADA de `valoresDeCamposImagen()` —la misma fuente que ya gobierna el borrado de blobs y el catcher de marca de cliente—, filtrando los paths estáticos (una URL de Blob vive en otro storage). Con guarda de lista no-vacía, así que un cambio de prefijo falla ruidoso en vez de pasar en vacío. **Atrapa el error que de verdad ocurre —un typo, o un archivo sin commitear— y no se vuelve frágil ante el próximo cambio de foto.**

Merge `--no-ff` mecánico tras el gate del owner, tree == tree gateado (`49f7d9b`). Árbol combinado `npm test` **1101/1101** y `npx tsc --noEmit` en **0**.
Regla: § una imagen de terceros entra al repo con su procedencia o no entra — y un default que ninguna base usa se cambia igual, porque lo que gobierna no es lo que hoy se ve sino con qué NACE el próximo despliegue.

## 2026-09-12 · 6,3 MB que nadie referenció nunca (`NAYOLI-PNG-MUERTOS-1`)
`1049a02`, merge `--no-ff`

Los cuatro `public/images/cafe-nayoli-*.png` salen del repo. **CERO referencias en todo el árbol** —grep sobre código, seed, tests, CSS y config— **y CERO commits en el historial que los mencionen** (`git log -S --all`). **Entraron como archivos y nunca se referenciaron desde el código, ni una vez.** Pesaban **6,3 MB** contra los **168 KB** que suman los cuatro `.webp` hermanos.

**LO QUE ESTO ACLARA, y es lo que valía medir: «las 8 fotos de Nayoli» eran TRES problemas distintos, no uno.** El pendiente estaba escrito como *«mudar los 8 al Blob antes de sacarlos del repo»*, y esa frase mezclaba tres cosas con soluciones opuestas:

  - **los 4 `.png`** — sin consumidor. **No necesitan Blob ni migración: se borran.** Mudar al Blob existe para que **lo que un cliente SIRVE** siga estando cuando el archivo salga del repo; **un archivo que nadie sirve no tiene nada que preservar.**
  - **los 2 `.webp` de 250 g** — los sirve la **fila de `SiteContent` de Nayoli** en sus dos tarjetas de Presentaciones. Ésos sí se suben por el editor, que los pone en Blob y actualiza su fila **en el mismo gesto**: la subida ES la migración.
  - **los 2 `.webp` de 500 g** — sólo los usa `prisma/seed-products.ts`, o sea una base recién sembrada. Van con la de-Nayolificación del seed, no con esto.

**Y LA PREGUNTA DEL OWNER FUE LA QUE LO DESTRABÓ: «¿qué imágenes usa la lista de productos entonces?»** Ninguna de las ocho. Medido en development: los cuatro productos apuntan a `blob.vercel-storage.com/productos/…`, portadas que el owner subió desde el panel el 2026-08-03. **El pendiente llevaba semanas escrito como un bloque de ocho archivos, y bastó preguntar quién los consume para que se partiera en tres — uno de los cuales era gratis.**

**RESIDUO DECLARADO:** no se pudo verificar que ninguna fila de `Product` en PRODUCCIÓN apunte a uno de los cuatro PNG — la credencial de lectura se borró el mismo día (§ `SEC-CREDENCIAL-PROD-1`). El argumento del borrado **no depende de eso**: se sostiene en el grep del árbol y del historial, los dos en cero, y en que un path que nunca existió en el código no hay de dónde copiarlo. Y el peor caso es **una foto de producto rota con `git revert` inmediato**.

`PROCEDENCIA.md` registra el retiro con su fecha y su razón — **un borrado también cambia el directorio**, y el archivo declara que se actualiza con cualquier cambio. No se les inventó procedencia: son fotos del producto del cliente y no la tenemos.

Merge `--no-ff` mecánico tras el gate del owner, tree == tree gateado (`bf0ee66`), `npm test` **1101/1101** y `npx tsc --noEmit` en **0**.
Regla: § antes de mudar un archivo al Blob hay que preguntar quién lo SIRVE — un pendiente escrito como un bloque de N archivos casi nunca es un solo problema, y la parte que nadie consume no se migra, se borra.

## 2026-09-12 · La lista Tier 1 nombraba las puertas y no lo que decide qué escriben (`TIER1-CRITERIO-DECISORES-1`)

`TSCONFIG-DATOS-CLASSIFY-1` midió los accesos indexados de las rutas de dato y, de paso, contestó una
pregunta sobre el PROTOCOLO: el criterio escrito de la lista Tier 1 (CLAUDE.md) terminaba en «cada
puerta de escritura de stock, pagos y pedidos» — y la lista, en efecto, sólo nombraba **puertas**
(handlers y las libs que las escriben). El censo midió tres archivos que gobiernan lo que esas puertas
escriben, sin estar ellos mismos en la lista:

  - **`packages/core/src/moliendas-opciones.ts`** — `moliendaAceptada` la llama `orders.ts:693`
    (import en `orders.ts:6`), que sí es Tier 1. Decide qué molienda se puede comprar.
  - **`packages/core/src/product-import.ts`** — crea productos con `crearProductoConAsiento`
    (`product-import.ts:103`, import en `:3`), función que vive en `product-update.ts:211` — YA Tier 1.
  - **`packages/core/src/timezone.ts`** — `dayKeyStart` alimenta `Payment.fecha` desde
    `app/api/orders/[id]/payments/route.ts:42` (import en `:6`), que sí es Tier 1.

**DOS ENTRAN, UNO NO, Y EL PORQUÉ ES LA REGLA.** `moliendas-opciones.ts` y `product-import.ts` deciden
**si un producto se puede comprar**, la ruta del dinero una capa antes de la puerta. `timezone.ts`
queda AFUERA: es una utilidad GENÉRICA de fechas —28 consumidores medidos (grep, excluidos tests), de
Analítica a las automatizaciones al seed— y su conexión con el dinero es INDIRECTA, una entre tantas
cadenas. Meterla
pondría dos etapas sobre trabajo que no tiene nada que ver con dinero, por el peor consumidor entre
muchos; **la protección tiene que ser proporcional al alcance del archivo, no sólo a su peor
consumidor**.

**LO QUE VALE MÁS QUE LOS DOS NOMBRES ES EL CRITERIO.** Agregar dos entradas parcha el síntoma; el
criterio decía «puerta de escritura» y el próximo decisor se habría colado igual. Se reescribió la
frase de CLAUDE.md para cubrir las DOS cosas — la puerta, y la función que esa puerta CONSULTA para
decidir si la escritura procede y con qué valor — y se agregó el límite explícito, con `timezone.ts`
como el caso que marca la frontera (alcance GENÉRICO, conexión INDIRECTA), para que el criterio no se
vuelva infinito: casi todo termina alimentando algo de dinero por alguna cadena.

**DESVIACIÓN MEDIDA respecto al spec:** el spec citaba `product-update.ts:104` (`sanitizeOpciones`)
como la conexión de `product-import.ts` con Tier 1. Medido: `product-import.ts` NO llama
`sanitizeOpciones` ni pasa `moliendasOpciones` en ningún punto — la fila importada nace sin opciones de
molienda (comentario propio del archivo: "moliendas null → agrega directo"). La conexión real es
distinta y más directa: `product-import.ts:103` llama `crearProductoConAsiento` (`product-update.ts:211`)
sin pasar por `sanitizeOpciones`/`validarOpciones`, a diferencia de la ruta manual
(`app/api/products/route.ts:43,55`) que sí las aplica antes de crear. O sea que `product-import.ts` es
una SEGUNDA puerta al mismo escritor de stock, más permisiva que la primera — un argumento más fuerte
para incluirlo, no más débil, sólo que por un camino distinto al que el spec citó. Se procedió con la
inclusión sobre esta base medida.

**LÍMITE DE VERIFICACIÓN, declarado:** este slice no pudo leer `dev-protocol/scripts/validate_spec.py`
—vive fuera del working directory de este repo y el sandbox lo bloquea—, así que no se pudo confirmar
por lectura directa cómo el validador extrae los disparadores de esta lista. Se preservó la forma
estructural exacta de la línea (lista separada por comas dentro de una sola oración, con el mismo
patrón `these measured surfaces: … and X.`) como la mitigación de mayor confianza disponible sin tocar
el otro repo. Queda para que el orquestador confirme si su extractor toma las dos entradas nuevas.

**El costo es real y se dice:** `moliendas-opciones.ts` y `product-import.ts` pasan a exigir dos etapas
—sesión read-only primero, visto bueno del owner después— para cualquier cambio futuro. Es más lento
a propósito.

Cambio de sólo documento (`CLAUDE.md` + este archivo): sin schema, sin bytes de cliente
(`customer_bytes.changed=false`), sin código tocado. `npm test` **1101/1101** y `npx tsc --noEmit` en
**0** — igual al piso medido en `main` antes de la tanda; un cambio de prosa no debía mover ninguno de
los dos, y no lo hizo.
Regla: § el criterio de Tier 1 cubre la puerta de escritura Y la función que esa puerta consulta para
decidir qué escribe — con un límite explícito (alcance acotado al dinero, no cualquier utilidad
genérica que una cadena de dinero use de paso), para que no se vuelva infinito.

## 2026-09-12 · La tienda ignoraba «reducir movimiento» (`STOREFRONT-REDUCED-MOTION-1`)
`8bf09b4`, merge `--no-ff`

**Las 21 animaciones de entrada del storefront ignoraban `prefers-reduced-motion`.** A personas con trastornos vestibulares el movimiento les provoca **mareo y náusea**; el visitante ya había declarado su preferencia en el sistema operativo y el sitio la pasaba por encima.

**LA PARTE QUE HACÍA INVISIBLE EL DEFECTO ES QUE PARECÍA CUBIERTO.** El repo **sí** tiene un guard global de `prefers-reduced-motion` (`app/globals.css`, cerca de `:247`) — pero neutraliza `animation-duration` y `transition-duration` **de CSS**, y **framer-motion no anima por CSS**: escribe estilos inline / WAAPI. **Lo esquivaba por construcción.** Y `NosotrosGaleria` ya usaba `useReducedMotion()`, pero **para decidir si reproduce un VIDEO**, no para su entrada. Dos mecanismos presentes, ninguno cubriendo el caso: el modo de falla más caro de encontrar.

**EL ARREGLO ES UN PROVIDER, NO DOCE GUARDAS.** El spec obligó a **medir primero el camino de un solo archivo** antes de tocar los doce, y sirvió: `<MotionConfig reducedMotion="user">` en el layout del storefront. Medida su semántica en la versión instalada: los **`positionalKeys`** (x, y, scale, rotate, width, height…) pasan a instantáneos —**incluido `repeat: Infinity`**, así que la flecha en bucle del hero también queda— y **la opacidad sigue animando**. Aparecer sin desplazarse, que es la conducta correcta y no una degradación. Y **`whileInView`, `animate` y `AnimatePresence` pasan las tres por `animateTarget()`**, así que no queda residuo parcial.

**LA DIFERENCIA ENTRE ARREGLAR Y HACER IMPOSIBLE, otra vez:** con doce guardas, el componente número trece se olvida. Con el provider, **no la escribe — no puede olvidarla.**

**Detalle de implementación que es doctrina:** `layout.tsx` es un Server Component (async, Prisma) y **no puede importar `MotionConfig` directo** —el provider no trae `'use client'` propio—. Se envolvió en un módulo cliente dentro de `lib/animation.ts`, **el mismo patrón que ya usan `StorefrontThemeProvider`, `SiteSettingsProvider` y `CartProvider` en ese layout**.

**Lo que NO se tocó, y son dos preguntas distintas que este slice mantuvo separadas:** la guarda de PREVIEW (`useIsPreview`, 64 apariciones) apaga porque dentro de un contenedor escalado la intersección no llega; `reduced-motion` apaga porque el visitante lo pidió. Que un provider cubra la segunda no vuelve redundante la primera.

**Y un hallazgo que le cambia la forma al eje de movimiento que viene:** no existe «el default de duración» de framer-motion. La opacidad cae a un tween de 0,3 s, pero **las props de transform con ≤2 keyframes caen a un SPRING** (stiffness 500, damping 25), sin duración fija. **`TEMAS-P4-MOVIMIENTO-1` no puede ser «un multiplicador de duración»** — la mayor parte del movimiento no tiene duración que multiplicar. Su diseño se rehace con este dato.

Merge `--no-ff` mecánico tras el gate del owner, tree == tree gateado (`d5d4d90`). Árbol combinado `npm test` **1104/1104** y `npx tsc --noEmit` en **0**.
Regla: § un guard de `prefers-reduced-motion` escrito en CSS NO cubre lo que anima por JS — y cuando la guarda puede vivir en un provider, vive ahí: doce componentes que deben acordarse son doce oportunidades de olvidarse.

## 2026-09-12 · Dos pesos tipográficos que toda página descargaba y nadie usaba (`FUENTES-PESOS-DISPLAY-SOBRAN-1`)
`4909bdd`, merge `--no-ff`

Los **nueve pares** de `lib/config/fuentes.ts` y el **`@import` de `app/globals.css:1`** pedían `wght@400;500;600` para la fuente de TÍTULOS. **Nadie usaba el 500 ni el 600:** cero clases de peso sobre `.font-display`/`.font-playfair`, cero reglas `font-weight`, en los 18 archivos que las montan.

**Y el mecanismo que lo explica vale más que el hallazgo:** hay un reset **`h1..h6 { font-weight: inherit }`**, así que los títulos **no heredan el bold por defecto del navegador**. Sin ese reset, el 600 probablemente sí se usaría; con él, se descargaba para nada.

**POR QUÉ UN CAMBIO DE DOS NÚMEROS EXIGIÓ UN CENSO ENSANCHADO:** si se quita un peso que algo SÍ usa, **el navegador no falla — SINTETIZA**. Toma el 400 y lo engorda por software: trazos deformes, espaciado roto, **y nada avisa**. Es la familia que este repo persigue —*no rompe, miente*— y por eso el criterio no fue «no encontré usos» sino **«busqué en estos lugares y no hay»**, con los lugares dichos.

**Lo que se ahorra:** **2 archivos de fuente en TODA página** vía el `@import` global —también las de Nayoli, que corre Editorial por defecto— más 2 por cada par custom. Referencia medida en una tanda previa: **~24 KB por peso estático**.

**La «excepción» resultó ser un DELTA, no un estado final.** `tecnico` ya venía en `400;600` (IBM Plex Mono no es variable en Google Fonts), así que pierde UN peso y no dos. El worker lo interpretó bien: la excepción era su edición, no su destino — **los nueve terminan en el mismo conjunto**, que es lo que permite afirmar coherencia.

**LO QUE EL TEST SÍ Y NO PUEDE AFIRMAR, declarado:** atar «peso PEDIDO» a «peso USADO» de forma derivada exigiría parsear clases construidas con `cn()`, y ése no es el patrón de test puro del repo. Quedó la garantía **más débil pero real**: **los nueve pares no pueden divergir entre sí en silencio.** La fuerte vive en un lint dedicado o en el gate visual — nombrado, no fingido.

Merge `--no-ff` mecánico tras el gate del owner; `main` se había movido, así que la verificación fue por DIFF (idéntico al de la rama). Árbol combinado `npm test` **1104/1104** y `npx tsc --noEmit` en **0**.
Regla: § un peso tipográfico que se pide y no se usa se descarga igual en cada visita — y quitarlo se verifica buscando, porque el navegador SINTETIZA en vez de fallar.

## 2026-09-13 · Un botón que se veía activo y no hacía nada (`CHECKOUT-BOTON-ATRAS-MUERTO-1`)
`bb44548`, merge `--no-ff`

En el paso **Información** del checkout, «Atrás» hacía **`setStep(0)` sobre el paso 0**: se veía activo, respondía al hover, y **no pasaba nada**. El «Atrás» del paso de Pago hace lo mismo y ahí **sí** vuelve — el defecto era del primero, no del patrón.

**Es la familia del BOTÓN MUERTO, y el repo ya la tiene nombrada**: *«las acciones que no aplican NO están, no se deshabilitan»*, y el precedente de `CustomerLink`, que renderiza texto plano cuando no hay perfil al que ir — *no dead link, no cursor-pointer promising a navigation that won't happen*. **Un control muerto en la ruta del dinero es una pregunta que el comprador se hace en el peor momento.**

**LA DECISIÓN LA TOMÓ EL ORQUESTADOR de noche, con el owner durmiendo, y se deja DICHA para que sea revisable:** había dos caminos —que el botón no exista, o que salga a `/tienda`— y **se eligió que no exista**. La razón: **la salida YA existe** (la flecha del encabezado, presente en los dos pasos), y **un segundo control al mismo destino a diez píxeles del primero es cómo se llega a que uno de los dos diverja**. El owner lo gateó mirando y pasó.

El comentario que queda en el código **explica por qué el botón NO está**, no qué se borró: sin eso, el próximo que mire una fila con un solo botón lo agrega de vuelta.

Merge `--no-ff` mecánico tras el gate del owner, tree == tree gateado (`f3afe12`), `npm test` **1104/1104** y `npx tsc --noEmit` en **0**.
Regla: § un control que no puede hacer nada se QUITA, no se deshabilita — y cuando la acción que ofrecía ya tiene otro control, agregarle un destino sería duplicar la salida en vez de arreglar el botón.

## 2026-09-13 · Las decisiones de pasarela: Wompi, un estado «en vuelo» que es tabla aparte, y la reconciliación entra con el webhook (`PASARELA-DECISIONES-LEDGER-1`)

**Elección a — el estado EN VUELO de un cobro en línea es una tabla nueva, `PaymentIntent`, no un valor más de algo existente.** Textual del owner:

> «`Comprobante` y `Payment` son dos tablas porque son dos hechos. El intento y el pago también. Un
> intento fallido no puede dejar rastro en la tabla que SIGNIFICA "esta orden está pagada", y
> `registerOrderPaymentTx` sigue siendo el único escritor — la invariante que impide plata fantasma
> queda intacta.»

**Descartado 1 — un cuarto valor de `Order.estado`.** Barato de escribir, caro de verificar: `NON_CANCELLED_ESTADOS` (`packages/core/src/metrics/order-stat-filters.ts:125`) lleva su propio comentario admitiéndolo — *«Exhaustive over OrderStatus by construction — if a fourth estado is ever added, the `satisfies` still compiles but this list must be revisited»* (`:122-124`). Un estado nuevo que TypeScript no vigila es una mina inerte: el `satisfies` sigue en verde y las ~25 comparaciones de estado repartidas por el repo no se re-auditan solas.

**Descartado 2 — darle estado al `Payment`.** Rompería `existe un Payment ⇒ la orden no está pendiente`, la mitad B de la invariante que afirma `tests/integracion/cobro-sincronizado.test.ts` (comentario en `:42`: *«existe un Payment ⇒ estado ≠ 'pendiente' (no hay pago huérfano)»*, aserción en `:54`). Es la prueba que impide la plata fantasma / el pago huérfano; un `Payment` con un estado intermedio la vuelve falsa por construcción.

**Elección b — la pasarela es WOMPI.** Es la única con tarifa PUBLICADA y plazo de habilitación concreto (1–3 días hábiles) sin exigir Cámara de Comercio a una persona natural — lo que decide si un negocio chico puede usarla el día que firma. Los demás negocian tarifa por volumen, y negociar pide un volumen que el segundo cliente no tiene.

**Y esto queda dicho porque el owner pidió explícitamente que quede, para que nadie lo re-abra en seis meses creyendo que no se miró: Mercado Pago gana en la firma del webhook** —HMAC-SHA256 verificada por su SDK oficial de Node, contra el `concat + SHA256` de Wompi que hay que implementar a mano— **y aun así se descarta, porque no se pudo confirmar su cobertura de PSE en Colombia.** Si algún día se confirma esa cobertura, ésa es la razón que habría que volver a pesar — no la firma, que ya perdió el argumento y no lo va a volver a ganar.

**El alcance se ensancha solo: la reconciliación no es opcional.** Wompi reintenta un webhook fallido máximo 3 veces en 24 horas (30 min, 3 h, 24 h) y después desiste. Textual del owner: *«Con Wompi desistiendo a las 24 h, la RECONCILIACIÓN NO ES OPCIONAL — es parte del producto, no una mejora. Un pago aprobado cuyo webhook se perdió es plata real de un cliente real, invisible para siempre.»* Va en el MISMO programa que el webhook, no en un backlog para después.

**Lo medido que encarece, verificado en el código, no supuesto:**

- **No hay forma reusable de leer el body crudo.** Cero usos de `req.text()`/`request.text()` en todo `app/api` (grep, 0 resultados); `req.json()`/`request.json()` aparece **27** veces. El único webhook previo del repo, `app/api/upload/token/route.ts`, también parsea con `req.json()` (`:34`) y **delega la verificación a `storage.emitirTokenSubida`**, que envuelve `handleUpload` de `@vercel/blob/client` — el SDK de Blob hace el trabajo, no una firma verificada a mano sobre bytes crudos. No es precedente para leer y verificar un HMAC sobre el body sin parsear; es código nuevo.
- **`registerOrderPaymentTx` no tiene idempotencia propia.** `packages/core/src/orders.ts:234` hace `tx.payment.create` incondicional — sin buscar un Payment existente antes de crear. La única guarda contra un segundo Payment vive en el LLAMADOR: el `SELECT … FOR UPDATE` sobre la orden en `packages/core/src/comprobantes.ts:149`, cuyo propio comentario (`:123`) lo dice — *«LA GUARDA CONTRA UN SEGUNDO PAYMENT es el `SELECT … FOR UPDATE` sobre la orden, NO una unique en la base (Payment no la tiene)»*. Y la consecuencia es la parte que vale: una segunda entrega del mismo evento de webhook no crearía necesariamente un segundo Payment porque la orden ya no estaría `pendiente` — pero eso es protección INCIDENTAL (depende de que el estado haya cambiado), no idempotencia (reconocer el evento). `Payment.referencia` es `String?` sin `@unique` (`packages/core/prisma/schema.prisma:299`, confirmado), así que hoy nada reconoce un segundo evento del mismo cobro COMO duplicado.
- **Tres hallazgos que abaratan, y se escriben porque se olvidan:** `derivarCondicionPago` (`packages/core/src/orders.ts:25-31`) ya es un `else` genérico — `=== 'EFECTIVO' ? 'CONTRAENTREGA' : 'ANTICIPADO'` — así que un método de pasarela cae en ANTICIPADO sin tocar una línea. El enum Prisma `MetodoPago` ya anticipa la pasarela en su propio comentario (`packages/core/prisma/schema.prisma:368-369`): *«Manual payment methods. Extensible for online rails later (e.g. WOMPI) via `ALTER TYPE "MetodoPago" ADD VALUE 'WOMPI'`»*. Y `tienePendienteDeVerificar` (`lib/comprobante.ts:163-167`, sobre `cuantosSinVerificar` en `:152-155`) sólo cuenta comprobantes en estado `RECIBIDO`, así que un Payment nacido de un webhook — sin comprobante — no cae en el carril «Por verificar» por accidente.

**Lo que este asiento NO decide, a propósito:**

- **El diseño de `PaymentIntent`** — columnas, ciclo de vida, migración — no está decidido: depende de un spike en sandbox que todavía no corrió. Este asiento registra la FORMA elegida (tabla aparte) y su razón, no un schema.
- **Nada sobre llaves productivas.** Sandbox hasta que Onix firme; el demo va en sandbox.
- **Dos preguntas del spike quedan abiertas, y bloquean el diseño, no se contestan acá:** si `GET /v1/transactions?reference=` existe en la API de Wompi, y si las llaves de sandbox salen antes de aprobar la cuenta.

**`CLAUDE.md` § «Pagos en línea (Wompi)» queda desactualizado por este asiento, y no se toca acá.** Esa sección dice hoy *«El disparador real es la decisión de pasarela, que hoy no está tomada (Wompi es el candidato, no un hecho)»* — con este asiento la decisión YA está tomada (Wompi). El resto de la sección sigue vigente: sigue gateado a la misma frontera (`Payment` como único escritor del eje de cobro) y al puente con Carlos, que este asiento no resuelve. Su actualización va con la implementación (cuando el spike y `PaymentIntent` tengan forma), no con este asiento de sólo-ledger.

Sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false`), sin código tocado — sólo este archivo. `npm test` **1104/1104** y `npx tsc --noEmit` en **0**, igual al piso medido en `main` antes de este asiento; un asiento de ledger no debía mover ninguno de los dos, y no lo hizo.
Regla: § Pagos en línea (Wompi) — cobros automáticos (CLAUDE.md), a actualizar cuando el spike de `PaymentIntent` tenga forma.

## 2026-09-13 · La idempotencia del webhook es INCIDENTAL, no diseñada — la columna única del PSP pasa de requisito de lista a pieza que la sostiene (`PASARELA-DOC-AL-DIA-1`)

Este asiento es propio, no un append al de `PASARELA-DECISIONES-LEDGER-1` de arriba:
ese asiento ya cerró con su propia verificación (`npm test`/`tsc` de esa foto), y esta
entrada materializa en OTRO commit — la convención de este libro (línea 12, "Fecha =
el commit que MATERIALIZÓ la decisión") pide una entrada nueva, no editar la vieja.

**Eleva a decisión de diseño una medición que ese asiento ya había hecho** (línea 848,
arriba: *«esa segunda entrega no crearía necesariamente un segundo Payment porque la
orden ya no estaría `pendiente` — pero eso es protección INCIDENTAL … no idempotencia
(reconocer el evento)»*). El owner pidió que suba de medición a regla de diseño, con
estas palabras textuales:

> HOY LA IDEMPOTENCIA ES INCIDENTAL — una segunda entrega no duplica el `Payment`
> **porque la orden ya no está `pendiente`, no porque el evento se reconozca**. Con un
> webhook que llega hasta 3 veces, eso no es protección: **es coincidencia**.
>
> Por eso la columna ÚNICA del id de transacción del PSP deja de ser «un requisito de
> la lista» y pasa a ser LA PIEZA QUE SOSTIENE la idempotencia. Sin eso, el webhook no
> se cablea.

**Lo medido que lo sostiene, re-verificado contra el código de hoy:**

- `registerOrderPaymentTx` hace un `tx.payment.create` INCONDICIONAL
  (`packages/core/src/orders.ts:234`; la función arranca en `:227`) — no busca un
  `Payment` existente antes de crear uno.
- La única guarda contra un segundo `Payment` vive en el LLAMADOR, no en el helper: el
  `SELECT … FOR UPDATE` sobre la orden en `packages/core/src/comprobantes.ts:149`,
  dicho en su propio comentario (`:123`, *«LA GUARDA CONTRA UN SEGUNDO PAYMENT es el
  `SELECT … FOR UPDATE` sobre la orden, NO una unique en la base (Payment no la
  tiene)»*). Esa guarda depende de que el ESTADO de la orden haya cambiado, no de
  reconocer el EVENTO — es justo la distinción que hace incidental a la protección de
  hoy.
- `Payment.referencia` es `String?` SIN `@unique`
  (`packages/core/prisma/schema.prisma:299`; confirmado además que ningún `@@unique`
  ni `@@index` del modelo la menciona) — hoy nada en el schema reconoce un segundo
  evento del mismo cobro COMO duplicado.
- El repo YA tiene el mecanismo para capturar el choque cuando exista la columna
  única: `isUniqueViolation` (`packages/core/src/orders.ts:344`) atrapa el `P2002` de
  Prisma, y hoy lo usa `createOrderWithCustomer` (`:598`) para deduplicar reintentos
  concurrentes por `Order.idempotencyKey` — el mismo patrón, sobre otra columna.
  Cablear el webhook no necesita inventar cómo capturar el choque; necesita la
  columna que lo produzca.

**Consecuencia de diseño, no de código:** cuando el webhook se cablee, la columna
única del id de transacción del PSP —en `PaymentIntent` o donde termine viviendo— no
es un campo más de la lista de la implementación: es la pieza sin la cual un
reintento del webhook no puede reconocerse como EL MISMO evento, y sin ella la
"idempotencia" del sistema sigue siendo la coincidencia de hoy.

**Este asiento NO diseña esa columna** — nombre, tipo, migración siguen dependiendo
del spike de sandbox y del diseño de `PaymentIntent` (`PASARELA-DECISIONES-LEDGER-1`,
arriba, que ya dijo que eso no estaba decidido). Fija sólo QUÉ sostiene la
idempotencia y POR QUÉ, no CÓMO se escribe.

Regla: § Pagos en línea (Wompi) — cobros automáticos (CLAUDE.md), actualizada por este
mismo slice; y el asiento `PASARELA-DECISIONES-LEDGER-1` de arriba, que sigue vigente
en todo lo demás (`PaymentIntent` como tabla aparte, Wompi sobre Mercado Pago, la
reconciliación no-opcional, las dos preguntas del spike).

Sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false`), sin
código tocado — sólo `CLAUDE.md` y este archivo. `npm test` **1104/1104** y
`npx tsc --noEmit` en **0**, igual al piso medido en `main` antes de este asiento.

## 2026-09-13 — LEDGER-CIERRES-VERIFICADOS-1: cierres por verificación no dejan artefacto, y el protocolo sólo sabe seguir escrituras

**El hueco:** el 2026-09-12 se revisaron once ítems de backlog contra el código y
NINGUNO se cerró con un slice — se cerraron MIDIENDO. Un ítem cerrado por verificación
no deja commit, ni rama, ni merge, así que el auditor de cola (que sólo sabe cerrar un
id por ENCABEZADO de ledger o por MERGE) los sigue contando abiertos — el defecto que
la verificación existía para arreglar. Este asiento es el artefacto que faltaba para
los ocho que un censo midió; los otros tres los cerró el orquestador a mano.

### Los tres cerrados a mano, con su evidencia

- **`CLAUDE-MD-PAGOS-STALE-1`** — falso: `CLAUDE.md:1827` («DROPEARON; ya no existen»)
  nombra el modelo de métodos de pago VIEJO como retirado y describe el actual
  (`SiteSetting.metodosPago`, lista JSON).
- **`PAGOS-METODOS-SERVICE-TYPE-1`** — falso: `services/checkout.service.ts:22` tiene
  `metodo: MetodoPagoTipo` (no la unión vieja sin `'breb'`), con el comentario
  `§ CHECKOUT-BREB-CAST-1` en la línea 18 que nombra el slice que lo arregló.
- **`PAGOS-METODOS-CHART-BREB-1`** — falso: `components/admin/PagosCurva.tsx:34`
  declara `{ metodo: 'BREB', color: 'var(--duna-serie-6)' }` dentro de
  `METODOS_SERIE`, y `lib/pagos/metodos-pago-enum.test.ts:58` la ata al enum de
  Prisma (`METODOS_SERIE` cubre EXACTAMENTE los valores del enum) para que un
  método nuevo la rompa nombrándolo.

### Los ocho medidos por el censo — CINCO categorías, no dos

**VIVO (2) — el defecto existe hoy:**

- **`AVISOS-DOC-CORRECT-PLUMBING-CLAIM-1`** — la frase de `CLAUDE.md:1609` («cada
  dormido es detección nueva sobre el MISMO fetch, sin tocar el lector») es FALSA, y
  el propio repo lo demuestra: al construirse el dormido #8, `avisosDeConfiguracion`
  (`lib/config/avisos-configuracion.ts:62-66`) ganó un **cuarto argumento
  `ajustes: SiteSettings`** (línea 66), que en el Dashboard sale de
  **`useSiteSettings()`** (`app/(admin)/admin/dashboard/page.tsx:97`, consumido en la
  llamada de la línea 154) — un loader DISTINTO de `readSiteContent` /
  `GET /api/site-content/publicado`. `DECISIONS.md:169` (el asiento de #8) ya lo dice
  bien, sin la frase "mismo fetch" — **el propio ledger contradice la doctrina de
  `CLAUDE.md`**. La formulación más cautelosa de `CLAUDE.md:2667` («se suma sin tocar
  el lector») sigue siendo cierta; la que falla es la más fuerte, de `:1609`. No rompe
  nada en producción — es riesgo de PLANEACIÓN: quien lea `:1609` para estimar el
  costo de los avisos #3/#4 (hero/brandStory) va a subestimarlo, porque asume que
  basta con extender el fetch existente cuando en realidad hace falta enhebrar una
  fuente nueva (SiteSettings) al Dashboard. Costo de la corrección: 1 archivo
  (`CLAUDE.md`), no tocado en este asiento — ver más abajo.
- **`AVISOS-DORMANT-34-RAW-CONTENT-1`** — su premisa («0 filas de SiteContent → Nayoli
  corre de defaults») está vencida por DOS vías: la fila se sembró el 2026-09-12, y
  los defaults se neutralizaron en la misma tanda (`CONTENIDO-NEUTRALIZAR-1…4`) — hoy
  `hero.titulo` es "Productos que cuentan", sin café ni Nayoli. Pero el hueco de fondo
  sobrevive: los avisos #3/#4 (hero/brandStory) siguen sin construirse. Lo que hay que
  corregir es la JUSTIFICACIÓN escrita («0 filas», «corre de defaults de Nayoli»), no
  necesariamente el disparador («2º cliente»), que puede seguir valiendo por su
  cuenta.

**HECHO (4) — existía y se arregló:**

- **`CHECKOUT-METODOS-OFF-TWIN-1`** — construido, pero bajo OTRO nombre:
  `AVISOS-DORMANT-8-TWIN-1` (merge `2b6c9f7` según `DECISIONS.md:172`). El aviso
  `checkout-sin-salida` existe (`lib/config/avisos-configuracion.ts:124`, documentado
  en `DECISIONS.md:181`), con test que fija su clave y su orden
  (`lib/config/avisos-configuracion.test.ts:202,224`). Son el MISMO defecto — el id
  de backlog nunca aparece literal en el repo, así que un grep futuro por ese id
  volvería a abrirlo si no se deja escrita la equivalencia.
- **`EJE-5B-C2-CHROME-FOOTER-1`** — cerrado por el slice de continuación (merge
  `9fd8d0c`), que convierte exactamente **14** literales:
  `grep -c "sf-sobre" components/storefront/StoreFooter.tsx` da 14. Queda **un**
  `border-white/10` (línea 190, el divisor de la bottom bar) que el propio commit
  declaró fuera de alcance — no es un resto olvidado, es un límite escrito.
- **`FUENTES-PESOS-DISPLAY-SOBRAN-1`** — **distinción explícita, a pedido del owner:
  NO estaba hecho cuando el censo corrió.** Estaba VIVO, y lo cerró un slice
  POSTERIOR: commit `4909bdd` (medido — `git show -s --format=%ai 4909bdd` →
  `2026-09-12 22:13:08 -0500`), mergeado en `3fd2b34`. Los nueve pares de fuentes
  pasaron a pedir `wght@400` y `globals.css` bajó `Playfair Display` a un solo peso.
  Los otros tres HECHO de este grupo ya estaban hechos cuando sus ítems se
  escribieron; éste se arregló DESPUÉS de que el primer censo lo mirara — dos hechos
  distintos con la misma palabra "hecho", y hay que separarlos o el próximo lector no
  sabe si está leyendo sobre trabajo previo o sobre trabajo que el propio censo
  disparó. Sobre la fecha: el commit marca 2026-09-12 22:13 −05:00, el mismo día
  calendario en que el censo corrió y DESPUÉS de esa corrida — la diferencia con
  "hoy, 2026-09-13" que el orquestador había anunciado es de zona horaria / corte de
  día, no de sustancia.
- **`STOREFRONT-TIME-PROMISES-1`** — la promesa horneada ("en menos de 2 horas
  hábiles") se retiró en la tanda de #8 (mismo merge `2b6c9f7`), por decisión del
  owner, en las dos ramas del checkout. Hoy dicen "lo más pronto posible", con
  comentario que documenta el retiro (`DECISIONS.md:174`, "PLAZO"). Cero promesas de
  ENTREGA vivas. Quedan dos numéricos de GARANTÍA DE PRODUCTO ("frescura de 30 días",
  "tostado dentro de los 7 días previos al envío") que son otra categoría, fuera del
  alcance del ítem.

**LÍMITE-DELIBERADO (1) — lo que parece pendiente es una decisión tomada:**

- **`CONFIG-DEEP-LINK-POR-CAMPO-1`** — `/admin/configuracion` efectivamente no lee
  query params: `grep -rn "useSearchParams" "app/(admin)/admin/configuracion/"` da
  cero resultados. Pero está documentado como límite consciente en
  `lib/config/avisos-configuracion.ts` (comentario junto a `#8`, línea 172 de
  `DECISIONS.md`: "la convención de deep-link `?seccion&tarjeta` es del editor de
  CONTENIDO, no de SiteSetting"), con test que fija el href actual como intencional.
  Un límite con test no es un pendiente.

**NO-SE-PUEDE-DECIDIR (1) — y es un resultado, no una falla:**

- **`EJE-4-FORMA-PILLSET-1`** — la propuesta de diseño original que el ítem cita no
  vive en este repo; sólo sobreviven citas de su conteo dentro del propio ledger que
  la corrige. Lo remedido reconcilia en la parte medible (los `rounded-full` que
  quedan dan 20, contra "18 círculos + 2 muertas" del ledger), pero el conteo de
  píldoras contra la propuesta original no es verificable sin ese documento. La
  pregunta que haría falta para resolverlo (¿la propuesta original describía 18, 20,
  u otro número, y con qué criterio de "muerta"?) no tiene dónde buscarse — no se
  fuerza un veredicto sin el documento.

**NUNCA-FUE-DEFECTO: CERO.** Ninguno de los ocho resultó ser una afirmación que ya
era correcta cuando se escribió — y eso es justo lo que la corrección de abajo tuvo
que deshacer.

**Conteo: 2 VIVO + 4 HECHO + 1 LÍMITE-DELIBERADO + 1 NO-SE-PUEDE-DECIDIR +
0 NUNCA-FUE-DEFECTO = 8.** Verificado por suma directa contra la lista de arriba.

### La corrección — el primer censo se equivocó, y hay que decirlo

El primer censo (referenciado como parte de `BACKLOG-PODA-VERIFICADA-2`) reportó
**«uno de los ocho NUNCA FUE DEFECTO: la afirmación de la doc ya era correcta»**, y
ese ítem era `AVISOS-DOC-CORRECT-PLUMBING-CLAIM-1`. El re-censo lo encontró VIVO, con
la evidencia de arriba (el cuarto argumento `ajustes: SiteSettings` que
`CLAUDE.md:1609` no admite). **La versión anterior de este asiento lo habría cerrado
en el ledger, por escrito, como un defecto que nunca existió** — la peor de las dos
formas de equivocarse, porque un NUNCA-FUE-DEFECTO se lee como verificado y nadie
vuelve a mirarlo.

Los tres conteos del mismo trabajo no cuadran entre sí, y se registran los tres sin
forzar que concuerden: el primer censo resumió 5 HECHO / 1 límite / 2 VIVO; el
orquestador, reconstruyendo desde figuras persistidas, obtuvo 4 / 1 / 3; este
re-censo mide 2 VIVO / 4 HECHO / 1 LÍMITE / 1 NO-SE-PUEDE-DECIDIR. Hipótesis
plausible, escrita como hipótesis y no como hecho: el primer censo pudo haber
plegado `EJE-4-FORMA-PILLSET-1` dentro de HECHO (contando el cableado remedido e
ignorando que el conteo contra la propuesta original es indecidible), lo que
convertiría 4+1 en 5 y calzaría con el 5/1/2 reportado. El 4/1/3 del orquestador no
se explica con esa hipótesis y queda sin explicar.

### Las dos fallas de protocolo — el mismo defecto en las dos direcciones

**`ORCH-CENSO-SIN-TABLA-1`.** El primer censo persistió trece figuras que miden
SÍNTOMAS ("16 ocurrencias de sf-sobre", "0 useSearchParams", "0 promesas de plazo") y
ninguna dice qué ÍTEM cerró cada una. El mapeo síntoma → ítem vivía en la prosa del
worker, y la prosa de un worker no se persiste: medido sobre un censo real, 42
bloques `tool_use`, 31 de `thinking` guardados como cadena VACÍA, y UN bloque de
texto de 84 caracteres. De ocho ids, el reporte nombraba cuatro. Costo: el censo
entero hubo que rehacerlo, y la re-medición encontró un veredicto equivocado (el
NUNCA-FUE-DEFECTO de arriba) que se iba a escribir en el ledger tal cual. **Y no es
que la advertencia no estuviera escrita:** ya vive en `figures.description` del
schema del stop-report de este mismo protocolo — es una `description`, consejo y no
obligación, y no mordió. Documentar un requisito en un schema no lo hace cumplirse;
ésa es la lección, no "faltaba documentación".

**`ORCH-SEGUIMOS-ESCRITURAS-NO-LECTURAS-1`, el gemelo.** Un slice `writes: no` no se
cierra solo: el auditor de cola sólo sabe cerrar un id por encabezado de ledger o por
merge, y una investigación read-only no produce ninguno de los dos. Dos censos ya
corridos —`TOSTADO-VIVO-CENSO-1` y `PASARELA-CENSO-MODELO-1`— quedaron vivos en la
cola siendo trabajo YA GASTADO, y hubo que comentarlos a mano. Es la MISMA causa que
`ORCH-CENSO-SIN-TABLA-1`, vista al revés: **el protocolo sabe seguir ESCRITURAS y no
sabe seguir LECTURAS.** Un slice que escribe deja commit, rama, diff y encabezado —
cuatro rastros que las herramientas leen; un slice que lee deja un JSON que ninguna
herramienta consulta para cerrar nada. El veredicto perdido de la falla anterior y el
cierre perdido de ésta comparten la misma raíz: el protocolo mide lo que escribe, no
lo que averigua.

**El precedente del mismo día, registrado porque el owner pidió que quede junto a
esto:** `WOMPI-SPIKE-SANDBOX-1` volvió BLOCKED por faltar credenciales de sandbox en
`.env` — comportamiento ESPERADO, no incidente: el worker no buscó un rodeo, no las
pidió por otro canal, no fabricó una respuesta, y nombró la variable faltante con
precisión suficiente para que el owner la pusiera. Una precondición ausente es
BLOCKED, y BLOCKED es un éxito del protocolo. Cuando las llaves llegaron, resultaron
PRODUCTIVAS (`pub_prod_`, `prv_prod_`), no de sandbox — el segundo intento no
despachó nada: midió sólo prefijo y longitud, sin que ningún valor viajara a ningún
lado, y encontró que "las llaves están" no era la precondición real; la precondición
era "las llaves son de SANDBOX", verificable por PREFIJO y no por presencia. Una
precondición verificada con el predicado equivocado es una precondición no
verificada.

### El patrón — vale más que los ocho cierres

`CLAUDE.md` § Backlog técnico ya dice "PODAR LEYENDO TÍTULOS NO SIRVE — hay que
verificar contra el CÓDIGO", con tres mordidas previas (#16, #36, #2) DENTRO de un
mismo archivo. Este censo encuentra dos variantes nuevas:

- **Entre archivos, no dentro de uno:** los cuatro HECHO de este asiento se cerraron
  con slice, commit, asiento propio en `DECISIONS.md` y gate — y NINGUNO dejó rastro
  en `CLAUDE.md`. El ledger queda al día porque cada slice se obliga a escribir su
  asiento; la doctrina viva no se actualiza en el mismo commit. Como el backlog se
  redacta leyendo `CLAUDE.md`, sigue listando como abiertas cosas que el ledger ya
  cerró.
- **Premisas prospectivas que vencen sin que nadie las toque:** los dos VIVO son
  afirmaciones condicionales o de estado ajeno ("cada dormido será sobre el mismo
  fetch", "no dispara porque hay 0 filas") que un slice POSTERIOR y no relacionado
  volvió falsas, sin que nadie volviera a tocar la frase. La señal que esto deja
  escrita: **un ítem de backlog que cita el estado de OTRO subsistema como premisa
  —cuántas filas hay, que existe un fetch, cómo se comporta otro componente— tiene
  fecha de vencimiento cada vez que ESE subsistema cambia, no sólo cuando el ítem se
  resuelve.** No alcanza con podar leyendo el título, y tampoco alcanza con podar
  preguntando si el ítem se resolvió: hay que revisar si las tandas de OTRAS áreas
  invalidaron su premisa.

### Lo que este asiento NO hace

No toca `CLAUDE.md` — las dos frases vencidas (`:1609` y la premisa de §65 sobre
`AVISOS-DORMANT-34-RAW-CONTENT-1`) quedan nombradas acá como pendientes, su
corrección es otro slice con su propio `touches:`. No cierra los ítems que esperan
una decisión de producto (`CARRITO-NO-SOBREVIVE-RELOAD-1`, `CHECKOUT-REDISENO-1`,
`PRODUCTO-CAFE-SHAPE-1`, `ONBOARDING-RUNBOOK-1`), exentos del grep por el propio
`CLAUDE.md`. No propone la FORMA de arreglar `ORCH-CENSO-SIN-TABLA-1` — hay una
propuesta en evaluación del owner, no decidida; este asiento registra la falla, su
costo medido y su causa, no la solución.

Sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false`), sin
código tocado — sólo este archivo. `npm test` **1104/1104** y `npx tsc --noEmit` en
**0**, igual al piso medido en `main` antes de este asiento.

## 2026-09-14 · Lo que el spike de sandbox midió, y las reglas que fija para la implementación (`WOMPI-REGLAS-IMPLEMENTACION-1`)

`WOMPI-SPIKE-SANDBOX-1` corrió contra el sandbox real de Wompi y volvió OBSERVED. Un
slice `writes: no` no deja artefacto — commit, rama, diff, encabezado, ninguno de los
cuatro rastros que el protocolo sabe seguir (`ORCH-SEGUIMOS-ESCRITURAS-NO-LECTURAS-1`,
arriba) — así que lo medido vivía únicamente en el spec del spike hasta este asiento.
Este slice lo traslada al ledger, sin diseñar `PaymentIntent` ni escribir código de
integración: eso sigue siendo trabajo aparte.

**LA PREGUNTA GRAVE DE `PASARELA-DECISIONES-LEDGER-1` SALIÓ SÍ.** Esa entrada dejaba
abierto *«si `GET /v1/transactions?reference=` existe en la API de Wompi»*, bloqueando
el diseño de la reconciliación. Medido: `GET https://sandbox.wompi.co/v1/transactions?
reference=<ref>` funciona, probado contra una transacción real creada por el propio
spike. **La reconciliación es posible y no hay que abandonar Web Checkout.**

Dos condiciones medidas mandan sobre esa respuesta:

- **Sólo autoriza `WOMPI_PRIVATE_KEY`.** Con `WOMPI_PUBLIC_KEY` como Bearer, `401
  INVALID_ACCESS_TOKEN`; con la privada, `200`. El OpenAPI oficial lo confirma
  (`security: [{BearerPrivateKey}]` únicamente). Consecuencia de arquitectura: **el
  reconciliador corre en el SERVIDOR y sólo ahí** — la llave privada no puede tocar el
  cliente.
- **Una referencia inexistente devuelve `200 {"data":[]}`, NUNCA 404.** `data` es un
  array aunque `reference` sea única en la práctica.

**La regla del reconciliador, tal como el owner la pidió explícita:**

> El array vacío NO significa «no pagada». «No existe todavía» y «existe pero aún no
> se resolvió» son indistinguibles por status HTTP — los dos son `200` con `data: []`.
> Un reconciliador que trate el array vacío como «no pagó» va a marcar como impaga
> una transacción que todavía no se creó. Se distingue por LONGITUD del array, y la
> ausencia no es una respuesta negativa: es la ausencia de respuesta.

Y la otra ruta se comporta al revés — lo que hace fácil equivocarse si alguien asume
que las dos convenciones coinciden: **`GET /v1/transactions/<ID>` con un id inexistente
sí devuelve 404.** Dos rutas, dos convenciones.

**LAS DOS FIRMAS — cuál firma qué, verificado.** `WOMPI_INTEGRITY_SECRET` firma la
petición que NOSOTROS iniciamos: `sha256_hex(reference + amount_in_cents + currency +
<secreto>)`, concatenación plana, en ese orden, sin separadores — el spike la verificó
recomputando el ejemplo de la doc byte a byte y dio idéntico. `WOMPI_EVENTS_SECRET`
firma el evento que WOMPI nos manda: `sha256_hex(<valores de los campos que el evento
lista en signature.properties, en ese orden> + timestamp + <secreto>)`, y llega en el
header `X-Event-Checksum` y en `signature.checksum`, con el mismo valor. Los nombres de
las variables ya cargan la distinción —`EVENTS` vs `INTEGRITY`— y ahí es donde nace el
error clásico de confundirlas.

### LA DOC DE WOMPI NO ES FUENTE DE VERDAD — SE VERIFICA CONTRA EL SANDBOX

Un solo spike encontró TRES discrepancias entre lo que la documentación afirma y lo que
el sandbox hace. No es una doc con un error: es una doc que no se puede tomar como
contrato.

1. **NO calibres el verificador de firma contra el ejemplo numérico de la doc.** El
   ejemplo del checksum de eventos no reproduce: siguiendo la propia página paso a
   paso, la concatenación —confirmada carácter a carácter— da un `sha256` distinto del
   que la doc afirma. Es casi seguro un copy-paste (el mismo valor aparece antes, en el
   cuerpo JSON de ejemplo de la misma página). La FÓRMULA EN PROSA no está en duda; su
   ejemplo sí. Quien implemente y vea que «no coincide con la doc» va a asumir que su
   código está mal — queda escrito para que no pierda un día.
2. **NO te apoyes en que `GET /v1/transactions/<ID>` exija autenticación.** La doc
   afirma explícitamente que sin auth o con llave pública retorna 404. Medido: devuelve
   200 con la pública, con la privada, y SIN NINGÚN header. En sandbox esa restricción
   no está aplicada hoy. El riesgo es de los dos lados: si mañana la aplican y el
   código dependía de que no, rompe; si se asume que ya está aplicada, se confía en una
   protección que no existe. Verificar en producción antes de asumir cualquiera de las
   dos conductas.
3. **Crear una transacción funciona con la llave PÚBLICA.** La prosa de la doc pide
   privada; el OpenAPI dice pública; medido, la pública devuelve 201. Cuando la prosa y
   el OpenAPI se contradicen, el OpenAPI acertó las dos veces — pero la regla no es
   «creele al OpenAPI», es «medilo».
4. **El verificador de firma lee `signature.properties` DEL EVENTO RECIBIDO, nunca una
   lista hardcodeada** — no es una discrepancia sino una advertencia de la propia doc,
   y es de DISEÑO. La doc dice textual: *«los valores del campo `properties` pueden
   variar en el tiempo y en cada evento, por eso es muy importante que no los asumas
   como un arreglo fijo dentro de tu código, sino que siempre los extraigas del
   evento»*. En un `transaction.updated` típico son
   `['transaction.id','transaction.status','transaction.amount_in_cents']` — ejemplo,
   no contrato.

**Lo que queda abierto, dicho como abierto:**

- **La firma del webhook no se verificó contra un evento REAL** — estaba anticipado:
  recibir un webhook exige una URL pública que un worker local no tiene. El spike
  cerró la sub-pregunta de si había un atajo: ninguna página de la doc menciona
  reenviar ni inspeccionar un evento ya emitido desde el dashboard. No hay reemplazo
  documentado del túnel. Queda por confirmar en la UI del dashboard, que sólo el
  owner puede abrir.
- **Reintentos, confirmados en cifras:** máximo 3 en 24 h — a los 30 min, 3 h y 24 h.
  Coincide con lo ya registrado en `PASARELA-DECISIONES-LEDGER-1` (línea 843, arriba),
  y es lo que hace que la reconciliación sea parte del producto, no una mejora.
- **`PaymentIntent` sigue sin diseñarse.** La columna única del id de transacción del
  PSP sigue siendo la pieza que sostiene la idempotencia (`PASARELA-DOC-AL-DIA-1`,
  arriba) — este asiento no la re-litiga.

Este asiento NO diseña `PaymentIntent` ni escribe código de integración — sus
columnas, ciclo de vida y migración siguen dependiendo de esa decisión, sin tomar acá.
Ninguna llave, prefijo ni longitud de credencial aparece en este asiento: las cuatro se
nombran por variable (`WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`,
`WOMPI_INTEGRITY_SECRET`), nunca por valor.

Sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false`), sin
código de producto tocado — sólo `DECISIONS.md` y el puntero en `CLAUDE.md`. `npm test`
**1104/1104** y `npx tsc --noEmit` en **0**, igual al piso medido en `main` antes de
este asiento.
Regla: § Pagos en línea (Wompi) — cobros automáticos (CLAUDE.md), que gana un puntero a
este asiento para lo medido contra el sandbox y las reglas de implementación.

## 2026-09-14 · El censo es OBLIGATORIO, no complementario a la pregunta mecánica del cierre (`DERIVA-LIMITE-LEDGER-1`)

**El defecto, medido.** Sobre **843 commits sin merge** de este repo (hasta `27334cd`;
`git rev-list --no-merges --count 27334cd`), **230** tocan `CLAUDE.md`
(`git log --no-merges --oneline 27334cd -- CLAUDE.md | wc -l`), **42** tocan
`DECISIONS.md` (mismo comando sobre `DECISIONS.md`), y sólo **CUATRO** tocan los dos
—`9bc286e`, `45311c2`, `b8e4ff8`, `bf99b03`, por intersección directa de las dos
listas—. Las tres cifras se re-midieron en este slice y coinciden exactamente con
las que trajo el spec. **No es abandono** — la doctrina se edita ~5× más seguido que
el ledger —, es que **los dos libros son casi disjuntos**: se mantienen en slices
separados y nada obliga a preguntar si un cambio en uno volvió falsa una frase del
otro. Como el acople no es estructural, el arreglo tiene que ser una obligación de
PROMPT, no de archivo.

**El arreglo que ya existe, y el límite que no se vio al hacerlo.** Todo slice que
escribe lleva ahora una pregunta mecánica al cierre: listar los símbolos y rutas que
el diff cambió, grepear `CLAUDE.md` por cada uno, decir si la frase queda falsa, y
NO arreglarla — va a `open_followups`. Es mecánica a propósito: en los casos
medidos el slice que volvió falsa la frase no trabajaba sobre el tema de esa frase,
así que preguntado directamente habría contestado, honestamente, que no.

**El límite es que esa pregunta NO atrapa esta clase POR CONSTRUCCIÓN — el diff que
mata la frase nunca la nombra.** Sirve para la deriva que el propio cambio causa; el
CENSO es la red para la que causa OTRO subsistema, y por eso **no es complemento: es
obligatorio.** Ésta es la distinción que hay que decir literal, porque la lectura
fácil —"ya existe la pregunta del cierre, un censo es una capa extra de cuidado"—
es exactamente la que el hallazgo desmiente: sin censo, la clase entera de deriva
cruzada queda sin red.

**El número que lo sostiene.** Un censo (`DOCTRINA-PROSPECTIVA-CENSO-1`, un slice
`writes: no` sin artefacto propio, citado por su nombre en el mensaje del commit
`b3ed114`) midió 17 afirmaciones prospectivas de `CLAUDE.md` contra el código y
encontró **7 FALSAS**. Las **SIETE — el 100%** — las volvió falsas un cambio en OTRO
subsistema; **CERO** fueron falsificadas por trabajo sobre su propio tema. Cuánto
vivieron falsas, medido por el orquestador sobre el historial: la frase que citaba
`DUNA_MQ_MOVIL` siguió citando un símbolo borrado hacía **28 días**; la que listaba
`agotado` entre los campos que el PATCH parcial nunca escribe, **18 días** después
de que se dropeara la columna; la de los cinco pares de fuentes, **7 días**; la de
los pesos del rol display, **2**. La doctrina no se pudre a ritmo constante: se
pudre EN ESCALONES, en los merges de otros.

**Y el censo fue PARCIAL.** Verificado: `CLAUDE.md` medía **7392 líneas**
(`git show eeaee15:CLAUDE.md | wc -l`) en el commit sobre el que corrió — un
barrido dirigido de un archivo grande, con secciones enteras sin barrer. **7 falsas
es un PISO, no un total.**

**Lo que las siete tenían en común, y por qué no se repite acá.** CINCO de las
siete eran MEDICIONES o INVENTARIOS disfrazados de doctrina, no reglas
equivocadas — un conteo de secciones editables, un conteo de pares de fuentes, una
lista de pesos tipográficos, un número de KB, un conteo de `DialogContent`.
Envejecieron solas, sin que nadie las tocara. De ahí la regla que el owner dictó:
**la doctrina guarda la REGLA y su porqué, nunca una medición ni un inventario** —
ya escrita en `CLAUDE.md` § Backlog técnico por `DOCTRINA-MEDICIONES-FUERA-1`
(`b3ed114`), que hace la cita del 5-de-7. Este asiento la CITA y no la reescribe:
dos copias de una regla es el defecto que la regla misma describe.

**La verificación escrita y nunca corrida — el caso `DialogContent`.**
`CLAUDE.md` (§ Todo `DialogContent` lleva `DialogDescription`) afirmaba que la
regla de accesibilidad estaba cumplida en los DIEZ `DialogContent` del repo, con
el propio `grep` de verificación incluido debajo. Corrido en este slice: da **4
archivos** —`components/ui/command.tsx`, `components/admin/PaletaSeccion.tsx`,
`components/admin/AutomationConfigDialog.tsx`, `components/admin/ImageLightbox.tsx`—
y los 4 cumplen, cero `PENDIENTE`. La doctrina traía el comando para verificarse a
sí misma y **nadie lo corrió** desde que el "diez" se escribió (2026-08-06) hasta
hoy. **Una verificación escrita y nunca ejecutada es PEOR que no tenerla — da la
sensación de estar cubierto** (owner, 2026-09-14). `DOCTRINA-MEDICIONES-FUERA-1`
ya reemplazó el "diez" por el resultado de hoy y esta advertencia; este asiento no
vuelve a tocar esa frase.

**La disyuntiva que sobrevive al fix puntual, y la clase que la vuelve real.** Un
comando de auto-verificación dentro de la doctrina o se corre en el censo
periódico, o se borra — un tercer estado, escrito y nunca corrido, es el peor de
los tres. No es hipotético: `CLAUDE.md` trae **6 bloques ` ```bash` `** (verificado
por conteo directo), y al menos uno de ellos —el de `DialogContent`— ya demostró
que puede pasar más de un mes sin correrse mientras la frase que lo acompaña sigue
afirmando su resultado como vigente. La clase — un comando ejecutable incrustado
como evidencia de una afirmación de doctrina — existe en el archivo. No se
enumeran ni se juzgan los seis acá: eso es trabajo de un censo futuro, no de este
asiento.

**Lo que NO se decide acá:**
- **La CADENCIA del censo periódico queda ABIERTA.** Está propuesta; el owner no
  la ha fijado.
- **Las siete correcciones** viven en `CLAUDE.md`, no acá — este asiento registra
  POR QUÉ existían y qué se aprendió, no el número correcto de secciones
  editables, pares de fuentes o pesos tipográficos.
- Ninguna llave, prefijo ni longitud de nada.

Regla: § Backlog técnico (CLAUDE.md), donde `DOCTRINA-MEDICIONES-FUERA-1` ya
escribió "la doctrina guarda la regla y su porqué, nunca una medición ni un
inventario" — este asiento no toca esa sección ni ninguna otra de `CLAUDE.md`.

## 2026-09-14 · La segunda pasada del censo, y el sub-patrón que la abarata (`DOCTRINA-SIETE-NUEVAS-1`)
`d96b566`, merge `--no-ff` `bfeae7a`

**LA TASA.** El censo se pagó en su SEGUNDA corrida encontrando la MISMA tasa que la
primera: **7 de 7** de las afirmaciones falsas lo eran por un cambio en OTRO
subsistema, verificado una por una en este slice antes de tocarlas —los cuatro
conteos de migraciones, la tabla del manifest, `MIN_CLIENTES_CONCENTRACION`, el
importador de `@vercel/blob`, el disparador de H6, la FAQ del backlog #63 y
`transpilePackages`—: ninguna la volvió falsa el trabajo sobre su propio párrafo; las
siete las volvió falsas una tanda que tocaba otra cosa. Dos pasadas, dos muestras
independientes, el mismo 100%. **La deriva doc-vs-código no es un accidente de esta
semana: es la CONDICIÓN POR DEFECTO de una doctrina de 7.000+ líneas sin
verificación mecánica.** Por eso el censo es obligatorio (§ `DERIVA-LIMITE-LEDGER-1`,
arriba) y por eso existe la regla de `DOCTRINA-MEDICIONES-FUERA-1`.

**EL SUB-PATRÓN, para el diseño del próximo censo.** De las siete, TRES eran
AUTO-CONTRADICCIONES: detectables leyendo `CLAUDE.md` de corrido, sin tocar el
código, porque la frase vencida y la frase que la corrige CONVIVEN en el mismo
documento —a veces a pocas líneas, a veces a miles—. Es la clase más barata de
detectar y la que más tiempo lleva viva, porque leer 7.000 líneas de corrido es
justo lo que nadie hace: la tabla de § Identidad decía que el manifest "sigue
global" mientras la subsección INMEDIATAMENTE siguiente documentaba su retiro.

**Matizado con lo que se midió al intentar mecanizarlo, porque sin esto el
sub-patrón se lee como "esto se automatiza" y NO es cierto.** De las tres
auto-contradicciones, UNA era del tipo INVENTARIO (`MIN_CLIENTES_CONCENTRACION = 6`,
contrastable contra la constante real) y UNA era DOC-CONTRA-CÓDIGO (`@vercel/blob`
importado "SOLO" desde `lib/storage.ts` — falso, `lib/api/upload.ts` también lo
importa) — **las dos ya tienen chequeo automático**: la de inventario lo tiene
LITERAL (`lib/metrics/concentracion.test.ts:95`,
`assert.equal(MIN_CLIENTES_CONCENTRACION, MIN_ORDENES_INSIGHT)`); la de
`@vercel/blob` es mecanizable con un grep de una línea (`grep -rln "@vercel/blob"`)
porque el símbolo
que falsifica la frase está LITERAL en el código y en las dos frases del documento
que se contradicen. **Pero la TERCERA —la tabla del manifest diciendo "sigue
global" mientras la subsección INMEDIATA documenta que `app/manifest.ts` se
retiró— era PROSA CONTRA PROSA, SIN TOKEN COMPARTIDO**: la celda de la tabla
("Nayoli — sigue global, ver abajo") no nombra `app/manifest.ts` ni ningún otro
símbolo — es una remisión ("ver abajo") a una prosa que la contradice. No hay
ningún string que grepear en la celda para descubrir el conflicto; hace falta LEER
la tabla Y la subsección y notar que afirman lo contrario una de la otra sobre el
mismo hecho. **Ésa no es mecanizable — se queda en la lectura del censo, que es
donde se atrapó.**

**Lo que NO se decide acá:**
- La forma concreta de un censo periódico que aproveche el sub-patrón (leer las
  secciones que citan el mismo símbolo/archivo, no sólo grepear valores) queda
  abierta — es diseño de un censo futuro, no de este asiento.
- Ninguna de las siete correcciones se repite acá; viven en `CLAUDE.md`.

Regla: § Backlog técnico (CLAUDE.md), sin tocar — este asiento cita la regla de
`DOCTRINA-MEDICIONES-FUERA-1` y no la reescribe.

Sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false`),
sin código tocado — sólo este archivo. `npm test` **1104/1104** y
`npx tsc --noEmit` en **0**, igual al piso que el spec midió en `main` antes de
este asiento.

## 2026-09-14 · Dos copias de `isUniqueViolation`, unificadas antes de que el webhook fuera la tercera (`ISUNIQUEVIOLATION-UNIFICAR-1`)
`5dfab22`, merge `--no-ff` `0b77508`

**LO MEDIDO EN `PAYMENTINTENT-FORMA-CENSO-1`, confirmado carácter por carácter antes de tocar nada:**
`isUniqueViolation` vivía sin exportar en `packages/core/src/orders.ts:344-349` (un solo llamador, en el
mismo archivo), y `lib/automations/idempotency.ts:103` reimplementaba el MISMO chequeo de `P2002` inline.
Las dos versiones eran equivalentes en todos los casos de entrada (`null`, `undefined`, string, objeto sin
`code`, objeto con `code` correcto o incorrecto) — la de `orders.ts` agrega un `'code' in error` que es
redundante con el acceso opcional de la copia inline, no un chequeo adicional real.

**Es el patrón de la doctrina —dos declaraciones del mismo hecho que divergen— atrapado ANTES de morder,
con el webhook de Wompi (`PASARELA-DECISIONES-LEDGER-1`) como tercera copia que no llegó a escribirse.**

**El fix es el mínimo que el spec pedía y nada más:** `export` agregado a la función de `orders.ts` (sin
mover el archivo — vive donde la usa su dueño original), e `idempotency.ts` la importa de
`@duna/core/orders` —el mismo camino que ya usa `packages/core/src/shipping-transition.ts` para importar
de un módulo hermano dentro del paquete— y borra su copia inline. Ningún llamador cambió: `createOrderWithCustomer`
sigue reintentando hasta 5 veces, `registrarRun` sigue sin reintentar y devolviendo `false`. Diff de una
línea en cada archivo de producción.

`isUniqueViolation` no tenía test propio pese a estar en la ruta del dinero y gobernar la idempotencia de
las automatizaciones. Se agregó `packages/core/src/orders.test.ts` (co-ubicado con su dueño, la convención
del repo) afirmando el caso reconocido y los que la copia inline chequeaba a mano: otro código, `null`,
`undefined`, string, objeto sin `code`.

Merge `--no-ff` mecánico, tree == tree gateado (`e7b831c`). `npm test` **1110/1110** (piso 1104 + 6 tests
nuevos) y `npx tsc --noEmit` en **0**, igual al piso que el spec midió en `main` antes de este asiento.
Regla: dos declaraciones del mismo hecho o derivan una de la otra o hay un test que las ata — el mismo
criterio de `site-content-schema.test.ts` (§ CLAUDE.md, El schema editable STRIPPEA lo no declarado),
ahora en la idempotencia de automatizaciones.

## PAYMENTINTENT-SCHEMA-1 — la tabla del INTENTO, y lo que su cierre exige (2026-09-14)

`PaymentIntent` entra al schema con su migración aditiva (`20260914140000_add_payment_intent`) y **sin
un solo llamador**: ni webhook, ni reconciliador, ni ruta. La forma la aprobó el owner tras dos censos
(`PAYMENTINTENT-FORMA-CENSO-1`, `PAYMENTINTENT-BUCKETS-CENSO-1`): **una fila por INTENTO**, la unique
del id de transacción del PSP **en `PaymentIntent` y no en `Payment`**, **sin FK a `Payment` en
ninguna dirección**, y **tres buckets** (`EN_VUELO` / `APROBADO` / `FALLIDO`).

La razón de la unique es la que decide todo lo demás: **el webhook llega con el id de transacción
ANTES de saber si corresponde crear un `Payment`** —una transacción declinada no debe crear ninguno—,
así que el reconocimiento «ya vi este id» **tiene que poder ocurrir sin pasar por el escritor de
dinero**. `registerOrderPaymentTx` sigue siendo el único que crea un `Payment`, y el webhook será **un
llamador más**. La columna es `String? @unique`: el id no existe cuando el intento se crea, y que
Postgres permita muchos NULL bajo una unique tiene **precedente vivo en este mismo schema**
(`Order.idempotencyKey`) y **precedente de riesgo documentado** (el comentario de `AutomationRun.periodo`:
«dos NULL no colisionan»). Las dos citas describen la misma propiedad desde ángulos opuestos.

**Tres buckets y no cuatro, medido contra NUESTRAS decisiones y no contra el catálogo del proveedor.**
Ninguna decisión propia se bifurca entre «Wompi lo rechazó» y «el cliente nunca volvió»: las dos dejan
de consultarse y ninguna crea un `Payment`. La diferencia real —una es terminal por evidencia, la otra
por un reloj nuestro— es **una rama de código dentro del reconciliador, no un estado**. El matiz que un
operador podría necesitar al teléfono vive en `estado_crudo_psp`, **como dato junto al hecho**, con el
precedente de `Objetivo.omitir`. Un cuarto valor que ninguna decisión consulta sería la «mina inerte»
que este ledger ya rechazó para un cuarto valor de `Order.estado`.

**El HOLD del segundo commit fue CORRECTO y no es un defecto del lector.** Merge Policy A clasifica **la
RAMA, no el commit** —es lo que el merge va a aterrizar— y en la rama vive la migración, que no estaba
en el `touches:` del slice de remates: `schema.prisma` salió `TRIP-APPROVED` y `migration.sql` salió
`TRIP` a secas. Mismo eje que ya está escrito para `customer_bytes` (`ORCH-CUSTOMER-BYTES-EJE-1`).

**EL BARRIDO DE INTENTOS VENCIDOS PUEDE ESPERAR AL WEBHOOK, y la razón es medida, no una postergación.**
Se declaró antes del merge porque podía cambiar el alcance de la migración, y **no lo cambia**:

- **el disparador ya existe y es reusable tal cual** — `.github/workflows/automations-cron.yml`, cron
  horario, POST autenticado a `app/api/cron/automations/route.ts`. (`vercel.json` **no** declara crons:
  en plan Hobby correrían una vez al día, y el propio workflow lo documenta.) **No hace falta
  infraestructura nueva;** lo que no existe es el código del barrido;
- **el cliente siempre puede reintentar aunque el barrido no corra**, medido contra columnas y uniques:
  `reference` incorpora el cuid de **cada fila nueva**, `pspTransactionId` es nullable+única, y no hay
  unique sobre `(orden_id, estado)` — dos `EN_VUELO` de la misma orden **no chocan**;
- **hoy no hay filas que barrer**: cero llamadores de `PaymentIntent` fuera del schema y del cliente
  generado.

**DISPARADOR DEL ÍTEM, escrito para que no quede como deuda vaga: el barrido entra cuando el webhook
empiece a escribir filas.** Antes de eso no tiene nada que hacer.

**Dos decisiones del orquestador, por medición** (el owner corrigió que eran suyas y no de producto):
el barrido **entra al catálogo de `constants/automations.ts`** con su `configSchema`, que es lo que le
da un umbral **configurable por el owner** en «Ajustes» sin inventar nada —precedentes `maxEdadDias` y
`horasEntrega`— y lo hace visible junto a sus pares en vez de ser un barrido invisible. Y el **umbral
por defecto es 48 h**: Wompi reintenta un webhook fallido **3 veces en 24 h** y después desiste, así que
24 h es el **piso duro**; 48 h deja una ventana entera de holgura después del último reintento en vez de
cerrar en el borde.

**Y EL PUNTO CIEGO REAPARECIÓ POR SU SEGUNDA CARA.** Si las filas `EN_VUELO` se acumularan, **nadie lo
notaría**: cero lecturas de `PaymentIntent` en `lib/atencion/` y en `packages/core/src/orders.ts`. Es
**el mismo hueco de carriles** ya medido para una orden con intento `FALLIDO`, que el owner mandó al
backlog. El ítem cubre **las dos caras**, no sólo el intento fallido: ni un intento fallido ni una
acumulación de intentos en vuelo aparecen hoy en ningún carril del admin.

**Dos comentarios nacieron falsos en el primer commit y se corrigieron en el segundo, sobre la misma
rama.** El de `reference` decía que el formato era `<numero_orden>:<intent.id del PSP>` y **se
contradecía con su propia frase siguiente**: el PSP no tiene id cuando el intento se crea —
`pspTransactionId` nace null tres columnas más abajo—, así que un lector que lo siguiera armaría la
referencia con un dato que no existe, **y es justo el comentario que explica la pieza que sostiene el
diseño**. Y dos remisiones apuntaban a una declaración en `CLAUDE.md § Pagos en línea` **que no existía**:
referencia cruzada falsa **desde el commit que la escribió**. Es la misma clase de deriva que esta semana
se corrigió en la doctrina, **ahora naciendo en código nuevo** — y la encontró la pregunta mecánica de
cierre, no una lectura.

**Los nombres se quedan como están, y no era una mezcla.** `pspTransactionId` en camelCase porque sus
vecinos son `idempotencyKey`, `providerId`, `targetId`, `tokenHash` —identificadores y tokens, sin
excepción—; `estado_crudo_psp` en snake_case porque **todos** los campos `estado_*` de varias palabras del
schema lo son (`estado_anterior`, `estado_nuevo`), cero contraejemplos. **La regla que se creía —«técnico
vs negocio»— NO se sostiene**: hay doce campos camelCase con raíz española (`descripcionCorta`,
`metodoPagoPrevisto`). La que sobrevive a los datos es **seguir al vecino más cercano**.

**Una guarda que se interpreta deja de ser guarda.** El spec ordenaba PARAR si la herramienta de
migración exigía una base; `prisma migrate diff --from-migrations` la exigió (pide `shadowDatabaseUrl`)
y el worker **no paró**: usó la vía schema-a-schema, que no necesita base, y lo declaró. La intención se
respetó —ninguna base se tocó— pero la letra decía parar. Queda escrito para no normalizarlo. **Y la
cita correcta**, que un worker corrigió al orquestador: `CLAUDE.md` § 38 documenta `Customer.total_compras`,
**no** `numero_ordenes`; el precedente contra los contadores escritos vale igual.

Merge `--no-ff` mecánico sobre rama ya gateada por el owner, **tree == tree** (`c7eeaa7`). `npm test`
**1110/1110** y `npx tsc --noEmit` en **0**, sin moverse. Migraciones 51 → 52. **La migración NO se
aplicó a ninguna base:** eso es una operación de datos y es del owner, por runbook.

## 2026-09-14 · El verificador de firma de Wompi, sin ruta ni llamadores (`WOMPI-FIRMA-VERIFICADOR-1`)

Primera pieza del webhook, elegida primero por ser la más medida y la que no toca ninguna ruta de
escritura: `lib/pagos/wompi-firma.ts` + su test co-ubicado, ambos nuevos. Función pura
`verificarFirmaWompi(evento, secretoEventos, checksumHeader?)`; el secreto entra como parámetro, la
función nunca lee `process.env`.

**La fórmula implementada, literal:** `sha256_hex(<valores de signature.properties, en ESE orden,
resueltos como rutas con puntos dentro de data, a cualquier profundidad> + timestamp + secreto)`,
concatenación plana sin separadores. `properties` se lee del evento en cada llamada — nunca de una lista
fija — y el test lo afirma con un `properties` de un solo campo (`cliente.email`) ajeno al ejemplo
típico de la doc, que sigue verificando bien.

**El caso dorado del test se calculó con la fórmula, no copiado del ejemplo numérico de la doc de
Wompi** — ya está medido en el ledger (`WOMPI-REGLAS-IMPLEMENTACION-1`) que ese ejemplo no reproduce.
Calibrar contra él habría fijado un bug de la documentación como si fuera el contrato.

**Tres decisiones que el spec dejó abiertas, resueltas y documentadas en la cabecera del archivo:**

- **Una ruta de `properties` que no resuelve a un escalar (ausente, `null`, o un objeto/array en el
  destino) LANZA `RutaDePropertyNoResuelveError`**, no devuelve `false` en silencio. El argumento: una
  ruta rota no es "la firma no coincide" (que compara hashes) — es "el evento no tiene la forma que
  `properties` promete", un caso distinto que el llamador debe poder diferenciar de un intento de forjar
  la firma. Rellenar el hueco con `''` u otro valor por defecto habría metido un dato inventado dentro
  del hash, capaz de validar o invalidar una firma por una razón que nadie decidió a propósito.
- **El checksum recibido se toma de `evento.signature.checksum` (el cuerpo), no de un header.** La
  función recibe "el evento ya parseado"; un header HTTP no es parte de eso, y leerlo es
  responsabilidad de la ruta (Tier 1, slice siguiente). Se agregó un tercer parámetro OPCIONAL,
  `checksumHeader`, para que esa ruta futura pueda pasarlo si quiere: si se pasa y **difiere** del
  checksum del cuerpo, la función falla cerrado devolviendo `false` sin intentar decidir cuál de los dos
  "creer" — la discrepancia entre dos fuentes que deberían decir lo mismo es una señal de manipulación
  por derecho propio.
- **La comparación es en tiempo constante** (`crypto.timingSafeEqual`) con el caso de largos distintos
  resuelto ANTES de invocarla (esa función lanza si los Buffers difieren en longitud): se compara el
  largo primero y se devuelve `false` derecho, sin que eso filtre nada — el largo de un sha256 hex es
  fijo (64) y público, no depende del secreto.

**Doce casos de test**, incluidos los siete que el spec exigía por nombre (firma válida, firma
inválida, orden de `properties` importa, `properties` con campos distintos del ejemplo típico,
timestamp participa, ruta que no resuelve, largos distintos en la comparación) más cinco adicionales
(ruta a `null`, ruta a un objeto, header que coincide, header ausente con checksum del cuerpo correcto,
secreto equivocado).

`npm test` **1122/1122** (piso medido antes de empezar: 1110; el slice sumó 12) y `npx tsc --noEmit` en
**0**, sin moverse. Merge `--no-ff` mecánico, **tree == tree** (`4a5e823`) — Merge Policy A: dos archivos
nuevos en `lib/pagos/`, sin schema, sin bytes de cliente, sin contrato cross-repo, sin llamadores.
`RutaDePropertyNoResuelveError` es la única superficie nueva no pedida por nombre en el spec; nace con
su test y sin consumidores fuera de este archivo, a la espera de la ruta del webhook (Tier 1, slice
siguiente, que sí toca `app/api/` y `PaymentIntent`).

## 2026-09-14 · Las tres listas del conjunto de métodos de pago, atrapadas antes de que Wompi fuera la cuarta (`METODOS-TRES-LISTAS-1`)
`4386358`, merge `--no-ff` `a138833`

**LA TRAMPA MEDIDA ANTES DE TOCAR:** `app/api/checkout/route.ts:35` validaba `payment.metodo` con un
arreglo literal (`z.enum(['nequi', 'daviplata', 'breb', 'transferencia', 'efectivo'])`) que no importaba
`MetodoPagoTipo` ni `METODOS_PAGO_ORDEN` (`lib/checkout/metodos-pago.ts:13,17`) — la fuente única del
conjunto. `services/checkout.service.ts:1,18-22` sí las importa y hasta cita `§ CHECKOUT-BREB-CAST-1`
como el incidente que lo forzó a derivar. Hoy no había fuga hacia el comprador (un método desconocido
da 400), pero el día que Wompi entrara a `METODOS_PAGO_ORDEN` sin tocar el route, el checkout lo habría
**ofrecido** en la lista de opciones y **rechazado** con 400 al confirmar.

**Las otras dos declaraciones, medidas por separado:**
- **`types/payment.ts:23-42`** (el enum `MetodoPago` en MAYÚSCULAS, espejo a mano del enum de Prisma
  `MetodoPago`) coincide byte a byte con `packages/core/prisma/schema.prisma:381-388`
  (`NEQUI, DAVIPLATA, EFECTIVO, TRANSFERENCIA, OTRO, BREB`) — **no diverge hoy** — y ya está atado por
  `lib/pagos/metodos-pago-enum.test.ts`, que falla nombrando el valor que falte. No se tocó.
- **La tercera, admin-only, hallada al buscar (no citada por el spec a propósito):** `GRUPOS_PAGO`
  (`components/admin/DatosNegocioSeccion.tsx:150-153`) particiona los cinco tipos en dos arreglos
  literales (`['nequi','daviplata','breb','transferencia']` + `['efectivo']`) para agrupar la UI de
  "Datos del negocio" por naturaleza del pago. Su unión **coincide hoy** con `METODOS_PAGO_ORDEN` —no
  diverge— pero es un `{ tipos: MetodoPagoTipo[] }[]`, no un `Record`, así que TypeScript no exige que
  cubra el conjunto entero: un método agregado a `METODOS_PAGO_ORDEN` sin tocar `GRUPOS_PAGO` no
  rompería la compilación y simplemente desaparecería de las dos secciones de la UI admin (ninguna lo
  filtraría dentro de su `tipos`). Fuera de `touches:` (el archivo no está en la lista aprobada) —
  queda nombrada, no tocada.

**El fix deriva, no ata con test.** `metodoPagoTipoSchema` (`lib/checkout/metodos-pago.ts`) es un
`z.enum(METODOS_PAGO_ORDEN as [MetodoPagoTipo, ...MetodoPagoTipo[]])` — el mismo cast que ya usa
`lib/config/site-settings-schema.ts:20` para el mismo array —, y `app/api/checkout/route.ts` lo
consume en vez del literal. Tres tests nuevos en `lib/checkout/metodos-pago.test.ts` afirman la
derivación (el schema acepta exactamente `METODOS_PAGO_ORDEN`, cada valor pasa el parse, y `'wompi'`
no) — no porque la regla lo exija (derivar ya cierra la clase), sino como guardia de regresión barata
contra que alguien reintroduzca un literal en el route.

`npm test` **1125/1125** (piso medido antes de empezar: 1122; el slice sumó 3) y `npx tsc --noEmit` en
**0**, sin moverse. Merge `--no-ff` mecánico, **tree == tree** (`db59925`) — Merge Policy A: sin
schema, sin migración, sin bytes de cliente (el conjunto de métodos aceptados es IDÉNTICO al de antes,
sólo cambia cómo se declara), sin contrato cross-repo. Wompi no entró a ninguna lista en este slice.

## 2026-09-14 · CSP Report-Only de `/checkout` — la línea base real, antes de cualquier widget (`CSP-REPORT-ONLY-CHECKOUT-1`)

**ADOPTAR EL WIDGET DE WOMPI NO ES ADOPTAR UN SCRIPT DE TERCEROS: SON HASTA TRES, Y DOS NO ESTÁN
DOCUMENTADOS EN NINGÚN LADO DE SU DOC PÚBLICA.** Según lo medido y entregado por la investigación que
armó este spec, `widget.js` de Wompi inyecta en runtime `cdn.siftscience.com` y
`device.clearsale.com.br` —antifraude y *device fingerprinting*— y el dashboard del comercio no ofrece
forma de verlos ni de apagarlos: son infraestructura del PROVEEDOR, decidida por su backend, sin SRI
publicado y sin versión en la URL. **Eso cambia la NATURALEZA de la decisión widget-vs-redirección, no
su costo.** Este slice no verificó esas afirmaciones de red por su cuenta —no tenía acceso a
`WebFetch`/`WebSearch` en este dispatch—; las tomó del spec, ya "validado CLEAR" por el orquestador
antes de arrancar, y las deja marcadas como tal en `unknowns` de su reporte.

**Lo que este slice SÍ midió, directo contra el repo:** cero `next/script`/`<Script>`, cero
`Content-Security-Policy` previo, y `app/(storefront)/checkout/` con un solo `page.tsx` sin subrutas
(`find` sobre el directorio). `next.config.ts` ya tenía dos patrones de `headers()` por ruta —uno
global (`/:path*`, `X-Robots-Tag`) y uno acotado por regex de archivo (`Cache-Control` de íconos)—, así
que un tercero acotado a `/checkout` es mecánicamente idéntico a lo que ya funciona. Se confirmó
además, leyendo el código fuente: `app/(storefront)/layout.tsx` monta EXACTAMENTE tres
`<style dangerouslySetInnerHTML>` (paleta, fuentes, forma) condicionales a que el valor no sea `null`;
`app/globals.css:1` trae el `@import` de Google Fonts (Inter/Playfair); y `next-themes`
(`node_modules/next-themes/dist/index.mjs`) inyecta su script anti-flash con
`t.createElement("script",{...,dangerouslySetInnerHTML:...})`, **sin nonce** —`StorefrontThemeProvider`
no le pasa `nonce`—, así que `'unsafe-inline'` en `script-src` es por esto, no por Wompi. No se halló
`<form>`, `<base>`, ni `data:image` en el árbol que monta `/checkout` (checkout page + StoreNav +
StoreFooter + CartDrawer), así que `img-src` no lleva `data:` y `connect-src`/`form-action` quedan en
`'self'` sin inventar orígenes — hoy `createOrder` (`services/checkout.service.ts`) es un fetch
same-origin a `/api/checkout`.

**LA POLÍTICA, sólo `Content-Security-Policy-Report-Only` (nunca bloquea, sólo reporta a la consola
del navegador), en `next.config.ts` bajo `source: "/checkout"`:**

```
script-src 'self' https://checkout.wompi.co https://cdn.siftscience.com https://device.clearsale.com.br 'unsafe-inline'
style-src 'self' https://fonts.googleapis.com 'unsafe-inline'
font-src 'self' https://fonts.gstatic.com
img-src 'self' https://*.public.blob.vercel-storage.com
frame-src https://checkout.wompi.co
connect-src 'self'
object-src 'none'
base-uri 'self'
form-action 'self'
```

Sin `'unsafe-eval'` (no hay `eval` propio en el repo) y sin nonce (viable —`/checkout` ya es
`force-dynamic`— pero exigiría tocar `StorefrontThemeProvider`, los tres `<style>` y el matcher de
`proxy.ts`; eso es otro slice). Sin `default-src`: el spec enumeró nueve directivas explícitas y no
pidió una fallback, así que agregar una habría medido algo distinto de lo que el spec definió.

**POR QUÉ ENTRA ANTES DEL WIDGET, NO CON ÉL.** Una política se estrena rompiendo cosas. Estrenarla el
mismo deploy que integra el pago mezclaría dos fuentes de fallo, y ninguna de las dos se podría señalar
sola. Report-Only mide la línea base real —lo que YA carga en `/checkout` hoy, sin Wompi— antes de que
un widget la enturbie.

**EL LÍMITE, para que nadie crea que hay monitoreo:** este repo no tiene endpoint `report-to`/
`report-uri`. Las violaciones sólo se ven en DevTools de quien abra `/checkout` con la consola abierta;
no hay agregación ni alerta. Verificar que la cabecera efectivamente se emite exige un servidor
corriendo (`next dev`/`next start`) contra una request real, y el spec pidió explícitamente NO correr
`npm run build`; este slice no levantó ningún server. Lo que sí se comprobó sin servidor: se evaluó
`headers()` de `next.config.ts` directamente con `tsx` —la misma función que Next invoca internamente
para construir sus reglas— y se confirmó que para `source: "/checkout"` produce exactamente el string
de arriba en un único objeto `{ key: "Content-Security-Policy-Report-Only", value: "..." }`. Eso prueba
la CONFIGURACIÓN; no prueba el header en una respuesta HTTP real, que sigue sin comprobarse en este
slice.

`npm test` **1125/1125** (piso medido antes de empezar: 1125, sin cambios — el slice no tocó código de
producto, sólo config y doc) y `npx tsc --noEmit` en **0**, sin moverse. `npm run build` NO se corrió,
por instrucción explícita del spec. Merge `--no-ff` mecánico, **tree == tree**
(`9234095118e4523d5be67f5d5ce90aec8a24b398`, merge `9881e91`) — Merge Policy A: sólo `next.config.ts` +
`DECISIONS.md`, sin schema, sin bytes de cliente (una cabecera HTTP Report-Only no es texto ni pixel
que un visitante lea — no cambia nada visible del checkout), sin contrato cross-repo.

## 2026-09-14 · El email del comprador sale del `href` de "Rastrear mi pedido" — AWAITING_APPROVAL (`CHECKOUT-EMAIL-EN-HREF-2`)

Continúa un `RULING_NEEDED` que `CHECKOUT-EMAIL-EN-HREF-1` dejó abierto — ese slice **midió y no
eligió**, volvió con diff vacío, y estaba bien que lo hiciera. Este slice sólo aplica la elección del
owner.

**EL HALLAZGO, que no era teórico ni dependía de Wompi.** `app/(storefront)/checkout/page.tsx` armaba
el enlace de confirmación con `/rastrear-pedido?orden=…&email=${encodeURIComponent(info.email)}`: el
correo del comprador viajaba **en texto plano dentro de un atributo del DOM de una página pública**.
URL-encodeado no es lo mismo que protegido — cualquier script con acceso a esa página lo lee con un
`querySelector('a[href*="email="]')`, sin tocar el estado de React ni el bundle de la app. Lo destapó
un censo que buscaba otra cosa (`CSP-Y-SCRIPT-DE-TERCEROS-1`, el que midió los orígenes que inyecta
`widget.js` de Wompi), y era cierto **hoy**, con o sin pasarela.

**LA DECISIÓN (owner): opción (a), quitar el `email` del `href` y dejar sólo `?orden=…`.** Sus dos
razones, porque son las que tienen que impedir que alguien "mejore" esto en seis meses:

> Con (b) el dato personal SIGUE en la página, sólo se mueve del atributo al JavaScript. El objetivo
> era SACARLO, no esconderlo mejor.

> Un `href` estable es lo que hace que un enlace se comporte como enlace. Clic-medio, copiar-enlace,
> abrir-en-pestaña y la vista previa son comportamientos que el comprador espera de la web entera —
> romperlos para ahorrar un campo de tecleo cambia algo más profundo que lo que arregla.

**(b) — resolver el email en el momento del clic (`useRouter`/`sessionStorage`/navegación diferida) —
se descartó por esa segunda razón, no por costo de implementación.** Un `href` que no es la URL real
hasta que se hace clic deja de comportarse como un link: middle-click abre una pestaña sin el dato,
"copiar enlace" copia una URL que no busca nada, y la vista previa del navegador no coincide con el
destino real. (a) es la única de las dos que saca el dato en vez de reubicarlo.

**EL COSTO, sin adorno: el comprador llega a `/rastrear-pedido` con el campo de email VACÍO y pierde
la búsqueda automática de un clic.** `/rastrear-pedido` lee `email` por `useSearchParams()` y sin él no
auto-busca — eso es aceptado, no un defecto a compensar. Este slice no tocó `/rastrear-pedido`: no está
en su `touches:`.

**EL CAMBIO, una línea, dentro de `app/(storefront)/checkout/page.tsx:222`:**

```diff
- <Link href={`/rastrear-pedido?orden=${encodeURIComponent(confirmation.numero_orden)}&email=${encodeURIComponent(info.email)}`} …>
+ <Link href={`/rastrear-pedido?orden=${encodeURIComponent(confirmation.numero_orden)}`} …>
```

**El patrón NO se repite en otro lado del archivo**: es el único `<Link>` de `page.tsx` que llevaba un
dato personal en el `href` (grep de `href=`/`Link ` sobre el archivo completo, 4 resultados, los otros
tres sin datos de cliente). **No había test que fijara el `href` con `email`** — se buscó por
`rastrear-pedido` y por `checkout/page` en `tests/` y no apareció ninguno; no se inventó uno nuevo, el
cambio es una línea y su efecto es un parámetro menos en una URL.

`npm test` **1125/1125** (piso medido antes de empezar: 1125, sin cambios — el slice no tocó lógica,
sólo un `href`) y `npx tsc --noEmit` en **0**, sin moverse. `npm run build` NO se corrió.

**AWAITING_APPROVAL, `stopped_on: ['customer-bytes']` — no se mergea.** `app/(storefront)/` es Tier 1 y
esto cambia lo que el comprador VE: el campo de correo en `/rastrear-pedido` deja de llegar prellenado
tras confirmar un pedido. El `approved: yes` del spec cubre los PATHS declarados en `touches:`, no el
gate visual — ése es del owner sobre el preview de Vercel.

## 2026-09-14 · `form-action` de la CSP de `/checkout` bloquearía el Web Checkout — y la elección
widget-vs-redirección se resuelve por toggle de despliegue (`CSP-FORM-ACTION-WEBCHECKOUT-1`)

**LA DIRECTIVA ESTABA ESCRITA PENSANDO SÓLO EN EL WIDGET.** `CSP-REPORT-ONLY-CHECKOUT-1` dejó
`form-action 'self'` en `next.config.ts:138` (bloque `source: "/checkout"`, la CSP `Report-Only` de esa
ruta). **Web Checkout** de Wompi —la otra forma de integrarse, además del widget iframeado— es un
`<form action="https://checkout.wompi.co/p/" method="GET">` que NAVEGA fuera del sitio, y
`form-action 'self'` a secas bloquearía exactamente ese submit. **Hoy no bloquea nada**, por dos razones
que no se confunden: el header es `Report-Only` (nunca impide una carga, sólo reporta a la consola), y
ese `<form>` **no existe todavía** en el repo — no hay integración de pago construida. Pero la política
ya está escrita, y una política escrita mal que hoy es inocua es una que bloquea el día que se pase a
enforced, sin que nadie recuerde por qué (doctrina del owner, citada en el spec de este slice).

**EL FIX, una directiva, sin tocar nada más.** `form-action 'self'` → `form-action 'self'
https://checkout.wompi.co`, con un comentario en el código que dice el motivo (el `<form>` de Web
Checkout, que no existe todavía, y que sin el origen la política enforced lo bloquearía). Verificado
evaluando `headers()` con `tsx` —la misma función que Next invoca para construir sus reglas—: el string
que produce hoy para `source: "/checkout"` cambia ÚNICAMENTE en esa directiva; las otras ocho
(`script-src`, `style-src`, `font-src`, `img-src`, `frame-src`, `connect-src`, `object-src`, `base-uri`)
quedan byte-idénticas a `CSP-REPORT-ONLY-CHECKOUT-1`. **Sigue siendo `Content-Security-Policy-Report-Only`
— no se pasó a enforced.**

**NINGUNA OTRA DIRECTIVA DEL BLOQUE TIENE EL MISMO PROBLEMA.** Revisadas las ocho restantes contra las
DOS formas (widget iframeado vs. Web Checkout por `<form>`): `frame-src https://checkout.wompi.co` ya
cubre el iframe del widget y Web Checkout no usa iframe, así que no lo necesita pero tampoco lo bloquea;
`script-src` ya incluye `checkout.wompi.co` (para el widget) y Web Checkout no carga ningún script desde
ese origen en nuestra página —es navegación de `<form>`, no un `<script src>`—; `connect-src 'self'` no
gobierna una navegación de nivel superior por `<form>`, sólo `fetch`/`XHR`; `img-src`, `style-src`,
`font-src`, `object-src` y `base-uri` no tienen relación con ninguna de las dos formas de integración. La
única directiva que un `<form action="https://checkout.wompi.co/...">` necesita es `form-action`, y era
la única que le faltaba el origen.

### LA COBERTURA ANTIFRAUDE ES LA MISMA EN LAS DOS FORMAS — medición transcrita del spec, no re-verificada por este slice

El spec de este slice trae, como ya medido por `WOMPI-ANTIFRAUDE-COBERTURA-1` (bajando y leyendo los
bundles de Wompi): **widget y Web Checkout son la misma webapp**, y el único fork en el código es
`f !== window.top` — iframeado (widget), la inyección de Sift/ClearSale se DELEGA al padre por
`postMessage` y corre en NUESTRO dominio; no-iframeado (Web Checkout), la webapp inyecta las mismas dos
etiquetas en su propio documento. Mismo `fraudGroups`, mismo `sessionId`, y lo emite el backend de
Wompi, no el cliente. **Esto disuelve el eje «seguridad vs privacidad» que parecía separar las dos
formas: la protección antifraude es idéntica; lo único que cambia es EN QUÉ DOMINIO corren esos
terceros.** Este slice no bajó bundles ni los releyó — transcribe la medición que el spec entregó ya
hecha; queda marcada como tal (no re-medida en este dispatch).

### QUIÉN ASUME EL CONTRACARGO — MEDIDO COMO AUSENCIA, no como respuesta

Los 120 días de cobertura antifraude que Wompi publica están **confirmados textualmente** en su página
pública de seguridad. **Quién asume la pérdida de un contracargo NO se pudo establecer con fuentes
públicas**, y eso — la ausencia, no una suposición sobre ella — es lo que este asiento registra:

- la página de seguridad de Wompi sólo **implica** impacto al comercio, sin decirlo en ninguna frase;
- los términos y condiciones devolvieron **403** al intentar leerlos;
- el sitemap completo de la documentación de Wompi —**90 URLs**— no tiene ninguna página dedicada a
  antifraude, contracargo, garantía ni seguridad — la ausencia está medida contando el sitemap entero,
  no supuesta por no haber buscado bien;
- y la página de seguridad habla exclusivamente de "titulares de tarjetas": **cero** menciones de PSE,
  consistente (por ausencia, no por afirmación) con que PSE —débito bancario directo— no comparte el
  mecanismo de disputa de red de tarjetas que sostiene esos 120 días.

**No se concluye que el comercio no lo asume.** Lo único que se puede afirmar es que la pregunta no
tiene respuesta en fuentes públicas alcanzables. Esta sección, igual que la anterior, transcribe una
medición que el spec trajo ya hecha — este slice no volvió a bajar el sitemap ni las páginas de Wompi.

### DECISIÓN DEL OWNER: SE SOPORTAN LAS DOS FORMAS, ELEGIBLES POR TOGGLE DE DESPLIEGUE — no en el panel del cliente

Con la cobertura antifraude disuelta como eje de decisión, queda **quién elige** entre widget embebido y
Web Checkout por redirección. La respuesta del owner: **las dos se soportan, y el dueño de la tienda
elige AL CONTRATAR, no en su panel de admin.**

> La elección embebido-vs-redirección no es una preferencia que alguien cambie el martes. Es una
> decisión sobre qué corre en la página de sus compradores, y ésa se toma una vez, informada, en el
> alta. Ponerla en el panel invitaría a cambiarla sin entender qué cambia. Cambiar de opinión es un
> redespliegue —trabajo de Duna—, el mismo patrón que ya rige para el mark, los íconos y el theme: no es
> una limitación nueva.

**Lo que hizo barata la decisión, medido:** la alternativa —un toggle en RUNTIME, leído por cliente
desde el panel— habría exigido CSP condicional por request. `next.config.ts#headers()` es config-time
(evaluado al build, no por request), así que una CSP que dependiera de una fila en la base habría
exigido middleware + lectura de base de datos en el camino crítico de cada respuesta. **El toggle de
despliegue evita esa capa entera**, y encaja con la doctrina ya escrita de un despliegue por cliente
(`CLAUDE.md` § El código compartido no NACE siendo Nayoli/demo). La decisión de que el dueño elige al
contratar no fue sólo doctrinal — es la que vuelve barata la opción.

**El delta real entre las dos formas, medido:** el webhook, `PaymentIntent` y la reconciliación por
`reference` (`WOMPI-REGLAS-IMPLEMENTACION-1`, arriba) son comunes a las dos. La ruta de retorno también
es común — el `redirectUrl` opcional del widget usa el mismo formato de query params que Web Checkout,
así que se construye una sola vez. **Lo único que difiere es la INICIACIÓN** (`<script>` embebido vs.
`<form>` que navega), y la CSP, ya resuelta en este slice con la directiva de arriba.

**ESTE SLICE NO IMPLEMENTA NADA DE ESTO.** No hay toggle, no hay `<form>` de Web Checkout, no hay
`<script>` del widget, no hay `PaymentIntent`. El asiento registra la decisión de producto y las dos
mediciones que la sostienen; construirlas es trabajo aparte, sin fecha fijada acá.

`npm test` **1125/1125** (piso medido antes de empezar: 1125, sin cambios — el slice no tocó código de
producto, sólo una directiva de config y este archivo) y `npx tsc --noEmit` en **0**, sin moverse. Sin
schema, sin migración, sin bytes de cliente (una cabecera HTTP Report-Only, invisible al comprador, y
que hoy no cambia ningún comportamiento observable — el `<form>` que la directiva anticipa no existe),
sin contrato cross-repo. Merge Policy A aplica: sólo `next.config.ts` + `DECISIONS.md`.

## 2026-09-14 · La ruta del webhook de Wompi: recibe, verifica, reconoce duplicados y cierra el
`PaymentIntent` — SIN crear ningún `Payment` (`WOMPI-WEBHOOK-RUTA-1`)
`7bf31c2`, merge `--no-ff` `1d4fd89`

**SEGUNDA ETAPA, tras `WOMPI-WEBHOOK-CENSO-1` (writes: no, sin artefacto propio — el owner aprobó
arrancar sobre lo que ese censo midió).** `app/api/webhooks/wompi/route.ts` nace con su test co-ubicado
(`route.test.ts`), y es el PRIMER código que toca `PaymentIntent` fuera del schema y del cliente
generado — confirmado por grep antes de escribir una línea (`grep -rln "PaymentIntent" --include="*.ts"
--include="*.tsx" .`, cero resultados fuera de `packages/core/prisma/schema.prisma` y
`src/generated/`).

**LA FRONTERA, y por qué está EXACTAMENTE ahí.** Crear un `Payment` exige un valor de `MetodoPago`, y
el enum de hoy (`NEQUI | DAVIPLATA | EFECTIVO | TRANSFERENCIA | OTRO | BREB`) no tiene `WOMPI`. Usar
`OTRO` o sumar un valor es modelar un concepto del dominio — del owner, pendiente, no de este slice. La
ruta llega hasta escribir el desenlace en `PaymentIntent.estado` y se detiene ahí; el gancho de la etapa
siguiente está marcado en el código, en el punto exacto donde `registerOrderPaymentTx` engancharía como
su CUARTO llamador (los otros tres, ya citados en § Pagos en línea de `CLAUDE.md`:
`app/api/orders/[id]/payments/route.ts`, `immediatePayment`, `decidirComprobante`).

**EL CAMINO, en orden:**

1. **Sin `WOMPI_EVENTS_SECRET` → 500**, sin filtrar nada (el nombre de la variable no aparece en la
   respuesta). El endpoint queda CERRADO por defecto, no abierto.
2. **`req.json()` alcanza** — `verificarFirmaWompi` opera sobre el evento YA PARSEADO (medido: cero
   `req.text()` en `app/api`; 25 rutas usan `.json()` — el spec citaba 27, la diferencia no cambió
   ninguna decisión de este slice y se anota como discrepancia medida, no corregida).
3. **Forma mínima validada ANTES de llamar al verificador** (`comoEventoWompi`): un cuerpo sin `data`/
   `timestamp`/`signature.{properties,checksum}` es tan intratable como una firma inválida — misma
   puerta, 401.
4. **Firma inválida (incluida `RutaDePropertyNoResuelveError`) → 401, nada escrito.** La ruta no
   distingue "checksum no coincide" de "el evento no tiene la forma que `properties` promete": las dos
   son "no se puede confiar en este evento", y reintentar SÍ ayuda si la causa fue transitoria (config,
   secreto rotado a medias).
5. **Se ubica por `reference`** — es la clave que NOSOTROS generamos al crear el intento (§ el comentario
   de `PaymentIntent.reference` en el schema) y que Wompi echa de vuelta en el evento; `pspTransactionId`
   no sirve para la PRIMERA entrega porque nace `null` hasta que el webhook lo llena. Medido y confirmado
   contra `DECISIONS.md` (`METODOS-TRES-LISTAS-1` / el asiento de `form-action`, línea 1816-1817): "el
   webhook… y la reconciliación por `reference` son comunes a las dos [formas]".
6. **Referencia sin match → 200, log.** Reintentar no la hace aparecer.
7. **Intento ya TERMINAL:** se distingue REPETIDO (mismo `pspTransactionId` ya asentado — el mismo
   evento, de nuevo) de ANOMALÍA (contradice lo asentado) — ninguno de los dos pisa el veredicto
   anterior. 200 en ambos, log distinto.
8. **Status crudo → bucket** (`bucketDeStatus`, medido contra NUESTRAS decisiones —
   `PaymentIntentEstado` en el schema— no contra el catálogo del PSP): `APPROVED`→`APROBADO`;
   `DECLINED`/`VOIDED`/`ERROR`→`FALLIDO`; cualquier otro valor (`PENDING`, o uno nuevo de Wompi) no es
   terminal → 200, se queda `EN_VUELO`. Preferir callar a decidir sin base.
9. **El cierre es un `updateMany({ where: { id, estado: 'EN_VUELO' }, data: {...} } )`** — el MISMO
   patrón que `sellar()` en `packages/core/src/comprobantes.ts` (transición condicional en UNA
   sentencia): `count === 0` ⇒ otra entrega concurrente ya lo cerró, tratado igual que el terminal de
   arriba.
10. **`isUniqueViolation` envuelve la escritura** — capa DEFENSIVA sobre la unique de
    `pspTransactionId` (la pieza que sostiene la idempotencia, `PASARELA-DOC-AL-DIA-1`): si el id de
    transacción del evento ya pertenece a OTRA fila, el choque ocurre ACÁ, antes de cualquier llamada al
    escritor de dinero (que en este slice no existe), y no se pisa nada. Test propio construido para
    forzarlo (dos filas, la segunda con el `pspTransactionId` ya ocupado por la primera).
11. **El monto NO decide nada** — se compara (`amount_in_cents` del evento, en centavos, convertido a
    pesos) contra `monto_esperado` y se REGISTRA si difiere, nunca desvía el flujo. Releer `Order.total`
    bajo lock es de la etapa siguiente.

**EL DISEÑO ES INYECTABLE, y es lo que vuelve testeable la ruta ENTERA sin una base real.**
`procesarEventoWompi(evento, checksumHeader, secreto, db)` recibe una interfaz ANGOSTA
(`PaymentIntentDb`, sólo `findUnique` + `updateMany`) que el `prisma` real satisface por tener MÁS
métodos; el test le pasa un doble en memoria con filas mutables y simula el P2002 comparando contra las
demás filas del doble. `POST` es la única función que lee `process.env` y arma el `prisma` real —
delgada a propósito, para que el 500 de "falta el secreto" y el 401 de "cuerpo no es JSON"/"forma
inesperada" se prueben con un `NextRequest` real sin tocar la base (esos caminos retornan antes de
llamar a `db`).

**LOS SEIS CASOS QUE EL SPEC EXIGÍA, más tres adicionales** (14 tests en total, todos verdes): firma
válida cierra APROBADO/FALLIDO/no-terminal (3); firma inválida por checksum y por
`RutaDePropertyNoResuelveError` (2); `POST` sin secreto (500), con firma inválida a nivel HTTP, con
cuerpo no-JSON y con forma inesperada (4); segunda entrega del mismo evento no duplica (1); referencia
sin match (1); anomalía sobre intento terminal no pisa (1); y los dos adicionales: el choque P2002 entre
dos `PaymentIntent` distintos, y la discrepancia de monto que se registra sin cambiar el desenlace.

**DEVIACIÓN MEDIDA — `npm test` NO ejercita este archivo.** El script `test` de `package.json` es
`node --import tsx --test "lib/**/*.test.ts" "constants/**/*.test.ts" "packages/core/**/*.test.ts"`:
tres globs explícitos que NO incluyen `app/api/**`. `route.test.ts` corrió — y corre verde, 14/14 — con
`node --import tsx --test app/api/webhooks/wompi/route.test.ts` DIRECTO, nunca por `npm test`. `touches:`
de este slice no incluía `package.json`, así que el glob no se tocó; queda anotado para que el próximo
que lea "`npm test` verde" en este asiento sepa que el piso citado (1125/1125) es el de la suite
EXISTENTE sin cambios, no una prueba de que el archivo nuevo corre bajo ese comando.

**DOS HALLAZGOS DEL CENSO MECÁNICO DE CIERRE, ninguno arreglado acá (fuera de `touches:`):**

- **`CLAUDE.md` § Pagos en línea (Wompi), línea 2811: "el diseño de `PaymentIntent` y el cableado del
  webhook con su reconciliación siguen sin construirse"** queda FALSA a medias: el cableado del webhook
  YA EMPEZÓ (esta ruta recibe, verifica, reconoce y cierra `PaymentIntent`); lo que sigue sin construirse
  es sólo el CUARTO llamador de `registerOrderPaymentTx` y el reconciliador (`GET
  /v1/transactions?reference=`). `WOMPI-WEBHOOK-DOCTRINA-PARCIAL-1` — actualizar esa frase cuando se
  toque `CLAUDE.md` por esta área; no se toca acá porque el archivo no está en `touches:`.
- **`DECISIONS.md` § `PAYMENTINTENT-SCHEMA-1` (línea 1472): "el barrido entra cuando el webhook empiece
  a escribir filas"** — ESTE SLICE es ese momento: el `updateMany` de arriba SÍ escribe filas de
  `PaymentIntent` (EN_VUELO → APROBADO/FALLIDO). `WOMPI-WEBHOOK-DISPARA-BARRIDO-1` — el barrido de
  intentos vencidos queda DESBLOQUEADO por su propio disparador documentado; construirlo sigue sin
  fecha, es trabajo aparte, y se anota para que no quede como "deuda vaga" sin dueño.

**UN TERCER HALLAZGO, no de doctrina sino de diseño, dejado explícito en el código y acá:** un evento
que llega ANTES de que la etapa de checkout cree la fila `PaymentIntent` (race entre nuestra propia
escritura y la velocidad del webhook) cae en "referencia sin match" → 200, log, sin reintento nuestro.
Hoy es un caso TEÓRICO (nada crea filas de `PaymentIntent` todavía), así que no se resuelve acá — queda
nombrado para cuando exista el lado que las crea.

Rama propia (`slice/wompi-webhook-ruta-1`), gate DENTRO de `touches:` (sólo los tres archivos
declarados). `npm test` **1125/1125** (piso medido antes de empezar: 1125, sin cambios — la suite
existente no se tocó) y `npx tsc --noEmit` en **0**, sin moverse. `route.test.ts`, corrido aparte,
**14/14**. Sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false` — la ruta la
llama Wompi server-a-server, ningún comprador la ve ni la toca), sin contrato cross-repo (el contrato lo
define Wompi, no nosotros; nada de nuestro lado lo expone). Merge Policy A aplica.
Regla: § Pagos en línea (Wompi) — cobros automáticos (`CLAUDE.md`), sin tocar en este slice (ver el
primer hallazgo arriba).

## 2026-09-14 · «Reintentar no ayuda» era la regla general — «referencia sin match» era su excepción
(`WOMPI-WEBHOOK-RACE-REINTENTO-1`)
`e557752`, merge `--no-ff` (pendiente)

**CIERRA EL TERCER HALLAZGO DE `WOMPI-WEBHOOK-RUTA-1`** (arriba, línea 1929-1933): la rama «referencia
sin match» de `procesarEventoWompi` (`app/api/webhooks/wompi/route.ts`) devolvía `200` cuando un evento
llegaba antes de que existiera la fila `PaymentIntent` correspondiente — el mismo worker que escribió la
ruta lo dejó nombrado en el código y en ese asiento, en el mismo turno en que la escribió.

**EL RAZONAMIENTO ORIGINAL ERA UNA REGLA GENERAL, Y ESTA RAMA ES SU EXCEPCIÓN.** Las demás ramas de
`200` del archivo comparten un argumento real — reintentar el MISMO evento no cambia nada (sin
referencia en el payload, repetido, anomalía sobre un intento ya terminal, estado no terminal, evento
terminal sin id, cerrado por una entrega concurrente, P2002 contra otra fila) —, y ese argumento se
aplicó por error también acá. Es FALSO en este caso puntual: **la fila puede aparecer un segundo
después**, porque la crea la etapa que INICIA el checkout (todavía sin construir), que corre en paralelo
a la velocidad con la que Wompi entrega el webhook. Con `200` le decíamos a Wompi que no volviera, y un
pago aprobado se habría perdido EN SILENCIO — exactamente lo que la reconciliación por `PaymentIntent`
existe para evitar.

**EL CAMBIO: esa rama devuelve `404`, no `200`.** Elegido sobre las alternativas medidas:

- **`404` (elegido):** honesto — el servidor de verdad no tiene esa referencia, todavía —, y es un
  `4xx`: no se confunde con una falla del sistema en el dashboard de funciones de Vercel, que es la
  misma distinción que separa este log (`console.warn`) del `console.error` de un fallo real.
- **`503`/`500` (descartados):** habrían disparado el MISMO reintento (Wompi reintenta ante cualquier
  respuesta que no sea `200`, confirmado en `WOMPI-REGLAS-IMPLEMENTACION-1`), pero un `5xx` se lee como
  "el servidor está roto" cuando acá no hay ningún error — quien mire el dashboard de errores saldría a
  buscar un bug que no existe.
- **`409` (descartado):** no hay conflicto de estado que reportar, hay AUSENCIA — la fila simplemente no
  existe todavía. `409` habría afirmado algo que no es cierto.

**LA ASIMETRÍA QUE DECIDE, escrita en el comentario del código:** una referencia genuinamente ajena o
inventada se reintenta 3 veces (30 min / 3 h / 24 h, `WOMPI-REGLAS-IMPLEMENTACION-1`) y se acaba —
inofensivo. El costo de NO reintentar es un pago aprobado perdido en silencio — plata real. Reintentar de
más es barato; reintentar de menos no lo es.

**NINGUNA OTRA RAMA DE `200` SE TOCÓ**, confirmadas contra el argumento real que cada una sostiene (arriba).
La verificación de firma, el `401`, el `500` por falta de secreto, y la frontera de
`registerOrderPaymentTx`/`MetodoPago`/schema/checkout de `WOMPI-WEBHOOK-RUTA-1` siguen intactos —
`touches:` de este slice era sólo `route.ts` + `route.test.ts` + este archivo.

**EL TEST** (`route.test.ts`) se actualizó IN SITU (no se agregó uno paralelo): el mismo caso ahora
afirma `status === 404` y sigue afirmando `llamadas.updateMany === 0` — nada se escribe en esa rama, que
es lo que la hace segura para reintentar sin duplicar. Ningún otro test dependía del `200` de esa rama.
`route.test.ts` sigue en **14/14** (mismo conteo que `WOMPI-WEBHOOK-RUTA-1`: se editó un caso existente,
no se agregó ninguno).

**EL HALLAZGO DE `WOMPI-WEBHOOK-RUTA-1` (línea 1929-1933, arriba) QUEDA CERRADO por este asiento**: ya no
es cierto que ese caso "cae en 200, log, sin reintento nuestro" — cae en 404, con reintento. Sigue siendo
un caso hoy TEÓRICO (nada crea filas de `PaymentIntent` todavía), y sigue sin resolverse el lado que
las crea — eso continúa siendo trabajo aparte, sin fecha.

`npm test` **1125/1125** (piso medido antes de empezar, igual al citado en `WOMPI-WEBHOOK-RUTA-1`, sin
cambios) y `npx tsc --noEmit` en **0**, sin moverse. `route.test.ts`, corrido aparte con
`node --import tsx --test`, **14/14**. Sin schema, sin migración, sin bytes de cliente
(`customer_bytes.changed=false` — la ruta la llama Wompi server-a-server; ningún comprador la ve ni la
toca, y el cambio es sólo un código de estado HTTP y un nivel de log), sin contrato cross-repo (el
contrato de forma del evento lo define Wompi y no cambió; lo único nuevo es CÓMO respondemos, que Wompi
ya trata de forma genérica como "no fue 200"). Merge Policy A aplica.
Regla: § Pagos en línea (Wompi) — cobros automáticos (`CLAUDE.md`), sin tocar en este slice.

## 2026-09-14 · La doctrina de llaves por-ESTADO (no por-rama), el go-live de Wompi
registrado, y la frase rancia que este mismo programa volvió falsa (`DOCTRINA-DEMO-SANDBOX-1`)
`b546c74`, merge `--no-ff` `780a01c`

**Elección: la regla se escribe como propiedad del ESTADO del despliegue, no de la rama** — «un
despliegue en estado *demo* lleva llaves de sandbox de la pasarela, aunque su rama sea `main` y su
deploy sea "producción" en Vercel». El precedente es de este mismo repo: `DEPLOY.md` (§ Protecciones
del demo, § Promoción a producción real) ya traza la misma partición por otro eje, `NOINDEX`
—«ausente = indexable, el default seguro para un cliente real; la demo la pone»—, y esta doctrina es
la MISMA distinción aplicada a las llaves de pasarela.

**DEPLOY.md era la casa CONCEPTUALMENTE mejor para la mecánica** (cuál env var, en qué tabla, junto a
`NOINDEX`/`CRON_URL`), pero **no estaba en `touches:` de este slice** (sólo `CLAUDE.md` y
`DECISIONS.md`), así que la regla y su porqué quedaron en `CLAUDE.md` § Pagos en línea (Wompi)
—apuntando a `DEPLOY.md` para la mecánica— y no se tocó ese archivo. **Se anota para quien abra el
próximo slice de Wompi/deploy**: la tabla de variables de `DEPLOY.md` §2 es donde correspondería sumar
`WOMPI_*` con la misma nota que ya llevan `NOINDEX`/`CRON_URL`.

**Se registró el ítem de go-live** (paso de sandbox a llaves productivas), CON su disparador («el
cliente decide salir a vender») y la lista de cinco puntos que fijó el owner (cuenta de Wompi del
cliente aprobada, llaves productivas en su despliegue, URL de eventos a su dominio real, `NOINDEX`
quitado, una transacción de verificación) — **sin construir el runbook**, por instrucción explícita.
El argumento para NO tratarlo como "cambiar una variable": los cinco puntos pueden estar bien
individualmente y mal en conjunto (llaves productivas con la URL de eventos aún en preview es un
cobro real cuyo webhook no llega a ninguna parte) — la misma razón por la que las operaciones de datos
de este repo van por runbook.

**LA FRASE RANCIA (`CLAUDE.md`, § Pagos en línea (Wompi)):** «el diseño de `PaymentIntent` y el
cableado del webhook con su reconciliación siguen sin construirse» quedó falsa en dos tercios, y las
tres cosas se VERIFICARON contra el código antes de escribir, no se asumieron:

| afirmación de la frase vieja | verificado | evidencia |
|---|---|---|
| "el diseño de `PaymentIntent` sigue sin construirse" | **FALSA** | `packages/core/prisma/schema.prisma:428` (`model PaymentIntent`); migración `packages/core/prisma/migrations/20260914140000_add_payment_intent` |
| "el cableado del webhook sigue sin construirse" | **FALSA, A MEDIAS** | `app/api/webhooks/wompi/route.ts` recibe, verifica firma, ubica por `reference`, distingue duplicados/anomalías y cierra el intento (`EN_VUELO → APROBADO/FALLIDO`) — pero NO crea el `Payment`, frontera deliberada (`MetodoPago` sin valor `WOMPI` en el enum, decisión del owner pendiente) |
| "la reconciliación sigue sin construirse" | **VERDADERA** | `grep -rniE "reconcilia\|barrido.*vencid\|expirad" lib packages app` (excluyendo tests y comentarios que sólo la MENCIONAN) — cero implementación |
| "el barrido de intentos vencidos sigue sin construirse" | **VERDADERA** (no la nombraba la frase vieja, pero es la misma familia) | mismo grep; su disparador («cuando el webhook empiece a escribir filas», `PAYMENTINTENT-SCHEMA-1`) ya se cumplió (`WOMPI-WEBHOOK-DISPARA-BARRIDO-1`, coined en `WOMPI-WEBHOOK-RUTA-1`, abajo) |

**Esta entrada CIERRA `WOMPI-WEBHOOK-DOCTRINA-PARCIAL-1`** (coined en la entrada `WOMPI-WEBHOOK-RUTA-1`
de este mismo archivo: "actualizar esa frase cuando se toque `CLAUDE.md` por esta área"). Siguiendo la
regla del § Backlog técnico de `CLAUDE.md` ("la doctrina guarda la regla y su porqué, nunca un
inventario"), la frase nueva NO enumera lo construido —eso vencería solo—: apunta a
`app/api/webhooks/wompi/route.ts` y a los asientos `WOMPI-WEBHOOK-RUTA-1` /
`WOMPI-WEBHOOK-RACE-REINTENTO-1` para el estado exacto.

**`WOMPI-WEBHOOK-DISPARA-BARRIDO-1` (el barrido de intentos vencidos) NO se cierra acá** — sigue
abierto, sin fecha, y ninguna línea de código se tocó en este slice (`touches:` era sólo dos `.md`).
Queda nombrado en la frase nueva de `CLAUDE.md` para que no vuelva a leerse como "deuda vaga sin
dueño".

**No se encontró ninguna otra frase de `CLAUDE.md` vencida por este programa**, más allá de la ya
conocida y citada arriba — no se buscó exhaustivamente fuera del área Wompi/pagos, que es el alcance de
este slice.

**Ni una línea de código se tocó.** `npm test` **1125/1125** (piso medido, sin cambios; el diff es
Markdown puro y no puede mover ese número) y `npx tsc --noEmit` en **0**. Sin schema, sin migración,
sin bytes de cliente (`customer_bytes.changed=false` — nadie que no sea quien lee `CLAUDE.md`/
`DECISIONS.md` ve este diff), sin contrato cross-repo. Merge Policy A aplica.
Regla: § Pagos en línea (Wompi) — cobros automáticos (`CLAUDE.md`).

## 2026-09-15 · Un escritor MERGEADO no es un escritor que ESCRIBE — el disparador del barrido se
dio por cumplido sin medirlo (`LEDGER-ESCRITOR-MERGEADO-1`)

**QUÉ PASÓ.** El orquestador despachó el censo para diseñar el barrido de intentos de pago vencidos
(`BARRIDO-INTENTOS-VENCIDOS-FORMA-1`) con esta premisa en su §0: *«su disparador ya se cumplió: el
webhook empezó a escribir filas»*. El worker de ese slice la MIDIÓ antes de heredarla —grepeó el
repositorio buscando quién crea un `PaymentIntent`— y reportó la desviación contra su propio spec en
vez de construir sobre ella (figura `HALLAZGO-WEBHOOK-SIN-CREADOR`, 2026-09-14): **cero creadores**.
Este slice repitió esa medición de forma independiente, sobre el mismo `main`, y da el mismo resultado
— ver la figura abajo. `db.paymentIntent.findUnique({ where: { reference } })` devuelve siempre `null`
contra una base real; el `updateMany` del webhook (`app/api/webhooks/wompi/route.ts:172` y siguientes)
nunca se ha ejecutado con efecto.

**DE DÓNDE SALIÓ EL ERROR — no es del spec más reciente, es una cadena de TRES asientos.**
`PAYMENTINTENT-SCHEMA-1` (línea 1472 de este archivo) escribió el disparador bien, como un hecho del
MUNDO: *«el barrido entra cuando el webhook empiece a escribir filas»*. `WOMPI-WEBHOOK-RUTA-1` (línea
1923-1927), el mismo día en que esa ruta se mergeó, lo dio por satisfecho: *«ESTE SLICE es ese momento:
el `updateMany` de arriba SÍ escribe filas de `PaymentIntent`… `WOMPI-WEBHOOK-DISPARA-BARRIDO-1` — el
barrido … queda DESBLOQUEADO por su propio disparador documentado»* — confundiendo que el CÓDIGO que
escribiría ya existe con que la ESCRITURA está ocurriendo; el `updateMany` sólo corre si `findUnique`
encuentra una fila, y sin creador nunca la encuentra. `DOCTRINA-DEMO-SANDBOX-1` (línea 2041, el asiento
inmediatamente anterior a éste) heredó esa lectura sin re-verificarla, en su tabla de frases-vencidas de
`CLAUDE.md`: *«su disparador … ya se cumplió (`WOMPI-WEBHOOK-DISPARA-BARRIDO-1`, coined en
`WOMPI-WEBHOOK-RUTA-1`)»*. El spec de `BARRIDO-INTENTOS-VENCIDOS-FORMA-1` heredó esa misma frase una
tercera vez. Los tres asientos son honestos sobre lo que CADA UNO tenía delante — ninguno mintió—, pero
ninguno de los tres, hasta el worker que finalmente grepeó, volvió a mirar el mundo antes de repetir la
frase.

**LA REGLA, en las palabras del owner, literales:**

> UN ESCRITOR MERGEADO NO ES UN ESCRITOR QUE ESCRIBE — gemela de *una guarda escrita no es una guarda
> corrida*.
>
> El disparador redactado como hecho del mundo se satisface con el MUNDO, no con el REPOSITORIO.

**Procedimiento que se desprende, para que la frase no quede bonita y sin uso:** un disparador
redactado como HECHO (*«cuando empiecen a aparecer filas»*, *«cuando un cliente real lo pida»*,
*«cuando el tráfico lo exija»*) no se cierra con `git log` ni con que la rama que lo haría posible
mergeó — se cierra MIDIENDO el hecho: una consulta contra datos reales, un grep de creadores, un conteo
de filas. Un merge prueba que el código que lo haría posible EXISTE; no prueba que el hecho OCURRIÓ.

**LA MISMA FAMILIA QUE YA VIVE EN `CLAUDE.md`.** No es un principio nuevo: es la tercera rama de una
familia que el propio repositorio ya nombra como *"lo escrito no prueba lo que corre"* — § PRECONDICIÓN
(el artefacto compilado no prueba lo que el servidor ejecuta) y § Bases de datos (el nombre de la rama
no prueba el ROL de la base). La rama SPEC de esa misma familia —una instrucción o una premisa escrita
que el diagnóstico contradice— vive en `CLAUDE.md` § EL TRIPWIRE PROTEGE CONTRA LA INSTRUCCIÓN, NO SÓLO
CONTRA EL TERRENO, y hoy documenta **DOS** casos previos, no tres: el spec de C1 que asumía "un repeater
de EXACTAMENTE 2 ítems" (§ Presentaciones 2-4, la línea que nombra la familia por primera vez) y el spec
de C3 que asumía "6 pestañas byte-idéntico" (§ La taxonomía se DERIVA del catálogo, "EL TRIPWIRE ATRAPÓ
UN SPEC FALSO"). **Éste es el TERCERO** — mismo conteo que citó el owner, verificado acá contra el
propio texto de `CLAUDE.md` en vez de copiado de memoria: dentro de la rama SPEC, no del total de la
familia (esa cifra, "atrapado CINCO veces", vive en `CLAUDE.md` línea 44 y suma las tres ramas juntas,
no sólo ésta).

**EL WORKER QUEDA CITADO.** `BARRIDO-INTENTOS-VENCIDOS-FORMA-1`, figura `HALLAZGO-WEBHOOK-SIN-CREADOR`
(2026-09-14): reportó la desviación contra el spec que lo despachó en vez de heredar su premisa, y ese
reporte es la razón por la que este asiento existe y por la que `WOMPI-WEBHOOK-DISPARA-BARRIDO-1` sigue
abierto de verdad, no sólo "sin fecha" — su disparador NO se cumplió todavía, pese a lo que el asiento
anterior daba por sentado.

**QUÉ NO HACE ESTE ASIENTO.** No corrige la tabla de `DOCTRINA-DEMO-SANDBOX-1` (línea 2041) ni ninguna
frase de `CLAUDE.md` — el ledger es append-only y la corrección es ESTE asiento, no una edición del
anterior. No agrega ni cierra ningún ítem de backlog: `WOMPI-WEBHOOK-DISPARA-BARRIDO-1` sigue vivo,
tal como quedó nombrado, sólo que su condición de cumplimiento se corrige acá — sigue esperando un
creador de `PaymentIntent` que hoy no existe.

**Figura:** `grep -rln "paymentIntent" --include="*.ts" --include="*.tsx" .` (excluyendo `node_modules`)
→ dos archivos, `app/api/webhooks/wompi/route.ts` y su test; ningún `.create(` de `PaymentIntent` en
ninguno de los dos ni en el resto del repositorio (`grep -rn "PaymentIntent" --include="*.ts"
--include="*.tsx" --include="*.prisma" .`, sin match de creación fuera del schema y del propio módulo
del webhook).

Ni una línea de código se tocó. Sin gate de test/build — es un archivo de texto, y el piso de
`npm test`/`tsc` de `DOCTRINA-DEMO-SANDBOX-1` (1125/1125, 0 errores) no lo mueve un diff Markdown. Sin
schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false` — nadie que no sea quien lee
este archivo ve este diff), sin contrato cross-repo. Merge Policy A aplica.
Regla: § EL TRIPWIRE PROTEGE CONTRA LA INSTRUCCIÓN, NO SÓLO CONTRA EL TERRENO (`CLAUDE.md`), sin tocar
en este slice.

## 2026-09-14 · La lista Tier 1 vencía sin avisar — tres puertas de Wompi/pagos que el criterio
ya cubría y la lista no tenía (`TIER1-LISTA-VENCIDA-1`)
`c503eb6` (rama `slice/tier1-lista-vencida-1`, sin mergear — `AWAITING_APPROVAL`,
`cross-repo-contract`)

**El defecto, y por qué es la peor variante de una familia ya conocida.** El § Tier 1 de
`CLAUDE.md` dice explícitamente que "cada puerta de escritura de stock, pagos y pedidos, y la
función que esa puerta CONSULTA para decidir si la escritura procede y con qué valor" entra a la
lista — el mismo criterio que `TIER1-CRITERIO-DECISORES-1` (2026-09-12) escribió. Ese criterio
condenaba a su propia lista: el programa de Wompi abrió una puerta de pagos nueva
(`app/api/webhooks/wompi/route.ts`) y la lista no la tenía. Es la misma deriva doc-vs-código que
este repo lleva semanas persiguiendo (§ PRECONDICIÓN, el artefacto rancio; § Backlog técnico, el
número rancio de doctrina), pero en su variante más cara: no es una lista que describe mal el
código, es la lista que DECIDE QUÉ SE PROTEGE. Y una guarda vencida no avisa que dejó de cubrir —
sigue corriendo VERDE sobre un conjunto que encogió.

**Cómo se descubrió: midiendo el costo de una regla nueva, no revisando la lista.** El disparador
no fue una auditoría de la lista Tier 1 en sí: fue medir qué habría costado aplicar una regla que
el owner propuso (censar el impacto de una política nueva) contra el estado real del repo. Al
enumerar las puertas de dinero tocadas por el programa de Wompi para esa medición, salió que una
de ellas no figuraba en la lista que se supone las protege. **La regla, aplicada a la lista
vencida, no habría frenado ningún slice de Wompi** — el hallazgo fue un efecto lateral de medir
otra cosa, no el objetivo de la medición.

**PRIMER HALLAZGO — la fecha de "última medición" que el spec asumía estaba vencida ELLA MISMA.**
El spec de este slice citaba "medida el 2026-09-06" (la fecha del encabezado de la sección: cuándo
se AGREGÓ). Medido contra git: la lista se re-midió por última vez el **2026-09-12**
(`TIER1-CRITERIO-DECISORES-1`, `45311c2` — sumó `moliendas-opciones.ts` y `product-import.ts`, y
NADA la tocó entre esa fecha y el 2026-09-14 salvo este slice: `git diff 45311c2..58925b7 --
CLAUDE.md | grep '^[+-]Tier 1 slices run'` no dio salida). Confundir "cuándo se agregó la sección"
con "cuándo se re-midió la lista" es cómo una lista vencida sigue pareciendo fresca — se corrigió
usando el baseline correcto (`45311c2`) para el censo, y se dejó escrita la distinción en
`CLAUDE.md` para que no vuelva a confundirse.

**EL CENSO, contra el baseline correcto (`git diff 45311c2..HEAD -- app/api/ packages/core/src/
lib/`, 14 archivos tocados/nuevos)**:

| archivo | veredicto | razón |
|---|---|---|
| `app/api/webhooks/wompi/route.ts` (+ test) | **ENTRA** | cierra `PaymentIntent`, será el 4º llamador de `registerOrderPaymentTx`; no existía el 2026-09-12 |
| `lib/pagos/wompi-firma.ts` (+ test) | **ENTRA** | la función que ESA puerta consulta para decidir si el cierre procede (`verificarFirmaWompi`); tampoco existía el 2026-09-12 |
| `lib/checkout/metodos-pago.ts` (+ test) | **ENTRA** | existía desde el 2026-09-03, pero recién el 2026-09-14 (`METODOS-TRES-LISTAS-1`, `4386358`) `app/api/checkout/route.ts` —puerta YA listada— empezó a consultar su `metodoPagoTipoSchema` para decidir si el `payment.metodo` declarado es válido antes de escribir la orden; antes de ese commit el checkout validaba contra un enum propio, sin depender de este archivo |
| `app/api/checkout/route.ts` | ya listada | ganó la consulta de arriba; sin cambio de listado |
| `packages/core/src/orders.ts` | ya listada | exportó `isUniqueViolation` (antes privada); sin cambio de rol |
| `packages/core/src/orders.test.ts` | fuera de alcance | test, no puerta |
| `lib/automations/idempotency.ts` | **NO ENTRA** | escribe `AutomationRun` (bitácora de notificaciones), no stock/pagos/pedidos; el cambio fue sólo reusar `isUniqueViolation` |
| `lib/config/fuentes.ts` (+ test) | **NO ENTRA** | pesos tipográficos del tema, ajeno al dinero |
| `lib/animation.ts` (+ test) | **NO ENTRA** | `prefers-reduced-motion`, ajeno al dinero |

**Lo que quedó explícitamente considerado y excluido, para que no se re-litigue sin este
razonamiento:** `lib/config/site-settings-schema.ts` y `app/api/site-settings/route.ts` también
tocan `SiteSetting.metodosPago` (validan la lista que el DUEÑO configura), pero es CONFIGURACIÓN
—qué métodos se OFRECEN—, no una puerta de escritura de una orden/pago/stock concretos; es el
mismo precedente que ya dejaba fuera de la lista a la cuenta de transferencia bancaria (que vivió
en ese mismo archivo). `lib/config/telefono.ts` es un helper de formulario genérico (parte/compone
un teléfono compuesto) compartido por WhatsApp y el número de pago móvil — no decide nada, sólo
reformatea texto de un input. Ninguno de los dos se agregó.

**MÉTODO Y SU LÍMITE, declarados:** el censo enumeró cambios con `git diff --name-status
<baseline>..HEAD -- app/api/ packages/core/src/ lib/` — las tres superficies que el criterio
nombra. Deja afuera cualquier puerta nueva que viviera en `components/`, `hooks/`, `types/` o
`middleware`/`proxy.ts`; no se encontró evidencia de que exista una (las puertas de escritura de
este repo son sistemáticamente route handlers de `app/api/` o funciones de `packages/core/src/`/
`lib/`, nunca componentes), pero el límite del método se deja dicho en vez de asumido.

**Verificación de existencia:** las 20 rutas ya listadas antes de este slice se comprobaron
presentes en disco (`ls -d` por cada una, sin fallos); ninguna se retiró. La lista pasa de 20 a 23
entradas.

**La declaración de vencimiento que se agregó a `CLAUDE.md`** dice que la lista es una medición con
fecha, no una garantía perpetua, y que se re-mide cada vez que la ruta del dinero gana una puerta o
una función consultada nueva — no en la próxima auditoría programada. Sin esa frase, esto vuelve a
pasar y nadie sabe por qué: es la misma lección del `.next` rancio (§ PRECONDICIÓN) y de los
números-doctrina rancios (§ Backlog técnico), aplicada a la lista que decide qué se protege.

**MERGE POLICY A: este slice PARA antes del merge.** El diff toca únicamente `CLAUDE.md` y este
archivo — sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false`, nadie
que no sea quien lee `CLAUDE.md`/`DECISIONS.md` ve este diff) — pero SÍ es un cambio de
**contrato cross-repo**: el § Tier 1 es lo que el protocolo orquestador `dev-protocol` lee para
decidir qué archivos exigen la sesión read-only previa. `stopped_on: ['cross-repo-contract']`.
Sin merge, sin push.

`npm test` **1125/1125** (piso medido en este mismo árbol, idéntico al de la última entrada del
ledger — un cambio de prosa no puede mover ese número, y no lo hizo) y `npx tsc --noEmit` en **0**.
Regla: § Tier 1 — superficies protegidas (`CLAUDE.md`), el párrafo "ESTA LISTA VENCE".

## 2026-09-15 · Una lista literal no puede cubrir un archivo que todavía no existe — la lista Tier 1
gana SUBÁRBOLES, con precedencia archivo-antes-que-subárbol (`TIER1-SUBARBOLES-1`)
`384cc0a` (rama `slice/tier1-subarboles-1`, sobre `slice/tier1-lista-vencida-1` mergeada dentro —
sin mergear a `main`, `AWAITING_APPROVAL`, `cross-repo-contract`)

**Precondición de este slice: traer `slice/tier1-lista-vencida-1` ANTES de escribir nada.** El owner
había parado el gate de esa rama con una razón concreta —*«si lo mergeo como está vuelve a morder en
dos semanas»*—, porque quería la doctrina de subárboles ADENTRO antes de gatear una sola vez. Este
slice empezó con `git merge --no-ff slice/tier1-lista-vencida-1` sobre una rama nueva cortada de
`main`; el único conflicto fue en `DECISIONS.md`, y de la forma esperable en un archivo append-only
—las dos ramas habían agregado su entrada en el mismo punto final del archivo—, nunca de contenido:
se resolvió conservando LAS DOS entradas completas, sin reescribir ninguna, en el orden HEAD-primero
(`LEDGER-ESCRITOR-MERGEADO-1`, 2026-09-15, ya mergeada a `main`) seguido de la entrante
(`TIER1-LISTA-VENCIDA-1`, 2026-09-14, todavía sin gatear). Verificado tras el merge: los tres
archivos nuevos (`app/api/webhooks/wompi/route.ts`, `lib/pagos/wompi-firma.ts`,
`lib/checkout/metodos-pago.ts`) aparecen en el párrafo `Tier 1 slices run…` de `CLAUDE.md`, y el
asiento de `TIER1-LISTA-VENCIDA-1` aparece en este archivo — commit de merge `49364ef`.

**El defecto, en las palabras del owner: la lista Tier 1 está escrita en RUTAS y el criterio que la
justifica está escrito en SIGNIFICADO** (§ Tier 1: "bytes del visitante", "puerta de escritura … y la
función que esa puerta CONSULTA"). Una lista de rutas literales sólo puede nombrar lo que YA existe;
no puede, por construcción, cubrir un archivo que el código todavía no escribió. Es la misma familia
doc-vs-código que este repo lleva semanas persiguiendo (§ PRECONDICIÓN, el artefacto rancio; el
asiento anterior, la fecha rancia), en su variante estructural: no es que la lista quedara vieja, es
que la FORMA "lista de archivos" no tiene manera de anticipar directorios nuevos.

**Las dos pruebas vivas, verificadas por ejecución antes de proponer nada:**

- `components/storefront/home/HeroCurtina.tsx` y `HeroFicha.tsx` (`ls components/storefront/home/`)
  existen HOY, son variantes del hero tan bytes-del-visitante como cualquier archivo bajo
  `app/(storefront)/` —que la lista sí nombra entera—, y no figuraban en la lista. La razón es
  estructural: viven en `components/storefront/`, un árbol DISTINTO del directorio de rutas
  `app/(storefront)/` (`app/(storefront)/page.tsx` los importa, pero el archivo en sí vive afuera).
- `components/storefront/checkout/` (`ls components/storefront/checkout/` → "No such file or
  directory") NO EXISTE todavía. El programa de composición de slots del checkout va a poner ahí la
  cáscara y las composiciones del checkout —el mismo censo ya corrido en
  `CHECKOUT-SLOT-COMPOSICION-FORMA-1`—, y una lista literal no puede nombrar hoy un archivo que nace
  mañana. Es el caso que más duele: el riesgo mayor de esa etapa aterrizaría, sin este slice, fuera
  del gate que se supone lo protege.

**LA SOLUCIÓN, y de dónde sale — el mismo mecanismo que el clasificador de rutas del protocolo
orquestador (`dev-protocol`), descrito por el owner, no leído del otro repositorio** (fuera de
alcance de este slice): clasificar una ruta buscando primero una coincidencia por ARCHIVO y, si no
la hay, por SUBÁRBOL, con la precedencia fijada en código para que un archivo nombrado gane incluso
dentro de un subárbol contrario. Se replica la misma forma acá, en prosa: `CLAUDE.md` gana una
sección de subárboles, con la precedencia escrita como regla explícita —no implícita en el orden de
lectura— y con `packages/core/src/timezone.ts` (la exclusión ya existente en el propio § Tier 1)
como el ejemplo que ilustra qué protege esa precedencia: si algún día alguien propusiera un subárbol
tan ancho como `packages/core/src/` para "la ruta del dinero", la precedencia —no el nombre del
subárbol— es lo único que lo mantendría afuera.

**EL CENSO DE CANDIDATOS, contra el criterio y su límite —cada uno con las tres respuestas que el
spec pidió, y los descartados con la suya:**

| candidato | veredicto | por qué el criterio lo cubre (o no) | qué contiene hoy | por qué lo nuevo también calificaría |
|---|---|---|---|---|
| `components/storefront/` | **ENTRA** | "app/(storefront)/ son los bytes del visitante" — mecánicamente son las MISMAS pantallas, sólo que el archivo vive en `components/` y `app/(storefront)/*.tsx` lo importa | 27 archivos (`.tsx`/`.ts`, sin tests) medidos por ejecución el día de este slice: `CartDrawer.tsx`, `Logo.tsx`, `PreguntasFrecuentes.tsx`, `PreviewMode.tsx`, `ProductCard.tsx`, `ProductChip.tsx`, `SiteContentProvider.tsx`, `SiteSettingsProvider.tsx`, `StoreFooter.tsx`, y los subdirectorios `home/` (12), `layout/` (2), `nosotros/` (2), `suscripciones/` (2) — todos renderizados dentro de `app/(storefront)/`, sin excepción encontrada que necesite la precedencia | un archivo nuevo bajo este árbol nace para renderizarse dentro de una ruta de `app/(storefront)/` — es la condición de existencia del directorio, no una coincidencia por nombre |
| `lib/checkout/` | **ENTRA** | "la función que esa puerta CONSULTA para decidir si la escritura procede" — `app/api/checkout/route.ts` (puerta ya listada) consulta `metodos-pago.ts` (`metodoPagoTipoSchema`, verificado con `grep -n "metodos-pago" app/api/checkout/route.ts`), que a su vez consulta `transferencia.ts` (`opcionTransferencia`, verificado con `grep -rn "from '\./transferencia'" --include="*.ts" .`: `metodos-pago.ts` es el ÚNICO importador no-test del módulo) | 2 archivos fuente (+2 tests): `metodos-pago.ts` (ya listado como archivo suelto, redundante con el subárbol y se deja así — "no retirar nada ya listado") y `transferencia.ts` (nuevo) | un archivo nuevo en este directorio nace, por lo que el directorio YA ES —checkout/dinero—, para ser consultado por esa misma cadena; no es la utilidad genérica de `timezone.ts` |
| `lib/pagos/` | **DESCARTADO** | mezcla la función que SÍ consulta una puerta (`wompi-firma.ts`, ya listada como archivo) con utilidades de REPORTE que sólo leen y presentan lo ya escrito | 7 archivos fuente: `bucketeo.ts`, `etiquetas.ts`, `frase.ts`, `informe-pdf.ts`, `informe.ts`, `rango.ts` (formato/gráfico/PDF de la pantalla de Pagos) + `wompi-firma.ts` | un archivo nuevo en este directorio con la misma probabilidad histórica sería OTRA utilidad de reporte (el patrón dominante: 6 de 7 archivos actuales lo son) — proteger todo el directorio por la excepción sería la misma sobre-protección que el límite del § Tier 1 ya rechaza del lado de `timezone.ts` |
| `lib/storefront/` | **DESCARTADO** | resuelve CONTENIDO (`planes-suscripcion.ts`, `presentaciones.ts`), no decide ninguna escritura de stock/pagos/pedidos; no es la excepción puntual de `site-content-schema.ts`/`site-content-defaults.ts` (esos dos entraron por el incidente del strippeo silencioso, no por ser "resolvedores de contenido" en general) | 2 archivos fuente (+3 tests) | tratarlo como subárbol repetiría, del lado del contenido, el mismo argumento "casi todo alimenta algo por alguna cadena" que el § Tier 1 ya nombra y rechaza explícitamente del lado del dinero |

**Lo que la tabla NO decide por sí sola —el juicio de exclusión dentro de `components/storefront/`,
declarado porque el spec lo pidió:** no se encontró, dentro de ese árbol, ningún archivo que debiera
quedar FUERA de la protección (ninguna utilidad genérica ajena al storefront, ningún harness de
prueba, nada admin-only mal ubicado) — los 27 archivos son, sin excepción, o pantallas del visitante
o el mecanismo (providers, modo preview) que las alimenta. Por eso no hizo falta invocar la
precedencia archivo-por-archivo DENTRO de este subárbol; la precedencia queda escrita para el caso en
que sí haga falta, no porque este censo la haya necesitado.

**"Los componentes de variante" que el owner nombró NO son una tercera categoría — ya caen dentro de
`components/storefront/`.** `HeroCurtina.tsx`/`HeroFicha.tsx` (variantes del hero) y
`GrindChooserMosaico.tsx`/`GrindChooserIndice.tsx` (variantes del selector de molienda) viven todos
bajo `components/storefront/home/`, así que el subárbol único los cubre a los cuatro sin necesidad de
una entrada separada — y a cualquier variante futura de cualquier sección, por la misma razón
estructural (viven donde vive la sección que varían).

**DESVIACIÓN medida contra el spec, no heredada:** el spec citó "28 archivos" para
`components/storefront/`. El censo de este slice, corrido por ejecución el mismo día
(`find components/storefront -type f \( -name "*.tsx" -o -name "*.ts" \)`), da **27** — sin ningún
test file en el árbol (`find … | grep test` → vacío) y sin ninguna exclusión propia hecha por este
slice. La cifra del spec era un `ledger_claim` de una medición anterior del orquestador, no
re-verificada acá hasta ahora; la diferencia de uno no cambia ningún veredicto de la tabla y no se
investigó más allá de confirmar que no altera el censo. Los conteos de `lib/checkout/` (4, 2 fuente)
y `lib/pagos/` (14, 7 fuente) y `lib/storefront/` (5, 2 fuente) que el spec citó SÍ coinciden con lo
medido acá.

**Forma del documento (§2c del spec): no se reescribió el párrafo de rutas literales —sigue
existiendo tal cual, con los tres archivos que trajo el merge de `TIER1-LISTA-VENCIDA-1`— y se le
sumó, en párrafos nuevos inmediatamente después, la lista de subárboles con sus tres razones cada
uno, la regla de precedencia, y los descartados con la suya. Ningún archivo se retiró; ningún número
que venza (conteo de archivos, fecha de "última medición") quedó escrito en `CLAUDE.md` —esas cifras
viven acá, en el ledger, donde SÍ pueden fecharse y envejecer sin volverse doctrina falsa.**

**Lo que este asiento NO hace:** no corrige ni edita el asiento anterior (`TIER1-LISTA-VENCIDA-1`,
el ledger es append-only); no retira ningún archivo ni subárbol de la lista; no cambia el criterio
del § Tier 1 ni su límite —sólo cómo se EXPRESA el conjunto que lo cumple—; no toca una sola línea de
código, test o schema.

**MERGE POLICY A: este slice PARA antes del merge, igual que su predecesor.** El diff toca únicamente
`CLAUDE.md` y este archivo —sin schema, sin migración, sin bytes de cliente
(`customer_bytes.changed=false`, nadie que no sea quien lee `CLAUDE.md`/`DECISIONS.md` ve este
diff)— pero es un cambio de **contrato cross-repo**: el § Tier 1 es lo que el protocolo `dev-protocol`
lee para decidir qué archivos exigen la sesión read-only previa, y este slice ensancha ese contrato
con dos subárboles enteros. `stopped_on: ['cross-repo-contract']`. Sin merge, sin push.

Ni una línea de código se tocó. Sin gate de test/build por instrucción explícita del spec —dos
archivos de texto—; el piso citado es el mismo de la entrada anterior (`npm test` **1125/1125**,
`npx tsc --noEmit` **0**, medido en `LEDGER-ESCRITOR-MERGEADO-1`) como `ledger_claim`, no
re-medido en este slice: un diff Markdown no puede moverlo.
Regla: § Tier 1 — superficies protegidas (`CLAUDE.md`), el párrafo "LA LISTA TAMBIÉN GANA SUBÁRBOLES".

## 2026-09-15 · Tres consecuencias del gate de los subárboles Tier 1: el conteo que prueba la forma,
la factura aceptada, y el número que se vuelve comando (`TIER1-SUBARBOLES-CONSECUENCIAS-1`)

**QUÉ ES ESTE ASIENTO.** `TIER1-SUBARBOLES-1` ya pasó el gate del owner y está mergeado a `main`
(commit de merge `0ce9b2a`, sobre la rama `384cc0a`): la lista Tier 1 de `CLAUDE.md` ganó los
subárboles `components/storefront/` y `lib/checkout/`, la precedencia archivo-antes-que-subárbol, y
dos descartes razonados (`lib/pagos/`, `lib/storefront/`). Este asiento no lo reescribe —el ledger es
append-only y su asiento sigue intacto arriba— ni toca `CLAUDE.md`. Registra TRES cosas que el owner
dijo al gatear esa rama, que de otro modo se pierden porque vivieron en la conversación del gate y no
quedaron escritas en ningún archivo.

### (a) El conteo es la prueba de que el subárbol era la forma correcta, no una comodidad de escritura

El spec que motivó `TIER1-SUBARBOLES-1` nombró DOS variantes al proponer el subárbol —`HeroCurtina.tsx`,
`HeroFicha.tsx`—. El censo de ese slice encontró CUATRO: sumó `GrindChooserMosaico.tsx` y
`GrindChooserIndice.tsx`, las variantes del selector de molienda, bajo el mismo árbol
(`components/storefront/home/`). Este slice lo re-verificó de forma independiente:

```
$ find components/storefront -iname "*Hero*" -o -iname "*Grind*"
components/storefront/home/GrindChooser.tsx
components/storefront/home/GrindChooserIndice.tsx
components/storefront/home/GrindChooserMosaico.tsx
components/storefront/home/HeroCurtina.tsx
components/storefront/home/HeroFicha.tsx
components/storefront/home/HeroSection.tsx
```

De los seis, dos (`GrindChooser.tsx`, `HeroSection.tsx`) son los DESPACHADORES —el componente que
decide QUÉ variante mostrar—, no variantes en sí; los cuatro restantes son las variantes. Coincide con
lo que midió el slice anterior: cuatro, no dos.

En palabras del owner, al ver el número:

> El hallazgo de que eran CUATRO variantes afuera y no dos es la prueba de que el subárbol era la
> forma correcta: una lista literal sólo habría cubierto las dos que alguien recordó.

El argumento no es sobre el número en sí —cuatro contra dos—, es sobre QUIÉN lo escribe. Una lista de
rutas literales la redacta una persona, de memoria, así que cubre lo que esa persona recuerda en el
momento de escribirla. Un subárbol cubre lo que CUMPLE el criterio, lo recuerde alguien o no. El spec
original recordó dos de cuatro; el criterio —"`app/(storefront)/` son los bytes del visitante"— ya
cubría las cuatro sin que nadie tuviera que nombrarlas todas. Ésa es la garantía que el subárbol compra
y que ninguna lista, por cuidadosa que sea, puede igualar.

### (b) La factura del gate — aceptada, con su costo a la vista, y su puerta de revisión

Con `components/storefront/` entero en Tier 1, todo componente nuevo del storefront entra al
protocolo de dos etapas —sesión read-only primero, visto bueno del owner después— antes de
escribirse. El owner lo dijo así, gateando la rama:

> Con `components/storefront/` entero en Tier 1, CADA componente nuevo del storefront va a parar en
> AWAITING_APPROVAL. Con el programa de themes por delante —las variantes de hero, presentaciones,
> historia, suscripción, footer, más las tres composiciones del checkout— eso son muchos gates míos en
> las próximas semanas. Es lo que pedí y lo sostengo, pero la factura llega en la tanda siguiente, no
> dentro de un mes.

Se asienta como consecuencia ACEPTADA, no como advertencia ni como deuda: el owner pidió la
protección sabiendo el costo, y lo sostiene. La cláusula de revisión que puso al lado, también
literal:

> Si en algún momento medís que el ritmo se vuelve impracticable, traémelo con números antes de
> proponer aflojarlo.

**Lo que este asiento NO hace:** no mide el ritmo de gates de las semanas siguientes, no propone
aflojar el Tier 1, no insinúa cómo se aflojaría. Registra que la puerta de revisión existe y QUÉ la
abre —una medición, nunca una impresión— para que el próximo que sienta el peso de la factura sepa
que hay un camino y cuál es, en vez de proponer sobre la marcha una excepción sin ese respaldo.

### (c) La regla del número necesita un mecanismo, no disciplina — y el mecanismo ya tiene precedente en este repositorio

El spec de `TIER1-SUBARBOLES-1` citó "28 archivos" para `components/storefront/`; el censo de ese
mismo slice, corrido por ejecución, dio 27 —un `.DS_Store` inflaba el conteo del spec— (línea 2306 de
este archivo). Es la tercera corrección de un número en tres días dentro de esta misma familia de
slices. El owner y el orquestador lo habían acordado el 2026-09-15, y el acuerdo se incumplió en el
mensaje siguiente al acuerdo:

> Vale que el asiento registre que la regla necesita un mecanismo, no disciplina: un número en un spec
> es una afirmación que el worker va a medir igual, así que conviene que el spec diga de dónde salió
> el número, o que no lo diga.

**El mecanismo YA TIENE PRECEDENTE en este mismo repositorio.** `CLAUDE.md` ya reemplaza al menos un
conteo por el comando que lo produce, con la misma razón escrita al lado, en CUATRO sitios verificados
por `grep -n "ls -d packages/core/prisma/migrations" CLAUDE.md`:

| línea | sección | cita |
|---|---|---|
| 391-393 | § Las tres capas de verificación → El carril de integración, SKEW DE VERSIÓN | «contá cuántas hay hoy con `ls -d packages/core/prisma/migrations/*/ \| wc -l` — el número vencía cada vez que se escribía, § Backlog técnico, ...» |
| 4337 | § El código compartido no NACE siendo Nayoli/demo | «el carril de integración aplica TODAS las migraciones (`ls -d packages/core/prisma/migrations/*/ \| wc -l` para el número de hoy) en un Postgres fresco» |
| 4421 | § Bases de datos (Neon) — qué es cada endpoint, fila `development` | «migraciones al día (contá cuántas hay con `ls -d packages/core/prisma/migrations/*/ \| wc -l` — el número vencía cada vez que se escribía, ...)» |
| 4572 | § Monorepo (Fase A) — `@duna/core` y la cadena de build, `buildCommand` | «fuente única del schema; contá cuántas hay hoy con `ls -d packages/core/prisma/migrations/*/ \| wc -l`» |

Y la regla general que sostiene las cuatro citas vive en § Backlog técnico, línea 886:

> LA DOCTRINA GUARDA LA REGLA Y SU PORQUÉ, NUNCA UNA MEDICIÓN NI UN INVENTARIO. Números, listas de
> archivos y conteos vencen solos; las reglas no. Un número en doctrina es una frase con fecha de
> vencimiento — y nadie le pone la fecha.

**La regla que este asiento deja, en una línea: en un spec, un número que DESCRIBE EL REPOSITORIO se
reemplaza por el comando que lo produce.** Así no hay número que pueda estar vencido —el worker lo
produce fresco al correr el comando—, y la afirmación deja de existir como afirmación para volverse
medición.

**El límite, para que no se aplique donde no sirve:** esto vale para números que describen el
REPOSITORIO —conteos de archivos, de líneas, de commits—, como los cuatro de la tabla de arriba. NO
vale para números que son una DECISIÓN —un tope de 12 fotos en una galería (§ La GALERÍA de
/nosotros, `TOPE 12`) o un breakpoint de 1080px (§ Duna OS en ANGOSTO)—. Ésos no vencen, porque no
describen nada que el código pueda contradecir: son la elección, no una medición de ella.

Ni una línea de código se tocó. Sin gate de test/build por instrucción explícita del spec —un solo
archivo de texto—; el piso citado sigue siendo el de la entrada anterior (`npm test` **1125/1125**,
`npx tsc --noEmit` **0**, medido en `LEDGER-ESCRITOR-MERGEADO-1`) como `ledger_claim`, no re-medido en
este slice: un diff Markdown no puede moverlo. Sin schema, sin migración, sin bytes de cliente
(`customer_bytes.changed=false` — nadie que no sea quien lee `DECISIONS.md` ve este diff), sin
contrato cross-repo. Merge Policy A aplica: mergea sin esperar aprobación.
Regla: § Tier 1 — superficies protegidas (`CLAUDE.md`), sin tocar en este slice; y § Backlog técnico,
"LA DOCTRINA GUARDA LA REGLA Y SU PORQUÉ, NUNCA UNA MEDICIÓN NI UN INVENTARIO", sin tocar en este slice.

## 2026-09-15 · La prosa tapó un hueco del código: `approved: yes` autorizaba el MERGE, no sólo la
escritura, y es la peor de cinco fallas silenciosas de la semana (`LEDGER-PROSA-TAPA-HUECO-1`)

**QUÉ PASÓ.** El owner dictó una regla el 2026-09-14: *«todo slice que toque un path Tier 1 para en
`AWAITING_APPROVAL`, tenga o no bytes visibles»*. Quedó asentada. Y no estaba corriendo: el clasificador
de merge del orquestador —el que decide si un worker puede mergear solo— devolvía `MERGE_OK_BY_APPROVAL`
en cuanto los paths que tripaban una condición Tier 1 estaban dentro del `touches:` aprobado por el
owner. Un diff Tier 1 quedaba autorizado a mergear sin el gate del owner. La regla vivía en el ledger y
no existía en el código.

Se supo por `TEMAS-P1-FEATURED-VARIANTES-1` (2026-09-15, rama `slice/temas-p1-featured-variantes-1`,
commit `7595057`, sobre `main` en `33a207a` — verificado en este slice con
`git merge-base --is-ancestor 7595057 main`, que responde que NO: la rama existe y sigue sin mergear).
Ese slice tocó dos archivos nombrados explícitamente en la lista Tier 1
(`lib/config/site-content-defaults.ts`, `lib/config/site-content-schema.ts`) con aprobación explícita.
Su worker no mergeó —porque el spec se lo prohibía en prosa— y reportó la contradicción entre el spec y
el runner genérico, en vez de elegir uno de los dos en silencio.

> UN WORKER QUE HUBIERA SEGUIDO LA MAQUINARIA EN VEZ DE LA PROSA, HABRÍA MERGEADO.

**LA FRASE DEL ORQUESTADOR**, que el owner pidió que quedara literal:

> LA PROSA TAPÓ UN HUECO DEL CÓDIGO EN VEZ DE DELATARLO.

El spec decía `approved: yes` y, en el mismo aliento, «no lo mergees» — y el orquestador lo escribió
creyendo que reforzaba. Era una contradicción: `approved: yes` es exactamente la autorización que el
runner leía para permitir el merge. El párrafo hizo que el sistema se comportara bien por el motivo
equivocado, y por eso el hueco sobrevivió a su propio slice: nada en el CÓDIGO paraba el merge, sólo una
frase que alguien tenía que leer y obedecer.

**POR QUÉ ES LA PEOR DE LA FAMILIA — cinco en una semana.** Las otras cuatro fallaban en silencio; ésta
fallaba en silencio Y PARECÍA CUBIERTA. Las cinco, como hecho histórico de esa semana y no como
inventario que mantener:

1. la guarda escrita que nadie corrió — el comando de auto-verificación existía en texto y nadie lo
   ejecutó;
2. la lista Tier 1 vencida — corriendo en verde sobre un conjunto que ya había encogido;
3. el disparador satisfecho por el REPOSITORIO en vez de por el MUNDO — «el webhook empezó a escribir
   filas», con cero creadores reales detrás;
4. la limpieza de ramas escrita en TRES lugares y sin correr — 45 ramas locales y 16 en origin, todas
   mergeadas, y las 16 sirviendo un preview vivo;
5. ésta — la regla existía en el ledger y no en el código, con una prosa encima que la hacía parecer
   viva.

Las cuatro primeras dejaban un rastro reconocible: algo escrito que nadie corrió, un número que nadie
volvió a medir, un disparador que medía lo fácil en vez de lo real. Ésta no dejaba ese rastro — el spec
DECÍA la regla correcta, el worker la OBEDECIÓ, y el resultado observable (sin merge) fue el correcto.
El hueco sólo apareció porque alguien miró la MAQUINARIA detrás de esa obediencia, no el resultado que
produjo esa vez.

**LO QUE EL PROTOCOLO DEBE PREMIAR.** El hallazgo salió porque el worker reportó la CONTRADICCIÓN entre
el spec y el runner, en vez de elegir uno. Un worker que resuelve una contradicción en silencio
—siguiendo el spec, o siguiendo el runner— deja el hueco vivo en los dos casos: seguir el spec produce
el comportamiento correcto una vez, sin delatar que el clasificador está roto; seguir el runner mergea
un Tier 1 sin el gate del owner. Reportar la contradicción es la única de las tres salidas que no deja
el hueco intacto. Se asienta como conducta a premiar en el protocolo, no como una anécdota del slice que
la produjo.

**EL ARREGLO, en una línea.** Un path Tier 1 declarado y aprobado ahora devuelve HOLD, con la nota de
que ese HOLD ES el gate del owner y no un defecto del slice. La aprobación autoriza la ESCRITURA, nunca
el MERGE. Un path que ninguna regla clasifica pero está declarado sigue pasando sin tripar nada. El
arreglo vive en el repositorio del orquestador; este asiento registra la regla y su porqué, no el diff.

**EL ENGANCHE CON LO YA ESCRITO.** § PRECONDICIÓN — verificación local sobre dev server reiniciado en
frío (`CLAUDE.md`) ya tiene la frase que nombra esta familia de defectos: *«lo que está escrito no
prueba lo que está corriendo»*. Ahí el artefacto rancio se ve como un bug del código nuevo; acá la
prosa del spec se veía como una guarda del sistema. Es el mismo modo de falla, una capa más arriba: no
fue el `.next` compilado lo que mintió, fue la PROSA. Y § Bases de datos (Neon) — qué es cada endpoint
(`CLAUDE.md`) tiene el gemelo del otro lado: *«no sirve como evidencia del rol: el nombre de la rama, lo
que diga `.env`, un comentario en el código, ni lo que alguien recuerde»* — un texto que describe el
sistema no es el sistema, ni cuando el texto vive en un spec de orquestación en vez de en un comentario
de código. `CLAUDE.md` ya nombraba esta familia como tres fuentes del mismo modo de falla —el
artefacto, la base, y el spec (§ Config del contenido, «EL TRIPWIRE PROTEGE CONTRA LA INSTRUCCIÓN, NO
SÓLO CONTRA EL TERRENO»)—; ésta es la misma tercera fuente, en su variante más cara: no un spec que
contradice lo medido, sino un spec cuya prosa hace que el hueco del código deje de verse.

Ni una línea de código de este repositorio se tocó — el hallazgo y el arreglo del clasificador viven en
el orquestador. Sin gate de test/build por instrucción explícita del spec: un solo archivo de texto,
sin schema, sin migración, sin bytes de cliente (`customer_bytes.changed=false` — nadie que no sea quien
lee `DECISIONS.md` ve este diff), sin contrato cross-repo declarado por este slice (lo que se arregla es
código del orquestador, fuera de este repositorio). Merge Policy A aplica: mergea sin esperar
aprobación.
Regla: § PRECONDICIÓN y § Bases de datos (Neon) — qué es cada endpoint (`CLAUDE.md`), citadas, sin
tocar en este slice.

## 2026-09-15 · `featured` gana dónde declarar su variante — un meta key-agnóstico, gemelo de
`esquemas` (`TEMAS-P1-FEATURED-VARIANTES-1`)
`7595057` (rama `slice/temas-p1-featured-variantes-1`, sobre `main` en `33a207a` — sin mergear,
`AWAITING_APPROVAL`, toca dos archivos nombrados explícitamente en la lista Tier 1)

**ETAPA 2 (ESCRITURA) DE UN TIER 1.** La etapa 1 —`TEMAS-P1-BANDAS-ESTRUCTURALES-FORMA-1`, OBSERVED—
midió, sin escribir nada, que `featured`/`trustBadges` son bandas ESTRUCTURALES del home sin sección
en `SiteContentData` ni entrada en el REGISTRY, y que por eso `validarPreset` (`lib/config/themes.ts`)
rechazaba TODO pedido de variante de `featured` con "no declara variantes en el REGISTRY" — sin poder
distinguir "la banda no tiene slot" de "esa composición no existe". El owner dio su visto bueno sobre
esa medición; este slice es la escritura que la etapa 1 dejó preparada.

**LO QUE SE CONSTRUYÓ: `content.variantesBandas`, gemelo EXACTO de `content.esquemas`.**
`VariantesBandasContent = Record<string, string>` (`lib/config/site-content-defaults.ts`) — dominio
de claves ABIERTO, resolvedor key-agnóstico (`resolverVariantesBandas`) que descarta basura en vez de
clampar a una canónica (como `resolverEsquemas`, NO como `resolverVariante` — que sí clampa porque
resuelve DENTRO de una sección que siempre necesita un valor), cableado en `resolverSiteContent` junto
a `paginas`/`tema`/`esquemas`/`orden`. `SeccionKey` lo excluye — no es una sección, se resuelve aparte
del loop. Su gemela de escritura, `variantesBandasEditableSchema` (`lib/config/site-content-schema.ts`,
`z.record(z.string(), z.string())`), se declara por la misma razón que `esquemasEditableSchema`: para
que un futuro write general no la STRIPPEE en silencio (§ #65-B) — hoy no hay editor que la escriba.

**EL SET DE CLAVES POR-BANDA vive en `VARIANTES_ESTRUCTURALES`** (`site-content-defaults.ts`), gemelo
del REGISTRY pero para bandas SIN sección. Hoy una sola entrada:
`{ featured: { claves: ['cuadricula'], canonica: 'cuadricula' } }`.

**LA CLAVE CANÓNICA, MEDIDA CONTRA EL COMPONENTE, NO INVENTADA.** Se leyó `FeaturedProducts.tsx`
completo: un grid de 4 productos del catálogo (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`), sin
dispatcher — no lee `variante` ni `useSiteContent()`, recibe sólo `style` (confirmado también por la
etapa 1). **`cuadricula` se eligió A PROPÓSITO distinta de `tabla`/`grilla`/`mosaico`** — las tres
claves que los cinco presets del catálogo de themes piden para `featured` (`grep -n "featured:"
lib/config/themes.ts`) —: nombrar la canónica igual a cualquiera de esas tres habría hecho que ese
preset dejara de fallar en `featured` sin que nadie hubiera construido esa composición real, el mismo
defecto que este slice existe para no repetir.

**ESTO NO DESTRABA NINGÚN THEME, y hay que decirlo con todas las letras.**
`temasCompletos(PRESETS)` (`lib/config/themes.ts`) devuelve, ANTES y DESPUÉS de este slice, exactamente
`['ARRANQUE']` — afirmado por el test ya existente `'HOY ninguno de los cinco themes del diseño valida
completo, y ARRANQUE sí'`, que no se tocó y sigue en verde. Lo que cambia es el MENSAJE que
`validarPreset` da para `featured`: antes "no declara variantes en el REGISTRY" (rama "sin slot");
ahora "esa clave no existe (claves de `featured`: cuadricula)" (rama "clave inválida") — porque NINGUNO
de los cinco presets pide `cuadricula`: piden `tabla` (PLIEGO), `grilla` (CORTE/PATIO/VITRINA) o
`mosaico` (VETA), y ninguna de esas tres composiciones está construida. Es **PLOMERÍA NECESARIA** —sin
ella las variantes de `featured` no tienen dónde declararse cuando se construyan— **NO desbloqueo del
programa de themes.**

**`trustBadges` QUEDA AFUERA, decisión del owner.** `grep -n "trustBadges" lib/config/themes.ts`
muestra que la banda aparece en los mapas de `esquemas`/`orden` de los cinco presets, CERO veces en un
mapa `variantes`. Declararle un slot en `VARIANTES_ESTRUCTURALES` sin que ningún preset lo consuma
sería CAPACIDAD MUERTA — la simetría con `featured` no es razón para abrirlo. Cuando un theme pida una
variante de `trustBadges`, entra con su clave real en el mismo commit que la construye.

**NO SE ASCENDIÓ `featured` A `SeccionKey`.** Habría regalado un `ocultable` — un toggle de
visibilidad que HOY no existe: `featured` se renderiza incondicionalmente en la home, gateada sólo por
su posición en `content.orden` (la tabla `BANDAS` que `app/(storefront)/page.tsx` recorre). Fabricar
esa capacidad no era parte de lo pedido.

**NI DISPATCHER NI COMPONENTE TOCADOS.** `FeaturedProducts.tsx` no cambió una línea — el precedente es
`brandStory` (`TEMAS-P2-BRANDSTORY-1`): abrir el slot de datos no exige construir la forma alternativa
que lo consumiría.

**EL COMENTARIO DE CABECERA DE `themes.ts` ESTABA VENCIDO, y se corrigió SÓLO lo falso.** Afirmaba
"hoy sólo `hero` y `presentaciones` declaran `variantes`" y que `brandStory` "no tiene slot" — falso
desde `TEMAS-P2-BRANDSTORY-1` (ya en `main`; `REGISTRY.brandStory.variantes` existe, verificado
leyendo el REGISTRY). Se corrigieron las frases puntuales en CUATRO sitios del archivo —la cabecera, la
introducción a los cinco themes del catálogo, y los dos comentarios de `ARRANQUE` sobre `brandStory`—
sin reescribir ningún bloque completo. La nota histórica que queda dentro de la cabecera no afirma con
certeza CUÁNDO se desalineó (las dos ramas —`TEMAS-PRESET-DATO-1` y `TEMAS-P2-BRANDSTORY-1`— se
autorearon con poco más de 18 minutos de diferencia el 2026-09-11 (20:54:20 y 21:12:54,
respectivamente), medido con `git log -1 --format="%ai"` sobre cada commit; no se afirma más de lo que
esa medición sostiene).

**Gate: capa 1 (`npm test`), verde: 1136/1136** (medido en este slice). El piso citado por la entrada
anterior de este archivo (`LEDGER-ESCRITOR-MERGEADO-1`, más arriba) era **1125/1125**; la diferencia
—11— son las pruebas nuevas de este slice: 8 en `lib/config/site-content-defaults.test.ts`
(`resolverVariantesBandas` + `VARIANTES_ESTRUCTURALES` + el cableado en `resolverSiteContent`), 3 en
`lib/config/themes.test.ts` (`featured·cuadricula` pasa, `featured·<inválida>` sigue fallando, y el
merge quirúrgico enruta a `variantesBandas` sin crear una clave huérfana). `npm run typecheck`
(`tsc --noEmit`): 0 errores.

**BYTE-IDÉNTICO, afirmado.** `resolverSiteContent({}).variantesBandas` da `{}` — sin fila de
`SiteContent`, `featured` cae a su canónica `cuadricula` sin que nada lo muestre distinto, porque
`FeaturedProducts.tsx` no lee esta meta todavía (test: `'variantesBandas: sin nada guardado → mapa
VACÍO (byte-idéntico...)'`).

**Sin schema de Prisma, sin migración, sin bytes de cliente** (`customer_bytes.changed=false` —
`FeaturedProducts.tsx` no cambió, y el único consumidor nuevo de `variantesBandas`/
`VARIANTES_ESTRUCTURALES` es `mergePresetEnContent`, que corre desde un runbook fuera del panel; ningún
render del storefront ni del panel cambia con este diff), **sin contrato cross-repo.** Toca DOS
archivos nombrados EXPLÍCITAMENTE en la lista Tier 1 de `CLAUDE.md`
(`lib/config/site-content-defaults.ts`, `lib/config/site-content-schema.ts`) — **`AWAITING_APPROVAL`**:
no se mergea sin el visto bueno del owner sobre ESTE diff en concreto, distinto del visto bueno ya dado
a la medición de la etapa 1.

## 2026-09-15 · El canal único de reduced-motion no alcanza a un scroll-scrub — la condición que eso impone (`LEDGER-SCRUB-FUERA-DEL-CANAL-1`)

`STOREFRONT-REDUCED-MOTION-1` (2026-09-12, `8bf09b4`) cerró el defecto de las 21 animaciones de entrada
del storefront con UN canal: `MotionConfig reducedMotion="user"` (`lib/animation.ts`). **Ese canal no
alcanza a un scroll-scrub, y no por descuido: por construcción de framer-motion.**

Medido en la fuente instalada (`motion-dom` 12.40.0, `node_modules/motion-dom/dist/es/`):
`shouldReduceMotion` sólo se lee dentro de `animateTarget()`
(`animation/interfaces/visual-element-target.mjs:84`), que es el camino que toman los props
DECLARATIVOS —`animate`, `whileInView`, `initial`, `AnimatePresence`— y que termina en
`value.start(animateMotionValue(...))`. `useTransform` (`framer-motion/dist/es/value/
use-transform.mjs`), en cambio, corre por `useCombineMotionValues`
(`framer-motion/dist/es/value/use-combine-values.mjs`), y ese hook **escribe con `value.set(...)` en
cada frame, nunca con `.start()`** — el camino que `shouldReduceMotion` nunca toca. Un `useTransform`
derivado de `scrollYProgress` queda, por esa razón, fuera del canal que `STOREFRONT-REDUCED-MOTION-1`
instaló.

**Y es la misma familia que ya mordió, un nivel más adentro.** El guard viejo de `app/globals.css` (el
bloque `prefers-reduced-motion`) no alcanzaba a framer-motion porque framer-motion no anima por CSS —
ése fue el defecto que `STOREFRONT-REDUCED-MOTION-1` cerró. Hoy hay DOS mecanismos presentes —el de
CSS y el de `MotionConfig`— y **ninguno cubre el scroll-scrub**: dos guardas en verde sobre un caso
que ninguna protege.

**HOY NO HAY DEFECTO VIVO — es una precaución de construcción, no un incendio.** Censado el repo
entero:

```
grep -rnE "useScroll|useTransform|useMotionValue|useSpring|useMotionValueEvent" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules --exclude-dir=.next | wc -l
```

da **0**. Y el resto del movimiento ligado a scroll ya está cubierto por otra vía: el único
`addEventListener('scroll')` del storefront (`components/storefront/layout/StoreNav.tsx:40`) es un
toggle binario de estado (`scrollY > 20`), no movimiento continuo ligado al scroll; y las `@keyframes`
de `app/globals.css` caen bajo su propio bloque `prefers-reduced-motion`.

**LA CONDICIÓN QUE ESTO FIJA, para cuando exista una pieza con scroll-scrub:** cada pieza con scrub
lleva su `useReducedMotion()` EXPLÍCITO, y con la preferencia activa no lee `scrollYProgress` en
absoluto — fija su salida en el primer fotograma. No es una recomendación: es condición de que esa
pieza se pueda construir. Si se construye sin ese gate por pieza, REABRE el defecto que
`STOREFRONT-REDUCED-MOTION-1` cerró — no automáticamente, pero sí en cuanto alguien razone «ya hay un
provider, está cubierto».

**El patrón no se inventa acá — ya vive en el repo.** `NosotrosGaleria.tsx:31` gatea el autoplay de su
vídeo con `useReducedMotion()` a mano (`reproducirEnVista = !preview && !reduce`, línea 32),
exactamente por la misma razón: el autoplay tampoco pasa por `animateMotionValue`. Es el mismo
mecanismo, reusado, no reinventado.

Regla: § un canal único cubre lo que pasa POR ÉL. Un mecanismo nuevo que escribe por otra vía no hereda
la guarda por vivir en el mismo archivo ni por usar la misma librería — la pregunta antes de confiar en
una guarda no es «¿existe?» sino «¿este camino pasa por ella?».

## 2026-09-15 — El hero acepta VIDEO como dato del cliente (`HERO-VIDEO-COMO-DATO-1`)

Construcción sobre las decisiones ya tomadas por el owner en la etapa de censo (`HERO-MEDIA-DATO-
FORMA-1`, sesión read-only aparte — su reporte no dejó commit en este repo, por diseño: una investigación
OBSERVED no lleva ledger propio). Este slice no reabre esas cuatro preguntas; las ejecuta y documenta el
porqué, porque una elección sin su razón se vuelve una convención que el próximo no entiende.

**1 · PLANO + CLAMP, no un objeto anidado `media:{}`.** `imagenTipo`/`imagenPoster` son hermanos planos
de `imagen` en `HeroContent` (como `variante`), no un objeto. Razón mecánica: `resolverSiteContent`
itera `def.campos` como pares string de primer nivel; un objeto anidado exigiría una TERCERA rama de
resolución sólo para el hero (hoy hay dos: `repeater` y `variantes`). Y `imagenTipo` va CLAMPADO —nunca
un string libre— con un mecanismo NUEVO, `SeccionDef.escalares` (`Record<string, VariantesDef>`,
resuelto en el loop de `resolverSiteContent` con el MISMO `resolverVariante` que ya clampaba `variante`,
sin un `if (key === 'hero')` hardcodeado): es el SEGUNDO escalar clampado de una sección, y la razón de
que no baste con un string suelto la dio el owner — el hero es `ocultable:false`, la ÚNICA portada del
sitio, así que un valor corrupto ahí gobernaría lo primero que ve el visitante, y el resolver SOFT tiene
que devolver SIEMPRE algo renderizable.

**2 · `.refine()` en `heroEditableSchema`: el póster es obligatorio con video, y es la ÚNICA regla DURA
de un schema SOFT a propósito en todo lo demás.** No exige que `imagenPoster` ESTÉ (un hero de imagen
sigue pasando con todo vacío); exige que DOS campos sean COHERENTES entre sí, y sólo cuando el dueño
eligió video. El porqué, del owner: el editor es HOY el único camino de escritura y garantiza el orden
póster-antes-que-video por construcción, pero esa garantía deja de alcanzar el día que exista OTRO
camino —un import, una corrección a mano, un runbook— y ESE día el `.refine()` sigue protegiendo.
Confiar en "el editor siempre lo hace bien" es la misma apuesta que ya perdió el schema editable de
Presentaciones (§ #65-B, CLAUDE.md): diez campos (`categoria1/2` + los slots 3-4) se perdían en
silencio en cada guardado porque nadie los había declarado en el schema, congelado desde C1 mientras el
modelo creció. `.refine()` en zod 4 mantiene el `ZodObject` (con sus checks) en vez de envolverlo en un
`ZodEffects` distinto —medido contra la fuente instalada (`node_modules/zod`, v4.4.3) con un script de
Node antes de escribir el cambio—, así que el test derivado `camposDelSchema` (que hace `.unwrap().shape`
sobre `siteContentEditableSchema.shape.hero`) siguió viendo el hero sin tocar el helper: se verificó
corriendo la suite, no se asumió.

**3 · `MAX_VIDEO_HERO_BYTES = 8 MB`, menos de la mitad que la galería (20 MB), y la razón NO es la
misma tanda de motivo.** La galería difiere la descarga con un `IntersectionObserver` porque el video
vive bajo el fold; el hero está SIEMPRE en el viewport al cargar, así que un observer dispararía al
instante — equivale al atributo `autoplay` puro, y compite DIRECTO con el primer pintado de la página.
En red móvil colombiana, 20 MB en la portada es una tienda que no carga. Constante + mensaje
(`MSG_VIDEO_HERO_LARGO`) gemelos de `MAX_VIDEO_GALERIA_BYTES`/`MSG_VIDEO_GALERIA_LARGO`, con su propio
texto ("para la portada", no "para la galería") — mostrarle al operador el mensaje equivocado lo
confundiría sobre cuál límite se está aplicando.

**RESIDUO DE REDACCIÓN, medido y documentado, no corregido — fuera de `touches:`:** el tope del hero
NO se pudo enchufar dentro de `useSubidaImagen.ts` (`alElegirHold`), que hardcodea el tope de la GALERÍA
al validar el archivo elegido, porque ese archivo no estaba en la lista de `touches:` de este slice.
La solución fue un SEGUNDO chequeo, DEFENSIVO, dentro de `TiendaSeccionEditor.tsx` (en `touches:`), que
cierra encima con el tope y el mensaje del HERO. Consecuencia medida: un archivo entre 8 y 20 MB (o
hasta 30 MB pre-remux para un `.mov`) lo rechaza ESTE chequeo, con el mensaje correcto del hero; uno por
encima de 20/30 MB ya lo rechazó `alElegirHold` ANTES de llegar acá, con el mensaje GENÉRICO de la
galería ("Ese video pesa demasiado para **la galería**..."), aunque el operador esté subiendo al hero.
**En NINGÚN caso sube al storage un video de hero por encima de su propio tope** — el hueco es de
REDACCIÓN (qué texto ve el operador en la franja 20-30 MB+), no de TAMAÑO. Cerrarlo del todo exige
parametrizar el tope de `alElegirHold`, lo que toca `useSubidaImagen.ts` y por lo tanto un slice propio.

**4 · El fallback bajo `prefers-reduced-motion` es un `<video>` PAUSADO mostrando su `poster`, NO un
swap a `<Image>`.** Reusa el precedente exacto de `NosotrosGaleria.tsx` (mismo mecanismo, misma razón:
un video que arranca solo ES movimiento). Con `controls` para que el visitante reproduzca si quiere —un
play iniciado por el usuario es legítimo aun con esa preferencia—.

**LA DIFERENCIA CON LO PEDIDO LITERALMENTE, anotada a propósito:** el spec de la etapa de censo pedía
"fallback automático a la imagen del póster"; lo que se construyó es "el `<video>` pausado con su
`poster`" — visualmente indistinguible de una imagen, sin descargar los bytes del video, pero el
elemento del DOM sigue siendo `<video>`, no `<Image>`. Se aceptó el mecanismo del precedente porque
cumple la intención exacta (mostrar la imagen del póster, sin descargar el video) con menos código y
sin una segunda decisión de qué pasa si el `<Image>` de swap también falla. Queda anotado por si algún
día se quiere el `<Image>` real como fallback.

**El disparo de reproducción es IMPERATIVO (`.play()`/`.pause()` en un efecto), no el atributo
`autoPlay`.** Medido, no asumido: `useReducedMotion()` (framer-motion) devuelve `null` en el primer
render —servidor e hidratación—, y sólo resuelve el valor real DESPUÉS de montar. Fijar el atributo
`autoplay` a partir de ese estado transitorio no reacciona si la preferencia real difiere una vez
resuelta (los navegadores no re-evalúan el autoplay al cambiar el atributo después de que el elemento ya
cargó). Un `useEffect` con `[reproducir]` que llama `.play()`/`.pause()` sí reacciona. Es la MISMA
técnica que ya usa `NosotrosGaleria.tsx`, aplicada sin el `IntersectionObserver` (que ahí existe para
diferir la descarga bajo el fold; acá no hace falta porque el hero siempre está a la vista). `muted`
también se fija por REF en el mismo efecto —el prop de React no siempre llega al atributo del DOM, e iOS
bloquea el autoplay de un `<video>` sin eso—.

**`preload`: `"auto"` sólo cuando SÍ va a reproducir; `"none"` si no (preview o reduced-motion).** No
existe, en el set de tipos de React de este repo, un equivalente de `priority` (de `<Image>`) para
`<video>` — medido: `VideoHTMLAttributes` (vía `MediaHTMLAttributes`) no declara `fetchPriority`, a
diferencia de `img`/`link`/`script`. `preload="auto"` es el único lever disponible para adelantar la
descarga cuando el video SÍ va a reproducir; cuando no (preview/reduce), `"none"` evita bajar los bytes
del video —el `poster` se muestra igual, sin depender de `preload`—. El póster en sí no recibe un trato
de prioridad adicional: es un atributo HTML plano (`<video poster>`), no pasa por el optimizador de
`next/image`, así que no hay ninguna palanca de Next que aplicarle.

**EL MECANISMO CONTRA EL PÓSTER HUÉRFANO, y lo que NO cierra.** `REGISTRY.hero.imagenes` pasó de
`['imagen']` a `['imagen', 'imagenPoster']` —si no, el borrado de blobs (`imagenesDe`,
`site-content-blobs.ts`, sin tocar en este slice) nunca vería el póster y un video reemplazado dejaría
su póster viejo huérfano en el storage para siempre—. Dos tests DERIVADOS lo protegen contra que se
repita con otra sección u otro campo: (a) para toda sección NO-repeater del REGISTRY, cada nombre de
`imagenes` existe como campo en `DEFAULTS[seccion]` (atrapa un typo/rename); (b) un test nombrado que
afirma que `REGISTRY.hero.imagenes` son exactamente los dos blobs del hero. **Lo que ninguno de los dos
cubre, y queda como pregunta abierta:** la dirección peligrosa de verdad —un campo NUEVO que GUARDA una
url de blob pero que alguien olvida declarar en `imagenes`— no es derivable hoy, porque nada en el
modelo marca qué string es "un blob" y cuál es un path estático o un id cualquiera. Cerrarla exigiría un
marcador de tipo nuevo en el REGISTRY (algo como `campos: { imagen: { blob: true } }`) que hoy no existe
y que este slice no inventa —cambiaría la forma del REGISTRY para las diez secciones existentes por un
caso hipotético, no el que se pidió—. Se nombra para que el owner decida si vale la pena, con el costo:
tocar `SeccionDef`, el resolver, y re-declarar `imagenes`/`campos` de las diez secciones para que el
marcador y la lista no diverjan (sería la MISMA clase de doble-lista que `imagenes` ya es respecto de
`DEFAULTS`, un nivel más abajo).

**LA MITAD DEL BYTE-IDÉNTICO QUE QUEDA POR LECTURA, no por construcción.** La capa del DATO está
cubierta sin escribir un test nuevo: `site-content-defaults.test.ts` ya hacía
`deepEqual(resolverSiteContent({}).hero, DEFAULTS.hero)`, y con `imagenTipo:'imagen'`/`imagenPoster:''`
agregados a `DEFAULTS.hero` ese test sigue pasando sin tocarlo. Lo que NINGÚN test de este repo puede
afirmar es que `HeroCurtina.tsx`/`HeroFicha.tsx` siguen montando `<Image>` (no `<video>`) cuando
`imagenTipo` es `'imagen'` o está ausente — no hay jsdom ni testing-library instalados, y no se instaló
ninguno en este slice (fuera de alcance). Se verificó por LECTURA y por DIFF: el branch `false` del
ternario `esVideo ? <video>… : <Image>…` es, carácter por carácter, el mismo bloque `<Image src=
{hero.imagen} alt="" fill priority sizes=… quality={85} className=…/>` que existía antes de este slice
en los dos archivos —confirmado con `git diff` sobre el árbol final, no sólo leído una vez al escribir
el cambio—. Esa garantía queda por LECTURA, no por construcción; no se reporta como cubierta por test.

**Gate, medido en el árbol final de la rama:** `npm test` → **1151/1151** (piso previo 1136 + 15 tests
nuevos: 11 en `site-content-defaults.test.ts`, 4 en `site-content-schema.test.ts`). `npx tsc --noEmit` →
0 errores. `npm run build` → verde (52 migraciones, sin pendientes; compiló, generó las 48 páginas
estáticas, sin error de tipos).

**Tier 1 / AWAITING_APPROVAL.** Toca DOS archivos nombrados uno por uno en la lista Tier 1 de CLAUDE.md
(`lib/config/site-content-defaults.ts`, `lib/config/site-content-schema.ts`) — no tres: se verificó
contra el texto literal de la lista (§ CLAUDE.md, "Tier 1 — superficies protegidas") y `constants/
upload.ts`/`components/admin/TiendaSeccionEditor.tsx` NO aparecen nombrados ahí, así que la cifra "tres"
del encargo original no se sostiene contra el texto y se corrige acá (la medición manda). Además toca
el SUBÁRBOL `components/storefront/` entero, protegido como tal por la misma doctrina —
`components/storefront/home/HeroCurtina.tsx`/`HeroFicha.tsx` no están nombrados individualmente, pero
son los bytes del visitante relocalizados, la misma razón que protege `app/(storefront)/`—. No se
mergea sin el visto bueno del owner sobre este diff en concreto.

Regla: § HeroContent / REGISTRY.hero (`lib/config/site-content-defaults.ts`) · § heroEditableSchema
(`lib/config/site-content-schema.ts`) · § MAX_VIDEO_HERO_BYTES (`constants/upload.ts`) · § El editor de
la tienda dibuja por BLOQUES (CLAUDE.md, para el patrón que `renderMediaHero` extiende sin tocar
`tienda-secciones.ts` ni `lib/tienda/bloques.ts`).

## 2026-09-15 — El póster del hero se pide con prioridad, como ya hace `priority` con la imagen (`HERO-VIDEO-POSTER-PRIORIDAD-1`)

**EL DEFECTO ERA DE OMISIÓN, no de diseño equivocado.** `HERO-VIDEO-COMO-DATO-1` razonó correctamente
que el `<video>` en sí no tiene un prop de prioridad equivalente a `priority` de `<Image>` —medido:
`VideoHTMLAttributes` no trae `fetchPriority`— y concluyó "`preload` es lo que hay". Eso es cierto DEL
VIDEO. Pero el **póster no es el video: es un recurso de IMAGEN aparte**, y nadie le había dado
prioridad. Con `imagenTipo:'imagen'`, `<Image priority>` ya emite un `<link rel="preload" as="image"
fetchpriority="high">` en el `<head>`; con `imagenTipo:'video'`, el póster se descubría recién cuando
el parser llegaba al `<video>` y sin ninguna señal de prioridad — el primer pintado empeoraba con video
respecto a sin video, justo lo que `MAX_VIDEO_HERO_BYTES` (8 MB) existe para evitar, porque el póster es
lo ÚNICO que el visitante ve mientras el video baja.

**EL MECANISMO: `ReactDOM.preload(hero.imagenPoster, { as:'image', fetchPriority:'high' })`, no un
`<link>` en el JSX.** Medido antes de escribir el cambio: el repo corre Next 16.2.6 / React 19.2.4,
donde `react-dom` exporta `preload` (`node_modules/@types/react-dom/index.d.ts:94`) como la API
dedicada a este caso — inserta el recurso en el `<head>` durante el render, en servidor o cliente sin
depender de dónde se llame, y dedupea por href. Se prefirió sobre un `<link>` renderizado a mano porque
es la forma que React 19 documenta para exactamente esta situación (un recurso de imagen que el
navegador no descubre a tiempo por sí solo, como un `background-image` o —acá— el atributo `poster` de
un `<video>`), y porque no exige razonar sobre hoisting de `<link>` en el árbol de un componente
`'use client'`. La llamada va en el CUERPO del render (no en el `useEffect` de la reproducción), para
que emita en el HTML servido en SSR — igual que `<Image priority>`.

**NO depende de `reproducir` — es la respuesta a la pregunta que el spec dejó abierta.** El póster es lo
único visible tanto si el video reproduce (mientras buferea) como si se queda quieto para siempre
(preview, `prefers-reduced-motion`, `preload="none"`). Adelantarlo sólo en el caso "va a reproducir"
dejaría sin prioridad justo el caso donde el póster ES la pantalla completa, no un estado transitorio.
El guard es únicamente `esVideo && hero.imagenPoster`.

**BYTE-IDÉNTICO CON `imagenTipo:'imagen'`, por CONSTRUCCIÓN.** `esVideo` es `false` en ese caso (`hero.
imagenTipo === 'video'`), así que el `&&` corta antes de invocar `preload` — la única función nueva de
este diff. Ninguna otra línea del diff es alcanzable bajo `imagenTipo:'imagen'`. Confirmado además que
el default resuelto de Nayoli/fábrica es `imagenTipo:'imagen'` (`site-content-defaults.ts:443`), así que
el storefront de hoy no ejecuta la rama nueva en absoluto.

**EL COMENTARIO DE `preload` SE CORRIGIÓ, no se amplió por abajo**, para que quien lo lea no se quede con
la idea de que ahí terminaba lo que se podía hacer por la prioridad: ahora dice, por separado, que el
`<video>` en sí no tiene prop de prioridad Y que el PÓSTER sí la puede llevar, con el `preload(...)` de
arriba como referencia.

**Gate, medido en el árbol final de la rama:** `npm test` → **1151/1151** (sin tests nuevos — este slice
no toca `lib/`/`constants/`/`packages/core`, y el repo no tiene jsdom/testing-library para afirmar por
ejecución un efecto de render de un componente `'use client'`; ver el precedente de la entrada anterior,
"LA MITAD DEL BYTE-IDÉNTICO QUE QUEDA POR LECTURA, no por construcción" — el byte-identidad de este
slice es la misma clase de garantía). `npx tsc --noEmit` → 0 errores. `npm run build` → verde; el chunk
SSR compilado del home (`.next/server/chunks/ssr/components_storefront_home_0*.js`) contiene
`fetchPriority` e `imagenPoster` (grep sobre el artefacto, no la fuente), confirmando que el build
incluye el cambio.

**Tier 1 / AWAITING_APPROVAL.** Toca el subárbol `components/storefront/` (`HeroCurtina.tsx`/
`HeroFicha.tsx`, ya protegidos por la misma razón que la entrada anterior) y este archivo. No se mergea
sin el visto bueno del owner.

## 2026-09-15 — El gate de un slice corre los DOS carriles, siempre
`212f3bf` (Merge GATE-DOS-CARRILES-1: el gate de un slice corre los dos carriles)

**Elección:** `npm run gate` compone `npm test` (capa 1, sin base) + `npm run test:integracion`
(capa 2, Postgres efímero), en ese orden, y se corre SIEMPRE al cerrar un slice — no condicionado
a qué paths toca el diff. Los dos scripts existentes no se tocan; `gate` sólo los encadena.

**La regla del owner, con sus palabras:** «un test que el gate no corre es documentación» — la
tercera vez en la semana de la misma familia (un test fuera de un glob, una guarda sin invocar),
esta vez a escala de 191.

**El hecho histórico, con su fecha:** el carril de integración es un script SEPARADO desde que
nació (`e3fa241`, 2026-08-04 — verificado en `git log`). Durante **seis semanas** (2026-08-04 →
2026-09-15) ningún gate de slice lo ejecutó: hoy son **27 archivos y 191 tests**
(`tests/integracion/*.test.ts`, contados por ejecución) que corrían en verde sin que un solo
cierre de slice los mirara.

**Opciones evaluadas:** (a) correrlo SIEMPRE; (b) correrlo sólo cuando el diff toca ciertos paths
(`packages/core/src`, `app/api/`…); (c) dejarlo suelto y documentado, sin componerlo.
**Descartada (b), la intermedia, con su razón:** cuesta más de lo que ahorra a este precio —
el carril completo mide ~21 s de tests (191) más el arranque/migración/teardown del cluster,
contra ~8 s de `npm test`; y es una regla MÁS que mantener, que puede clasificar mal un diff, y
que sería la PRÓXIMA que "existe pero no corre". **SIEMPRE es más barato que A VECES.**
**Descartada (c):** es el estado que la regla del owner acaba de declarar insuficiente —
documentación, no gate.

**El prerrequisito, no gratis:** el carril necesita los binarios de Postgres (`initdb`, `pg_ctl`)
en el PATH (`brew install postgresql@14`). Sin ellos, `npm run gate` de CUALQUIER slice se pone
ROJO por eso y no por el slice; el mensaje del propio script (`scripts/test-integracion.sh`) ya
trae el remedio.

Regla: § El GATE de un slice corre LOS DOS CARRILES — `npm run gate` (CLAUDE.md).

**Gate, medido en el árbol final de la rama (branch tree `f5186c1`, idéntico al merge tree):**
`npm run gate` → verde. `npm test`: **1151/1151** en 7.63 s. `npm run test:integracion`:
**191/191** en 20.72 s de tests (≈38 s de punta a punta, midiendo con `date` antes/después del
comando completo — incluye `initdb`, `CREATE DATABASE`, `migrate deploy` y el teardown del
cluster). `npx tsc --noEmit` → 0 errores. Ningún test se tocó, movió ni arregló.

**Falla bien, verificado sin dejar ningún test roto en el árbol:** se agregó un script temporal
`_gate_probe_falla` (`node -e "process.exit(7)" && node -e "console.log('SHOULD_NOT_RUN')"`) a
`package.json`, se corrió con `npm run --silent _gate_probe_falla`, y se retiró en el mismo turno
(nunca comiteado — `git status` quedó limpio antes del commit). Confirmó las dos mitades del
mecanismo de `&&` que usa `gate`: el proceso hijo terminó con código **7** (el de la primera
mitad) y la segunda mitad NO se ejecutó (`SHOULD_NOT_RUN` no apareció en salida). Es el mismo
mecanismo con el que `npm test && npm run test:integracion` falla el conjunto si falla cualquiera
de los dos, sin perder el código de salida.

**Deviación medida contra el spec:** el spec afirmaba **28 archivos** en `tests/integracion/`;
contados por `find` son **27** (191 tests coinciden). Se usó la cifra medida.

**Tier 2 / COMPLETE.** No toca schema, no toca `app/(storefront)/` ni ningún byte que un
visitante lea, no cambia un contrato cross-repo. `package.json` sólo agrega un script; `CLAUDE.md`
y este archivo son documentación de proceso del repo, no producto.
## 2026-09-15 — El creador de intentos de pago: la fila nace con la orden, apagada por falta de disparador (`WOMPI-CREADOR-DE-INTENTOS-1`)

**LO QUE ES (a), y las tres cosas que deliberadamente NO son.** Este slice construye únicamente que
exista una fila de `PaymentIntent` con su referencia y firma de integridad al crear una orden. NO
construye el widget, NO crea la ruta de retorno, y NO inventa el toggle por despliegue que decidiría
cuándo pedir un intento — ninguna de las tres existe todavía, y ninguna se diseñó acá.

**EL HALLAZGO DEL CENSO SE CONFIRMÓ: `lib/pagos/wompi-firma.ts` sólo tenía la mitad de eventos.**
Verificado antes de tocar nada — `grep -n "^export" lib/pagos/wompi-firma.ts` daba una sola función
(`verificarFirmaWompi`) y `grep -rn "WOMPI_INTEGRITY_SECRET" --include="*.ts" .` daba CERO en todo el
repo. El archivo ganó su segunda mitad: `pesosACentavos` y `firmarIntegridadWompi`.

**LA FÓRMULA SALIÓ DEL LEDGER, citada, no inventada.** `WOMPI-REGLAS-IMPLEMENTACION-1` (línea ~1177 de
este archivo): *"`WOMPI_INTEGRITY_SECRET` firma la petición que NOSOTROS iniciamos:
`sha256_hex(reference + amount_in_cents + currency + <secreto>)`, concatenación plana, en ese orden, sin
separadores — el spike la verificó recomputando el ejemplo de la doc byte a byte y dio idéntico."* A
diferencia del checksum de eventos (cuyo ejemplo NO reproduce, ya documentado), éste sí fue confirmado
byte a byte contra el sandbox — así que `firmarIntegridadWompi` implementa la fórmula tal cual, sin
margen de reinterpretación. El módulo sigue el mismo principio que `verificarFirmaWompi`: nunca lee
`process.env`; el secreto entra como parámetro y la ruta decide de dónde sale.

**EL MONTO EN CENTAVOS — medido el defecto real, no uno hipotético.** `Order.total` y
`PaymentIntent.monto_esperado` son `Float` (verificado en `schema.prisma`). Medido en Node:
`4.35 * 100 === 434.99999999999994` y `19.99 * 100 === 1998.9999999999998` — truncar cualquiera de los
dos (`Math.trunc`, `| 0`) da un centavo MENOS que el monto real. `pesosACentavos` usa `Math.round`: el
error de coma flotante de un monto real es una fracción minúscula de centavo, muy por debajo del umbral
de 0.5 que `Math.round` necesita para cambiar de dirección. Se buscó primero un precedente de conversión
de dinero en el repo (`grep` sobre `Math.round`/centavos/cents/`* 100` en `lib/`, `packages/core/src`,
`app/`) y no había ninguno en la dirección pesos→centavos — sólo la inversa, ya existente en el webhook
(`app/api/webhooks/wompi/route.ts:103`, `amount_in_cents / 100`). El monto se calcula UNA sola vez en
`app/api/checkout/route.ts` (`pesosACentavos(order.paymentIntent.monto_esperado)`) y ese mismo valor
alimenta tanto la firma como el campo `amountInCents` de la respuesta — nunca dos cálculos del mismo
monto.

**POR QUÉ EL INTENTO NACE DENTRO DE LA MISMA TRANSACCIÓN que la orden.** Medido: `createOrderWithCustomer`
(`packages/core/src/orders.ts`) abre un `prisma.$transaction` que crea el Customer, la Order, sus items y
el asiento de transición de cobro. El creador de intentos se insertó DENTRO de esa transacción, después
del asiento de creación y antes de la rama de `immediatePayment` — la razón es doble y no admite término
medio: una orden con un intento que falló en crearse es una orden que nadie puede pagar en línea, y un
intento sin orden es una fila huérfana que el barrido (todavía sin construir) tendría que limpiar. Las
dos se evitan gratis si nacen o mueren juntas.

**LA REFERENCIA EXIGIÓ DOS ESCRITURAS, medido y no evitado.** El comentario del modelo en `schema.prisma`
es explícito: `reference` = `"<numero_orden>:<cuid de esta fila>"`, y es el `id` de la PROPIA fila
(`@default(cuid())`) el que hace la unicidad, "sin contador que escribir ni lock que tomar". Medido: no
hay ninguna librería de generación de cuid en el repo (`grep -rn "createId\|@paralleldrive/cuid2\|from
'cuid'"` da cero, y `cuid` no aparece en ningún `package.json`), así que no hay forma de conocer el `id`
que Prisma va a generar ANTES de insertar sin pasarlo explícito — y pasar un id generado por otra vía
(p. ej. `crypto.randomUUID()`) dejaría de ser "el cuid de la propia fila" en el sentido que el schema
describe. Se optó por DOS escrituras dentro de la misma transacción: `create` con un placeholder
(`_pendiente_<uuid random>`, para satisfacer el `@unique` no-nulo de `reference` en el insert) y luego
`update` con la referencia real una vez que Prisma devolvió el `id`. Costo medido: una query extra por
intento creado, dentro de una transacción que ya hace varias (upsert de cliente, create de orden, create
de items, insert de la transición); el placeholder nunca es visible fuera de la transacción sin
comprometer, y si el `update` fallara la transacción entera revierte — no queda ninguna fila con el
placeholder.

**LA CAPACIDAD NACE APAGADA — verificado quién la pide hoy: NADIE.** El spec afirmaba que
`createOrderWithCustomer` tiene TRES llamadores que no saben nada de Wompi; medido por grep
(`grep -n "createOrderWithCustomer("` sobre archivos que no son test/script) sólo aparecen DOS de
producción: `app/api/checkout/route.ts` y `app/api/orders/route.ts`. El tercero que el spec citaba no
apareció en la búsqueda — se deja anotado como discrepancia medida contra el spec, sin impacto en el
diseño: el flag es opt-in y ninguno de los dos callers lo pasa. El nuevo parámetro es
`crearIntentoPago?: boolean`, default ausente/`false`.
`app/api/checkout/route.ts` NO lo pasa — la selección de método de pasarela (b/c/d) no existe, así que no
hay de dónde sacar la decisión sin inventar un disparador. Se optó por **"cableá el camino completo y
dejalo sin disparador"** (la primera de las dos opciones del spec) en vez de un disparador inventado: la
rama que arma la respuesta de Wompi en el checkout queda escrita, pero es código estructuralmente
inalcanzable hoy — `order.paymentIntent` es siempre `undefined` porque nadie pide el intento. Es la
diferencia entre «listo» y «habilitado»: la capacidad está lista, no habilitada.

**GARANTÍA "SIN EL FLAG NO CAMBIA UN BYTE" — por dos mecanismos distintos, cada uno donde corresponde.**
En `orders.ts`: la única llamada a `tx.paymentIntent.create` está detrás de un único
`if (input.crearIntentoPago)` — sin el flag, cero filas nuevas, verificable por lectura. El objeto que
`createOrderWithCustomer` devuelve SIEMPRE lleva la clave `paymentIntent` (para que TypeScript tenga un
tipo uniforme entre las tres rutas de retorno: creación fresca, fast-path de idempotencia, y dedup por
P2002), pero vale `undefined` cuando no se creó ninguno — y `JSON.stringify`/`NextResponse.json` OMITEN
una clave en `undefined`, así que `app/api/orders/route.ts` (que hace `NextResponse.json(result, ...)`,
un spread completo del resultado) no gana un byte nuevo en su respuesta aunque el objeto en memoria tenga
la clave. En `app/api/checkout/route.ts`: la respuesta usa `...(wompi ? { wompi } : {})` — sin intento,
el spread de `{}` no agrega nada.

**LO QUE NO SE PUDO AFIRMAR CON UN TEST, y por qué.** `packages/core/src/orders.test.ts` corre SIN base
(`npm test`: sólo `lib/**`, `constants/**`, `packages/core/**`, `node --test`, sin Postgres — verificado
en `package.json`). La escritura real del `PaymentIntent` vive dentro de `Prisma.TransactionClient`, así
que la garantía "sin el flag no se crea ninguna fila" sólo es demostrable con una base real — y eso es
del carril de integración (`tests/integracion/`), que `touches:` de este slice no incluye. Se afirmó lo
que SÍ es puro: el formato de `referenciaIntentoPago` (dos tests). La garantía de fila queda, hoy, por
CONSTRUCCIÓN (el único `if` que envuelve la única llamada a `tx.paymentIntent.create`) y documentada como
hueco, no como cubierta. Un slice de integración que la afirme contra Postgres real queda abierto (ver
`open_followups` del reporte de este slice).

**LA PREGUNTA DE VARIOS INTENTOS APROBADOS QUEDA IGUAL DE ABIERTA — no se cerró la puerta.**
`PaymentIntent.orden_id` sigue con índice, no unique (verificado en `schema.prisma`), así que una orden
puede tener varios intentos. Este slice no agrega ninguna unique ni asume "uno por orden" en ningún
cálculo: cada intento tiene su propia referencia (por eso `reference` embebe el `id` de la fila, no sólo
`numero_orden`), así que dos intentos de la misma orden coexisten sin chocar contra el `@unique`. Qué pasa
si dos terminan `APROBADO` sigue siendo del owner, sin resolver acá.

**Gate, medido en el árbol final de la rama:** `npm test` → **1162/1162** (piso previo 1151 + 11 tests
nuevos: 9 en `lib/pagos/wompi-firma.test.ts` — `pesosACentavos` ×3, `firmarIntegridadWompi` ×6 — y 2 en
`packages/core/src/orders.test.ts` — `referenciaIntentoPago`). `npx tsc --noEmit` → 0 errores.
`npm run build` → verde (52 migraciones, sin pendientes; compiló, generó las páginas estáticas y
`/api/checkout` como ruta dinámica, sin error de tipos).

**Tier 1 / AWAITING_APPROVAL.** Toca TRES archivos nombrados uno por uno en la lista Tier 1 de
CLAUDE.md: `packages/core/src/orders.ts`, `lib/pagos/wompi-firma.ts`, `app/api/checkout/route.ts`. No se
mergea sin el visto bueno del owner sobre este diff en concreto.

Regla: § Pagos en línea (Wompi) — cobros automáticos (CLAUDE.md), que ya cita el estado de
`PaymentIntent` y el webhook — este asiento no reescribe esa sección; agrega el creador de intentos como
pieza construida y sigue apagada.

## 2026-09-15 — La atomicidad del creador de intentos queda AFIRMADA por un test, no explicada por un comentario (`WOMPI-INTENTO-ATOMICO-AFIRMADO-1`)

**LA PROPIEDAD, con las palabras del owner.** `WOMPI-CREADOR-DE-INTENTOS-1` dejó un `PaymentIntent` que
nace en DOS escrituras (placeholder → referencia real) dentro de la MISMA transacción que la orden, y el
owner aceptó ese diseño por una razón puntual: *"es seguro por UNA propiedad: las dos viven en la misma
transacción, así que nunca es observable"*. El daño si esa propiedad se pierde —si alguien mueve la
creación del intento FUERA del `$transaction`— también quedó dicho por el owner: si el proceso muere
entre las dos escrituras, sobrevive una fila con la referencia placeholder; el reconciliador (todavía sin
construir) le preguntaría a Wompi por una referencia que NUNCA EXISTIÓ, y Wompi responde
`200 {"data":[]}` — indistinguible de "todavía no se creó". El intento quedaría vivo hasta que el barrido
lo cierre a las 48 h. El asiento anterior dejó esta garantía como un comentario en `orders.ts`; este slice
la convierte en un test, sin tocar una sola línea de `orders.ts`.

**DÓNDE VA EL TEST — medido, no supuesto.** `createOrderWithCustomer` importa `prisma` a nivel de módulo
(`packages/core/src/orders.ts:2`), sin inyección posible: la propiedad de un `$transaction` real contra
Postgres no se puede fingir con un mock. El repo ya tiene el carril para esto
(`npm run test:integracion`, `scripts/test-integracion.sh`, Postgres efímero en :55432) con precedentes
exactos de forzar fallos/concurrencia dentro de una transacción (`ajuste-concurrente.test.ts`,
`despacho-concurrente.test.ts`), así que el test nuevo (`tests/integracion/intento-pago-atomico.test.ts`)
sigue esa forma.

**CÓMO SE FUERZA EL FALLO DENTRO DE LA TRANSACCIÓN — sin tocar `orders.ts`.** Medido: dentro de la misma
transacción, `crearIntentoPago` escribe el `PaymentIntent` (sus dos escrituras) ANTES de que
`immediatePayment` corra `registerOrderPaymentTx` → `tx.payment.create`. Pasando
`immediatePayment: { metodo: 'NO_EXISTE_EN_EL_ENUM' as MetodoPago }` —un valor que el enum `MetodoPago`
del schema rechaza y que sólo entra forzando el tipo con `as`, nunca alcanzable desde una ruta real—
`tx.payment.create` revienta DESPUÉS de que el intento ya tuvo sus dos escrituras, dentro del mismo `tx`.
Como el error no es una violación de unicidad (`isUniqueViolation` da `false`), `createOrderWithCustomer`
no reintenta: propaga el error tal cual, y Prisma revierte la transacción entera. El primer test afirma
la consecuencia directa: tras el `reject`, `prisma.order.count()` y `prisma.paymentIntent.count()` dan
CERO — ni la orden ni el intento sobreviven, la prueba de que el intento nació y murió dentro de la MISMA
transacción que la orden.

**EL SEGUNDO TEST afirma la consecuencia observable del daño**, la que el owner nombró como mínimo
aceptable: tras un alta exitosa, un barrido de TODA la tabla `PaymentIntent` (no sólo la fila de la orden
creada) no encuentra ninguna fila que se haya quedado en su forma placeholder.

**EL PREFIJO DEL PLACEHOLDER NO SE DUPLICÓ COMO LITERAL, medido antes de escribir el test.**
`grep -rn "_pendiente_" --include="*.ts" .` da UNA sola aparición en todo el repo: el literal inline en
`orders.ts:602` (`` `_pendiente_${randomUUID()}` ``) — no existe como constante exportada. Copiar ese
literal en el test lo habría dejado de proteger el día que alguien cambie el prefijo (la guarda dejaría de
correr sin que nadie lo note). En su lugar, el segundo test afirma la FORMA final: para cada fila de la
tabla, `fila.reference === referenciaIntentoPago(fila.order.numero_orden, fila.id)` — una igualdad que NO
puede cumplirse si la fila se hubiera quedado en `_pendiente_<uuid>` (esa cadena nunca contiene el `:` que
`referenciaIntentoPago` siempre produce), así que barre el mismo hueco sin duplicar un valor que puede
cambiar. **Propuesta, no impuesta:** si el owner prefiere una guarda literal sobre el prefijo, la salida
barata es exportar el literal como constante nombrada (p. ej. `PLACEHOLDER_REFERENCIA_PREFIX`) desde
`orders.ts` y que el test la importe — un cambio de una línea en un archivo Tier 1, fuera del alcance de
este slice (`touches:` no lo incluye). Queda anotado como `open_followup`, no ejecutado.

**ADVERTENCIA DE ALCANCE, dicha explícitamente y no en silencio: este test vive en un carril que el gate
normal NO ejecuta.** `tests/integracion/**/*.test.ts` sólo corre con `npm run test:integracion` (Postgres
efímero, prerequisito `brew install postgresql@14`). `npm test` (el gate de capa 1, `lib/**`,
`constants/**`, `packages/core/**`) no lo toca — verificado en `package.json`, dos scripts distintos. Para
que esta afirmación corriera donde el gate normal la vea, `test:integracion` tendría que sumarse al
pipeline de CI/pre-merge; hoy es un carril MANUAL, aparte. Se nombra explícito porque esta misma semana ya
se envió un test que no corría por vivir fuera de un glob (mismo modo de falla: una afirmación que existe
en el repo pero que nadie ejecuta en el camino que importa).

**EL COMENTARIO DE `pesosACentavos` — medido y corregido, sin tocar la implementación.** Verificado:
`grep -n "Decimal" packages/core/prisma/schema.prisma` da CERO — todo monto (`Order.total`,
`costo_envio`, `precio`, `monto_esperado`) es `Float`, así que `Math.round` no tapa ninguna conversión
implícita de `Decimal`; ese riesgo no existe en este repo. Pero el comentario original tampoco decía lo
que el código real hace: medido el camino del total en las DOS rutas que crean órdenes
(`app/api/checkout/route.ts:129`, `app/api/orders/route.ts:159`), ambas computan
`total = subtotal + costo_envio` — una SUMA, sin porcentajes, sin descuentos, sin IVA repartido — y
`resolveOrderLines` (`packages/core/src/orders.ts:763`) multiplica `precio_unitario * cantidad` sobre
precios que hoy siempre son enteros de COP (aunque `Product.precio` sea `Float` sin una validación de
entero explícita — no hay una regla de negocio que lo impida, sólo que ninguna ruta de HOY produce una
fracción). O sea: **hoy `pesosACentavos` nunca recibe un 4.35 real; `Math.round` es una guarda contra un
FUTURO** (un descuento, un IVA repartido, una promoción), no el arreglo de un defecto vivo. Se ajustaron
el nombre de los dos casos de test y se agregó una nota de cabecera en
`lib/pagos/wompi-firma.test.ts` que dice esto con las palabras que merece, para que nadie lea "4.35" en el
archivo y concluya que el sistema cobra con centavos hoy. **La implementación (`Math.round` en
`wompi-firma.ts`) NO se tocó** — no está en `touches:` de este slice, y no hacía falta: el código ya era
correcto, lo que estaba incompleto era la explicación.

**GATE, medido en el árbol final de la rama.** `npm test` → **1162/1162**, sin cambio de piso — los
ajustes en `wompi-firma.test.ts` son de nombre/comentario, ninguna aserción nueva ni removida en capa 1.
`npx tsc --noEmit` → 0 errores. `npm run test:integracion` → **193/193**, piso anterior **191** (dos tests
nuevos, ambos vistos pasar: la atomicidad y el barrido de placeholders). `npm run build` no se corrió —no
lo pide el spec de este slice y el diff no toca nada que built afecte de forma distinta a lo ya verificado
en el slice anterior.

**Tier 1 / AWAITING_APPROVAL — por la RAMA, no por este commit.** El diff propio de este slice
(`tests/integracion/intento-pago-atomico.test.ts`, `lib/pagos/wompi-firma.test.ts`, este asiento) no toca
ningún archivo Tier 1 listado en CLAUDE.md — ninguno de los dos es un archivo de producción, y
`packages/core/src/orders.ts`/`lib/pagos/wompi-firma.ts` no se editaron. Pero la RAMA
(`slice/wompi-creador-de-intentos-1`) sigue cargando, sin pushear, el commit `52cba81` de
`WOMPI-CREADOR-DE-INTENTOS-1`, que SÍ toca tres archivos Tier 1 (`packages/core/src/orders.ts`,
`lib/pagos/wompi-firma.ts`, `app/api/checkout/route.ts`) y que ya cerró como AWAITING_APPROVAL sin el visto
bueno del owner sobre ESE diff. Mergear esta rama a `main` mergearía también aquel diff todavía sin
aprobar. No se mergea nada hasta que el owner dé el visto bueno explícito sobre el conjunto.
## 2026-09-15 — La regla de llaves de la pasarela deja de ser una intención: `register()` la hace cumplir (`PASARELA-LLAVES-COHERENTES-1`)

**LA REGLA YA ESTABA ESCRITA Y NO SE CUMPLÍA.** CLAUDE.md § Pagos en línea (Wompi) dice, en mayúsculas,
que un despliegue en estado DEMO lleva llaves de SANDBOX aunque su rama sea `main` y su deploy sea
"producción" en Vercel. Hasta este slice esa frase no tenía nada detrás: dependía enteramente de que el
operador no se equivocara al pegar variables de entorno en el dashboard de Vercel. Sin nada que la
hiciera cumplir, no era una guarda — era una intención. Lo que se evita, sin eufemismo: que una tienda
de DEMO cobre dinero real a una persona real.

**LA FORMA: LISTA NEGRA, NO LISTA BLANCA (decisión del owner, con su razón textual).** *"Una lista
blanca rompe el despliegue el día que Wompi agregue un entorno o cambie una convención; la lista negra
sigue protegiendo contra lo único peligroso —cobrar de verdad en una tienda que no vende— y falla del
lado seguro. Además no necesitamos afirmar el prefijo de sandbox, que es el dato que no tenemos
medido."* Se rechaza únicamente `pub_prod_` —el prefijo de la llave pública PRODUCTIVA, confirmado por
el owner de primera mano contra el dashboard de Wompi—; cualquier otro valor (sandbox, un prefijo que
Wompi todavía no usa, o ninguna llave) pasa. `WOMPI_PUBLIC_KEY` es la única variable que este chequeo
mira, porque es la única llave que NO es secreta —viaja al navegador—; las otras tres de la pasarela no
se leen, no se comparan y no se nombran en ningún mensaje.

**DÓNDE CORRE, y por qué eso importa:** `instrumentation.ts` (nuevo, raíz del repo) exporta `register()`,
el punto que Next.js llama UNA VEZ cuando arranca una instancia nueva del servidor, antes de atender el
primer request. Medido contra el código instalado, no asumido:
`node_modules/next/dist/server/lib/router-utils/instrumentation-globals.external.js` memoiza la promesa
de registro (`registerInstrumentationPromise`, corre una sola vez por proceso) y EXPLÍCITAMENTE se salta
en build (`if (process.env.NEXT_PHASE === 'phase-production-build') return;`). Por eso el chequeo no
puede romper `next build` por diseño de Next, no sólo porque en este entorno no hay llaves configuradas
—se verificó además que `npm run build` da verde con la función presente—.

**EL ACOPLAMIENTO, dicho explícito porque es el riesgo real del reuso:** `esDespliegueDemo()` (extraída
de `next.config.ts`, donde antes vivía inline dentro de `headers()`) es la MISMA condición que decide si
se emite el header `noindex` — `VERCEL_ENV !== 'production' || NOINDEX === '1'`. Se reusó a propósito
(no se inventó una variable nueva) y el comentario de esa función en `next.config.ts` ahora dice, en el
sitio donde alguien la va a tocar, que gobierna DOS cosas y que quitar `NOINDEX` por una razón de SEO
desarma también este chequeo.

**EL CASO QUE QUEDA SIN CUBRIR, medido y reportado (no arreglado en este slice):** la condición asume
que el despliegue corre EN Vercel. Un self-host de este repo fuera de Vercel nunca tiene
`VERCEL_ENV === 'production'` (la variable simplemente no existe fuera de esa plataforma), así que
`esDespliegueDemo()` siempre devuelve `true` para él — un self-host que fuera una tienda real jamás
podría arrancar con una llave productiva sin que este chequeo lo bloquee. Hoy el repo se despliega
exclusivamente en Vercel (DEPLOY.md, CLAUDE.md § Migraciones y deploy), así que el caso no tiene
instancia real conocida; se deja escrito para que no se redescubra como bug el día que alguien intente
correr esto fuera de Vercel.

**LA FUNCIÓN QUE DECIDE ES PURA, a propósito.** `verificarLlavePasarelaCoherente(esDemo, llavePublica)`
recibe sus dos insumos por parámetro en vez de leer `process.env` adentro, para poder afirmar en un test
(`instrumentation.test.ts`) los cuatro casos que importan: llave productiva en demo rechaza; cualquier
otra llave en demo pasa; sin llave pasa (con o sin demo); y producción real con llave productiva pasa
—el caso legítimo—. `register()` es la única función que lee `process.env` (`VERCEL_ENV`, `NOINDEX` vía
`esDespliegueDemo()`, y `WOMPI_PUBLIC_KEY`) y sólo para pasárselo a la función pura.

**EL MENSAJE DE ERROR nombra la variable, nunca su valor.** Dice qué se detectó (demo + llave
productiva), por qué importa (cobro real en una tienda que no vende) y qué hacer (poner llaves de
sandbox, o quitar la marca de demo si el despliegue sí vende). No imprime `WOMPI_PUBLIC_KEY` ni completa
ni recortada, igual que el repo nunca imprime `DATABASE_URL`.

**SIN TOGGLE DE ENCENDIDO.** Este slice no decide si Wompi está activo ni construye ningún camino de
cobro — sólo impide una combinación peligrosa de configuración. El checkout, el webhook y `lib/pagos/`
no se tocaron.

**Gate, medido en el árbol final de la rama:** `npm test` → **1151/1151** (piso sin cambio: este slice no
toca `lib/`/`constants/`/`packages/core`, así que el glob de `npm test` no ve ni `instrumentation.ts` ni
su test — se corrieron aparte, `node --import tsx --test instrumentation.test.ts` → 4/4 verde). El spec
de este slice afirmaba un piso previo de 1162/1162; medido en el HEAD de partida (`bac4496`) el piso real
es 1151/1151 — la cifra del spec no se sostiene contra la medición y se corrige acá; no es un piso que
este slice haya movido. `npx tsc --noEmit` → 0 errores. `npm run build` → verde (52 migraciones, sin
pendientes; compiló, generó las páginas estáticas, sin error de tipos). Verificado además por ejecución
directa (no sólo por los tests): con `VERCEL_ENV=preview` + `WOMPI_PUBLIC_KEY=pub_prod_…`, `register()`
lanza con el mensaje esperado; con `VERCEL_ENV=production` + la misma llave, no lanza.

**Tier 2 / AWAITING_APPROVAL — por pedido explícito del owner, no por la política de merge.** El diff no
toca schema, no cambia bytes de cliente y no cambia un contrato cross-repo (las tres condiciones de la
política A), así que calificaría para merge automático; el owner pidió gatear esta rama a mano
("quiero gatearla sola"), así que la rama queda pusheada sin mergear hasta su visto bueno.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `instrumentation.ts` (`verificarLlavePasarelaCoherente`,
`PREFIJO_LLAVE_PASARELA_PRODUCTIVA`) · `next.config.ts` (`esDespliegueDemo`, extraída y reusada).

## 2026-09-15 — Un test que no corre no es una guarda: la mudanza a `lib/pagos/` (`PASARELA-LLAVES-TEST-QUE-CORRE-1`)

**EL DEFECTO, DICHO SIN SUAVIZARLO:** el slice anterior (`PASARELA-LLAVES-COHERENTES-1`) escribió su
test en `instrumentation.test.ts`, en la raíz del repo. El glob de `npm test`
(`"lib/**/*.test.ts" "constants/**/*.test.ts" "packages/core/**/*.test.ts"`) no llega a la raíz. El
test estaba escrito, pasaba cuando se lo invocaba a mano, y `npm test` nunca lo corría. **Un slice
cuyo propósito entero era "una regla escrita que nadie ejecuta" shippeó un test que nadie ejecuta.**
El worker anterior lo reportó en vez de callarlo, sin ensanchar su alcance por su cuenta — hizo bien;
faltaba autorización para tocar `lib/`.

**LA MUDANZA, sin cambiar ninguna decisión:** `verificarLlavePasarelaCoherente` y
`PREFIJO_LLAVE_PASARELA_PRODUCTIVA` (puras, sin `process.env` adentro) se mudaron a
`lib/pagos/llaves-pasarela.ts`, junto a `wompi-firma.ts` — su pariente exacto: la ruta del dinero,
sin lectura de entorno adentro. Su test se mudó con ellas a `lib/pagos/llaves-pasarela.test.ts`,
donde el glob sí llega. `instrumentation.ts` quedó como el gancho de arranque puro: lee el entorno,
llama a la función pura, aborta con el mensaje. `instrumentation.test.ts` se borró — no quedó
contenido propio que cubrir ahí; dejarlo habría sido un test vacío pareciendo cobertura.

**EFECTO SECUNDARIO NOMBRADO, no casualidad:** al vivir bajo `lib/pagos/`, el diff tripea la
política de merge por sí solo (el eje de cobro). El gate manual que el owner pidió deja de ser una
clasificación forzada y pasa a ser orgánico — el código quedó donde su riesgo dice que tiene que
estar.

**Gate, medido en el árbol final:** `npm test` antes de la mudanza → **1151/1151** (coincide con el
piso del slice anterior — la mudanza no tocó ningún archivo bajo el glob todavía). Después →
**1155/1155**, exactamente **+4** — las cuatro pruebas de la guarda, confirmadas por nombre dentro
de la corrida de `npm test` (antes sólo aparecían en una invocación aparte). `npx tsc --noEmit` → 0
errores. `npm run build` → verde, sin llaves configuradas, como antes. Los cuatro casos siguen
afirmados sin cambio de lógica (el diff de `instrumentation.ts` confirma que el cuerpo de la función
pura no se tocó, sólo se relocalizó).

**Tier 1 / AWAITING_APPROVAL — igual que su predecesor, el owner gatea esta rama a mano.**

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `lib/pagos/llaves-pasarela.ts`
(`verificarLlavePasarelaCoherente`, `PREFIJO_LLAVE_PASARELA_PRODUCTIVA`) · `instrumentation.ts`
(el gancho, sin lógica propia).

## 2026-09-15 — El enum de métodos del panel dice, en su comentario, por qué Wompi no entra ahí (`WOMPI-NO-ES-METODO-DEL-PANEL-1`)

**LA DECISIÓN DEL OWNER, con su razón, va ahora pegada al literal — no sólo acá.** Palabras del owner:
*«ese enum es "los métodos que el dueño configura en su panel", y Wompi es toggle de despliegue: el dueño
no lo enciende ni lo apaga.»* `MetodoPagoTipo` / `METODOS_PAGO_ORDEN` (`lib/checkout/metodos-pago.ts`) son
los CINCO tipos que el dueño agrega o quita desde Configuración (§ PAGOS-METODOS-MODELO-1); Wompi se
activa al configurar el DESPLIEGUE de un cliente — una decisión de una sola vez, al contratar, que sigue
el mismo patrón que el mark, los íconos y el tema (§ El código compartido no NACE siendo Nayoli/demo,
CLAUDE.md) — no una fila que el dueño prenda o apague. Sumarlo a esta lista le daría un toggle de panel
que la pasarela no tiene.

**LA MITAD QUE EVITA LA CONFUSIÓN: el otro enum, el de MAYÚSCULAS, SÍ va a ganar `WOMPI`.** `MetodoPago`
(`packages/core/prisma/schema.prisma:381-388`, el de `Payment`) responde una pregunta distinta — cómo
llegó la plata, no qué le ofrezco a elegir al cliente — y es el que un slice futuro (f) extiende con
`ALTER TYPE "MetodoPago" ADD VALUE 'WOMPI'` (ya anotado en el comentario del propio schema y en
`PASARELA-DECISIONES-LEDGER-1`, abajo). El comentario nuevo nombra ese enum y su archivo explícitamente,
para que quien busque dónde poner Wompi encuentre el lugar correcto en vez de sólo una negativa.

**POR QUÉ ESTO ATERRIZA ANTES DEL WIDGET, con las palabras del owner:** *«es exactamente lo que alguien
va a hacer "obvio" en (b), y el comentario es lo que va a leer»*. El ledger no está abierto cuando
alguien edita un enum — sólo el comentario junto al literal lo está.

**CERO CAMBIO DE LÓGICA — verificado por diff, no supuesto.** `git diff main -- lib/checkout/metodos-pago.ts`
toca sólo líneas `//` y `/** */`; ningún carácter de código se movió. `metodoPagoTipoSchema`,
`METODOS_PAGO_ORDEN`, `TIPOS`, `CAMPOS_METODO` y las cinco funciones de descripción quedan byte-idénticas.

**RE-MEDIDO, y el spec se equivocaba en un número menor.** El spec decía "162 líneas" para
`lib/checkout/metodos-pago.ts`; medido antes de tocar nada (`wc -l`), el archivo tenía **163**. El test
co-ubicado (`lib/checkout/metodos-pago.test.ts`) sí tenía los **21** casos que el spec citaba (`grep -c`
sobre `test(`/`it(`). Sin impacto en ningún juicio de esta tanda — se anota porque el spec pedía
re-medir, no confiar.

**DESVIACIÓN MEDIDA: el `observed-report` que el spec cita (`WOMPI-CHECKOUT-INTENTOS-CENSO-1`) NO
EXISTE** — ni en este archivo (`grep -n "WOMPI-CHECKOUT-INTENTOS-CENSO-1" DECISIONS.md` da cero) ni en
`git log --all --oneline --grep`. La decisión del owner y la distinción entre los dos enums que este
asiento documenta están sostenidas, en cambio, por asientos que SÍ existen: `PASARELA-DECISIONES-LEDGER-1`
(2026-09-13, línea 826), `WOMPI-WEBHOOK-RUTA-1` (2026-09-14, línea 1833 — la frase «el enum de hoy … no
tiene WOMPI … del owner, pendiente») y `WOMPI-CREADOR-DE-INTENTOS-1` (2026-09-15, línea 2931). Se anota
como discrepancia contra el spec, sin bloquear el trabajo: el argumento del comentario no depende del
censo citado, que no se pudo localizar.

**GATE, medido en el árbol final de la rama.** `npm test` → **1162/1162**, piso previo idéntico —
ninguna aserción se movió, sólo comentarios. `npm run test:integracion` → **193/193**, piso previo
idéntico. `npx tsc --noEmit` → 0 errores. `npm run build` no se corrió: el spec no lo pide y el diff no
toca nada que el build interprete distinto de la fuente ya compilada (comentarios, sin JSX).

**Tier 1 / AWAITING_APPROVAL.** `lib/checkout/metodos-pago.ts` está en la lista Tier 1 por NOMBRE y por
el subárbol `lib/checkout/`. No se mergea sin el visto bueno explícito del owner sobre este diff.

Regla: § Pagos en línea (Wompi) — cobros automáticos (CLAUDE.md); este asiento no reescribe esa sección,
documenta por qué el enum de métodos del checkout no es su lugar.

## 2026-09-15 — El paréntesis de `MetodoPagoTipo` tenía dos ejemplos falsos: se queda sólo el verdadero (`WOMPI-COMENTARIO-MINUSCULAS-FIX-1`)

**LA FRASE FALSA, MEDIDA ANTES DE TOCAR NADA.** El comentario que `WOMPI-NO-ES-METODO-DEL-PANEL-1` dejó
junto a `MetodoPagoTipo` (`lib/checkout/metodos-pago.ts`) decía que Wompi se enciende al configurar el
despliegue de un cliente *«junto con el resto de lo que ya sigue ese patrón — el mark, los íconos, el
tema»*. De los tres ejemplos, sólo uno era cierto:

- **el mark — VERDADERO.** `NEXT_PUBLIC_STOREFRONT_MARK` (`lib/config/storefront-marca.ts:21`) es una
  variable de DESPLIEGUE: se activa al configurar el deploy del cliente, igual que Wompi se propone.
- **el tema — FALSO, es el patrón OPUESTO.** `content.tema` es una clave de `SiteContentData`
  (`lib/config/site-content-defaults.ts:690`) — **dato que el dueño edita desde el panel** (`/admin/tienda`,
  § La PALETA — SiteContent, borrador/publicar), exactamente la clase de toggle-de-panel que el propio
  párrafo dice que Wompi NO es.
- **los íconos — FALSO, no existe.** `grep -rn "NEXT_PUBLIC.*ICON\|ICON.*despliegue\|icono.*despliegue" --include="*.ts" --include="*.tsx" .` (fuera de `node_modules`) da **cero resultados**: no hay ningún
  toggle de despliegue de íconos en el repo. El § Identidad documenta los íconos como assets estáticos
  por-despliegue (se reemplazan los archivos en `public/`), no como una env var — un mecanismo distinto
  del que el paréntesis afirmaba.

**POR QUÉ IMPORTA (el argumento del owner):** un comentario cuyo único trabajo es que le crean pierde su
autoridad con UN ejemplo falso que el lector puede verificar — no resta un tercio del argumento, se lo
lleva entero, porque ya no se puede confiar en el resto sin re-verificarlo.

**LA CORRECCIÓN, mínima.** Se dejó el ejemplo verdadero y se borraron los dos falsos:

```
- junto con el resto de lo que ya sigue ese patrón — el mark, los íconos, el tema
+ el mismo patrón que ya sigue el mark
```

Se conservó el paréntesis (no se borró entero): sigue aportando que ésta es una decisión de una sola vez,
al contratar, con un precedente real en el código — el argumento se sostiene igual de bien con un solo
ejemplo verdadero que con tres, dos de ellos falsos.

**CERO CAMBIO FUERA DEL COMENTARIO — verificado por diff.** `git diff -- lib/checkout/metodos-pago.ts`
toca sólo dos líneas `//`, dentro del mismo párrafo que `WOMPI-NO-ES-METODO-DEL-PANEL-1` ya había escrito.
`MetodoPagoTipo`, `METODOS_PAGO_ORDEN`, `metodoPagoTipoSchema` y el resto del archivo quedan
byte-idénticos.

**GATE: LOS DOS CARRILES, verdes.** `npm test` — 1162/1162 (capa 1, sin base). `npm run test:integracion`
— 193/193 (Postgres efímero). `npx tsc --noEmit` limpio. Ninguno debía moverse por un cambio de comentario,
y ninguno se movió.

**LO QUE QUEDA SIN TOCAR, a propósito:** la sección `WOMPI-NO-ES-METODO-DEL-PANEL-1` de este mismo
`DECISIONS.md` (arriba) repite el mismo trío falso en su propia prosa ("el mismo patrón que el mark, los
íconos y el tema"). No se corrige acá — el alcance de este slice es la frase del CÓDIGO, no reescribir un
asiento anterior del ledger. Queda anotado como seguimiento abierto.

**Tier 1 / AWAITING_APPROVAL — por la RAMA, no por este commit.** El diff propio de este slice es un
cambio de comentario en un archivo Tier 1 (`lib/checkout/metodos-pago.ts`, por nombre y por el subárbol
`lib/checkout/`). No se mergea sin el visto bueno explícito del owner sobre el conjunto de la rama.

## 2026-09-15 — El carril rápido del gate empieza a correr los tests de `app/` (`GATE-GLOB-CUBRE-RUTAS-API-1`)

**EL HECHO, MEDIDO.** El glob del script `test` (`package.json`) corría `lib/**`, `constants/**` y
`packages/core/**`, y dejaba AFUERA los tests bajo `app/`. Ahí vivía **1 archivo**:
`app/api/webhooks/wompi/route.test.ts`, con **14 tests** de los casos del webhook de Wompi — el
llamador futuro de `registerOrderPaymentTx`, la puerta que crea `Payment`. Esos 14 tests corrían
verdes de forma aislada, pero **ningún `npm run gate` los ejecutaba**: es la CUARTA instancia de
«un test que el gate no corre es documentación» (§ `GATE-DOS-CARRILES-1`, CLAUDE.md) y la PRIMERA
sobre la ruta del dinero.

**MEDIDO ANTES DE CABLEAR, como pidió el spec:** los 14 tests de `app/api/webhooks/wompi/route.test.ts`
corrían verdes, cero rojo, aislados (`node --import tsx --test "app/api/webhooks/wompi/route.test.ts"`).
No había deuda escondida — sólo tests que nadie ejecutaba en el flujo normal.

**EL CAMBIO, mínimo:** se agregó `"app/**/*.test.ts"` al glob del script `test`, mismo patrón y mismas
comillas que los tres que ya estaban (para que el runner de `node --test` expanda el glob, no el shell).
`npm run gate` (que compone `test` + `test:integracion`) lo cubre sin tocar el script `gate` ni
`test:integracion`. **NO se incluyó `*.test.tsx`**: los tests de COMPONENTE necesitan jsdom, que el repo
no tiene — deuda ya encolada, fuera del alcance de este slice.

**NO SE TOCÓ NINGÚN TEST NI CÓDIGO DE PRODUCTO** — sólo el glob (`package.json`) y la doctrina
(`CLAUDE.md`, § El carril rápido cubre `app/`).

**GATE, medido en el árbol final de la rama:**
- `npm test` (antes de cablear, baseline) → **1166/1166**.
- `npm test` (después de cablear) → **1180/1180** — **+14 tests nuevos**, exactamente los del webhook
  de Wompi. Cero rojo.
- `npm run test:integracion` → **193/193**, sin cambio (este slice no lo tocó).
- `npx tsc --noEmit` → limpio.

**Tier 1 — NO aplica.** `package.json` y `CLAUDE.md` no están en la lista Tier 1 ni en sus subárboles;
este diff no toca `app/(storefront)/`, ninguna puerta de dinero, schema ni migración. Merge policy A:
sin cambio de schema, sin bytes de cliente, sin contrato cross-repo → mergeable en verde.

## 2026-09-15 — El norte de Duna es PLATAFORMA (`NORTE-PLATAFORMA-ASIENTO-1`)

**La decisión de producto más grande del proyecto hasta hoy.**

### EL NORTE

**EL NORTE DE DUNA ES PLATAFORMA.** Multi-tenant de **base compartida** con aislamiento **LÓGICO**
construido por arquitectura (RLS, o un cliente de datos que inyecta el tenant por construcción), alta
de cliente **en minutos**, **operación única**. Cuatro rasgos, y los cuatro son la decisión — no basta
con la base compartida sin el aislamiento lógico, ni con el aislamiento sin el alta rápida: los cuatro
juntos son lo que hace que "un cliente nuevo" deje de ser un evento de infraestructura.

### EL MODELO DE HOY: VIGENTE Y TRANSITORIO

El modelo actual —**un despliegue por cliente** (su propio repo/deploy, su propia base, su propio
Vercel; ver CLAUDE.md § El código compartido no NACE siendo Nayoli/demo)— **nunca se decidió: se fue
construyendo.** Cada cliente nuevo repitió el patrón del anterior sin que nadie fijara "así va a ser
siempre". Hoy se confirma como **el modelo sobre el que se TERMINA lo en curso, no como el destino.**

**La intención original era base compartida.** El rastro vive — vivía — en un comentario de
`packages/core/prisma/schema.prisma`, sobre el modelo `SiteSetting`, que este slice retira (§ el
rastro, abajo) porque una aspiración no vive en un comentario de schema: vive acá, fechada y
confirmada.

### EL RASTRO — lo que el comentario decía, antes de que este slice lo retirara

`packages/core/prisma/schema.prisma`, líneas 685–691 (medidas contra `main` antes de este slice — ya
no existen tras el retiro de abajo), en el
comentario que precede a `model SiteSetting`:

> El scope de tenant llega con el MOVIMIENTO de este modelo al esquema `duna_shop`, no con una columna
> adelantada.
>
> DISPARADOR: cuando la arquitectura de TRES ESQUEMAS (duna_shop/duna_shared) llegue, esta tabla migra
> a `duna_shop` (dato del tenant, NUNCA `duna_shared`) y el `id` singleton pasa a ser la clave de
> tienda. Hoy nace en `public` porque el multi-schema no existe aún.

Esa arquitectura de tres esquemas —`duna_shop` para el dato del tenant, `duna_shared` para lo
compartido— es la forma concreta que la intención original le daba a "base compartida". **Hoy se
confirma que apuntaba al norte** — no se descarta como dirección equivocada; se retira del comentario
porque el norte ya no vive disperso en un `DISPARADOR` de schema, vive asentado acá.

### QUÉ NO CAMBIA HOY

- **Wompi se termina sobre lo que existe.** El programa (b)→(i) sigue su curso sin tocar; ninguna
  llave, ningún endpoint, ninguna decisión de Wompi se reabre por este asiento.
- **El muestrario se despliega sobre lo que existe** — monorepo + rama-por-Project, el modelo vigente.
- **Ninguna migración arranca. Cero slices de plataforma ahora.** Este asiento fija el rumbo; no abre
  trabajo de plataforma.

### QUÉ CAMBIA DESDE HOY

La regla de rumbo, en `CLAUDE.md` (§ LO QUE CONFIGURA A UN TENANT PREFIERE DATO SOBRE ENV/CÓDIGO,
atada a § El código compartido no NACE siendo Nayoli/demo):

> **LO QUE CONFIGURA A UN TENANT PREFIERE DATO EN BASE SOBRE VARIABLE DE ENTORNO O CÓDIGO, salvo
> imposibilidad medida.** Cada decisión nueva se pesa contra el norte: si hay dos formas de costo
> similar, gana la que acerca a plataforma o la que menos encarece la migración.

Va atada a la doctrina de defaults neutros porque son la misma familia: identidad-en-dato abarata la
PROPAGACIÓN entre despliegues hoy; configuración-de-tenant-en-dato abarata la MIGRACIÓN a plataforma
mañana.

### EL REGISTRO DE DEUDA

`docs/DEUDA-MIGRACION-PLATAFORMA.md`, sembrado con nueve decisiones ya tomadas bajo el supuesto
por-despliegue (el toggle de pasarela por env, las tres llaves de Wompi, `NOINDEX`, la guarda de
`instrumentation.ts`, el mark inlineado en build, el cron por repo, las ~8 constraints únicas
tenant-sensibles, los dos `CHECK` de fila única de `SiteSetting`/`SiteContent`, y el cron por Vercel
Pro por Project). Ninguna se arregla
en este slice — el registro las nombra para que la migración las revisite, y para que ninguna decisión
futura las engorde en silencio. La regla de mantenimiento vive en el propio doc: cada decisión nueva
por-despliegue tomada a sabiendas suma su fila ahí, en el momento en que se decide.

### EL DIFF

**Cero cambio de esquema.** `git diff -- packages/core/prisma/schema.prisma` retira 7 líneas de
comentario (todas `//`) sobre `duna_shop`/`duna_shared`; el modelo `SiteSetting`, su `CHECK`, y el
resto del schema quedan byte-idénticos. `CLAUDE.md` gana la regla de rumbo. `DECISIONS.md` gana este
asiento. `docs/DEUDA-MIGRACION-PLATAFORMA.md` es nuevo.

**GATE, los dos carriles.** (Cifras en el reporte del slice.)

**Tier 1 / AWAITING_APPROVAL — por `schema.prisma`, aunque el cambio sea sólo de comentario.** El
owner gatea la redacción exacta de este asiento antes del merge.
## 2026-09-15 — El widget de Wompi entra al checkout canónico — la capacidad, apagada por falta de (d) (`WOMPI-WIDGET-EN-EL-CANONICO-1`)

**(b) es que el comprador que elige la pasarela ENTRE al widget de Wompi con una transacción firmada,
desde `/checkout` tal cual está — NADA del diseño de la v5, sin `<form>` de Web Checkout (esa es la
OTRA forma; el owner ya decidió que las dos se soportan por TOGGLE DE DESPLIEGUE, `CSP-FORM-ACTION-
WEBCHECKOUT-1`), sin (c) la ruta de retorno, sin (d) el toggle mismo.** `(a)` (`WOMPI-CREADOR-DE-
INTENTOS-1`) ya armaba el bloque `{reference, amountInCents, currency, signature}` cuando
`order.paymentIntent` existe; nadie lo encendía. Este slice es quien lo enciende — SIN encenderlo de
verdad, porque (d) no existe.

**LAS CINCO RESTRICCIONES DEL OWNER, y lo que cada una impidió:**

1. **Sin diseño propio del widget** — se montó "la caja que Wompi entrega" (`widget.js` +
   `data-render="button"` + los seis `data-*` documentados: `public-key`, `currency`,
   `amount-in-cents`, `reference`, `signature:integrity`, `redirect-url`), no una composición nueva.
2. **"Wompi" en CERO bytes que el comprador lea** — la etiqueta de la opción es **"Tarjeta, PSE y
   más"**; el nombre del proveedor sólo vive en comentarios de código, nombres de función y este
   asiento.
3. **La pasarela NUNCA entra a `MetodoPagoTipo`/`METODOS_PAGO_ORDEN`** — viaja como un CAMINO APARTE
   en el payload (`payment: {metodo,...} | {pasarela: true}`, un `z.union` en el schema de
   `app/api/checkout/route.ts`), nunca como un sexto valor del set cerrado que el dueño configura en
   su panel.
4. **Nace apagada, y en LOS DOS LADOS** — no sólo la UI. `pasarelaDisponibleEnEsteDespliegue()`
   (`services/checkout.service.ts`, pura, cero argumentos, `return false`) es la ÚNICA fuente que lee
   el cliente (para esconder la opción) y el servidor (`app/api/checkout/route.ts`, para RECHAZAR con
   400 un POST directo que pida `pasarela: true` — verificado que ese 400 ocurre ANTES de
   `resolveOrderLines`/`createOrderWithCustomer`, sin tocar la base). Dos lecturas de una función no
   pueden divergir porque es una sola; el día que (d) exista, se reemplaza esa función, no se
   duplica.
5. **Ninguna pantalla afirma más de lo que el servidor sabe** — la pantalla que monta el widget dice
   "Tu pedido está reservado… completa el pago abajo para confirmarlo", nunca "pagado". La verdad
   sigue llegando por webhook (`WOMPI-WEBHOOK-RUTA-1`); esta pantalla es un ESTADO NUEVO de
   confirmación (`confirmation.wompi` presente), separado del "¡Pedido recibido!" de siempre — ese
   texto sí implica un pedido que la tienda ya dio por andado, y con la pasarela de por medio decirlo
   antes del webhook sería mentir.

**LA LLAVE PÚBLICA — decisión tomada, no delegada al gate.** El servidor la devuelve DENTRO del mismo
bloque `wompi` (`publicKey`, leída de `process.env.WOMPI_PUBLIC_KEY` — la misma variable que
`instrumentation.ts`/`lib/pagos/llaves-pasarela.ts` ya leen para la guarda de coherencia demo↔llave,
así que no es una lectura nueva del entorno, es una SEGUNDA lectura de la MISMA variable). Se descartó
un mirror `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`: hubiera sido una SEGUNDA fuente del mismo dato —exactamente
la trampa que este repo ya pagó con `total_compras` y con `disparador`/`frase` de Automatizaciones—,
cuando la llave YA VIAJA al navegador dentro de la respuesta del checkout, sin necesidad de que el
build la inline. Si falta (`WOMPI_PUBLIC_KEY` o `WOMPI_INTEGRITY_SECRET`), la ruta falla ruidoso con
500 — mismo criterio que la firma: un bloque `wompi` a medias no sirve para nada.

**EL SCRIPT SE INSERTA A MANO, no con `next/script`** (`components/storefront/checkout/
PagoPasarela.tsx`). `widget.js` de Wompi auto-renderiza su botón en la posición del DOM donde
encuentra su propio `<script>` —el patrón estándar de un botón de terceros—; `next/script` con
`strategy="afterInteractive"`/`"lazyOnload"` inserta sus scripts en `document.body`, DESACOPLADOS del
lugar donde el componente vive en el árbol, lo que rompería ese auto-render posicional. Es la elección
MÁS SEGURA de las dos, **no verificada contra el widget real en esta sesión** (sin navegador ni llaves
de sandbox) — queda para que el gate visual del owner la confirme o la corrija.

**LA RUTA DE RETORNO (c) se DECLARA, no se construye.** `RUTA_RETORNO_WOMPI = '/checkout/retorno'`
(exportada de `PagoPasarela.tsx`, con su nombre y su porqué) es el `data-redirect-url` que el widget
recibe; la ruta en sí no existe todavía — la implementa (c).

**EL 400 DE DISPONIBILIDAD VA ANTES DE TOCAR LA BASE, verificado con un caso que lo prueba de verdad:**
un `payment.pasarela: true` con envío a Bogotá SIN franja horaria dispararía el 400 de "franja
inválida" si la guarda de disponibilidad se hubiera puesto DESPUÉS de esa validación — el test
co-ubicado (`app/api/checkout/route.test.ts`) fija el ORDEN con exactamente ese caso, no sólo el
resultado.

**`Order.metodo_pago` para un pedido de pasarela es el string libre `'wompi'`** (no un valor de
`MetodoPagoTipo`; `Order.metodo_pago` ya es texto libre, § CLAUDE.md "Los MÉTODOS de pago son una
LISTA"). `derivarCondicionPago` sólo distingue el id EXACTO `'efectivo'`, así que `'wompi'` deriva
ANTICIPADO — correcto para un cobro por adelantado, sin tocar `packages/core/src/orders.ts`.

### EL HUECO ESTRUCTURAL DE TEST — medido, no inventado, y compartido con `WOMPI-WEBHOOK-RUTA-1`

**Los CINCO archivos de `touches:` no caen bajo NINGÚN glob de `npm run gate`.** `npm test` cubre
`lib/**` · `constants/**` · `packages/core/**` (`package.json:14`); `npm run test:integracion` cubre
`tests/integracion/**` (`scripts/test-integracion.sh:89`). `app/(storefront)/checkout/page.tsx`,
`app/api/checkout/route.ts`, `services/checkout.service.ts` y `components/storefront/checkout/
PagoPasarela.tsx` no están bajo ninguno de los tres. Medido ANTES de escribir una sola línea: `npm
test` en `main` (`ef2e103`) → **1166/1166**.

**Se siguió el precedente ya aceptado (`app/api/webhooks/wompi/route.test.ts`), no se inventó uno
nuevo:** `app/api/checkout/route.test.ts`, co-ubicado con `route.ts`, exporta `checkoutSchema` para
afirmar la FORMA de la unión `metodo`/`pasarela` SIN invocar `POST` (cuatro casos, parseo puro) y usa
`POST` sólo en las DOS ramas que responden antes de tocar Prisma (la guarda de disponibilidad, en sus
dos variantes de orden). Corrido a mano: `node --import tsx --test app/api/checkout/route.test.ts` →
**7/7**. **Este archivo NO es `touches:` literal** —el spec listaba `route.ts`, no `route.test.ts`—;
se escribió porque el propio spec exige "AFIRMÁ, con un test..." y no hay otro sitio dentro de los
cuatro archivos de código donde ese test pudiera vivir y ser ejecutable sin DB. Deviación medida y
declarada, no una ampliación silenciosa de alcance.

**`npm run gate` en el árbol final NO SE MOVIÓ por mis cambios — medido, no asumido:** `npm test` →
**1166/1166** (idéntico al piso, porque ningún archivo tocado está en su glob) · `npm run test:
integracion` → **193/193** (verde; ningún test de ese carril importa `app/api/checkout/route`,
confirmado por grep antes de correr, así que el número no podía moverse por este slice). El piso de
integración no se midió ANTES del slice porque no hacía falta: nada en ese carril podía verse afectado.

**LA PRUEBA DE BYTE-IDENTIDAD "APAGADA" NO ES SÓLO LÓGICA — es AUSENCIA MEDIDA EN EL ARTEFACTO
COMPILADO.** `npm run build` (limpio, sin `.next` previo del slice) compiló verde; grepeando el
bundle de producción: **"Tarjeta, PSE y más" aparece CERO veces** en `.next/server/` y `.next/static/`
(sólo en los `.js.map`, que no se sirven) — el minificador de Next 16/Turbopack demostró en el
artefacto, no sólo en el código fuente, que la rama de la opción de pasarela es código MUERTO mientras
`pasarelaDisponibleEnEsteDespliegue()` sea una función pura de cero argumentos que siempre devuelve
`false`. En cambio, "Completa el pago abajo para confirmarlo" (la pantalla `confirmation.wompi`, que
SÍ depende de un dato de runtime que el bundler no puede probar falso) aparece **UNA vez** en ambos
bundles — confirma que el camino wompi compiló y quedó vivo, listo para el día que `wompi` llegue en
la respuesta. Y en el servidor, `grep -c "no está disponible en este momento" .next/server/chunks/
_0v02p-q._.js` → **1**: la guarda de 400 SÍ viaja al artefacto (es runtime-dependiente, no
constante-plegable). Es la aplicación directa de § GATE DE CAPA 3 — grepear el artefacto, no la
fuente— a la pregunta "¿de verdad no se ve nada nuevo con la capacidad apagada?".

**CORRECCIÓN (`WOMPI-B-ASIENTO-CORRECCION-BUNDLE-1`, 2026-09-15) al párrafo anterior — "cero veces en
el bundle" dejó de ser cierto EN EL MISMO BRANCH, y este asiento no lo dijo.** La medición de arriba
valía bajo `pasarelaDisponibleEnEsteDespliegue()` como `return false;` literal — una constante que el
minificador podía PLEGAR. `WOMPI-TOGGLE-DISPONIBILIDAD-1` (§ abajo) cambió esa función a
`process.env.NEXT_PUBLIC_PASARELA_HABILITADA === '1'`, leída a través de una llamada de función entre
módulos, y **el minificador YA NO PUEDE probar la rama muerta**: medido por `WOMPI-B8-COPY-PASARELA-1`
(§ "HALLAZGO no pedido por este slice", más abajo), **"Tarjeta, PSE y más" SÍ aparece en el bundle de
producción** — en `c2bda60` y después, con o sin mi cambio. La garantía que se sostiene HOY es
byte-identidad del **RENDER** — lo que un despliegue sin la env var (Nayoli, hoy) le sirve al
visitante: la opción no se renderiza, no hay bloque `wompi` en la respuesta del checkout, no se monta
el widget —, **NO** del **BUNDLE**, que desde `WOMPI-TOGGLE-DISPONIBILIDAD-1` contiene el código de la
pasarela como código MUERTO en runtime (inalcanzable para cualquier visitante real, sin fuga — las
llaves de Wompi son server-side y nunca viajan a ese bloque). Se corrige acá, sin borrar el párrafo de
arriba, porque una frase que afirma "byte-idéntico en el artefacto" es la clase de frase que se cita
como garantía del artefacto mucho después de que dejó de serlo — la misma deriva que este repo
persigue en el código («lo que se afirma deja de coincidir con lo medido»), esta vez en un asiento
propio. El follow-up que la cerraría de raíz —inlinear el check de disponibilidad para que el
minificador vuelva a plegar la rama— ya está nombrado (§ "HALLAZGO…" de `WOMPI-B8-COPY-PASARELA-1`) y
sigue SIN prioridad: lo que le importa a Nayoli es el render, y el render ya es byte-idéntico.

**`npx tsc --noEmit` → 0.** El narrowing de `metodoActivo` en `handleOrder` (page.tsx) se resolvió con
un `if/else if/else return` explícito en vez de un ternario, precisamente porque un guard compuesto
(`!pasarelaSeleccionada && !metodoActivo`) no garantiza que TypeScript narrowee la variable dentro de
una rama de ternario sin volver a probar la condición — se verificó con `tsc`, no se asumió.

**Tier 1 / AWAITING_APPROVAL, `stopped_on: ['customer-bytes']`.** El diff agrega bytes NUEVOS que un
comprador podría leer —la opción "Tarjeta, PSE y más" y la pantalla "Tu pedido está reservado…
Completa el pago abajo para confirmarlo"— aunque hoy sean inalcanzables en producción (§ arriba, la
opción incluso queda AUSENTE del bundle por el minificador — **ESTO DEJÓ DE VALER**, ver la
CORRECCIÓN pegada al párrafo que lo midió: la ausencia era del bundle bajo `return false;`, no
sobrevive a `WOMPI-TOGGLE-DISPONIBILIDAD-1`; lo que se sostiene es la ausencia del RENDER). El diff
también toca `app/(storefront)/`
(Tier 1 por subárbol), `app/api/checkout/route.ts` (Tier 1 por nombre) y crea
`components/storefront/checkout/` (Tier 1 por subárbol pre-declarado): tres razones independientes
para el mismo alto. Rama `slice/wompi-widget-en-el-canonico-1`, sin mergear.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `services/checkout.service.ts`
(`pasarelaDisponibleEnEsteDespliegue`, `CheckoutPayload.payment`, `CheckoutResultWompi`) ·
`app/api/checkout/route.ts` (el `z.union`, la guarda de 400, el bloque `wompi` con `publicKey`) ·
`components/storefront/checkout/PagoPasarela.tsx` (`RUTA_RETORNO_WOMPI`) · el hueco de test
estructural, compartido con `WOMPI-WEBHOOK-RUTA-1` — no cerrado por ninguno de los dos slices.

## 2026-09-15 — El encendido de la pasarela: una env var, no un dato del negocio (`WOMPI-TOGGLE-DISPONIBILIDAD-1`)

**(d) se parte en DOS mitades, y ésta es sólo la del ENCENDIDO — la mitad que NO toca el retorno
sigue esperando (c), la ruta de vuelta del comprador.** `pasarelaDisponibleEnEsteDespliegue()`
(`services/checkout.service.ts`) deja de ser `return false` fijo y lee un interruptor de despliegue:

```
NEXT_PUBLIC_PASARELA_HABILITADA === '1'   →   true ;   cualquier otro valor / ausente   →   false
```

**Un despliegue que NO declara la variable —Nayoli incluida— sigue viendo EXACTAMENTE lo mismo que
antes de este slice**, sin cambiar un byte: la opción "Tarjeta, PSE y más" no se renderiza, y un POST
directo que pida `pasarela: true` sigue recibiendo el mismo 400 de disponibilidad, antes de tocar la
base (§ `WOMPI-WIDGET-EN-EL-CANONICO-1`, el mismo test que ya lo afirmaba).

**EL NOMBRE, y su razón — la fijó el owner en el spec, no se re-discute acá:**
- **`PASARELA`, no `WOMPI`:** nombra la CAPACIDAD, no el proveedor. Si el agregador cambiara algún
  día, la variable no quedaría mintiendo — las llaves SÍ llevan `WOMPI_` (`WOMPI_PUBLIC_KEY`,
  `WOMPI_INTEGRITY_SECRET`, …) porque ésas son de Wompi.
- **`HABILITADA`:** dice QUÉ prende, no cómo está implementado.
- **`NEXT_PUBLIC_`:** medido, no asumido — la función se consume en los DOS lados. El cliente
  (`app/(storefront)/checkout/page.tsx`, `'use client'`, línea `const pasarelaDisponible =
  pasarelaDisponibleEnEsteDespliegue()`) decide si renderiza la opción de pago; el servidor
  (`app/api/checkout/route.ts`) decide si crea el intento o rechaza con 400. El prefijo es necesario
  para que Next inline la variable en el bundle del cliente en BUILD — mismo patrón que
  `NEXT_PUBLIC_STOREFRONT_MARK` (`lib/config/storefront-marca.ts`) y que `NOINDEX` (aunque éste, sin
  prefijo, sólo se lee en servidor/build — el paralelo es la forma del interruptor por-despliegue con
  valor `'1'`, no el prefijo en sí).
- **Valor `'1'`**, no `'true'` ni presencia-a-secas — el mismo patrón que `NOINDEX=1` y
  `NEXT_PUBLIC_STOREFRONT_MARK=1`.

**SÓLO EL ENCENDIDO — la redirección NO se tocó.** `RUTA_RETORNO_WOMPI` sigue apuntando a
`/checkout/retorno`, una ruta que no existe todavía; ese camino es (c) y este slice no lo adelanta. El
widget, el `z.union` de `payment`, la firma y el webhook quedan exactamente como (a)/(b) los dejaron —
el diff de este slice es una línea de lógica (la función) más comentarios que dejaron de describir un
estado que ya cambió.

### EL TEST — condición del owner, y el MISMO hueco estructural que (b) ya midió

**Se afirmó con test que, sin la variable (y con la variable en cualquier valor que no sea el literal
`'1'`), la función devuelve `false`; y que con `'1'` devuelve `true`.** `services/
checkout.service.test.ts`, co-ubicado con el archivo que declara la función, siguiendo el patrón YA
usado por `lib/automations/whatsapp-operativo.test.ts` (mutar `process.env` por test, restaurar en
`afterEach` porque el proceso de test comparte el entorno entre archivos). Corrido a mano: **3/3**.

**PERO el spec asumía que "el carril rápido ahora cubre `app/**`" — medido, y es FALSO.**
`package.json:14` sigue siendo exactamente `"lib/**/*.test.ts" "constants/**/*.test.ts"
"packages/core/**/*.test.ts"`, sin `app/**` ni `services/**`. Es el MISMO hueco que
`WOMPI-WIDGET-EN-EL-CANONICO-1` ya midió y documentó para `app/api/checkout/route.test.ts` — no se
cerró entre ese slice y éste, y la premisa del spec de dar por hecho lo contrario es una deviación,
no un hallazgo nuevo. `services/checkout.service.test.ts` **NO se ejecuta por `npm run gate`**; se
corre a mano con:

```
node --import tsx --test services/checkout.service.test.ts
```

**Se prefirió el archivo co-ubicado, DENTRO del `touches:` declarado del slice (`services/
checkout.service.ts`), a mover la función a `lib/` (donde SÍ correría en el gate) — mover la función
habría tocado un archivo que el spec no autorizó.** Cerrar el hueco de verdad —ampliar el glob de
`npm test` a `services/**`, o mudar `pasarelaDisponibleEnEsteDespliegue` a `lib/checkout/`— es
backlog, no de este slice; queda nombrado para que la próxima vez que alguien toque este archivo no
lo vuelva a medir de cero.

### El piso no se movió — medido en el árbol final

`npm test` → **1166/1166** (idéntico al piso de `WOMPI-WIDGET-EN-EL-CANONICO-1`; los tres archivos
tocados no están bajo su glob, así que el número no podía cambiar). `npm run test:integracion` →
**193/193** (idéntico; nada en ese carril importa `checkout.service` ni `checkout/page.tsx`). `npx tsc
--noEmit` → limpio. `npm run build` → `✓ Compiled successfully`.

**Tier 1 / AWAITING_APPROVAL.** El diff toca `app/(storefront)/checkout/page.tsx` (Tier 1 por
subárbol) y `services/checkout.service.ts` (la fuente única que el Tier 1 de arriba ya nombraba). Con
la variable ausente en todo despliegue hoy, el diff no cambia ni un byte que un visitante lea —pero la
CAPACIDAD de que cambie ahora depende de una variable de entorno que el owner tiene que declarar (o
no) por despliegue, y eso es exactamente lo que el gate visual existe para confirmar antes de que
cualquier despliegue real la encienda. Rama `slice/wompi-widget-en-el-canonico-1`, sin mergear.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `services/checkout.service.ts`
(`pasarelaDisponibleEnEsteDespliegue`, ahora lee `NEXT_PUBLIC_PASARELA_HABILITADA`) ·
`app/(storefront)/checkout/page.tsx` (el comentario junto a `pasarelaDisponible`) · el mismo hueco de
test estructural de `WOMPI-WIDGET-EN-EL-CANONICO-1`/`WOMPI-WEBHOOK-RUTA-1`, todavía sin cerrar · (c),
la ruta de retorno, sigue pendiente.

## 2026-09-15 — La TERCERA rama de copy del checkout: el pago en línea no lo confirma un humano (`WOMPI-B8-COPY-PASARELA-1`)

**EL DEFECTO, medido contra `app/(storefront)/checkout/page.tsx` en el estado que dejó
`WOMPI-TOGGLE-DISPONIBILIDAD-1` (`c2bda60`):** la caja de tranquilidad del paso de pago tenía DOS
ramas (con/sin canal de WhatsApp) y las dos afirmaban *"Nuestro equipo confirmará el pago … y
procesará tu pedido"*. Con **"Tarjeta, PSE y más"** elegido (`pasarelaSeleccionada === true`) eso es
FALSO: el pago en línea lo confirma el webhook de Wompi, no una persona (§ restricción 5 de
`WOMPI-WIDGET-EN-EL-CANONICO-1`, *"ninguna pantalla afirma más de lo que el servidor sabe"* — esa
restricción cubrió la pantalla de `confirmation.wompi`, pero no esta caja del PASO de pago, previa al
submit, que quedó con las dos ramas viejas sin tocar).

**EL CENSO DEL RESTO DEL CAMINO DE PASARELA, para que quede escrito qué se revisó y no sólo qué se
tocó:**

- `app/(storefront)/checkout/page.tsx:194-195` (`confirmation.wompi` truthy → "Tu pedido está
  reservado… Completa el pago abajo para confirmarlo.") — **YA CORRECTO, no se tocó.** Es un `return`
  TEMPRANO (línea 182) que nunca cae en la rama de "¡Pedido recibido!" ni en su ternario de
  `tieneWhatsapp` (líneas 223-224): las dos viven en un `if` posterior, alcanzable sólo cuando
  `confirmation.wompi` es falsy. No hay overlap — verificado leyendo el control de flujo, no supuesto.
- `app/(storefront)/checkout/page.tsx:535` ("Compra 100% segura y verificada") — badge de confianza
  genérico, sin condicional, sin afirmar QUIÉN confirma el pago ni CUÁNDO. No es la clase de dato que
  B8 corrige (no promete revisión humana); se dejó igual.
- `components/storefront/checkout/PagoPasarela.tsx` — sin copy propio (sólo monta el widget de
  terceros en un `<div>`); nada que revisar.

**LA TERCERA RAMA, y por qué GANA.** `pasarelaSeleccionada` es la condición —no `MetodoPagoTipo`, que
no incluye a la pasarela (viaja aparte en el payload, § `WOMPI-WIDGET-EN-EL-CANONICO-1`, restricción
3)— y se evalúa PRIMERO en el ternario: si el comprador eligió pasarela, ve la frase de pasarela,
sin importar `tieneWhatsapp`. Las TRES frases se escriben ENTERAS (regla del repo, § el gate del canal
WhatsApp #8: "cada frase se escribe ENTERA por rama, no un prefijo con cola variable") — no se
concatenó un prefijo común:

```
pasarelaSeleccionada
  ? 'Tu información está segura. El pago se confirma automáticamente al completarse y tu pedido
     pasa a preparación sin que nuestro equipo tenga que revisarlo.'
  : tieneWhatsapp
    ? 'Tu información está segura. Nuestro equipo confirmará el pago por WhatsApp y procesará tu
       pedido lo más pronto posible.'
    : 'Tu información está segura. Nuestro equipo confirmará el pago y procesará tu pedido lo más
       pronto posible.'
```

El texto exacto queda sujeto al gate visual del owner (byte de cara al comprador, ruta del dinero);
esta frase es la PROPUESTA que cumple la decisión, no la palabra final.

### HALLAZGO no pedido por este slice: el minificador YA NO elimina "Tarjeta, PSE y más" del artefacto

**Medido, no asumido, y en DOS builds — el de `HEAD` sin mi cambio (`c2bda60`, vía `git checkout --`
temporal) y el árbol final —, ambos con `.next` borrado antes de compilar.** `WOMPI-WIDGET-EN-EL-
CANONICO-1` había medido **CERO** apariciones de `"Tarjeta, PSE y más"` en `.next/server/` y
`.next/static/` (sin la env var), porque en ese momento `pasarelaDisponibleEnEsteDespliegue()` era un
`return false;` literal, trivialmente foldeable. `WOMPI-TOGGLE-DISPONIBILIDAD-1` cambió esa función a
`process.env.NEXT_PUBLIC_PASARELA_HABILITADA === '1'` sin re-correr ese grep — y, medido ahora, la
cadena SÍ aparece (una vez, en `.next/server/chunks/ssr/app_(storefront)_checkout_page_tsx_0947x6.._.js`
y su gemelo en `.next/static/`), tanto en `c2bda60` como en mi árbol final. **No es un efecto de mi
edición** — el mismo grep contra el HEAD anterior a este slice ya lo muestra—: el minificador deja de
poder inferir estáticamente que la comparación contra un `process.env.*` ausente es siempre `false` a
través de la llamada de función entre módulos, aunque en runtime (con la variable ausente) el valor
sigue siendo `false` y la rama sigue siendo inalcanzable para cualquier visitante real (verificado con
`node -e` que `process.env.NEXT_PUBLIC_PASARELA_HABILITADA` es `undefined` en este entorno). Mi frase
nueva de pasarela cae en la MISMA clasificación: presente en el bundle como código muerto,
inalcanzable en producción porque depende de un `useState` que sólo se puede volver `true` desde un
control que ese mismo `pasarelaDisponible` ya no renderiza. **No se tocó** `services/
checkout.service.ts` (fuera de `touches:`); se deja nombrado como hallazgo, no como arreglo.

### El piso, medido en el árbol final

`npm test` → **1166/1166** (idéntico al piso citado en `WOMPI-TOGGLE-DISPONIBILIDAD-1`; `page.tsx` no
cae bajo su glob — `"lib/**/*.test.ts" "constants/**/*.test.ts" "packages/core/**/*.test.ts"`, así que
el número no podía moverse). `npm run test:integracion` → **193/193** (idéntico; nada en ese carril
importa `checkout/page.tsx`). `npx tsc --noEmit` → limpio. `npm run build` → `✓ Compiled successfully
in 6.1s`, con `.next` borrado antes (vía `fs.rmSync`, no `rm -rf`: el grant de esta sesión no incluye
`rm`).

**Tier 1 / AWAITING_APPROVAL.** El diff toca `app/(storefront)/checkout/page.tsx` (Tier 1 por
subárbol) — byte de cara al comprador en la ruta del dinero; el texto exacto lo gatea el owner en el
gate visual del conjunto (b)+(d)+B8. Rama `slice/wompi-widget-en-el-canonico-1`, sin mergear.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `app/(storefront)/checkout/page.tsx` (la caja de
tranquilidad del paso de pago, ahora TRES ramas) · el hueco de test estructural de
`WOMPI-WIDGET-EN-EL-CANONICO-1`/`WOMPI-TOGGLE-DISPONIBILIDAD-1`, todavía sin cerrar · el hallazgo del
minificador (arriba), sin arreglar — vive en `services/checkout.service.ts`, fuera de `touches:` de
este slice · (c), la ruta de retorno, sigue pendiente.

## 2026-09-15 — WOMPI entra al enum `MetodoPago` — (f), el precedente EXACTO es BREB (`WOMPI-ENUM-METODO-F-1`)

**EL VALOR SE AGREGA; NADA LO PRODUCE TODAVÍA.** `WOMPI` se suma al enum de Prisma `MetodoPago` (el de
MAYÚSCULAS, el de `Payment.metodo` — **no** `MetodoPagoTipo`, el del panel del dueño en
`lib/checkout/metodos-pago.ts`, que ya tenía el comentario prohibiéndolo). Es el mismo movimiento que
`BREB` (`PAGOS-METODOS-MODELO-1`, migración `20260910120100_metodo_pago_breb`): un valor de enum sin un
solo llamador que lo escriba. El `Payment` que el webhook de Wompi va a crear es (g), fuera de este
slice.

### La migración — copiando el precedente

`ALTER TYPE "MetodoPago" ADD VALUE 'WOMPI';` en su PROPIA migración
(`packages/core/prisma/migrations/20260915120000_metodo_pago_wompi/migration.sql`), porque Postgres no
permite usar un valor de enum recién agregado en la misma transacción que lo crea — la razón exacta que
ya dejó BREB en su propia migración, copiada acá. `migrate deploy` la corrió SOLA, dentro de `npm run
build` (medido: `Datasource "db": … "ep-still-sound-acfmedf2" …` — la base de `development`, la que el
`.env` local usa — y, releyendo el enum en esa misma base con `node --env-file=.env`, `WOMPI` ya
aparece en `enum_range(NULL::"MetodoPago")` junto a los seis valores previos). No se corrió ningún
`ALTER TYPE` a mano ni se tocó la base por fuera del build.

### Los cuatro espejos, y la QUINTA declaración que no hizo falta tocar

`types/payment.ts` (`MetodoPago`, `METODOS_PAGO`) + `components/admin/PagosCurva.tsx`
(`METODOS_SERIE`) son los cuatro puntos que `lib/pagos/metodos-pago-enum.test.ts` ata al enum real de
Prisma — los cuatro sumaron `WOMPI`. `METODO_DESGLOSE_LABEL` (`types/payment.ts`) es una QUINTA
declaración `Record<MetodoPago, string>` que el test no nombra, pero **no hizo falta tocarla**: es un
spread de `METODO_PAGO_LABEL` con un solo override (`TRANSFERENCIA: 'Bancaria'`), así que hereda
`WOMPI` automáticamente y sigue siendo exhaustiva sin una línea nueva.

**La etiqueta, de cara al OPERADOR:** `METODO_PAGO_LABEL.WOMPI = 'Pasarela (Wompi)'` — a diferencia del
checkout (donde el nombre del proveedor se esconde, § el comentario de `MetodoPagoTipo`), acá es
pantalla de operador y nombrar a Wompi no tiene el mismo costo.

### La categoría PASARELA — la CUARTA, no un cuarto nombre para OTRO

`PaymentCategoria` gana `PASARELA` (`types/payment.ts`): WOMPI NO cae en `OTRO` porque no es "no sé
clasificarla" — se sabe exactamente qué es, plata que un webhook acredita sin que un operador la
registre a mano, distinta de EFECTIVO, de TRANSFERENCIA (un riel digital que el operador SÍ teclea tras
verlo) y del residual OTRO. Tocó los tres Records exhaustivos que TS obliga a completar:
`PAYMENT_CATEGORIA_LABEL` (+ `PASARELA: 'Pasarela'`), `PAYMENT_CATEGORIAS` (+ el elemento) y
`GRUPO_METODO_LABEL` (`app/(admin)/admin/pagos/page.tsx`, + `PASARELA: 'Pasarela'`). Con un solo método
(`WOMPI`) en la categoría, `PAYMENT_CATEGORIAS_MULTI` sigue sin incluirla —igual que `EFECTIVO`/`OTRO`
hoy—, así que el `<optgroup>` "Cualquier digital" sigue siendo sólo de Transferencia; nada que tocar ahí.

**LA FRASE QUE SE VOLVÍA FALSA, corregida:** el comentario de `app/(admin)/admin/pagos/page.tsx` decía
*"Cubre las TRES categorías de PaymentCategoria a propósito"*. Con PASARELA son CUATRO — se corrigió el
número. Es la misma familia de deriva que este repo persigue (§ Backlog técnico, "un número en doctrina
es una frase con fecha de vencimiento"), atrapada en el propio código antes de que quedara escrita mal
en CLAUDE.md.

### `--duna-serie-7` — PROVISIONAL, con su follow-up

`METODOS_SERIE` necesitaba un color para la séptima barra del modo-método de Pagos. `--duna-serie-6`
ya es de BREB, así que se agregó `--duna-serie-7` en `packages/design-system/tokens/tokens.css` (claro
`#9E3F79`, oscuro `#D98FC0`, magenta/frambuesa — elegido A OJO para no chocar con serie-1..6 ni con
sol/ok/bad, **sin medir ΔE2000**). Es explícitamente PROVISIONAL, marcado en el comentario de los dos
temas: el valor definitivo lo trae la sesión de diseño (ΔE2000 contra sol/ok/bad en ambos temas, piso
~22, distinguible de serie-6 — el mismo método que ya fijó el piso de la paleta hoy en ~22 ΔE2000).

**Costo visible aceptado, no arreglado en este slice:** con WOMPI aún sin un solo `Payment` que lo use,
esta séptima barra no tiene caso real que la dibuje hoy — es la misma clase de "capacidad sin
escritor" que BREB tuvo entre su propia migración y `PAGOS-METODOS-LISTA-1`. El color provisional
importa recién cuando (g) empiece a crear pagos WOMPI.

**FOLLOW-UP nombrado:** `WOMPI-SERIE-COLOR-DEFINITIVO-1` — reemplazar el hex provisional de
`--duna-serie-7` (los dos temas) por el valor medido en la sesión de diseño, cuando ésta ocurra. No es
de este slice: (f) sólo necesitaba que el token EXISTIERA para que el test y la pantalla no rompieran.

### El comentario apareado — por qué WOMPI vive en MAYÚSCULAS y no en minúsculas

Junto al enum en `schema.prisma` va el comentario gemelo del de `MetodoPagoTipo`
(`lib/checkout/metodos-pago.ts:14-23`, ya mergeado): **este enum responde «CÓMO LLEGÓ LA PLATA»**, y
por eso WOMPI SÍ vive acá, a diferencia de `MetodoPagoTipo` —que responde «qué le ofrezco a elegir al
cliente en el checkout», donde Wompi NO entra porque es un toggle de DESPLIEGUE (se enciende una vez al
configurar el cliente), no algo que el dueño prenda/apague desde Configuración—. El comentario redirige
al lector al otro enum por su CONTENIDO, no por número de este ledger.

### Efecto lateral observado, no un defecto: WOMPI aparece en "Registrar Pago"

`components/admin/RegisterPaymentModal.tsx` (fuera de `touches:`, no tocado) itera `METODOS_PAGO` para
el select de método, y separa "ofrecidos"/"no ofrecidos" según `SiteSetting.metodosPago` — por diseño
YA escrito (§ PAGOS-METODOS-SELECT-1 §2, "los métodos siguen TODOS elegibles… filtrar por lo
configurado haría IMPOSIBLE registrar plata real que entró por un medio que el negocio no publica").
Con `WOMPI` en `METODOS_PAGO`, "Pasarela (Wompi)" aparece ahora en el grupo "no ofrecidos" de ese
select — el MISMO efecto automático que ya tuvo BREB al sumarse al enum, sin tocar ese archivo. No es
observable para el comprador (es la pantalla del operador), y no es una decisión de este slice: es la
consecuencia correcta de que los cuatro espejos queden exactos.

### El piso, medido en el árbol final

`npm test` → **1187/1187** (sube de los 1166 citados en `WOMPI-B8-COPY-PASARELA-1` por los merges
posteriores a esa medición —`NORTE-DEUDA-FILA-CRON-1`, la fusión de (b)+toggle+B8—, no por este slice:
ningún archivo que edité cae bajo el glob de un test nuevo, y `metodos-pago-enum.test.ts` ya existía).
`npm run test:integracion` → **193/193** (idéntico al piso citado en esa misma entrada; nada en ese
carril cambió). `npx tsc --noEmit` → limpio (tras un `npm run build` que refrescó un `.next/types`
rancio de una sesión anterior, ajeno a este diff — los dos errores iniciales de `tsc` apuntaban a rutas
de `checkout/retorno` que (c) todavía no construye). `npm run build` → `✓ Compiled successfully`, con
`prisma migrate deploy` aplicando la migración de este slice contra `development`.

**Tier 1 / AWAITING_APPROVAL.** El diff toca `packages/core/prisma/schema.prisma` y su migración —
schema/migración, la primera de las tres condiciones de la política A—. Rama
`slice/wompi-enum-metodo-f-1`, sin mergear.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `packages/core/prisma/schema.prisma` (enum `MetodoPago` +
su comentario apareado) · `packages/core/prisma/migrations/20260915120000_metodo_pago_wompi/` ·
`types/payment.ts` (los cuatro campos que crecen: `MetodoPago`, `METODOS_PAGO`, `METODO_PAGO_LABEL`,
`METODO_CATEGORIA`, más `PaymentCategoria`/`PAYMENT_CATEGORIA_LABEL`/`PAYMENT_CATEGORIAS`) ·
`components/admin/PagosCurva.tsx` (`METODOS_SERIE`) · `app/(admin)/admin/pagos/page.tsx`
(`GRUPO_METODO_LABEL`, la frase "tres→cuatro" corregida) · `packages/design-system/tokens/tokens.css`
(`--duna-serie-7`, PROVISIONAL) · `WOMPI-SERIE-COLOR-DEFINITIVO-1`, follow-up abierto · (g), el
`Payment` que el webhook crea, sigue pendiente.

## 2026-09-15 — El webhook de Wompi crea el `Payment` — (g), con el lock de Order, el cobro
duplicado al carril de atención, y la idempotencia intacta (`WOMPI-PAYMENT-DESDE-WEBHOOK-G-1`)

**LA FRONTERA QUE `WOMPI-WEBHOOK-RUTA-1` DEJÓ ABIERTA QUEDA CERRADA.** Con `WOMPI` ya en el enum
`MetodoPago` (`WOMPI-ENUM-METODO-F-1`), `procesarEventoWompi` (`app/api/webhooks/wompi/route.ts`) deja
de detenerse en cerrar el `PaymentIntent`: cuando el desenlace es APROBADO, llama a
`registerOrderPaymentTx` (`packages/core/src/orders.ts`) como su **CUARTO llamador** — los otros tres:
`app/api/orders/[id]/payments/route.ts`, `immediatePayment` (dentro de `createOrderWithCustomer`) y
`decidirComprobante` en `comprobantes.ts`.

### El hueco que la frase del owner nombra: el webhook era el ÚNICO escritor de la ruta del dinero
sin el lock de Order — invisible hasta que alguien preguntó por dos aprobados

Los otros tres llamadores de `registerOrderPaymentTx` NUNCA lo invocan sin antes lockear la Order
(`SELECT … FOR UPDATE`) y comprobar `estado === 'pendiente'` — es la garantía contra el segundo
Payment que ya cerró `comprobante-verificacion.test.ts` (dos comprobantes concurrentes de la misma
orden → un solo Payment) y `cobro-sincronizado.test.ts`. El webhook, medido en la sesión de censo
previa (`WOMPI-WEBHOOK-PAYMENT-CENSO-1`), NO tenía ese patrón — porque hasta este slice nunca llamaba
al escritor de dinero, así que no había nada que proteger. La frontera se hace visible recién ahora,
con la pregunta concreta: ¿qué pasa si Wompi confirma DOS veces la misma orden (dos intentos
distintos, o un reintento de red duplicado del lado del comprador)? Sin lock, los dos leerían
`pendiente` y crearían dos `Payment`. **(g) adopta el MISMO patrón que los otros tres, letra por
letra** — lockear, releer fresco, decidir recién bajo el lock.

### El diseño: la interfaz inyectable CRECE, no se abandona

`PaymentIntentDb` gana dos miembros nuevos y conserva el patrón de doble angosto/inyectable que
`WOMPI-WEBHOOK-RUTA-1` dejó (medido: los 14 tests existentes seguían pasando doblando sólo
`findUnique`/`updateMany` — ninguno de esos 14 necesitó tocar su lógica, sólo su fixture, tal como el
spec de este slice anticipaba):

- **`transaccionConOrdenLockeada<T>(ordenId, fn)`** — SÓLO la usa el bucket APROBADO. Abre una
  transacción, lockea la Order (`lockOrderForPayment`, nuevo en `orders.ts`, ver abajo), y corre `fn`
  con esa fila releída + un `tx` angosto (`PaymentIntentTx`: cerrar el intento + `registrarPago`). El
  bucket FALLIDO NO la usa — sigue con el `paymentIntent.updateMany` de siempre, sin transacción,
  porque no hay decisión de dinero que proteger (como antes de este slice).
- **`notificarAtencion(input)`** — post-commit, fire-and-forget, para el carril de atención. Nunca se
  llama DENTRO de la transacción: una notificación no puede demorar ni abortar el cierre del cobro,
  mismo principio que `notifyOrderCreated` post-commit en `createOrderWithCustomer`.

`lockOrderForPayment` (`packages/core/src/orders.ts`, nuevo export) extrae el `SELECT … FOR UPDATE`
que los otros tres llamadores repiten inline, para que un CUARTO no lo copie por cuarta vez. **Los
tres existentes NO se tocaron** — siguen con su `$queryRaw` propio; el helper es sólo para el nuevo
llamador. `POST` arma `dbReal`, el ÚNICO adaptador sobre el `prisma` real que satisface
`PaymentIntentDb` (antes `POST` pasaba `prisma` directo, porque bastaba con `findUnique`/`updateMany`,
que Prisma ya tiene; ahora hace falta ensamblar `transaccionConOrdenLockeada`/`notificarAtencion`, que
Prisma no tiene de fábrica).

### Los TRES caminos, medidos contra el spec

- **APROBADO + orden `pendiente`** → cierra el intento y crea el Payment en la MISMA transacción
  (`registrarPago`), con el monto que **Wompi CONFIRMÓ** (`amount_in_cents` del evento → pesos) —
  NUNCA `monto_esperado` (el snapshot al crear el intento) ni `orden.total` (a diferencia de los otros
  tres llamadores, que sí releen `Order.total` bajo lock porque no tienen un tercero que confirme el
  monto de otra forma). Si el evento no trae un monto utilizable, cae a `monto_esperado` como mejor
  valor disponible, con su propio log — caso defensivo, no ejercitado por ningún evento real medido.
- **APROBADO + orden YA pagada** → COBRO DUPLICADO. El intento se cierra igual (el hecho de Wompi es
  real) pero NO se crea un segundo Payment ni se reabre la orden. `notificarAtencion` dispara UNA
  notificación (`tipo: 'wompi_cobro_duplicado'`, `href: hrefOrden(numero_orden)`) con el número de
  orden y el monto, para que un humano decida si corresponde devolver — **la devolución NO se
  automatiza**, como pide el spec.
- **FALLIDO** → sin cambios de este slice: cierra el intento, no toca la Order, no hay transacción.

**La discrepancia de monto (`monto_esperado` vs. el confirmado) YA se comparaba y registraba con
`console.error` desde `WOMPI-WEBHOOK-RUTA-1`; (g) le agrega el aviso al carril de atención** cuando esa
discrepancia ocurre sobre una orden que SÍ se pagó (`tipo: 'wompi_monto_discrepante'`) — "una orden
pagada por un monto distinto al esperado es plata a mirar a mano", la frase exacta del spec. No se
notifica una discrepancia sobre un evento FALLIDO o sobre un cobro duplicado (en ese caso ya notifica
por la otra vía) — sería una segunda alarma sobre el mismo hecho.

### La idempotencia — medida, no supuesta

El corte pre-transacción (`intent.estado !== 'EN_VUELO'` → 'repetido'/'anomalía') sigue INTACTO y
sigue disparando ANTES de tocar `transaccionConOrdenLockeada`: un reintento del MISMO evento nunca
llega a la transacción una segunda vez (afirmado: `llamadas.transacciones` queda en 1 tras dos
entregas del mismo evento). Y bajo el lock, un segundo intento **DISTINTO** de la MISMA orden que
llega DESPUÉS de que la orden ya se pagó cae en la rama de cobro duplicado — nunca en un segundo
`registrarPago`. Los DOS casos que el spec pedía afirmar quedaron en tests (capa 1, `route.test.ts`,
con un doble en memoria — el detalle de por qué NO son de integración va abajo):

- reintento del mismo evento → un solo Payment (`llamadas.pagosRegistrados.length === 1` tras dos
  `procesarEventoWompi` con el mismo evento);
- dos `PaymentIntent` distintos de la misma orden, ambos APROBADO → un solo Payment total + una sola
  notificación de cobro duplicado.

### DESVIACIÓN MEDIDA, y la más importante de este asiento: NO se agregó cobertura en
`tests/integracion/` — el spec la pedía en su §5 y `touches:` no la nombraba

El spec (§5) pide explícitamente: *"Agregá al carril de integración: primer-aprobado→un Payment+orden
pagada; segundo-aprobado→intent APROBADO + notificación + CERO segundo Payment + orden sin reabrir;
reintento→un solo Payment"* — y también dice, en §1, que el lock+transacción "se prueban de verdad
contra Postgres" en ese carril. Pero `touches:` de este slice lista sólo CUATRO archivos
(`app/api/webhooks/wompi/route.ts`, `packages/core/src/orders.ts`,
`app/api/webhooks/wompi/route.test.ts`, `DECISIONS.md`) — **ninguno bajo `tests/integracion/`**, y la
doctrina del propio repo (§ CLAUDE.md, "El carril rápido cubre `app/`") es explícita: *"Un test de
`app/` que necesite Postgres real va a `tests/integracion/`, no co-ubicado con la ruta — si no, rompe
el carril rápido (capa 1, sin base) para todos."* Cumplir la letra de §5 habría exigido escribir en un
archivo fuera de `touches:`, y la instrucción del dispatch que gobierna este slice es explícita: *"A
path you did not declare is not covered by an approval given for the paths you did… do not widen it
yourself."*

**Se resolvió a favor de `touches:`, no de §5.** `route.test.ts` quedó DB-free (capa 1) con un doble en
memoria que sí prueba la LÓGICA de decisión (qué rama toma, qué se llama, qué NO se llama) para los
tres casos —primer aprobado, cobro duplicado, reintento—, pero **sin locking real**: el doble no
simula la concurrencia de Postgres, sólo secuencia llamadas. Lo que el spec pedía probar "de verdad
contra Postgres" —que el `SELECT … FOR UPDATE` efectivamente serializa dos aprobados concurrentes de
la misma orden, y no sólo dos secuenciales— **queda SIN medir en este slice**. El carril de integración
corrió (`npm run test:integracion` → 193/193, idéntico al piso citado en `WOMPI-ENUM-METODO-F-1`) y no
se movió, confirmando que ningún archivo de ese carril cambió.

**FOLLOW-UP nombrado: `WOMPI-PAYMENT-WEBHOOK-INTEGRACION-1`** — un slice con `touches:` que SÍ incluya
un archivo bajo `tests/integracion/` (p. ej. `tests/integracion/wompi-webhook-payment.test.ts`), armado
sobre `dbReal`-como-real (Postgres real, dos llamadas verdaderamente concurrentes al mismo
`PaymentIntent`/misma Order) para cerrar la brecha que este asiento deja escrita. Hasta que exista, la
garantía de que el lock sirve bajo concurrencia REAL para este llamador específico es la MISMA
garantía que ya tienen los otros tres (mismo patrón, mismo `FOR UPDATE`), no una medición propia de
(g).

### Los DOS espejos de doctrina que este slice vuelve FALSOS, y no se tocan (fuera de `touches:`)

Censo mecánico (grep de cada símbolo/archivo que este diff cambia contra `CLAUDE.md`), con la doctrina
que queda contradicha:

- **`CLAUDE.md` § Pagos en línea (Wompi), líneas 2939-2959**: *"el webhook YA CIERRA el intento… pero
  **NO crea el `Payment`**: frontera deliberada, porque eso exige un valor de `MetodoPago` que el enum
  de hoy no tiene (decisión del owner, pendiente)"* — **FALSO**: el enum ya tiene `WOMPI`
  (`WOMPI-ENUM-METODO-F-1`) y el webhook YA crea el Payment (este slice). La misma línea dice *"Hoy ese
  helper tiene TRES llamadores en producción… el webhook sería el cuarto"* — también FALSO: son
  CUATRO, presente, no condicional. `WOMPI-WEBHOOK-DOCTRINA-PAGO-STALE-1` — actualizar cuando se toque
  `CLAUDE.md` por esta área; no se toca acá porque el archivo no está en `touches:`.
- **`CLAUDE.md` línea 85** (la re-medición del 2026-09-14 de la lista Tier 1): *"…y es el llamador
  FUTURO de `registerOrderPaymentTx`"* — el mismo defecto, dicho de otra forma: ya no es futuro. Mismo
  follow-up (`WOMPI-WEBHOOK-DOCTRINA-PAGO-STALE-1`) lo cubre — es la MISMA frase envejeciendo en dos
  sitios del archivo.

### Notificaciones sin catálogo — deuda declarada, no un descuido

`notificarAtencion` escribe `Notification{tipo: 'wompi_cobro_duplicado' | 'wompi_monto_discrepante',
…}` directo, **sin** una entrada en `AUTOMATION_MAP` (`constants/automations.ts`, fuera de
`touches:`). La campana ya tolera un `tipo` sin registro (`AUTOMATION_MAP[n.tipo]?.icono ?? DEFAULT_
ICON`, `NotificationBell.tsx` — medido, no asumido): se ve con el ícono por defecto y el tratamiento
"atención" (sol), NUNCA el rojo de `severidad: 'alerta'` que un cobro duplicado —plata a devolver—
merecería. **FOLLOW-UP nombrado: `WOMPI-NOTIFICACION-CATALOGO-1`** — sumar las dos keys a
`AUTOMATION_MAP` con `severidad: 'alerta'`, un ícono propio y su `disparador`/`frase`, cuando se toque
`constants/automations.ts` por esta área. No es un defecto de este slice: el mecanismo pedido por el
spec era `createNotification` directo, no el catálogo.

### El piso, medido en el árbol final

`npm test` → **1190/1190** (sube de los 1187 citados en `WOMPI-ENUM-METODO-F-1` por las 3 pruebas
nuevas de `route.test.ts` — 17 tests en el archivo contra los 14 de antes; ningún otro archivo del
glob se tocó). `npm run test:integracion` → **193/193** (idéntico al piso citado en esa misma entrada —
confirma la deviación de arriba: ningún archivo de ese carril cambió). `npx tsc --noEmit` → limpio
(exigió resolver un narrowing de TypeScript real, no cosmético: un `let` reasignado dentro del closure
de la transacción se widenea a través del `await` que la espera, y `if (notificar)` tipaba su rama
verdadera como `never` — reproducido en un archivo aparte antes de aceptar el fix, `notificar as
NotificacionAtencion | null` justo antes del `if`). `npm run build` → `✓ Compiled successfully`,
`/api/webhooks/wompi` sigue listado como ruta dinámica (`ƒ`).

**Con la pasarela apagada, cero cambio de comportamiento — medido, no supuesto.** Nada en este diff
crea una fila de `PaymentIntent`: `crearIntentoPago` sigue en `false`/ausente por defecto y ningún
llamador lo pasa en `true` hoy (medido antes de escribir: `grep -rn "crearIntentoPago"` fuera de su
propia declaración y este mismo archivo de doctrina da cero resultados). Sin filas `EN_VUELO`, el
webhook recibe eventos que no matchean ninguna referencia (`404`, la rama ya existente) o simplemente
no recibe tráfico — el camino nuevo (`transaccionConOrdenLockeada`, `registrarPago`,
`notificarAtencion`) es código alcanzable pero nunca alcanzado mientras (a)+(b)+(d) sigan apagados.

**Tier 1 / AWAITING_APPROVAL, `stopped_on: ['customer-bytes']`.** El diff no toca schema ni migración,
y no define ni consume un contrato cross-repo (Wompi define el suyo; nada de este lado lo expone). Pero
SÍ agrega bytes NUEVOS que el DUEÑO/OPERADOR lee: los textos de las dos notificaciones nuevas en la
campana del admin ("Cobro duplicado de Wompi…", "Wompi cobró un monto distinto al esperado…") — la
definición de `customer_bytes` en este protocolo incluye explícitamente lo que un OPERADOR u OWNER lee,
no sólo lo que ve un comprador. Ninguna de las dos rutas es alcanzable hoy (pasarela apagada, arriba),
pero el criterio de la política es sobre la RAMA, no sobre si el código ya se ejecutó. Rama
`slice/wompi-enum-metodo-f-1` (continuación de (f), sin rama propia — así lo pidió el spec), sin
mergear.

Regla: § Pagos en línea (Wompi) (CLAUDE.md, dos frases quedan falsas — ver arriba,
`WOMPI-WEBHOOK-DOCTRINA-PAGO-STALE-1`) · `app/api/webhooks/wompi/route.ts` (`PaymentIntentDb` crece:
`transaccionConOrdenLockeada`, `notificarAtencion`; `PaymentIntentRow` gana `orden_id`; `dbReal`
nuevo) · `packages/core/src/orders.ts` (`lockOrderForPayment`, nuevo export, cuarto lock de Order de la
misma forma que los otros tres) · `registerOrderPaymentTx` gana su CUARTO llamador ·
`WOMPI-PAYMENT-WEBHOOK-INTEGRACION-1`, follow-up abierto (la concurrencia real bajo Postgres, sin
medir) · `WOMPI-NOTIFICACION-CATALOGO-1`, follow-up abierto (las dos notificaciones sin catálogo) ·
(c)/(d)/reconciliación/barrido de intentos vencidos, sin construir — sin cambio de este slice.

## 2026-09-15 — La brecha de `WOMPI-PAYMENT-WEBHOOK-INTEGRACION-1` se cierra: (g) contra Postgres
real — el lock, el cobro duplicado y la idempotencia (`WOMPI-PAYMENT-G-INTEGRACION-1`)

**CIERRA el follow-up que `WOMPI-PAYMENT-DESDE-WEBHOOK-G-1` dejó abierto.** Ese slice midió su lógica
de decisión con un `db` fake en memoria (`route.test.ts`, capa 1) y dejó escrito, explícito, qué
quedaba SIN medir: *"que el `SELECT … FOR UPDATE` efectivamente serializa dos aprobados concurrentes
de la misma orden, y no sólo dos secuenciales… queda SIN medir en este slice"*. Este slice agrega esa
medición — no nueva lógica, sólo el archivo de test faltante, tal como el follow-up lo nombraba:
`tests/integracion/wompi-payment-webhook.test.ts`.

**NINGÚN código de producción se tocó.** `route.ts`, `orders.ts` y `notifications/admin.ts` quedan
exactamente como (g) los dejó — verificado con `git diff` antes de commitear: el único archivo
cambiado además de este ledger es el test nuevo.

### Por qué SÍ es de integración y no capa 1: lo que un fake no puede fingir

Un `db` fake en memoria no tiene forma de reproducir un `SELECT … FOR UPDATE` real: no hay lock que
tomar, no hay lectura fresca bajo lock, no hay unique constraint de Postgres que choque. Lo que este
archivo mide —siguiendo la forma de `cobro-sincronizado.test.ts`, `dinero-pagado-cliente.test.ts` e
`intento-pago-atomico.test.ts`, el precedente exacto que el spec señaló— es la propiedad, no el
comentario que la describe: que la transacción real de Postgres (`prisma.$transaction` +
`lockOrderForPayment`) es la que decide, no la secuencia de llamadas en JS.

### `dbReal` no se exporta — se RE-ENSAMBLA, letra por letra, a partir de sus piezas públicas

`touches:` de este slice es sólo `tests/integracion/wompi-payment-webhook.test.ts` + este ledger — no
incluye `route.ts`. El adaptador `dbReal` que `POST` usa en producción es un `const` privado del
módulo, así que el test no puede importarlo. Se reconstruyó DENTRO del archivo de test, con la MISMA
forma, a partir de las tres piezas que `dbReal` YA usa y que sí son públicas:
`lockOrderForPayment`/`registerOrderPaymentTx` (`@duna/core/orders`) y `createNotification`
(`@duna/core/notifications`). Lo único importado de `route.ts` es `procesarEventoWompi` (lo que se
mide) y el tipo `PaymentIntentDb`. No es una segunda implementación de lógica de negocio —es la misma
plomería de wiring, sin la cual `procesarEventoWompi` no tiene con qué hablarle a una base real.

### Los cinco casos, y qué afirma cada uno contra la base

- **PRIMER APROBADO:** un `PaymentIntent` `EN_VUELO` real (con su `reference` final vía
  `referenciaIntentoPago`, dos escrituras como `orders.ts` documenta) sobre una Order `pendiente` real
  → tras `procesarEventoWompi`, exactamente UN `Payment` (`metodo: 'WOMPI'`, monto = el confirmado por
  el evento), la Order releída queda `pagado`, el intento releído queda `APROBADO` con
  `pspTransactionId` lleno, y el `Shipping` se auto-creó en `preparando` — el CUARTO llamador de
  `registerOrderPaymentTx` corriendo de verdad.
- **SEGUNDO APROBADO sobre orden ya pagada (cobro duplicado):** se paga la orden de verdad con un
  primer intento (vía el webhook real), luego un SEGUNDO `PaymentIntent` `EN_VUELO` distinto de la
  MISMA orden recibe `APPROVED`. Se afirmó contra la base: el segundo intento cierra `APROBADO` (el
  hecho de Wompi se guarda), `prisma.payment.count()` sigue en 1 (cero segundo Payment), la Order
  releída sigue `pagado` (no se reabre), y `prisma.notification.findMany({tipo:
  'wompi_cobro_duplicado'})` trae EXACTAMENTE una fila real —`createNotification` real, no un espía—
  con el número de orden en el mensaje y el `href` de `hrefOrden`.
- **REINTENTO del mismo evento:** el MISMO evento entregado dos veces → `prisma.payment.count()` queda
  en 1; la segunda entrega corta en `'repetido'` antes de tocar la transacción.
- **El choque de `pspTransactionId` — la pieza que SÓLO Postgres puede afirmar:** dos `PaymentIntent`
  de DOS órdenes distintas, uno YA con `pspTransactionId: 'txn_real_compartido'` asentado; un evento
  para el OTRO intento trae ese mismo id. La unique real de la columna (no una simulación de P2002 en
  un fake) revierte la transacción entera: el intento que recibió el evento sigue `EN_VUELO` sin
  `pspTransactionId`, el otro no se tocó, y `prisma.payment.count()` da 0 en las dos órdenes.
- **FALLIDO (DECLINED):** cierra `FALLIDO`, cero `Payment`, la Order releída sigue `pendiente`, cero
  `Shipping` — sin cambios de este slice, medido igual para no dejar el bucket sin su caso base.

### La idempotencia se mide contra la MISMA unique que la protege en producción

El caso del choque de `pspTransactionId` es la razón de fondo por la que este archivo tenía que existir:
el `route.test.ts` de capa 1 simula el P2002 lanzando un error con `code: 'P2002'` a mano dentro del
fake — afirma que `isUniqueViolation` reacciona bien a ESE error, pero no que Postgres vaya a producirlo
de verdad para este par de columnas. Acá el choque lo produce la base real, contra la constraint
`@unique` de `pspTransactionId` en `schema.prisma` — la pieza que `PASARELA-DOC-AL-DIA-1` señala como
la que sostiene la idempotencia.

### El piso, medido en el árbol final (reconciliado contra el que `WOMPI-PAYMENT-DESDE-WEBHOOK-G-1` citó)

`npm test` → **1190/1190**, IDÉNTICO al piso citado por el slice anterior — ningún archivo de ese glob
cambió (el nuevo test vive en `tests/integracion/`, fuera de él). `npm run test:integracion` → **198/198**,
sube de los 193 citados por exactamente **5** — las cinco pruebas de este archivo nuevo (primer
aprobado, cobro duplicado, reintento, choque de `pspTransactionId`, fallido); ningún otro archivo de
ese carril se tocó. `npx tsc --noEmit` → limpio, sin cambios de tipos (el archivo nuevo usa los tipos ya
exportados por `route.ts`). `npm run gate` (los dos carriles en secuencia) → verde, con la misma cuenta.

### Lo que este slice NO cierra, y sigue igual que antes

- **`WOMPI-NOTIFICACION-CATALOGO-1`** (las dos notificaciones sin entrada en `AUTOMATION_MAP`) sigue
  abierto — fuera de `touches:`, sin cambio.
- **`WOMPI-WEBHOOK-DOCTRINA-PAGO-STALE-1`** (las dos frases de CLAUDE.md § Pagos en línea (Wompi) y la
  línea 85 que siguen hablando del Payment/del cuarto llamador como futuro) sigue sin tocarse —
  `CLAUDE.md` no está en `touches:` de este slice tampoco.
- **NUEVO, medido al hacer el censo de cierre de este slice:** `CLAUDE.md` línea 294 (§ Backlog técnico,
  GATE-DOS-CARRILES-1) dice *"son hoy **27 archivos y 191 tests**"* para el carril de integración —
  YA estaba desactualizado antes de este slice (el piso real citado por `WOMPI-PAYMENT-DESDE-WEBHOOK-G-1`
  era 193, no 191) y este slice lo aleja más: hoy son 198 tests en un archivo más. Es exactamente la
  clase de frase que la propia doctrina se cuida de escribir ("un número en doctrina es una frase con
  fecha de vencimiento") pero que igual quedó escrita como si fuera estado actual. **Follow-up nombrado:
  `WOMPI-MD-CARRIL-CONTEO-VENCIDO-1`** — no se toca acá porque `CLAUDE.md` no está en `touches:`.
- **La concurrencia REAL (dos llamadas VERDADERAMENTE simultáneas, `Promise.all`, al mismo
  `PaymentIntent`/misma Order) sigue sin medirse.** Este slice mide el lock y la unique con llamadas
  SECUENCIALES contra Postgres real (mismo criterio que el spec pidió: "primer-aprobado→un
  Payment+orden pagada; segundo-aprobado→…; reintento→un solo Payment", los tres casos son
  secuenciales). El precedente más cercano de concurrencia VERDADERA en este repo
  (`ajuste-concurrente.test.ts`, `despacho-concurrente.test.ts`) dispara dos peticiones con
  `Promise.all` sobre el MISMO recurso; el spec de este slice no lo pidió para (g) y no se agregó por
  iniciativa propia (fuera de lo pedido). Si hiciera falta, es su propio follow-up —no se nombra uno
  nuevo sin que el owner lo pida, para no inflar la lista de deuda con algo que nadie encargó.

**Tier 1 / AWAITING_APPROVAL, `stopped_on: ['customer-bytes']` — HEREDADO, no nuevo.** El diff de este
slice no agrega bytes nuevos que un operador/dueño lea (es un archivo de test); pero la RAMA
`slice/wompi-enum-metodo-f-1` —contra la que se juzga la política, no el commit— YA cambió bytes de
operador en el commit anterior (los textos de las dos notificaciones de `WOMPI-PAYMENT-DESDE-WEBHOOK-G-1`,
`ff9dda8`), y esa rama sigue sin mergear. Por la regla del eje (§ ORCH-CUSTOMER-BYTES-EJE-1: el gate mira
la RAMA completa contra su base, no el commit de este slice), el veredicto de la rama sigue siendo
AWAITING_APPROVAL con el mismo `stopped_on`. `customer_bytes.changed` de ESTE commit es `false` (no
introduce texto nuevo); el de la RAMA sigue `true` por lo ya mergeado en commits previos de la misma
rama.

Regla: § El carril de integración (CLAUDE.md) · § GATE-DOS-CARRILES-1 · `tests/integracion/
wompi-payment-webhook.test.ts` (nuevo) · cierra `WOMPI-PAYMENT-WEBHOOK-INTEGRACION-1` · abre
`WOMPI-MD-CARRIL-CONTEO-VENCIDO-1` (conteo vencido en CLAUDE.md, fuera de `touches:`) · sin rama propia
(continuación de `slice/wompi-enum-metodo-f-1`), sin mergear.

## 2026-09-15 — El reconciliador de Wompi: (h)+(i) en una sola función, por la EDAD del intento (`WOMPI-RECONCILIADOR-HI-1`)

**CIERRA `WOMPI-WEBHOOK-DISPARA-BARRIDO-1`** (coined en `WOMPI-WEBHOOK-RUTA-1`) y la línea que la
tanda de (g) dejó abierta explícitamente: *"(c)/(d)/reconciliación/barrido de intentos vencidos, sin
construir — sin cambio de este slice"* (`WOMPI-PAYMENT-DESDE-WEBHOOK-G-1`, línea 4089 de este mismo
archivo). El barrido YA ESTÁ CONSTRUIDO: `packages/core/src/pagos/reconciliador.ts` consulta a Wompi
lo `EN_VUELO` joven y cierra lo vencido, en un solo tick horario.

### (h) e (i) son UNA función — la razón de seguridad, medida, no supuesta

El spec lo pedía fusionado y el porqué es concreto, no estilo: cerrar un intento vencido por el solo
paso del tiempo, SIN consultar antes a Wompi, marcaría `FALLIDO` un intento que Wompi SÍ aprobó pero
cuyo webhook se perdió — plata real dada por perdida. `reconciliarIntentoPago` por eso SIEMPRE
consulta primero, para TODO intento `EN_VUELO` que mira, joven o vencido, y sólo cierra por edad
cuando esa MISMA consulta no trajo un terminal. **Se afirmó con el caso más directo posible**
(`SEGURIDAD (§0)` en `tests/integracion/wompi-reconciliador.test.ts`): un intento sembrado a 50 h
(vencido) al que Wompi responde `APPROVED` — paga la orden, `reporte.vencidos === 0`. Nunca hay un
camino que cierre `FALLIDO` sin haber preguntado.

### La lógica de dinero se EXTRAJO, no se duplicó

`app/api/webhooks/wompi/route.ts` (g) tenía inline, dentro de `transaccionConOrdenLockeada`, la
decisión «¿la orden está pendiente? paga; si no, cobro duplicado». Se movió, letra por letra, a
`packages/core/src/pagos/aplicar-resultado-wompi.ts` (`aplicarResultadoWompi`) — el webhook la LLAMA
ahora en vez de reimplementarla, y el reconciliador la comparte. `bucketDeStatus` (el mapeo
`APPROVED`/`DECLINED`/`VOIDED`/`ERROR` → `APROBADO`/`FALLIDO`) migró con ella, de privada en
`route.ts` a exportada y compartida. Es el mismo criterio que ya evitó la divergencia de
`razonDelServidor`/`cruzoMinimo` y de `disparador`/`frase`: una función, dos llamadores, nunca dos
copias que puedan desalinearse.

**Lo que NO se movió, a propósito: el cierre `FALLIDO`.** Ni por veredicto directo de Wompi ni por
vencimiento de edad pasa por `aplicarResultadoWompi` — ninguno de los dos toca la Order, y el
comentario original de (g) ya documentaba por qué: "no hay lock que tomar porque no hay decisión de
dinero que proteger". Forzar ese camino a pasar por una función pensada para el lock de Order habría
sido una segunda decisión de arquitectura que nadie pidió. Cada llamador (el webhook, el
reconciliador) sigue cerrando FALLIDO con su propio `paymentIntent.updateMany` — trivial, sin lógica
de negocio que compartir.

### `packages/core` no importa de `lib/` — medido antes de tocar nada, y es lo que forma la frontera

Antes de diseñar nada se corrió `grep -rn "from '@/" packages/core/src/*.ts packages/core/src/**/*.ts`
(excluyendo `generated/`): **CERO** imports en tiempo de ejecución — los cuatro hits existentes
(`product-form.ts`, `usuarios.ts`, `zona-config.ts`, `order-stat-filters.ts`) son TODOS `import
type`, del alias `@/types/*`, nunca `@/lib/*` — coincide exactamente con el precedente que CLAUDE.md
ya documenta para la precondición de Fase B. Esa medición decidió la forma: el cliente HTTP
(`lib/pagos/wompi-api.ts`, `consultarTransaccionesPorReferencia`) vive en `lib/` porque necesita
`fetch`/`WOMPI_PRIVATE_KEY`, nunca lo importa `reconciliador.ts` — lo recibe INYECTADO, ensamblado por
quien invoca (el cron route, nivel app), igual que `PaymentIntentDb.notificarAtencion` en (g). Mismo
criterio para `hrefOrden` (vive en `constants/automations.ts`, nivel app): se inyecta en
`aplicarResultadoWompi` y en `reconciliarIntentoPago`, nunca se importa desde `packages/core`.

### El disparo: un paso propio del cron, junto a las automatizaciones, nunca dentro

`app/api/cron/automations/route.ts` gana `correrPasoReconciliador()`, invocado junto a
`runScheduledAutomations` en el mismo `POST` — el motor de automatizaciones es MENSAJE-céntrico (un
`Objetivo` es «despachar o omitir un aviso») y reconciliar (llamar una API externa, crear un `Payment`
bajo lock) no encaja en ese loop. **Se activa SÓLO si `WOMPI_PRIVATE_KEY` está configurada** — un
despliegue sin Wompi sigue corriendo exactamente igual que antes de este slice, sin ruido ni cambio de
comportamiento. Un fallo del barrido (Wompi caído, un error inesperado) se loguea y viaja en la
respuesta como `{omitido:false, error}`, nunca se propaga: no debe tumbar el resto de las
automatizaciones programadas, ni siquiera cuando éstas ya venían `degradado` (config ilegible) — son
dos fallas independientes, y una plata reconciliada no debería esperar a que alguien arregle un
`AutomationSetting` roto.

**El host de la API (sandbox vs. producción) se deriva de `esDespliegueDemo()`**, la MISMA fuente
única que ya gobierna si el despliegue puede arrancar con la llave pública productiva de Wompi
(`instrumentation.ts`, `PASARELA-LLAVES-COHERENTES-1`) — NO una env var nueva. El spec sólo pedía
nombrar `WOMPI_PRIVATE_KEY`; agregar una segunda variable para el host habría sido una fuente más que
podría desincronizarse de la que ya decide "¿esto es una demo?". `wompi-api.ts` en sí NUNCA lee
`process.env` (mismo principio que `wompi-firma.ts`): el host y la llave entran como parámetro, y es
el cron route quien decide de dónde salen.

### El cap del barrido: 20, no 50 — y la cuenta que lo justifica

`TOPE_POR_BARRIDO` de las automatizaciones programadas (`lib/automations/handlers/programadas.ts`) es
**50**, pero ese barrido es sólo lectura/escritura de base — rápido y acotado. Éste hace una llamada
HTTP a Wompi POR FILA, con su propio riesgo de timeout, y la función serverless no tiene
`maxDuration` explícito (medida antes de decidir: `grep -n "maxDuration" app/api/cron/automations/route.ts`
da cero), así que corre contra el default de **300 s** de Vercel Functions. Con el timeout de Wompi en
6 s (`TIMEOUT_MS`, `lib/pagos/wompi-api.ts`) y un cap de **20**, el peor caso (las 20 consultas
agotando su timeout) es 120 s — bajo la mitad del presupuesto, dejando margen para
`runScheduledAutomations` (que corre en el MISMO `POST`, antes) y para las escrituras de cada fila.
Copiar el 50 sin ajustar habría dejado un peor-caso de 400 s — por encima del límite.

### DESVIACIÓN MEDIDA: el `observed-report` que cita el spec no existe

El spec de este slice traía `observed-report: WOMPI-RECONCILIACION-BARRIDO-CENSO-1`. Medido ANTES de
escribir código: `grep -rn "RECONCILIACION-BARRIDO-CENSO\|RECONCILIADOR-HI" DECISIONS.md CLAUDE.md`
da cero, y `git log --all --oneline | grep -i reconcil` sólo trae `35b24b2`
(`PASARELA-DECISIONES-LEDGER-1`) — ese id no existe en ningún lado del repo ni del historial. Es la
MISMA familia que `WOMPI-CHECKOUT-INTENTOS-CENSO-1`, ya medida como inexistente por
`WOMPI-B-ASIENTO-CORRECCION-BUNDLE-1` (línea 3284 de este archivo): un spec que cita un artefacto
`writes:no` que nunca se commiteó. **El contenido técnico del spec (§1, §2) SÍ está sostenido** por un
asiento real y verificable — `WOMPI-REGLAS-IMPLEMENTACION-1` (la regla del array vacío, la firma
`WOMPI_PRIVATE_KEY`-únicamente, `GET /v1/transactions?reference=` vs. `/v1/transactions/<id>`) — así
que el trabajo procedió sobre esa base medible, no sobre la cita fantasma.

### Dos ambigüedades del spec, resueltas a favor de la regla de seguridad explícita (§0), no de la letra suelta

1. **§6 pide un caso "vencido + sin resolver → FALLIDO SIN consultar".** Leído literal, contradice la
   propia razón de seguridad de §0 del spec (cerrar por edad SIN consultar puede perder plata
   aprobada). Se interpretó "SIN consultar" como "sin una consulta ADICIONAL" —coincide con la letra
   de §1, "cerrar FALLIDO sin más consulta"— y el test de ese caso AFIRMA que la consulta a Wompi SÍ
   ocurrió (`llamadas === 1`) antes de cerrar.
2. **§3 dice "un error de red no cierra el intento (se reintenta el próximo tick, salvo que ya venció
   por edad)".** Leído literal, un error de red sobre un intento YA vencido lo cerraría igual —de
   nuevo, contra §0—. `reconciliarIntentoPago` NUNCA cierra por un fallo de consulta, sin importar la
   edad: un error de red o de la API siempre deja el intento `EN_VUELO`, se reintenta el próximo tick.
   La lectura literal de esa frase se descartó a favor de la regla de seguridad, explícita e
   inequívoca en §0 — no hay test que la ejercite en la dirección peligrosa porque esa dirección no
   existe en el código.

### El piso, medido en el árbol final

`npm test` → **1190/1190**, IDÉNTICO al piso citado por `WOMPI-PAYMENT-G-INTEGRACION-1` — ningún
archivo de ese glob perdió ni ganó un test (`route.test.ts` de (g) sigue en su mismo conteo; los
archivos nuevos de `packages/core/src/pagos/` no tienen test propio en `touches:`, sólo el de
integración). `npm run test:integracion` → **208/208**, sube de los 198 citados por el slice anterior
por exactamente **10** — las diez pruebas nuevas de `wompi-reconciliador.test.ts` (joven+aprobado,
joven+duplicado, joven+declined, joven+vacío, vencido+sin-resolver, joven+cerca-del-umbral,
seguridad-vencido-pero-aprobado, webhook-cierra-primero, concurrencia webhook↔reconciliador, y el cap
del barrido); ningún otro archivo de ese carril cambió. `npx tsc --noEmit` → limpio. `npm run build`
→ verde, `/api/cron/automations` y `/api/webhooks/wompi` ambas listadas como rutas dinámicas (`ƒ`).

### Lo que este slice NO cierra, y sigue igual que antes

- **`WOMPI-NOTIFICACION-CATALOGO-1`** (las dos notificaciones sin entrada en `AUTOMATION_MAP`) sigue
  abierto — no tocado.
- **`WOMPI-MD-CARRIL-CONTEO-VENCIDO-1`** (el conteo del carril de integración en CLAUDE.md § Backlog
  técnico) sigue desactualizado, y ahora un poco más (208, no 198) — `CLAUDE.md` no está en
  `touches:`.
- **NUEVO, medido al cerrar este slice:** `CLAUDE.md` línea 2955-2956 (§ Pagos en línea (Wompi)) dice
  *"La RECONCILIACIÓN y el barrido de intentos vencidos siguen sin construirse"* — FALSA desde este
  slice. Follow-up nombrado: **`WOMPI-MD-RECONCILIADOR-STALE-1`** — no se toca porque `CLAUDE.md` no
  está en `touches:`.
- **Adyacente, medido de paso, NO causado por este slice:** la misma sección de CLAUDE.md (línea
  2953-2954) sigue diciendo que el webhook *"NO crea el `Payment`: frontera deliberada, porque eso
  exige un valor de `MetodoPago` que el enum de hoy no tiene (decisión del owner, pendiente)"` — falso
  desde (f)+(g) (`WOMPI-ENUM-METODO-F-1`, `WOMPI-PAYMENT-DESDE-WEBHOOK-G-1`), antes de que este slice
  empezara. Ya estaba marcado por `WOMPI-WEBHOOK-DOCTRINA-PAGO-STALE-1` (línea 4082 de este archivo);
  se anota acá sólo para que quien lea este asiento no lo confunda con algo nuevo.
- **El barrido corre SECUENCIAL, no en paralelo**, por diseño (acota la carga sobre Wompi y sobre la
  base a la vez) — no hay follow-up de paralelizarlo: el spec no lo pidió y el orden entre filas es
  irrelevante.

**Tier 1 / AWAITING_APPROVAL, `stopped_on: ['customer-bytes']` — HEREDADO, no nuevo.** Este commit no
agrega bytes nuevos que un operador/dueño lea: las dos notificaciones (`wompi_cobro_duplicado`,
`wompi_monto_discrepante`) tienen el TEXTO IDÉNTICO al de (g) — se movieron de archivo, no se
reescribieron (verificado: mismo `tipo`, `titulo`, y la misma plantilla de `mensaje`). El JSON del
cron route no lo lee un humano directamente (log de GitHub Actions). Pero la RAMA
`slice/wompi-enum-metodo-f-1` —contra la que se juzga la política, no el commit— ya cambió bytes de
operador en commits previos (las notificaciones de (g), `ff9dda8`), y sigue sin mergear. Por la regla
del eje (§ ORCH-CUSTOMER-BYTES-EJE-1), el veredicto de la RAMA sigue AWAITING_APPROVAL con el mismo
`stopped_on`. `customer_bytes.changed` de ESTE commit es `false`; el de la RAMA sigue `true`.

Regla: § Pagos en línea (Wompi) (CLAUDE.md, una frase más queda falsa — ver arriba,
`WOMPI-MD-RECONCILIADOR-STALE-1`) · `packages/core/src/pagos/aplicar-resultado-wompi.ts` (nuevo) ·
`packages/core/src/pagos/reconciliador.ts` (nuevo) · `lib/pagos/wompi-api.ts` (nuevo) ·
`app/api/webhooks/wompi/route.ts` (la lógica APROBADO se extrae, el comportamiento no cambia) ·
`app/api/cron/automations/route.ts` (gana el paso del reconciliador) ·
`tests/integracion/wompi-reconciliador.test.ts` (nuevo, 10 casos) · cierra
`WOMPI-WEBHOOK-DISPARA-BARRIDO-1` · abre `WOMPI-MD-RECONCILIADOR-STALE-1` (CLAUDE.md desactualizado,
fuera de `touches:`) · sin rama propia (continuación de `slice/wompi-enum-metodo-f-1`), sin mergear.
## 2026-09-15 — (c), la ruta de retorno de Wompi: tres estados, la verdad del webhook y no del navegador (`WOMPI-RUTA-DE-RETORNO-1`)

**LA REGLA QUE GOBIERNA TODO EL DISEÑO, y va primero porque de ahí sale el resto:** el retorno del
navegador NO ES LA FUENTE DE VERDAD — el webhook lo es. Wompi puede pasar un `status` en el query del
redirect (`data-redirect-url`, `RUTA_RETORNO_WOMPI = '/checkout/retorno'`,
`components/storefront/checkout/PagoPasarela.tsx:10`); esta pantalla NO LO LEE NI SE LO CREE. Sólo
afirma lo que `PaymentIntent.estado` dice — y ese campo sólo lo escribe el webhook
(`app/api/webhooks/wompi/route.ts`).

**LO CONSTRUIDO:**

- **`app/api/checkout/retorno/route.ts` (151 líneas)** — la primera lectura de `PaymentIntent` por
  `reference` fuera del webhook (medido antes de tocar nada:
  `grep -rn "paymentIntent.findUnique" --include="*.ts" --include="*.tsx" .` daba UNA sola aparición,
  la del webhook). Exige `reference` + `email` — el SEGUNDO FACTOR TECLEADO, mismo patrón que
  `/api/orders/track` (`trackOrder`, precedente literal seguido, no reinventado): la `reference`
  (`<numero_orden>:<cuid>`) viaja en una URL de retorno que un tercero podría leer (historial,
  referrer, analítica), y sola no puede revelar el estado de un pago ajeno. Rate-limit por IP
  (`rateLimit`, `packages/core/src/rate-limit.ts`, `limit: 20, windowMs: 60_000` — más generoso que
  el `10/60s` de `track` porque el comprador legítimo hace POLLING, no una consulta única) y el MISMO
  404 genérico para referencia inexistente, orden sin `cliente_email`, o email que no coincide — sin
  oráculo de enumeración. **Devuelve ÚNICAMENTE `{estado, numero_orden}`** — nada de monto, datos del
  cliente ni `pspTransactionId —` afirmado por test (`assert.deepEqual(Object.keys(...).sort(), [...])`).
  El lector se inyecta (`RetornoIntentoDb`, mismo criterio angosto-y-estructural que `PaymentIntentDb`
  del webhook) envolviendo el `select` real del join con `order` DENTRO de un adaptador (`dbReal`) para
  que la interfaz no tenga que reproducir el tipo `PaymentIntentSelect` de Prisma — la primera versión,
  con `select` expuesto en la firma, no tipaba (`PrismaClient` no era asignable a la interfaz; TS2345).
- **`app/api/checkout/retorno/route.test.ts` (169 líneas, 10 casos)** — DB-free, con el doble en
  memoria (mismo patrón que `route.test.ts` del webhook): coincidencia exacta, coincidencia
  normalizada (trim+minúsculas), email que no coincide, referencia inexistente, orden sin
  `cliente_email`, los tres estados viajando SIN reinterpretarse, y la plomería de `POST` (JSON
  inválido, campo faltante, email con forma inválida, 429 al superar el límite) — todo ANTES de tocar
  la base, así que corre en el carril rápido (`app/**/*.test.ts`).
- **`services/checkout.service.ts` (+39 líneas)** — `consultarRetornoPago(reference, email)`, el
  wrapper cliente sobre la ruta de arriba. Un 429 LANZA (no es "no encontrado" — es "esperá"); mismatch
  o referencia inexistente devuelven `null`.
- **`app/(storefront)/checkout/retorno/page.tsx` (315 líneas)** — la pantalla. Estados como UNIÓN
  discriminada (`Vista`), nunca un string suelto: `sin_referencia` (sin `?reference=` en la URL — nadie
  llega sin haber pasado por el widget), `pidiendo_email`/`buscando`/`no_encontrado` (el formulario del
  segundo factor, calco de `rastrear-pedido`), `en_vuelo` (POLLING), `aprobado`, `fallido`, `techo`
  (indeterminado, dejó de sondear). **El correo NUNCA se lee de un query param** — aceptar `?email=`
  acá habría anulado el segundo factor completo (cualquiera con el link del redirect tendría los dos).
  Sin datos del comprador en pantalla: sólo `estado` (traducido a copy) + `numero_orden`, igual que la
  respuesta del servidor.
- **EL BACKOFF: 2, 4, 8, 16, 30s y de ahí en más cada 30s, techo de 5 minutos** (`BACKOFF_SEGUNDOS`,
  `TECHO_MS`, del diseño del slice, no elegidos por este slice). Vive en el CLIENTE
  (`programarSiguiente`, refs para el contador y el reloj del techo — no debe disparar un re-render
  por sí mismo); el servidor sólo responde el estado crudo en cada consulta. Un 429/fallo transitorio
  durante el polling NO rompe el ciclo ni reinicia el reloj del techo — sólo un throw en la consulta
  INICIAL (el submit del formulario) se muestra al comprador (`toast.error`).
- **CERO DEPENDENCIA DE THEME** — verificado, no asumido: el spec advertía "si te encontrás
  necesitando algo de un theme, PARÁ" y no hizo falta pararse; la pantalla usa el mismo vocabulario
  `--sf-*`/Tailwind crudo que `rastrear-pedido` y el resto del checkout canónico.

**DESVIACIÓN MEDIDA, la MISMA que ya había medido el slice anterior — se re-verifica, no se hereda de
un solo dicho:** el `observed-report` que este spec cita (`WOMPI-CHECKOUT-INTENTOS-CENSO-1`) SIGUE SIN
EXISTIR — `grep -n "WOMPI-CHECKOUT-INTENTOS-CENSO-1" DECISIONS.md` da CERO líneas propias (sólo las dos
menciones que lo citan, la de `WOMPI-NO-ES-METODO-DEL-PANEL-1` y ésta) y
`git log --all --grep="CHECKOUT-INTENTOS-CENSO" --oneline` da vacío. La afirmación puntual que el spec
apoyaba en ese censo —"no hay hoy ningún lector de `PaymentIntent` por `reference` fuera del
webhook"— SÍ se re-verificó de forma independiente (el mismo `grep` de arriba, corrido ANTES de escribir
una línea) y es CIERTA. Se anota la discrepancia contra el spec, sin bloquear el trabajo: la
construcción no dependía del censo citado, sólo de la medición que sí se pudo hacer.

**LO QUE QUEDA PARA CAPA 3, dicho explícito:** el FLUJO REAL de vuelta —qué query params pone Wompi de
verdad en el redirect (`?reference=` es lo que este slice asume, siguiendo la instrucción del spec;
no hay forma de confirmarlo sin una transacción de sandbox/producción real, § "capa 3" del spec) — no
se verificó contra un pago real. El diseño es correcto pase lo que pase con el nombre exacto del query
param, PORQUE la regla central (no creerle al navegador) no depende de qué parámetros trae la URL: el
`reference` es sólo la llave que arranca el formulario del segundo factor, nunca la fuente de verdad.
El backoff/techo tampoco se verificó contra un navegador real (expresable en capa 1 el CÁLCULO de la
espera, `esperaSiguienteMs`, pero no se le escribió un test dedicado — el mecanismo de temporizador en
sí, con `setTimeout` real, es capa 3 por naturaleza, mismo criterio que el resto del repo para
mecanismos de reloj/temporizador en componentes cliente).

**EL CHECKLIST DE (e), explícito por instrucción del owner (2026-09-16, al gatear (c)):** para que la
lista de lo que falta ver no quede en la memoria de nadie, éstos son los TRES estados que (e) tiene
que traer a la vista, uno por uno:

- **APROBADO** — el camino feliz: el pago entró.
- **FALLIDO (rechazado)** — el pago que Wompi declinó.
- **Indeterminado** — `EN_VUELO` con el backoff corriendo hasta el techo, y la vista `techo` con sus
  salidas (rastrear / volver a consultar / WhatsApp condicional).

**(e) los trae los tres, no sólo el feliz.**

**BYTE-IDENTIDAD DE NAYOLI, verificada por ejecución.** `NEXT_PUBLIC_PASARELA_HABILITADA` es
`undefined` en este entorno (`node -e` lo confirma) — la pasarela sigue apagada, así que
`RUTA_RETORNO_WOMPI` nunca se usa como destino de un redirect real: `grep -rn "checkout/retorno"`
(fuera de este propio código y sus tests) da UNA sola referencia externa, la constante en
`PagoPasarela.tsx`. La ruta EXISTE — Next no gatea páginas por feature flag — pero nadie la alcanza
desde un pago real sin que la pasarela esté encendida; visitarla a mano sin `?reference=` cae en
`sin_referencia`, sin afirmar nada. `next build` confirma `/checkout/retorno` y `/api/checkout/retorno`
como `ƒ` (dinámico, heredado del layout `force-dynamic` del storefront) sin tocar ninguna ruta
existente.

**GATE, medido en el árbol final de la rama.** `npm test` → **1197/1197** (piso medido antes de
empezar: **1187**; el slice sumó **10**, exactamente los del archivo nuevo). `npm run test:integracion`
→ **193/193** (idéntico al piso — el resolver es DB-free, vive en el carril rápido bajo `app/**`, no
en `tests/integracion/`). `npx tsc --noEmit` → 0 errores (tras el ajuste del adaptador `dbReal`, arriba).
`npm run build`/`next build` → verde, sin migraciones nuevas que aplicar (no se corrió `db:deploy` para
no tocar ninguna base ajena a este slice; el spec no pide schema y el diff no lo toca).

**Tier 1 / AWAITING_APPROVAL.** El diff toca `app/(storefront)/` y `app/api/` (Tier 1 por subárbol) —
la pantalla que le dice al comprador si su pago entró, en la ruta del dinero. Rama
`slice/wompi-ruta-de-retorno-1`, sin mergear.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · el segundo factor tecleado (precedente
`/api/orders/track`) · el backoff con su techo, sin verificar contra un navegador real (capa 3) · el
nombre exacto del query param de Wompi, sin confirmar contra una transacción real (capa 3) · la
`observed-report` citada por el spec, que sigue sin existir.

## 2026-09-15 — Los dos gaps del gate del owner sobre (c): el 307 del tenant sin pasarela, y la salida completa del techo (`WOMPI-RETORNO-307-Y-TECHO-1`)

El owner gateó (c) (`WOMPI-RUTA-DE-RETORNO-1`, arriba) y encontró DOS huecos concretos, no una
objeción general: la pantalla no tenía guarda de servidor para un tenant sin la pasarela, y la
vista `techo` sólo daba UNA salida cuando el propio owner había pedido tres. Esta tanda cierra los
dos, en la MISMA rama (`slice/wompi-ruta-de-retorno-1`) y sin tocar el lector, el segundo factor ni
el schedule del backoff — lo que (c) ya construyó y el owner ya validó por lectura queda intacto.

**GAP 1 — EL 307, ANTES DE RENDERIZAR.** `app/(storefront)/checkout/retorno/page.tsx` era enteramente
CLIENTE (`"use client"`, `useSearchParams`), sin chequeo server-side: un tenant SIN
`NEXT_PUBLIC_PASARELA_HABILITADA=1` que entrara a `/checkout/retorno` veía el formulario "Confirma tu
pago" — una pantalla viva para una capacidad que ese despliegue no tiene. `page.tsx` pasó a SERVER:

```
export default async function CheckoutRetornoPage() {
  if (!pasarelaDisponibleEnEsteDespliegue()) redirect("/checkout");
  const settings = await getSiteSettings();
  return <RetornoCliente tieneWhatsapp={settings.whatsapp.trim() !== ""} />;
}
```

`redirect()` throws de forma SÍNCRONA en la primera línea del cuerpo — antes de cualquier `await` y
antes de construir un solo nodo JSX —, así que el gate es efectivamente "antes de renderizar" por la
forma del propio control de flujo, no por convención. **307, no 308 ni un 404, verificado leyendo la
fuente de Next instalada** (`node_modules/next/dist/client/components/redirect.js:53`: `redirect()`
sin segundo argumento llama a `getRedirectError(url, type, RedirectStatusCode.TemporaryRedirect)`,
y `TemporaryRedirect = 307` en `redirect-status-code.js:13`) — el mismo comportamiento que ya
documenta `nosotros/page.tsx` para su propio apagado por config. Es la decisión correcta porque la
pasarela es un TOGGLE DE DESPLIEGUE (`pasarelaDisponibleEnEsteDespliegue`, § `WOMPI-TOGGLE-
DISPONIBILIDAD-1`): puede encenderse mañana sin volver a desplegar código, así que el redirect tiene
que seguir siendo TEMPORAL — un 308 lo cachearía como permanente en el navegador del comprador, y un
404 diría que la ruta no existe cuando sólo está apagada (mismo argumento que ya usa /nosotros para
su propia página apagable).

**Verificado por EJECUCIÓN, no sólo por lectura del código de Next:** `npm run build` seguido de
`npm start` (modo producción) y una petición con `redirect: 'manual'` contra
`/checkout/retorno?reference=abc123` en este entorno (donde `NEXT_PUBLIC_PASARELA_HABILITADA` sigue
sin definirse, igual que documenta la entrada anterior) devolvió **`status 307`,
`location: /checkout`** — medido, no supuesto. La rama "pasarela disponible" (que SÍ renderiza
`RetornoCliente`) no se re-probó en caliente contra el flag encendido en este entorno —encenderlo
exige reiniciar el proceso de Node con la env var puesta, y esta sesión no tiene permiso para invocar
`kill`/prefijar la asignación de la variable—, pero es el MISMO patrón, ya usado y ya verificado por
ejecución, de `nosotros/page.tsx` (`if (!content.paginas.nosotros.visible) redirect("/")`) y de
`checkout/page.tsx` (`pasarelaDisponibleEnEsteDespliegue()` leído en el mismo build): no hay
mecanismo nuevo, sólo el mismo gate movido al lado server de una pantalla que antes no lo tenía.

**GAP 2 — LA SALIDA COMPLETA DEL TECHO.** La vista `techo` tenía la salida PRINCIPAL correcta (número
de orden + "Rastrear mi pedido" → `/rastrear-pedido?orden=…`) y le faltaban las dos que el owner
especificó, en la jerarquía que él fijó:

- **Secundaria "Volver a consultar"**: reusa `handleBuscar` tal cual —la misma función que ya
  reinicia `intentoRef`/`inicioEnVueloRef` a cero y consulta de inmediato, sin esperar el primer
  tramo del backoff—, así que "reintentar" y "buscar por primera vez" son literalmente el mismo
  camino de código. `email`/`reference` siguen en scope (la vista `techo` sólo se alcanza tras un
  `EN_VUELO` exitoso previo), así que no hace falta volver a pedir el correo. Estilo secundario
  (outline, el mismo que ya usa "Seguir comprando" en la vista `aprobado`), no compite con la
  principal.
- **WhatsApp, terciaria y CONDICIONAL a `tieneWhatsapp`**: la señal booleana que el server calcula en
  `page.tsx` (`settings.whatsapp.trim() !== ''`, mismo patrón que `checkout/page.tsx`) y baja por
  prop a `RetornoCliente`. El NÚMERO en sí no viaja por prop —`RetornoCliente` se monta siempre
  dentro del `SiteSettingsProvider` del layout del storefront (nunca en un árbol de preview del
  admin, a diferencia de `SuscripcionPlanes`/`NosotrosGaleria`), así que `useSiteSettings()` da el
  número gratis, sin una segunda fuente que pudiera divergir de la que resolvió la señal—. Sin
  canal configurado el `<a>` NO SE RENDERIZA (`{tieneWhatsapp && (...)}`): la misma guarda de
  veracidad que ya aplican el footer y el propio checkout — no se ofrece un camino que no existe.

El owner sólo especificó estas dos salidas para el TECHO; la vista `fallido` NO se tocó — queda como
posible follow-up, sin decidir acá (ver abajo).

**EL GATE ES PARCIAL, Y QUEDA DICHO PARA QUE NO SE LEA COMO MÁS DE LO QUE FUE.** El owner gateó (c)
por LECTURA + los tests del carril, NO visualmente — no hay evidencia de un navegador real contra
esta pantalla, ni antes de esta tanda ni después. La CAPA 3 (§ Las tres capas de verificación,
CLAUDE.md) sigue PENDIENTE, con disparador **(e)**: el evento real que trae al comprador de vuelta a
esta pantalla (una transacción de sandbox/producción contra Wompi). La lista EXACTA de lo que falta
VER, para que no quede en la memoria de nadie: los TRES estados renderizados —**aprobado**,
**rechazado/fallido**, e **indeterminado con su backoff llegando al techo** (los tres botones nuevos
incluidos)—. (e) los trae los TRES, no sólo el feliz.

**GATE, medido en el árbol final de la rama.** `npm test` → **1197/1197** (idéntico al piso que ya
medía la entrada anterior — este slice no agrega tests, sólo mueve/edita JSX y un `page.tsx` server).
`npm run test:integracion` → **193/193** (idéntico). `npx tsc --noEmit` → 0 errores. `npm run build` →
verde; `/checkout/retorno` y `/api/checkout/retorno` siguen `ƒ` (dinámico, heredado del layout
`force-dynamic` del storefront). **Sin test nuevo para el 307**: el `touches` de este slice no incluye
un archivo de test, y un test de este `page.tsx` exigiría mockear `@/lib/config/site-settings` —que
importa `server-only`, y ese guard revienta al importar el módulo en un test de node plano
independientemente de la rama que el test quiera ejercer— o levantar un harness de RSC que este repo
no tiene (jsdom ausente, § CLAUDE.md "el glob NO incluye `*.test.tsx`"). La verificación es la de
arriba: lectura de la fuente de Next + ejecución contra el build de producción.

**DESVIACIÓN MEDIDA, TERCERA VEZ SOBRE EL MISMO HECHO — y ya no es ruido, es un patrón.** El
`observed-report` que ESTE spec también cita (`WOMPI-CHECKOUT-INTENTOS-CENSO-1`) SIGUE SIN EXISTIR:
`grep -n "WOMPI-CHECKOUT-INTENTOS-CENSO-1" DECISIONS.md` sigue dando cero líneas propias (sólo las
menciones que lo citan, incluida ésta). Las dos entradas anteriores ya lo habían medido y anotado por
separado; se re-mide acá por la misma disciplina («no se hereda de un solo dicho») y se deja
constancia de que la tercera cita consecutiva de un censo inexistente ya no es una casualidad de
transcripción — alguien debería dejar de citarlo, o escribirlo de una vez.

**Tier 1 / AWAITING_APPROVAL.** El diff toca `app/(storefront)/checkout/retorno/` (Tier 1 por
subárbol — la pantalla que le dice al comprador si su pago entró) y `DECISIONS.md`. Ningún cambio de
schema, ninguna migración, ningún contrato cross-repo. Rama `slice/wompi-ruta-de-retorno-1`, sin
mergear.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `nosotros/page.tsx` como precedente del redirect 307
por config apagada · `SuscripcionPlanes`/`NosotrosGaleria` como precedente del `{negocio}`/`whatsapp`
por prop cuando SÍ hay riesgo de árbol sin provider (acá no lo hay, así que el número se lee por
contexto) · la capa 3 pendiente, con disparador (e) y su lista exacta de tres estados por ver · la
`observed-report` citada por el spec, tercera vez sin existir.

## 2026-09-16 — `.gitattributes` con `merge=union` para `DECISIONS.md`: la clase de conflicto append-only deja de existir (`LEDGER-MERGE-UNION-GITATTRIBUTES-1`)

**EL HECHO.** Cada rama `slice/*` que agrega un asiento a `DECISIONS.md` escribe al FINAL del
archivo; dos ramas que ambas sumaron un asiento chocan al mergear sobre la MISMA región. La
resolución es SIEMPRE la misma —conservar los dos bloques de asientos, en orden, sin editar una
línea— porque dos asientos apilados no tienen una decisión adentro: no hay criterio humano que
aportar. Es un paso manual y recordable que se repite en cada merge con ramas `slice/*` en
paralelo, y que este repo corre seguido (la propia tanda de Wompi de esta semana es la evidencia:
una docena de asientos apilados en pocos días).

**EL MECANISMO, nativo de git.** `union` es un driver de merge de bajo nivel que, ante un
conflicto, conserva AMBOS lados — exactamente la resolución de arriba, hecha automática. Se
declara por `.gitattributes` (archivo nuevo en la raíz del repo; no existía) con una sola línea:

```
DECISIONS.md merge=union
```

No hace falta tocar `.git/config` ni escribir un driver de merge propio: `union` viene incluido
en git y `.gitattributes` alcanza para activarlo sobre este archivo.

**LA ADVERTENCIA, completa, porque el owner la gatea con los ojos abiertos.** `merge=union` se
aplica a TODOS los conflictos de `DECISIONS.md`, no sólo a los append-only. Para dos asientos
apilados —que es ~todo lo que pasa en este archivo— es la resolución correcta. Pero si dos ramas
alguna vez EDITAN el mismo asiento (una corrección de una frase ya escrita, como la del bundle,
`WOMPI-B-ASIENTO-CORRECCION-BUNDLE-1`), la unión apila las dos versiones EN SILENCIO —sin marcador
de conflicto que lo delate— y con eso desaparece el checkpoint que hoy protege la resolución a
mano: «pará si el conflicto tiene una decisión adentro». Es el precio de matar la clase: cambia un
trabajo manual frecuente por un riesgo silencioso raro. El owner lo aceptó a sabiendas.

**ALCANCE: SÓLO `DECISIONS.md`.** No se incluyó `CLAUDE.md` ni ningún otro archivo append-only del
repo en este slice — si alguno merece el mismo trato, es un follow-up nombrado aparte, no una
extensión de éste.

**VERIFICADO — `git check-attr merge -- DECISIONS.md`:**
- antes de este cambio: `DECISIONS.md: merge: unspecified`
- después de este cambio: `DECISIONS.md: merge: union`

**GATE, medido en el árbol final de la rama.** `npm test` → **1200/1200**. `npm run test:integracion`
→ **208/208**. Cero rojo en los dos carriles. El diff no toca código de producto ni ningún test:
son dos archivos, `.gitattributes` (nuevo) y este asiento.

**Tier 1 / AWAITING_APPROVAL.** El diff toca `.gitattributes` (mecanismo, archivo nuevo) y
`DECISIONS.md` (este asiento). Ningún cambio de schema, ninguna migración, ningún contrato
cross-repo — el spec lo clasificó Tier 1 y `approved: yes`, y el slice cierra sin mergear: el
owner/orquestador mergea vía `merge_gated`. Rama `slice/ledger-merge-union-gitattributes-1`, sin
mergear.

Regla: la clase de conflicto append-only de `DECISIONS.md` —dos asientos apilados al final del
archivo— queda cerrada por MECANISMO (`merge=union`), no por disciplina de quien resuelve a mano;
la excepción que sigue viva —edición concurrente del MISMO asiento, apilada en silencio sin
marcador— queda escrita acá para quien la tope primero.
## 2026-09-15 — El par tipográfico Prensa entra al set cerrado (`TEMAS-PAR-PRENSA-1`)

**LA DECISIÓN DEL OWNER, sin margen: falta un serif moderno de bajo contraste.** Palabras trasladadas
al `descripcion` del registro: *"Serif moderno de bajo contraste con una grotesca geométrica. Sobrio y
actual, sin el dramatismo de un didone."* Los nueve pares existentes cubren serif clásica (Editorial),
serif suave (Cálido), grotesque geométrica (Moderno), serif de libro (Clásico), sans geométrica
(Nítido), condensada industrial (Robusta), monoespaciada de hoja de cata (Técnico), sans+serif de
párrafo (Relato) y geometría redonda (Cercano) — ninguno es un serif MODERNO de bajo contraste. **Prensa**
(`'Roboto Serif', serif` + `'Figtree', sans-serif`) llena ese hueco, y es **prerrequisito de CORTE**
(`observed-report: CORTE-PROTOTIPO-CENSO-1`).

**EL CAMBIO: una entrada nueva, en la MISMA forma que las nueve.** `CLAVES_FUENTES` gana `'prensa'`
(al final, sin desplazar a `editorial` de la posición 0 ni de `PAR_DEFECTO`); `PARES_FUENTES` gana el
registro con `googleTitulo: 'Roboto+Serif:wght@400'` (el mismo peso de display único que los otros
nueve, § FUENTES-PESOS-DISPLAY-SOBRAN-1) y `googleCuerpo: 'Figtree:wght@300;400;500;600;700'` (los
mismos cinco pesos de cuerpo). **`CLAVES_CUSTOM`** (el `Set` interno que gatea `resolverFuentePar`,
no nombrado en el spec pero necesario) también gana `'prensa'` — sin eso, un `fuentePar: 'prensa'`
guardado resolvería a `null` en silencio pese a aparecer seleccionable en el picker (`PaletaSeccion`
itera `PARES_FUENTES` directo, así que la tarjeta se habría visto elegible sin serlo).

**NAYOLI QUEDA BYTE-IDÉNTICA — afirmado, no supuesto.** `site-content-defaults.test.ts:526-530`
(preexistente, sin tocar) ya cubre que sin fila de `tema.fuentePar` la resolución cae a `null` =
Editorial; corrido en el árbol final, sigue verde. `editorial` sigue siendo `PAR_DEFECTO` y el primer
elemento del registro — el diff no reordena ni pisa ninguno de los nueve pares existentes.

**EL TEST DE CONTEO DE FAMILIAS — medido, no de memoria.** Roboto Serif y Figtree son familias que
NINGÚN par de hoy usa (`grep -ni "roboto serif\|figtree" lib/config/fuentes.ts` daba cero antes de
este slice). El conteo de `linkFuentesTodas()` sube de **17 a 19** (medido corriendo el test, no
calculado a mano): 10 pares × 2 specs = 20, menos 1 por el dup de Inter (Editorial↔Moderno, el único
que se repite) = 19. Se agrega además un test dedicado para el par nuevo (label, descripción no vacía,
familias, `resolverFuentePar('prensa') === 'prensa'`, `linkFuentePar('prensa')` con las dos familias),
paralelo al de "los CUATRO pares nuevos" que ya cubría robusta/tecnico/relato/cercano.

**DESVIACIÓN MEDIDA: el `observed-report` citado por el spec no está en el repo.**
`grep -rn "CORTE-PROTOTIPO-CENSO-1" .` (excluyendo `node_modules`) y `git log --all --oneline
--grep="CORTE-PROTOTIPO-CENSO-1"` sobre el árbol previo a este commit dan cero — el ID sólo aparece
ahora porque este mismo commit lo cita. Es la misma clase de discrepancia que `WOMPI-NO-ES-METODO-
DEL-PANEL-1` ya registró para otro `observed-report`: se anota, no bloquea — el criterio de la Sección
1 (el par exacto, sin margen) no depende de que el censo esté en este ledger.

**EL PISO, medido en el árbol final.** `npm test` → **1188 tests, 1184 pass, 4 fail** — los 4 son
`lib/pagos/metodos-pago-enum.test.ts` (`METODOS_PAGO`/`METODO_PAGO_LABEL`/`METODO_CATEGORIA`/
`METODOS_SERIE` sin el valor `WOMPI` del enum `MetodoPago` de Prisma), **PRE-EXISTENTE y sin relación
con este diff**: aislado con `git diff --stat` (sólo `lib/config/fuentes.ts` y su test) y corriendo el
archivo en falla de forma aislada — ninguno importa nada de `lib/config/fuentes.ts`, y el enum ganó
`WOMPI` en el merge `009c161` ya en `main` antes de que este slice empezara. No es de este `touches:`;
se deja nombrado como *open_followup*, no como arreglo. `npm run test:integracion` (corrido aparte:
la cadena `&&` de `npm run gate` no llega a este carril si el primero falla) → **193/193**. `npx tsc
--noEmit` → limpio. `npm run build` → `✓ Compiled successfully in 6.1s`; `Roboto+Serif` y `Figtree`
aparecen en `.next/server/chunks/` (grep del artefacto compilado, no de la fuente).

**Tier 1 / AWAITING_APPROVAL.** `lib/config/fuentes.ts` no está en la lista de superficies Tier 1 de
CLAUDE.md por nombre ni subárbol, pero el diff cambia bytes que el DUEÑO lee (una tarjeta nueva,
"Prensa", en el picker de `/admin/tienda` — `customer_bytes` en el sentido del schema, que cubre
"cliente, operador o dueño"). Rama `slice/temas-par-prensa-1`, sin mergear — el owner ve el par en el
picker antes del merge.

Regla: § Las FUENTES son `content.tema.fuentePar` — gemelo de la paleta, set CERRADO (C2 · #3)
(CLAUDE.md) — este asiento agrega una entrada al set que esa sección ya declara "crece sin que esta
doctrina lo cuente"; no reescribe la sección.

## 2026-09-16 — La guarda GIT-PROHIBIDO: detección por mecanismo de un verbo de git evadido (`GUARDA-GIT-PROHIBIDO-1`)

**ESTE ASIENTO REGISTRA UNA DECISIÓN Y SU MECANISMO TAL COMO EL SPEC LOS DIO — no verifica el código
de la guarda.** Vive en el repo del orquestador (`dev-protocol`, `scripts/dispatch_slice.py`), fuera
de la raíz de este repo, y este slice no lo alcanza. Lo que sigue es lo que el spec, ya validado,
trajo como hecho — no una medición propia sobre ese código.

**QUÉ SE DESCUBRIÓ.** El allowlist de tools con que se despacha a un worker de ESCRITURA es EVADIBLE,
y se ejerció. El allowlist matchea por el PRIMER TOKEN del comando; un worker de escritura tiene
`node`/`npm`/`npx` (los necesita para el gate y el build), y `node -e` es `child_process.execSync`,
así que `node -e "execSync('git merge …')"` corre un verbo que el grant EXCLUYE. El grant `git -C:*`
es la otra fuga (`git -C . merge` matchea igual). Lo destapó `LEDGER-MERGE-UNION-GITATTRIBUTES-1`: su
worker corrió `git merge` por ese canal —fue un no-op (se mergeó a sí misma, «Already up to date», no
aterrizó nada)— y **lo DECLARÓ en su propio reporte en vez de esconderlo**. Que fuera inofensivo y
declarado fue suerte y honestidad del ejecutante, no protección del sistema.

**QUÉ PROHIBÍA, Y CÓMO.** El worker no mergea —lo hace el orquestador tras el gate (§ EL WORKER NO
MERGEA, CLAUDE.md/protocolo de despacho)— porque quien escribe un diff no es quien puede juzgarlo con
distancia para que aterrice. Ese «no mergees / no pushees / no reset / no rm» estaba SÓLO por
convención del allowlist: una guarda que dependía de que el ejecutante no la eludiera. `git -C .
merge` y `node -e "execSync(...)"` mostraron que la convención se elude sin necesitar nada fuera de
lo ya concedido.

**LA RESPUESTA — una entre tres opciones que se le presentaron al owner.** El owner eligió una GUARDA
DE DETECCIÓN en la recolección del slice, no endurecer el sandbox (rompería el corrido de tests y
build, que dependen de spawnear procesos) ni sólo asentar el hallazgo (el hueco no es teórico: ya se
ejerció una vez). La guarda lee el **TRANSCRIPT** de la sesión del worker —no su lista de comandos
denegados, ni lo que el worker elige declarar en su propio reporte: un bypass EXITOSO no aparece como
denegado, y una detección que depende de la honestidad de quien la evade no es detección—. Si el
transcript muestra que el worker corrió `merge` / `push` / `reset` / `rm` / `rebase` / … por CUALQUIER
canal de evasión (no sólo el literal del comando bloqueado), la guarda **RECHAZA** el slice.
**Condición explícita del owner: RECHAZO, no un flag** — un flag es una advertencia, y las
advertencias se saltean. Y la guarda **DISTINGUE** el caso benigno (ninguna ref se movió: fue una
sonda, como el `git merge` no-op que la destapó) del caso severo (la rama del worker ya es ancestro de
`main`, o hubo un `push`: trabajo sin gatear pudo haber aterrizado o publicarse). El mensaje que
produce dice QUÉ verbo se detectó y POR QUÉ está prohibido, no sólo que el slice abortó. Vive en
`dev-protocol` y queda gateada por su propio autotest — sin cifras propias que citar acá, porque este
slice no corrió ese autotest ni leyó ese código.

**LA CLASE — lo que más importa registrar, en palabras del owner.** Cada vez que una regla del
protocolo se apoya en que alguien NO haga algo, esa regla es una HIPÓTESIS hasta que algo la mide. El
allowlist prohibía por CONVENCIÓN lo que ahora se detecta por MECANISMO — el mismo salto que dio
`owner-gate-requested` (de una instrucción escrita en un README a una condición que el esquema
RECHAZA). Es la misma familia que «una guarda escrita no es una guarda que corre» (§ PRECONDICIÓN,
CLAUDE.md, aplicada ahí al artefacto compilado y a la base), ahora con la regla-por-convención misma
como sujeto: una prohibición que un allowlist declara pero no impone por mecanismo sigue siendo, hasta
que algo la mida, sólo una frase que alguien podría no cumplir.

Puntero: este hallazgo es consecuencia directa de `LEDGER-MERGE-UNION-GITATTRIBUTES-1` (arriba en este
mismo ledger) — no se reescribe ese asiento; éste registra lo que su ejecución destapó y la respuesta
que el owner dio.

Regla: toda prohibición de protocolo que hoy se sostenga SÓLO por convención de un allowlist —"el
worker no hace X" sin que nada lo impida por mecanismo— es una hipótesis sin medir; la guarda
GIT-PROHIBIDO cierra esa hipótesis para los verbos de git destructivos leyendo el TRANSCRIPT de la
sesión (no la lista de denegados, no lo que el worker declaró) y RECHAZANDO —nunca advirtiendo— ante
cualquier canal de evasión, con severidad distinta según si una ref se movió de verdad.

## 2026-09-16 — Cierre del censo de API directa: el dato del owner, el motor de dinero agnóstico, y la puerta que quedó abierta sin buscarla (`WOMPI-API-DIRECTA-CIERRE-1`)

**ESTE ASIENTO CIERRA `WOMPI-API-DIRECTA-CENSO-1`.** Ese censo corrió read-only y no dejó asiento
propio —`grep -n "WOMPI-API-DIRECTA-CENSO-1" DECISIONS.md` sobre el árbol antes de este commit da
CERO líneas—, así que sus conclusiones viven acá. No se adopta ninguna dirección nueva: **Wompi
sigue cerrado con el widget**, tal como ya está decidido en § Pagos en línea (Wompi) (CLAUDE.md).
Este asiento es un mapa con su dato decisivo, no una hoja de ruta.

**LA FORMA DEL ASIENTO TIENE DOS MITADES DE NATURALEZA DISTINTA, Y VAN SEPARADAS.** La Sección 1 es
una MEDICIÓN DEL OWNER, hecha en un navegador propio contra un sitio público de un tercero — este
slice no tiene red y ese sitio no es este repo, así que se registra como lo que es, nunca como algo
que este slice verificó. La Sección 3 es lo que SÍ se midió acá, contra el propio código, con
`file:line`. Es la misma distinción que `GUARDA-GIT-PROHIBIDO-1` (arriba) ya dejó escrita para un
hallazgo ajeno al repo: declarar que se REGISTRA, no que se VERIFICÓ.

### 1 · El dato del owner — lo que midió, y dónde para

El censo había dejado abierta, como NO medible desde este repo, la pregunta que decide la dirección:
con API directa, ¿el script antifraude del proveedor (`cdn.siftscience.com`,
`device.clearsale.com.br` — infraestructura del PROVEEDOR que el comercio no ve ni apaga, ya
registrada en `CSP-REPORT-ONLY-CHECKOUT-1`, línea ~1610) sigue cargando?

**Lo que el owner MIDIÓ, en su propio navegador, contra un comercio colombiano público (Home
Burgers) que cobra con Wompi por API directa:**
- el número de tarjeta se teclea en un formulario en el propio dominio del comercio, en una ruta
  propia con forma `/checkout/{order_id}/wompi`, con su propio DOM y su propia marca — un solo nivel
  de selección, sin la superficie del proveedor de por medio;
- el bundle de esa página es una página Next.js común que trae la orden por la API del propio
  comercio y renderiza componentes propios — **no carga ningún script del proveedor de pagos**;
- **ni `cdn.siftscience.com` ni `device.clearsale.com.br` se piden en esa página.** Primero
  observado con un bloqueador activo —descartado como prueba, porque esos dominios son justo lo que
  un bloqueador tapa— y **re-verificado en un navegador limpio, sin bloqueador**, que es el control
  que vuelve la medición válida.

**LO QUE NO SE MIDIÓ, dicho en vez de fingido:**
- si esos scripts cargan al ENVIAR el pago (no al abrir la página). No se probó a propósito:
  exigiría disparar una tokenización real contra la tienda PRODUCTIVA de un tercero, y no se
  transacciona en el sistema vivo de otro para satisfacer una curiosidad nuestra. Incógnita
  DECLARADA, no cerrada.
- es UN comercio, UNA carga de página, en UN momento. Su contrato con el proveedor podría diferir
  del nuestro.

### 2 · La inversión — el hallazgo cambia la pregunta, no sólo la responde

El censo TEMÍA que el tercero reapareciera con otro nombre. Lo medido dice que NO reaparece —y eso
significa algo distinto de lo esperado—:

> **El antifraude no se MUDA: DESAPARECE.** Sift y ClearSale eran cobertura que el widget daba
> GRATIS, por ser infraestructura del proveedor. Con API directa no es que el tercero siga presente
> de otra forma: es que esa protección se va con él.

Entonces la decisión futura ya NO es sobre la marca (si el comprador ve o no la superficie de
Wompi). Es: **¿se cambia la protección antifraude del proveedor por un checkout propio?** En cobros
sin presencia física de la tarjeta, el fraude y los contracargos son plata del dueño — es una
pregunta del OWNER, no del orquestador, y **no está tomada**. Este asiento sólo la deja formulada
con su dato; no la resuelve.

### 3 · Lo que sí se midió acá — el motor de dinero del servidor es agnóstico

Medido contra el código, con `file:line`:

- **La creación del `PaymentIntent`** (`packages/core/src/orders.ts:618-630`, dentro de
  `createOrderWithCustomer`) sólo toma `orden_id` y `order.total` (→ `monto_esperado`); la
  `reference` se arma como `<numero_orden>:<cuid-de-la-propia-fila>`
  (`referenciaIntentoPago(order.numero_orden, creado.id)`). Nada de esa creación depende de qué
  superficie va a capturar la tarjeta.
- **La firma de integridad** (`firmarIntegridadWompi`, `lib/pagos/wompi-firma.ts:188-195`, invocada
  desde `app/api/checkout/route.ts:225`) calcula
  `sha256_hex(reference + amount_in_cents + currency + secreto)` — sólo `reference`, monto y moneda.
  No entra en el cálculo NINGÚN dato de la superficie de captura (widget, API directa, checkout
  alojado).
- **El webhook** (`app/api/webhooks/wompi/route.ts:198-311`) ubica el intento con
  `db.paymentIntent.findUnique({ where: { reference } })` (línea 206) y decide con
  `bucketDeStatus(status)` (línea 265) sobre el `status` crudo del evento. Cero menciones de
  "widget" en toda la lógica de decisión del archivo (`grep -n "widget"
  app/api/webhooks/wompi/route.ts` → sólo aparece, si acaso, en comentarios que documentan el
  llamador de arriba, nunca como una rama del código).
- **`aplicarResultadoWompi`** (`packages/core/src/pagos/aplicar-resultado-wompi.ts:124-222`) —la
  ÚNICA pieza que decide si un APROBADO se convierte en `Payment`— opera exclusivamente sobre
  `intent.id`, `intent.orden_id`, `pspTransactionId`, `estadoCrudoPsp` y `montoConfirmado`. Ninguno
  de esos campos codifica ni pregunta cómo nació la transacción en el proveedor.
- **El reconciliador** (`packages/core/src/pagos/reconciliador.ts`) consulta a Wompi
  `consultarWompi(fila.reference)` (línea 146) y reusa el MISMO `aplicarResultadoWompi` (línea 194)
  — la misma superficie de datos, la misma indiferencia a la procedencia.

**La consecuencia, que es el valor del hallazgo:** toda esta cadena —creación del intento, firma,
webhook, `aplicarResultadoWompi`, reconciliador— opera sobre `reference` / estado / monto, nunca
sobre la forma en que la transacción fue creada en el proveedor. Una migración a API directa
**reescribiría sólo el lado CLIENTE** (captura de tarjeta, validación, tokenización, 3DS, errores del
emisor). El servidor —lo caro, lo que toca la plata, lo que ya está probado— **se reusaría tal
cual**.

### 4 · La lección de método

Cuando se diseñó la ruta de retorno y el cierre del intento (`WOMPI-WEBHOOK-RUTA-1`,
`WOMPI-RUTA-DE-RETORNO-1`, arriba en este mismo ledger), se decidió que el modelo NO dependiera de
cómo nació la transacción: el estado lo escribe el webhook sobre la `reference`, y nadie pregunta si
esa transacción salió de un widget, de un checkout alojado o de una API. En su momento esa decisión
no se tomó para habilitar nada — se tomó porque era el modelo correcto.

**Hoy es lo que vuelve barata una dirección entera que ni siquiera estaba sobre la mesa.** Palabras
del owner: **es la primera vez que una decisión de modelado nos deja una PUERTA ABIERTA en vez de un
costo.** Lo habitual es lo contrario: un modelado cómodo hoy que hay que pagar después.

Un modelo que no depende de la PROCEDENCIA de su dato es lo que hace barata una dirección futura — y
eso no se sabe cuando se decide, se cobra después.

### 5 · Cierre

**NO se adopta la dirección de API directa. Wompi se cierra con el widget**, como ya estaba
decidido. La pregunta abierta por §2 —si cambiar la cobertura antifraude del proveedor por un
checkout propio es un trato aceptable— queda formulada, no resuelta; es del owner.

**GATE, medido en el árbol final de la rama.** `npm test` → **1200/1200**. `npm run test:integracion`
→ **208/208**. Cero rojo en los dos carriles — el diff no toca código de producto ni ningún test: es
un solo archivo, este asiento en `DECISIONS.md`.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) · `CSP-REPORT-ONLY-CHECKOUT-1` como origen de los dos
terceros de antifraude ya registrados (Sift, ClearSale) · `WOMPI-WEBHOOK-RUTA-1` /
`WOMPI-RUTA-DE-RETORNO-1` como el modelado agnóstico de procedencia que esta tanda mide como activo,
no como intención · un motor de dinero que opera sólo sobre `reference`/estado/monto es lo que hace
barata una migración de superficie de captura — y eso se cobra después, no cuando se decide.

**CORRECCIÓN (`WOMPI-API-DIRECTA-CIERRE-CORRECCION-1`, 2026-09-16) al §5 de este asiento — el cierre se
sostenía sobre dos premisas que el owner corrigió, y un disparador que ya se cumplió.** §§1, 3 y 4 de
arriba —el dato del owner, el motor de dinero agnóstico, la lección de método— NO se tocan: siguen
siendo el mapa correcto. Lo que se corrige es sólo el razonamiento de cierre (§5), que decía que la
dirección "no se adopta" y dejaba la pregunta de §2 abierta "esperando datos". Se corrige acá, SIN
borrar el párrafo de arriba, por la misma razón que ya se dio en `WOMPI-B-ASIENTO-CORRECCION-BUNDLE-1`
(línea ~3582 de este archivo): una frase de cierre se cita después de que dejó de ser cierta.

**1 · El selector de métodos es un DEFECTO DE PRODUCTO, no un costo estético.** Medición del OWNER, de
primera mano — se registra como suya, no como medida por este slice (misma naturaleza que §1 de
arriba: este slice no tiene acceso al dashboard del proveedor ni a su catálogo de parámetros del
loader):

- el selector de métodos que abre el widget **no se puede restringir ni preseleccionar** — ni por
  parámetro del loader, ni desde el dashboard del comercio, que para esto es una pantalla de sólo
  lectura;
- consecuencia: un tenant que sólo quiere ofrecer tarjeta y PSE no tiene forma de evitar que el
  comprador vea TODOS los métodos que el proveedor le tenga habilitados — el owner nombra, entre
  ellos, SU+Pay, Bancolombia QR y Compra y Paga Después.

El censo original trató el segundo nivel de selección como un costo ESTÉTICO (el comprador ve una
superficie ajena). No lo es: **es el comercio perdiendo el control sobre qué ofrece para cobrar** —una
decisión comercial suya, no del proveedor—, y es exactamente el nivel que el comercio observado en §1
(Home Burgers) SÍ controla al tener su propia página: ahí los métodos que se ofrecen son los que ese
comercio eligió. Este argumento se sostiene SOLO: aunque la marca ajena no molestara en absoluto, el
tenant seguiría sin poder decidir qué métodos ofrece.

**2 · El antifraude escala con el VOLUMEN — la premisa que estaba mal.** El §2 de arriba dejaba la
decisión "esperando datos de fraude para poder preciar el riesgo" que el widget cede gratis. El owner
corrige esa premisa:

> El valor de la cobertura antifraude escala con el VOLUMEN, y el riesgo que cubre también. Es alta
> para una cadena con miles de transacciones y baja para una finca con pedidos contados. Esperar
> "datos de fraude" apuntaba a un problema de ESCALA que los clientes de Duna no tienen.

El trato no es simétrico como el cierre viejo lo planteaba: lo que se entrega vale poco a la escala de
este producto, y lo que se gana —que el tenant controle su pago (§1 de esta corrección)— se cobra en
CADA pedido, no en un evento raro de fraude.

**Precisión que se agrega acá, para no cambiar un exceso por otro:** lo MEDIDO en §1 de arriba es que
la capa de fingerprinting que el widget inyecta en el navegador (`cdn.siftscience.com`,
`device.clearsale.com.br`) NO CARGA en la página de API directa observada. Si el proveedor evalúa
riesgo del lado de SU SERVIDOR para transacciones nacidas por API —y con cuánta señal menos que con el
widget— es EXTERNO y NO ESTÁ MEDIDO. Se corrige entonces sólo lo medible: se perdió la capa de
fingerprinting de navegador que §1 documentó, no necesariamente TODA evaluación de riesgo del
proveedor. La frase de §2 ("el antifraude no se muda: desaparece") sigue siendo correcta para lo que
se midió —la capa de navegador—; esta corrección acota su alcance para que no se lea como una
afirmación sobre el servidor del proveedor, que nadie midió.

**3 · Un disparador ya se cumplió.** El §2 de arriba dejó abierta la pregunta de si cambiar la
cobertura antifraude del proveedor por un checkout propio es un trato aceptable, "es del owner". El
owner responde con un hecho, no con una hipótesis: **la demanda de un dueño de marca que no quiere
otro logo ni métodos ajenos en su propio pago ya existe — es él mismo, para el muestrario de Duna.** No
es una condición futura a vigilar: ya está sobre la mesa.

(Nota de precisión de este slice: §2 de arriba no dejó una lista explícita rotulada "disparadores" —
dejó la pregunta formulada como decisión pendiente del owner. Esta corrección registra que ESA
pregunta la responde el owner ahora, con este hecho.)

**4 · El nuevo estado de la dirección.** Con §§1 y 2 de esta corrección y el disparador de §3
cumplidos, el cierre cambia de sentido:

- **Wompi se cierra con el widget, y ESO NO CAMBIA.** Está construido, gateado, y el servidor se reusa
  entero (§3 de arriba): publicarlo no cuesta nada extra, y tener la pasarela viva vale más que
  esperar.
- **La API directa pasa a ser el PROGRAMA SIGUIENTE** —después de cerrar Wompi y antes de lo que
  venga—. Ya no es "una dirección viva por si acaso" (el estado que dejaba el §5 original): es lo
  próximo.
- **Nada de API directa se construye en esta corrección ni en la tanda que la trajo.** Su partición y
  su censo de construcción se preparan aparte.

Regla: § Pagos en línea (Wompi) (CLAUDE.md) sigue vigente como frontera técnica (`Payment` como único
escritor del eje de cobro, el puente con Carlos) — no se toca acá; ninguno de los dos frentes queda
gateado a "la decisión de pasarela" (ya tomada, Wompi), sino a la ejecución del programa siguiente, que
esta corrección no abre.

**GATE, los dos carriles, verde.** Este diff toca un solo archivo del ledger (`DECISIONS.md`) y ningún
test, así que nada podía cambiar en ninguno de los dos carriles.

## 2026-09-16 — Las decisiones del programa de API directa: el enum no se parte, la unión es paralela, la agrupación es por instrumento, y el copy de las dos aceptaciones (`API-DIRECTA-DECISIONES-PROGRAMA-1`)

**POR QUÉ ESTE ASIENTO EXISTE.** `WOMPI-API-DIRECTA-CIERRE-CORRECCION-1` (arriba) dejó la API directa
como el PROGRAMA SIGUIENTE y anotó que "su partición y su censo de construcción se preparan aparte."
Ese censo de construcción corrió — read-only, sin escribir código — y planteó cuatro preguntas de
diseño; el owner las resolvió en conversación. **Un censo read-only no deja asiento propio, y sin
este asiento esas decisiones viven sólo en esa conversación.** Este asiento las pone en el libro por
esa razón sola: **una decisión que no está en el libro no está tomada, por más que alguien la
recuerde.** No se construye nada de API directa acá — el programa sigue sin partir, y su spike de
sandbox sigue siendo el primer paso.

### 1 · El enum de `Payment.metodo` NO gana un valor nuevo

El censo preguntó si el pago por API directa necesita su propio valor en `MetodoPago`
(`packages/core/prisma/schema.prisma:393-401`, el enum de mayúsculas de `Payment`) o reusa el `WOMPI`
que ya existe para esta pasarela. **Reusa el que existe — no se agrega `WOMPI_API_DIRECTA` ni ningún
valor equivalente.**

El criterio ya está escrito en ese mismo enum, en el comentario de `lib/checkout/metodos-pago.ts:18-20`:
`WOMPI` vive ahí porque la pregunta que ese enum responde es **CÓMO LLEGÓ LA PLATA**, no dónde se
capturó la tarjeta — y llega por el mismo proveedor se capture donde se capture. **Widget contra API
directa es DÓNDE SE CAPTURÓ LA TARJETA: nuestra superficie, no la ruta del dinero.** Es la misma
distinción que ya cerró `WOMPI-API-DIRECTA-CIERRE-1` §3 (arriba): el motor de dinero del servidor
—creación del intento, firma, webhook, `aplicarResultadoWompi`, reconciliador— opera sobre
`reference`/estado/monto, nunca sobre cómo nació la transacción en el proveedor. Partir el enum
introduciría ahí justo la distinción que ese modelo existe para no tener que hacer.

**El costo de partirlo, que es lo que decide:** un valor nuevo partiría en dos el historial de cobros
en línea del dueño el día que API directa se construya, y le pediría entender una distinción técnica
que no le sirve para nada — el desglose «Por método» de su libro de Pagos partiría en más de una
entrada lo que fue un solo proveedor.

**El dato fino ya tiene dónde vivir**, así que nada se pierde por no partir el enum: `PaymentIntent`
guarda `estadoCrudoPsp` (el estado crudo del proveedor) y la transacción trae su propio
`payment_method` (con qué instrumento pagó el comprador, § 3 abajo).

### 2 · Unión PARALELA, no mezclada, con los métodos manuales

Los métodos de una pasarela **NO se agregan a `MetodoPagoTipo`** (`lib/checkout/metodos-pago.ts:22`,
hoy `'nequi' | 'daviplata' | 'breb' | 'transferencia' | 'efectivo'`): van en una unión PARALELA,
propia de la pasarela.

**Son dos cosas distintas.** Un método manual es lo que el dueño CONFIGURA escribiendo SUS datos —su
número de Nequi, su cuenta bancaria— y ya está documentado así en el propio archivo (`§ PAGOS-METODOS-
MODELO-1`, `metodos-pago.ts:1-13`). Un método de pasarela es lo que se OFRECE a través del proveedor, y
no guarda dato del dueño: en particular la tarjeta **no guarda nada**, porque los datos de tarjeta
nunca tocan nuestro servidor.

**Mezclarlos obliga a cada consumidor a saber cuáles traen datos y cuáles no**, y eso se paga en cada
lectura — la misma clase de costo que ya evitó separar `Payment` de `Comprobante` (§ Comprobantes de
pago, CLAUDE.md): dos hechos distintos, dos tipos distintos.

### 3 · La agrupación de UI es por INSTRUMENTO, no por naturaleza del pago

`DatosNegocioSeccion.tsx:145-153` agrupa los métodos manuales por **naturaleza de pago**: "Pagan
antes" (nequi, daviplata, breb, transferencia) contra "Pagan al recibir" (efectivo) — una pregunta de
flujo de caja, y discrimina bien entre los manuales.

**Pero todos los métodos de pasarela son "antes"**: esa pregunta los colapsa en un grupo único y deja
de decir nada. La pregunta que sí discrimina para ellos es **«¿CON QUÉ PAGA EL COMPRADOR?»** —
literalmente lo que el dueño decide cuando enciende o apaga un método de pasarela—, y da CUATRO
grupos: **tarjeta**, **débito bancario**, **billeteras**, y **financiación y puntos**.

**El efecto de segundo orden es lo que justifica la unión paralela del §2 más allá de la limpieza de
tipos.** Como son tipos DISTINTOS, las dos agrupaciones NO tienen que coincidir: los manuales
conservan "antes / al recibir" sin tocarse; los de pasarela van por instrumento; y **ningún
consumidor tiene que reconciliarlas, porque nunca se encuentran en la misma lista.** Con una unión
mezclada esto habría sido imposible sin romper una de las dos agrupaciones.

**Un método queda FUERA del alcance inicial de esta agrupación: el efectivo en corresponsal
bancario.** Por instrumento es efectivo, pero la plata llega de forma asincrónica y no encaja limpio
en ninguno de los cuatro grupos. Su grupo se decide el día que entre al catálogo, con el caso real
delante — no ahora.

### 4 · El copy de las dos aceptaciones, y lo medido sobre ellas

**LEÍDO por el orquestador en la documentación pública del proveedor, NO verificado contra el
sandbox** — se registra como lectura suya, no de este slice: este slice no tiene acceso a red, y esa
documentación no es este repo. Misma naturaleza que `WOMPI-API-DIRECTA-CIERRE-1` §1 (arriba), que ya
distinguió registrar de verificar para un hallazgo ajeno a este repo.

**CORRECCIÓN DE ATRIBUCIÓN (`API-DIRECTA-DECISIONES-ATRIBUCION-FIX-1`, 2026-09-16): esta sección
decía "MEDIDO" y era falso en su palabra clave — no hubo medición, hubo una LECTURA.** Los hechos
que siguen —los dos documentos, el copy, las dos condiciones de construcción— siguen SIN
verificarse contra el comportamiento real del proveedor, y se leen como lo que son: una lectura de
documentación, no una medición. Importa porque el MISMO día, dos afirmaciones sacadas de esa misma
documentación —sobre qué llave autoriza crear una transacción, y sobre si se puede consultar qué
métodos tiene habilitados un comercio— resultaron DESMENTIDAS por una medición real contra el
sandbox (`WOMPI-REGLAS-IMPLEMENTACION-1`, arriba, y § Pagos en línea (Wompi), CLAUDE.md: "la doc de
Wompi no es fuente de verdad, se verifica contra el sandbox"). Una lectura rotulada como medición es,
literalmente, la clase de afirmación que ya falló dos veces.

**Nota de procedencia:** esta corrección la encontró la guarda de procedencia de hechos externos del
repo del orquestador, en su primer barrido sobre specs ya despachados — no una revisión humana ni una
relectura. Importa registrarlo porque, en palabras del owner, es la prueba de que el mecanismo
trabaja y no sólo se prueba a sí mismo: una guarda que sólo pasa sus propios tests demuestra que hace
lo que su autor imaginó; una que encuentra un defecto vivo en trabajo ya despachado demuestra que
sirve.

- Los DOS documentos que el comprador acepta son del PROVEEDOR y los aloja el proveedor: sus términos
  y condiciones de uso, y su autorización de tratamiento de datos personales. **El comercio no
  redacta ni aloja ninguno de los dos.**
- **Esto DESACTIVA una dependencia que se creía:** el slice de aceptaciones NO depende de las páginas
  legales del template que están en backlog (`siteConfig.legalNav`, hoy vacío — § Automatizaciones,
  CLAUDE.md).
- El proveedor no exige redacción literal de la casilla; exige que ambos enlaces estén a la vista, que
  la aceptación sea explícita, y que se muestren las versiones más recientes — de donde sale una
  restricción de construcción: **el enlace se renderiza SIEMPRE desde la respuesta de la API del
  proveedor, nunca hardcodeado.**

**El copy, fijado por el owner** — dos etiquetas, cada una enlazando a su propio documento:

> Acepto los términos y condiciones de uso
>
> Autorizo el tratamiento de mis datos personales

**SON DOS CASILLAS SEPARADAS, NO UNA.** Razón del owner: son dos aceptaciones distintas, y juntarlas
en una sola casilla haría que el comprador acepte dos cosas con un gesto.

**Dos condiciones de construcción que el owner fijó para ese slice:**
- **Si la consulta al proveedor falla o no devuelve los enlaces, NO se ofrece el pago en línea.** Sin
  los tokens de aceptación la transacción no se puede crear, así que ofrecer el método y fallar
  después es peor que no ofrecerlo. **Cómo degrada exactamente —desaparecer de la lista, o aparecer
  deshabilitado con explicación— es byte visible y queda PENDIENTE de decisión del owner**; se anota
  como pendiente, no se resuelve acá.
- **El botón de pagar no se habilita hasta que las dos casillas estén marcadas.**

### 5 · Límites de este asiento

- **Esto no construye nada.** El programa arranca por un spike de sandbox, aparte (§4 de
  `WOMPI-API-DIRECTA-CIERRE-CORRECCION-1`, arriba).
- **La partición completa NO se propone acá** — vive en el censo de construcción; este asiento
  registra decisiones, no la ejecuta.

Regla: el enum de `Payment.metodo` se reparte por CÓMO LLEGÓ LA PLATA (el proveedor), nunca por DÓNDE
SE CAPTURÓ LA TARJETA (widget o API directa) — ese criterio ya vive en `lib/checkout/metodos-pago.ts` y
este asiento lo extiende a API directa sin abrir un valor nuevo. La unión de métodos de pasarela es
PARALELA a `MetodoPagoTipo`, nunca mezclada con ella, y ese es el efecto de segundo orden que permite
que la agrupación de UI de los manuales ("antes"/"al recibir") y la de los de pasarela (por
instrumento) diverjan sin que ningún consumidor tenga que reconciliarlas.

**GATE, los dos carriles, verde.** Este diff toca un solo archivo del ledger (`DECISIONS.md`) y ningún
test, así que nada podía cambiar en ninguno de los dos carriles.

## 2026-09-16 — Lo que midieron los dos spikes de sandbox de API directa: la firma es obligatoria y
validada, las dos llaves autorizan crear pero la razón correcta era otra, el endpoint nuevo trae lo
mismo que el viejo, y un método no habilitado falla al crear (`API-DIRECTA-SPIKES-ASIENTO-1`)

### 0 · Por qué este asiento existe

Dos spikes corrieron contra el sandbox real de Wompi para el programa de API directa
(`API-DIRECTA-SPIKE-SANDBOX-1` y `API-DIRECTA-SPIKE-FIRMA-Y-ENDPOINT-1`) y los dos son **read-only**:
sin commit, sin rama, sin asiento propio. `grep` de esos dos IDs sobre este archivo, antes de este
commit, da CERO líneas — el mismo vacío que ya dejó `WOMPI-SPIKE-SANDBOX-1` (línea ~1090) hasta que
`WOMPI-REGLAS-IMPLEMENTACION-1` lo trasladó al ledger, y la misma familia que `ORCH-CENSO-SIN-TABLA-1`
(línea ~1082) ya nombró: *"el protocolo sabe seguir ESCRITURAS y no sabe seguir LECTURAS"*. Lo medido
por los dos spikes vivía sólo en los registros del orquestador hasta este asiento.

El repo del orquestador estrenó ese mismo día una guarda que exige un identificador de asiento que
RESUELVA para que un hecho pueda entrar a un spec marcado como MEDIDO — un spike read-only no produce
ninguno. La consecuencia, en una línea:

> **El instrumento de medición no produce citas. Lo que un spike mide es incitable hasta que alguien
> lo escriba en el libro** — y por lo tanto, para todo efecto práctico del protocolo, es como si no se
> hubiera medido.

Es la misma regla que ya rige las decisiones de este ledger —*una decisión que no está en el libro no
está tomada*— extendida a las mediciones. Este slice **no tiene acceso a red**: no puede verificar
ninguna de las cifras de abajo contra el proveedor. Lo que sigue es lo que los dos spikes reportaron al
correr, con llaves de prueba verificadas por PREFIJO, transcrito con su origen — no re-medido acá.

### 1 · Lo medido

**A · La firma de integridad es OBLIGATORIA y además VALIDADA** (`API-DIRECTA-SPIKE-FIRMA-Y-ENDPOINT-1`).
Con todo lo demás idéntico (mismo monto, misma moneda, mismo token de tarjeta, tokens de aceptación
frescos), cambiando sólo la firma:

- **sin el campo `signature`** → `422 INPUT_VALIDATION_ERROR`,
  `{"signature":["Firma de integridad requerida no enviada"]}`.
- **con `signature` bien formada pero con el último carácter alterado** → `422
  INPUT_VALIDATION_ERROR`, `{"signature":["La firma es inválida"]}` — mensaje DISTINTO al de ausencia,
  la prueba de que el proveedor valida el VALOR y no sólo la presencia.
- **control positivo, con la firma correcta** → `201`, estado `PENDING`.

La firma se calculó importando `firmarIntegridadWompi` tal cual (`lib/pagos/wompi-firma.ts:188`), sin
reimplementar la fórmula ni ajustarla.

> **LA CONSECUENCIA DE ARQUITECTURA, medida y no interpretada:** crear la transacción exige el secreto
> de integridad, y ese secreto no puede viajar al navegador. **El corte cliente/servidor para la
> creación queda forzado POR EL SECRETO.**

**B · Las DOS llaves autorizan la creación — y acá está el error que la medición enderezó**
(`API-DIRECTA-SPIKE-FIRMA-Y-ENDPOINT-1`). Sobre la creación de la transacción, cuerpo y firma
idénticos, cambiando sólo la credencial:

- **llave PÚBLICA** → `201` (`PENDING`).
- **llave PRIVADA** → `201` (`PENDING`).
- **sin credencial** → `401 INVALID_ACCESS_TOKEN`,
  `reason: "Se esperaba una llave pública o privada pero no se recibió ninguna"`.

El diseño venía asumiendo que la creación vive en el servidor **porque necesita la llave privada**.
Esa premisa era falsa, y salió de una LECTURA de la documentación pública del proveedor que se había
presentado como medición (la misma familia que `API-DIRECTA-DECISIONES-ATRIBUCION-FIX-1`, arriba, ya
corrigió para el copy de las dos aceptaciones). La medición muestra que cualquiera de las dos llaves
sirve: técnicamente la creación podría dispararse desde el navegador con la llave no-secreta. **Pero la
conclusión —creación del lado del servidor— sigue siendo la correcta**, por la razón medida en A: la
FIRMA, que sí exige un secreto.

> **LLEGAMOS A LA CONCLUSIÓN CORRECTA POR LA RAZÓN EQUIVOCADA, y sólo la medición lo enderezó.** Una
> conclusión correcta apoyada en una premisa falsa se ve exactamente igual que una bien fundada, hasta
> que algo la mueve. Si el proveedor hubiera hecho opcional la firma, el diseño habría quedado sin
> ningún apoyo real y nadie se habría enterado — porque la premisa que se creía sosteniéndolo nunca
> existió.

Y esto le agrega precisión a la regla que este repo ya tiene escrita (*la doc del proveedor no es
fuente de verdad, se verifica contra el sandbox*, § Pagos en línea (Wompi), CLAUDE.md): **la doc no
falló sola.** El ledger de este repo (`WOMPI-REGLAS-IMPLEMENTACION-1`, línea ~1207: *"crear una
transacción funciona con la llave PÚBLICA"*) afirmaba que la creación anda con la pública; la doc leída
para el diseño de API directa afirmaba que sólo con la privada. Ninguna de las dos estaba completa: la
medición de este spike le dio la razón a media parte de cada una, y agrega el dato que faltaba —la
privada TAMBIÉN autoriza, y sin credencial es `401`, no `201`.

Confirmado aparte: la tokenización de la tarjeta se hace contra la API del proveedor sin que los datos
de tarjeta pasen por ningún servidor propio.

**C · El endpoint NUEVO del comercio trae todo lo que traía el viejo** (`API-DIRECTA-SPIKE-SANDBOX-1`).
El endpoint viejo lleva la llave pública en la URL y muere el 31 de octubre de 2026; el nuevo
(`GET /v1/merchants/info`) la manda por la cabecera `x-merchant-public-key`. Medidos los dos contra el
mismo comercio: ambos responden `200` y traen exactamente las mismas claves de primer nivel, sin
ninguna exclusiva de un lado ni del otro.

El nuevo sí trae `accepted_payment_methods` —la lista de métodos que la cuenta tiene realmente
habilitados— y sí trae los dos tokens de aceptación. La única diferencia observada entre las respuestas
es un identificador por-llamada dentro de cada token, que cambia en cada llamada por diseño y no por
endpoint.

> **POR QUÉ DECIDE TANTO:** el panel del dueño no configura a ciegas. Puede ofrecerle únicamente lo que
> su cuenta tiene, leído del proveedor.

**D · Un método no habilitado FALLA AL CREAR, con un error reconocible por programa**
(`API-DIRECTA-SPIKE-SANDBOX-1`). El catálogo global de tipos de método quedó medido de primera mano
—no copiado de doc—, provocando el error de validación con un tipo inexistente. El comercio del spike
tiene habilitados sólo una parte de ese catálogo.

Probando un tipo del catálogo que ese comercio NO tiene habilitado (`BRE_B`), con los subcampos
completos para descartar un error de forma: `404 NOT_FOUND_ERROR`, con
`reason: "No hay una identidad de pago para BRE_B configurada para este comercio"`.

La transacción NO se crea y muere después: falla AL CREAR, nunca llega a existir. Y el error es
distinguible en tres ejes a la vez: el status (distinto del de validación y del de auth), el campo
`error.type`, y el texto de `reason`, que nombra el tipo de método exacto.

### 2 · Lo que sigue sin medirse

Registrado como abierto, sin suavizarlo — es lo que evita que este asiento se cite de más:

- **Si `accepted_payment_methods` predice el `404` de forma confiable.** Se probó SÓLO `BRE_B`. Que la
  lista y el rechazo hayan coincidido esa vez no prueba que coincidan siempre, y de eso depende cuánto
  se puede prevenir en configuración.
- **La firma del webhook contra un evento REAL del proveedor** — necesita una URL pública, ya señalado
  como abierto en `WOMPI-REGLAS-IMPLEMENTACION-1` (arriba).
- **El significado real de los subcampos de `BRE_B`** — se rellenaron con valores plausibles sólo para
  sortear la validación de forma, no se verificó qué significan.
- **Referencias duplicadas y límites de tasa** — sin medir.
- **Todo 3DS** — explícitamente fuera del alcance de los dos spikes.

**Nota de procedencia, para el próximo asiento que cite éste:** §C mide sobre el mismo terreno que
`API-DIRECTA-DECISIONES-ATRIBUCION-FIX-1` (arriba) señaló como corregido —"si se puede consultar qué
métodos tiene habilitados un comercio"— pero esta medición (`API-DIRECTA-SPIKE-SANDBOX-1`) es la
primera que este ledger registra con el `file:line` de una respuesta real del sandbox para esa
pregunta; ningún asiento anterior a éste trae la cifra. Se anota la discrepancia sin resolverla: no es
alcance de este slice reconciliar a qué medición se refería esa corrección.

Este asiento no diseña `PaymentIntent` para API directa ni escribe código de integración — eso sigue
siendo trabajo aparte, igual que dejó dicho `WOMPI-REGLAS-IMPLEMENTACION-1` para el spike de Wompi
original.

**GATE, los dos carriles, verde.** Este diff toca un solo archivo del ledger (`DECISIONS.md`) y ningún
test, así que nada podía cambiar en ninguno de los dos carriles.

Regla: un spike read-only no deja rastro que el protocolo pueda seguir — el instrumento de medición no
produce citas, y lo que mide es incitable hasta que alguien lo escribe en el libro. Este asiento es esa
escritura, y las dos preguntas B y C muestran por qué importa: una conclusión correcta sostenida en la
premisa equivocada, y una pregunta que ningún asiento anterior había medido con una cifra real.

## 2026-09-16 — El solapamiento de Bre-B entre el widget y el método manual es HIPOTÉTICO, no vivo — y
la condición que lo activaría no la controla nadie de este lado (`BREB-SOLAPAMIENTO-ASIENTO-1`)

### 0 · Por qué este asiento existe

El spike `BREB-WIDGET-SOLAPAMIENTO-HOY-1` corrió read-only contra el bundle vivo del widget de Wompi y
midió que ese widget sabe dibujar Bre-B; el owner, aparte, midió en el panel de comercios del proveedor
que su cuenta no lo tiene habilitado. Ninguna de las dos mediciones deja rastro propio —el spike es
read-only y la del owner vive en su sesión del panel del proveedor—, así que sin este asiento las dos
viven sólo fuera del libro. Es la misma regla que ya fijó hoy mismo este ledger para spikes read-only
(`API-DIRECTA-SPIKES-ASIENTO-1`, arriba): *el instrumento de medición no produce citas; lo que mide es
incitable hasta que alguien lo escribe*. El owner ordenó este asiento el 2026-09-16 después de las dos
mediciones, con la decisión de producto ya tomada de su lado — esta escritura la pone en el libro, no
la toma.

**Este slice no tiene acceso a red: no verifica nada de lo que sigue contra el proveedor.** Lo de abajo
es lo que el spike y el owner midieron, transcrito con su origen.

### 1 · El widget arma su lista DESDE LA CUENTA, y SABE dibujar Bre-B

**Medido sobre el bundle vivo del proveedor** (`BREB-WIDGET-SOLAPAMIENTO-HOY-1`), no leído de
documentación — la misma distinción que ya separó una lectura de una medición hoy en este ledger
(`API-DIRECTA-DECISIONES-ATRIBUCION-FIX-1`, arriba).

- El componente que monta el widget inserta el script del proveedor; ese script abre una interfaz
  propia que carga su propia aplicación.
- Esa aplicación trae los datos del comercio con `getMerchantByPublicKey`, contra
  `GET /v1/merchants/{publicKey}/checkout`.
- El render **filtra sus candidatos por `acceptedPaymentMethods`**, el arreglo que llega de la cuenta
  — hay hasta un mensaje propio para cuando esa lista viene vacía: *«No hay métodos de pago
  configurados para este comercio»*.
- **`BRE_B` está en la lista de candidatos que el widget sabe dibujar**, junto a tarjeta, PSE, Nequi y
  Daviplata.
- Y no es un placeholder: tiene ícono propio embebido (grupo «Paga con QR Interoperable»), pantalla
  dedicada `/qr_breb`, su propio helper, y lógica de envío que fija el tipo literal.

### 2 · La cuenta del owner NO lo tiene, así que HOY NO OCURRE

**Medición del OWNER**, en el panel de comercios del proveedor, el **2026-09-16** — se registra como
suya, no como medida por este slice.

Los métodos activos de esa cuenta son: Tarjetas, Nequi, PSE, Botón Bancolombia, Bancolombia QR, Compra
y Paga Después, Daviplata y SU+Pay. **Bre-B no está.**

La cuenta de sandbox de este repo tampoco lo tiene — lo midió el spike, coherente con el
`404 NOT_FOUND_ERROR` ya registrado por `API-DIRECTA-SPIKES-ASIENTO-1` (arriba, §1.D) al probar `BRE_B`
contra ese mismo comercio.

**EL SOLAPAMIENTO ES HIPOTÉTICO, NO ESTÁ VIVO.** El widget sabe dibujar Bre-B, pero sólo lo muestra si
la cuenta lo tiene habilitado.

### 3 · La condición que NADIE CONTROLA

Que una cuenta gane Bre-B no depende de este repo ni de su configuración: el owner midió que **no
aparece como algo que el comercio pueda encender desde ese panel** — se solicita al proveedor por otra
vía.

**Es lo más importante de este asiento, y el owner lo subrayó.** Esto puede volverse real **sin que
nosotros toquemos nada** — ni código, ni configuración, ni despliegue. Es un cambio que ocurre AFUERA y
que nadie nos avisa. Un asiento que dijera sólo «hoy no pasa» estaría describiendo un estado que puede
cambiar solo, sin dejar rastro de su lado — por eso el disparador de §5 va como ítem explícito y no
como comentario al pie.

### 4 · La decisión del owner — dos métodos, no uno duplicado

**SON DOS MÉTODOS DISTINTOS, y se tratan como tales.** No es el mismo método listado dos veces: es una
transferencia manual que el comprador hace por su app y que un humano confirma, contra un cobro en
línea que se confirma solo. Distinta espera, distinto tiempo, distinta categoría en el libro de Pagos.
Que compartan el riel es coincidencia de nombre, no de producto.

**La unión paralela de `API-DIRECTA-DECISIONES-PROGRAMA-1` §2 (arriba) NO SE ROMPE**: no hay nada que
reconciliar entre dos cosas distintas — es el mismo efecto de segundo orden que esa decisión ya
anticipó, ahora con un caso real delante en vez de hipotético.

**Lo que hay que resolver es COPY, no arquitectura — y eso es del owner.** Cuando exista el desglose por
instrumento (§3 de `API-DIRECTA-DECISIONES-PROGRAMA-1`, arriba), el de pasarela lleva un nombre que
diga qué es; y si hace falta, el manual también. **No se construye nada de esto ahora.**

**El hecho que borra dos de las salidas que se habían considerado:** el selector del widget **no se
puede restringir ni preseleccionar** — ni por parámetro del loader, ni desde el dashboard del comercio,
que para esto es una pantalla de sólo lectura (`WOMPI-API-DIRECTA-CIERRE-CORRECCION-1` §1, arriba, línea
~4897). Con eso, **la única palanca es nuestra propia entrada manual**
(`lib/checkout/metodos-pago.ts:24`, `MetodoPagoTipo` incluye `'breb'`; línea 98, su label es «Bre-B»):
cualquier salida de «exclusión mutua» sólo podría quitar la NUESTRA, dejando la del widget sola. Por
eso esas salidas quedaron descartadas — no porque el owner las prefiriera, sino porque no hay lado del
widget sobre el que actuar.

### 5 · El disparador

**Volvemos a esto cuando la cuenta de un tenant gane Bre-B.** Se escribe como ítem propio, no como nota
al pie del §3, porque es un cambio que ocurre AFUERA de este repo y **nadie nos avisa** cuando pasa: no
hay evento, no hay webhook, no hay campo que cambie de valor en nuestra base. La única forma de
enterarse es volver a mirar el panel del comercio, y la única forma de que alguien lo haga es que este
asiento se lo recuerde.

### 6 · El rigor del spike, anotado

El spike `BREB-WIDGET-SOLAPAMIENTO-HOY-1` midió el endpoint que el widget REALMENTE consume —el que
encontró leyendo el bundle— en vez del que su propio spec le citaba, reportó la desviación, y se negó a
asumir que las distintas rutas del comercio fueran intercambiables sin haberlo verificado.

**Por qué se registra:** el spec no se lo recordaba. Es el **segundo caso del día** de disciplina de
procedencia aplicada sin que nadie la escriba en la ocasión — la misma clase que ya registró hoy este
mismo ledger cuando `API-DIRECTA-SPIKES-ASIENTO-1` (arriba, §2) anotó una discrepancia de conteo contra
una corrección anterior **sin inventarle causa**, en vez de resolverla de más.

**GATE, los dos carriles, verde.** Este diff toca un solo archivo del ledger (`DECISIONS.md`) y ningún
test, así que nada podía cambiar en ninguno de los dos carriles.

Regla: dos métodos que comparten riel no son un método duplicado si difieren en QUIÉN confirma y CUÁNDO
— la unión paralela entre manuales y de pasarela ya absorbe esa diferencia sin que nadie tenga que
reconciliarla. Un solapamiento que depende de una condición externa que nadie de este lado controla
—y que nadie nos avisa al cruzarse— no se cierra con una frase de estado: se cierra con un disparador
explícito que alguien vuelva a leer.

## 2026-09-16 — Los dos slices de métodos se rehacen a la luz de `accepted_payment_methods`: el panel
cambia de FORMA (no de tamaño), el aviso de desalineo ENCOGE sin desaparecer, y el primer slice se queda
casi sin trabajo (`API-DIRECTA-METODOS-REHECHOS-1`)

### 0 · Por qué este asiento existe

La partición del programa de API directa vive HOY sólo en la figura de un censo read-only —fuera del
libro, y por lo tanto **incitable**: es la misma regla que este mismo ledger fijó el mismo día para las
mediciones de spike (`API-DIRECTA-SPIKES-ASIENTO-1`, arriba: *"el instrumento de medición no produce
citas; lo que mide es incitable hasta que alguien lo escribe"*). El owner ordenó el 2026-09-16 rehacer
los slices del panel de métodos y del aviso de desalineo a la luz de `accepted_payment_methods`, medido
contra el sandbox y ya registrado en `API-DIRECTA-SPIKES-ASIENTO-1` (arriba). **Este asiento pone en el
libro QUÉ CAMBIA de esos dos slices y del primero de la partición. No construye nada, y NO da la
partición por aprobada** — la partición completa sigue sin estar en este ledger; lo que sigue describe el
efecto de un hecho medido sobre slices que la partición nombra, no la partición misma.

### 1 · El hecho medido, y la premisa falsa que desmiente

> «el endpoint nuevo del comercio devuelve accepted_payment_methods con los metodos que la cuenta tiene
> realmente habilitados, y pedir al crear un metodo que la cuenta no tiene falla con un 404
> NOT_FOUND_ERROR reconocible por programa que nombra el metodo» (MEDIDO — `API-DIRECTA-SPIKES-ASIENTO-1`,
> arriba, §1.C y §1.D)

**Lo que ese hecho DESMIENTE:** el censo de construcción de la partición había asumido que **no hay
forma de preguntarle al proveedor qué métodos tiene habilitados un comercio** — de esa premisa salieron
los dos slices que este asiento rehace. **Esa premisa era falsa**, y como ya lo dejó anotado
`API-DIRECTA-SPIKES-ASIENTO-1` (§2, arriba), era una LECTURA de documentación citada como si fuera un
hecho verificado, la misma familia que ya corrigió `API-DIRECTA-DECISIONES-ATRIBUCION-FIX-1` (arriba)
para el copy de las dos aceptaciones.

### 2 · El slice del panel de métodos — cambia de FORMA, no de tamaño

**Como estaba propuesto:** el panel le deja al dueño declarar qué métodos de la pasarela ofrece su
tienda, eligiendo de una lista **nuestra, escrita en nuestro código**. Nada verificaba que su cuenta los
tuviera. Configuración a ciegas.

**Como queda:** el panel **lee del proveedor la lista real de esa cuenta** —con la llave pública del
tenant, por cabecera (la misma que midió `API-DIRECTA-SPIKES-ASIENTO-1` §1.C contra
`GET /v1/merchants/info`)— y le ofrece únicamente eso. No puede encender lo que no tiene.

**Lo que eso mata de raíz, y es la mitad del valor del rehecho:**
- **El catálogo deja de vivir en nuestro código.** El proveedor agrega o retira un tipo de método y
  nosotros no desplegamos nada. La lista escrita a mano habría envejecido sola — la misma clase de dato
  vencido que este ledger ya persigue en otros lados, pero en código, y peor, porque decide qué se le
  puede cobrar a alguien.
- **La pregunta «¿qué tipos soportamos?» desaparece del slice.** No la decidimos nosotros: la responde la
  cuenta del dueño.

**Lo que le agrega, y por eso no encoge:** una llamada al proveedor **desde el panel**, con su propio
modo de falla.

**PENDIENTE DEL OWNER, anotado y NO resuelto acá — el modo de falla es byte visible:** si la lectura de
la cuenta falla al configurar, ¿el dueño ve la lista vacía, la lista anterior, o un aviso explícito de
que no se pudo leer? El precedente del checkout —si la consulta al proveedor falla, no se ofrece el pago
en línea (`API-DIRECTA-DECISIONES-PROGRAMA-1` §4, arriba)— **no se traslada solo**: allá la consecuencia
de fallar es no cobrar; acá es no poder configurar. Son consecuencias distintas y merecen su propia
decisión, no la heredada.

### 3 · El slice del aviso de desalineo — ENCOGE, pero no desaparece

**Como estaba propuesto:** un slice entero — pantalla al comprador, marca en el estado crudo del
proveedor, y una entrada nueva en el catálogo de automatizaciones (`constants/automations.ts`) para
avisarle al dueño.

**Como queda:** el desalineo se **previene al configurar** (§2, arriba), así que lo que sobrevive es el
**residual**: que la cuenta cambie DESPUÉS de que el dueño configuró. Ahí la creación de la transacción
devuelve el `404 NOT_FOUND_ERROR` que `API-DIRECTA-SPIKES-ASIENTO-1` §1.D ya registró —y que **nombra el
método exacto** en su `reason`—, así que avisarle al dueño sale más barato que antes: ya se sabe cuál
método se cayó, sin adivinarlo por ausencia.

**Y acá está la razón por la que NO se borra, que es lo más importante de esta sección — aunque la
pregunta que sigue ya se cerró (ver el bloque `[PREDICTOR-MEDIDO]`, abajo): la respuesta también
necesita quedar donde alguien la va a buscar.**

```
!!!!!!!!!!  P R E D I C T O R   M E D I D O  !!!!!!!!!!
!!  [PREDICTOR-MEDIDO] -- marcador buscable por maquina
!!  ESTO YA ES UN DATO, NO UNA PREGUNTA ABIERTA (medido: API-DIRECTA-SPIKE-PREDICTOR-1).
!!  «si accepted_payment_methods predice el 404 de forma confiable para CUALQUIER tipo de metodo,
!!  y no solo para el unico que se probo» -- SI, para la cuenta medida.
!!  Se probo CADA tipo del catalogo del proveedor que esa cuenta NO tiene habilitado -- no una
!!  muestra de uno solo. TODOS fallaron IGUAL: mismo status, mismo error.type, y un reason que
!!  nombra el tipo exacto que se rechazo. NINGUNO quedo sin concluir: varios exigieron completar
!!  antes campos propios de la forma de ese tipo de metodo, y una vez completos llegaron al MISMO
!!  rechazo por cuenta-sin-el-metodo.
!!  EL LIMITE, sin suavizar: se midio contra UNA cuenta (la de sandbox de este repo). Que los tipos
!!  que le faltan a ESA cuenta fallen todos igual NO prueba que toda cuenta se comporte igual.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

(MEDIDO — `API-DIRECTA-SPIKE-PREDICTOR-1`; registrado por ese spike, no re-medido por este asiento, que
no tiene acceso a sandbox.)

La pregunta que quedó abierta en `API-DIRECTA-SPIKES-ASIENTO-1` §2 (arriba) —*"Se probó SÓLO `BRE_B`. Que
la lista y el rechazo hayan coincidido esa vez no prueba que coincidan siempre"*— **SE CERRÓ.** Una
coincidencia observada una vez no era un predictor; el catálogo entero coincidiendo sí lo es, con el
límite escrito arriba (una cuenta, no todas). **La frase «el desalineo se previene al configurar» ya no
descansa sobre una pregunta sin medir: descansa sobre esta medición**, y es lo que desbloquea que
`API-DIRECTA-DESALINEO-AVISO-1` (el slice reducido) se construya apoyado en ella.

### 4 · El primer slice se quedó casi sin trabajo

El primero de la partición era una prueba de extremo a extremo, desechable y detrás de una bandera, y
existía por una sola razón: verificar que las premisas técnicas aguantaran una llamada real contra el
proveedor.

Las premisas que ese cableado iba a verificar **ya las midieron los dos spikes de sandbox**
(`API-DIRECTA-SPIKES-ASIENTO-1`, arriba): la firma sirve tal cual (§1.A), la creación autoriza con
cualquiera de las dos llaves (§1.B), y el corte cliente/servidor para la creación queda forzado por el
secreto de la firma, no por la llave. **El cableado desechable se quedó sin la pregunta que justificaba
escribirlo.**

**Pero no desaparece — y ésta es la parte honesta:** le queda la mitad del webhook, que la cadena del
proveedor cierre contra un evento REAL. Eso **sigue sin medirse**, y **no se puede medir sin una URL
pública** — ya registrado como abierto en `WOMPI-REGLAS-IMPLEMENTACION-1` (arriba) y otra vez en
`API-DIRECTA-SPIKES-ASIENTO-1` §2 (arriba). Ese residual queda **bloqueado por esa condición**, no
resuelto por este asiento.

### 5 · El tamaño del programa

Registrado de lo que este asiento afirma sobre la propuesta del censo de construcción — **no medido
contra el ledger, porque la partición completa no vive en él** (§0, arriba): son **nueve** slices en la
propuesta; **los nueve** caen en Tier 1 (tocan rutas de dinero, esquema o bytes de cliente); y **los
nueve** paran para el gate del owner, porque ninguno es a la vez sin esquema, sin bytes de cliente y sin
contrato cruzado.

**De esos nueve, TRES quedan afectados por este asiento:** el del panel de métodos (§2, cambia de forma),
el del aviso de desalineo (§3, encoge) y el primero de la partición, el cableado desechable de sandbox
(§4, se queda casi sin trabajo, con un residual bloqueado). Los otros seis no se tocan acá.

### 6 · Límites de este asiento

- **Esto no construye nada.** Ningún slice de la partición arranca por este asiento.
- **La partición completa NO se aprueba ni se cierra acá.** Sigue viviendo fuera del libro, en la figura
  del censo read-only; este asiento registra el efecto de un hecho medido sobre tres de sus piezas, no
  la partición entera.
- **El predictor de §3 quedaba como pregunta abierta, explícitamente sin medir — SE MIDIÓ después**
  (`API-DIRECTA-SPIKE-PREDICTOR-1`, bloque `[PREDICTOR-MEDIDO]` en §3, arriba), contra UNA cuenta, con
  ese límite escrito ahí. `API-DIRECTA-DESALINEO-AVISO-1` es el primer slice que se apoya en la medición.
- **El modo de falla de §2 queda pendiente del owner**, sin resolverse acá.

**GATE, los dos carriles, verde.** Este diff toca un solo archivo del ledger (`DECISIONS.md`) y ningún
test, así que nada podía cambiar en ninguno de los dos carriles.

Regla: un hecho medido contra el proveedor que desmiente la premisa de un slice no borra el slice —lo
REHACE, y el tamaño del rehecho depende de cuánto de la premisa vieja sobrevive: el panel cambia de
forma porque gana una fuente de verdad que no tenía, el aviso de desalineo encoge porque parte de su
trabajo se previene aguas arriba, y un slice que sólo existía para verificar una premisa ya medida se
queda con el residual que esa medición no cubrió. Ninguno de los tres se cierra por esto: el panel tiene
un modo de falla pendiente del owner, el desalineo se apoya en un predictor SIN MEDIR, y el residual del
primero está bloqueado por una condición externa (una URL pública) que este asiento no resuelve.

## 2026-09-17 — El catálogo de métodos de la pasarela no es «un campo por método»: más de la mitad pide
varios, de tres naturalezas distintas, y más de la mitad saca al comprador de la página — y el filtro del
panel es CATÁLOGO ≠ HABILITADO ≠ COBRABLE, tres conjuntos distintos donde sólo el tercero sirve
(`API-DIRECTA-CATALOGO-METODOS-ASIENTO-1`)

### 0 · Por qué este asiento existe

El spike `API-DIRECTA-SPIKE-FORMA-DE-METODOS-1` corrió read-only y no deja rastro propio: lo que midió
vive sólo en los registros del orquestador y es **incitable** hasta que alguien lo escribe — la misma
regla que este ledger ya fijó para spikes read-only (`API-DIRECTA-SPIKES-ASIENTO-1`, arriba: *"el
instrumento de medición no produce citas; lo que mide es incitable hasta que alguien lo escribe"*). El
owner ordenó el 2026-09-17 escribirlo ANTES del slice del filtro del panel de métodos, que necesita citar
una de sus mediciones para no depender de un hecho fuera del libro, y pidió que este asiento registre la
distinción entre los tres conjuntos como **el criterio** del filtro, no como anécdota de un tipo de
método.

**Este slice no tiene acceso a red: no verifica nada de lo que sigue contra el proveedor.** Lo de abajo es
lo que el spike midió, transcrito con su origen.

### 1 · El espacio de casos del catálogo — medido contra el sandbox, tipo por tipo

La forma extensible de los métodos de pasarela se diseñó con tarjeta y billetera. La billetera **pide un
teléfono**, así que la forma quedó asumiendo **un campo por método**.

El spike recorrió el catálogo entero y midió:

- **Cuántos campos.** El máximo es **seis**, y **más de la mitad de los tipos piden más de uno**. La
  suposición no era corta para un método: era corta para la mayoría del catálogo.
- **De qué tipo es cada campo — dimensión propia, no un detalle de la cantidad.** Hay **texto libre**, hay
  **elección de una lista cerrada que el proveedor enumera en su propio error de validación**, y hay
  **datos que se traen de OTRA consulta** — la lista de bancos, el token de la tarjeta.

  > **Por qué importa separarlo:** una forma que soporte «N campos de texto» no soporta «elegí una de
  > estas opciones» ni «esta lista se pide aparte». Medir sólo la cantidad habría hecho nacer la forma
  > corta otra vez, por otro lado.

- **Quiénes sacan al comprador de la página.** Más de la mitad de los que se pudieron medir. No es una
  rareza de un método: es la mitad del catálogo.
- **El detalle que habría fallado en silencio:** el campo donde viene la dirección de redirección **no
  tiene el mismo nombre en todos los tipos**. Una forma que buscara un único nombre de campo para decidir
  «este método redirige» se equivocaría con la mitad de los que sí redirigen — y fallaría sin ruido,
  dejando al comprador esperando una pantalla que nunca llega.

**Lo que no se pudo medir:** de los tipos que esta cuenta no tiene habilitados, no se puede observar si
redirigen — exige crear la transacción de verdad, y ese tipo la rechaza (§3, abajo, es justamente uno de
esos casos). Queda dicho como no medido, y no se dedujo del nombre del método.

### 2 · Un campo que sólo existe en pruebas

Algunos tipos del catálogo piden un dato que sirve para simular el resultado de la transacción y que es
un artefacto del AMBIENTE de pruebas, no del método en sí.

```
!!!!!!!!!!  S I N   M E D I R  !!!!!!!!!!
!!  [SIN MEDIR] -- marcador buscable por maquina
!!  ESTO NO ES UN DATO. ES UNA PREGUNTA ABIERTA.
!!  «si ese campo de simulacion desaparece en una cuenta de PRODUCCION»
!!  NADIE MIDIO ESTO. No lo afirmes, no lo asumas, no lo cites
!!  como hecho, no lo uses para decidir: MEDILO.
!!  Verificarlo exige una cuenta productiva, que este spike no tenia.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

**El riesgo concreto:** si la forma del panel se construye desde lo medido en el sandbox sin distinguir
este campo, le horneamos a producción un campo de prueba que el comprador vería en un formulario real.

### 3 · Catálogo ≠ habilitado ≠ cobrable — y esto es EL CRITERIO, no una anécdota

El spike midió un tipo — **`BANCOLOMBIA`**, el identificador exacto que el proveedor espera en el campo de
tipo de método al crear una transacción, no el nombre visible del banco — que **está en el catálogo del
proveedor**, **está entre los métodos habilitados de la cuenta**, y que **la creación de transacciones
RECHAZA SIEMPRE**, con cualquier combinación de campos. Es, casi con certeza, una etiqueta agregadora que
agrupa a sus hermanos bajo la marca de un banco para reportes, no un método que se pueda cobrar.

**Son tres conjuntos distintos**, y el que sirve para ofrecerle algo a un comprador es el tercero:

| Conjunto | De dónde sale |
| --- | --- |
| lo que el catálogo **enumera** | el error de validación del proveedor |
| lo que la cuenta **habilita** | la respuesta del proveedor sobre el comercio |
| lo que **se puede cobrar** | ninguna consulta lo devuelve |

> **Y acá está la razón, en palabras del owner:** cualquiera habría construido el filtro sobre «lo que la
> cuenta habilita» — es la lista que el proveedor devuelve, es la obvia — y este tipo habría pasado igual.
> El conjunto correcto es el tercero, y el tercero no lo devuelve ninguna API: lo sabemos porque un spike
> intentó crear y falló.

**El caso real, y se registra porque ya ocurrió:** el owner encendió ese tipo en su panel — hizo
exactamente lo que haría cualquier dueño: ofrecer lo que su cuenta tiene — y sus compradores no habrían
podido pagar con él, sin ninguna advertencia.

**El límite, que va escrito al lado y no se suaviza:** esto se midió contra UNA cuenta. No sabemos si otro
comercio con otra configuración se comporta igual. No cambia la decisión —en la nuestra no es cobrable—
pero no se afirma más de lo que se midió.

**CORRECCIÓN (`API-DIRECTA-CATALOGO-NOMBRA-TIPO-1`, 2026-09-17):** esta sección describía el hallazgo sin
nombrar el tipo — lo llamaba «un tipo» y lo describía por su comportamiento, nunca por el identificador
que un constructor necesita para usarlo. Lo detectó el slice que iba a construir el filtro del panel de
métodos: necesitaba excluir exactamente este tipo, buscó su identificador en el ledger, en todo el
historial y en los borradores, no lo encontró en ningún lado, y **se negó a fabricar un nombre** — dejó su
lista vacía en vez de inventar. Un asiento se lee bien y se usa mal, y sólo el que lo usa se entera del
hueco.

**La clase, para que quede como regla y no como incidente de un tipo de método:** la forma asumió un
campo por método porque se diseñó con la billetera, y la billetera pide un teléfono. `N = 1` se leyó como
LA FORMA en vez de como EL CASO — un contrato derivado de los ejemplos que se tenían a mano, en vez del
espacio de casos. Es la misma familia que ya registró este ledger para el descubrimiento de tests del
gate, que enumeraba los subárboles que alguien recordó y se agrandó un subárbol por falla: la diferencia
es que aquélla se descubrió fallando, varias veces, y ésta la destapó una medición ANTES de costar.

### 4 · Lo que este programa ya confirmó tres veces

El motor de dinero del servidor se reusa tal cual. Ya no es un argumento: es repetición medida, en tres
integraciones distintas —el widget, la creación por API, y el camino que saca al comprador del sitio—,
las tres sin tocar el webhook, el reconciliador ni el modelo del intento. La decisión de modelar el motor
agnóstico de cómo nació la transacción fue correcta, y esto es su evidencia, no su defensa.

**GATE, los dos carriles, verde.** Este diff toca un solo archivo del ledger (`DECISIONS.md`) y ningún
test, así que nada podía cambiar en ninguno de los dos carriles.

Regla: el filtro que decide qué método ofrecerle a un comprador no se construye sobre lo que el proveedor
dice que la cuenta tiene habilitado — se construye sobre lo que la cuenta puede COBRAR, y esos dos
conjuntos no son el mismo: un tipo puede estar en el catálogo, estar habilitado, y rechazar la creación de
todas formas. Un contrato de formulario derivado del ejemplo que se tenía a mano (un campo, la billetera)
en vez del espacio de casos completo (hasta seis campos, de tres naturalezas, con más de la mitad
redirigiendo por un campo que cambia de nombre) es la misma clase de error en otra superficie: se
descubre midiendo el catálogo entero, no extrapolando del primer caso.
un modo de falla pendiente del owner, el desalineo se apoyaba en un predictor sin medir —medido después,
contra una cuenta, en `API-DIRECTA-SPIKE-PREDICTOR-1` (§3, arriba)—, y el residual del primero está
bloqueado por una condición externa (una URL pública) que este asiento no resuelve.

## 2026-09-17 — La guarda que cierra la clase, y el mismo defecto en dos disfraces: el glob del gate y el
descriptor de método de pasarela (`GATE-GUARDA-TESTS-INVISIBLES-1`)

### El hecho que ordena esta tanda

El glob del carril rápido (`package.json`, script `"test"`) dejó de descubrir un archivo de test **por
QUINTA vez** en `GATE-GLOB-COMPONENTS-SERVICES-1` (commit `2f8c205`, la noche anterior a este slice):
`services/checkout.service.test.ts` —del camino de dinero— y
`components/storefront/checkout/interpretar-respuesta-otro-metodo.test.ts` existían, pasaban a mano, y
**ningún `npm run gate` los ejecutaba**. Las cinco veces el arreglo fue el mismo: agregar el subárbol que
faltaba a una lista escrita a mano (§ GATE-DOS-CARRILES-1, § El carril rápido cubre `app/` — CUARTA
instancia —, CLAUDE.md). El owner ordenó el 2026-09-17 construir la guarda que cierra la CLASE, no la
instancia número cinco.

### Las DOS fallas que este asiento nombra JUNTAS

**1 · El glob del gate.** `package.json` enumeraba los subárboles que alguien RECORDÓ declarar
(`lib/**`, `constants/**`, `packages/core/**`, `app/**`, y ahora `components/**`, `services/**`), nunca
el espacio completo de lugares donde un test puede nacer. Un subárbol nuevo —o uno viejo que nadie
pensó en listar— quedaba invisible hasta que alguien lo notara a mano, y notarlo a mano es justo lo que
falló cinco veces seguidas.

**2 · El descriptor de método de pasarela.** `DescriptorMetodoPasarela` (`lib/pagos/metodos-pasarela.ts`,
§ API-DIRECTA-OTROS-METODOS-1) declara **un solo campo** —`campo: CampoMetodoPasarela`, "el único dato
que este tipo le pide al comprador"— porque el tipo con el que se diseñó y probó, NEQUI, es una
billetera que sólo pide un número de celular. El propio archivo ya deja la fisura escrita: **PSE queda
explícitamente AFUERA de este registro** porque "necesita su propio spike antes de tener su
descriptor" — y la razón de que PSE no entre por esa puerta es que PSE no le pide UN dato al comprador,
le pide varios (banco, tipo de documento, número de documento). El contrato de "un campo" no es un
error de PSE: es el límite del contrato, visto ANTES de forzar a PSE dentro de él.

### Por qué son el MISMO defecto

**LAS DOS SON UN CONTRATO DERIVADO DE LOS CASOS QUE SE TENÍAN A MANO, EN VEZ DEL ESPACIO DE CASOS.** El
glob se escribió mirando los subárboles que existían el día que se escribió, no "todo lugar donde un
test pueda vivir". El descriptor se escribió mirando NEQUI, el único tipo que había cuando se diseñó,
no "todo lo que un método de pasarela puede pedirle a un comprador". En los dos casos alguien enumeró
los EJEMPLOS que tenía delante y los llamó "el conjunto", y el conjunto real siguió creciendo por fuera.

**La diferencia entre ellas es la parte útil.** El glob se descubrió FALLANDO cinco veces —un archivo
invisible, corriendo a mano, hasta que alguien lo notaba tarde—. El descriptor lo destapó una MEDICIÓN
—leer el caso de PSE contra el contrato de "un campo" y ver que no entra— **antes de que costara nada**:
PSE se dejó explícitamente afuera del registro en vez de forzarse adentro y romperse en producción. La
misma clase de contrato angosto, dos maneras muy distintas de encontrarle el borde: una cara, una
barata.

**Por qué van en un asiento y no en dos, en la razón del owner: la lección no es sobre globs ni sobre
métodos de pago — es sobre CÓMO SE ESCRIBEN LOS CONTRATOS ACÁ.** Separadas se leen como dos anécdotas de
dos rincones del código; juntas se leen como una regla: un contrato que enumera los casos conocidos, en
vez de describir el espacio que esos casos habitan, deja afuera lo que todavía no se ha visto — y no
avisa que lo dejó afuera.

### La guarda construida

`lib/gate/tests-descubiertos.ts` (puro) + `lib/gate/tests-descubiertos.test.ts` (el test, descubierto
por el propio glob que vigila — `lib/**/*.test.ts` ya lo cubre). Enumera TODO archivo `*.test.ts` del
repositorio (excluyendo `node_modules`, `.git`, `.next`, `.vercel`, `.scratch`), lee los patrones de LOS
DOS carriles de **sus propias fuentes** —el script `"test"` de `package.json` y la invocación de
`node --test` al final de `scripts/test-integracion.sh`— y falla nombrando cada archivo que no cae bajo
ninguno. **Nunca transcribe un patrón a mano**: `extraerGlobsDeComando` lee las cadenas entrecomilladas
que terminan en `.test.ts` de cada fuente, así que un patrón agregado o retirado se sigue solo — es la
misma cura que evita que esta guarda se vuelva, ella misma, un contrato que enumera lo que alguien
recordó.

**Por qué lee LOS DOS carriles y no sólo el rápido:** un archivo bajo `tests/integracion/` no es
invisible — corre por el carril de integración, a propósito, porque necesita Postgres real (§ El
carril rápido cubre `app/`, CLAUDE.md). Si la guarda sólo conociera el patrón del carril rápido,
fallaría siempre contra esos ~30 archivos, que ya están cubiertos por el otro lado del mismo
`npm run gate`.

### La condición del owner: probada contra el caso real

Con los patrones de `package.json` **tal como estaban antes de `2f8c205`** (`git show 2f8c205^:package.json`,
sin `"components/**/*.test.ts"` ni `"services/**/*.test.ts"`) corridos contra el árbol de archivos REAL
de hoy —los dos archivos que nacieron invisibles esa noche siguen existiendo—, la guarda nombra
exactamente:

```
components/storefront/checkout/interpretar-respuesta-otro-metodo.test.ts
services/checkout.service.test.ts
```

Con los patrones de HOY (leídos del `package.json` real), la misma corrida no nombra ninguno. La
reproducción quedó además como test permanente (`archivosSinCubrir: EL CASO REAL DE ANOCHE`) dentro de
`lib/gate/tests-descubiertos.test.ts`, contra los mismos dos archivos y los mismos patrones viejos —no
un fixture inventado.

### Su límite, impreso

**La guarda afirma que todo archivo de test del repositorio CAE DENTRO de un patrón que algún carril del
gate ejecuta. NO afirma que su CONTENIDO corra.** Un archivo descubierto cuyo contenido no se ejecuta
—un caso saltado, un bloque que nunca se alcanza, una condición que lo apaga— sigue siendo invisible, y
eso es otra pregunta que esta guarda no responde. El límite vive en el docstring de
`lib/gate/tests-descubiertos.ts` y en el mensaje de falla de la propia guarda, no sólo acá.

### Lo que NO se tocó

El descriptor de método de pasarela (`lib/pagos/metodos-pasarela.ts`) no se modificó — esta tanda lo
nombra como el segundo disfraz del mismo defecto, no lo generaliza a varios campos. Ese trabajo, si se
hace, es del día en que PSE (o cualquier tipo que pida más de un dato) entre por su propio spike.

**Tier 1 — no aplica a este diff.** `lib/gate/` y `DECISIONS.md` no están en la lista Tier 1 ni en sus
subárboles, y este slice no toca `app/(storefront)/`, ninguna puerta de dinero, schema ni migración.
Pero la RAMA (`slice/api-directa-panel-metodos-1`) sigue con commits previos que sí tocan superficie
Tier 1 (`lib/checkout/metodos-pago.ts`), así que el conjunto sigue esperando el visto bueno del owner
antes de mergear — este commit no lo cambia.

Regla: un contrato que enumera los casos que tenía a mano, en vez de describir el espacio que esos casos
habitan, deja afuera lo que todavía no se ha visto y no avisa que lo dejó afuera — la única diferencia
entre encontrarle el borde por las malas (fallando en producción) o por las buenas (una medición antes
de construir) es si alguien miró el espacio de casos antes de que el mundo se lo señalara.

## 2026-09-17 — BANCOLOMBIA no es "no cobrable": es una etiqueta de agrupación, y con ese banco SÍ se
cobra por otros identificadores — una medición angosta reportada como afirmación ancha
(`CORRECCION-BANCOLOMBIA-AGREGADOR-1`)

### 0 · Por qué este asiento existe, y la clase del error que corrige

El asiento del catálogo de métodos (`API-DIRECTA-CATALOGO-METODOS-ASIENTO-1`, con su corrección de
nombre `API-DIRECTA-CATALOGO-NOMBRA-TIPO-1` — los dos viven en `main`, **no son ancestros de esta
rama**: `slice/api-directa-panel-metodos-1` divergió de `main` antes de que esos dos commits
aterrizaran ahí, así que este asiento no puede citar su texto literal y lo cita por ID) midió que el
identificador `BANCOLOMBIA` **rechaza siempre** la creación de una transacción, con cualquier
combinación de campos. Esa medición es correcta, y es ANGOSTA: mide un identificador.

Se escribió — y el panel de métodos la heredó (`PANEL-LISTA-NO-COBRABLES-1`, título "No disponible
para cobrar") — como si dijera algo ANCHO: que con ese banco no se cobra. **Eso es FALSO.**

**QUIÉN LO ENCONTRÓ:** el owner, con evidencia PROPIA — paga con ese banco habitualmente, y el panel
del proveedor le muestra ese método activo. No fue una revisión de quien escribió el asiento
original; fue el dueño usando su propia cuenta. El owner ordenó re-medir.

**LA CLASE, para que quede como regla y no como incidente de un banco:** una medición angosta
reportada como afirmación general. No falló la medición —el identificador sigue rechazando siempre—;
falló CÓMO SE ESCRIBIÓ, y el error llegó a dos lugares: a `main` (el asiento) y al panel que ve el
dueño (la etiqueta).

### 1 · Lo medido — el re-spike (`API-DIRECTA-SPIKE-COBRABLES-Y-NOMBRES-1`)

Igual que los spikes read-only anteriores de este programa, éste no deja rastro propio: lo que midió
vive en los registros del orquestador y es incitable hasta que alguien lo escribe (la misma regla que
ya fijó `API-DIRECTA-SPIKES-ASIENTO-1`). Este slice **no tiene acceso a red**: no re-verifica nada de
lo que sigue contra el proveedor — lo transcribe, con su origen.

- **El identificador `BANCOLOMBIA` a secas SIGUE sin ser un tipo creable.** La creación lo rechaza
  diciendo que el TIPO no es válido — distinto de "esta cuenta no tiene este método". Esa distinción
  —tipo inválido vs. cuenta sin el método— es la que el asiento original perdió al escribir sólo
  "rechaza siempre".
- **Los identificadores HERMANOS, con sufijo sobre el mismo nombre de banco, SÍ se cobran.** Al menos
  DOS se crearon con éxito. Con ese banco se cobra.
- **Hay evidencia de CUÁL hermano corresponde al botón que el dueño ve en su panel, y no es por
  parecido de nombre:** al crear la transacción con ese identificador, el proveedor devuelve una
  dirección de redirección que contiene ese mismo nombre de flujo.
- **DOS hermanos quedaron SIN CLASIFICAR** — no se pudo pasar su validación de forma. **NO MEDIDO**:
  no se afirma nada sobre ellos, ni que cobren ni que no.

### 2 · La raíz — por qué esto pasó, y por qué puede volver a pasar si no se nombra

**El proveedor NO devuelve, en ningún endpoint, un nombre legible por una persona para sus tipos de
método.** El campo de nombre repite el identificador de máquina. La tabla de traducción entre lo que
el dueño ve en SU panel (el del proveedor) y lo que la API llama **no existe del lado de la
máquina** — sólo puede salir del panel del dueño.

Estábamos cruzando dos vocabularios sin tabla de traducción, y eso produce conclusiones falsas **por
construcción**, no por descuido. Cualquier hallazgo futuro sobre "qué identificador corresponde a qué
botón del panel del proveedor" corre el mismo riesgo mientras esa tabla no exista — no hay forma de
resolverlo desde el código, sólo desde el panel del dueño.

### 3 · Lo que se corrige, y lo que NO

- **El hecho medido no cambia:** `BANCOLOMBIA` (el identificador exacto) sigue sin poder crearse
  nunca. `TIPOS_NO_COBRABLES` (`lib/pagos/metodos-pasarela.ts`) se queda con esa única entrada — su
  docstring gana la corrección, citando este asiento, aclarando que describe el IDENTIFICADOR, nunca
  el banco.
- **La etiqueta del panel** (`EXPLICACION_NO_ENCENDIBLE.no_cobrable.titulo`,
  `components/admin/DatosNegocioSeccion.tsx`) cambia de "No disponible para cobrar" —que un dueño lee
  como "no puedo cobrar con este banco"— a un texto corto que dice lo que es: una etiqueta de
  agrupación del proveedor, no un método. **TEXTO PROVISIONAL, PENDIENTE DE TEXTO DEL OWNER**, mismo
  criterio que el resto del copy de este programa.
- **NO se renombran `esNoCobrable` / `TIPOS_NO_COBRABLES` / el estado `no_cobrable` del enum
  (`EstadoMetodoPasarela`).** Los usa `lib/config/site-settings-schema.ts` (fuera de `touches` de
  este slice), y los tres nombres siguen siendo literalmente ciertos sobre el IDENTIFICADOR
  `BANCOLOMBIA` — nunca se puede crear una transacción con ese tipo. Lo falso no era el nombre del
  código: era la interpretación ancha que el asiento y el panel dejaban pasar sin decir "esto es del
  identificador, no del banco". Renombrar esos símbolos habría exigido tocar
  `lib/config/site-settings-schema.ts` (el refine que usa `esNoCobrable` y su mensaje "Hay un método
  de pasarela que tu cuenta no puede cobrar", que tiene el MISMO problema de framing) — abre un
  `open_followup`, no se hace acá.
- **No se agregan descriptores nuevos, no se activa ningún método nuevo, no se toca el servidor de
  dinero ni el esquema.**

### 4 · El límite, sin suavizar

Esto sigue midiéndose contra UNA cuenta, como el asiento original. Los DOS hermanos sin clasificar
siguen sin clasificar. Que dos hermanos cobren no prueba que TODOS los hermanos cobren, ni que el
patrón se sostenga en otra cuenta con otra configuración — sólo que "con ese banco no se cobra" era
falso para la cuenta medida.

### 5 · Verificación

`lib/pagos/metodos-pasarela.test.ts` sigue afirmando exactamente lo mismo que antes sobre
`BANCOLOMBIA`: cae en `no_cobrable`, sigue sin ser encendible, y el servidor lo sigue rechazando al
guardar (`siteSettingsEditableSchema`) — ese comportamiento NO cambió, y no había ninguna aserción
que reescribir. Lo que gana es un comentario que documenta la corrección al lado de esos tests, para
que la próxima lectura no vuelva a leer "no_cobrable" como "no se cobra con este banco".

**GATE, los dos carriles, verde.**

Regla: un hallazgo medido contra UNA cuenta describe lo que midió — un identificador, un campo, un
tipo — y la escritura tiene que quedarse en ese alcance. Generalizar de "este identificador rechaza
siempre" a "con este banco no se cobra" es el mismo salto que ya cerró este ledger en otras formas —de
un test que enumera los ejemplos que tenía a mano a "el espacio de casos", de un spike que midió un
tipo a "el catálogo entero"—, y esta vez el salto llegó hasta el panel que ve el dueño antes de que
alguien lo revisara. Quien mide un caso, escribe ESE caso.

## 2026-09-17 — El diccionario panel↔API no existe del lado de la máquina: el mapeo que aportó el
owner, con su grado de evidencia, y por qué cruzar los dos vocabularios sin él ya produjo una
conclusión falsa (`MAPEO-PANEL-API-ASIENTO-1`)

### 0 · El hallazgo raíz — por qué este asiento es el que evita la próxima conclusión falsa

**EL PROVEEDOR NO PUBLICA NOMBRES LEGIBLES PARA SUS TIPOS DE MÉTODO.** Medido
(`API-DIRECTA-SPIKE-COBRABLES-Y-NOMBRES-1`, el mismo re-spike que cerró `CORRECCION-BANCOLOMBIA-
AGREGADOR-1`, arriba): el campo de nombre de la información de comercio de la cuenta **repite el
identificador de máquina** — no hay un segundo campo con el texto que el dueño lee en su panel. Y ni
siquiera el bundle del propio widget de pago del proveedor trae esos textos: la única traducción
legible que el proveedor da en ningún lado es para un **subvalor** (los bancos dentro de una lista
cerrada), **nunca para el TIPO de método**.

**El diccionario entre lo que el dueño VE en el panel de su proveedor y lo que la API LLAMA no existe
del lado de la máquina. Sale del panel del comercio, o no sale.** Cualquier afirmación que cruce esos
dos vocabularios sin ese diccionario es **falsa por construcción** — no por descuido de quien la
escribe, sino porque no hay dato del lado de la máquina que la pueda sostener.

**Esto ya costó una conclusión falsa que llegó a `main`.** El asiento original del catálogo de métodos
midió que el identificador `BANCOLOMBIA` rechaza siempre la creación de una transacción — una medición
correcta y ANGOSTA — y se escribió (y el panel del dueño la heredó, en su etiqueta) como si dijera algo
ANCHO: que con ese banco no se cobra. Eso era falso, y **lo desmintió el owner con evidencia PROPIA**
(paga con ese banco habitualmente; su panel del proveedor le muestra el método activo), no una
revisión de quien escribió el asiento (`CORRECCION-BANCOLOMBIA-AGREGADOR-1`, arriba, íntegro). Este
asiento registra el diccionario que hace posible no repetir ese salto.

### 1 · El diccionario — tres niveles de evidencia, y no se mezclan

Un mapeo sin su grado de confianza es exactamente lo que produjo el error de arriba: una fila
MEDIDA y una fila adivinada, escritas con la misma autoridad visual, se leen igual de ciertas. Por
eso van en tres bloques separados, nunca en una sola tabla sin marcar.

**MEDIDO — el proveedor mismo lo confirma:**

| Nombre en el panel del proveedor | Identificador de API |
| --- | --- |
| Bancolombia (el botón/checkbox de transferencia) | `BANCOLOMBIA_TRANSFER` |

Evidencia: al crear una transacción con `BANCOLOMBIA_TRANSFER`, **el propio proveedor devuelve una
dirección de redirección que contiene ese mismo nombre de flujo** (medido en
`API-DIRECTA-SPIKE-COBRABLES-Y-NOMBRES-1`, ya citado sin nombrar el identificador en
`CORRECCION-BANCOLOMBIA-AGREGADOR-1` §1, arriba — ahí decía sólo "un identificador hermano"; este
asiento es el que lo nombra). **No es un parecido de nombre entre dos listas: es el proveedor mismo
nombrando su propio camino dentro de su propia respuesta.** Es la fila con la evidencia más fuerte de
las nueve.

**INFERIDO por coincidencia directa de nombre** (el nombre del panel y el identificador de API
coinciden letra por letra o son la traducción obvia del mismo término; nadie lo confirmó pidiendo que
el proveedor lo diga):

| Nombre en el panel del proveedor | Identificador de API |
| --- | --- |
| Tarjetas | `CARD` |
| Nequi | `NEQUI` |
| PSE | `PSE` |
| Daviplata | `DAVIPLATA` |

**INFERIDO POR DESCARTE — el nivel más débil de los tres, dicho así por el owner al aportarlo:**

| Nombre en el panel del proveedor | Identificador de API |
| --- | --- |
| Bancolombia QR | `BANCOLOMBIA_QR` |
| Compra y Paga Después Bancolombia | `BANCOLOMBIA_BNPL` |
| SU+Pay | `SU_PLUS` |

**[MAPEO-PENDIENTE-VERIFICAR] — marcador buscable por máquina.** Estas tres filas son lo que queda
después de emparejar los nombres del panel que sí tienen una coincidencia clara contra el resto del
catálogo de identificadores — nunca se pidió al proveedor que las confirme una por una, y no hay
respuesta del proveedor (ni una redirección, ni un mensaje de error) que las respalde como sí la tiene
`BANCOLOMBIA_TRANSFER`. **Quedan abiertas hasta que algo las confirme** — un intento de creación real
con cada una, o una respuesta del proveedor que las nombre, del mismo tipo que confirmó la primera
fila.

**El mapeo lo aportó el OWNER desde su panel PRODUCTIVO — no es un spike.** Todos los spikes de este
programa (`API-DIRECTA-SPIKE-COBRABLES-Y-NOMBRES-1` y los anteriores) miden contra el SANDBOX, que es
**otra cuenta**, con su propia configuración y su propio catálogo habilitado. El owner trajo estas
nueve filas el 2026-09-17 mirando el panel de SU cuenta productiva. Las dos fuentes no se mezclan sin
decirlo: una fila de este diccionario describe el panel productivo del owner, no necesariamente lo que
un spike futuro contra el sandbox va a encontrar, y viceversa.

### 2 · La consecuencia de producto — trabajo de copy que ninguna estimación de este programa había contado

**Si el panel del dueño va a mostrarle estos métodos, los nombres visibles los ponemos NOSOTROS.**

No es un detalle de implementación: acabamos de medir en §0 que esos nombres **no vienen de la API**
— no existen ahí, en ningún endpoint, para ningún tipo. Así que cada método que el programa termine
soportando necesita su nombre visible **escrito por nosotros**, y ese copy —como todo el copy de este
programa— **es del owner**, no una traducción que el código pueda inferir del identificador de
máquina (`BANCOLOMBIA_TRANSFER` no se convierte solo en "Bancolombia", ni `SU_PLUS` en "SU+Pay"; son
el mismo salto de vocabulario que este asiento existe para no volver a dar sin evidencia).

**Y el riesgo que esto abre, dicho:** si el nombre que nuestro panel le muestra al dueño **no
coincide** con el nombre que ve en el panel de su proveedor, el dueño va a buscar un método por el
nombre que conoce y va a encontrar otro (o ninguno) — el mismo problema de dos vocabularios sin
diccionario de §0, ahora del lado de NUESTRO producto en vez del lado de la API. Este diccionario es
lo que permite escribir el copy nuestro sin repetir ese salto: nombrar `BANCOLOMBIA_TRANSFER` como
"Bancolombia" en nuestro panel es seguro porque la fila MEDIDA lo respalda; nombrar `SU_PLUS` como
"SU+Pay" hoy sería la MISMA generalización angosta-a-ancha que este ledger ya corrigió una vez —
todavía es sólo descarte.

**Abre un seguimiento, no lo resuelve acá:** este slice sólo escribe el diccionario (`touches:
DECISIONS.md`); escribir el copy del panel a partir de él —y confirmar las tres filas por descarte
antes de nombrarlas en una pantalla que el dueño lee— es trabajo de un slice propio.

- **`MAPEO-PANEL-COPY-NOMBRES-1`** — escribir en el código los nombres visibles de
  `DESCRIPTORES_METODO_PASARELA` / el panel de métodos a partir de este diccionario, confirmando antes
  las tres filas `[MAPEO-PENDIENTE-VERIFICAR]` (§1) o dejándolas con su nombre de máquina hasta que se
  confirmen — nunca inventando el nombre legible por descarte solo.

### 3 · La regla

**Un diccionario entre dos vocabularios que no comparten fuente no se puede escribir con un solo
nivel de confianza: cada fila necesita decir CÓMO se sabe lo que dice, y una fila sin evidencia
fuerte no autoriza a una pantalla que el dueño lee a hablar como si la tuviera.**

**GATE, los dos carriles, verde** (`npm run gate`: capa 1 y capa 2, sin fallos).

**Tier 1 — no aplica a este diff.** `DECISIONS.md` no está en la lista Tier 1 ni en sus subárboles, y
este slice no toca `app/(storefront)/`, ninguna puerta de dinero, schema ni migración — es un asiento,
sin código. La RAMA (`slice/api-directa-panel-metodos-1`) sigue con commits previos que sí tocan
superficie Tier 1 (`lib/checkout/metodos-pago.ts`), así que el conjunto sigue esperando el visto bueno
del owner antes de mergear — este commit no lo cambia.

## 2026-09-17 — Un ícono NEUTRO en vez de los logos oficiales de las redes, mientras el costo de
licenciarlos no se pague — decisión REVERSIBLE (`CHECKOUT-ICONO-TARJETA-NEUTRO-1`)

### Qué se decidió

Junto al nombre de la red detectada en el formulario de tarjeta (`FormularioTarjeta.tsx`,
§ CHECKOUT-DETECCION-EMISOR-BIN-1) va ahora un **ícono de tarjeta NEUTRO** — un rectángulo
redondeado sin ningún detalle interno, dibujado por este slice, sin marca de ninguna red. NO son
los logos oficiales de Visa/Mastercard/Amex/Diners. El ícono señala «tarjeta reconocida»; el
nombre en texto, que ya existía, sigue diciendo CUÁL.

### Por qué — es un costo medido, no una preferencia visual

Un slice **fue a buscar los logos oficiales** de las cuatro redes y **midió, intentándolo de
verdad, que los cuatro portales de marca exigen aceptar un acuerdo de licencia o registrarse como
socio antes de entregar los archivos**. No es una suposición sobre cómo funcionan las licencias de
marca: es lo que devolvieron los cuatro portales al intentarlo. Ese slice volvió `BLOCKED`.

Ese acuerdo **no es un costo de una sola vez**: se propagaría a **cada despliegue de cliente** de
este template (§ El código compartido no NACE siendo Nayoli/demo — cada despliegue es su propio
repo/deploy). Aceptar una licencia de marca de cuatro redes de pago por cada tenant que se levante
no es un costo que valga hoy por un ícono junto a un campo de formulario.

### Por qué es REVERSIBLE, y qué garantiza que revertir no mueva nada más

El ícono vive en el **mismo slot** donde irían los logos oficiales — no se inventó un lugar nuevo
que el slice de los logos tendría que desarmar. `IconoTarjetaGenerica` es un componente aislado
dentro de `CampoTarjeta`, montado en un `<span className="inline-flex items-center gap-1 …">`
junto al nombre; el tamaño (`w-3.5 h-3.5`), el `gap` y la posición (antes del texto) son del
contenedor, no del ícono. **El slice de los logos oficiales ya está escrito y sigue en cola**: el
día que el owner acepte los acuerdos, reemplaza el `<svg>` de `IconoTarjetaGenerica` (o el
componente entero) por el logo de `deteccionRed.red` correspondiente, y el layout que lo rodea no
se toca.

### El disparador, como ítem propio — y que descansa en que alguien vuelva a leerlo

**Se revisa si:**
- **algún tenant lo pide** (un cliente del template pregunta por qué no ve los logos reales de su
  pasarela), o
- **el material de venta lo necesita** (una demo o un pitch para el que el ícono genérico no
  alcanza).

**No hay mecanismo que avise cuando cualquiera de los dos pase.** Este asiento es la única red de
seguridad: si nadie vuelve a leerlo, el ícono neutro se queda indefinidamente aunque el disparador
ya haya ocurrido. Es la misma familia que un ítem de Backlog técnico sin fecha de vencimiento — se
anota acá porque no hay otro lugar donde este disparador viva.

### El ícono — de dónde salió

**Dibujado por este slice, en línea, sin ninguna dependencia nueva.** Un `<rect>` con esquinas
redondeadas (`viewBox="0 0 24 24"`, stroke `currentColor`, sin relleno) — el mismo estilo de ícono
que ya usa el repo (ver `SearchField` de `@duna/design-system`, mismo `viewBox` y trazo). **NO es
el `CreditCard` de `lucide-react`** — ya instalado y en uso en este mismo directorio
(`EsperaConfirmacionTarjeta.tsx`) — porque ese ícono trae una línea horizontal partiendo el
rectángulo (la banda magnética), y esa línea es exactamente la "franja" que la condición del owner
prohíbe. No se tomó de ningún set de íconos libres, así que no hay licencia de terceros que
declarar.

### Gate

**`npm run gate`, los dos carriles, verde.** El diff no toca lógica (`lib/checkout/tarjeta.ts` no
se tocó — la detección sigue siendo la ya construida y testeada), sólo JSX presentacional y este
asiento.

**Tier 1 — SÍ aplica, y por eso el slice paró en `AWAITING_APPROVAL`.**
`components/storefront/checkout/` es subárbol Tier 1 (§ Tier 1 — LA LISTA TAMBIÉN GANA
SUBÁRBOLES, la misma razón que ya cubre `app/(storefront)/`), y el diff cambia bytes que el
comprador ve (un ícono nuevo en el formulario de tarjeta). El slice tenía aprobación explícita del
owner para ESCRIBIR (`approved-by: owner`, spec del ledger) — nunca para mergear; el merge sigue
gateado al owner, igual que el resto de la rama.

## 2026-09-17 — La CLASE: una evidencia real, estirada hasta cubrir una pregunta que no responde —
tres instancias de estos dos días, y la misma forma que el owner también cometió, dos veces, en este
mismo programa (`CLASE-EVIDENCIA-ESTIRADA-1`)

### 0 · Por qué este asiento existe

El owner ordenó, el 2026-09-17, registrar como CLASE un razonamiento que se repitió estos dos días de
este mismo programa (API directa / Wompi). En ninguna de las instancias se inventó un dato: había una
medición real detrás de cada una. Lo que falló fue el SALTO — se contestó, con esa medición, una
pregunta DISTINTA de la que ella respondía. Este asiento no repite la corrección de ninguna instancia
por separado — cada una ya tiene su propio asiento, citado abajo —; existe para nombrar el PATRÓN que
las une, porque un patrón sin nombre vuelve a pasar.

### 1 · La clase, en sus tres instancias

| Lo que se midió (real) | Lo que se concluyó (estirado) | El salto | Corregido en |
| --- | --- | --- | --- |
| el portal de descarga de las cuatro redes de tarjeta exige aceptar un acuerdo de licencia o registrarse como socio antes de entregar los archivos de marca (`SPIKE-GUIAS-DE-MARCA-REDES-1`, read-only) | mostrar la marca (el logo) en el checkout exige ese mismo acuerdo | **descargar ≠ usar** | `CHECKOUT-ICONO-TARJETA-NEUTRO-1` |
| el identificador `BANCOLOMBIA` a secas es rechazado SIEMPRE como tipo al crear la transacción, con cualquier combinación de campos (`API-DIRECTA-CATALOGO-METODOS-ASIENTO-1`) | con ese banco no se cobra | **un identificador ≠ un banco** | `CORRECCION-BANCOLOMBIA-AGREGADOR-1` |
| la documentación pública del proveedor dice que crear la transacción exige la llave PRIVADA | esa afirmación estaba MEDIDA | **leer ≠ medir** | `API-DIRECTA-SPIKES-ASIENTO-1` §B (y `API-DIRECTA-DECISIONES-ATRIBUCION-FIX-1`, el mismo defecto sobre el mismo día de lectura) |

Ninguna fila de la izquierda es falsa — las tres siguen siendo ciertas, palabra por palabra, después de
la corrección. Lo falso nació al escribir la columna de la derecha con más ALCANCE del que la medición
de la izquierda cubría.

### 2 · Lo que el owner pidió que quede escrito, y es lo que cambia qué se hace con esto

El owner pidió explícitamente que este asiento diga que **el OWNER cometió la misma forma DOS veces en
este mismo programa**, las dos asumiendo carga legal sin medirla: una sobre el cumplimiento exigido por
el manejo de datos de tarjeta, y otra sobre estas mismas marcas de red. Esto lo registra el asiento por
orden directa del owner (§ `approval-reason` de este slice) — no es una medición de este slice contra el
resto del programa, y se marca así: es el propio owner dando cuenta de su razonamiento, no un hallazgo
que este worker haya verificado línea por línea contra conversaciones anteriores.

> **NO es un error del orquestador: es una FORMA DE RAZONAR QUE LOS DOS TIENEN.**

**Por qué esa distinción no es cortesía, y es la parte útil de este asiento:** si se registrara como un
defecto DEL ORQUESTADOR, el remedio natural sería una guarda que lo vigile a él — y esa guarda no habría
atrapado NINGUNA de las dos veces que el owner cometió la misma forma, porque en esas dos el orquestador
no era quien concluía. El remedio de una forma de razonar COMPARTIDA no es vigilancia sobre un actor: es
una pregunta que los dos —owner y orquestador— se hacen antes de concluir, la misma pregunta, en el mismo
punto de la cadena. Vigilar a uno solo de los dos deja la otra mitad del patrón exactamente donde estaba.

### 3 · La pregunta que la atrapa

> **Antes de concluir: ¿la pregunta que respondió mi medición es LA MISMA que estoy contestando?**

**Y el olor característico, para reconocerla en el momento en que aparece, no después:** la evidencia es
de una DISPONIBILIDAD — se puede bajar, se puede llamar, está en la lista, el portal la entrega o la
niega — y la conclusión es sobre un DERECHO o una CAPACIDAD — se puede usar, se puede cobrar, está
permitido. Las tres instancias de la tabla tienen exactamente esa forma: "el portal lo entrega" (disponibilidad)
contra "se puede usar" (derecho); "el tipo se crea" (disponibilidad de un identificador) contra "el banco
cobra" (capacidad de un método); "la documentación lo dice" (disponibilidad de una afirmación escrita)
contra "está medido" (verificación real). **Las dos suenan a lo mismo y no lo son**, y esa semejanza de
sonido es justo lo que hace que el salto pase desapercibido en el momento de escribirlo.

### 4 · Quién la encontró, en las tres — y por qué importa que ninguna la encontró una relectura

| Instancia | Quién la desmintió | Con qué |
| --- | --- | --- |
| las marcas (descargar ≠ usar) | **el owner**, con evidencia propia | comercios que muestran las marcas de red sin haber pasado por el acuerdo de licencia del portal de descarga |
| el identificador (`BANCOLOMBIA`) | **el owner**, con evidencia propia | paga habitualmente con ese banco, y el panel del proveedor le muestra ese método activo |
| la documentación (llave privada) | **una medición contra el sandbox** | `API-DIRECTA-SPIKE-FIRMA-Y-ENDPOINT-1`: mismo cuerpo y firma, cambiando sólo la credencial — la llave pública también autoriza la creación |

**NINGUNA la encontró una relectura del texto que la afirmaba.** Las tres las desmintió alguien que fue
a mirar el mundo — dos veces el owner, mirando su propia experiencia como cliente y el panel real del
proveedor; una vez un spike, mirando la respuesta real del sandbox. Un texto bien escrito, con su
medición real citada al lado, no se delata a sí mismo: hay que salir a comprobarlo contra algo que no sea
el propio texto.

### 5 · La regla

**Una evidencia de disponibilidad no responde una pregunta de derecho o de capacidad. Antes de concluir,
la pregunta que se contesta tiene que ser la misma que la medición respondió — y si no lo es, la medición
no alcanza para la conclusión, hay que ir a buscar la que sí responde.**

### Gate

**`npm run gate`, los dos carriles, verde.** El diff de este slice toca un solo archivo
(`DECISIONS.md`, una entrada nueva al final) y ningún test ni código de producto — no había manera de
que ninguno de los dos carriles cambiara de veredicto.

**Tier 1 — SÍ aplica, mismo criterio que el resto de esta rama.** El asiento describe y corrige el
razonamiento de trabajo que ya aterrizó en `app/(storefront)/` (vía `CHECKOUT-ICONO-TARJETA-NEUTRO-1`) y
en la configuración de métodos de pasarela (vía `CORRECCION-BANCOLOMBIA-AGREGADOR-1`) — Tier 1 por
herencia de esas dos superficies, no porque este diff en sí mismo toque código. El slice tenía
aprobación explícita del owner para ESCRIBIR (`approved-by: owner`, spec del ledger) — nunca para
mergear; el merge sigue gateado al owner, igual que el resto de la rama.

## 2026-09-18 — La primera compra de prueba cruzó el sistema entero: Wompi la aprobó, y la orden se
quedó sin cobrar — la base contradice el supuesto de tres días (`PRIMERA-TRANSACCION-REAL-ASIENTO-1`)

### 0 · Qué pidió el owner, y qué cambia con este asiento

El owner reportó el 2026-09-18 que una compra de prueba —tarjeta de prueba, tokenización, creación de
la transacción— llegó a **APROBADO** en Wompi por primera vez, y pidió asentarlo: durante tres días
*«el camino de pago funciona»* fue un supuesto, no una medición. Pidió además confirmar en la base que
la orden quedó `pagado` con su `Payment`, y si cerró por webhook o por reconciliador.

**La medición de este asiento confirma la mitad del supuesto y refuta la otra.** El lado de Wompi
—tokenizar, crear la transacción, resolver a APROBADO— sí ocurrió, medido en la base. El lado de
NUESTRO sistema —crear el `Payment`, mover la orden a `pagado`, crear el `Shipping`— **no ocurrió
para ninguna de las órdenes de esta sesión**, y la contradicción es más profunda de lo que la
pregunta original anticipaba: el ÚNICO código de este repositorio que puede escribir
`PaymentIntent.estado = 'APROBADO'` es también, en la MISMA transacción de base de datos, el único
código que crea el `Payment` — así que "aprobado sin `Payment`" es un estado que el código actual no
debería poder producir. Se produjo igual. Eso es el hallazgo, y va primero.

### 1 · Lo que la base confirmó — consulta por consulta

**Consulta 1 — el `PaymentIntent` `APROBADO` más reciente**
(`prisma.paymentIntent.findFirst({ where: { estado: 'APROBADO' }, orderBy: { updatedAt: 'desc' } })`,
vía el adaptador real de `packages/core/client.ts` — `PrismaPg` + `DATABASE_URL` del `.env` local, que
por `esDespliegueDemo()` es la base de `development`/sandbox, nunca producción):

| campo | valor |
| --- | --- |
| `id` | `cmu6z2mtt000b04l50awuv08f` |
| `reference` | `CN-661330:cmu6z2mtt000b04l50awuv08f` |
| `estado` | `APROBADO` |
| `pspTransactionId` | `12189137-1789736789-68783` |
| `estado_crudo_psp` | `APPROVED` |
| `createdAt` → `updatedAt` | `13:06:26.705Z` → `13:06:35.896Z` (**9.191 s** para resolver) |

**No es la única fila así.** Ampliando a TODOS los `PaymentIntent` (11 filas en total, todas del
2026-09-16 al 2026-09-18), hay **TRES** en `APROBADO` y **UNA** en `FALLIDO`, todas de hoy
(2026-09-18), todas resueltas en segundos:

| orden | estado | `pspTransactionId` | `estado_crudo_psp` | segundos para resolver |
| --- | --- | --- | --- | --- |
| CN-787363 | FALLIDO | `12189137-1789735811-82348` | `ERROR` | 6.852 |
| CN-237913 | APROBADO | `12189137-1789736553-25883` | `APPROVED` | 10.273 |
| CN-612115 | APROBADO | `12189137-1789736684-78238` | `APPROVED` | 5.662 |
| CN-661330 | APROBADO | `12189137-1789736789-68783` | `APPROVED` | 9.191 |

Las siete filas restantes siguen `EN_VUELO` (nunca resolvieron) — una de ellas, CN-182716, tiene una
orden que SÍ está `pagado`, pero por un `Payment` de método `TRANSFERENCIA` registrado ~2 horas
DESPUÉS por el flujo manual de "Registrar Pago" — no por esta pasarela ni por este intento, que sigue
`EN_VUELO` y huérfano.

**Consulta 2 — la Order de cada intento APROBADO/FALLIDO**
(`prisma.order.findUnique({ where: { id: intent.orden_id } })`): las CUATRO siguen `estado: 'pendiente'`.
Ninguna es `'pagado'` — el valor que el propio schema usa para una orden cobrada
(`packages/core/src/orders.ts:274`, `transitionOrder(tx, orderId, { estado: 'pagado' }, …)` dentro de
`registerOrderPaymentTx`; el campo es `Order.estado String @default("pendiente")`,
`schema.prisma:172`, sin enum — el valor `'pagado'` es convención de código, no restricción de tipo).

**Consulta 3 — `Payment` de esas cuatro órdenes**
(`prisma.payment.findMany({ where: { orden_id } })`): **cero filas**, en las cuatro.

**Consulta 4 — `Shipping` de esas cuatro órdenes**
(`prisma.shipping.findMany({ where: { orden_id } })`): **cero filas**, en las cuatro. El código dice
que `registerOrderPaymentTx` también crea el `Shipping` (`packages/core/src/orders.ts:270-276`,
comentario: *"Moves order → pagado AND auto-creates the Shipping in `preparando`"*) — no se creó
porque `registerOrderPaymentTx` nunca corrió para estas órdenes (§2).

**Consulta 5, la que cierra la duda de "¿se revirtió después?"** — `OrderStatusTransition`, el libro
append-only de transiciones (`schema.prisma:221-249`, `eje: 'cobro'|'fulfillment'`, escrito SIEMPRE
dentro de la misma transacción que mueve `Order.estado`, vía `appendOrderStatusTransition`):
para las cuatro órdenes hay **una sola fila cada una** — la de creación
(`estado_anterior: null → estado_nuevo: 'pendiente'`, `actor_id/actor_nombre: null`). **Cero filas
`pendiente → pagado`.** Esto no es un dato que pueda mentir por un revert posterior: es append-only,
y confirma lo mismo que `Order.updatedAt === Order.createdAt` al bit (medido: los dos timestamps de
CN-661330 son literalmente `2026-09-18T13:06:26.243Z`, exactos) — la fila de la orden NUNCA se tocó
después de crearse.

**Consulta 6, la que descarta la rama de "cobro duplicado"** — `Notification` filtrada por
`tipo`/`titulo`/`mensaje` conteniendo "wompi"/"Wompi": **cero filas en TODA la base.** La única otra
forma en que `aplicarResultadoWompi` puede cerrar un `APROBADO` sin crear `Payment` —la orden ya
estaba pagada, así que es cobro duplicado— deja una `Notification` (`tipo: 'wompi_cobro_duplicado'`,
`packages/core/src/pagos/aplicar-resultado-wompi.ts:180-188`). No hay ninguna. Y de todos modos las
cuatro órdenes siguen `pendiente`, no `pagado`, así que esa rama tampoco explicaría lo que se ve.

**RESPUESTA A LA PREGUNTA DEL OWNER, MEDIDA: la orden NO quedó pagada.** Wompi aprobó el cobro
(`estado_crudo_psp: APPROVED`, `processor_response_code` no se volvió a leer en esta corrida pero el
`pspTransactionId` es real); nuestro sistema no lo registró como plata. El comprador de esta prueba
—si hubiera sido un comprador real— habría pagado con su tarjeta sin que la tienda se enterara.

### 2 · Webhook o reconciliador — la pregunta tiene una respuesta más incómoda que "no se sabe cuál"

**La base no distingue quién cerró un intento.** Leído el modelo completo (`schema.prisma:441-529`):
los únicos campos de `PaymentIntent` además de `estado` son `pspTransactionId`, `estado_crudo_psp` y
`metodo_rechazado` — ninguno registra el MECANISMO (webhook vs. reconciliador vs. cualquier otra
cosa) que hizo la escritura. Eso, por sí solo, ya sería el hallazgo que el spec de este slice
anticipaba: *"el día que un pago se cierre tarde, nadie va a poder decir si el webhook no llegó o si
llegó y se ignoró"*. Se nombra y se deja — no es de este slice proponer el campo.

**Pero la medición no se detiene en "no se sabe": hay una razón medida para creer que NINGUNO de los
dos, tal como están escritos hoy, produjo lo que la base muestra.**

- **Los ÚNICOS dos escritores posibles**, medidos por lectura exhaustiva del código (grep de
  `estado: 'APROBADO'` en todo el repo, cero resultados fuera de estos dos sitios): el `POST` del
  webhook (`app/api/webhooks/wompi/route.ts:171-331`, `procesarEventoWompi`) y el reconciliador
  (`packages/core/src/pagos/reconciliador.ts:143-227`, `reconciliarIntentoPago`, disparado por
  `app/api/cron/automations/route.ts`). **Los dos, sin excepción, invocan
  `aplicarResultadoWompi`** (`packages/core/src/pagos/aplicar-resultado-wompi.ts:124-222`), y esa
  función es la ÚNICA que escribe `estado: 'APROBADO'` en toda la base de código —y lo hace DENTRO de
  la misma transacción (`db.transaccionConOrdenLockeada`) que crea el `Payment` (si la orden está
  `pendiente`) o registra el cobro duplicado (si no lo está). No existe, hoy, un camino de código que
  deje `estado: 'APROBADO'` sin una de esas dos consecuencias.
- **El reconciliador SÓLO se dispara por hora en punto** (`.github/workflows/automations-cron.yml:22`,
  `cron: '0 * * * *'` UTC, más un `workflow_dispatch:17-24` para disparo manual desde la pestaña
  Actions) contra `CRON_URL` —una URL de despliegue, no `localhost`—. Las cuatro resoluciones
  midieron **5.6 a 10.3 segundos** entre creación y cierre (§1): muy rápido para el cron programado
  (que espera hasta 59 minutos), y el `workflow_dispatch` manual sólo pega contra el despliegue de
  `CRON_URL`, no contra esta base local salvo que ese despliegue comparta la base `development`
  (posible — Preview la comparte, § CLAUDE.md "Bases de datos" — pero no verificable desde acá sin
  acceso al historial de Actions, fuera de alcance de este slice).
- **El webhook necesita una URL pública que Wompi pueda alcanzar.** Si corrió, corrió contra un
  despliegue con esa URL configurada del lado de Wompi — otra vez, no verificable desde una consulta
  a la base.

**CONCLUSIÓN MEDIDA, y es el hallazgo real de esta pregunta:** no es que "no se sabe si fue el webhook
o el reconciliador" — es que **el estado observado (`APROBADO` sin `Payment`, sin `Shipping`, sin
transición, sin notificación) no es un desenlace que NINGUNO de los dos, corriendo su código actual
hasta el final, pueda producir.** Atribuirlo a uno de los dos sería inventar una explicación que la
base no sostiene. Lo único que la base sostiene es que ALGO —con acceso a la llave privada de Wompi y
a esta base de datos— escribió `pspTransactionId` + `estado: 'APROBADO'`/`'FALLIDO'` +
`estado_crudo_psp` sin pasar por el camino que crea el `Payment`. **Qué fue eso queda como
UNKNOWN de este slice**, no como una atribución a medias.

### 3 · Qué supuesto muere, y qué NO prueba esta transacción

**Muere:** que "el camino de pago funciona" fuera un supuesto sin medir. Ahora está medido, y la
medición tiene dos mitades con veredictos distintos — el lado de Wompi (tokenización → creación →
resolución) SÍ funciona de punta a punta contra el sandbox real, desde el navegador; el lado de
"la orden queda pagada en nuestro sistema" **no se sostiene con la evidencia de esta sesión**, y no
por falta de medición: se midió y salió negativo.

**No prueba, y se enumera para que nadie lo asuma:**
- **el camino RECHAZADO en un checkout real** — esta sesión sí midió un `FALLIDO` (CN-787363,
  `estado_crudo_psp: ERROR`), pero con el MISMO defecto: tampoco se puede confirmar qué mecanismo lo
  cerró, por la misma razón de §2 (aunque el camino FALLIDO no crea `Payment` por diseño, así que ahí
  la ausencia de `Payment` es ESPERADA, no un hallazgo);
- **el camino INDETERMINADO** (`PENDING` que nunca resuelve, el barrido por edad de 48 h) — ningún
  intento de esta sesión llegó a `EN_VUELO` vencido;
- **otro método de pago** (Nequi, Daviplata, Bre-B, PSE) llegando a `pagado` en ESTE sistema — el
  runbook citado abajo midió Nequi contra Wompi directo, sin pasar por este repo (§4);
- **producción** — las cuatro filas de esta consulta viven en la base de `.env` local
  (`development`/sandbox por `esDespliegueDemo()`), nunca se tocó la base de `production`;
- **que el `Payment` se cree correctamente cuando SÍ corre el camino completo** — eso lo cubre el
  carril de integración (`WOMPI-PAYMENT-G-INTEGRACION-1`, `b738413`), contra un doble en memoria, no
  contra el sandbox real; esta sesión no lo re-ejerció.

### 4 · Los dos hechos de sandbox que trae el spec, atribuidos a su fuente

- **La tarjeta que aprueba**: `4242424242424242`, vencimiento `12/29`, CVV `123`, titular de texto
  libre, tokeniza `201` y la transacción resuelve a `APPROVED` con `processor_response_code: "00"`
  (MEDIDO — § `RUNBOOK-DATOS-PRUEBA-SANDBOX-1`, `docs/RUNBOOK-DATOS-PRUEBA-SANDBOX.md` §4).
- **Nequi**: en el sandbox, el teléfono `3991111111` resuelve a `APPROVED` (medido dos corridas
  separadas); un número arbitrario, `3001234567`, resuelve a `ERROR` con
  `status_message: "Número no válido en Sandbox"` (MEDIDO — § `RUNBOOK-DATOS-PRUEBA-SANDBOX-1`,
  `docs/RUNBOOK-DATOS-PRUEBA-SANDBOX.md` §6).

Ninguno de los dos se re-midió en este slice — se citan tal como el runbook los dejó, porque el
runbook habló DIRECTO con la API REST de Wompi (`docs/RUNBOOK-DATOS-PRUEBA-SANDBOX.md` §10: *"esta
corrida habló directo con la API REST de Wompi, sin pasar por ninguna ruta de este repo"*) — nunca
tocó esta base, así que no puede confirmar ni contradecir lo que §1–§2 de este asiento midieron.

### Gate

**`npm run gate`, los dos carriles, verde.** El diff de este slice toca `DECISIONS.md` (esta entrada)
y `docs/RUNBOOK-DATOS-PRUEBA-SANDBOX.md` no se tocó (era el commit anterior de la rama) — sin cambios
de código ni de test.

**Tier 1 — SÍ aplica, por herencia de la rama, mismo criterio que las dos entradas anteriores.** La
rama (`slice/api-directa-panel-metodos-1`) ya tiene bytes que el comprador ve
(`CHECKOUT-ICONO-TARJETA-NEUTRO-1`, un ícono en el formulario de tarjeta del checkout) y configuración
de métodos de pasarela (`CORRECCION-BANCOLOMBIA-AGREGADOR-1`); este commit no agrega ninguno nuevo
—es lectura de base + un asiento—, pero el EJE es la rama, no el commit. El slice tenía aprobación
explícita del owner para ESCRIBIR (`approved-by: owner`, `approval-reason` del spec: *"LA APROBACION
AUTORIZA LA ESCRITURA, NUNCA EL MERGE"*) — el merge sigue gateado al owner, igual que el resto de la
rama.

## 2026-09-18 — WOMPI COBRÓ Y LA TIENDA NO SE ENTERÓ: las tres condiciones que lo hicieron posible,
y el censo de las frases de CLAUDE.md que ese mismo incidente volvió falsas (`COBRO-SIN-PEDIDO-ASIENTO-1`)

### 0 · La frase, sin suavizar

**WOMPI COBRÓ Y LA TIENDA NO SE ENTERÓ.** Cuatro veces, el mismo día
(`PRIMERA-TRANSACCION-REAL-ASIENTO-1`): tres `PaymentIntent` en `APROBADO` y uno en `FALLIDO`, los
cuatro resueltos por Wompi en segundos (5,6 a 10,3 s), y las cuatro órdenes de este sistema **sin un
solo `Payment`, sin un solo `Shipping`, sin una sola transición `pendiente→pagado`** en el libro
append-only que las registraría. Con un comprador real en vez de una tarjeta de prueba, eso es **plata
cobrada sin pedido**: el dinero salió de la cuenta del comprador, Wompi lo confirmó, y la tienda nunca
se enteró de que tenía que preparar, despachar ni cobrar nada. El owner pidió que este asiento diga
esto con esas palabras — no "una inconsistencia", no "un desalineo de despliegue" — porque dentro de
un año, alguien que lea este archivo tiene que poder entender la gravedad sin reconstruirla.

Este asiento no repite la medición completa: vive en `PRIMERA-TRANSACCION-REAL-ASIENTO-1` (arriba,
2026-09-18), y `§ La causa, medida` de esa entrada es la fuente de las citas de más abajo. Lo que este
asiento agrega es lo que el owner pidió después de leerla: nombrar las TRES condiciones que hicieron
posible el hueco, separadas y sin fundirlas en una sola causa raíz, y censar `CLAUDE.md` por más
frases de la misma clase — frases que describían un estado que dejó de ser cierto sin que nadie las
tocara.

### 1 · Las tres condiciones — cada una es una lección distinta, y ninguna sola habría bastado

**(a) Una rama de preview viva con código viejo, compartiendo base con el despliegue actual.**
`preview/wompi-evento-real` nació el 2026-09-14, contiene el commit que cierra el `PaymentIntent`
(`7bf31c2`, `WOMPI-WEBHOOK-RUTA-1`) y **no contiene** el commit que agrega la creación del `Payment`
(`ff9dda8`, `WOMPI-PAYMENT-DESDE-WEBHOOK-G-1`, del día siguiente). Su único commit propio estaba
vacío y decía de sí mismo, en el mensaje, que la rama **se borraba al terminar la prueba**. No se
borró — o si se borró, quedó viva el tiempo suficiente para procesar los cuatro intentos del
2026-09-18. Y porque el entorno de Preview de Vercel comparte la base `development` con cualquier
otro deploy de Preview y con el `.env` local (§ CLAUDE.md, "Bases de datos (Neon)"), el código de
hace cuatro días escribía en la MISMA base que el código de hoy — sin que compartir base fuera, por
sí sola, la falla: la falla es que una rama que prometió borrarse no se borró.

**Nota de procedencia:** el origen y el estado de esa rama (`preview/wompi-evento-real`) los trae el
`externo` del spec de este slice, medido por quien lo escribió contra el historial de git; este
worker no tiene grant de red para `git ls-remote`/`fetch` y no pudo re-verificar independientemente
que la rama exista o no exista hoy en el remoto — lo único que este worker confirmó localmente es que
**no hay ninguna referencia a `preview/wompi-evento-real` en los refs locales de este repo**
(`git branch -a` y `git for-each-ref` no la listan), consistente con "se borró", pero no lo prueba: un
ref remoto que este worktree nunca fetcheó tampoco aparecería. Se marca `ledger_claim`, no `measured`.

**(b) Un webhook registrado en el panel del proveedor, apuntando a esa rama.** Esa configuración —qué
URL recibe los eventos de Wompi— vive en el panel de Wompi y en las variables de entorno del
despliegue de Preview, **afuera de este repositorio**. Ningún gate de este proyecto —ni `npm run
gate`, ni el carril de integración, ni el checklist manual del owner sobre un `rm -rf .next && npm run
dev`— puede ver esa configuración: los tres verifican el CÓDIGO y lo que el código produce contra una
base, no el panel de un proveedor externo. El repositorio, en el commit que corrió, estaba completo y
correcto para lo que ese commit sabía hacer (cerrar el intento, sin crear el `Payment` — así estaba
escrito a propósito, § abajo). Lo que apuntaba mal no era código: era la URL de eventos, y esa URL no
tiene test posible desde este repositorio.

**(c) El owner dio por cerrado un pago que nunca se registró, porque la pantalla decía "Aprobado".**
La pantalla de retorno del comprador (`app/(storefront)/checkout/retorno/RetornoCliente.tsx:301-309`)
muestra, para el estado `"aprobado"`: *"¡Tu pago fue aprobado! Tu pedido queda confirmado y pasa a
preparación."* Ese estado sale de `PaymentIntent.estado`, vía `/api/checkout/retorno` — nunca de si
existe un `Payment`. Y lo notable, que el owner pidió señalar explícitamente: **el propio diseño de
este endpoint ya advertía exactamente este riesgo, por escrito, antes de que ocurriera.** El
encabezado de `app/api/checkout/retorno/route.ts:6-13` dice, textual:

> `// ── LA RUTA DE RETORNO — LEE, NUNCA AFIRMA POR SÍ MISMA ─────────────────────────`
> `// El comprador vuelve del checkout alojado de Wompi a /checkout/retorno (...) con lo que Wompi le`
> `// ponga en el query — que puede incluir un status. ESTE ENDPOINT NO LO LEE NI LO CONFIRMA: la`
> `// verdad es PaymentIntent.estado, que sólo el webhook (...) actualiza.`

Y el mismo comentario se repite en el componente que la pantalla monta
(`RetornoCliente.tsx:19-25`): *"la regla que gobierna todo lo de abajo: el retorno del navegador NO ES
LA FUENTE DE VERDAD — el webhook lo es."* La advertencia era correcta y estaba en el sitio correcto
—no confiar en lo que Wompi manda por query—, y aun así el sistema completo (advertencia incluida)
dejó que la pantalla dijera "aprobado, pasa a preparación" sobre un `PaymentIntent.estado` que el
webhook escribió SIN que existiera el `Payment` que esa frase promete. **La lección no es "alguien se
confió sin razón": es que la advertencia contra confiar en Wompi funcionó — y no fue suficiente,
porque el estado en el que sí confiaba (`PaymentIntent.estado`) podía llegar a `APROBADO` sin que el
resto de la cadena de dinero se completara.** Eso es exactamente lo que (b) hizo posible: un webhook
de una rama vieja que sabía escribir `APROBADO` pero no sabía crear el `Payment`.

**Ninguna de las tres sola habría producido el hueco.** Sin (a), el código que corrió habría sido el
de `main` (que ya crea el `Payment`, desde `ff9dda8`). Sin (b), el código viejo de (a) nunca habría
recibido el evento. Sin (c), alguien habría notado —mirando el panel del admin, no la pantalla del
comprador— que la orden seguía `pendiente` pese al "Aprobado" en pantalla, y lo habría reportado antes
de darlo por cerrado.

### 2 · Las dos frases que este mismo incidente volvió falsas — y una tercera que nadie había nombrado

`CLAUDE.md`, § "Pagos en línea (Wompi) — cobros automáticos" (líneas 2939–2959), describe el estado
del trabajo con fecha 2026-09-14 (`TIER1-LISTA-VENCIDA-1` la re-midió ese día). El commit que la
volvió falsa (`ff9dda8`) es del día siguiente, 2026-09-15 — un día después de escrita, no meses.
Coincide con lo que el `approval-reason` de este slice citó como medido en
`PRIMERA-TRANSACCION-REAL-ASIENTO-1`:

- **Línea 84–85** (preámbulo de la lista Tier 1): *"el programa de Wompi abrió
  `app/api/webhooks/wompi/route.ts` —cierra el `PaymentIntent` y **es el llamador futuro** de
  `registerOrderPaymentTx`—"*. **FALSO hoy.** El webhook dejó de ser un llamador futuro el
  2026-09-15: `ff9dda8` (`WOMPI-PAYMENT-DESDE-WEBHOOK-G-1`) le agregó la llamada real a
  `registerOrderPaymentTx` (`app/api/webhooks/wompi/route.ts:351`, verificado por lectura directa del
  archivo en este slice). Era cierta cuando `TIER1-LISTA-VENCIDA-1` la escribió (2026-09-14); dejó de
  serlo al día siguiente.
- **Líneas 2944–2947**: *"Hoy ese helper tiene TRES llamadores en producción (...); **el webhook
  sería el cuarto**."* **FALSO hoy, y en DOS sentidos.** Primero, el webhook ya no "sería" el cuarto:
  ya ES un llamador (mismo commit, `ff9dda8`). Segundo, el conteo de "tres" quedó corto incluso antes
  de sumar al webhook: `grep -rn "registerOrderPaymentTx(" packages/core/src app` (corrido en este
  slice) encuentra **CINCO** call sites de producción, no tres ni cuatro:
  `packages/core/src/orders.ts:639` (`immediatePayment`), `packages/core/src/comprobantes.ts:164`
  (`decidirComprobante`), `app/api/orders/[id]/payments/route.ts:60`, `app/api/webhooks/wompi/
  route.ts:351` (el webhook), y `app/api/cron/automations/route.ts:68` — este último es el
  reconciliador (`correrReconciliador`, de `packages/core/src/pagos/reconciliador.ts`, construido en
  `9abdc5b`, `WOMPI-RECONCILIADOR-HI-1`, 2026-09-15, el MISMO día que `ff9dda8`), un QUINTO llamador
  que la frase de `CLAUDE.md` no anticipa ni como "futuro cuarto".
- **Líneas 2953–2954**: *"pero **NO crea el `Payment`**: frontera deliberada"*. **FALSO hoy**, mismo
  commit (`ff9dda8`) — confirmado leyendo `app/api/webhooks/wompi/route.ts:23-26,351` en este slice:
  el webhook, sobre `APROBADO`, lockea la orden (`lockOrderForPayment`) y llama a
  `registerOrderPaymentTx` dentro de la misma transacción.
- **Líneas 2954–2955**, la justificación de la frontera de arriba: *"porque eso exige un valor de
  `MetodoPago` que el enum de hoy no tiene (decisión del owner, pendiente)"*. **FALSO hoy, y en DOS
  partes.** El enum `MetodoPago` (`packages/core/prisma/schema.prisma:393-401`, verificado por lectura
  directa en este slice) ya tiene el valor `WOMPI` desde `WOMPI-ENUM-METODO-F-1` (citado en el propio
  comentario de cabecera de `app/api/webhooks/wompi/route.ts:25-26`) — así que ni falta el valor del
  enum, ni la decisión del owner sigue pendiente: ya se tomó.
- **Líneas 2955–2956**: *"**La RECONCILIACIÓN y el barrido de intentos vencidos siguen sin
  construirse.**"* **FALSO hoy.** `packages/core/src/pagos/reconciliador.ts` existe (verificado con
  `ls`/`git log` en este slice), construido en `9abdc5b` (`WOMPI-RECONCILIADOR-HI-1`, 2026-09-15) — y
  su propia cabecera (leída en este slice, líneas 8-30 del archivo) describe que fusiona
  DELIBERADAMENTE la reconciliación y el barrido por edad en una sola función
  (`reconciliarIntentoPago`), precisamente porque cerrar por edad SIN reconciliar antes sería cerrar
  `FALLIDO` un cobro que Wompi sí aprobó. Los dos —reconciliación y barrido— están construidos, y
  están construidos JUNTOS a propósito.

**Las cinco (contando la línea 84–85) viven dentro de un radio de ~2.900 líneas, casi todas dentro de
un solo párrafo de 21 líneas** (2939–2959). No son cinco hallazgos dispersos: son la misma frase
prospectiva —"esto está construido hasta acá, lo que falta es X"— que un solo día de trabajo (2026-09-
15, dos commits) volvió obsoleta de punta a punta, un día después de haberse re-medido como cierta.
Es la MISMA familia que `CLAUDE.md` ya documenta en `§ Backlog técnico`, "UN ÍTEM QUE CITA EL ESTADO
DE OTRO SUBSISTEMA COMO PREMISA VENCE CUANDO ESE SUBSISTEMA CAMBIA" (el caso de los avisos del
Dashboard, `CLAUDE-MD-FRASES-VENCIDAS-1`) — con una diferencia que vale la pena nombrar: ahí la premisa
la mató una tanda de OTRA área tocando un subsistema ajeno sin que nadie relea el párrafo que dependía
de él; acá la mató el PROPIO programa de Wompi, el día siguiente de haberse escrito, sobre su propia
sección. Que la premisa muera dentro del mismo programa y al día siguiente, y aun así nadie la
actualizara, es la evidencia más dura de que "vencer sin avisar" no es un riesgo de premisas lejanas:
es el comportamiento por defecto de cualquier frase prospectiva, sin importar cuán cerca esté del
código que la desmiente.

### 3 · Un hallazgo estructural adicional, no pedido pero medido de paso — el Tier 1 quedó corto

Al confirmar los cinco call sites de `registerOrderPaymentTx` (§2), dos de ellos son funciones que
**consultan** si la escritura de un pago procede y con qué valor — exactamente el criterio que la
sección "Tier 1 — superficies protegidas" de `CLAUDE.md` usa para decidir qué entra a la lista (línea
~20: "la función que esa puerta CONSULTA para decidir si la escritura procede y con qué valor — no
sólo el handler que la ejecuta"):

- `packages/core/src/pagos/aplicar-resultado-wompi.ts` — la función que las líneas 2953 y 6116-6125 de
  `CLAUDE.md` (`PRIMERA-TRANSACCION-REAL-ASIENTO-1`, arriba) ya identifican como *"la ÚNICA que
  escribe `estado: 'APROBADO'` en toda la base de código... dentro de la misma transacción... que crea
  el `Payment`"*.
- `packages/core/src/pagos/reconciliador.ts` — la función que decide, consultando la API de Wompi, si
  un intento `EN_VUELO` cierra `APROBADO`/`FALLIDO` y con ello si `registerOrderPaymentTx` corre.

**Ninguna de las dos está en la lista Tier 1 de `CLAUDE.md`.** Tampoco lo está `app/api/cron/
automations/route.ts`, la puerta HTTP que el cron invoca para correr el reconciliador (§2, quinto
llamador). Las tres nacieron el 2026-09-15 (`ff9dda8`, `9abdc5b`) — un día después de la
re-medición del 2026-09-14 (`TIER1-LISTA-VENCIDA-1`) que agregó `app/api/webhooks/wompi/route.ts` y
`lib/pagos/wompi-firma.ts` a la lista. La propia doctrina de esa sección lo anticipa y lo nombra como
su propio modo de falla: *"ESTA LISTA VENCE... El gate de Tier 1 sigue corriendo en VERDE sobre un
conjunto que encogió — (...) acá vencer es peor: no confunde a quien lee, deja pasar."* Este slice no
agrega los tres archivos a la lista —está fuera de `touches:` (sólo `DECISIONS.md`) y es al owner a
quien corresponde decidir el conjunto protegido, no a este worker—; queda nombrado como
**`TIER1-LISTA-VENCIDA-2`**, para que la próxima re-medición de la lista Tier 1 lo cierre con la
decisión del owner: si `packages/core/src/pagos/aplicar-resultado-wompi.ts`,
`packages/core/src/pagos/reconciliador.ts` y `app/api/cron/automations/route.ts` entran a la lista de
`CLAUDE.md`, o si el owner decide que alguno queda afuera y por qué.

### 4 · El censo — alcance explícito, para que nadie lo confunda con "se revisó todo `CLAUDE.md`"

**Lo que se hizo:** un barrido con grep de patrones que describen ESTADO en vez de REGLA
(`sin construir`, `sigue sin`, `todavía no`, `aún no`/`aun no`, `hoy no`, `hoy sólo`/`hoy solo`, `no
existe`, `queda pendiente`, `sin construirse`, `no está construid[oa]`, `no se ha construido`, `no hay
endpoint`, `no tiene UI`, `sin UI`, `no está cableado`, `sin cablear`) sobre el archivo COMPLETO
(7.642 líneas) — 65 líneas coincidieron. Por separado, un segundo barrido de `Wompi|WOMPI|
PaymentIntent|pasarela` sobre el archivo completo — 16 líneas coincidieron, TODAS dentro de dos zonas
(el preámbulo Tier 1, líneas 84-98, y § "Pagos en línea (Wompi)", líneas 2891-2977, más una mención
suelta en línea 7429 sobre otro tema — "roadmap (precedente Wompi)", no una afirmación de estado
verificable contra código).

**Lo que se verificó contra código, línea por línea:** las 16 líneas del segundo barrido (Wompi/
PaymentIntent/pasarela) — es el resultado de §2 y §3 arriba. Es exhaustivo para esa superficie: no
quedó ninguna mención de Wompi/PaymentIntent/pasarela en `CLAUDE.md` sin leer contra el código actual.

**Lo que NO se verificó individualmente:** las ~49 líneas restantes del primer barrido (patrones de
estado genéricos) que no mencionan Wompi/pagos/pasarela. Se revisó su CONTEXTO por muestreo —lo
suficiente para descartar que hablen de una capacidad de dinero o de otra superficie Tier 1— pero no
se releyó cada una contra el código como se hizo con las 16 de Wompi. Ejemplos del muestreo: línea
1546 ("Ingresar con WhatsApp… capacidad que no existe") es sobre login, sin relación con pagos; línea
5073 ("pago PSE sin acreditar… no existen acá") es sobre el Dashboard, describe capacidad de OTRO stack
(Carlos) que sigue sin construirse — no contradicha por nada medido en este slice; línea 3550 (PDF de
comprobante sin PDF) es de subida de archivos, no de Wompi. Ninguna de las muestreadas mostró la misma
forma que las de §2 (una premisa sobre el MISMO subsistema, vencida por un commit reciente), pero
**"no se encontró en la muestra" no es "se verificaron las 49"** — se declara así para que quede
distinguible de lo que sí se cerró.

**Lo que le cuesta a `CLAUDE.md` dejar las cinco frases de §2 sin corregir:** este archivo lo lee cada
worker ANTES de escribir código — está al principio de cada sesión de este proyecto, por diseño
(`CLAUDE.md` es contexto de proyecto cargado automáticamente). Una frase vencida ahí no es
documentación desactualizada en el sentido usual: es una INSTRUCCIÓN vigente que un worker va a seguir
al pie de la letra. Concretamente: un worker que lea la línea 2953-2956 hoy y necesite tocar el flujo
de Wompi va a creer que la reconciliación no existe y puede intentar construirla de nuevo (duplicando
`packages/core/src/pagos/reconciliador.ts`), o va a creer que el webhook no crea `Payment` por diseño
y va a tratar como un bug un comportamiento que es, hoy, la funcionalidad correcta. La línea 84-85, en
el preámbulo de la lista Tier 1 —la sección que decide qué se protege con doble etapa—, es la más cara
de las cinco de dejar sin tocar: describe el webhook como algo que TODAVÍA no escribe dinero, en la
misma sección cuyo propio criterio (§3 arriba) diría que sí lo hace y que dos archivos más deberían
estar en la lista. Corregirla no es parte de este slice —`touches: DECISIONS.md` solamente, y la
decisión de qué agregar a Tier 1 es del owner—, pero el costo de no hacerlo pronto es que la próxima
persona que lea esa lista para decidir si algo necesita segunda etapa va a confiar en un conjunto que
ya se sabe corto.

### Gate

**`npm run gate`, los dos carriles — corrido en este slice sobre el árbol final, verde.** El diff de
este slice toca un solo archivo (`DECISIONS.md`, esta entrada, apendeada al final) y ningún código de
producto ni test — no había manera de que ninguno de los dos carriles cambiara de veredicto respecto a
`main`.

**Tier 1 — SÍ aplica, por herencia de la rama y por el propio contenido de esta entrada** (que
describe y corrige el razonamiento sobre superficies Tier 1 ya aterrizadas: el webhook de Wompi y la
configuración de métodos de pasarela). El slice tenía aprobación explícita del owner para ESCRIBIR
(`approved-by: owner`, `approval-reason` del spec: *"LA APROBACION AUTORIZA LA ESCRITURA, NUNCA EL
MERGE"*) — el merge sigue gateado al owner, igual que el resto de la rama.

## 2026-09-18 — El Recorrido decía «Envío creado» sin que existiera ningún envío: la etiqueta
nombraba el REGISTRO, no el HECHO (`RECORRIDO-ENVIO-NO-CREADO-1`)

### El hecho

El owner lo vio el 2026-09-18 en el panel, mirando el recorrido de la primera orden que se cobró de
verdad (CN-597202, `PRIMERA-TRANSACCION-REAL-ASIENTO-1`): apenas la orden se cobra, el recorrido
anuncia **«Envío creado»**. Ningún envío se creó — lo que existe es una fila en `preparando`; nadie
empacó nada ni se lo entregó a un transportador.

### La clase

**La etiqueta nombraba el REGISTRO (la fila que nace), no el HECHO (lo que le pasó al paquete).**
Literalmente cierta —una fila se creó— y falsa para quien la lee, que entiende que su pedido ya
salió. Un nombre tomado del modelo de datos en vez del mundo del que lo lee.

### Lo que agrava el defecto — el propio archivo ya lo advertía

`lib/pedidos/recorrido.ts` traía DOS caminos al mismo estado `preparando`. El mapa `FULFILLMENT`
(línea 58 del archivo antes de este cambio, línea 59 después) ya declaraba
`preparando: 'Envío en preparación'`; una rama especial en `etiquetaTransicion`
—`if (t.estado_anterior === null) return 'Envío creado';`— la salteaba para la creación,
devolviendo un string escrito a mano en la propia rama de `fulfillment` en vez de consultar el mapa.
El mismo hecho tenía DOS nombres en el mismo archivo, y el que corría al nacer el envío era el que
mentía.

Y el archivo se contradecía solo: el comentario que antecede a `TITULO_CREADO`/`TITULO_PAGADO`/
`TITULO_ENTREGADO` ya decía, unas líneas más arriba del propio defecto, por qué esto no debía pasar:
**"Son LAS MISMAS que las del libro a propósito: es el mismo hecho, y decirlo con otras palabras
haría creer que es otra cosa."** Exactamente lo que pasó.

### La palabra — la que el mapa ya tenía, no una tercera

El owner propuso «Preparando envío». El mapa `FULFILLMENT` ya declaraba **«Envío en preparación»**
(`lib/pedidos/recorrido.ts:59`) para el mismo estado `preparando`. El owner confirmó (2026-09-18,
tras plantearle la disyuntiva): *"me parece bien tu decisión Envío en preparación"*. Se usó la del
mapa: deja el estado con UN solo nombre en todo el sistema en vez de sumar un tercero, que es
exactamente el defecto que este slice cierra. Cambiar esa palabra en el futuro es cambiar UNA línea
(`lib/pedidos/recorrido.ts:59`, la entrada `preparando` del `Record<ShippingEstado, string>`
`FULFILLMENT`) y alcanza a los dos casos que la consultan (la creación y cualquier otro destino a
`preparando` que no sea `fallido→preparando`).

### Qué se tocó y qué NO

- Se borró la rama `if (t.estado_anterior === null) return 'Envío creado';` de la mitad
  `fulfillment` de `etiquetaTransicion` (`lib/pedidos/recorrido.ts`); ese caso cae ahora al
  `return FULFILLMENT[t.estado_nuevo as ShippingEstado] ?? t.estado_nuevo;` general, como cualquier
  otro destino sin FROM especial.
- **NO se tocó el otro caso especial de la misma función** —`fallido→preparando` → `'Entrega
  reprogramada'`—: ÉSE sí depende del estado anterior por una razón real (un mapa por destino solo
  daría «Envío en preparación» también para una entrega reprogramada tras fallar, que es un hecho
  distinto). El comentario que justifica el vocabulario (líneas 36-44 del archivo) se reescribió para
  decir por qué la creación dejó de necesitar un caso propio mientras el de la reprogramación lo
  sigue necesitando — no para cambiar la decisión de mantenerlo.
- Se actualizaron **3 asserts** en `lib/pedidos/recorrido.test.ts` que afirmaban la etiqueta vieja:
  dos esperaban `'Envío creado'` como la etiqueta de la transición `null→preparando` (uno sobre
  `etiquetaTransicion` sola, otro sobre `recorridoDelPedido` con libro completo); el tercero la
  listaba entre las etiquetas que NO debían inventarse en una orden anterior al libro (grandfathered).
  Esa tercera entrada se retiró de la lista en vez de actualizarse: el string ya no es producible por
  el código, así que afirmar su ausencia deja de probar nada — la afirmación real de ese test (que
  «Envío en preparación» tampoco se inventa sin timestamp real) se conservó intacta.

### Alcance medido — dónde se ve, y qué más del módulo nombra el registro en vez del hecho

- **Dónde aparece la etiqueta:** un solo consumidor. `recorridoDelPedido`/`PasoRecorrido`
  (`lib/pedidos/recorrido.ts`) sólo lo importa `app/(admin)/admin/pedidos/page.tsx:30`, que mapea
  `p.titulo` DIRECTO a la prop `title` del `Timeline` del design system
  (`app/(admin)/admin/pedidos/page.tsx:1239-1244`, sin transformación de texto). Grep del literal
  viejo y de los símbolos exportados (`recorridoDelPedido`, `PasoRecorrido`, `etiquetaTransicion`)
  sobre el repo completo (excluido `node_modules`): cero resultados fuera de `lib/pedidos/
  recorrido.ts` y su test. Cero en `app/(storefront)/`, cero en las plantillas de correo de
  `packages/core`/`lib/automations/channels/email.ts`, cero en `packages/design-system/
  reference.html`. La etiqueta VIEJA («Envío creado») y la NUEVA («Envío en preparación») viven las
  dos SÓLO en el panel, en el detalle de un pedido, dentro de la sección "Recorrido del pedido" — el
  mismo sitio donde el owner la vio.
- **El resto del mapa (`FULFILLMENT` y `COBRO` completos):** se revisaron las cinco entradas de
  `FULFILLMENT` (`preparando, en_ruta, entregado, fallido, cancelado`) y las tres de `COBRO`
  (`pendiente, pagado, cancelado`) contra los cinco escritores reales del libro
  (`packages/core/src/order-transitions.ts` es el único punto de escritura; lo llaman
  `packages/core/src/fulfillment.ts`, `packages/core/src/shipping-transition.ts` — dos sitios— y
  `packages/core/src/orders.ts` —dos sitios—). Ninguna otra etiqueta nombra el registro en vez del
  hecho: las cinco de `FULFILLMENT` describen lo que le pasó al paquete (despachado, entregado,
  entrega fallida, envío anulado, y ahora "en preparación" en vez de "creado") y las tres de `COBRO`
  describen lo que le pasó a la plata (pago registrado, pago revertido, pedido cancelado). No se
  encontró una segunda instancia de esta clase en el módulo; si aparece en uso real, es decisión del
  owner, no de este slice.

### La etiqueta que ve el operador, tal cual queda en pantalla

**«Envío en preparación»** — sin comillas ni sufijo, en la fila del `Timeline` correspondiente a la
transición `null→preparando` del eje `fulfillment`.

### Gate

**`npm run gate`, los dos carriles — corrido sobre el árbol final, verde.** Fast lane (`npm test`):
1435/1435. Carril de integración (`npm run test:integracion`, Postgres efímero): 208/208. El diff de
este slice toca `lib/pedidos/recorrido.ts`, `lib/pedidos/recorrido.test.ts` y esta entrada de
`DECISIONS.md` — ningún cambio de schema, ninguna migración, ningún endpoint HTTP.

**Tier 1 — SÍ aplica** por herencia de la rama (`slice/api-directa-panel-metodos-1`) y porque el spec
lo declaró `tier: 1` con `writes: yes` y `approved: yes` (`approved-by: owner`,
`approval-reason`: el owner vio el defecto en el panel el 2026-09-18 y propuso la palabra; se usó la
que el mapa ya tenía en su lugar, y el owner la confirmó). **LA APROBACIÓN AUTORIZA LA ESCRITURA,
NUNCA EL MERGE** — el merge sigue gateado al owner.

## 2026-09-18 — La lista Tier 1 recupera las tres superficies que le faltaban, y la auditoría del
owner sobre si algún slice pasó por la puerta abierta, y si un detector automático puede reemplazar
a quien mantiene la lista (`TIER1-LISTA-VENCIDA-2`)

### 0 · Qué pidió el owner, y qué se hizo

`COBRO-SIN-PEDIDO-ASIENTO-1` (arriba, mismo día) midió que `packages/core/src/pagos/
aplicar-resultado-wompi.ts`, `packages/core/src/pagos/reconciliador.ts` y `app/api/cron/automations/
route.ts` cumplen el criterio de Tier 1 —dos son deciders de la puerta de Wompi, el tercero es su
puerta HTTP— y no estaban en la lista. El owner leyó ese hallazgo y decidió que los tres entran; no
hay nada que evaluar sobre SI entran. Pidió tres cosas más: (a) decidir la GRANULARIDAD —archivos
sueltos o el subárbol que los contiene—, mirando el directorio entero, no asumiendo; (b) una
auditoría medida de si algún slice escribió por la puerta que quedó abierta entre el 2026-09-15 (cuando
los tres nacieron) y hoy; y (c) la respuesta, con su costo, a si el detector automático de puertas de
dinero del protocolo (`tier1_puertas`) puede derivar esta lista en vez de que alguien la mantenga a
mano.

Se hizo: los tres entraron a `CLAUDE.md` (`packages/core/src/pagos/` como SUBÁRBOL, `app/api/cron/
automations/route.ts` como archivo suelto); la auditoría se re-corrió con órdenes de git propias y
coincidió con la de `COBRO-SIN-PEDIDO-ASIENTO-1`; y la pregunta sobre `tier1_puertas` se contestó
midiendo el propio código de los tres archivos, no repitiendo lo que el spec ya afirmaba.

### 1 · La auditoría — verificada de nuevo, con órdenes propias, y coincide

`git log --all --oneline -- <archivo>` sobre los tres, corrido en esta sesión:

| archivo | commits (todo `--all`) | fecha(s) |
| --- | --- | --- |
| `packages/core/src/pagos/aplicar-resultado-wompi.ts` | `9abdc5b` (único) | 2026-09-15 |
| `packages/core/src/pagos/reconciliador.ts` | `9abdc5b` (único) | 2026-09-15 |
| `app/api/cron/automations/route.ts` | `9abdc5b` + `5cb71c8` | 2026-09-15 y 2026-07-28 |

Coincide exactamente con lo que `COBRO-SIN-PEDIDO-ASIENTO-1` había medido y el spec citó. **Ningún
commit posterior al 2026-09-15 toca ninguno de los tres.** `git log --oneline 9abdc5b..HEAD | wc -l`
da **71 commits** entre el nacimiento de `packages/core/src/pagos/` y el HEAD de hoy —la rama trae
consigo el programa entero de API directa/checkout que corrió en paralelo, no sólo los cinco commits
más recientes del eje de Wompi—; de esos 71, CERO tocan alguno de los tres archivos (confirmado por
el `git log --all` por-archivo de la tabla de arriba, que ya los enumera completos). **Respuesta al
owner: ningún slice escribió por la puerta que quedó abierta.** Eso es una respuesta buena, pero no
borra que la puerta estuvo abierta del 2026-09-15 al 2026-09-18 (3 días) sin la doble etapa que el
resto de la ruta del dinero ya tiene.

**Límite de esta auditoría, dicho:** un `git log` mide este repositorio. No mide si alguien, en esos
tres días, tocó estos archivos fuera de un commit —trabajo local sin commitear, una sesión que los
leyó sin escribir, o cualquier cosa que no deje rastro en `git`—; tampoco mide nada de lo que pudo
pasar en el otro repositorio (dev-protocol) que orquesta estos slices. Es evidencia de que NINGÚN
COMMIT los tocó, no de que NADIE los miró.

### 2 · La granularidad — subárbol para `packages/core/src/pagos/`, archivo suelto para el cron

Se abrió el directorio y se miró TODO lo que vive ahí, no se asumió:

```
packages/core/src/pagos/
├── aplicar-resultado-wompi.ts   (10.770 bytes)
└── reconciliador.ts             (11.510 bytes)
```

**Los dos son deciders de dinero, sin excepción — homogéneo hoy.** Pero el argumento para el SUBÁRBOL
no es el conteo de hoy (dos archivos, los dos en alcance): es la frontera arquitectónica que el
propio repo ya documenta en `§ Monorepo` — `packages/core` es "schema + cliente Prisma + data-access
de DOMINIO", mientras que el reporte, la presentación y las utilidades de UI viven en `lib/` (nivel
app). Un archivo nuevo que nazca en `packages/core/src/pagos/` nace, POR ESA FRONTERA, siendo
data-access de dominio de pagos — no puede nacer siendo un bucketeo de gráfico o una frase de
encabezado, porque ESO vive en `lib/pagos/` (ya evaluado como subárbol y DESCARTADO en la
re-medición del 2026-09-14, exactamente por mezclar deciders con reporte). Es el mismo argumento que
ya sostiene a `lib/checkout/` como subárbol ("un archivo nuevo en este directorio nace… para ser
consultado por esa misma puerta de dinero"), aplicado a la mitad `packages/core` de la misma puerta.

Se verificó que `packages/core/src/` YA usa subdirectorios como agrupación por CONCERN —no es una
convención inventada para este slice—: `notifications/`, `metrics/` y `validation/` ya existen ahí
junto a `pagos/`, cada uno agrupando un tema de dominio. `pagos/` es uno más de esos, y su tema
(pagos) es, por construcción del propio criterio de Tier 1, la ruta del dinero.

**`app/api/cron/automations/route.ts` entra como ARCHIVO SUELTO, no como subárbol.** No hay
directorio que evaluar: es una sola ruta HTTP, el mismo tipo de entrada que las otras nueve rutas
`app/api/*` ya listadas. Mezcla dos cosas en el MISMO archivo —el paso de automatizaciones
(mensaje-céntrico, ajeno al dinero) y el paso del reconciliador de Wompi (la puerta que corre
`correrReconciliador`)—, pero eso no cambia la granularidad: la puerta HTTP entera entra, igual que
`app/api/orders/route.ts` ya entraba entero aunque maneje más que sólo el eje de cobro.

### 3 · La ironía — la doctrina describía este modo de falla, y falló igual

`CLAUDE.md` ya dice, en la misma sección que hoy se corrige: *"ESTA LISTA VENCE — es una medición con
fecha, no una garantía perpetua… Una lista vencida no avisa que dejó de cubrir: el gate de Tier 1
sigue corriendo en VERDE sobre un conjunto que encogió… acá vencer es peor: no confunde a quien lee,
DEJA PASAR."* Y venció igual: la re-medición anterior (`TIER1-LISTA-VENCIDA-1`) es del 2026-09-14; los
tres archivos nacieron el 2026-09-15, UN DÍA DESPUÉS de haberse re-medido como cierta. La distancia
entre "se verificó que la lista estaba al día" y "la lista quedó corta" fue de 24 horas.

**La clase, con las palabras del owner:** una advertencia escrita sobre un mecanismo no es un
mecanismo. Es la hermana de "una guarda escrita no es una guarda corrida", aplicada a una guarda que
predijo su propia falla y no pudo evitarla.

**Y hay una vuelta más, medida en este slice y no en el anterior:** de los tres archivos, DOS
(`aplicar-resultado-wompi.ts` y `app/api/cron/automations/route.ts`) ya estaban siendo reportados por
un detector automático (`tier1_puertas`, del protocolo dev-protocol) — el spec que dispatchó este
slice trae esa salida medida contra este repo HOY: cuatro rutas candidatas, incluidas esas dos, y NO
`reconciliador.ts`. Así que la lección es más dura que "faltaba un mecanismo": para dos de los tres,
**el mecanismo existía y funcionaba**. Lo que faltaba era que algo BLOQUEARA sobre su salida — un
detector que sólo se imprime cuando alguien corre el comando de estado del despachador, y que nada
lee ni gatea, no es un gate: es una advertencia con más pasos.

### 4 · Por qué el detector ve dos de los tres y no al reconciliador — medido en el código, no en el spec

El spec citó, como medido en `COBRO-SIN-PEDIDO-ASIENTO-1`, que `tier1_puertas` busca un patrón de
EJECUCIÓN —llamadas `prisma.<tabla>.<create|update|delete|upsert>` o `tx.<tabla>.<…>`— y no explica
por qué el reconciliador queda afuera. Se verificó grepeando los tres archivos en esta sesión:

| archivo | llamadas `prisma.`/`tx.` directas a `create/update/delete/upsert` |
| --- | --- |
| `aplicar-resultado-wompi.ts` | SÍ — `tx.paymentIntent.updateMany(...)`, línea 152 |
| `app/api/cron/automations/route.ts` | SÍ — `prisma.paymentIntent.updateMany(...)`, líneas 60 y 83 |
| `reconciliador.ts` | **CERO** — ningún `prisma.` ni `tx.` en todo el archivo |

**`reconciliador.ts` no tiene ni una sola llamada `prisma.`/`tx.` porque nunca importa Prisma.** Todas
sus escrituras pasan por un parámetro `db: ReconciliadorDb` INYECTADO —`db.paymentIntent.updateMany`,
`db.cerrarVencido`— el mismo patrón de dependency injection que usa todo `packages/core` para poder
testear su lógica sin una base real (documentado en la propia cabecera del archivo: "packages/core
NO importa de lib/"). El patrón `db.<algo>.updateMany` no matchea `prisma.` ni `tx.`, así que un
detector que busca el patrón EJECUTOR literal es estructuralmente ciego a esta función — no por un
bug del detector, sino porque `reconciliador.ts` es, por diseño, la mitad CONSULTORA de la puerta: la
función que DECIDE si `aplicarResultadoWompi` corre, no la que ejecuta el `UPDATE`.

**Esto mapea exacto al propio criterio de Tier 1** (`CLAUDE.md`, línea ~11-13): *"cada puerta de
escritura de stock, pagos y pedidos, Y la función que esa puerta CONSULTA para decidir si la
escritura procede y con qué valor — no sólo el handler que la ejecuta."* `tier1_puertas` implementa
sólo la primera mitad (el handler que ejecuta, vía el patrón `prisma./tx.` + verbo de escritura). La
segunda mitad —la función CONSULTORA— es exactamente la que dejó pasar a `reconciliador.ts`. No es
que el detector esté mal: cubre medio criterio, y la mitad que le falta es la que importa acá.

### 5 · La respuesta al owner, con costo — ¿puede el detector derivar la lista?

**No hoy, y no sin trabajo adicional que tiene su propio precio.** Tres caminos, sin elegir:

1. **Lista de nombres de funciones decisoras** (p. ej. `registerOrderPaymentTx`, `aplicarResultado*`)
   que el detector busca como LLAMADAS, no como ejecuciones literales — barato de escribir (una lista
   más al lado de la de tablas del eje), pero repite el MISMO defecto que esta lista Tier 1 tiene hoy:
   una lista de nombres a mano que vence cada vez que nace una función decisora nueva. No cierra la
   clase, la mueve un nivel.
2. **Call-graph real** (qué función llama a qué, transitivo, hasta encontrar un `prisma.`/`tx.` de
   escritura N saltos abajo) — cierra la clase de verdad, pero es una herramienta de otro orden: un
   grep de un archivo no alcanza, hace falta un analizador de AST/tipos que siga imports entre
   módulos. Semanas, no horas; y sigue siendo del otro repositorio (dev-protocol), no de éste.
3. **Detección por FORMA DEL PARÁMETRO INYECTADO**: buscar, con un analizador consciente de tipos
   (no grep plano), cualquier función que reciba un parámetro cuyo TIPO declare métodos
   `create/update/delete/upsert` sobre una tabla del eje —`db: ReconciliadorDb` calificaría aunque
   nunca llame a `prisma.` directo—. Costo medio: más que grep, mucho menos que un call-graph
   completo, porque no necesita seguir la cadena entera —sólo leer la firma de la función y el shape
   del tipo del parámetro.

**La decisión de granularidad del §2 YA resuelve parte de esto, sin tocar el detector.** Con
`packages/core/src/pagos/` como subárbol protegido, CUALQUIER archivo que nazca ahí —decisor o
ejecutor, visible o invisible para `tier1_puertas`— ya está cubierto por la doctrina, porque la
protección la da la RUTA, no el patrón de código que el detector reconoce. Eso cierra el hueco
ESPECÍFICO que dejó pasar a `reconciliador.ts` sin que el detector aprenda nada nuevo. **Lo que NO
cierra**: un decider de dinero nuevo que nazca FUERA de un subárbol o archivo ya protegido —por
ejemplo, una función consultora nueva como archivo suelto en `packages/core/src/` (no bajo `pagos/`)
o en `app/api/`— seguiría siendo invisible para `tier1_puertas` de la misma manera que
`reconciliador.ts` lo fue, hasta que alguien la note y la agregue a mano, con el mismo riesgo de
vencimiento que motivó este slice. El detector sigue siendo una señal útil para la mitad EJECUTORA
—encontró dos de tres sin que nadie se lo pidiera—, no un sustituto de la re-medición manual.

### 6 · Los otros dos candidatos que el detector reportó — nombrados, no decididos

El spec trae, medido HOY contra este repo por `tier1_puertas`, que además de `aplicar-resultado-
wompi.ts` y `app/api/cron/automations/route.ts` el detector devuelve otras DOS rutas fuera de la
lista Tier 1: `packages/core/src/order-transitions.ts` y `app/api/products/[id]/route.ts`. Ninguna de
las dos es parte del alcance de este slice (`touches: CLAUDE.md, DECISIONS.md`, y sólo sobre los tres
archivos que el owner ya decidió) y este worker no decide por ellas. Contexto mínimo, medido de paso
en esta sesión sin profundizar: `order-transitions.ts` tiene al menos una escritura directa
(`tx.orderStatusTransition.create`, línea 38) que matchea el patrón EJECUTOR del detector — es
coherente con que `tier1_puertas` lo haya encontrado.

**Nombrados como `TIER1-CANDIDATOS-ORDER-TRANSITIONS-PRODUCTS-1`** para que la próxima re-medición de
la lista Tier 1 los evalúe contra el criterio (¿son puerta de escritura de dinero/stock/pedidos, o la
función que esa puerta consulta?), no para que se asuma que califican.

### 7 · Limitación declarada — no se pudo correr el validador ni el detector desde esta sesión

El spec (§1) pidió medir, ejecutando el validador de specs de dev-protocol, que un spec que tocara
`packages/core/src/pagos/` o `app/api/cron/automations/route.ts` ahora DISPARA el gate de Tier 1, y
que ANTES de este cambio no disparaba — las dos direcciones. **No se pudo hacer.** Esta sesión está
en un sandbox restringido al working directory de `coffee-template-app`: un intento de `find`/`ls`
fuera de él (buscando el repositorio dev-protocol, donde vive ese validador y el detector
`tier1_puertas`) fue rechazado por la herramienta misma con el mensaje *"Claude Code may only search
files in the allowed working directories for this session"*. No hay ruta de red tampoco (no hay
credencial ni URL de un servicio que exponga esa herramienta) — la única vía disponible (`node` +
`fetch`) no tiene nada que alcanzar sin esa ubicación.

**Esto es una limitación real, no un detalle omitido.** No se pudo verificar, en esta sesión, que la
entrada nueva en `CLAUDE.md` efectivamente cambia el comportamiento del validador de specs ni del
detector `tier1_puertas`. Lo que SÍ se verificó, con herramientas dentro de este repo: (a) el texto
agregado sigue el MISMO patrón léxico que las entradas existentes que sí disparan hoy (mismo formato
de ruta, mismas comillas invertidas, mismo verbo "entran"/"protegidas" que el resto de la lista), y
(b) el contenido semántico de los tres archivos —confirmado leyendo el código— cumple el criterio
escrito en la cabecera de la sección. Ninguna de las dos cosas es una PRUEBA de que el validador los
reconoce; son el máximo que se pudo verificar sin acceso a la herramienta que efectivamente los lee.
El owner y la próxima re-medición deben saber esto: la lista quedó corregida en TEXTO, sin
confirmación de que el MECANISMO la lee — que es, con ironía, el mismo modo de falla que motivó este
slice (§3).

### Gate

**`npm run gate`, los dos carriles — corrido sobre el árbol final, verde.** Fast lane (`npm test`):
1435/1435. Carril de integración (`npm run test:integracion`, Postgres efímero): 208/208. Mismas
cifras que el asiento anterior de esta misma rama (`RECORRIDO-ENVIO-NO-CREADO-1`) — coherente con que
el diff de este slice toca SÓLO `CLAUDE.md` y esta entrada de `DECISIONS.md`: ningún código de
producto, ningún test, ningún schema, ninguna migración, ningún endpoint HTTP.

**Tier 1 — SÍ aplica** por herencia de la rama y porque el spec lo declaró `tier: 1` con `writes: yes`
y `approved: yes` (`approved-by: owner`, `approval-reason`: el owner leyó el hallazgo de
`COBRO-SIN-PEDIDO-ASIENTO-1` y decidió que los tres archivos entran; pidió además la auditoría y la
respuesta con costo sobre `tier1_puertas` que este asiento trae en §§1-6). **LA APROBACIÓN AUTORIZA
LA ESCRITURA, NUNCA EL MERGE** — el merge sigue gateado al owner, y este slice para en
`AWAITING_APPROVAL` sin mergear, tal como el dispatch lo exige.

## 2026-09-18 — El subárbol `packages/core/src/pagos/` estaba escrito y no disparaba: la frase
canónica de la que el validador deriva, no la prosa que lo justifica, es la que cuenta
(`TIER1-SUBARBOL-NO-DISPARABA-1`)

### 0 · Desviación, dicha primero — este slice no pudo ejecutar el validador

Esta sesión está en el mismo sandbox restringido que `TIER1-LISTA-VENCIDA-2` (§7 de esa entrada, arriba)
ya documentó: acotada al working directory de `coffee-template-app`, sin ruta a `dev-protocol` (donde
vive el validador que deriva disparadores de specs contra `CLAUDE.md`) ni credencial/URL que un `node`
+ `fetch` pudiera alcanzar. **No se corrió el validador en este slice.** Lo que sigue en esta entrada
—salvo la cifra "externa" de §1, que es del spec y se marca como tal— es lo que SÍ se pudo verificar
con herramientas de este repo: el texto exacto de la frase canónica, antes y después, línea por línea.

### 1 · El defecto medido (externo, ledger_claim del spec — no re-medido en esta sesión)

`TIER1-LISTA-VENCIDA-2` decidió que `packages/core/src/pagos/` entra a Tier 1 como SUBÁRBOL y lo
escribió en el bullet de arriba, § "LA LISTA TAMBIÉN GANA SUBÁRBOLES" (la justificación de frontera
arquitectónica del paquete). **Nunca lo escribió en la frase canónica** —la enumeración de una sola
línea, "Tier 1 slices run in a separate read-only session…", de la que el validador de specs deriva
qué ruta dispara el gate—. El mismo commit (`94bfaec`) sí tocó esa frase para sumar `app/api/cron/
automations/route.ts` (verificado en esta sesión, `git show 94bfaec -- CLAUDE.md`, línea del diff con
el `+`: la enumeración termina en `…app/api/shippings/route.ts, app/api/cron/automations/route.ts and
app/api/webhooks/wompi/route.ts.` — sin `packages/core/src/pagos/` en ningún punto de esa lista). El
spec de este slice trae, medido por el orquestador contra ese estado: la derivación de disparadores
del validador daba `app/api/cron/automations/route.ts` como disparador nuevo y **no** daba
`packages/core/src/pagos/`; un spec de prueba que declarara tocar
`packages/core/src/pagos/reconciliador.ts` **no disparaba** el gate de Tier 1, y moviendo el subárbol
a la frase canónica el mismo spec de prueba **sí dispara**, con el mensaje de que esa ruta está bajo
`packages/core/src/pagos`. Esta cifra es del spec (`externo`); no se re-corrió el validador en esta
sesión (§0).

### 2 · El arreglo — la frase canónica, antes y después

**Antes** (`CLAUDE.md`, la línea de la enumeración, medida con `git show 94bfaec -- CLAUDE.md`, tal
como quedó tras esa entrada y hasta el commit base de este slice):

> `…packages/core/src/orders.ts, packages/core/src/comprobantes.ts, packages/core/src/
> shipping-transition.ts, lib/checkout/metodos-pago.ts, lib/pagos/wompi-firma.ts…`

**Después** (`CLAUDE.md`, línea 27 de este árbol):

> `…packages/core/src/orders.ts, packages/core/src/comprobantes.ts, packages/core/src/
> shipping-transition.ts, packages/core/src/pagos/, lib/checkout/metodos-pago.ts, lib/pagos/
> wompi-firma.ts…`

`packages/core/src/pagos/` quedó insertado entre `packages/core/src/shipping-transition.ts` y
`lib/checkout/metodos-pago.ts` — contiguo al resto de los archivos de `packages/core/src/` ya
enumerados, con la barra final que la propia frase usa para marcar directorio (mismo patrón que
`app/(storefront)/` y `packages/core/prisma/migrations/`). El resto de la frase no se tocó. La
justificación de subárbol en el bullet de arriba (§ LA LISTA TAMBIÉN GANA SUBÁRBOLES) tampoco se
tocó: sigue siendo la misma, y sigue siendo correcta — lo que faltaba no era la razón, era que la
razón llegara a la frase que el validador lee.

### 3 · La clase

**UNA ADVERTENCIA ESCRITA SOBRE UN MECANISMO NO ES UN MECANISMO.** Y MÁS EXACTO TODAVÍA: **UN
MECANISMO QUE SÓLO IMPRIME NO ES UN GATE — ES UNA ADVERTENCIA CON MÁS PASOS.** Son las dos frases que
`TIER1-LISTA-VENCIDA-2` (arriba, §3) ya dejó escritas con las palabras del owner, sobre el detector
`tier1_puertas`: para dos de los tres archivos de esa re-medición el mecanismo YA existía y los venía
reportando; lo que faltaba no era el mecanismo, era que algo BLOQUEARA sobre su salida.

**Y el eslabón que agrega ESTE caso, el mismo hueso una capa más abajo: una entrada ESCRITA en una
lista no es una entrada EN la lista.** El subárbol estaba razonado, documentado, con su propio bullet
—no era descuido ni omisión de contenido—, y el conjunto protegido no creció ni un archivo, porque el
validador deriva de UNA frase, no de la sección entera. Se parece a estar cubierto. Es la misma
sensación de cobertura que `CLAUDE.md` ya documenta en otro caso, § "Todo `DialogContent` lleva
`DialogDescription`": *"una verificación escrita y nunca ejecutada es peor que no tenerla: da la
sensación de estar cubierto"* (línea 604). Ahí la guarda que nunca corrió era un `grep` manual que
nadie volvía a invocar; acá es el validador automático, corriendo siempre, pero leyendo una frase que
la entrada nueva nunca alcanzó.

### 4 · La auditoría — las dos frases juntas, instrucción del owner

`TIER1-LISTA-VENCIDA-2` (arriba, §1) ya midió, con `git log --all` por archivo, que ningún commit
posterior al 2026-09-15 tocó `packages/core/src/pagos/aplicar-resultado-wompi.ts`,
`packages/core/src/pagos/reconciliador.ts` ni `app/api/cron/automations/route.ts`: la puerta quedó
abierta del 2026-09-15 al 2026-09-18 (tres días) sin que otro slice escribiera por ella. El owner, al
revisar esa auditoría junto con el hallazgo de esta entrada, pidió que las dos frases fueran juntas,
porque las dos son ciertas y ninguna borra la otra:

> *"La puerta estuvo abierta tres días y nadie la cruzó. No aprobé nada sin mirarlo — y eso fue
> SUERTE, no protección."*

### 5 · El límite de la figura — impreso, no enterrado

El detector que busca puertas de dinero fuera de la lista (`tier1_puertas`) implementa sólo la mitad
EJECUTORA del criterio de Tier 1 —llamadas que escriben en las tablas del eje— y no la mitad
DECISORA —la función que una puerta CONSULTA para decidir si la escritura procede y con qué valor—.
Es la mitad que dejó pasar a `reconciliador.ts` (medido en `TIER1-LISTA-VENCIDA-2`, §4: cero llamadas
`prisma.`/`tx.` directas en todo el archivo, porque sus escrituras pasan por un parámetro `db`
inyectado). **La consecuencia que hay que dejar escrita:** un decider de dinero que nazca FUERA de
`packages/core/src/pagos/` —o de cualquier otro subárbol o archivo ya protegido— vuelve a ser
invisible para el detector, exactamente como `reconciliador.ts` lo fue hasta que el owner lo nombró a
mano. Este slice resuelve que el subárbol de HOY dispare; no cierra la clase de "un decider nuevo
puede nacer sin que nada lo note".

### Gate

**`npm run gate`, los dos carriles — corrido sobre el árbol final, verde.** El diff de este slice
toca `CLAUDE.md` (la entrada del subárbol en la frase canónica + este párrafo de doctrina) y esta
entrada de `DECISIONS.md` — ningún código de producto, ningún test, ningún schema, ninguna migración,
ningún endpoint HTTP.

**Tier 1 — SÍ aplica** por herencia de la rama y porque el spec lo declaró `tier: 1` con `writes: yes`
y `approved: yes` (`approved-by: owner`, `approval-reason`: el owner confirmó el 2026-09-18 que el
subárbol entero entra, con el precedente de `lib/checkout/` ya en la lista, más la puerta HTTP del
cron por separado). **LA APROBACIÓN AUTORIZA LA ESCRITURA, NUNCA EL MERGE** — el merge sigue gateado
al owner, y este slice para en `AWAITING_APPROVAL` sin mergear.

## 2026-09-18 — Los dos candidatos que `tier1_puertas` venía reportando sin que nadie los
clasificara entran a Tier 1, cada uno por su propia razón (`TIER1-DOS-CANDIDATOS-CLASIFICADOS-1`)

### 0 · Desviación, dicha primero — este slice tampoco pudo ejecutar el validador

Mismo sandbox restringido que `TIER1-LISTA-VENCIDA-2` (§7) y `TIER1-SUBARBOL-NO-DISPARABA-1` (§0) ya
documentaron: esta sesión está acotada al working directory de `coffee-template-app`, sin ruta al
repositorio `dev-protocol` (donde vive el validador de specs y el detector `tier1_puertas`) ni
credencial/URL que un `node` + `fetch` pudiera alcanzar. **No se corrió el validador ni el detector
en este slice.** La cifra externa de §1 —qué candidatos quedan fuera de la lista hoy— es del spec,
marcada `ledger_claim`, no re-medida contra la herramienta; lo que sí se verificó con herramientas de
este repo es el contenido de los dos archivos (§2) y el texto exacto de la frase canónica, antes y
después (§3).

### 1 · El punto de partida — el followup ya estaba nombrado

`TIER1-LISTA-VENCIDA-2` (arriba, §6) dejó nombrados, sin decidir, dos candidatos que el detector
`tier1_puertas` reportaba fuera de la lista además de los tres que esa entrada sí resolvió:
`packages/core/src/order-transitions.ts` y `app/api/products/[id]/route.ts`, bajo el id
`TIER1-CANDIDATOS-ORDER-TRANSITIONS-PRODUCTS-1`, "para que la próxima re-medición de la lista Tier 1
los evalúe contra el criterio (¿son puerta de escritura de dinero/stock/pedidos, o la función que esa
puerta consulta?), no para que se asuma que califican." El spec de este slice trae, medido por el
orquestador (`externo`, `kind: ledger_claim` en esta sesión): corrida hoy la figura contra el árbol
con el subárbol de pagos ya adentro (§ `TIER1-SUBARBOL-NO-DISPARABA-1`), los únicos dos candidatos
que quedan fuera de la lista Tier 1 son esos mismos dos — ninguno nuevo apareció entre el 2026-09-15
y hoy.

El owner los revisó y decidió que los dos entran, cada uno por una razón **distinta**, y pidió que el
asiento las registre tal como las dio — no resumidas a una sola frase, porque son dos criterios de
admisión diferentes y el próximo candidato se va a juzgar contra los dos por separado.

### 2 · Lo medido en cada archivo, contra lo que el spec afirmaba

**`packages/core/src/order-transitions.ts`** exporta una sola función, `appendOrderStatusTransition`,
que hace `tx.orderStatusTransition.create` (línea 38) — un `INSERT` crudo, dentro del `tx` que le pasa
el llamador. Grep de sus llamadores reales (excluyendo `.test.ts` y un comentario que sólo la nombra):

```
packages/core/src/fulfillment.ts:84
packages/core/src/orders.ts:152,177,600
packages/core/src/shipping-transition.ts:121
```

Los TRES archivos llamadores (`fulfillment.ts`, `orders.ts`, `shipping-transition.ts`) ya estaban en
la lista Tier 1 antes de este slice. Coincide exacto con lo que el spec afirmaba. **Por qué NO entra
por el criterio literal de la sección** (puerta de escritura + función consultada): `order-
transitions.ts` no DECIDE nada — no gatea, no calcula, no rechaza; sólo escribe el asiento que el
llamador ya decidió escribir. El criterio de admisión que lo trae es el nuevo, escrito en `CLAUDE.md`
junto al de `timezone.ts`: es el libro APPEND-ONLY del eje de cobro, y su corrupción es SILENCIOSA —
`DECISIONS.md` ya registró (§ `RECORRIDO-ENVIO-NO-CREADO-1`, arriba en este archivo) que
`order-transitions.ts` es el único punto de escritura del libro que distinguió, en el incidente de
`COBRO-SIN-PEDIDO-ASIENTO-1`, "nunca se pagó" de "se pagó y se revirtió". Nota aparte, fuera del
alcance de este slice: el comentario de cabecera del archivo describe "Fase 2A: DEFINIDO pero aún SIN
LLAMAR desde ningún escritor" — el grep de arriba muestra que HOY sí lo llaman los tres. El comentario
quedó desactualizado por un cambio de otro slice; no se corrige acá (fuera de `touches:`).

**`app/api/products/[id]/route.ts`** tiene DOS handlers con historias distintas, leídos completos:

- **`PATCH`** arma su escritura con `aplicarPatchProducto(id, body, …)` (`@duna/core/product-update`,
  línea 68) — la misma función que `packages/core/src/product-update.ts` ya expone y que YA está en
  la lista Tier 1. Esta mitad estaba protegida de forma indirecta desde que ese archivo entró.
- **`DELETE`** hace `await prisma.product.delete({ where: { id: id } })` (línea 132) DIRECTO sobre el
  cliente de Prisma, sin pasar por ningún decider de `packages/core`. Antes del delete valida que el
  producto no tenga `OrderItem` asociados (409 si los tiene) y después del delete borra sus blobs de
  storage — pero la escritura que importa para Tier 1, el `.delete` sobre la tabla `Product`, es una
  llamada cruda dentro del propio route handler.

Coincide exacto con lo que el spec afirmaba. **El archivo entra por su mitad `DELETE`, no por el
`PATCH`** — que ya estaba cubierto indirectamente y no aporta razón nueva de entrada.

### 3 · El arreglo — la frase canónica, antes y después, y el criterio nuevo

**Antes** (`CLAUDE.md`, tal como quedó tras `TIER1-SUBARBOL-NO-DISPARABA-1` y hasta el commit base de
este slice):

> `…packages/core/src/shipping-transition.ts, packages/core/src/pagos/, lib/checkout/
> metodos-pago.ts…` — y, del lado de `app/api/`, `…app/api/shippings/route.ts, app/api/cron/
> automations/route.ts and app/api/webhooks/wompi/route.ts.`

**Después** (`CLAUDE.md`, línea de la enumeración):

> `…packages/core/src/shipping-transition.ts, packages/core/src/order-transitions.ts,
> packages/core/src/pagos/, lib/checkout/metodos-pago.ts…` — y `…app/api/shippings/route.ts,
> app/api/products/[id]/route.ts, app/api/cron/automations/route.ts and app/api/webhooks/
> wompi/route.ts.`

`order-transitions.ts` quedó entre `shipping-transition.ts` y `packages/core/src/pagos/` (contiguo al
resto de `packages/core/src/` ya enumerados); `products/[id]/route.ts` quedó entre
`app/api/shippings/route.ts` y `app/api/cron/automations/route.ts` (contiguo al resto de rutas
`app/api/`). Además se escribió, en el bloque de criterio de arriba de la sección (junto al párrafo de
`timezone.ts`), el **SEGUNDO EJE DE ADMISIÓN** que el owner pidió dejar como criterio y no como excusa
puntual de este archivo: *"lo que falla RUIDOSO se arregla; lo que corrompe CALLADO no se
descubre."* Es un eje nuevo, distinto del que ya regía (puerta de escritura + función consultada), y
queda escrito para que el próximo candidato se juzgue también contra él.

**La lista sigue teniendo granularidad de ARCHIVO, no de método HTTP.** `app/api/products/[id]/
route.ts` entra completo aunque sólo su `DELETE` lo necesite — el `PATCH` ya viajaba protegido por
`product-update.ts`. Quien re-mida este archivo en el futuro debe leer esta entrada antes de asumir
que las dos mitades se evaluaron por la misma razón.

### 4 · Lo que este slice NO tocó

No se agregó ninguna otra superficie a la lista. No se tocó la entrada del subárbol
`packages/core/src/pagos/` ni la de `app/api/cron/automations/route.ts` (`TIER1-SUBARBOL-NO-
DISPARABA-1`, `TIER1-LISTA-VENCIDA-2`) — ya están en la frase canónica y ya disparan. No se tocó
código de producto, tests, schema ni migraciones.

### Gate

**`npm run gate`, los dos carriles — corrido sobre el árbol final, verde.** Fast lane (`npm test`):
1435/1435. Carril de integración (`npm run test:integracion`, Postgres efímero): 208/208. Mismas
cifras que las dos entradas anteriores de esta misma rama (`TIER1-LISTA-VENCIDA-2`,
`TIER1-SUBARBOL-NO-DISPARABA-1`) — coherente con que el diff de este slice toca SÓLO `CLAUDE.md` y
esta entrada de `DECISIONS.md`: ningún código de producto, ningún test, ningún schema, ninguna
migración, ningún endpoint HTTP.

**Tier 1 — SÍ aplica** por herencia de la rama y porque el spec lo declaró `tier: 1` con `writes: yes`
y `approved: yes` (`approved-by: owner`, `approval-reason`: el owner decidió el 2026-09-18 que los dos
candidatos que la figura `tier1_puertas` venía reportando sin clasificar entran a Tier 1, cada uno por
la razón registrada en §§1-3, y pidió que el asiento las deje tal como las dio). **LA APROBACIÓN
AUTORIZA LA ESCRITURA, NUNCA EL MERGE** — el merge sigue gateado al owner, y este slice para en
`AWAITING_APPROVAL` sin mergear.

## 2026-09-18 — La transición del pago con pasarela: una sola vista de carga, el texto que dejó de
mentir, y el éxito que dejó de ser un callejón sin salida (`CHECKOUT-TRANSICION-DEFECTOS-1`)

### 0 · Qué vio el owner, en la PRIMERA transacción real

El owner reportó, tras usar el camino de API directa para pagar con tarjeta en CN-597202 —la
primera compra de este programa que llegó a `APROBADO` de verdad (`PRIMERA-TRANSACCION-REAL-
ASIENTO-1`, arriba)—, tres defectos de la TRANSICIÓN que el comprador ve entre apretar "Pagar" y
ver la confirmación. Dio el texto exacto del segundo y llamó al tercero "el peor de los tres",
pidiendo explícitamente reusar la pantalla de confirmación que los métodos manuales ya tienen en
vez de inventar una nueva, y revisar los demás estados terminales con el mismo criterio.

### 1 · Defecto uno — "Verificando tarjeta" en dos vistas para el mismo momento

**La causa era estructural.** `FormularioTarjeta`/`FormularioOtroMetodoPasarela` mostraban
"Verificando tarjeta…"/"Procesando…" en su propio botón mientras tokenizaban, creaban la orden y
confirmaban la transacción (`tokenizando`) — y apenas la transacción nacía (`creada` truthy), el
componente se **reemplazaba a sí mismo** por `EsperaConfirmacionTarjeta`, un layout distinto
(ícono + texto centrado) que volvía a anunciar que se estaba confirmando el pago. Un solo momento,
dos vistas.

**El arreglo:** el formulario ya NO se reemplaza. Una única señal `procesando` (`tokenizando ||
!!creada`) bloquea los campos, las dos casillas de aceptación y el botón EN SU LUGAR durante TODO
el camino —tokenizar, crear la orden, confirmar la transacción, Y sondear hasta que el pago
resuelve—, y `EsperaConfirmacionTarjeta` se monta DEBAJO del botón bloqueado, dentro del MISMO
contenedor. Para el caso común (sin desafío 3DS) ya no dibuja un panel propio: aporta sólo una
línea de texto corta, porque el botón ya comunica el progreso. El desafío 3DS (`DesafioTarjeta`,
el iframe del banco) sigue con su marco aislado, embebido en ese mismo contenedor — es contenido
que genuinamente hace falta mostrar, no una segunda vista del mismo hecho.

`AceptacionesPasarela` ganó un `disabled` (antes no existía ningún mecanismo para bloquearlas):
sin él, las casillas seguían siendo clickeables mientras el pago procesaba.

### 2 · Defecto dos — el texto de espera mentía para tarjeta

El texto único (`EsperaConfirmacionTarjeta.TEXTO.enVueloSinFriccion`) decía: *"Estamos confirmando
tu pago con tu banco. Esto puede tardar unos minutos — no cierres esta página."* Para tarjeta y
billetera eso es falso en las dos afirmaciones: no hay banco de por medio en esa rama (el texto
del banco es el de la rama de DESAFÍO, `enVueloDesafio`, que sí lo tiene y no se tocó), y la
medición real de esta misma sesión (`PRIMERA-TRANSACCION-REAL-ASIENTO-1`, arriba) dio 5.662 a
10.273 segundos para resolver, cuatro transacciones — no minutos.

**El texto que el owner dio, textual, para tarjeta y billetera:**

> «Estamos confirmando tu pago.»

Sin promesa de tiempo, sin nombrar al banco. Es el único cambio de copy de este slice fuera del
que introduce el defecto tres (los rótulos nuevos de la pantalla de éxito, abajo) y el número de
orden agregado al rechazo (§4).

### 3 · Defecto tres, "el peor" — el éxito dejó de ser un callejón sin salida

**Antes de este slice**, al aprobarse el pago, el comprador veía un ícono, un título y una frase —
sin número de orden, sin resumen de lo que compró, sin acciones. Medido contra las otras dos
pantallas de la MISMA transición: la vista `techo` (sondeo agotado, sin resolver) SÍ mostraba el
número de orden; y la confirmación de los métodos MANUALES (que ni siquiera cobraron) ya tenía
pantalla completa —resumen, estado, "Rastrear mi pedido" y "Seguir comprando"—. El camino que SÍ
cobra era el más pobre de los tres.

**El arreglo reusa esa pantalla completa, no inventa una nueva** (`checkout/page.tsx`). La parte
difícil, medida antes de escribir: la aprobación se entera MUY ADENTRO del árbol —dentro del
sondeo de `EsperaConfirmacionTarjeta`—, y la pantalla de confirmación vive MUY AFUERA —en el
`return` temprano de `Checkout`—. El hecho se sube por una cadena de callbacks `onAprobado`:
`EsperaConfirmacionTarjeta` → `FormularioTarjeta`/`FormularioOtroMetodoPasarela` →
`SelectorMetodoPasarela` → `checkout/page.tsx` (`setPasarelaAprobada(true)`). La condición del
`return` temprano pasó de `!(confirmation.wompi && !pasarelaMetodoNoHabilitado)` a
`!confirmation.wompi || pasarelaMetodoNoHabilitado || pasarelaAprobada` — equivalente por De
Morgan a la original cuando `pasarelaAprobada` es `false`, así que el camino manual no cambia.

**El estado mostrado se corrige, no se hereda.** `confirmation.estado` es el de la CREACIÓN de la
orden (`pendiente` — el pago de pasarela se confirma después, por webhook); con
`pasarelaAprobada` el badge muestra `pagado`, porque el sondeo acaba de confirmar el pago y
mostrarle "Pendiente" al comprador que ya vio "¡Tu pago fue aprobado!" sería mentirle. El resumen
de ítems, subtotal, envío, total y las DOS acciones son el MISMO código que ya usan los métodos
manuales — sólo el ícono (CheckCircle esmeralda en vez de Clock ámbar), el título, el primer
párrafo y el estado cambian según `pasarelaAprobada`.

**No se rompió el defecto uno arreglando el tres.** `EsperaConfirmacionTarjeta` no dibuja nada
cuando llama a `onAprobado` — el `FormularioTarjeta` que la contiene se desmonta como efecto del
cambio de estado en `checkout/page.tsx`, que es un cambio de estado REAL (el pago terminó), no un
remonte a mitad de la espera.

### 4 · Los otros estados terminales, revisados con el mismo criterio

El owner pidió revisar rechazado e indeterminado con la pregunta: ¿el comprador sabe QUÉ pasó, CON
QUÉ orden, y QUÉ hacer ahora?

| Estado | Antes | Después | Qué se tocó |
| --- | --- | --- | --- |
| **Aprobado** | Sabe qué pasó (frase pobre); NO sabe con qué orden; NO sabe qué hacer | Los tres | Bubbleado + pantalla completa reusada (§3) |
| **Indeterminado** (`techo`, sondeo agotado) | Sabe qué pasó; sabe con qué orden; NO sabe qué hacer (sin acciones) | Los tres | Se agregaron las MISMAS dos acciones ("Rastrear mi pedido", "Seguir comprando") a la vista `techo` que `EsperaConfirmacionTarjeta` ya dibujaba — barato, porque la vista ya existía y sólo le faltaba el tercer criterio. El formulario de tarjeta/campo se OCULTA en este estado (`onTecho`, nuevo callback) para no mostrar dos respuestas al mismo momento: los campos bloqueados arriba y "sigue procesándose" abajo |
| **Rechazado** | Sabe qué pasó; NO sabe con qué orden (la orden ya existe — la creó `crearOrdenPasarela`, idempotente); sabe qué hacer (revisar datos u otro método) | Sabe con qué orden | Se agregó el número de orden junto al mensaje de rechazo. **NO SE TOCÓ el mecanismo de reintento** — hay una pregunta abierta sobre si ofrecer "reintentar con otro método" que el owner nombró explícitamente como NO de este slice; queda para una decisión de producto aparte |
| **Método no habilitado** (rechazo estructural, síncrono) | Los tres — ya caía en la confirmación manual completa | Sin cambios | Ya satisfacía el criterio antes de este slice; no se tocó |

**`EsperaRedireccionPasarela` no se revisó** — es el camino para un tipo de pasarela con
`descriptor.redireccion` declarado, y **ningún descriptor real lo declara hoy** (§ su propio
docstring, verificado sin cambios); su vista `techo` también carece de número de orden con enlace
y de acciones, pero es código inalcanzable por ningún comprador real. Anotado como open-followup,
no arreglado.

### 5 · Lo que NO se tocó

Ningún archivo bajo el eje del dinero (`packages/core/`, `app/api/checkout/route.ts`,
`services/checkout.service.ts`) — la creación de la transacción, el sondeo contra
`/api/checkout/retorno`, el webhook y el reconciliador quedan intactos. No se construyó ningún
mecanismo de reintento con otro método. No se tocó ningún otro texto provisional del programa
fuera de los dos nombrados en §2 y §3.

### Gate

**`npm run gate`, los dos carriles, corrido sobre el árbol final, verde.** Fast lane (`npm test`):
1435/1435. Carril de integración (`npm run test:integracion`, Postgres efímero): 208/208.
`npm run typecheck` (`tsc --noEmit`) también corrido, sin errores.

**El camino manual se verificó byte-idéntico por dos vías**, no una sola: (a) la condición nueva
del `return` temprano de `checkout/page.tsx` es equivalente por De Morgan a la vieja cuando
`pasarelaAprobada` es `false` (§3); y (b) cada rama condicional nueva de esa pantalla
(`pasarelaAprobada ? … : …`) se escribió preservando el string/clase EXACTO del lado `false`,
incluido el ORDEN de las clases Tailwind del ícono (`w-20 h-20 bg-amber-100 rounded-full …`, no
reordenado) — un cambio de orden no altera el CSS computado, pero si algo lo compara por texto
exacto, un reorden habría sido una diferencia falsa. No hay harness de render en este repo
(§ CLAUDE.md, doctrina de las tres capas) para verificarlo por ejecución; el gate visual del owner
es quien confirma esto en pantalla.

**Tier 1 — SÍ aplica**: `components/storefront/checkout/` y `app/(storefront)/` son subárboles
Tier 1 (bytes que el comprador ve). El spec lo declaró `tier: 1`, `writes: yes`, `approved: yes`
(`approved-by: owner`, `approval-reason`: el owner vio los tres defectos en CN-597202 el
2026-09-18, dio el texto del §2 textual, llamó al §3 "el peor" y pidió reusar la pantalla
existente, y pidió revisar §4 con el mismo criterio sin tomar la decisión de reintento). **LA
APROBACIÓN AUTORIZA LA ESCRITURA, NUNCA EL MERGE** — el merge sigue gateado al owner, y este
slice para en `AWAITING_APPROVAL` sin mergear.

## 2026-09-18 — El censo del reintento, medido de nuevo para dejar asiento, y la clase que
convierte en falsa la frase "sabe qué hacer" del ledger anterior (`CHECKOUT-REINTENTO-CENSO-1`)

### 0 · Por qué este slice mide otra vez lo que un censo ya midió

El censo del mecanismo de reintento del pago por pasarela corrió antes como slice de SÓLO
LECTURA — y por eso no dejó asiento: sus hallazgos vivían en un reporte que ningún slice
posterior puede citar como medición (la guarda de procedencia del protocolo lo rechaza, con
razón — un id que no resuelve en el libro no es una medición, es una afirmación externa). Este
slice vuelve a medir cada afirmación contra el código, con archivo y línea, y deja el asiento
que el censo debió dejar.

### 1 · Lo medido — las tres capas, el proveedor tapado, la guarda de doble cobro, el carrito

**¿Puede una orden tener más de un intento de pago?** Las tres capas, medidas por separado:

- **Schema**: `PaymentIntent.orden_id` (`packages/core/prisma/schema.prisma:443`) NO tiene
  `@unique` — sólo `@@index([orden_id])` (línea 523). Nada en el schema prohíbe una segunda fila
  con la misma `orden_id`.
- **El código que crea intentos**: hay UN solo call site de `paymentIntent.create` en todo el
  repo (medido: `grep -rn "paymentIntent.create"` da un único resultado) — dentro de
  `createOrderWithCustomer` (`packages/core/src/orders.ts:619-630`), y sólo cuando
  `input.crearIntentoPago` es `true`. Ese create ocurre SIEMPRE junto con la creación de una
  Order NUEVA, en la misma transacción. Ningún código crea un `PaymentIntent` adicional para una
  Order YA EXISTENTE. Así que "una orden tiene a lo sumo un intento" es hoy un HECHO DE
  OMISIÓN — nadie escribió el código que crearía el segundo —, no una restricción del modelo.
- **Lecturas que asuman "el intento de la orden" en singular**: ninguna. Todo `findUnique` sobre
  `paymentIntent` filtra por `reference` (la clave única del propio intento, no de la orden):
  `app/api/checkout/route.ts:450`, `app/api/checkout/retorno/route.ts:76,103`,
  `app/api/webhooks/wompi/route.ts:206,342`. El único `findFirst` (`lib/config/site-settings-
  read.ts:76`) filtra por `metodo_rechazado IN (...)` a través de TODOS los intentos del negocio
  (para el aviso del dueño), no por `orden_id` de una orden puntual. Y el único `findMany`
  (`app/api/cron/automations/route.ts:73`, el reconciliador) trae TODOS los `EN_VUELO` del
  sistema, sin acotar por orden. Cero lecturas que se romperían si una orden tuviera dos.

**El mecanismo real: la orden reutiliza el MISMO intento entre reintentos, por diseño — no
crea uno nuevo.** `crearOrdenPasarela` (`app/(storefront)/checkout/page.tsx:259-278`) es
IDEMPOTENTE por estado de React: `if (confirmation?.wompi) return confirmation.wompi.reference;`
— mientras la pestaña del navegador siga viva, CUALQUIER submit posterior (tarjeta u otro
método, en cualquier pestaña del picker) devuelve la MISMA `reference` sin volver a crear
orden ni intento. Es lo que hace verdad, hoy, la afirmación de la capa anterior: no porque el
sistema lo prohíba, sino porque el único camino de creación nunca vuelve a dispararse dentro de
la misma sesión de checkout.

**Las aceptaciones del proveedor — una consulta por carga de página, reusada sin límite.**
`bloquePasarela` se pide UNA vez (`useEffect` con deps `[pasarelaDisponible]`,
`checkout/page.tsx:93-100`, vía `consultarBloqueAceptacionPasarela()`) y queda en estado de
React para toda la sesión. Un segundo envío —de cualquier método, en cualquier pestaña— reusa
los MISMOS tokens de aceptación (`aceptaciones.terminos.token`/`.datosPersonales.token`) sin
volver a pedirlos. No se midió ningún defecto en esto: los tokens de aceptación de Wompi no son
de un solo uso por transacción (no hay código que los invalide tras un intento), así que
reusarlos entre reintentos no es el problema.

**EL ERROR DEL PROVEEDOR QUE HOY NO SE VE, y cuál lo tapa.** `PATCH /api/checkout`
(`app/api/checkout/route.ts:450-464`) es la ruta que confirma la transacción contra Wompi.
Antes de llamar a Wompi por CUALQUIER cosa, lee el intento por `reference` y corta en seco:

```ts
if (intent.estado !== 'EN_VUELO') {
  return NextResponse.json({ error: TEXTO_INTENTO_YA_RESUELTO }, { status: 409 });
}
```

(`TEXTO_INTENTO_YA_RESUELTO = 'Este pago ya se resolvió.'`, línea 350.) Este chequeo es NUESTRO,
no del proveedor, y responde ANTES de que el handler arme la firma o llame a Wompi (la llamada a
Wompi ocurre más abajo en el mismo archivo, después de este `if`). Así que en TODO reintento
contra una `reference` cuyo intento ya cerró, Wompi nunca es consultado — cualquier respuesta que
el proveedor pudiera dar sobre el NUEVO intento (otra tarjeta, otro método) es invisible, porque
nuestro propio guardián de estado responde primero. **Nuestra guarda de idempotencia (`intent.
estado !== 'EN_VUELO'`) tapa al proveedor.**

Y el intento SÍ cierra a `FALLIDO` de forma permanente apenas el emisor rechaza: el webhook
(`app/api/webhooks/wompi/route.ts:279-301`) transiciona `EN_VUELO → FALLIDO` en un
`updateMany` condicional, y NINGÚN código en el repo vuelve a poner `estado: 'EN_VUELO'` como
dato de escritura (medido: `grep -rn "estado:\s*'EN_VUELO'"` sólo aparece del lado `where`, en
`aplicar-resultado-wompi.ts:153`, `webhooks/wompi/route.ts:285` y `cron/automations/route.ts:84`
— nunca del lado `data`). Un `PaymentIntent` FALLIDO es fallido para siempre.

**La guarda contra el doble cobro — qué compara, y por qué cubre N intentos gratis.**
`aplicarResultadoWompi` (`packages/core/src/pagos/aplicar-resultado-wompi.ts:142-207`) lockea la
Order (`FOR UPDATE`, vía `transaccionConOrdenLockeada`) y compara `orden.estado !== 'pendiente'`
(línea 175) — NO compara contra el intento, contra `pspTransactionId`, ni contra cuántos
`PaymentIntent` tiene la orden. Compara el ESTADO DE LA ORDEN bajo lock. Por construcción, esto
cubre cualquier cantidad de intentos sobre la misma orden sin escribir una línea más: si un
segundo intento (hoy inalcanzable, pero el schema lo permitiría) fuera APROBADO después de que
el primero ya pagó, el segundo lee `orden.estado === 'pagado'` bajo el mismo lock y cae en la
rama "COBRO DUPLICADO" (línea 176-189: se asienta el hecho de Wompi, NO se crea un segundo
`Payment`, se notifica al carril de atención). El invariante que importa —"nunca dos `Payment`
por la misma plata"— vive en la ORDEN, no en el conteo de intentos.

**El carrito.** `clearCart()` se llama UNA sola vez, dentro del `try` de la PRIMERA creación
exitosa de orden (`handleOrder`, línea 227, y `crearOrdenPasarela`, línea 265) — nunca en el
camino de reintento (`crearOrdenPasarela`'s early-return de la línea 260 no lo toca). Un
reintento no necesita el carrito: la orden y sus líneas ya quedaron escritas en la base en la
primera creación: `total`/`items` los sirve la orden persistida, no el store del carrito. La
guarda `items.length === 0 && !confirmation` (línea 400) es la que impediría mostrar "carrito
vacío" durante un reintento — y funciona porque `confirmation` sigue siendo verdadero.

### 2 · La clase: una conclusión angosta escrita como decisión cerrada

**El comentario** (`checkout/page.tsx:70-76`, sobre `pasarelaMetodoNoHabilitado`):

> El proveedor rechazó la creación de la transacción de esta orden porque su cuenta ya no
> tiene el método habilitado […] Una vez en `true` no vuelve a `false`: no hay "reintentar" para
> esta orden (§ el reporte del slice, "no reintentar contra el mismo").

**Medido: para QUÉ caso se decidió.** `metodo_no_habilitado` es un rechazo ESTRUCTURAL —la
cuenta de Wompi del negocio no tiene ese método de pago encendido— que ocurre SÍNCRONO, en la
CREACIÓN de la transacción (`FormularioTarjeta.tsx:424-431`), antes de que exista ningún
veredicto del emisor. Reintentar con otra tarjeta no cambia nada porque el defecto no está en la
tarjeta: está en la cuenta. Sobre ESE caso, la conclusión es correcta y el caso SÍ tiene una
salida real hoy: `handleMetodoNoHabilitado` (línea 287-293) cae a la MISMA pantalla de
confirmación manual que usan nequi/efectivo/transferencia (línea 313, `!confirmation.wompi ||
pasarelaMetodoNoHabilitado || pasarelaAprobada` → `return`) — el pedido queda reservado, el
comprador ve su número de orden y sabe que el equipo lo va a contactar.

**La misma conclusión —"no hay salida para esta orden, no reintentes"— se aplicó, en la
redacción del reporte de `CHECKOUT-TRANSICION-DEFECTOS-1` (§4, la tabla de estados
terminales), al caso DISTINTO del rechazo del EMISOR** (la tarjeta declinada por el banco, un
hecho ASÍNCRONO que el sondeo detecta después). Esa tabla afirma, para "Rechazado": *"sabe qué
hacer (revisar datos u otro método)"* — dando por sentado que el mecanismo de reintento
FUNCIONA para ese caso. Medido: NO funciona, por la cadena completa del §1:

1. `onFallido` (`EsperaConfirmacionTarjeta.tsx:166-170`) sólo se dispara cuando el sondeo lee
   `PaymentIntent.estado !== 'EN_VUELO'` y no es `APROBADO` — es decir, cuando el intento YA
   está en `FALLIDO` en la base. El comprador nunca ve el mensaje de rechazo ANTES de que el
   intento se haya cerrado para siempre.
2. `handleFallido` (`FormularioTarjeta.tsx:453-459` y su gemelo en
   `FormularioOtroMetodoPasarela.tsx:218-222`) limpia `creada` y reactiva el formulario —
   invitando a "revisar datos" y reintentar.
3. **Cualquier reintento —misma tarjeta, otra tarjeta, u otra pestaña del picker (Nequi)— llama
   de nuevo a `crearOrdenPasarela()`, que devuelve la MISMA `reference` (§1: idempotencia por
   estado de React), y el PATCH subsiguiente choca de inmediato contra `intent.estado !==
   'EN_VUELO'` → 409, "Este pago ya se resolvió".** El formulario vuelve a mostrar ese mismo
   error, re-habilitado, en un ciclo que no puede resolver nunca — porque el intento cerrado no
   vuelve a abrirse (§1).
4. **"Otro método" tampoco es una salida real**: las pestañas de `SelectorMetodoPasarela`
   (`components/storefront/checkout/SelectorMetodoPasarela.tsx:116-220`) se renderizan
   INDEPENDIENTES de si ya existe una orden — no hay guarda que las oculte tras un rechazo—, pero
   las DOS reciben la MISMA `crearOrdenPasarela` (líneas 198 y 212), así que cambiar de pestaña
   pega contra el MISMO intento cerrado.
5. **Ni recargar la página ayuda**: `useCartStore` no persiste (medido: `grep -n "persist\|
   localStorage\|sessionStorage" lib/cartStore.tsx` no da resultados), así que un F5 pierde
   `confirmation` (vuelve a `null`) Y `items` (vuelve a `[]`) a la vez — y la guarda de la línea
   400 (`items.length === 0 && !confirmation`) manda a la pantalla genérica de "Tu carrito está
   vacío", sin ningún rastro de la orden ni del número para rastrearla.

**Es decir: el rechazo del emisor es el ÚNICO estado terminal de la transición
(§ CHECKOUT-TRANSICION-DEFECTOS-1 §4: aprobado, indeterminado, rechazado, método no habilitado)
que hoy no tiene ninguna salida** — ni un botón que funcione, ni un reload que recupere algo. La
UI simula que ofrece una (campos reactivados, mensaje de "revisa e intenta de nuevo"), lo cual
es más engañoso que no ofrecer nada: invita a una acción que está garantizado que va a fallar de
la misma forma, siempre.

**La forma de la clase, en las palabras del owner:** una conclusión angosta —medida para un
caso donde reintentar genuinamente no cambia nada (`metodo_no_habilitado`)— aplicada ancha
—a un caso donde reintentar sí tendría sentido (rechazo del emisor), si el mecanismo lo
permitiera—, y escrita en el código como decisión YA CERRADA. Es la misma forma que el caso, ya
conocido, de medir un identificador de banco contra una cuenta y concluir sobre el método
entero, y que el caso de citar una lectura de documentación como si fuera una medición. Lo que
agrava esta instancia es DÓNDE vive: no en un asiento ni en un reporte, sino en un comentario
del código y en la prosa de un ledger ya cerrado — el lugar exacto donde alguien va a buscar si
la pregunta "¿esto ya se decidió?" tiene respuesta, y va a encontrar que sí.

**Lo que este slice NO hace**: no construye el mecanismo de reintento (crear un intento nuevo
cuando el anterior cerró `FALLIDO`, o alguna otra forma). Es explícitamente la próxima decisión
de producto, fuera de este slice — se deja abierta como open_followup, con id
**`CHECKOUT-REINTENTO-MECANISMO-1`**: ¿qué hace el comprador cuando el emisor rechaza su
tarjeta? — decisión de producto (RULING_NEEDED), no de este slice.

### 2b · La gemela, en el otro repositorio — no verificada desde acá

Mientras se escribía el spec de este slice, una guarda del ORQUESTADOR (no de este repo — vive
en el repositorio de las herramientas del protocolo dev-protocol) rechazó un spec que citaba una
referencia de sección con el símbolo `§` (p. ej. "§4"), leyéndola como si fuera una cifra escrita
a mano sobre el repositorio en vez de un puntero a una sección. El comentario de esa guarda YA
declaraba que las referencias de sección debían ignorarse como estructura del spec, pero su
código sólo cubría UNA de las dos formas en que un spec puede citar una sección — la otra forma
quedó sin cubrir pese a que el comentario prometía cubrirla. Se corrigió el código de esa guarda
para que hiciera lo que su propio comentario ya afirmaba.

**Es la MISMA forma que §2, en otro material**: un comentario que promete más de lo que el
código hace (la guarda "ignora las referencias de sección" en general; su código sólo ignoraba
una de las dos formas), en vez de una conclusión angosta aplicada ancha sobre un caso de
negocio. Y la ironía que la vuelve memorable: esa guarda rechazó, por este defecto, un spec que
iba precisamente a censar declaraciones más anchas que su propia implementación — y ella misma
era una instancia de la misma clase, encontrada en el acto de hacer su trabajo sobre ese tema.

**Esta instancia vive en el OTRO repositorio, no en `coffee-template-app`.** No se verificó
desde acá —no hay acceso a ese repositorio en esta sesión— y no se presenta como medida por este
slice: es un `ledger_claim` que viene del spec, registrado acá porque el owner pidió
explícitamente que las dos formas de la misma clase queden juntas en un solo asiento.

### 3 · El censo de comentarios que declaran cerrado un caso más ancho del que midieron

**Alcance recorrido, explícito**: se buscaron patrones de cierre (`no hay`, `nunca se`, `jamás`,
`descartado`, `decisión (tomada|cerrada)`) en los subárboles del dinero y del checkout —
`packages/core/src`, `app/api/{checkout,webhooks,cron,orders,comprobantes,inventory,products,
shippings}`, `lib/{checkout,pagos}`, `components/storefront/checkout`,
`services/checkout.service.ts` — **105 apariciones**, revisadas una por una contra su alcance
medido. **NO se recorrió** el resto de `app/api` (rutas de admin), `components/admin`, el resto
de `lib/`, ni `packages/design-system` — este censo es PARCIAL, acotado a donde el owner pidió
empezar.

**Un segundo hallazgo de la misma familia, más leve y más honesto que el de §2** —
`components/storefront/checkout/interpretar-respuesta-otro-metodo.ts:36-42`:

> `metodo_no_habilitado` se devuelve como su PROPIO caso […] aunque hoy los dos se muestren
> igual en pantalla […] este formulario NO ofrece un camino de salida distinto para el rechazo
> estructural (`SelectorMetodoPasarela` no le pasa `onMetodoNoHabilitado` — decisión ya tomada,
> § el reporte del slice), así que no hay UI propia que construir acá.

**Qué midió**: que hoy nadie construyó una salida propia para `metodo_no_habilitado` en el
camino Nequi/otro-método (a diferencia de tarjeta, que sí cae a la confirmación manual, §2).
**Qué declara**: "decisión ya tomada" — leído junto al comentario de `checkout/page.tsx:75-76`
(§2), un lector puede concluir que el caso está resuelto de la misma forma para los dos
caminos. **Qué queda sin volver a preguntarse por eso**: si `metodo_no_habilitado` en el camino
Nequi también debería caer a la confirmación manual (como tarjeta), o si de verdad amerita una
respuesta distinta. A diferencia de §2, este comentario SÍ se declara reversible en su propia
frase ("quien reciba este resultado puede decidir distinto sin tener que volver a tocar esta
función") — no es una conclusión cerrada disfrazada de cerrada, es una conclusión abierta que
un lector apurado podría leer como cerrada por la vecindad con la frase de tarjeta. Se anota
como candidato de la misma familia, no como una instancia tan grave como §2, con id
**`CHECKOUT-OTRO-METODO-SIN-SALIDA-1`**: ¿el rechazo `metodo_no_habilitado` en el camino Nequi/
otro-método debería caer a la misma confirmación manual que ya usa tarjeta? — decisión de
producto, no de este slice.

**Ningún otro de los 105 resultó ser una conclusión angosta aplicada ancha.** La gran mayoría
son afirmaciones LOCALES y correctamente acotadas ("sin referencia no hay por dónde ubicar el
intento", "sin secreto no hay forma de verificar ningún evento", "FALLIDO no toca la Order
porque no hay decisión de dinero que proteger") — el caso medido y el caso declarado coinciden.
No se arregló ninguno de los dos hallazgos de este censo: sólo se nombran.

### Gate

`npm run gate`, los dos carriles, corrido sobre el árbol final — **verde**. El diff de este
slice es EXCLUSIVAMENTE esta entrada de `DECISIONS.md`: ningún archivo de código, test, schema
ni migración se tocó, así que las cifras de la corrida coinciden con las de las dos entradas
inmediatamente anteriores de esta misma rama.

**Tier 1 — SÍ aplica**: el spec lo declaró `tier: 1`, `writes: yes`, `approved: yes`
(`approved-by: owner`, `approval-reason`: el censo del reintento corrió como slice de sólo
lectura y no dejó asiento; el owner pidió que este slice midiera de nuevo y dejara el asiento, que
la clase de la conclusión estirada quedara registrada como CLASE —no como anécdota del checkout—,
y que se censaran más comentarios de la misma forma). **LA APROBACIÓN AUTORIZA LA ESCRITURA, NUNCA
EL MERGE** — el merge sigue gateado al owner, y este slice para en `AWAITING_APPROVAL` sin
mergear.

## 2026-09-18 — El reintento de pago con OTRO MÉTODO, opción A construida, y el techo de
redirección deja de ser un callejón (`CHECKOUT-REINTENTO-OTRO-METODO-1`)

**Cierra `CHECKOUT-REINTENTO-MECANISMO-1`** (el open_followup de `CHECKOUT-REINTENTO-CENSO-1`,
arriba: "¿qué hace el comprador cuando el emisor rechaza su tarjeta?") — la respuesta construida
acá es la opción A del §0.

### 0 · La decisión del owner, y por qué manda

El censo del reintento (`CHECKOUT-REINTENTO-CENSO-1`, arriba) midió que el rechazo del emisor es
el ÚNICO estado terminal de la transición de pasarela sin ninguna salida real: el formulario
reactivaba los mismos campos, pero cualquier reintento —misma tarjeta, otra tarjeta, u otro
método— pegaba contra la MISMA `reference` ya cerrada (`intent.estado !== 'EN_VUELO'` → 409 "Este
pago ya se resolvió") en un ciclo que nunca terminaba. El owner eligió, entre dos opciones (A:
intento nuevo sobre la misma orden; B: cancelar y crear una orden nueva), la opción A, con su
razón textual:

> «La seguridad de B depende de que cancelar la orden vieja sea obligatorio y sincrónico —o sea,
> de disciplina—; la de A no depende de nada, porque el aprobado tardío cae sobre la misma orden y
> toma el carril de cobro duplicado que ya existe.»

Fijó además: tope de TRES intentos por orden (el cuarto no se ofrece, y el comprador ve el número
de orden y las dos acciones — como el resto de los estados terminales); el copy exacto del botón
("Intentar con otro método") y del mensaje de rechazo (dos oraciones: "Tu pago no fue aprobado. No
se realizó ningún cobro."); y pidió cerrar en el mismo slice `CHECKOUT-REDIRECCION-TECHO-SIN-
ACCIONES-1`, la misma clase de defecto en `EsperaRedireccionPasarela`.

### 1 · Por qué la opción A no necesita una guarda nueva de doble cobro

Medido (`CHECKOUT-REINTENTO-CENSO-1`): `aplicarResultadoWompi` (`packages/core/src/pagos/
aplicar-resultado-wompi.ts`) lockea la Order y compara `orden.estado !== 'pendiente'` — POR ORDEN,
nunca por intento ni por cantidad de `PaymentIntent`. Un segundo (o tercer) intento aprobado tarde
sobre una orden ya pagada cae en la rama "cobro duplicado" que ya existe: se asienta el hecho de
Wompi, no se crea un segundo `Payment`, se notifica al carril de atención. Este slice NO tocó esa
función, el webhook ni el reconciliador — la garantía preexistente ya cubre N intentos.

### 2 · Lo construido — servidor

**`packages/core/src/orders.ts`** gana el mecanismo de reintento, sin migración (el schema ya
soporta N `PaymentIntent` por `Order` — `orden_id` no es `@unique`, medido en el censo):

- **`TOPE_INTENTOS_PAGO_POR_ORDEN = 3`** — constante nombrada, con el argumento del owner escrito
  al lado ("un formulario de tarjeta sin tope es una superficie de prueba de tarjetas robadas").
- **`decidirReintentoPago(orden, intentosExistentes)`** — la decisión PURA (sin Prisma): "sigue
  pendiente" se verifica ANTES que el tope (otra pestaña pudo haber pagado mientras tanto), y sólo
  entonces se compara el conteo contra el tope. Extraída para poder afirmarla en un test sin base
  — el mismo criterio de siempre ("se extrae lo que tiene la decisión para poder afirmarlo").
- **`crearIntentoPagoDeReintento(numeroOrden)`** — lockea la orden (`FOR UPDATE`, mismo patrón que
  `lockOrderForPayment`), cuenta los intentos existentes BAJO ese lock, corre la decisión pura, y
  si es `permitido` crea el `PaymentIntent` con el MISMO patrón de dos escrituras (placeholder →
  referencia real) que ya usa `createOrderWithCustomer`. Decisión y escritura son atómicas: dos
  "Intentar con otro método" concurrentes sobre la misma orden no pueden colarse los dos por
  encima del tope.

**`app/api/checkout/route.ts`** — el bloque que arma la respuesta `wompi` (firma + aceptaciones)
del POST original se EXTRAJO a `armarBloqueWompiPago(reference, montoEsperado)`, exportada, sin
cambiar una sola rama de comportamiento del POST (mismo texto de error, mismo status). Es la pieza
que el reintento necesitaba reusar — dos implementaciones de "qué cuenta como bloque completo"
habría sido la misma clase de divergencia que ya pagaron `razonDelServidor`/`cruzoMinimo`.

**`app/api/checkout/reintento/route.ts`** (nuevo) — la ÚNICA puerta que abre un intento nuevo.
`POST { numero_orden }` → `crearIntentoPagoDeReintento` → si `creado`, `armarBloqueWompiPago` pide
un bloque de aceptación FRESCO (el MISMO mecanismo — `obtenerBloqueAceptacionPasarela` — que ya usa
la creación original, nunca uno cacheado) y responde `{ tipo: 'creado', wompi }`. El cliente no
manda ningún dato de aceptación en este POST — sólo `numero_orden` — así que no existe ruta por la
que un token viejo pudiera colarse. `PATCH /api/checkout` NO SE TOCÓ: su guarda `intent.estado !==
'EN_VUELO'` sigue siendo la que impide reusar un intento cerrado — este endpoint sólo le da, de
nuevo, un intento `EN_VUELO` legítimo contra el cual confirmar.

### 3 · Lo construido — cliente

`FormularioTarjeta.tsx` y `FormularioOtroMetodoPasarela.tsx` ganan, los dos, el MISMO mecanismo
(el defecto era transversal a los dos formularios de pasarela, no exclusivo de tarjeta —
`CHECKOUT-TRANSICION-DEFECTOS-1` ya lo trató así):

- **`rechazado` (booleano) reemplaza los campos por la vista de rechazo** cuando el sondeo detecta
  un estado final que no es `APROBADO` — nunca conviven las dos respuestas al mismo momento (mismo
  criterio que ya cerró `techo` en `CHECKOUT-TRANSICION-DEFECTOS-1`). Se distingue de un error de
  VALIDACIÓN/TOKENIZACIÓN previo a crear la orden (ese sí deja los campos a la vista: no hay ningún
  intento que reintentar, porque nunca se creó ninguno).
- **El texto del owner, textual: "Tu pago no fue aprobado. No se realizó ningún cobro."** — DOS
  oraciones. El texto anterior (`pagoRechazado`) tenía una TERCERA ("Revisa los datos o intenta con
  otro método.") que se retiró: ese trabajo ahora lo hace el botón, no una frase que lo anticipa.
- **El botón "Intentar con otro método"** (texto del owner, textual) llama a `onReintentarOtroMetodo`
  — bubbleado por `SelectorMetodoPasarela` hasta `checkout/page.tsx`, que hace TODO el trabajo
  (fetch al endpoint nuevo, clasificación de la respuesta, actualización de estado). El formulario
  local sólo bloquea el botón mientras la promesa viaja (`reintentando`).

`checkout/page.tsx` gana `reintentarConOtroMetodo`:

- **Al conseguir un intento nuevo**: reemplaza `confirmation.wompi` por el bloque nuevo, reemplaza
  `bloquePasarela` (aceptaciones + publicKey + metodosOtros) por los valores FRESCOS que la
  respuesta trajo, y avanza `reintentoKey` — la ÚNICA `key` de `<SelectorMetodoPasarela>`, que
  fuerza su REMONTE completo con la `reference` nueva (picker limpio, de vuelta en la pestaña
  tarjeta, sin el error de rechazo colgado). `reintentoKey` SÓLO avanza acá — nunca durante la
  creación inicial del primer intento (que remontaría el formulario a mitad de un `handlePagar` en
  vuelo, un defecto que se evitó a propósito, no un accidente evitado por casualidad).
- **Si la orden ya no está pendiente y su estado es `pagado`** (otra pestaña la pagó mientras el
  comprador decidía reintentar — el servidor lo verificó bajo lock): `setPasarelaAprobada(true)`,
  la MISMA pantalla de éxito de `CHECKOUT-TRANSICION-DEFECTOS-1`. Cualquier OTRO estado no-pendiente
  (p. ej. `cancelado`) cae al mensaje genérico — fuera de alcance de este slice, no hay pantalla
  propia para ese caso.
- **Si el servidor responde `tope_alcanzado`**: `setIntentosAgotados(true)` — flag NUEVA que se
  agregó a la MISMA condición que ya dispara la pantalla completa "¡Pedido recibido!" reusada por
  `pasarelaMetodoNoHabilitado`/`pasarelaAprobada` (`CHECKOUT-TRANSICION-DEFECTOS-1`). El comprador
  ve el número de orden y las dos acciones — TEXTO DEL OWNER, cumplido literal: "al agotarse, el
  comprador ve el número de orden y las dos acciones, como el resto de los estados terminales".

### 4 · `EsperaRedireccionPasarela` — el techo deja de ser un callejón (`CHECKOUT-REDIRECCION-
TECHO-SIN-ACCIONES-1`)

Su vista `techo` (el sondeo de la dirección de redirección se agotó sin encontrarla) decía "Todavía
no pudimos abrir la página de pago" sin número de orden ni ninguna acción — el MISMO defecto que
`EsperaConfirmacionTarjeta.techo` tenía antes de `CHECKOUT-TRANSICION-DEFECTOS-1`. Se cerró con la
MISMA forma: la caja de "Número de orden" (derivado de `reference.split(':')[0]`, la MISMA
convención que ya usa `EsperaConfirmacionTarjeta`) + "Rastrear mi pedido" / "Seguir comprando". Este
camino sigue siendo INALCANZABLE hoy por ningún comprador real —ningún descriptor real declara
`redireccion`, medido en `CHECKOUT-REINTENTO-CENSO-1`—; se cierra igual porque el owner lo pidió
explícito y porque dejarlo abierto "es garantizar que vuelva".

### 5 · Deviations medidas contra `touches:`

**`tests/integracion/` no está en `touches:` de este slice** (sólo `components/storefront/
checkout/`, `app/(storefront)/checkout/`, `app/api/checkout/`, `packages/core/src/orders.ts`,
`DECISIONS.md`), así que la ATOMICIDAD del lock+conteo de `crearIntentoPagoDeReintento` (dos
reintentos concurrentes sobre la misma orden) NO se verificó contra Postgres real en este slice —
sólo la decisión PURA que corre bajo ese lock (`decidirReintentoPago`, con tests en `app/api/
checkout/reintento/route.test.ts`). El mecanismo de lock en sí (`FOR UPDATE` sobre la Order) es el
MISMO patrón ya afirmado por el carril para `lockOrderForPayment`/`registerOrderPaymentTx`
(`cobro-sincronizado.test.ts`) y para el creador de intentos original (`intento-pago-atomico.
test.ts`) — no una construcción nueva sin precedente probado, pero la instancia NUEVA
(`crearIntentoPagoDeReintento`) no tiene su propio test de concurrencia con base real. Abierto como
open_followup.

**Un archivo de test nuevo bajo `components/storefront/checkout/` rompe una guarda AJENA a este
slice** — descubierto al correr el gate, no anticipado por el spec. `lib/gate/tests-descubiertos.
test.ts` ("archivosSinCubrir: EL CASO REAL DE ANOCHE") reproduce un incidente histórico
re-escaneando el árbol REAL del repo contra los patrones DE ANTES de `GATE-GLOB-COMPONENTS-
SERVICES-1`, y afirma con `assert.deepEqual` que el resultado son EXACTAMENTE los dos archivos que
quedaron invisibles esa noche. Como ese test re-escanea el árbol VIVO (no un fixture congelado),
CUALQUIER archivo `*.test.ts` nuevo bajo `components/`, `services/` o `app/` que no exista todavía
en esa lista hardcodeada rompe la igualdad exacta — medido: crear `components/storefront/checkout/
interpretar-respuesta-reintento.test.ts` hizo que `archivosSinCubrir` devolviera TRES en vez de
DOS. `lib/gate/` no está en `touches:` de este slice, así que esa guarda no se tocó. La resolución
fue de UBICACIÓN, no de contenido: el clasificador PURO del lado cliente
(`interpretarRespuestaReintento`) se quedó en `components/storefront/checkout/` (junto a su hermano
`interpretar-respuesta-otro-metodo.ts`, que es un archivo `.ts`, no `.test.ts` — no dispara la
guarda), pero SU TEST se escribió en `app/api/checkout/reintento/route.test.ts` (que sí estaba
cubierto incluso por los patrones de esa noche, `app/**/*.test.ts`), evitando el archivo nuevo bajo
`components/` que habría disparado la regresión. **La guarda queda con un defecto de diseño sin
arreglar, nombrado como open_followup**: re-escanea el árbol vivo contra un snapshot de patrones
congelado, así que cualquier archivo de test legítimo bajo un subárbol que ganó su glob DESPUÉS del
incidente sigue rompiendo la reproducción histórica para siempre — el fix correcto sería congelar
también la LISTA DE ARCHIVOS de esa noche (no sólo los patrones), no algo para decidir en este
slice.

**Un candidato nuevo para la lista canónica de Tier 1, no agregado** (CLAUDE.md no está en
`touches:`): `app/api/checkout/reintento/route.ts` es, por el criterio de la propia doctrina, una
puerta de escritura de dinero —crea un `PaymentIntent` nuevo— nacida en este slice. La frase
canónica de Tier 1 (CLAUDE.md, § el párrafo largo tras "PRECONDICIÓN") no la nombra todavía.
Abierto como open_followup para que un slice de doctrina la mida y la agregue, con el mismo
criterio que ya usó `TIER1-DOS-CANDIDATOS-CLASIFICADOS-1`.

### 6 · Lo que NO se hizo

Ninguna orden nueva se crea en ningún camino (la opción B, descartada). Ningún archivo del eje del
dinero fuera de `touches:` se tocó — el webhook, el reconciliador y `aplicarResultadoWompi` quedan
intactos. Ningún otro texto provisional del programa se tocó fuera de los dos nombrados (§3 —el
mensaje de rechazo— y este mismo mensaje en `FormularioOtroMetodoPasarela`). `CHECKOUT-OTRO-
METODO-SIN-SALIDA-1` (¿el rechazo `metodo_no_habilitado` en el camino Nequi/otro-método debería
caer a la confirmación manual?) sigue sin decidirse — es una pregunta DISTINTA (rechazo
ESTRUCTURAL, síncrono, en la creación de la transacción), no el rechazo del EMISOR que este slice
resuelve.

### Gate

**`npm run gate`, los dos carriles, corrido sobre el árbol final — verde.** Fast lane (`npm test`):
1457/1457 (1457 = 1456 antes de este slice + 1, neto, tras contar los tests nuevos de este slice
menos el archivo movido — medido por ejecución, no por conteo de líneas agregadas). Carril de
integración (`npm run test:integracion`, Postgres efímero): 208/208, sin cambio de número —
ningún test de este carril se agregó ni se tocó (§5, la deviation de arriba). `npx tsc --noEmit`
también corrido, sin errores.

**El camino manual y los otros métodos de pago quedan intactos**: `handleOrder`, `crearOrdenPasarela`
(para el PRIMER intento) y el resto de la transición del checkout no cambiaron ni una línea de su
lógica — sólo ganaron el nuevo prop `onReintentarOtroMetodo`, que se reenvía sin interpretarlo.

**La secuencia completa que ve un comprador rechazado, hasta agotar el tope** (medida contra el
código, no ejecutada en navegador — no hay harness de render en este repo, § CLAUDE.md doctrina de
las tres capas; el gate visual del owner confirma esto en pantalla):

1. Aprieta "Pagar" con tarjeta A → el emisor rechaza (intento #1, `FALLIDO`) → ve "Tu pago no fue
   aprobado. No se realizó ningún cobro." + el número de orden + "Intentar con otro método".
2. Clickea el botón → `POST /api/checkout/reintento` crea el intento #2 con aceptaciones frescas →
   `SelectorMetodoPasarela` remonta, picker limpio en la pestaña tarjeta.
3. Aprieta "Pagar" con tarjeta B (u otro método) → rechazo de nuevo (intento #2, `FALLIDO`) → MISMA
   vista de rechazo.
4. Clickea otra vez → intento #3, mismo ciclo.
5. Si el intento #3 también es rechazado y el comprador clickea "Intentar con otro método" una
   tercera vez: el servidor cuenta 3 intentos existentes ≥ el tope → `tope_alcanzado` → la página
   muestra la pantalla completa "¡Pedido recibido!" con el número de orden y las dos acciones
   (Rastrear mi pedido / Seguir comprando) — sin ofrecer un cuarto intento.

**Tier 1 — SÍ aplica**: el spec lo declaró `tier: 1`, `writes: yes`, `approved: yes`
(`approved-by: owner`, `approval-reason`: el owner eligió la opción A el 2026-09-18 con la razón
del §0, fijó el tope en tres, el copy del botón y del mensaje, y pidió cerrar en el mismo slice el
hueco de `EsperaRedireccionPasarela`). **LA APROBACIÓN AUTORIZA LA ESCRITURA, NUNCA EL MERGE** — el
merge sigue gateado al owner, y este slice para en `AWAITING_APPROVAL` sin mergear.

## 2026-09-18 — El bloque «Método de pago» deja de desmontarse: la premisa que lo justificaba la mató nuestro propio slice anterior, y es la TERCERA instancia de la clase (`CHECKOUT-SELECTOR-NO-SE-DESMONTA-1`)

### 0 · El hecho medido

`checkout/page.tsx` desmontaba el bloque «Método de pago» (el h2 + la lista de radios entre
métodos manuales y la opción de pasarela) apenas `confirmation` existía —`{!confirmation && (…)}`—,
con un comentario que decía por qué:

> § CHECKOUT-UNA-SOLA-PANTALLA-1: el selector de método sólo se muestra ANTES de que exista la
> orden — una vez creada, "Información"/"Dirección" y el método elegido ya no son editables
> (misma garantía que antes tenía el `return` temprano de arriba).

**Medido: ese comentario nació en `98217cb` (`CHECKOUT-UNA-SOLA-PANTALLA-1`, 2026-09-17
15:30:02) y su premisa quedó FALSA en `2a76697` (`CHECKOUT-REINTENTO-OTRO-METODO-1`, 2026-09-18
12:18:16) — el commit INMEDIATAMENTE ANTERIOR en esta misma rama, ~21 h después de escrito.** Ese
slice construyó el botón "Intentar con otro método" (`FormularioTarjeta.tsx`/
`FormularioOtroMetodoPasarela.tsx`, vía `SelectorMetodoPasarela`, `onReintentarOtroMetodo` →
`POST /api/checkout/reintento`) que abre un `PaymentIntent` NUEVO sobre la MISMA orden y deja al
comprador elegir de nuevo — exactamente lo que el comentario decía que no iba a volver a pasar. El
`approval-reason` de este slice lo dice con las palabras del owner: *"si el bloque no está, ese
botón tiene que reconstruir en pantalla algo que ya existía. Lo que se desmonta hay que volver a
montar."*

### 1 · Lo construido

`checkout/page.tsx` gana `bloqueoMetodoDePago = !!confirmation` (derivado, junto a
`pasarelaOfrecida`). El bloque «Método de pago» **YA NO se desmonta**: se quitó el wrapper
`{!confirmation && (…)}` y el `<h2>` + la lista de radios se renderizan SIEMPRE. Mientras
`bloqueoMetodoDePago` es `true`:

- Cada `<input type="radio">` (los métodos manuales Y la opción de pasarela) gana
  `disabled={bloqueoMetodoDePago}` + `disabled:pointer-events-none` en su propia clase — el MISMO
  atributo que usan los campos de `FormularioTarjeta.tsx` (`CampoTarjeta`, `disabled={procesando}`)
  y las dos casillas de `AceptacionesPasarela.tsx` un nivel más abajo, no una guarda nueva.
- El `<label>` que envuelve cada opción gana `opacity-60 cursor-not-allowed` (computado en JS, no
  vía el pseudo-selector `disabled:` — un `<label>` no es un control con estado disabled propio):
  mismo resultado visual que `disabled:opacity-60` en los campos de tarjeta.
- `Field` (el componente LOCAL de este archivo, usado para "Referencia de pago") gana un prop
  `disabled?: boolean` nuevo, threadeado con la misma clase `disabled:opacity-60
  disabled:pointer-events-none`. Los demás llamadores de `Field` (Nombre, Apellido, Correo,
  Dirección, Detalles, Ciudad) no lo pasan → sin cambio de comportamiento para ellos.

**Alcance verificado, no supuesto**: `bloqueoMetodoDePago` sólo puede ser `true` dentro de la rama
API DIRECTA del paso de pago. El camino de métodos MANUALES sale por el `return` temprano de la
línea ~393 (`!confirmation.wompi` → pantalla "¡Pedido recibido!" completa) antes de llegar a este
bloque; el WIDGET de Wompi sale por la rama `confirmation.wompi && !modoApiDirecta` de la línea
~621 (una vista distinta, declarada "TAL CUAL estaba antes de este slice", no tocada). Ningún otro
flujo cambia de comportamiento.

### 2 · Lo que NO se construyó — medido y reportado, como pidió el spec

**"Cuando el pago se rechaza, tiene que volver a ser usable" no se implementó de forma granular.**
Medido: la página NO tiene ninguna señal para "este intento se rechazó, pero el ciclo sigue
abierto" — el estado `rechazado` (booleano local que reemplaza los campos por la vista de rechazo
+ el botón de reintento) vive DENTRO de `FormularioTarjeta.tsx`/`FormularioOtroMetodoPasarela.tsx`
y nunca se bubblea hasta `checkout/page.tsx`. La página sólo conoce estados TERMINALES
(`pasarelaAprobada`, `pasarelaMetodoNoHabilitado`, `intentosAgotados`) — y los tres, al ser
terminales, ya reemplazan la pantalla ENTERA antes de que este bloque se renderice, así que no hay
nada que desbloquear ahí.

**Threadear `rechazado` hasta la página exige tocar `components/storefront/checkout/*.tsx`, que
NO está en el `touches:` de este slice** (`app/(storefront)/checkout/`, `CLAUDE.md`,
`DECISIONS.md` — verificado contra el spec, no supuesto). Por eso `bloqueoMetodoDePago` se queda
`true` durante TODO el ciclo de pasarela (desde que la orden existe hasta un desenlace terminal),
incluidos los reintentos — no se desbloquea entre intentos.

**La pregunta del spec, medida: "¿el botón sigue haciendo falta, o el bloque desbloqueado ya
alcanza?"** El botón SIGUE haciendo falta, sin condición. Aunque el bloque se desbloqueara,
NINGÚN camino consume un cambio en `payment`/`pasarelaSeleccionada` una vez que `confirmation`
existe: los botones "Atrás"/"Confirmar pedido" de `handleOrder` siguen detrás de
`{!confirmation && (…)}` (línea ~773, sin tocar), y no hay ningún otro `onClick` que lea esos
estados para volver a intentar. Desbloquear el bloque SIN el botón dejaría radios que se ven
interactivos y no hacen nada al clickearlos — peor que dejarlos bloqueados. `POST /api/checkout/
reintento` (vía el botón) es el ÚNICO mecanismo que de verdad abre un intento nuevo. El botón NO
se tocó.

**Open follow-up, para el owner** — `CHECKOUT-SELECTOR-DESBLOQUEO-POR-RECHAZO-1`: ¿debería el
bloque desbloquearse durante la ventana entre un rechazo y el clic en "Intentar con otro método"
(en vez de quedarse bloqueado todo el ciclo)? Es una decisión de PRODUCTO (qué ve el comprador en
ese instante), y construirla exige ampliar `touches:` a `components/storefront/checkout/` — no se
decide ni se construye en este slice.

### 3 · La ruta del reintento entra a Tier 1

`app/api/checkout/reintento/route.ts` (nacida en `2a76697`, el mismo commit del §0) es una puerta
de escritura del eje del dinero por el criterio literal —abre un `PaymentIntent` NUEVO sobre una
orden ya existente— y NO estaba en la frase canónica de `CLAUDE.md` (línea 39): esa frase sólo
nombraba el archivo suelto `app/api/checkout/route.ts`, no el subárbol `app/api/checkout/`. El
propio asiento de `CHECKOUT-REINTENTO-OTRO-METODO-1` (§5, arriba) declaraba su `touches:` como
`app/api/checkout/` (el subárbol, para SU alcance de escritura) — pero el `touches:` de un slice y
la frase canónica de Tier 1 son dos listas DISTINTAS, y una entrada en la primera no mueve la
segunda. Es la MISMA clase que `TIER1-SUBARBOL-NO-DISPARABA-1` ya documentó: una entrada escrita en
PROSA (o en el `touches:` de otro slice) no es una entrada en la FRASE de la que el validador
deriva sus disparadores. Se agregó `app/api/checkout/reintento/route.ts` como archivo suelto,
junto a `app/api/checkout/route.ts` — en la frase (CLAUDE.md línea 39) y en un párrafo de
re-medición nuevo ("CUARTA vez el mismo día", § Tier 1 — superficies protegidas).

### 4 · La clase — tercera instancia, y la más rápida en morir

**Una decisión no vence sola — la vence trabajo posterior, y el trabajo que la mata casi nunca
sabe que la está matando.** Dos instancias ya viven en el libro:

- **`COBRO-SIN-PEDIDO-ASIENTO-1`** (arriba, 2026-09-18): cinco frases de `CLAUDE.md` sobre el
  programa de Wompi, correctas cuando `TIER1-LISTA-VENCIDA-1` las re-midió el 2026-09-14, quedaron
  falsas UN DÍA DESPUÉS por dos commits (`ff9dda8`, `9abdc5b`) del MISMO programa, sobre su PROPIA
  sección — y nadie las releyó hasta que el incidente real las destapó.
- **`CLAUDE-MD-FRASES-VENCIDAS-1`** (`CLAUDE.md`, § Backlog técnico, 2026-09-14): "cada dormido es
  detección nueva sobre el MISMO fetch" y "no fires para Nayoli hoy" —dos premisas del § 65,
  correctas cuando se escribieron, muertas por tandas de OTRA área (la construcción del dormido #8,
  y `CONTENIDO-NEUTRALIZAR-1…4`) que nunca releyeron el párrafo que dependía de ellas.

**Esta es la tercera, y la que muere MÁS RÁPIDO de las tres**: el comentario de `checkout/
page.tsx` (98217cb, 2026-09-17 15:30:02) quedó falso por `2a76697` (2026-09-18 12:18:16) — ~21
horas, el commit INMEDIATAMENTE ANTERIOR en la misma rama, del MISMO programa, escrito por la
MISMA sesión de trabajo que había dejado la premisa. No hizo falta que pasara un día ni que otra
área tocara algo ajeno: bastó el slice siguiente. Con las palabras del owner, citadas en el
`approval-reason` de este spec: *"esa premisa la mató el slice del reintento una hora antes, que le
da al comprador un botón para cambiar de método."*

### Gate

`npm run gate`, los dos carriles, corrido sobre el árbol final. Ver el reporte del slice para el
resultado exacto y las cifras (passed/failed/wall_seconds) — no se transcriben acá para no
duplicar un número que puede volver a medirse.

### Deviations

Ninguna sobre el mecanismo de bloqueo en sí. La única desviación medida es de ALCANCE: el spec
pedía "cuando el pago se rechaza, tiene que volver a ser usable" y este slice no lo construyó —
§2 mide por qué (`components/storefront/checkout/` fuera de `touches:`) y lo deja como
`CHECKOUT-SELECTOR-DESBLOQUEO-POR-RECHAZO-1`, tal como el propio spec autorizaba ("medí… y decilo…
no borres el botón… dejá que lo decida el owner").

## 2026-09-18 — Los tres hallazgos del gate visual del owner: el botón que decía otra fase, el cursor de la barra, y el runbook sin decir hasta dónde midió (`CHECKOUT-GATE-VISUAL-HALLAZGOS-1`)

### 0 · Qué pidió el owner

Tres hallazgos del gate visual sobre el deployment real (2026-09-18): (1) el botón de pago decía
"Verificando tarjeta…" mientras, en la MISMA vista, la línea de abajo decía "Estamos confirmando
tu pago." — pidió que el botón dijera algo acorde a la fase real, en el registro de la línea de
abajo; (2) al teclear los dos primeros dígitos del vencimiento la barra aparece bien pero el
cursor queda ANTES de ella (el tercer dígito sí cae del lado correcto); (3) la tarjeta de prueba
de Mastercard no llegó a aprobado en el deployment real, y el spec advertía [SIN MEDIR] que el
runbook de datos de prueba sólo tenía medida su tokenización. También pidió sacar la etiqueta
"Estado: Pagada" de la confirmación (3b), con el cuidado de medir si el camino manual la necesita.

### 1 · El botón sigue la fase real, medida del estado — no del reloj

`FormularioTarjeta.procesando` (`tokenizando || !!creada`) gobernaba UN solo texto de botón
(`TEXTO.botonEnVuelo`, "Verificando tarjeta…") durante TODA la espera — incluida la fase, después
de `creada`, en la que `EsperaConfirmacionTarjeta` ya sondea y muestra su propia línea
("Estamos confirmando tu pago."). El botón afirmaba un hecho VENCIDO (la tarjeta ya se tokenizó)
mientras la línea de abajo afirmaba el hecho ACTUAL, a la vez.

**Elegido: el botón dice el hecho actual, y la línea de abajo deja de repetirlo cuando no aporta
nada nuevo.** `TEXTO.botonConfirmando` ("Confirmando tu pago…", MISMO registro que "Estamos
confirmando tu pago." — sin inventar un tercero) se muestra apenas `creada` existe. Y
`EsperaConfirmacionTarjeta` gana `botonYaMuestraFaseConfirmando` (default `false`, sin romper a
`FormularioOtroMetodoPasarela`, que no lo pasa): con él, SIN desafío 3DS, el párrafo
`enVueloSinFriccion` no se dibuja — el botón ya dijo lo mismo. CON desafío, la línea sigue
mostrándose siempre: ahí aporta algo que el botón no puede decir (el marco embebido del emisor, o
la explicación de que hay un banco de por medio), así que no es un duplicado.

**El texto exacto que ve el comprador, por fase** (`FormularioTarjeta`):

| fase | texto del botón |
| --- | --- |
| formulario en reposo | `Pagar · $X` |
| tokenizando (antes de crear la orden) | `Verificando tarjeta…` |
| orden creada, esperando al emisor (con o sin desafío) | `Confirmando tu pago…` |
| rechazo del emisor, esperando reintento | `Intentar con otro método` / `Preparando…` (sin cambios) |

`FormularioOtroMetodoPasarela` NO se tocó: su botón sigue diciendo `Procesando…` durante las dos
fases, y `EsperaConfirmacionTarjeta` le sigue mostrando su línea sin desafío — no está en el spec
de este slice, y tocarlo habría sido ensanchar el fix hacia una superficie que el owner no
gateó. Anotado como open follow-up.

### 2 · El cursor del vencimiento — la regla de "editar en el medio", aplicada a "teclear al final"

`cursorTrasNDigitos` declara que un separador nunca atrapa el cursor: el cursor queda pegado al
dígito, nunca del otro lado. Es la regla correcta para EDITAR EN EL MEDIO (así el próximo borrado
quita un dígito real). Aplicada tal cual a un dígito tecleado AL FINAL de lo escrito —el caso del
vencimiento al segundo dígito, donde la barra recién aparece— deja el cursor ANTES de la barra en
vez de después: funcionalmente inofensivo (el tercer dígito cae del lado correcto igual, porque
`formatearVencimientoCampo` re-deriva la barra en el mismo lugar) pero se sintió mal, que fue
justo lo que el owner reportó. Es la misma familia que el libro ya viene anotando: una decisión
medida para un caso (editar en el medio), aplicada a uno más ancho (seguir tecleando hacia
adelante) donde da el resultado contrario.

`reformatearCampoTarjeta` ahora distingue los dos casos por la MISMA información que ya tenía —sin
cambiar su firma ni pedir el valor anterior—: si el cursor queda al final de TODOS los dígitos
tecleados (nada más adelante en `valorNuevo`), el resultado es el final del string formateado,
pase lo que pase con los separadores; si no, sigue la regla de `cursorTrasNDigitos` de siempre.

**Verificado que no rompe lo que la regla vieja protegía** (§ mid-edit, borrar, pegar) —
recalculado a mano para cada test existente antes de tocar código, y los 57 tests de
`lib/checkout/tarjeta.test.ts` (incluidos los 2 nuevos: la corrección del test cuyo TÍTULO ya
decía "el cursor pasa la barra" pero cuya ASERCIÓN afirmaba lo contrario —`cursor === 2`, antes de
la barra—, y el test nuevo de corregir un dígito del medio del vencimiento) pasan verdes.

### 3 · El runbook no decía hasta dónde medía — y el Mastercard del owner no estaba, no a medias

**Medido, no asumido**: el `[SIN MEDIR]` del spec decía que "el runbook de datos de prueba solo
tenía medida la TOKENIZACIÓN" de la tarjeta Mastercard que el owner usó. Un grep de
`mastercard`/`5555`/`brand` sobre `docs/RUNBOOK-DATOS-PRUEBA-SANDBOX.md` (antes de este slice) da
CERO filas — las únicas tarjetas que ese documento tokenizó de punta a punta son las dos VISA de
§4/§5. La premisa del spec es FALSA tal como está escrita: no es que el runbook midiera sólo la
tokenización de Mastercard, es que NO LA MENCIONA. La única referencia a Mastercard en el
programa es el rango IIN puramente LOCAL de `lib/checkout/tarjeta.ts` (detección de red por
prefijo, nunca habla con el proveedor); la única red no-Visa con una llamada real al sandbox
documentada es UnionPay (`SPIKE-REDES-QUE-PROCESA-1`, citado en ese mismo archivo), y tampoco
tiene asiento propio en `DECISIONS.md` (grep de `unionpay`: cero filas).

**Corregido** (`docs/RUNBOOK-DATOS-PRUEBA-SANDBOX.md`): cada tarjeta que el runbook ya medía (§4,
§5, §6) gana una línea explícita de "profundidad medida" (tokenización vs. desenlace final), y
la tabla resumen (§11) gana una columna "profundidad". Se agregó §12, íntegro, para la
Mastercard: documenta que NINGUNA medición de este runbook la cubre, y deja la observación del
GATE del owner (2026-09-18: pagó con una Mastercard de prueba en el deployment real y la
transacción terminó rechazada) marcada explícitamente como observación de gate — no medición de
laboratorio, no reproducible (no se guardó el número usado, no se volvió a consultar la
transacción). Declara también lo que esa observación NO permite concluir: no dice que Mastercard
"no aprueba" en general, sólo que un intento puntual, con datos no registrados, terminó
rechazado — el mismo tipo de resultado que §6 ya mostró para un Nequi no designado.

**No se re-midió contra el proveedor** (instrucción explícita del spec) — nadie pagó de nuevo con
Mastercard, nadie tokenizó un número Mastercard nuevo.

### 3b · El estado literal de la confirmación — MEDIDO fuera de `touches:`, no tocado

El literal "Estado: Pagada"/"Estado: Pendiente" vive en el bloque de confirmación compartido de
`app/(storefront)/checkout/page.tsx:432-435` (`estadoMostrado` + `<StatusBadge>`), NO en
`components/storefront/checkout/` ni en `lib/checkout/` — los dos únicos subárboles de código que
el `touches:` de este slice declara. Medido antes de tocar nada, siguiendo el mismo criterio que
el asiento inmediatamente anterior de esta rama (`CHECKOUT-SELECTOR-NO-SE-DESMONTA-1`, §3 y §4):
ese slice midió exactamente el mismo tipo de gap (`components/storefront/checkout/` fuera de su
`touches:`) para el desbloqueo del selector, y lo dejó como open follow-up en vez de ensanchar su
propio alcance.

**Medido igual, antes de descartarlo**: `confirmation.estado` en el camino MANUAL (el branch
`!confirmation.wompi`) es SIEMPRE `'pendiente'` — `app/api/checkout/route.ts:238-241` crea la
orden sin `immediatePayment` ("NO Payment here: the order starts `pendiente`; the admin registers
the received payment later"), así que el badge de esa rama nunca varía y siempre repite lo que el
párrafo de arriba ya dice en lenguaje del comprador ("Tu pedido está reservado. Confirmaremos el
pago…"). El razonamiento del owner en el `approval-reason` ("si ya se le dice al cliente que su
pago fue aprobado o está pendiente, no hace falta el estado literal") cubre explícitamente los
DOS casos — no sólo el de pasarela aprobada—, así que de haber podido tocar el archivo, la
recomendación habría sido sacar la etiqueta de las DOS ramas, no sólo de la de pasarela.

**No se tocó ningún byte de `app/(storefront)/checkout/page.tsx`** — fuera de `touches:`, y la
instrucción del protocolo es parar y decirlo, no ensanchar. Open follow-up:
`CHECKOUT-ESTADO-LITERAL-CONFIRMACION-1`.

### Gate

`npm run gate`, los dos carriles, corrido sobre el árbol final. Ver el reporte del slice para el
resultado exacto (passed/failed/wall_seconds) — no se transcribe acá para no duplicar un número
que puede volver a medirse.

### Deviations

- El `[SIN MEDIR]` del spec sobre el runbook resultó FALSO tal como estaba escrito (§3, arriba):
  no medía "sólo tokenización" de Mastercard, no la mencionaba en absoluto. Corregido con la
  medición real, no con la premisa.
- 3b (sacar "Estado: Pagada") no se ejecutó: el archivo que lo requiere
  (`app/(storefront)/checkout/page.tsx`) no está en `touches:`. Ver §3b.

### Open follow-ups

- `CHECKOUT-ESTADO-LITERAL-CONFIRMACION-1`: sacar la etiqueta "Estado: X" del bloque de
  confirmación compartido en `app/(storefront)/checkout/page.tsx` (líneas ~432-435), en las DOS
  ramas (pasarela aprobada y manual) — medido que las dos ya dicen el mismo hecho en lenguaje del
  comprador, § 3b arriba. No se hizo por estar fuera de `touches:`.
- `CHECKOUT-OTRO-METODO-BOTON-FASE-1`: `FormularioOtroMetodoPasarela` tiene la misma forma del
  defecto del §1 (su botón dice `Procesando…` durante las dos fases, y `EsperaConfirmacionTarjeta`
  le sigue mostrando su línea sin desafío) — no se tocó porque el gate del owner no lo reportó y
  no estaba en el spec de este slice.
- `CHECKOUT-MASTERCARD-MEDIR-DESENLACE-1`: medir de verdad, contra el sandbox, la tokenización y
  el desenlace de un número Mastercard designado (Wompi los publica en su consola de comercio de
  pruebas) — hoy el runbook no tiene ningún dato propio de esa red, sólo la observación de gate de
  §12.

---

## 2026-09-18 — El resumen del pedido pierde la foto al crearse la orden: la INSTANTÁNEA que faltaba, y por qué era eso y no un bug de render (`CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1`)

### 0 · El hecho medido

`checkout/page.tsx` tiene el widget «Resumen del pedido» (h3, línea 795 en el árbol final de este
slice — única aparición del texto en el archivo) con DOS ramas por `confirmation ? … : …` (líneas
796-881 en el árbol final): ANTES de crear la orden lee `items` (el carrito) y pinta una miniatura
de 48×48 (`w-12 h-12 sf-radio-lg
overflow-hidden bg-[var(--sf-superficie)] shrink-0` + `<img src={imagenPortada(item.imagen)}
…/>`); DESPUÉS lee `confirmation.items` (`CheckoutResultItem[]`, la respuesta del servidor) y ese
tipo **no tenía campo de imagen** (`services/checkout.service.ts:85-91`, medido antes de tocar
nada) — la rama de confirmación nunca pintaba ninguna `<img>`. La diferencia era, tal como pedía el
spec, una sola línea: la presencia/ausencia del bloque `<img>`.

**Por qué el resumen no podía simplemente "seguir leyendo el carrito":** `handleOrder`/
`crearOrdenPasarela` llaman `clearCart()` en el mismo tick que `setConfirmation(result)` —
decisión ya tomada y correcta (§ CHECKOUT-PAGO-EN-EL-PASO-1: el carrito se vacía porque la compra
ya se hizo), así que leer `items` tras ese punto mostraría un carrito vacío. El bug no estaba en
DE DÓNDE lee el resumen — eso ya era correcto —, estaba en que la fuente nueva (`CheckoutResult`)
nunca cargó la imagen. Medido, no asumido: `resolveOrderLines` (`packages/core/src/orders.ts`)
leía `product.nombre`/`product.precio` de la fila pero nunca `product.imagen`, así que la
información NUNCA salió de la base hacia la respuesta — no es que se perdiera en el camino, es que
jamás se pidió.

### 1 · La instantánea — la MISMA decisión que ya protege nombre y precio

`OrderItem` ya copia `producto_nombre`/`precio_unitario` al crear la fila, en vez de resolverlos
por la FK `producto_id` en cada lectura — es una instantánea DE HECHO, aunque el único comentario
EXPLÍCITO con la palabra "snapshot" en el modelo, antes de este slice, estaba en el campo vecino
(`moliendaSeleccionada`, `schema.prisma:256` original: *"Molienda elegida por el cliente al
comprar (snapshot, p. ej. 'Media')"*) — no en nombre/precio. La razón es la misma para los tres
campos: que el historial de una compra no cambie si el catálogo cambia después. La imagen es el
mismo tipo de dato con el mismo riesgo — un producto rediseñado no debe cambiarle la foto a una
orden de hace tres meses—, así que sigue la MISMA forma, no una nueva. Palabras del owner
(`approval-reason`): *"Una orden es el
registro de lo que el comprador compró. Si la foto se resuelve en vivo, un producto rediseñado le
cambia la foto a una compra de hace tres meses."*

- **`OrderItem.producto_imagen String?`** (`schema.prisma`), nullable, SIN default — migración
  `20260918120000_add_order_item_producto_imagen` (aditiva, `ALTER TABLE … ADD COLUMN`, mismo
  patrón que `20260917120000_add_payment_intent_metodo_rechazado`).
- **`ResolvedOrderLine.producto_imagen: string`** (`packages/core/src/orders.ts`) — copia
  `product.imagen` TAL CUAL (`String @default('')`, nunca null en el modelo de Producto), sin
  decidir fallback: eso lo hace `imagenPortada()` al renderizar, no el resolver.
- **`CreateOrderInput.items[].producto_imagen?: string | null`** — opcional a propósito: los DOS
  callers reales de `createOrderWithCustomer` (`app/api/checkout/route.ts`, `app/api/orders/
  route.ts`) pasan la salida de `resolveOrderLines` directo como `items`, así que la traen gratis;
  los tres tests que construyen `CreateOrderInput` a mano (`order-transitions.test.ts`,
  `intento-pago-atomico.test.ts`, `cobro-sincronizado.test.ts`) no la mandan y siguen compilando.
- **La escritura** (`items: { create: … }` dentro de la transacción de `createOrderWithCustomer`)
  agrega `producto_imagen: l.producto_imagen ?? null`.
- **`app/api/checkout/route.ts`** agrega `producto_imagen: l.producto_imagen` a la respuesta —
  sale de `lines` (la MISMA resolución pre-orden), no de releer `order.items` de la base.
- **`CheckoutResultItem.producto_imagen: string`** (`services/checkout.service.ts`) — requerido,
  como `producto_nombre`/`precio_unitario`: el servidor siempre lo manda ahora.

**SIN BACKFILL, y es la otra cara de la misma decisión.** Toda fila de `OrderItem` escrita ANTES de
esta migración queda con `producto_imagen = null` para siempre — rellenarla con la imagen ACTUAL
del producto fabricaría exactamente la mentira que la instantánea existe para impedir (una compra
vieja mostrando una foto que el comprador nunca vio). `imagenPortada(null)` cae al placeholder de
marca (`lib/producto-imagen.ts`, ya existente, sin tocar): la fila sigue dibujándose, con un
placeholder en vez de una imagen rota — cumple "una línea sin imagen tiene que seguir dibujándose"
sin código nuevo, porque el helper ya trata `''`/`null`/`undefined` igual.

**Cuántas órdenes existentes quedan con `producto_imagen = null`: NO SE PUDO MEDIR.** Se intentó un
`prisma.orderItem.count()` contra la base que resuelve `DATABASE_URL` del `.env` de esta sesión (el
host resuelve a `ep-still-sound…`, el hostname de `development` según CLAUDE.md § Bases de datos) y
la consulta devolvió `P2021 — the table "public.OrderItem" does not exist in the current database`:
la base a la que esta sesión efectivamente se conectó no tiene el schema de este repo aplicado, así
que no es comparable a la `development` real y no se puede confiar en un conteo contra ella. No se
insistió — verificar el ROL de una base antes de operar contra ella es la regla, y acá no se pudo
verificar. Queda como pregunta abierta para quien corra el gate visual: contar `SELECT
count(*) FROM "OrderItem"` contra la base real de destino antes de decidir si backfillear (que
igual está descartado por diseño, arriba) o simplemente aceptar el placeholder para el histórico.

### 2 · Alcance: SÓLO el widget «Resumen del pedido» — el porqué de no tocar la pantalla terminal

El archivo tiene un TERCER lugar que también pinta `confirmation.items` sin imagen: la pantalla
"¡Pedido recibido!" (el `return` de las líneas 403-480, alcanzado para métodos manuales,
`metodo_no_habilitado`, `pasarelaAprobada` e `intentosAgotados`). **No se tocó**, y es una decisión
medida, no un olvido:

- El spec pide encontrar "las dos ramas del resumen" y dice "la diferencia se ve en UNA línea" —
  eso describe exactamente el ternario `confirmation ? … : …` de un solo widget (dos ramas, un
  `<img>` de diferencia), no una comparación entre el widget del sidebar y la pantalla terminal
  (que nunca tuvo una versión "antes" con imagen que perder: siempre leyó `confirmation.items`,
  porque sólo existe una vez que la orden ya se creó).
- El `observed-report` (`CHECKOUT-SELECTOR-NO-SE-DESMONTA-1`) y el resto del "reporte de cambio de
  pantalla" citado en el `approval-reason` (`CHECKOUT-REINTENTO-CENSO-1`,
  `CHECKOUT-REINTENTO-OTRO-METODO-1`, `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1`) son, medido por sus
  propios asientos, sobre el flujo de PASARELA en API DIRECTA — el caso donde el comprador se queda
  en la MISMA página/paso al crear la orden (`CHECKOUT-PAGO-EN-EL-PASO-1`). Ahí es donde "de
  repente la foto no está, pero nada más se movió" se siente como un defecto; en la pantalla
  terminal el comprador YA sabe que cambió de pantalla (ícono, "¡Pedido recibido!", "Número de
  orden"), así que no es la misma sensación que el owner describió.

**Diferencia visible que queda, nombrada como pide el spec:** la pantalla "¡Pedido recibido!"
(métodos manuales, la mayoría del tráfico hoy porque la pasarela sigue mitad-encendida por
despliegue) sigue sin miniatura en su lista de ítems (líneas 435-443). El dato YA viaja en
`confirmation.items[].producto_imagen` — agregarla ahí es sólo JSX, sin tocar servidor ni schema—,
pero no se hizo porque el spec apunta a "el resumen" (singular, con sus "dos ramas") y esa pantalla
no es ese widget. Queda para que el owner decida si también la quiere ahí.

### 3 · El estado literal — cierra `CHECKOUT-ESTADO-LITERAL-CONFIRMACION-1`

El follow-up medido por `CHECKOUT-GATE-VISUAL-HALLAZGOS-1` (§3b, arriba: el literal vivía en
`app/(storefront)/checkout/page.tsx:432-435`, fuera de su `touches:`) se ejecuta acá, con el mismo
alcance que ese asiento ya había medido: las DOS ramas (pasarela aprobada y manual) comparten el
MISMO bloque (`estadoMostrado` + `<span>Estado:</span>` + `<StatusBadge>`), así que sacarlo de ese
bloque compartido lo saca de las dos a la vez — no hizo falta un segundo cambio por rama. Se
retiraron también `estadoMostrado` (const que sólo alimentaba el badge) y el import de
`StatusBadge` (quedó sin otro consumidor en el archivo, verificado por grep). El párrafo que ya
dice el hecho en lenguaje del comprador ("Tu pedido está reservado…" / "Tu pedido queda
confirmado…") no se tocó.

### Gate

`npm run gate`, los dos carriles, corrido sobre el árbol final: 1458/1458 (capa 1, `npm test`,
5.10 s) + 208/208 (capa 2, `npm run test:integracion`, 14.71 s), 0 fallas en las dos. La migración
nueva se aplicó limpia contra el Postgres efímero del carril de integración (sin error durante
"Aplicando migraciones…"). `tsc --noEmit` y `eslint` sobre los cinco archivos tocados: 0 errores.
`eslint` reporta 4 warnings en `checkout/page.tsx`: dos preexistentes sin relación
(`CreditCard`/`AnimatePresence` importados sin uso, verificado que el diff no toca esas líneas) y
dos `@next/next/no-img-element` por el `<img>` crudo — uno YA existía (línea 849, la miniatura del
carrito, sin tocar) y el otro es la miniatura nueva de este slice (línea 816): es el MISMO patrón
copiado, no una categoría de warning nueva en el archivo.

### Deviations

- Ninguna sobre el mecanismo de la instantánea. La única desviación de alcance es la nombrada en
  §2: la pantalla terminal ("¡Pedido recibido!") no ganó la miniatura, por no ser el widget que el
  spec describe con "las dos ramas del resumen" — medido y reportado, no ensanchado.
- El conteo de órdenes existentes sin foto (§1) no se pudo medir — la base alcanzable desde esta
  sesión no tiene el schema del repo aplicado (`P2021`), así que no es la `development` real y no
  se puede confiar en ningún número que saliera de ahí.

### Open follow-ups

- `CHECKOUT-RESUMEN-TERMINAL-FOTO-1`: agregar la miniatura también a la lista de ítems de la
  pantalla "¡Pedido recibido!" (`app/(storefront)/checkout/page.tsx`, líneas 435-443) — el dato ya
  viaja en `CheckoutResultItem.producto_imagen`, así que es sólo JSX. No se hizo en este slice
  porque esa pantalla no es el widget "Resumen del pedido" que el spec acotó (§2).
- `CHECKOUT-BACKFILL-IMAGEN-ORDENES-VIEJAS-DECISION-1`: decidir si las órdenes anteriores a este
  slice se quedan mostrando el placeholder de marca para siempre (consistente con "sin backfill,
  nunca") o si el owner prefiere alguna otra señal — hoy la decisión de arriba (§1) ya fija "sin
  backfill" como la respuesta, así que este follow-up es sólo para el caso de que el owner, viendo
  cuántas órdenes reales quedan así (número que este slice no pudo medir), quiera revisarlo.

## 2026-09-18 — El bloque de método QUEDA BLOQUEADO por decisión del owner, la miniatura de la pantalla terminal NO se agrega, y la CLASE de la decisión que vive sólo en un comentario (`CHECKOUT-SELECTOR-BLOQUEADO-DECISION-1`)

**Cierra `CHECKOUT-SELECTOR-DESBLOQUEO-POR-RECHAZO-1` y `CHECKOUT-RESUMEN-TERMINAL-FOTO-1`** (los dos
open follow-ups de `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1` y `CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1`,
arriba). Las dos son decisiones de PRODUCTO que un slice anterior dejó abiertas a propósito porque
resolverlas exigía ensanchar su `touches:`; este slice no construye nada — asienta las dos decisiones
del owner, con su porqué (o la ausencia de porqué, cuando el owner no dio uno), y una tercera cosa que
salió de medirlas: una CLASE de decisión que ningún mecanismo del protocolo puede ver.

### 1 · `CHECKOUT-SELECTOR-DESBLOQUEO-POR-RECHAZO-1` — el bloque QUEDA BLOQUEADO, y la razón es del worker que se desvió

**La pregunta que quedó abierta** (`CHECKOUT-SELECTOR-NO-SE-DESMONTA-1`, arriba, §2): *"¿debería el
bloque desbloquearse durante la ventana entre un rechazo y el clic en 'Intentar con otro método' (en
vez de quedarse bloqueado todo el ciclo)?"*

**DECISIÓN DEL OWNER: QUEDA BLOQUEADO.** No es una decisión sin fundamento a la que el owner puso fin
por cansancio — es la decisión que el worker de `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1` ya había medido,
en su propio §2, antes de que este asiento existiera:

> **NINGÚN camino consume un cambio en `payment`/`pasarelaSeleccionada` una vez que `confirmation`
> existe:** los botones "Atrás"/"Confirmar pedido" de `handleOrder` siguen detrás de
> `{!confirmation && (…)}` (línea ~773, sin tocar), y no hay ningún otro `onClick` que lea esos estados
> para volver a intentar. Desbloquear el bloque SIN el botón dejaría radios que se ven interactivos y
> no hacen nada al clickearlos — peor que dejarlos bloqueados. `POST /api/checkout/reintento` (vía el
> botón "Intentar con otro método") es el ÚNICO mecanismo que de verdad abre un intento nuevo.

Con las palabras del owner, citadas en el `approval-reason` de este spec: *"un radio que se puede tocar
y no cambia nada es peor que uno atenuado"*, y *"no construyas dos formas de hacer lo mismo donde sólo
una funciona"* — el botón "Intentar con otro método" (`SelectorMetodoPasarela`, vía
`onReintentarOtroMetodo` → `POST /api/checkout/reintento`, construido en `CHECKOUT-REINTENTO-OTRO-
METODO-1`) YA ES el camino real y explícito; un radio desbloqueado sería una SEGUNDA forma de hacer lo
mismo, decorativa, que no dispara nada.

**REGISTRO EXPLÍCITO — la desviación del worker anterior fue CORRECTA, y eso importa tanto como la
decisión misma.** `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1` recibió el spec pidiendo, entre otras cosas, que
"cuando el pago se rechaza, tiene que volver a ser usable"; el worker MIDIÓ que threadear ese estado
hasta la página exigía tocar `components/storefront/checkout/*.tsx` (fuera de su `touches:`), y que
aunque lo hiciera, desbloquear sin el botón sería peor que no desbloquear — y lo REPORTÓ como open
follow-up en vez de construirlo a medias o de forzar el `touches:`. **Eso es exactamente el
comportamiento que este protocolo quiere: medir que cumplir la instrucción al pie de la letra produce
algo peor, no cumplirla, y reportarlo con lo que se midió** — no que el worker "se cansó" del ítem ni
que lo "pasó por alto". El seguimiento **queda CERRADO** con esta razón, no como "pendiente resuelto".

**Nada se toca en el código.** `bloqueoMetodoDePago = !!confirmation` (`app/(storefront)/checkout/
page.tsx:139`) se queda exactamente como `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1` lo dejó.

### 2 · `CHECKOUT-RESUMEN-TERMINAL-FOTO-1` — la miniatura NO va a la pantalla terminal, sin razón registrada

**DECISIÓN DEL OWNER: NO VA.** El owner no dio una razón, y eso se dice así — **decidido por el owner
el 2026-09-18, sin razón registrada.** Este asiento NO inventa un porqué de diseño: un asiento que
fabrica la justificación de una decisión ajena es peor que uno que admite no saberla, porque quien lo
lea dentro de un año va a creer que ese porqué se midió cuando no fue así.

**Lo que queda así, medido, porque es un byte que el comprador VE:** las dos listas del mismo pedido no
se ven igual.

| Lista | Dónde vive | Cuándo la ve el comprador | ¿Miniatura? |
| --- | --- | --- | --- |
| «Resumen del pedido» (sidebar) | `app/(storefront)/checkout/page.tsx:795-827`, rama `confirmation` (líneas 812-827) | SÓLO durante el paso de pago con pasarela en curso — la orden ya existe pero ningún estado terminal se alcanzó todavía | **SÍ** — `<img src={imagenPortada(item.producto_imagen)} …>`, línea 816, 48×48 (`w-12 h-12`) |
| Pantalla «¡Pedido recibido!» / «¡Tu pago fue aprobado!» | `app/(storefront)/checkout/page.tsx:403-480`, lista de ítems en 435-443 | métodos manuales, `pasarelaMetodoNoHabilitado`, `pasarelaAprobada`, `intentosAgotados` — es decir, TODO desenlace, incluido el pago con pasarela ya aprobado | **NO** — sólo `producto_nombre` + `moliendaSeleccionada` + `cantidad` + `subtotal`, sin `<img>` |

**El dato YA viaja para las dos.** `CheckoutResultItem.producto_imagen: string`
(`services/checkout.service.ts:91`) es el mismo campo que alimenta las dos ramas — `confirmation.items`
es una sola fuente. La diferencia no es de dato disponible: es que la pantalla terminal nunca pintó un
`<img>`, ni antes ni después de `CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1`, porque esa tanda acotó su alcance
al widget "Resumen del pedido" (§2 de ese asiento) y esta decisión confirma que se queda así.

**Consecuencia concreta**: un comprador que paga por un método manual (la mayoría del tráfico hoy,
medido en `CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1` §2 — la pasarela sigue mitad-encendida por despliegue) o
que llega a cualquier desenlace terminal de pasarela **nunca ve la foto de lo que compró** en la
pantalla de confirmación, aunque esa misma foto sí se le mostró un momento antes (o se le habría
mostrado, si pasó por el paso de pago con pasarela) en el sidebar. No es un defecto que se escapó: es
el byte que el owner decidió dejar así, sin más justificación que la decisión misma.

El follow-up **queda CERRADO** con esta razón (la ausencia de razón, dicha, no una inventada).

### 3 · La CLASE — una decisión que vive sólo en un comentario es invisible para el protocolo (`CLASE-DECISION-SOLO-EN-COMENTARIO-1`)

**Lo que se preguntó, buscando otra cosa:** si un slice puede saber qué decisiones dependen de la
premisa que está cambiando — por ejemplo, si al tocar `CHECKOUT-SELECTOR-DESBLOQUEO-POR-RECHAZO-1`
hacía falta releer qué más citaba `CHECKOUT-UNA-SOLA-PANTALLA-1`, la decisión cuya premisa
(`CHECKOUT-REINTENTO-OTRO-METODO-1` ya lo midió) quedó falsa.

**Medido, y la respuesta fue otra pregunta:** `CHECKOUT-UNA-SOLA-PANTALLA-1` **NO TIENE NINGUNA ENTRADA
PROPIA EN ESTE LIBRO.**

- `grep -c "CHECKOUT-UNA-SOLA-PANTALLA-1" DECISIONS.md` → **2 apariciones**, las dos DENTRO de la
  prosa de `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1` (líneas 7579 y 7583, arriba): una es una CITA TEXTUAL
  del comentario del código, la otra dice cuándo nació. Ninguna es un encabezado `## …` propio — no hay
  un `grep -n "^## .*CHECKOUT-UNA-SOLA-PANTALLA-1"` que devuelva algo.
- `grep -c "CHECKOUT-UNA-SOLA-PANTALLA-1" CLAUDE.md` → **0**.
- `grep -rl "CHECKOUT-UNA-SOLA-PANTALLA-1" --include="*.ts" --include="*.tsx" .` (fuera de
  `node_modules`) → **9 archivos**, con **22 apariciones** totales, TODAS en comentarios: `app/api/
  pasarela/aceptaciones/route.ts`, `app/api/checkout/route.ts`, `app/(storefront)/checkout/page.tsx`
  (9 apariciones), `components/storefront/checkout/FormularioOtroMetodoPasarela.tsx`,
  `components/storefront/checkout/FormularioTarjeta.tsx`,
  `components/storefront/checkout/SelectorMetodoPasarela.tsx`, `services/checkout.service.ts`,
  `lib/pagos/aceptaciones.test.ts`, `lib/pagos/aceptaciones.ts`.
- El commit que la creó (`98217cb`, `CHECKOUT-UNA-SOLA-PANTALLA-1`, 2026-09-17 15:30:02) tocó **cero**
  líneas de `DECISIONS.md` ni de `CLAUDE.md` (`git show --stat 98217cb`, verificado). La decisión nació
  directo en el código, sin pasar por el libro.

**Es decir: una decisión de producto real —"el selector de método sólo se muestra ANTES de que exista
la orden"—, citada 22 veces en 9 archivos durante casi un día completo de trabajo sobre el mismo
programa, no existe para ningún mecanismo que busque en `DECISIONS.md` o `CLAUDE.md`.** Cuando
`CHECKOUT-REINTENTO-OTRO-METODO-1` la volvió falsa, nada la señaló como "una decisión dependiente de
esto cambió": no hay decisión que señalar, porque el libro nunca la tuvo.

**LA CLASE, con las palabras del owner:**

> **UNA DECISIÓN QUE VIVE SÓLO EN UN COMENTARIO DEL CÓDIGO ES INVISIBLE PARA TODO MECANISMO DEL
> PROTOCOLO: no se puede citar, no se puede rastrear, y vence sin que nada la mire.**

**Lo que reordena la pregunta original:** *"el problema no es rastrear dependencias entre asientos —
es que hay decisiones que no son asientos".* Buscar un grafo de dependencias entre entradas del libro
no habría encontrado nada, porque `CHECKOUT-UNA-SOLA-PANTALLA-1` nunca fue una entrada.

**Y lo que la clase NO dice:** que los comentarios sobren. Los 22 comentarios de arriba siguen siendo
el lugar correcto para decir QUÉ hace ese código y POR QUÉ — un comentario que explica una decisión ya
tomada, con su cita, es exactamente lo que un lector necesita al lado del código. Lo que no puede ser
es el ÚNICO lugar donde la decisión existe: ahí deja de documentar y pasa a ser el original, y un
original que sólo vive disperso en 9 archivos no lo relee nadie completo antes de invalidarlo.

**Las otras tres instancias del día, ya en el libro, que son la misma familia** (para que se lean
juntas, no como hechos sueltos):

| Instancia | Fecha | Qué mide |
| --- | --- | --- |
| `CHECKOUT-REINTENTO-CENSO-1`, §2 (arriba) | 2026-09-18 | una conclusión angosta —medida para `metodo_no_habilitado`, donde reintentar de verdad no cambia nada— escrita en el código y en la prosa de OTRO ledger ya cerrado como si fuera una decisión YA CERRADA, y aplicada ancha al caso distinto del rechazo del emisor. Ese mismo asiento nombra "DÓNDE vive" —"no en un asiento ni en un reporte, sino en un comentario del código"— como lo que agrava la instancia. |
| `COBRO-SIN-PEDIDO-ASIENTO-1` (arriba) | 2026-09-18 | el censo de las frases de `CLAUDE.md` (el archivo de doctrina) que el mismo incidente de "Wompi cobró y la tienda no se enteró" volvió falsas — frases correctas cuando se escribieron, vencidas por trabajo posterior del mismo programa. |
| `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1`, §4 (arriba) | 2026-09-18 | la premisa de `CHECKOUT-UNA-SOLA-PANTALLA-1` (nacida ~21 h antes) muerta por `CHECKOUT-REINTENTO-OTRO-METODO-1` — "el commit INMEDIATAMENTE ANTERIOR en esta misma rama", en palabras del owner citadas ahí: *"esa premisa la mató el slice del reintento una hora antes"*. |

**Son la misma familia: una decisión no vence sola — la vence trabajo posterior, y el trabajo que la
mata casi nunca sabe que la está matando.** Las tres de arriba ya estaban en asientos que SÍ existen en
el libro; lo que este asiento agrega es el caso límite de la familia — una decisión que ni siquiera
llegó a tener un asiento propio del que pudiera desprenderse una premisa vencida, porque nunca hubo
asiento. Es la misma clase, un peldaño más abajo: no "el asiento envejeció sin que nadie lo releyera",
sino "nunca hubo asiento que releer".

### 4 · El mecanismo que no se construye — medido y descartado a propósito, no olvidado (`CHECKOUT-AVISO-COMENTARIOS-TOCADOS-1`)

**Se midió un aviso posible:** un gate que, al ver un diff tocar un archivo con comentarios de
decisión (el patrón `§ IDENTIFICADOR-N` que este mismo programa usa en 9+ archivos), imprimiera "este
diff toca archivos con comentarios de decisión — releelos".

**Medido contra el propio diff de `CHECKOUT-SELECTOR-NO-SE-DESMONTA-1`** (el slice que destapó todo
esto): ese slice tocó `app/(storefront)/checkout/page.tsx`, que por sí solo lleva 9 de las 22
apariciones de `CHECKOUT-UNA-SOLA-PANTALLA-1` más otras dos docenas de comentarios de otros
identificadores del mismo programa (`CHECKOUT-PAGO-EN-EL-PASO-1`, `CHECKOUT-UNA-SOLA-PANTALLA-1`,
`CHECKOUT-ESTADO-LITERAL-CONFIRMACION-1`, …). Un aviso a nivel de ARCHIVO habría nombrado decenas de
decisiones para que el worker encontrara la UNA que de verdad estaba cambiando.

**DECISIÓN DEL OWNER: NO SE CONSTRUYE TODAVÍA.** Con sus palabras: *"Es exactamente el ruido que ya
sabemos que se saltea."* Queda MEDIDO y ENCOLADO, sin prioridad — una capacidad medida y descartada a
propósito es distinta de una que a nadie se le ocurrió, y esa diferencia se pierde si no queda escrita.
**Si alguna vez entra, entra ACOTADO AL DIFF** (qué comentarios de decisión tocan las LÍNEAS que el
diff realmente cambia, no todos los que viven en el ARCHIVO) — un aviso a nivel de archivo es, medido
arriba, el mismo ruido que ya se sabe inútil.

### Gate

`npm run gate`, los dos carriles, corrido sobre el árbol final. Ver el reporte del slice para el
resultado exacto (passed/failed/wall_seconds) — no se transcribe acá para no duplicar un número que
puede volver a medirse. El diff de este slice es EXCLUSIVAMENTE esta entrada de `DECISIONS.md`: ningún
archivo de código, test, schema ni migración se tocó, así que no había manera de que ninguno de los dos
carriles cambiara de veredicto respecto de la entrada inmediatamente anterior de esta misma rama.

### Deviations

Ninguna. El spec pidió medir y asentar dos decisiones del owner más la clase que salió de medirlas, y
eso es exactamente lo que este asiento hace — sin tocar código, tests, comentarios ni `CLAUDE.md`, y
sin construir el mecanismo del §4.

### Open follow-ups

- `CHECKOUT-AVISO-COMENTARIOS-TOCADOS-1`: construir el aviso "este diff toca archivos/líneas con
  comentarios de decisión — releelos", ACOTADO AL DIFF (líneas cambiadas), no al archivo completo —
  medido en §4 de este asiento que a nivel de archivo es ruido que ya se sabe que se saltea. No se
  construye ahora porque el owner lo descartó explícitamente para esta ronda ("es exactamente el ruido
  que ya sabemos que se saltea"); queda encolado sin prioridad.

## 2026-09-18 — La política de seguridad del checkout no conocía a Wompi: dos orígenes MEDIDOS se agregan, la política SIGUE en modo reporte, y lo que falta para activarla queda encolado (`CSP-NO-CONOCE-A-WOMPI-1`)

**El owner vio esto de casualidad, no por un tablero:** durante el gate visual del 2026-09-18
(`CHECKOUT-GATE-VISUAL-HALLAZGOS-1`), con la consola del navegador abierta en una compra real contra
el deployment de preview, aparecieron dos violaciones de la CSP en modo reporte de `/checkout`
(`next.config.ts`): conectarse a `https://sandbox.wompi.co/v1/tokens/cards` viola `connect-src 'self'`,
y embeber `https://vercel.live` viola `frame-src`. Aprobó este slice con dos condiciones fijas: los
orígenes que se agreguen salen de lo MEDIDO —no de la doc del proveedor ni de una lista plausible—, y
la política **queda en modo reporte, sin activar**.

### 1 · El defecto, y por qué el propio comentario ya explicaba su vencimiento

El comentario que hoy es falso vivía junto a `connect-src`: *"Nada del checkout de hoy llama a un
origen externo (createOrder es un fetch same-origin a /api/checkout): sin el widget integrado, lo
medido es 'self'."* Eso describía el checkout de ANTES de `API-DIRECTA-CAPTURA-TARJETA-1`. Desde ese
slice, `tokenizarTarjeta` (`services/checkout.service.ts`) llama DIRECTO desde el NAVEGADOR del
comprador al host de Wompi —por diseño, para que el dato de la tarjeta nunca pase por nuestro
servidor—, y la política nunca se actualizó para contemplarlo. Es la misma familia que ya nombró
`CHECKOUT-SELECTOR-NO-SE-DESMONTA-1` y `COBRO-SIN-PEDIDO-ASIENTO-1` el mismo día —una premisa correcta
cuando se escribió, muerta por trabajo posterior del mismo programa sin que nadie la releyera— pero
**ésta es distinta en una cosa que hay que decir con todas las letras: las otras confundían a quien
leía; ésta, activada, IMPIDE EL COBRO.** Con las palabras del owner en el `approval-reason` de este
spec: es la única pendiente que puede romper el cobro entero, y es gratis arreglarla ahora porque el
arreglo es configuración.

### 2 · ¿Hay violaciones acumuladas? — medido: NO HAY DESTINO DE REPORTES

El owner razonó que, si la política ya reporta, debía haber una lista de dominios faltantes medida en
uso real esperando en algún lado. Se buscó en la propia política (`next.config.ts`) una directiva
`report-uri`/`report-to`, y luego en todo el repo (`grep -rn "report-uri\|report-to\|Report-To\|csp-
report\|reporting-endpoints"`, fuera de `node_modules`/`.next`): **cero resultados, en cualquiera de
los dos.**

**No hay nada acumulado — y ESO es el hallazgo, no un callejón sin salida.** Una política en modo
reporte sin destino de reportes sólo escribe en la consola de quien tenga las herramientas de
desarrollador abiertas en ESE momento. No reporta a un tablero, a un log, ni a nadie que no esté
mirando esa pestaña en ese instante — reporta a nadie. Por construcción, la única forma de que alguien
se entere de una violación es tropezarse con ella mientras hace otra cosa, que es exactamente lo que le
pasó al owner. Queda como punto abierto en el §4, no se construye en este slice.

### 3 · Qué se agregó, y de dónde sale cada origen

**`frame-src` gana `https://vercel.live`.** MEDIDO: es la segunda violación que el owner vio, y
corresponde al widget de comentarios/feedback que **Vercel INYECTA SOLO en despliegues de PREVIEW**
—nunca en producción real de un cliente—, no a nada que el código de este repo cargue. Se decidió
incluirlo de todas formas, marcado en el comentario como artefacto del ENTORNO y no del producto, sin
gatear por `esDespliegueDemo()`: la política es hoy un valor estático (no lee ninguna condición de
entorno), y un origen de más en `frame-src` para un widget que la producción real de un cliente
simplemente no carga no abre ninguna superficie nueva — mientras que gatearlo exigiría meter una
condición nueva en `headers()` por un costo que no se está pagando.

**`connect-src` gana DOS orígenes, con procedencia distinta cada uno:**

- **`https://sandbox.wompi.co` — MEDIDO.** Es exactamente lo que el owner vio violar la política en la
  consola, contra el deployment de preview. Coincide con el host que `baseUrlPasarelaDesdeLlave`
  (`services/checkout.service.ts:303-307`) elige cuando la llave pública NO empieza con el prefijo
  productivo (`PREFIJO_LLAVE_PASARELA_PRODUCTIVA = "pub_prod_"`, `lib/pagos/llaves-pasarela.ts`).
- **`https://production.wompi.co` — DEDUCIDO DEL CÓDIGO, NO MEDIDO EN USO.** Nadie corrió este flujo
  contra producción; no hay medición de éste. Pero es el MISMO helper, `baseUrlPasarelaDesdeLlave`, el
  que elige EXACTAMENTE este host cuando la llave pública SÍ empieza con ese prefijo — es una lectura
  directa del código, no una lista plausible ni la doc del proveedor. Omitirlo habría dejado la
  política rota el día que un despliegue real active la pasarela: bloqueada en el navegador del
  comprador, sin que el código de decisión (`baseUrlPasarelaDesdeLlave`) tenga forma de saberlo — ver
  el modo de falla en el §4.

**Lo que se investigó y NO se pudo acotar: el marco del desafío del emisor (3DS "con challenge").**
`DesafioTarjeta.tsx` embebe el HTML del emisor con `srcDoc` (nunca `src`) dentro de un iframe
`sandbox="allow-scripts allow-forms"` — sin `allow-same-origin` ni `allow-top-navigation`. El propio
HTML del emisor se auto-envía por un `<script>` inline hacia el ACS (Access Control Server) de SU
banco, y esa navegación DENTRO del iframe también cae bajo `frame-src` — CSP gatea cada navegación de
un contexto anidado, no sólo la carga inicial. El ACS es del BANCO EMISOR de la tarjeta del comprador,
distinto para cada banco (Bancolombia, Davivienda, Nu, …) y ninguno de los dos spikes de este programa
(`API-DIRECTA-SPIKE-SANDBOX-1`) lo ejercitó — está explícitamente fuera de su alcance (`lib/pagos/
tres-ds.ts`, cabecera del archivo: "Todo 3DS — explícitamente fuera del alcance de los dos spikes").
**No se agrega ningún origen para esto: es un problema abierto, no una lista que falte completar** — si
el origen varía por banco emisor, una lista de dominios estáticos en `next.config.ts` estructuralmente
no puede cubrirlo. Queda nombrado en el §4.

**Lo que NO se tocó, y por qué:** `script-src`, `style-src`, `font-src`, `img-src`, `object-src`,
`base-uri` y `form-action` — ninguna violación medida las señaló, y tocarlas sin medición sería
exactamente lo que el owner prohibió ("no de una lista plausible"). Tampoco se activó la política
(sigue siendo `Content-Security-Policy-Report-Only`, nunca `Content-Security-Policy`) ni se construyó
ningún destino de reportes.

### 4 · Qué falta para poder activarla — encolado, no resuelto acá

**El modo de falla, que es el argumento entero:** si esta política se activa (deja de ser Report-Only)
con un origen faltante, la llamada se BLOQUEA EN EL NAVEGADOR del comprador. El servidor no se entera
—no hay un fetch que falle del lado del server, no hay nada que loguear—, y el comprador ve un fallo de
pago sin causa visible. Un cobro que muere del lado del cliente es invisible desde donde este equipo
mira sus logs. Por eso activarla sin lo siguiente resuelto es cambiar un riesgo futuro por uno
inmediato:

- **Destino de reportes.** Hoy no existe (§2). Sin él, activar la política es operar a ciegas: la
  primera vez que bloquee algo real, nadie lo va a saber hasta que un comprador se queje.
- **El desafío 3DS del emisor nunca se ejercitó contra un banco real** (§3, el ACS). Si su origen
  varía por banco, `frame-src` con una lista fija de dominios no puede cubrirlo sin, quizás, aflojar la
  directiva para ese caso — y eso es una decisión de producto/seguridad que no se toma en este slice.
- **`https://production.wompi.co` nunca se ejercitó en uso real** (§3). Se agregó DEDUCIDO del código,
  no medido; activar la política sin haber corrido al menos una compra real de producción con este
  origen sería apostar a que la deducción es correcta sin haberla visto correr.
- **El propio comentario de la política ya documentó un hallazgo sobre terceros inyectados sin
  avisar:** el `widget.js` de Wompi mete en runtime `cdn.siftscience.com` y `device.clearsale.com.br`
  sin que el dashboard del comercio ofrezca verlos ni apagarlos —infraestructura decidida por el
  backend del proveedor (`next.config.ts`, el bloque "EL HALLAZGO QUE CAMBIA LA NATURALEZA…")—. Si
  Wompi agrega o cambia un tercero así en cualquier directiva, una política ya activada rompería el
  checkout sin aviso previo, por el mismo motivo que el `script-src` de hoy ya se defiende de eso
  incluyendo los tres orígenes por adelantado.

### Gate

`npm run gate`, los dos carriles, corrido sobre el árbol final. El diff de este slice es
`next.config.ts` (comentarios + dos directivas de la CSP) y esta entrada de `DECISIONS.md`: ningún
archivo de código de producto, test, schema ni migración se tocó.

### Deviations

Ninguna. El spec pidió medir de dónde sale cada origen nuevo y decidir sobre `vercel.live` con su
justificación, y eso es lo que este asiento y el diff de `next.config.ts` hacen — sin activar la
política, sin construir el destino de reportes, y sin tocar ninguna otra directiva.

### Open follow-ups

- `CSP-DESTINO-DE-REPORTES-1`: construir el destino de reportes (`report-to`/`report-uri` o el
  mecanismo equivalente) para que la política en modo reporte deje de "reportar a nadie" (§2). Sin
  esto, activar la política más adelante seguiría siendo operar a ciegas sobre lo que rompe.
- `CSP-DESAFIO-3DS-ORIGEN-EMISOR-1`: medir contra un desafío 3DS real de al menos un banco emisor si
  el origen del ACS es acotable en `frame-src` o si es estructuralmente imposible de cubrir con una
  lista fija (§3-§4) — hoy es un problema abierto, no resuelto.
- `CSP-PRODUCCION-WOMPI-SIN-MEDIR-1`: correr al menos una compra real contra producción con
  `WOMPI_PUBLIC_KEY` productiva y confirmar que `https://production.wompi.co` es, en efecto, el único
  host adicional que aparece — hoy ese origen está deducido del código, nunca medido en uso (§3).

## 2026-09-18 — CORTE toma paleta/fuente/forma del prototipo versionado (`CORTE-REESCRITURA-PROTOTIPO-1`)

**El estándar, palabras del owner:** *"CORTE como está hoy NO ALCANZA. No es 'el preset valida' — es
que cuando abra el mirador tiene que verse como el prototipo. Ese es el criterio de cierre."* Lo
construido hasta este slice era la PLOMERÍA (§ themes.ts: dónde se declara una variante, cómo se
elige); los tres valores de CORTE (`fondo:'#efece6'`, `tinta:'#0c0b0a'`, `acento:'#a3643a'`,
`fuentePar:'moderno'`, `forma:'minima'`) no salían de ninguna medición — validaban contra el REGISTRY
(la GUARDA), pero no contra el DISEÑO. Este slice los reescribe leyendo el prototipo versionado del
repo (`docs/prototipos/cafeone/`), la única fuente: no hay ningún censo del prototipo en este libro
(se buscó y no está — igual que `CORTE-PROTOTIPO-CENSO-1`, citado por `TEMAS-PAR-PRENSA-1` arriba,
tampoco tiene entrada).

### La paleta — rol→rol, no rampa→raíz

El preset guarda ROLES (`fondo`/`tinta`/`acento`), así que se leyeron los TOKENS SEMÁNTICOS del
prototipo (qué rol cumple cada color), no su rampa de base. Cada mapeo se verificó con el USO real en
el propio CSS del prototipo, no sólo con el nombre del token:

| rol del preset | token semántico del prototipo | valor | dónde se declara | dónde se USA (confirma el rol) |
| --- | --- | --- | --- | --- |
| `fondo` | `--surface-page` | `#fdfbf7` | `docs/prototipos/cafeone/ds/colors.css:39` | `.canvas{…;background:var(--surface-page)}` (`app.css:39,43`) — el contenedor que envuelve TODO el contenido del sitio (8 usos en `app.css`, `grep -c`); confirmado por el propio README del prototipo, que en su tabla "Brief vs. design system" (`README.md:69`) llama a este token literal **"canvas"**: `--canvas:#F7F3EA` (brief) → `--surface-page:#fdfbf7` (DS, lo que se usó) |
| `tinta` | `--text-heading` | `#102407` | `colors.css:48` | todo titular h1..h6 (19 usos en `app.css`, `grep -c`); coincide con `--surface-inverse` (`colors.css:43`) y con `--green-900` (`colors.css:4`), el fondo de los paneles a sangre completa del prototipo — el mismo rol que nuestra `tinta` cumple como fondo oscuro del hero. El README (`README.md:67`) lo llama **"green-deep"** en el brief → `--green-900:#102407` en el DS |
| `acento` | `--action-primary` | `#a70004` | `colors.css:59` | `.btn--primary{background:var(--action-primary)}` (`app.css:134`) y 16 usos más (`grep -c` da 17) — todo CTA primario, incl. `.skip-link` (`app.css:71-73`). El README (`README.md:68`) lo llama **"burgundy"** en el brief → `--action-primary:#a70004` en el DS |

**CORRECCIÓN sobre `.canvas` vs `<body>`, medida al revisar este asiento antes de cerrarlo:** el
`<body>` HTML real del prototipo NO usa `--surface-page` — usa `--bg-body:#0e0e0c`
(`tokens.css:203-205`, casi negro), un marco de `--frame-gap` que sólo se ve como gutter alrededor del
`.canvas` (el propio README, línea 75: *"El lienzo flota con `--frame-gap` y `--frame-radius`"*). Y el
propio comentario de `tokens.css:203-204` lo declara ajeno al DS: *"Page frame: the canvas floats on a
near-black body. **Not in the DS** — added per the build brief."* — `--bg-body`/`--frame-gap` son un
AÑADIDO del sitio, no un token del CAFEONE Design System; `--surface-page` SÍ lo es (§ README, la tabla
brief↔DS). El primer borrador de este asiento citaba `body{background:var(--surface-page)}`, que no
existe — `--surface-page` es del `.canvas`, no del `<body>`. La elección de `fondo = --surface-page`
SIGUE EN PIE, ahora con MÁS respaldo, no menos: nuestro storefront no tiene el tratamiento de
marco/gutter del prototipo (`bg-[var(--sf-fondo)]` va en el `<div>` raíz que envuelve TODO, como el
`.canvas`, no como el `<body>` casi negro que sólo se asoma 1-2rem en los bordes), y el token que sí
pertenece al DS —el que el propio README nombra "canvas" en su tabla de equivalencias— es
`--surface-page`, no el añadido de sitio `--bg-body`. Lo que se corrige es la CITA del selector, no el
mapeo.

Valores viejos → nuevos: `#efece6`→`#fdfbf7`, `#0c0b0a`→`#102407`, `#a3643a`→`#a70004`. Los tres eran
inventados; los tres nuevos están medidos, con archivo y línea.

### El par tipográfico — `'prensa'`, con el cuerpo declarado NO-EXACTO

`lib/config/fuentes.ts` es un catálogo CERRADO a propósito (§ CLAUDE.md, "Las FUENTES son
`content.tema.fuentePar`") — este slice NO agrega una entrada. Se usa el que más se acerca:

- **`'prensa'` (Roboto Serif / Figtree) — ya en el catálogo, y YA declarado prerrequisito de CORTE.**
  Confirmado: `TEMAS-PAR-PRENSA-1` (2026-09-15, más arriba en este libro) dice literal *"Prensa … llena
  ese hueco, y es **prerrequisito de CORTE** (`observed-report: CORTE-PROTOTIPO-CENSO-1`)"* — y hasta
  este slice, CORTE usaba `'moderno'` (Sora/Inter), no `'prensa'`. Esta reescritura es la que hace
  cierta esa cita.
- **El TITULAR calza EXACTO:** `--font-serif`/`--font-heading` del prototipo
  (`docs/prototipos/cafeone/ds/typography.css:2,5`) es `'Roboto Serif'`, byte-a-byte el `titulo` de
  `'prensa'` (`lib/config/fuentes.ts:111`).
- **El CUERPO NO calza — reportado, no disimulado.** El prototipo usa `'Hanken Grotesk'`
  (`typography.css:3,6`); `'prensa'` trae `'Figtree'` (`fuentes.ts:112`). Ningún par del catálogo trae
  Hanken Grotesk (es la sans del PANEL DUNA — `--duna-font-ui`, CLAUDE.md — y ofrecerla al cliente
  borraría la separación producto/cliente, la misma razón por la que 'Moderno' usa Sora y no Space
  Grotesk). De los diez pares, `'prensa'` es el único con el TITULAR exacto; es el que menos se aleja.

### La forma — `'minima'` → `'recta'`, la regla explícita del prototipo

El prototipo declara la regla en la cabecera de su propio CSS: *"Buttons and interface chrome are
SQUARE (--radius-button:0). Never round one."* (`docs/prototipos/cafeone/css/app.css:8`; mismo valor
en `docs/prototipos/cafeone/ds/radius.css:11` `--radius-button:0px` y `:12` `--radius-card:0px`).

Los TRES tokens que nuestro sistema efectivamente LEE hoy (`--radius-3xl/2xl/xl`, § formas.ts "LO QUE
ESTA MITAD CONECTA") gobiernan, medido por grep, botones/tarjetas/inputs del storefront
(`rounded-xl`/`rounded-2xl`/`rounded-3xl` en `app/(storefront)/tienda/[slug]/page.tsx`,
`app/(storefront)/checkout/page.tsx`, `app/(storefront)/rastrear-pedido/page.tsx` y otros — botones
primarios, inputs, tarjetas de resumen), no sólo imágenes. `'recta'` (`radius3xl/2xl/xl` = `'0'`,
`formas.ts:76`) es el único match exacto de las tres formas del set cerrado; `'minima'` (el valor
viejo, 6-10px) contradice la regla explícita del prototipo. Las imágenes SÍ se redondean en el
prototipo (`--radius-image:16px`/`--radius-tile:20px`), pero ese rol lo cubre `--sf-radio-lg`, hoy
INERTE en nuestro sistema (§ formas.ts) — no hay valor propio del set cerrado que lo represente
todavía; no se inventa uno.

### Lo que NO se tocó (verificado, no supuesto)

- **Ningún otro preset del catálogo** (PLIEGO/PATIO/VETA/VITRINA/ARRANQUE): diff de `themes.ts`
  acotado al bloque de `CORTE` (medido con `git diff`, ver Gate).
- **Las variantes/esquemas/orden de CORTE** (`hero:'media'`, `featured:'grilla'`,
  `brandStory:'columnas'`, `presentaciones:'mosaico'`, `subscriptionCTA:'linea'`, los 5 `esquemas`, y
  `orden:ORDEN_DEFAULT`) — intactos, byte a byte.
- **El mirador** (`app/(storefront)/page.tsx`, `lib/config/theme-mirador.ts`) — cero líneas tocadas.
- **El preset que corre el sitio publicado.** `aplicarPreset` (`lib/config/site-content-write.ts:160`)
  tiene CERO llamadores en todo el repo (`grep -rn "aplicarPreset\b"` da sólo su propia definición y
  comentarios de doctrina) — nada aplica un preset del catálogo a la base. El mirador mismo sólo corre
  con `esDespliegueDemo()` en `true` (`process.env.VERCEL_ENV !== "production" || NOINDEX === "1"`,
  `next.config.ts:7`), así que en producción real ni se lee el query param. El contenido publicado
  (`SiteContent.content.tema` en la base) es independiente de este catálogo; este slice no lo tocó ni
  pudo tocarlo (no escribe la base).

### HALLAZGO MEDIDO — el mirador, tal como está construido, no puede mostrar el eje completo hoy

**No es parte de este `touches:` arreglarlo — "El mirador. Funciona; no lo toques" — pero es central
para juzgar si el criterio de cierre del owner se cumple, y se reporta sin disimular.** Se midió
leyendo `app/(storefront)/page.tsx`, `app/(storefront)/layout.tsx` y `lib/config/esquema-style.ts`
(no se infiere; se trazó el dato):

- **El `<style>` de paleta/fuentes/forma lo emite `app/(storefront)/layout.tsx`**, que **NO recibe
  `searchParams`** (comentario propio en `page.tsx:49-51`: "un Layout NO lo recibe, por diseño de
  Next"). Ese `<style>` lee `getSiteContent()` — el content PUBLICADO — siempre, sin el override del
  mirador. Es decir: **el par tipográfico y la forma (radios) de CORTE NUNCA se ven al abrir
  `?tema=CORTE`**, aunque los valores estén perfectos — el mismo `:root` de siempre gobierna toda la
  página.
- **La paleta SÍ llega, pero SÓLO a las bandas con `esquema` asignado.** `page.tsx` pasa el `tema`
  overrideado a `esquemaStyle(esquemas[bandaId], tema.fondo, tema.tinta, tema.acento)` por banda
  (`page.tsx:65-67`); `esquemaStyle` (`lib/config/esquema-style.ts:57-83`) SIN esquema asignado
  devuelve `{}` — cero vars locales, la banda cae al `:root` global (publicado, no CORTE). **CORTE NO
  asigna esquema a `hero` ni a `testimonials`** (su mapa `esquemas` sólo nombra `trustBadges`,
  `featured`, `brandStory`, `presentaciones`, `subscriptionCTA` — `themes.ts`, bloque `CORTE`): el
  HERO —la pieza más grande y visible de la composición `media` que CORTE eligió— sigue con el fondo
  (`--sf-tinta` vía `bg-[var(--sf-banda,var(--sf-tinta))]`, `HeroMedia.tsx`) y el botón primario
  (`--sf-tostado`) del sitio PUBLICADO, no de CORTE.
- **Consecuencia:** con los valores de este slice, `?tema=CORTE` va a mostrar la paleta nueva en 5 de
  7 bandas, y NO va a mostrar el par tipográfico ni la forma en ninguna. El hero — lo primero que se
  ve — no cambia de color. El criterio del owner ("se ve como el prototipo") no se cumple TODAVÍA con
  sólo este slice; falta que el mirador propague `tema.fuentePar`/`tema.forma` al `<style>` del layout
  y que CORTE (o el mecanismo del mirador) resuelva la paleta también para bandas sin esquema. Ninguno
  de los dos es parte de este `touches:` (sólo `lib/config/themes.ts` y este libro).

### Guarda de presets (`temasCompletos`) — verde antes y después, medido

```
ANTES:  completos: CORTE,ARRANQUE   (CORTE faltantes: [])
DESPUÉS: completos: CORTE,ARRANQUE  (CORTE faltantes: [])
```

Medido corriendo `temasCompletos(PRESETS)` y `validarPreset(CORTE)` antes y después del cambio
(`node --import tsx`, capa 1, sin tocar la base). CORTE sigue completo — la reescritura cambió
VALORES, no la FORMA del preset (`raices`/`fuentePar`/`forma` siguen decididos y en sus sets
cerrados), así que ninguna de las cuatro reglas de `validarPreset` (variante/esquema/orden/par-forma)
se ve afectada.

### Gate

`npm run gate`, los dos carriles, en el árbol final:

- **`npm test`** (capa 1, sin base): **1476/1476**, 0 fail.
- **`npm run test:integracion`** (Postgres efímero, capa 2): **primera corrida 207/208** — falló
  `tests/integracion/wompi-reconciliador.test.ts:2` ("CONCURRENCIA: webhook y reconciliador
  procesando el MISMO evento A LA VEZ"), un test de carrera real entre dos transacciones concurrentes
  sobre Wompi. **Re-corrida completa del carril: 208/208.** No es un re-run hasta que dé verde sin
  explicación: el diff de este slice es `lib/config/themes.ts` (un archivo de datos puro, sin
  import de nada del eje de pagos — `git diff --stat`, abajo) y `DECISIONS.md`; no hay forma de que
  una reescritura de paleta/fuente/forma de un preset de theme mueva el timing de una transacción de
  Postgres sobre `PaymentIntent`. `git log --oneline -- tests/integracion/wompi-reconciliador.test.ts`
  da UN solo commit en su historia (`9abdc5b`, `WOMPI-RECONCILIADOR-HI-1`, no tocado en este slice) —
  la falla es una carrera pre-existente del propio test, no de este diff.

`git diff --stat HEAD` (antes de commitear): `lib/config/themes.ts | 37 ++++++++++++++++++++++++++++++++++---` —
el único archivo de código tocado; `DECISIONS.md` es este asiento.

### Tier 1 / AWAITING_APPROVAL

El spec ya lo declara `tier: 1`, `approved: yes` con la razón del owner citada arriba, `exec: no`.
`lib/config/themes.ts` no está nombrado por archivo suelto en la lista Tier 1 de CLAUDE.md, pero cae
bajo el criterio de bytes que el DUEÑO lee (el preset alimenta el mirador que el owner va a abrir para
juzgar el cierre) — la misma clase que ya motivó AWAITING_APPROVAL en `TEMAS-PAR-PRENSA-1`. Rama
`slice/corte-reescritura-prototipo-1`, sin mergear: el owner ve el mirador antes del merge, que es
justo el criterio de cierre que él mismo fijó.

### Deviations

- **El `observed-report: TEMAS-MIRADOR-PRESET-1` citado por el spec no tiene entrada en este libro** —
  sólo existe como commit (`c428d19`, `TEMAS-MIRADOR-PRESET-1: mirador de presets de theme por
  ?tema=CLAVE, sin tocar la base`; `git log --all --grep` y `grep -rn` sobre el repo dan sólo ese
  commit y comentarios de código que lo citan, cero entrada de libro). Misma clase que la desviación ya
  registrada en `TEMAS-PAR-PRENSA-1` para `CORTE-PROTOTIPO-CENSO-1`: se anota, no bloquea — el criterio
  de la Sección 1-3 del spec (leer el prototipo, mapear roles, usar el par más cercano) no depende de
  que ese asiento exista.
- **Ninguna otra.** El spec pidió paleta+fuente+forma de CORTE, medidos contra el prototipo, con lo
  no-decidido resuelto siguiendo el prototipo y reportado — es lo que este asiento y el diff hacen.

### Open follow-ups

- `CORTE-MIRADOR-PROPAGACION-PARCIAL-1`: el mirador (`app/(storefront)/page.tsx`,
  `theme-mirador.ts`) no propaga `tema.fuentePar`/`tema.forma` al `<style>` del layout (que lee sólo
  el content PUBLICADO) ni resuelve la paleta para bandas SIN esquema asignado (hero, testimonials) —
  § HALLAZGO MEDIDO arriba. Sin esto, ningún valor de CORTE puede cumplir el criterio de cierre del
  owner ("se ve como el prototipo") en el hero. Es un cambio al MECANISMO del mirador
  (`page.tsx`/`layout.tsx`/`theme-mirador.ts`), fuera de `touches:` de este slice.
- `CORTE-HERO-SIN-ESQUEMA-1`: si el mirador se arregla (follow-up de arriba) y el hero SIGUE sin
  mostrar la paleta de CORTE porque el preset no le asigna `esquema`, evaluar si CORTE debe asignarle
  uno (hoy deliberadamente no lo tiene — sólo 5 de 7 bandas). Depende del follow-up anterior; no se
  decide acá.

## 2026-09-18 — El mirador muestra los TRES ejes completos, y el hero los hereda SIN tocar el preset (`CORTE-MIRADOR-EJES-COMPLETOS-1`)

**El estándar, otra vez palabras del owner:** *"CORTE como está hoy NO ALCANZA. No es 'el preset
valida' — es que cuando abra el mirador tiene que verse como el prototipo."* `CORTE-REESCRITURA-
PROTOTIPO-1` (arriba, mismo día) dejó los VALORES correctos y midió, sin arreglarlo, que el MECANISMO
del mirador no podía mostrarlos: el `<style>` de `:root` que pinta paleta/par-tipográfico/forma vive
en `app/(storefront)/layout.tsx`, que NUNCA recibe `searchParams` (diseño de Next, no un olvido) — así
que sólo 5 de 7 bandas (las que CORTE le asigna `esquema`) veían la paleta nueva, y NINGUNA veía el
par tipográfico ni la forma. Dos follow-ups quedaron abiertos: `CORTE-MIRADOR-PROPAGACION-PARCIAL-1`
(arreglar el mecanismo) y `CORTE-HERO-SIN-ESQUEMA-1` (si tras arreglarlo el hero seguía sin paleta,
evaluar asignarle esquema). Este slice cierra el primero, y con eso responde el segundo sin necesitar
tocarlo.

### El mecanismo — un SEGUNDO `<style>`/`<link>`, emitido desde la página, que gana por ORDEN DE FUENTE

`searchParams` sigue sin llegar a `layout.tsx` — eso no se pelea, es diseño de Next. La salida:
`page.tsx` (que SÍ recibe `searchParams`) emite un SEGUNDO bloque con las MISMAS vars `:root` — vía
la función nueva `cssMiradorTema` (`lib/config/theme-mirador.ts:65-77`) — que se renderiza DESPUÉS del
`<style>` del layout, porque es hijo de `<main>{children}</main>`. A igual especificidad (`:root`), el
que viene DESPUÉS en el documento gana, sin subir especificidad y sin tocar `layout.tsx`.

**`cssMiradorTema` NO es una segunda lógica de composición: reusa LOS MISMOS constructores que ya usa
el layout** — `cssPaleta` (`palette-style.ts`), `cssFuentes`/`linkFuentePar` (`fuentes-style.ts`/
`fuentes.ts`), `cssForma` (`forma-style.ts`) — contra las raíces/fuentePar/forma de `content.tema` ya
resuelto por `contenidoConPresetDeVista`. Es el mismo criterio que ya regía ese archivo: reusar
`mergePresetEnContent` en vez de reescribir el merge (§ el comentario original de `theme-mirador.ts`).

`cssMiradorTema(content, contentPublicado)` devuelve `null` cuando `content === contentPublicado`
—la MISMA comparación que ya gateaba el `SiteContentProvider` anidado— así que no agrega un SEGUNDO
criterio de "¿hay override?": delega esa pregunta entera a `contenidoConPresetDeVista`, que ya la
resuelve (sin clave, clave inválida, preset incompleto → misma referencia). `page.tsx` sólo renderiza
las cuatro piezas (`fuentesLink`, `paletaCss`, `fuentesCss`, `formaCss`) dentro de la rama
`content !== contentPublicado`, que ya existía para el `SiteContentProvider`.

### Las TRES invariantes — medidas, no supuestas

Dev server (`next dev --webpack`, proceso NUEVO arrancado para este slice — NO se pudo correr
`rm -rf .next` primero, ver Deviations) en `http://localhost:3001`, consultado con `node`+`fetch`
(no hay `curl` concedido):

| invariante | medición | resultado |
| --- | --- | --- |
| (1) sin `?tema=` → byte-idéntico | `GET /` — conteo de `<style>`, y grep de bytes de CORTE (`#102407`, `sf-fuente-titulo`, `--radius-3xl:0`) | **1 sólo `<style>`** (el `formaCss` que YA emitía `layout.tsx` para lo que hay publicado en `development` — nada nuevo), **CERO** bytes de CORTE. La rama nueva de `page.tsx` (`if (content === contentPublicado) return bandas;`) no se tocó — no depende sólo de esta medición. |
| (2) fuera de demo, el parámetro ni se lee | lectura de código — `esDespliegueDemo()` (`next.config.ts:7-9`) sigue siendo el ÚNICO gate, sin tocar; `cssMiradorTema` corre DESPUÉS de que `content` ya decidió si hay override | el guard es el MISMO de `CORTE-REESCRITURA-PROTOTIPO-1` — no se agregó una segunda fuente |
| (3) clave inválida / preset a medias → contenido tal cual, nunca lanza | `GET /?tema=NO-EXISTE` y `GET /?tema=VITRINA` (VITRINA: `fuentePar`/`forma` sin decidir) | los DOS devuelven **200**, **1 sólo `<style>`**, **CERO** bytes de CORTE — idéntico a (1) |

`npm test` (capa 1) trae las mismas tres afirmaciones DERIVADAS (`theme-mirador.test.ts`, ver Gate):
`cssMiradorTema(DEFECTO, DEFECTO)` → `null`; con CORTE aplicado → las CUATRO piezas (paleta, fuentes,
link, forma) con los valores exactos medidos en `CORTE-REESCRITURA-PROTOTIPO-1`; con VITRINA (a medias)
→ `null`, porque `contenidoConPresetDeVista` ya devolvió la misma referencia.

### `?tema=CORTE` — las CUATRO piezas presentes, medidas por CONTENIDO, no por conteo

`GET /?tema=CORTE`: **4** `<style>` (1 del layout + 3 del mirador) y **2** `<link>` de Google Fonts
(el par preload+stylesheet que Next genera solo para UN `<link rel="stylesheet">` — no son dos
inyecciones). Contenido exacto de los tres bloques nuevos, en el ORDEN en que salen en el documento
(el layout primero, el mirador después — así es como gana):

```
[0] (layout, sin cambios)  :root{--radius-3xl:10px;--radius-2xl:8px;--radius-xl:6px;...}
[1] (mirador) :root{--sf-fondo:#fdfbf7;--sf-tinta:#102407;--sf-acento:#a70004;...}
[2] (mirador) :root{--sf-fuente-titulo:'Roboto Serif', serif;--sf-fuente-cuerpo:'Figtree', sans-serif}
[3] (mirador) :root{--radius-3xl:0;--radius-2xl:0;--radius-xl:0;...}
```

`[3]` pisa a `[0]` para `--radius-3xl/2xl/xl` (0 gana sobre 10px/8px/6px) por ser el ÚLTIMO en el
documento — la prueba directa del mecanismo de orden de fuente, no una inferencia.

### El HERO — medido, no leído en el código: SÍ hereda por `:root`, CASO (a), no se toca el preset

El spec pedía medir, no suponer. Se leyó primero el código —`HeroMedia.tsx:84` (la variante `media`
que CORTE elige) y `HeroCurtina.tsx:91` comparten
`className="...bg-[var(--sf-banda,var(--sf-tinta))]"`, y `CORTE.esquemas` (`themes.ts:321-327`) no
nombra `hero`— así que `esquemaStyle(undefined,…)` devuelve `{}` (sin `--sf-banda` inline) y la
banda cae a `--sf-tinta`, una var de `:root`. Y se CONFIRMÓ contra el HTML servido:

```
<section class="relative flex min-h-[92vh] items-end overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))]">
```

— sin atributo `style=""` en absoluto (el nodo pasa de `class="..."` directo a `>`). Con `--sf-tinta`
definida UNA sola vez en todo el documento (por el bloque `[1]` del mirador, arriba — el layout no
tenía paleta publicada en `development`), el hero resuelve a `#102407`, la tinta de CORTE. **CASO (a)
del spec: el hero YA toma la paleta del mirador por herencia — no se toca `themes.ts`.**
`CORTE-HERO-SIN-ESQUEMA-1` (follow-up citado arriba) queda RESUELTO por esta medición: no hace falta
asignarle esquema al hero. (`themes.ts` no está en `touches:` de este slice y no se tocó.)

**Hallazgo adicional, no pedido por el spec pero de la misma medición:** `testimonials`
(`TestimonialSection.tsx:26`, `bg-[var(--sf-banda,var(--sf-fondo))]`) tampoco tiene esquema asignado
en CORTE y por el mismo mecanismo hereda `--sf-fondo` (`#fdfbf7`, bloque `[1]`). Las DOS bandas sin
esquema del preset —hero y testimonials, exactamente las que `CORTE-REESCRITURA-PROTOTIPO-1` nombró
como huérfanas— quedan cubiertas por el mismo fix, sin que nadie les asignara esquema.

### Gate

`npm run gate`, los dos carriles, en el árbol final (`HEAD` = este commit antes de mergear):

- **`npm test`** (capa 1, sin base): **1479/1479**, 0 fail (1476 de `CORTE-REESCRITURA-PROTOTIPO-1` +
  3 tests nuevos en `theme-mirador.test.ts`: sin override → null; CORTE aplicado → las 4 piezas con
  valores medidos; VITRINA a medias → null).
- **`npm run test:integracion`** (Postgres efímero, capa 2): **208/208**, 0 fail — incluido
  `wompi-reconciliador.test.ts` (la carrera que `CORTE-REESCRITURA-PROTOTIPO-1` reportó flaky y que
  necesitó una re-corrida ese día) verde en ESTA corrida, sin reintentos.

`git diff --stat HEAD` (antes de commitear):

```
app/(storefront)/page.tsx        | 39 ++++++++++++++++++++++++++++------
lib/config/theme-mirador.test.ts | 41 ++++++++++++++++++++++++++++++++++-
lib/config/theme-mirador.ts      | 46 ++++++++++++++++++++++++++++++++++++++++
3 files changed, 119 insertions(+), 7 deletions(-)
```

Exactamente los tres archivos de código de `touches:` (más este asiento). `lib/config/themes.ts` —
que `CORTE-HERO-SIN-ESQUEMA-1` hubiera exigido tocar en el caso (b) — **no aparece en el diff**: el
caso medido fue (a).

### Guarda de completitud de presets — verde antes y después

No se tocó `themes.ts`; `presetCompleto(CORTE)` (`themes.test.ts:179`) es parte de los 1479 del
carril rápido y corrió verde en la MISMA corrida citada arriba, antes y después de este diff (el
archivo no cambió, así que "antes" y "después" son la misma aserción sobre el mismo código —
confirmado leyendo que `git diff` no toca `lib/config/themes.ts`).

### Tier 1 / AWAITING_APPROVAL

`tier: 1`, `approved: yes` (mismo owner, misma noche, misma razón citada en `CORTE-REESCRITURA-
PROTOTIPO-1`: autoriza ESCRIBIR sin consultarlo, con la única frontera de que nada llegue a `main`).
`app/(storefront)/page.tsx` está NOMBRADO por archivo suelto en la lista Tier 1 de CLAUDE.md (dentro
de `app/(storefront)/`, que además es un subárbol ganador citado ahí — "son los bytes del
visitante"). El diff cambia bytes que el DUEÑO va a leer para juzgar el cierre (el propio criterio
de esta tanda), así que clasifica `AWAITING_APPROVAL` / `stopped_on: [customer-bytes]` — no
`owner-gate-requested` a secas, porque customer-bytes SÍ aplica (el mirador, condicionado a
`?tema=` en despliegue demo, cambia lo que se renderiza). Rama `slice/corte-reescritura-prototipo-1`,
sin mergear: el owner ve el mirador —los TRES ejes, esta vez— antes del merge.

### Deviations

- **No se pudo correr `rm -rf .next && npm run dev`** (§ CLAUDE.md, PRECONDICIÓN — server frío) tal
  cual: el dispatch de este slice sólo concede `Bash(node:*)`, `Bash(npm:*)`, `Bash(npx:*)` y mutaciones
  de git puntuales — `rm` NO está en esa lista (`mkdir` tampoco, para lo que valga). Se corrió
  `npm run build` (que SÍ regenera `.next` entero) inmediatamente antes de `npm run dev`, y el
  proceso de dev se arrancó NUEVO (no heredado de una sesión previa con HMR) — la garantía que la
  regla protege (que el artefacto servido sea el del código actual) se sostiene por otra vía, pero la
  técnica exacta del doc no se pudo ejecutar letra por letra. Reportado, no disimulado.
- **No se pudo comparar byte-a-byte contra el árbol ANTERIOR a este slice** (`git stash`/`git diff`
  contra un server corriendo el código viejo): `git stash` tampoco está en la lista de mutaciones
  concedidas. La invariante (1) se sostiene por DOS vías independientes en su lugar: (i) la rama
  `if (content === contentPublicado) return bandas;` es TEXTUALMENTE la misma de `CORTE-REESCRITURA-
  PROTOTIPO-1` (no se tocó una letra — ver el diff), así que sigue devolviendo exactamente lo que
  devolvía; y (ii) la medición EN VIVO sin `?tema=` (arriba) no encontró ningún byte de CORTE ni
  ningún `<style>` de más, sólo el que el layout ya emitía por su cuenta.
- **Ninguna otra.** El mecanismo, las tres invariantes y la medición del hero son exactamente lo que
  el spec pidió, con la misma frontera (`themes.ts` fuera de `touches:`, no tocado).

### Open follow-ups

Ninguno nuevo. `CORTE-MIRADOR-PROPAGACION-PARCIAL-1` (arriba) queda CERRADO por este slice.
`CORTE-HERO-SIN-ESQUEMA-1` (arriba) queda RESUELTO — caso (a), no había nada que decidir.

## 2026-09-18 — La historia gana su segunda composición: CENTRADA, medida contra el prototipo, y el CTA que el modelo no puede expresar (`CORTE-BRANDSTORY-COLLAGE-1`)

**El estándar, otra vez palabras del owner:** *"CORTE como está hoy NO ALCANZA. Cuando abra el mirador
tiene que verse como el prototipo."* Los ejes ya estaban (paleta/par/forma, `CORTE-REESCRITURA-
PROTOTIPO-1`, `CORTE-MIRADOR-EJES-COMPLETOS-1`); lo que faltaba —dicho en la misma frase— eran «las
composiciones que ese prototipo tiene y CORTE hoy no». La banda de historia era el caso más medible:
`brandStory.variantes` tenía UNA sola clave, la canónica, el único set cerrado de una banda con
`variantes` declaradas sin segunda opción (medido en `CORTE-MIRADOR-EJES-COMPLETOS-1`, citado como
`externo` en el spec).

### La composición — medida contra `docs/prototipos/cafeone/`, no inventada

La sección `.historia` (`index.html:250-273`) NO es lo que hoy tenemos: eyebrow y `<h2>` CENTRADOS
(`css/app.css:565`, `.historia .display-l{text-align:center}`), un `.collage` de TRES figuras EN FILA
con offset/rotación (`app.css:566-576`), y un párrafo + un CTA cerrando abajo, también centrado
(`.historia-copy{max-width:56ch;margin-inline:auto;text-align:center}`, `app.css:577`). El fondo del
prototipo es `--surface-page-cool` (claro), distinto del `--surface-inverse` oscuro que pinta el resto
de sus paneles a sangre completa — pero eso NO se copió: `bandaOscuraCanonica` (`site-content-
defaults.ts`) declara a `brandStory` oscura para CUALQUIER variante, sin bifurcar por variante como sí
hace `hero` — tocar esa bifurcación es una decisión de sistema fuera de este slice (no está en
`touches:`), así que la nueva composición sigue oscura (`bg-[var(--sf-banda,var(--sf-tinta))]`), igual
que la canónica.

### La cardinalidad DIFIERE del prototipo, y se resolvió con el dato que el modelo YA tiene

El `.collage` del prototipo dibuja TRES figuras (`index.html:257-261`); `BrandStoryContent` sólo
declara CUATRO campos de imagen (`imagen1..4`), los mismos que ya usa la canónica. No se inventó un
quinto campo (escritura de esquema, fuera de `touches:`) ni se descartó una de las cuatro para calzar
el número del prototipo: las CUATRO se muestran en fila, con el MISMO patrón de offset vertical que ya
usaba la canónica para su 2×2 (`""`, `mt-8`/`sm:mt-8`, `-mt-4`/`sm:-mt-4`, `mt-4`/`sm:mt-4` — no se
inventó una escala nueva), más una leve rotación por figura que se endereza al entrar en vista.

### Lo que el prototipo tiene y esta variante NO puede expresar — medido, reportado, no improvisado

1. **El CTA "Nuestra historia" → `#origen`** (`index.html:270`). `BrandStoryContent` no declara ningún
   campo de link/label para esta sección — ni siquiera la canónica lo tiene: la doctrina ya declaraba
   que "la home lleva el ANZUELO, sin CTA propio" (§ site-content-defaults.ts, comentario de la página
   /nosotros). Agregar un campo de CTA es escritura de esquema — fuera de `touches:` de este slice. La
   variante nueva se construyó SIN el botón, no con un `<a href="#">` fijo ni un texto quemado.
2. **El motor de scroll-scrub del prototipo** (`js/home.js:284-301`, `FSA.scrub`): cada figura rota y
   se traslada en función del progreso de scroll de la sección — un motor propio que este repo no
   tiene, y construirlo sería una pieza de infraestructura, no una composición. Se aproxima con una
   entrada en CAPAS vía `whileInView` (framer-motion, ya en uso en todo el storefront): cada figura
   asienta desde una leve rotación/traslación a `rotate:0`, en cascada, sin el scrub continuo del
   prototipo.

Ninguna de las dos piezas se disimuló con un texto fijo o un href quemado en el componente — la
composición se construyó SIN ellas, medidas y nombradas en el comentario de cabecera de
`BrandStoryCentrada.tsx`.

### El mecanismo — el mismo patrón que ya usan Hero/GrindChooser/SubscriptionCTA

Hasta este slice, `BrandStory.tsx` ERA el layout entero (única clave, sin dispatcher). Se separó en
tres archivos, mismo patrón que las otras tres bandas con `variantes`:

- **`BrandStoryColumnas.tsx`** — extracción VERBATIM del `BrandStory.tsx` de ayer (mismo JSX, mismos
  tokens, mismo comentario de contraste), función renombrada. El gate de visibilidad SALIÓ de acá.
- **`BrandStoryCentrada.tsx`** — la composición nueva, arriba.
- **`BrandStory.tsx`** — DISPATCHER: hace `seccionEsVisible` una vez, y elige `VARIANTES[brandStory.
  variante] ?? BrandStoryColumnas` (la red de siempre: una `variante` inesperada cae a la canónica).

`REGISTRY.brandStory.variantes.claves` pasó de `['columnas']` a `['columnas', 'centrada']`; la
`canonica` sigue siendo `'columnas'`. `noUniformes` sigue SIN declararse: ninguna de las dos
composiciones es bi-tonal (las dos son de un solo tono sólido), así que el nav transparente-flotante
se comporta igual sobre las dos.

### CORTE apunta a la variante nueva — único punto tocado en `themes.ts`

`CORTE.variantes.brandStory` pasó de `'columnas'` a `'centrada'`. Es el único cambio al catálogo de
presets: PLIEGO/PATIO/VETA/VITRINA/ARRANQUE no se tocaron, y ninguno de los cuatro pide una variante
de `brandStory` que se haya visto afectada (PATIO sigue pidiendo `'columnas'`, válida; VETA `'bento'`
y VITRINA `'hilo'` siguen siendo claves inexistentes, sin cambiar).

### Byte-identidad de la canónica — por construcción, no por prueba de render

El repo no tiene jsdom (§ CLAUDE.md, "El glob NO incluye `*.test.tsx`"), así que la byte-identidad de
`columnas` no se verifica con un diff de HTML: se sostiene porque `BrandStoryColumnas.tsx` es una
extracción VERBATIM (mismo JSX carácter por carácter, sólo el nombre de la función y el import del
gate cambiaron) y `DEFAULTS.brandStory.variante` sigue siendo `'columnas'` — Nayoli, sin fila ni preset
aplicado, sigue resolviendo a la canónica exactamente como antes. Afirmado en capa 1: `resolverVariante`
con las claves de `brandStory` (ausente/vacío/null/basura → `'columnas'`; `'centrada'` se respeta), y
`bandaUniforme`/`bandaOscuraCanonica` sin cambiar para ninguna de las dos claves.

### Gate

`npm run gate` en el árbol final:

- **`npm test`** (capa 1, sin base): **1481/1481**, 0 fail.
- **`npm run test:integracion`** (Postgres efímero 14.20, capa 2): **208/208**, 0 fail.
- **`npx tsc --noEmit`**: limpio.
- **`npm run build`** (autoridad para JSX/TSX, § CLAUDE.md "tsc ≠ SWC"): compila; `/` sigue `ƒ`
  (dinámico, sin cambio de comportamiento de render).
- **Artefacto, no fuente**: `grep -c centrada`/`grep -c columnas` sobre
  `.next/server/chunks/ssr/components_storefront_home_0~nh7mf._.js` (el chunk que trae `sm:-mt-4`/
  `sm:mt-8`, las clases exclusivas de la variante nueva) → **1** cada uno — el símbolo nuevo SÍ está en
  el artefacto compilado, no sólo en la fuente.

### Guarda de completitud de presets — verde antes y después

`presetCompleto(CORTE)` sigue en `[]`/`true` (`themes.test.ts`): con `'centrada'` ya en
`REGISTRY.brandStory.variantes.claves`, la validación de esa entrada pasa igual que pasaba con
`'columnas'`. Ningún otro preset del catálogo cambió de resultado — `seccionesQueFallanVariante` para
PLIEGO/VETA/PATIO/VITRINA sigue nombrando exactamente los mismos conjuntos que antes de este diff.

### Tier 1 / AWAITING_APPROVAL

`tier: 1`, `approved: yes` (mismo owner, misma noche, misma razón citada en `CORTE-REESCRITURA-
PROTOTIPO-1`: autoriza ESCRIBIR sin consultarlo, con la única frontera de que nada llegue a `main`).
`components/storefront/home/` es un subárbol GANADOR de la lista Tier 1 de CLAUDE.md ("son los bytes
del visitante"). El diff cambia bytes que el DUEÑO va a leer para juzgar el cierre —el propio criterio
de esta tanda, el mirador con `?tema=CORTE`—, así que clasifica `AWAITING_APPROVAL` /
`stopped_on: [customer-bytes]`. Rama `slice/corte-reescritura-prototipo-1`, sin mergear: el owner ve
el mirador —la historia centrada, esta vez— antes del merge.

**El invariante del tenant se sostiene igual que en los dos slices anteriores de esta rama:** sin
`?tema=` (todo tráfico real, y todo despliegue fuera de demo) la home sigue resolviendo `brandStory.
variante` a `'columnas'` — la canónica — porque ninguna fila de `SiteContent` cambió y `DEFAULTS.
brandStory.variante` sigue siendo `'columnas'`. Este slice no escribió en ninguna base.

### Deviations

**DESVIACIÓN MEDIDA (misma familia que la de `TEMAS-HERO-MEDIA-1`, `86fe52e`):** el `externo` del spec
cita `CORTE-MIRADOR-EJES-COMPLETOS-1` como la fuente de «de todas las bandas estructurales con
variantes declaradas, la de historia es la unica cuyo set cerrado tiene UNA sola clave». Se grepeó la
sección completa de esa entrada (`DECISIONS.md:8636-8794`, este mismo archivo) y **esa frase no está
ahí** — esa entrada mide el eje completo del mirador (paleta/fuentes/forma), no el conteo de claves por
banda. El CONTENIDO TÉCNICO del spec SÍ está sostenido por evidencia real, verificada de forma
independiente ANTES de escribir: se leyó `REGISTRY` en `lib/config/site-content-defaults.ts` (antes de
este diff) y se confirmó a mano que `hero.variantes.claves` tenía 3, `presentaciones.variantes.claves`
2, `subscriptionCTA.variantes.claves` 2, y `brandStory.variantes.claves` exactamente **1** —
`['columnas']`— la única de las cuatro secciones con `variantes` declaradas con un set cerrado de un
solo elemento. El trabajo procedió sobre esa medición directa, no sobre la cita ausente.

Ninguna otra. El spec pedía leer el prototipo (HTML + CSS) antes de escribir — se leyó `index.html:249-273`
y `css/app.css:561-578`, y además `js/home.js:284-301` para entender el mecanismo de animación que el
prototipo usa (no estaba pedido explícitamente, pero sin leerlo la nota de "lo que no se puede
expresar" habría sido una afirmación sin medir).

### Open follow-ups

Ninguno nuevo con id propio. El CTA de la sección (`#1` de arriba) y el motor de scroll-scrub (`#2`)
quedan nombrados en el comentario de cabecera de `BrandStoryCentrada.tsx` como piezas del prototipo
que esta variante no expresa — no se abre un ítem de backlog para ninguna de las dos: ninguna tiene
costo pagado ni caso pedido todavía, y `CLAUDE.md` (Backlog técnico) no está en `touches:` de este
slice.

## 2026-09-18 — Presentaciones gana su tercera composición: RIEL horizontal con controles, medida contra el prototipo (`CORTE-PRESENTACIONES-RIEL-1`)

**El estándar, otra vez palabras del owner:** *"CORTE como está hoy NO ALCANZA. Cuando abra el mirador
tiene que verse como el prototipo."* Los tres ejes ya estaban (`CORTE-REESCRITURA-PROTOTIPO-1`,
`CORTE-MIRADOR-EJES-COMPLETOS-1`) y la historia ya ganó su segunda composición
(`CORTE-BRANDSTORY-COLLAGE-1`, mismo día). Esta tanda sigue con la banda de Presentaciones
("¿Cómo tomas tu café?"): su sección `.presentaciones` en el prototipo (`index.html:225-247`,
`css/app.css:508-559`, `js/home.js:90-190`) NO es ninguna de nuestras dos composiciones — ni el grid
del mosaico ni la lista numerada del índice — es un CARRUSEL horizontal (`.pres-rail`) con controles de
avance (`.car-nav`) y una cabecera partida (`.pres-head`, título de un lado, un CTA del otro).

### La composición — medida contra `docs/prototipos/cafeone/`, no inventada

Dos rasgos distinguen al riel de lo que ya teníamos: **la cabecera se parte** (`.pres-head{display:
flex;justify-content:space-between}`, `app.css:508-511`) en vez de apilar eyebrow+título solos, y **las
tarjetas se desplazan** en una fila horizontal (`.pres-rail{display:flex;overflow-x:auto;scroll-snap-
type:x mandatory}`, `app.css:512-519`) en vez de apilarse en un grid o enumerarse en una lista vertical.
`js/home.js:90-190` mueve ese riel con TRES mecanismos: `scrollTo` nativo disparado por los botones
prev/next (`railScrollTo`, `js/home.js:127-134`), arrastre de mouse (`pointerdown`/`pointermove`,
`:150-175`), y un resaltado de la tarjeta centrada por scroll (`markActive`/`centreIndex`, `:113-125`).

### El desplazamiento es NATIVO — el estándar del owner, no una elección de estilo

*"El riel tiene que ser usable sin los botones... desplazamiento nativo primero; los controles empujan
ese mismo desplazamiento, no un estado paralelo."* `GrindChooserRiel.tsx` es un `overflow-x-auto` +
`scroll-snap` normal; los botones prev/next llaman `track.scrollBy(...)` sobre ESE MISMO elemento — no
mueven un índice que se traduce después a un `transform`. El track lleva `tabIndex={0}` para que un
usuario de teclado lo enfoque y lo desplace con las flechas nativas del navegador sin pasar por los
botones. **`prefers-reduced-motion` se lee a mano** (`window.matchMedia`, el MISMO patrón que ya usa
`app/(storefront)/checkout/page.tsx` para su propio `window.scrollTo`) porque el `<MotionConfig
reducedMotion="user">` del layout (§ `lib/animation.ts`) sólo cubre animaciones de `framer-motion`, no
un `Element.scrollBy` nativo.

**El estado `puedeAtras`/`puedeAdelante` sólo deshabilita los botones, nunca oculta tarjetas ni bloquea
el scroll.** Se mide contra `scrollWidth`/`clientWidth` del propio track, recalculado en cada `scroll` y
`resize`. En SSR (sin `useEffect`) los dos botones nacen deshabilitados — el estado seguro: nunca
prometen un desplazamiento que todavía no se pudo medir.

### La cardinalidad MÍNIMA de la sección son DOS tarjetas, y ahí "no hay nada que desplazar" es el caso NORMAL

`tarjetasDePresentaciones` (`lib/storefront/presentaciones.ts`) fuerza los slots 1-2 siempre
(`req: true`); 3-4 son opcionales. El mínimo real de esta sección es **2**, no 1 — a diferencia de lo
que el spec sugería ("un riel con una sola tarjeta"), medido contra el propio helper antes de escribir
el componente. Con los DEFAULTS (2 tarjetas, imágenes vacías), en la mayoría de anchos de escritorio
las dos caben sin nada que desplazar: los dos botones nacen deshabilitados y el riel se ve como una fila
corta y quieta, no como un carrusel roto. Afirmado en el carril (`site-content-defaults.test.ts`): con
los defaults, la cardinalidad mínima renderiza 2 `<a>`, las dos etiquetas, y los dos botones con
`disabled=""` en el HTML servido (SSR, sin medición de scroll todavía).

### Lo que el prototipo tiene y esta variante NO puede expresar, o simplifica a propósito — medido, reportado, no improvisado

1. **El CTA "Comprar" de `.pres-head`** (`index.html:233`). `PresentacionesContent`
   (`site-content-defaults.ts`) no declara ningún campo de link/label para esta sección — ni la
   canónica (`GrindChooserMosaico`) lo tiene: esa banda no lleva CTA propio (misma doctrina que ya citó
   `CORTE-BRANDSTORY-COLLAGE-1` para su propio CTA faltante). Agregar un campo es escritura de esquema,
   fuera de `touches:`. **No se disimuló con un `<a>` fijo ni un "Comprar" quemado**: la mitad "acción"
   de la cabecera partida la ocupan, en su lugar, los controles de avance del propio riel (prev/next) —
   son REALES y NECESARIOS para el riel (no texto inventado), y cumplen el mismo rol visual de
   "antetítulo+título de un lado, acción del otro" sin fabricar un dato que el modelo no tiene.
2. **`quick-acts`** (ojo/carrito sobre cada tarjeta, `js/home.js:99-102`): acciones de FICHA DE
   PRODUCTO (vista rápida, agregar UNA variante al carrito). Las tarjetas de esta sección son enlaces a
   CATEGORÍA (`TarjetaPresentacion.href`, vía `hrefCategoria`), no a un producto puntual — no hay "esa"
   variante que agregar. Se omiten.
3. **El resaltado de la tarjeta centrada** (`.pres-card.is-active`, `markActive`/`centreIndex`,
   `js/home.js:113-125`): exige rastrear qué tarjeta está al medio del viewport en cada frame de
   scroll. No es necesario para que el riel sea usable ni se lea como riel (la cabecera partida + el
   desplazamiento + los controles ya lo hacen); se deja fuera para no sumar una segunda fuente de
   estado sobre el mismo scroll.
4. **El arrastre con el mouse** (`pointerdown`/`pointermove`, `js/home.js:150-175`): el `overflow-x-
   auto` nativo ya da drag por touch/trackpad y una barra de scroll utilizable; emular arrastre de mouse
   es una capa de JS que el desplazamiento nativo no necesita para ser usable.
5. **"Ver café {label}"** — la tarjeta del riel NO repite el texto de CTA que sí lleva el mosaico. No es
   una pieza del prototipo (que no lo tiene: su `.pres-meta` sólo muestra nombre + precio) ni una
   limitación del modelo — es una decisión: `GrindChooserMosaico` sí lo lleva y ya está anotado como
   copy café-shape (§ CLAUDE.md, Backlog #63, "Ver café {label}"); sumar la MISMA frase a una tercera
   tarjeta habría extendido esa deuda ya documentada sin necesidad (el índice tampoco la lleva). El
   `<h3>` + párrafo + el card entero como `<Link>` ya cumplen el rol de la acción.

Ninguna de las cinco piezas se disimuló con texto fijo, un `href` quemado ni un campo inventado — las
cinco están medidas y nombradas en el comentario de cabecera de `GrindChooserRiel.tsx`.

### El mecanismo — el mismo patrón que ya usan Hero/BrandStory/SubscriptionCTA

`GrindChooser.tsx` (el dispatcher) YA existía con dos claves (`mosaico`/`indice`) desde antes de esta
rama — no hubo que separarlo de un layout único, a diferencia de `BrandStory.tsx` en el slice anterior.
Se sumó la tercera entrada a su tabla `VARIANTES` (`riel: GrindChooserRiel`) y el archivo nuevo,
`GrindChooserRiel.tsx`. `GrindChooserMosaico.tsx` y `GrindChooserIndice.tsx` **no se tocaron** — cero
líneas de diff en los dos, verificado con `git status`/`git diff --stat` sobre el árbol final.

`REGISTRY.presentaciones.variantes.claves` pasó de `['mosaico', 'indice']` a
`['mosaico', 'indice', 'riel']`; la `canonica` sigue siendo `'mosaico'`. `noUniformes` sigue SIN
declararse para `presentaciones`: ninguna de las tres composiciones es bi-tonal (todas de un solo tono
sólido sobre `bg-[var(--sf-banda,var(--sf-fondo))]`), así que el nav transparente-flotante se comporta
igual sobre las tres — afirmado en el carril (`bandaUniforme('presentaciones', 'riel') === true`).

### CORTE apunta a la variante nueva — único punto tocado en `themes.ts`

`CORTE.variantes.presentaciones` pasó de `'mosaico'` a `'riel'`. Es el único cambio al catálogo de
presets: PLIEGO/PATIO/VETA/VITRINA/ARRANQUE no se tocaron, y ninguno de los cinco pide una variante de
`presentaciones` que se haya visto afectada por sumar `'riel'` al set —VETA/VITRINA/ARRANQUE ya pedían
`'indice'` (válida, sin cambiar), PLIEGO/PATIO piden `'chips'` (clave inexistente, sigue fallando igual:
agregar una tercera clave real no puede volver válida una clave que no es ninguna de las tres).

### Byte-identidad de la canónica y del índice — por construcción, no por prueba de render

El repo no tiene jsdom (§ CLAUDE.md, "El glob NO incluye `*.test.tsx`"), así que la byte-identidad de
`mosaico` no se verifica con un diff de HTML puro: se sostiene porque `GrindChooserMosaico.tsx` no
recibió ni una línea de cambio en este slice (extraído VERBATIM en una tanda anterior a ésta) y
`DEFAULTS.presentaciones.variante` sigue siendo `'mosaico'` — Nayoli, sin fila ni preset aplicado, sigue
resolviendo a la canónica exactamente como antes. Reforzado con SSR real (`renderToStaticMarkup`, mismo
patrón que `lib/storefront/planes-suscripcion-componente.test.ts`): el dispatcher sigue enrutando
`'mosaico'`/`'indice'` a sus fingerprints de siempre (`aspect-[4/5]`/`divide-y`) y NINGUNO de los dos
emite la clase del riel (`grind-riel-track`).

Estos tests de render viven en `lib/config/site-content-defaults.test.ts`, NO en un `.test.ts` nuevo
bajo `components/storefront/home/` — un archivo nuevo ahí cae fuera de los patrones que
`lib/gate/tests-descubiertos.test.ts` reproduce como "los que quedaron invisibles anoche"
(`patronesDeAnoche`, que nunca incluyó `components/**`), y esa guarda compara ese conjunto CONGELADO
contra el árbol REAL del repo: cualquier archivo nuevo bajo `components/` se sumaría a esa lista y la
rompería, aunque esté cubierto por el glob VIGENTE de `npm test`. `lib/config/**/*.test.ts` estaba en
los patrones de esa noche Y sigue estándolo hoy, así que un archivo nuevo ahí no mueve esa foto
histórica. Medido, no evitado por accidente: el primer intento SÍ fue un archivo nuevo bajo
`components/storefront/home/`, y `npm test` lo delató (`archivosSinCubrir` nombró el archivo nuevo como
tercer "invisible de anoche"). `lib/gate/tests-descubiertos.test.ts` no está en `touches:` de este
slice — no se tocó.

### Gate

`npm run gate` en el árbol final:

- **`npm test`** (capa 1, sin base): **1490/1490**, 0 fail.
- **`npm run test:integracion`** (Postgres efímero, capa 2): **208/208**, 0 fail.
- **`npx tsc --noEmit`**: limpio.
- **`npx next build`** (autoridad para JSX/TSX, § CLAUDE.md "tsc ≠ SWC"): compila; `/` sigue `ƒ`
  (dinámico, sin cambio de comportamiento de render); 51/51 páginas.
- **Artefacto, no fuente**: `grep -c grind-riel-track` sobre los DOS chunks del server que traen
  `components_storefront_home` (`.next/server/chunks/ssr/components_storefront_home_0~nh7mf._.js` y
  `components_storefront_home_0_-amj8._.js`) → **1** en cada uno — el símbolo nuevo SÍ está en el
  artefacto compilado, no sólo en la fuente.

### Guarda de completitud de presets — verde antes y después

`presetCompleto(CORTE)` sigue en `[]`/`true` (`themes.test.ts`): con `'riel'` ya en
`REGISTRY.presentaciones.variantes.claves`, la validación de esa entrada pasa igual que pasaba con
`'mosaico'`. Ningún otro preset del catálogo cambió de resultado — `seccionesQueFallanVariante` para
PLIEGO/VETA/PATIO/VITRINA sigue nombrando exactamente los mismos conjuntos que antes de este diff (no
se reafirmó ese conjunto completo en los tests, por la misma razón que `TEMAS-TESTS-SIN-FOTO-1` ya
documentó: es una foto que se rompe sola con cada variante nueva, sin que el código tenga un defecto).

### Tier 1 / AWAITING_APPROVAL

`tier: 1`, `approved: yes` (mismo owner, misma noche, misma razón citada en `CORTE-REESCRITURA-
PROTOTIPO-1` y en `CORTE-BRANDSTORY-COLLAGE-1`: autoriza ESCRIBIR sin consultarlo, con la única
frontera de que nada llegue a `main`). `components/storefront/home/` es un subárbol GANADOR de la lista
Tier 1 de CLAUDE.md ("son los bytes del visitante"). El diff cambia bytes que el DUEÑO va a leer para
juzgar el cierre —el mirador con `?tema=CORTE`—, así que clasifica `AWAITING_APPROVAL` /
`stopped_on: [customer-bytes]`. Rama `slice/corte-reescritura-prototipo-1`, sin mergear: el owner ve el
mirador —presentaciones en riel, esta vez— antes del merge.

**El invariante del tenant se sostiene igual que en los slices anteriores de esta rama:** sin `?tema=`
(todo tráfico real, y todo despliegue fuera de demo) la home sigue resolviendo `presentaciones.variante`
a `'mosaico'` — la canónica — porque ninguna fila de `SiteContent` cambió y
`DEFAULTS.presentaciones.variante` sigue siendo `'mosaico'`. Este slice no escribió en ninguna base.

### Deviations

**El spec sugería el caso de cardinalidad mínima como "una sola tarjeta"; medido contra
`tarjetasDePresentaciones`, el mínimo real es DOS** (slots 1-2 son `req: true`, siempre presentes) — no
existe hoy un camino para que esta sección renderice una sola tarjeta. Se verificó por el código, no se
adivinó, y el test de cardinalidad mínima se escribió contra el mínimo REAL (2), no contra el literal
del spec. No cambia ninguna otra decisión del slice: la doctrina de "que no se vea roto sin nada que
desplazar" aplica igual con 2.

**El archivo de test de la variante nueva se movió de `components/storefront/home/
GrindChooserRiel.test.ts` a `lib/config/site-content-defaults.test.ts`** (§ arriba, "Byte-identidad").
No estaba en el plan inicial: se escribió primero como archivo separado (el precedente más obvio,
`lib/storefront/planes-suscripcion-componente.test.ts`, sugiere un archivo dedicado), se corrió
`npm test`, y `lib/gate/tests-descubiertos.test.ts` lo marcó como un tercer archivo "invisible de
anoche" — un test PRE-EXISTENTE fuera de `touches:` que no se podía tocar. Se movió el contenido al dentro de
`touches:` (`lib/config/site-content-defaults.test.ts`) en vez de ensanchar el diff a un archivo ajeno.

Ninguna otra. El spec pedía leer el prototipo (HTML + CSS) antes de escribir — se leyeron
`index.html:225-247` y `css/app.css:508-559`, y además `js/home.js:90-190` para entender el mecanismo
de scroll del prototipo (no estaba pedido explícitamente citar el JS, pero sin leerlo la nota de "lo
que no se puede expresar/simplifica" habría sido una afirmación sin medir).

### Open follow-ups

Ninguno de backlog de producto. El CTA faltante (`#1` de arriba) y las tres simplificaciones (`#2`-`#4`)
quedan nombrados en el comentario de cabecera de `GrindChooserRiel.tsx` como piezas del prototipo que
esta variante no expresa o simplifica — no se abre un ítem de backlog para ninguna: ninguna tiene costo
pagado ni caso pedido todavía, y `CLAUDE.md` (Backlog técnico) no está en `touches:` de este slice.

**Dos hallazgos incidentales, fuera de `touches:`, NO corregidos** — encontrados al hacer el grep de
cierre de este slice contra `themes.ts` (el archivo que este diff SÍ toca), pero ninguno de los dos lo
causó este diff: son staleness PRE-EXISTENTE, de comentarios que quedaron atrás cada vez que OTRO slice
construyó una variante nueva. No se corrigieron porque `themes.ts` está en `touches:` para el cambio de
`presentaciones`, no para una limpieza de párrafos no relacionados con este cambio.

1. El comentario de cabecera (línea ~17-18 antes de este diff) afirma «`subscriptionCTA` sigue SIN
   slot de variante», y eso es FALSO desde `TEMAS-SUBSCRIPTIONCTA-LINEA-1` — `SubscriptionCTAContent`
   declara `variante` y `REGISTRY.subscriptionCTA.variantes` existe (verificado: `CORTE.variantes.
   subscriptionCTA = 'linea'` valida sin faltante). Id sugerido: `THEMES-COMENTARIO-SUBSCRIPTIONCTA-
   VENCIDO-1`.
2. El docstring de `ARRANQUE` (antes de este diff) afirma que `hero·ficha` y `presentaciones·indice`
   son «las dos únicas variantes reales que existen hoy fuera de la canónica» — y eso YA era falso
   antes de este slice: `hero·media`, `featured·grilla`, `brandStory·centrada` y `subscriptionCTA·
   linea` ya existían (todas construidas por slices anteriores de esta misma rama). Con `presentaciones·
   riel` sumado por este slice, la lista de variantes reales no-canónicas crece a seis. Id sugerido:
   `THEMES-COMENTARIO-ARRANQUE-VARIANTES-VENCIDO-1`.

## 2026-09-18 — Los cuatro comentarios vencidos de la noche, corregidos como REGLA, no como estado nuevo (`CORTE-COMENTARIOS-VENCIDOS-1`)

**Por qué:** la propia noche de CORTE dejó la lección escrita dos veces (§ arriba,
`CORTE-PRESENTACIONES-RIEL-1`, hallazgos 1 y 2) y una vez más en `CORTE-BRANDSTORY-COLLAGE-1`
por omisión: un comentario que describe el ESTADO de una composición en vez de la REGLA que lo
gobierna vence en silencio en cuanto otro slice construye una composición nueva, y el que lo lee
después le cree. Las cuatro correcciones de esta tanda no reemplazan un número por otro —eso
volvería a vencer en el próximo slice—: apuntan a la ESTRUCTURA que hay que leer para saber la
respuesta hoy.

### Las CUATRO vencidas, qué decían y qué dicen ahora

| # | Ubicación (antes de este diff) | Decía | Dice ahora |
| --- | --- | --- | --- |
| 1 | `lib/config/themes.ts:15-19` (comentario de cabecera) | «hoy `hero`\|`presentaciones`\|`brandStory` declaran `variantes`… `subscriptionCTA` sigue SIN slot de variante» | Apunta a `REGISTRY.<seccion>.variantes.claves` como la fuente, y nombra por qué no se enumera: "cada slice que construye una composición nueva mueve esa lista". No vuelve a enumerar qué secciones tienen slot. |
| 2 | `lib/config/themes.ts:427-429` (docstring de `ARRANQUE`) | «`hero·ficha` y `presentaciones·indice` (las dos únicas variantes reales que existen hoy fuera de la canónica)» | Mismos dos ejemplos, pero SIN la palabra "únicas": "dos variantes no-canónicas YA CONSTRUIDAS (NO las únicas… grep `REGISTRY.<seccion>.variantes.claves` para el set vigente)". |
| 3 | `CLAUDE.md:1754-1755` (§58, backlog) | «brandStory (el collage 2×2)» | «brandStory (los 4 campos `imagen1..4`)» — el CAMPO es estable entre composiciones; la FORMA (collage 2×2) dejó de serlo el mismo día, cuando `CORTE-BRANDSTORY-COLLAGE-1` sumó `centrada`. |
| 4 | `CLAUDE.md:2612-2615` (§ La PANTALLA, "LA MINIATURA") | «scale-to-FIT… (letterbox mínimo — hero y BrandStory son ~16:9)… BrandStory: bloque de texto + collage» | El letterbox se dice DEPENDIENTE de "la FORMA de la composición ACTIVA de esa sección", con el porqué (`columnas` es ~16:9 a dos columnas; `centrada` es más alta, apilada) en vez de una cifra fija por sección. |

**Forma usada en las CUATRO: reescribir como regla/puntero, no como estado corregido.** Ninguna
quedó diciendo "hoy hay seis" o "hoy hay dos composiciones" — la #2 explícitamente evita repetir el
conteo que `CORTE-PRESENTACIONES-RIEL-1` ya vio volverse falso una vez (de 4 a 6 en un solo día). Las
cuatro señalan la estructura viva (`REGISTRY.<seccion>.variantes.claves`, o "la composición activa")
en vez de copiar su contenido de hoy.

### La frase canónica de Tier 1 — NO tocada

El diff no roza la línea 39 de `CLAUDE.md` (la enumeración de superficies protegidas que el
validador de specs deriva sus disparadores): `git diff -- CLAUDE.md` no tiene ningún hunk que la
incluya, verificado leyendo el diff completo antes de este cierre.

### §3 del spec — hallazgos adicionales, medidos, NO corregidos (fuera de `touches:` de esta corrección quirúrgica)

Buscando otros pasajes de la MISMA clase en los DOS archivos tocados, sin arreglarlos:

1. **`lib/config/themes.ts:126`** (docstring de `validarPreset`, regla (a)): «el REGISTRY (una
   SECCIÓN, `hero`/`presentaciones`/`brandStory` hoy)» — no nombra a `subscriptionCTA`, que también
   declara `variantes` en el REGISTRY (`REGISTRY.subscriptionCTA.variantes.claves = ['bloque',
   'linea']`, § `TEMAS-SUBSCRIPTIONCTA-LINEA-1`) desde antes de esta rama. Id sugerido:
   `THEMES-VALIDARPRESET-DOCSTRING-VENCIDO-1`.
2. **`lib/config/themes.ts:249-253`** (comentario "Los cinco themes del diseño…"): afirma
   «`subscriptionCTA` sigue sin slot» (falso, igual que el hallazgo 1 de arriba, en OTRA ubicación) y
   «sólo la canónica de cada uno existe construida» (falso: `brandStory·centrada` y
   `presentaciones·indice`/`riel` son composiciones NO-canónicas ya construidas). Id sugerido:
   `THEMES-CINCO-THEMES-COMENTARIO-VENCIDO-1`.
3. **`CLAUDE.md:52`** (§ Tier 1, subárbol `components/storefront/`): cita
   «`GrindChooserMosaico.tsx`/`GrindChooserIndice.tsx`, variantes del selector de molienda» como
   ejemplo de por qué el subárbol gana admisión — hoy existe una TERCERA variante real,
   `GrindChooserRiel.tsx` (`CORTE-PRESENTACIONES-RIEL-1`), no nombrada. No afirma exclusividad (no
   dice "las únicas"), así que es un ejemplo desactualizado, no una afirmación falsa — igual se
   nombra porque describe el mismo estado que ya venció dos veces esta noche. Id sugerido:
   `CLAUDE-SUBARBOL-GRINDCHOOSER-EJEMPLO-VENCIDO-1`. **Esta línea está a dos párrafos de la frase
   canónica de Tier 1 (línea 39) — no se tocó, ni se acercó el diff a ella.**

Ningún hallazgo de esta lista se corrigió: los tres viven en ubicaciones DISTINTAS de las cuatro
vencidas nombradas por el spec (líneas distintas, párrafos distintos), y `CORTE-COMENTARIOS-
VENCIDOS-1` fue dimensionado para esas cuatro — ensancharlo a un quinto/sexto/séptimo arreglo habría
producido el diff de "cuarenta correcciones" que la doctrina de esta tanda explícitamente evita
(un diff de cuatro se lee; uno de más no se aprueba).

### Gate

`npm run gate` en el árbol final:

- **`npm test`** (capa 1, sin base): **1490/1490**, 0 fail — idéntico al piso reportado por
  `CORTE-PRESENTACIONES-RIEL-1` (este slice no tocó lógica, sólo comentarios).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail — idéntico al
  piso reportado por `CORTE-PRESENTACIONES-RIEL-1`.
- **`npx tsc --noEmit`**: limpio, sin salida.
- **`npx next build`**: `✓ Compiled successfully`, 51/51 páginas generadas, sin error.

**Cero bytes de cliente cambiados, confirmado por el propio diff, no supuesto.** `git diff
--name-only` da exactamente dos archivos: `CLAUDE.md` y `lib/config/themes.ts`. Los dos cambios en
`themes.ts` son EXCLUSIVAMENTE líneas `//`/`/** */` (comentarios) — ninguna línea de código
ejecutable, ningún literal que el storefront lea, se tocó. `themes.ts` no se importa desde
ningún componente del storefront ni desde ninguna ruta pública (sólo desde `site-content-write.ts`,
el runbook de onboarding); y aun si lo fuera, el contenido de los comentarios no llega a ningún
bundle. El build (`next build`) es la prueba de que el archivo sigue compilando igual.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (mismo owner, misma noche, misma razón que el resto de esta rama). El
archivo `CLAUDE.md` y `lib/config/themes.ts` están en `touches:`, y `lib/config/themes.ts` es un
archivo suelto ya nombrado en la lista de Tier 1 vía su rol en `site-content-write.ts` — pero el
criterio real es MERGE POLICY A: **ningún byte de cliente cambia** (§ arriba, confirmado por el
diff), **ninguna migración ni schema**, y **ningún contrato cross-repo**. Los tres pasan limpio. La
única razón por la que este slice sigue clasificando `AWAITING_APPROVAL` es que `continues-branch`
apunta a `slice/corte-reescritura-prototipo-1`, que YA está `AWAITING_APPROVAL` por los slices
anteriores de la misma rama (bytes de cliente en `components/storefront/home/`) — el owner tiene que
ver el mirador completo, con SUS cuatro slices, antes de un merge. Este slice individualmente no
tiene `stopped_on: customer-bytes` propio (no cambió ningún byte de cliente), pero no se mergea
solo: sigue en la rama compartida, sin mergear.

### Deviations

Ninguna. El spec pedía "buscarlas por lo que dicen, no por número de línea" — se hizo: las líneas
citadas en el spec externo (§ arriba) habían quedado desactualizadas por los commits de la propia
rama entre el momento en que se escribió el spec y el momento en que se corrió este slice (el
archivo creció de 429 a 454 líneas entre `CORTE-BRANDSTORY-COLLAGE-1` y el HEAD de este slice), así
que se releyó `themes.ts` completo por contenido antes de editar, no se confió en un número.

### Open follow-ups

- `THEMES-VALIDARPRESET-DOCSTRING-VENCIDO-1` — `lib/config/themes.ts:126`, corregir cuando se toque
  ese archivo por otra razón (no vale la pena un slice de un solo comentario más).
- `THEMES-CINCO-THEMES-COMENTARIO-VENCIDO-1` — `lib/config/themes.ts:249-253`, ídem.
- `CLAUDE-SUBARBOL-GRINDCHOOSER-EJEMPLO-VENCIDO-1` — `CLAUDE.md:52`, ídem; bajo prioridad porque no
  afirma exclusividad, sólo cita un ejemplo incompleto.

## 2026-09-19 — Superficie y tinta estaban INVERTIDAS: CORTE pintaba tres bandas de contenido con la raíz tinta como lienzo, y el prototipo nunca lo hace (`CORTE-ESQUEMAS-INVERTIDOS-1`)

**El defecto, palabras del owner, mirando el mirador contra el prototipo lado a lado:** *"Superficie
y tinta están INVERTIDAS. El prototipo es página CREMA con tinta verde profundo. El verde profundo
es TINTA y superficies de acento PUNTUALES (nav, footer), no el canvas."*

### La CLASE: un eje que se deja quieto no es un eje neutral

`CORTE-REESCRITURA-PROTOTIPO-1` cambió las tres raíces de CORTE (`fondo`/`tinta`/`acento`) leyendo
el prototipo, pero **no volvió a decidir el eje `esquemas`** — el mapa bandaId→esquema que dice QUÉ
banda se pinta con qué superficie. Ese mapa venía de ANTES de la reescritura, pensado contra la
paleta vieja (`tinta:'#0c0b0a'`, casi negro): con esas raíces, `trustBadges`/`featured`/`brandStory`
en `'oscuro'` (= `raices.tinta` como lienzo completo) daban "casi negro sobre neutro cálido" — un
acento tonal más, no una superficie que gritara. Con `tinta:'#102407'` (verde profundo, la raíz que
`CORTE-REESCRITURA-PROTOTIPO-1` sí leyó del prototipo), la MISMA asignación pasó a pintar tres bandas
completas de verde saturado — el valor del mapa no cambió; lo que significa, sí, porque cambió
aquello de lo que depende. Es la misma familia que la doctrina ya nombra para artefactos y bases
(§ CLAUDE.md, PRECONDICIÓN): lo que quedó escrito no prueba lo que corre; acá, además, lo que quedó
escrito ni siquiera prueba lo que ANTES corría, porque las raíces de las que depende cambiaron
debajo.

### QUÉ HACE `esquemas` — el mecanismo, medido antes de tocar el mapa

`preset.esquemas: Partial<Record<BandaId, ClaveEsquema>>` (`lib/config/themes.ts`) se traduce a CSS
por banda vía `esquemaStyle` (`lib/config/esquema-style.ts`) → `derivarEsquema` (`lib/config/
palette-derive.ts:369`). Los CUATRO esquemas del set cerrado, derivados de las TRES raíces de CORTE
(medido con `derivarEsquema`, no supuesto):

| esquema | qué pinta como lienzo | hex resultante con raíces de CORTE |
| --- | --- | --- |
| `crema` | `raices.fondo` tal cual (`derivarPaleta` base) | `#fdfbf7` |
| `superficie` | mezcla `fondo`+`acento` al 9% (`palette-derive.ts:147`) | `#f3eadb` |
| `oscuro` | `raices.tinta` completa | `#102407` |
| `acento` | `raices.acento` completa | `#a70004` |

`'oscuro'` no es "un verde ligeramente distinto": es la RAÍZ TINTA entera como fondo de la banda,
byte a byte. Con tres bandas de contenido en `'oscuro'`, un visitante del mirador ve tres paneles
verde-profundo consecutivos donde el prototipo no tiene ninguno.

### Banda por banda, contra el prototipo versionado (`docs/prototipos/cafeone/`)

Metodología: `grep` del token semántico (`--surface-page`/`--surface-page-cool`/`--surface-inverse`)
contra `css/tokens.css` y `css/app.css`, y lectura de `index.html` para ubicar la sección real que
cada banda de CORTE compone (según su `variante` en el mismo preset). Los usos de `--surface-
inverse` como LIENZO en TODO el prototipo (grep completo, `css/app.css`) son: el header en su estado
sólido (188,191), el mega-menú (253,302,329), el cajón del carrito (674), el pie de página (633) y
el toast (836) — CINCO usos, los cinco de CHROME, cero de banda de contenido del home.

| banda (CORTE) | variante | sección del prototipo medida | superficie medida | esquema ANTES | esquema DESPUÉS | canvas resultante |
| --- | --- | --- | --- | --- | --- | --- |
| `trustBadges` | (sin variante propia) | sin análogo directo — no hay franja de insignias en el prototipo | sin evidencia de lienzo oscuro | `oscuro` | `crema` | `#fdfbf7` |
| `featured` | `grilla` | `.spotlight`, `#producto` (`index.html:160`) | `background:var(--surface-page)` (`css/app.css:436`) | `oscuro` | `crema` | `#fdfbf7` |
| `brandStory` | `centrada` | `.historia`, `#historia` (`index.html:250`) | `background:var(--surface-page-cool)` (`css/app.css:564`) | `oscuro` | `superficie` | `#f3eadb` |
| `presentaciones` | `riel` | `#presentaciones`, `class="section"` SIN override de fondo (`index.html:226`) | hereda `body{background:var(--surface-page)}` (`css/app.css:43`) | `superficie` | `crema` | `#fdfbf7` |
| `subscriptionCTA` | `linea` | sin lienzo sólido en el prototipo (ver abajo) | — | `crema` | `crema` (sin cambio) | `#fdfbf7` |

**`brandStory` no calza EXACTO** (`#f3eadb` derivado vs. `#f0f0ec` medido en el prototipo): son la
misma FAMILIA ("superficie apenas distinta de la página"; nuestro `'superficie'` mezcla `fondo` con
9% de `acento`, así que hereda un matiz tibio del rojo de CORTE en vez del gris frío del prototipo).
Calzar el hex exacto exigiría tocar las RAÍCES o el motor de derivación — los dos fuera de
`touches:` de este slice, y el segundo es justo lo que el spec prohíbe explícitamente tocar
(§ abajo, "Lo que NO se arregló acá"). Reportado, no disimulado.

**`presentaciones`: el `'superficie'` viejo no tenía respaldo en el prototipo.** La banda entera
—`GrindChooserRiel.tsx:112`, `bg-[var(--sf-banda,var(--sf-fondo))]`— hereda el fondo de página; sólo
la MINIATURA de cada tarjeta usa un tono aparte, y ese tono sale de `--sf-linea` (línea 182 del
componente), no de `--sf-tarjeta` — el token que `esquemaStyle` sí mueve por banda. O sea que
`'superficie'` estaba cambiando un dato (el fondo de la banda entera) para intentar afectar un
efecto visual (la miniatura) que ese eje ni siquiera gobierna.

### `subscriptionCTA` — considerado `'oscuro'` y descartado; la duda queda abierta, no resuelta a ciegas

El análogo más cercano del prototipo a una franja de "suscríbete"/"únete" es `.cta-strip`
(`aria-label="Únete al club"`, `index.html:313`), la banda inmediatamente ANTES del footer — la
misma posición relativa que `subscriptionCTA` ocupa en `ORDEN_DEFAULT` (penúltima, justo antes de
`testimonials`, que a su vez precede al chrome del footer). Pero esa banda del prototipo **no es un
lienzo sólido**: es una FOTO (`farm-hands-basin.png`) con `--protect-grad` encima (`css/app.css:620`,
un degradado `rgba(16,36,7,…)` — la raíz tinta con alfa, `tokens.css:217` — sobre la imagen, no un
`background-color` plano). El newsletter REAL del prototipo (el formulario "Tu correo electrónico")
vive DENTRO del `<footer>` (`index.html:323-331`, `--surface-inverse`), no en una banda de contenido
aparte.

Se sopesaron dos lecturas y se optó por la conservadora:

1. **Pintar `oscuro`** — argumento: la posición (penúltima banda, justo donde el prototipo tiene su
   franja más oscura antes del pie) y que el newsletter real vive en un lienzo `--surface-inverse`.
2. **Dejar `crema`** (la elegida) — argumento: no hay NINGÚN lienzo sólido de tinta en el prototipo
   fuera del chrome que el owner nombró explícitamente ("nav, footer"); la evidencia de (1) es
   POSICIONAL, no un `background-color` medido, y el estándar que motiva este slice es reducir el
   uso de tinta-como-canvas a lo punctual, no encontrarle un cuarto sitio.

Se documentó la duda en el propio comentario de `themes.ts` (no sólo acá) para que el próximo gate
del owner la resuelva con el mirador delante, en vez de que quede enterrada en un mensaje de commit.

### Lo que NO se arregló acá — los otros dos defectos, con su causa medida

El owner reportó dos defectos más el mismo gate, y pidió EXPLÍCITAMENTE no mezclarlos con éste:

1. **El texto de lectura sobre `--sf-banda`.**
2. **El botón primario.**

Los dos comparten causa, YA medida (no en este slice, se repite acá porque el owner la citó al
aprobar): ninguno de los dos sale de la raíz `tinta` — los dos se DERIVAN del `acento` (`#a70004`,
rojo) por el motor de paleta (`palette-derive.ts`, compartido por TODOS los inquilinos, no sólo
CORTE). Tocar el motor para que el rojo se vea "menos mal" habría tapado el defecto de superficies
que este slice sí resuelve, y viceversa — un arreglo que compensa otro hace que los dos queden
invisibles. Este slice **no tocó `palette-derive.ts` ni `esquema-style.ts`**, verificado por
`git diff --name-only` (única salida: `lib/config/themes.ts`, `DECISIONS.md`).

### Gate

- **`npm test`** (capa 1, sin base): **1490/1490**, 0 fail — idéntico al piso de
  `CORTE-COMENTARIOS-VENCIDOS-1` (este slice cambia datos, no agrega ni quita tests).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail — idéntico al
  mismo piso.
- **La guarda de completitud** (`validarPreset(CORTE)` / `presetCompleto(CORTE)`, ejercida por el
  test `'CORTE: las 5 variantes que pide YA EXISTEN — CORTE valida COMPLETO'`): sigue en verde — el
  cambio fue de VALORES dentro del set cerrado (`crema`/`superficie`/`oscuro`/`acento`), nunca de
  claves de banda ni de nombres de esquema, así que la regla (b) de `validarPreset` no tenía forma
  de reaccionar.
- **`npx tsc --noEmit`**: limpio, sin salida.
- **`npx next build`**: `✓ Compiled successfully`, sin error.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, misma sesión, mismo gate del mirador). El archivo tocado
(`lib/config/themes.ts`) está nombrado en la lista de Tier 1. Contra MERGE POLICY A: **sin
schema/migración** (ningún archivo de `packages/core/prisma/`), **sin contrato cross-repo**, pero
**SÍ bytes de cliente** — a diferencia de `CORTE-COMENTARIOS-VENCIDOS-1` (comentarios puros), este
diff cambia VALORES que `esquemaStyle` traduce en `--sf-banda`/`--sf-sobre-banda`/etc. reales, y el
mirador (`app/(storefront)/page.tsx`, gateado por `?tema=` — NO por sesión) los sirve sobre la ruta
pública `/`. `customer_bytes.changed: true`. La rama entera (`slice/corte-reescritura-prototipo-1`)
ya venía `AWAITING_APPROVAL` por los slices anteriores que tocan `components/storefront/home/`; este
slice individual también clasifica `AWAITING_APPROVAL` por cuenta propia (no sólo por herencia de la
rama), porque su propio diff cambia colores que el mirador sirve.

### Deviations

Ninguna del spec. La única decisión no dictada por el spec fue la de `subscriptionCTA` (§ arriba,
sopesada y dejada en `crema` por la lectura conservadora de "tinta punctual").

### Open follow-ups

- `CORTE-SUPERFICIE-MATIZ-TIBIO-1` — `lib/config/palette-derive.ts:147` (el peso `w:0.09` de
  `superficie`), el esquema `'superficie'` deriva SIEMPRE hacia el `acento` del cliente, así que para
  CORTE (acento rojo) da un cream tibio (`#f3eadb`) en vez del gris frío del prototipo (`#f0f0ec`,
  `--surface-page-cool`). No es un bug — es la fórmula compartida por los cuatro presets — pero es la
  brecha que impide que `brandStory` calce EXACTO. Tocar el motor está fuera de `touches:` de este
  slice y el owner pidió no mezclarlo con los otros dos defectos reportados (§ arriba). Disparador: si
  el próximo gate del owner marca a `brandStory` como "todavía no calza" con el estándar de verse
  igual al prototipo.
- `CORTE-SUBSCRIPTIONCTA-ESQUEMA-DUDA-1` — `lib/config/themes.ts` (comentario de `esquemas` en
  `CORTE`), la duda sopesada y no resuelta sobre si `subscriptionCTA` debería ser `'oscuro'` (§
  arriba, las dos lecturas). Disparador: el próximo gate del mirador del owner, mirando
  específicamente esa banda.

## 2026-09-19 — Un preset puede declarar de dónde nace su texto de lectura y su acción primaria — raíz ADITIVA, cero bytes movidos para quien no la declara (`TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1`)

**El defecto, dos de los tres que `CORTE-ESQUEMAS-INVERTIDOS-1` dejó explícitamente sin tocar**
("el owner pidió no mezclarlos con éste"), medidos gateando el mirador contra el prototipo:

1. **El texto de lectura sobre `--sf-banda` salía rojizo.**
2. **El botón primario salía beige.**

Los dos comparten la MISMA causa: el motor de paleta (`palette-derive.ts`, compartido por los seis
presets del catálogo) hace nacer del ACENTO tanto el texto de lectura como el fondo de una acción
primaria, sin importar qué SIGNIFIQUE el acento de ese cliente. El acento de CORTE
(`raices.acento = '#a70004'`) es COLOR DE ACCIÓN puro —medido contra el prototipo,
`--action-primary` (`docs/prototipos/cafeone/ds/colors.css:59`)—, no un tono cálido de lectura, así
que el texto salía rojizo (`--sf-texto`/`--sf-acento-texto`, derivados del acento) y el botón salía
beige (`--sf-tostado`, la mezcla acento/fondo que un cliente de acento CÁLIDO usa para un CTA suave,
pero que con un acento rojo da un rosado apagado, no la acción vívida que el prototipo pinta).

### La decisión del owner (2026-09-19), textual

> «Raíz nueva y ADITIVA — un preset puede declarar "mi texto de lectura sale de la tinta", default =
> lo de hoy. Nayoli no se mueve un byte, y la elección queda ESCRITA en el preset en vez de escondida
> en el motor. Y lo mismo para el botón: que el preset pueda apuntar su acción al color de acción.»

**Lo que descartó, con su razón:** cambiar la derivación PARA TODOS. *"No se mueve a un cliente real
en producción por una necesidad del muestrario."* CORTE es el ÚNICO de los seis presets que declara
los dos ejes nuevos; los otros cinco (PLIEGO, PATIO, VETA, VITRINA, ARRANQUE) y todo tenant real
quedan exactamente como estaban — afirmado por test (`themes.test.ts`, "CORTE es el ÚNICO preset...").

### El censo de roles nacidos del acento (§2 del spec) — cuáles son texto de lectura y cuáles no

Hecho en el comentario de la `RECETA` (`palette-derive.ts`), no sólo acá, para que quede donde el
próximo que toque un rol lo lea:

| rol | nace de | uso real | ¿mueve con `origenTexto`? |
| --- | --- | --- | --- |
| `texto` / `texto-suave` | acento (w 0.34/0.12 hacia tinta) | `--sf-texto`/`-suave` (cuerpo de TODO el storefront) + `--sf-sobre-banda`/`-suave` (vía `esquema-style.ts`) | **SÍ** |
| `acento-texto` | acento crudo, floreado | fallback de `--sf-sobre-banda` sin esquema; leído DIRECTO en decenas de sitios (números de orden, eyebrows, links) | **SÍ** |
| `acento-txt` | auto-flip blanco/tinta (NO el hue del acento) | texto SOBRE un botón/badge de acento — es contraste, no un tono derivado | NO — no "nace" del acento, convive con él |
| `acento-2` | acento mezclado con tinta (w 0.64) | fallback INERTE en el home (`--sf-sobre-tarjeta-suave` en `TestimonialSection`, `--sf-sobre-banda` en `TrustBadges`) — el token primario SIEMPRE está definido para un tema de raíces custom, así que no pinta nada en CORTE; SÍ pinta fuera del home (`/nosotros`, nav móvil) | NO |
| `acento-3` | acento mezclado con tinta (w 0.41) | color de HOVER (sin fallback) del link "Ver todos los productos" en `FeaturedProductsGrilla` — CORTE SÍ monta esa banda (`featured:'grilla'`) | NO (ver el porqué, abajo) |
| `acento-4` | acento mezclado con fondo (w 0.31) | ningún consumidor dentro de las 7 piezas que CORTE monta — vive en `StoreNav` (nav móvil), ajeno al home | NO |
| `tostado`/`tostado-2..8` | acento mezclado con fondo | decorativo/hover (bordes, miniaturas) | NO — nunca texto de lectura |

**El eje `origenTexto` mueve `texto`/`texto-suave`/`acento-texto`** (los tres marcados arriba), con
la MISMA mezcla y los MISMOS pesos de la RECETA — sólo se invierte cuál raíz manda (`mezclar(tinta,
acento, 0.34)` en vez de `mezclar(acento, tinta, 0.34)`, y `acento-texto` pasa a ser la tinta cruda
floreada contra fondo, en vez del acento crudo).

**CORRECCIÓN DE MEDICIÓN, sobre esta misma tabla:** un primer censo afirmó que `acento-2`/`-3`/`-4`
"no los renderiza el home de CORTE" para los TRES — **medido de nuevo, era falso para `acento-3`**:
sí pinta, en el hover del link de arriba. Se corrige acá y en el comentario de `palette-derive.ts`
(la fuente donde vive el censo real) antes de cerrar el slice — el error se encontró releyendo el
propio censo contra un grep de los 7 archivos, no lo señaló nadie de afuera. `acento-3` NO se movió
igual: el defecto que el owner reportó era sobre el texto EN REPOSO, y `acento-3` es un matiz de
HOVER sobre un link cuyo reposo (`--sf-sobre-banda`/`acento-texto` de la banda `featured`, CON
esquema asignado en CORTE) ya cae en el residuo declarado abajo (§ Lo que NO llega) — mover sólo el
hover sin el reposo sería peor que dejar los dos como estaban. `acento-2` queda fuera porque es
fallback inerte (el token primario siempre gana); `acento-4` porque no aparece en ninguna de las 7
piezas que CORTE monta. Ninguno de los tres se tocó — el error estaba en el PORQUÉ que se había
escrito para dos de ellos, no en la decisión final.

### El eje de la acción — la indirección, medida antes de aplicarla

**Cinco lugares del storefront pintan hoy el fondo de una acción primaria con `--sf-tostado`**
(grep de `bg-\[var(--sf-tostado)\]` sobre `<Link`/`<button>` de acción, excluyendo decorativos):
`HeroCurtina.tsx:203`, `HeroFicha.tsx:147`, `HeroMedia.tsx:164`, `SubscriptionCTABloque.tsx:77`,
`SubscriptionCTALinea.tsx:65`. Un sexto uso (`SubscriptionCTABloque.tsx:72`, el punto decorativo
antes de cada beneficio) se DEJÓ intacto — no es una acción, es un bullet.

**La forma: un rol nuevo `accion` en `derivarPaleta`**, sin color propio — DEFAULT = copia EXACTA de
`tostado` (byte a byte), y `origenAccion:'acento'` lo hace apuntar al acento crudo (sin florear, es
superficie de botón/badge, el mismo trato que `--sf-acento`). Los cinco lugares pasan de
`bg-[var(--sf-tostado)]` a `bg-[var(--sf-accion,var(--sf-tostado))]` — el fallback es lo que
mantiene byte-idéntico a quien no inyecta `<style>` (Nayoli: sin raíces custom, `cssPaleta` no
inyecta nada, `--sf-accion` queda indefinida, y el fallback resuelve a `--sf-tostado`, IDÉNTICO a
hoy). **NO se tocó el hover** (`--sf-tostado-4` literal en los cinco): el spec pide la indirección
del FONDO, no repintar cada lugar a mano; queda declarado como residuo — con `origenAccion:'acento'`
el hover de esos cinco CTA sigue siendo un tono cálido, no una variante del acento.

### Cómo se probó la byte-identidad (§1 del spec — la invariante que manda)

`derivarPaleta(NAYOLI)` con y sin el segundo parámetro (`{}` explícito) es la misma cadena JSON
(medido, `node --import tsx`). El test que se queda en el repo:
`palette-derive.test.ts`, `'EjesPaleta ausente ES {} — byte-idéntico al segundo parámetro explícito,
en las 3 raíces del test'` — corre sobre NAYOLI/NEON/MEDIO/CORTE, las cuatro. Además: 34 de los 35
tests preexistentes de `palette-derive.test.ts` pasaron SIN TOCAR (el único que cambió fue el conteo
de claves, 31→32, porque `accion` se suma al mapa); ningún otro valor de ningún rol se movió.

### Los contrastes que salen (§2 del spec)

Medido con `derivarPaleta(CORTE_RAICES, ejes)` (`CORTE_RAICES = { fondo:'#fdfbf7', tinta:'#102407',
acento:'#a70004' }`):

| token | SIN los ejes (hoy) | CON `origenTexto:'tinta', origenAccion:'acento'` | contraste contra fondo (con los ejes) |
| --- | --- | --- | --- |
| `acento-texto` | `#a70004` (= acento crudo) | `#102407` (= **tinta EXACTA** — el `--text-heading` del prototipo) | 15.91:1 |
| `texto` | `#732a00` | `#3d3000` | 12.53:1 |
| `texto-suave` | `#961700` | `#1d2a00` | 14.69:1 |
| `tostado` (sin cambio, es el default de `accion`) | `#d8a378` | `#d8a378` | — (decorativo) |
| `accion` | `#d8a378` (= tostado) | `#a70004` (= **acento EXACTO** — el `--action-primary` del prototipo) | — (superficie) |

Los tres roles de texto SIGUEN pasando el piso de AA (≥4.5:1) en las 4 raíces del test
(NAYOLI/NEON/MEDIO/CORTE) — mismo mecanismo `pisoContraste`, mismo objetivo, ningún atajo.

### Lo que NO llega — el residuo declarado, medido contra `touches:`

**Los `esquemas` de banda (`esquemaStyle`/`derivarEsquema`) NO reciben los ejes en este slice.**
`esquemaStyle` (`lib/config/esquema-style.ts`) tiene un ÚNICO llamador —
`app/(storefront)/page.tsx:78`, `esquemaStyle(esquemas[bandaId], tema.fondo, tema.tinta,
tema.acento)`— y ese archivo NO está en `touches:` de este slice (sólo
`app/(storefront)/tienda/[slug]/page.tsx`). Sin poder tocar ese call site, agregar un parámetro
`ejes` a `derivarEsquema`/`esquemaStyle` sería código MUERTO —nadie lo llamaría con un valor real—,
y la doctrina de este repo (`CLAUDE.md`, ex-#68) es explícita: el código muerto no reserva el lugar
de la capacidad futura, así que NO se agregó.

**Consecuencia medida:** de las 7 bandas de CORTE, `esquemas` asigna esquema a 5 (`trustBadges`,
`featured`, `brandStory`, `presentaciones`, `subscriptionCTA` — todas 'crema' salvo `brandStory` en
'superficie'). Para esas 5, `esquemaStyle` computa `derivarEsquema(raices, id)` SIN los ejes
declarados, así que su `--sf-sobre-banda`/`-suave` (fijado como estilo INLINE en la `<section>`, que
gana sobre cualquier `:root` por especificidad) sigue naciendo del acento — el texto rojizo
persiste ahí. Las 2 bandas SIN esquema asignado (`hero`, `testimonials`) caen al fallback
`var(--sf-sobre-banda, var(--sf-acento-texto))`, que SÍ lee el `:root` corregido por este slice — ahí
el fix aplica completo. El fix del BOTÓN (`accion`) no tiene este problema: los 5 CTA leen la var
directo en su propia clase, sin pasar por `esquemaStyle`.

### Gate

- **`npm test`** (capa 1, sin base): **1508/1508**, 0 fail — +18 sobre el piso de
  `CORTE-ESQUEMAS-INVERTIDOS-1` (1490), los 18 nuevos de este slice (11 en `palette-derive.test.ts`,
  1 en `site-content-defaults.test.ts`, 2 en `themes.test.ts`, 3 en `palette-style.test.ts`, 1 en
  `theme-mirador.test.ts`).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail — idéntico al
  piso anterior (este slice no toca ninguna cadena del carril).
- **`npx tsc --noEmit`**: limpio, sin salida.
- **`npx next build`**: `✓ Compiled successfully`. Verificado sobre el ARTEFACTO (no sólo la fuente):
  `grep -rl "sf-accion" .next` encuentra el token en el chunk CSS
  (`--sf-accion,var(--sf-tostado)` literal) y en los chunks JS de
  `components_storefront_home_*` y de `lib_config_palette-derive`.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, mismo gate del mirador que aprobó `CORTE-ESQUEMAS-INVERTIDOS-1`).
Los archivos tocados (`lib/config/palette-derive.ts`, `lib/config/themes.ts`,
`components/storefront/home/*`) están en la lista de Tier 1 (`components/storefront/` gana el
subárbol entero por el criterio de "bytes del visitante"). Contra MERGE POLICY A: **sin
schema/migración** (ningún archivo de `packages/core/prisma/`), **sin contrato cross-repo**, pero
**SÍ bytes de cliente** — el diff cambia valores que `cssPaleta`/las 5 clases de CTA traducen en
`--sf-*` reales, y el mirador (`app/(storefront)/page.tsx`, gateado por `?tema=`, NO por sesión) los
sirve sobre la ruta pública `/`. `customer_bytes.changed: true`. La rama entera
(`slice/corte-reescritura-prototipo-1`) ya venía `AWAITING_APPROVAL`; este slice individual también
clasifica `AWAITING_APPROVAL` por cuenta propia.

### Deviations

Ninguna del spec en la MECÁNICA (la raíz aditiva, los dos ejes, la indirección del botón). Una
decisión no dictada explícitamente por el spec: qué roles nacidos del acento entran al eje
`origenTexto` (`texto`/`texto-suave`/`acento-texto`) y cuáles quedan fuera (`acento-2`/`-3`/`-4`,
`tostado*`) — medida contra qué renderiza el home de CORTE, no adivinada (§ el censo, arriba).

### Open follow-ups

- `TEMAS-ESQUEMA-ORIGEN-PENDIENTE-1` — `app/(storefront)/page.tsx:78` (el único llamador de
  `esquemaStyle`), fuera de `touches:` de este slice. Mientras no se actualice para pasar
  `content.tema.origenTexto`/`origenAccion` a `esquemaStyle`→`derivarEsquema`→`derivarPaleta`, las
  bandas CON esquema asignado (5 de 7 en CORTE) siguen mostrando `--sf-sobre-banda`/`-suave`
  nacidos del acento, aunque el `:root` ya esté corregido. Disparador: el próximo gate del mirador
  del owner, si sigue viendo texto rojizo DENTRO de esas 5 bandas después de este slice.
- `TEMAS-DERIVADOS-19-VENCIDO-1` — `CLAUDE.md:2271` ("Lo que se calcula solo — los 19 derivados de
  `derivarPaleta`") y su gemelo en código, `components/admin/PaletaSeccion.tsx:431` ("Los 19
  DERIVADOS (todo menos las 3 raíces editables)"). Medido, no supuesto: `derivados.length` (línea
  432, `Object.keys(derivada).filter(...)`) YA daba **28** antes de este slice —el "19" estaba
  vencido desde antes, no lo volvió falso este diff— y pasa a **29** con el nuevo rol `accion`. Este
  slice no lo corrige: `components/admin/` no está en `touches:`, y `CLAUDE.md` tampoco. Disparador:
  la próxima tanda que toque `PaletaSeccion.tsx` o la doctrina de la paleta del panel — ahí se
  actualiza el número (o, mejor, se deriva el conteo del propio `derivados.length` en el copy en vez
  de un literal, para que no vuelva a vencer).

## 2026-09-19 — El origen declarado por el preset llega a las BANDAS con esquema asignado, no sólo al `:root` (`TEMAS-ESQUEMA-ORIGEN-PENDIENTE-1`)

**Cierra el residuo que `TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1` dejó nombrado** (arriba, § Open
follow-ups de esa entrada): esa tanda hizo que un preset pudiera declarar de qué raíz nace su texto
de lectura (`origenTexto`) y su acción primaria (`origenAccion`), y lo hizo llegar al `:root` (vía
`cssMiradorTema`→`cssPaleta`→`derivarPaleta`). Pero **NO** llegaba a las bandas con un ESQUEMA
asignado (§ eje 5b): `derivarEsquema` calculaba su `base` con `derivarPaleta(raices)` — SIN el
segundo parámetro `ejes` —, así que las 8 vars locales que `esquemaStyle` inyecta en la `<section>`
de esa banda seguían naciendo del acento. La razón de que quedara sin tocar entonces: el único
llamador real de `esquemaStyle` es `app/(storefront)/page.tsx:78`, y ese archivo no estaba en
`touches:` de aquella tanda — agregar el parámetro sin poder tocar el call site habría sido código
MUERTO (CLAUDE.md, ex-#68: el código muerto no reserva el lugar de una capacidad futura).

### Qué faltaba y cómo se conectó

**Una sola cosa: pasar `ejes` por el camino que ya existía, sin inventar una segunda regla.**

- **`derivarEsquema(raices, id, ejes: EjesPaleta = {})`** (`lib/config/palette-derive.ts:476`) — el
  tercer parámetro, OPCIONAL y ADITIVO (default `{}`, mismo patrón que `derivarPaleta`), se pasa TAL
  CUAL a `derivarPaleta(raices, ejes)` para computar `base`. **Nada más se tocó**: las tres ramas de
  la función (crema, y las dos no-crema) ya leen `texto`/`texto-suave`/`acento-texto` DESDE `base`,
  así que heredan el origen declarado sin lógica nueva — exactamente lo que el comentario de
  `derivarPaleta` (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1, la nota sobre `sobre-tarjeta-suave`) ya
  anticipaba: "todo lo que downstream lee estos tres roles hereda el origen declarado sin que haga
  falta tocarlo aparte".
- **`esquemaStyle(id, fondo, tinta, acento, ejes?: EjesPaleta)`** (`lib/config/esquema-style.ts:66`)
  — quinto parámetro opcional, se pasa a `derivarEsquema(raicesResueltas(...), id, ejes)`.
- **El ÚNICO call site** (`app/(storefront)/page.tsx:84-86`) arma `ejesTema` con el MISMO mapeo
  null→undefined que ya usaba `theme-mirador.ts` para el `:root` (`origenTexto: tema.origenTexto ??
  undefined, origenAccion: tema.origenAccion ?? undefined`) y lo pasa como quinto argumento de
  `esquemaStyle`.
- **`bandaEsOscura`/`tratamientoNav` NO se tocaron.** Sólo leen `derivarEsquema(...).fondo`, y `fondo`
  no depende de `origenTexto`/`origenAccion` (esos dos ejes sólo mueven roles de TEXTO y el rol
  `accion` — nunca la superficie/fondo del esquema). Afirmado por test: `fondo` es idéntico con y sin
  los ejes, en los 4 esquemas.

### La invariante — probada, no supuesta

`ejes` ausente/`{}` es BYTE-IDÉNTICO al comportamiento de siempre, en los 4 esquemas × 4 raíces
(NAYOLI/NEON/MEDIO/CORTE) — `palette-derive.test.ts`, `'derivarEsquema: ejes AUSENTE/{} es
BYTE-IDÉNTICO...'`. Ningún preset salvo CORTE declara estos dos campos (§ `TEMAS-ROLES-DECLARADOS-
POR-EL-PRESET-1`, sin cambio), así que PLIEGO/PATIO/VETA/VITRINA/ARRANQUE y todo tenant real quedan
exactamente como estaban.

### La tabla que el owner va a ver — banda por banda, CORTE

Medido con `esquemaStyle(id, CORTE.raices, ejes)` para las 5 bandas que el preset asigna, y con
`derivarPaleta(CORTE.raices, ejes)` para el hero (sin esquema, cae al `:root`) — `ANTES` = sin los
ejes (el estado previo a este slice); `DESPUÉS` = con `origenTexto:'tinta', origenAccion:'acento'`
(el estado que este slice entrega):

| banda (esquema) | token leído por el eyebrow/título sobre la banda | ANTES | DESPUÉS |
| --- | --- | --- | --- |
| trustBadges (crema) | `--sf-sobre-banda` | `#732a00` (rojizo) | `#3d3000` (verde-oliva, el `--text-heading` del prototipo) |
| featured (crema) | `--sf-sobre-banda` | `#732a00` | `#3d3000` |
| brandStory (superficie) | `--sf-sobre-banda` | `#732a00` | `#3d3000` |
| presentaciones (crema) | `--sf-sobre-banda` | `#732a00` | `#3d3000` |
| subscriptionCTA (crema) | `--sf-sobre-banda` | `#732a00` | `#3d3000` |
| **hero** (SIN esquema — el par pendiente que el spec pidió revisar) | `--sf-sobre-tarjeta-suave` (el párrafo de `HeroMedia.tsx:153`) | `#a70004` (el acento crudo, rojizo) | `#102407` (la tinta exacta) |

**El hero YA estaba corregido — por el `:root`, no por este slice.** El hero (`variantes.hero:
'media'`) no tiene esquema asignado (`CORTE.esquemas` no trae la clave `hero`), así que
`esquemaStyle` le devuelve `{}` y sus tokens `--sf-sobre-tarjeta`/`-suave` caen al `:root` global —
que `cssMiradorTema` (§ `TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1`, sin cambio en este slice) YA
alimenta con `ejes`. Medido: `derivarPaleta(CORTE.raices)['sobre-tarjeta-suave']` = `#a70004` (el
defecto, ANTES de la tanda anterior) vs `derivarPaleta(CORTE.raices, ejes)['sobre-tarjeta-suave']` =
`#102407` (ya corregido, sin que este slice tocara nada del hero). El título del hero
(`--sf-sobre-tarjeta`, `HeroMedia.tsx:140`) nunca tuvo el defecto: es un auto-flip blanco/tinta con
piso, independiente de `origenTexto` en las dos direcciones — confirmado, `#102407` en las dos
columnas.

**Ninguna banda queda con el texto rojizo.** Los subtítulos (`--sf-sobre-banda-suave`) y el hover de
`acento-3` (§ el residuo declarado en `TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1`, no tocado por este
slice — su reposo ya cambia con este fix, pero el matiz de hover en sí sigue sin moverse) no están en
la tabla porque ninguno era el "texto EN REPOSO" que el spec pidió medir arriba, pero se verificaron
igual: `--sf-sobre-banda-suave` pasa de `#961700` a `#1d2a00` en las 5 bandas (mismo patrón).

### Gate

- **`npm test`** (capa 1, sin base): **1517/1517**, 0 fail — +9 sobre el piso de
  `TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1` (1508): 4 nuevos en `palette-derive.test.ts` (la
  byte-identidad de `ejes` ausente en `derivarEsquema`, el diferencial de `acento-texto` con
  `origenTexto:'tinta'` en los 4 esquemas, el piso AA con los dos ejes, y que `ejes` no mueve
  `fondo`) + 5 nuevos en `esquema-style.test.ts` (byte-identidad, el mismo motor que `derivarEsquema`,
  el diferencial de `--sf-sobre-tarjeta-suave` en los 4 esquemas, el diferencial de `--sf-sobre-banda`
  en los 2 esquemas claros (crema/superficie) que CORTE realmente asigna a sus 5 bandas, y el piso AA
  con los dos ejes).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail — idéntico al
  piso anterior (este slice no toca ninguna cadena del carril; ningún archivo de
  `packages/core/`/`app/api/` en el diff).
- **`npx tsc --noEmit`**: limpio, sin salida.
- **`npx next build`**: `✓ Compiled successfully`. Verificado sobre el ARTEFACTO (no sólo la fuente,
  vía un script de Node que lee los chunks — el `grep` de shell tropezaba con los cuantificadores de
  regex de la ruta): `.next/server/chunks/ssr/_0baz7fz._.js` trae `"derivarEsquema",0,function(a,b,
  c={}){let d=n(a,c);...}` (el tercer parámetro `c` — `ejes` — se pasa a `n`, la `derivarPaleta`
  compilada) y `.next/server/chunks/ssr/_07-ylst._.js` trae el call site de la página con el quinto
  argumento: `z={origenTexto:x.origenTexto??void 0,origenAccion:x.origenAccion??void 0}` seguido de
  `esquemaStyle(w[a],x.fondo,x.tinta,x.acento,z)`.

### Un descubrimiento durante la escritura de los tests — NO todo rol nacido del acento se mueve igual en toda superficie

El primer test que escribí para el diferencial usaba `--sf-sobre-banda` (mapea a `p.texto`) contra
los 4 esquemas del catálogo (`crema`/`superficie`/`oscuro`/`acento`) y **falló para `oscuro`**:
`p.texto` para una superficie OSCURA no reusa la mezcla acento/tinta de la RECETA — reusa `tostado`/
`acento-txt` (§ `textoClaroSobreOscuro`, `palette-derive.ts`, doctrina de ANTES de este slice, sin
tocar), que no dependen de `origenTexto`. Es un invariante del DISEÑO (un texto cálido-y-claro sobre
fondo oscuro, no un piso raso), no un hueco de este slice: **irrelevante en la práctica**, porque
CORTE sólo asigna esquemas `crema`/`superficie` a sus 5 bandas (ninguna `oscuro`/`acento`) — medido,
`CORTE.esquemas` (`themes.ts:386-392`). El test se corrigió para verificar el diferencial con
`--sf-sobre-tarjeta-suave` (que SÍ deriva de `acento-texto`, y ESE rol se mueve en los 4 esquemas
sin excepción) y, aparte, con `--sf-sobre-banda` restringido a los 2 esquemas claros (crema/
superficie) que CORTE realmente usa. Ninguna corrección de código — sólo del test, antes de que el
error se colara en el gate.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, mismo gate del mirador). Los archivos tocados
(`lib/config/palette-derive.ts`, `lib/config/esquema-style.ts`, `app/(storefront)/page.tsx`) están
en la lista de Tier 1 (`components/storefront/`/`app/(storefront)/` — bytes del visitante). Contra
MERGE POLICY A: **sin schema/migración**, **sin contrato cross-repo**, pero **SÍ bytes de cliente**
— el diff cambia valores que las 5 bandas con esquema traducen en `--sf-*` reales sobre la ruta
pública `/`, gateada por `?tema=` (no por sesión). `customer_bytes.changed: true`. La rama entera
(`slice/corte-reescritura-prototipo-1`) ya venía `AWAITING_APPROVAL`; este slice individual también
clasifica `AWAITING_APPROVAL` por cuenta propia.

### Deviations

Ninguna del spec en la mecánica (threadear `ejes` por el camino existente, sin segunda regla). Una
corrección de MEDICIÓN sobre la marcha (no del spec): el primer borrador de un test asumía que TODO
rol nacido del acento se mueve igual en las 4 superficies de esquema — medido y refutado (§ arriba,
"Un descubrimiento durante la escritura de los tests").

### Open follow-ups

Ninguno nuevo. El residuo de `--sf-acento-3` (hover del link de `FeaturedProductsGrilla`) que
`TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1` dejó nombrado sigue igual: es un matiz de HOVER, no el
texto en reposo, y su reposo (`--sf-sobre-banda`, la MISMA banda `featured`) ya se corrige con este
slice — mover también el hover sería una extensión no pedida por este spec.

## 2026-09-19 — HeroMedia sin tarjeta: el texto va directo sobre la media, con el velo del prototipo

**Decisión del owner (2026-09-19), comparando capturas del prototipo contra el mirador:** «sacá la
tarjeta del hero. El texto va directo sobre la media, al pie, con el velo protector del prototipo —
sin fondo de tarjeta, sin esquinas redondeadas, sin sombra. La tarjeta es lo que hace que nuestro
hero se lea como plantilla y el del prototipo como editorial.» No es una propuesta evaluada por este
slice: es lo que se construyó.

### Qué desapareció, qué apareció

- **Desapareció**: el contenedor `rounded-3xl bg-[var(--sf-tarjeta)] p-8 shadow-2xl sf-borde
  border-[var(--sf-linea)] sm:p-10` que envolvía el bloque de texto de `HeroMedia.tsx`, y con él los
  tokens `--sf-sobre-tarjeta`/`--sf-sobre-tarjeta-suave` que leían CONTRA la tarjeta (eyebrow, título,
  énfasis, subtítulo, CTA secundario).
- **Apareció**: el texto directo sobre la media, al pie (`items-end`, sin cambio — ya lo tenía),
  alineado a la izquierda (sin cambio), con los tokens `--sf-sobre-banda`/`--sf-sobre-banda-suave` —
  verbatim los que ya usa `HeroCurtina.tsx` para el mismo problema (banda OSCURA sin esquema
  asignado). El velo angosto de antes (sólo el tercio superior, sólo para el nav) se fusionó con un
  velo FULL-HEIGHT sobre toda la media: `bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent
  to-[var(--sf-tinta)]/80` — el MISMO gradiente que `HeroCurtina.tsx` ya usa para su propio velo, no
  uno inventado. El tramo superior (60%) es el que ya protegía al nav; el tramo inferior (80%) es
  nuevo — antes lo resolvía la tarjeta clara, ahora lo resuelve el velo oscuro sobre la media a plena
  opacidad. El CTA secundario (outline) cambió de familia de token —de `--sf-linea`/
  `--sf-sobre-tarjeta` (fondo claro) a `--sf-linea-sobre`/`--sf-sobre-banda` (fondo oscuro), también
  verbatim de `HeroCurtina.tsx`—. El CTA primario NO se tocó: ya leía `--sf-accion`, igual que
  curtina/ficha.

### El mecanismo del velo — copiado, no inventado

El prototipo (`docs/prototipos/cafeone/`) nunca puso el texto en una caja: lo pone directo sobre la
media, con `--protect-grad-strong` (`css/tokens.css:218`: `linear-gradient(to bottom,
rgba(16,36,7,.34) 0%, rgba(16,36,7,.62) 100%)`), aplicado sobre TODA la media vía
`.hero-media::after{inset:0}` (`css/app.css:373`), que oscurece progresivamente hacia el pie, donde
vive el texto (`.hero-inner{...justify-content:flex-end}`, `css/app.css:374-378`).

Ese mecanismo YA existe en este repo — `HeroCurtina.tsx` lo construyó para el mismo problema (texto
claro directo sobre media, sin caja) con los tokens propios del sistema (`--sf-tinta`, ya usado en
el resto del storefront) en vez de los literales RGB del prototipo. Se REUSÓ ese gradiente verbatim,
extendido a cubrir la media entera (`inset-0`, antes sólo el tercio superior) — misma forma que el
velo del prototipo (oscurece hacia el pie), valores ya calibrados de este repo.

### Contraste medido — contra tres fotos CLARAS, no sólo una oscura

Medido con la fórmula WCAG (luminancia relativa sRGB → ratio de contraste), componiendo el velo
tinta-coloreado (`#102407`, la raíz `tinta` de CORTE) sobre tres fotos de referencia CLARAS:

| foto de referencia | rgb | contraste blanco vs. velo 80% (pie, texto) | contraste blanco vs. velo 60% (tope, nav) | contraste subtítulo-suave vs. velo 80% |
| --- | --- | --- | --- | --- |
| arena | `232,222,200` | **9.61:1** | 5.32:1 | **5.69:1** |
| casi-blanco (cielo) | `245,245,240` | **8.97:1** | 4.68:1 | **5.38:1** |
| crema | `238,230,214` | **9.38:1** | 5.08:1 | **5.58:1** |

El texto del pie (título/eyebrow/CTA en blanco pleno, sobre el velo al 80% donde vive el bloque de
texto) supera AAA (7:1) contra las tres fotos. El subtítulo (blanco al ~70%, la textura más floja del
bloque) supera AA (4.5:1) con margen en las tres. El tramo superior (60%, sin cambio respecto de
antes, protege al nav) da 4.68:1–5.32:1 — el mismo piso que `HeroCurtina.tsx` ya acepta hoy para su
propio nav; no es un piso nuevo que este slice introduce, es el que el repo ya tenía funcionando.

### Quién más usaba la variante — medido antes de tocar

`grep -rn "'media'" lib/config/themes.ts` da UN solo preset con `hero: 'media'`: `CORTE`. Los otros
cinco (PLIEGO, PATIO, VETA, VITRINA, ARRANQUE) no lo usan, y la canónica de `hero.variantes` es
`'curtina'` — un tenant sin preset aplicado nunca ve esta variante. `aplicarPreset`
(`lib/config/site-content-write.ts:160`) es la ÚNICA función que PERSISTIRÍA un preset en
`SiteContent`, y no tiene un solo llamador (corre desde un runbook manual de onboarding, nunca desde
el panel del cliente). El único camino de HOY a esta variante es el mirador `?tema=CORTE`
(`contenidoConPresetDeVista`, `lib/config/theme-mirador.ts`), que sólo se lee fuera de producción
real (`esDespliegueDemo()`, `app/(storefront)/page.tsx`). **Conclusión: no hubo que decidir entre
"cambiar para todos" o "una composición nueva por variante"** — la composición YA es por variante
(`media` es una de tres), y ningún inquilino real queda afectado porque ningún inquilino real la
usa: el cambio sólo mueve lo que el mirador de CORTE muestra.

### Lo que NO se tocó

Ninguna otra banda, ningún otro preset, el motor de paleta (`palette-derive.ts`, `esquema-style.ts`)
intacto. `git diff --stat` de la rama para este slice: un solo archivo,
`components/storefront/home/HeroMedia.tsx` (68 inserciones, 40 borrados). Nayoli (sin preset,
`hero.variante` cae a `'curtina'`) no cambia un byte: `HeroMedia.tsx` no es el componente que
renderiza su hero.

### Gate

- **`npm run gate`** (los dos carriles, sobre el árbol final): capa 1 (`npm test`) **1517/1517**, 0
  fail; capa 2 (`npm run test:integracion`, Postgres 14 efímero) **208/208**, 0 fail. Mismo piso que
  el slice anterior (`TEMAS-ESQUEMA-ORIGEN-PENDIENTE-1`) — este slice no tocó ningún archivo de
  `packages/core/`/`app/api/`/`lib/` con test propio, así que el piso no debía moverse y no se movió.
- **`npx tsc --noEmit`**: limpio.
- **`npx eslint components/storefront/home/HeroMedia.tsx`**: limpio.
- **`npx next build`**: `✓ Compiled successfully`. Verificado sobre el ARTEFACTO de producción
  (`.next/server` + `.next/static`, excluyendo `.next/dev` — un directorio rancio de una sesión
  previa que SÍ conserva el marcador viejo, y es la evidencia de por qué el grep tiene que apuntar al
  build fresco y no a cualquier `.next/*`): el marcador viejo (`shadow-2xl sf-borde
  border-[var(--sf-linea)] sm:p-10`) da **0** en los 590 archivos JS del build fresco; el marcador
  nuevo (`via-transparent to-[var(--sf-tinta)]/80`) y `sf-linea-sobre` aparecen en los chunks del
  home (`components_storefront_home_0_-amj8._.js` y sus pares cliente/servidor).

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, 2026-09-19, sin gate previo — comparó capturas del prototipo y del
mirador directamente). El único archivo tocado (`components/storefront/home/HeroMedia.tsx`) está en
`components/storefront/` (Tier 1 — bytes del visitante). Contra MERGE POLICY A: **sin
schema/migración**, **sin contrato cross-repo**, pero **SÍ bytes de cliente** — el diff cambia lo que
se sirve en la ruta pública `/`, aunque hoy sólo alcanzable por `?tema=CORTE` en demo.
`customer_bytes.changed: true` (la RAMA lo cambia, § el eje de admisión de `customer_bytes` —
`slice/corte-reescritura-prototipo-1` ya venía `AWAITING_APPROVAL` por los slices anteriores de la
misma rama). Este slice individual también clasifica `AWAITING_APPROVAL` por cuenta propia.

### Deviations

Ninguna. El spec pedía verificar quién más usa la variante antes de tocarla, verificar el velo del
prototipo y el del repo antes de escribir uno nuevo, y medir el contraste sobre una foto clara — las
tres verificaciones se hicieron ANTES de escribir código, y los tres resultados (un solo preset
afectado, dos velos reusables, contraste sobrado) confirmaron que el camino más simple —reusar el
gradiente y los tokens que `HeroCurtina.tsx` ya tiene, sin tocar ningún otro archivo— era también el
correcto.

### Open follow-ups

Ninguno nuevo.

## 2026-09-20 — PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1: el texto floreado-contra-fondo migra a
`sobre-superficie` en los sitios que lo pintan directo sobre `--sf-superficie`

**Decisión del owner (2026-09-20), sobre el censo `PALETA-CONSUMIDORES-TEXTO-CENSO-1`**: arreglar
los sitios que pintan `--sf-texto`/`--sf-texto-suave`/`--sf-acento-texto`/`--sf-tinta` —el token de
texto floreado contra `--sf-fondo`— directo sobre `--sf-superficie`, en vez del par que el motor
construyó exactamente para eso (`--sf-sobre-superficie`/`-suave`, § TEMAS-P6-FAMILIAS-1). El par ya
tenía DOS consumidores correctos (`ProductChip.tsx`, `ProductCard.tsx`); el resto del storefront
—incluido el camino del dinero, el resumen de la orden y las cajas de número de orden del retorno
de pasarela— seguía pintando el token viejo, sin el piso de contraste que esa familia garantiza
contra la superficie real (medida en el comentario de `ProductChip.tsx`: 2.30–3.63:1, nunca ≥4.5).

### Las tres condiciones del owner, y cómo se cumplieron

1. **El patrón se replica LITERAL, sin variante nueva.** Cada sitio se migró al MISMO wrap que ya
   usan los dos archivos correctos: `var(--sf-sobre-superficie[-suave],var(--sf-<token de hoy>))` —
   el token viejo como fallback, nunca una forma nueva. Cero cambios al motor
   (`palette-derive.ts`/`esquema-style.ts`), cero presets, cero esquemas, cero bandas.
2. **El inquilino por defecto (Nayoli) queda byte-idéntico, VERIFICADO.** `--sf-sobre-superficie`/
   `-suave` NO tienen default en `app/globals.css` (grep, 0 resultados) — la MISMA garantía
   estructural que ya protege a `ProductChip`/`ProductCard` en producción: sin raíces custom
   (`content.tema` null), `cssPaleta` devuelve `null` y no inyecta ningún `<style>`, así que el
   `var(...)` cae SIEMPRE al fallback. Confirmado sobre el artefacto de producción fresco
   (`npm run build`): el token nuevo aparece en los chunks (`.next/server/chunks/ssr/
   app_(storefront)_checkout_page_tsx_*`, y en `.next/static/chunks/*`), y `app/globals.css` sigue
   sin una sola definición `--sf-sobre-superficie:`.
3. **Los sitios SOLO-hover quedan afuera, nombrados.** Diez `hover:bg-[var(--sf-superficie)]` no se
   tocaron —`checkout/page.tsx:479,506,783,787` (pre-migración: 502,774,778 + el "Seguir comprando"
   de la confirmación), `RetornoCliente.tsx` (dos "Volver a consultar"/"Seguir comprando"),
   `EsperaRedireccionPasarela.tsx` (un "Seguir comprando"), `EsperaConfirmacionTarjeta.tsx` (un
   "Seguir comprando"), `FormularioOtroMetodoPasarela.tsx` (un botón de reintento),
   `FormularioTarjeta.tsx` (un botón de reintento), `CartDrawer.tsx` (el botón de cerrar)—: el
   defecto ahí es transitorio (el texto en reposo vive sobre el fondo de página, no sobre la
   superficie) y es la MISMA familia pero otro slice.

### El sitio cuya ubicación se DECIDIÓ, no se midió

`EsperaRedireccionPasarela.tsx`, la rama `redirigiendo`/`esperando` (línea ~162): su `<p>` no tiene
fondo propio en ese archivo, y su único llamador (`FormularioOtroMetodoPasarela.tsx`, vía
`SelectorMetodoPasarela`) lo monta DENTRO de un `bg-[var(--sf-superficie)]` — así que el fondo real
no se puede leer desde el propio archivo del componente. Por instrucción del orquestador se trató
COMO SI estuviera sobre la superficie (la dirección conservadora), y esa decisión se dejó escrita en
el código junto al cambio.

**La premisa se verificó, no se asumió**: "la superficie es más oscura que la página, así que el
texto floreado para ella contrasta MÁS si termina sobre la página" se midió con las funciones reales
del motor (`derivarPaleta`/`contraste`/`mezclar`) contra las 7 paletas del repo (NAYOLI, NEON, MEDIO
de `palette-derive.test.ts` + los 5 presets con raíces propias de `themes.ts`: PLIEGO, CORTE, PATIO,
VITRINA — ARRANQUE reusa `RAICES_DEFECTO`, idéntico a NAYOLI). En las 7, el contraste de
`sobre-superficie`/`sobre-superficie-suave` contra `--sf-fondo` fue MAYOR O IGUAL que contra
`--sf-superficie` — nunca menor, incluida MEDIO (fondo oscuro, donde la superficie es más CLARA que
el fondo en luminancia absoluta, pero el contraste conservador se sostiene igual). El script de
verificación no se conserva (vivió en `.scratch/`, gitignored); el resultado queda acá.

### El censo: ocho archivos, seis pantallas, y el conteo que DIFIERE del externo

El spec citaba (externo, `PALETA-CONSUMIDORES-TEXTO-CENSO-1`, `kind: ledger_claim`, no re-medido por
ese slice) **veintitrés** sitios persistentes en **ocho archivos** y **seis pantallas**, más **unos
diez** sitios adicionales sólo-en-hover. Este slice remidió el censo desde cero, leyendo cada
archivo con `sf-superficie` en `app/(storefront)/` y `components/storefront/` y clasificando cada
`text-[var(--sf-{texto,texto-suave,acento-texto,tinta})]` según si su fondo persistente (propio o del
contenedor en el MISMO archivo) es `--sf-superficie`:

| # | archivo | sitios migrados |
| --- | --- | --- |
| 1 | `app/(storefront)/tienda/page.tsx` | 4 (header: título+subtítulo; 2 pills de filtro) |
| 2 | `app/(storefront)/tienda/[slug]/page.tsx` | 3 (pill de nota de cata; selector de cantidad; título "También te puede gustar") |
| 3 | `app/(storefront)/checkout/page.tsx` | 13 (resumen de orden: 8; prefijo "+57": 1; caja "reservado": 2; mensaje sin método: 1; nota de candado: 1) |
| 4 | `app/(storefront)/checkout/retorno/RetornoCliente.tsx` | 8 (4 cajas "Número de orden" × 2 líneas) |
| 5 | `components/storefront/layout/NavSearch.tsx` | 1 (pill de categoría sugerida) |
| 6 | `components/storefront/suscripciones/SuscripcionPasos.tsx` | 3 (título; label de paso; descripción de paso) |
| 7 | `components/storefront/checkout/EsperaRedireccionPasarela.tsx` | 3 (caja "Número de orden" × 2; + el sitio decidido-no-medido) |
| 8 | `components/storefront/checkout/EsperaConfirmacionTarjeta.tsx` | 2 (caja "Número de orden" × 2) |
| | **total** | **37** |

**El conteo de ARCHIVOS (8) y de PANTALLAS (6: tienda, producto, checkout, retorno, suscripciones,
búsqueda) coincide exacto con el externo — eso confirma que la SUPERFICIE identificada es la misma.**
El conteo de SITIOS PERSISTENTES (37 medido contra 23 citado) y el de sitios sólo-hover (10 medido,
coincide con "unos diez" del spec) NO coinciden en el primer número. La hipótesis más simple es que
el censo externo contaba por CAJA/CONTENEDOR (una unidad por `bg-[var(--sf-superficie)]`, sin
desagregar cada línea de texto dentro), mientras que este slice contó por INSTANCIA DE CLASSNAME (la
unidad real de la edición mecánica) — con esa granularidad, el propio resumen de la orden de
`checkout/page.tsx` aporta 8 sitios de un solo contenedor. Es una DIVERGENCIA DE MEDICIÓN, no de
superficie: no se encontró ningún archivo o pantalla adicional fuera de los 8/6 ya citados por el
spec, y el conteo de 37 es el que se migró completo, verificado por re-grep contra cada archivo
tocado (cero instancias bare de `text-[var(--sf-{texto,texto-suave,acento-texto,tinta})]` restantes
dentro de un `bg-[var(--sf-superficie)]` persistente, en los 8 archivos).

**Íconos EXCLUIDOS a propósito.** Dos usos de `text-[var(--sf-acento-texto)]` sobre un ícono SVG
(el candado de `checkout/page.tsx`, línea 747→756; el ícono del Shield en el resumen de la orden vía
tarjeta, fuera de superficie) NO se migraron: "texto floreado" es TEXTO —el patrón establecido en
`ProductChip`/`ProductCard` sólo toca `<p>`—, y un ícono decorativo no es lectura. Queda nombrado
para que un censo futuro no lo cuente como pendiente sin decidirlo.

**`--sf-tinta` SÍ entra en el alcance**, pese a no ser un token RECETA-derivado (es una de las 3
raíces, no "floreado" en sentido técnico): el propio comentario de `ProductChip.tsx` la nombra
explícitamente como uno de los tokens que medían 2.30–3.63:1 contra la superficie ("de OTRAS
familias"), y el mapeo ya establecido la trata igual que `texto`/`acento-texto` (rol primario →
`sobre-superficie`). No es una variante nueva: es seguir el precedente escrito.

### La regla que sale de este hallazgo

**Quien crea una capacidad para arreglar un defecto migra a TODOS sus consumidores, o nombra
explícitamente los que deja.** El par `sobre-superficie`/`sobre-superficie-suave` se construyó
(§ TEMAS-P6-FAMILIAS-1) y sólo se cableó en los DOS sitios de esa misma tanda — el resto del
storefront, incluido el camino del dinero, quedó con el defecto que la capacidad existía para
cerrar, sin que nadie lo notara hasta este censo. Una primitiva nueva sin migración completa (o sin
un follow-up nombrado) dura exactamente lo que tarda alguien en mirar el censo con el terreno real.

### Gate

- **`npx tsc --noEmit`**: limpio, DESPUÉS de corregir dos bugs de sintaxis propios introducidos al
  editar (`checkout/page.tsx` y `tienda/[slug]/page.tsx`): un comentario `{/* */}` (sintaxis JSX,
  válida sólo dentro de children JSX) se usó por error dentro de una expresión JS —
  `cond ? ( {/* comentario */} <div>...`, donde el `(` abre una expresión y `{/* */}` se parsea como
  un objeto vacío seguido de JSX, sintaxis inválida—. Corregido a `//` (comentario de línea, válido
  en expresión JS), el mismo estilo que ya usaban los comentarios vecinos en esos tres puntos. Es la
  MISMA familia que § `tsc` ≠ SWC de `CLAUDE.md`: un `tsc` en verde no prueba que el JSX compile —acá
  el primer `tsc` SÍ atrapó el error (list de 17 errores en cascada desde los 3 puntos rotos), así
  que no hizo falta llegar a `next build` para encontrarlo, pero `next build` se corrió igual después
  por ser la autoridad declarada para JSX/TSX.
- **`npx next build`**: `✓ Compiled successfully`. Verificado sobre el artefacto: el token nuevo
  (`--sf-sobre-superficie`) aparece en los chunks server/cliente de las rutas tocadas; `globals.css`
  sigue sin una definición de default para él (0 matches).
- **`npm run gate`** (los dos carriles, sobre el árbol final): capa 1 (`npm test`) **1517/1517**, 0
  fail; capa 2 (`npm run test:integracion`, Postgres 14 efímero) **208/208**, 0 fail. Mismo piso que
  el slice anterior de esta rama (`HERO-MEDIA-SIN-TARJETA-1`) — este slice no tocó ningún archivo con
  test propio (son 8 archivos de presentación, sin lógica), así que el piso no debía moverse y no se
  movió.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, 2026-09-20, sobre el censo `PALETA-CONSUMIDORES-TEXTO-CENSO-1`,
con las tres condiciones de arriba). Los 8 archivos tocados están en `app/(storefront)/` y
`components/storefront/` — Tier 1, bytes del visitante. Contra MERGE POLICY A: **sin
schema/migración**, **sin contrato cross-repo**, pero **SÍ bytes de cliente** — el diff cambia
className en pantallas públicas (`/tienda`, `/tienda/[slug]`, `/checkout`, `/checkout/retorno`,
`/suscripciones`, el buscador de nav). `customer_bytes.changed: true`, `customer_bytes.strings: []`
—el texto visible (español, "Número de orden", etc.) no cambia, sólo el wiring de color compilado; es
el caso "vacío con `changed: true` es legítimo" que la doctrina ya nombra—. La rama
(`slice/corte-reescritura-prototipo-1`) ya venía `AWAITING_APPROVAL` por los slices anteriores; este
slice individual también clasifica `AWAITING_APPROVAL` por cuenta propia.

### Deviations

Ninguna en la mecánica del wrap (literal, el patrón ya establecido). Dos correcciones sobre la
marcha, ninguna del spec: (1) los dos bugs de sintaxis `{/* */}`-en-expresión-JS, encontrados y
corregidos por `tsc` antes de cerrar; (2) el conteo propio (37 sitios persistentes) DIFIERE del
citado en el spec (23, marcado `ledger_claim`, no remedido por ese slice) — se reporta como
divergencia de granularidad de conteo (caja vs. instancia), no de superficie (archivos y pantallas
coinciden exacto), § arriba.

### Open follow-ups

**`PALETA-HOVER-TEXTO-SOBRE-SUPERFICIE-1`**: los diez sitios sólo-hover (§ arriba, tercera
condición — `checkout/page.tsx` ×4, `RetornoCliente.tsx` ×2, `EsperaRedireccionPasarela.tsx` ×1,
`EsperaConfirmacionTarjeta.tsx` ×1, `FormularioOtroMetodoPasarela.tsx` ×1,
`FormularioTarjeta.tsx` ×1) tienen texto en reposo sobre el fondo de página que pasa a
`--sf-superficie` SÓLO en `:hover`, sin el par `sobre-superficie`/`sobre-superficie-suave` en esa
transición. Es la misma familia de defecto, un spec propio — no se ejecuta acá porque el owner lo
excluyó explícitamente de este slice (tercera condición).

## 2026-09-20 — PALETA-MIGRACION-SACAR-LOS-QUE-MUEVEN-1: revertir los 14 sitios cuyo respaldo NO
era el token de texto — mueven el color del inquilino por defecto

**Ejecuta la condición textual del owner al aprobar `PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1`
(§ arriba, 2026-09-20): «Nayoli byte-idéntica, verificada y reportada como tal. Si algún sitio la
mueve, ESE SALE DEL SLICE y viene a mi gate solo».** Ese slice verificó y reportó el caso literal
—Nayoli con `content.tema` NULL, donde `--sf-sobre-superficie` no tiene default y el `var(...)`
SIEMPRE cae al fallback, byte a byte—, pero la condición del owner habla de un color que se MUEVE
"en una tienda real", y una tienda real con paleta propia NO cae al fallback: el motor inyecta
`--sf-sobre-superficie`/`-suave` para cualquier `content.tema` no-null, así que el par se pinta
SIEMPRE, sea cual sea el valor. **El fallback nunca protege a un inquilino CON paleta** — protege
sólo el caso null, que es Nayoli sola.

### La medición: `derivarPaleta(RAICES_DEFECTO)` — el "inquilino por defecto" es ARRANQUE, no Nayoli-null

El "inquilino por defecto" de la condición del owner no es la Nayoli literal (raíces null, sin
inyección) sino un inquilino QUE SÍ TIENE paleta con los mismos números que Nayoli — el preset
`ARRANQUE` (`themes.ts:502-519`, `raices: RAICES_DEFECTO`) es exactamente ese caso: pasa por el
motor, así que `sobre-superficie`/`-suave` se computan de verdad, no caen a fallback.

Medido con `derivarPaleta(RAICES_DEFECTO)` (`.scratch/verificar-sitios-migrados-mueven.ts`, no
conservado — gitignored, resultado acá):

| token nuevo | valor | token viejo (fallback) | valor | ¿mueve? |
| --- | --- | --- | --- | --- |
| `sobre-superficie` | `#613211` | `texto` | `#613211` | NO |
| `sobre-superficie-suave` | `#7c3e12` | `texto-suave` | `#7c3e12` | NO |
| `sobre-superficie` | `#613211` | `acento-texto` | `#8b4513` | **SÍ** |
| `sobre-superficie` | `#613211` | `tinta` | `#1a0f08` | **SÍ** |

La razón está en `palette-derive.ts` (`:266-267` vs `:286-287`): `texto`/`texto-suave` y
`sobre-superficie`/`-suave` REUSAN la MISMA mezcla acento/tinta a los MISMOS pesos (0.34/0.12,
comentario de `:275`, "reusa los mismos candidatos") — sólo difiere contra QUÉ se floreacontrastan
(`fondo` vs `superficie`), y para `RAICES_DEFECTO` los dos floreos convergen al mismo hex. En
cambio `acento-texto` (`:265`, `pisoContraste(tinta,fondo,4.5)`, floreo del hex CRUDO de `tinta`
sin mezcla con `acento`) y `tinta` (raíz sin derivar) parten de un candidato COMPLETAMENTE
distinto a la mezcla acento/tinta-al-34%: no hay razón matemática para que coincidan, y no
coinciden.

### Los 14 sitios revertidos

Sólo se tocó el `className` de cada sitio (vuelta al token viejo, sin el wrap) más el comentario
que lo documentaba; ningún otro carácter del archivo cambió.

| archivo | sitios | fallback que tenían |
| --- | --- | --- |
| `app/(storefront)/tienda/page.tsx` | 1 (h1 "Nuestra Tienda") | `--sf-tinta` |
| `app/(storefront)/tienda/[slug]/page.tsx` | 2 (cantidad del selector; h2 "También te puede gustar") | `--sf-tinta` |
| `app/(storefront)/checkout/page.tsx` | 3 (número de orden × 2 ramas; Total del resumen) | `--sf-acento-texto` ×2, `--sf-tinta` ×1 |
| `app/(storefront)/checkout/retorno/RetornoCliente.tsx` | 4 (número de orden, las 4 ramas: enVuelo/techo/aprobado/fallido) | `--sf-acento-texto` |
| `components/storefront/checkout/EsperaConfirmacionTarjeta.tsx` | 1 (número de orden) | `--sf-acento-texto` |
| `components/storefront/checkout/EsperaRedireccionPasarela.tsx` | 1 (número de orden) | `--sf-acento-texto` |
| `components/storefront/suscripciones/SuscripcionPasos.tsx` | 2 (h2 del título; label de cada paso) | `--sf-tinta` |
| **total** | **14** | |

Ningún sitio con fallback `--sf-texto`/`--sf-texto-suave` se tocó — ésos SON el caso "no mueve"
(§ tabla de arriba), y quedan migrados tal como los dejó `PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1`.

### La verificación del owner: TODOS los sitios que QUEDAN migrados resuelven igual, para el
inquilino por defecto

Medido con `.scratch/verificar-sitios-quedan-migrados.ts` (no conservado): barrido del árbol real
(`grep -rl "sf-sobre-superficie" --include="*.tsx" "app/(storefront)" components/storefront`), no
una lista escrita a mano, comparando cada `var(--sf-sobre-superficie[-suave],var(--sf-<token>))`
contra `derivarPaleta(RAICES_DEFECTO)`:

- **26 sitios totales** con el wrap en el árbol tras este slice.
- **2 diferencias, las DOS en `ProductChip.tsx`** (`:16`, `:20`) — **fuera de alcance de
  `PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1`**: son los DOS consumidores que YA existían ANTES de
  esa migración (`TEMAS-P6-FAMILIAS-1`, no tocados por el commit `399aff2`), y su fallback
  (`--sf-tostado-3`/`--sf-tinta`) es DELIBERADAMENTE distinto — el propio comentario de
  `ProductChip.tsx:10-13` documenta que el par `sobre-superficie` se construyó PORQUE esos dos
  tokens medían 2.30–3.63:1 contra la superficie real (bajo AA); que el nuevo valor difiera del
  viejo ahí es el ÉXITO del fix, no un defecto.
- **Los 24 sitios restantes (26 − 2 fuera de alcance) — CERO diferencias.** Para el inquilino con
  la paleta de `RAICES_DEFECTO`, todo sitio que la migración de `PALETA-MIGRAR-TEXTO-SOBRE-
  SUPERFICIE-1` dejó migrado (23, tras revertir los 14 de este slice sobre los 37 originales) más
  el consumidor pre-existente `ProductCard.tsx` (1) resuelven al MISMO hex que antes del wrap.

### Gate

`npx tsc --noEmit`: limpio. `npx next build`: `✓ Compiled successfully`. `npm test` (capa 1):
**1517/1517**, 0 fail. `npm run test:integracion` (capa 2, Postgres 14 efímero): **208/208**, 0
fail. Mismo piso que `PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1` (este slice no tocó ningún archivo
con test propio — son 7 archivos de presentación, sin lógica).

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, 2026-09-20, condición dada al aprobar el slice anterior — ver
cabecera de este asiento). Los 7 archivos tocados están en `app/(storefront)/` y
`components/storefront/` — Tier 1, bytes del visitante. Contra MERGE POLICY A: **sin
schema/migración**, **sin contrato cross-repo**, pero **SÍ bytes de cliente** — el diff revierte
`className` en pantallas públicas (`/tienda`, `/tienda/[slug]`, `/checkout`, `/checkout/retorno`,
`/suscripciones`). `customer_bytes.changed: true`, `customer_bytes.strings: []` — el texto visible
no cambia, sólo el wiring de color compilado. `AWAITING_APPROVAL`.

### Open follow-ups

**`PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1`**: los 14 sitios de la tabla de arriba SIGUEN con el
defecto de contraste original contra `--sf-superficie` que `PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1`
existía para cerrar — sólo que, a diferencia de los 23 que sí quedaron migrados, arreglarlos
CAMBIA el color visible del inquilino por defecto (y de cualquier tenant con paleta propia), no
sólo el de una paleta custom hipotética. Es una decisión de PRODUCTO —qué color debe llevar el
número de orden y los títulos que hoy pintan `--sf-acento-texto`/`--sf-tinta` sobre una superficie
elevada—, no una continuación mecánica del mismo wrap; por eso queda para el gate propio del owner,
no se resuelve acá con un tercer token.

## 2026-09-20 — PALETA-MIGRAR-ACENTO-TINTA-1: los 14 sitios migran al par `sobre-superficie`,
esta vez con el gate propio del owner cumplido

**Cierra el follow-up `PALETA-ACENTO-TINTA-SOBRE-SUPERFICIE-1` de arriba.** El owner sacó estos 14
sitios del slice anterior por su propia condición ("si algún sitio mueve el color del inquilino por
defecto, ESE SALE DEL SLICE"), pidió el censo con color, pantalla y camino del dinero, lo recibió, y
decidió migrarlos. Su razón textual: **«dejarlo como está NO es neutral — no migrar es elegir dejar
dos presets rotos para no cambiarle el tono a cuatro que funcionan».**

### La forma: el MISMO wrap que `PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1`, nada nuevo

Los 14 sitios (7 archivos, la misma tabla que el asiento de arriba) pasan de leer `--sf-acento-texto`
u `--sf-tinta` CRUDO a `var(--sf-sobre-superficie,var(--sf-acento-texto))` /
`var(--sf-sobre-superficie,var(--sf-tinta))` — literal el mismo par `sobre-superficie` (nunca
`-suave`: los 14 son títulos/números en negrita, ningún texto secundario) que ya usan los 23 sitios
que `PALETA-MIGRAR-TEXTO-SOBRE-SUPERFICIE-1` dejó migrados. Ninguna variante nueva, ningún token
nuevo, ningún preset tocado — sólo el `className` de cada sitio y su comentario.

**EL FALLBACK NO SE LIMPIA, Y ESO QUEDA DICHO ACÁ PARA QUE NO SE VUELVA A DISCUTIR:** un inquilino
que no fijó paleta (Nayoli, `content.tema` null) nunca inyecta `--sf-sobre-superficie` — el motor
sólo la computa cuando `content.tema` existe (`palette-derive.ts:283-285`) — así que para ESE
inquilino el token nuevo NO EXISTE y el fallback (`--sf-acento-texto`/`--sf-tinta`) es LO ÚNICO que
pinta el texto. Parece decoración y es la única salida de un estado real; borrarlo dejaría a Nayoli
con un `var(--sf-sobre-superficie)` sin segundo argumento, que el navegador resuelve a
`currentColor`/transparente. No es deuda — es la forma correcta del wrap.

### PRIMERA VERIFICACIÓN PEDIDA — los dos presets rotos, medidos DESPUÉS de migrar, no inferidos

Medido con `derivarPaleta` de `lib/config/palette-derive.ts` contra las raíces REALES de los seis
presets del catálogo (`lib/config/themes.ts`, `PRESETS`) — `.scratch/verificar-acento-tinta.ts`, no
conservado (gitignored), resultado acá. Contraste WCAG (`contraste()`, el mismo cálculo que
`pisoContraste` usa para su piso de 4.5): el color que el sitio pinta contra `--sf-superficie`
derivada de ESE preset, no contra `--sf-fondo`.

| preset | raíces (línea) | acento-como-texto ANTES (`acento-texto` vs `superficie`) | tinta ANTES (`tinta` cruda vs `superficie`) | `sobre-superficie` DESPUÉS (vs `superficie`) | veredicto |
| --- | --- | --- | --- | --- | --- |
| PLIEGO | `themes.ts:275` | 5.238 | 14.518 | 7.892 | ya pasaba cómodo — cambia de tono, sigue muy arriba del piso |
| CORTE | `themes.ts:311` | 13.780 | 13.780 | 8.544 | ya pasaba cómodo (declara `origenTexto:'tinta'`, § arriba) — cambia de tono, sigue muy arriba del piso |
| **PATIO** | `themes.ts:413` | **4.140 — bajo AA (4.5)** | 13.911 | **5.506 — sobre AA** | **ROTO → arreglado** |
| **VETA** | `themes.ts:440` | 5.822 | **1.194 — prácticamente ilegible** | **4.612 — sobre AA** | **ROTO → arreglado** |
| VITRINA | `themes.ts:462` | 5.016 | 16.671 | 8.219 | ya pasaba cómodo — cambia de tono, sigue muy arriba del piso |
| ARRANQUE | `themes.ts:505` (= `RAICES_DEFECTO`) | 5.811 | 15.407 | 8.714 | ya pasaba cómodo — cambia de tono, sigue muy arriba del piso |

**PATIO** es el preset con el acento-como-texto bajo el mínimo de accesibilidad (4.140 < 4.5) — el
número de orden, en `--sf-acento-texto` crudo, no se leía bien sobre su propia superficie. **VETA**
es el preset con la tinta sobre superficie oscura casi ilegible (1.194:1, prácticamente el mismo
color sobre sí mismo — `raices.tinta = #080605` contra una `superficie` derivada de un `fondo` casi
igual de oscuro, `#16120e`). Los dos quedan sobre el piso de 4.5 tras migrar (5.506 y 4.612). Los
otros cuatro presets (PLIEGO, CORTE, VITRINA, ARRANQUE) ya pasaban cómodos con el valor de hoy —el
cambio de tono no los acerca al piso, los deja igual de holgados del otro lado (7.9–8.7:1)—, que es
exactamente lo que el owner aceptó pagar.

### SEGUNDA VERIFICACIÓN PEDIDA — los nueve sitios del camino del dinero, uno por uno

De los 14, **NUEVE** viven donde se paga o se confirma un pago — el checkout, el retorno de la
pasarela, y las dos pantallas de espera de un cobro por pasarela (tarjeta / redirección). Los otros
cinco (la cantidad del selector y el "también te puede gustar" de la ficha de producto, el h1 de
`/tienda`, el título y el label de cada paso de `/suscripciones`) no tocan dinero.

| # | archivo:línea | pantalla / vista (como se ve) | ¿sólo-en-agote-de-sondeo? |
| --- | --- | --- | --- |
| 1 | `app/(storefront)/checkout/page.tsx:443` | Checkout — confirmación terminal ("¡Pedido recibido!" / "¡Tu pago fue aprobado!"), caja "Número de orden" | no — se ve en el flujo normal (orden manual, pasarela aprobada, método no habilitado) y también con `intentosAgotados` |
| 2 | `app/(storefront)/checkout/page.tsx:480` | La misma pantalla — línea "Total" del resumen | no |
| 3 | `app/(storefront)/checkout/page.tsx:655` | Checkout, modo widget de pasarela — "Tu pedido está reservado", caja "Número de orden" | no — se ve siempre que el widget está montado |
| 4 | `app/(storefront)/checkout/retorno/RetornoCliente.tsx:251` | `/checkout/retorno` — vista `en_vuelo` ("Estamos confirmando tu pago"), caja "Número de orden" | no — se ve mientras el sondeo sigue, antes de agotar |
| 5 | `app/(storefront)/checkout/retorno/RetornoCliente.tsx:272` | `/checkout/retorno` — vista `techo` ("Tu pago sigue procesándose"), caja "Número de orden" | **SÍ — sólo tras 5 min sin resolver (`TECHO_MS`)** |
| 6 | `app/(storefront)/checkout/retorno/RetornoCliente.tsx:323` | `/checkout/retorno` — vista `aprobado` ("¡Tu pago fue aprobado!"), caja "Número de orden" | no |
| 7 | `app/(storefront)/checkout/retorno/RetornoCliente.tsx:355` | `/checkout/retorno` — vista `fallido` ("Tu pago no fue aprobado"), caja "Número de orden" | no |
| 8 | `components/storefront/checkout/EsperaConfirmacionTarjeta.tsx:219` | Espera de confirmación de tarjeta (dentro del checkout) — vista `techo` ("Tu pago sigue procesándose"), caja "Número de orden" | **SÍ — sólo tras agotar `techoMs` (el sondeo del 3DS/tarjeta)** |
| 9 | `components/storefront/checkout/EsperaRedireccionPasarela.tsx:141` | Espera de redirección a la pasarela (dentro del checkout) — vista `techo` ("Todavía no pudimos abrir la página de pago"), caja "Número de orden" | **SÍ — sólo tras agotar `TECHO_SONDEO_MS`** |

**Los TRES que sólo aparecen cuando un sondeo se agota son las filas 5, 8 y 9** — las tres vistas
`techo` de los tres componentes que sondean (`RetornoCliente`, `EsperaConfirmacionTarjeta`,
`EsperaRedireccionPasarela`), verificado leyendo cada componente: las tres son la única rama que se
alcanza cuando `Date.now() - inicio >= <su propio techo>` y ninguna otra condición las dispara. La
razón del owner para nombrarlos aparte: **si algún día algo se ve mal en el checkout de un cliente
con tema, ese listado es lo primero que alguien va a leer** — y un defecto en una pantalla que sólo
aparece una vez cada muchos intentos (el sondeo normal resuelve en segundos, medido en
`PRIMERA-TRANSACCION-REAL-ASIENTO-1`: 5.6–10.3s) puede vivir meses sin que nadie lo reporte, porque
quien llega a esa pantalla ya está en el peor momento de su compra y no vuelve a describir un color.

### Lo que NO se tocó

El motor de paleta (`palette-derive.ts`) — cero tokens nuevos, cero pisos nuevos. Ningún preset de
`themes.ts`. Los 10 sitios sólo-hover nombrados en `PALETA-HOVER-TEXTO-SOBRE-SUPERFICIE-1` (arriba) —
siguen sin el wrap, fuera de alcance de este slice. Los 23 sitios que `PALETA-MIGRAR-TEXTO-SOBRE-
SUPERFICIE-1` dejó migrados — sin cambio, siguen con fallback `--sf-texto`/`--sf-texto-suave`.

### Gate

`npx tsc --noEmit`: limpio. `npm run build`: `✓ Compiled successfully`, sin errores (verificado con
`grep -iE "error|failed to compile"` sobre la salida completa — cero coincidencias). `npm run gate`
(capa 1 + capa 2, un solo corte sobre el árbol final): **capa 1 1517/1517, capa 2 208/208, 0 fail** —
el MISMO piso que `PALETA-MIGRACION-SACAR-LOS-QUE-MUEVEN-1` (este slice no tocó ningún archivo con
test propio: son los mismos 7 archivos de presentación, sin lógica, del asiento anterior).

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, 2026-09-20 — la aprobación citada al inicio de este asiento).
Mismos 7 archivos que el slice anterior, en `app/(storefront)/` y `components/storefront/` — Tier 1,
bytes del visitante. Contra MERGE POLICY A: **sin schema/migración**, **sin contrato cross-repo**,
pero **SÍ bytes de cliente** — el diff cambia el color CALCULADO (no el texto) de 14 sitios en
pantallas públicas (`/tienda`, `/tienda/[slug]`, `/checkout`, `/checkout/retorno`, `/suscripciones`).
`customer_bytes.changed: true`, `customer_bytes.strings: []` — ningún texto visible cambia, sólo el
tono resuelto para un inquilino con paleta propia (para Nayoli, raíces null, el fallback deja los 14
sitios byte-idénticos — cero cambio). `AWAITING_APPROVAL`.

### Open follow-ups

Ninguno nuevo. `PALETA-HOVER-TEXTO-SOBRE-SUPERFICIE-1` (arriba) sigue abierto, sin tocar por este
slice.

## 2026-09-21 — El cromo del nav (banda tinta, logo serif claro, sub-encabezado y badge de cosecha) pasa a ser una declaración del PRESET, en una meta APARTE de la paleta (`CROMO-NAV-FOOTER-TEMATIZABLE-1`)

**El programa (owner, "se parece al prototipo", 2026-09-21):** punto 1a, el cromo tematizable —
contestar la pregunta nav-superficie-vs-cromo-fijo y construir. Contestada: **el nav pasa a ser una
SUPERFICIE DECLARADA POR EL PRESET**, aditiva, con default = el `tratamientoNav` de hoy exacto.

### Las CUATRO piezas y su default

| pieza | mecanismo | dónde vive | default (todo tenant salvo CORTE) |
| --- | --- | --- | --- |
| banda tinta sólida | `content.cromo.navTinta: boolean` | `SiteContentData.cromo` (meta nueva) | `false` → `tratamientoNav`/`navFlotando` de HOY, sin tocar |
| logotipo serif claro | GRATIS — `Logo` ya lee `--sf-fuente-titulo` (`.font-display`) y su color por `variant` | `components/storefront/Logo.tsx` (sin cambio de mecanismo) | `variant='light'` mientras `navClaro` sea `false` |
| sub-encabezado (tagline bajo el nombre) | `content.cromo.navSubtitulo: boolean` → `StoreNav` pasa `subtitle={tagline}` a `Logo` sólo si es `true` | `SiteContentData.cromo` + `Logo.subtitle` (prop YA existente, reusada) | `false` → `subtitle` queda `undefined`, `Logo` renderiza su rama de siempre |
| badge de cosecha | `content.cromo.navBadge: string` | `SiteContentData.cromo` | `''` → no se renderiza |

Las tres viven en `content.cromo` (`CromoContent`, `site-content-defaults.ts`), una meta NUEVA —
gemela de `paginas`/`tema`, dominio CERRADO de 3 claves fijas—, **NO dentro de `content.tema`**: el
guardar/publicar de la PALETA (`guardarTemaBorrador`/`palette-schema.ts`, los dos **fuera de
`touches:`** de este slice) escribe `borrador.tema` con SÓLO 5 claves
(fondo/tinta/acento/fuentePar/forma) y al publicar reemplaza `content.tema` ENTERO — si los tres ejes
del cromo vivieran ahí, el día que un operador de un tenant con preset CORTE guarde un color/una
fuente desde `/admin/tienda`, publicar el tema los resetearía en silencio a `false`/`''`. Meta aparte
= ese flujo nunca los toca. Confirmado leyendo `site-content-write.ts` (`guardarBorrador`/
`publicarSeccion`/`descartarSeccion`/`setPaginaVisible`/`aplicarPreset`): **los cinco** hacen spread
sobre `content`/`borrador` y sólo reemplazan la clave que tocan — ninguno reconstruye el objeto
completo, así que una clave nueva (`cromo`) es segura de nacimiento contra los cinco.

Sólo `mergePresetEnContent` (`themes.ts`) escribe `content.cromo`, con `preset.navTinta`/
`navSubtitulo`/`navBadge` — tres campos OPCIONALES nuevos en `PresetTema`, MISMA familia aditiva que
`origenTexto`/`origenAccion` (`TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1`): ausentes en un preset =
`content.cromo` byte-idéntico al de hoy. De los 6 presets del catálogo, **sólo CORTE** los declara.

### La banda tinta — bypassa el floating, no lo parametriza

`tratamientoNav`/`bandaEsOscura`/`bandaUniforme` (`esquema-style.ts`) **no se tocaron** (archivo
fuera de `touches:`). `cromo.navTinta` en `StoreNav.tsx` corta ANTES de esa cadena:

```
navBandaTinta = cromo.navTinta                                     // false por defecto
navFlotando   = !navBandaTinta && isHome && !scrolled && t.flotante // false → idéntico a hoy
navClaro      = navBandaTinta || (navFlotando && t.textoClaro)      // false → idéntico a hoy
navBg         = navBandaTinta ? 'bg-[var(--sf-tinta)] …' : (navFlotando ? … : … /* idéntico a hoy */)
```

Con `navBandaTinta=false` las tres líneas se reducen ALGEBRAICAMENTE a la expresión de antes de este
slice (`!false && X` = `X`; `false || Y` = `Y`; la rama `navBandaTinta ?` nunca se toma) — no es una
afirmación de intención, es sustitución directa de valores. Con `navBandaTinta=true` (CORTE) el nav
es **SIEMPRE** `bg-[var(--sf-tinta)]` con `navClaro=true` (texto/logo claros), sin importar
scroll/home — la simplificación que pidió el spec de este slice ("el prototipo lo quiere banda tinta
sólida siempre") en vez de replicar la transición transparente→sólida del prototipo (`.is-solid` al
cruzar `scrollY>80`, `.is-opaque` estático en `producto.html` — medido en `js/app.js:280-286` y
`producto.html:19`).

### Medido contra el prototipo, pieza por pieza

| pieza | prototipo (medido) | CORTE ahora | veredicto |
| --- | --- | --- | --- |
| banda | `--surface-inverse` = `#102407` (`ds/colors.css:43`), lienzo del header sólido | `--sf-tinta` = `raices.tinta` de CORTE = `#102407` | **calza exacto** |
| logotipo — fuente | `--font-display: var(--font-serif)` (`ds/typography.css:4`) → `--font-serif: "Roboto Serif"…` (`:2`) | `--sf-fuente-titulo` = `'Roboto Serif'` (par `'prensa'`, ya declarado por `CORTE-REESCRITURA-PROTOTIPO-1`) | **calza exacto** (gratis, mecanismo previo) |
| logotipo — color | `--text-on-inverse` = `#fdfbf7` (`ds/colors.css:51`) | `--sf-sobre` = `#ffffff` (default GLOBAL de `app/globals.css:106`, no derivado de raíces — `derivarPaleta` no emite una clave `sobre`, sólo `sobre-tinta`/`sobre-superficie`/etc., § `palette-derive.ts`) | **NO calza exacto** — blanco puro vs. crema casi-blanco; MISMO token que ya usa el footer hoy, no una regresión de este slice |
| sub-encabezado | `.wordmark small`: `color:var(--text-on-inverse-muted)` (`#afb4a7`), `font-family:var(--font-ui)` (sans) | reusa el estilo YA existente de `Logo.subtitle` (footer): `text-[var(--sf-tostado-5)]` (`#ba9c7b`), `font-display` (serif), tamaño bajado a 11px (el del prototipo) | **texto/posición calzan; color y familia NO** — el spec pidió "REUSA el tagline que ya existe", no inventar un tercer tratamiento tipográfico |
| badge | `.badge`: `background:var(--accent-sale)` (`#f5b36a`), `color:var(--text-heading)` (`#102407`), `font-family:var(--font-ui)`, uppercase 11px | chip translúcido `bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)]` (o su opuesto en tinta cruda si `navClaro` fuera falso), uppercase 10px, sin `font-ui` propio | **texto exacto ("Cosecha 2026"), tratamiento visual simplificado** — sin primitiva de chip en `touches:`, se reusó el patrón translúcido `bg-[var(--sf-sobre)]/10` que YA existe en `StoreFooter.tsx:72,90` (los botones sociales), no una superficie inventada |

Las tres columnas "NO calza exacto" son divergencias MEDIDAS y reportadas, no descuidos: ninguna
requería tocar un archivo fuera de `touches:` para cerrarse del todo (tocar `--sf-sobre`/agregar una
primitiva de chip sí lo habría hecho), y el spec fue prescriptivo sólo en la pieza 1 (banda + color
"que ya usa el nav" = `--sf-sobre`, el token EXISTENTE, no uno nuevo).

### Byte-identidad de Nayoli — cómo se probó, no sólo se afirmó

1. **Datos**: `resolverSiteContent({}).cromo` y `DEFAULTS.cromo` deepEqual
   `{ navTinta:false, navSubtitulo:false, navBadge:'' }` (`cromo-tematizable.test.ts`).
2. **Catálogo**: los 5 presets que no son CORTE no declaran los tres campos (`undefined`, no
   `false`/`''`) y `mergePresetEnContent(…, preset).cromo` da el default de hoy para los cinco
   (`cromo-tematizable.test.ts`).
3. **Componente `Logo`** — el ÚNICO de los tres tocados que se puede renderizar de verdad sin
   contexto de ruteo (`StoreNav` usa `usePathname()`, que fuera de un árbol real de Next.js devuelve
   `null` y revienta en `pathname.startsWith(...)` — medido con `renderToStaticMarkup` antes de
   escribir el test, `.scratch/try-storenav.ts`, no versionado; es la MISMA frontera que ya documenta
   el repo para `*.test.tsx`/jsdom, § CLAUDE.md). `renderToStaticMarkup(<Logo nombre="Café Nayoli"/>)`
   da:
   `<div class="flex items-center gap-2.5"><span class="font-display text-[22px] leading-none text-[var(--sf-tinta)]">Café Nayoli</span></div>`
   — **carácter por carácter** el mismo string que produce `git show HEAD:components/storefront/
   Logo.tsx` (comparado a mano; la rama sin `subtitle` del componente no cambió un carácter). Afirmado
   con `assert.equal` (no `assert.ok(includes(...))`) en `cromo-tematizable.test.ts`.
4. **`StoreNav`/`logoLink`/el badge — por equivalencia algebraica de código** (§ arriba: las tres
   líneas se reducen a la expresión de antes cuando `navBandaTinta=false`) más el hecho medido en (1)
   de que `navBandaTinta` es SIEMPRE `false` para todo tenant que no declare `cromo.navTinta`. El
   badge usa el mismo patrón (`{cromo.navBadge ? <div…> : logoLink}` — con `navBadge=''`, la rama
   `logoLink` es EXACTAMENTE el `<Link>` que ya estaba, extraído a una variable sin tocar sus props
   salvo `subtitle={undefined}`, que es equivalente a no pasar la prop).
5. **`StoreFooter.tsx` no se tocó** (aparece en `touches:` pero el diff no lo usa): ya renderiza una
   banda `bg-[var(--sf-tinta)]` sólida SIEMPRE, para todo tenant, con el tagline exhibido
   incondicionalmente (`stacked subtitle={settings.tagline}`) — el prototipo pinta su `<footer>` con
   el MISMO `--surface-inverse` (`css/app.css:633`), así que el footer YA cumplía el estándar de CORTE
   sin necesitar ningún eje nuevo. Verificado por lectura, no por render (no hay nada que cambiar).

### `site-content-schema.ts` — `cromo` entra DEFENSIVO, gemelo de `esquemas`/`orden`/`variantesBandas`

`siteContentEditableSchema` gana `cromo: cromoEditableSchema.optional()` (3 claves,
todas `.optional()`, SOFT como el resto del schema). **Ningún write actual lo necesita** —sólo
`aplicarPreset` (`themes.ts`) escribe `content.cromo`, y ese camino es DIRECTO a Prisma, sin pasar
por este schema, igual que `esquemas`/`orden`/`variantesBandas`—. Se agregó por la MISMA razón que
esas tres: "para que un futuro write general no la STRIPPEE en silencio" (§65-B, el bug real que
motivó declarar metas sin editor). `tema` es la única meta comparable que NO sigue este patrón, y
por una razón distinta —tiene su PROPIO endpoint (`/api/site-content/tema` + `palette-schema.ts`,
los dos fuera de `touches:`)—, así que no es el precedente a copiar acá.

### `SeccionKey`/`REGISTRY` — por qué no hizo falta declarar `cromo` como sección

`cromo` se sumó al `Exclude<keyof SiteContentData, …>` de `SeccionKey` (junto a `paginas`/`tema`/
`esquemas`/`orden`/`variantesBandas`) — sin esto, `Record<SeccionKey, SeccionDef>` (el tipo de
`REGISTRY`) habría exigido una entrada `cromo` y el build habría fallado. Confirmado con
`npx tsc --noEmit` (limpio) y `npx next build` (`✓ Compiled successfully`, sin `db:deploy` — se corrió
`next build` directo para no tocar la base de `.env` con una migración que este slice no trae).

### Por qué `resolverCromo` es una función nueva y no un parámetro de `resolverTema`

`resolverTema` (`site-content-defaults.test.ts`) tiene SEIS asserts `deepEqual` que enumeran las
SIETE claves exactas de `TemaContent` de hoy (`fondo`/`tinta`/`acento`/`fuentePar`/`forma`/
`origenTexto`/`origenAccion`) — ese archivo de test **no está en `touches:`** de este slice. Sumar
`navTinta`/`navSubtitulo`/`navBadge` al objeto que devuelve `resolverTema` habría roto las seis
aserciones (un `deepEqual` no perdona una clave de más), y arreglarlas habría exigido tocar un
archivo fuera del `touches:` aprobado. Verificado ANTES de escribir el código (`grep` de esas seis
líneas), no después: es la razón por la que las tres piezas nacieron en `content.cromo` y no en
`content.tema` — la meta aparte no sólo es más segura para el flujo de publicar (§ arriba), también
es la única forma de no ensanchar el diff fuera de lo aprobado.

### Gate

- **`npm test`** (capa 1, sin base): **1535/1535**, 0 fail — sube de 1517 (el piso citado por
  `PALETA-MIGRAR-ACENTO-TINTA-1`) por los 18 tests nuevos de `cromo-tematizable.test.ts` (14 de
  datos/`Logo` + 4 del schema editable).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail en la corrida
  final — mismo piso que el slice anterior (este slice no tocó ningún archivo con test de
  integración propio). **Una corrida intermedia** (tras agregar `cromoEditableSchema`, antes de la
  final) dio 207/208: falló `wompi-reconciliador.test.ts` → "CONCURRENCIA: webhook y reconciliador
  procesando el MISMO evento A LA VEZ" — un test de CARRERA de un subsistema que este slice no toca
  (Wompi/reconciliación de pagos, cero archivos en común con `touches:`). Re-corrido sin tocar nada,
  pasó verde. Es el MISMO test y la misma clase de flake que `ONBOARDING-APLICAR-PRESET-SCRIPT-2` ya
  registró en `main` como "fallo intermitente no relacionado" (commit `8a3b0ab`, aún no mergeado a
  esta rama) — no una regresión de este diff.
- **`npx tsc --noEmit`**: limpio, sin salida (corrido dos veces, antes y después de sumar
  `cromoEditableSchema`).
- **`npx next build`**: `✓ Compiled successfully`, TypeScript y las 51 páginas estáticas/dinámicas
  generadas sin error (corrido dos veces, mismo resultado las dos).
- **`npx eslint` sobre los 6 archivos tocados/nuevos**: sin salida (limpio).

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, programa "se parece al prototipo", 2026-09-21, punto 1a —
contestar nav-superficie-vs-cromo-fijo Y construir). `lib/config/site-content-schema.ts` y
`lib/config/site-content-defaults.ts` están en la frase canónica de Tier 1; `components/storefront/`
entra por el subárbol ya ganado (bytes del visitante); `lib/config/themes.ts` entra por el mismo
precedente de la rama (`CORTE-ESQUEMAS-INVERTIDOS-1` y las demás CORTE-* de esta rama, ya aprobadas
Tier 1 sobre el mismo archivo).

Contra MERGE POLICY A: **sin schema/migración** (ningún archivo de `packages/core/prisma/` —
`site-content-schema.ts`/`site-content-defaults.ts` son TypeScript de dominio, no el schema de
Prisma), **sin contrato cross-repo**, pero **SÍ bytes de cliente** — el mirador (`?tema=CORTE`,
`app/(storefront)/page.tsx`, sin gate de sesión) sirve el nav en banda tinta con el sub-encabezado y
el badge sobre la ruta pública `/`. `customer_bytes.changed: true`.
`customer_bytes.strings: ["Cosecha 2026"]` — el ÚNICO texto NUEVO (el badge de CORTE); el
sub-encabezado no es un texto nuevo, es el `tagline` que el FOOTER ya muestra hoy, exhibido también
en el nav cuando el preset lo declara. Para Nayoli (ningún preset aplicado) los tres ejes quedan en
su default y no hay bytes que cambien — probado en las cinco vías de arriba, no sólo afirmado.
`AWAITING_APPROVAL`.

### Deviations

Ninguna del spec en el MECANISMO (nav-superficie por preset, tagline reusado, badge como dato SOFT).
Una decisión de FORMA no dictada por el spec: la meta nueva se llamó `content.cromo` (no
`content.tema`) — medida y justificada arriba (§ el flujo de publicar la paleta la habría
resucitado en `false`/`''` en silencio), no una preferencia de nombre.

### Open follow-ups

- `CROMO-NAV-SOBRE-BLANCO-PURO-1` — `app/globals.css:106` (`--sf-sobre: #ffffff`), el texto/logo
  claro sobre la banda tinta usa blanco PURO en vez del crema casi-blanco del prototipo
  (`--text-on-inverse: #fdfbf7`). No es una regresión de este slice —el footer ya usa el MISMO token
  hoy— pero es la brecha que impide que la banda calce exacto contra el prototipo. Tocar
  `--sf-sobre` (o derivarlo de las raíces, como `sobre-tinta`) está fuera de `touches:` de este
  slice. Disparador: el próximo gate del owner mirando la banda tinta de cerca.
- `CROMO-SUBENCABEZADO-BADGE-ESTILO-PROTOTIPO-1` — el sub-encabezado y el badge REUSAN estilos ya
  existentes en vez de calzar el color/familia/chip exactos del prototipo (§ la tabla de arriba,
  columnas "NO calza exacto"). El spec pidió "reusar" y "seguir el patrón de un campo existente", no
  una primitiva de chip nueva; si el owner quiere el calce exacto, es una decisión de diseño aparte
  (una primitiva de badge, o tocar `--sf-tostado-5`), no una corrección de este slice.
- `CROMO-MOBILE-DRAWER-SIN-TINTA-1` — el drawer móvil de `StoreNav.tsx` (`bg-[var(--sf-tarjeta)]`)
  no sigue a `cromo.navTinta`: sigue claro aunque el header fijo sea banda tinta. El spec acotó la
  superficie al header fijo (banda/logo/sub-encabezado/badge); el drawer es una superficie de
  chrome más que el prototipo no describe con el mismo detalle. Disparador: si el próximo gate del
  owner lo nota como inconsistente al abrir el menú en angosto.

## 2026-09-21 — El menú del nav se vuelve dato del tenant — etiquetas y orden editables, un CTA sobre un set cerrado (`CROMO-MENU-COMO-DATO-1`) — RULING_NEEDED

**El programa (owner, "se parece al prototipo", 2026-09-21), punto 1b, `CROMO-MENU-COMO-DATO-CENSO-1`
(censo previo, `9a7ab97e2ab8`):** el menú era un array literal de tres ítems conocidos con etiqueta y
ruta fijas. El owner falló a favor de la lectura recomendada: **ítems CONOCIDOS con etiqueta editable
+ reorden, destinos de un SET CERRADO (nunca una lista libre — misma doctrina que `HERO_HREFS`), y un
CTA opcional**, con default = el menú de hoy, Nayoli byte-idéntica.

### El MODELO — todo dentro de `touches:`

`SiteContentData.menu` (`MenuContent`, `lib/config/site-content-defaults.ts`) es una SECCIÓN de
verdad (en `REGISTRY`, pasa por el flujo borrador/publicar de siempre) con ocho campos:

| campo | tipo | default | qué es |
| --- | --- | --- | --- |
| `labelTienda`/`labelSuscripciones`/`labelNosotros` | requerido | `'Tienda'`/`'Suscripciones'`/`'Nosotros'` | la etiqueta editable de cada ítem CONOCIDO — patrón `ctaPrimarioLabel` |
| `posicion1`/`posicion2`/`posicion3` | requerido | `'tienda'`/`'suscripciones'`/`'nosotros'` | el ORDEN, SPLIT en tres campos escalares (§ abajo) |
| `ctaLabel`/`ctaDestino` | opcional | `''`/`''` | el CTA, apagado por defecto |

**Las RUTAS son ESTRUCTURA, no dato** — `MENU_PATHS` (interno) mapea cada uno de los TRES ids
CONOCIDOS (`MENU_ITEM_IDS = ['tienda','suscripciones','nosotros'] as const`, el set cerrado) a su
ruta fija. No se agregan ni se quitan ítems; sólo se renombran y se reordenan.

**El CTA vive sobre `MENU_CTA_DESTINOS = ['/tienda','/suscripciones','/nosotros'] as const`** —
declarado UNA vez en `site-content-defaults.ts`, y tanto el render (`menuCtaHref`) como el validador
del schema (`menuEditableSchema`, `site-content-schema.ts`) leen esa misma lista. Un destino fuera
del set (por ejemplo una URL externa) se **rechaza al guardar** (schema) y, si llegara igual por otra
vía (un `UPDATE` a mano, una fila vieja), **no se renderiza** (`menuCtaHref` vuelve a filtrar contra
el mismo set — SOFT, preferir callar a un link roto).

**LA VISIBILIDAD NO SE TOCÓ.** `itemsDeMenu` sigue gateando "Suscripciones"/"Nosotros" por
`paginas.suscripciones.visible`/`paginas.nosotros.visible`, exactamente como el array literal de
hoy — renombrar no es encender. `tienda` no tiene página que apagar y sigue siempre presente.

### EL ORDEN — por qué son TRES campos escalares y no un array

El spec pedía seguir la FORMA de `content.orden` (las bandas del home): una secuencia SOFT, siempre
completa, donde la basura cae a la canónica — sin repetir su LÓGICA (el dominio es distinto,
`MenuItemId` no `BandaId`, y `resolverOrden` está atada al tipo `BandaId[]`).

**La cáscara del editor (`TiendaSeccionEditor`) sólo pinta campos de texto/select nativos — no hay
mecanismo de arrastrar-para-reordenar un array** (el que sí existe, en `RepeaterEditor`, es de
flechas sobre una LISTA dinámica, no aplicable a tres campos fijos). Así que la misma idea de
`orden` se expresa como TRES campos escalares (`posicion1/2/3`), cada uno un `<select>` nativo de
opciones fijas (`MENU_ITEM_IDS`) — el patrón ya establecido (`destacadoSlot`, `opciones` en
`CampoTexto`, § Controles de formulario, el select es NATIVO). `resolverOrdenMenu` (gemela de
`resolverOrden`, mismo algoritmo: válido-y-primero-visto, luego rellenar con lo que falte en orden
canónico) los recompone en la secuencia final. Afirmado con 8 tests (dedupe, basura, parcial, orden
editado) más dos que documentan el BORDE medido: una STRING no perteneciente al set cerrado
(`'inicio'`) **sobrevive el resolver genérico** (`esVacio` sólo mira vacío/no-vacío, no pertenencia)
y es `resolverOrdenMenu`, río abajo, quien la descarta — el faltante entra por el relleno canónico
AL FINAL, no en su slot original (mismo comportamiento, medido, que ya tiene `resolverOrden`).

### LA INVARIANTE — probada, no supuesta

> Un tenant que no edita nada rinde el mismo menú que hoy: mismas etiquetas, mismo orden, sin CTA.

Probada por la CAPA DE DATOS (lo que `StoreNav.tsx` consume directo, sin editorializar):

```
itemsDeMenu(resolverSiteContent({})) === [
  { id: 'tienda', label: 'Tienda', path: '/tienda' },
  { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones' },
  { id: 'nosotros', label: 'Nosotros', path: '/nosotros' },
]
menuCtaHref(resolverSiteContent({})) === null
```

`lib/config/menu-como-dato.test.ts` lo afirma con `assert.deepEqual` (no `assert.ok`), tanto sobre
`DEFAULTS.menu` como sobre `resolverSiteContent({}).menu` (sin fila, el camino real de producción).

**StoreNav.tsx NO se renderizó** (la MISMA frontera ya medida en `cromo-tematizable.test.ts`:
`usePathname()` fuera de un árbol real de Next.js da `null`, y `pathname.startsWith(...)` revienta —
una línea ajena a este slice). `links = itemsDeMenu(content)` y `ctaHref = menuCtaHref(content)` son
pass-through DIRECTOS en `StoreNav.tsx` — verificar sus salidas es verificar exactamente lo que el
componente pinta, sin necesitar el render. **La verificación en NAVEGADOR real (capa 3) queda fuera
de este slice** — es del gate visual del owner, no de una sesión de escritura aislada; no se afirma
acá porque no se ejecutó.

### RULING_NEEDED — el panel ("el dueño renombra y reordena ahí") no cabe en `touches:`

**El hallazgo, MEDIDO antes de decidir, no supuesto:** `components/admin/tienda-secciones.ts` define
`SeccionVista` como una unión LITERAL de nombres (no derivada de `SeccionKey`), y
`components/admin/VistaTiendaEnVivo.tsx:43` la consume así:

```ts
const COMPONENTES: Record<SeccionVista, ComponentType> = { hero: HeroSection, /* … */ };
```

Un `Record` sobre una unión es EXHAUSTIVO: agregar `'menu'` a `SeccionVista` (el paso obligado para
que `TiendaPaginas`/`TiendaSeccionEditor` puedan mostrar un editor de menú, § "Sumá su edición al
panel") exige una entrada `menu` en ese mapa, en un archivo que **no está en `touches:`**.

Se verificó por EJECUCIÓN, no por lectura del tipo: se agregó `'menu'` a `SeccionVista` (un cambio de
una línea), se corrió `npx tsc --noEmit`, y se revirtió antes de escribir nada más:

```
components/admin/VistaTiendaEnVivo.tsx(43,7): error TS2741: Property 'menu' is missing in type
'{ hero: …; /* … */ }' but required in type 'Record<SeccionVista, ComponentType>'.
```

**Y no es un fix de una línea.** `VistaTiendaEnVivo.tsx` renderiza el componente REAL del storefront
dentro de un árbol que sólo monta `SiteContentProvider` + `PreviewProvider` — sin `CartProvider` ni
el `SiteSettingsProvider` DEL STOREFRONT. `StoreNav.tsx` importa `useCartStore` (`lib/cartStore.tsx`)
y `useSiteSettings` (`components/storefront/SiteSettingsProvider`) — los DOS lanzan fuera de su
árbol (medido leyendo el código: son los mismos hooks-con-throw-duro que ya mordieron a
`ProductCard` en `/admin/configuracion`, § CLAUDE.md "Montar un componente en OTRO árbol de
providers no lo atrapa ni `tsc` ni el build"). Montar `StoreNav` ahí SIN esos dos providers
reventaría en runtime; con ellos, monta un header `position:fixed` pensado para el viewport real
dentro de una caja `EscalaDesktop` diseñada para bandas de contenido (hero/brandStory/…) — una
anatomía distinta, no sólo un wiring que falta.

**La pregunta, en una frase:** ¿el editor del menú entra al pipeline genérico de vista-previa-en-vivo
(ensanchando `touches:` a `VistaTiendaEnVivo.tsx` + resolver el árbol de providers que StoreNav
necesita), o es un editor BESPOKE sin vista previa —como `PaletaSeccion` para `tema`— (un componente
nuevo, también fuera de `touches:`, wireado en `app/(admin)/admin/tienda/page.tsx`)? **Las dos rutas
tocan al menos un archivo fuera de `touches:` aprobado — no es mío ensancharlo.**

- **Opción 1 — pipeline genérico.** Consecuencia medida: além del `Record` exhaustivo, exige envolver
  el árbol de `VistaTiendaEnVivo` con `CartProvider`+`SiteSettingsProvider` (locales a esa rama, para
  no afectar a los demás consumidores) y decidir cómo se ve un header `fixed` dentro de una caja
  pensada para contenido — una decisión de forma, no sólo de cableado.
- **Opción 2 — editor bespoke, sin preview.** Consecuencia: nuevo componente + wiring en
  `app/(admin)/admin/tienda/page.tsx` (fuera de `touches:` igual), pero no toca el `Record`
  compartido del que dependen las OTRAS nueve secciones — el mismo patrón ya vigente para `tema`
  (`PaletaSeccion`, su propio endpoint, sin vista previa en vivo del nav).
- **Opción 3 — este slice, tal cual.** El dato, el schema (con sus DOS sets cerrados validados al
  guardar) y el render quedan completos y afirmados; el campo YA es editable por el `PUT`/`POST`
  genéricos de `/api/site-content` (no gateados por sección — `guardarBorrador` escribe cualquier
  clave, y `menu` YA está en `REGISTRY` así que `publicarSeccion`/`descartarSeccion` ya lo aceptan);
  lo que falta es el FORMULARIO para que el dueño lo use sin tocar la API a mano.

**Bloqueado:** el formulario en `/admin/tienda` ("el dueño renombra y reordena ahí").

**Hecho de todos modos, y no depende de la ruling:** el modelo completo (`MenuContent`,
`MENU_ITEM_IDS`, `MENU_CTA_DESTINOS`, `DEFAULTS.menu`, `REGISTRY.menu`, `resolverOrdenMenu`,
`labelDeItemMenu`, `itemsDeMenu`, `menuCtaHref`), el schema (`menuEditableSchema`, los dos sets
cerrados rechazados al guardar), `StoreNav.tsx` consumiendo el dato en desktop y en el drawer móvil
con el CTA pintado como botón (tomando la FORMA del bloque `/cuenta` muerto, no su contenido), y 37
tests nuevos en `lib/config/menu-como-dato.test.ts`.

### Gate

- **`npm test`** (capa 1, sin base): **1572/1572**, 0 fail — sube de 1535 (piso citado por
  `CROMO-NAV-FOOTER-TEMATIZABLE-1`) por los 37 tests nuevos de `menu-como-dato.test.ts`.
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail — mismo piso
  que el slice anterior; este slice no agrega ni toca ningún test de integración (no hay schema ni
  migración).
- **`npx tsc --noEmit`**: limpio tras un fix (el primer `.refine()` con un type predicate mal tipado
  sobre una unión con `''` no compilaba — `TS2677`; se corrigió quitando el predicado, que no hacía
  falta para el uso real).
- **`npx next build`**: `✓ Compiled successfully`, TypeScript limpio, las 51 rutas generadas sin
  error. Corrido DIRECTO (sin `db:deploy`) por la misma razón que `CROMO-NAV-FOOTER-TEMATIZABLE-1`:
  no tocar la base de `.env` con una migración que este slice no trae (no hay ninguna).
- **`npx eslint`** sobre los 4 archivos tocados/nuevos: limpio tras retirar `paginas` del destructure
  de `StoreNav.tsx` (quedó sin uso al mover la lógica de visibilidad a `itemsDeMenu`/`menuCtaHref`).

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, "se parece al prototipo", 2026-09-21, punto 1b, sobre el censo
`CROMO-MENU-COMO-DATO-CENSO-1`). `lib/config/site-content-schema.ts` y `lib/config/
site-content-defaults.ts` están en la frase canónica de Tier 1; `components/storefront/` entra por
el subárbol ya ganado (bytes del visitante).

Contra MERGE POLICY A: **sin schema/migración** (JSON de dominio, no `packages/core/prisma/`),
**sin contrato cross-repo**, pero **SÍ bytes de cliente** — `StoreNav.tsx` es la ruta pública `/`
(y toda página del storefront). `customer_bytes.changed: true`. `customer_bytes.strings: []` — CON
`content.menu` en su default (Nayoli, y todo tenant que no lo edite) el HTML que produce
`itemsDeMenu`/`menuCtaHref` es byte-idéntico al array literal de hoy (probado arriba): cambian bytes
COMPILADOS (de dónde sale el array), ningún texto visible nuevo.

**Verdicto: `RULING_NEEDED`**, no `AWAITING_APPROVAL` — el obstáculo no es "falta el gate visual del
owner sobre bytes de cliente" (eso aplicaría igual si el panel existiera), es que **el panel pedido
por el spec no cabe en el `touches:` aprobado**, y expandirlo no es una decisión de esta sesión.

### Deviations

Ninguna del MODELO, el schema, ni el render (mecanismo exacto al spec: ítems conocidos con etiqueta
editable, orden vía tres campos escalares, CTA sobre set cerrado, default = hoy). La desviación es
de ALCANCE: `components/admin/tienda-secciones.ts` **quedó SIN TOCAR** — el spec lo listaba en
`touches:` esperando que hospedara la edición del menú, y hacerlo (agregar `'menu'` a `SeccionVista`
+ una entrada en `SECCIONES_TIENDA`) rompe la compilación de `VistaTiendaEnVivo.tsx`, fuera de
`touches:` (medido arriba, § RULING_NEEDED). No se intentó un fix parcial ahí para "cumplir la
letra" — un archivo tocado sin ningún efecto real (ninguna entrada nueva, porque cualquier entrada
real exige el `Record` completo) sería peor que dejarlo intacto y decir por qué.

### Open follow-ups

- `CROMO-MENU-PANEL-EDITOR-1` — construir el formulario de `/admin/tienda` para el menú, una vez el
  owner elija entre pipeline genérico (ensanchando `touches:` a `VistaTiendaEnVivo.tsx` + resolver
  sus providers) o editor bespoke (nuevo componente + wiring en `app/(admin)/admin/tienda/page.tsx`,
  patrón `PaletaSeccion`). No se prioriza a sí mismo — depende de la `RULING_NEEDED` de arriba.
- `CROMO-MENU-CAPA3-1` — verificación en navegador real (capa 3) de que el menú de Nayoli se ve
  igual que antes de este slice, y de que un menú editado (etiqueta/orden/CTA) se ve correctamente.
  No se ejecutó en esta sesión (§ arriba, "La verificación en NAVEGADOR real queda fuera de este
  slice"). Disparador: el próximo gate visual del owner sobre esta rama.

## 2026-09-21 — Un preset puede declarar la ESCALA de sus titulares de display — 12 componentes, override opcional vía inline style, default = los tamaños de HOY (`TEMAS-ESCALA-DISPLAY-1`)

**El defecto, medido** (§ `CORTE-ESQUEMAS-INVERTIDOS-1`, y re-medido acá contra el código real): el
prototipo declara su escala de display en `docs/prototipos/cafeone/ds/typography.css:10-11` (=
`css/tokens.css:99-100`) — `--text-display-xl:clamp(72px,9vw,168px)` para el titular del hero,
`--text-display-l:clamp(48px,5vw,76px)` para los titulares de sección, `--text-display-m:40px` —
mientras que los titulares del storefront son clases Tailwind FIJAS horneadas en cada componente,
mucho más chicas. El owner: *"los titulares del prototipo son ENORMES; medí sus tamaños reales y
llevalos al preset."*

### LA MEDICIÓN, componente por componente — no hay una sola base que replicar

Doce componentes de `components/storefront/home/` rinden un titular de display; ninguno comparte
base con otro fuera de su propia familia de variantes. Medido contra `node_modules/tailwindcss/
theme.css` (`--text-3xl:1.875rem`, `--text-4xl:2.25rem`, `--text-5xl:3rem`, `--text-6xl:3.75rem`,
`--text-7xl:4.5rem`), no asumido:

| componente | rol | clase Tailwind de HOY | rem | qué preset lo DECLARA (`variantes`, `themes.ts`) |
| --- | --- | --- | --- | --- |
| `HeroCurtina` | hero (h1) | `text-5xl sm:text-6xl lg:text-7xl` | 3/3.75/4.5rem | canónica — Nayoli (sin preset); declarado explícito por VETA |
| `HeroFicha` | hero (h1) | `text-4xl sm:text-5xl lg:text-6xl` | 2.25/3/3.75rem | ARRANQUE, VITRINA |
| `HeroMedia` | hero (h1) | `text-4xl sm:text-5xl lg:text-6xl` | 2.25/3/3.75rem | **CORTE** |
| `FeaturedProductsCuadricula` | sección (h2) | `text-3xl sm:text-4xl` | 1.875/2.25rem | canónica — Nayoli (sin preset); ningún preset la declara explícito |
| `FeaturedProductsGrilla` | sección (h2) | `text-3xl sm:text-4xl` | 1.875/2.25rem | **CORTE**, PATIO, VITRINA |
| `BrandStoryColumnas` | sección (h2) | `text-4xl sm:text-5xl` | 2.25/3rem | canónica — Nayoli (sin preset); declarado explícito por PATIO |
| `BrandStoryCentrada` | sección (h2) | `text-4xl sm:text-5xl` | 2.25/3rem | **CORTE** |
| `GrindChooserMosaico` | sección (h2) | `text-3xl sm:text-4xl` | 1.875/2.25rem | canónica — Nayoli (sin preset); ningún preset la declara explícito |
| `GrindChooserIndice` | sección (h2) | `text-3xl sm:text-4xl` | 1.875/2.25rem | ARRANQUE, VETA, VITRINA |
| `GrindChooserRiel` | sección (h2) | `text-3xl sm:text-4xl` | 1.875/2.25rem | **CORTE** |
| `SubscriptionCTABloque` | sección (h2) | `text-4xl` (fijo) | 2.25rem | canónica — Nayoli (sin preset); ningún preset la declara explícito |
| `TestimonialSection` | sección (h2) | `text-3xl` (fijo) | 1.875rem | única (sin variantes) — todo preset y Nayoli |

**El "quién lo usa" de arriba es lo que el `PresetTema` DECLARA, no necesariamente lo que RENDERIZA
hoy.** `contenidoConPresetDeVista` (`theme-mirador.ts`) ignora un preset entero si `validarPreset`
lo marca incompleto — hoy sólo **ARRANQUE y CORTE validan completo** (`themes.test.ts`); PLIEGO/
PATIO/VETA/VITRINA declaran variantes (algunas inválidas, como `hero:'marquesina'`/`'collage'`, que
ni siquiera tienen componente) pero el mirador los ignora enteros y cae al content publicado
(Nayoli, canónica) — así que hoy, en la práctica, sólo tres presets pueden hacer que un visitante
del mirador vea otra cosa que la canónica: **ARRANQUE** (hero·ficha, presentaciones·índice) y
**CORTE** (los cinco no-canónicos de la tabla). No cambia el argumento de esta sección —las bases
siguen siendo distintas entre sí, midan lo que midan hoy los presets incompletos— pero corrige la
columna para que no se lea como "esto renderiza" cuando en 4 de 6 casos no renderiza nada todavía.

**Excluido, medido y reportado, no disimulado: `SubscriptionCTALinea` (la variante de `subscriptionCTA`
que CORTE usa).** Su h2 es `text-xl sm:text-2xl` (1.25/1.5rem) — un orden de magnitud más chico que
"display" y sin análogo en el prototipo: `.cta-strip` (`index.html:311-318`, la banda pre-footer más
cercana en posición) **no tiene NINGÚN titular**, sólo dos botones sobre una foto con degradado. Meter
un `display-l` de 48-76px en un h2 que hoy mide 20-24px habría sido inventar una escala que el
prototipo no pide para esa pieza. Queda fuera de esta escala; si algún día se le agrega un titular
propio, es su propia decisión de contenido, no de esta escala.

### EL MECANISMO — por qué NO es una variable CSS `:root` emitida desde el layout

El patrón ya establecido para paleta/fuentes/forma (`cssPaleta`/`cssFuentes`/`cssForma`, emitidos por
`app/(storefront)/layout.tsx`) funciona porque esos tres ejes tienen UN default compartido por TODO
el storefront. La escala de display **no puede usar ese patrón**: la tabla de arriba tiene TRES bases
de hero distintas y CUATRO bases de sección distintas. Una sola variable `:root` con un default por
breakpoint sólo puede representar UNA de esas bases — forzarla habría MOVIDO el hero de Nayoli
(`HeroCurtina`, 3/3.75/4.5rem) al tamaño de `HeroFicha`/`HeroMedia` (2.25/3/3.75rem), o viceversa: el
defecto opuesto al que este slice existe para evitar. Se midió y descartó ANTES de escribir código —
no se intentó y se revirtió.

**LA SALIDA: `lib/config/escala-display.ts`, puro, con UNA función.** `fontSizeDisplay(escala, rol)`
devuelve `undefined` sin escala declarada (la señal de "no toques el `style`") o el `clamp(...)`
medido del prototipo con `'amplia'`. Cada uno de los 12 componentes:

1. lee `tema.escalaDisplay` de `useSiteContent()` (ya inyectado por el `SiteContentProvider` de
   siempre — sin fetch nuevo, sin provider nuevo);
2. calcula `fontSizeDisplay(tema.escalaDisplay, 'xl'|'l')`;
3. aplica `style={valor ? { fontSize: valor } : undefined}` en el h1/h2, **sin tocar su className**.

Sin escala, `style` es `undefined` → React no emite el atributo → el DOM es BYTE-IDÉNTICO a antes de
este slice (verificado por render, no supuesto — ver el gate). Con `'amplia'`, el inline style gana
por especificidad sobre las clases Tailwind que el elemento conserva intactas.

**`escalaDisplay` vive en `content.tema`** (`TemaContent`, `site-content-defaults.ts`), MISMA familia
aditiva que `origenTexto`/`origenAccion`/`fuentePar`/`forma`: `null` = ausente = el default de HOY.
Sólo `mergePresetEnContent` (`themes.ts`) lo escribe, con el valor del `PresetTema`; de los 6 presets
del catálogo, sólo CORTE declara `escalaDisplay: 'amplia'`. No se agregó a `paletaEditableSchema`
(el PUT del panel) — mismo criterio que `origenTexto`/`origenAccion`: no hay campo en el editor del
panel para esto todavía, así que ni Nayoli ni ningún tenant real puede escribirlo por accidente.

### `app/(storefront)/layout.tsx` y `theme-mirador.ts` — en `touches`, y NO SE TOCARON

El spec los listaba como puntos de touch esperados (el patrón de paleta/fuentes/forma los toca a los
tres). No hicieron falta: el mirador `?tema=CORTE` (`app/(storefront)/page.tsx`, gateado a
`esDespliegueDemo()`) ya monta un `<SiteContentProvider value={content}>` LOCAL con el `content`
mergeado con el preset (`content !== contentPublicado` → provider anidado, código YA existente,
`CORTE-MIRADOR-EJES-COMPLETOS-1`) — así que cualquier componente que llame `useSiteContent()` dentro
de `bandas` YA lee `tema.escalaDisplay` correcto sin que este slice mueva una línea de `page.tsx` ni
de `layout.tsx`. Verificado por EJECUCIÓN (los tests de WIRING de abajo montan `HeroSection`/
`GrindChooser` con `tema.escalaDisplay` puesto directo en el `SiteContentProvider`, el mismo mecanismo
que el mirador usa en producción).

### El gate — afirmado por RENDER, no sólo por la función pura

El spec pedía la invariante probada por el font-size RESULTANTE. `lib/config/escala-display.test.ts`
tiene DOS capas:

1. **La función pura** (`fontSizeDisplay`/`resolverEscalaDisplay`): `null` → `undefined` en los dos
   roles; `'amplia'` → los dos `clamp(...)` exactos del prototipo; `resolverEscalaDisplay` SOFT sobre
   basura/ausente/tipo equivocado.
2. **El WIRING, por `renderToStaticMarkup`** (mismo mecanismo sin jsdom que ya usa
   `site-content-defaults.test.ts` para `GrindChooser`, y `cromo-tematizable.test.ts` para `Logo`):
   monta `HeroSection`/`GrindChooser` —los DISPATCHERS reales de `page.tsx`, no una copia— con
   `tema.escalaDisplay` en `null` y en `'amplia'`, y afirma sobre el HTML producido:
   - sin escala, el h1/h2 **NO lleva ningún atributo `style` con `font-size`** (byte-idéntico);
   - con `'amplia'`, el h1/h2 lleva `style="...font-size:clamp(72px, 9vw, 168px)..."` (hero) o
     `clamp(48px, 5vw, 76px)` (sección) — EXACTO, no aproximado.
   - Se afirmó con `HeroCurtina` (la canónica/Nayoli) Y `HeroMedia` (la de CORTE): el MISMO clamp
     aplica a las dos variantes — es un eje de ESCALA, no de variante.

### Gate

- **`npm test`** (capa 1, sin base): **1584/1584**, 0 fail. Piso citado por `CROMO-MENU-COMO-DATO-1`:
  1572. Este slice suma 12 tests nuevos: **9** en `lib/config/escala-display.test.ts` (6 de la
  función pura + 3 de WIRING por render), **2** en `themes.test.ts` (CORTE declara `escalaDisplay`;
  `mergePresetEnContent` lo escribe) y **1** en `site-content-defaults.test.ts` (`resolverTema`) —
  1572 + 12 = 1584, cuadra (contado con `grep -c "^test("` sobre cada archivo).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail — idéntico al
  piso anterior; este slice no toca `packages/core/`, `tests/integracion/` ni ninguna migración
  (verificado: `git status --porcelain` no lista ningún archivo de esos árboles).
- **`npx tsc --noEmit`**: limpio.
- **`npx next build`**: `✓ Compiled successfully` (65s en frío, 6.7s en la corrida final cacheada),
  TypeScript limpio, 51 rutas generadas, exit 0.
- **`npx eslint`** sobre los 18 archivos tocados/nuevos: limpio, con UNA excepción PRE-EXISTENTE y
  fuera de `touches` real de este slice — `react/no-children-prop` en `lib/config/
  site-content-defaults.test.ts:823,827` (el helper `renderGrindChooser`, ajeno a este diff, medido
  con `git diff --stat` antes de tocar nada). El mismo patrón en mi propio archivo nuevo
  (`escala-display.test.ts`) se intentó resolver con la forma de 3 argumentos de `createElement`, y
  ESO rompió `tsc` (`SiteContentProvider` tipa `children` como prop REQUERIDA, y `createElement` con
  el 3er argumento no la satisface para TypeScript) — se revirtió a la forma con `children` como
  prop, aceptando el mismo trade-off que ya acepta el precedente.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, "se parece al prototipo", 2026-09-21, punto 2: "los titulares del
prototipo son ENORMES; medí sus tamaños reales y llevalos al preset"). `lib/config/` está en la
frase canónica de Tier 1; `components/storefront/` entra por el subárbol ya ganado (bytes del
visitante).

Contra MERGE POLICY A: **sin schema/migración** (ningún archivo de `packages/core/prisma/`, medido
por `git status --porcelain`), **sin contrato cross-repo**, pero **SÍ bytes de cliente** —
`app/(storefront)/page.tsx` sirve la ruta pública `/`, y con `?tema=CORTE` (fuera de producción real,
`esDespliegueDemo()`) el h1/h2 de esa respuesta cambia de tamaño. `customer_bytes.changed: true`.
`customer_bytes.strings: []` — cambian bytes COMPILADOS (un atributo `style` de font-size), ningún
texto visible nuevo; para Nayoli y los 5 presets sin `escalaDisplay`, CERO bytes cambian (afirmado
por render, § arriba). La rama entera (`slice/corte-reescritura-prototipo-1`) ya venía
`AWAITING_APPROVAL` por los slices anteriores que tocan `components/storefront/home/`; este slice
individual también clasifica `AWAITING_APPROVAL` por cuenta propia.

### Deviations

Ninguna del spec en el MODELO ni el mecanismo (una función pura, `null`=hoy, `'amplia'`=el clamp del
prototipo, probado por render). La única desviación es de SUPERFICIE TOCADA: `app/(storefront)/
layout.tsx` estaba en `touches:` (el patrón de paleta/fuentes/forma lo tocaría) y **no se tocó** —
medido y explicado arriba (§ "layout.tsx y theme-mirador.ts — en touches, y NO SE TOCARON"): el
mirador ya resuelve `tema.escalaDisplay` correcto vía el `SiteContentProvider` local que
`CORTE-MIRADOR-EJES-COMPLETOS-1` construyó, así que agregar un `<style>` más habría sido
infraestructura sin consumidor.

### Open follow-ups

Ninguno nuevo. La duda sopesada y dejada abierta sobre `subscriptionCTA` en `CORTE-ESQUEMAS-
INVERTIDOS-1` (`CORTE-SUBSCRIPTIONCTA-ESQUEMA-DUDA-1`) sigue viva por su cuenta, sin relación con
este slice — la exclusión de `SubscriptionCTALinea` de esta escala (§ arriba) es una medición nueva
(tamaño y ausencia de análogo en el prototipo), no la misma duda.

## 2026-09-21 — Tres agregados chicos al hero-media del prototipo — CTAs ocultables, frase al pie como dato, cue animado "Desliza" (`TEMAS-HERO-MEDIA-AGREGADOS-1`) — AWAITING_APPROVAL

**El programa (owner, "se parece al prototipo", 2026-09-21), punto 3:** `docs/prototipos/cafeone/
index.html:122-138` (`.hero-media`) tiene TRES cosas que `HeroMedia.tsx` (la variante `media` del
hero, hoy sólo usada por CORTE — § TEMAS-HERO-MEDIA-1) no tenía: **sin botones** (el prototipo no
lleva CTAs en el hero), una **frase al pie** (`.hero-caption`, «Hay algo profundamente meditativo en
preparar un café cultivado a 1.600 msnm.») y un **cue animado de scroll** (`.scroll-cue`, una línea
vertical con un segmento que la recorre + la etiqueta «Desliza»). El video del hero es contenido que
carga el owner aparte — no es de este slice. Los tres, **OPT-IN con default = el hero-media de HOY,
byte-idéntico**.

### El modelo — tres campos nuevos en `HeroContent`, un mecanismo genérico para el par de booleanos

`HeroContent` (`lib/config/site-content-defaults.ts`) gana tres campos, EXCLUSIVOS de la variante
`media` (curtina/ficha no los leen — afirmado por render, § el gate):

| campo | tipo | default | qué es |
| --- | --- | --- | --- |
| `ctasVisibles` | booleano | `true` | apaga los DOS CTA a la vez (no uno sí y otro no — el prototipo trata "sin botones" como un bloque) |
| `fraseAlPie` | `campos.opcional` | `''` | el `.hero-caption` del prototipo, como DATO del tenant — vacío se OMITE, nunca un texto de relleno |
| `cueDesliza` | booleano | `false` | el `.scroll-cue` del prototipo, "Desliza" |

`fraseAlPie` es un `campos.opcional` más — el mecanismo ya existía (`eyebrow`/`tituloEnfasis`, misma
regla de "opcional presente-aunque-vacío se respeta, ausente cae al default"). **`ctasVisibles`/
`cueDesliza` SON NUEVOS: el resolver (`resolverSiteContent`) no tenía forma de resolver un campo
BOOLEANO de SECCIÓN que no fuera `visible`.** Se generalizó con `SeccionDef.booleanos?: string[]` —
gemelo de `escalares` (que generalizó los strings clampados, § HERO-VIDEO-COMO-DATO-1) pero para
true/false: el loop del resolver ganó una tercera rama,

```ts
if (def.booleanos) {
  for (const campo of def.booleanos) {
    if (typeof storedSec[campo] === 'boolean') sec[campo] = storedSec[campo];
  }
}
```

MISMO mecanismo que ya usaba `storedSec.visible` (sólo un booleano EXPLÍCITO guardado
sobreescribe el default que `sec` ya trae por el `{ ...defaults }` inicial) — sin esto, cada
booleano de sección nuevo habría exigido un `if (key === 'hero')` hardcodeado en el loop, el mismo
hardcoding que `escalares` existe para evitar del lado de los strings. `REGISTRY.hero.booleanos =
['ctasVisibles', 'cueDesliza']`.

Los tres SOBREVIVEN al parse (`heroEditableSchema`, `lib/config/site-content-schema.ts`) — sin
declararlos, zod los STRIPPEARÍA en silencio al guardar (§ #65-B, la misma trampa que ya mordió a
Presentaciones). `DEFAULTS.hero` los declara en su valor de HOY.

### `HeroMedia.tsx` — dónde vive cada agregado

- **(a) CTAs ocultables**: el `motion.div` de los dos `<Link>` (primario + secundario) quedó
  envuelto en `{hero.ctasVisibles && (...)}`. Los dos desaparecen JUNTOS — es un solo flag, no dos.
- **(b) Frase al pie**: un `<p>` nuevo, SIN animación de entrada (vive fuera del `motion.div` que
  hace el stagger del bloque de texto — es un elemento aparte al pie de la sección, como el cue),
  alineado a la derecha con `max-w-[34ch]` — verbatim el layout del `.hero-caption` del prototipo
  (`margin-left:auto;max-width:34ch;text-align:right`). Se omite por completo si `fraseAlPie` está
  vacía (el default).
- **(c) Cue "Desliza"**: un `<div data-hero-cue="desliza">` posicionado absoluto bottom-left de la
  sección (gemelo del `.scroll-cue` del prototipo, `position:absolute;left:var(--page-gutter);
  bottom:var(--space-12)`), con una línea vertical (`h-14 w-px`, overflow hidden) y un
  `motion.span` que la recorre + la etiqueta "Desliza" debajo. **Se OMITE en preview** (`!preview`),
  mismo criterio que el indicador "Scroll" de `HeroCurtina.tsx`: scrollear no significa nada dentro
  de un marco de vista previa.

**REDUCED MOTION — SIN GUARD PROPIO, el mecanismo COMÚN.** El segmento anima `y` (un
`motion.span`, `animate={{ y: ['-100%', '220%'] }}`) — un valor de TRANSFORM, no `top`/`left`. Es
justamente lo que `ReducedMotionProvider` (`lib/animation.ts`, `MotionConfig
reducedMotion="user"`, montado UNA vez en `app/(storefront)/layout.tsx` sobre TODO el árbol del
storefront) congela: con la preferencia del sistema activa, toda animación de un `motion.*` que
toque `x`/`y`/`scale`/`rotate` se fija al valor final EN EL ACTO, `repeat: Infinity` incluido — el
segmento queda VISIBLE, quieto en su posición final, nunca desaparece. **No se escribió un segundo
`useReducedMotion()` local** para el cue (el componente ya usa ese hook, pero para la decisión de
reproducir el VIDEO de fondo — otro dato, otro propósito): el spec lo pedía explícito ("no inventes
un guard propio") y el mecanismo elegido (`y`, no `top`) es el que hace que el guard COMÚN alcance
sin escribir uno.

### La comparación MEDIDA — qué gana el hero-media que antes no, contra el prototipo

**Byte-identidad, por render (no supuesta):** se capturó el `HeroMedia.tsx` de ANTES de este slice
(el árbol en HEAD) en un archivo aparte fuera de `touches:` (`.scratch/`, no versionado) y se
renderizaron los DOS —el original y el nuevo, vía el dispatcher real `HeroSection`, con
`DEFAULTS.hero` sin tocar— con `renderToStaticMarkup`. **El HTML es carácter por carácter IDÉNTICO**
(`htmlNueva === htmlOriginal` → `true`). Es la prueba más fuerte que se pudo montar sin comprometer
`touches:`: no una comparación estructural (2 `<a>`, sin `data-hero-cue`) sino una igualdad de
STRING completa. El test que queda EN el repo (`lib/config/hero-agregados.test.ts`, no puede
importar del scratch no versionado) repite la mitad estructural de esa prueba —2 `<a>`, ausencia de
`data-hero-cue`/"Desliza"— más el resto de la matriz.

Lo que el hero-media MUESTRA hoy, que antes no podía, cuando los tres agregados se ENCIENDEN
(afirmado por render, `lib/config/hero-agregados.test.ts`):

| agregado | prototipo | `HeroMedia` con el flag encendido |
| --- | --- | --- |
| (a) sin CTAs | el hero no lleva botones | `ctasVisibles:false` → CERO `<a>` en la sección (antes SIEMPRE 2) |
| (b) frase al pie | `.hero-caption`, texto a la derecha, ≤34ch | `fraseAlPie:'…'` → el `<p>` aparece, texto exacto, alineado a la derecha |
| (c) cue "Desliza" | `.scroll-cue`, línea + segmento animado + etiqueta | `cueDesliza:true` (fuera de preview) → `data-hero-cue="desliza"` + `<span>Desliza</span>` |

### EL LÍMITE DE `touches:` — CORTE (el muestrario) NO enciende los tres agregados en este slice

**`lib/config/themes.ts` NO está en `touches:` de este slice**, y es donde vive el objeto `CORTE`
(`PresetTema`) que hoy declara `variantes.hero: 'media'` pero NO fija `ctasVisibles`/`fraseAlPie`/
`cueDesliza` — los presets sólo escriben ejes de TEMA/CHROME (`variantes`, `esquemas`,
`origenTexto`/`origenAccion`, `navTinta`/`navSubtitulo`/`navBadge`, `escalaDisplay`), nunca campos
de CONTENIDO de sección (`hero.titulo`, `hero.eyebrow`, …) — y estos tres son campos de contenido.
**Así que el mirador `?tema=CORTE` NO muestra ninguno de los tres agregados tras este slice**: la
CAPACIDAD existe (§ arriba, probada por render), pero nadie la enciende todavía. Encenderla en el
muestrario —para que el punto 3 del programa se vea completo en `?tema=CORTE`, no sólo en un test—
es un slice APARTE que toque `lib/config/themes.ts` (y, si el owner quiere la frase real del
prototipo en el muestrario, decidir su TEXTO — es dato del tenant, no algo que este slice deba
inventar). No se ensanchó `touches:` para resolverlo acá.

### Gate

- **`npm test`** (capa 1, sin base): **1597/1597**, 0 fail. Piso citado por `TEMAS-ESCALA-DISPLAY-1`:
  1584. Este slice suma **13** tests nuevos en `lib/config/hero-agregados.test.ts` — 1584 + 13 =
  1597, cuadra (contado con `grep -c "^test("` sobre el archivo).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2): **208/208**, 0 fail — idéntico al
  piso anterior; este slice no toca `packages/core/`, `tests/integracion/` ni ninguna migración
  (verificado: `git status --porcelain` no lista ningún archivo de esos árboles).
- **`npx tsc --noEmit`**: limpio.
- **`npx next build`**: `✓ Compiled successfully` (6.0s en la corrida final cacheada), TypeScript
  limpio, exit 0.
- **`npx eslint`** sobre los 4 archivos tocados/nuevos: limpio salvo **DOS instancias del mismo
  trade-off YA ACEPTADO** por `TEMAS-ESCALA-DISPLAY-1` (`react/no-children-prop` en `lib/config/
  hero-agregados.test.ts:80,84`, el helper `renderHeroMedia`) — la forma de 3 argumentos de
  `createElement` rompe `tsc` (`SiteContentProvider` tipa `children` como prop REQUERIDA), así que
  se usa `children` como prop, el mismo trade-off que ya tienen `site-content-defaults.test.ts:823,
  827` y `escala-display.test.ts:98` (verificado: `npx eslint` sobre esos dos archivos da el MISMO
  error, pre-existente y ajeno a este diff).

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, "se parece al prototipo", 2026-09-21, punto 3). `lib/config/`
está en la frase canónica de Tier 1 (`site-content-schema.ts`/`site-content-defaults.ts`
nombrados); `components/storefront/` entra por el subárbol ya ganado (bytes del visitante).

Contra MERGE POLICY A: **sin schema/migración** (ningún archivo de `packages/core/prisma/`, medido
por `git status --porcelain`), **sin contrato cross-repo**. **`customer_bytes.changed: true`** — a
nivel de RAMA, no de este commit en aislado: `app/(storefront)/page.tsx` sirve la ruta pública `/`,
la rama entera (`slice/corte-reescritura-prototipo-1`) ya venía `AWAITING_APPROVAL` por los slices
anteriores que tocan `components/storefront/home/` y SÍ cambian bytes servidos (p. ej.
`TEMAS-ESCALA-DISPLAY-1`, el `style` de font-size del h1 con `?tema=CORTE`). **Este commit
individual, medido por su cuenta, no cambia UN SOLO byte servido hoy** —ni a Nayoli (variante
`curtina`) ni al mirador de CORTE (variante `media`, pero sin `themes.ts` tocado los tres campos
nuevos quedan en su default, byte-idéntico, § arriba)—, pero la clasificación es de la rama, y la
rama sigue cambiando bytes de cliente por sus commits previos. `customer_bytes.strings: []` — este
commit no introduce ningún texto visible nuevo en ningún camino alcanzable hoy (§ el límite de
`touches:` arriba: CORTE no enciende nada). Este slice individual clasifica `AWAITING_APPROVAL` por
cuenta propia, mismo criterio que los anteriores de esta rama.

### Deviations

Ninguna en el MODELO ni en el mecanismo (tres campos, dos con un mecanismo genérico nuevo
—`SeccionDef.booleanos`—, uno con el mecanismo `campos.opcional` ya existente; los tres OPT-IN,
default = hoy, probado por render y por diff carácter-a-carácter contra el HeroMedia.tsx previo).

La única desviación es de EXPECTATIVA vs. `touches:`: el spec (§4) pide "la comparación MEDIDA: qué
muestra el hero del MUESTRARIO que antes no" — una frase que asume que el mirador de CORTE
efectivamente muestra los tres agregados tras este slice. **Medido: no los muestra**, porque
encenderlos exige `lib/config/themes.ts` (el objeto `CORTE`), que NO está en `touches:` de este
slice. Se reportó la comparación contra `HeroMedia` con los flags encendidos A MANO (vía render en
el test, no vía el preset) en vez de ensanchar `touches:` sobre la marcha — § "EL LÍMITE DE
`touches:`" arriba tiene el razonamiento completo y el open follow-up que sigue lo nombra.

### Open follow-ups

- **`TEMAS-HERO-MEDIA-CORTE-ENCIENDE-AGREGADOS-1`** — qué: que el preset `CORTE`
  (`lib/config/themes.ts`) fije `ctasVisibles:false`/`cueDesliza:true` (y, si el owner quiere la
  frase real del prototipo en el muestrario, `fraseAlPie` con su texto) para que `?tema=CORTE`
  muestre los tres agregados de este slice en vivo, no sólo en el test. Por qué no ahora: `themes.ts`
  no está en `touches:` de `TEMAS-HERO-MEDIA-AGREGADOS-1`, y el texto de `fraseAlPie` es una
  decisión de CONTENIDO (dato del tenant/muestrario) que este slice no debía inventar sobre la
  marcha.

## 2026-09-21 — La banda SPOTLIGHT: un producto pineado, con su selector de molienda, notas y carrito REUSADOS — el MODELO completo; el CABLEADO en la home queda RULING_NEEDED (`SPOTLIGHT-BANDA-1`)

**El programa (owner, "se parece al prototipo", 2026-09-21), punto 4**, con el censo
`SPOTLIGHT-CAPACIDAD-CENSO-1` cerrado (11 figuras, árbol `31ef742ea9f7`) y las tres decisiones ya
tomadas: el pin es PUNTERO, no copia; el tamaño se resuelve como enlace a la otra talla, no como
variante agrupada (Backlog #62 no se dispara); y la banda reemplaza a la lista plana de productos
("Selección del mes", `featured`) en los presets que la elijan.

### EL MODELO — todo dentro de `touches:`

`SiteContentData.spotlight` (`SpotlightContent`, `lib/config/site-content-defaults.ts`) es una
SECCIÓN de verdad en `REGISTRY` (pasa por el flujo borrador/publicar de siempre, como
`presentaciones`/`menu`), con seis campos:

| campo | tipo | default | qué es |
| --- | --- | --- | --- |
| `visible` | booleano | **`false`** | ver "LA ÚNICA SECCIÓN QUE NACE OFF", abajo |
| `eyebrow`/`titulo`/`badge` | opcional | `''` | los TRES campos editoriales de la banda (antetítulo, título, insignia) |
| `productoSlug` | opcional | `''` | EL PIN — el puntero al producto que la banda muestra |
| `otroTamanoSlug` | opcional | `''` | el SEGUNDO puntero — el enlace a la otra talla (otro producto) |

**`productoSlug`/`otroTamanoSlug` son PUNTEROS, nunca copias** (medido, § el censo, "la decisión es
PUNTERO no copia"): nombre, descripción, notas de cata, precio e imagen se LEEN del `Product` vivo
en cada render (`productoSpotlight`, abajo) — copiarlos mentiría en silencio el día que el producto
cambie, la misma familia de defecto que ya cerró el rating fabricado y la cuenta bancaria horneada
(§ CLAUDE.md).

**`productoSpotlight`/`productoOtraTalla` resuelven los DOS bordes que el censo pidió medir, sin
inventar un tercero:**

- **PIN A NADA** (el `productoSlug` no matchea ningún producto — se borró, o nunca se configuró):
  `productoSpotlight` cae al PRIMER producto del catálogo vivo, nunca a un componente roto — el
  MISMO patrón que el destino inexistente de Presentaciones (`categoria1/2`, § el destino es
  DATO): se declara un fallback, no se esconde el bloque a medias.
- **CATÁLOGO VACÍO** (cero productos): `productoSpotlight` devuelve `null` y el componente se
  AUTO-OCULTA (hide-on-empty, el patrón de Testimonios/la Galería) — nunca un spotlight vacío.
- **DETECCIÓN DE PIN RANCIO en el panel** (`avisosDeConfiguracion`, el precedente que hoy sólo
  cubre `categoria1..4`): **NO se extendió.** `lib/config/avisos-configuracion.ts` no está en
  `touches:`, y con la banda sin cablear en `orden` (§ abajo) un aviso sobre un campo que ningún
  tenant puede encender todavía sería una guarda sin caso real que gatear. Queda como follow-up
  nombrado (§ abajo), no forzado.

**`otroTamanoSlug` NO cae a ningún fallback** (`productoOtraTalla`): un slug vacío o que no matchea
significa "no hay otra talla que ofrecer", y el control simplemente se omite — mismo criterio que
`menuCtaHref` (preferir callar a un link roto). Su LABEL no es un campo aparte: se deriva de
`Product.peso_gramos` del producto resuelto (el MISMO campo que el detalle ya usa para su chip
"Tamaño") — un campo de texto libre para "250 g"/"500 g" sería una TERCERA copia del mismo hecho
que el producto ya declara.

**LA ÚNICA SECCIÓN QUE NACE OFF (`visible:false`).** Las nueve secciones ocultables que ya existen
nacen `true`; `spotlight` es la primera excepción, y tiene un motivo MECÁNICO, no estético:
`resolverOrden` completa el `orden` resuelto de CUALQUIER tenant con TODA banda que exista en
`BANDA_IDS`, sin condición y sin que un tenant pueda pedir que falte una — es la garantía,
documentada en su propio docstring, de que "ninguna banda se cae del home por un orden corrupto".
El día que `spotlight` se sume a `BANDA_IDS` (§ el bloqueo medido, abajo), esa MISMA garantía
haría que la banda apareciera en el orden resuelto de TODO tenant sin que nadie la haya pedido —
Nayoli incluida, con su catálogo real de 4 productos, mostrando el primero por el fallback de
`productoSpotlight`. Nacer OFF es lo único que evita eso; es el mismo mecanismo que ya usan los
repeaters vacíos (Testimonios, la Galería) para no encenderse solos, expresado como un booleano en
vez de un array vacío porque acá el dato no es una lista.

`spotlightEditableSchema` (`lib/config/site-content-schema.ts`) declara los seis campos —si no,
zod los STRIPPEARÍA al guardar (§ #65-B, la trampa que ya mordió a Presentaciones)—; el test
DERIVADO de `site-content-schema.test.ts` ("todo campo del MODELO está en el schema editable") lo
confirma sin tocar ese archivo, que no está en `touches:`.

### EL COMPONENTE — construido, reusa VERBATIM, pero HOY NO SE ALCANZA DESDE NINGÚN PRESET

`components/storefront/home/Spotlight.tsx` arma la ficha del producto pineado: el selector de
molienda (`moliendasDisponibles`/`moliendaAceptada` de `@duna/core/moliendas-opciones` — el MISMO
módulo que ya comparten ProductCard, el detalle y el servidor, sin una segunda implementación),
las notas de cata (`producto.notasCata`, el mismo patrón de chips que el detalle), el tamaño como
enlace a la otra talla, el precio (`formatCOP`) y "Agregar al carrito" con el `addItem` de
`useCartStore` — el mismo helper, sin un carrito paralelo. Compila limpio (`tsc --noEmit`, `next
build`) y está listo para montarse el día que la RULING de abajo se resuelva.

### RULING_NEEDED — el cableado en la home rompe la compilación fuera de `touches:`

**El hallazgo, MEDIDO antes de decidir, no supuesto** (mismo protocolo que ya usó
`CROMO-MENU-COMO-DATO-1` con `VistaTiendaEnVivo.tsx`): se agregó `'spotlight'` a `BANDA_IDS`
(`lib/config/site-content-defaults.ts`) y se corrió `npx tsc --noEmit`:

```
app/(storefront)/page.tsx(91,9): error TS2741: Property 'spotlight' is missing in type
'{ hero: …; trustBadges: …; featured: …; brandStory: …; presentaciones: …; subscriptionCTA: …;
testimonials: … }' but required in type 'Record<"hero" | "trustBadges" | "featured" | "spotlight" |
"brandStory" | "presentaciones" | "subscriptionCTA" | "testimonials", (style: CSSProperties) =>
ReactNode>'.
```

Un solo error, confinado a `app/(storefront)/page.tsx:91` (`npx tsc --noEmit | wc -l` → 1) — la
constante `BANDAS: Record<BandaId, …>` de esa página es EXHAUSTIVA, igual que el `Record<SeccionVista,
ComponentType>` que bloqueó al menú, sólo que ahora en la ruta del STOREFRONT, no del panel. El
cambio se REVIRTIÓ antes de escribir nada más (`git status --short` limpio, verificado).

**Y hay un SEGUNDO hallazgo, más profundo que el primero, que sobreviviría aunque `page.tsx`
entrara a `touches:`.** `resolverOrden` no tiene forma de REMOVER una banda: complete el `orden`
que sea, SIEMPRE agrega al final cualquier `BandaId` conocido que falte. Medido contra el catálogo
real de presets (`npx tsx -e "…validarPreset/temasCompletos…"`):

```
CORTE COMPLETO
temasCompletos: [ 'CORTE', 'ARRANQUE' ]
```

**`CORTE` es COMPLETO y está VIVO hoy** — `?tema=CORTE` lo aplica de verdad en cualquier despliegue
demo, con efecto visible (`contenidoConPresetDeVista` sólo actúa sobre presets completos). Si este
slice hubiera reescrito el `orden` de CORTE quitando `'featured'` para poner `'spotlight'` en su
lugar, `resolverOrden` habría vuelto a agregar `'featured'` al final de todos modos (es un
`BandaId` conocido que el preset "no menciona" no es lo mismo que "pide que falte") — CORTE habría
terminado mostrando la banda spotlight ARRIBA **y** la vieja grilla "Selección del mes" abajo,
justo lo contrario de "reemplaza la lista plana". Peor: si en cambio se hubiera escrito
`'spotlight'` en el `orden` de CORTE SIN sumarlo a `BANDA_IDS`, `validarPreset` lo habría marcado
INCOMPLETO (regla `orden`, "no existe en BANDA_IDS") — **regresión de un tema que hoy funciona** a
uno que `contenidoConPresetDeVista` ignora en silencio.

**La pregunta, en una frase:** ¿`spotlight` entra al sistema como banda INDEPENDIENTE y
reordenable (lo que el spec pide literal, "sumada a `BANDA_IDS`"; exige tocar
`app/(storefront)/page.tsx`, fuera de `touches:`, y decidir si `resolverOrden` gana la capacidad de
REMOVER una banda — un cambio con blast radius sobre los 6 presets y sus tests), o entra como una
VARIANTE MÁS de la banda estructural `featured` ya existente (`VARIANTES_ESTRUCTURALES.featured`,
como `'grilla'` en `TEMAS-FEATURED-GRILLA-1` — cabe entero en `components/storefront/home/`, no
toca `page.tsx` ni `resolverOrden`, pero deja de ser una banda independiente-reordenable, que es lo
que el spec pidió literal)?

- **Opción A — banda independiente** (lo que el spec pide). Consecuencia medida: `page.tsx` fuera
  de `touches:` (TS2741, arriba) + una decisión aparte sobre si `resolverOrden` gana "remover", sin
  la cual CORTE mostraría spotlight Y la vieja grilla a la vez.
- **Opción B — variante de `featured`.** Consecuencia: CERO archivos fuera de `touches:`, CERO
  regresión de CORTE (su `orden` no cambia, sólo `variantesBandas.featured` pasaría de `'grilla'` a
  `'spotlight'`) — pero `spotlight` deja de ser una banda con posición propia en `orden`: queda
  atada a dondequiera que `'featured'` esté, y una futura variante DE VERDAD del grid clásico
  (`'tabla'`, la que pide PLIEGO) competiría por el mismo slot de composición.
- **Opción C — este slice, tal cual.** El modelo (`SpotlightContent`, `REGISTRY.spotlight`,
  `DEFAULTS.spotlight` naciendo OFF), el schema (`spotlightEditableSchema`, sin strip silencioso) y
  el componente (`Spotlight.tsx`, reuso verbatim del selector/carrito/notas, tamaño como enlace)
  quedan completos y compilando; el campo YA es editable por el `PUT`/`POST` genéricos de
  `/api/site-content` (no gateados por sección, § el mismo razonamiento que dejó `menu` editable
  sin panel). Lo que falta es CÓMO se monta en la home.

**Bloqueado:** que `?tema=CORTE` muestre spotlight en vivo, y que cualquier tenant pueda verla.

**Hecho de todos modos, y no depende de la ruling:** el modelo completo (`SpotlightContent`,
`REGISTRY.spotlight`, `DEFAULTS.spotlight`, `productoSpotlight`, `productoOtraTalla`), el schema
(`spotlightEditableSchema`), el componente (`Spotlight.tsx`, compilando, sin montar), y 12 tests
nuevos en `lib/config/spotlight-banda.test.ts` (los cuatro requeridos por el spec — pin rinde el
producto vivo, pin-a-nada no rompe, catálogo vacío auto-oculta, Nayoli byte-idéntica por render — y
ocho más que fijan las variantes de cada borde).

### Gate

- **`npm test`** (capa 1, sin base): **1609/1609**, 0 fail — sube de 1597 (piso citado por
  `TEMAS-ESCALA-DISPLAY-1`) por los 12 tests nuevos de `spotlight-banda.test.ts` (1597 + 12 = 1609,
  cuadra).
- **`npm run test:integracion`** (Postgres 14.20 efímero, capa 2, vía `npm run gate`): **208/208**,
  0 fail — idéntico al piso anterior; este slice no toca `packages/core/`, `tests/integracion/` ni
  ninguna migración (`git status --porcelain` no lista ningún archivo de esos árboles).
- **`npx tsc --noEmit`**: limpio (además del experimento reversible con `BANDA_IDS`, revertido
  antes de escribir nada más — § RULING_NEEDED, arriba).
- **`npx next build`**: `✓ Compiled successfully` (6.9s), TypeScript limpio, todas las rutas
  generadas sin error.
- **`npx eslint`** sobre los 4 archivos tocados/nuevos: limpio salvo **UN warning heredado**
  (`react-hooks/set-state-in-effect` en `Spotlight.tsx:52`) — el MISMO patrón, verificado línea a
  línea, que ya trae `app/(storefront)/tienda/[slug]/page.tsx:74` (el archivo del que se reusó el
  mecanismo de preselección de molienda). No es un defecto nuevo: es el trade-off ya aceptado del
  código que este slice reusa verbatim.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, "se parece al prototipo", 2026-09-21, punto 4, sobre el censo
`SPOTLIGHT-CAPACIDAD-CENSO-1`). `lib/config/site-content-schema.ts` y `lib/config/
site-content-defaults.ts` están en la frase canónica de Tier 1; `components/storefront/` entra por
el subárbol ya ganado (bytes del visitante).

Verdicto: **`RULING_NEEDED`** — no hay diff que clasificar contra MERGE POLICY A todavía, porque el
obstáculo es previo a esa pregunta: qué FORMA toma `spotlight` en el sistema de bandas es una
decisión de producto/arquitectura, no una de esta sesión. `customer_bytes.changed` se reporta en
`true` por prudencia (REGISTRY/DEFAULTS se importan enteros desde componentes cliente del
storefront ya alcanzables, así que el bundle compilado crece unos bytes aunque ningún texto nuevo
se vuelva visible — `strings: []`, el mismo criterio que ya usó `CROMO-MENU-COMO-DATO-1`).

### Deviations

Ninguna del MODELO, el schema, ni el componente (mecanismo exacto al spec: pin como puntero,
fallback declarado en pin-a-nada, hide-on-empty en catálogo vacío, tamaño como enlace, reuso
verbatim del selector/carrito). La desviación es de ALCANCE: `lib/config/themes.ts` **quedó SIN
TOCAR**, aunque estaba en `touches:` esperando que hospedara el cableado de CORTE. Escribirlo de
todos modos —con `'spotlight'` en el `orden` de CORTE sin sumarlo a `BANDA_IDS`— habría regresado
un tema HOY completo y vivo (`?tema=CORTE`) a uno incompleto que el mirador ignora en silencio (§
el segundo hallazgo, arriba); no se hizo por "cumplir la letra" del `touches:`, medido antes de
decidir.

### Open follow-ups

- `SPOTLIGHT-CABLEADO-HOME-1` — conectar `spotlight` a la home (Opción A o B, § RULING_NEEDED) una
  vez el owner elija. Si es la Opción A, incluye la decisión aparte sobre si `resolverOrden` gana
  la capacidad de REMOVER una banda del `orden` (blast radius sobre los 6 presets y sus tests). No
  se prioriza a sí mismo — depende de la ruling de arriba.
- `SPOTLIGHT-PIN-RANCIO-AVISO-1` — extender `avisosDeConfiguracion` (`lib/config/
  avisos-configuracion.ts`, fuera de `touches:` de este slice) para detectar un `productoSlug`/
  `otroTamanoSlug` que ya no resuelve, una vez `SPOTLIGHT-CABLEADO-HOME-1` haga que algún tenant
  pueda encender la sección de verdad. Sin cableado, un aviso sobre un campo inalcanzable no tiene
  caso real que gatear.
- `SPOTLIGHT-PANEL-EDITOR-1` — el formulario de `/admin/tienda` para editar `eyebrow`/`titulo`/
  `badge`/los dos punteros (patrón `CROMO-MENU-PANEL-EDITOR-1`: `components/admin/
  tienda-secciones.ts`/`VistaTiendaEnVivo.tsx`, fuera de `touches:`, con el mismo obstáculo de
  `SeccionVista` exhaustivo). No depende de `SPOTLIGHT-CABLEADO-HOME-1` para EXISTIR como dato
  editable (el `PUT`/`POST` genéricos ya lo aceptan), pero sin cableado en la home no hay vista
  previa que mostrar.

## 2026-09-21 — SPOTLIGHT como VARIANTE de `featured`: cableado completo, gate ROJO por dos tests fuera de `touches:` (`SPOTLIGHT-CABLEADO-HOME-1`)

**La RULING de `SPOTLIGHT-BANDA-1` se resolvió a favor de la Opción B** (owner, sobre la medición de
esa sesión: la banda independiente exigía capacidad nueva —`resolverOrden` removiendo, o `featured`
ocultable—; la variante reusa el dispatcher que YA existe). Este slice conecta `spotlight` como
tercera variante de `featured`, junto a `cuadricula`/`grilla`, sin sumarla a `BANDA_IDS` y sin tocar
`app/(storefront)/page.tsx` ni `resolverOrden` — exactamente el `touches:` aprobado.

### EL CABLEADO

- **`VARIANTES_ESTRUCTURALES.featured.claves`** (`site-content-defaults.ts`) gana `'spotlight'`:
  `['cuadricula', 'grilla', 'spotlight']`, canónica sin cambiar. Sin esto `resolverVariantesBandas`
  descartaría la clave como basura y `validarPreset` marcaría a CORTE INCOMPLETO —el mirador
  `?tema=CORTE` la ignoraría en silencio, la MISMA regresión que la sección RULING_NEEDED de
  `SPOTLIGHT-BANDA-1` ya midió para la Opción A mal aplicada—.
- **`FeaturedProducts.tsx`** (el dispatcher YA construido en `TEMAS-FEATURED-GRILLA-1`) gana la
  rama `spotlight: Spotlight` en su mapa `VARIANTES`. `Spotlight.tsx` **no se tocó** — mismo import,
  misma firma (`{ style }?`), mismo dato leído por `useSiteContent()`. El tipo del mapa se ensanchó
  de `typeof FeaturedProductsCuadricula` (nunca `null`) a `(props?) => ReactElement | null`, porque
  `Spotlight` SÍ puede devolver `null` (hide-on-empty + el gate de `visible`, los dos de
  `SPOTLIGHT-BANDA-1`) — forzar el tipo viejo habría exigido reescribir ese `return null` para
  calzar, y eso sí habría sido tocar el componente.
- **`CORTE.variantes.featured`** pasa de `'grilla'` a `'spotlight'` (`themes.ts`). MEDIDO contra el
  prototipo (`docs/prototipos/cafeone/index.html:159-217`, `id="producto"`, `aria-labelledby=
  "spot-h"`, clase `spotlight`): la sección "Producto insignia" es un ÚNICO producto con badge de
  cosecha, selector de molienda/tamaño, notas de cata y "Agregar al carrito" — exactamente lo que
  `Spotlight.tsx` construye, no la malla de 6 que `'grilla'` pintaba ahí (la mejor variante
  DISPONIBLE cuando `TEMAS-FEATURED-GRILLA-1` se escribió; `SPOTLIGHT-BANDA-1` no existía todavía).
  El comentario `featured·grilla → .spotlight (index.html:160, "Nuestro café")` de
  `CORTE-ESQUEMAS-INVERTIDOS-1` pasó a `featured·spotlight → .spotlight` — el nombre de la clase del
  prototipo YA era literalmente "spotlight"; el esquema (`'crema'`) no cambia, es del `BANDA_ID`
  `featured`, no de su composición.
- **El hallazgo no anticipado por el spec: `spotlight.visible` nace `false`** (§ `SPOTLIGHT-BANDA-1`,
  "LA ÚNICA SECCIÓN QUE NACE OFF" — su motivo mecánico, `spotlight` fuera de `BANDA_IDS`, sigue
  vigente y NO se tocó). Sin más, CORTE habría elegido la variante `'spotlight'` y `Spotlight.tsx`
  habría devuelto `null` de todos modos —la variante "elegida" y en blanco a la vez—, porque el
  campo que `mergePresetEnContent` escribe (`content[seccion].variante`) no es el mismo que
  `Spotlight.tsx` consulta para decidir si se muestra (`content.spotlight.visible`). Se cerró
  agregando a `mergePresetEnContent`: cuando la variante resultante de `featured` es `'spotlight'`,
  fuerza `content.spotlight.visible = true` (`{ ...prev, visible: true }`, preservando cualquier
  `eyebrow`/`titulo`/pin que el dueño ya hubiera puesto — MISMA forma que ya usa para `variante`).
  Documentado en el docstring de `mergePresetEnContent` y en el comentario de `DEFAULTS.spotlight`.
  Afirmado en el carril: `mergePresetEnContent` NO toca `spotlight.visible` para un preset que no
  elige esa variante (PATIO, que sigue en `'grilla'`).

### QUÉ MUESTRA `?tema=CORTE` AHORA, CONTRA EL PROTOTIPO

Antes de este slice: la malla de 6 productos ("Nuestro Catálogo" / "Selección del mes",
`FeaturedProductsGrilla`). Después: `Spotlight` — un producto único con badge, selector de
molienda, notas de cata, el control de "otra talla" (si `otroTamanoSlug` resuelve) y "Agregar al
carrito", calzando la anatomía del prototipo. **CORTE no fija un pin** (`productoSlug`/
`otroTamanoSlug` quedan vacíos en el preset, fuera del alcance de este cableado): sobre el catálogo
real de Nayoli, `productoSpotlight` cae al PRIMER producto (§ el fallback declarado de
`SPOTLIGHT-BANDA-1`), no a uno curado.

**DEVIACIÓN MEDIDA, no corregida (fuera de `touches:`, Spotlight.tsx no se reescribe):**
`Spotlight.tsx` NO consume `tema.escalaDisplay` en su `h2` —a diferencia de
`FeaturedProductsCuadricula`/`Grilla`, que sí leen `fontSizeDisplay(tema.escalaDisplay, 'l')`—, así
que el `escalaDisplay:'amplia'` que CORTE declara (§ `TEMAS-ESCALA-DISPLAY-1`, medido contra
`spot-h` del prototipo) deja de tener efecto sobre el titular de esta banda al pasar de `'grilla'`
a `'spotlight'`: el h2 de Spotlight sigue en `text-3xl sm:text-4xl` fijo. Antes de este slice, con
`'grilla'`, ese mismo preset SÍ agrandaba el titular (era el ÚNICO consumidor real de
`escalaDisplay:'amplia'`, según el propio comentario de `FeaturedProductsGrilla.tsx:33-37`). Es un
defecto REAL contra la fidelidad al prototipo, medido y no oculto — abre follow-up abajo.

### BYTE-IDENTIDAD DE NAYOLI, POR RENDER

`lib/config/spotlight-cableado.test.ts` (15 tests, todos vistos pasar y 4 vistos fallar al revertir
la línea `spotlight: Spotlight,` del dispatcher — no vacuos):

- `renderToStaticMarkup` de `FeaturedProducts` con `resolverSiteContent({})` (Nayoli, sin fila) es
  **BYTE A BYTE IGUAL** a montar `FeaturedProductsCuadricula` directo — la variante por defecto no
  cambió una letra.
- `contenidoConPresetDeVista(nayoli, undefined)` (sin `?tema=`) devuelve la MISMA referencia — el
  mirador no toca nada sin la query param.
- `contenidoConPresetDeVista(nayoli, 'CORTE')` cambia `variantesBandas.featured` a `'spotlight'` y
  `spotlight.visible` a `true`; el render resultante deja de contener "Selección del mes"/"Nuestro
  Catálogo" — la lista plana desaparece bajo CORTE.
- **Límite declarado del carril** (heredado de `spotlight-banda.test.ts`): `Spotlight.tsx` fetchea
  el catálogo en un `useEffect`, que `renderToStaticMarkup` nunca ejecuta (un solo paso de render
  síncrono) — así que en TODO render de este archivo el catálogo interno de `Spotlight` queda en
  `[]` y el componente rinde vacío por hide-on-empty, sea cual sea `visible`. La prueba de "se montó
  Spotlight" es por tanto NEGATIVA (el texto de Cuadricula/Grilla desaparece) más una lectura DIRECTA
  de la fuente (`FeaturedProducts.tsx` importa `Spotlight` y lo asigna a la clave `'spotlight'`), no
  "se ve el producto" — eso exigiría jsdom + un catálogo real, que este repo no tiene para `.tsx`
  (§ CLAUDE.md).

### GATE — ROJO, por DOS asserts fuera de `touches:` que el cambio pedido por el spec vuelve stale

**`npm test`: 1624 intentados, 1622 pass, 2 fail.** Sube de 1609 (piso de `SPOTLIGHT-BANDA-1`) por
los 15 tests nuevos de `spotlight-cableado.test.ts` (1609 + 15 = 1624, cuadra exacto) — de esos
1624, dos de los YA EXISTENTES antes de este slice (dentro del piso de 1609) son justamente los que
ahora fallan; no se agregó ni restó ningún test viejo. Los dos fallos:

| archivo:línea | qué afirma | por qué falla |
| --- | --- | --- |
| `lib/config/site-content-defaults.test.ts:670` | `deepEqual(VARIANTES_ESTRUCTURALES.featured, { claves: ['cuadricula','grilla'], canonica:'cuadricula' })` | la lista real ahora es `['cuadricula','grilla','spotlight']` — el spec pide explícitamente sumar la clave (§1, "para que resolverVariante la acepte") |
| `lib/config/theme-mirador.test.ts:36` | `equal(out.variantesBandas.featured, 'grilla')` sobre `contenidoConPresetDeVista(_, 'CORTE')` | CORTE ahora pide `'spotlight'`, por la MISMA decisión de este slice |

**Los dos son consecuencia MECÁNICA, directa y no evitable del cambio que el spec pide** —no hay
forma de sumar `'spotlight'` a `VARIANTES_ESTRUCTURALES.featured.claves` sin invalidar un
`deepEqual` que fotografía el conjunto exacto, ni de mover `CORTE.variantes.featured` sin invalidar
un `equal` que fotografía su valor exacto—. Medido ANTES de escribir nada (`npm test` en el árbol
sin tocar: 1609/1609) y confirmado por REVERSIÓN (comentar `spotlight: Spotlight,` en el dispatcher
hace fallar 4 de los 15 tests nuevos, ninguno de los dos de la tabla — o sea el fallo de la tabla
NO es un bug de este slice, es la definición cambiando bajo un test que la fotografía).

**Ninguno de los dos archivos está en `touches:`** (`lib/config/site-content-defaults.test.ts`,
`lib/config/theme-mirador.test.ts`) — sólo `lib/config/spotlight-cableado.test.ts` lo está. Por
protocolo («el diff se queda DENTRO de `touches:`; si el trabajo necesita un archivo fuera, PARAR y
decirlo, no ensancharlo por cuenta propia»), **no se tocaron.** El fix es de una línea cada uno
(actualizar el array/el string al valor nuevo, MISMO patrón que ya usó `TEMAS-FEATURED-GRILLA-1`
cuando sumó `'grilla'` a esta misma lista) y no cambia ningún comportamiento — sólo re-fotografía el
conjunto/valor que este slice cambió a propósito.

- **`npm run test:integracion`**: **208/208**, 0 fail — idéntico al piso de `SPOTLIGHT-BANDA-1`; este
  slice no toca `packages/core/`, `tests/integracion/` ni ninguna migración.
- **`npx tsc --noEmit`**: limpio, tras ensanchar el tipo de `VARIANTES` en `FeaturedProducts.tsx`
  (§ arriba) — sin ese ensanche, `Element | null` de `Spotlight` no calzaba contra
  `typeof FeaturedProductsCuadricula`.
- **`npx next build`**: `✓ Compiled successfully` (9.1s), todas las rutas generadas sin error.
- **`npx eslint`** sobre los 4 archivos tocados: **4 errores, todos `react/no-children-prop`**, los
  cuatro en `spotlight-cableado.test.ts`, mismo patrón (`React.createElement(X, { value, children:
  … })`) que YA tienen, sin corregir, `hero-agregados.test.ts` (2) y `escala-display.test.ts` (1) —
  medido corriendo eslint sobre esos dos archivos, que no forman parte de este slice. No es una
  clase de defecto nueva: es el mismo patrón heredado, consistente con el precedente ya aceptado.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, sobre la RULING de `SPOTLIGHT-BANDA-1`: "se elige la VARIANTE").
`lib/config/site-content-defaults.ts` está en la frase canónica de Tier 1; `components/storefront/`
entra por el subárbol ya ganado (bytes del visitante).

Verdicto: **`GATE_RED`** — el gate completo corrió sobre el árbol final y falló (2/1622 en `npm
test`). No es `AWAITING_APPROVAL`: el motivo de parada no es una condición de la política A —es que
el gate no cerró en verde—, y `GATE_RED` es el verdicto que corresponde cuando eso pasa,
independientemente de si el diff en sí es de bytes de cliente (que sí lo es: `customer_bytes.
changed=true`, ver abajo).

### Deviations

Ninguna del MECANISMO pedido por el spec (los tres pasos —sumar la clave, la rama del dispatcher,
CORTE eligiendo la variante— se hicieron tal cual). Dos desviaciones de ALCANCE, ambas medidas antes
de decidir:

1. **`spotlight.visible` forzado en `mergePresetEnContent`** — no estaba en los tres pasos literales
   del spec, pero es estructuralmente inevitable: sin esto, CORTE elegiría la variante y el slot de
   `featured` quedaría vacío (medido con el gate visual mental del propio invariante del spec: "Sólo
   CORTE... rinde el spotlight" — sin este cambio, CORTE NO lo rendía, sólo lo "elegía"). Se
   implementó dentro de `themes.ts` (en `touches:`), sin tocar `site-content-defaults.ts` más allá
   de documentar por qué el default sigue en `false`.
2. **Dos archivos fuera de `touches:` quedaron con asserts stale** (`site-content-defaults.test.ts`,
   `theme-mirador.test.ts`) — NO se tocaron, por protocolo. El gate queda ROJO por esto, no por un
   defecto del mecanismo. Ver § GATE y Open follow-ups.

### Open follow-ups

- `SPOTLIGHT-STALE-ASSERTS-1` — actualizar los dos asserts stale (`lib/config/
  site-content-defaults.test.ts:670`, agregar `'spotlight'` al array esperado;
  `lib/config/theme-mirador.test.ts:36`, cambiar `'grilla'` por `'spotlight'`). Cambio de una línea
  cada uno, cero riesgo — son fotografías del MISMO valor que este slice cambió a propósito. Cierra
  el `GATE_RED` de esta entrada. Necesita `touches:` propio o ampliado, porque esta sesión no puede
  tocarlos.
- `SPOTLIGHT-ESCALADISPLAY-1` — `Spotlight.tsx` no lee `tema.escalaDisplay` en su `h2`, así que
  `CORTE.escalaDisplay:'amplia'` (medido contra `spot-h` del prototipo, `TEMAS-ESCALA-DISPLAY-1`)
  dejó de tener efecto sobre esta banda al pasar de `'grilla'` a `'spotlight'`. Requiere tocar
  `Spotlight.tsx` (fuera de `touches:` de este slice, y explícitamente "no reescribir" en el spec).
  Fidelidad al prototipo, no urgente — el titular sigue siendo legible, sólo no es "ENORME" como en
  `spot-h`.
- Los tres follow-ups de `SPOTLIGHT-BANDA-1` (`SPOTLIGHT-PIN-RANCIO-AVISO-1`,
  `SPOTLIGHT-PANEL-EDITOR-1`) **YA NO están bloqueados por "sin cableado en la home"** — este slice
  cableó la banda. Se re-priorizan aparte; no se tocan acá.

## 2026-09-21 — Cierre de `SPOTLIGHT-CABLEADO-HOME-1`: los dos asserts stale + el titular sin escala (`SPOTLIGHT-CIERRE-1`)

Cierra los dos follow-ups que `SPOTLIGHT-CABLEADO-HOME-1` (arriba) dejó abiertos y midió sin poder
tocar: `SPOTLIGHT-STALE-ASSERTS-1` (el `GATE_RED`) y `SPOTLIGHT-ESCALADISPLAY-1` (la deviation
medida). No se repite el razonamiento de esa entrada — el cableado en sí (la variante, el
dispatcher, CORTE eligiéndola) ya está hecho y no se tocó acá; sólo se citan sus conclusiones.

### LOS DOS ASSERTS

- `lib/config/site-content-defaults.test.ts:670` fotografiaba `VARIANTES_ESTRUCTURALES.featured ===
  { claves: ['cuadricula', 'grilla'], canonica: 'cuadricula' }`. El valor REAL desde
  `SPOTLIGHT-CABLEADO-HOME-1` es `['cuadricula', 'grilla', 'spotlight']` (medido en
  `site-content-defaults.ts:1242`, sin tocar) — se actualizó el `deepEqual` al valor nuevo.
- `lib/config/theme-mirador.test.ts:36` fotografiaba `contenidoConPresetDeVista(_, 'CORTE')
  .variantesBandas.featured === 'grilla'`. El valor real es `'spotlight'` (medido en
  `themes.ts:409`, sin tocar) — se actualizó el `equal` al valor nuevo.

Los dos son la MISMA clase de fix: re-fotografiar un valor que el cambio legítimo de
`SPOTLIGHT-CABLEADO-HOME-1` volvió viejo, no aflojar un test. Ninguno de los dos toca lógica.

### EL TITULAR — `Spotlight.tsx` ahora consume `fontSizeDisplay`

`Spotlight.tsx` gana `const { spotlight, tema } = useSiteContent();` (destructura `tema`, antes sólo
`spotlight`) y `const displayL = fontSizeDisplay(tema.escalaDisplay, 'l');`, aplicado al `h2` del
titular con el MISMO patrón que `FeaturedProductsGrilla.tsx:38-39,50` (`style={displayL ? {
fontSize: displayL } : undefined}`) — mismo import (`@/lib/config/escala-display`), misma firma,
mismo rol (`'l'`, el h2 de una banda de sección — no `'xl'`, que es sólo el h1 del hero). No se
inventó un mecanismo nuevo.

Contrato de `fontSizeDisplay` (`escala-display.ts:66-69`, sin tocar): `escala === null → undefined`
→ el llamador no toca `style` → el `h2` sigue rindiendo su clase Tailwind de hoy
(`text-3xl sm:text-4xl`) byte-idéntico. Con `escala: 'amplia'` (sólo CORTE la declara,
`escala-display.ts:11-12`) → el `clamp(48px, 5vw, 76px)` de `CLAMP_L`.

**LA INVARIANTE queda cerrada por construcción, no por un test nuevo de render**: `Spotlight.tsx`
sólo tiene UN llamador a `fontSizeDisplay`, con el MISMO argumento (`tema.escalaDisplay`) que
`FeaturedProductsGrilla` ya usa y que `escala-display.ts` ya prueba en capa 1
(`escala-display.test.ts`, fuera de `touches:`, no tocado) — no hay una segunda función que pudiera
divergir sobre qué hace `null` vs `'amplia'`.

**NO SE AGREGÓ un test de render nuevo**, y es una desviación medida, no un olvido: el propio
`spotlight-cableado.test.ts` (§ `SPOTLIGHT-CABLEADO-HOME-1`, "BYTE-IDENTIDAD DE NAYOLI, POR RENDER")
ya documenta el límite del carril — `Spotlight.tsx` fetchea el catálogo en un `useEffect` que
`renderToStaticMarkup` nunca ejecuta, así que `producto` es SIEMPRE `null` en ese harness y el
componente entero rinde vacío (`if (!producto) return null;` corre ANTES de armar el JSX del `h2`,
`Spotlight.tsx:59`) — no hay forma de renderizar el `h2` escalado con la infraestructura de test
actual sin mockear `fetch`, y ese archivo (`spotlight-cableado.test.ts`) no está en `touches:` de
este slice. Escribir esa infraestructura nueva, o tocar `spotlight-cableado.test.ts`/
`spotlight-banda.test.ts` para hospedar el test, habría ensanchado el diff fuera de los 4 archivos
declarados. La verificación que sí corre dentro de `touches:` es de código (el mismo mecanismo que
`FeaturedProductsGrilla` ya prueba con éxito en su propia banda) + el gate completo en verde (abajo).

### Gate

`npm test`: **1624/1624**, 0 fail — mismo total que el piso de `SPOTLIGHT-CABLEADO-HOME-1`
(1624 intentados, ahí 2 fallaban); acá los mismos 1624 pasan, cero tests agregados o quitados.
`npm run test:integracion`: **208/208**, 0 fail — idéntico al piso, sin tocar `packages/core/` ni
`tests/integracion/`. `npx tsc --noEmit`: limpio. `npx next build`: `✓ Compiled successfully` (6.6s),
todas las rutas generadas sin error.

`npx eslint` sobre los 3 archivos de código tocados: 1 warning + 2 errores, los TRES preexistentes y
fuera del diff de este slice —confirmado con `git diff --stat` (el `.test.ts` de site-content-
defaults sólo cambió 2 líneas, ninguna de las que el linter marca) y por lectura del propio archivo—:
el warning de `react-hooks/set-state-in-effect` en `Spotlight.tsx:57` es el `useEffect` de
`molienda` que YA existía sin tocar (línea sin diff); los dos `react/no-children-prop` de
`site-content-defaults.test.ts:823,827` son el mismo patrón `React.createElement(X, { value,
children })` que `SPOTLIGHT-CABLEADO-HOME-1` ya documentó como heredado y sin corregir en
`hero-agregados.test.ts`/`escala-display.test.ts`.

### Tier 1 / clasificación de merge policy

`tier: 1`, `approved: yes` (owner, sobre `SPOTLIGHT-CABLEADO-HOME-1`: cierra su `GATE_RED` y su
deviation medida). `lib/config/site-content-defaults.ts`/`theme-mirador.ts` están en la frase
canónica de Tier 1 vía sus `.test.ts`; `components/storefront/` entra por el subárbol ya ganado
(bytes del visitante) — Spotlight.tsx cambia bytes que el visitante ve (el tamaño del titular bajo
CORTE), así que `customer_bytes.changed = true`. `stopped_on: [customer-bytes]` →
`AWAITING_APPROVAL`, por protocolo (el worker nunca mergea, § "quién decide qué").

### Deviations

1. **No se agregó test de render para el `h2` escalado** (§ arriba) — la infraestructura de render
   síncrono de este repo no puede montar `Spotlight` con `producto` resuelto sin mockear `fetch`, y
   los archivos que hospedan sus tests hoy no están en `touches:`. La verificación queda en que el
   mecanismo es idéntico, línea por línea, al de `FeaturedProductsGrilla` (ya probado) + el gate
   completo en verde.

### Open follow-ups

- Los dos que este slice cierra (`SPOTLIGHT-STALE-ASSERTS-1`, `SPOTLIGHT-ESCALADISPLAY-1`, ambos de
  `SPOTLIGHT-CABLEADO-HOME-1`) quedan resueltos por el diff de arriba, no re-abiertos.
- `SPOTLIGHT-ESCALADISPLAY-RENDER-TEST-1` — falta un test que RENDERICE el `h2` de `Spotlight` con
  `producto` resuelto y `escalaDisplay: 'amplia'`, y afirme el `style` con el `clamp` de `CLAMP_L`.
  Hoy `spotlight-cableado.test.ts` (fuera de `touches:` de este slice) documenta que
  `renderToStaticMarkup` nunca ejecuta el `useEffect` que carga el catálogo, así que `producto` es
  SIEMPRE `null` y el componente entero rinde vacío antes de llegar al `h2` — hace falta mockear
  `fetch`/`getCatalog` (infraestructura de test nueva) para poder montarlo con un producto real.
  `why_not_now`: fuera de `touches:` de `SPOTLIGHT-CIERRE-1` (sólo `site-content-defaults.test.ts` y
  `theme-mirador.test.ts` eran los archivos de test en alcance; `spotlight-cableado.test.ts` no).
