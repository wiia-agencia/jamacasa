// Hoy (la E2, la que eligió Javi el 19 de noviembre): arriba, una frase con lo que importa hoy y, dentro, cristales que
// se tocan («Josu», «piso de abajo», «basura», «2,14 €»); al tocar uno se abre su baldosa de «Para ti». Debajo, los
// pisos en tarjetas, una al lado de otra (se pasan con el dedo). Reglas puras: la pantalla solo lo pinta.
import { cuandoSacada, sacadaPor } from './basura';
import { abierta } from './compras';
import { euros } from './cuentas';
import { diasSinLimpiar, pisoDe } from './escena';
import { atrasadas, basuraAhora, paraPuntuar, tareaDe, tuyosAbiertos, type Estado } from './estado';
import { elDia, fueraDe, rangoFuera } from './fuera';
import { enMarcha, progreso, type Intento, type Tarea } from './limpieza';
import { nota } from './noticias';
import { diaLocal, duracion, fechaCorta, finSemana, hora, nombreDia, partes } from './tiempo';
import type { Config, MiembroId, Zona } from './tipos';

export type IconoHoy = 'estrella' | 'chispas' | 'basura' | 'cartera' | 'carro' | 'calcetin' | 'reloj' | 'avion';
/** El color del redondel del icono (y de la bola del cristal): el tuyo, el de una persona (`p:id`) o el de la cosa. */
export type ColorHoy = 'tuyo' | 'verde' | 'ambar' | 'rojo' | 'oro' | 'rosa' | 'azul' | `p:${string}`;

/** Lo que hace un botón (o una tarjeta) al tocarlo: la pantalla lo traduce a sus hojas y acciones. */
export type AccionHoy =
  | { tipo: 'puntuar'; semana: number; de: MiembroId; intento: number; propia?: boolean }
  | { tipo: 'empezar'; semana: number }
  | { tipo: 'lista'; de: MiembroId } // la lista de ese piso, en Limpieza
  | { tipo: 'hecho'; semana: number; de: MiembroId } // «Ya está limpio»
  | { tipo: 'tarea'; semana: number; de: MiembroId } // la hoja de su piso
  | { tipo: 'ponerme'; de: MiembroId } // echar una mano, limpiarlo… (la hoja del cuadro)
  | { tipo: 'hoja'; hoja: 'basura' | 'sacada' | 'fuera' | 'extra' | 'tuyo' | 'falta' | 'saldar' }
  | { tipo: 'recogido'; aviso: string }
  | { tipo: 'comprado'; falta: string }
  | { tipo: 'pasar'; falta: string } // «Ahora no puedo»
  | { tipo: 'pantalla'; pantalla: 'cuentas' | 'limpieza' | 'juego' };

export interface BotonHoy {
  texto: string;
  accion: AccionHoy;
  /** El color del botón: el tuyo, claro, oscuro (por defecto) o el de una persona o cosa */
  tono?: 'claro' | ColorHoy;
}

/** Una baldosa de «Para ti»: encendida (blanca) si te toca hacer algo; al tocarla (o su cristal) se abre con más. */
export interface Baldosa {
  clave: string;
  icono: IconoHoy;
  color: ColorHoy;
  titulo: string;
  sub: string;
  encendida: boolean;
  /** Lo que llevas de la lista de tu piso (el anillo) */
  cuenta?: { hechas: number; total: number };
  /** Al abrirse: una línea más y sus botones */
  linea?: string;
  foto?: string;
  botones: BotonHoy[];
}

/** Un trozo de la frase: texto, negrita o un cristal (que abre su baldosa). */
export type Trozo =
  | { t: 'texto'; texto: string }
  | { t: 'negrita'; texto: string }
  | { t: 'cristal'; texto: string; clave: string; icono: IconoHoy; color: ColorHoy };

/** Una tarjeta de los pisos: quién lo tiene, los días que lleva sin limpiar, cómo va y lo que puedes hacer. */
export interface TarjetaPiso {
  clave: string;
  miembro: MiembroId; // el dueño esta semana
  limpia: MiembroId; // quien lo limpia (el dueño o quien se encarga)
  zona: Zona;
  tuya: boolean;
  titulo: string;
  sub: string;
  dias: number;
  /** Lo limpio que está (de 1 recién limpio a casi 0 a la semana) */
  fresco: number;
  frase: Trozo[];
  salas: string[];
  boton?: BotonHoy;
  alTocar: AccionHoy;
}

// ——— Ayudas de texto ———

