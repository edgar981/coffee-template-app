import { test } from "node:test";
import assert from "node:assert/strict";
import {
  iconosDeTienda,
  iconosManifestDeTienda,
  tituloYDescripcionDeTienda,
  ICONOS_ESTATICOS_POR_DEFECTO,
  ICONOS_MANIFEST_POR_DEFECTO,
} from "./metadata-tienda";

test("iconosDeTienda: vacío cae a los estáticos de Nayoli", () => {
  assert.deepEqual(iconosDeTienda(""), ICONOS_ESTATICOS_POR_DEFECTO);
  assert.deepEqual(iconosDeTienda("   "), ICONOS_ESTATICOS_POR_DEFECTO);
});

test("iconosDeTienda: un ícono PNG subido reemplaza favicon/apple/shortcut, con su type", () => {
  const url = "https://blob.example/contenido/icono-xyz.png";
  const icons = iconosDeTienda(url) as {
    icon: { url: string; type: string }[];
    apple: { url: string; type: string };
    shortcut: string;
  };
  assert.equal(icons.icon[0].url, url);
  assert.equal(icons.icon[0].type, "image/png");
  assert.equal(icons.apple.url, url);
  assert.equal(icons.apple.type, "image/png");
  assert.equal(icons.shortcut, url);
});

test("iconosDeTienda: un SVG subido se declara image/svg+xml", () => {
  const url = "https://blob.example/contenido/icono-xyz.svg";
  const icons = iconosDeTienda(url) as { icon: { type: string }[] };
  assert.equal(icons.icon[0].type, "image/svg+xml");
});

test("iconosManifestDeTienda: vacío cae a los tres PNG de Nayoli", () => {
  assert.deepEqual(iconosManifestDeTienda(""), ICONOS_MANIFEST_POR_DEFECTO);
});

test("iconosManifestDeTienda: un ícono subido da UNA entrada sizes:'any' con su type", () => {
  assert.deepEqual(iconosManifestDeTienda("https://blob.example/contenido/icono.png"), [
    { src: "https://blob.example/contenido/icono.png", sizes: "any", type: "image/png" },
  ]);
  assert.deepEqual(iconosManifestDeTienda("https://blob.example/contenido/icono.svg"), [
    { src: "https://blob.example/contenido/icono.svg", sizes: "any", type: "image/svg+xml" },
  ]);
});

test("tituloYDescripcionDeTienda: absolute+template, para que un title hijo no vuelva a pasar por el template de la raíz", () => {
  const meta = tituloYDescripcionDeTienda("Café Las Chamisas", "Café de especialidad");
  assert.deepEqual(meta.title, { absolute: "Café Las Chamisas", template: "%s · Café Las Chamisas" });
  assert.equal(meta.description, "Café de especialidad");
});
