import { describe, expect, it } from 'vitest';
import { semanaInicial, zonaDe } from '../src/core/calendario';
import { derivar } from '../src/core/estado';
import { fraseDeHoy, paraTi, quedanDias, saludo, salasDe, tarjetasPisos, type Trozo } from '../src/core/hoy';
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
    { id: 'abajo', nombre: 'Piso de abajo', incluye: 'Cocina grande, salón, baño, pasillo del garaje y escaleras', checklist: ['Suelo', 'Mesa', 'Baño'] },
    { id: 'medio', nombre: 'Piso del medio', incluye: 'Entrada, salón, terraza y escalera', checklist: ['Suelo', 'Terraza'] },
    { id: 'arriba', nombre: 'Piso de arriba', incluye: 'Salón, entradilla, cocina y rellano', checklist: ['Suelo', 'Cocina'] },
  ],
  alquiler: { total: 0, paga: 'b', partes: {}, dia: 10, desde: '2026-10' },
  facturas: [],
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: string, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const s = semanaInicial(config) + 1;
const dia = (d: number, h = 12) => inicioSemana(s) + d * 24 * HORA + h * HORA;
const texto = (f: Trozo[]) => f.map((x) => (x.t === 'cristal' ? `[${x.texto}]` : x.t === 'negrita' ? `**${x.texto}**` : x.texto)).join('');

// Como la casa el jueves por la mañana: Ana sin empezar; Bea lo limpió el martes y se pone un 8 (le faltó una cosa);
// Cris, aprobado con un 9,5. Bea pagó una cena de 30 € entre los tres.
const eventos: Evento[] = [
  ev('zona_hecha', 'c', dia(0, 18), { semana: s }),
  ev('puntuacion', 'a', dia(0, 20), { semana: s, de: 'c', intento: 1, nota: 9 }),
  ev('puntuacion', 'b', dia(1, 9), { semana: s, de: 'c', intento: 1, nota: 10 }),
  ev('zona_hecha', 'b', dia(1, 19), { semana: s, notaPropia: 8, faltan: ['Terraza'] }),
  ev('gasto', 'b', dia(2, 21), { concepto: 'Cena', categoria: 'otro', importe: 3000, pagador: 'b', participantes: ['a', 'b', 'c'], fecha: '2026-10-14' }),
];
const e = derivar(config, eventos, dia(3, 9));

