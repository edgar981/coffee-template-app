# Censo de movimiento — cafeone-home

- URL: https://x-cafeone.myshopify.com/
- Generado: 2026-09-27T20:32:26.073Z
- Viewport: 1280×900
- Plan: 6 posición(es) de scroll × 3 instante(s) de tiempo (cada 400ms)
- Elementos candidatos (todo el `<body>`): 5240
- Elementos con movimiento detectado: 225 (5015 descartados por estáticos en todas las muestras)
- Duración de esta corrida: 50.7s

**LÍMITE DECLARADO: `hover` queda fuera de alcance** — este arnés no simula el puntero, así que un
elemento cuyo único movimiento depende de `:hover`/`:focus` se clasifica `estatico` acá. Ver
`docs/movimiento/README.md`.

## Calibración adaptativa (§ ARNES-CENSO-MOVIMIENTO-CALIBRACION-1)

5 tramo(s) de la pasada gruesa marcado(s) por un `revelado` preliminar, refinados con 3 sub-paso(s) cada uno:

- scrollY 0–3819 → +3 posición(es): 955, 1910, 2864
- scrollY 3819–7637 → +3 posición(es): 4774, 5728, 6683
- scrollY 7637–11456 → +3 posición(es): 8592, 9547, 10501
- scrollY 11456–15274 → +3 posición(es): 12411, 13365, 14320
- scrollY 15274–19093 → +3 posición(es): 16229, 17184, 18138

La columna "en viewport" de la tabla de abajo es `visibles/total` posiciones de scroll (gruesas +
adaptativas) donde el elemento intersectó el viewport en alguna muestra — `0/N` (marcado con ⚠)
significa que el eje de TIEMPO nunca se pudo observar en vista para ese elemento (calibración (a)).

## Elementos con movimiento

