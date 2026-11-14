// «Tu espacio»: lo de cada uno que no sale en la casa de los tres (su habitación y su baño; Jose, su piso).
// Solo lo ve su dueño (la base de datos no les da a los otros dos estos apuntes) y no da puntos: solo dice cuánto
// lleva sin limpiarse y avisa cuando toca (Javi, 9 de noviembre: todo cada semana).
//  · espacio_cosa { cosa, nombre, cada }: apunta una cosa o le cambia el nombre o cada cuánto (días)
//  · espacio_cosa_quitada { cosa }: la quita
//  · espacio_hecho { cosa }: la acabas de limpiar
//  · espacio_deshecho { cosa }: la desmarcas (quita la última vez que la marcaste como hecha). En «Tu parte», debajo
//    de la lista de tu piso, se marca en verde como lo del piso y se desmarca igual (Javi, 14 de noviembre)
import { diaLocal, inicioSemana, semana } from './tiempo';
import type { Evento, MiembroId } from './tipos';

export interface CosaEspacio {
  id: string;
  nombre: string;
  cada: number; // días entre una limpieza y la siguiente
  creada: number;
  ultima: number | null; // la última vez que la marcaste como hecha
  dias: number; // días desde la última vez (o desde que la apuntaste)
  venceDia: number; // el día (contado desde 1970, en Madrid) en que toca
  faltan: number; // días que faltan para que toque (0 o menos: ya toca)
  toca: boolean;
}

/** Lo que se ofrece para apuntar de un toque. */
export const SUGERENCIAS_ESPACIO = ['Tu habitación', 'Tu baño', 'Tu piso'];
/** Cada cuánto, si no se dice otra cosa: cada semana. */
export const CADA_ESPACIO = 7;

/** Los «Hecho» de «Tu espacio» que se desmarcaron después (cada espacio_deshecho quita el último que quede). */
export function espacioAnulados(eventos: Evento[], ahora = Infinity): Set<string> {
  const vivos = new Map<string, string[]>(); // dueño|cosa → sus «Hecho», en orden
  const r = new Set<string>();
  for (const e of [...eventos].sort((a, b) => a.ts - b.ts)) {
    if (e.ts > ahora || (e.tipo !== 'espacio_hecho' && e.tipo !== 'espacio_deshecho' && e.tipo !== 'espacio_cosa_quitada')) continue;
    const k = `${e.autor}|${e.datos?.cosa}`;
    if (e.tipo === 'espacio_cosa_quitada') { vivos.delete(k); continue; }
    const l = vivos.get(k) ?? vivos.set(k, []).get(k)!;
    if (e.tipo === 'espacio_hecho') l.push(e.id);
    else {
      const id = l.pop();
      if (id) r.add(id);
    }
  }
  return r;
}

/** ¿La marcaste como hecha esta semana? (en «Tu parte» sale en verde, como lo de la lista del piso) */
export function hechaEstaSemana(c: CosaEspacio, ahora: number): boolean {
  return c.ultima !== null && c.ultima >= inicioSemana(semana(ahora));
}

export function calcularEspacio(eventos: Evento[], ahora: number): Record<MiembroId, CosaEspacio[]> {
  type Bruta = { m: MiembroId; id: string; nombre: string; cada: number; creada: number; ultima: number | null };
  const cosas = new Map<string, Bruta>();
  const anulados = espacioAnulados(eventos, ahora);
  for (const e of [...eventos].sort((a, b) => a.ts - b.ts)) {
    if (e.ts > ahora || !e.tipo.startsWith('espacio_')) continue;
    const id = e.datos?.cosa;
    if (typeof id !== 'string' || !id) continue;
    const k = `${e.autor}|${id}`;
    if (e.tipo === 'espacio_cosa') {
      const nombre = String(e.datos?.nombre ?? '').trim().slice(0, 40) || 'Sin nombre';
      const cada = Math.max(1, Math.min(90, Math.round(Number(e.datos?.cada) || CADA_ESPACIO)));
      const ya = cosas.get(k);
      if (ya) { ya.nombre = nombre; ya.cada = cada; }
      else cosas.set(k, { m: e.autor, id, nombre, cada, creada: e.ts, ultima: null });
    } else if (e.tipo === 'espacio_cosa_quitada') {
      cosas.delete(k);
    } else if (e.tipo === 'espacio_hecho' && !anulados.has(e.id)) {
      const ya = cosas.get(k);
      if (ya) ya.ultima = e.ts;
    }
  }
  const hoy = diaLocal(ahora);
  const r: Record<MiembroId, CosaEspacio[]> = {};
  for (const x of cosas.values()) {
    const base = diaLocal(x.ultima ?? x.creada);
    const venceDia = base + x.cada;
    const faltan = venceDia - hoy;
    (r[x.m] ??= []).push({ id: x.id, nombre: x.nombre, cada: x.cada, creada: x.creada, ultima: x.ultima, dias: Math.max(0, hoy - base), venceDia, faltan, toca: faltan <= 0 });
  }
  for (const k of Object.keys(r)) r[k].sort((a, b) => a.faltan - b.faltan || a.creada - b.creada);
  return r;
}

/** «Hace 8 días · ya toca», «Hecho hoy · toca en 7 días»… */
export function textoEspacio(c: CosaEspacio): string {
  const cuando = c.ultima === null ? 'Sin marcar todavía' : c.dias === 0 ? 'Hecho hoy' : c.dias === 1 ? 'Hace 1 día' : `Hace ${c.dias} días`;
  if (c.toca) return `${cuando} · ya toca`;
  if (c.ultima === null) return cuando;
  return `${cuando} · ${c.faltan === 1 ? 'toca mañana' : `toca en ${c.faltan} días`}`;
}
