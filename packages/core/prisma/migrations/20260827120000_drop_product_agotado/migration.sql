-- Product.agotado: se RETIRA (§ Backlog #10).
--
-- Era una bandera manual de disponibilidad con CERO escritores en la app (el POST
-- no la ponía, el PATCH la excluía) — sólo el seed la escribía, y a `false`. Su
-- único lector era el catálogo, en `disponible = stock > 0 && !agotado`.
--
-- Su único aporte SOBRE `stock = 0` era "no vendible CON stock > 0", y ese hueco
-- ya lo cubre `activo:false` (el producto desaparece del catálogo y vuelve cuando
-- se quiera). Lo que `agotado` agregaba —seguir VISIBLE— no paga su complejidad en
-- un catálogo de cuatro SKU, y exponía una contradicción irresoluble para el
-- operador ("5 en existencia" en el panel, "Agotado" en la tienda). Ahora
-- `disponible` depende SÓLO del stock.
--
-- DESTRUCTIVA pero SIN pérdida de dato en uso: producción está en el default
-- (0 productos con agotado=true, verificado por el owner en la consola de Neon),
-- así que el drop no cambia nada visible. El código que dejó de leer la columna
-- viaja en ESTE mismo commit, nunca en uno posterior.

ALTER TABLE "Product" DROP COLUMN "agotado";
