// mp4box 0.5.2 no publica tipos. Declaración mínima del único símbolo que usamos; el shape real lo tipa
// `lib/video-remux.ts` con un cast (`as unknown as ArchivoMp4`). La versión está pinneada a 0.5.2 a
// propósito —el 2.x cambió el API de segmentación y no emitía media en este flujo (§ lib/video-remux)—.
declare module 'mp4box' {
  export function createFile(): unknown;
}
