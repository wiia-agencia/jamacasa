// La casa en 3D de Limpieza: cómo está cada piso y qué hace cada muñeco, sacado de los eventos.
// Reglas puras, como el resto de src/core: la pantalla solo le pasa el resultado al dibujo.
//   · Un piso sin limpiar se va estropeando: 1 semana (desorden), 2 (asco), 3 o más (ruina).
//   · Un piso aprobado brilla según la nota: de 5 a 7 limpio, de 7 a 9 muy limpio, 9 o más reluciente.
//   · Cada muñeco hace lo suyo: el móvil si no ha empezado, barrer, esperar la nota o descansar.
//   · Insignias: corona del rey del mes, racha (3 pisos seguidos con 9 o más), mejorando o empeorando,
//     debe un piso de antes y peste (2 semanas seguidas sin hacer su piso o 3 «Esto es tuyo» sin recoger en el mes).
import type { Estado } from './estado';
import type { Tarea } from './limpieza';
import { mes } from './tiempo';
import type { MiembroId, Zona } from './tipos';

export type Piso3D = 'abajo' | 'medio' | 'arriba';
export type EstadoPiso = 'sucio' | 'limpiando' | 'esperando' | 'limpio';
export type Accion = 'pie' | 'movil' | 'triste';
export type Insignia = 'debe' | 'peste' | 'racha' | 'mejora' | 'empeora';

export interface PersonaEscena {
  accion?: Accion; // sin acción: la que toca por el estado del piso (barrer, esperar, descansar)
  insignias: Insignia[];
  dice?: string;
}

export interface EscenaCasa {
  turnos: Record<MiembroId, Piso3D>;
  pisos: Record<Piso3D, [EstadoPiso, number]>;
  personas: Record<MiembroId, PersonaEscena>;
  rey: MiembroId | null;
}

export function pisoDe(z: Zona): Piso3D | null {
  if (z.id === 'abajo' || z.id === 'medio' || z.id === 'arriba') return z.id;
  const n = z.nombre.toLowerCase();
  if (n.includes('abajo')) return 'abajo';
  if (n.includes('medio')) return 'medio';
  if (n.includes('arriba')) return 'arriba';
  return null;
}

/** Brillo de un piso aprobado: 1 limpio (5–7), 2 muy limpio (7–9), 3 reluciente (9 o más). */
export function brillo(nota: number | undefined): number {
  if (nota === undefined) return 1;
  return nota >= 9 ? 3 : nota >= 7 ? 2 : 1;
}

/** Semanas seguidas (como mucho 3) que lleva un piso sin limpiar antes de la semana w. */
export function semanasSinLimpiar(e: Estado, piso: Piso3D, w: number): number {
  let n = 0;
  for (let k = w - 1; k >= e.semanaInicio && n < 3; k--) {
    const t = e.tareas.find((x) => x.semana === k && pisoDe(x.zona) === piso);
    if (!t || t.estado === 'aprobada' || t.estado === 'esperando') break;
    n++;
  }
  return n;
}

function insigniasDe(e: Estado, m: MiembroId): Insignia[] {
  const r: Insignia[] = [];
  const suyas = e.tareas.filter((t) => t.miembro === m).sort((a, b) => a.semana - b.semana);
  const pasadas = suyas.filter((t) => t.semana < e.semana);

  // Debe un piso de las dos últimas semanas
  if (pasadas.some((t) => t.semana >= e.semana - 2 && (t.estado === 'pendiente' || t.estado === 'suspendida'))) r.push('debe');

  // Peste
  const dos = pasadas.slice(-2);
  const multas = e.tuyos.filter((a) => a.para === m && a.estado === 'multa' && mes(a.limite) === e.mes).length;
  const sinLimpiar = (t: Tarea) => t.estado === 'pendiente' || t.estado === 'suspendida';
  if ((dos.length === 2 && dos.every(sinLimpiar)) || multas >= 3) r.push('peste');

  // Racha: los 3 últimos pisos acabados, aprobados con 9 o más (el de esta semana cuenta si ya está aprobado)
  const acabadas = suyas.filter((t) => !(t.semana === e.semana && t.estado !== 'aprobada'));
  let seguidas = 0;
  for (let i = acabadas.length - 1; i >= 0; i--) {
    const t = acabadas[i];
    if (t.estado === 'aprobada' && (t.nota ?? 0) >= 9) seguidas++;
    else break;
  }
  if (seguidas >= 3) r.push('racha');

  // Mejorando o empeorando: la media de sus 3 últimas notas contra la de las 3 anteriores
  const notas = suyas.filter((t) => t.estado === 'aprobada').map((t) => t.nota!);
  if (notas.length >= 6) {
    const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const d = media(notas.slice(-3)) - media(notas.slice(-6, -3));
    if (d >= 0.75) r.push('mejora');
    if (d <= -0.75) r.push('empeora');
  }
  return r;
}

export function escenaCasa(e: Estado): EscenaCasa | null {
  if (!e.empezado) return null;
  const turnos: Record<MiembroId, Piso3D> = {};
  const pisos: Partial<Record<Piso3D, [EstadoPiso, number]>> = {};
  const personas: Record<MiembroId, PersonaEscena> = {};
  const tareas = e.tareas.filter((t) => t.semana === e.semana);

  for (const t of tareas) {
    const piso = pisoDe(t.zona);
    if (!piso) continue;
    turnos[t.miembro] = piso;
    const sucio = semanasSinLimpiar(e, piso, e.semana);
    let estado: [EstadoPiso, number];
    if (t.estado === 'aprobada') estado = ['limpio', brillo(t.nota)];
    else if (t.estado === 'esperando') estado = ['esperando', 0];
    else if (t.empezada !== undefined && t.estado === 'pendiente') estado = ['limpiando', 0];
    else estado = ['sucio', sucio];
    pisos[piso] = estado;

    const p: PersonaEscena = { insignias: insigniasDe(e, t.miembro) };
    if (estado[0] === 'sucio') {
      if (t.estado === 'suspendida') { p.accion = 'pie'; p.dice = 'Toca repasarlo'; }
      else if (sucio >= 2) p.accion = 'triste';
      else if (p.insignias.includes('debe')) p.accion = 'pie';
      else p.accion = 'movil';
    }
    personas[t.miembro] = p;
  }
  // Los tres pisos tienen que estar (si falta alguno, la casa no se puede dibujar)
  if (!pisos.abajo || !pisos.medio || !pisos.arriba) return null;

  const reyes = e.titulos[e.mes]?.rey ?? [];
  return { turnos, pisos: pisos as Record<Piso3D, [EstadoPiso, number]>, personas, rey: reyes.length === 1 ? reyes[0] : null };
}

/** La tarea de una persona con su piso en 3D (para la tarjeta de «Tu piso»). */
export function tareaConPiso(e: Estado, m: MiembroId): { tarea: Tarea; piso: Piso3D } | null {
  const t = e.tareas.find((x) => x.semana === e.semana && x.miembro === m);
  const piso = t && pisoDe(t.zona);
  return t && piso ? { tarea: t, piso } : null;
}
