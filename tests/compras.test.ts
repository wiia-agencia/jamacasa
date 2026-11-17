// Compras de casa (Javi, 17 de noviembre): el súper de casa es de turno (le toca al que menos ha aportado), no deuda;
// «Se ha acabado…» le llega a quien le toca y se lo recuerda cada vez más; «Ahora no puedo» pasa al siguiente.
import { describe, expect, it } from 'vitest';
import { avisosDeEvento, avisosDelReloj } from '../src/core/avisos';
import { horasRecuerdo } from '../src/core/compras';
import { semanaInicial } from '../src/core/calendario';
import { derivar } from '../src/core/estado';
import { HORA, inicioSemana } from '../src/core/tiempo';
import type { Config, Evento, MiembroId } from '../src/core/tipos';

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
    { id: 'abajo', nombre: 'Piso de abajo', incluye: '', checklist: ['Suelo'] },
    { id: 'medio', nombre: 'Piso del medio', incluye: '', checklist: ['Suelo'] },
    { id: 'arriba', nombre: 'Piso de arriba', incluye: '', checklist: ['Suelo'] },
  ],
  alquiler: { total: 0, paga: 'b', partes: {}, dia: 10, desde: '2026-10' },
  facturas: [],
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: MiembroId, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const s = semanaInicial(config);
const dia = (d: number, h = 12) => inicioSemana(s) + d * 24 * HORA + h * HORA;
const compra = (quien: MiembroId, ts: number, importe: number, extra: any = {}) =>
  ev('gasto', quien, ts, { concepto: 'Súper', categoria: 'compra', importe, pagador: quien, participantes: ['a', 'b', 'c'], fecha: '2026-10-06', ...extra });

describe('El súper de casa', () => {
  it('no es deuda: cuenta en el marcador, y le toca al que menos ha aportado', () => {
    const e = derivar(config, [compra('a', dia(0), 900), compra('b', dia(1), 300)], dia(2));
    expect(e.cuentas.saldo).toEqual({ a: 0, b: 0, c: 0 });
    expect(e.super.aportado).toEqual({ a: 900, b: 300, c: 0 });
    expect(e.super.toca).toBe('c');
    // las facturas siguen siendo deuda
    const f = derivar(config, [ev('gasto', 'a', dia(0), { concepto: 'Luz', categoria: 'luz', importe: 900, pagador: 'a', participantes: ['a', 'b', 'c'], fecha: '2026-10-05' })], dia(1));
    expect(f.cuentas.saldo.a).toBe(600);
  });

  it('si el que menos ha aportado está fuera, le toca al siguiente', () => {
    const fuera = ev('fuera', 'c', dia(0), { desde: dia(0, 0), hasta: dia(5, 23) });
    expect(derivar(config, [compra('a', dia(0), 900), compra('b', dia(1), 300), fuera], dia(2)).super.toca).toBe('b');
  });
});

describe('«Se ha acabado…»', () => {
  const falta = ev('falta', 'a', dia(1, 10), { cosa: 'Aceite' });

  it('le llega a quien le toca; «Ahora no puedo» (solo suyo) pasa al siguiente; «Lo compré» lo acaba', () => {
    const base = [compra('a', dia(0), 900), compra('b', dia(0, 13), 300), falta];
    let e = derivar(config, base, dia(1, 11));
    expect(e.super.faltas[0]).toMatchObject({ cosa: 'Aceite', pide: 'a', toca: 'c' });
    expect(avisosDeEvento(config, base, falta.id)).toMatchObject([{ para: 'c', titulo: '🛒 Se ha acabado: aceite' }]);
    // Ana no puede pasarlo (no le toca); Cris sí
    const pasoA = ev('falta_paso', 'a', dia(1, 12), { falta: falta.id });
    const pasoC = ev('falta_paso', 'c', dia(1, 13), { falta: falta.id });
    e = derivar(config, [...base, pasoA, pasoC], dia(1, 14));
    expect(e.super.faltas[0]).toMatchObject({ toca: 'b', pasaron: ['c'] });
    expect(avisosDeEvento(config, [...base, pasoA, pasoC], pasoC.id)).toMatchObject([{ para: 'b', titulo: '🛒 Te toca comprar: aceite' }]);
    // Bea lo compra: se acaba, cuenta para ella y se lo dice a Ana
    const lo = compra('b', dia(2), 364, { concepto: 'Aceite', falta: falta.id });
    e = derivar(config, [...base, pasoA, pasoC, lo], dia(2, 13));
    expect(e.super.faltas[0].comprada).toMatchObject({ quien: 'b', importe: 364 });
    expect(e.super.aportado.b).toBe(664);
    expect(avisosDeEvento(config, [...base, pasoA, pasoC, lo], lo.id)).toMatchObject([{ para: 'a', titulo: '✅ Bea ha comprado: aceite' }]);
  });

  it('se recuerda una vez al día; desde el 5.º día, cinco; desde el 7.º, doce; con «Una vez al día», una', () => {
    expect(horasRecuerdo(0, false)).toEqual([]);
    expect(horasRecuerdo(3, false)).toHaveLength(1);
    expect(horasRecuerdo(5, false)).toHaveLength(5);
    expect(horasRecuerdo(8, false)).toHaveLength(12);
    expect(horasRecuerdo(8, true)).toHaveLength(1);
    const unDia = (d: number, evs: Evento[]) => avisosDelReloj(config, evs, dia(d, 0), dia(d, 23)).filter((x) => x.etiqueta === `falta-${falta.id}`).length;
    expect(unDia(2, [falta])).toBe(1);
    expect(unDia(7, [falta])).toBe(5);
    expect(unDia(9, [falta])).toBe(12);
    // «Una vez al día» lo pone quien le toca
    const toca = derivar(config, [falta], dia(1, 11)).super.faltas[0].toca;
    expect(unDia(9, [falta, ev('compras_suave', toca, dia(1), { suave: true })])).toBe(1);
  });
});
