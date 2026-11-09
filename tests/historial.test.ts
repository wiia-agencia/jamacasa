import { describe, expect, it } from 'vitest';
import { semanaInicial, zonaDe } from '../src/core/calendario';
import { derivar } from '../src/core/estado';
import { diaDeLaCasa, estadoDelDia, finDelDia, marcasDelMes, rejillaDelMes, resumenDelMes } from '../src/core/historial';
import { diaLocal, HORA, inicioSemana, mes } from '../src/core/tiempo';
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
const momento = (w: number, d: number, h = 12) => inicioSemana(w) + d * 24 * HORA + h * HORA;

describe('Historial', () => {
  // Ana limpia el martes, Bea y Cris le ponen nota el miércoles; Bea paga un gasto el jueves
  const lista = [
    ev('zona_empezada', 'a', momento(s, 1, 17), { semana: s }),
    ev('zona_hecha', 'a', momento(s, 1, 19), { semana: s }),
    ev('puntuacion', 'b', momento(s, 2, 10), { semana: s, de: 'a', intento: 1, nota: 9 }),
    ev('puntuacion', 'c', momento(s, 2, 11), { semana: s, de: 'a', intento: 1, nota: 8 }),
    ev('gasto', 'b', momento(s, 3, 13), { concepto: 'Lejía', categoria: 'limpieza', importe: 600, pagador: 'b', participantes: ['a', 'b', 'c'], fecha: '2026-10-08' }),
  ];
  const ahora = momento(s + 2, 0, 12);
  const dia = (d: number) => diaLocal(momento(s, d));

  it('cada día se ve como estaba al acabar el día', () => {
    expect(finDelDia(dia(1)) + 1).toBe(momento(s, 2, 0));
    const lunes = diaDeLaCasa(config, lista, dia(0), ahora);
    expect(lunes.personas.find((p) => p.miembro === 'a')!.situacion).toBe('sin_empezar');
    const martes = diaDeLaCasa(config, lista, dia(1), ahora);
    expect(martes.personas.find((p) => p.miembro === 'a')!.situacion).toBe('esperando');
    expect(martes.personas.find((p) => p.miembro === 'a')!.zona).toBe(zonaDe(config, s, 'a')!.nombre);
    const miercoles = diaDeLaCasa(config, lista, dia(2), ahora);
    const ana = miercoles.personas.find((p) => p.miembro === 'a')!;
    expect(ana.situacion).toBe('aprobado');
    expect(ana.nota).toBe(8.5);
    expect(ana.puntos).toBeGreaterThan(0); // sumó su nota ese día
    // lo de ese día y nada más
    expect(miercoles.noticias.every((x) => diaLocal(x.ts) === dia(2))).toBe(true);
    expect(martes.noticias.length).toBeGreaterThan(0);
  });

  it('el dinero de cada día es el de ese día', () => {
    expect(diaDeLaCasa(config, lista, dia(2), ahora).personas.find((p) => p.miembro === 'b')!.saldo).toBe(0);
    const jueves = diaDeLaCasa(config, lista, dia(3), ahora);
    expect(jueves.personas.find((p) => p.miembro === 'b')!.saldo).toBe(400);
    expect(jueves.personas.find((p) => p.miembro === 'a')!.saldo).toBe(-200);
  });

  it('un día futuro se ve como ahora, no como el futuro', () => {
    const e = estadoDelDia(config, lista, diaLocal(ahora) + 5, ahora);
    expect(e.ahora).toBe(ahora);
  });

  it('el calendario marca quién limpió, las notas y los pagos de cada día', () => {
    const marcas = marcasDelMes(config, lista, mes(momento(s, 1)), derivar(config, lista, ahora));
    expect(marcas.get(dia(1))!.limpiaron).toEqual(['a']);
    expect(marcas.get(dia(2))!.aprobados).toEqual(['a']);
    expect(marcas.get(dia(3))!.pagaron).toEqual(['b']);
    expect(marcas.get(dia(0))!.limpiaron).toEqual([]);
  });

  it('la rejilla del mes empieza en lunes', () => {
    const r = rejillaDelMes('2026-11'); // el 1 de noviembre de 2026 es domingo
    expect(r.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(r.filter((x) => x !== null).length).toBe(30);
  });
  it('las medallas salen el día que se ganaron', () => {
    // Bea saca un 10 el martes de la semana siguiente: Quirófano el día que se resuelve la nota
    const w = s + 1;
    const conDiez = [
      ...lista,
      ev('zona_hecha', 'b', momento(w, 0, 19), { semana: w }),
      ev('puntuacion', 'a', momento(w, 1, 9), { semana: w, de: 'b', intento: 1, nota: 10 }),
      ev('puntuacion', 'c', momento(w, 1, 10), { semana: w, de: 'b', intento: 1, nota: 10 }),
    ];
    const elDia = diaLocal(momento(w, 1));
    const bea = diaDeLaCasa(config, conDiez, elDia, ahora).personas.find((p) => p.miembro === 'b')!;
    expect(bea.medallas).toContain('quirofano');
    expect(diaDeLaCasa(config, conDiez, elDia - 1, ahora).personas.find((p) => p.miembro === 'b')!.medallas).toEqual([]);
    const marcas = marcasDelMes(config, conDiez, mes(momento(w, 1)), derivar(config, conDiez, ahora));
    expect(marcas.get(elDia)!.medallas.map((g) => [g.miembro, g.medalla])).toContainEqual(['b', 'quirofano']);
  });

  it('el alquiler: quién lo pagó y qué día', () => {
    const conAlquiler: Config = { ...config, alquiler: { total: 90000, paga: 'b', partes: { a: 30000, b: 30000, c: 30000 }, dia: 10, desde: '2026-10' } };
    const pago = ev('pago', 'a', momento(s, 2, 21), { de: 'a', a: 'b', importe: 30000, alquiler: '2026-10' });
    const eventos = [...lista, pago];
    const miercoles = diaDeLaCasa(conAlquiler, eventos, dia(2), ahora);
    expect(miercoles.personas.find((p) => p.miembro === 'a')!.alquiler).toMatchObject({ mes: '2026-10', pagado: true, dia: dia(2) });
    expect(miercoles.personas.find((p) => p.miembro === 'c')!.alquiler).toMatchObject({ pagado: false });
    expect(miercoles.personas.find((p) => p.miembro === 'b')!.alquiler).toBeNull(); // b es quien lo recibe
    const martes = diaDeLaCasa(conAlquiler, eventos, dia(1), ahora);
    expect(martes.personas.find((p) => p.miembro === 'a')!.alquiler!.pagado).toBe(false);
    const ya = derivar(conAlquiler, eventos, ahora);
    expect(marcasDelMes(conAlquiler, eventos, '2026-10', ya).get(dia(2))!.alquiler).toEqual(['a']);
    const r = resumenDelMes(conAlquiler, ya, '2026-10');
    expect(r.alquiler.find((x) => x.miembro === 'a')!.pagadoDia).toBe(dia(2));
    expect(r.alquiler.find((x) => x.miembro === 'c')!.pagadoDia).toBeUndefined();
  });

  it('«Tu espacio» solo se marca para quien mira', () => {
    const eventos = [
      ...lista,
      ev('espacio_cosa', 'a', momento(s, 0, 9), { cosa: 'bano', nombre: 'Tu baño', cada: 7 }),
      ev('espacio_hecho', 'a', momento(s, 3, 20), { cosa: 'bano' }),
    ];
    const ya = derivar(config, eventos, ahora);
    expect(marcasDelMes(config, eventos, '2026-10', ya, 'a').get(dia(3))!.espacio).toEqual(['Tu baño']);
    expect(marcasDelMes(config, eventos, '2026-10', ya, 'b').get(dia(3))!.espacio).toEqual([]);
    expect(diaDeLaCasa(config, eventos, dia(3), ahora, 'a').espacio[0].ultima).toBe(momento(s, 3, 20));
  });

  it('el resumen del mes dice cómo acabó cada semana', () => {
    const r = resumenDelMes(config, derivar(config, lista, ahora), '2026-10');
    const primera = r.semanas.find((x) => x.semana === s)!;
    expect(primera.personas.find((p) => p.miembro === 'a')).toMatchObject({ como: 'aprobado', nota: 8.5, hechoDia: dia(1) });
    // Bea y Cris no limpiaron esa semana: pasados los días de gracia queda «sin hacer»
    expect(primera.personas.find((p) => p.miembro === 'b')!.como).toBe('sin_hacer');
    expect(primera.racha).toBe('rota');
    expect(r.cerrado).toBe(false);
  });
});
