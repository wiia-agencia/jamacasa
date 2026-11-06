import { basuraDe, semanaInicial } from './calendario';
import { HORA, finSemana, semana } from './tiempo';
import type { Config, DatosEstoEsTuyo, Evento, MiembroId, Normas } from './tipos';

export type EstadoAviso = 'abierto' | 'resuelto' | 'queja';

export interface AvisoBasura {
  id: string;
  semana: number;
  responsable: MiembroId;
  pulsaciones: Evento[]; // quién avisó (puede avisar más de uno)
  desde: number;
  limite: number;
  estado: EstadoAviso;
  resueltoEn?: number;
}

export interface SemanaBasura {
  semana: number;
  responsable: MiembroId;
  avisos: AvisoBasura[];
  quejas: number;
  cerrada: boolean; // la semana terminó y no queda ningún aviso abierto
  sacadas: Evento[];
}

export function calcularBasura(config: Config, normas: Normas, eventos: Evento[], ahora: number): SemanaBasura[] {
  const s = semanaInicial(config);
  const wAhora = semana(ahora);
  const pulsaciones = eventos.filter((e) => e.tipo === 'basura_llena').sort((a, b) => a.ts - b.ts);
  const sacadas = eventos.filter((e) => e.tipo === 'basura_sacada').sort((a, b) => a.ts - b.ts);
  const r: SemanaBasura[] = [];

  for (let w = s; w <= wAhora; w++) {
    const t = basuraDe(config, w);
    if (!t) continue;
    const delResp = sacadas.filter((x) => x.autor === t);
    const avisos: AvisoBasura[] = [];
    for (const p of pulsaciones) {
      if (semana(p.ts) !== w || p.autor === t) continue;
      const ult = avisos[avisos.length - 1];
      if (ult && p.ts < ult.limite && (ult.estado === 'abierto' || (ult.resueltoEn ?? 0) > p.ts)) {
        ult.pulsaciones.push(p);
        continue;
      }
      const limite = p.ts + normas.horasBasura * HORA;
      const sacada = delResp.find((x) => x.ts >= p.ts);
      let estado: EstadoAviso = 'abierto';
      let resueltoEn: number | undefined;
      if (sacada && sacada.ts <= limite) { estado = 'resuelto'; resueltoEn = sacada.ts; }
      else if (ahora > limite) { estado = 'queja'; resueltoEn = limite; }
      avisos.push({ id: p.id, semana: w, responsable: t, pulsaciones: [p], desde: p.ts, limite, estado, resueltoEn });
    }
    const quejas = avisos.filter((a) => a.estado === 'queja').length;
    const cerrada = ahora > finSemana(w) && avisos.every((a) => a.estado !== 'abierto');
    r.push({
      semana: w,
      responsable: t,
      avisos,
      quejas,
      cerrada,
      sacadas: delResp.filter((x) => semana(x.ts) === w),
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