| # | selector | clases | en viewport |
| --- | --- | --- | --- |
| 0 | `div` | ticker (0.4 u/s) | 16/21 |
| 1 | `div` | ticker (0.4 u/s) | 16/21 |
| 2 | `div` | ticker (0.4 u/s) | 16/21 |
| 3 | `div` | ticker (0.4 u/s) | 16/21 |
| 4 | `div` | ticker (0.4 u/s) | 16/21 |
| 5 | `div` | ticker (0.4 u/s) | 16/21 |
| 6 | `div` | ticker (0.4 u/s) | 16/21 |
| 7 | `div` | ticker (0.4 u/s) | 16/21 |
| 8 | `div` | ticker (0.4 u/s) | 16/21 |
| 9 | `div` | ticker (0.4 u/s) | 16/21 |
| 10 | `div` | ticker (0.9 u/s) | 2/21 |
| 11 | `xo-parallax-scroll.w:100%` | revelado (Δ≈45.0, scrollY 0–955) | 3/21 |
| 12 | `xo-parallax-scroll.w:100vw` | revelado (Δ≈262.7, scrollY 0–955) | 3/21 |
| 13 | `xo-marquee-item` | ticker (116.6 u/s) + revelado (Δ≈238.1, scrollY 2864–19093) | 3/21 |
| 14 | `xo-marquee-item` | ticker (116.6 u/s) + revelado (Δ≈238.1, scrollY 2864–19093) | 3/21 |
| 15 | `xo-parallax-scroll` | revelado (Δ≈350.0, scrollY 0–1910) | 3/21 |
| 16 | `xo-animate.bgz:inherit` | scrub (scrollY 1910–19093) | 1/21 |
| 17 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 18 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 19 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 20 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 21 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 22 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 23 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 24 | `xo-animate` | scrub (scrollY 1910–19093) | 1/21 |
| 25 | `xo-animate` | scrub (scrollY 1910–19093) | 1/21 |
| 26 | `xo-animate.bgz:inherit` | scrub (scrollY 1910–19093) | 1/21 |
| 27 | `xo-animate.bgz:inherit` | scrub (scrollY 1910–19093) | 1/21 |
| 28 | `xo-animate.wrapper-button` | scrub (scrollY 1910–19093) | 1/21 |
| 29 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 30 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 31 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 32 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 33 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 34 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 35 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 36 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 37 | `xo-animate` | scrub (scrollY 1910–19093) | 1/21 |
| 38 | `xo-parallax-scroll.w:100%` | ticker (0.0 u/s) + revelado (Δ≈0.2, scrollY 2864–3819, 800ms) | 2/21 |
| 39 | `xo-animate.bgz:inherit` | ticker (24.3 u/s) + revelado (Δ≈100.0, scrollY 0–955) | 2/21 |
| 40 | `xo-parallax-scroll.w:100%` | revelado (Δ≈0.1, scrollY 2864–3819, 800ms) | 1/21 |
| 41 | `xo-animate.w:100%@+sm` | revelado (Δ≈100.0, scrollY 0–955) | 1/21 |
| 42 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–955) | 1/21 |
| 43 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–955) | 1/21 |
| 44 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–955) | 1/21 |
| 45 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–955) | 1/21 |
| 46 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–955) | 1/21 |
| 47 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–955) | 1/21 |
| 48 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 1/21 |
| 49 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 1/21 |
| 50 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 1/21 |
| 51 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 1/21 |
| 52 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 1/21 |
| 53 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 1/21 |
| 54 | `xo-animate` | ticker (21.0 u/s) + revelado (Δ≈0.0, scrollY 3819–19093) | 2/21 |
| 55 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 7/21 |
| 56 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 8/21 |
| 57 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–4774) | 8/21 |
| 58 | `div` | scrub (scrollY 0–19093) | 8/21 |
| 59 | `xo-parallax-scroll.w:fit-content` | ticker (387.0 u/s) | 8/21 |
| 60 | `div.scroll__item` | ticker (0.9 u/s) | 2/21 |
| 61 | `xo-animate.h:100%` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 62 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 63 | `div` | ticker (0.1 u/s) | 2/21 |
| 64 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 65 | `div` | ticker (0.1 u/s) | 2/21 |
| 66 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 67 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 68 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 69 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 70 | `div.scroll__item` | ticker (0.3 u/s) + revelado (Δ≈0.0, scrollY 4774–6683, 800ms) | 3/21 |
| 71 | `xo-animate.h:100%` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 72 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 73 | `div` | ticker (0.1 u/s) | 2/21 |
| 74 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 75 | `div` | ticker (0.1 u/s) | 2/21 |
| 76 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 77 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 78 | `xo-animate` | ticker (40.9 u/s) + revelado (Δ≈0.0, scrollY 4774–19093) | 2/21 |
| 79 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 80 | `div.scroll__item` | ticker (0.3 u/s) + revelado (Δ≈70.0, scrollY 6683–7637, 800ms) | 3/21 |
| 81 | `xo-animate.h:100%` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 82 | `xo-animate.wrapper-button` | ticker (63.3 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 83 | `div` | ticker (0.1 u/s) | 2/21 |
| 84 | `xo-animate.wrapper-button` | ticker (98.1 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 85 | `div` | ticker (0.1 u/s) | 2/21 |
| 86 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 87 | `xo-animate` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 88 | `xo-animate` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 89 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 90 | `div.scroll__item` | ticker (0.6 u/s) | 3/21 |
| 91 | `xo-animate.h:100%` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 92 | `xo-animate.wrapper-button` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 93 | `div` | ticker (0.1 u/s) | 2/21 |
| 94 | `xo-animate.wrapper-button` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 95 | `div` | ticker (0.1 u/s) | 2/21 |
| 96 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 97 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 98 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 99 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–4774) | 3/21 |
| 100 | `div.scroll__item` | ticker (0.2 u/s) + revelado (Δ≈70.0, scrollY 8592–9547) | 2/21 |
| 101 | `xo-animate.h:100%` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 102 | `xo-animate.wrapper-button` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 103 | `div` | ticker (0.1 u/s) | 2/21 |
| 104 | `xo-animate.wrapper-button` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 105 | `div` | ticker (0.1 u/s) | 2/21 |
| 106 | `xo-animate.bgz:inherit` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–4774) | 2/21 |
| 107 | `xo-animate` | ticker (124.1 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 108 | `xo-animate` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 109 | `xo-animate` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 110 | `div.scroll__item` | ticker (0.9 u/s) | 2/21 |
| 111 | `xo-animate.h:100%` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 112 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 113 | `div` | ticker (0.1 u/s) | 2/21 |
| 114 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 115 | `div` | ticker (0.1 u/s) | 2/21 |
| 116 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 117 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 118 | `xo-animate` | ticker (125.0 u/s) + revelado (Δ≈0.0, scrollY 7637–19093) | 2/21 |
| 119 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 120 | `div.scroll__item` | ticker (0.4 u/s) | 3/21 |
| 121 | `xo-animate.h:100%` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 122 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 123 | `div` | scrub (scrollY 0–19093) | 3/21 |
| 124 | `xo-animate.wrapper-button` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 125 | `div` | scrub (scrollY 0–19093) | 3/21 |
| 126 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 127 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 128 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 129 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 130 | `div.scroll__item` | ticker (0.3 u/s) + revelado (Δ≈70.0, scrollY 9547–10501, 800ms) | 3/21 |
| 131 | `xo-animate.h:100%` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 132 | `xo-marquee` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 133 | `xo-animate.wrapper-button` | ticker (77.3 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 134 | `div` | scrub (scrollY 0–19093) | 2/21 |
| 135 | `xo-animate.wrapper-button` | ticker (118.8 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 136 | `div` | scrub (scrollY 0–19093) | 2/21 |
| 137 | `xo-animate.bgz:inherit` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 138 | `xo-animate` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 139 | `xo-animate` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 140 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 3/21 |
| 141 | `xo-animate` | revelado (Δ≈100.0, scrollY 0–8592) | 1/21 |
| 142 | `xo-animate.h:100%` | ticker (85.8 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 143 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 11456–19093) | 1/21 |
| 144 | `xo-animate.h:100%` | ticker (83.7 u/s) + revelado (Δ≈0.0, scrollY 11456–19093) | 2/21 |
| 145 | `div` | scrub (scrollY 0–7637) | 0/3 ⚠ |
| 146 | `xo-marquee.xo-marquee-block` | revelado (Δ≈100.0, scrollY 0–8592) | 2/21 |
| 147 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 148 | `xo-animate` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 149 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 150 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 151 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 152 | `xo-animate` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 153 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 154 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 155 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 156 | `xo-animate` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 157 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 158 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 159 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 160 | `xo-animate` | revelado (Δ≈0.0, scrollY 12411–19093) | 1/21 |
| 161 | `xo-animate.h:100%` | ticker (71.7 u/s) + revelado (Δ≈0.0, scrollY 13365–19093) | 2/21 |
| 162 | `div` | scrub (scrollY 0–7637) | 0/3 ⚠ |
| 163 | `xo-parallax-scroll.w:100%` | revelado (Δ≈200.0, scrollY 13365–15274) | 2/21 |
| 164 | `xo-animate.bgz:inherit` | ticker (17.9 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 165 | `xo-animate.bgz:inherit` | ticker (34.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 166 | `xo-parallax-scroll` | ticker (18.9 u/s) + revelado (Δ≈200.0, scrollY 14320–15274, 800ms) | 2/21 |
| 167 | `xo-animate.w:100%@+sm` | ticker (57.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 168 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 169 | `xo-parallax-scroll` | ticker (143.9 u/s) + revelado (Δ≈200.0, scrollY 14320–15274, 800ms) | 2/21 |
| 170 | `xo-animate.w:100%@+sm` | ticker (89.2 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 171 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 172 | `xo-parallax-scroll` | ticker (185.2 u/s) | 2/21 |
| 173 | `xo-animate.w:100%@+sm` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 174 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 175 | `xo-parallax-scroll` | ticker (60.2 u/s) | 2/21 |
| 176 | `xo-animate.w:100%@+sm` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 177 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 178 | `xo-parallax-scroll` | revelado (Δ≈200.0, scrollY 15274–16229) | 2/21 |
| 179 | `xo-animate.w:100%@+sm` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 180 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 181 | `xo-parallax-scroll.w:100%` | ticker (0.6 u/s) | 2/21 |
| 182 | `xo-animate.bgz:inherit` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 183 | `xo-animate.h:100%` | ticker (114.7 u/s) + scrub (scrollY 0–16229) | 2/21 |
| 184 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 185 | `xo-animate.bgz:inherit` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 186 | `xo-animate.bgz:inherit` | ticker (125.0 u/s) + revelado (Δ≈100.0, scrollY 0–12411) | 2/21 |
| 187 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 16229–19093) | 1/21 |
| 188 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 16229–19093) | 1/21 |
| 189 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 16229–19093) | 1/21 |
| 190 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 16229–19093) | 1/21 |
| 191 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 192 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 193 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 194 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 195 | `div` | scrub (scrollY 0–19093) | 0/21 ⚠ |
| 196 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 16229–19093) | 1/21 |
| 197 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 16229–19093) | 1/21 |
| 198 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 16229–19093) | 1/21 |
| 199 | `xo-animate.w:100%@+sm` | ticker (57.1 u/s) + revelado (Δ≈0.0, scrollY 17184–19093) | 2/21 |
| 200 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 201 | `xo-animate.w:100%@+sm` | ticker (125.0 u/s) + revelado (Δ≈0.0, scrollY 16229–19093) | 2/21 |
| 202 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 203 | `xo-animate.w:100%@+sm` | ticker (71.8 u/s) + revelado (Δ≈0.0, scrollY 17184–19093) | 2/21 |
| 204 | `div` | scrub (scrollY 0–11456) | 0/4 ⚠ |
| 205 | `xo-animate.wrapper-button` | revelado (Δ≈0.0, scrollY 17184–19093) | 1/21 |
| 206 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 207 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 17184–19093) | 1/21 |
| 208 | `xo-animate.bgz:inherit` | scrub (scrollY 0–16229) | 1/21 |
| 209 | `xo-animate.wrapper-button` | scrub (scrollY 0–16229) | 1/21 |
| 210 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 211 | `xo-animate.bgz:inherit` | revelado (Δ≈0.0, scrollY 17184–19093) | 1/21 |
| 212 | `xo-animate.bgz:inherit` | scrub (scrollY 0–16229) | 1/21 |
| 213 | `xo-animate.wrapper-button` | scrub (scrollY 0–16229) | 1/21 |
| 214 | `div` | scrub (scrollY 0–19093) | 1/21 |
| 215 | `xo-animate.footer__logo-image` | scrub (scrollY 0–16229) | 1/21 |
| 216 | `xo-animate.bgz:inherit` | scrub (scrollY 0–16229) | 1/21 |
| 217 | `xo-animate.d:flex` | scrub (scrollY 0–16229) | 1/21 |
| 218 | `xo-animate.h:100%` | scrub (scrollY 0–19093) | 1/21 |
| 219 | `div` | scrub (scrollY 0–15274) | 0/5 ⚠ |
| 220 | `xo-animate.d:flex` | scrub (scrollY 0–16229) | 1/21 |
| 221 | `xo-animate.d:flex` | scrub (scrollY 0–19093) | 1/21 |
| 222 | `xo-animate` | scrub (scrollY 0–19093) | 1/21 |
| 223 | `xo-floating-sidebar.xo-floating-sidebar` | ticker (45.2 u/s) | 2/21 |
| 224 | `xo-turbo-progress-bar` | revelado (Δ≈100.0, scrollY 0–12411) | 18/21 |

