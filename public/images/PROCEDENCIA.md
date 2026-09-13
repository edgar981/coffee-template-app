# Procedencia de las imágenes de `public/images/`

Este archivo existe para que la licencia de cada imagen sea **probable**, no sólo
afirmada. La licencia de Unsplash es irrevocable para lo que se descargó, pero sólo
si dentro de dos años alguien puede reconstruir QUÉ se descargó y CUÁNDO — sin este
registro, esa reconstrucción es imposible.

**Por qué Unsplash y no Pexels:** la Unsplash License nombra explícitamente el verbo
*"distribute"*, que es el nuestro — redistribuir estas imágenes dentro de un template
que se despliega para N clientes. La licencia de Pexels está redactada para el uso
final de quien la descarga, no para redistribución dentro de un producto.

## Imágenes de este slice (IMAGENES-STOCK-TEMPLATE-1, 2026-09-12)

| archivo | autor | id Unsplash | descargada |
| --- | --- | --- | --- |
| `hero-cerezas-v1.jpg` | Dang Cong | `JqF4IS65xEg` | 2026-09-12 |
| `historia-1-v1.jpg` | Hannah Busing | `0r5lHhXQtD4` | 2026-09-12 |
| `historia-2-v1.jpg` | Anton K | `96PWsk3fBNY` | 2026-09-12 |
| `historia-3-v1.jpg` | Carlos Felipe Ramírez Mesa | `U0dqLMx4vvw` | 2026-09-12 |
| `historia-4-v1.jpg` | Kia Sheikhy | `GmjzotmnUUk` | 2026-09-12 |

Licencia: **Unsplash License** en las cinco. URL de cada foto:
`https://unsplash.com/photos/<id>`. Los autores y los ids salen del parámetro `dl=`
que Unsplash pone en su propia URL de descarga — es evidencia primaria, no transcrita
de memoria.

## Retiros de este slice (NAYOLI-PNG-MUERTOS-1, 2026-09-12)

Se borraron `cafe-nayoli-250g-grano.png`, `cafe-nayoli-250g-molido.png`,
`cafe-nayoli-500g-grano-v2.png` y `cafe-nayoli-500g-molido-v2.png` (6,3 MB): **cero
referencias en el repo y cero apariciones en todo el historial** (`git log -S` por
archivo, sobre `--all`, da 0 los cuatro) — entraron como archivos y nunca los sirvió
ni el código ni un producto sembrado. No tienen procedencia registrada porque nunca
la tuvieron: son fotos del producto del cliente, sin autor ni licencia documentados
en este archivo, y decirlo es más honesto que omitirlos en silencio. Sus cuatro
`.webp` hermanos SÍ están en uso (`prisma/seed-products.ts`, y dos de ellos los sirve
hoy la fila de `SiteContent` de Nayoli en producción) y no se tocaron.

## Regla de mantenimiento

**Este archivo se actualiza al agregar o reemplazar cualquier imagen de `public/`.**
Un registro de procedencia que se queda viejo es peor que ninguno: afirma una cadena
de custodia que ya no cubre lo que hay en el directorio.
