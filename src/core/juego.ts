import type { AvisoTuyo, SemanaBasura } from './basura';
import type { Cuentas } from './cuentas';
import { redondear1, type Tarea } from './limpieza';
import { diaSemana, finSemana, hora, mes, mesDeSemana, partes } from './tiempo';
import type { Config, MiembroId, Normas } from './tipos';

export type ClaseApunte = 'zona' | 'suspenso' | 'retraso' | 'sin_hacer' | 'revision' | 'basura' | 'queja' | 'tuyo';

export interface Apunte {
  miembro: MiembroId;
  puntos: number;
  motivo: string;
  ts: number;
  mes: string;
  clase: ClaseApunte;
  provisional?: boolean; // sigue sumando (retraso aún sin marcar)
}

export function calcularApuntes(config: Config, normas: Normas, tareas: Tarea[], basura: SemanaBasura[], tuyos: AvisoTuyo[], ahora: number): Apunte[] {
  const nombre = (id: MiembroId) => config.miembros.find((m) => m.id === id)?.nombre ?? id;
  const r: Apunte[] = [];
  for (const t of tareas) {
    const m = mesDeSemana(t.semana);
    const zona = t.zona.nombre.toLowerCase();
    for (const i of t.intentos) {
      if (i.resuelto) {
        if (i.aprobado) r.push({ miembro: t.miembro, puntos: i.media!, motivo: `${t.zona.nombre} aprobado${i.auto ? ' sin notas' : ''}`, ts: i.resueltoEn!, mes: m, clase: 'zona' });
        else r.push({ miembro: t.miembro, puntos: normas.puntosSuspenso, motivo: `${t.zona.nombre} suspendido`, ts: i.resueltoEn!, mes: m, clase: 'suspenso' });
      }
      for (const v of i.votos) {
        r.push({ miembro: v.autor, puntos: normas.puntosRevisar, motivo: `Puntuaste el ${zona} de ${nombre(t.miembro)}`, ts: v.ts, mes: m, clase: 'revision' });
      }
    }
    if (t.retrasoDias > 0) {
      const sigue = t.primerHecho === undefined;
      r.push({
        miembro: t.miembro,
        puntos: t.retrasoDias * normas.puntosRetrasoDia,
        motivo: `Retraso en el ${zona}: ${t.retrasoDias} ${t.retrasoDias === 1 ? 'día' : 'días'}${sigue ? ' (sigue sumando)' : ''}`,
        ts: t.primerHecho ?? ahora,
        mes: m,
        clase: 'retraso',
        provisional: sigue,
      });
    }
    if (t.sinHacer) r.push({ miembro: t.miembro, puntos: normas.puntosSinHacer, motivo: `${t.zona.nombre} sin hacer`, ts: t.limiteSinHacer, mes: m, clase: 'sin_hacer' });
  }
  for (const s of basura) {
    const m = mesDeSemana(s.semana);
    for (const a of s.avisos) if (a.estado === 'queja') r.push({ miembro: s.responsable, puntos: normas.puntosQuejaBasura, motivo: 'Basura sin sacar en 12 h', ts: a.limite, mes: m, clase: 'queja' });
    if (s.cerrada && s.quejas === 0) r.push({ miembro: s.responsable, puntos: normas.puntosBasuraSemana, motivo: 'Semana de basura sin quejas', ts: finSemana(s.semana), mes: m, clase: 'basura' });
  }
  for (const a of tuyos) if (a.estado === 'multa') r.push({ miembro: a.para, puntos: normas.puntosEstoEsTuyo, motivo: `Sin recoger: ${a.que || 'lo que dejaste por ahí'}`, ts: a.limite, mes: mes(a.limite), clase: 'tuyo' });
  return r.sort((a, b) => b.ts - a.ts);
}

export function puntosPorMes(config: Config, apuntes: Apunte[]): Record<string, Record<MiembroId, number>> {
  const r: Record<string, Record<MiembroId, number>> = {};
  for (const a of apuntes) {
    const fila = (r[a.mes] ??= Object.fromEntries(config.miembros.map((m) => [m.id, 0])));
    fila[a.miembro] = redondear1((fila[a.miembro] ?? 0) + a.puntos);
  }
  return r;
}

// ——— Niveles ———

// El nivel suma todo lo que ganas desde el principio y nunca baja. Sin nombres de fantasía: «Nivel 1», «Nivel 2»…
export const NIVELES = [0, 50, 150, 300, 500, 800, 1200].map((desde, i) => ({ nombre: `Nivel ${i + 1}`, desde }));

export interface Nivel { actual: (typeof NIVELES)[number]; siguiente?: (typeof NIVELES)[number]; total: number; progreso: number }

export function nivelDe(apuntes: Apunte[], m: MiembroId): Nivel {
  const total = redondear1(apuntes.filter((a) => a.miembro === m && a.puntos > 0).reduce((s, a) => s + a.puntos, 0));
  let i = 0;
  while (i + 1 < NIVELES.length && total >= NIVELES[i + 1].desde) i++;
  const actual = NIVELES[i];
  const siguiente = NIVELES[i + 1];
  const progreso = siguiente ? (total - actual.desde) / (siguiente.desde - actual.desde) : 1;
  return { actual, siguiente, total, progreso };
}

