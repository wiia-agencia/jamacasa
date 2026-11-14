// Hacer lo de otro (Javi, 14 de noviembre: Josu no estaba; su piso lo limpió Jose y la basura la sacó Javi toda la
// semana). «Lo limpio yo» en el piso de otro y «Me la quedo yo» en la basura.
import { describe, expect, it } from 'vitest';
import { avisosDeEvento, avisosDelReloj } from '../src/core/avisos';
import { bocadilloDe, fichaDe, resumenDe } from '../src/core/bocadillos';
import { basuraDe, semanaInicial, zonaDe } from '../src/core/calendario';
import { avisosBasuraAbiertos, derivar, paraPuntuar, tareaDe } from '../src/core/estado';
import { HORA, finSemana, inicioSemana, instanteLocal, lunesDe, mesDeSemana } from '../src/core/tiempo';
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
    { id: 'abajo', nombre: 'Piso de abajo', incluye: '', checklist: ['Suelo', 'Mesa', 'Baño'] },
    { id: 'medio', nombre: 'Piso del medio', incluye: '', checklist: ['Suelo', 'Terraza'] },
    { id: 'arriba', nombre: 'Piso de arriba', incluye: '', checklist: ['Suelo', 'Cocina'] },
  ],
  alquiler: { total: 0, paga: 'b', partes: {}, dia: 10, desde: '2026-10' },
  facturas: [],
};

let n = 0;
const ev = (tipo: Evento['tipo'], autor: MiembroId, ts: number, datos: any = {}): Evento => ({ id: `e${++n}`, tipo, autor, ts, datos });
const s = semanaInicial(config);
const dia = (d: number, h = 12) => inicioSemana(s) + d * 24 * HORA + h * HORA;
const hora = (dias: number, h: number) => {
  const d = new Date((lunesDe(s) + dias) * 86400000);
  return instanteLocal(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h);
};

