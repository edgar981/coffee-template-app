# Rediseño del panel (`/admin`) — propuesta

**Fecha:** 2026-10-03
**Rama:** `slice/corte-reescritura-prototipo-1`
**Estado:** PROPUESTA. Este documento no cambia código. Cada slice del § 4 necesita su propio visto
bueno. Hermano de `docs/editor-tienda/REDISENO.md` (el editor de tienda) y de `DUNA-DS.md` (el brief
del panel, que esta propuesta sigue en todo lo que el código aún no cumple).
**Prototipo navegable:** https://claude.ai/artifact/3yw6zhJ3vERFMfccvyQHTz (privado hasta que el
owner lo comparta). Recorre solo diez capítulos (~90 s), se puede usar a mano y tiene modo oscuro.
La lámina «Diagnóstico» resume las notas por sección.

---

## 1 · Resumen

El panel ya tiene buen esqueleto: las secciones del brief, el sistema de tokens de Duna y varias
frases bien escritas (Pagos, Automatizaciones). Lo que pesa es otra cosa:

- **Dos sistemas visuales conviven.** Componentes viejos (shadcn y Tailwind) están junto a los de
  Duna en modales, menús, formularios de contraseña y gráficas.
- **Vocabulario inconsistente.** Pedido u orden, «En camino», «En ruta» o «Despachado», tuteo con
  voseo, y tres descripciones distintas por rol.
- **Pantallas que no responden su pregunta.** Inventario no dice qué tienes. Analítica habla como
  nota de desarrollo. Hoy pone la cifra principal más chica que las tarjetas.
- **Acciones lejos de su contexto.** «Registrar pago» queda a media columna. El historial de un
  cliente no abre sus pedidos. Pausar un producto está escondido dentro de Eliminar.

La propuesta se apoya en seis principios, que aplican a todas las secciones:

| # | Principio | En la práctica |
|---|---|---|
| 1 | **Una frase arriba** | Cada pantalla abre respondiendo su pregunta, con los números dentro («Tienes 108 unidades en 8 productos»). |
| 2 | **Un siguiente paso** | Donde hay trabajo, un solo botón principal que lo hace. |
| 3 | **El sol, solo para lo urgente** | El ámbar marca lo que espera del dueño y nada decorativo lo usa (hoy el avatar del menú lo usa). |
| 4 | **Estados como posición** | Recibido → Preparando → En camino → Entregado, como recorrido. Respeta la nota de `tokens.css`: «En curso no es un color: es una posición». |
| 5 | **Editar donde se lee** | Los ajustes van dentro de la frase y cada bloque se edita por separado. Nada de formularios de seis bloques. |
| 6 | **Un solo idioma** | Pedidos, nunca órdenes. En camino, nunca en ruta. Tú, nunca vos. |

---

## 2 · Diagnóstico por sección (medido leyendo el código)

La nota va de 1 a 10 y dice cuánto necesita la sección el rediseño. Las que van **en negrita**
son las que el prototipo trata a fondo.

