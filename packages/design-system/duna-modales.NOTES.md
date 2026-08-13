# Cómo se lee `duna-modales.html`

Maqueta de los diálogos de Pedidos. **No es una especificación.** Esta nota fija
qué de ella se adopta y qué no, porque sin ella quien la abra dentro de seis meses
la va a leer como espec — y ése es exactamente el error que esta lectura previno.

Entra al repo **sin editar**, a propósito: es evidencia de lo que se diseñó. Las
correcciones van acá, no en el archivo.

No confundir con `reference.html`, que es la **prueba viva** del sistema: aquélla
enlaza los tokens reales del paquete y se rompe si el sistema se rompe. Ésta trae
su propia copia de los valores y no está conectada a nada.

Contexto: § Backlog técnico #5 (H6) de `CLAUDE.md`. La maqueta se lee **cuando H6
se abra**; hoy los flujos de `/admin/pedidos` usan los modales shadcn de
`/admin/ordenes` y eso está decidido.

---

## 1 · SÍ es intención de FORMA. Esto se adopta

- **Dos formas, no una.** Drawer lateral para los cinco flujos con formulario
  (programar, editar, reprogramar, registrar pago, comprobantes); diálogo centrado
  para las dos confirmaciones (despacho sin cobro, cancelar). Es lo que hace que
  re-estilar el wrapper shadcn no alcance: el drawer es otra forma, no otro color.
- **`is-saving` bloquea el modal entero** mientras la mutación viaja.
  **Es sólo la mitad VISIBLE de la guarda de doble-submit.** La que de verdad corta
  la re-entrada del mismo tick es el ref síncrono de `useAccionGuardada` (§
  Doble-submit en `CLAUDE.md`): `disabled` depende de un re-render, así que dos
  clicks seguidos leen ambos el estado en `false` y pasan los dos. Una primitiva
  que bloquee el modal y haga creer que la guarda ya está puesta **reabre el
  agujero que ese hook cerró** — y ese agujero costó un doble-submit con 2,5 s
  entre clicks.
- **`btn-danger`**, que es la variante destructiva que al paquete le falta hoy.
  **El valor sale del paquete: `--duna-bad`, no `--bad`** (ver §2).
- **La fricción del destructivo** — checkbox de confirmación antes de habilitar
  "Cancelar definitivamente". **Es un CAMBIO DE COMPORTAMIENTO, no una consecuencia
  gratis del rediseño:** hoy `ConfirmDeleteDialog` no lo tiene y esto suma un paso.
  Decisión de producto pendiente; viaja con H6 y se toma como tal.
- También se adoptan, y ya coinciden con la doctrina del repo: el error **inline
  dentro del modal** (§ Toast = éxito, inline = error), el estado "incompleto" que
  marca el campo que falta (mismo criterio que `missingToDispatch`), Escape,
  click-fuera y `prefers-reduced-motion`.

## 2 · NO es fuente de VALORES

Sus tokens son una copia del paquete que **ya derivó**. Copiarlos reintroduce
diferencias en silencio:

| | maqueta | paquete |
|---|---|---|
| `--bad-ink` claro | `#96422F` | `#A0472F` |
| `--bad-ink` oscuro | `#E08A72` | `#D07C66` |
| `--shadow-3` | `24px 64px .18` | `16px 48px .14` |
| `--ok-ink` | **no existe** | `#3D6B4C` / `#7FAE8D` |

**Lo de `--ok-ink` es lo serio, y no es cosmético:** la maqueta pinta los badges con
`--ok` y `--bad` **como texto**, que es justo lo que las variantes `-ink` existen
para evitar — el fill no pasa AA como texto. Copiarlo es una **regresión de
contraste**, no una diferencia de gusto.

Además no usa la escala del sistema: espaciados en px sueltos y tipografías que no
caen en los nueve niveles (`.m-title` 1.15rem contra `--duna-text-title` 1.1875rem;
`.eyebrow` .66rem contra `--duna-text-caption` .6875rem).

Y escribe los tokens **sin prefijo** (`var(--bad)`), que en el paquete es
`--duna-bad`. Ver el encabezado de `tokens/tokens.css` para por qué.

**Los valores salen del paquete. Son los que están en producción.**

## 3 · NO es fuente de ALCANCE

Dibuja features que **el dominio no tiene**. Cada una es una decisión de producto
que se toma cuando toque, no porque esté dibujada:

- **PAGO PARCIAL** — monto editable, "saldo pendiente", un comprobante de "abono".
  **Cruza un tripwire ya escrito**: § La CARTERA de `CLAUDE.md` dice *"no hay pagos
  parciales… si algún día existen, ESTA es la línea que deja de ser cierta"*. Hoy
  `registrarPago` snapshotea `Order.total` server-side y transiciona a `pagado`; el
  modal ni siquiera acepta monto. Es la discrepancia más cara de la maqueta y toca
  cartera, analítica y el eje de cobro.
- **PSE y Tarjeta** como métodos. `MetodoPago` es NEQUI · DAVIPLATA · EFECTIVO ·
  TRANSFERENCIA · OTRO.
- **Monto y método POR COMPROBANTE.** El `Comprobante` es la EVIDENCIA, no la plata
  (§3.1): no tiene ninguno de los dos.
- **Motivo de cancelación persistido.** No hay columna, y `OrderStatusTransition`
  no tiene campo de motivo.
- **Aviso al cliente por WhatsApp** al cancelar. El canal es un STUB
  (`PENDIENTE_CANAL`) y no existe automatización de cancelación.
- **"El pago queda marcado para devolución manual."** Cancelar NO toca el `Payment`
  — comportamiento conservado y declarado; qué hacer con un pago sobre una orden
  cancelada sigue siendo una decisión pendiente.
- **Tres franjas horarias.** `shipping-config` tiene dos (`am`, `pm`).
- **Mensajeros como entidad**, con avatar y carga de trabajo ("Camilo tiene 2
  entregas hoy"). `Shipping.mensajero` es un String libre.
- **"Guardar borrador"** y **"Pedir otro comprobante"**: no existen.
- Vocabulario: dice "Aprobar" por verificar y "Sin pagar" por el badge de cobro ya
  decidido (Pagado · Contraentrega · Sin acreditar).

**Media que SÍ está:** el motivo del rechazo tiene columna y se escribe
(`Comprobante.notas_verificacion`). Lo que no existe es enviárselo al cliente.

## 4 · Un fósil conocido

El fondo simulado dibuja **cinco** `steps`. La secuencia canónica son **cuatro**
(Recibido · Preparando · En camino · Entregado).

Es el mismo error que el "Confirmado" que sobrevivió un mes dentro de
`reference.html`, ahora en otra maqueta — o sea **segunda evidencia del § Backlog
técnico #4**, que dice que nada garantiza que las etiquetas de dominio dibujadas
fuera del dominio no caduquen. No se corrige en el archivo: se anota acá, que es lo
que ese ítem propone hacer con los ejemplos que no puede mantener.
