// Historial: cómo estaba la casa cualquier día pasado.
// Como todo se apunta y nada se borra (los eventos), basta con volver a calcular el estado con los eventos de
// hasta ese día: es la misma cuenta de siempre, pero «parando el reloj» al final de ese día.
import { avisosBasuraAbiertos, derivar, paraPuntuar, type Estado } from './estado';
import type { CosaEspacio } from './espacio';
import { calcularMedallas, type MedallaGanada } from './juego';
import { enMarcha } from './limpieza';
import type { Noticia } from './noticias';
import { diaLocal, fechaDeDia, inicioDia, instanteLocal, lunesDe, mesDeDia, semanaDeDia } from './tiempo';
import type { Config, Evento, MiembroId } from './tipos';

/** Cómo iba el piso de cada uno: «sin_hacer» es que acabó la semana (y los días de gracia) sin limpiarlo. */
export type Situacion = 'sin_empezar' | 'limpiando' | 'esperando' | 'aprobado' | 'suspendido' | 'tarde' | 'sin_hacer';

export interface AlquilerDelDia {
  mes: string; // «2026-11»
  pagado: boolean; // al acabar ese día ya lo había pagado
  dia?: number; // el día que lo pagó
  diasTarde: number; // días que se pasó del día de pago (hasta que pagó o hasta ese día)
}

export interface PersonaDelDia {
  miembro: MiembroId;
  zona: string | null; // su piso esa semana
  situacion: Situacion | null;
  nota?: number;
  atrasada: boolean; // aún debía el piso de la semana anterior
  porPuntuar: number; // notas que le quedaban por poner a los otros
  basura: boolean; // esa semana le tocaba la basura
  saldo: number; // al acabar el día, en céntimos: + le deben, − debe
  alquiler: AlquilerDelDia | null; // null si es quien recibe el alquiler
  puntos: number; // lo que sumó (o restó) ese día
  medallas: string[]; // las medallas que ganó ese día
}

export interface DiaDeLaCasa {
  dia: number;
  ts: number; // el momento que se mira: el final del día (o ahora, si es hoy)
  hoy: boolean;
  personas: PersonaDelDia[];
  basuraLlena: boolean; // al acabar el día había un «Basura llena» sin sacar
  noticias: Noticia[]; // lo que pasó ese día, en orden
  espacio: CosaEspacio[]; // «Tu espacio» de quien mira, como estaba ese día
  estado: Estado; // el estado entero de ese momento (para ver la casa en 3D tal cual estaba)
}

export interface MarcaDelDia {
  limpiaron: MiembroId[]; // marcaron su piso como hecho
  aprobados: MiembroId[]; // les aprobaron el piso ese día
  suspensos: MiembroId[];
  pagaron: MiembroId[]; // apuntaron un pago o un gasto
  alquiler: MiembroId[]; // pagaron el alquiler ese día
  basuraSacada: boolean;
  mensajes: number;
  medallas: MedallaGanada[];
  espacio: string[]; // lo de «Tu espacio» que limpió quien mira (solo lo suyo)
}

/** El último instante de un día (en Madrid). */
export const finDelDia = (dia: number) => inicioDia(dia + 1) - 1;

/** El estado de la casa al acabar ese día (o ahora mismo, si el día es hoy). */
export function estadoDelDia(config: Config, eventos: Evento[], dia: number, ahora: number): Estado {
  return derivar(config, eventos, Math.min(finDelDia(dia), ahora));
}

/** Todas las medallas ganadas hasta ese estado, con el momento de cada una. */
export function medallasConFecha(config: Config, e: Estado): MedallaGanada[] {
  const r: MedallaGanada[] = [];
  calcularMedallas(config, e.normas, e.tareas, e.semanasBasura, e.racha.historial, r);
  return r.sort((a, b) => a.ts - b.ts);
}

export function situacionDe(e: Estado, m: MiembroId): { zona: string | null; situacion: Situacion | null; nota?: number } {
  const t = e.tareas.find((x) => x.semana === e.semana && x.miembro === m);
  if (!t) return { zona: e.reparto.find((r) => r.miembro === m)?.zona.nombre ?? null, situacion: null };
  const situacion: Situacion =
    t.estado === 'aprobada' ? 'aprobado'
    : t.estado === 'suspendida' ? 'suspendido'
    : t.estado === 'esperando' ? 'esperando'
    : !t.enCurso ? (t.sinHacer ? 'sin_hacer' : 'tarde')
    : enMarcha(t) ? 'limpiando'
    : 'sin_empezar';
  return { zona: t.zona.nombre, situacion, nota: t.estado === 'aprobada' ? t.nota : undefined };
}

