import { semanaInicial, zonaDe } from './calendario';
import { HORA, diaLocal, finSemana, inicioDia, lunesDe, mesDeSemana, semana } from './tiempo';
import type { Config, DatosPuntuacion, Evento, MiembroId, Normas, Zona } from './tipos';

export interface Voto {
  evento: string;
  autor: MiembroId;
  nota: number;
  faltan: string[];
  fotos: string[];
  comentario?: string;
  ts: number;
  primero: boolean; // primer voto de ese juez en este intento (da el punto por revisar)
}

export interface Intento {
  n: number;
  hecho: Evento;
  /** Quién lo limpió: el dueño del piso o el que lo hizo por él («Lo limpio yo»). Se lleva la nota (o el suspenso) y
   *  le ponen nota los otros dos (el dueño también, si lo limpió otro). */
  quien: MiembroId;
  /** Los que le echaron una mano («Le echo una mano», Javi, 14 de noviembre): +2 cada uno si se aprueba; no ponen nota */
  ayudaron: MiembroId[];
  /** Si alguien dijo después quién lo limpió de verdad («Lo limpió Jose»: Javi, 14 de noviembre, el piso del medio lo
   *  marcó Josu pero lo había limpiado Jose): quién lo dijo y cuándo */
  corregido?: { por: MiembroId; ts: number };
  jueces: MiembroId[];
  fin: number; // cuándo se cierra el plazo para puntuar
  votos: Voto[]; // el voto que cuenta de cada juez
  sinVotar: MiembroId[]; // jueces que no han votado (o no votaron a tiempo)
  resuelto: boolean;
  resueltoEn?: number;
  media?: number;
  auto?: boolean; // nadie votó: aprobado con la nota automática
  aprobado?: boolean;
}

export type EstadoTarea = 'pendiente' | 'esperando' | 'aprobada' | 'suspendida';

export interface Tarea {
  semana: number;
  miembro: MiembroId;
  zona: Zona;
  intentos: Intento[];
  estado: EstadoTarea;
  primerHecho?: number;
  empezada?: number; // cuándo le dio a «Empezar a limpiar» (la primera vez)
  /** Alguien se encarga de su piso esta semana («Lo limpio yo», Javi, 14 de noviembre: Josu no estaba y su piso lo
   *  hizo Jose). El piso sigue siendo del dueño (si nadie lo hace, el retraso y el «sin hacer» son suyos), pero la
   *  lista la marca quien lo limpia y la nota es para él. */
  cubre?: MiembroId;
  cubiertaEn?: number;
  /** Quién lo dijo: el propio `cubre` («Lo limpio yo») u otro desde el cuadro («Lo limpia Jose», Javi, 14 de noviembre:
   *  «coger a un personaje y moverlo al piso que quiera») */
  cubiertaPor?: MiembroId;
  /** Los que le echan una mano ahora (con su piso o con el de quien se encarga): marcan su lista y no ponen nota */
  ayudan: MiembroId[];
  /** Cuándo se puso cada uno a echar una mano y quién lo dijo (él mismo u otro desde el cuadro) */
  ayudas: { quien: MiembroId; ts: number; por: MiembroId }[];
  lista: string[]; // lo que se limpia en su piso (lo de siempre y, si le toca, lo que solo entra a veces)
  marcadas: string[]; // lo que ya ha marcado de la lista en esta vuelta (si se suspende, se empieza de cero)
  retrasoDias: number; // días de retraso hasta que se marcó (o hasta ahora)
  enCurso: boolean; // la semana aún no ha terminado
  limiteSinHacer: number;
  sinHacer: boolean;
  nota?: number; // nota con la que se aprobó
}

export const redondear1 = (x: number) => Math.round(x * 10) / 10;

