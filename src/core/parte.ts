// «Mi parte»: los cuartos de cada uno (su habitación, su baño, el pasillo…), que no salen en la casa de los tres.
// Se abre tocando tu cara en Limpieza y solo la ves tú (Javi, 10 de noviembre, 19:46). De quién es cada cuarto lo
// dice la config de la casa (`partes`); cómo está cada uno, «Tu espacio» (lo que apuntas y marcas como hecho, que la
// base de datos no da a los otros dos). El nombre del cuarto dice qué es (habitacion1, bano2, pasillo…) y así se
// junta con lo que apuntas en «Tu espacio»: «Tu habitación», «Tu baño», «El pasillo»…
import type { CosaEspacio } from './espacio';
import type { Config, MiembroId } from './tipos';

export type TipoCuarto = 'habitacion' | 'bano' | 'pasillo' | 'otro';

export interface CuartoParte {
  id: string; // el nombre del cuarto en el plano de la casa en 3D
  tipo: TipoCuarto;
  nombre: string; // cómo se apunta en «Tu espacio»
  cosa: CosaEspacio | null; // lo de «Tu espacio» que le corresponde (si lo has apuntado)
  dias: number | null; // días sin limpiarse que enseña la casa (null: sin apuntar)
  brillo: number; // recién limpio: 3 el mismo día, 2 al siguiente, 1 al otro; 0 si no (o si nunca lo has marcado)
}

export function tipoCuarto(id: string): TipoCuarto {
  if (id.startsWith('habitacion')) return 'habitacion';
  if (id.startsWith('bano')) return 'bano';
  if (id.startsWith('pasillo')) return 'pasillo';
  return 'otro';
}

/** Cómo se llama cada cuarto en «Tu espacio» (lo que se apunta de un toque). */
export const NOMBRE_CUARTO: Record<TipoCuarto, string> = { habitacion: 'Tu habitación', bano: 'Tu baño', pasillo: 'El pasillo', otro: 'Tu cuarto' };

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ¿Esto de «Tu espacio» es este tipo de cuarto? («Mi habitación» es una habitación; «El baño de arriba», un baño…) */
export function esDeTipo(tipo: TipoCuarto, nombre: string): boolean {
  const n = sinTildes(nombre);
  if (tipo === 'habitacion') return /habitacion|cuarto|dormitorio/.test(n) && !esDeTipo('bano', nombre); // «cuarto de baño» no
  if (tipo === 'bano') return /\bbano|aseo|ducha/.test(n);
  if (tipo === 'pasillo') return n.includes('pasillo');
  return false;
}

/** Tus cuartos y cómo está cada uno. Vacío si no tienes parte en la casa (Jose, de momento). */
export function parteDe(config: Config, cosas: CosaEspacio[], yo: MiembroId): CuartoParte[] {
  const ids = (config.partes?.[yo] ?? []).filter((id, i, a) => typeof id === 'string' && id && a.indexOf(id) === i);
  return ids.map((id) => {
    const tipo = tipoCuarto(id);
    // primero lo apuntado desde el propio cuarto (lleva su nombre como id); si no, lo que se llame como él
    const cosa = cosas.find((c) => c.id === id) ?? cosas.find((c) => esDeTipo(tipo, c.nombre)) ?? null;
    // si nunca lo has marcado como hecho, no se sabe cuándo se limpió: sale con lo del primer día
    const dias = cosa ? (cosa.ultima === null ? Math.max(1, cosa.dias) : cosa.dias) : null;
    const brillo = cosa && cosa.ultima !== null ? Math.max(0, 3 - cosa.dias) : 0;
    return { id, tipo, nombre: NOMBRE_CUARTO[tipo], cosa, dias, brillo };
  });
}
