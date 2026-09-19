-- La portada del producto AL MOMENTO DE COMPRAR (§ CHECKOUT-RESUMEN-PIERDE-LA-FOTO-1) —
-- INSTANTÁNEA, la MISMA decisión que ya protege `producto_nombre`/`precio_unitario`: el resumen
-- del pedido no se resuelve contra el producto vivo, para que un rediseño de la ficha no le
-- cambie la foto a una compra ya hecha. ADITIVA, NULLABLE, SIN DEFAULT: nace NULL para toda fila
-- existente y se queda así — no se rellena con la imagen actual del producto (eso fabricaría la
-- mentira que esta columna existe para impedir). El comprador ve el placeholder de marca
-- (`imagenPortada`) para toda orden anterior a este slice.
ALTER TABLE "OrderItem" ADD COLUMN "producto_imagen" TEXT;