## Detalle por elemento

### [0] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [1] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [2] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [3] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [4] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [5] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [6] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [7] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [8] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [9] `div`
- clases: ticker
- en viewport durante el muestreo: 16/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.666→0.009, transform matrix(0.665518, 0, 0, 0.665518, 0, 0) → matrix(0.00896804, 0, 0, 0.00896804, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.926→0.601, transform matrix(0.925619, 0, 0, 0.925619, 0, 0) → matrix(0.601038, 0, 0, 0.601038, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.103→0.000, transform matrix(0.103445, 0, 0, 0.103445, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [10] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.067→0.473, transform matrix(0.0671425, 0, 0, 0.0671425, 0, 0) → matrix(0.473133, 0, 0, 0.473133, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.320→0.041, transform matrix(0.319727, 0, 0, 0.319727, 0, 0) → matrix(0.040749, 0, 0, 0.040749, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [11] `xo-parallax-scroll.w:100%`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.150→0.150, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.600→0.600, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.600→0.600, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [12] `xo-parallax-scroll.w:100vw`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.250→0.250, transform matrix(1, 0, 0, 1, 0, 262.672) → matrix(1, 0, 0, 1, 0, 262.672)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [13] `xo-marquee-item`
- clases: ticker, revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -996.599, 0) → matrix(1, 0, 0, 1, -1101.37, 0)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -1352.6, 0) → matrix(1, 0, 0, 1, -1352.6, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -1114.47, 0) → matrix(1, 0, 0, 1, -1114.47, 0)

### [14] `xo-marquee-item`
- clases: ticker, revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -996.599, 0) → matrix(1, 0, 0, 1, -1101.37, 0)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -1352.6, 0) → matrix(1, 0, 0, 1, -1352.6, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -1114.47, 0) → matrix(1, 0, 0, 1, -1114.47, 0)

### [15] `xo-parallax-scroll`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 350) → matrix(1, 0, 0, 1, 0, 350)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [16] `xo-animate.bgz:inherit`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [17] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [18] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.854, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.853789, 0, 0, 0.853789, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.041→0.000, transform matrix(0.0406084, 0, 0, 0.0406084, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.000→0.075, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.0752021, 0, 0, 0.0752021, 0, 0)

### [19] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [20] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [21] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [22] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [23] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [24] `xo-animate`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [25] `xo-animate`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [26] `xo-animate.bgz:inherit`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [27] `xo-animate.bgz:inherit`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [28] `xo-animate.wrapper-button`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [29] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [30] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [31] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [32] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [33] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [34] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [35] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [36] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→1.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.999536, 0, 0, 0.999536, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.075→0.401, transform matrix(0.075194, 0, 0, 0.075194, 0, 0) → matrix(0.401083, 0, 0, 0.401083, 0, 0)

### [37] `xo-animate`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [38] `xo-parallax-scroll.w:100%`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix3d(0.996195, 0, 0.0871557, 0, 0, 1, 0, 0, -0.0871557, 0, 0.996195, 0, 0, 0, 0, 1) → matrix3d(0.996195, 0, 0.0871557, 0, 0, 1, 0, 0, -0.0871557, 0, 0.996195, 0, 0, 0, 0, 1)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix3d(0.996195, 0, -0.0871557, 0, 0, 1, 0, 0, 0.0871557, 0, 0.996195, 0, 0, 0, 0, 1) → matrix3d(0.996195, 0, -0.0871557, 0, 0, 1, 0, 0, 0.0871557, 0, 0.996195, 0, 0, 0, 0, 1)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix3d(0.996195, 0, -0.0871557, 0, 0, 1, 0, 0, 0.0871557, 0, 0.996195, 0, 0, 0, 0, 1) → matrix3d(0.996195, 0, -0.0871557, 0, 0, 1, 0, 0, 0.0871557, 0, 0.996195, 0, 0, 0, 0, 1)

### [39] `xo-animate.bgz:inherit`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [40] `xo-parallax-scroll.w:100%`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix3d(0.997564, 0, 0.0697565, 0, 0, 1, 0, 0, -0.0697565, 0, 0.997564, 0, 0, 0, 0, 1) → matrix3d(0.997564, 0, 0.0697565, 0, 0, 1, 0, 0, -0.0697565, 0, 0.997564, 0, 0, 0, 0, 1)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix3d(0.997564, 0, -0.0697565, 0, 0, 1, 0, 0, 0.0697565, 0, 0.997564, 0, 0, 0, 0, 1) → matrix3d(0.997564, 0, -0.0697565, 0, 0, 1, 0, 0, 0.0697565, 0, 0.997564, 0, 0, 0, 0, 1)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix3d(0.997564, 0, -0.0697565, 0, 0, 1, 0, 0, 0.0697565, 0, 0.997564, 0, 0, 0, 0, 1) → matrix3d(0.997564, 0, -0.0697565, 0, 0, 1, 0, 0, 0.0697565, 0, 0.997564, 0, 0, 0, 0, 1)

### [41] `xo-animate.w:100%@+sm`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [42] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [43] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [44] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [45] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [46] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [47] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [48] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [49] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [50] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [51] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [52] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [53] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [54] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [55] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 7/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [56] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 8/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [57] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 8/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [58] `div`
- clases: scrub
- en viewport durante el muestreo: 8/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [59] `xo-parallax-scroll.w:fit-content`
- clases: ticker
- en viewport durante el muestreo: 8/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 640, 0) → matrix(1, 0, 0, 1, 640, 0)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -3174.58, 0) → matrix(1, 0, 0, 1, -3365.51, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -4164, 0) → matrix(1, 0, 0, 1, -4164, 0)