function alquilerDe(e: Estado, m: MiembroId, mesId: string): AlquilerDelDia | null {
  const a = e.cuentas.alquiler.find((x) => x.mes === mesId && x.persona === m);
  if (!a) return null;
  const pagado = a.pagadoEn !== undefined && a.pagadoEn <= e.ahora;
  return { mes: mesId, pagado, dia: pagado ? diaLocal(a.pagadoEn!) : undefined, diasTarde: a.diasTarde };
}

/** Todo lo de un día: cómo estaba cada uno al acabar el día y lo que pasó. */
export function diaDeLaCasa(config: Config, eventos: Evento[], dia: number, ahora: number, yo?: MiembroId): DiaDeLaCasa {
  const e = estadoDelDia(config, eventos, dia, ahora);
  const ganadas = medallasConFecha(config, e).filter((g) => diaLocal(g.ts) === dia);
  const mesId = mesDeDia(dia);
  const personas = config.miembros.map((m): PersonaDelDia => {
    const s = situacionDe(e, m.id);
    const puntos = e.apuntes.filter((a) => a.miembro === m.id && diaLocal(a.ts) === dia).reduce((x, a) => x + a.puntos, 0);
    const atrasada = e.tareas.some((t) => t.miembro === m.id && t.semana < e.semana && t.estado !== 'aprobada');
    return {
      miembro: m.id,
      ...s,
      atrasada,
      porPuntuar: paraPuntuar(e, m.id).length,
      basura: e.basura === m.id,
      saldo: e.cuentas.saldo[m.id] ?? 0,
      alquiler: alquilerDe(e, m.id, mesId),
      puntos: Math.round(puntos * 10) / 10,
      medallas: ganadas.filter((g) => g.miembro === m.id).map((g) => g.medalla),
    };
  });
  return {
    dia,
    ts: e.ahora,
    hoy: dia === diaLocal(ahora),
    personas,
    basuraLlena: avisosBasuraAbiertos(e).length > 0,
    noticias: e.noticias.filter((n) => diaLocal(n.ts) === dia).sort((a, b) => a.ts - b.ts),
    espacio: yo ? e.espacio[yo] ?? [] : [],
    estado: e,
  };
}

/** Las marcas de cada día de un mes («2026-11»), para pintar el calendario. `e` es el estado de ahora; `yo`, de quién es «Tu espacio». */
export function marcasDelMes(config: Config, eventos: Evento[], mesId: string, e: Estado, yo?: MiembroId): Map<number, MarcaDelDia> {
  const ahora = e.ahora;
  const [y, m] = mesId.split('-').map(Number);
  const primero = diaLocal(instanteLocal(y, m, 1, 12));
  const r = new Map<number, MarcaDelDia>();
  for (let d = primero; fechaDeDia(d).m === m; d++) {
    r.set(d, { limpiaron: [], aprobados: [], suspensos: [], pagaron: [], alquiler: [], basuraSacada: false, mensajes: 0, medallas: [], espacio: [] });
  }
  const de = (ts: number) => r.get(diaLocal(ts));
  const anadir = <T,>(lista: T[], x: T) => { if (!lista.includes(x)) lista.push(x); };
  const nombres = new Map<string, string>(); // las cosas de «Tu espacio», por su id
  for (const ev of [...eventos].sort((a, b) => a.ts - b.ts)) {
    if (ev.ts > ahora) continue;
    if (yo && ev.autor === yo && ev.tipo === 'espacio_cosa') nombres.set(String(ev.datos?.cosa), String(ev.datos?.nombre ?? ''));
    const k = de(ev.ts);
    if (!k) continue;
    if (ev.tipo === 'zona_hecha') anadir(k.limpiaron, ev.autor);
    else if (ev.tipo === 'pago' || ev.tipo === 'gasto') anadir(k.pagaron, ev.autor);
    else if (ev.tipo === 'basura_sacada') k.basuraSacada = true;
    else if (ev.tipo === 'mensaje') k.mensajes++;
    else if (ev.tipo === 'espacio_hecho' && yo && ev.autor === yo) anadir(k.espacio, nombres.get(String(ev.datos?.cosa)) || 'Tu espacio');
  }
  // las notas se resuelven solas (cuando votan todos o se acaba el plazo): salen del estado de ahora
  for (const t of e.tareas) {
    for (const i of t.intentos) {
      if (!i.resuelto || i.resueltoEn === undefined) continue;
      const k = de(i.resueltoEn);
      if (k) anadir(i.aprobado ? k.aprobados : k.suspensos, i.quien); // de quien lo limpió (si fue el piso de otro, también)
    }
  }
  for (const a of e.cuentas.alquiler) {
    if (a.pagadoEn === undefined) continue;
    const k = de(a.pagadoEn);
    if (k) anadir(k.alquiler, a.persona);
  }
  for (const g of medallasConFecha(config, e)) de(g.ts)?.medallas.push(g);
  return r;
}

