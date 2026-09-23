#!/usr/bin/env bash
#
# EL ARNÉS DE CAPTURA (§ ARNES-CAPTURA-SECCION-1) — empaqueta lo que
# WORKER-CAPTURA-HEADLESS-CENSO-1 ya probó a mano: Postgres efímero (el MISMO mecanismo del
# gate, `postgres-efimero.sh`) + un preset aplicado + `next build` UNA VEZ + `next start` contra
# esa base (NUNCA `next dev` — § CROMO-DEV-HIDRATACION-SPA-1: bajo `next dev`, en este sandbox,
# los efectos de React que disparan una animación de entrada nunca corren, y la captura sale con
# el color del fondo en vez del color del componente) + Chromium headless capturando la ruta del
# storefront Y la sección correspondiente del prototipo, lado a lado, con los valores CSS
# computados impresos.
#
# ESTA CAPTURA PRUEBA QUE EL TEMA SE APLICÓ Y LA BANDA RENDERIZA. NO PRUEBA QUE SE VEA BIEN. El
# gate de gusto es del owner. (el script de abajo repite esto en su propio banner — acá para
# quien lea el código sin correrlo, § el matiz del spec).
#
# DE ACÁ EN MÁS, TODO SLICE VISUAL CORRE ESTE ARNÉS Y ADJUNTA: su captura de la app + la sección
# del prototipo + los valores computados — en vez de decir "completo" sin mostrar nada
# (aprobación del owner, 2026-09-22, § ARNES-CAPTURA-SECCION-1 en DECISIONS.md).
#
# MODO `--url` (§ ARNES-CAPTURA-MUESTRARIO-REAL-1): con `--url <URL>` entre los flags, este script
# SALTEA Postgres efímero + migraciones por completo — la captura navega el muestrario YA
# DESPLEGADO, no una base local, así que no hay nada que levantar ni migrar acá. La detección es
# posicional sobre "$@", ANTES de tocar Postgres: si aparece, se invoca `capturar-seccion.ts`
# directo y se sale.
#
# INVOCACIÓN CANÓNICA — `npm run capturar:seccion -- <flags>` (§ ARNES-INVOCABLE-POR-NPM-1): un
# worker despachado sólo tiene concedido `node`/`npm`/`npx` como comando de TOPE; `bash
# scripts/capturar-seccion.sh` pide una aprobación de `bash` que en modo no interactivo nadie puede
# dar. El `npm run` de abajo corre este MISMO script sin reimplementar nada — el permiso gatea el
# comando de tope, no lo que ese comando lanza por dentro.
#
#   npm run capturar:seccion -- --preset CORTE \
#     --ruta / --selector-app "#hero" \
#     --prototipo index.html --selector-prototipo ".hero" \
#     --nombre hero
#
#   npm run capturar:seccion -- --url https://coffee-template-app-onix.vercel.app/ \
#     --selector-app "header nav a" \
#     --prototipo index.html --selector-prototipo ".nav-link" \
#     --nombre muestrario-nav
#
# Invocación directa (fuera de un dispatch, con `bash` disponible — equivalente byte a byte):
#   scripts/capturar-seccion.sh --preset CORTE \
#     --ruta / --selector-app "#hero" \
#     --prototipo index.html --selector-prototipo ".hero" \
#     --nombre hero
#
# (`--ayuda` para el resto de las opciones — las parsea `capturar-seccion.ts`, no este script.)
#
# PRERREQUISITOS:
#   - Postgres local, igual que `scripts/test-integracion.sh` (brew install postgresql@14) — SALVO
#     en modo `--url`, que no toca Postgres en absoluto.
#   - Red la PRIMERA vez en una máquina nueva (Playwright + Chromium se instalan AISLADOS, nunca
#     como dependencia del repo — § capturar-seccion.ts). Ya cacheados, no hace falta red. (Y en
#     modo `--url`, red hacia la URL dada.)
#   - Ningún `npm run dev` real (ni otra corrida de este arnés) corriendo sobre este mismo
#     checkout — `next build` SOBREESCRIBE `.next/`, que todos comparten. No aplica a `--url`.
#   - Este script tarda más que antes: ahora corre `next build` completo (§ arriba), no sólo
#     arranca `next dev` — normal, no es un cuelgue. (Tampoco aplica a `--url`, que no construye
#     nada local.)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Detección POSICIONAL de --url, ANTES de tocar Postgres (§ arriba). Sólo mira el nombre del flag,
# no su valor — no hay forma de que un valor de OTRO flag colisione con el string exacto "--url".
for arg in "$@"; do
  if [ "$arg" = "--url" ]; then
    echo "▸ Modo --url: capturando el muestrario YA DESPLEGADO — sin Postgres efímero, sin migraciones."
    node --import tsx "$RAIZ/scripts/capturar-seccion.ts" "$@"
    exit 0
  fi
done

# Puerto y base PROPIOS, DISTINTOS de los del gate (55432/integracion): para que
# `npm run test:integracion` y este arnés puedan correr uno al lado del otro sin pisarse.
PUERTO=55434
BASE=captura

source "$RAIZ/scripts/postgres-efimero.sh"
pg_efimero_arriba "$PUERTO" "$BASE"

echo "▸ Aplicando migraciones…"
cd "$RAIZ"
npm run --silent db:deploy -w @duna/core >/dev/null

# El resto —aplicar el preset, `next build`, levantar `next start`, Playwright, apagar
# `next start`— vive en TS porque necesita child_process/fetch/un servidor HTTP chico, no porque
# bash no alcance: es la misma frontera que `test-integracion.sh` ya traza contra
# `node --import tsx --test`.
node --import tsx "$RAIZ/scripts/capturar-seccion.ts" "$@"
