// Tareas extra (Javi, 18 de noviembre; lo pidió Josu): «hoy me apetece limpiar un poco la cocina, pues lo marco… hoy
// ordené el salón… el horno está sucísimo… las ventanas… las escaleras». Lo eligió Javi:
//  · +1, +2 o +3 según lo grande, y lo dice quien lo hace;
//  · cuenta solo, y los otros tienen 48 horas para decir «no vale» (o «vale menos»: cuenta lo más bajo que se diga);
//  · como mucho 6 puntos a la semana cada uno (lo que pase de ahí no suma).
// Eventos: `extra` { que, puntos, fotos? }, `extra_no_vale` { extra, puntos?, porque?, deja? } (sin `puntos`, no vale
// nada; con `deja`, retira lo suyo; vale lo último de cada uno dicho a tiempo) y `extra_anulado` { extra } (solo quien
// lo apuntó).
import { diaLocal, HORA, hora, nombreDia, semana } from './tiempo';
import type { Config, Evento, MiembroId, Normas } from './tipos';

/** Lo que dice alguien de un extra: 0, no vale; 1 o 2, vale menos de lo que dijo quien lo hizo. */
export interface Pega {
  autor: MiembroId;
  ts: number;
  puntos: number;
  porque?: string;
  evento: Evento;
}

export interface Extra {
  id: string;
  evento: Evento;
  quien: MiembroId; // quien lo hizo (y lo apuntó)
  que: string;
  puntos: number; // 1, 2 o 3: lo que dijo
  cuenta: number; // lo que suma de verdad (0 si no vale o lo quitó; menos si pasa de 6 esa semana)
  semana: number;
  fotos: string[];
  hasta: number; // hasta cuándo se puede decir «no vale»
  noVale: Pega[]; // las pegas que siguen en pie (dichas a tiempo y sin retirar)
  anulado?: number; // lo quitó quien lo apuntó
  tope: boolean; // suma menos de lo que dijo por el máximo de la semana
}

/** Las ideas de un toque (lo que dijo Javi; lo demás, escrito). */
export const IDEAS_EXTRA = ['Limpiar la cocina', 'Ordenar el salón', 'El horno', 'Las ventanas', 'Las escaleras', 'La nevera por dentro'];

/** Lo grande que es: lo que se enseña al elegir. */
export const TAMANOS_EXTRA = [
  { puntos: 1, nombre: 'Algo rápido', ejemplo: 'Un repaso, recoger un poco' },
  { puntos: 2, nombre: 'Un buen rato', ejemplo: 'Ordenar el salón, la nevera' },
  { puntos: 3, nombre: 'Algo gordo', ejemplo: 'El horno a fondo, las ventanas' },
];

const ajustar = (x: unknown, min: number, max: number) => {
  const v = Math.round(Number(x));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
};

export function calcularExtras(config: Config, normas: Normas, eventos: Evento[]): Extra[] {
  const esMiembro = (m: unknown): m is MiembroId => typeof m === 'string' && config.miembros.some((x) => x.id === m);
  const ordenados = [...eventos].sort((a, b) => a.ts - b.ts);
  const porId = new Map<string, Extra>();
  const pegas = new Map<string, Map<MiembroId, Pega | null>>(); // lo último de cada uno, por extra
  for (const e of ordenados) {
    if (e.tipo === 'extra') {
      const que = String(e.datos?.que ?? '').trim();
      if (!que || !esMiembro(e.autor)) continue;
      porId.set(e.id, {
        id: e.id,
        evento: e,
        quien: e.autor,
        que,
        puntos: ajustar(e.datos?.puntos, 1, 3),
        cuenta: 0,
        semana: semana(e.ts),
        fotos: Array.isArray(e.datos?.fotos) ? e.datos.fotos.filter((f: unknown) => typeof f === 'string') : [],
        hasta: e.ts + normas.horasExtra * HORA,
        noVale: [],
        tope: false,
      });
    } else if (e.tipo === 'extra_no_vale') {
      const x = porId.get(String(e.datos?.extra ?? ''));
      // solo los otros, y a tiempo
      if (!x || !esMiembro(e.autor) || e.autor === x.quien || e.ts > x.hasta) continue;
      const deEste = pegas.get(x.id) ?? pegas.set(x.id, new Map()).get(x.id)!;
      const puntos = e.datos?.puntos === undefined ? 0 : ajustar(e.datos.puntos, 0, 3);
      const porque = typeof e.datos?.porque === 'string' && e.datos.porque.trim() ? e.datos.porque.trim() : undefined;
      // con `deja`, o si dice que vale lo mismo (o más), retira lo suyo
      deEste.set(e.autor, e.datos?.deja || puntos >= x.puntos ? null : { autor: e.autor, ts: e.ts, puntos, porque, evento: e });
    } else if (e.tipo === 'extra_anulado') {
      const x = porId.get(String(e.datos?.extra ?? ''));
      if (x && e.autor === x.quien && x.anulado === undefined) x.anulado = e.ts;
    }
  }
  const r = [...porId.values()];
  for (const x of r) x.noVale = [...(pegas.get(x.id)?.values() ?? [])].filter((p): p is Pega => p !== null).sort((a, b) => a.ts - b.ts);
  // el máximo de la semana, por orden: lo que no vale no gasta sitio
  const usado = new Map<string, number>();
  for (const x of r) {
    if (x.anulado !== undefined) continue;
    const vale = Math.min(x.puntos, ...x.noVale.map((p) => p.puntos));
    if (vale <= 0) continue;
    const k = `${x.quien}|${x.semana}`;
    const queda = Math.max(0, normas.puntosExtraSemana - (usado.get(k) ?? 0));
    x.cuenta = Math.min(vale, queda);
    x.tope = x.cuenta < vale;
    usado.set(k, (usado.get(k) ?? 0) + x.cuenta);
  }
  return r;
}

/** ¿Se puede decir aún que no vale? */
export const enPlazo = (x: Extra, ahora: number) => x.anulado === undefined && ahora <= x.hasta;

/** Lo que suma de verdad: lo que dijo, o lo más bajo que le hayan dicho. */
export const valeAhora = (x: Extra) => (x.anulado !== undefined ? 0 : Math.min(x.puntos, ...x.noVale.map((p) => p.puntos)));

/** Los puntos de extras que ya lleva alguien esa semana. */
export function llevaSemana(extras: Extra[], m: MiembroId, w: number): number {
  return extras.filter((x) => x.quien === m && x.semana === w).reduce((s, x) => s + x.cuenta, 0);
}

/** Hasta cuándo: «hasta las 19:06», «hasta mañana a las 19:06» o «hasta el jueves a las 19:06». */
export function hastaLas(t: number, ahora: number): string {
  const dif = diaLocal(t) - diaLocal(ahora);
  return dif <= 0 ? `hasta las ${hora(t)}` : dif === 1 ? `hasta mañana a las ${hora(t)}` : `hasta el ${nombreDia(t)} a las ${hora(t)}`;
}

/** «el horno» (sin tocar lo que va en mayúsculas, como «KH7»). */
export function minus(t: string): string {
  return t.length > 1 && t[1] === t[1].toLowerCase() ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
