import { describe, expect, it } from 'vitest';
import { avisosDeEvento, avisosDelReloj } from '../src/core/avisos';
import { semanaInicial } from '../src/core/calendario';
import { calcularEspacio, textoEspacio } from '../src/core/espacio';
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
    { id: 'abajo', nombre: 'Piso de abajo', incluye: '', checklist: [] },
    { id: 'medio', nombre: 'Piso del medio', incluye: '', checklist: [] },
    { id: 'arriba', nombre: 'Piso de arriba', incluye: '', checklist: [] },
  ],
  alquiler: { total: 0, paga: 'b', partes: {}, dia: 10, desde: '2026-10' },
  facturas: [],
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: string, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const s = semanaInicial(config);
const dia = (w: number, d: number, h = 12) => inicioSemana(w) + d * 24 * HORA + h * HORA;

describe('Tu espacio', () => {
  it('cuenta los días desde la última vez y dice cuándo toca', () => {
    const lista = [
      ev('espacio_cosa', 'a', dia(s, 0, 9), { cosa: 'bano', nombre: 'Tu baño', cada: 7 }),
      ev('espacio_cosa', 'a', dia(s, 0, 9), { cosa: 'hab', nombre: 'Tu habitación', cada: 7 }),
      ev('espacio_hecho', 'a', dia(s, 1, 20), { cosa: 'bano' }),
      ev('espacio_cosa', 'b', dia(s, 0, 9), { cosa: 'piso', nombre: 'Tu piso', cada: 7 }),
    ];
    const e = calcularEspacio(lista, dia(s + 1, 2, 10)); // miércoles de la semana siguiente
    const bano = e.a.find((c) => c.id === 'bano')!;
    expect(bano.dias).toBe(8);
    expect(bano.toca).toBe(true);
    expect(textoEspacio(bano)).toBe('Hace 8 días · ya toca');
    const hab = e.a.find((c) => c.id === 'hab')!;
    expect(hab.ultima).toBeNull();
    expect(textoEspacio(hab)).toBe('Sin marcar todavía · ya toca');
    // cada uno lo suyo
    expect(e.b.map((c) => c.nombre)).toEqual(['Tu piso']);
    expect(e.c).toBeUndefined();
    // recién hecho
    const hoy = calcularEspacio([...lista, ev('espacio_hecho', 'a', dia(s + 1, 2, 9), { cosa: 'bano' })], dia(s + 1, 2, 10)).a.find((c) => c.id === 'bano')!;
    expect(textoEspacio(hoy)).toBe('Hecho hoy · toca en 7 días');
  });

  it('se puede quitar, cambiar y volver a apuntar', () => {
    const lista = [
      ev('espacio_cosa', 'a', dia(s, 0, 9), { cosa: 'x', nombre: 'Armario', cada: 14 }),
      ev('espacio_hecho', 'a', dia(s, 0, 10), { cosa: 'x' }),
      ev('espacio_cosa', 'a', dia(s, 1, 9), { cosa: 'x', nombre: 'El armario', cada: 30 }),
    ];
    const c = calcularEspacio(lista, dia(s, 2)).a[0];
    expect([c.nombre, c.cada, c.faltan]).toEqual(['El armario', 30, 28]);
    const quitada = [...lista, ev('espacio_cosa_quitada', 'a', dia(s, 3), { cosa: 'x' })];
    expect(calcularEspacio(quitada, dia(s, 4)).a).toBeUndefined();
    const otraVez = [...quitada, ev('espacio_cosa', 'a', dia(s, 5), { cosa: 'x', nombre: 'Armario' })];
    expect(calcularEspacio(otraVez, dia(s, 5, 13)).a[0].ultima).toBeNull();
  });

  it('avisa solo a su dueño, el día que toca a las 19:00 y otra vez a los 3 días', () => {
    const lista = [
      ev('espacio_cosa', 'a', dia(s, 0, 9), { cosa: 'bano', nombre: 'Tu baño', cada: 7 }),
      ev('espacio_hecho', 'a', dia(s, 1, 20), { cosa: 'bano' }),
    ];
    // nada a los otros dos al apuntarlo
    expect(avisosDeEvento(config, lista, lista[1].id)).toEqual([]);
    const reloj = (w: number, d: number, h: number, l = lista) => avisosDelReloj(config, l, dia(w, d, h) - HORA, dia(w, d, h)).filter((x) => x.etiqueta.startsWith('espacio-'));
    const el = reloj(s + 1, 1, 19);
    expect(el.map((x) => [x.para, x.titulo])).toEqual([['a', '🧽 Tu baño lleva 7 días']]);
    expect(reloj(s + 1, 1, 18)).toEqual([]);
    expect(reloj(s + 1, 4, 19).map((x) => x.titulo)).toEqual(['🧽 Tu baño lleva 10 días']);
    // si lo hace antes, no hay segundo aviso
    const hecho = [...lista, ev('espacio_hecho', 'a', dia(s + 1, 2, 10), { cosa: 'bano' })];
    expect(reloj(s + 1, 4, 19, hecho)).toEqual([]);
    // y su espacio no cuenta para nada más
    expect(derivar(config, hecho, dia(s + 1, 5)).noticias.length).toBe(derivar(config, [], dia(s + 1, 5)).noticias.length);
  });
});
