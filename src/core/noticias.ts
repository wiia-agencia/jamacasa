import { hash32 } from './azar';
import { apuntadaTarde, bolsasDe, cuandoSacada, desdeAntes, responsableEn, sacadaPor, type AvisoTuyo, type SemanaBasura } from './basura';
import { euros, type Cuentas } from './cuentas';
import type { Tarea } from './limpieza';
import { cuando, nombreDia, nombreMes, semana as semanaDe } from './tiempo';
import { rangoFuera, type Fuera } from './fuera';
import { esSuper, type Falta } from './compras';
import type { Config, Evento, MiembroId, Normas } from './tipos';

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

export function calcularNoticias(config: Config, normas: Normas, tareas: Tarea[], basura: SemanaBasura[], tuyos: AvisoTuyo[], cuentas: Cuentas, fueras: Fuera[] = [], faltas: Falta[] = []): Noticia[] {
  const n = (id: MiembroId) => config.miembros.find((m) => m.id === id)?.nombre ?? id;
  const r: Noticia[] = [];

  // «Estoy fuera»: quién se va, hasta cuándo y si su piso queda libre
  for (const f of fueras) {
    const libres = tareas.filter((t) => t.miembro === f.quien && t.libre && t.semana >= semanaDe(f.desde) && t.semana <= semanaDe(f.hasta));
    const piso = libres.length ? `: su ${libres[0].zona.nombre.toLowerCase()} queda libre${libres.length > 1 ? ' esas semanas' : ''}` : '';
    const apunta = f.por !== f.quien ? ` Lo apunta ${n(f.por)}.` : '';
    r.push({ id: `${f.id}-fu`, ts: f.evento.ts, quien: f.quien, texto: `${n(f.quien)} está fuera ${rangoFuera(f, f.evento.ts)}${piso}.${apunta}` });
  }

  for (const t of tareas) {
    const X = n(t.miembro);
    const zona = t.zona.nombre.toLowerCase();
    if (t.empezada !== undefined) r.push({ id: `${t.semana}-${t.miembro}-em`, ts: t.empezada, quien: t.miembro, texto: `${X} ha empezado a limpiar el ${zona}.` });
    if (t.cubre !== undefined && t.cubiertaEn !== undefined) {
      // si lo dijo otro desde el cuadro («Lo limpia Jose»), la noticia es de quien lo dijo
      const por = t.cubiertaPor ?? t.cubre;
      const dice = por !== t.cubre ? `${n(por)} dice que ` : '';
      r.push({ id: `${t.semana}-${t.miembro}-cu`, ts: t.cubiertaEn, quien: por, texto: `${dice}${n(t.cubre)} se encarga del ${zona} de ${X} esta semana.` });
    }
    // «Le echo una mano» (o «Josu le echa una mano», desde el cuadro)
    for (const a of t.ayudas) {
      const con = t.cubre ?? t.miembro;
      const dice = a.por !== a.quien ? `${n(a.por)} dice que ` : '';
      r.push({ id: `${t.semana}-${t.miembro}-${a.quien}-ay`, ts: a.ts, quien: a.por, texto: `${dice}${n(a.quien)} le echa una mano a ${n(con)} con el ${zona}${con === t.miembro ? '' : ` de ${X}`}.` });
    }
    for (const i of t.intentos) {
      // si lo limpió otro, la noticia es de quien lo limpió y se dice de quién era el piso
      const Q = n(i.quien);
      const suyo = i.quien === t.miembro;
      const elPiso = suyo ? `el ${zona}` : `el ${zona} de ${X}`;
      const elDe = suyo ? `el ${zona} de ${X}` : `el ${zona} que limpió ${Q}`;
      // si lo apuntó otro desde el cuadro («Ya lo ha limpiado Jose»), se dice quién
      const apunta = i.hecho.autor !== i.quien && !i.corregido ? ` Lo apunta ${n(i.hecho.autor)}.` : '';
      // la nota que se puso al marcarlo (Javi, 16 de noviembre) y, si se la cambió después, otra noticia
      const puesta = i.hecho.autor === i.quien && i.hecho.datos?.notaPropia !== undefined ? ` Se pone un ${nota(Number(i.hecho.datos.notaPropia))}.` : '';
      r.push({ id: `${i.hecho.id}-h`, ts: i.hecho.ts, quien: i.quien, texto: (i.n > 1 ? `${Q} ha repasado ${elPiso}.` : `${Q} ha terminado ${elPiso}.`) + apunta + puesta, fotos: i.hecho.datos?.fotos });
      if (i.propia && i.propia.ts !== i.hecho.ts) {
        r.push({ id: `${i.hecho.id}-pr`, ts: i.propia.ts, quien: i.quien, texto: `${Q} se cambia la nota: ahora un ${nota(i.propia.nota)} (${zona}${suyo ? '' : ` de ${X}`}).${i.propia.comentario ? ` «${i.propia.comentario}»` : ''}` });
      }
      if (i.corregido) {
        r.push({ id: `${t.semana}-${t.miembro}-${i.n}-hp`, ts: i.corregido.ts, quien: i.corregido.por, texto: `${n(i.corregido.por)} dice que el ${zona} de ${X} lo limpió ${Q}.` });
      }
      if (!i.resuelto) continue;
      const id = `${i.hecho.id}-r`;
      if (i.aprobado) {
        // nadie le puso pegas: se queda con su nota (o, si no se la puso, con la máxima)
        const texto = i.auto
          ? `Nadie le puso pegas al ${elDe.slice(3)}: se queda con un ${nota(i.media!)}.`
          : i.media === 10
            ? `${Q} saca un 10 en ${elPiso}. Quirófano.`
            : `${Q} aprueba ${elPiso} con un ${nota(i.media!)}.`;
        r.push({ id, ts: i.resueltoEn!, quien: i.quien, texto });
      } else {
        r.push({
          id,
          ts: i.resueltoEn!,
          quien: i.quien,
          oficial: true,
          texto: elegir(id, [
            `La Jamacasa comunica que ${Q} ha suspendido ${elPiso} con un ${nota(i.media!)}. Queda nombrado Chapuzas oficial hasta que lo repase.`,
            `Comunicado oficial: ${elDe} no pasa la inspección (${nota(i.media!)}). Se le espera con la fregona.`,
            `La Jamacasa informa de que ${elDe} se queda en un ${nota(i.media!)}. Toca repetir.`,
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
    // «Me la quedo yo», «Te la devuelvo» y pasársela a otro desde el cuadro
    for (const tr of s.tramos) {
      const c = tr.evento;
      if (!c) continue;
      const cuando = desdeAntes(tr) ? `desde el ${nombreDia(tr.desde)}` : 'de esta semana';
      const antes = responsableEn(s, tr.desde - 1); // quien la tenía justo antes
      const texto = c.autor === tr.quien
        ? `${n(tr.quien)} se queda la basura ${cuando}${tr.quien === s.tocaba ? '' : ` (le tocaba a ${n(s.tocaba)})`}.`
        : c.autor === antes
          ? tr.quien === s.tocaba ? `${n(c.autor)} le devuelve la basura a ${n(tr.quien)}.` : `${n(c.autor)} le pasa la basura a ${n(tr.quien)}.`
          : `${n(c.autor)} le pasa la basura de ${n(antes)} a ${n(tr.quien)}.`;
      r.push({ id: `${c.id}-bc`, ts: c.ts, quien: c.autor, texto });
    }
    // cuántas bolsas dice (Javi, 17 de noviembre: «no es lo mismo que haya una bolsa a que haya 6»)
    const bolsas = (p: Evento) => { const b = bolsasDe(p); return b ? ` (${b === 1 ? '1 bolsa' : `${b} bolsas`})` : ''; };
    for (const a of s.avisos) {
      a.pulsaciones.forEach((p, k) => {
        const yaAviso = a.pulsaciones.slice(0, k).some((x) => x.autor === p.autor);
        const texto = k === 0
          ? `${n(p.autor)} avisa de que la basura está llena${bolsas(p)}. Le toca a ${n(responsableEn(s, p.ts))}.`
          : yaAviso ? `${n(p.autor)} insiste: la basura sigue llena${bolsas(p)}.` : `${n(p.autor)} también avisa: ya son dos${bolsas(p)}.`;
        r.push({ id: `${p.id}-b`, ts: p.ts, quien: p.autor, texto, fotos: p.datos?.fotos });
      });
      if (a.estado === 'queja') {
        const id = `${a.id}-q`;
        const Y = n(a.responsable);
        r.push({
          id,
          ts: a.limite,
          quien: a.responsable,
          oficial: true,
          texto: elegir(id, [
            `La Jamacasa comunica que la basura de ${Y} lleva ${normas.horasBasura} horas esperando. Queja registrada: ${pt(normas.puntosQuejaBasura)}.`,
            `Comunicado oficial: la basura de ${Y} ha cumplido ${normas.horasBasura} horas sin salir de casa. ${pt(normas.puntosQuejaBasura)} puntos.`,
          ]),
        });
      }
    }
    // «Recuérdamelo»: quien la tiene dice que está llena
    for (const x of s.recordatorios) r.push({ id: `${x.id}-br`, ts: x.desde, quien: x.quien, texto: `${n(x.quien)} apunta que la basura está llena${bolsas(x.evento)}: la saca en un rato.`, fotos: x.evento.datos?.fotos });
    // quien la sacó (si lo apuntó otro desde el cuadro, «La ha sacado Jose», se dice quién) y, si lo apunta más tarde,
    // cuándo la sacó («¿Cuándo la sacaste?»)
    const apunta = (x: Evento) => (sacadaPor(x) !== x.autor ? ` Lo apunta ${n(x.autor)}.` : '');
    const ha = (x: Evento) => (apuntadaTarde(x) ? 'sacó la basura' : 'ha sacado la basura');
    const tarde = (x: Evento) => (apuntadaTarde(x) ? ` ${cuando(cuandoSacada(x), x.ts)} (lo apunta más tarde)` : '');
    for (const x of s.sacadas) r.push({ id: `${x.id}-s`, ts: x.ts, quien: sacadaPor(x), texto: `${n(sacadaPor(x))} ${ha(x)}${tarde(x)}.${apunta(x)}` });
    // «Esta la saqué yo»
    for (const x of s.ajenas) r.push({ id: `${x.id}-sa`, ts: x.ts, quien: sacadaPor(x), texto: `${n(sacadaPor(x))} ${ha(x)} de ${n(responsableEn(s, cuandoSacada(x)))}${tarde(x)}.${apunta(x)}` });
  }

  for (const a of tuyos) {
    const que = a.que ? `: «${a.que}»` : '';
    r.push({ id: `${a.id}-t`, ts: a.evento.ts, quien: a.de, texto: `${n(a.de)} ha encontrado algo de ${n(a.para)}${que}.`, fotos: a.fotos });
    if (a.recogidoEn) r.push({ id: `${a.id}-tr`, ts: a.recogidoEn, quien: a.para, texto: `${n(a.para)} ya ha recogido lo suyo.` });
    if (a.estado === 'multa') r.push({ id: `${a.id}-tm`, ts: a.limite, quien: a.para, oficial: true, texto: `La Jamacasa comunica que ${n(a.para)} no ha recogido lo suyo en ${normas.horasEstoEsTuyo} horas. ${pt(normas.puntosEstoEsTuyo)} punto.` });
  }

  for (const g of cuentas.gastos) {
    if (!g.evento || g.anulado) continue;
    // el súper de casa es de turno: se dice que lo ha comprado (cuenta en su marcador, no es deuda)
    const texto = esSuper(g) ? `${n(g.pagador)} ha comprado para casa: ${g.concepto.toLowerCase()}, ${euros(g.importe)}.` : `${n(g.pagador)} ha apuntado un gasto: ${g.concepto}, ${euros(g.importe)}.`;
    r.push({ id: `${g.id}-g`, ts: g.evento.ts, quien: g.pagador, texto });
  }
  // «Se ha acabado…» y «Ahora no puedo»
  for (const f of faltas) {
    const T = (m: MiembroId) => (m === f.pide ? 'a él mismo' : `a ${n(m)}`);
    r.push({ id: `${f.id}-fa`, ts: f.desde, quien: f.pide, texto: `${n(f.pide)} avisa: se ha acabado ${f.cosa.toLowerCase()}. Le toca comprarlo ${T(f.pasaron[0] ?? f.toca)}.` });
    if (f.pasaron.length) r.push({ id: `${f.id}-fp`, ts: f.tocaDesde, quien: f.pasaron[f.pasaron.length - 1], texto: `${n(f.pasaron[f.pasaron.length - 1])} ahora no puede comprar ${f.cosa.toLowerCase()}: le toca a ${n(f.toca)}.` });
  }
  for (const p of cuentas.pagos) {
    if (p.anulado) continue;
    const extra = p.alquiler ? ` (alquiler de ${nombreMes(p.alquiler)})` : '';
    r.push({ id: `${p.id}-p`, ts: p.evento.ts, quien: p.de, texto: `${n(p.de)} le ha pagado ${euros(p.importe)} a ${n(p.a)}${extra}.` });
  }

  return r.sort((a, b) => b.ts - a.ts);
}
