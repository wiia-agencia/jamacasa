import { azarDe, barajar } from './azar';
import { diaDeTexto, semanaDeDia } from './tiempo';
import type { Config, MiembroId, Normas, Zona } from './tipos';

export const NORMAS_BASE: Normas = {
  notaMinima: 5,
  notaAutomatica: 7,
  horasRevision: 48,
  horasBasura: 12,
  horasEstoEsTuyo: 12,
  puntosRevisar: 1,
  puntosBasuraSemana: 3,
  puntosQuejaBasura: -2,
  puntosEstoEsTuyo: -1,
  puntosRetrasoDia: -2,
  puntosSuspenso: -5,
  puntosSinHacer: -15,
  diasGracia: 3,
};

export function normasDe(config: Config): Normas {
  return { ...NORMAS_BASE, ...(config.normas ?? {}) };
}

export function semanaInicial(config: Config): number {
  return semanaDeDia(diaDeTexto(config.inicio));
}

/**
 * Rotación: el primer día se sortea el orden y después cada uno avanza un piso
 * por semana. Así nadie repite el piso de la semana anterior y cada uno hace
 * cada piso una vez cada tantas semanas como pisos haya, tenga el mes las
 * semanas que tenga.
 */
function ordenRotacion(config: Config): number[] {
  const n = config.miembros.length;
  return barajar([...Array(n).keys()], azarDe(config.semilla, 'rotacion'));
}

export function zonaDe(config: Config, w: number, m: MiembroId): Zona | null {
  const s = semanaInicial(config);
  if (w < s) return null;
  const i = config.miembros.findIndex((x) => x.id === m);
  if (i < 0) return null;
  const n = config.zonas.length;
  const p = ordenRotacion(config);
  return config.zonas[(((p[i] + (w - s)) % n) + n) % n];
}

export function repartoSemana(config: Config, w: number): { miembro: MiembroId; zona: Zona }[] {
  return config.miembros
    .map((m) => ({ miembro: m.id, zona: zonaDe(config, w, m.id)! }))
    .filter((x) => x.zona);
}

/**
 * Basura con sorteo de bolsa: los nombres van a una bolsa y sale uno por semana;
 * nadie vuelve a entrar hasta que hayan salido todos, y nunca repite nadie dos
 * semanas seguidas (tampoco al cambiar de bolsa).
 */
const cacheBolsas = new Map<string, MiembroId[][]>();

function bolsas(config: Config, hastaCiclo: number): MiembroId[][] {
  const clave = `${config.semilla}|${config.miembros.map((m) => m.id).join(',')}`;
  let lista = cacheBolsas.get(clave);
  if (!lista) { lista = []; cacheBolsas.set(clave, lista); }
  const ids = config.miembros.map((m) => m.id);
  while (lista.length <= hastaCiclo) {
    const c = lista.length;
    let orden = barajar(ids, azarDe(config.semilla, `basura:${c}`));
    if (c > 0 && orden.length > 1) {
      const anterior = lista[c - 1];
      if (orden[0] === anterior[anterior.length - 1]) orden = [...orden.slice(1), orden[0]];
    }
    lista.push(orden);
  }
  return lista;
}

export function basuraDe(config: Config, w: number): MiembroId | null {
  const s = semanaInicial(config);
  if (w < s) return null;
  const n = config.miembros.length;
  const ciclo = Math.floor((w - s) / n);
  const pos = (w - s) % n;
  return bolsas(config, ciclo)[ciclo][pos];
}

/** Lo que había en la bolsa antes del sorteo de la semana w (para la animación). */
export function bolsaAntesDe(config: Config, w: number): MiembroId[] {
  const s = semanaInicial(config);
  if (w < s) return [];
  const n = config.miembros.length;
  const ciclo = Math.floor((w - s) / n);
  const pos = (w - s) % n;
  return bolsas(config, ciclo)[ciclo].slice(pos);
}
