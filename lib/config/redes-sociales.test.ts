import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRedesSociales, urlDeRedSocial, REDES_SOCIALES_ORDEN, type RedSocialGuardada,
} from './site';

// MUESTRARIO-REDES-ADICIONALES-1 — las redes sociales dejan de ser dos columnas fijas
// (instagram/whatsapp) y pasan a `SiteSetting.redes`, una LISTA `{tipo, valor}`, MISMO patrón
// que `parseMetodosPago` (`lib/checkout/metodos-pago.ts`): SOFT, nunca lanza; orden canónico;
// el primero de un tipo repetido gana.

const instagram = (valor: string): RedSocialGuardada => ({ tipo: 'instagram', valor });
const whatsapp = (valor: string): RedSocialGuardada => ({ tipo: 'whatsapp', valor });
const facebook = (valor: string): RedSocialGuardada => ({ tipo: 'facebook', valor });

// ── parseRedesSociales — SOFT, nunca lanza ────────────────────────────────────────────────────

test('parseRedesSociales: no-array (basura, null, objeto) → lista vacía, nunca lanza', () => {
  assert.deepEqual(parseRedesSociales(null), []);
  assert.deepEqual(parseRedesSociales(undefined), []);
  assert.deepEqual(parseRedesSociales('no soy un array'), []);
  assert.deepEqual(parseRedesSociales({ tipo: 'instagram' }), []);
  assert.deepEqual(parseRedesSociales(42), []);
});

test('parseRedesSociales: descarta ítems basura dentro del array (no objeto, sin tipo, tipo desconocido — un tipo fuera del set no valida)', () => {
  const out = parseRedesSociales([null, 'x', 42, { sinTipo: true }, { tipo: 'tiktok', valor: 'x' }, instagram('nayolicafe')]);
  assert.deepEqual(out.map(r => r.tipo), ['instagram']);
});

test('parseRedesSociales: un tipo REPETIDO se queda con el PRIMERO', () => {
  const out = parseRedesSociales([instagram('primero'), instagram('segundo')]);
  assert.equal(out.length, 1);
  assert.equal(out[0].valor, 'primero');
});

test('parseRedesSociales: siempre devuelve el ORDEN CANÓNICO, sin importar el orden de guardado', () => {
  const revuelto = [facebook('https://facebook.com/x'), whatsapp('573001234567'), instagram('nayolicafe')];
  const out = parseRedesSociales(revuelto);
  assert.deepEqual(out.map(r => r.tipo), ['instagram', 'whatsapp', 'facebook']);
  assert.deepEqual(REDES_SOCIALES_ORDEN, ['instagram', 'whatsapp', 'facebook', 'x', 'pinterest']);
});

test('parseRedesSociales: normaliza un valor no-string a cadena', () => {
  const out = parseRedesSociales([{ tipo: 'whatsapp', valor: 573001234567 }]);
  assert.equal(out[0].valor, '573001234567');
});

// ── una LISTA VACÍA oculta el riel — el modelo, no el componente (el render vive en
// `cromo-riel-social.test.ts`, fuera de `touches:` de este slice; acá se afirma que el modelo
// produce el estado vacío que ese render consume) ──────────────────────────────────────────────

test('lista vacía: parseRedesSociales([]) devuelve [] — el estado que hace que el riel no se monte', () => {
  assert.deepEqual(parseRedesSociales([]), []);
});

// ── urlDeRedSocial ─────────────────────────────────────────────────────────────────────────────

test('urlDeRedSocial: instagram COMPONE con instagramUrl (handle, no URL)', () => {
  assert.equal(urlDeRedSocial(instagram('nayolicafe')), 'https://instagram.com/nayolicafe');
});

test('urlDeRedSocial: whatsapp COMPONE con whatsappUrl (número, no URL)', () => {
  assert.equal(urlDeRedSocial(whatsapp('573001234567')), 'https://wa.me/573001234567');
});

test('urlDeRedSocial: facebook/x/pinterest usan `valor` TAL CUAL — ya es la URL completa', () => {
  assert.equal(urlDeRedSocial(facebook('https://facebook.com/nayolicafe')), 'https://facebook.com/nayolicafe');
  assert.equal(urlDeRedSocial({ tipo: 'x', valor: 'https://x.com/nayolicafe' }), 'https://x.com/nayolicafe');
  assert.equal(urlDeRedSocial({ tipo: 'pinterest', valor: 'https://pinterest.com/nayolicafe' }), 'https://pinterest.com/nayolicafe');
});

// ── el backfill preserva instagram/whatsapp — la FORMA que la migración
// (`20260925120000_site_setting_redes/migration.sql`) produce a partir de las columnas viejas:
// [instagram, whatsapp] en ese orden, sólo si no están vacías. Afirma que `parseRedesSociales`
// lee ESA forma exacta sin perder nada — la migración misma corre contra Postgres real en el
// carril de integración (`npm run test:integracion`), no acá (sin base, § CLAUDE.md capa 1). ────

test('el backfill preserva instagram/whatsapp: las dos columnas pobladas → dos elementos, en el orden [instagram, whatsapp]', () => {
  // La forma EXACTA que la migración construye con jsonb_build_object.
  const backfillNayoli = [
    { tipo: 'instagram', valor: 'nayolicafe' },
    { tipo: 'whatsapp', valor: '573155766064' },
  ];
  const out = parseRedesSociales(backfillNayoli);
  assert.deepEqual(out, [instagram('nayolicafe'), whatsapp('573155766064')]);
});

test('el backfill omite la columna vacía: sólo whatsapp poblado → un solo elemento', () => {
  const backfillSoloWhatsapp = [{ tipo: 'whatsapp', valor: '573155766064' }];
  assert.deepEqual(parseRedesSociales(backfillSoloWhatsapp), [whatsapp('573155766064')]);
});

test('el backfill con las dos columnas vacías: lista vacía, el estado LEGÍTIMO (a diferencia de metodosPago)', () => {
  assert.deepEqual(parseRedesSociales([]), []);
});
