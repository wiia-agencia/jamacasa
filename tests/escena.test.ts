import { describe, expect, it } from 'vitest';
import { avisosDeEvento } from '../src/core/avisos';
import { zonaDe, semanaInicial } from '../src/core/calendario';
import { diasSinLimpiar, escenaCasa, pisoDe, semanasSinLimpiar } from '../src/core/escena';
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
    expect(escenaCasa(e)!.pisos[piso]).toEqual(['limpiando', 0, 1, 0]);
    expect(e.noticias.some((x) => x.texto.startsWith('Ana ha empezado a limpiar'))).toBe(true);
    const avisos = avisosDeEvento(config, lista, lista[0].id);
    expect(avisos.map((x) => x.para).sort()).toEqual(['b', 'c']);
    // La segunda vez ya no avisa
    const otra = ev('zona_empezada', 'a', dia(s, 1, 20), { semana: s });
    expect(avisosDeEvento(config, [...lista, otra], otra.id)).toEqual([]);
  });

  it('«Lo que se limpia»: lo marcado cuenta, lo último de cada cosa manda y el piso se va limpiando', () => {
    const conLista: Config = { ...config, zonas: config.zonas.map((z) => ({ ...z, checklist: ['Suelo', 'Mesa', 'Baño', 'Escalera'] })) };
    const piso = zonaDe(conLista, s, 'a')!.id as 'abajo' | 'medio' | 'arriba';
    const marca = (cosa: string, h: number, hecha = true) => ev('zona_cosa', 'a', dia(s, 1, h), { semana: s, cosa, hecha });
    const lista = [ev('zona_empezada', 'a', dia(s, 1, 9), { semana: s }), marca('Suelo', 10), marca('Mesa', 11), marca('Mesa', 12, false), marca('Baño', 13), marca('Inventada', 14)];
    const e = derivar(conLista, lista, dia(s, 1, 15));
    const t = tareaDe(e, s, 'a')!;
    expect(t.lista).toEqual(['Suelo', 'Mesa', 'Baño', 'Escalera']);
    expect(t.marcadas).toEqual(['Suelo', 'Baño']);
    expect(escenaCasa(e)!.pisos[piso]).toEqual(['limpiando', 0, 1, 0.5]);
    // marcar no avisa a nadie
    expect(avisosDeEvento(conLista, lista, lista[1].id)).toEqual([]);
  });

  it('si se suspende, la lista vuelve a empezar; lo marcado después de «hecho» no cuenta', () => {
    const conLista: Config = { ...config, zonas: config.zonas.map((z) => ({ ...z, checklist: ['Suelo', 'Mesa'] })) };
    const marca = (cosa: string, d: number, h: number) => ev('zona_cosa', 'a', dia(s, d, h), { semana: s, cosa, hecha: true });
    const antes = [marca('Suelo', 1, 10), marca('Mesa', 1, 11), ev('zona_hecha', 'a', dia(s, 1, 12), { semana: s })];
    const tarde = marca('Suelo', 1, 13);
    const esperando = derivar(conLista, [...antes, tarde], dia(s, 1, 14));
    expect(tareaDe(esperando, s, 'a')!.estado).toBe('esperando');
    expect(tareaDe(esperando, s, 'a')!.marcadas).toEqual(['Suelo', 'Mesa']);
    const notas = ['b', 'c'].map((j) => ev('puntuacion', j, dia(s, 1, 15), { semana: s, de: 'a', intento: 1, nota: 3 }));
    const suspendida = derivar(conLista, [...antes, tarde, ...notas], dia(s, 1, 16));
    expect(tareaDe(suspendida, s, 'a')!.estado).toBe('suspendida');
    expect(tareaDe(suspendida, s, 'a')!.marcadas).toEqual([]);
    const otra = derivar(conLista, [...antes, tarde, ...notas, marca('Mesa', 1, 17)], dia(s, 1, 18));
    expect(tareaDe(otra, s, 'a')!.marcadas).toEqual(['Mesa']);
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

  it('la suciedad va por días: el lunes después de limpiar, casi nada; el domingo siguiente, ya una semana', () => {
    const lista = semanaLimpia(s, {});   // los tres limpian el miércoles de la primera semana
    const piso = zonaDe(config, s, 'a')!.id as 'abajo' | 'medio' | 'arriba';
    const lunes = derivar(config, lista, dia(s + 1, 0, 10));
    expect(diasSinLimpiar(lunes, piso)).toBe(5);
    expect(escenaCasa(lunes)!.pisos[piso]).toEqual(['sucio', 0, 5]);
    const domingo = derivar(config, lista, dia(s + 1, 6, 20));
    expect(escenaCasa(domingo)!.pisos[piso]).toEqual(['sucio', 1, 11]);
    // si lo limpian el domingo, el lunes lleva un día
    const dueño = config.miembros.find((m) => zonaDe(config, s + 1, m.id)!.id === piso)!.id;
    const tarde = [...lista, ev('zona_hecha', dueño, dia(s + 1, 6, 18), { semana: s + 1 })];
    expect(diasSinLimpiar(derivar(config, tarde, dia(s + 2, 0, 9)), piso)).toBe(1);
  });

  it('la basura llena sale en la cocina y se va acumulando de dos en dos hasta que la sacan', () => {
    const resp = derivar(config, [], dia(s, 0, 10)).basura!;
    const otro = config.miembros.find((m) => m.id !== resp)!.id;
    const llena = ev('basura_llena', otro, dia(s, 1, 9));
    expect(escenaCasa(derivar(config, [llena], dia(s, 1, 10)))!.basura).toEqual({ bolsas: 1, dias: 0 });
    expect(escenaCasa(derivar(config, [llena], dia(s, 2, 10)))!.basura).toEqual({ bolsas: 3, dias: 1 });
    expect(escenaCasa(derivar(config, [llena], dia(s, 3, 10)))!.basura).toEqual({ bolsas: 5, dias: 2 });
    expect(escenaCasa(derivar(config, [llena], dia(s + 1, 0, 10)))!.basura).toEqual({ bolsas: 12, dias: 6 });
    const sacada = ev('basura_sacada', resp, dia(s, 1, 12));
    expect(escenaCasa(derivar(config, [llena, sacada], dia(s, 1, 13)))!.basura).toBeNull();
    // si se pasa el plazo, sigue ahí hasta que la sacan
    const tardisima = ev('basura_sacada', resp, dia(s, 3, 12));
    expect(escenaCasa(derivar(config, [llena, tardisima], dia(s, 3, 11)))!.basura).toEqual({ bolsas: 5, dias: 2 });
    expect(escenaCasa(derivar(config, [llena, tardisima], dia(s, 3, 13)))!.basura).toBeNull();
  });

  it('el pasillo de arriba solo entra cuando el piso le toca a alguien que duerme ahí', () => {
    const conPasillo: Config = { ...config, zonas: config.zonas.map((z) => (z.id === 'arriba' ? { ...z, extras: [{ id: 'pasillo', nombre: 'El pasillo de las habitaciones', para: ['a', 'c'] }] } : z)) };
    for (const w of [s, s + 1, s + 2]) {
      const dueño = conPasillo.miembros.find((m) => zonaDe(conPasillo, w, m.id)!.id === 'arriba')!.id;
      const esc = escenaCasa(derivar(conPasillo, [], dia(w, 0, 10)))!;
      expect(esc.extras.arriba).toEqual(dueño === 'b' ? undefined : ['pasillo']);
    }
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
