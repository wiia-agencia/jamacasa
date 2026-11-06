import { describe, expect, it } from 'vitest';
import { basuraDe, bolsaAntesDe, semanaInicial, zonaDe } from '../src/core/calendario';
import { calcularCuentas, leerImporte, repartir, simplificar, euros } from '../src/core/cuentas';
import { derivar, paraPuntuar, tareaDe } from '../src/core/estado';
import {
  diaSemana,
  finSemana,
  HORA,
  inicioSemana,
  instanteLocal,
  mesDeSemana,
  partes,
  rangoSemana,
  semana,
} from '../src/core/tiempo';
import type { Config, Evento } from '../src/core/tipos';

const config: Config = {
  nombre: 'Casa de prueba',
  inicio: '2026-10-05',
  semilla: 2026,
  miembros: [
    { id: 'a', nombre: 'Ana', color: '#f80' },
    { id: 'b', nombre: 'Bea', color: '#0a5' },
    { id: 'c', nombre: 'Cris', color: '#28f' },
  ],
  zonas: [
    { id: 'abajo', nombre: 'Piso de abajo', incluye: '', checklist: [] },
    { id: 'medio', nombre: 'Piso del medio', incluye: '', checklist: [] },
    { id: 'arriba', nombre: 'Piso de arriba', incluye: '', checklist: [] },
  ],
  alquiler: { total: 134500, paga: 'b', partes: { a: 42500, c: 39000, b: 53000 }, dia: 10, desde: '2026-10' },
  facturas: [],
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: string, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });

describe('tiempo', () => {
  it('las semanas van de lunes a domingo en hora de Madrid', () => {
    const lunes = instanteLocal(2026, 11, 2, 0, 0);
    expect(diaSemana(lunes)).toBe(0);
    expect(partes(lunes).h).toBe(0);
    const w = semana(lunes);
    expect(semana(lunes - 1)).toBe(w - 1);
    expect(semana(instanteLocal(2026, 11, 8, 23, 59))).toBe(w);
    expect(inicioSemana(w)).toBe(lunes);
    expect(finSemana(w)).toBe(instanteLocal(2026, 11, 9) - 1);
    expect(rangoSemana(w)).toBe('2–8 nov');
  });
  it('aguanta el cambio de hora de octubre', () => {
    // 25 oct 2026: a las 3:00 vuelven a ser las 2:00
    const w = semana(instanteLocal(2026, 10, 21, 12));
    expect(finSemana(w) - inicioSemana(w) + 1).toBe(7 * 24 * HORA + HORA);
    expect(mesDeSemana(w)).toBe('2026-10');
  });
  it('una semana entre dos meses cuenta para el mes en que termina', () => {
    const w = semana(instanteLocal(2026, 10, 28, 12)); // 26 oct – 1 nov
    expect(mesDeSemana(w)).toBe('2026-11');
  });
});

describe('rotación y basura', () => {
  const s = semanaInicial(config);
  it('nadie repite piso ni lo comparte, y cada uno hace todos los pisos', () => {
    for (let w = s; w < s + 30; w++) {
      const zonas = config.miembros.map((m) => zonaDe(config, w, m.id)!.id);
      expect(new Set(zonas).size).toBe(3);
      for (const m of config.miembros) expect(zonaDe(config, w, m.id)!.id).not.toBe(zonaDe(config, w + 1, m.id)!.id);
    }
    for (const m of config.miembros) {
      const tres = [0, 1, 2].map((k) => zonaDe(config, s + k, m.id)!.id);
      expect(new Set(tres).size).toBe(3);
    }
  });
  it('la basura sale de una bolsa: uno por semana y nunca dos semanas seguidas', () => {
    const lista = Array.from({ length: 60 }, (_, k) => basuraDe(config, s + k)!);
    for (let k = 0; k + 1 < lista.length; k++) expect(lista[k]).not.toBe(lista[k + 1]);
    for (let c = 0; c < 20; c++) expect(new Set(lista.slice(c * 3, c * 3 + 3)).size).toBe(3);
    expect(bolsaAntesDe(config, s)).toHaveLength(3);
    expect(bolsaAntesDe(config, s + 2)).toEqual([lista[2]]);
  });
  it('antes de empezar no hay reparto', () => {
    expect(zonaDe(config, s - 1, 'a')).toBeNull();
    expect(basuraDe(config, s - 1)).toBeNull();
  });
});