const t = (texto: string): Trozo => ({ t: 'texto', texto });
const b = (texto: string): Trozo => ({ t: 'negrita', texto });
const y = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
/** «le faltó 1 cosa» / «le faltaron 4 cosas» */
const falto = (n: number) => (n === 1 ? 'faltó 1 cosa' : `faltaron ${n} cosas`);
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nombreDe = (config: Config, m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? m;
const sinEuro = (cent: number) => euros(cent).replace(' €', '').replace(',00', '');
const limpiando = (x: Tarea) => (x.estado === 'pendiente' && enMarcha(x)) || (x.estado === 'suspendida' && x.marcadas.length > 0);

/** «Buenos días», «Buenas tardes» o «Buenas noches», con la hora de Madrid. */
export function saludo(ahora: number): string {
  const h = partes(ahora).h;
  if (h >= 6 && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

/** «hoy», «ayer», «el sábado» o «el 3 nov» (sin la hora). */
export function elDiaCorto(ms: number, ahora: number): string {
  const d = diaLocal(ahora) - diaLocal(ms);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d > 1 && d < 7) return `el ${nombreDia(ms)}`;
  return `el ${fechaCorta(diaLocal(ms))}`;
}

/** «hoy antes de las 18:57», «mañana antes de las 10:25» o «antes del sábado a las 10:25», con la hora en negrita. */
function antesDe(fin: number, ahora: number): Trozo[] {
  const d = diaLocal(fin) - diaLocal(ahora);
  if (d <= 0) return [t('hoy antes de las '), b(hora(fin))];
  if (d === 1) return [t('mañana antes de las '), b(hora(fin))];
  return [t(`antes del ${nombreDia(fin)} a las `), b(hora(fin))];
}

/** Los días que quedan de la semana: «quedan 3 días», «queda 1 día» u «hoy es el último día». */
export function quedanDias(semana: number, ahora: number): string {
  const n = diaLocal(finSemana(semana)) - diaLocal(ahora);
  if (n <= 0) return 'hoy es el último día';
  return n === 1 ? 'queda 1 día' : `quedan ${n} días`;
}

/** «Te quedan 3 días», «Te queda 1 día» u «Hoy es el último día». */
function teQuedan(semana: number, ahora: number): string {
  const q = quedanDias(semana, ahora);
  return q.startsWith('hoy') ? mayus(q) : `Te ${q}`;
}

/** Las estancias de un piso, de su «incluye»: «Cocina grande, salón, baño…» → ['Cocina grande', 'Salón', 'Baño', …]. */
export function salasDe(z: Zona): string[] {
  return z.incluye
    .split(/,\s*|\s+y\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(mayus);
}

/** «piso de abajo» (para la frase: el nombre del piso en minúscula). */
const enFrase = (z: Zona) => z.nombre.charAt(0).toLowerCase() + z.nombre.slice(1);

/** La última vez que se limpió un piso (lo último marcado que quedó aprobado o esperando nota). */
function ultimaLimpieza(e: Estado, z: Zona): { tarea: Tarea; intento: Intento } | null {
  const piso = pisoDe(z);
  let r: { tarea: Tarea; intento: Intento } | null = null;
  for (const x of e.tareas) {
    const mismo = piso ? pisoDe(x.zona) === piso : x.zona.id === z.id;
    if (!mismo || (x.estado !== 'aprobada' && x.estado !== 'esperando')) continue;
    const i = x.intentos[x.intentos.length - 1];
    if (i && (!r || i.hecho.ts > r.intento.hecho.ts)) r = { tarea: x, intento: i };
  }
  return r;
}

/** Tu piso de esta semana y, si te encargas del de otro («Lo limpio yo»), ese. */
function tusPisos(e: Estado, yo: MiembroId): Tarea[] {
  const tuyo = tareaDe(e, e.semana, yo);
  const otros = e.tareas.filter((x) => x.semana === e.semana && x.cubre === yo && x.miembro !== yo && (x.estado === 'pendiente' || x.estado === 'suspendida'));
  return [...(tuyo ? [tuyo] : []), ...otros];
}

// ——— «Para ti» ———

/** Las baldosas de «Para ti», por orden: lo de antes, las notas que te tocan, lo que es tuyo, tu piso, la basura, tus
 *  cuentas, el súper (si te toca) y si estás fuera. */
export function paraTi(config: Config, e: Estado, yo: MiembroId): Baldosa[] {
  const n = (m: MiembroId) => (m === yo ? 'tú' : nombreDe(config, m));
  const r: Baldosa[] = [];

  // Lo que te queda de semanas pasadas (sin hacer o suspendido)
  for (const x of atrasadas(e, yo).filter((a) => a.estado === 'pendiente' || a.estado === 'suspendida')) {
    r.push({
      clave: `antes:${x.semana}`,
      icono: 'reloj',
      color: 'rojo',
      titulo: 'Te queda de antes',
      sub: `${x.zona.nombre} · ${x.estado === 'suspendida' ? 'a repasar' : `${dias(x.retrasoDias)} tarde`}`,
      encendida: true,
      linea: x.sinHacer ? `Pasó el plazo: ${nota(e.normas.puntosSinHacer)} puntos. Sigue siendo tuyo hasta que se apruebe.` : 'Sigue siendo tuyo hasta que se apruebe.',
      botones: [{ texto: x.estado === 'suspendida' ? 'Ya lo he repasado' : 'Ya está limpio', accion: { tipo: 'hecho', semana: x.semana, de: x.miembro }, tono: 'tuyo' }],
    });
  }

  // Las notas que te tocan poner (a quien lo limpió)
  for (const { tarea, intento } of paraPuntuar(e, yo).sort((p, q) => p.intento.fin - q.intento.fin)) {
    const propia = intento.propia;
    const de = intento.quien !== tarea.miembro ? ` de ${nombreDe(config, tarea.miembro)}` : '';
    const dice = propia
      ? `Se puso un ${nota(propia.nota)}${propia.faltan.length ? ` y dice que le ${falto(propia.faltan.length)}` : ''}. Si no votas, cuenta su ${nota(propia.nota)}.`
      : `Si no votas, cuenta como un ${nota(e.normas.notaAutomatica)}.`;
    r.push({
      clave: `nota:${tarea.semana}:${tarea.miembro}:${intento.n}`,
      icono: 'estrella',
      color: `p:${intento.quien}`,
      titulo: `Nota de ${nombreDe(config, intento.quien)}`,
      sub: `Se cierra en ${duracion(intento.fin - e.ahora)}`,
      encendida: true,
      linea: `${tarea.zona.nombre}${de}. ${dice}`,
      botones: [{ texto: 'Puntuar', accion: { tipo: 'puntuar', semana: tarea.semana, de: tarea.miembro, intento: intento.n }, tono: `p:${intento.quien}` }],
    });
  }

  // «Esto es tuyo»: lo que te han pillado por ahí
  for (const a of tuyosAbiertos(e, yo)) {
    r.push({
      clave: `tuyo:${a.id}`,
      icono: 'calcetin',
      color: 'rosa',
      titulo: `${nombreDe(config, a.de)} dice que es tuyo`,
      sub: `Recógelo en ${duracion(a.limite - e.ahora)}`,
      encendida: true,
      linea: a.que ? `${mayus(a.que)}.` : undefined,
      foto: a.fotos[0],
      botones: [{ texto: 'Ya lo recogí', accion: { tipo: 'recogido', aviso: a.id }, tono: 'rosa' }],
    });
  }

  // Tu piso (y el de otro, si te encargas tú)
  for (const x of tusPisos(e, yo)) r.push(baldosaPiso(config, e, x, yo));

  // La basura
  r.push(baldosaBasura(config, e, yo));

  // Tus cuentas
  const saldo = e.cuentas.saldo[yo] ?? 0;
  const debo = e.cuentas.transferencias.filter((x) => x.de === yo);
  const meDeben = e.cuentas.transferencias.filter((x) => x.a === yo);
  if (saldo < 0) {
    r.push({
      clave: 'cuentas', icono: 'cartera', color: 'rojo', encendida: false,
      titulo: `Debes ${euros(-saldo)}`,
      sub: debo.map((x) => `${sinEuro(x.importe)} a ${n(x.a)}`).join(' · '),
      linea: `${mayus(y(debo.map((x) => `${euros(x.importe)} a ${n(x.a)}`)))}.`,
      botones: [{ texto: 'Pagar', accion: { tipo: 'hoja', hoja: 'saldar' }, tono: 'rojo' }, { texto: 'Ver cuentas', accion: { tipo: 'pantalla', pantalla: 'cuentas' }, tono: 'claro' }],
    });
  } else if (saldo > 0) {
    r.push({
      clave: 'cuentas', icono: 'cartera', color: 'verde', encendida: false,
      titulo: `Te deben ${euros(saldo)}`,
      sub: meDeben.map((x) => `${n(x.de)} ${sinEuro(x.importe)}`).join(' · '),
      linea: `${mayus(y(meDeben.map((x) => `${n(x.de)} te debe ${euros(x.importe)}`)))}.`,
      botones: [{ texto: 'Ver cuentas', accion: { tipo: 'pantalla', pantalla: 'cuentas' } }],
    });
  } else {
    r.push({
      clave: 'cuentas', icono: 'cartera', color: 'verde', encendida: false,
      titulo: 'Cuentas', sub: 'Todo saldado',
      botones: [{ texto: 'Ver cuentas', accion: { tipo: 'pantalla', pantalla: 'cuentas' } }],
    });
  }

  // El súper de casa: lo que hace falta y te toca comprar (o, si no falta nada, que la próxima es tuya)
  const mias = e.super.faltas.filter((f) => abierta(f) && f.toca === yo);
  if (mias.length) {
    const vieja = mias.reduce((p, q) => (q.desde < p.desde ? q : p));
    r.push({
      clave: 'super', icono: 'carro', color: 'oro', encendida: true,
      titulo: 'Te toca comprar',
      sub: mayus(y(mias.map((f) => f.cosa.toLowerCase()))),
      linea: `Lo pidió ${n(vieja.pide)} ${elDiaCorto(vieja.desde, e.ahora)}.`,
      botones: mias.length === 1
        ? [{ texto: 'Lo compré', accion: { tipo: 'comprado', falta: mias[0].id }, tono: 'verde' }, { texto: 'Ahora no puedo', accion: { tipo: 'pasar', falta: mias[0].id }, tono: 'claro' }]
        : [{ texto: 'Ver lo que falta', accion: { tipo: 'pantalla', pantalla: 'cuentas' } }],
    });
  } else if (e.super.toca === yo) {
    r.push({
      clave: 'super', icono: 'carro', color: 'oro', encendida: false,
      titulo: 'Súper de casa', sub: 'Te toca la próxima compra',
      botones: [{ texto: 'Se ha acabado algo', accion: { tipo: 'hoja', hoja: 'falta' } }, { texto: 'Ver', accion: { tipo: 'pantalla', pantalla: 'cuentas' }, tono: 'claro' }],
    });
  }

  // Si estás fuera (o te vas pronto)
  const f = fueraDe(e.fuera, yo, e.ahora);
  if (f) {
    r.push({
      clave: 'fuera', icono: 'avion', color: 'azul', encendida: false,
      titulo: f.desde <= e.ahora ? 'Estás fuera' : 'Te vas', sub: mayus(rangoFuera(f, e.ahora)),
      linea: 'No te llegan avisos y la basura la lleva otro mientras tanto.',
      botones: [{ texto: 'Cambiar las fechas', accion: { tipo: 'hoja', hoja: 'fuera' } }],
    });
  }
  return r;
}

function baldosaPiso(config: Config, e: Estado, x: Tarea, yo: MiembroId): Baldosa {
  const propio = x.miembro === yo;
  const z = x.zona;
  const clave = propio ? 'piso' : `piso:${x.miembro}`;
  const titulo = propio ? z.nombre : `${z.nombre} de ${nombreDe(config, x.miembro)}`;
  const { hechas, total } = progreso(x);
  // lo que llevas de la lista, solo mientras está por hacer (hecho, ya no cuenta)
  const cuenta = total && (x.estado === 'pendiente' || x.estado === 'suspendida') ? { hechas, total } : undefined;
  const base = { clave, icono: 'chispas' as const, color: 'tuyo' as const, titulo, cuenta };
  const i = x.intentos[x.intentos.length - 1];
  const lista: BotonHoy = { texto: 'La lista', accion: { tipo: 'lista', de: x.miembro }, tono: 'claro' };
  const hecho = (texto: string): BotonHoy => ({ texto, accion: { tipo: 'hecho', semana: x.semana, de: x.miembro }, tono: 'claro' });
  // tu piso lo limpia otro: lo marca él
  if (propio && x.cubre !== undefined && x.cubre !== yo && (x.estado === 'pendiente' || x.estado === 'suspendida')) {
    return { ...base, sub: `Lo limpia ${nombreDe(config, x.cubre)}`, encendida: false, linea: `${nombreDe(config, x.cubre)} se encarga de tu piso esta semana.`, botones: [{ texto: 'Ver tu piso', accion: { tipo: 'tarea', semana: x.semana, de: x.miembro } }] };
  }
  if (x.libre && x.estado === 'pendiente' && x.cubre === undefined) {
    return { ...base, sub: 'Libre: estás fuera', encendida: false, linea: 'Esta semana se queda sin limpiar y nadie pierde puntos.', botones: [] };
  }
  switch (x.estado) {
    case 'pendiente': {
      if (!x.enCurso) {
        return { ...base, sub: `Vas ${dias(x.retrasoDias)} tarde`, encendida: true, linea: z.incluye ? `${z.incluye}.` : undefined, botones: [limpiando(x) ? { ...lista, texto: 'Seguir', tono: 'tuyo' } : { texto: 'Empezar', accion: { tipo: 'empezar', semana: x.semana }, tono: 'tuyo' }, hecho('Ya está limpio')] };
      }
      if (limpiando(x)) {
        return { ...base, sub: `Limpiando · ${quedanDias(x.semana, e.ahora)}`, encendida: true, linea: z.incluye ? `${z.incluye}. Hasta el domingo.` : 'Hasta el domingo.', botones: [{ ...lista, texto: 'Seguir', tono: 'tuyo' }, hecho('Ya está limpio')] };
      }
      return { ...base, sub: `Te toca · ${quedanDias(x.semana, e.ahora)}`, encendida: true, linea: z.incluye ? `${z.incluye}. Hasta el domingo.` : 'Hasta el domingo.', botones: [{ texto: 'Empezar', accion: { tipo: 'empezar', semana: x.semana }, tono: 'tuyo' }, lista] };
    }
    case 'esperando': {
      const suya = i.quien === yo;
      return {
        ...base, sub: 'Hecho · esperando nota', encendida: false,
        linea: i.sinVotar.length ? `Falta la nota de ${y(i.sinVotar.map((j) => nombreDe(config, j)))}. Se cierra en ${duracion(i.fin - e.ahora)}.` : undefined,
        botones: suya ? [{ texto: i.propia ? 'Cambiar mi nota' : 'Ponerme nota', accion: { tipo: 'puntuar', semana: x.semana, de: x.miembro, intento: i.n, propia: true }, tono: 'claro' }] : [],
      };
    }
    case 'aprobada':
      return { ...base, sub: `Aprobado · un ${nota(x.nota!)}`, encendida: false, linea: i.auto ? 'Nadie puso pegas.' : undefined, botones: [] };
    case 'suspendida':
      return { ...base, sub: `Suspenso · a repasar`, encendida: true, linea: `Se quedó en un ${nota(i.media!)}. Repásalo y vuelve a marcarlo.`, botones: [{ ...lista, texto: 'Repasar', tono: 'tuyo' }, hecho('Ya lo he repasado')] };
  }
}

function baldosaBasura(config: Config, e: Estado, yo: MiembroId): Baldosa {
  const n = (m: MiembroId) => (m === yo ? 'tú' : nombreDe(config, m));
  const ba = basuraAhora(e);
  const mia = ba.quien === yo;
  const color: ColorHoy = ba.nivel === 'urgente' ? 'rojo' : ba.nivel === 'llena' ? 'ambar' : 'verde';
  const bolsas = ba.bolsas ? ` · ${ba.bolsas === 1 ? '1 bolsa' : `${ba.bolsas} bolsas`}` : '';
  const como = ba.nivel === 'tranquila' ? 'tranquila' : ba.pasada ? 'sin sacar' : ba.nivel === 'urgente' ? 'muy llena' : 'llena';
  const sub = mia ? `Tuya · ${como}${bolsas}` : ba.quien ? `La tiene ${nombreDe(config, ba.quien)} · ${como}` : `Sin dueño · ${como}`;
  // la última vez que se sacó
  const sacadas = e.semanasBasura.flatMap((s) => [...s.sacadas, ...s.ajenas]).sort((p, q) => cuandoSacada(q) - cuandoSacada(p));
  const ult = sacadas[0];
  let linea: string;
  if (ba.nivel === 'tranquila') {
    const fue = ult ? `${sacadaPor(ult) === yo ? 'La sacaste' : `La sacó ${nombreDe(config, sacadaPor(ult))}`} ${elDiaCorto(cuandoSacada(ult), e.ahora)} a las ${hora(cuandoSacada(ult))}. ` : '';
    linea = `${fue}Nadie ha avisado de que esté llena.`;
  } else {
    const avisan = ba.avisan.length ? `${ba.avisan.length > 1 ? 'Avisan' : 'Avisa'} ${y(ba.avisan.map(n))}.` : ba.recordatorio ? `${ba.recordatorio.quien === yo ? 'Te lo apuntaste' : `${nombreDe(config, ba.recordatorio.quien)} lo sabe`}.` : '';
    const queda = ba.pasada ? ' Se pasó el plazo.' : ba.limite !== undefined ? ` ${mia ? 'Te quedan' : 'Le quedan'} ${duracion(ba.limite - e.ahora)}.` : '';
    linea = `${avisan}${queda}`.trim();
  }
  const botones: BotonHoy[] = mia
    ? [{ texto: 'Ya la saqué', accion: { tipo: 'hoja', hoja: 'sacada' }, tono: 'verde' }, ...(!ba.aviso && !ba.recordatorio ? [{ texto: 'Está llena', accion: { tipo: 'hoja', hoja: 'basura' }, tono: 'claro' } as BotonHoy] : [])]
    : [{ texto: ba.avisan.includes(yo) ? 'Ya avisaste' : ba.avisan.length ? 'Avisar yo también' : 'Está llena', accion: { tipo: 'hoja', hoja: 'basura' } }, ...(ba.nivel !== 'tranquila' && ba.quien ? [{ texto: 'La saqué yo', accion: { tipo: 'hoja', hoja: 'sacada' }, tono: 'claro' } as BotonHoy] : [])];
  return { clave: 'basura', icono: 'basura', color, titulo: 'La basura', sub, encendida: mia || ba.nivel !== 'tranquila', linea, botones };
}

// ——— La frase de arriba ———

/** La frase de Hoy: el saludo y, por orden, lo que importa (las notas que te tocan, tu piso, la basura y lo que debes,
 *  el súper, quién está fuera), con un cristal en cada cosa que se puede tocar. Como mucho cinco frases. */
export function fraseDeHoy(config: Config, e: Estado, yo: MiembroId, baldosas = paraTi(config, e, yo)): Trozo[] {
  const nombre = (m: MiembroId) => nombreDe(config, m);
  const de = (clave: string) => baldosas.find((x) => x.clave === clave);
  const cristal = (texto: string, clave: string): Trozo => {
    const x = de(clave);
    return x ? { t: 'cristal', texto, clave, icono: x.icono, color: x.color } : b(texto);
  };
  const frases: Trozo[][] = [];

  // lo de antes
  const antes = atrasadas(e, yo).find((a) => a.estado === 'pendiente' || a.estado === 'suspendida');
  if (antes) frases.push([t('Te queda el '), cristal(enFrase(antes.zona), `antes:${antes.semana}`), t(antes.estado === 'suspendida' ? ' por repasar.' : ' de la semana pasada.')]);

  // las notas que te tocan: la que antes se cierra manda la hora
  const votos = paraPuntuar(e, yo).sort((p, q) => p.intento.fin - q.intento.fin);
  if (votos.length) {
    const [primera, ...resto] = antesDe(votos[0].intento.fin, e.ahora);
    const quien = votos.map((v) => cristal(nombre(v.intento.quien), `nota:${v.tarea.semana}:${v.tarea.miembro}:${v.intento.n}`));
    const juntos: Trozo[] = quien.flatMap((q, k) => (k === 0 ? [q] : [t(k === quien.length - 1 ? ' y a ' : ', a '), q]));
    frases.push([{ ...primera, texto: mayus((primera as { texto: string }).texto) } as Trozo, ...resto, t(' ponle nota a '), ...juntos, t('.')]);
  }

  // lo que es tuyo
  const tuyos = tuyosAbiertos(e, yo).sort((p, q) => p.limite - q.limite);
  if (tuyos.length) frases.push([t('Hay '), cristal(tuyos.length > 1 ? 'cosas tuyas' : 'algo tuyo', `tuyo:${tuyos[0].id}`), t(' por ahí: recógelo '), ...antesDe(tuyos[0].limite, e.ahora), t('.')]);

  // tu piso
  for (const x of tusPisos(e, yo)) {
    const propio = x.miembro === yo;
    const c = cristal(enFrase(x.zona), propio ? 'piso' : `piso:${x.miembro}`);
    if (!propio) { frases.push([t('Te encargas del '), c, t(` de ${nombre(x.miembro)}`), t(limpiando(x) ? `: vas por ${progreso(x).hechas} de ${progreso(x).total}.` : '.')]); continue; }
    if (x.cubre !== undefined && x.cubre !== yo && (x.estado === 'pendiente' || x.estado === 'suspendida')) { frases.push([t('Tu '), c, t(` lo limpia ${nombre(x.cubre)}.`)]); continue; }
    if (x.libre && x.estado === 'pendiente' && x.cubre === undefined) { frases.push([t('Tu '), c, t(' queda libre: estás fuera.')]); continue; }
    if (x.estado === 'pendiente' && !x.enCurso) { frases.push([t('Vas '), b(dias(x.retrasoDias)), t(' tarde con tu '), c, t('.')]); continue; }
    if (x.estado === 'pendiente' && limpiando(x)) { const p = progreso(x); frases.push([t('Tu '), c, t(' va por '), b(`${p.hechas} de ${p.total}`), t(`: ${quedanDias(x.semana, e.ahora)}.`)]); continue; }
    if (x.estado === 'pendiente') { frases.push([t('Tu '), c, t(` sigue sin empezar: ${quedanDias(x.semana, e.ahora)}.`)]); continue; }
    if (x.estado === 'esperando') { frases.push([t('Tu '), c, t(' está hecho y espera nota.')]); continue; }
    if (x.estado === 'aprobada') { frases.push([t('Tu '), c, t(' está aprobado con un '), b(nota(x.nota!)), t('.')]); continue; }
    frases.push([t('Tu '), c, t(' está suspendido: toca repasarlo.')]);
  }

  // la basura y lo que debes, juntos
  const ba = basuraAhora(e);
  const mia = ba.quien === yo;
  const basura: Trozo[] = [];
  if (mia) {
    if (ba.nivel === 'tranquila') basura.push(t('La '), cristal('basura', 'basura'), t(' está tranquila'));
    else if (ba.pasada) basura.push(t('La '), cristal('basura', 'basura'), t(' sigue sin sacar: sácala ya'));
    else if (ba.limite !== undefined) basura.push(t(`La `), cristal('basura', 'basura'), t(` está ${ba.nivel === 'urgente' ? 'muy llena' : 'llena'}: sácala `), ...antesDe(ba.limite, e.ahora));
    else basura.push(t('Tienes la '), cristal('basura', 'basura'), t(' llena por sacar'));
  } else if (ba.nivel !== 'tranquila' && ba.quien) {
    basura.push(t('La '), cristal('basura', 'basura'), t(` está ${ba.nivel === 'urgente' ? 'muy llena' : 'llena'} (la tiene ${nombre(ba.quien)})`));
  }
  const saldo = e.cuentas.saldo[yo] ?? 0;
  const dinero: Trozo[] = saldo < 0 ? [t('debes '), cristal(euros(-saldo), 'cuentas')] : saldo > 0 ? [t('te deben '), cristal(euros(saldo), 'cuentas')] : [];
  if (basura.length && dinero.length) frases.push([...basura, t(' y '), ...dinero, t('.')]);
  else if (basura.length) frases.push([...basura, t('.')]);
  else if (dinero.length) frases.push([{ ...(dinero[0] as { t: 'texto'; texto: string }), texto: mayus((dinero[0] as { texto: string }).texto) }, ...dinero.slice(1), t('.')]);

  // el súper
  const faltas = e.super.faltas.filter((f) => abierta(f) && f.toca === yo);
  if (faltas.length) frases.push([t('Te toca comprar '), cristal(y(faltas.map((f) => f.cosa.toLowerCase())), 'super'), t('.')]);

  // quién está fuera
  const fuera = e.fuera.filter((f) => f.desde <= e.ahora && f.hasta >= e.ahora);
  for (const f of fuera) frases.push(f.quien === yo ? [t('Estás fuera hasta '), cristal(elDia(f.hasta), 'fuera'), t('.')] : [t(`${nombre(f.quien)} está fuera hasta ${elDia(f.hasta)}.`)]);

  const cuerpo = frases.slice(0, 5);
  if (!cuerpo.length) cuerpo.push([t('Nada pendiente por hoy.')]);
  return [t(`${saludo(e.ahora)}, ${nombre(yo)}. `), ...cuerpo.flatMap((f, k) => (k === 0 ? f : [t(' '), ...f]))];
}

// ——— Los pisos, en tarjetas ———

/** Las tarjetas de los pisos de esta semana: el tuyo (o el que limpias tú) primero y luego los demás, por pisos. */
export function tarjetasPisos(config: Config, e: Estado, yo: MiembroId): TarjetaPiso[] {
  const nombre = (m: MiembroId) => (m === yo ? 'tú' : nombreDe(config, m));
  const orden = (z: Zona) => config.zonas.findIndex((x) => x.id === z.id);
  const deLaSemana = e.tareas.filter((x) => x.semana === e.semana);
  const mia = (x: Tarea) => x.miembro === yo || x.cubre === yo;
  // lo limpias tú: tu piso (si no lo limpia otro) o el de otro del que te encargas
  const loLimpiasTu = (x: Tarea) => (x.cubre !== undefined ? x.cubre === yo : x.miembro === yo);
  return deLaSemana
    .slice()
    .sort((p, q) => Number(mia(q)) - Number(mia(p)) || orden(p.zona) - orden(q.zona))
    .map((x): TarjetaPiso => {
      const limpia = x.cubre ?? x.miembro;
      const tuya = loLimpiasTu(x);
      const piso = pisoDe(x.zona);
      const d = piso ? diasSinLimpiar(e, piso) : 0;
      const sub = x.cubre !== undefined && x.cubre !== x.miembro
        ? `De ${nombre(x.miembro)} · lo limpia ${nombre(x.cubre)}`
        : `Esta semana, ${nombre(x.miembro)}`;
      const frase: Trozo[] = [];
      // la última vez que se limpió
      const ult = ultimaLimpieza(e, x.zona);
      const i = x.intentos[x.intentos.length - 1];
      const estaSemana = ult && ult.tarea === x;
      if (ult) {
        const quien = ult.intento.quien;
        const lo = quien === yo ? 'Lo limpiaste tú' : `Lo limpió ${nombreDe(config, quien)}`;
        const cuando = elDiaCorto(ult.intento.hecho.ts, e.ahora);
        if (ult.tarea.estado === 'aprobada') frase.push(t(`${lo} ${cuando}, con un ${nota(ult.tarea.nota!)}. `));
        else if (ult.intento.propia) frase.push(t(`${lo} ${cuando} y `), b(`se ${quien === yo ? 'puso' : 'pone'} un ${nota(ult.intento.propia.nota)}`), t('. '));
        else frase.push(t(`${lo} ${cuando} y espera nota. `));
      } else {
        frase.push(t('Aún no se ha limpiado. '));
      }
      // cómo va esta semana
      if (estaSemana && x.estado === 'esperando') {
        const faltan = i.propia?.faltan.length ?? 0;
        if (faltan) frase.push(t(`${i.quien === yo ? 'Te' : 'Le'} ${falto(faltan)}. `));
        frase.push(t(`Se cierra ${elDiaCorto(i.fin, e.ahora)} a las ${hora(i.fin)}.`));
      } else if (x.estado === 'suspendida') {
        frase.push(t(`Suspendido con un ${nota(i.media!)}: `), b('toca repasarlo'), t('.'));
      } else if (x.estado === 'pendiente') {
        const { hechas, total } = progreso(x);
        if (x.libre && x.cubre === undefined) frase.push(t(`${x.miembro === yo ? 'Estás fuera' : `${nombreDe(config, x.miembro)} está fuera`}: `), b('esta semana queda libre'), t('.'));
        else if (!x.enCurso) frase.push(b(`${tuya ? 'Vas' : 'Va'} ${dias(x.retrasoDias)} tarde`), t('.'));
        else if (limpiando(x)) frase.push(t(tuya ? 'Vas por ' : 'Va por '), b(`${hechas} de ${total}`), t('.'));
        else if (tuya) frase.push(b(teQuedan(x.semana, e.ahora)), t(` y llevas 0 de ${total}.`));
        else if (x.cubre !== undefined) frase.push(t('Esta semana '), b(`lo limpia ${nombre(x.cubre)}`), t('.'));
        else frase.push(t('Esta semana '), b('aún no ha empezado'), t('.'));
      }
      // el botón
      let boton: BotonHoy | undefined;
      const voto = paraPuntuar(e, yo).find((v) => v.tarea === x);
      if (voto) boton = { texto: 'Ponle nota', accion: { tipo: 'puntuar', semana: x.semana, de: x.miembro, intento: voto.intento.n }, tono: `p:${voto.intento.quien}` };
      else if (tuya && (x.estado === 'pendiente' || x.estado === 'suspendida') && !(x.libre && x.cubre === undefined)) {
        boton = limpiando(x) || x.estado === 'suspendida'
          ? { texto: x.estado === 'suspendida' ? 'Repasar' : 'Seguir', accion: { tipo: 'lista', de: x.miembro }, tono: 'tuyo' }
          : { texto: 'Empezar', accion: { tipo: 'empezar', semana: x.semana }, tono: 'tuyo' };
      } else if (!tuya && (x.estado === 'pendiente' || x.estado === 'suspendida') && x.cubre === undefined && !(x.libre)) {
        boton = x.ayudan.includes(yo) ? { texto: 'Le ayudas 🤝', accion: { tipo: 'ponerme', de: x.miembro }, tono: 'claro' } : { texto: 'Le echo una mano', accion: { tipo: 'ponerme', de: x.miembro }, tono: 'claro' };
      }
      return {
        clave: x.zona.id,
        miembro: x.miembro,
        limpia,
        zona: x.zona,
        tuya,
        titulo: x.zona.nombre,
        sub,
        dias: d,
        fresco: Math.max(0.04, Math.min(1, 1 - d / 7)),
        frase,
        salas: salasDe(x.zona),
        boton,
        alTocar: tuya ? { tipo: 'lista', de: x.miembro } : { tipo: 'tarea', semana: x.semana, de: x.miembro },
      };
    });
}