| Sección | Nota | Lo que duele hoy | Dónde |
|---|---|---|---|
| **Analítica** | 8 | Texto de desarrollo visible («dato del seed hasta la sesión con el cliente», «(SN-)», «la lista de Órdenes», «provisionales hasta definir la política de cobro»). El período cambia 3 de 7 bloques y solo lo explica en letra chica. Las gráficas usan estilos viejos (`constants/dashb-styles.ts`). «Cartera» y el «Por cobrar» de Hoy miden cosas distintas con el mismo nombre. | `app/(admin)/admin/analitica/` |
| **Configuración** | 8 | Editar un correo abre los seis bloques a la vez, incluidos los medios de pago. Se ofrece el rol Empleado aunque `ROLES_INVITABLES = ['MANAGER']` (`packages/core/src/usuarios.ts:121`), así que bajar a alguien a STAFF lo deja sin acceso. Los cambios de rol no piden confirmación, ni siquiera para hacer dueño a alguien, y el menú de rol no se oculta a quien no es dueño (`configuracion/page.tsx:312`). El menú ⋮ está hecho a mano y la Pasarela muestra códigos crudos (`c.tipo`). | `configuracion/page.tsx`, `DatosNegocioSeccion.tsx` |
| **Pedidos** | 6 | Nueve filtros sin buscador; se cargan y dibujan todos los pedidos. En el detalle, «Registrar pago» parece parte de Entrega (`:1176`). Para el mismo paso se usan «En camino», «En ruta» y «Despachado». Los modales usan shadcn (`NewOrderModal.tsx:301-326`, `ScheduleDeliveryModal.tsx:397-619`). | `pedidos/page.tsx`, `lib/pedidos/filtros.ts` |
| **Inventario** | 6 | No hay vista de existencias: la pantalla solo cuenta lo que pasó. Ajustar arranca en «Ajuste (fijar cantidad)», el tipo más riesgoso (`AdjustStockModal.tsx:16`), no muestra cómo queda y el motivo es texto libre. | `inventario/page.tsx`, `AdjustStockModal.tsx` |
| Productos | 6 | Unos 13 campos y las moliendas en 480 px (`MoliendasOpcionesEditor.tsx:106-131` pide 450 px por fila). Sin interruptor «Publicado»; pausar la venta solo se hace vía Eliminar. Al importar, el motivo del error nunca se muestra (`ImportarCatalogoSheet.tsx:146-150`). | `productos/page.tsx`, `ProductFormModal.tsx` |
| Pagos | 6 | Unos 8 controles en una fila y tres formas escondidas de filtrar. Los comprobantes por verificar no se ven en la lista. Usa voseo («Reintentá», «Volvé»). | `pagos/page.tsx`, `PagosCurva.tsx`, `Comprobantes.tsx` |
| Tienda | 6 | Cuatro formularios largos sin vista previa antes del botón del editor. Está suelta en el menú, contra el brief («no debe incluir Canales… Tienda»). | `tienda/page.tsx` |
| Perfil | 6 | Nombre, correo y rol se repiten. «Iniciada en este dispositivo» es texto fijo. Los dos formularios de contraseña se comportan distinto (`FormClaveNueva.tsx`). | `perfil/page.tsx` |
| **Hoy** | 5 | El titular (22 px) es más chico que los indicadores (27 px) y no tiene la frase ni la comparación del brief. Los indicadores mezclan saldo, hoy y mes bajo «Hoy», sin tope. Los widgets son fijos, no una biblioteca. | `dashboard/page.tsx`, `CurvaPedidosHoy.tsx`, `Indicador.tsx` |
| Clientes | 5 | El historial no abre los pedidos (`FilaPedido`, `:674-683`). No existe «nuevo pedido para este cliente». «Guardar» se apaga sin decir por qué (`CustomerFormModal.tsx:225`). | `clientes/page.tsx` |
| Menú y barra | 4 | La búsqueda es un ícono, cuando el brief pide una barra. El cambio de tema es instantáneo, cuando el brief pide movimiento. La campana es un desplegable casero sin Esc ni foco, y el avatar usa el ámbar. `DunaPie.tsx` no tiene quien lo importe. | `AdminChrome.tsx`, `TopBar.tsx`, `NotificationBell.tsx` |
| Automatizaciones | 4 | El diálogo de ajustes no valida, se cierra al guardar y guarda solo la hora aunque muestra minutos. La falla no dice por qué ni lleva a la tarjeta. «Nacen encendidas» contradice lo que el dueño ve. | `automatizaciones/page.tsx`, `AutomationConfigDialog.tsx` |

---

## 3 · La propuesta, sección por sección

### Estructura (menú lateral y barra)
- **Menú lateral:** el logo real (`public/brand/duna-mark-v1.svg`) con el negocio debajo. El nombre
  del negocio abre «Editar tienda · Ver tienda · Datos del negocio». Los grupos son Hoy · Operación
  (Pedidos, Productos, Clientes, Inventario, Pagos) · Crecimiento (Analítica, Automatizaciones).
- **Tienda sale del menú.** Su punto de entrada es el nombre del negocio.
- **Indicador del ítem activo:** se desliza entre ítems. Los puntos ámbar solo aparecen donde hay
  algo que atender, con su cuenta (Pedidos 5, Pagos 2).
- **Usuario al pie:** iniciales en tinta. Abre Mi perfil · Configuración · Cerrar sesión.
- **Barra superior:** la búsqueda es una barra visible a la izquierda («Buscar pedidos, clientes o
  productos · ⌘K»). A la derecha, el tema (sol y luna con transición de color en todo el panel) y
  los avisos (un popover de verdad, con Esc y foco).

### Hoy
- Fecha y hora, y en grande la frase del brief: «Hoy vendiste **$1.284.500** en **23 pedidos**.»
  Debajo, la comparación: «Un 18 % más que el viernes pasado…».
