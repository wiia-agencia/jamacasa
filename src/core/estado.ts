import { calcularChat, type Chat } from './chat';
import { calcularBasura, calcularEstoEsTuyo, cuandoSacada, type AvisoBasura, type AvisoTuyo, type RecordatorioBasura, type SemanaBasura } from './basura';
import { basuraDe, normasDe, repartoSemana, semanaInicial, zonaDe } from './calendario';
import { calcularCuentas, type Cuentas } from './cuentas';
import { calcularEspacio, type CosaEspacio } from './espacio';
import { calcularFuera, type Fuera } from './fuera';
import { calcularSuper, type Super } from './compras';
import {
  calcularApuntes,
  calcularMedallas,
  calcularRacha,
  calcularTitulos,
  nivelDe,
  puntosPorMes,
  type Apunte,
  type Nivel,
  type SemanaRacha,
} from './juego';
import { calcularTareas, porPuntuar, type Intento, type Tarea } from './limpieza';
import { calcularNoticias, type Noticia } from './noticias';
import { DIA_MS, mes, mesDeSemana, mesesEntre, semana } from './tiempo';
import type { Config, Evento, MiembroId, Normas, Zona } from './tipos';

export interface Estado {
  ahora: number;
  semana: number;
  semanaInicio: number;
  empezado: boolean;
  normas: Normas;
  mes: string;
  meses: string[];
  reparto: { miembro: MiembroId; zona: Zona }[];
  basura: MiembroId | null;
  tareas: Tarea[];
  semanasBasura: SemanaBasura[];
  tuyos: AvisoTuyo[];
  apuntes: Apunte[];
  puntosMes: Record<string, Record<MiembroId, number>>;
  medallas: Record<MiembroId, Record<string, number>>;
  titulos: Record<string, Record<string, MiembroId[]>>;
  racha: { actual: number; historial: SemanaRacha[] };
  cuentas: Cuentas;
  noticias: Noticia[];
  chat: Chat;
  /** «Tu espacio» de cada uno (en el móvil solo llega el tuyo) */
  espacio: Record<MiembroId, CosaEspacio[]>;
  /** «Estoy fuera»: quién se va y cuándo */
  fuera: Fuera[];
  /** El súper de casa: lo que ha aportado cada uno, a quién le toca comprar y lo que hace falta */
  super: Super;
  /** La foto de cada uno (Javi, 18 de noviembre: fuera de Limpieza, fotos de verdad y no los muñecos) */
  fotos: Partial<Record<MiembroId, string>>;
}

export function derivar(config: Config, eventos: Evento[], ahora: number): Estado {
  const normas = normasDe(config);
  const ordenados = eventos.filter((e) => e.ts <= ahora).sort((a, b) => a.ts - b.ts);
  const w = semana(ahora);
  const s = semanaInicial(config);
  const tareas = calcularTareas(config, normas, ordenados, ahora);
  const semanasBasura = calcularBasura(config, normas, ordenados, ahora);
  // «Esto es tuyo» cuenta desde que arranca la casa, como la basura: lo de antes del primer lunes no resta
  const tuyos = calcularEstoEsTuyo(normas, ordenados.filter((e) => semana(e.ts) >= s), ahora);
  const cuentas = calcularCuentas(config, ordenados, ahora);
  const apuntes = calcularApuntes(config, normas, tareas, semanasBasura, tuyos, ahora);
  const puntosMes = puntosPorMes(config, apuntes);
  const racha = calcularRacha(config, tareas, w);
  const medallas = calcularMedallas(config, normas, tareas, semanasBasura, racha.historial);
  const mesInicio = mesDeSemana(s) < mes(ahora) ? mesDeSemana(s) : mes(ahora);
  const meses = mesesEntre(mesInicio, mes(ahora));
  const titulos = calcularTitulos(config, tareas, puntosMes, cuentas, tuyos, meses);
  const fuera = calcularFuera(config, ordenados);
  const fotos = fotosDe(config, ordenados);
  const superCasa = calcularSuper(config, ordenados, cuentas.gastos, fuera, ahora);
  const noticias = calcularNoticias(config, normas, tareas, semanasBasura, tuyos, cuentas, fuera, superCasa.faltas);
  const chat = calcularChat(ordenados);
  return {
    ahora,
    semana: w,
    semanaInicio: s,
    empezado: w >= s,
    normas,
    mes: mes(ahora),
    meses,
    reparto: repartoSemana(config, w),
    // quien la tiene ahora: la del sorteo o, si alguien se la quedó («Me la quedo yo»), ese
    basura: semanasBasura.find((x) => x.semana === w)?.responsable ?? basuraDe(config, w),
    tareas,
    semanasBasura,
    tuyos,
    apuntes,
    puntosMes,
    medallas,
    titulos,
    racha,
    cuentas,
    noticias,
    chat,
    espacio: calcularEspacio(ordenados, ahora),
    fuera,
    super: superCasa,
    fotos,
  };
}

// ——— Consultas para las pantallas ———

export function tareaDe(e: Estado, w: number, m: MiembroId): Tarea | undefined {
  return e.tareas.find((t) => t.semana === w && t.miembro === m);
}

/** Tareas de semanas pasadas que siguen sin aprobar. */
export function atrasadas(e: Estado, m: MiembroId): Tarea[] {
  return e.tareas.filter((t) => t.miembro === m && t.semana < e.semana && t.estado !== 'aprobada');
}

export function paraPuntuar(e: Estado, m: MiembroId): { tarea: Tarea; intento: Intento }[] {
  return porPuntuar(e.tareas, m);
}

