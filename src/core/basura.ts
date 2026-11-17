import { basuraDe, semanaInicial } from './calendario';
import { calcularFuera, estaFuera, siguienteEnCasa, type Fuera } from './fuera';
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
  /** Cuántas bolsas dicen que hay: lo más que haya dicho alguien (0 si nadie lo dijo) */
  bolsas: number;
}

/** «Recuérdamelo»: quien tiene la basura dice él mismo que está llena para que la app se lo recuerde (Javi, 17 de
 *  noviembre: «simplemente para que la app me lo recuerde»). Sin plazo ni queja: hasta que alguien la saque. */
export interface RecordatorioBasura {
  id: string;
  semana: number;
  quien: MiembroId;
  evento: Evento;
  desde: number;
  bolsas: number;
  resueltoEn?: number;
}

/** Lo más atrás que se puede decir que se sacó: una semana. */
export const ATRAS_MAX = 7 * 24 * HORA;

/** Cuándo se sacó: la hora que se dice al apuntarla («¿Cuándo la sacaste?»: Javi, 17 de noviembre, la sacó a las 2 de
 *  la mañana y se acordó de apuntarlo al mediodía), nunca después de apuntarla ni más de una semana antes. */
export function cuandoSacada(e: Evento): number {
  const c = e.datos?.cuando;
  if (c === undefined || c === null || !Number.isFinite(Number(c))) return e.ts;
  return Math.max(e.ts - ATRAS_MAX, Math.min(e.ts, Number(c)));
}

/** ¿Se apuntó más de una hora después de sacarla? */
export function apuntadaTarde(e: Evento): boolean {
  return e.ts - cuandoSacada(e) > HORA;
}

/** Las bolsas que dice un «Basura llena» (de 1 a 12; si no lo dice, 0). */
export function bolsasDe(e: Evento): number {
  const b = Math.round(Number(e.datos?.bolsas));
  return Number.isFinite(b) && b > 0 ? Math.min(b, 12) : 0;
}

/** Quiénes han avisado de que está llena (sin repetir, por orden). */
export function quienesAvisan(a: AvisoBasura): MiembroId[] {
  return [...new Set(a.pulsaciones.map((p) => p.autor))];
}

/** Quién tiene la basura de la semana desde cuándo: el que salió en el sorteo y, si alguien dice «Me la quedo yo»
 *  (Javi, 14 de noviembre: Josu no estaba y la sacó él toda la semana), desde ese momento, ese. */
export interface TramoBasura {
  desde: number;
  quien: MiembroId;
  evento?: Evento; // el «Me la quedo yo» (o el «Te la devuelvo») que lo cambió
  /** Si la lleva porque quien la tenía está fuera («Estoy fuera»), ese */
  fuera?: MiembroId;
}

