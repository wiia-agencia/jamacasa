import { calcularChat, type Chat } from './chat';
import { calcularBasura, calcularEstoEsTuyo, type AvisoBasura, type AvisoTuyo, type SemanaBasura } from './basura';
import { basuraDe, normasDe, repartoSemana, semanaInicial, zonaDe } from './calendario';
import { calcularCuentas, type Cuentas } from './cuentas';
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
import { mes, mesDeSemana, mesesEntre, semana } from './tiempo';
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
  const noticias = calcularNoticias(config, normas, tareas, semanasBasura, tuyos, cuentas);
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
    basura: basuraDe(config, w),
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

/** Avisos de basura abiertos ahora mismo (de la semana actual o de la anterior). */
export function avisosBasuraAbiertos(e: Estado): AvisoBasura[] {
  return e.semanasBasura.flatMap((s) => s.avisos).filter((a) => a.estado === 'abierto');
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