// ——— Medallas y títulos ———

export interface DefMedalla { id: string; emoji: string; nombre: string; texto: string; mala?: boolean; proximamente?: boolean }

export const MEDALLAS: DefMedalla[] = [
  { id: 'quirofano', emoji: '🏥', nombre: 'Quirófano', texto: 'Un piso con un 10 de media.' },
  { id: 'suelo', emoji: '🍽️', nombre: 'Para Comer en el Suelo', texto: 'Tres semanas seguidas con un 9 o más.' },
  { id: 'pole', emoji: '🏁', nombre: 'Pole Position', texto: 'Piso marcado el lunes y aprobado.' },
  { id: 'limite', emoji: '⏰', nombre: 'Al Límite', texto: 'Piso marcado el domingo después de las 22:00 y aprobado.' },
  { id: 'ojo', emoji: '🦅', nombre: 'Ojo de Halcón', texto: 'Pusiste menos de un 5 con foto y el piso suspendió.' },
  { id: 'sinred', emoji: '🧗', nombre: 'Sin Red', texto: 'Cuatro semanas seguidas a tiempo y aprobando a la primera.' },
  { id: 'basurero', emoji: '🗑️', nombre: 'Basurero de Oro', texto: 'Tres semanas de basura seguidas sin una sola queja.' },
  { id: 'salvavidas', emoji: '🛟', nombre: 'Salvavidas', texto: 'Cubriste a un compañero. Llega con los cambios de turno.', proximamente: true },
  { id: 'chapuzas', emoji: '🛠️', nombre: 'Chapuzas', texto: 'Te suspendieron un piso.', mala: true },
  { id: 'repetidor', emoji: '🔁', nombre: 'Repetidor', texto: 'Te suspendieron el mismo piso dos veces seguidas.', mala: true },
  { id: 'fantasma', emoji: '👻', nombre: 'Fantasma', texto: 'Se te pasó el plazo para puntuar a un compañero.', mala: true },
  { id: 'rompe', emoji: '💔', nombre: 'Rompe-rachas', texto: 'Rompiste la racha de la casa.', mala: true },
];

export const TITULOS: DefMedalla[] = [
  { id: 'rey', emoji: '👑', nombre: 'Rey de la Jamacasa', texto: 'El que más puntos suma en el mes.' },
  { id: 'matricula', emoji: '🎓', nombre: 'Matrícula de Honor', texto: 'La mejor nota media del mes.' },
  { id: 'banco', emoji: '🏦', nombre: 'Banco de la Jamacasa', texto: 'El que más dinero adelanta en gastos comunes, sin contar el alquiler.' },
  { id: 'escoba', emoji: '🧹', nombre: 'Escoba de la Vergüenza', texto: 'El que menos puntos suma en el mes.', mala: true },
  { id: 'moroso', emoji: '🐌', nombre: 'Moroso', texto: 'El que paga el alquiler más tarde, si se pasa del día de pago.', mala: true },
  { id: 'calcetin', emoji: '🧦', nombre: 'Calcetín Perdido', texto: 'El que más avisos de «Esto es tuyo» recibe en el mes.', mala: true },
];

export interface SemanaRacha { semana: number; estado: 'ok' | 'rota' | 'pendiente'; culpables: MiembroId[] }

/** Racha: semanas seguidas en las que los tres marcáis vuestro piso dentro de la semana (da igual la nota). */
export function calcularRacha(config: Config, tareas: Tarea[], semanaActual: number): { actual: number; historial: SemanaRacha[] } {
  const porSemana = new Map<number, Tarea[]>();
  for (const t of tareas) (porSemana.get(t.semana) ?? porSemana.set(t.semana, []).get(t.semana)!).push(t);
  const historial: SemanaRacha[] = [];
  for (const [w, ts] of [...porSemana.entries()].sort((a, b) => a[0] - b[0])) {
    if (w >= semanaActual) continue;
    const fin = finSemana(w);
    const culpables = ts.filter((t) => t.primerHecho === undefined || t.primerHecho > fin).map((t) => t.miembro);
    historial.push({ semana: w, estado: culpables.length ? 'rota' : 'ok', culpables });
  }
  let actual = 0;
  for (let i = historial.length - 1; i >= 0 && historial[i].estado === 'ok'; i--) actual++;
  return { actual, historial };
}