- **La duna:** pedidos por hora con el mismo viernes pasado punteado detrás y el sol ámbar (con su
  anillo que late) marcando el ahora. Al pasar el mouse se ve hora, cantidad y comparación; al
  hacer clic se abren los pedidos de esa hora.
- **Cuatro indicadores de hoy**, con tope de 5 al personalizar. «Por cobrar al entregar» cambia de
  nombre para no chocar con «¿Cuánto me deben?» de Analítica.
- **Widgets:**
  - Necesita tu atención: cada fila trae su botón (Registrar pago, Verificar, Reprogramar).
  - Meta del día.
  - Pedidos recientes, con su recorrido en miniatura.
  - Inventario crítico.
  - Duna sugiere: «la IA propone, tú decides»; solo cuando exista la IA.
  - Nota rápida.
- **Personalizar** muestra un modo de edición sobre las mismas tarjetas, sin hoja aparte.

### Pedidos

La pantalla deja de ser un feed cronológico con la atención salpicada entre filas. Se ordena por
**lo que le toca al operador**, y el camino del pedido pasa a ser el filtro.

**Dos modos, arriba a la derecha: «En curso» e «Historial».** En curso es lo abierto, sea del día
que sea; Historial es todo lo anterior. Nada en la pantalla supone un volumen ni un rubro: no hay
«la mesa» ni «hoy» como marco fijo, para que sirva igual a quien despacha 3 pedidos por semana y a
quien despacha 80 al día.

**En curso**

- **Titular:** «5 pedidos necesitan tu atención». Debajo: «10 pedidos abiertos por $963.000 · el
  más antiguo sin preparar lleva 7 h». No repite las cuentas de abajo.
- **Barra:** buscador (número, cliente o teléfono) y dos facetas que cruzan etapas: **Piden tu
  acción** y **Sin cobrar**. Con un filtro puesto aparece «Mostrando N de 13 · Ver todos».
- **El camino (cuatro etapas):** Por preparar → Preparando → En camino → Entregados hoy. Cada
  etapa muestra su cuenta, su plata y cuántos piden tu acción (o, si ninguno, un dato tranquilo:
  «Ninguno estancado»). En Lista, tocar una etapa la filtra. En Tablero, la misma franja se parte en
  cuatro y queda como encabezado de cada columna. La cuarta etapa, **Entregados**, cuenta los
  últimos 7 días y lleva al historial; en la lista y el tablero solo se ven los más recientes, con
  un enlace al resto.
- **Lista agrupada:** primero «Piden tu acción», con el botón que lo resuelve en la misma fila
  (Verificar, Registrar pago, Programar, Reprogramar). Después una sección por etapa, cada una con
  su cuenta y su total; «Entregados hoy» va atenuada.
  - **La fila:** número y hora a la izquierda (el número es como se nombra un pedido, no las
    iniciales del cliente); cliente con lo que pidió debajo, o el motivo en ámbar si pide acción;
    pago con punto de color y quién lo lleva; total alineado a la derecha.
  - **Teclado:** ↑ ↓ (o j / k) mueve la selección y Enter hace el siguiente paso.
  - **Buscar** mira lo abierto; si hay coincidencias más viejas lo dice al pie («Hay 25 pedidos más
    con «tomas» en el historial →»). La búsqueda ignora tildes.
- **Detalle como ficha:**
  1. «Pedido #1041 · WhatsApp · 2:05 p. m.», el cliente con teléfono, ciudad y un enlace a su
     historial («5 pedidos desde febrero»), y el total con su estado de pago.
  2. **Siguiente paso** con un solo botón principal (ámbar si es atención).
  3. **Recorrido con horas**: Recibido, Preparando, En camino y Entregado, cada uno con su hora; el
     que falló, en rojo.
  4. **Hechos en tres filas** sin cajas: Pago, Entrega, Dirección (con la zona).
  5. **Recibo**: productos, subtotal, envío y total. Luego el historial, las notas internas y,
     al pie, Cancelar pedido, Imprimir guía y Escribir al cliente.
  - El detalle queda fijo al hacer scroll y desplaza su propio contenido.
- **Tablero:** columnas sin caja bajo el encabezado de cada etapa. Lo que pide acción va primero
  en cada columna, con una línea ámbar a la izquierda, el motivo y su botón. Las demás tarjetas
  dicen número, tiempo, cliente, total, lo que pidió, pago y quién lo lleva. Con «Piden tu acción»
  o «Sin cobrar» puesto, el tablero no esconde nada: atenúa lo que no aplica.

