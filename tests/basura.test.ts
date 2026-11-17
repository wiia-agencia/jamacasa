// La basura clara (Javi, 17 de noviembre): cuántas bolsas hay y quién avisa, «¿Cuándo la sacaste?» si lo apuntas más
// tarde y «Recuérdamelo» si la tienes tú.
import { describe, expect, it } from 'vitest';
import { avisosDeEvento, avisosDelReloj } from '../src/core/avisos';
import { ATRAS_MAX, cuandoSacada } from '../src/core/basura';
import { basuraDe, semanaInicial } from '../src/core/calendario';
import { basuraEnCasa } from '../src/core/escena';
import { basuraAhora, derivar } from '../src/core/estado';
import { HORA, hora, inicioSemana } from '../src/core/tiempo';
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
const tiene = basuraDe(config, s)!;
const [uno, otro] = config.miembros.map((m) => m.id).filter((m) => m !== tiene);
const semanaDe = (evs: Evento[], ahora: number) => derivar(config, evs, ahora).semanasBasura.find((x) => x.semana === s)!;

describe('«¿Cuándo la sacaste?»', () => {
  it('vale la hora que se dice, nunca después de apuntarla ni más de una semana antes', () => {
    const t = dia(3, 13);
    expect(cuandoSacada(ev('basura_sacada', tiene, t))).toBe(t);
    expect(cuandoSacada(ev('basura_sacada', tiene, t, { cuando: dia(2, 21) }))).toBe(dia(2, 21));
    expect(cuandoSacada(ev('basura_sacada', tiene, t, { cuando: t + HORA }))).toBe(t);
    expect(cuandoSacada(ev('basura_sacada', tiene, t, { cuando: t - 30 * 24 * HORA }))).toBe(t - ATRAS_MAX);
  });

  it('si la sacó antes de que se pasara el plazo y lo apunta más tarde, no hay queja (el caso de Javi)', () => {
    const aviso = ev('basura_llena', uno, dia(2, 10)); // plazo: hasta las 22:00
    const tarde = ev('basura_sacada', tiene, dia(3, 13), { cuando: dia(2, 21) });
    // antes de apuntarlo, se había pasado el plazo
    expect(semanaDe([aviso], dia(3, 12)).avisos[0].estado).toBe('queja');
    const e = derivar(config, [aviso, tarde], dia(3, 14));
    const sem = e.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.avisos[0]).toMatchObject({ estado: 'resuelto', resueltoEn: dia(2, 21), responsable: tiene });
    expect(e.apuntes.filter((x) => x.clase === 'queja')).toHaveLength(0);
    expect(e.noticias.find((x) => x.id === `${tarde.id}-s`)!.texto).toContain(`sacó la basura ayer a las ${hora(dia(2, 21))} (lo apunta más tarde)`);
    // si la sacó después del plazo, la queja se queda
    const pasada = ev('basura_sacada', tiene, dia(3, 13), { cuando: dia(2, 23) });
    expect(semanaDe([aviso, pasada], dia(3, 14)).avisos[0].estado).toBe('queja');
  });

  it('una que se sacó antes del aviso no lo resuelve (era otra basura)', () => {
    const aviso = ev('basura_llena', uno, dia(2, 10));
    const antes = ev('basura_sacada', tiene, dia(2, 12), { cuando: dia(2, 8) });
    expect(semanaDe([aviso, antes], dia(2, 13)).avisos[0].estado).toBe('abierto');
  });
});

