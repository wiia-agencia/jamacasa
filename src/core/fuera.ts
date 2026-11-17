// «Estoy fuera» (Javi, 17 de noviembre: «aún no resolvimos bien lo de cuando Josu se vaya»): quien se va unos días lo
// dice con sus fechas (o lo dice otro por él, como en el cuadro). Mientras está fuera no le llegan avisos y la basura
// pasa al siguiente que esté en casa. Si está fuera 4 días o más de una semana, su piso de esa semana queda libre: se
// queda sin limpiar (lo eligió Javi) y nadie pierde puntos por él; si alguien lo limpia («Lo limpio yo»), se lleva lo
// de siempre. Para corregirlo, otro evento: `fuera_anulado` («Ya he vuelto» antes de tiempo lleva `hasta`).
import { diaLocal, fechaDeDia, inicioDia, lunesDe, nombreDia } from './tiempo';
import type { Config, Evento, MiembroId } from './tipos';

export interface Fuera {
  id: string;
  quien: MiembroId;
  desde: number; // el comienzo del primer día
  hasta: number; // el final del último día (o cuando dijo que volvió)
  evento: Evento;
  por: MiembroId; // quién lo apuntó (él mismo u otro)
}

/** Con 4 días fuera (o más) de una semana, su piso de esa semana queda libre. */
export const DIAS_LIBRE = 4;

/** Las ausencias que valen: sin las anuladas y, si volvió antes, hasta que volvió. */
export function calcularFuera(config: Config, eventos: Evento[]): Fuera[] {
  const esMiembro = (m: unknown): m is MiembroId => typeof m === 'string' && config.miembros.some((x) => x.id === m);
  const cambios = new Map<string, Evento>(); // lo último que se dijo de cada una
  for (const e of eventos) {
    if (e.tipo !== 'fuera_anulado') continue;
    const id = String(e.datos?.id ?? '');
    const antes = cambios.get(id);
    if (!antes || antes.ts <= e.ts) cambios.set(id, e);
  }
  const r: Fuera[] = [];
  for (const e of eventos) {
    if (e.tipo !== 'fuera') continue;
    const quien: MiembroId = esMiembro(e.datos?.quien) ? e.datos.quien : e.autor;
    const desde = Number(e.datos?.desde);
    let hasta = Number(e.datos?.hasta);
    if (!esMiembro(quien) || !Number.isFinite(desde) || !Number.isFinite(hasta)) continue;
    const c = cambios.get(e.id);
    if (c) {
      // «Ya he vuelto»: hasta ese momento; sin `hasta`, se anula entera
      const vuelta = Number(c.datos?.hasta);
      if (!Number.isFinite(vuelta)) continue;
      hasta = Math.min(hasta, vuelta);
    }
    if (hasta <= desde) continue;
    r.push({ id: e.id, quien, desde, hasta, evento: e, por: e.autor });
  }
  return r.sort((a, b) => a.desde - b.desde);
}

/** ¿Está fuera en ese momento? */
export function estaFuera(fueras: Fuera[], m: MiembroId, t: number): boolean {
  return fueras.some((f) => f.quien === m && t >= f.desde && t <= f.hasta);
}

/** La ausencia que tiene ahora (o la próxima, si aún no se ha ido). */
export function fueraDe(fueras: Fuera[], m: MiembroId, ahora: number): Fuera | undefined {
  return fueras.find((f) => f.quien === m && f.hasta >= ahora);
}

/** Cuántos días de esa semana está fuera (un día cuenta si está fuera casi entero: más de 20 horas). */
export function diasFuera(fueras: Fuera[], m: MiembroId, w: number): number {
  const lunes = lunesDe(w);
  let n = 0;
  for (let d = lunes; d < lunes + 7; d++) {
    const a = inicioDia(d), b = inicioDia(d + 1);
    const dentro = fueras.filter((f) => f.quien === m).reduce((x, f) => x + Math.max(0, Math.min(b, f.hasta) - Math.max(a, f.desde)), 0);
    if (dentro > 20 * 3_600_000) n++;
  }
  return n;
}

/** ¿Su piso de esa semana queda libre? (4 días fuera o más) */
export function pisoLibre(fueras: Fuera[], m: MiembroId, w: number): boolean {
  return diasFuera(fueras, m, w) >= DIAS_LIBRE;
}

/** El siguiente que está en casa en ese momento (por el orden de la casa), para pasarle lo de quien se ha ido. */
export function siguienteEnCasa(config: Config, fueras: Fuera[], m: MiembroId, t: number): MiembroId {
  const ids = config.miembros.map((x) => x.id);
  const i = ids.indexOf(m);
  for (let k = 1; k < ids.length; k++) {
    const otro = ids[(i + k) % ids.length];
    if (!estaFuera(fueras, otro, t)) return otro;
  }
  return m; // si no hay nadie en casa, se queda donde estaba
}

/** «el jueves 19»: el día de un momento. */
export function elDia(t: number): string {
  return `el ${nombreDia(t)} ${fechaDeDia(diaLocal(t)).d}`;
}

/** «del jueves 19 al domingo 22» o, si ya se ha ido, «hasta el domingo 22». */
export function rangoFuera(f: Pick<Fuera, 'desde' | 'hasta'>, ahora: number): string {
  const hasta = elDia(f.hasta);
  if (f.desde <= ahora) return `hasta ${hasta}`;
  if (diaLocal(f.desde) === diaLocal(f.hasta)) return hasta;
  return `del ${elDia(f.desde).slice(3)} al ${hasta.slice(3)}`;
}
