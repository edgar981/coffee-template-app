# La ley del horizonte ondulante — pieza de marca de Duna

**Procedencia:** pieza de marca de Duna, transcrita por el orquestador el 2026-09-27 dentro
del spec de `PANEL-LOGIN-HORIZONTE-FAMILIA-1` (Sección 0 del dispatch), porque el archivo
fuente (`~/.claude/uploads/.../660043e9-duna.html`) vive fuera de este repo y el sandbox de
ejecución no tiene permiso de lectura sobre esa ruta — ni el slice anterior
(`PANEL-LOGIN-HORIZONTE-ONDULANTE-1`) ni éste pudieron abrirlo. Este archivo existe para que
el PRÓXIMO slice que toque el horizonte no dependa, otra vez, de que alguien la vuelva a
copiar de memoria.

## La fórmula

Para la línea `i`, con `u` la posición horizontal normalizada (0..1 a lo ancho del viewport) y
`t` el tiempo:

```
y(i, u, t) = BASE + i·SEP
           + sin(u·5.2 + t·1.2 + i·0.30) · (A1 + i·1.5)
           + sin(u·11.0 − t·0.80 + i·0.50) · A2
```

## Lo que la fórmula DICE

- **Las frecuencias (`5.2`, `11.0`) NO dependen de `i`.** Todas las líneas tienen la MISMA
  onda — no hay una longitud de onda que crezca (o varíe de ningún modo) por índice.
- **El tiempo entra con el MISMO signo y la MISMA velocidad para todas, DENTRO de cada
  término.** En el primer término, `t·1.2` es igual para toda línea; en el segundo,
  `−t·0.80` también. Nadie va más rápido, nadie va al revés — DENTRO de cada onda.
- **Lo único que varía por línea** es un desfase CHICO (`i·0.30`, `i·0.50` radianes) y una
  amplitud que crece apenas (`+i·1.5`, sólo en el primer término).
- **Son DOS ondas viajando en SENTIDOS OPUESTOS** (`+t` en la primera, `−t` en la segunda) a
  distinta velocidad angular (`1.2` contra `0.80`) y distinta frecuencia espacial (`5.2`
  contra `11.0`). **Ahí nace la ondulación viva** — no en que cada línea vaya a su propio
  ritmo (eso era el defecto que `PANEL-LOGIN-HORIZONTE-ONDULANTE-1` introdujo a propósito, y
  que `PANEL-LOGIN-HORIZONTE-FAMILIA-1` revierte).

## Por qué esta ley no se pudo implementar TAL CUAL en este repo

Dos ondas que viajan en sentidos opuestos a distinta velocidad no son un patrón que se
TRASLADA — son un patrón que se DEFORMA con el tiempo (las dos ondas se deslizan una
respecto de la otra, cambiando la forma compuesta en cada instante, no sólo su posición).
Un patrón que se deforma exige recalcular la geometría en cada cuadro (JS), y esta pantalla
—donde se teclea una contraseña— no puede pagar ese costo: la animación tiene que ser 100%
`transform` de CSS, compositada por GPU, sin un bucle de `requestAnimationFrame`
recalculando SVG.

`PANEL-LOGIN-HORIZONTE-FAMILIA-1` implementó la salida intermedia que el propio spec
autoriza: **una sola onda viajera, rígida** — toda la familia de líneas se traslada JUNTA, a
la MISMA velocidad y el MISMO sentido (nunca dos sentidos a la vez) — conservando sólo el
desfase chico y la amplitud creciente por línea. Se perdió la segunda onda (la de sentido
contrario); se conservó el hilo principal (CSS puro, cero JS por cuadro) y, sobre todo, el
INVARIANTE que el owner señaló: que las líneas nunca se crucen. El razonamiento completo, con
las cuentas, vive en `DECISIONS.md` bajo `PANEL-LOGIN-HORIZONTE-FAMILIA-1`.

**Si un slice futuro encuentra una forma de expresar las dos ondas contra-viajeras sin JS por
cuadro** (por ejemplo, si CSS ganara un primitivo de composición de ondas, o si el costo de un
`requestAnimationFrame` mínimo dejara de ser una preocupación para esta pantalla), esta es la
fórmula a implementar completa — hoy `lib/duna-horizonte.ts` implementa sólo el primer
término (sin el segundo armónico contra-viajero).