### [60] `div.scroll__item`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=19093: t=0→800: opacity 0.300→0.300, transform none → none

### [61] `xo-animate.h:100%`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [62] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [63] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [64] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [65] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [66] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [67] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [68] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [69] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [70] `div.scroll__item`
- clases: ticker, revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=9547: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=19093: t=0→800: opacity 0.300→0.300, transform none → none

### [71] `xo-animate.h:100%`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [72] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [73] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [74] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [75] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [76] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [77] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [78] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [79] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [80] `div.scroll__item`
- clases: ticker, revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=9547: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=19093: t=0→800: opacity 0.300→0.300, transform none → none

### [81] `xo-animate.h:100%`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [82] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [83] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [84] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [85] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [86] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [87] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [88] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [89] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [90] `div.scroll__item`
- clases: ticker
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=9547: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=19093: t=0→800: opacity 0.300→0.300, transform none → none

### [91] `xo-animate.h:100%`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [92] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [93] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [94] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [95] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [96] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [97] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [98] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [99] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [100] `div.scroll__item`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=9547: t=0→800: opacity 0.305→0.300, transform none → none
  - scrollY=19093: t=0→800: opacity 0.300→0.300, transform none → none

### [101] `xo-animate.h:100%`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [102] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [103] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [104] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [105] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [106] `xo-animate.bgz:inherit`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [107] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [108] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [109] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [110] `div.scroll__item`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→0.300, transform none → none
  - scrollY=19093: t=0→800: opacity 0.300→0.300, transform none → none

