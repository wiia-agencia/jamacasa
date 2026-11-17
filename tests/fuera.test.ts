// «Estoy fuera» (Javi, 17 de noviembre): fechas, piso libre (se queda sin limpiar y nadie pierde puntos), la basura al
// siguiente que está en casa y sin avisos para quien se ha ido.
import { describe, expect, it } from 'vitest';
import { avisosDeEvento, avisosDelReloj } from '../src/core/avisos';
import { responsableEn } from '../src/core/basura';
import { bocadilloDe } from '../src/core/bocadillos';
import { basuraDe, semanaInicial, zonaDe } from '../src/core/calendario';
import { escenaCasa } from '../src/core/escena';
import { derivar, tareaDe } from '../src/core/estado';
import { calcularFuera, diasFuera, estaFuera, pisoLibre, siguienteEnCasa } from '../src/core/fuera';
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
const inicio = (d: number) => inicioSemana(s) + d * 24 * HORA;
const fin = (d: number) => inicioSemana(s) + (d + 1) * 24 * HORA - 1;
const tiene = basuraDe(config, s)!;
const sig = (m: MiembroId) => { const ids = config.miembros.map((x) => x.id); return ids[(ids.indexOf(m) + 1) % 3]; };

describe('Las fechas', () => {
  it('vale lo apuntado; se anula, o «Ya he vuelto» lo acorta', () => {
    const f = ev('fuera', 'a', dia(0, 9), { desde: inicio(2), hasta: fin(6) });
    const otro = ev('fuera', 'b', dia(0, 9), { desde: inicio(1), hasta: fin(1), quien: 'c' }); // lo apunta Bea por Cris
    expect(calcularFuera(config, [f, otro]).map((x) => [x.quien, x.por])).toEqual([['c', 'b'], ['a', 'a']]);
    expect(calcularFuera(config, [f, ev('fuera_anulado', 'a', dia(1), { id: f.id })])).toHaveLength(0);
    const vuelta = calcularFuera(config, [f, ev('fuera_anulado', 'a', dia(4), { id: f.id, hasta: dia(4) })]);
    expect(vuelta[0].hasta).toBe(dia(4));
  });

  it('4 días fuera de una semana (o más): su piso queda libre', () => {
    const cuatro = calcularFuera(config, [ev('fuera', 'a', dia(0), { desde: inicio(3), hasta: fin(6) })]);
    expect(diasFuera(cuatro, 'a', s)).toBe(4);
    expect(pisoLibre(cuatro, 'a', s)).toBe(true);
    const tres = calcularFuera(config, [ev('fuera', 'a', dia(0), { desde: inicio(4), hasta: fin(6) })]);
    expect(pisoLibre(tres, 'a', s)).toBe(false);
    expect(estaFuera(tres, 'a', dia(5))).toBe(true);
    expect(estaFuera(tres, 'a', dia(3))).toBe(false);
    expect(siguienteEnCasa(config, tres, 'c', dia(5))).toBe('b'); // después de Cris va Ana, pero está fuera
  });
});

describe('El piso libre', () => {
  const fuera = ev('fuera', 'a', dia(0, 9), { desde: inicio(1), hasta: fin(6) });

  it('si nadie lo limpia, se queda así: ni retraso ni «sin hacer»', () => {
    const e = derivar(config, [fuera], dia(10)); // el jueves de la semana siguiente: ya habría retraso y «sin hacer»
    const t = tareaDe(e, s, 'a')!;
    expect(t.libre).toBe(true);
    expect(t).toMatchObject({ estado: 'pendiente', retrasoDias: 0, sinHacer: false });
    expect(e.apuntes.filter((x) => x.miembro === 'a' && (x.clase === 'retraso' || x.clase === 'sin_hacer'))).toHaveLength(0);
    // los otros dos, como siempre
    expect(tareaDe(e, s, 'b')!.sinHacer).toBe(true);
  });

  it('si alguien lo limpia, se lleva lo de siempre', () => {
    const cubre = ev('zona_cubierta', 'b', dia(2, 10), { semana: s, de: 'a' });
    const hecho = ev('zona_hecha', 'b', dia(2, 12), { semana: s, de: 'a', notaPropia: 9, faltan: [] });
    const e = derivar(config, [fuera, cubre, hecho], dia(5));
    expect(e.apuntes.find((x) => x.clase === 'zona' && x.miembro === 'b')?.puntos).toBeGreaterThan(0);
  });

  it('en la casa en 3D: su muñeco no está y su bocadillo dice que está fuera', () => {
    const e = derivar(config, [fuera], dia(3));
    expect(escenaCasa(e)!.personas.a.fuera).toBe(true);
    expect(bocadilloDe(config, e, 'a', 'b')).toMatchObject({ titulo: '✈️ Ana está fuera' });
    expect(bocadilloDe(config, e, 'a', 'a')).toMatchObject({ titulo: '✈️ Estás fuera' });
  });
});

describe('La basura y los avisos', () => {
  it('mientras quien la tiene está fuera, la lleva el siguiente que está en casa; al volver, vuelve a ser suya', () => {
    const f = ev('fuera', tiene, dia(0, 9), { desde: inicio(1), hasta: fin(2) });
    const e = derivar(config, [f], dia(5));
    const sb = e.semanasBasura.find((x) => x.semana === s)!;
    expect(responsableEn(sb, dia(0))).toBe(tiene);
    expect(responsableEn(sb, dia(1))).toBe(sig(tiene));
    expect(responsableEn(sb, dia(4))).toBe(tiene);
    expect(sb.tramos.find((x) => x.fuera === tiene)?.quien).toBe(sig(tiene));
    // un «Basura llena» mientras está fuera le llega al que la lleva
    const aviso = ev('basura_llena', 'b' === tiene ? 'c' : 'b', dia(1, 10));
    const r = avisosDeEvento(config, [f, aviso], aviso.id);
    expect(r.map((x) => x.para)).not.toContain(tiene);
  });

  it('a quien está fuera no le llega nada (ni lo del reloj)', () => {
    const f = ev('fuera', 'a', dia(0, 9), { desde: inicio(0), hasta: fin(6) });
    const hecho = ev('zona_hecha', 'b', dia(1), { semana: s, notaPropia: 8, faltan: [] });
    expect(avisosDeEvento(config, [f, hecho], hecho.id).map((x) => x.para)).toEqual(['c']);
    expect(avisosDelReloj(config, [f, hecho], dia(1), dia(4)).some((x) => x.para === 'a')).toBe(false);
  });

  it('el «Estoy fuera» se lo dice a los otros dos, con su piso libre', () => {
    const f = ev('fuera', 'a', dia(0, 9), { desde: inicio(1), hasta: fin(6) });
    const r = avisosDeEvento(config, [f], f.id);
    expect(r.map((x) => x.para).sort()).toEqual(['b', 'c']);
    expect(r[0].titulo).toContain('Ana está fuera');
    expect(r[0].texto).toContain(`su ${zonaDe(config, s, 'a')!.nombre.toLowerCase()} queda libre`);
    const e = derivar(config, [f], dia(1));
    expect(e.noticias.find((x) => x.id === `${f.id}-fu`)!.texto).toContain('queda libre');
  });
});
