// El chat de la casa. Los mensajes también son eventos: no se borran de verdad («borrar» deja
// «Mensaje borrado» en su sitio, y solo lo puede hacer quien lo escribió) y lo fijado arriba
// es el último mensaje que alguien fijó (o nada, si lo último fue quitarlo).
import type { DatosMensaje, Evento, MiembroId } from './tipos';

export interface Mensaje {
  id: string;
  ts: number;
  autor: MiembroId;
  texto: string;
  fotos: string[];
  audio?: { ref: string; segundos: number };
  borrado: boolean;
}

export interface Chat {
  mensajes: Mensaje[]; // del más antiguo al más nuevo
  fijado?: Mensaje;
  fijadoPor?: MiembroId;
}

export function calcularChat(eventos: Evento[]): Chat {
  const borrados = new Set(eventos.filter((e) => e.tipo === 'mensaje_borrado').map((e) => `${e.autor}|${e.datos?.mensaje}`));
  const mensajes: Mensaje[] = eventos
    .filter((e) => e.tipo === 'mensaje')
    .map((e) => {
      const d = (e.datos ?? {}) as DatosMensaje;
      return {
        id: e.id,
        ts: e.ts,
        autor: e.autor,
        texto: String(d.texto ?? '').trim().slice(0, 4000),
        fotos: Array.isArray(d.fotos) ? d.fotos.filter((f) => typeof f === 'string').slice(0, 6) : [],
        audio: d.audio?.ref ? { ref: String(d.audio.ref), segundos: Math.max(0, Math.round(Number(d.audio.segundos) || 0)) } : undefined,
        borrado: borrados.has(`${e.autor}|${e.id}`),
      };
    })
    .filter((m) => m.texto || m.fotos.length || m.audio)
    .sort((a, b) => a.ts - b.ts);

  const fijados = eventos.filter((e) => e.tipo === 'mensaje_fijado').sort((a, b) => a.ts - b.ts);
  const ult = fijados[fijados.length - 1];
  const fijado = ult?.datos?.mensaje ? mensajes.find((m) => m.id === ult.datos.mensaje && !m.borrado) : undefined;
  return { mensajes, fijado, fijadoPor: fijado ? ult.autor : undefined };
}

/** Mensajes de los demás que llegaron después de `leido` (el número de la pestaña Chat). */
export function sinLeer(chat: Chat, yo: MiembroId, leido: number): number {
  return chat.mensajes.filter((m) => m.autor !== yo && !m.borrado && m.ts > leido).length;
}

/** Un mensaje en una línea (para los avisos y lo fijado). */
export function resumen(m: Pick<Mensaje, 'texto' | 'fotos' | 'audio'>, max = 120): string {
  if (m.texto) return m.texto.length > max ? `${m.texto.slice(0, max - 1).trimEnd()}…` : m.texto;
  if (m.audio) return '🎤 Audio';
  if (m.fotos.length > 1) return `📷 ${m.fotos.length} fotos`;
  if (m.fotos.length) return '📷 Foto';
  return '';
}
