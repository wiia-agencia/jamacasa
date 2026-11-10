// La casa viva (la H, la que eligió Javi el 10 de noviembre): la luz de la casa en 3D sigue la hora de verdad.
// De día, luz de día; al atardecer, naranja y más oscuro; de noche, azul noche con las lámparas encendidas.
// Sale de la altura del sol a esa hora (como en España: el reloj de la app ya es el de Madrid), no de una tabla de
// horas, así que en invierno anochece antes que en verano.

/** Dónde se mira el sol: el centro de España (con el reloj de Madrid, el atardecer cae a su hora en toda la Península). */
export const LUGAR = { lat: 40.42, lon: -3.7 };

export type Fase = 'noche' | 'amanecer' | 'manana' | 'dia' | 'tarde' | 'atardecer';

export interface Luz {
  /** Altura del sol sobre el horizonte, en grados (negativa de noche). */
  sol: number;
  /** Antes del mediodía solar. */
  manana: boolean;
  fase: Fase;
  /** 0 de noche, 1 de día (pasa poco a poco al amanecer y al atardecer). */
  dia: number;
  /** Cuánto tira a naranja (1 con el sol en el horizonte, 0 a pleno día y de noche cerrada). */
  calidez: number;
  /** Las lámparas de la casa: 0 apagadas, 1 encendidas del todo. */
  lamparas: number;
}

const RAD = Math.PI / 180;
const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Altura del sol (en grados) y si es antes del mediodía solar, en un instante y un lugar. Fórmulas cortas del
 *  almanaque (error de unas décimas de grado, de sobra para pintar el cielo). */
export function alturaSol(ms: number, lugar = LUGAR): { sol: number; manana: boolean } {
  const n = ms / 86_400_000 + 2440587.5 - 2451545.0; // días desde el 1 de enero de 2000 a mediodía
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ar = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  let h = ((gmst * 15 + lugar.lon) * RAD - ar) % (2 * Math.PI);
  if (h > Math.PI) h -= 2 * Math.PI;
  if (h < -Math.PI) h += 2 * Math.PI;
  const lat = lugar.lat * RAD;
  const sol = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h)) / RAD;
  return { sol, manana: h < 0 };
}

/** Cómo está la luz en un instante. */
export function luzDe(ms: number, lugar = LUGAR): Luz {
  const { sol, manana } = alturaSol(ms, lugar);
  let fase: Fase;
  if (sol < -6) fase = 'noche';
  else if (sol < 2) fase = manana ? 'amanecer' : 'atardecer';
  else if (sol < 12) fase = manana ? 'manana' : 'tarde';
  else fase = 'dia';
  return {
    sol,
    manana,
    fase,
    dia: suave(-8, 12, sol),
    calidez: sol < -7 ? 0 : Math.max(0, 1 - Math.abs(sol - 2) / (sol < 2 ? 9 : 13)),
    lamparas: 1 - suave(-3, 7, sol),
  };
}