export function calcularTareas(config: Config, normas: Normas, eventos: Evento[], ahora: number): Tarea[] {
  const s = semanaInicial(config);
  const wAhora = semana(ahora);
  const hechos = new Map<string, Evento[]>();
  const votos = new Map<string, Evento[]>();
  const empezadas = new Map<string, number>();
  const cosas = new Map<string, Evento[]>();
  const cubiertas = new Map<string, Evento[]>();
  const ayudas = new Map<string, Evento[]>();
  const correcciones = new Map<string, Evento[]>();
  const esMiembro = (m: unknown): m is MiembroId => typeof m === 'string' && config.miembros.some((x) => x.id === m);
  const anadir = (mapa: Map<string, Evento[]>, k: string, e: Evento) => (mapa.get(k) ?? mapa.set(k, []).get(k)!).push(e);
  // a quién se refiere: a quien lo apunta o, si lleva `quien`, a ese (desde el cuadro se puede poner a cualquiera:
  // «Lo limpia Jose», «Josu le echa una mano», «Ya lo ha limpiado Jose»; Javi, 14 de noviembre)
  const actor = (e: Evento): MiembroId => (esMiembro(e.datos?.quien) ? e.datos.quien : e.autor);
  for (const e of eventos) {
    if (e.tipo === 'zona_cosa') {
      anadir(cosas, `${e.datos?.semana}|${duenoDe(e, esMiembro)}`, e);
    } else if (e.tipo === 'zona_empezada') {
      const k = `${e.datos?.semana}|${e.autor}`;
      if (!empezadas.has(k) || e.ts < empezadas.get(k)!) empezadas.set(k, e.ts);
    } else if (e.tipo === 'zona_hecha') {
      anadir(hechos, `${e.datos?.semana}|${duenoDe(e, esMiembro)}`, e);
    } else if (e.tipo === 'zona_cubierta') {
      // «Lo limpio yo» en el piso de otro (o, con `deja`, «Ya no lo limpio yo»); con `quien`, por otro
      if (esMiembro(e.datos?.de) && e.datos.de !== actor(e)) anadir(cubiertas, `${e.datos?.semana}|${e.datos.de}`, e);
    } else if (e.tipo === 'zona_hecha_por') {
      // «Lo limpió Jose»: quién limpió de verdad lo que se marcó como hecho (nadie puede ponérselo a sí mismo)
      if (esMiembro(e.datos?.de) && esMiembro(e.datos?.quien) && e.datos.quien !== e.autor) anadir(correcciones, `${e.datos?.semana}|${e.datos.de}|${Number(e.datos?.intento)}`, e);
    } else if (e.tipo === 'zona_ayuda') {
      // «Le echo una mano» en el piso de otro (o, con `deja`, «Ya no ayudo»); con `quien`, por otro
      if (esMiembro(e.datos?.de) && e.datos.de !== actor(e)) anadir(ayudas, `${e.datos?.semana}|${e.datos.de}`, e);
    } else if (e.tipo === 'puntuacion') {
      const d = e.datos as DatosPuntuacion;
      const k = `${d.semana}|${d.de}|${d.intento}`;
      (votos.get(k) ?? votos.set(k, []).get(k)!).push(e);
    }
  }

  const tareas: Tarea[] = [];
  for (let w = s; w <= wAhora; w++) {
    for (const m of config.miembros) {
      const zona = zonaDe(config, w, m.id);
      if (!zona) continue;
      const lista = (hechos.get(`${w}|${m.id}`) ?? []).slice().sort((a, b) => a.ts - b.ts);
      // quién echa una mano en cada momento (el último «Le echo una mano» o «Ya no ayudo» de cada uno)
      const delPiso = (ayudas.get(`${w}|${m.id}`) ?? []).slice().sort((a, b) => a.ts - b.ts);
      const ayudanEn = (ts: number) => {
        const r = new Map<MiembroId, boolean>();
        for (const a of delPiso) if (a.ts <= ts) r.set(actor(a), !a.datos?.deja);
        return [...r.entries()].filter(([, si]) => si).map(([x]) => x);
      };
      const intentos: Intento[] = [];
      for (const h of lista) {
        const ult = intentos[intentos.length - 1];
        if (ult) {
          if (!ult.resuelto || ult.aprobado) continue;
          if (h.ts <= ult.resueltoEn!) continue;
        }
        // quién lo limpió: quien lo marcó (o a quien puso: «Ya lo ha limpiado Jose»), salvo que alguien diga después
        // que fue otro (vale lo último que se diga)
        const n = intentos.length + 1;
        let quien = actor(h);
        let corregido: { por: MiembroId; ts: number } | undefined;
        for (const c of (correcciones.get(`${w}|${m.id}|${n}`) ?? []).slice().sort((a, b) => a.ts - b.ts)) {
          if (c.ts < h.ts) continue;
          quien = c.datos.quien;
          corregido = { por: c.autor, ts: c.ts };
        }
        // le ponen nota los que no lo han limpiado: ni quien lo limpió ni los que le echaron una mano (si lo limpió
        // otro, también el dueño)
        const ayudaron = ayudanEn(h.ts).filter((x) => x !== quien && x !== m.id);
        const jueces = config.miembros.filter((x) => x.id !== quien && !ayudaron.includes(x.id)).map((x) => x.id);
        const intento = resolverIntento(h, n, quien, ayudaron, jueces, votos.get(`${w}|${m.id}|${n}`) ?? [], normas, ahora);
        if (corregido) intento.corregido = corregido;
        intentos.push(intento);
      }

      // quién se encarga de su piso esta semana: el último que dijo «Lo limpio yo» (o al que pusieron: «Lo limpia
      // Jose»), si no lo ha dejado después
      let cubre: MiembroId | undefined;
      let cubiertaEn: number | undefined;
      let cubiertaPor: MiembroId | undefined;
      for (const c of (cubiertas.get(`${w}|${m.id}`) ?? []).slice().sort((a, b) => a.ts - b.ts)) {
        const q = actor(c);
        if (c.datos?.deja) {
          if (q === cubre) { cubre = undefined; cubiertaEn = undefined; cubiertaPor = undefined; }
        } else if (q !== cubre) {
          cubre = q;
          cubiertaEn = c.ts;
          cubiertaPor = c.autor;
        }
      }

      const fin = finSemana(w);
      const lunesSig = lunesDe(w + 1);
      const primerHecho = intentos[0]?.hecho.ts;
      let retrasoDias = 0;
      if (primerHecho !== undefined) {
        if (primerHecho > fin) retrasoDias = diaLocal(primerHecho) - lunesSig + 1;
      } else if (ahora > fin) {
        retrasoDias = diaLocal(ahora) - lunesSig + 1;
      }
      const limiteSinHacer = inicioDia(lunesSig + normas.diasGracia) - 1;
      const sinHacer = ahora > limiteSinHacer && (primerHecho === undefined || primerHecho > limiteSinHacer);

      const ult = intentos[intentos.length - 1];
      let estado: EstadoTarea = 'pendiente';
      if (ult) estado = !ult.resuelto ? 'esperando' : ult.aprobado ? 'aprobada' : 'suspendida';
      const deLaLista = listaDe(zona, m.id);

      tareas.push({
        semana: w,
        miembro: m.id,
        zona,
        intentos,
        estado,
        primerHecho,
        empezada: empezadas.get(`${w}|${m.id}`),
        cubre,
        cubiertaEn,
        cubiertaPor,
        // los que ayudan ahora (si ya está hecho, los que ayudaron)
        ayudan: estado === 'pendiente' || estado === 'suspendida' ? ayudanEn(ahora).filter((x) => x !== cubre) : (ult?.ayudaron ?? []),
        ayudas: unidos(delPiso, actor).filter((x) => x.quien !== cubre),
        lista: deLaLista,
        marcadas: marcadasDe(cosas.get(`${w}|${m.id}`) ?? [], deLaLista, intentos, estado),
        retrasoDias,
        enCurso: ahora <= fin,
        limiteSinHacer,
        sinHacer,
        nota: estado === 'aprobada' ? ult!.media : undefined,
      });
    }
  }
  return tareas;
}