describe('marcar y puntuar', () => {
  const s = semanaInicial(config);
  const lunes = inicioSemana(s);
  it('con las dos notas se aprueba al momento y da puntos', () => {
    const hecho = ev('zona_hecha', 'a', lunes + 10 * HORA, { semana: s });
    const v1 = ev('puntuacion', 'b', lunes + 12 * HORA, { semana: s, de: 'a', intento: 1, nota: 8 });
    const v2 = ev('puntuacion', 'c', lunes + 13 * HORA, { semana: s, de: 'a', intento: 1, nota: 9 });
    const e = derivar(config, [hecho, v1, v2], lunes + 20 * HORA);
    const t = tareaDe(e, s, 'a')!;
    expect(t.estado).toBe('aprobada');
    expect(t.nota).toBe(8.5);
    expect(e.puntosMes['2026-10'].a).toBe(8.5);
    expect(e.puntosMes['2026-10'].b).toBe(1);
    expect(e.medallas.a.pole).toBe(1);
  });
  it('si solo vota uno, cuenta su nota al cerrar el plazo; si no vota nadie, un 7', () => {
    const h1 = ev('zona_hecha', 'a', lunes + 10 * HORA, { semana: s });
    const v = ev('puntuacion', 'b', lunes + 12 * HORA, { semana: s, de: 'a', intento: 1, nota: 6 });
    const h2 = ev('zona_hecha', 'b', lunes + 11 * HORA, { semana: s });
    const antes = derivar(config, [h1, v, h2], lunes + 30 * HORA);
    expect(tareaDe(antes, s, 'a')!.estado).toBe('esperando');
    expect(paraPuntuar(antes, 'c').map((x) => x.tarea.miembro).sort()).toEqual(['a', 'b']);
    const despues = derivar(config, [h1, v, h2], lunes + 60 * HORA);
    expect(tareaDe(despues, s, 'a')!.nota).toBe(6);
    const tb = tareaDe(despues, s, 'b')!;
    expect(tb.nota).toBe(7);
    expect(tb.intentos[0].auto).toBe(true);
    expect(despues.medallas.c.fantasma).toBe(2);
  });
  it('por debajo de 5 se suspende, resta y hay que repetir', () => {
    const h1 = ev('zona_hecha', 'c', lunes + 10 * HORA, { semana: s });
    const v1 = ev('puntuacion', 'a', lunes + 11 * HORA, { semana: s, de: 'c', intento: 1, nota: 4, fotos: ['x'] });
    const v2 = ev('puntuacion', 'b', lunes + 12 * HORA, { semana: s, de: 'c', intento: 1, nota: 5 });
    const h2 = ev('zona_hecha', 'c', lunes + 20 * HORA, { semana: s });
    const v3 = ev('puntuacion', 'a', lunes + 21 * HORA, { semana: s, de: 'c', intento: 2, nota: 7 });
    const v4 = ev('puntuacion', 'b', lunes + 22 * HORA, { semana: s, de: 'c', intento: 2, nota: 8 });
    const e1 = derivar(config, [h1, v1, v2], lunes + 15 * HORA);
    expect(tareaDe(e1, s, 'c')!.estado).toBe('suspendida');
    expect(e1.medallas.c.chapuzas).toBe(1);
    expect(e1.medallas.a.ojo).toBe(1);
    const e2 = derivar(config, [h1, v1, v2, h2, v3, v4], lunes + 30 * HORA);
    const t = tareaDe(e2, s, 'c')!;
    expect(t.estado).toBe('aprobada');
    expect(t.intentos).toHaveLength(2);
    expect(e2.puntosMes['2026-10'].c).toBe(-5 + 7.5);
  });
  it('marcar tarde resta 2 por día y pasado el miércoles, 15 más', () => {
    const fin = finSemana(s);
    const hecho = ev('zona_hecha', 'b', fin + 30 * HORA, { semana: s }); // martes
    const e = derivar(config, [hecho], fin + 31 * HORA);
    expect(tareaDe(e, s, 'b')!.retrasoDias).toBe(2);
    const e2 = derivar(config, [], fin + 4 * 24 * HORA);
    const t = tareaDe(e2, s, 'b')!;
    expect(t.sinHacer).toBe(true);
    expect(t.retrasoDias).toBe(4);
    expect(e2.apuntes.filter((x) => x.miembro === 'b' && (x.clase === 'retraso' || x.clase === 'sin_hacer')).reduce((a, x) => a + x.puntos, 0)).toBe(-8 - 15);
  });
});