describe('«Lo limpio yo»: el piso de otro', () => {
  // Ana no está: Bea se encarga de su piso, lo marca y Ana y Cris le ponen nota
  const cubre = ev('zona_cubierta', 'b', dia(1, 10), { semana: s, de: 'a' });
  const cosa = ev('zona_cosa', 'b', dia(1, 11), { semana: s, de: 'a', cosa: zonaDe(config, s, 'a')!.checklist[0], hecha: true });
  const hecho = ev('zona_hecha', 'b', dia(1, 12), { semana: s, de: 'a' });
  const notaA = ev('puntuacion', 'a', dia(1, 20), { semana: s, de: 'a', intento: 1, nota: 8 });
  const notaC = ev('puntuacion', 'c', dia(1, 21), { semana: s, de: 'a', intento: 1, nota: 9 });

  it('se encarga: sale quién lo limpia y lo que marca va en la lista del piso', () => {
    const e = derivar(config, [cubre, cosa], dia(1, 11));
    const t = tareaDe(e, s, 'a')!;
    expect(t.cubre).toBe('b');
    expect(t.marcadas).toEqual([zonaDe(config, s, 'a')!.checklist[0]]);
    expect(bocadilloDe(config, e, 'a', 'b')).toMatchObject({ titulo: 'Lo limpias tú…', accion: 'lista' });
    expect(bocadilloDe(config, e, 'a', 'c')!.titulo).toBe('Lo limpia Bea…');
    expect(fichaDe(config, e, 'a', 'c')!.texto).toContain('lo limpia Bea');
    expect(fichaDe(config, e, 'a', 'c')!.cubrir).toBeUndefined(); // ya se encarga alguien
    expect(resumenDe(e, 'a', config)).toBe('Bea se encarga de tu piso');
  });

  it('sin nadie que se encargue, la ficha deja limpiarlo (aunque su dueña lo empezara); el tuyo, no', () => {
    const e = derivar(config, [], dia(1, 9));
    expect(fichaDe(config, e, 'a', 'b')!.cubrir).toBe(true);
    expect(fichaDe(config, e, 'b', 'b')?.cubrir).toBeUndefined();
    // como Josu: lo empezó y se fue
    const empezo = ev('zona_empezada', 'a', dia(0, 20), { semana: s });
    expect(fichaDe(config, derivar(config, [empezo], dia(1, 9)), 'a', 'b')!.cubrir).toBe(true);
  });

  it('lo marca hecho: le ponen nota los otros dos (también la dueña) y los puntos son para quien lo limpió', () => {
    const espera = derivar(config, [cubre, cosa, hecho], dia(1, 13));
    const t = tareaDe(espera, s, 'a')!;
    expect(t.estado).toBe('esperando');
    expect(t.intentos[0].quien).toBe('b');
    expect(t.intentos[0].jueces.sort()).toEqual(['a', 'c']);
    expect(paraPuntuar(espera, 'a').map((x) => x.tarea.miembro)).toEqual(['a']);
    expect(paraPuntuar(espera, 'b')).toHaveLength(0);
    expect(bocadilloDe(config, espera, 'a', 'a')!.titulo).toBe('Bea espera tu nota ★');

    const e = derivar(config, [cubre, cosa, hecho, notaA, notaC], dia(5, 12));
    const ta = tareaDe(e, s, 'a')!;
    expect(ta.estado).toBe('aprobada');
    expect(ta.nota).toBe(8.5);
    const zona = e.apuntes.find((x) => x.clase === 'zona' && x.miembro === 'b')!;
    expect(zona.puntos).toBe(8.5);
    expect(zona.motivo).toContain('de Ana');
    // Ana ni suma por el piso ni pierde: solo el punto por puntuar
    expect(e.apuntes.filter((x) => x.miembro === 'a').map((x) => x.clase)).toEqual(['revision']);
    expect(ta.retrasoDias).toBe(0);
    expect(e.medallas.b.salvavidas).toBe(1);
    expect(e.titulos[mesDeSemana(s)].matricula).toEqual(['b']); // la nota cuenta para la media de quien limpió
    expect(bocadilloDe(config, e, 'a', 'c')).toMatchObject({ titulo: 'Aprobado ✓ 8,5', sub: 'Lo limpió Bea' });
    expect(e.noticias.some((x) => /^Bea aprueba el piso .* de Ana con un 8,5\.$/.test(x.texto))).toBe(true);
  });

  it('el piso sigue siendo de su dueño: si nadie lo hace, el retraso y el «sin hacer» son suyos', () => {
    const e = derivar(config, [cubre], finSemana(s) + 4 * 24 * HORA);
    const t = tareaDe(e, s, 'a')!;
    expect(t.sinHacer).toBe(true);
    const suyo = (x: { motivo: string }) => x.motivo.toLowerCase().includes(t.zona.nombre.toLowerCase());
    expect(e.apuntes.filter((x) => x.clase === 'sin_hacer' && suyo(x)).map((x) => x.miembro)).toEqual(['a']);
    expect(e.apuntes.filter((x) => x.clase === 'retraso' && suyo(x)).map((x) => x.miembro)).toEqual(['a']);
    expect(e.apuntes.some((x) => x.miembro === 'b' && x.motivo.includes('Ana'))).toBe(false);
  });

  it('«Ya no lo limpio yo» lo deja como estaba', () => {
    const deja = ev('zona_cubierta', 'b', dia(1, 15), { semana: s, de: 'a', deja: true });
    const e = derivar(config, [cubre, deja], dia(1, 16));
    expect(tareaDe(e, s, 'a')!.cubre).toBeUndefined();
    // y nadie puede encargarse de su propio piso
    const propio = ev('zona_cubierta', 'a', dia(1, 17), { semana: s, de: 'a' });
    expect(tareaDe(derivar(config, [propio], dia(1, 18)), s, 'a')!.cubre).toBeUndefined();
  });

  it('avisos: a la dueña y al otro al encargarse; al terminar, a los dos que ponen nota', () => {
    const lista = [cubre, cosa, hecho];
    const r1 = avisosDeEvento(config, lista, cubre.id);
    expect(r1.map((x) => x.para).sort()).toEqual(['a', 'c']);
    expect(r1.find((x) => x.para === 'a')!.titulo).toBe('🤝 Bea se encarga de tu piso esta semana');
    expect(r1.find((x) => x.para === 'c')!.titulo).toBe('🤝 Bea se encarga del piso de Ana');
    const r2 = avisosDeEvento(config, lista, hecho.id);
    expect(r2.map((x) => x.para).sort()).toEqual(['a', 'c']);
    expect(r2.find((x) => x.para === 'a')!.titulo).toContain('ha terminado tu ');
    expect(r2.find((x) => x.para === 'c')!.titulo).toContain('de Ana');
    // el resultado, a quien lo limpió
    const r3 = avisosDeEvento(config, [...lista, notaA, notaC], notaC.id);
    expect(r3.map((x) => x.para)).toEqual(['b']);
    expect(r3[0].titulo).toContain('de Ana: aprobado');
  });

  it('el domingo a las 20, si sigue sin marcar, se le recuerda a la dueña y a quien se encarga', () => {
    const domingo = hora(6, 20);
    const r = avisosDelReloj(config, [cubre], domingo - HORA, domingo);
    const delPiso = r.filter((x) => x.etiqueta.startsWith(`domingo-${s}`));
    // los tres tienen su piso sin marcar y, además, Bea se encarga del de Ana
    expect(delPiso.map((x) => x.para).sort()).toEqual(['a', 'b', 'b', 'c']);
    expect(delPiso.find((x) => x.etiqueta === `domingo-${s}-a`)).toMatchObject({ para: 'b', titulo: `⏰ El ${zonaDe(config, s, 'a')!.nombre} de Ana sigue sin marcar` });
    expect(delPiso.find((x) => x.para === 'a')!.texto).toContain('Lo lleva Bea');
  });
});

