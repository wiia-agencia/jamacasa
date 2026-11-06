import { describe, expect, it } from 'vitest';
import { avisosDeEvento, avisosDelReloj, type Aviso } from '../src/core/avisos';
import { basuraDe, semanaInicial, zonaDe } from '../src/core/calendario';
import { HORA, instanteLocal, inicioSemana, lunesDe } from '../src/core/tiempo';
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
  alquiler: { total: 134500, paga: 'b', partes: { a: 42500, c: 39000, b: 53000 }, dia: 10, desde: '2026-10' },
  facturas: [],
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: string, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const para = (r: Aviso[]) => r.map((x) => x.para).sort();
const s = semanaInicial(config);
const lunes = inicioSemana(s);
const hora = (dias: number, h: number, mi = 0) => {
  const d = new Date((lunesDe(s) + dias) * 86400000);
  return instanteLocal(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, mi);
};

describe('avisos al apuntar algo', () => {
  const resp = basuraDe(config, s)!;
  const otro = config.miembros.find((m) => m.id !== resp)!.id;

  it('basura llena: solo al que le toca la basura, no al que avisa', () => {
    const e = ev('basura_llena', otro, lunes + 10 * HORA);
    const r = avisosDeEvento(config, [e], e.id);
    expect(para(r)).toEqual([resp]);
    expect(r[0].titulo).toContain('La basura está llena');
    expect(r[0].texto).toContain('12 horas');
  });

  it('antes de que empiece la casa, la basura no avisa a nadie', () => {
    const e = ev('basura_llena', otro, lunes - 5 * HORA);
    expect(avisosDeEvento(config, [e], e.id)).toEqual([]);
  });

  it('esto es tuyo: al dueño, con lo que es', () => {
    const e = ev('esto_es_tuyo', 'a', lunes + HORA, { para: 'b', que: 'las pesas' });
    const r = avisosDeEvento(config, [e], e.id);
    expect(para(r)).toEqual(['b']);
    expect(r[0].titulo).toBe('🧦 Ana dice que esto es tuyo');
    expect(r[0].texto).toBe('Las pesas. Tienes 12 horas para recogerlo.');
  });

  it('piso marcado: a los otros dos, para que le pongan nota', () => {
    const e = ev('zona_hecha', 'a', lunes + 30 * HORA, { semana: s });
    const r = avisosDeEvento(config, [e], e.id);
    expect(para(r)).toEqual(['b', 'c']);
    expect(r[0].titulo).toBe(`🧹 Ana ha terminado el ${zonaDe(config, s, 'a')!.nombre}`);
    // Marcarlo otra vez mientras se espera la nota no vuelve a avisar
    const e2 = ev('zona_hecha', 'a', lunes + 31 * HORA, { semana: s });
    expect(avisosDeEvento(config, [e, e2], e2.id)).toEqual([]);
  });

  it('notas: con el primer voto nada; con el segundo, el resultado al dueño', () => {
    const h = ev('zona_hecha', 'a', lunes + 30 * HORA, { semana: s });
    const v1 = ev('puntuacion', 'b', lunes + 31 * HORA, { semana: s, de: 'a', intento: 1, nota: 8 });
    const v2 = ev('puntuacion', 'c', lunes + 32 * HORA, { semana: s, de: 'a', intento: 1, nota: 9 });
    expect(avisosDeEvento(config, [h, v1], v1.id)).toEqual([]);
    const r = avisosDeEvento(config, [h, v1, v2], v2.id);
    expect(para(r)).toEqual(['a']);
    expect(r[0].titulo).toContain('aprobado con un 8,5');
    const mal = ev('puntuacion', 'c', lunes + 32 * HORA, { semana: s, de: 'a', intento: 1, nota: 1 });
    expect(avisosDeEvento(config, [h, v1, mal], mal.id)[0].titulo).toContain('suspendido con un 4,5');
  });

  it('un gasto: a los que les toca pagar parte, con su parte', () => {
    const e = ev('gasto', 'c', lunes + HORA, { concepto: 'gasóleo', categoria: 'gasoleo', importe: 51240, pagador: 'c', participantes: ['a', 'b', 'c'], fecha: '2026-10-05' });
    const r = avisosDeEvento(config, [e], e.id);
    expect(para(r)).toEqual(['a', 'b']);
    expect(r[0].texto).toBe('Gasóleo: 512,40 €. Te tocan 170,80 €.');
    expect(r[0].pantalla).toBe('cuentas');
  });

  it('un pago del alquiler: al que lo recibe', () => {
    const e = ev('pago', 'a', lunes + HORA, { de: 'a', a: 'b', importe: 42500, alquiler: '2026-10' });
    const r = avisosDeEvento(config, [e], e.id);
    expect(para(r)).toEqual(['b']);
    expect(r[0].titulo).toBe('💸 Ana te ha pagado 425 €');
    expect(r[0].texto).toBe('El alquiler de octubre. Ya está apuntado en Cuentas.');
  });

  it('probar los avisos: solo a quien lo pulsa', () => {
    const e = ev('aviso_prueba', 'c', lunes + HORA);
    expect(para(avisosDeEvento(config, [e], e.id))).toEqual(['c']);
  });
});

