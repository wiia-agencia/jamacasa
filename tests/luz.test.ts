import { describe, expect, it } from 'vitest';
import { alturaSol, luzDe } from '../src/core/luz';

// Horas de Madrid escritas con su desfase (CET +01:00 en invierno, CEST +02:00 en verano)
const t = (s: string) => Date.parse(s);

describe('la casa viva: la luz de la hora de verdad', () => {
  it('el sol sale y se pone a su hora (10 de noviembre y 21 de junio en Madrid)', () => {
    // 10 nov 2026: sale hacia las 8:10 y se pone hacia las 18:00
    expect(alturaSol(t('2026-11-10T07:50:00+01:00')).sol).toBeLessThan(0);
    expect(alturaSol(t('2026-11-10T08:40:00+01:00')).sol).toBeGreaterThan(0);
    expect(alturaSol(t('2026-11-10T17:40:00+01:00')).sol).toBeGreaterThan(0);
    expect(alturaSol(t('2026-11-10T18:20:00+01:00')).sol).toBeLessThan(0);
    // 21 jun 2026: se pone hacia las 21:48
    expect(alturaSol(t('2026-06-21T21:30:00+02:00')).sol).toBeGreaterThan(0);
    expect(alturaSol(t('2026-06-21T22:10:00+02:00')).sol).toBeLessThan(0);
    // a mediodía de junio, el sol muy alto
    expect(alturaSol(t('2026-06-21T14:15:00+02:00')).sol).toBeGreaterThan(68);
  });

  it('cada momento del día con su luz', () => {
    expect(luzDe(t('2026-11-10T13:00:00+01:00')).fase).toBe('dia');
    expect(luzDe(t('2026-11-10T17:15:00+01:00')).fase).toBe('tarde');
    expect(luzDe(t('2026-11-10T18:05:00+01:00')).fase).toBe('atardecer');
    expect(luzDe(t('2026-11-10T23:30:00+01:00')).fase).toBe('noche');
    expect(luzDe(t('2026-11-11T08:00:00+01:00')).fase).toBe('amanecer');
    expect(luzDe(t('2026-11-11T08:45:00+01:00')).fase).toBe('manana');
    expect(luzDe(t('2026-11-11T10:00:00+01:00')).fase).toBe('dia');
    // en verano, a las nueve y media de la tarde aún es de día
    expect(['tarde', 'atardecer']).toContain(luzDe(t('2026-06-21T21:15:00+02:00')).fase);
  });

  it('de noche, las lámparas encendidas y nada de día; a mediodía, al revés', () => {
    const noche = luzDe(t('2026-11-10T23:30:00+01:00'));
    expect(noche.lamparas).toBe(1);
    expect(noche.dia).toBe(0);
    expect(noche.calidez).toBe(0);
    const dia = luzDe(t('2026-11-10T13:00:00+01:00'));
    expect(dia.lamparas).toBe(0);
    expect(dia.dia).toBe(1);
    // al atardecer, naranja y a media luz, con las lámparas encendiéndose
    const tarde = luzDe(t('2026-11-10T17:55:00+01:00'));
    expect(tarde.calidez).toBeGreaterThan(0.6);
    expect(tarde.dia).toBeGreaterThan(0.2);
    expect(tarde.dia).toBeLessThan(0.8);
    expect(tarde.lamparas).toBeGreaterThan(0.2);
  });
});
