import { basuraDe, semanaInicial } from './calendario';
import { HORA, finSemana, inicioSemana, semana } from './tiempo';
import type { Config, DatosEstoEsTuyo, Evento, MiembroId, Normas } from './tipos';

export type EstadoAviso = 'abierto' | 'resuelto' | 'queja';

export interface AvisoBasura {
  id: string;
  semana: number;
  /** A quién le toca sacarla: quien tiene la basura (si se la quedó otro mientras estaba llena, ese); si ya se
   *  sacó, quien la sacó; si se pasó el plazo, quien la tenía entonces (y se lleva la queja). */
  responsable: MiembroId;
  pulsaciones: Evento[]; // quién avisó (puede avisar más de uno)
  desde: number;
  limite: number;
  estado: EstadoAviso;
  resueltoEn?: number;
}

/** Quién tiene la basura de la semana desde cuándo: el que salió en el sorteo y, si alguien dice «Me la quedo yo»
 *  (Javi, 14 de noviembre: Josu no estaba y la sacó él toda la semana), desde ese momento, ese. */
export interface TramoBasura {
  desde: number;
  quien: MiembroId;
  evento?: Evento; // el «Me la quedo yo» (o el «Te la devuelvo») que lo cambió
}

/** ¿Se la quedó desde antes de decirlo? («desde el lunes»: toda la semana) */
export function desdeAntes(t: TramoBasura): boolean {
  return t.evento !== undefined && t.desde < t.evento.ts - 60_000;
}

export interface SemanaBasura {
  semana: number;
  responsable: MiembroId; // quien la tiene ahora (o quien la tenía al acabar la semana)
  tocaba: MiembroId; // a quién le salió en el sorteo
  tramos: TramoBasura[];
  avisos: AvisoBasura[];
  quejas: number; // todas las de la semana, sean de quien sean
  cerrada: boolean; // la semana terminó y no queda ningún aviso abierto
  sacadas: Evento[];
}

/** Quién tenía la basura de esa semana en ese momento. */
export function responsableEn(s: Pick<SemanaBasura, 'tramos'>, ts: number): MiembroId {
  let quien = s.tramos[0].quien;
  for (const t of s.tramos) if (t.desde <= ts) quien = t.quien;
  return quien;
}

/** Las quejas que se llevó alguien esa semana. */
export function quejasDe(s: SemanaBasura, m: MiembroId): number {
  return s.avisos.filter((a) => a.estado === 'queja' && a.responsable === m).length;
}

export function calcularBasura(config: Config, normas: Normas, eventos: Evento[], ahora: number): SemanaBasura[] {
  const s = semanaInicial(config);
  const wAhora = semana(ahora);
  const esMiembro = (m: unknown): m is MiembroId => typeof m === 'string' && config.miembros.some((x) => x.id === m);
  const pulsaciones = eventos.filter((e) => e.tipo === 'basura_llena').sort((a, b) => a.ts - b.ts);
  const sacadas = eventos.filter((e) => e.tipo === 'basura_sacada').sort((a, b) => a.ts - b.ts);
  const cambios = eventos.filter((e) => e.tipo === 'basura_cubierta').sort((a, b) => a.ts - b.ts);
  const r: SemanaBasura[] = [];

  for (let w = s; w <= wAhora; w++) {
    const tocaba = basuraDe(config, w);
    if (!tocaba) continue;
    const fin = finSemana(w);
    // «Me la quedo yo» (te la quedas tú, desde ahora o desde el día de esta semana que digas: Javi, 14 de noviembre,
    // «que se pueda marcar desde cuándo, por si acaso») o «Devolvérsela» (quien la tiene se la devuelve a quien le
    // tocaba), siempre antes de que acabe su semana. Lo último que se dice manda desde su «desde» en adelante.
    const tramos: TramoBasura[] = [{ desde: -Infinity, quien: tocaba }];
    for (const c of cambios) {
      if (Number(c.datos?.semana) !== w || c.ts > fin || !esMiembro(c.datos?.quien)) continue;
      const quien: MiembroId = c.datos.quien;
      const actual = responsableEn({ tramos }, c.ts);
      const toma = quien === c.autor;
      const devuelve = !toma && c.autor === actual && quien === tocaba;
      if (!toma && !devuelve) continue;
      const pedido = toma && Number.isFinite(Number(c.datos?.desde)) ? Number(c.datos.desde) : c.ts;
      const desde = Math.max(inicioSemana(w), Math.min(c.ts, pedido));
      if (quien === actual && desde >= c.ts) continue; // ya la tiene: nada que cambiar
      const antes = tramos.filter((t) => t.desde < desde);
      tramos.splice(0, tramos.length, ...antes, { desde, quien, evento: c });
    }
    const en = (ts: number) => responsableEn({ tramos }, ts);

    // solo cuenta la que saca quien la tiene en ese momento
    const validas = sacadas.filter((x) => x.autor === en(x.ts));
    const avisos: AvisoBasura[] = [];
    for (const p of pulsaciones) {
      if (semana(p.ts) !== w || p.autor === en(p.ts)) continue;
      const ult = avisos[avisos.length - 1];
      if (ult && p.ts < ult.limite && (ult.estado === 'abierto' || (ult.resueltoEn ?? 0) > p.ts)) {
        ult.pulsaciones.push(p);
        continue;
      }
      const limite = p.ts + normas.horasBasura * HORA;
      const sacada = validas.find((x) => x.ts >= p.ts);
      let estado: EstadoAviso = 'abierto';
      let resueltoEn: number | undefined;
      let responsable = en(Math.min(ahora, limite));
      if (sacada && sacada.ts <= limite) { estado = 'resuelto'; resueltoEn = sacada.ts; responsable = sacada.autor; }
      else if (ahora > limite) { estado = 'queja'; resueltoEn = limite; responsable = en(limite); }
      avisos.push({ id: p.id, semana: w, responsable, pulsaciones: [p], desde: p.ts, limite, estado, resueltoEn });
    }
    const quejas = avisos.filter((a) => a.estado === 'queja').length;
    const cerrada = ahora > fin && avisos.every((a) => a.estado !== 'abierto');
    r.push({
      semana: w,
      responsable: en(Math.min(ahora, fin)),
      tocaba,
      tramos,
      avisos,
      quejas,
      cerrada,
      sacadas: validas.filter((x) => semana(x.ts) === w),
    });
  }
  return r;
}

export type EstadoTuyo = 'abierto' | 'recogido' | 'multa';

export interface AvisoTuyo {
  id: string;
  evento: Evento;
  de: MiembroId;
  para: MiembroId;
  que?: string;
  fotos: string[];
  limite: number;
  estado: EstadoTuyo;
  recogidoEn?: number;
}

export function calcularEstoEsTuyo(normas: Normas, eventos: Evento[], ahora: number): AvisoTuyo[] {
  const recogidas = eventos.filter((e) => e.tipo === 'recogido');
  return eventos
    .filter((e) => e.tipo === 'esto_es_tuyo')
    .map((e) => {
      const d = e.datos as DatosEstoEsTuyo;
      const limite = e.ts + normas.horasEstoEsTuyo * HORA;
      const rec = recogidas.find((x) => x.datos?.aviso === e.id && x.autor === d.para);
      let estado: EstadoTuyo = 'abierto';
      if (rec && rec.ts <= limite) estado = 'recogido';
      else if (ahora > limite) estado = 'multa';
      return { id: e.id, evento: e, de: e.autor, para: d.para, que: d.que, fotos: d.fotos ?? [], limite, estado, recogidoEn: rec?.ts };
    })
    .sort((a, b) => b.evento.ts - a.evento.ts);
}
