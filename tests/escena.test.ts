import { describe, expect, it } from 'vitest';
import { avisosDeEvento } from '../src/core/avisos';
import { zonaDe, semanaInicial } from '../src/core/calendario';
import { escenaCasa, pisoDe, semanasSinLimpiar } from '../src/core/escena';
import { derivar, tareaDe } from '../src/core/estado';
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

/** Una semana en la que los tres limpian y los otros dos les ponen esa nota. */
function semanaLimpia(w: number, notas: Record<string, number>): Evento[] {
  const r: Evento[] = [];
  for (const m of config.miembros) {
    const t0 = dia(w, 2, 10 + r.length);
    r.push(ev('zona_hecha', m.id, t0, { semana: w }));
    for (const j of config.miembros.filter((x) => x.id !== m.id)) r.push(ev('puntuacion', j.id, t0 + HORA, { semana: w, de: m.id, intento: 1, nota: notas[m.id] ?? 8 }));
  }
  return r;
}

describe('la casa en 3D', () => {
  it('reconoce los pisos por su id o por su nombre', () => {
    expect(pisoDe({ id: 'arriba', nombre: 'Piso de arriba', incluye: '', checklist: [] })).toBe('arriba');
    expect(pisoDe({ id: 'p2', nombre: 'Piso del medio', incluye: '', checklist: [] })).toBe('medio');
    expect(pisoDe({ id: 'x', nombre: 'Terraza', incluye: '', checklist: [] })).toBeNull();
  });

  it('el lunes de la primera semana: cada uno en su piso, sin limpiar y mirando el móvil', () => {
    const e = derivar(config, [], dia(s, 0, 10));
    const esc = escenaCasa(e)!;
    for (const m of config.miembros) expect(esc.turnos[m.id]).toBe(zonaDe(config, s, m.id)!.id);
    expect(Object.values(esc.pisos).every(([estado, nivel]) => estado === 'sucio' && nivel === 0)).toBe(true);
    expect(esc.personas.a.accion).toBe('movil');
    expect(esc.rey).toBeNull();
  });

  it('«Empezar a limpiar» pone el piso en limpiando, sale en lo último y avisa a los otros dos', () => {
    const lista = [ev('zona_empezada', 'a', dia(s, 1, 18), { semana: s })];
    const e = derivar(config, lista, dia(s, 1, 19));
    const piso = zonaDe(config, s, 'a')!.id as 'abajo' | 'medio' | 'arriba';
    expect(tareaDe(e, s, 'a')!.empezada).toBe(lista[0].ts);
    expect(escenaCasa(e)!.pisos[piso]).toEqual(['limpiando', 0]);
    expect(e.noticias.some((x) => x.texto.startsWith('Ana ha empezado a limpiar'))).toBe(true);
    const avisos = avisosDeEvento(config, lista, lista[0].id);
    expect(avisos.map((x) => x.para).sort()).toEqual(['b', 'c']);
    // La segunda vez ya no avisa
    const otra = ev('zona_empezada', 'a', dia(s, 1, 20), { semana: s });
    expect(avisosDeEvento(config, [...lista, otra], otra.id)).toEqual([]);
  });

  it('aprobado brilla según la nota y el dueño descansa', () => {
    const e = derivar(config, semanaLimpia(s, { a: 9.5, b: 7.5, c: 6 }), dia(s, 4));
    const esc = escenaCasa(e)!;
    const pisoDe_ = (m: string) => zonaDe(config, s, m)!.id as 'abajo' | 'medio' | 'arriba';
    expect(esc.pisos[pisoDe_('a')]).toEqual(['limpio', 3]);
    expect(esc.pisos[pisoDe_('b')]).toEqual(['limpio', 2]);
    expect(esc.pisos[pisoDe_('c')]).toEqual(['limpio', 1]);
    expect(esc.personas.a.accion).toBeUndefined();
  });

  it('un piso sin limpiar se va estropeando semana a semana', () => {
    // Nadie limpia nada en tres semanas
    const e = derivar(config, [], dia(s + 3, 1));
    for (const piso of ['abajo', 'medio', 'arriba'] as const) expect(semanasSinLimpiar(e, piso, s + 3)).toBe(3);
    const esc = escenaCasa(e)!;
    expect(Object.values(esc.pisos).every(([estado, nivel]) => estado === 'sucio' && nivel === 3)).toBe(true);
    // y el muñeco está hundido, debe su piso y huele (dos semanas seguidas sin hacer el suyo)
    expect(esc.personas.a.accion).toBe('triste');
    expect(esc.personas.a.insignias).toEqual(expect.arrayContaining(['debe', 'peste']));
  });

  it('si el de la semana pasada lo hace tarde, el piso deja de contar como sucio', () => {
    const w = s + 1;
    const dueño = config.miembros.find((m) => zonaDe(config, s, m.id)!.id === 'abajo')!.id;
    const tarde = [...semanaLimpia(s, {}).filter((x) => x.autor !== dueño && x.datos?.de !== dueño), ev('zona_hecha', dueño, dia(w, 1, 9), { semana: s })];
    expect(semanasSinLimpiar(derivar(config, tarde.slice(0, -1), dia(w, 1, 8)), 'abajo', w)).toBe(1);
    expect(semanasSinLimpiar(derivar(config, tarde, dia(w, 1, 10)), 'abajo', w)).toBe(0);
  });

  it('racha con 3 pisos seguidos de 9 o más, y corona para el rey del mes', () => {
    const lista = [...semanaLimpia(s, { a: 9.5, b: 6, c: 6 }), ...semanaLimpia(s + 1, { a: 9, b: 6, c: 6 }), ...semanaLimpia(s + 2, { a: 10, b: 6, c: 6 })];
    const e = derivar(config, lista, dia(s + 3, 0, 10));
    const esc = escenaCasa(e)!;
    expect(esc.personas.a.insignias).toContain('racha');
    expect(esc.personas.b.insignias).not.toContain('racha');
    const reyes = e.titulos[e.mes]?.rey ?? [];
    expect(esc.rey).toBe(reyes.length === 1 ? reyes[0] : null);
  });
});
