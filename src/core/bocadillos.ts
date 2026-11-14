// La pantalla de Limpieza (la D, la «pantalla de juego» que eligió Javi el 10 de noviembre): lo que dice cada uno en
// su bocadillo encima del muñeco, la marca de su cara arriba, la frase de debajo de la semana y la ficha que sale al
// tocar la cara de otro. Reglas puras: la pantalla solo lo pinta.
import { diasSinLimpiar, pisoDe } from './escena';
import { tareaDe, type Estado } from './estado';
import { enMarcha, progreso, type Tarea } from './limpieza';
import { nota } from './noticias';
import { cuando, nombreDia } from './tiempo';
import type { Config, MiembroId } from './tipos';

/** Color del bocadillo: el tuyo (naranja), de otro (blanco), aprobado (verde), suspenso o tarde (rojo), esperando (oro). */
export type Tono = 'yo' | 'blanco' | 'verde' | 'rojo' | 'oro';
/** Qué pasa al tocarlo: empezar a limpiar, abrir tu lista, ponerle nota o ver su piso. */
export type QueHace = 'empezar' | 'lista' | 'puntuar' | 'tarea';

export interface Bocadillo {
  miembro: MiembroId;
  titulo: string;
  sub?: string;
  tono: Tono;
  accion?: QueHace;
}

/** La marca de la cara: te toca (!), limpiando (…), esperando nota (★), aprobado (✓), suspenso (✕) o va tarde (⏰). */
export interface Marca {
  marca: '!' | '…' | '★' | '✓' | '✕' | '⏰' | '';
  tono: 'naranja' | 'oro' | 'verde' | 'rojo' | '';
}

export interface Ficha {
  miembro: MiembroId;
  titulo: string;
  texto: string;
  boton?: { texto: string; accion: QueHace };
  nota?: number;
  suspensa?: boolean;
  /** Está sin hacer y nadie se encarga: puedes limpiarlo tú («Lo limpio yo») */
  cubrir?: boolean;
}