/** «Estoy fuera»: mientras quien la tiene está fuera, la lleva el siguiente que esté en casa (y vuelve a él al volver). */
function conFuera(config: Config, tramos: TramoBasura[], fueras: Fuera[], w: number): TramoBasura[] {
  const ini = inicioSemana(w), fin = finSemana(w);
  if (!fueras.some((f) => f.desde <= fin && f.hasta >= ini)) return tramos;
  const cortes = new Set<number>([ini]);
  for (const t of tramos) if (t.desde > ini && t.desde <= fin) cortes.add(t.desde);
  for (const f of fueras) {
    if (f.desde > ini && f.desde <= fin) cortes.add(f.desde);
    if (f.hasta + 1 > ini && f.hasta + 1 <= fin) cortes.add(f.hasta + 1);
  }
  const r: TramoBasura[] = [];
  for (const c of [...cortes].sort((a, b) => a - b)) {
    const base = responsableEn({ tramos }, c);
    const quien = estaFuera(fueras, base, c) ? siguienteEnCasa(config, fueras, base, c) : base;
    const ult = r[r.length - 1];
    if (ult && ult.quien === quien) continue;
    const t: TramoBasura = { desde: r.length ? c : -Infinity, quien, evento: tramos.find((x) => x.desde === c)?.evento };
    if (quien !== base) t.fuera = base;
    r.push(t);
  }
  return r;
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
  sacadas: Evento[]; // las que sacó quien la tenía
  /** «Esta la saqué yo»: las que sacó otro que no la tenía (Javi, 14 de noviembre: +1 para él, como mucho una al día) */
  ajenas: Evento[];
  recordatorios: RecordatorioBasura[];
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

/** Quién sacó la basura: quien lo apunta o, si lleva `quien` (desde el cuadro: «La ha sacado Jose»), ese. */
export function sacadaPor(e: Evento): MiembroId {
  return typeof e.datos?.quien === 'string' && e.datos.quien ? e.datos.quien : e.autor;
}

export function calcularBasura(config: Config, normas: Normas, eventos: Evento[], ahora: number): SemanaBasura[] {
  const s = semanaInicial(config);
  const wAhora = semana(ahora);
  const esMiembro = (m: unknown): m is MiembroId => typeof m === 'string' && config.miembros.some((x) => x.id === m);
  const pulsaciones = eventos.filter((e) => e.tipo === 'basura_llena').sort((a, b) => a.ts - b.ts);
  // las que dicen que la sacó alguien que no es de la casa no cuentan
  const sacadas = eventos
    .filter((e) => e.tipo === 'basura_sacada' && (e.datos?.quien === undefined || esMiembro(e.datos.quien)))
    .sort((a, b) => cuandoSacada(a) - cuandoSacada(b));
  const cambios = eventos.filter((e) => e.tipo === 'basura_cubierta').sort((a, b) => a.ts - b.ts);
  const fueras = calcularFuera(config, eventos);
  const r: SemanaBasura[] = [];

  for (let w = s; w <= wAhora; w++) {
    const tocaba = basuraDe(config, w);
    if (!tocaba) continue;
    const fin = finSemana(w);
    // «Me la quedo yo» (te la quedas tú, desde ahora o desde el día de esta semana que digas: Javi, 14 de noviembre,
    // «que se pueda marcar desde cuándo, por si acaso») o pasársela a otro: devolvérsela a quien le tocaba o, desde el
    // cuadro, a cualquiera («poder añadir a quien yo quiera»). A otro, solo desde ahora: lo de antes (avisos y quejas)
    // no se le echa encima. Siempre antes de que acabe su semana; lo último que se dice manda desde su «desde».
    const tramos: TramoBasura[] = [{ desde: -Infinity, quien: tocaba }];
    for (const c of cambios) {
      if (Number(c.datos?.semana) !== w || c.ts > fin || !esMiembro(c.datos?.quien)) continue;
      const quien: MiembroId = c.datos.quien;
      const actual = responsableEn({ tramos }, c.ts);
      const toma = quien === c.autor;
      const pedido = toma && Number.isFinite(Number(c.datos?.desde)) ? Number(c.datos.desde) : c.ts;
      const desde = Math.max(inicioSemana(w), Math.min(c.ts, pedido));
      if (quien === actual && desde >= c.ts) continue; // ya la tiene: nada que cambiar
      const antes = tramos.filter((t) => t.desde < desde);
      tramos.splice(0, tramos.length, ...antes, { desde, quien, evento: c });
    }
    tramos.splice(0, tramos.length, ...conFuera(config, tramos, fueras, w));
    const en = (ts: number) => responsableEn({ tramos }, ts);

    // la que saca quien la tiene en ese momento y la que saca otro por él («Esta la saqué yo»): las dos la vacían.
    // Cuenta cuándo se sacó de verdad (si se apunta más tarde, la hora que se dice), no cuándo se apuntó
    const validas = sacadas.filter((x) => sacadaPor(x) === en(cuandoSacada(x)));
    const ajenas = sacadas.filter((x) => sacadaPor(x) !== en(cuandoSacada(x)) && semana(cuandoSacada(x)) === w);
    const vacia = (desde: number) => sacadas.find((x) => cuandoSacada(x) >= desde); // cualquiera que la saque
    const avisos: AvisoBasura[] = [];
    const recordatorios: RecordatorioBasura[] = [];
    for (const p of pulsaciones) {
      if (semana(p.ts) !== w) continue;
      const ult = avisos[avisos.length - 1];
      const sigue = ult && p.ts < ult.limite && (ult.estado === 'abierto' || (ult.resueltoEn ?? 0) > p.ts);
      if (p.autor === en(p.ts)) {
        // quien la tiene dice que está llena: «Recuérdamelo» (si ya le han avisado, no hace falta)
        const r = recordatorios[recordatorios.length - 1];
        if (sigue || (r && (r.resueltoEn === undefined || r.resueltoEn > p.ts))) {
          if (r && r.resueltoEn === undefined) r.bolsas = Math.max(r.bolsas, bolsasDe(p));
          continue;
        }
        const sacada = vacia(p.ts);
        recordatorios.push({ id: p.id, semana: w, quien: p.autor, evento: p, desde: p.ts, bolsas: bolsasDe(p), resueltoEn: sacada ? cuandoSacada(sacada) : undefined });
        continue;
      }
      if (sigue) {
        ult.pulsaciones.push(p);
        ult.bolsas = Math.max(ult.bolsas, bolsasDe(p));
        continue;
      }
      const limite = p.ts + normas.horasBasura * HORA;
      const sacada = vacia(p.ts);
      let estado: EstadoAviso = 'abierto';
      let resueltoEn: number | undefined;
      let responsable = en(Math.min(ahora, limite));
      if (sacada && cuandoSacada(sacada) <= limite) { estado = 'resuelto'; resueltoEn = cuandoSacada(sacada); responsable = sacadaPor(sacada); }
      else if (ahora > limite) { estado = 'queja'; resueltoEn = limite; responsable = en(limite); }
      avisos.push({ id: p.id, semana: w, responsable, pulsaciones: [p], desde: p.ts, limite, estado, resueltoEn, bolsas: bolsasDe(p) });
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
      sacadas: validas.filter((x) => semana(cuandoSacada(x)) === w),
      ajenas,
      recordatorios,
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
