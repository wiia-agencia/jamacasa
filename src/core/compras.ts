// Compras de casa (Javi, 17 de noviembre): el súper de la casa (aceite, papel, detergente…) no es una deuda sino «de
// turno», como un marcador de quién aporta más: le toca comprar a quien menos ha aportado. Lo eligió Javi: «súper de
// casa de turno; alquiler y facturas, deuda». «Se ha acabado el aceite» le llega a quien le toca y se lo recuerda cada
// día hasta que lo compre: «si tarda más de 4 o 5 días… 5 notificaciones; si tarda una semana… 12», y «hay que poder
// desactivar esa opción tan agresiva» («Una vez al día»). «Lo compré» apunta el gasto (súper de casa: cuenta en el
// marcador, no en lo que se debe); «Ahora no puedo» se lo pasa al siguiente.
import type { Gasto } from './cuentas';
import { estaFuera, type Fuera } from './fuera';
import type { Config, Evento, MiembroId } from './tipos';

/** La categoría de los gastos del súper de casa (la «Compra común» de siempre). */
export const SUPER = 'compra';
export const esSuper = (g: Pick<Gasto, 'categoria'>) => g.categoria === SUPER;

export interface Falta {
  id: string;
  cosa: string;
  evento: Evento;
  pide: MiembroId; // quién avisó
  desde: number; // cuándo se avisó
  toca: MiembroId; // a quién le toca comprarlo ahora
  tocaDesde: number; // desde cuándo (si alguien dijo «Ahora no puedo», desde entonces)
  pasaron: MiembroId[]; // los que dijeron «Ahora no puedo»
  comprada?: { quien: MiembroId; ts: number; importe: number; gasto: string };
  quitada?: number; // «Ya no hace falta»
}

export interface Super {
  aportado: Record<MiembroId, number>; // céntimos al súper de casa, desde siempre
  compras: Record<MiembroId, number>; // cuántas veces
  toca: MiembroId; // a quién le toca ahora: el que menos ha aportado (de los que están en casa)
  faltas: Falta[]; // las abiertas primero
  suave: Record<MiembroId, boolean>; // «Una vez al día»: sin el modo pesado
}

export const abierta = (f: Falta) => !f.comprada && f.quitada === undefined;

/** A quién le toca comprar: el que menos ha aportado (a igualdad, el que menos veces ha comprado), de los que están en
 *  casa y no han dicho «Ahora no puedo». */
export function aQuienToca(config: Config, aportado: Record<MiembroId, number>, compras: Record<MiembroId, number>, fueras: Fuera[], t: number, sin: MiembroId[] = []): MiembroId {
  const ids = config.miembros.map((m) => m.id);
  const quedan = ids.filter((m) => !sin.includes(m));
  const enCasa = quedan.filter((m) => !estaFuera(fueras, m, t));
  const lista = enCasa.length ? enCasa : quedan.length ? quedan : ids;
  return lista.slice().sort((a, b) => (aportado[a] ?? 0) - (aportado[b] ?? 0) || (compras[a] ?? 0) - (compras[b] ?? 0) || ids.indexOf(a) - ids.indexOf(b))[0];
}

export function calcularSuper(config: Config, eventos: Evento[], gastos: Gasto[], fueras: Fuera[], ahora: number): Super {
  const ids = config.miembros.map((m) => m.id);
  const sup = gastos.filter((g) => !g.anulado && esSuper(g) && g.evento).sort((a, b) => a.evento!.ts - b.evento!.ts);
  // lo aportado hasta un momento (a quién le toca se decide con lo de entonces)
  const hasta = (t: number) => {
    const ap: Record<MiembroId, number> = Object.fromEntries(ids.map((m) => [m, 0]));
    const co: Record<MiembroId, number> = Object.fromEntries(ids.map((m) => [m, 0]));
    for (const g of sup) {
      if (g.evento!.ts > t || ap[g.pagador] === undefined) continue;
      ap[g.pagador] += g.importe;
      co[g.pagador] += 1;
    }
    return { ap, co };
  };
  const pasos = eventos.filter((e) => e.tipo === 'falta_paso').sort((a, b) => a.ts - b.ts);
  const quitadas = eventos.filter((e) => e.tipo === 'falta_quitada');
  const faltas: Falta[] = [];
  for (const e of eventos) {
    if (e.tipo !== 'falta') continue;
    const cosa = String(e.datos?.cosa ?? '').trim();
    if (!cosa) continue;
    const compra = sup.find((g) => g.evento!.datos?.falta === e.id && g.evento!.ts >= e.ts);
    const q = quitadas.find((x) => x.datos?.falta === e.id && x.ts >= e.ts);
    const fin = Math.min(compra ? compra.evento!.ts : Infinity, q ? q.ts : Infinity);
    const { ap, co } = hasta(e.ts);
    let toca = aQuienToca(config, ap, co, fueras, e.ts);
    let tocaDesde = e.ts;
    const pasaron: MiembroId[] = [];
    for (const p of pasos) {
      // «Ahora no puedo»: solo vale de quien le toca, y pasa al siguiente (con lo aportado de entonces)
      if (p.datos?.falta !== e.id || p.ts < e.ts || p.ts > fin || p.autor !== toca) continue;
      pasaron.push(p.autor);
      const h = hasta(p.ts);
      toca = aQuienToca(config, h.ap, h.co, fueras, p.ts, pasaron);
      tocaDesde = p.ts;
    }
    faltas.push({
      id: e.id,
      cosa,
      evento: e,
      pide: e.autor,
      desde: e.ts,
      toca,
      tocaDesde,
      pasaron,
      comprada: compra && compra.evento!.ts <= fin ? { quien: compra.pagador, ts: compra.evento!.ts, importe: compra.importe, gasto: compra.id } : undefined,
      quitada: q && q.ts <= fin && !(compra && compra.evento!.ts <= q.ts) ? q.ts : undefined,
    });
  }
  faltas.sort((a, b) => Number(abierta(b)) - Number(abierta(a)) || b.desde - a.desde);
  const suave: Record<MiembroId, boolean> = {};
  for (const e of eventos) if (e.tipo === 'compras_suave') suave[e.autor] = Boolean(e.datos?.suave);
  const { ap, co } = hasta(ahora);
  return { aportado: ap, compras: co, toca: aQuienToca(config, ap, co, fueras, ahora), faltas, suave };
}

/** A qué horas se le recuerda lo que falta, según los días que lleva tocándole: una vez al día hasta el 4.º; desde el
 *  5.º, cinco; desde el 7.º, doce (Javi, 17 de noviembre). Con «Una vez al día», siempre una. Nunca de noche. */
export function horasRecuerdo(dias: number, suave: boolean): number[] {
  if (dias < 1) return [];
  if (suave || dias < 5) return [19];
  if (dias < 7) return [10, 13, 16, 19, 21];
  return [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
}

/** Las cosas que más se acaban, para avisar de un toque. */
export const COSAS_DE_CASA = ['Aceite', 'Sal', 'Papel de váter', 'Papel de cocina', 'Lavavajillas', 'Detergente', 'Suavizante', 'Bolsas de basura', 'Fairy', 'Estropajos', 'Café', 'Leche'];