const nombre = (config: Config, m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? m;
const y = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
const limpiando = (t: Tarea) => (t.estado === 'pendiente' && enMarcha(t)) || (t.estado === 'suspendida' && t.marcadas.length > 0);
const llevaHechas = (t: Tarea) => {
  const { hechas, total } = progreso(t);
  return total ? `${hechas} de ${total} hechas` : undefined;
};
const sinLimpiar = (e: Estado, t: Tarea) => {
  const piso = pisoDe(t.zona);
  return piso ? diasSinLimpiar(e, piso) : 0;
};

/** El bocadillo de cada uno esta semana (o nada si no hay que decir nada). */
export function bocadilloDe(config: Config, e: Estado, m: MiembroId, yo: MiembroId): Bocadillo | null {
  const t = tareaDe(e, e.semana, m);
  if (!t) return null;
  const mio = m === yo;
  const ult = t.intentos[t.intentos.length - 1];
  // su piso lo limpia otro («Lo limpio yo»): se dice quién, y quien lo limpia lo toca para abrir la lista
  if (t.cubre !== undefined && limpiando(t)) {
    if (t.cubre === yo) return { miembro: m, titulo: 'Lo limpias tú…', sub: llevaHechas(t), tono: 'yo', accion: 'lista' };
    return { miembro: m, titulo: `Lo limpia ${nombre(config, t.cubre)}…`, sub: llevaHechas(t), tono: mio ? 'yo' : 'blanco', accion: 'tarea' };
  }
  if (limpiando(t)) return { miembro: m, titulo: t.estado === 'suspendida' ? 'Repasando…' : 'Limpiando…', sub: llevaHechas(t), tono: mio ? 'yo' : 'blanco', accion: mio ? 'lista' : 'tarea' };
  // lo limpió otro: lo que se espera (o la nota) es suyo
  if (ult && ult.quien !== m) {
    const q = ult.quien === yo ? 'tú' : nombre(config, ult.quien);
    const lo = ult.quien === yo ? 'Lo limpiaste tú' : `Lo limpió ${q}`;
    if (t.estado === 'esperando') {
      const faltan = ult.sinVotar;
      if (ult.quien === yo) return { miembro: m, titulo: 'Esperando nota ★', sub: faltan.length ? `De ${y(faltan.map((j) => nombre(config, j)))}` : undefined, tono: 'yo', accion: 'tarea' };
      if (faltan.includes(yo)) return { miembro: m, titulo: `${q} espera tu nota ★`, sub: mio ? 'Ha limpiado tu piso' : undefined, tono: 'blanco', accion: 'puntuar' };
      return { miembro: m, titulo: 'Esperando nota', sub: lo, tono: 'blanco', accion: 'tarea' };
    }
    if (t.estado === 'aprobada') return { miembro: m, titulo: `Aprobado ✓ ${nota(t.nota!)}`, sub: lo, tono: 'verde', accion: 'tarea' };
    if (t.estado === 'suspendida') {
      return ult.quien === yo || mio
        ? { miembro: m, titulo: 'Suspenso: a repasar', sub: `Nota ${nota(ult.media!)} · ${lo.toLowerCase()}`, tono: 'rojo', accion: 'lista' }
        : { miembro: m, titulo: `Suspenso ${nota(ult.media!)}`, sub: lo, tono: 'rojo', accion: 'tarea' };
    }
  }
  switch (t.estado) {
    case 'pendiente': {
      if (!t.enCurso) {
        return mio
          ? { miembro: m, titulo: '▶ Ponte con ello', sub: `Vas ${dias(t.retrasoDias)} tarde`, tono: 'rojo', accion: 'empezar' }
          : { miembro: m, titulo: `${nombre(config, m)} va tarde`, sub: dias(t.retrasoDias), tono: 'rojo', accion: 'tarea' };
      }
      if (!mio) return null;
      const d = sinLimpiar(e, t);
      return { miembro: m, titulo: '▶ Empezar a limpiar', sub: d > 0 ? `Lleva ${dias(d)} sin limpiar` : 'Esta semana te toca', tono: 'yo', accion: 'empezar' };
    }
    case 'esperando': {
      const faltan = ult.sinVotar;
      if (mio) return { miembro: m, titulo: 'Esperando nota ★', sub: faltan.length ? `De ${y(faltan.map((j) => nombre(config, j)))}` : undefined, tono: 'yo', accion: 'tarea' };
      if (faltan.includes(yo)) return { miembro: m, titulo: `${nombre(config, m)} espera tu nota ★`, tono: 'blanco', accion: 'puntuar' };
      return { miembro: m, titulo: 'Esperando nota', sub: faltan.length ? `De ${y(faltan.map((j) => nombre(config, j)))}` : undefined, tono: 'blanco', accion: 'tarea' };
    }
    case 'aprobada':
      return { miembro: m, titulo: `Aprobado ✓ ${nota(t.nota!)}`, tono: 'verde', accion: 'tarea' };
    case 'suspendida':
      return mio
        ? { miembro: m, titulo: 'Suspenso: a repasar', sub: `Nota ${nota(ult.media!)}`, tono: 'rojo', accion: 'lista' }
        : { miembro: m, titulo: `Suspenso ${nota(ult.media!)}`, sub: 'Tiene que repasarlo', tono: 'rojo', accion: 'tarea' };
  }
}

export function bocadillos(config: Config, e: Estado, yo: MiembroId): Bocadillo[] {
  return config.miembros.map((m) => bocadilloDe(config, e, m.id, yo)).filter((b): b is Bocadillo => b !== null);
}

/** La marca de la cara de cada uno, arriba. */
export function marcaDe(e: Estado, m: MiembroId, yo: MiembroId): Marca {
  const t = tareaDe(e, e.semana, m);
  if (!t) return { marca: '', tono: '' };
  if (limpiando(t)) return { marca: '…', tono: 'oro' };
  if (t.estado === 'esperando') return { marca: '★', tono: 'oro' };
  if (t.estado === 'aprobada') return { marca: '✓', tono: 'verde' };
  if (t.estado === 'suspendida') return { marca: '✕', tono: 'rojo' };
  if (!t.enCurso) return { marca: '⏰', tono: 'rojo' };
  return m === yo ? { marca: '!', tono: 'naranja' } : { marca: '', tono: '' };
}

/** La frase de debajo de la semana: cómo vas tú (y, si te encargas del piso de otro, el suyo). */
export function resumenDe(e: Estado, yo: MiembroId, config?: Config): string {
  const t = tareaDe(e, e.semana, yo);
  const n = (m: MiembroId) => (config ? nombre(config, m) : m);
  const otro = e.tareas.find((x) => x.semana === e.semana && x.cubre === yo && x.miembro !== yo && (x.estado === 'pendiente' || x.estado === 'suspendida'));
  if (otro && (!t || t.estado === 'esperando' || t.estado === 'aprobada')) return `Te queda el ${otro.zona.nombre.toLowerCase()} de ${n(otro.miembro)}`;
  if (!t) return 'Esta semana no te toca piso';
  const piso = t.zona.nombre.toLowerCase();
  if (t.cubre !== undefined && t.estado === 'pendiente') return `${n(t.cubre)} se encarga de tu piso`;
  if (otro) return `Te tocan el ${piso} y el de ${n(otro.miembro)}`;
  if (limpiando(t)) return t.estado === 'suspendida' ? `Repasando el ${piso}` : `Limpiando el ${piso}`;
  if (t.estado === 'pendiente') return t.enCurso ? `Te toca el ${piso}` : `Vas tarde con el ${piso}`;
  if (t.estado === 'esperando') return `${t.zona.nombre}: esperando nota`;
  if (t.estado === 'aprobada') return `${t.zona.nombre}: aprobado con un ${nota(t.nota!)}`;
  return `${t.zona.nombre}: toca repasarlo`;
}

/** La ficha de otro, al tocar su cara: su piso, cómo va y, si te toca, ponerle nota. */
export function fichaDe(config: Config, e: Estado, m: MiembroId, yo: MiembroId): Ficha | null {
  const t = tareaDe(e, e.semana, m);
  if (!t) return null;
  const ult = t.intentos[t.intentos.length - 1];
  const base = { miembro: m, titulo: m === yo ? 'Tú' : nombre(config, m) };
  const z = t.zona.nombre;
  // «lo limpia Jose» / «lo limpias tú» (y en pasado: «lo limpió Jose» / «lo limpiaste tú»)
  const limpia = (x: MiembroId) => (x === yo ? 'lo limpias tú' : `lo limpia ${nombre(config, x)}`);
  const limpio = (x: MiembroId) => (x === yo ? 'lo limpiaste tú' : `lo limpió ${nombre(config, x)}`);
  const haLimpiado = (x: MiembroId) => (x === yo ? 'lo has limpiado tú' : `lo ha limpiado ${nombre(config, x)}`);
  // se puede hacer por él si está sin hacer (o suspendido) y nadie se encarga todavía
  const cubrir = m !== yo && t.cubre === undefined && (t.estado === 'pendiente' || t.estado === 'suspendida') ? { cubrir: true } : {};
  if (t.cubre !== undefined && limpiando(t)) {
    const lleva = llevaHechas(t);
    return { ...base, texto: `${z} · ${limpia(t.cubre)}${lleva ? `: ${lleva}` : ''}` };
  }
  if (ult && ult.quien !== m && t.estado === 'esperando') {
    const hecho = `${haLimpiado(ult.quien)} ${cuando(ult.hecho.ts, e.ahora)}`;
    if (ult.sinVotar.includes(yo)) return { ...base, texto: `${z} · ${hecho}`, boton: { texto: 'Ponle nota ★', accion: 'puntuar' } };
    const faltan = ult.sinVotar.filter((j) => j !== yo).map((j) => nombre(config, j));
    return { ...base, texto: `${z} · ${hecho}${faltan.length ? `; falta la nota de ${y(faltan)}` : ''}` };
  }
  if (limpiando(t)) {
    // aunque lo haya empezado, si no está (Josu, 11 de noviembre: lo empezó y se fue), otro puede acabarlo por él
    const lleva = llevaHechas(t);
    return { ...base, ...cubrir, texto: `${z} · ${t.estado === 'suspendida' ? 'repasando' : 'limpiando'}${lleva ? `: ${lleva}` : ''}` };
  }
  switch (t.estado) {
    case 'pendiente': {
      const d = sinLimpiar(e, t);
      if (!t.enCurso) return { ...base, ...cubrir, texto: `${z} · va ${dias(t.retrasoDias)} tarde` };
      return { ...base, ...cubrir, texto: `${z} · sin empezar${d > 0 ? `, ${dias(d)} sin limpiar` : ''}` };
    }
    case 'esperando': {
      const hecho = `lo ha limpiado ${cuando(ult.hecho.ts, e.ahora)}`;
      if (m !== yo && ult.sinVotar.includes(yo)) return { ...base, texto: `${z} · ${hecho}`, boton: { texto: 'Ponle nota ★', accion: 'puntuar' } };
      const faltan = ult.sinVotar.filter((j) => j !== yo).map((j) => nombre(config, j));
      return { ...base, texto: `${z} · ${hecho}${faltan.length ? `; falta la nota de ${y(faltan)}` : ''}` };
    }
    case 'aprobada': {
      const lo = ult.quien !== m ? ` (${limpio(ult.quien)})` : '';
      return { ...base, texto: `${z} · aprobado el ${nombreDia(ult.resueltoEn ?? ult.hecho.ts)}${lo}`, nota: t.nota };
    }
    case 'suspendida':
      return { ...base, ...cubrir, texto: `${z} · suspenso: tiene que repasarlo`, nota: ult.media, suspensa: true };
  }
}
