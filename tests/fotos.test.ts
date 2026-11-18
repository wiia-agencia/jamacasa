// La foto de cada uno (Javi, 18 de noviembre: fuera de Limpieza, fotos de verdad y no los muñecos).
import { describe, expect, it } from 'vitest';
import { fotosDe } from '../src/core/estado';
import type { Config, Evento, MiembroId } from '../src/core/tipos';

const config = { miembros: [{ id: 'a', nombre: 'Ana', color: 'naranja' }, { id: 'b', nombre: 'Bea', color: 'verde' }] } as unknown as Config;
let n = 0;
const ev = (autor: MiembroId, datos: any): Evento => ({ id: `f${++n}`, tipo: 'foto_perfil', autor, ts: ++n, datos });

describe('Las fotos', () => {
  it('vale la última de cada uno; la puede poner otro; con null se quita', () => {
    expect(fotosDe(config, [ev('a', { foto: 'sb:a/1.jpg' }), ev('a', { foto: 'sb:a/2.jpg' })])).toEqual({ a: 'sb:a/2.jpg' });
    expect(fotosDe(config, [ev('a', { foto: 'sb:a/3.jpg', quien: 'b' })])).toEqual({ b: 'sb:a/3.jpg' });
    expect(fotosDe(config, [ev('a', { foto: 'sb:a/1.jpg' }), ev('b', { foto: null, quien: 'a' })])).toEqual({});
    expect(fotosDe(config, [ev('a', { foto: 'sb:a/1.jpg', quien: 'zz' })])).toEqual({ a: 'sb:a/1.jpg' });
  });
});
