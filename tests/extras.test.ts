// Tareas extra (Javi, 18 de noviembre; lo pidió Josu): «hoy ordené el salón… el horno… las ventanas… las escaleras».
// Lo eligió Javi: +1, +2 o +3 según lo grande (lo dice quien lo hace), cuenta solo y los otros tienen 48 h para decir
// «no vale», y como mucho 6 puntos a la semana.
import { describe, expect, it } from 'vitest';
import { avisosDeEvento } from '../src/core/avisos';
import { semanaInicial } from '../src/core/calendario';
import { derivar } from '../src/core/estado';
import { calcularExtras, enPlazo, llevaSemana } from '../src/core/extras';
import { HORA, inicioSemana } from '../src/core/tiempo';
import type { Config, Evento, MiembroId } from '../src/core/tipos';
import { normasDe } from '../src/core/calendario';

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
const normas = normasDe(config);

let n = 0;
const ev = (tipo: Evento['tipo'], autor: MiembroId, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const s = semanaInicial(config);
const dia = (d: number, h = 12) => inicioSemana(s) + d * 24 * HORA + h * HORA;
const extra = (autor: MiembroId, ts: number, que: string, puntos: number, mas: any = {}) => ev('extra', autor, ts, { que, puntos, ...mas });

describe('Una tarea extra', () => {
  it('cuenta sola: suma lo que dice quien la hizo, sale en lo último y en sus puntos del mes', () => {
    const x = extra('a', dia(1), 'El horno', 2);
    const e = derivar(config, [x], dia(1, 13));
    expect(e.apuntes.find((a) => a.clase === 'extra')).toMatchObject({ miembro: 'a', puntos: 2, motivo: 'Extra: el horno' });
    expect(e.noticias.find((y) => y.id === `${x.id}-x`)!.texto).toBe('Ana ha hecho un extra: el horno (+2).');
    expect(e.puntosMes[e.mes].a).toBe(2);
  });

  it('se dice +1, +2 o +3 (lo demás se ajusta) y hace falta decir qué', () => {
    const xs = calcularExtras(config, normas, [extra('a', dia(0), 'Ventanas', 5), extra('b', dia(0), 'Salón', 0), extra('c', dia(0), 'Escaleras', NaN), extra('a', dia(0), '  ', 2)]);
    expect(xs.map((x) => [x.que, x.puntos])).toEqual([['Ventanas', 3], ['Salón', 1], ['Escaleras', 1]]);
  });

  it('quien la apuntó la puede quitar (y nadie más)', () => {
    const x = extra('a', dia(1), 'El horno', 3);
    expect(calcularExtras(config, normas, [x, ev('extra_anulado', 'b', dia(1, 14), { extra: x.id })])[0].cuenta).toBe(3);
    const e = derivar(config, [x, ev('extra_anulado', 'a', dia(1, 14), { extra: x.id })], dia(2));
    expect(e.extras[0]).toMatchObject({ cuenta: 0 });
    expect(e.apuntes.some((a) => a.clase === 'extra')).toBe(false);
    expect(e.noticias.some((y) => y.id === `${x.id}-x`)).toBe(false);
  });
});

describe('«No vale»', () => {
  const x = extra('a', dia(1), 'El horno', 3);

  it('los otros tienen 48 horas para decirlo: entonces no suma', () => {
    const no = ev('extra_no_vale', 'b', dia(2), { extra: x.id, porque: 'Era de su piso' });
    const e = derivar(config, [x, no], dia(3));
    expect(e.extras[0]).toMatchObject({ cuenta: 0, noVale: [{ autor: 'b', puntos: 0, porque: 'Era de su piso' }] });
    expect(e.apuntes.some((a) => a.clase === 'extra')).toBe(false);
    expect(e.noticias.find((y) => y.id === `${no.id}-xn`)!.texto).toBe('Bea dice que el extra de Ana no vale: el horno. «Era de su piso»');
    // pasadas las 48 horas, ya no
    const tarde = ev('extra_no_vale', 'b', dia(3, 13), { extra: x.id });
    expect(calcularExtras(config, normas, [x, tarde])[0].cuenta).toBe(3);
    // ni uno mismo
    expect(calcularExtras(config, normas, [x, ev('extra_no_vale', 'a', dia(2), { extra: x.id })])[0].cuenta).toBe(3);
  });

  it('o vale menos («Vale +1»): cuenta lo más bajo que se diga', () => {
    const uno = ev('extra_no_vale', 'b', dia(2), { extra: x.id, puntos: 1 });
    const dos = ev('extra_no_vale', 'c', dia(2, 14), { extra: x.id, puntos: 2 });
    expect(calcularExtras(config, normas, [x, dos])[0].cuenta).toBe(2);
    expect(calcularExtras(config, normas, [x, uno, dos])[0].cuenta).toBe(1);
    // decir que vale más de lo que dijo no sube nada
    expect(calcularExtras(config, normas, [x, ev('extra_no_vale', 'b', dia(2), { extra: x.id, puntos: 5 })])[0]).toMatchObject({ cuenta: 3, noVale: [] });
  });

  it('se puede cambiar de idea dentro del plazo (vale lo último de cada uno)', () => {
    const no = ev('extra_no_vale', 'b', dia(2), { extra: x.id });
    const si = ev('extra_no_vale', 'b', dia(2, 18), { extra: x.id, deja: true });
    expect(calcularExtras(config, normas, [x, no, si])[0]).toMatchObject({ cuenta: 3, noVale: [] });
    expect(enPlazo(calcularExtras(config, normas, [x])[0], dia(3, 11))).toBe(true);
    expect(enPlazo(calcularExtras(config, normas, [x])[0], dia(3, 13))).toBe(false);
  });
});

describe('Como mucho 6 a la semana', () => {
  it('lo que pasa de 6 no suma; la semana siguiente vuelve a empezar', () => {
    const xs = calcularExtras(config, normas, [extra('a', dia(0), 'Horno', 3), extra('a', dia(1), 'Ventanas', 2), extra('a', dia(2), 'Nevera', 3), extra('a', dia(3), 'Terraza', 1), extra('a', dia(8), 'Garaje', 3)]);
    expect(xs.map((x) => [x.cuenta, x.tope])).toEqual([[3, false], [2, false], [1, true], [0, true], [3, false]]);
    expect(llevaSemana(xs, 'a', s)).toBe(6);
    expect(llevaSemana(xs, 'a', s + 1)).toBe(3);
    // cada uno tiene sus 6
    expect(calcularExtras(config, normas, [extra('a', dia(0), 'Horno', 3), extra('a', dia(0, 13), 'Horno', 3), extra('b', dia(1), 'Salón', 3)])[2].cuenta).toBe(3);
  });

  it('si uno no vale, deja sitio a los demás', () => {
    const h = extra('a', dia(0), 'Horno', 3);
    const v = extra('a', dia(1), 'Ventanas', 3);
    const ne = extra('a', dia(2), 'Nevera', 3);
    expect(calcularExtras(config, normas, [h, v, ne])[2].cuenta).toBe(0);
    expect(calcularExtras(config, normas, [h, v, ne, ev('extra_no_vale', 'c', dia(1, 9), { extra: h.id })])[2].cuenta).toBe(3);
  });
});

describe('Los avisos', () => {
  it('a los otros dos (no a quien está fuera), para que puedan decir que no vale', () => {
    const x = extra('a', dia(1), 'El horno', 3);
    const r = avisosDeEvento(config, [x], x.id);
    expect(r.map((y) => y.para).sort()).toEqual(['b', 'c']);
    expect(r[0]).toMatchObject({ titulo: '✨ Ana ha hecho un extra: el horno (+3)', pantalla: 'juego' });
    expect(r[0].texto).toContain('48 horas');
    const fuera = ev('fuera', 'c', dia(0), { desde: dia(0, 0), hasta: dia(3, 23) });
    expect(avisosDeEvento(config, [fuera, x], x.id).map((y) => y.para)).toEqual(['b']);
  });

  it('el «no vale» (o el «vale menos») le llega a quien lo hizo', () => {
    const x = extra('a', dia(1), 'El horno', 3);
    const no = ev('extra_no_vale', 'b', dia(2), { extra: x.id, porque: 'Estaba limpio' });
    expect(avisosDeEvento(config, [x, no], no.id)).toEqual([expect.objectContaining({ para: 'a', titulo: '🙅 Bea dice que tu extra no vale: el horno', texto: '«Estaba limpio»' })]);
    const menos = ev('extra_no_vale', 'c', dia(2), { extra: x.id, puntos: 1 });
    expect(avisosDeEvento(config, [x, menos], menos.id)[0]).toMatchObject({ para: 'a', titulo: '✋ Cris dice que tu extra vale +1: el horno' });
    // pasado el plazo, nada
    const tarde = ev('extra_no_vale', 'b', dia(4), { extra: x.id });
    expect(avisosDeEvento(config, [x, tarde], tarde.id)).toEqual([]);
  });
});