export function semanaBasura(e: Estado, w: number): SemanaBasura | undefined {
  return e.semanasBasura.find((s) => s.semana === w);
}

/** Avisos de basura abiertos ahora mismo (de la semana actual o de la anterior); con `para`, solo los que le tocan a él. */
export function avisosBasuraAbiertos(e: Estado, para?: MiembroId): AvisoBasura[] {
  return e.semanasBasura.flatMap((s) => s.avisos).filter((a) => a.estado === 'abierto' && (!para || a.responsable === para));
}

/** La foto de cada uno: la última que se puso (`foto_perfil` { foto, quien? }; sin `quien`, la suya; `foto: null`, sin
 *  foto). La puede poner cualquiera (Javi pone las de los tres). */
export function fotosDe(config: Config, eventos: Evento[]): Partial<Record<MiembroId, string>> {
  const r: Partial<Record<MiembroId, string>> = {};
  for (const e of eventos) {
    if (e.tipo !== 'foto_perfil') continue;
    const q: MiembroId = typeof e.datos?.quien === 'string' && config.miembros.some((m) => m.id === e.datos.quien) ? e.datos.quien : e.autor;
    if (!config.miembros.some((m) => m.id === q)) continue;
    if (typeof e.datos?.foto === 'string' && e.datos.foto) r[q] = e.datos.foto;
    else delete r[q];
  }
  return r;
}

export type NivelBasura = 'tranquila' | 'llena' | 'urgente';

export interface BasuraAhora {
  quien: MiembroId | null; // quien la tiene ahora
  nivel: NivelBasura;
  desde?: number; // desde cuándo está llena (el aviso o el «Recuérdamelo» más antiguo sin sacar)
  avisan: MiembroId[]; // quienes han avisado (sin quien la tenía)
  bolsas: number; // las que dicen que hay (0 si nadie dijo cuántas)
  aviso?: AvisoBasura; // el aviso abierto, o la queja que sigue sin sacar
  limite?: number; // hasta cuándo hay para sacarla sin queja (con un aviso abierto)
  pasada: boolean; // se pasó el plazo y sigue sin sacar
  recordatorio?: RecordatorioBasura; // «Recuérdamelo» sin sacar
}

/** Cómo está la basura ahora: sin avisos, tranquila; si avisa uno (o te lo apuntas tú), llena; si avisan dos, dicen
 *  4 bolsas o más o se pasó el plazo sin sacarla, urgente (Javi, 17 de noviembre: «no es lo mismo que avise Josu… o
 *  que avise Jose también… no es lo mismo que haya una bolsa a que haya 6»). */
export function basuraAhora(e: Estado): BasuraAhora {
  const todas = e.semanasBasura;
  const sacadas = todas.flatMap((s) => [...s.sacadas, ...s.ajenas]).map(cuandoSacada);
  const sinSacar = (desde: number) => !sacadas.some((t) => t >= desde);
  const reciente = (t: number) => e.ahora - t < 7 * DIA_MS;
  const avisos = todas
    .flatMap((s) => s.avisos)
    .filter((a) => a.estado === 'abierto' || (a.estado === 'queja' && reciente(a.desde) && sinSacar(a.desde)))
    .sort((a, b) => a.desde - b.desde);
  const recs = todas.flatMap((s) => s.recordatorios).filter((r) => r.resueltoEn === undefined && reciente(r.desde));
  const avisan = [...new Set(avisos.flatMap((a) => a.pulsaciones.map((p) => p.autor)))];
  const bolsas = Math.max(0, ...avisos.map((a) => a.bolsas), ...recs.map((r) => r.bolsas));
  const pasada = avisos.some((a) => a.estado === 'queja');
  const desdes = [...avisos.map((a) => a.desde), ...recs.map((r) => r.desde)];
  const abierto = avisos.find((a) => a.estado === 'abierto');
  return {
    quien: e.basura,
    nivel: !desdes.length ? 'tranquila' : pasada || avisan.length >= 2 || bolsas >= 4 ? 'urgente' : 'llena',
    desde: desdes.length ? Math.min(...desdes) : undefined,
    avisan,
    bolsas,
    aviso: abierto ?? avisos[0],
    limite: abierto?.limite,
    pasada,
    recordatorio: recs[recs.length - 1],
  };
}

/** A quién le salió la basura esta semana en el sorteo (si se la ha quedado otro, no es quien la tiene). */
export function basuraTocaba(e: Estado): MiembroId | null {
  return e.semanasBasura.find((x) => x.semana === e.semana)?.tocaba ?? null;
}

export function tuyosAbiertos(e: Estado, para?: MiembroId): AvisoTuyo[] {
  return e.tuyos.filter((a) => a.estado === 'abierto' && (!para || a.para === para));
}

export function nivel(e: Estado, m: MiembroId): Nivel {
  return nivelDe(e.apuntes, m);
}

export function puntosDelMes(e: Estado, m: MiembroId, mesId = e.mes): number {
  return e.puntosMes[mesId]?.[m] ?? 0;
}

export function rotacionFutura(config: Config, desde: number, cuantas: number) {
  const r: { semana: number; reparto: { miembro: MiembroId; zona: Zona | null }[]; basura: MiembroId | null }[] = [];
  for (let w = desde; w < desde + cuantas; w++) {
    r.push({ semana: w, reparto: config.miembros.map((m) => ({ miembro: m.id, zona: zonaDe(config, w, m.id) })), basura: basuraDe(config, w) });
  }
  return r;
}
