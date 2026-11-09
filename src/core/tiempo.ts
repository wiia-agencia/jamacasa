// Fechas y semanas con la hora de Madrid. Las semanas van de lunes a domingo.
// Una "semana" es un número: semanas desde el lunes 1 de enero de 2024.

export const ZONA_HORARIA = 'Europe/Madrid';
export const HORA = 3_600_000;
export const DIA_MS = 86_400_000;
const LUNES_REF = Date.UTC(2024, 0, 1) / DIA_MS; // 1 ene 2024 fue lunes

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export interface Partes { y: number; m: number; d: number; h: number; mi: number; s: number }

const cache = new Map<number, Partes>();
export function partes(ms: number): Partes {
  const clave = Math.floor(ms / 1000);
  const c = cache.get(clave);
  if (c) return c;
  const p: any = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  const r = { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
  if (cache.size > 20000) cache.clear();
  cache.set(clave, r);
  return r;
}

function desfaseMin(ms: number): number {
  const p = partes(ms);
  const comoUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((comoUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Instante de una hora "de reloj" en Madrid. */
export function instanteLocal(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  const supuesto = Date.UTC(y, m - 1, d, h, mi, s);
  const d1 = desfaseMin(supuesto);
  let t = supuesto - d1 * 60000;
  const d2 = desfaseMin(t);
  if (d2 !== d1) t = supuesto - d2 * 60000;
  return t;
}

/** Día del calendario (en Madrid) como número de días desde 1970. */
export function diaLocal(ms: number): number {
  const p = partes(ms);
  return Date.UTC(p.y, p.m - 1, p.d) / DIA_MS;
}

export function fechaDeDia(n: number): { y: number; m: number; d: number } {
  const dt = new Date(n * DIA_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function diaDeTexto(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DIA_MS;
}

export function textoDeDia(n: number): string {
  const f = fechaDeDia(n);
  return `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`;
}

/** 0 = lunes … 6 = domingo */
export function diaSemana(ms: number): number {
  return (((diaLocal(ms) - LUNES_REF) % 7) + 7) % 7;
}

export function semanaDeDia(n: number): number {
  return Math.floor((n - LUNES_REF) / 7);
}

export function semana(ms: number): number {
  return semanaDeDia(diaLocal(ms));
}

/** Primer día (lunes) de la semana, como número de día. */
export function lunesDe(w: number): number {
  return LUNES_REF + w * 7;
}

export function inicioDia(n: number): number {
  const f = fechaDeDia(n);
  return instanteLocal(f.y, f.m, f.d);
}

export function inicioSemana(w: number): number {
  return inicioDia(lunesDe(w));
}

/** Último milisegundo del domingo. */
export function finSemana(w: number): number {
  return inicioSemana(w + 1) - 1;
}

export function mesDeDia(n: number): string {
  const f = fechaDeDia(n);
  return `${f.y}-${String(f.m).padStart(2, '0')}`;
}

export function mes(ms: number): string {
  return mesDeDia(diaLocal(ms));
}

/** Mes al que cuenta una semana: el del domingo en que termina. */
export function mesDeSemana(w: number): string {
  return mesDeDia(lunesDe(w) + 6);
}

export function mesSiguiente(m: string): string {
  let [y, mm] = m.split('-').map(Number);
  mm += 1;
  if (mm > 12) { mm = 1; y += 1; }
  return `${y}-${String(mm).padStart(2, '0')}`;
}

export function mesAnterior(m: string): string {
  let [y, mm] = m.split('-').map(Number);
  mm -= 1;
  if (mm < 1) { mm = 12; y -= 1; }
  return `${y}-${String(mm).padStart(2, '0')}`;
}

export function mesesEntre(desde: string, hasta: string): string[] {
  const r: string[] = [];
  let m = desde;
  let guardia = 0;
  while (m <= hasta && guardia++ < 600) { r.push(m); m = mesSiguiente(m); }
  return r;
}

// ——— Textos en castellano ———

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_C = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

export function nombreMes(m: string, corto = false): string {
  const mm = Number(m.split('-')[1]) - 1;
  return (corto ? MESES_C : MESES)[mm];
}

export function nombreDia(ms: number, corto = false): string {
  return (corto ? DIAS_C : DIAS)[diaSemana(ms)];
}

/** "2–8 nov" o "30 nov – 6 dic" */
export function rangoSemana(w: number, largo = false): string {
  const a = fechaDeDia(lunesDe(w));
  const b = fechaDeDia(lunesDe(w) + 6);
  const M = largo ? MESES : MESES_C;
  if (a.m === b.m) return largo ? `del ${a.d} al ${b.d} de ${M[b.m - 1]}` : `${a.d}–${b.d} ${M[b.m - 1]}`;
  return largo ? `del ${a.d} de ${M[a.m - 1]} al ${b.d} de ${M[b.m - 1]}` : `${a.d} ${M[a.m - 1]} – ${b.d} ${M[b.m - 1]}`;
}

export function hora(ms: number): string {
  const p = partes(ms);
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

/** "hoy a las 19:30", "ayer a las 9:05", "el jueves a las 21:00", "el 3 nov" */
export function cuando(ms: number, ahora: number): string {
  const dif = diaLocal(ahora) - diaLocal(ms);
  if (dif === 0) return `hoy a las ${hora(ms)}`;
  if (dif === 1) return `ayer a las ${hora(ms)}`;
  if (dif > 1 && dif < 7) return `el ${nombreDia(ms)} a las ${hora(ms)}`;
  const f = fechaDeDia(diaLocal(ms));
  return `el ${f.d} ${MESES_C[f.m - 1]}`;
}

export function fechaCorta(n: number): string {
  const f = fechaDeDia(n);
  return `${f.d} ${MESES_C[f.m - 1]}`;
}

/** Duración en texto: "2 d 5 h", "5 h 20 min", "12 min" */
export function duracion(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const mi = min % 60;
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return mi > 0 && h < 10 ? `${h} h ${mi} min` : `${h} h`;
  return `${mi} min`;
}

export function haceRato(ms: number, ahora: number): string {
  const dif = ahora - ms;
  if (dif < 60_000) return 'ahora mismo';
  return `hace ${duracion(dif)}`;
}