describe('«Me la quedo yo»: la basura de otro', () => {
  const tocaba = basuraDe(config, s)!;
  const [yo, tercero] = config.miembros.map((m) => m.id).filter((m) => m !== tocaba);
  const queda = ev('basura_cubierta', yo, dia(2, 9), { semana: s, quien: yo });

  it('desde ese momento la tiene quien se la quedó: al acabar la semana, sus 3 puntos (y Salvavidas)', () => {
    const e = derivar(config, [queda], dia(2, 10));
    expect(e.basura).toBe(yo);
    const fin = derivar(config, [queda], finSemana(s) + HORA);
    const sem = fin.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.tocaba).toBe(tocaba);
    expect(sem.responsable).toBe(yo);
    const bonus = fin.apuntes.filter((x) => x.clase === 'basura');
    expect(bonus.map((x) => x.miembro)).toEqual([yo]);
    expect(bonus[0].motivo).toBe(`Semana de basura de ${config.miembros.find((m) => m.id === tocaba)!.nombre} sin quejas`);
    expect(fin.medallas[yo].salvavidas).toBe(1);
    expect(fin.noticias.some((x) => x.id === `${queda.id}-bc`)).toBe(true);
  });

  it('lo de antes se queda como estaba: una queja de antes es de quien la tenía', () => {
    const aviso = ev('basura_llena', tercero, dia(0, 8)); // lunes 8:00, a quien le tocaba; se pasa el plazo
    const fin = derivar(config, [aviso, queda], finSemana(s) + HORA);
    const sem = fin.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.avisos[0].estado).toBe('queja');
    expect(sem.avisos[0].responsable).toBe(tocaba);
    expect(fin.apuntes.filter((x) => x.clase === 'queja').map((x) => x.miembro)).toEqual([tocaba]);
    // quien se la quedó no se llevó ninguna: sus 3 puntos
    expect(fin.apuntes.filter((x) => x.clase === 'basura').map((x) => x.miembro)).toEqual([yo]);
  });

  it('si estaba llena al quedársela, ahora le toca a él sacarla (y su «Ya la saqué» cuenta)', () => {
    const aviso = ev('basura_llena', tercero, dia(2, 7)); // abierto a las 9
    const sacada = ev('basura_sacada', yo, dia(2, 11));
    const antes = derivar(config, [aviso, queda], dia(2, 10));
    expect(avisosBasuraAbiertos(antes, yo)).toHaveLength(1);
    expect(avisosBasuraAbiertos(antes, tocaba)).toHaveLength(0);
    const e = derivar(config, [aviso, queda, sacada], dia(2, 12));
    expect(e.semanasBasura.find((x) => x.semana === s)!.avisos[0]).toMatchObject({ estado: 'resuelto', responsable: yo });
    // y si la saca quien ya no la tiene, también la vacía: es «Esta la saqué yo» (+1 para él)
    const otra = ev('basura_sacada', tocaba, dia(2, 11));
    const e2 = derivar(config, [aviso, queda, otra], dia(2, 12));
    const sem2 = e2.semanasBasura.find((x) => x.semana === s)!;
    expect(sem2.avisos[0]).toMatchObject({ estado: 'resuelto', responsable: tocaba });
    expect(sem2.ajenas.map((x) => x.id)).toEqual([otra.id]);
    expect(e2.apuntes.filter((x) => x.clase === 'sacada').map((x) => x.miembro)).toEqual([tocaba]);
  });

  it('se la puede devolver a quien le tocaba o pasársela a otro (desde el cuadro), siempre desde ahora', () => {
    const devuelve = ev('basura_cubierta', yo, dia(3, 9), { semana: s, quien: tocaba });
    expect(derivar(config, [queda, devuelve], dia(3, 10)).basura).toBe(tocaba);
    const pasa = ev('basura_cubierta', yo, dia(3, 9), { semana: s, quien: tercero });
    expect(derivar(config, [queda, pasa], dia(3, 10)).basura).toBe(tercero);
    // a otro no se le puede echar encima lo de antes: aunque diga «desde el lunes», es desde ahora
    const desdeLunes = ev('basura_cubierta', yo, dia(3, 9), { semana: s, quien: tercero, desde: inicioSemana(s) });
    const sem = derivar(config, [desdeLunes], dia(3, 10)).semanasBasura.find((x) => x.semana === s)!;
    expect(sem.tramos.map((t) => [t.quien, t.desde])).toEqual([[tocaba, -Infinity], [tercero, dia(3, 9)]]);
    // ni quedársela después de que acabe su semana
    const tardia = ev('basura_cubierta', tercero, finSemana(s) + HORA, { semana: s, quien: tercero });
    expect(derivar(config, [tardia], finSemana(s) + 2 * HORA).semanasBasura.find((x) => x.semana === s)!.responsable).toBe(tocaba);
  });

  it('se la puede quedar desde un día de esta semana (el lunes: toda la semana), no desde antes ni desde después', () => {
    const aviso = ev('basura_llena', tercero, dia(1, 8)); // martes: se pasa el plazo sin sacarla
    const lunes = inicioSemana(s);
    const todaLaSemana = ev('basura_cubierta', yo, dia(5, 10), { semana: s, quien: yo, desde: lunes });
    const e = derivar(config, [aviso, todaLaSemana], finSemana(s) + HORA);
    const sem = e.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.tramos.map((t) => t.quien)).toEqual([tocaba, yo]);
    expect(sem.tramos[1].desde).toBe(lunes);
    expect(sem.avisos[0]).toMatchObject({ estado: 'queja', responsable: yo }); // lo de esos días pasa a ser suyo
    expect(e.noticias.find((x) => x.id === `${todaLaSemana.id}-bc`)!.texto).toContain('desde el lunes');
    expect(avisosDeEvento(config, [aviso, todaLaSemana], todaLaSemana.id).find((x) => x.para === tocaba)).toMatchObject({ titulo: expect.stringContaining('desde el lunes'), texto: expect.stringContaining('Ya no te toca') });
    // primero «desde ahora» y luego se acuerda de que fue toda la semana
    const ahora = ev('basura_cubierta', yo, dia(5, 9), { semana: s, quien: yo });
    const e2 = derivar(config, [ahora, todaLaSemana], dia(5, 11));
    expect(e2.semanasBasura.find((x) => x.semana === s)!.tramos.map((t) => [t.quien, t.desde])).toEqual([[tocaba, -Infinity], [yo, lunes]]);
    // ni antes del lunes ni después de cuando lo dice
    const antes = ev('basura_cubierta', yo, dia(2, 9), { semana: s, quien: yo, desde: lunes - 3 * 24 * HORA });
    expect(derivar(config, [antes], dia(2, 10)).semanasBasura.find((x) => x.semana === s)!.tramos[1].desde).toBe(lunes);
    const despues = ev('basura_cubierta', yo, dia(2, 9), { semana: s, quien: yo, desde: dia(4, 0) });
    expect(derivar(config, [despues], dia(2, 10)).semanasBasura.find((x) => x.semana === s)!.tramos[1].desde).toBe(dia(2, 9));
  });

  it('avisos: al quedársela se les dice a los otros dos; «está llena» le llega a quien la tiene', () => {
    const r = avisosDeEvento(config, [queda], queda.id);
    expect(r.map((x) => x.para).sort()).toEqual([tocaba, tercero].sort());
    expect(r.find((x) => x.para === tocaba)!.texto).toContain('Ya no te toca');
    const llena = ev('basura_llena', tercero, dia(2, 15));
    expect(avisosDeEvento(config, [queda, llena], llena.id).map((x) => x.para)).toEqual([yo]);
  });
});