describe('basura y esto es tuyo', () => {
  const s = semanaInicial(config);
  const lunes = inicioSemana(s);
  const resp = basuraDe(config, s)!;
  const otro = config.miembros.find((m) => m.id !== resp)!.id;
  it('aviso atendido a tiempo: sin queja y +3 al acabar la semana', () => {
    const av = ev('basura_llena', otro, lunes + 10 * HORA);
    const sa = ev('basura_sacada', resp, lunes + 14 * HORA);
    const e = derivar(config, [av, sa], finSemana(s) + HORA);
    const sem = e.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.avisos[0].estado).toBe('resuelto');
    expect(e.apuntes.find((a) => a.clase === 'basura')!.puntos).toBe(3);
  });
  it('aviso sin atender en 12 h: queja de −2 y sin los +3', () => {
    const av = ev('basura_llena', otro, lunes + 10 * HORA);
    const av2 = ev('basura_llena', otro, lunes + 15 * HORA); // insiste: mismo aviso
    const e = derivar(config, [av, av2], finSemana(s) + HORA);
    const sem = e.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.avisos).toHaveLength(1);
    expect(sem.quejas).toBe(1);
    expect(e.apuntes.filter((a) => a.miembro === resp && (a.clase === 'basura' || a.clase === 'queja')).map((a) => a.puntos)).toEqual([-2]);
  });
  it('esto es tuyo: −1 si no se recoge en 12 h', () => {
    const t = ev('esto_es_tuyo', 'a', lunes + HORA, { para: 'b', que: 'las pesas' });
    const ok = ev('esto_es_tuyo', 'a', lunes + 2 * HORA, { para: 'c' });
    const rec = ev('recogido', 'c', lunes + 3 * HORA, { aviso: ok.id });
    const e = derivar(config, [t, ok, rec], lunes + 20 * HORA);
    expect(e.tuyos.find((x) => x.id === t.id)!.estado).toBe('multa');
    expect(e.tuyos.find((x) => x.id === ok.id)!.estado).toBe('recogido');
    expect(e.titulos['2026-10'].calcetin.sort()).toEqual(['b', 'c']);
  });
  it('antes del primer lunes no cuenta: «Esto es tuyo» empieza con la casa, como la basura', () => {
    const antes = ev('esto_es_tuyo', 'a', lunes - 2 * HORA, { para: 'b', que: 'la mochila' });
    const e = derivar(config, [antes], lunes + 20 * HORA);
    expect(e.tuyos).toHaveLength(0);
    expect(e.apuntes.filter((a) => a.clase === 'tuyo')).toHaveLength(0);
  });
});