/** Los días de un mes para el calendario, con huecos delante para que el 1 caiga en su día de la semana (lunes primero). */
export function rejillaDelMes(mesId: string): (number | null)[] {
  const [y, m] = mesId.split('-').map(Number);
  const primero = diaLocal(instanteLocal(y, m, 1, 12));
  const huecos = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dias: (number | null)[] = Array.from({ length: huecos }, () => null);
  for (let d = primero; fechaDeDia(d).m === m; d++) dias.push(d);
  return dias;
}

// ——— El resumen del mes (debajo del calendario) ———

export type ComoAcabo = 'aprobado' | 'suspendido' | 'esperando' | 'limpiando' | 'en_curso' | 'tarde' | 'sin_hacer';

export interface PersonaDeSemana {
  miembro: MiembroId;
  zona: string;
  como: ComoAcabo;
  nota?: number;
  hechoDia?: number; // el día que lo marcó como hecho (la primera vez)
  retrasoDias: number;
}

export interface SemanaDelMes {
  semana: number;
  lunes: number; // el día del lunes
  personas: PersonaDeSemana[];
  basura: { miembro: MiembroId; quejas: number } | null;
  racha: 'ok' | 'rota' | 'pendiente' | null;
}

export interface ResumenDelMes {
  mes: string;
  cerrado: boolean; // el mes ya acabó (los títulos son definitivos)
  semanas: SemanaDelMes[];
  alquiler: { miembro: MiembroId; pagadoDia?: number; diasTarde: number }[];
  titulos: Record<string, MiembroId[]>;
}

/** Cómo acabó cada semana del mes, quién pagó el alquiler y los títulos. `e` es el estado de ahora. */
export function resumenDelMes(config: Config, e: Estado, mesId: string): ResumenDelMes {
  const [y, m] = mesId.split('-').map(Number);
  const primero = diaLocal(instanteLocal(y, m, 1, 12));
  let ultimo = primero;
  while (fechaDeDia(ultimo + 1).m === m) ultimo++;
  const semanas: SemanaDelMes[] = [];
  for (let w = semanaDeDia(primero); w <= semanaDeDia(ultimo); w++) {
    if (w < e.semanaInicio || w > e.semana) continue;
    const personas = config.miembros.flatMap((x): PersonaDeSemana[] => {
      const t = e.tareas.find((k) => k.semana === w && k.miembro === x.id);
      if (!t) return [];
      const como: ComoAcabo =
        t.estado === 'aprobada' ? 'aprobado'
        : t.estado === 'suspendida' ? 'suspendido'
        : t.estado === 'esperando' ? 'esperando'
        : t.enCurso ? (enMarcha(t) ? 'limpiando' : 'en_curso')
        : t.sinHacer ? 'sin_hacer' : 'tarde';
      return [{
        miembro: x.id,
        zona: t.zona.nombre,
        como,
        nota: t.estado === 'aprobada' ? t.nota : undefined,
        hechoDia: t.primerHecho !== undefined ? diaLocal(t.primerHecho) : undefined,
        retrasoDias: t.retrasoDias,
      }];
    });
    const b = e.semanasBasura.find((k) => k.semana === w);
    semanas.push({
      semana: w,
      lunes: lunesDe(w),
      personas,
      basura: b ? { miembro: b.responsable, quejas: b.quejas } : null,
      racha: e.racha.historial.find((h) => h.semana === w)?.estado ?? null,
    });
  }
  return {
    mes: mesId,
    cerrado: mesId < e.mes,
    semanas,
    alquiler: e.cuentas.alquiler
      .filter((a) => a.mes === mesId)
      .map((a) => ({ miembro: a.persona, pagadoDia: a.pagadoEn !== undefined ? diaLocal(a.pagadoEn) : undefined, diasTarde: a.diasTarde })),
    titulos: e.titulos[mesId] ?? {},
  };
}