describe('avisos por la hora', () => {
  const hora9 = hora(7, 9); // el lunes de la segunda semana a las 9

  it('el lunes a las 9: a cada uno su piso y de quién es la basura', () => {
    const r = avisosDelReloj(config, [], hora9 - HORA, hora9);
    const semanas = r.filter((x) => x.etiqueta === `semana-${s + 1}`);
    expect(para(semanas)).toEqual(['a', 'b', 'c']);
    const b = basuraDe(config, s + 1)!;
    expect(semanas.find((x) => x.para === b)!.texto).toContain('Y la basura es tuya');
    expect(semanas.find((x) => x.para !== b)!.texto).toContain(`La basura es de ${config.miembros.find((m) => m.id === b)!.nombre}`);
    // Nadie hizo nada la primera semana: se le recuerda
    expect(semanas[0].texto).toContain('sigue sin hacer');
    // La hora siguiente ya no lo repite
    expect(avisosDelReloj(config, [], hora9, hora9 + HORA).filter((x) => x.etiqueta.startsWith('semana-'))).toEqual([]);
  });

  it('el primer lunes dice que arranca la Jamacasa', () => {
    const t = hora(0, 9);
    const r = avisosDelReloj(config, [], t - HORA, t);
    expect(r.filter((x) => x.titulo.startsWith('🎉 Arranca la Jamacasa'))).toHaveLength(3);
  });

  it('el domingo a las 20: solo a quien no ha marcado su piso', () => {
    const t = hora(6, 20);
    const hecho = ev('zona_hecha', 'a', hora(3, 12), { semana: s });
    const r = avisosDelReloj(config, [hecho], t - HORA, t).filter((x) => x.etiqueta === `domingo-${s}`);
    expect(para(r)).toEqual(['b', 'c']);
  });

  it('la basura: aviso dos horas antes del plazo y queja si se pasa', () => {
    const resp = basuraDe(config, s)!;
    const otro = config.miembros.find((m) => m.id !== resp)!.id;
    const llena = ev('basura_llena', otro, hora(1, 10));
    const limite = llena.ts + 12 * HORA;
    const antes = avisosDelReloj(config, [llena], limite - 2.5 * HORA, limite - 1.5 * HORA);
    expect(antes.filter((x) => x.para === resp && x.titulo.includes('sacar la basura'))).toHaveLength(1);
    const despues = avisosDelReloj(config, [llena], limite - 0.5 * HORA, limite + 0.5 * HORA);
    expect(despues.filter((x) => x.para === resp && x.titulo.includes('Se acabaron'))).toHaveLength(1);
    // Si la saca, no hay recordatorio
    const sacada = ev('basura_sacada', resp, hora(1, 12));
    expect(avisosDelReloj(config, [llena, sacada], limite - 2.5 * HORA, limite - 1.5 * HORA).filter((x) => x.para === resp)).toEqual([]);
  });

  it('notas: recordatorio al que no ha puntuado y resultado al cerrarse el plazo', () => {
    const h = ev('zona_hecha', 'a', hora(2, 10), { semana: s });
    const v = ev('puntuacion', 'b', hora(2, 11), { semana: s, de: 'a', intento: 1, nota: 7 });
    const fin = h.ts + 48 * HORA;
    const rec = avisosDelReloj(config, [h, v], fin - 6.5 * HORA, fin - 5.5 * HORA).filter((x) => x.titulo.includes('para puntuar'));
    expect(para(rec)).toEqual(['c']);
    const cierre = avisosDelReloj(config, [h, v], fin - 0.5 * HORA, fin + 0.5 * HORA).filter((x) => x.etiqueta.startsWith('nota-'));
    expect(para(cierre)).toEqual(['a']);
    expect(cierre[0].titulo).toContain('aprobado con un 7');
  });

  it('el alquiler: el día 10 a las 10, a quien no lo ha pagado', () => {
    const t = instanteLocal(2026, 10, 10, 10);
    const pago = ev('pago', 'a', instanteLocal(2026, 10, 8, 12), { de: 'a', a: 'b', importe: 42500, alquiler: '2026-10' });
    const r = avisosDelReloj(config, [pago], t - HORA, t).filter((x) => x.etiqueta === 'alquiler-2026-10');
    expect(para(r)).toEqual(['c']);
    expect(r[0].texto).toBe('390 € a Bea. Cuando hagas el Bizum, márcalo en Cuentas.');
  });
});
