import type { Config, Evento, MiembroId, TipoEvento } from '../core/tipos';

/** Dónde se guarda la casa: en este móvil (modo prueba) o en la base de datos compartida. */
export interface Almacen {
  modo: 'prueba' | 'casa';
  config: Config;
  yo: MiembroId;
  cargarEventos(): Promise<Evento[]>;
  /** Avisa cuando otro de la casa apunta algo. Devuelve cómo dejar de escuchar. */
  escuchar(alLlegar: (e: Evento) => void): () => void;
  apuntar(tipo: TipoEvento, datos: any): Promise<Evento>;
  subirFoto(archivo: Blob): Promise<string>;
  urlFoto(ref: string): Promise<string>;
  /** Apunta este móvil para recibir avisos (solo en la casa de verdad). */
  suscribir?(s: { endpoint: string; p256dh: string; auth: string }): Promise<void>;
  /** La llave pública de los avisos de la casa (null si aún no está). */
  llaveAvisos?(): Promise<string | null>;
  cambiarYo?(m: MiembroId): void; // solo en modo prueba
  reiniciar?(): void; // solo en modo prueba
  salir(): Promise<void>;
}

/** Reduce una foto del móvil a algo ligero (lado largo máx. y calidad JPEG). */
export async function comprimirFoto(archivo: Blob, ladoMax = 1280, calidad = 0.76): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la foto'));
      i.src = url;
    });
    const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    lienzo.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo preparar la foto'))), 'image/jpeg', calidad));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobADataUrl(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(r.error);
    r.readAsDataURL(b);
  });
}

export function nuevoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
