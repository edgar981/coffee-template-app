import { test } from "node:test";
import assert from "node:assert/strict";
import {
  iconosDeTienda,
  iconosManifestDeTienda,
  tituloYDescripcionDeTienda,
  decidirIconoRuta,
  huellaIcono,
  urlIconoVersionada,
  cacheControlIconoTienda,
  RUTA_ICONO_MISMO_ORIGEN,
  ICONOS_ESTATICOS_POR_DEFECTO,
  ICONOS_MANIFEST_POR_DEFECTO,
  ICONOS_ESTATICOS_POR_RUTA,
} from "./metadata-tienda";

test("huellaIcono: determinístico — la misma URL da siempre la misma huella", () => {
  const url = "https://blob.example/contenido/icono-chamisas.png";
  assert.equal(huellaIcono(url), huellaIcono(url));
});

test("huellaIcono: URLs distintas dan huellas distintas (§ FAVICON-MISMO-ORIGEN-1, versiona con el dato)", () => {
  const a = huellaIcono("https://blob.example/contenido/icono-chamisas-AbC123.png");
  const b = huellaIcono("https://blob.example/contenido/icono-chamisas-XyZ789.png");
  assert.notEqual(a, b);
});

test("huellaIcono: hex de 8 caracteres", () => {
  assert.match(huellaIcono("https://blob.example/contenido/icono.svg"), /^[0-9a-f]{8}$/);
});

test("urlIconoVersionada: mismo origen (RUTA_ICONO_MISMO_ORIGEN), nunca la URL del blob", () => {
  const url = "https://blob.example/contenido/icono-chamisas.png";
  const versionada = urlIconoVersionada(url);
  assert.ok(versionada.startsWith(`${RUTA_ICONO_MISMO_ORIGEN}?v=`));
  assert.equal(versionada, `${RUTA_ICONO_MISMO_ORIGEN}?v=${huellaIcono(url)}`);
  assert.ok(!versionada.includes("blob.example"), "jamás la URL del blob, otro dominio");
});

test("cacheControlIconoTienda: versionado = largo e inmutable; sin versión = corto (§ FAVICON-NEXTCONFIG-CACHE-PRECEDENCIA-1)", () => {
  assert.match(cacheControlIconoTienda(true), /max-age=31536000/);
  assert.match(cacheControlIconoTienda(true), /immutable/);
  assert.match(cacheControlIconoTienda(false), /max-age=300\b/);
});

test("iconosDeTienda: vacío cae a los estáticos de Nayoli", () => {
  assert.deepEqual(iconosDeTienda(""), ICONOS_ESTATICOS_POR_DEFECTO);
  assert.deepEqual(iconosDeTienda("   "), ICONOS_ESTATICOS_POR_DEFECTO);
});

test("iconosDeTienda: un ícono PNG subido reemplaza favicon/apple/shortcut con la URL MISMO-ORIGEN versionada, no la del blob", () => {
  const url = "https://blob.example/contenido/icono-xyz.png";
  const esperada = urlIconoVersionada(url);
  const icons = iconosDeTienda(url) as {
    icon: { url: string; type: string }[];
    apple: { url: string; type: string };
    shortcut: string;
  };
  assert.equal(icons.icon[0].url, esperada);
  assert.equal(icons.icon[0].type, "image/png");
  assert.equal(icons.apple.url, esperada);
  assert.equal(icons.apple.type, "image/png");
  assert.equal(icons.shortcut, esperada);
  assert.ok(!icons.icon[0].url.includes("blob.example"), "jamás la URL del blob, otro dominio");
});

test("iconosDeTienda: un SVG subido se declara image/svg+xml, con URL mismo-origen", () => {
  const url = "https://blob.example/contenido/icono-xyz.svg";
  const icons = iconosDeTienda(url) as { icon: { url: string; type: string }[] };
  assert.equal(icons.icon[0].type, "image/svg+xml");
  assert.equal(icons.icon[0].url, urlIconoVersionada(url));
});

test("iconosDeTienda: dos íconos distintos dan dos URLs distintas (la versión sigue al dato)", () => {
  const a = iconosDeTienda("https://blob.example/contenido/icono-a.png") as { icon: { url: string }[] };
  const b = iconosDeTienda("https://blob.example/contenido/icono-b.png") as { icon: { url: string }[] };
  assert.notEqual(a.icon[0].url, b.icon[0].url);
});

test("iconosManifestDeTienda: vacío cae a los tres PNG de Nayoli", () => {
  assert.deepEqual(iconosManifestDeTienda(""), ICONOS_MANIFEST_POR_DEFECTO);
});

test("iconosManifestDeTienda: un ícono subido da UNA entrada sizes:'any', URL mismo-origen versionada", () => {
  const png = "https://blob.example/contenido/icono.png";
  const svg = "https://blob.example/contenido/icono.svg";
  assert.deepEqual(iconosManifestDeTienda(png), [
    { src: urlIconoVersionada(png), sizes: "any", type: "image/png" },
  ]);
  assert.deepEqual(iconosManifestDeTienda(svg), [
    { src: urlIconoVersionada(svg), sizes: "any", type: "image/svg+xml" },
  ]);
});

test("iconosManifestDeTienda y iconosDeTienda: la MISMA URL para el mismo ícono subido (no divergen)", () => {
  const url = "https://blob.example/contenido/icono-chamisas.png";
  const manifest = iconosManifestDeTienda(url);
  const head = iconosDeTienda(url) as { icon: { url: string }[] };
  assert.equal(manifest[0].src, head.icon[0].url);
});

test("decidirIconoRuta: vacío cae al estático de la variante (§ FAVICON-RUTA-POR-TIENDA-1)", () => {
  assert.deepEqual(decidirIconoRuta("", "favicon"), { tipo: "estatico", ...ICONOS_ESTATICOS_POR_RUTA.favicon });
  assert.deepEqual(decidirIconoRuta("   ", "apple"), { tipo: "estatico", ...ICONOS_ESTATICOS_POR_RUTA.apple });
});

test("decidirIconoRuta: un ícono subido manda, sin importar la variante, con su contentType", () => {
  const url = "https://blob.example/contenido/icono-chamisas.png";
  assert.deepEqual(decidirIconoRuta(url, "favicon"), { tipo: "subido", url, contentType: "image/png" });
  assert.deepEqual(decidirIconoRuta(url, "apple"), { tipo: "subido", url, contentType: "image/png" });
});

test("decidirIconoRuta: un ícono SVG subido lleva contentType image/svg+xml", () => {
  const url = "https://blob.example/contenido/icono-chamisas.svg";
  assert.deepEqual(decidirIconoRuta(url, "favicon"), { tipo: "subido", url, contentType: "image/svg+xml" });
});

test("tituloYDescripcionDeTienda: absolute+template, para que un title hijo no vuelva a pasar por el template de la raíz", () => {
  const meta = tituloYDescripcionDeTienda("Café Las Chamisas", "Café de especialidad");
  assert.deepEqual(meta.title, { absolute: "Café Las Chamisas", template: "%s · Café Las Chamisas" });
  assert.equal(meta.description, "Café de especialidad");
});