### [111] `xo-animate.h:100%`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [112] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [113] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [114] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [115] `div`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [116] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [117] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [118] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [119] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [120] `div.scroll__item`
- clases: ticker
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=9547: t=0→800: opacity 0.455→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.300→0.300, transform none → none

### [121] `xo-animate.h:100%`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [122] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [123] `div`
- clases: scrub
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [124] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [125] `div`
- clases: scrub
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [126] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [127] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [128] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [129] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [130] `div.scroll__item`
- clases: ticker, revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=9547: t=0→800: opacity 0.300→0.300, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [131] `xo-animate.h:100%`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [132] `xo-marquee`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [133] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [134] `div`
- clases: scrub
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [135] `xo-animate.wrapper-button`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [136] `div`
- clases: scrub
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [137] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [138] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [139] `xo-animate`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [140] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 3/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [141] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [142] `xo-animate.h:100%`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [143] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [144] `xo-animate.h:100%`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [145] `div`
- clases: scrub
- en viewport durante el muestreo: 0/3 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=3819: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)

### [146] `xo-marquee.xo-marquee-block`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [147] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [148] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [149] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [150] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [151] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [152] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [153] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [154] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [155] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [156] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [157] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [158] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [159] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [160] `xo-animate`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [161] `xo-animate.h:100%`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [162] `div`
- clases: scrub
- en viewport durante el muestreo: 0/3 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=3819: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)

