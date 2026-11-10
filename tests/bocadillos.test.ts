import { describe, expect, it } from 'vitest';
import { bocadilloDe, bocadillos, fichaDe, marcaDe, resumenDe } from '../src/core/bocadillos';
import { semanaInicial, zonaDe } from '../src/core/calendario';
import { derivar } from '../src/core/estado';
import { HORA, inicioSemana } from '../src/core/tiempo';
import type { Config, Evento } from '../src/core/tipos';

const config: Config = {
  nombre: 'Casa de prueba',
  inicio: '2026-10-05',
  semilla: 2026,
  miembros: [
    { id: 'a', nombre: 'Ana', color: 'naranja' },
    { id: 'b', nombre: 'Bea', color: 'verde' },
    { id: 'c', nombre: 'Cris', color: 'azul' },
  ],
  zonas: [
    { id: 'abajo', nombre: 'Piso de abajo', incluye: '', checklist: ['Suelo', 'Mesa', 'Baño'] },
    { id: 'medio', nombre: 'Piso del medio', incluye: '', checklist: ['Suelo', 'Terraza'] },
    { id: 'arriba', nombre: 'Piso de arriba', incluye: '', checklist: ['Suelo', 'Cocina'] },
  ],
  alquiler: { total: 0, paga: 'b', partes: {}, dia: 10, desde: '2026-10' },
  facturas: [],
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: string, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const s = semanaInicial(config) + 1;
const dia = (d: number, h = 12) => inicioSemana(s) + d * 24 * HORA + h * HORA;

// Ana sin empezar; Bea lo ha limpiado y espera nota (de Ana y de Cris); Cris aprobado con un 9,5
const eventos: Evento[] = [
  ev('zona_hecha', 'b', dia(1, 19), { semana: s }),
  ev('zona_hecha', 'c', dia(0, 18), { semana: s }),
  ev('puntuacion', 'a', dia(0, 20), { semana: s, de: 'c', intento: 1, nota: 9 }),
  ev('puntuacion', 'b', dia(1, 9), { semana: s, de: 'c', intento: 1, nota: 10 }),
];

describe('la pantalla de Limpieza: bocadillos, caras y fichas', () => {
  const e = derivar(config, eventos, dia(2, 10));
  it('tú, sin empezar: «Empezar a limpiar» con los días que lleva tu piso', () => {
    const b = bocadilloDe(config, e, 'a', 'a')!;
    expect(b.titulo).toBe('▶ Empezar a limpiar');
    expect(b.tono).toBe('yo');
    expect(b.accion).toBe('empezar');
    expect(b.sub).toMatch(/^Lleva \d+ días? sin limpiar$|^Esta semana te toca$/);
    expect(marcaDe(e, 'a', 'a')).toEqual({ marca: '!', tono: 'naranja' });
    expect(resumenDe(e, 'a')).toBe(`Te toca el ${zonaDe(config, s, 'a')!.nombre.toLowerCase()}`);
  });

  it('el que espera tu nota te lo pide; el aprobado sale en verde con su nota', () => {
    const bea = bocadilloDe(config, e, 'b', 'a')!;
    expect(bea.titulo).toBe('Bea espera tu nota ★');
    expect(bea.accion).toBe('puntuar');
    expect(marcaDe(e, 'b', 'a')).toEqual({ marca: '★', tono: 'oro' });
    const cris = bocadilloDe(config, e, 'c', 'a')!;
    expect(cris.titulo).toBe('Aprobado ✓ 9,5');
    expect(cris.tono).toBe('verde');
    expect(marcaDe(e, 'c', 'a').marca).toBe('✓');
    // la ficha de Bea: lo ha limpiado y el botón para ponerle nota
    const f = fichaDe(config, e, 'b', 'a')!;
    expect(f.texto).toContain('lo ha limpiado ayer');
    expect(f.boton).toEqual({ texto: 'Ponle nota ★', accion: 'puntuar' });
    expect(fichaDe(config, e, 'c', 'a')!.nota).toBe(9.5);
    // los de otros que no han empezado no dicen nada (si no van tarde)
    expect(bocadillos(config, e, 'b').map((x) => x.miembro)).toEqual(['b', 'c']);
  });

  it('mientras limpias: «Limpiando…» con lo que llevas de la lista', () => {
    const z = zonaDe(config, s, 'a')!;
    const mas = [ev('zona_empezada', 'a', dia(2, 10), { semana: s }), ev('zona_cosa', 'a', dia(2, 11), { semana: s, cosa: z.checklist[0], hecha: true })];
    const e2 = derivar(config, [...eventos, ...mas], dia(2, 12));
    const b = bocadilloDe(config, e2, 'a', 'a')!;
    expect(b.titulo).toBe('Limpiando…');
    expect(b.sub).toBe(`1 de ${z.checklist.length} hechas`);
    expect(b.accion).toBe('lista');
    expect(marcaDe(e2, 'a', 'b').marca).toBe('…');
    expect(resumenDe(e2, 'a')).toBe(`Limpiando el ${z.nombre.toLowerCase()}`);
    // los otros lo ven en blanco
    expect(bocadilloDe(config, e2, 'a', 'b')!.tono).toBe('blanco');
  });

  it('el lunes siguiente, la pantalla ya es la de la semana nueva', () => {
    const lunes = derivar(config, [], inicioSemana(s + 1) + 30 * HORA);
    expect(lunes.semana).toBe(s + 1);
    expect(bocadilloDe(config, lunes, 'a', 'a')!.titulo).toBe('▶ Empezar a limpiar');
  });
});
