
# Duna Admin Panel

Este documento se realiza para el diseño del panel que utilizarán los clientes de Duna.

Primero se definen las pantallas que tendrá, y funcionalidades y contenido de las mismas.
Se debe mantener "motion"/interactividad que tienen algunos iconos/botones actualmente en el panel de Duna en producción, como al del momento de cambiar de modo claro/oscuro.
----------

## Hoy

Se debe evidenciar la fecha y hora, tal como está en el HTML "Duna os". El titular en prosa ("Hoy has vendido $1.284.500 en 23 pedidos"), seguido de un "insight" ("Un 18 % más que el jueves pasado. La mañana estuvo tranquila; el pico llegó después del almuerzo."), la gráfica igualmente, está 100% en el logo de Duna, lo que la hace única. Una línea de tendencia con el sol en ámbar, en el HTML el sol no tiene "motion" pero el ring que lo rodea debería tener, como "vibrando". La gráfica debe incluir el timeline. Abajo de eso irían 3 indicadores, cuya aparición puede ser personalizable/configurable, como se hace con los widgets en el panel de producción actualmente (Puedes elegir cuales se muestran y cuántos), podemos intentar probar con un max de 4 o 5, así no sufre la estética de la página.

Lista de indicadores posibles:
-  Ordenes/Pedidos hoy
-   Conversaciones hoy
-   Promedio por orden
-   Por cobrar (Contra entrega despachada)
-  Ordenes del mes
- Alertas de stock
- Ordenes/Pedidos pendientes

Debajo de la fila de indicadores se incluirían los widgets de atención/sugerencias, etc. Igual que los indicadores, la persona que maneje el panel podrá seleccionar que widgets desea ver o le interesan más para su tipo de negocio, sin embargo habrá una configuración por default, como existe actualmente en el panel de Duna prod.

Biblioteca de widgets:

-   Necesita tu atención
    
-   Conversaciones activas
    
-   Meta del día
    
-   Pedidos recientes
    
-  Nota rápida
- Inventario crítico
- Duna sugiere (Posible cuando se agregue IA al panel)
  
En el panel actual de Duna ya existen tanto indicadores como widgets antes mencionados, habría que verificar cuales no existen y agregarlos.

----------
## Ordenes/Pedidos

Debe basarse en el diseño de "Duna os". Si hay algo en la página de ordenes que requiere atención, debe mostrarse activo en el punto amber en el sidebar. 
En la página dividir/filtrar en: Todos, Necesitan atención, En preparación, En camino, Entregados, Por Cobrar, Cancelado.

Cada elemento de la lista de ordenes debe mostrar: nombre de cliente, número de orden, total, canal, un estado, indicador de progreso y hace "x cantidad de tiempo" del último estado/interacción, respecto a la orden, registrado.

El componente de detalle de la orden debe ser basado en el mostrado en "Duna os".
Sin embargo los elementos que debe listar son los siguientes: Nombre, # de orden, estado del pago (Pagado, Contraentrega, Sin acreditar), canal, dirección si es para domicilio/envío o recoge en tienda para pickup, desglose de los elementos de la orden, método de pago, recorrido del pedido, botones de acción dependiendo del estado.

----------
## Conversaciones

Debe estar basado en la estructura de las imagenes: duna-os-conversaciones-oscuro y duna-os-conversaciones-claro, pero con el estilo de "Duna os" (html).

----------
## Clientes

Igual que la página clientes de "Duna os". Lista de clientes con el detalle de los mismos.
        
----------
## Productos

Igual que la página clientes de "Duna os". Debería poder crear un producto, además de listar los productos en cuadrícula o lista. 
Cada card debería mostrar la imagen del producto, el nombre, precio, un indicador de inventario de cuántos quedan, numero en color diferencial si el producto se está agotando. Un chip en el card que indique si el producto está disponible, o agotado. 

----------
## Analítica

Igual que la página clientes de "Duna os". Debería seguir ese modelo, grafica + insight, que aporta información de valor. Idealmente incluir las mismas gráficas y timeline picker.

----------
Demás páginas a incluir que no se muestra diseño: Inventario y Pagos, en la sección Operación, y Automatizaciones en la sección Analítica. 

Página a remover/no incluir en el panel: Entregas

----------
## Sidebar

Incluye el logo real de Duna (icono+letra) al mismo nivel, debajo de él el nombre del negocio.

Debe tener la división actual, Hoy, Operación, Crecimiento. No debe incluir la sección Canales, ni las sub secciones en ella (Tienda, WhatsApp).

Al final del sidebar debe ir el icono/badge que indica el usuario loggeado, con interactividad. Al dar click debería mostrar: Mi perfil, configuración y cerrar sesión como actualmente en el panel de Duna prod.

----------
## Topbar

Debe incluir la barra de búsqueda y ubicarla hacia la izq en la pantalla (hacia el lado del sidebar), manteniendo proporciones adecuadas. A la derecha debe incluir solamente el botón de modos y notificaciones, como está actualmente el panel de Duna en prod.

----------
Además de Inventario, Pagos y utomatizaciones, cualquier otro tema no mencionado/olvidado de notar en el documento se debe preguntar para tomar decisión.