### [163] `xo-parallax-scroll.w:100%`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [164] `xo-animate.bgz:inherit`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [165] `xo-animate.bgz:inherit`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [166] `xo-parallax-scroll`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [167] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [168] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [169] `xo-parallax-scroll`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [170] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [171] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [172] `xo-parallax-scroll`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [173] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [174] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [175] `xo-parallax-scroll`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [176] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [177] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [178] `xo-parallax-scroll`
- clases: revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 200) → matrix(1, 0, 0, 1, 0, 200)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [179] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [180] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [181] `xo-parallax-scroll.w:100%`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → matrix(1, 0, 0, 1, 0, 0)

### [182] `xo-animate.bgz:inherit`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [183] `xo-animate.h:100%`
- clases: ticker, scrub
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, 0, 0) → none

### [184] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [185] `xo-animate.bgz:inherit`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [186] `xo-animate.bgz:inherit`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform none → none

### [187] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [188] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [189] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [190] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [191] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [192] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [193] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [194] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [195] `div`
- clases: scrub
- en viewport durante el muestreo: 0/21 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [196] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [197] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [198] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [199] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [200] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [201] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [202] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [203] `xo-animate.w:100%@+sm`
- clases: ticker, revelado
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [204] `div`
- clases: scrub
- en viewport durante el muestreo: 0/4 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=11456: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)