export function calcularMedallas(config: Config, normas: Normas, tareas: Tarea[], basura: SemanaBasura[], racha: SemanaRacha[]): Record<MiembroId, Record<string, number>> {
  const r: Record<MiembroId, Record<string, number>> = {};
  for (const m of config.miembros) r[m.id] = {};
  const dar = (m: MiembroId, id: string) => { if (r[m]) r[m][id] = (r[m][id] ?? 0) + 1; };

  for (const m of config.miembros) {
    const suyas = tareas.filter((t) => t.miembro === m.id).sort((a, b) => a.semana - b.semana);
    let seguidasNueve = 0;
    let seguidasSinRed = 0;
    for (const t of suyas) {
      const fin = finSemana(t.semana);
      let suspSeguidos = 0;
      for (const i of t.intentos) {
        if (!i.resuelto) continue;
        if (i.aprobado) {
          suspSeguidos = 0;
          if (i.media === 10) dar(m.id, 'quirofano');
          const p = partes(i.hecho.ts);
          if (i.n === 1 && diaSemana(i.hecho.ts) === 0 && i.hecho.ts <= fin) dar(m.id, 'pole');
          if (diaSemana(i.hecho.ts) === 6 && p.h >= 22 && i.hecho.ts <= fin) dar(m.id, 'limite');
        } else {
          dar(m.id, 'chapuzas');
          suspSeguidos++;
          if (suspSeguidos === 2) dar(m.id, 'repetidor');
        }
      }
      if (t.estado === 'aprobada') {
        if ((t.nota ?? 0) >= 9) { seguidasNueve++; if (seguidasNueve === 3) { dar(m.id, 'suelo'); seguidasNueve = 0; } }
        else seguidasNueve = 0;
        const limpia = t.intentos[0].aprobado && t.primerHecho !== undefined && t.primerHecho <= fin;
        if (limpia) { seguidasSinRed++; if (seguidasSinRed === 4) { dar(m.id, 'sinred'); seguidasSinRed = 0; } }
        else seguidasSinRed = 0;
      } else if (!t.enCurso && t.estado !== 'esperando') {
        seguidasNueve = 0;
        seguidasSinRed = 0;
      }
    }
  }

  // Ojo de Halcón y Fantasma (los jueces)
  for (const t of tareas) {
    for (const i of t.intentos) {
      if (!i.resuelto) continue;
      if (!i.aprobado) for (const v of i.votos) if (v.nota < normas.notaMinima && v.fotos.length > 0) dar(v.autor, 'ojo');
      if (i.resueltoEn === i.fin) for (const j of i.sinVotar) dar(j, 'fantasma');
    }
  }

  // Basurero de Oro
  for (const m of config.miembros) {
    let seguidas = 0;
    for (const s of basura.filter((x) => x.responsable === m.id && x.cerrada)) {
      if (s.quejas === 0) { seguidas++; if (seguidas === 3) { dar(m.id, 'basurero'); seguidas = 0; } }
      else seguidas = 0;
    }
  }

  // Rompe-rachas
  let previa = 0;
  for (const h of racha) {
    if (h.estado === 'ok') previa++;
    else if (h.estado === 'rota') { if (previa > 0) for (const c of h.culpables) dar(c, 'rompe'); previa = 0; }
  }
  return r;
}

export function calcularTitulos(
  config: Config,
  tareas: Tarea[],
  porMes: Record<string, Record<MiembroId, number>>,
  cuentas: Cuentas,
  tuyos: AvisoTuyo[],
  meses: string[],
): Record<string, Record<string, MiembroId[]>> {
  const ids = config.miembros.map((m) => m.id);
  const mejores = (valores: Record<MiembroId, number>, minimo = -Infinity) => {
    const max = Math.max(...ids.map((i) => valores[i] ?? 0));
    if (!(max > minimo)) return [];
    return ids.filter((i) => (valores[i] ?? 0) === max);
  };
  const r: Record<string, Record<string, MiembroId[]>> = {};
  for (const m of meses) {
    const puntos = porMes[m] ?? {};
    const valores = ids.map((i) => puntos[i] ?? 0);
    const todosIguales = valores.every((v) => v === valores[0]);
    const fila: Record<string, MiembroId[]> = {};
    fila.rey = todosIguales ? [] : mejores(puntos);
    const min = Math.min(...valores);
    fila.escoba = todosIguales ? [] : ids.filter((i) => (puntos[i] ?? 0) === min);

    const notas: Record<MiembroId, number> = {};
    for (const i of ids) {
      const ns = tareas.filter((t) => t.miembro === i && t.estado === 'aprobada' && mesDeSemana(t.semana) === m).map((t) => t.nota!);
      notas[i] = ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : -1;
    }
    fila.matricula = mejores(notas, -1);

    const adelantado: Record<MiembroId, number> = {};
    for (const g of cuentas.gastos) if (!g.anulado && !g.alquiler && g.fecha.startsWith(m)) adelantado[g.pagador] = (adelantado[g.pagador] ?? 0) + g.importe;
    fila.banco = mejores(adelantado, 0);

    const tarde: Record<MiembroId, number> = {};
    for (const a of cuentas.alquiler) if (a.mes === m) tarde[a.persona] = a.diasTarde;
    fila.moroso = mejores(tarde, 0);

    const recibidos: Record<MiembroId, number> = {};
    for (const a of tuyos) if (mes(a.evento.ts) === m) recibidos[a.para] = (recibidos[a.para] ?? 0) + 1;
    fila.calcetin = mejores(recibidos, 0);
    r[m] = fila;
  }
  return r;
}

export const horaTexto = hora;
