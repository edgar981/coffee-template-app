#!/usr/bin/env bash
#
# EL ARNÉS DE CAPTURA (§ ARNES-CAPTURA-SECCION-1) — empaqueta lo que
# WORKER-CAPTURA-HEADLESS-CENSO-1 ya probó a mano: Postgres efímero (el MISMO mecanismo del
# gate, `postgres-efimero.sh`) + un preset aplicado + `next dev` contra esa base + Chromium
# headless capturando la ruta del storefront Y la sección correspondiente del prototipo, lado a
# lado, con los valores CSS computados impresos.
#
# ESTA CAPTURA PRUEBA QUE EL TEMA SE APLICÓ Y LA BANDA RENDERIZA. NO PRUEBA QUE SE VEA BIEN. El
# gate de gusto es del owner. (el script de abajo repite esto en su propio banner — acá para
# quien lea el código sin correrlo, § el matiz del spec).
#
# DE ACÁ EN MÁS, TODO SLICE VISUAL CORRE ESTE ARNÉS Y ADJUNTA: su captura de la app + la sección
# del prototipo + los valores computados — en vez de decir "completo" sin mostrar nada
# (aprobación del owner, 2026-09-22, § ARNES-CAPTURA-SECCION-1 en DECISIONS.md).
#
# Uso:
#   scripts/capturar-seccion.sh --preset CORTE \
#     --ruta / --selector-app "#hero" \
#     --prototipo index.html --selector-prototipo ".hero" \
#     --nombre hero
#
# (`--ayuda` para el resto de las opciones — las parsea `capturar-seccion.ts`, no este script.)
#
# PRERREQUISITOS:
#   - Postgres local, igual que `scripts/test-integracion.sh` (brew install postgresql@14).
#   - Red la PRIMERA vez en una máquina nueva (Playwright + Chromium se instalan AISLADOS, nunca
#     como dependencia del repo — § capturar-seccion.ts). Ya cacheados, no hace falta red.
#   - Ningún `npm run dev` real corriendo sobre este mismo checkout (comparten `.next/`).
set -euo pipefail

# Puerto y base PROPIOS, DISTINTOS de los del gate (55432/integracion): para que
# `npm run test:integracion` y este arnés puedan correr uno al lado del otro sin pisarse.
PUERTO=55434
BASE=captura
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$RAIZ/scripts/postgres-efimero.sh"
pg_efimero_arriba "$PUERTO" "$BASE"

echo "▸ Aplicando migraciones…"
cd "$RAIZ"
npm run --silent db:deploy -w @duna/core >/dev/null

# El resto —aplicar el preset, levantar `next dev`, Playwright, apagar `next dev`— vive en TS
# porque necesita child_process/fetch/un servidor HTTP chico, no porque bash no alcance: es la
# misma frontera que `test-integracion.sh` ya traza contra `node --import tsx --test`.
node --import tsx "$RAIZ/scripts/capturar-seccion.ts" "$@"