/** Los que siguen echando una mano, desde cuándo y quién lo dijo (su último «Le echo una mano» sin un «Ya no ayudo»
 *  después). */
function unidos(evs: Evento[], actor: (e: Evento) => MiembroId): { quien: MiembroId; ts: number; por: MiembroId }[] {
  const r = new Map<MiembroId, { ts: number; por: MiembroId }>();
  for (const a of evs) {
    const q = actor(a);
    if (a.datos?.deja) r.delete(q);
    else if (!r.has(q)) r.set(q, { ts: a.ts, por: a.autor });
  }
  return [...r.entries()].map(([quien, x]) => ({ quien, ...x }));
}

/** De quién es el piso de un evento de limpieza: el suyo o, si lleva `de` (lo hace por otro), el de ese otro. */
function duenoDe(e: Evento, esMiembro: (m: unknown) => m is MiembroId): MiembroId {
  const de = e.datos?.de;
  return esMiembro(de) ? de : e.autor;
}

/** Quién lo ha limpiado (el último intento): el dueño o quien lo hizo por él. */
export function limpiadoPor(t: Tarea): MiembroId | undefined {
  return t.intentos[t.intentos.length - 1]?.quien;
}

/** ¿Lo limpió (o lo intentó) otro que no es el dueño? */
export function lohizoOtro(t: Tarea): boolean {
  return t.intentos.some((i) => i.quien !== t.miembro);
}

/** Alguien está con él: lo ha empezado su dueño, se encarga otro o ya hay cosas marcadas de la lista. */
export function enMarcha(t: Tarea): boolean {
  return t.empezada !== undefined || t.cubre !== undefined || t.marcadas.length > 0;
}

/** Lo que se limpia en un piso para quien le toca: la lista de siempre y lo que solo entra si le toca a él
 *  (el pasillo de las habitaciones de arriba). */
export function listaDe(zona: Zona, m: MiembroId): string[] {
  return [...zona.checklist, ...(zona.extras ?? []).filter((x) => x.para.includes(m)).map((x) => x.nombre)];
}

