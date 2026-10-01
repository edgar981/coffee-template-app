import { test } from "node:test";
import assert from "node:assert/strict";
import { openGraphDeTienda } from "./og-tienda";

const base = { nombre: "Café Las Chamisas", descripcion: "Café de especialidad", imagenPoster: "https://blob.example/poster.jpg", imagen: "" };

test("fuera de CORTE no emite nada (Nayoli byte-idéntica)", () => {
  assert.deepEqual(openGraphDeTienda({ ...base, esCorte: false }), {});
});

test("bajo CORTE usa el póster del hero como imagen de la vista previa", () => {
  const og = openGraphDeTienda({ ...base, esCorte: true }).openGraph as { images: { url: string }[]; siteName: string; locale: string };
  assert.equal(og.images[0].url, "https://blob.example/poster.jpg");
  assert.equal(og.siteName, "Café Las Chamisas");
  assert.equal(og.locale, "es_CO");
});

test("sin póster cae a la imagen del hero; sin ninguna URL absoluta no emite nada", () => {
  const og = openGraphDeTienda({ ...base, esCorte: true, imagenPoster: "", imagen: "https://blob.example/hero.jpg" }).openGraph as { images: { url: string }[] };
  assert.equal(og.images[0].url, "https://blob.example/hero.jpg");
  assert.deepEqual(openGraphDeTienda({ ...base, esCorte: true, imagenPoster: "", imagen: "/images/hero.jpg" }), {});
});
