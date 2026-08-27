import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCodecVideo } from './video-codec';

// Construye bytes ISO-BMFF sintéticos: cajas [size(4)][type(4)][payload], para afirmar que el parser
// lee el fourcc del códec del `stsd` real —no un mock del árbol—. Node 18+ trae `Blob` global con
// `.slice()` y `.arrayBuffer()`, así que el parser corre en capa 1 sin navegador.
function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}
function box(type: string, payload: Buffer): Buffer {
  return Buffer.concat([u32(8 + payload.length), Buffer.from(type, 'latin1'), payload]);
}
// Caja de 64 bits: size=1 y largesize(8) real. Sirve para probar que el walker salta un `mdat` grande
// con tamaño de 64 bits sin perderse.
function box64(type: string, payload: Buffer): Buffer {
  const total = 16 + payload.length;
  const large = Buffer.alloc(8);
  large.writeUInt32BE(Math.floor(total / 2 ** 32), 0);
  large.writeUInt32BE(total >>> 0, 4);
  return Buffer.concat([u32(1), Buffer.from(type, 'latin1'), large, payload]);
}
// `stsd`: 8 bytes de header (version+flags+entry_count) + la 1ª sample-entry (una caja cuyo TIPO es el
// fourcc del códec). El payload de la entry es relleno; el parser sólo lee su fourcc.
const stsd = (fourcc: string) => box('stsd', Buffer.concat([Buffer.alloc(8), box(fourcc, Buffer.alloc(8))]));
const trak = (fourcc: string) => box('trak', box('mdia', box('minf', box('stbl', stsd(fourcc)))));
const moov = (...traks: Buffer[]) => box('moov', Buffer.concat(traks));
const ftyp = box('ftyp', Buffer.from('qt  ', 'latin1'));
const blob = (buf: Buffer) => new Blob([new Uint8Array(buf)]);

test('AVC (avc1) → ok: un H.264, en mp4 o en .mov, pasa', async () => {
  const v = await leerCodecVideo(blob(Buffer.concat([ftyp, moov(trak('avc1'))])));
  assert.deepEqual(v, { estado: 'ok', codec: 'avc1' });
});

test('AVC con moov DESPUÉS de un mdat grande → ok (se salta el payload, no lo carga)', async () => {
  // Una grabación de pantalla del Mac tiene el moov al FINAL, tras un mdat de MB. El walker debe
  // saltar el mdat leyendo sólo su cabecera y encontrar el moov.
  const buf = Buffer.concat([ftyp, box('mdat', Buffer.alloc(4096)), moov(trak('avc1'))]);
  assert.deepEqual(await leerCodecVideo(blob(buf)), { estado: 'ok', codec: 'avc1' });
});

test('mdat con tamaño de 64 bits antes del moov → ok', async () => {
  const buf = Buffer.concat([ftyp, box64('mdat', Buffer.alloc(4096)), moov(trak('avc1'))]);
  assert.deepEqual(await leerCodecVideo(blob(buf)), { estado: 'ok', codec: 'avc1' });
});

test('el track de AUDIO se salta; se lee el de VÍDEO', async () => {
  // `mp4a` (audio) primero, `avc1` (vídeo) después: el parser ignora el audio y devuelve el vídeo.
  const buf = Buffer.concat([ftyp, moov(trak('mp4a'), trak('avc1'))]);
  assert.deepEqual(await leerCodecVideo(blob(buf)), { estado: 'ok', codec: 'avc1' });
});

test('HEVC (hvc1) → rechazado: el iPhone graba esto y medio navegador no lo reproduce', async () => {
  const v = await leerCodecVideo(blob(Buffer.concat([ftyp, moov(trak('hvc1'))])));
  assert.deepEqual(v, { estado: 'rechazado', codec: 'hvc1' });
});

test('HEVC etiqueta hev1 → rechazado', async () => {
  assert.deepEqual(await leerCodecVideo(blob(Buffer.concat([ftyp, moov(trak('hev1'))]))), {
    estado: 'rechazado',
    codec: 'hev1',
  });
});

test('ProRes (ap4h) → rechazado: formato de edición que ningún navegador reproduce', async () => {
  assert.deepEqual(await leerCodecVideo(blob(Buffer.concat([ftyp, moov(trak('ap4h'))]))), {
    estado: 'rechazado',
    codec: 'ap4h',
  });
});

test('sin moov → ilegible (cae a la red del contenedor)', async () => {
  const buf = Buffer.concat([ftyp, box('mdat', Buffer.alloc(64))]);
  assert.deepEqual(await leerCodecVideo(blob(buf)), { estado: 'ilegible' });
});

test('truncado (tamaño de caja imposible) → ilegible, no explota', async () => {
  // Una caja que dice medir más que el archivo: el walker corta y no encuentra moov.
  const buf = Buffer.concat([u32(999999), Buffer.from('moov', 'latin1'), Buffer.alloc(8)]);
  assert.deepEqual(await leerCodecVideo(blob(buf)), { estado: 'ilegible' });
});

test('vacío → ilegible', async () => {
  assert.deepEqual(await leerCodecVideo(blob(Buffer.alloc(0))), { estado: 'ilegible' });
});