/** Lo marcado de la lista («zona_cosa»: { semana, cosa, hecha }; vale lo último de cada cosa). Cuenta lo de esta
 *  vuelta: si el piso se suspendió, lo de antes ya no vale y se empieza de cero; si ya está marcado como hecho, lo
 *  que se marcó hasta entonces. */
function marcadasDe(evs: Evento[], lista: string[], intentos: Intento[], estado: EstadoTarea): string[] {
  if (!evs.length) return [];
  const ult = intentos[intentos.length - 1];
  const penult = intentos[intentos.length - 2];
  let desde = -Infinity, hasta = Infinity;
  if (estado === 'suspendida') desde = ult.resueltoEn ?? ult.hecho.ts;
  else if (ult) { hasta = ult.hecho.ts; if (penult) desde = penult.resueltoEn ?? penult.hecho.ts; }
  const ultimo = new Map<string, boolean>();
  for (const e of evs.slice().sort((a, b) => a.ts - b.ts)) {
    if (e.ts <= desde || e.ts > hasta) continue;
    ultimo.set(String(e.datos?.cosa ?? ''), e.datos?.hecha !== false);
  }
  return lista.filter((c) => ultimo.get(c));
}

/** Cuánto lleva de la lista: { hechas, total }. */
export function progreso(t: Tarea): { hechas: number; total: number } {
  return { hechas: t.marcadas.length, total: t.lista.length };
}

function resolverIntento(h: Evento, n: number, quien: MiembroId, ayudaron: MiembroId[], jueces: MiembroId[], votosEv: Evento[], normas: Normas, ahora: number): Intento {
  const fin = h.ts + normas.horasRevision * HORA;
  const validos = votosEv
    .filter((v) => jueces.includes(v.autor) && v.ts >= h.ts && v.ts <= fin)
    .sort((a, b) => a.ts - b.ts);

  // Momento en que votó el último juez por primera vez
  const primerVoto = new Map<MiembroId, number>();
  for (const v of validos) if (!primerVoto.has(v.autor)) primerVoto.set(v.autor, v.ts);
  const completos = jueces.every((j) => primerVoto.has(j));

  let resueltoEn: number | undefined;
  if (!jueces.length) resueltoEn = h.ts; // lo limpiasteis los tres: no queda nadie para poner nota (va la automática)
  else if (completos) resueltoEn = Math.max(...jueces.map((j) => primerVoto.get(j)!));
  else if (ahora >= fin) resueltoEn = fin;

  const corte = resueltoEn ?? Infinity;
  const ultimo = new Map<MiembroId, Evento>();
  const primeros = new Set<string>();
  for (const v of validos) {
    if (v.ts > corte) continue;
    if (!ultimo.has(v.autor)) primeros.add(v.id);
    ultimo.set(v.autor, v);
  }
  const vs: Voto[] = [...ultimo.values()].map((v) => {
    const d = v.datos as DatosPuntuacion;
    return {
      evento: v.id,
      autor: v.autor,
      nota: Math.max(0, Math.min(10, Number(d.nota) || 0)),
      faltan: d.faltan ?? [],
      fotos: d.fotos ?? [],
      comentario: d.comentario,
      ts: v.ts,
      primero: true,
    };
  });
  // Marca si el voto que cuenta fue también el primero (el punto por revisar va al primero)
  for (const v of vs) v.primero = primeros.has(v.evento);

  const sinVotar = jueces.filter((j) => !ultimo.has(j));
  const intento: Intento = { n, hecho: h, quien, ayudaron, jueces, fin, votos: vs, sinVotar, resuelto: resueltoEn !== undefined, resueltoEn };
  if (intento.resuelto) {
    if (vs.length > 0) {
      intento.media = redondear1(vs.reduce((a, v) => a + v.nota, 0) / vs.length);
    } else {
      intento.media = normas.notaAutomatica;
      intento.auto = true;
    }
    intento.aprobado = intento.media >= normas.notaMinima;
  }
  return intento;
}

/** Intentos abiertos que un miembro tiene que puntuar. */
export function porPuntuar(tareas: Tarea[], m: MiembroId): { tarea: Tarea; intento: Intento }[] {
  const r: { tarea: Tarea; intento: Intento }[] = [];
  for (const t of tareas) {
    // los jueces son los que no lo han limpiado: si tu piso lo limpió otro, también te toca ponerle nota
    const i = t.intentos[t.intentos.length - 1];
    if (i && !i.resuelto && i.sinVotar.includes(m)) r.push({ tarea: t, intento: i });
  }
  return r.sort((a, b) => a.intento.fin - b.intento.fin);
}

export function mesDeTarea(t: Tarea): string {
  return mesDeSemana(t.semana);
}