describe('«Le echo una mano» y «Esta la saqué yo»', () => {
  it('ayudar: la nota es del dueño, +2 al que ayuda si se aprueba, y el que ayuda no pone nota', () => {
    const ayuda = ev('zona_ayuda', 'b', dia(1, 10), { semana: s, de: 'a' });
    const cosa = ev('zona_cosa', 'b', dia(1, 11), { semana: s, de: 'a', cosa: zonaDe(config, s, 'a')!.checklist[1], hecha: true });
    const hecho = ev('zona_hecha', 'a', dia(1, 12), { semana: s });
    const espera = derivar(config, [ayuda, cosa, hecho], dia(1, 13));
    const t = tareaDe(espera, s, 'a')!;
    expect(t.marcadas).toEqual([zonaDe(config, s, 'a')!.checklist[1]]);
    expect(t.intentos[0]).toMatchObject({ quien: 'a', ayudaron: ['b'], jueces: ['c'] });
    expect(paraPuntuar(espera, 'b')).toHaveLength(0);
    const nota = ev('puntuacion', 'c', dia(1, 20), { semana: s, de: 'a', intento: 1, nota: 9 });
    const e = derivar(config, [ayuda, cosa, hecho, nota], dia(1, 21));
    expect(tareaDe(e, s, 'a')!.estado).toBe('aprobada');
    expect(e.apuntes.find((x) => x.clase === 'zona')).toMatchObject({ miembro: 'a', puntos: 9 });
    expect(e.apuntes.find((x) => x.clase === 'ayuda')).toMatchObject({ miembro: 'b', puntos: 2 });
    expect(e.noticias.some((x) => x.id.endsWith('-ay') && x.texto.startsWith('Bea le echa una mano a Ana'))).toBe(true);
    // avisos: a la que lo limpia al ponerse a ayudar; y el +2, al aprobarse
    expect(avisosDeEvento(config, [ayuda], ayuda.id)).toMatchObject([{ para: 'a', titulo: expect.stringContaining('Bea te echa una mano') }]);
    expect(avisosDeEvento(config, [ayuda, cosa, hecho, nota], nota.id).map((x) => x.para).sort()).toEqual(['a', 'b']);
  });

  it('si suspende, el que ayudó no gana nada; «Ya no ayudo» lo quita; y si lo limpiáis los tres, va la nota automática', () => {
    const ayuda = ev('zona_ayuda', 'b', dia(1, 10), { semana: s, de: 'a' });
    const hecho = ev('zona_hecha', 'a', dia(1, 12), { semana: s });
    const mala = ev('puntuacion', 'c', dia(1, 20), { semana: s, de: 'a', intento: 1, nota: 3, fotos: ['x'] });
    expect(derivar(config, [ayuda, hecho, mala], dia(1, 21)).apuntes.some((x) => x.clase === 'ayuda')).toBe(false);
    const deja = ev('zona_ayuda', 'b', dia(1, 11), { semana: s, de: 'a', deja: true });
    expect(tareaDe(derivar(config, [ayuda, deja], dia(1, 11)), s, 'a')!.ayudan).toEqual([]);
    const otra = ev('zona_ayuda', 'c', dia(1, 10), { semana: s, de: 'a' });
    const e = derivar(config, [ayuda, otra, hecho], dia(1, 12));
    const i = tareaDe(e, s, 'a')!.intentos[0];
    expect(i).toMatchObject({ jueces: [], resuelto: true, auto: true, aprobado: true });
  });

  it('«Esta la saqué yo»: +1 al que saca la de otro, como mucho una vez al día; vacía el aviso y se lo dice a quien la tiene', () => {
    const tocaba = basuraDe(config, s)!;
    const [yo, tercero] = config.miembros.map((m) => m.id).filter((m) => m !== tocaba);
    const aviso = ev('basura_llena', tercero, dia(2, 8));
    const una = ev('basura_sacada', yo, dia(2, 9));
    const otra = ev('basura_sacada', yo, dia(2, 18)); // mismo día: no suma otra vez
    const manana = ev('basura_sacada', yo, dia(3, 9));
    const e = derivar(config, [aviso, una, otra, manana], dia(3, 10));
    const sem = e.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.avisos[0]).toMatchObject({ estado: 'resuelto', responsable: yo });
    expect(e.apuntes.filter((x) => x.clase === 'sacada').map((x) => x.puntos)).toEqual([1, 1]);
    expect(e.apuntes.find((x) => x.clase === 'sacada')!.motivo).toContain('Sacaste la basura de');
    const r = avisosDeEvento(config, [aviso, una], una.id);
    expect(r).toMatchObject([{ para: tocaba, titulo: expect.stringContaining('ha sacado tu basura'), texto: expect.stringContaining('Ya no te cae la queja') }]);
    // la que saca quien la tiene no es «de otro»
    expect(derivar(config, [ev('basura_sacada', tocaba, dia(2, 9))], dia(2, 10)).semanasBasura.find((x) => x.semana === s)!.ajenas).toHaveLength(0);
  });
});

