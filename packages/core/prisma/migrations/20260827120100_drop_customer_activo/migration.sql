-- Customer.activo: se RETIRA (§ Backlog #8).
--
-- Un cliente no se desactiva —existe o no—, y si dejó de comprar eso es un hecho
-- MEDIBLE (su última orden pagada), no un estado que alguien marque. La columna
-- llevaba meses sin que nadie la pidiera: ningún formulario la exponía, ninguna
-- pantalla la mostraba, y su único LECTOR (el `where activo:true` del barrido
-- `reactivacion_cliente`) era DECORATIVO —todo cliente valía `true`—. Medido en
-- dev: con y sin ese `where`, el conjunto de reactivación era IDÉNTICO (7 = 7).
-- El `where` se retiró en el mismo commit; el predicado queda correcto porque
-- `total_pedidos > 0` (órdenes pagadas) ya excluye a quien nunca compró.
--
-- DESTRUCTIVA pero SIN pérdida de dato en uso: producción está en el default
-- (0 clientes con activo=false, verificado por el owner en la consola de Neon),
-- así que el drop no cambia nada visible. El código que dejó de leer/escribir la
-- columna viaja en ESTE mismo commit que el DROP, nunca en uno posterior.

ALTER TABLE "Customer" DROP COLUMN "activo";