**Historial**

- **Titular:** el período en una frase, como en Pagos: «En los últimos 7 días: 41 pedidos por
  $3.754.000», con «31 entregados · 10 en curso · 2 cancelados · promedio por pedido $91.561». Si
  se filtra por estado, la frase lo dice («Desde el 17 de agosto: 16 pedidos cancelados»).
- **Barra:** buscador en todo el historial (ignora el período), período (Hoy · 7 días · el mes en
  curso · el mes pasado · Todo), estado en un select nativo (Todos · Entregados · En curso ·
  Cancelados) y «Descargar CSV».
- **Pedidos por día:** una barra por día del período. Con pocos días cada barra lleva su fecha; con
  muchos, solo el primero y «hoy». Tocar un día muestra solo ese día (aparece como chip con ×).
  Los días sin pedidos quedan como un trazo mínimo: también es información.
- **Lista por día:** encabezado «Miércoles 30 de septiembre · 4 pedidos · $569.000» y filas con
  número, hora, cliente, lo que pidió, estado (Entregado / Cancelado / En curso · etapa), pago y
  total. Un cancelado va tachado y no suma. Carga de a 80 filas con «Mostrar 80 más».
- **El detalle es la misma ficha** que en curso. Un pedido entregado dice «Completo»; uno
  cancelado lo marca en el recorrido.

**Formularios**

- **Formularios:**
  - Registrar pago: método con un toque, «¿Cuándo entró?» (Hoy, Ayer, Otra fecha) y comprobante
    opcional.
  - Programar entrega: quién lo lleva y cuándo, con chips.

### Productos
- Tarjetas con foto, precio y barra de existencias con la marca del mínimo. «Por reponer» y
  «Agotado» como chips.
- La **ficha es una hoja ancha con pestañas** (General · Precio y existencias · Moliendas · Fotos).
  Lleva «Publicado» en la cabecera y «Pausar venta» a la vista.
- La pestaña de precio calcula **lo que te queda por unidad** (precio − costo). Las existencias no
  se editan en la ficha: se cambian desde Ajustar, que deja rastro.

### Clientes
- Titular «64 clientes, 22 volvieron a comprar».
- El detalle lleva tres cifras (pedidos, ha comprado, llega por) y **«Nuevo pedido para Laura»**.
- El historial abre cada pedido.

### Inventario
- **Existencias primero:** «Tienes 108 unidades en 8 productos». Cada producto muestra su barra con
  el mínimo, su estado y un botón Ajustar. Movimientos pasa a ser la segunda pestaña.
- **Ajustar** pregunta en palabras: «Llegó más» (por defecto) · «Salió» · «Conté y hay» · «Me
  devolvieron».
  - Atajos +6, +12 y +24.
  - **«Quedará en 16»** antes de guardar, con la barra y si sale o no de «Por reponer».
  - Motivo con un toque: Tostión nueva, Merma, Degustación, Error de conteo.

### Pagos
- La frase de hoy se mantiene; es de lo mejor del panel.
- **La franja «Por verificar» va arriba, en ámbar**, con Verificar y Rechazar en un toque.
- Un solo selector de período, la gráfica diaria apilada por método (colores `--duna-serie-*`) y
  la lista de pagos.

### Analítica
- **Cuatro preguntas con la misma anatomía:** pregunta · alcance · respuesta en una frase · una
  gráfica · «Cómo se calcula» plegado.
  1. ¿Estoy ganando o solo vendiendo? Cuánto te quedó, la barra costos/te queda y lo que más te
     deja.
  2. ¿Cuánto me deben? Lo pendiente por tipo (contraentrega en la calle, comprobantes por
     verificar, pago previsto) y por antigüedad.
  3. ¿Voy creciendo? Los 12 meses con el sol en el mes en curso y «Ver también lo que te queda».
  4. ¿De quién depende mi negocio? Concentración en 5 clientes y canales.
- **Cada bloque lleva su alcance a la vista** («Este mes», «Al día de hoy», «Últimos 12 meses»).
  Cuando el período cambia, parpadean solo los bloques que cambiaron. Así deja de hacer falta la
  letra chica.

