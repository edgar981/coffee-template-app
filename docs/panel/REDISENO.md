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
- **Titular:** «5 pedidos necesitan tu atención», con la línea «3 en camino · 6 por preparar · hoy
  entraron 23».
- **Buscador** por número, cliente o teléfono, y **cinco pestañas** con su cuenta: Necesitan
  atención · Por preparar · En camino · Por cobrar · Todos. Entregados, cancelados, canal y fecha
  pasan a «Más filtros».
- **Detalle, en orden:**
  1. Cabecera: cliente, número y total.
  2. **«Siguiente paso»**: la razón y un solo botón principal (Registrar pago, Verificar
     comprobante, Programar entrega, Marcar en camino, Marcar entregado). En ámbar si es atención.
  3. El recorrido de cuatro pasos.
  4. Tres resúmenes: Pago · Entrega · Cliente.
  5. Productos, Recorrido y Notas internas.
- **Vista Tablero:** las mismas filas agrupadas por etapa (Por preparar · Preparando · En camino ·
  Entregados hoy), para quien despacha.
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
- **Pagos y cobros** lleva interruptores con nombres humanos: «Pagan antes de recibir», «Pagan al
  recibir» y la pasarela con Tarjeta · PSE · Nequi en vez de códigos.
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
| 3 | `PANEL-PEDIDOS-BUSCADOR-1` — buscador y 5 pestañas con «Más filtros»; «En camino» en todas partes | `pedidos/`, `lib/pedidos/filtros.ts` | |
| 4 | `PANEL-PEDIDOS-SIGUIENTE-PASO-1` — reordenar el detalle con siguiente paso y resúmenes; pasar los modales a Duna | `pedidos/`, `NewOrderModal.tsx`, `ScheduleDeliveryModal.tsx`, `RegisterPaymentModal.tsx` | |
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
- Las **cifras del prototipo** son de una tienda de ejemplo (Finca San Adolfo); no son datos reales.
