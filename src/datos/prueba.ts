// Modo prueba: la casa vive solo en este móvil, con un mes inventado para tocarlo todo.
import { basuraDe, zonaDe } from '../core/calendario';
import { HORA, diaLocal, inicioDia, inicioSemana, lunesDe, mes, mesesEntre, semana, textoDeDia } from '../core/tiempo';
import type { Config, Evento, MiembroId, TipoEvento } from '../core/tipos';
import { configEjemplo, FOTOS_EJEMPLO } from '../demo/ejemplo';
import { blobADataUrl, comprimirFoto, nuevoId, type Almacen } from './almacen';

import * as privado from 'datos-privados';

const CLAVE = 'jamacasa-prueba-v1';
const CLAVE_YO = 'jamacasa-prueba-yo';

function leer(clave: string): any {
  try {
    const t = localStorage.getItem(clave);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}
function guardar(clave: string, valor: any): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function configPrueba(ahora: number): Config {
  const s = semana(ahora) - 4;
  const inicio = textoDeDia(lunesDe(s));
  const desde = mes(inicioSemana(s));
  return privado.configPrivada ? privado.configPrivada(inicio, desde) : configEjemplo(inicio, desde);
}

const FOTOS: Record<string, string> = { ...FOTOS_EJEMPLO, ...(privado.FOTOS_PRIVADAS ?? {}) };
export const hayFotoDemo = (k: string) => Boolean(FOTOS[k]);

/** Un mes inventado pero creíble: aprobados, un suspenso, un retraso, quejas de basura, gastos… */
export function generarPrueba(config: Config, ahora: number): Evento[] {
  const s = semana(ahora) - 4;
  const [A, B, C] = config.miembros.map((m) => m.id);
  const ev: Evento[] = [];
  let n = 0;
  const add = (tipo: TipoEvento, autor: MiembroId, ts: number, datos: any = {}) => {
    ev.push({ id: `prueba-${++n}`, tipo, autor, ts, datos });
  };
  const t = (k: number, dia: number, h: number, mi = 0) => inicioDia(lunesDe(s + k) + dia) + h * HORA + mi * 60000;
  const fecha = (ts: number) => textoDeDia(diaLocal(ts));
  const hecho = (k: number, m: MiembroId, ts: number) => add('zona_hecha', m, ts, { semana: s + k });
  const voto = (k: number, de: MiembroId, juez: MiembroId, nota: number, ts: number, intento = 1, extra: any = {}) =>
    add('puntuacion', juez, ts, { semana: s + k, de, intento, nota, ...extra });
  const otroQue = (m: MiembroId | null) => (m === C ? B : C);
  const gasto = (autor: MiembroId, ts: number, concepto: string, categoria: string, importe: number) =>
    add('gasto', autor, ts, { concepto, categoria, importe, pagador: autor, participantes: [A, B, C], fecha: fecha(ts) });

  // Semana 1: todo en orden (C se olvida de puntuar a A)
  hecho(0, A, t(0, 2, 19, 10));
  voto(0, A, B, 9, t(0, 3, 9));
  hecho(0, B, t(0, 3, 21, 30));
  voto(0, B, A, 8, t(0, 4, 8));
  voto(0, B, C, 9, t(0, 4, 13));
  hecho(0, C, t(0, 5, 12));
  voto(0, C, A, 7, t(0, 5, 20));
  voto(0, C, B, 8, t(0, 6, 11));
  add('basura_llena', otroQue(basuraDe(config, s)), t(0, 1, 21));
  add('basura_sacada', basuraDe(config, s)!, t(0, 1, 22, 15));
  gasto(A, t(0, 1, 13), 'Compra común: Mercadona', 'compra', 3680);
  gasto(B, t(0, 0, 10), 'Internet', 'internet', 3500);
  gasto(B, t(0, 2, 9), 'Netflix', 'netflix', 1799);

  // Semana 2: A saca un 10 el lunes; C marca tarde; la basura se queda 12 h
  hecho(1, A, t(1, 0, 20, 5));
  voto(1, A, B, 10, t(1, 1, 9));
  voto(1, A, C, 10, t(1, 1, 19));
  hecho(1, B, t(1, 4, 18));
  voto(1, B, A, 8, t(1, 5, 10));
  voto(1, B, C, 8, t(1, 5, 12));
  hecho(1, C, t(2, 0, 18));
  voto(1, C, A, 7, t(2, 1, 9));
  voto(1, C, B, 7, t(2, 1, 10));
  const b1 = basuraDe(config, s + 1)!;
  add('basura_llena', otroQue(b1), t(1, 2, 8), {});
  add('basura_sacada', b1, t(1, 2, 22));
  gasto(C, t(1, 1, 18), 'Luz', 'luz', 7432);
  gasto(C, t(1, 3, 11), 'Gasóleo', 'gasoleo', 51240);

  // Semana 3: a B le suspenden el piso y lo repasa al día siguiente
  hecho(2, A, t(2, 0, 19, 30));
  voto(2, A, B, 9, t(2, 1, 8));
  voto(2, A, C, 9, t(2, 1, 21));
  hecho(2, B, t(2, 2, 20));
  const zonaB = zonaDe(config, s + 2, B)!;
  voto(2, B, A, 4, t(2, 3, 9), 1, { faltan: zonaB.checklist.slice(-1), comentario: 'Te dejaste el final de la lista' });
  voto(2, B, C, 5, t(2, 3, 13));
  hecho(2, B, t(2, 3, 21));
  voto(2, B, A, 8, t(2, 4, 9), 2);
  voto(2, B, C, 8, t(2, 4, 10), 2);
  hecho(2, C, t(2, 5, 11));
  voto(2, C, A, 8, t(2, 5, 19));
  voto(2, C, B, 9, t(2, 6, 10));
  const b2 = basuraDe(config, s + 2)!;
  add('basura_llena', otroQue(b2), t(2, 4, 13));
  add('basura_sacada', b2, t(2, 4, 15, 30));
  gasto(B, t(2, 1, 20), 'Agua', 'agua', 3110);
  gasto(B, t(2, 2, 13), 'Compra común: fruta y papel', 'compra', 2245);
  gasto(A, t(2, 4, 12), 'Aquaservice', 'aquaservice', 2850);
  add('pago', A, t(2, 1, 12), { de: A, a: C, importe: 17080, nota: 'Mi parte del gasóleo' });
  const tz = t(2, 2, 22);
  add('esto_es_tuyo', A, tz, { para: C, que: 'Unas zapatillas en la escalera' });
  add('recogido', C, tz + HORA, { aviso: `prueba-${n}` });

  // Semana 4 (la pasada): todo aprobado; A lo deja para el domingo por la noche
  hecho(3, B, t(3, 2, 19));
  voto(3, B, A, 9, t(3, 3, 8));
  voto(3, B, C, 9, t(3, 3, 9));
  hecho(3, C, t(3, 3, 20));
  voto(3, C, A, 10, t(3, 4, 9));
  voto(3, C, B, 9, t(3, 4, 13));
  hecho(3, A, t(3, 6, 22, 40));
  voto(3, A, B, 8, t(4, 0, 9));
  voto(3, A, C, 9, t(4, 0, 13));
  gasto(C, t(3, 1, 19), 'Compra común: Gadis', 'compra', 1890);
  gasto(A, t(3, 2, 10), 'Prime', 'prime', 499);
  add('esto_es_tuyo', C, t(3, 4, 10), { para: B, que: 'Una toalla en la terraza' });

  // Semana actual: depende de cuánto lleve la semana
  const lunes = inicioSemana(s + 4);
  const E = ahora - lunes;
  if (E > 4 * HORA) {
    const hC = lunes + E * 0.3;
    hecho(4, C, hC);
    voto(4, C, A, 9, hC + Math.min(5 * HORA, E * 0.1));
    voto(4, C, B, 8, hC + Math.min(8 * HORA, E * 0.2));
    const hB = Math.max(lunes + E * 0.6, ahora - 30 * HORA);
    hecho(4, B, hB);
    voto(4, B, C, 8, Math.min(hB + 3 * HORA, ahora - HORA / 2));
    const b4 = basuraDe(config, s + 4)!;
    add('basura_llena', otroQue(b4), ahora - 3 * HORA);
  }
  add('esto_es_tuyo', B, ahora - 2 * HORA, { para: A, que: 'La media bola naranja del jardín', fotos: hayFotoDemo('bola') ? ['demo:bola'] : [] });

  // El chat: un mensaje fijado y una conversación de los últimos días
  const msg = (autor: MiembroId, ts: number, texto: string, extra: any = {}) => add('mensaje', autor, ts, { texto, ...extra });
  msg(B, t(3, 0, 21, 5), 'Recordad que el jueves viene el del gasóleo por la mañana');
  add('mensaje_fijado', A, t(3, 0, 21, 20), { mensaje: `prueba-${n}` });
  msg(A, t(3, 0, 21, 18), 'Vale, yo estoy en casa hasta las 11');
  msg(C, ahora - 26 * HORA, '¿Alguien ha visto mi cargador? 🔌');
  msg(B, ahora - 25.8 * HORA, 'Estaba en el salón de arriba 👆');
  msg(A, ahora - 25.7 * HORA, 'Jajaja ya tienes otro «Esto es tuyo» 😂');
  msg(A, ahora - 4 * HORA, '¿Esta noche pizza? 🍕');
  msg(B, ahora - 3.9 * HORA, 'Yo me apunto');

  // Alquiler: uno paga el día 9 y el otro se retrasa al 12
  const al = config.alquiler;
  const [puntual, tardon] = config.miembros.map((m) => m.id).filter((m) => m !== al.paga);
  for (const m of mesesEntre(al.desde, mes(ahora))) {
    const [y, mm] = m.split('-').map(Number);
    const t9 = inicioDia(Date.UTC(y, mm - 1, 9) / 86400000) + 21 * HORA;
    const t12 = inicioDia(Date.UTC(y, mm - 1, 12) / 86400000) + 10 * HORA;
    if (puntual && t9 <= ahora) add('pago', puntual, t9, { de: puntual, a: al.paga, importe: al.partes[puntual] ?? 0, alquiler: m });
    if (tardon && t12 <= ahora) add('pago', tardon, t12, { de: tardon, a: al.paga, importe: al.partes[tardon] ?? 0, alquiler: m });
  }

  return ev.filter((e) => e.ts <= ahora).sort((a, b) => a.ts - b.ts);
}

export function almacenPrueba(ahora: number): Almacen {
  const config = configPrueba(ahora);
  let datos = leer(CLAVE);
  if (!datos || datos.inicio !== config.inicio) {
    datos = { inicio: config.inicio, eventos: generarPrueba(config, ahora) };
    guardar(CLAVE, datos);
  }
  let eventos: Evento[] = datos.eventos;
  let yo: MiembroId = leer(CLAVE_YO) ?? config.miembros[0].id;
  if (!config.miembros.some((m) => m.id === yo)) yo = config.miembros[0].id;
  const oyentes = new Set<(e: Evento) => void>();

  const almacen: Almacen = {
    modo: 'prueba',
    config,
    get yo() { return yo; },
    async cargarEventos() { return eventos.slice(); },
    escuchar(f) { oyentes.add(f); return () => oyentes.delete(f); },
    async apuntar(tipo, d) {
      const e: Evento = { id: nuevoId(), ts: Date.now(), autor: yo, tipo, datos: d };
      eventos = [...eventos, e];
      if (!guardar(CLAVE, { inicio: config.inicio, eventos })) {
        // Sin espacio: quitamos las fotos más antiguas de la prueba y seguimos
        eventos = eventos.map((x, i) => (i < eventos.length - 5 && x.datos?.fotos ? { ...x, datos: { ...x.datos, fotos: [] } } : x));
        guardar(CLAVE, { inicio: config.inicio, eventos });
      }
      return e;
    },
    async subirFoto(archivo) {
      return blobADataUrl(await comprimirFoto(archivo, 900, 0.7));
    },
    async subirAudio(audio) {
      return blobADataUrl(audio);
    },
    async urlFoto(ref) {
      if (ref.startsWith('demo:')) return FOTOS[ref.slice(5)] ?? '';
      return ref;
    },
    cambiarYo(m) { yo = m; guardar(CLAVE_YO, m); },
    reiniciar() {
      eventos = generarPrueba(config, Date.now());
      guardar(CLAVE, { inicio: config.inicio, eventos });
    },
    async salir() {},
  };
  return almacen;
}