### Automatizaciones
- **Se ajustan dentro de la frase:** «Avísame cuando un pedido lleve [− 3 +] días despachado sin
  que lo cobremos». Nada de diálogo, y la validación queda en el propio control.
- **La que falla** sube arriba con su motivo y «Reintentar ahora», y después confirma el resultado.
- Grupos: Te avisan en el panel · Le escriben un correo al equipo · Le escriben al cliente por
  WhatsApp (bloqueado hasta conectar).

### Configuración
- Subsecciones a la izquierda: Negocio · Contacto y redes · Correos · Pagos y cobros · Equipo.
  **Cada bloque tiene su propio Editar**, con Cancelar y Guardar a la derecha.
- **Pagos y cobros** (rehecho en la v2 del prototipo):
  - Una sola lista, **«Cómo te pueden pagar»**, en el orden en que el cliente la ve, con asa para
    reordenar. Cada medio muestra su ícono, nombre, el dato clave (número, llave, cuenta ···· 4821,
    tope de efectivo), su estado (Activo · Apagado · Falta configurar) y un interruptor.
  - **Editar** abre el medio en el mismo lugar, con los campos de su tipo:
    - Nequi y Daviplata: número y a nombre de quién.
    - Bre-B: tipo de llave y la llave.
    - Transferencia: banco, ahorros o corriente, número, titular y NIT.
    - Efectivo: dónde aplica y hasta qué monto.
    - Todos llevan «Lo que le dices a tu cliente al elegirlo» y, si aplica, «Pedirle la foto del
      comprobante». Abajo están Quitar, Cancelar y Guardar.
  - Un medio sin datos no se puede encender: su interruptor abre «Configurar».
  - **Agregar medio** abre una hoja con los tipos. Los que ya existen aparecen como «Ya lo tienes»;
    transferencia permite **varias cuentas**. Después pide el formulario del tipo y termina en
    «Agregar y activar».
  - Al lado, **«Así lo ve tu cliente»**: el selector de pago de la tienda, que se actualiza en vivo
    con lo que se enciende, se apaga o se agrega.
  - El pago en línea (Wompi) va aparte, con sus medios en chips y «Abrir Wompi ↗».
- **Equipo:** dos roles explicados en una línea cada uno. El cambio de rol pide confirmación («¿Hacer
  dueña a Natalia Mejía? Podrá ver y cambiar los medios de pago…»). Las invitaciones pendientes van
  con «Reenviar».

### Perfil y Tienda
- **Perfil:** tres bloques cortos (nombre, contraseña, sesiones reales). Guardar se apaga si no hay
  cambios.
- **Tienda:** una portada con la tienda en miniatura y «Abrir el editor». Menú, encabezado y pie
  **pasan al editor**, con vista previa. Depende de los slices del rediseño del editor.

---

## 4 · Plan por slices (cada uno con su visto bueno)

El orden pone primero lo que más se nota y menos cuesta. Ninguna de las superficies de este plan
está en la lista Tier 1 de `CLAUDE.md`: son `app/(admin)/` y `components/admin/`. Solo cambian la
interfaz que llama a las puertas de dinero; las puertas mismas no se tocan.

