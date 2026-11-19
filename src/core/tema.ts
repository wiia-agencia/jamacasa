// Tu tema (Javi, 19 de noviembre: «el tema que lo elija cada uno y punto, yo no puedo decidir por ellos»): el color del
// fondo de Hoy y la luz de la app, guardados en cada móvil. La luz puede ir «con el sol» (la idea de la ronda 11): clara
// de día, oscura de noche y dorada al amanecer y al atardecer, con el mismo sol que la casa en 3D (`luz.ts`).
import { luzDe } from './luz';

export type ColorTema = 'naranja' | 'azul' | 'verde' | 'morado' | 'rosa' | 'grafito';
export const COLORES_TEMA: { id: ColorTema; nombre: string }[] = [
  { id: 'naranja', nombre: 'Naranja' },
  { id: 'azul', nombre: 'Azul' },
  { id: 'verde', nombre: 'Verde' },
  { id: 'morado', nombre: 'Morado' },
  { id: 'rosa', nombre: 'Rosa' },
  { id: 'grafito', nombre: 'Grafito' },
];
export const esColorTema = (x: unknown): x is ColorTema => COLORES_TEMA.some((c) => c.id === x);

/** La luz: como el móvil, clara, oscura o con el sol. */
export type LuzTema = 'auto' | 'claro' | 'oscuro' | 'sol';
export const esLuzTema = (x: unknown): x is LuzTema => x === 'auto' || x === 'claro' || x === 'oscuro' || x === 'sol';

export type Momento = 'amanecer' | 'dia' | 'atardecer' | 'noche';

/** El momento del día según el sol: de noche, al amanecer, de día o al atardecer (el sol, a menos de 2° del horizonte). */
export function momentoDelSol(ms: number): Momento {
  const { fase } = luzDe(ms);
  if (fase === 'noche' || fase === 'amanecer' || fase === 'atardecer') return fase;
  return 'dia';
}

/** ¿Va en oscuro? Como el móvil, lo que digas tú o, con el sol, del atardecer al amanecer. */
export function esOscuro(luz: LuzTema, movilOscuro: boolean, ms: number): boolean {
  if (luz === 'auto') return movilOscuro;
  if (luz === 'sol') {
    const m = momentoDelSol(ms);
    return m === 'noche' || m === 'atardecer';
  }
  return luz === 'oscuro';
}