describe('Hoy: la frase, «Para ti» y los pisos en tarjetas', () => {
  it('el saludo va con la hora de Madrid', () => {
    expect(saludo(dia(3, 9))).toBe('Buenos días');
    expect(saludo(dia(3, 16))).toBe('Buenas tardes');
    expect(saludo(dia(3, 22))).toBe('Buenas noches');
  });

  it('los días que quedan de la semana y las estancias de cada piso', () => {
    expect(quedanDias(s, dia(3, 9))).toBe('quedan 3 días');
    expect(quedanDias(s, dia(5, 9))).toBe('queda 1 día');
    expect(quedanDias(s, dia(6, 9))).toBe('hoy es el último día');
    expect(salasDe(config.zonas[0])).toEqual(['Cocina grande', 'Salón', 'Baño', 'Pasillo del garaje', 'Escaleras']);
  });

  it('«Para ti»: la nota de Bea (encendida, con su botón), tu piso, la basura y lo que debes', () => {
    const p = paraTi(config, e, 'a');
    const nota = p.find((x) => x.clave.startsWith('nota:'))!;
    expect(nota.titulo).toBe('Nota de Bea');
    expect(nota.encendida).toBe(true);
    expect(nota.color).toBe('p:b');
    expect(nota.linea).toContain('Se puso un 8 y dice que le faltó 1 cosa');
    expect(nota.botones[0]).toMatchObject({ texto: 'Puntuar', accion: { tipo: 'puntuar', de: 'b', intento: 1 } });
    const piso = p.find((x) => x.clave === 'piso')!;
    expect(piso.titulo).toBe(zonaDe(config, s, 'a')!.nombre);
    expect(piso.sub).toBe('Te toca · quedan 3 días');
    expect(piso.cuenta).toEqual({ hechas: 0, total: zonaDe(config, s, 'a')!.checklist.length });
    expect(piso.botones.map((x) => x.texto)).toEqual(['Empezar', 'La lista']);
    expect(p.find((x) => x.clave === 'basura')).toBeTruthy();
    const cuentas = p.find((x) => x.clave === 'cuentas')!;
    expect(cuentas.titulo).toBe('Debes 10,00 €');
    expect(cuentas.sub).toBe('10 a Bea');
    // el orden: primero la nota que te toca, luego tu piso
    expect(p.findIndex((x) => x.clave.startsWith('nota:'))).toBeLessThan(p.findIndex((x) => x.clave === 'piso'));
  });

  it('la frase: saludo, la nota con su hora en negrita, tu piso y lo que debes, con cristales que abren su baldosa', () => {
    const f = fraseDeHoy(config, e, 'a');
    const z = zonaDe(config, s, 'a')!.nombre.toLowerCase();
    const cierre = e.tareas.find((x) => x.miembro === 'b' && x.semana === s)!.intentos[0].fin;
    const h = new Date(cierre).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    expect(texto(f)).toContain('Buenos días, Ana. ');
    expect(texto(f)).toContain(`Hoy antes de las **${h}** ponle nota a [Bea].`);
    expect(texto(f)).toContain(`Tu [${z}] sigue sin empezar: quedan 3 días.`);
    expect(texto(f)).toMatch(/[Dd]ebes \[10,00 €\]\./);
    // cada cristal lleva a una baldosa que existe
    const claves = paraTi(config, e, 'a').map((x) => x.clave);
    for (const c of f.filter((x) => x.t === 'cristal')) expect(claves).toContain((c as { clave: string }).clave);
  });

  it('mientras limpias: «va por 1 de 3» en la frase y «Seguir» en tu tarjeta', () => {
    const z = zonaDe(config, s, 'a')!;
    const mas = [ev('zona_empezada', 'a', dia(3, 10), { semana: s }), ev('zona_cosa', 'a', dia(3, 11), { semana: s, cosa: z.checklist[0], hecha: true })];
    const e2 = derivar(config, [...eventos, ...mas], dia(3, 12));
    expect(texto(fraseDeHoy(config, e2, 'a'))).toContain(`Tu [${z.nombre.toLowerCase()}] va por **1 de ${z.checklist.length}**`);
    const mia = tarjetasPisos(config, e2, 'a')[0];
    expect(mia.tuya).toBe(true);
    expect(mia.boton).toMatchObject({ texto: 'Seguir', accion: { tipo: 'lista', de: 'a' } });
    expect(paraTi(config, e2, 'a').find((x) => x.clave === 'piso')!.sub).toMatch(/^Limpiando · /);
  });

  it('los pisos en tarjetas: el tuyo primero; el de Bea te pide nota; el de Cris dice su nota', () => {
    const ts = tarjetasPisos(config, e, 'a');
    expect(ts).toHaveLength(3);
    expect(ts[0].miembro).toBe('a');
    expect(ts[0].sub).toBe('Esta semana, tú');
    expect(ts[0].boton).toMatchObject({ texto: 'Empezar' });
    expect(texto(ts[0].frase)).toContain('y llevas 0 de');
    const bea = ts.find((x) => x.miembro === 'b')!;
    expect(bea.boton).toMatchObject({ texto: 'Ponle nota', accion: { tipo: 'puntuar', de: 'b' } });
    expect(texto(bea.frase)).toContain('Lo limpió Bea el martes y **se pone un 8**. Le faltó 1 cosa. Se cierra');
    expect(bea.alTocar).toEqual({ tipo: 'tarea', semana: s, de: 'b' });
    const cris = ts.find((x) => x.miembro === 'c')!;
    expect(texto(cris.frase)).toContain('Lo limpió Cris el lunes, con un 9,5.');
    expect(cris.boton).toBeUndefined();
    expect(cris.dias).toBe(3);
    expect(cris.fresco).toBeCloseTo(1 - 3 / 7);
  });

  it('el piso de otro sin empezar: «Le echo una mano» (abre la hoja del cuadro)', () => {
    const e3 = derivar(config, eventos.slice(0, 3), dia(3, 9));
    const bea = tarjetasPisos(config, e3, 'a').find((x) => x.miembro === 'b')!;
    expect(texto(bea.frase)).toContain('Esta semana **aún no ha empezado**.');
    expect(bea.boton).toEqual({ texto: 'Le echo una mano', accion: { tipo: 'ponerme', de: 'b' }, tono: 'claro' });
  });

  it('sin nada pendiente: el saludo y «Nada pendiente por hoy» no salen nunca vacíos', () => {
    // Cris: su piso aprobado, no le toca puntuar a nadie (ya votó… no: Bea espera su nota)
    const f = texto(fraseDeHoy(config, e, 'c'));
    expect(f.startsWith('Buenos días, Cris. ')).toBe(true);
    expect(f).toContain('ponle nota a [Bea]');
    expect(f).toContain('está aprobado con un **9,5**');
  });
});

describe('tu tema: el color y la luz, con el sol', async () => {
  const { esOscuro, momentoDelSol, esColorTema, esLuzTema } = await import('../src/core/tema');
  const madrid = (iso: string) => Date.parse(`${iso}+01:00`);
  it('con el sol: de día claro, al atardecer y de noche oscuro, al amanecer claro', () => {
    expect(momentoDelSol(madrid('2026-11-19T13:00:00'))).toBe('dia');
    expect(momentoDelSol(madrid('2026-11-19T22:00:00'))).toBe('noche');
    expect(momentoDelSol(madrid('2026-11-19T17:55:00'))).toBe('atardecer');
    expect(momentoDelSol(madrid('2026-11-19T08:15:00'))).toBe('amanecer');
    expect(esOscuro('sol', false, madrid('2026-11-19T13:00:00'))).toBe(false);
    expect(esOscuro('sol', false, madrid('2026-11-19T22:00:00'))).toBe(true);
    expect(esOscuro('sol', true, madrid('2026-11-19T08:15:00'))).toBe(false);
  });
  it('como el móvil, claro u oscuro; y lo guardado se comprueba', () => {
    expect(esOscuro('auto', true, 0)).toBe(true);
    expect(esOscuro('auto', false, 0)).toBe(false);
    expect(esOscuro('oscuro', false, 0)).toBe(true);
    expect(esOscuro('claro', true, 0)).toBe(false);
    expect(esColorTema('morado')).toBe(true);
    expect(esColorTema('fucsia')).toBe(false);
    expect(esLuzTema('sol')).toBe(true);
    expect(esLuzTema(null)).toBe(false);
  });
});