describe('cuentas', () => {
  it('reparte a partes iguales sin perder céntimos', () => {
    const p = repartir(1000, ['a', 'b', 'c'], 'b', ['a', 'b', 'c']);
    expect(p).toEqual({ a: 333, b: 334, c: 333 });
    expect(Object.values(repartir(51240, ['a', 'b', 'c'], 'c', ['a', 'b', 'c'])).reduce((x, y) => x + y, 0)).toBe(51240);
  });
  it('el alquiler se apunta solo cada mes y cada uno se lo debe al que paga', () => {
    const ahora = instanteLocal(2026, 11, 6, 12);
    const pagoOct = ev('pago', 'a', instanteLocal(2026, 10, 9, 10), { de: 'a', a: 'b', importe: 42500, alquiler: '2026-10' });
    const pagoOctC = ev('pago', 'c', instanteLocal(2026, 10, 13, 10), { de: 'c', a: 'b', importe: 39000, alquiler: '2026-10' });
    const c = calcularCuentas(config, [pagoOct, pagoOctC], ahora);
    expect(c.saldo).toEqual({ a: -42500, b: 81500, c: -39000 });
    const oct = c.alquiler.filter((x) => x.mes === '2026-10');
    expect(oct.find((x) => x.persona === 'a')!.diasTarde).toBe(0);
    expect(oct.find((x) => x.persona === 'c')!.diasTarde).toBe(3);
    expect(c.alquiler.filter((x) => x.mes === '2026-11' && !x.pagadoEn)).toHaveLength(2);
  });
  it('simplifica las deudas en dos Bizums como mucho', () => {
    const t = simplificar({ a: -5000, b: 8000, c: -3000 });
    expect(t).toEqual([
      { de: 'a', a: 'b', importe: 5000 },
      { de: 'c', a: 'b', importe: 3000 },
    ]);
  });
  it('un gasto común lo reparte y cuenta para el Banco', () => {
    const ahora = instanteLocal(2026, 10, 20, 12);
    const g = ev('gasto', 'c', ahora - HORA, { concepto: 'Gasóleo', categoria: 'gasoleo', importe: 51240, pagador: 'c', participantes: ['a', 'b', 'c'], fecha: '2026-10-20' });
    const e = derivar({ ...config, alquiler: { ...config.alquiler, total: 0 } }, [g], ahora);
    expect(e.cuentas.saldo).toEqual({ a: -17080, b: -17080, c: 34160 });
    expect(e.titulos['2026-10'].banco).toEqual(['c']);
  });
  it('lee importes como los escribe la gente', () => {
    expect(leerImporte('36,8')).toBe(3680);
    expect(leerImporte('36.80')).toBe(3680);
    expect(leerImporte('1.345,50')).toBe(134550);
    expect(leerImporte('1345')).toBe(134500);
    expect(leerImporte('abc')).toBeNull();
    expect(leerImporte('0')).toBeNull();
    expect(euros(4840)).toBe('48,40 €');
  });
});

describe('mes de ejemplo', () => {
  it('genera un mes creíble para cualquier casa sin romper nada', async () => {
    const { generarPrueba, configPrueba } = await import('../src/datos/prueba');
    const ahora = instanteLocal(2026, 11, 6, 20, 30);
    const c = configPrueba(ahora);
    const e = derivar(c, generarPrueba(c, ahora), ahora);
    const [a, b, cc] = c.miembros.map((m) => m.id);
    expect(e.medallas[a].quirofano).toBe(1);
    expect(e.medallas[b].chapuzas).toBe(1);
    expect(e.medallas[cc].rompe).toBe(1);
    expect(paraPuntuar(e, a).map((x) => x.tarea.miembro)).toEqual([b]);
    expect(e.racha.actual).toBe(2); // el suspenso de la semana 3 no rompe la racha: se marcó a tiempo
    expect(e.cuentas.alquiler.filter((x) => x.mes === '2026-10' && x.diasTarde > 0)).toHaveLength(1);
  });
});

describe('racha', () => {
  it('cuenta si los tres marcan dentro de su semana, aunque luego suspendan', () => {
    const s = semanaInicial(config);
    const ev2: Evento[] = [];
    for (const m of ['a', 'b', 'c']) ev2.push(ev('zona_hecha', m, inicioSemana(s) + 20 * HORA, { semana: s }));
    ev2.push(ev('puntuacion', 'a', inicioSemana(s) + 22 * HORA, { semana: s, de: 'b', intento: 1, nota: 2, faltan: ['x'] }));
    ev2.push(ev('puntuacion', 'c', inicioSemana(s) + 23 * HORA, { semana: s, de: 'b', intento: 1, nota: 3, faltan: ['x'] }));
    for (const m of ['a', 'b']) ev2.push(ev('zona_hecha', m, inicioSemana(s + 1) + 20 * HORA, { semana: s + 1 }));
    const e = derivar(config, ev2, inicioSemana(s + 2) + HORA);
    expect(e.racha.historial.map((h) => h.estado)).toEqual(['ok', 'rota']);
    expect(e.racha.historial[1].culpables).toEqual(['c']);
  });
});
