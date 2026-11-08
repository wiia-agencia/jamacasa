import { hash32 } from './azar';
import type { AvisoTuyo, SemanaBasura } from './basura';
import { euros, type Cuentas } from './cuentas';
import type { Tarea } from './limpieza';
import { nombreMes } from './tiempo';
import type { Config, MiembroId, Normas } from './tipos';

export interface Noticia {
  id: string;
  ts: number;
  quien: MiembroId;
  texto: string;
  oficial?: boolean;
  fotos?: string[];
}

const elegir = (id: string, opciones: string[]) => opciones[hash32(id) % opciones.length];
export const nota = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 });
export const pt = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + nota(Math.abs(x));

export function calcularNoticias(config: Config, normas: Normas, tareas: Tarea[], basura: SemanaBasura[], tuyos: AvisoTuyo[], cuentas: Cuentas): Noticia[] {
  const n = (id: MiembroId) => config.miembros.find((m) => m.id === id)?.nombre ?? id;
  const r: Noticia[] = [];

  for (const t of tareas) {
    const X = n(t.miembro);
    const zona = t.zona.nombre.toLowerCase();
    if (t.empezada !== undefined) r.push({ id: `${t.semana}-${t.miembro}-em`, ts: t.empezada, quien: t.miembro, texto: `${X} ha empezado a limpiar el ${zona}.` });
    for (const i of t.intentos) {
      r.push({ id: `${i.hecho.id}-h`, ts: i.hecho.ts, quien: t.miembro, texto: i.n > 1 ? `${X} ha repasado el ${zona}.` : `${X} ha terminado el ${zona}.`, fotos: i.hecho.datos?.fotos });
      if (!i.resuelto) continue;
      const id = `${i.hecho.id}-r`;
      if (i.aprobado) {
        const texto = i.auto
          ? `Nadie puntuó a tiempo el ${zona} de ${X}: aprobado con un ${nota(i.media!)}.`
          : i.media === 10
            ? `${X} saca un 10 en el ${zona}. Quirófano.`
            : `${X} aprueba el ${zona} con un ${nota(i.media!)}.`;
        r.push({ id, ts: i.resueltoEn!, quien: t.miembro, texto });
      } else {
        r.push({
          id,
          ts: i.resueltoEn!,
          quien: t.miembro,
          oficial: true,
          texto: elegir(id, [
            `La Jamacasa comunica que ${X} ha suspendido el ${zona} con un ${nota(i.media!)}. Queda nombrado Chapuzas oficial hasta que lo repase.`,
            `Comunicado oficial: el ${zona} de ${X} no pasa la inspección (${nota(i.media!)}). Se le espera con la fregona.`,
            `La Jamacasa informa de que el ${zona} de ${X} se queda en un ${nota(i.media!)}. Toca repetir.`,
          ]),
        });
      }
    }
    if (t.sinHacer) {
      const id = `${t.semana}-${t.miembro}-sh`;
      r.push({
        id,
        ts: t.limiteSinHacer,
        quien: t.miembro,
        oficial: true,
        texto: elegir(id, [
          `La Jamacasa comunica que el ${zona} de ${X} sigue sin hacer. Se le restan ${nota(-normas.puntosSinHacer)} puntos y la vergüenza no se la quita nadie.`,
          `Comunicado oficial: ${X} ha dejado el ${zona} sin hacer. ${pt(normas.puntosSinHacer)} puntos y sigue siendo suyo.`,
        ]),
      });
    }
  }

  for (const s of basura) {
    const Y = n(s.responsable);
    for (const a of s.avisos) {
      a.pulsaciones.forEach((p, k) =>
        r.push({ id: `${p.id}-b`, ts: p.ts, quien: p.autor, texto: k === 0 ? `${n(p.autor)} avisa de que la basura está llena. Le toca a ${Y}.` : `${n(p.autor)} insiste: la basura sigue llena.`, fotos: p.datos?.fotos }),
      );
      if (a.estado === 'queja') {
        const id = `${a.id}-q`;
        r.push({
          id,
          ts: a.limite,
          quien: s.responsable,
          oficial: true,
          texto: elegir(id, [
            `La Jamacasa comunica que la basura de ${Y} lleva ${normas.horasBasura} horas esperando. Queja registrada: ${pt(normas.puntosQuejaBasura)}.`,
            `Comunicado oficial: la basura de ${Y} ha cumplido ${normas.horasBasura} horas sin salir de casa. ${pt(normas.puntosQuejaBasura)} puntos.`,
          ]),
        });
      }
    }
    for (const x of s.sacadas) r.push({ id: `${x.id}-s`, ts: x.ts, quien: x.autor, texto: `${Y} ha sacado la basura.` });
  }

  for (const a of tuyos) {
    const que = a.que ? `: «${a.que}»` : '';
    r.push({ id: `${a.id}-t`, ts: a.evento.ts, quien: a.de, texto: `${n(a.de)} ha encontrado algo de ${n(a.para)}${que}.`, fotos: a.fotos });
    if (a.recogidoEn) r.push({ id: `${a.id}-tr`, ts: a.recogidoEn, quien: a.para, texto: `${n(a.para)} ya ha recogido lo suyo.` });
    if (a.estado === 'multa') r.push({ id: `${a.id}-tm`, ts: a.limite, quien: a.para, oficial: true, texto: `La Jamacasa comunica que ${n(a.para)} no ha recogido lo suyo en ${normas.horasEstoEsTuyo} horas. ${pt(normas.puntosEstoEsTuyo)} punto.` });
  }

  for (const g of cuentas.gastos) {
    if (!g.evento || g.anulado) continue;
    r.push({ id: `${g.id}-g`, ts: g.evento.ts, quien: g.pagador, texto: `${n(g.pagador)} ha apuntado un gasto: ${g.concepto}, ${euros(g.importe)}.` });
  }
  for (const p of cuentas.pagos) {
    if (p.anulado) continue;
    const extra = p.alquiler ? ` (alquiler de ${nombreMes(p.alquiler)})` : '';
    r.push({ id: `${p.id}-p`, ts: p.evento.ts, quien: p.de, texto: `${n(p.de)} le ha pagado ${euros(p.importe)} a ${n(p.a)}${extra}.` });
  }

  return r.sort((a, b) => b.ts - a.ts);
}