describe('Bolsas y quién avisa', () => {
  it('avisa uno: llena; avisan dos, 4 bolsas o más o se pasa el plazo: urgente', () => {
    const a1 = ev('basura_llena', uno, dia(1, 10), { bolsas: 2 });
    expect(basuraAhora(derivar(config, [], dia(1, 9)))).toMatchObject({ nivel: 'tranquila', bolsas: 0, avisan: [] });
    expect(basuraAhora(derivar(config, [a1], dia(1, 11)))).toMatchObject({ nivel: 'llena', bolsas: 2, avisan: [uno], quien: tiene, limite: a1.ts + 12 * HORA });
    const a2 = ev('basura_llena', otro, dia(1, 12), { bolsas: 3 });
    const e2 = derivar(config, [a1, a2], dia(1, 13));
    expect(basuraAhora(e2)).toMatchObject({ nivel: 'urgente', bolsas: 3, avisan: [uno, otro] });
    expect(e2.semanasBasura.find((x) => x.semana === s)!.avisos).toHaveLength(1); // el plazo es el del primero
    expect(basuraAhora(derivar(config, [ev('basura_llena', uno, dia(1, 10), { bolsas: 5 })], dia(1, 11))).nivel).toBe('urgente');
    expect(basuraAhora(derivar(config, [a1], dia(2, 0)))).toMatchObject({ nivel: 'urgente', pasada: true });
    // la saca cualquiera: tranquila
    expect(basuraAhora(derivar(config, [a1, a2, ev('basura_sacada', otro, dia(1, 14))], dia(1, 15))).nivel).toBe('tranquila');
  });

  it('en la casa en 3D, las bolsas que dicen o, si pasan los días, más', () => {
    const a1 = ev('basura_llena', uno, dia(1, 10), { bolsas: 3 });
    expect(basuraEnCasa(derivar(config, [a1], dia(1, 11)))).toEqual({ bolsas: 3, dias: 0 });
    expect(basuraEnCasa(derivar(config, [a1], dia(4, 11)))!.bolsas).toBeGreaterThan(3);
  });

  it('los avisos: el primero, con sus bolsas; si avisa otro, «Te avisan dos»', () => {
    const a1 = ev('basura_llena', uno, dia(1, 10), { bolsas: 2 });
    const a2 = ev('basura_llena', otro, dia(1, 12), { bolsas: 3 });
    const a3 = ev('basura_llena', otro, dia(1, 14));
    expect(avisosDeEvento(config, [a1], a1.id)).toMatchObject([{ para: tiene, titulo: expect.stringContaining('2 bolsas') }]);
    expect(avisosDeEvento(config, [a1, a2], a2.id)).toMatchObject([{ para: tiene, titulo: expect.stringContaining('Te avisan dos'), texto: expect.stringContaining('Te quedan 10 h') }]);
    expect(avisosDeEvento(config, [a1, a2, a3], a3.id)[0].titulo).toContain('insiste');
    expect(derivar(config, [a1, a2], dia(1, 13)).noticias.find((x) => x.id === `${a2.id}-b`)!.texto).toContain('también avisa: ya son dos');
  });
});

describe('«Recuérdamelo»: si la tienes tú', () => {
  it('no es un aviso (ni queja): se lo recuerda a las 2 horas y a las 8, y se acaba al sacarla', () => {
    const rec = ev('basura_llena', tiene, dia(2, 10), { bolsas: 1 });
    const sem = semanaDe([rec], dia(3, 12));
    expect(sem.avisos).toHaveLength(0);
    expect(sem.recordatorios).toMatchObject([{ quien: tiene, desde: rec.ts, bolsas: 1 }]);
    expect(avisosDeEvento(config, [rec], rec.id)).toEqual([]);
    expect(basuraAhora(derivar(config, [rec], dia(2, 11)))).toMatchObject({ nivel: 'llena', avisan: [] });
    const avisos = avisosDelReloj(config, [rec], dia(2, 10), dia(3, 10));
    expect(avisos.filter((x) => x.para === tiene).map((x) => x.titulo)).toEqual(['🗑️ ¿Sacas la basura?', '🗑️ La basura sigue llena']);
    // la saca: no hay más
    const sacada = ev('basura_sacada', tiene, dia(2, 11));
    expect(avisosDelReloj(config, [rec, sacada], dia(2, 10), dia(3, 10)).filter((x) => x.titulo.includes('basura'))).toHaveLength(0);
    expect(semanaDe([rec, sacada], dia(2, 12)).recordatorios[0].resueltoEn).toBe(sacada.ts);
  });

  it('de noche no: a las 9 de la mañana', () => {
    const rec = ev('basura_llena', tiene, dia(2, 22));
    const avisos = avisosDelReloj(config, [rec], dia(2, 22), dia(3, 12)).filter((x) => x.para === tiene);
    expect(avisos).toHaveLength(1); // las dos caen de noche: una sola, a las 9
    expect(avisosDelReloj(config, [rec], dia(3, 8), dia(3, 9)).filter((x) => x.para === tiene)).toHaveLength(1);
  });

  it('si ya le han avisado, no hace falta', () => {
    const a1 = ev('basura_llena', uno, dia(2, 10));
    const rec = ev('basura_llena', tiene, dia(2, 11));
    expect(semanaDe([a1, rec], dia(2, 12)).recordatorios).toHaveLength(0);
  });
});