### [205] `xo-animate.wrapper-button`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [206] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [207] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [208] `xo-animate.bgz:inherit`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.832→1.000, transform matrix(1, 0, 0, 1, 0, 2.95703) → none

### [209] `xo-animate.wrapper-button`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.692→1.000, transform matrix(1, 0, 0, 1, 0, 5.91684) → none

### [210] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [211] `xo-animate.bgz:inherit`
- clases: revelado
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

### [212] `xo-animate.bgz:inherit`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.494→1.000, transform matrix(1, 0, 0, 1, 0, 8.93128) → none

### [213] `xo-animate.wrapper-button`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.215→1.000, transform matrix(1, 0, 0, 1, 0, 15.0693) → none

### [214] `div`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=9547: t=0→800: opacity 0.000→0.000, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0, 0, 0, 0, 0, 0)
  - scrollY=19093: t=0→800: opacity 0.046→0.333, transform matrix(0.0455015, 0, 0, 0.0455015, 0, 0) → matrix(0.332635, 0, 0, 0.332635, 0, 0)

### [215] `xo-animate.footer__logo-image`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→1.000, transform matrix(0.6, 0, 0, 0.6, 0, 0) → none

### [216] `xo-animate.bgz:inherit`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→1.000, transform matrix(1, 0, 0, 1, 0, 16.0781) → none

### [217] `xo-animate.d:flex`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→1.000, transform matrix(1, 0, 0, 1, 0, 23.8781) → none

### [218] `xo-animate.h:100%`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.880, transform matrix(1.3, 0, 0, 1.3, 0, 0) → matrix(1.03598, 0, 0, 1.03598, 0, 0)

### [219] `div`
- clases: scrub
- en viewport durante el muestreo: 0/5 posiciones
- ⚠ nunca estuvo en el viewport durante el muestreo — la clasificación por TIEMPO no se pudo verificar en vista (§ calibración (a), ARNES-CENSO-MOVIMIENTO-CALIBRACION-1); lo reportado es sólo lo que cambió por SCROLL.
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.994, transform matrix(0, 0, 0, 0, 0, 0) → matrix(0.993642, 0, 0, 0.993642, 0, 0)
  - scrollY=7637: t=0→800: opacity 0.933→0.994, transform matrix(0.932525, 0, 0, 0.932525, 0, 0) → matrix(0.993585, 0, 0, 0.993585, 0, 0)
  - scrollY=15274: t=0→800: opacity 0.932→0.599, transform matrix(0.932334, 0, 0, 0.932334, 0, 0) → matrix(0.599199, 0, 0, 0.599199, 0, 0)

### [220] `xo-animate.d:flex`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→1.000, transform matrix(1, 0, 0, 1, 0, 67.1672) → none

### [221] `xo-animate.d:flex`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→1.000, transform matrix(1, 0, 0, 1, 0, 55.2281) → matrix(1, 0, 0, 1, 0, 0)

### [222] `xo-animate`
- clases: scrub
- en viewport durante el muestreo: 1/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 0.000→0.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→1.000, transform matrix(1, 0, 0, 1, 0, 6.3) → matrix(1, 0, 0, 1, 0, 0)

### [223] `xo-floating-sidebar.xo-floating-sidebar`
- clases: ticker
- en viewport durante el muestreo: 2/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -82.5, -181.656) → matrix(1, 0, 0, 1, -82.5, -181.656)
  - scrollY=9547: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -82.5, -181.656) → matrix(1, 0, 0, 1, -82.5, -181.656)
  - scrollY=19093: t=0→800: opacity 1.000→1.000, transform matrix(1, 0, 0, 1, -82.5, -181.656) → matrix(1, 0, 0, 1, -82.5, -181.656)

### [224] `xo-turbo-progress-bar`
- clases: revelado
- en viewport durante el muestreo: 18/21 posiciones
- muestras (resumen — primer/mitad/último grupo de scroll):
  - scrollY=0: t=0→800: opacity 1.000→1.000, transform none → none
  - scrollY=9547: t=0→800: opacity 1.000→0.000, transform none → none
  - scrollY=19093: t=0→800: opacity 0.000→0.000, transform none → none

La traza cruda completa (todos los grupos de scroll, todas las muestras de tiempo) vive en
`cafeone-home.json`, al lado de este archivo.
