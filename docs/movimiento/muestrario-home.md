# Censo de movimiento — muestrario-home

- URL: https://coffee-template-app-onix.vercel.app/
- Generado: 2026-09-27T20:29:02.925Z
- Viewport: 1280×900
- Plan: 6 posición(es) de scroll × 3 instante(s) de tiempo (cada 400ms)
- Elementos candidatos (todo el `<body>`): 172
- Elementos con movimiento detectado: 16 (156 descartados por estáticos en todas las muestras)
- Duración de esta corrida: 40.2s

**LÍMITE DECLARADO: `hover` queda fuera de alcance** — este arnés no simula el puntero, así que un
elemento cuyo único movimiento depende de `:hover`/`:focus` se clasifica `estatico` acá. Ver
`docs/movimiento/README.md`.

## Calibración adaptativa (§ ARNES-CENSO-MOVIMIENTO-CALIBRACION-1)

5 tramo(s) de la pasada gruesa marcado(s) por un `revelado` preliminar, refinados con 3 sub-paso(s) cada uno:

- scrollY 0–717 → +3 posición(es): 179, 359, 538
- scrollY 717–1435 → +3 posición(es): 897, 1076, 1256
- scrollY 1435–2152 → +3 posición(es): 1614, 1794, 1973
- scrollY 2152–2870 → +3 posición(es): 2332, 2511, 2691
- scrollY 2870–3587 → +3 posición(es): 3049, 3229, 3408

La columna "en viewport" de la tabla de abajo es `visibles/total` posiciones de scroll (gruesas +
adaptativas) donde el elemento intersectó el viewport en alguna muestra — `0/N` (marcado con ⚠)
significa que el eje de TIEMPO nunca se pudo observar en vista para ese elemento (calibración (a)).

## Elementos con movimiento

| # | selector | clases | en viewport |
| --- | --- | --- | --- |
| 0 | `div` | revelado (Δ≈128.0, scrollY 0–359) | 7/21 |
| 1 | `div.flex` | ticker (629.7 u/s) | 7/21 |
| 2 | `span.absolute` | ticker (71.1 u/s) | 9/21 |
| 3 | `div` | revelado (Δ≈100.0, scrollY 0–179) | 6/21 |
| 4 | `div.w-[78vw]` | revelado (Δ≈100.0, scrollY 0–897) | 8/21 |
| 5 | `div.w-[78vw]` | revelado (Δ≈100.0, scrollY 0–897) | 8/21 |
| 6 | `div` | revelado (Δ≈100.0, scrollY 0–1614) | 5/21 |
| 7 | `div.relative` | revelado (Δ≈16.0, scrollY 1794–2691) | 6/21 |
| 8 | `div.relative` | revelado (Δ≈16.0, scrollY 1794–2691) | 7/21 |
| 9 | `div.relative` | revelado (Δ≈16.0, scrollY 1794–2691) | 6/21 |
| 10 | `div.relative` | revelado (Δ≈16.0, scrollY 1794–2691) | 6/21 |
| 11 | `div.mx-auto` | revelado (Δ≈100.0, scrollY 0–2332) | 5/21 |
| 12 | `div.grid` | revelado (Δ≈100.0, scrollY 0–2332) | 6/21 |
| 13 | `div` | revelado (Δ≈100.0, scrollY 0–2332) | 6/21 |
| 14 | `div.flex` | scrub (scrollY 0–3049) | 3/21 |
| 15 | `button.fixed` | revelado (Δ≈100.0, scrollY 897–1076) | 21/21 |

## Detalle por elemento

### [0] `div`
- clases: revelado
- en viewport durante el muestreo: 7/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 128) → matrix(1, 0, 0, 1, 0, 128)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [1] `div.flex`
- clases: ticker
- en viewport durante el muestreo: 7/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -1381.13, 0) → matrix(1, 0, 0, 1, -1568.4, 0)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -925.8, 0) → matrix(1, 0, 0, 1, -1113.3, 0)
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -677.252, 0) → matrix(1, 0, 0, 1, -868.654, 0)

### [2] `span.absolute`
- clases: ticker
- en viewport durante el muestreo: 9/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 17.9483) → matrix(1, 0, 0, 1, 0, 57.4135)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, -27.9649) → matrix(1, 0, 0, 1, 0, -4.48793)
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 59.6975) → matrix(1, 0, 0, 1, 0, -16.9908)

### [3] `div`
- clases: revelado
- en viewport durante el muestreo: 6/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [4] `div.w-[78vw]`
- clases: revelado
- en viewport durante el muestreo: 8/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [5] `div.w-[78vw]`
- clases: revelado
- en viewport durante el muestreo: 8/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [6] `div`
- clases: revelado
- en viewport durante el muestreo: 5/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [7] `div.relative`
- clases: revelado
- en viewport durante el muestreo: 6/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(0.997564, -0.0697565, 0.0697565, 0.997564, 1.1161, 15.961) → matrix(0.997564, -0.0697565, 0.0697565, 0.997564, 1.1161, 15.961)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform matrix(0.997564, -0.0697565, 0.0697565, 0.997564, 1.1161, 15.961) → matrix(0.997564, -0.0697565, 0.0697565, 0.997564, 1.1161, 15.961)
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [8] `div.relative`
- clases: revelado
- en viewport durante el muestreo: 7/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(0.99863, 0.052336, -0.052336, 0.99863, -0.837375, 15.9781) → matrix(0.99863, 0.052336, -0.052336, 0.99863, -0.837375, 15.9781)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform matrix(0.99863, 0.052336, -0.052336, 0.99863, -0.837375, 15.9781) → matrix(0.99863, 0.052336, -0.052336, 0.99863, -0.837375, 15.9781)
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [9] `div.relative`
- clases: revelado
- en viewport durante el muestreo: 6/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(0.99863, -0.052336, 0.052336, 0.99863, 0.837375, 15.9781) → matrix(0.99863, -0.052336, 0.052336, 0.99863, 0.837375, 15.9781)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform matrix(0.99863, -0.052336, 0.052336, 0.99863, 0.837375, 15.9781) → matrix(0.99863, -0.052336, 0.052336, 0.99863, 0.837375, 15.9781)
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [10] `div.relative`
- clases: revelado
- en viewport durante el muestreo: 6/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(0.997564, 0.0697565, -0.0697565, 0.997564, -1.1161, 15.961) → matrix(0.997564, 0.0697565, -0.0697565, 0.997564, -1.1161, 15.961)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform matrix(0.997564, 0.0697565, -0.0697565, 0.997564, -1.1161, 15.961) → matrix(0.997564, 0.0697565, -0.0697565, 0.997564, -1.1161, 15.961)
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [11] `div.mx-auto`
- clases: revelado
- en viewport durante el muestreo: 5/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [12] `div.grid`
- clases: revelado
- en viewport durante el muestreo: 6/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [13] `div`
- clases: revelado
- en viewport durante el muestreo: 6/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [14] `div.flex`
- clases: scrub
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 24) → matrix(1, 0, 0, 1, 0, 24)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

### [15] `button.fixed`
- clases: revelado
- en viewport durante el muestreo: 21/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 8) → matrix(1, 0, 0, 1, 0, 8)
  - scrollY=1794: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=3587: t=0→800: opacity 1.000→1.000, transform none → none

La traza cruda completa (todos los grupos de scroll, todas las muestras de tiempo) vive en
`muestrario-home.json`, al lado de este archivo.
