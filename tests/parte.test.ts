import { describe, expect, it } from 'vitest';
import { semanaInicial } from '../src/core/calendario';
import { calcularEspacio } from '../src/core/espacio';
import { esDeTipo, parteDe, tipoCuarto } from '../src/core/parte';
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
  partes: { a: ['habitacion1', 'bano1', 'pasillo'], c: ['habitacion3', 'bano2', 'pasillo', 'pasillo'] },
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: string, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const s = semanaInicial(config);
const dia = (w: number, d: number, h = 12) => inicioSemana(w) + d * 24 * HORA + h * HORA;

describe('Mi parte', () => {
  it('el nombre del cuarto dice qué es', () => {
    expect(tipoCuarto('habitacion2')).toBe('habitacion');
    expect(tipoCuarto('bano1')).toBe('bano');
    expect(tipoCuarto('pasillo')).toBe('pasillo');
    expect(tipoCuarto('desvan')).toBe('otro');
  });

  it('junta cada cuarto con lo que se llama como él en «Tu espacio»', () => {
    expect(esDeTipo('habitacion', 'Mi habitación')).toBe(true);
    expect(esDeTipo('habitacion', 'El cuarto')).toBe(true);
    expect(esDeTipo('habitacion', 'Cuarto de baño')).toBe(false);
    expect(esDeTipo('bano', 'Cuarto de baño')).toBe(true);
    expect(esDeTipo('bano', 'Tu baño')).toBe(true);
    expect(esDeTipo('bano', 'La bañera')).toBe(false);
    expect(esDeTipo('pasillo', 'El pasillo de arriba')).toBe(true);
    expect(esDeTipo('pasillo', 'Tu piso')).toBe(false);
  });

  it('cada cuarto va por los días de lo suyo; sin apuntar, null; nunca marcado, al menos el primer día', () => {
    const eventos = [
      ev('espacio_cosa', 'a', dia(s, 0, 9), { cosa: 'x1', nombre: 'Tu habitación', cada: 7 }),
      ev('espacio_cosa', 'a', dia(s, 0, 9), { cosa: 'x2', nombre: 'Tu baño', cada: 7 }),
      ev('espacio_hecho', 'a', dia(s, 1, 20), { cosa: 'x1' }),
      // lo de otro no cuenta
      ev('espacio_cosa', 'b', dia(s, 0, 9), { cosa: 'pasillo', nombre: 'El pasillo', cada: 7 }),
    ];
    const ahora = dia(s, 4, 12);
    const p = parteDe(config, calcularEspacio(eventos, ahora).a ?? [], 'a');
    expect(p.map((c) => [c.id, c.tipo, c.dias])).toEqual([
      ['habitacion1', 'habitacion', 3],
      ['bano1', 'bano', 4],
      ['pasillo', 'pasillo', null],
    ]);
    expect(p.map((c) => c.brillo)).toEqual([0, 0, 0]);
    // apuntado hoy y sin marcar: sale con lo del primer día y sin brillos
    const hoy = [ev('espacio_cosa', 'a', dia(s, 4, 9), { cosa: 'pasillo', nombre: 'Lo de fuera', cada: 7 })];
    const pasillo = parteDe(config, calcularEspacio(hoy, ahora).a ?? [], 'a').find((c) => c.id === 'pasillo');
    expect([pasillo?.dias, pasillo?.brillo]).toEqual([1, 0]);
  });

  it('recién limpio, brilla: reluciente el mismo día y menos cada día', () => {
    const eventos = [
      ev('espacio_cosa', 'a', dia(s, 0, 9), { cosa: 'x1', nombre: 'Tu habitación', cada: 7 }),
      ev('espacio_hecho', 'a', dia(s, 3, 10), { cosa: 'x1' }),
    ];
    const brillo = (d: number) => parteDe(config, calcularEspacio(eventos, dia(s, d, 20)).a ?? [], 'a')[0].brillo;
    expect([brillo(3), brillo(4), brillo(5), brillo(6)]).toEqual([3, 2, 1, 0]);
  });

  it('lo apuntado desde el propio cuarto (con su nombre de id) gana a lo que solo se llama igual', () => {
    const eventos = [
      ev('espacio_cosa', 'c', dia(s, 0, 9), { cosa: 'y', nombre: 'Mi baño', cada: 7 }),
      ev('espacio_cosa', 'c', dia(s, 0, 9), { cosa: 'bano2', nombre: 'Baño', cada: 7 }),
      ev('espacio_hecho', 'c', dia(s, 2, 9), { cosa: 'bano2' }),
    ];
    const p = parteDe(config, calcularEspacio(eventos, dia(s, 3, 12)).c ?? [], 'c');
    expect(p.map((c) => c.id)).toEqual(['habitacion3', 'bano2', 'pasillo']); // sin repetir
    expect(p[1].cosa?.id).toBe('bano2');
    expect(p[1].dias).toBe(1);
  });

  it('sin parte en la config, nada', () => {
    expect(parteDe(config, [], 'b')).toEqual([]);
    expect(parteDe({ ...config, partes: undefined }, [], 'a')).toEqual([]);
  });
});