describe('Poner a otro desde el cuadro (Javi, 14 de noviembre: «coger a un personaje y moverlo al piso que quiera»)', () => {
  const z = () => zonaDe(config, s, 'a')!.nombre.toLowerCase();

  it('«Lo limpia Bea» (lo dice Cris): se encarga Bea, lo dijo Cris y les llega a Bea y a Ana', () => {
    const pone = ev('zona_cubierta', 'c', dia(1, 10), { semana: s, de: 'a', quien: 'b' });
    const e = derivar(config, [pone], dia(1, 11));
    const t = tareaDe(e, s, 'a')!;
    expect(t).toMatchObject({ cubre: 'b', cubiertaPor: 'c' });
    expect(e.noticias.find((x) => x.id.endsWith('-cu'))).toMatchObject({ quien: 'c', texto: `Cris dice que Bea se encarga del ${z()} de Ana esta semana.` });
    const r = avisosDeEvento(config, [pone], pone.id);
    expect(r.map((x) => x.para).sort()).toEqual(['a', 'b']);
    expect(r.find((x) => x.para === 'b')!.titulo).toBe('🤝 Cris dice que te encargas del piso de Ana');
    expect(r.find((x) => x.para === 'a')!.titulo).toBe('🤝 Cris dice que Bea se encarga de tu piso esta semana');
    // y lo puede quitar cualquiera: «Bea ya no lo limpia»
    const quita = ev('zona_cubierta', 'c', dia(1, 12), { semana: s, de: 'a', quien: 'b', deja: true });
    expect(tareaDe(derivar(config, [pone, quita], dia(1, 13)), s, 'a')!.cubre).toBeUndefined();
    expect(avisosDeEvento(config, [pone, quita], quita.id).map((x) => x.para).sort()).toEqual(['a', 'b']);
    // la dueña lo recupera: a Bea le llega que vuelve a encargarse ella
    const recupera = ev('zona_cubierta', 'a', dia(1, 12), { semana: s, de: 'a', quien: 'b', deja: true });
    expect(avisosDeEvento(config, [pone, recupera], recupera.id)).toMatchObject([{ para: 'b', titulo: '🤝 Ana vuelve a encargarse de su piso' }]);
    // a nadie se le pone en su propio piso
    const propio = ev('zona_cubierta', 'c', dia(1, 14), { semana: s, de: 'a', quien: 'a' });
    expect(tareaDe(derivar(config, [propio], dia(1, 15)), s, 'a')!.cubre).toBeUndefined();
  });

  it('«Bea le echa una mano» (lo dice Cris): ayuda Bea, sin poner nota, y se lo dice a Bea y a Ana', () => {
    const pone = ev('zona_ayuda', 'c', dia(1, 10), { semana: s, de: 'a', quien: 'b' });
    const hecho = ev('zona_hecha', 'a', dia(1, 12), { semana: s });
    const e = derivar(config, [pone, hecho], dia(1, 13));
    const t = tareaDe(e, s, 'a')!;
    expect(t.ayudas).toEqual([{ quien: 'b', ts: dia(1, 10), por: 'c' }]);
    expect(t.intentos[0]).toMatchObject({ quien: 'a', ayudaron: ['b'], jueces: ['c'] });
    expect(e.noticias.find((x) => x.id.endsWith('-ay'))!.texto).toBe(`Cris dice que Bea le echa una mano a Ana con el ${z()}.`);
    const r = avisosDeEvento(config, [pone], pone.id);
    expect(r.map((x) => x.para).sort()).toEqual(['a', 'b']);
    expect(r.find((x) => x.para === 'b')!.titulo).toBe('🤝 Cris dice que le echas una mano a Ana');
  });

  it('«Ya lo ha limpiado Bea» (lo apunta Cris): la nota es de Bea, le ponen nota Ana y Cris', () => {
    const cubre = ev('zona_cubierta', 'c', dia(1, 10), { semana: s, de: 'a', quien: 'b' });
    const hecho = ev('zona_hecha', 'c', dia(1, 12), { semana: s, de: 'a', quien: 'b' });
    const e = derivar(config, [cubre, hecho], dia(1, 13));
    const i = tareaDe(e, s, 'a')!.intentos[0];
    expect(i).toMatchObject({ quien: 'b', jueces: ['a', 'c'] });
    expect(paraPuntuar(e, 'c')).toHaveLength(1);
    expect(e.noticias.find((x) => x.id === `${hecho.id}-h`)!.texto).toBe(`Bea ha terminado el ${z()} de Ana. Lo apunta Cris.`);
    const r = avisosDeEvento(config, [cubre, hecho], hecho.id);
    expect(r.map((x) => x.para).sort()).toEqual(['a', 'b']); // a Cris no: lo ha apuntado él
    expect(r.find((x) => x.para === 'a')).toMatchObject({ titulo: `🧹 Bea ha terminado tu ${z()}`, texto: expect.stringContaining('Lo apunta Cris.') });
    expect(r.find((x) => x.para === 'b')!.titulo).toBe(`✅ Cris ha marcado como hecho el ${z()} de Ana`);
  });

  it('«La ha sacado Cris» (lo apunta Ana): +1 para Cris, vacía el aviso y les llega a los dos', () => {
    const tocaba = basuraDe(config, s)!;
    const [otro1, otro2] = config.miembros.map((m) => m.id).filter((m) => m !== tocaba);
    const nombre = (m: MiembroId) => config.miembros.find((x) => x.id === m)!.nombre;
    const aviso = ev('basura_llena', otro1, dia(2, 8));
    const apunta = ev('basura_sacada', otro1, dia(2, 9), { quien: otro2 });
    const e = derivar(config, [aviso, apunta], dia(2, 10));
    const sem = e.semanasBasura.find((x) => x.semana === s)!;
    expect(sem.avisos[0]).toMatchObject({ estado: 'resuelto', responsable: otro2 });
    expect(e.apuntes.filter((x) => x.clase === 'sacada').map((x) => x.miembro)).toEqual([otro2]);
    expect(e.noticias.find((x) => x.id === `${apunta.id}-sa`)!.texto).toBe(`${nombre(otro2)} ha sacado la basura de ${nombre(tocaba)}. Lo apunta ${nombre(otro1)}.`);
    const r = avisosDeEvento(config, [aviso, apunta], apunta.id);
    expect(r.map((x) => x.para).sort()).toEqual([tocaba, otro2].sort());
    expect(r.find((x) => x.para === tocaba)!.titulo).toBe(`🗑️ ${nombre(otro2)} ha sacado tu basura`);
    // la de alguien que no es de la casa no cuenta
    const rara = ev('basura_sacada', otro1, dia(2, 9), { quien: 'zz' });
    expect(derivar(config, [aviso, rara], dia(2, 10)).semanasBasura.find((x) => x.semana === s)!.avisos[0].estado).toBe('abierto');
  });

  it('pasarle la basura a otro: le llega a él y a quien la tenía', () => {
    const tocaba = basuraDe(config, s)!;
    const [otro1, otro2] = config.miembros.map((m) => m.id).filter((m) => m !== tocaba);
    const pasa = ev('basura_cubierta', otro1, dia(2, 9), { semana: s, quien: otro2 });
    const e = derivar(config, [pasa], dia(2, 10));
    expect(e.basura).toBe(otro2);
    const nombre = (m: MiembroId) => config.miembros.find((x) => x.id === m)!.nombre;
    expect(e.noticias.find((x) => x.id === `${pasa.id}-bc`)!.texto).toBe(`${nombre(otro1)} le pasa la basura de ${nombre(tocaba)} a ${nombre(otro2)}.`);
    const r = avisosDeEvento(config, [pasa], pasa.id);
    expect(r.map((x) => x.para).sort()).toEqual([tocaba, otro2].sort());
    expect(r.find((x) => x.para === otro2)!.titulo).toBe(`🗑️ ${nombre(otro1)} te pasa la basura`);
  });
});