| # | Slice | Toca | Nota |
|---|---|---|---|
| 1 | `PANEL-ANALITICA-COPIA-1` — quitar el texto de desarrollo y nombrar distinto «Cartera» y «Por cobrar» | `analitica/` | Solo texto. Se ve el mismo día. |
| 2 | `PANEL-ROLES-HONESTOS-1` — sacar STAFF de la leyenda y de «Cambiar rol», confirmar promociones y ocultar el menú a quien no es dueño | `configuracion/page.tsx`, `InviteUserModal.tsx` | Cierra un camino que deja a alguien sin acceso. |
| 3 | `PANEL-PEDIDOS-CAMINO-1` — buscador, facetas «Piden tu acción» y «Sin cobrar», franja de cuatro etapas y lista agrupada con la acción en la fila; «En camino» en todas partes | `pedidos/`, `lib/pedidos/filtros.ts` | Reemplaza los nueve carriles de hoy (§ Backlog #35). Las etapas y las facetas reusan los predicados que ya existen (`motivosDeAtencion`, `isPorCobrar`); no hay definición nueva. |
| 3b | `PANEL-PEDIDOS-HISTORIAL-1` — modo Historial: período, estado, pedidos por día, lista por día con carga paginada, búsqueda en todo y CSV | `pedidos/`, `app/api/orders/route.ts` | Hoy `GET /api/orders` trae todo sin paginar. El historial necesita paginar y filtrar por fecha en el servidor; esa ruta está en Tier 1 (sesión de solo lectura primero). |
| 4 | `PANEL-PEDIDOS-FICHA-1` — el detalle como ficha: siguiente paso, recorrido con horas, hechos en filas y recibo; tablero con encabezado por etapa; pasar los modales a Duna | `pedidos/`, `NewOrderModal.tsx`, `ScheduleDeliveryModal.tsx`, `RegisterPaymentModal.tsx` | |
| 5 | `PANEL-INVENTARIO-EXISTENCIAS-1` — pestaña Existencias y ajuste con vista previa, «Llegó más» por defecto y motivos | `inventario/`, `AdjustStockModal.tsx` | El motivo sigue siendo texto: los chips solo lo escriben. |
| 6 | `PANEL-CONFIG-POR-BLOQUES-1` — subsecciones con edición por bloque | `configuracion/`, `DatosNegocioSeccion.tsx` | |
| 7 | `PANEL-HOY-FRASE-1` — titular del brief, duna con comparación e indicadores con tope | `dashboard/`, `CurvaPedidosHoy.tsx`, `Indicador.tsx` | La comparación necesita una lectura nueva (mismo día de la semana pasada), sin cambio de esquema. |
| 8 | `PANEL-PAGOS-POR-VERIFICAR-1` — la franja por verificar y un solo selector de período | `pagos/`, `Comprobantes.tsx` | |
| 9 | `PANEL-PRODUCTOS-FICHA-1` — ficha ancha por pestañas, «Publicado» y «Pausar venta» | `ProductFormModal.tsx`, `ProductoAccionesMenu.tsx` | «Publicado» y «Pausar venta» usan el `activo` que ya existe. |
| 10 | `PANEL-ESTRUCTURA-1` — barra de búsqueda, tema con transición, avatar en tinta, campana accesible y Tienda fuera del menú | `AdminChrome.tsx`, `TopBar.tsx`, `NotificationBell.tsx`, `constants/admin-nav.ts` | Quitar Tienda espera a que el editor absorba menú, encabezado y pie. |
| 11 | `PANEL-AUTOMATIZACIONES-EN-FRASE-1` — ajustes dentro de la frase y la falla con su motivo | `automatizaciones/`, `AutomationConfigDialog.tsx` | Si el motivo de la última falla no se guarda hoy, hace falta un campo nuevo (gate del owner). |
| 12 | `PANEL-CLIENTES-1` — historial que abre pedidos y «Nuevo pedido para…» | `clientes/` | |
| 13 | `PANEL-PERFIL-1` — tres bloques; un solo formulario de contraseña | `perfil/`, `FormClaveNueva.tsx` | |

---

## 5 · Lo que esta propuesta NO decide

- La **Meta del día**: es un dato nuevo (una cifra por negocio). Hace falta decidir si existe y
  dónde se configura.
- **Duna sugiere**: depende de que exista la IA en el panel. El texto del prototipo es ilustrativo.
- Las **descripciones finales de los roles**: tienen que salir de una sola fuente, no de tres.
- Partes de **Pagos y cobros** que pueden no existir hoy en el modelo:
  - Varias cuentas de transferencia.
  - El orden en que el cliente ve los medios.
  - Un texto de instrucciones por medio.
  - «Pedir comprobante» por medio.
  - El tope de efectivo.
  - El tipo «Otro medio».
  Cualquiera que no exista es un campo nuevo (gate del owner).
- La **fila y la tarjeta de pedido**: en agosto se decidió no tocar la tarjeta hasta medirla en
  la pantalla donde se trabaja (§ «un número de layout sólo vale si viene de la pantalla donde se
  TRABAJA»). Esta propuesta la cambia. Antes de construirla hay que medir en esa pantalla cuántas
  filas caben con la fila nueva (unos 58 px).
- **Qué cuenta como «en curso»**: la propuesta lo define como todo lo que no está entregado y
  pagado ni cancelado, sin importar la fecha. Un pedido entregado y sin cobrar sigue en curso.
- **Teclado en la lista** (↑ ↓, Enter): es capacidad nueva. Enter dispara el siguiente paso, así
  que necesita la misma guarda de doble envío que los botones (`useAccionGuardada`).
- Las **cifras del prototipo** son de una tienda de ejemplo (Finca San Adolfo); no son datos reales.