describe('«Lo limpió otro»: corregir quién limpió un piso ya marcado', () => {
  // como el 14 de noviembre: Ana (la dueña) marca su piso como hecho, pero lo había limpiado Bea
  const hecho = ev('zona_hecha', 'a', dia(1, 12), { semana: s });

  it('cualquiera de los otros dice quién fue: la nota (y Salvavidas) para ese, y le ponen nota los demás', () => {
    const corr = ev('zona_hecha_por', 'c', dia(1, 13), { semana: s, de: 'a', intento: 1, quien: 'b' });
    const e = derivar(config, [hecho, corr], dia(1, 14));
    const i = tareaDe(e, s, 'a')!.intentos[0];
    expect(i).toMatchObject({ quien: 'b', jueces: ['a', 'c'], corregido: { por: 'c' } });
    expect(paraPuntuar(e, 'a').map((x) => x.tarea.miembro)).toEqual(['a']);
    const v1 = ev('puntuacion', 'a', dia(1, 15), { semana: s, de: 'a', intento: 1, nota: 8 });
    const v2 = ev('puntuacion', 'c', dia(1, 16), { semana: s, de: 'a', intento: 1, nota: 10 });
    const fin = derivar(config, [hecho, corr, v1, v2], dia(1, 17));
    expect(fin.apuntes.find((x) => x.clase === 'zona')).toMatchObject({ miembro: 'b', puntos: 9 });
    expect(fin.medallas.b.salvavidas).toBe(1);
    expect(fin.noticias.some((x) => x.id.endsWith('-hp') && x.texto === `Cris dice que el ${zonaDe(config, s, 'a')!.nombre.toLowerCase()} de Ana lo limpió Bea.`)).toBe(true);
    // avisos: a los otros dos
    const r = avisosDeEvento(config, [hecho, corr], corr.id);
    expect(r.map((x) => x.para).sort()).toEqual(['a', 'b']);
    expect(r.find((x) => x.para === 'b')!.titulo).toContain('lo limpiaste tú');
    expect(r.find((x) => x.para === 'a')!.texto).toContain('ponle nota');
  });

  it('nadie se lo puede poner a sí mismo; vale lo último que se diga', () => {
    const yoMismo = ev('zona_hecha_por', 'b', dia(1, 13), { semana: s, de: 'a', intento: 1, quien: 'b' });
    expect(tareaDe(derivar(config, [hecho, yoMismo], dia(1, 14)), s, 'a')!.intentos[0].quien).toBe('a');
    const una = ev('zona_hecha_por', 'c', dia(1, 13), { semana: s, de: 'a', intento: 1, quien: 'b' });
    const otra = ev('zona_hecha_por', 'b', dia(1, 14), { semana: s, de: 'a', intento: 1, quien: 'a' });
    expect(tareaDe(derivar(config, [hecho, una, otra], dia(1, 15)), s, 'a')!.intentos[0].quien).toBe('a');
  });
});
