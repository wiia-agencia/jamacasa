// Avisos al móvil: a quién hay que avisar, cuándo y con qué palabras.
// Son reglas puras, como el resto de src/core: la función del servidor (servidor/avisos.ts)
// solo trae los datos, las llama y manda lo que salga.
//  · avisosDeEvento: lo que hay que avisar en cuanto alguien apunta algo.
//  · avisosDelReloj: lo que toca por la hora (se llama cada hora con la hora que acaba de pasar).
import { basuraDe, zonaDe } from './calendario';
import { alquilerPendiente, euros } from './cuentas';
import { derivar, tareaDe } from './estado';
import type { Intento, Tarea } from './limpieza';
import { nota } from './noticias';
import { HORA, duracion, fechaDeDia, instanteLocal, lunesDe, mes, mesesEntre, nombreMes, semana } from './tiempo';
import type { Config, Evento, MiembroId, Normas } from './tipos';

export type Pantalla = 'hoy' | 'limpieza' | 'cuentas' | 'juego';

export interface Aviso {
  para: MiembroId;
  titulo: string;
  texto: string;
  pantalla: Pantalla; // dónde se abre la app al tocar el aviso
  etiqueta: string; // un aviso nuevo con la misma etiqueta sustituye al anterior en el móvil
}

const mayus = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const pts = (x: number) => (x > 0 ? `+${nota(x)}` : `−${nota(-x)}`);
/** "425 €" o "36,80 €" */
const eur = (c: number) => euros(c).replace(',00 €', ' €');
/** Instante de una hora de reloj (Madrid) en un día contado desde 1970. */
const aLas = (dia: number, h: number) => {
  const f = fechaDeDia(dia);
  return instanteLocal(f.y, f.m, f.d, h);
};

function nombres(config: Config) {
  return (m: MiembroId | null | undefined) => config.miembros.find((x) => x.id === m)?.nombre ?? 'Alguien';
}

/** Aprobado o suspendido: se le dice al dueño del piso. */
function resultado(t: Tarea, i: Intento, n: Normas): Aviso {
  const etiqueta = `nota-${t.semana}-${t.miembro}-${i.n}`;
  if (i.aprobado) {
    return {
      para: t.miembro,
      titulo: `✅ ${t.zona.nombre}: aprobado con un ${nota(i.media!)}`,
      texto: i.auto ? 'Nadie te puso nota a tiempo: va con la nota automática.' : `Suma ${nota(i.media!)} puntos.`,
      pantalla: 'limpieza',
      etiqueta,
    };
  }
  return {
    para: t.miembro,
    titulo: `❌ ${t.zona.nombre}: suspendido con un ${nota(i.media!)}`,
    texto: `Son ${pts(n.puntosSuspenso)}. Repásalo y vuelve a marcarlo.`,
    pantalla: 'limpieza',
    etiqueta,
  };
}

/** Lo que hay que avisar en cuanto se apunta el evento `id`. */
export function avisosDeEvento(config: Config, eventos: Evento[], id: string): Aviso[] {
  const e = eventos.find((x) => x.id === id);
  if (!e) return [];
  const estado = derivar(config, eventos, e.ts);
  const n = estado.normas;
  const nombre = nombres(config);
  const yo = nombre(e.autor);
  const w = semana(e.ts);

  switch (e.tipo) {
    case 'basura_llena': {
      if (w < estado.semanaInicio) return [];
      const r = basuraDe(config, w);
      if (!r || r === e.autor) return [];
      return [{ para: r, titulo: '🗑️ La basura está llena', texto: `Te avisa ${yo}. Tienes ${n.horasBasura} horas para sacarla.`, pantalla: 'hoy', etiqueta: `basura-${w}` }];
    }
    case 'esto_es_tuyo': {
      const a = estado.tuyos.find((x) => x.id === e.id);
      if (!a || a.para === e.autor) return [];
      const que = a.que ? `${mayus(a.que)}. ` : '';
      return [{ para: a.para, titulo: `🧦 ${yo} dice que esto es tuyo`, texto: `${que}Tienes ${n.horasEstoEsTuyo} horas para recogerlo.`, pantalla: 'hoy', etiqueta: `tuyo-${e.id}` }];
    }
    case 'zona_hecha': {
      const t = tareaDe(estado, Number(e.datos?.semana), e.autor);
      const i = t?.intentos[t.intentos.length - 1];
      if (!t || !i || i.hecho.id !== e.id) return []; // marcado de más: no cuenta
      const titulo = i.n > 1 ? `🧹 ${yo} ha repasado el ${t.zona.nombre}` : `🧹 ${yo} ha terminado el ${t.zona.nombre}`;
      return i.sinVotar.map((j) => ({ para: j, titulo, texto: `Ponle nota: tienes ${n.horasRevision} horas.`, pantalla: 'hoy' as const, etiqueta: `puntuar-${t.semana}-${t.miembro}-${i.n}` }));
    }
    case 'puntuacion': {
      const d = e.datos ?? {};
      const t = tareaDe(estado, Number(d.semana), d.de);
      const i = t?.intentos.find((x) => x.n === d.intento);
      // Solo cuando con este voto queda resuelto (el otro ya había votado)
      if (!t || !i || !i.resuelto || i.resueltoEn !== e.ts) return [];
      return [resultado(t, i, n)];
    }
    case 'gasto': {
      const g = estado.cuentas.gastos.find((x) => x.id === e.id);
      if (!g || g.anulado) return [];
      return Object.entries(g.partes)
        .filter(([m, v]) => m !== e.autor && v > 0)
        .map(([m, v]) => ({ para: m, titulo: `💶 ${yo} ha apuntado un gasto`, texto: `${mayus(g.concepto)}: ${eur(g.importe)}. Te tocan ${eur(v)}.`, pantalla: 'cuentas' as const, etiqueta: `gasto-${e.id}` }));
    }
    case 'pago': {
      const p = estado.cuentas.pagos.find((x) => x.id === e.id);
      if (!p || p.anulado) return [];
      const que = p.alquiler ? `El alquiler de ${nombreMes(p.alquiler)}. ` : p.nota ? `${mayus(p.nota)}. ` : '';
      const r: Aviso[] = [];
      if (p.a !== e.autor) {
        r.push({ para: p.a, titulo: `💸 ${nombre(p.de)} te ha pagado ${eur(p.importe)}`, texto: `${que}Ya está apuntado en Cuentas.`, pantalla: 'cuentas', etiqueta: `pago-${e.id}` });
      }
      if (p.de !== e.autor) {
        const titulo = p.a === e.autor ? `💸 ${yo} ha apuntado que le pagaste ${eur(p.importe)}` : `💸 ${yo} ha apuntado que pagaste ${eur(p.importe)} a ${nombre(p.a)}`;
        r.push({ para: p.de, titulo, texto: `${que}Si no es así, díselo.`, pantalla: 'cuentas', etiqueta: `pago-${e.id}` });
      }
      return r;
    }
    case 'aviso_prueba':
      return [{ para: e.autor, titulo: '🔔 Así te llegarán los avisos', texto: 'La basura, las notas, «Esto es tuyo», las cuentas… Solo lo que te toca a ti.', pantalla: 'hoy', etiqueta: 'prueba' }];
  }
  return [];
}

/**
 * Lo que toca avisar por la hora: lo que cae después de `desde` y hasta `hasta` (incluido).
 * `ahora` es para los textos con lo que queda («te quedan 1 h 40 min»).
 */
export function avisosDelReloj(config: Config, eventos: Evento[], desde: number, hasta: number, ahora = hasta): Aviso[] {
  const estado = derivar(config, eventos, hasta);
  const n = estado.normas;
  const s = estado.semanaInicio;
  const nombre = nombres(config);
  const en = (t: number) => t > desde && t <= hasta;
  const r: Aviso[] = [];
  const semanas = [...new Set([semana(desde) - 1, semana(desde), semana(hasta)])].filter((w) => w >= s);

  for (const w of semanas) {
    // Lunes a las 9: el piso de la semana y de quién es la basura
    if (en(aLas(lunesDe(w), 9))) {
      const b = basuraDe(config, w);
      for (const m of config.miembros) {
        const zona = zonaDe(config, w, m.id);
        if (!zona) continue;
        const partes = [b === m.id ? 'Y la basura es tuya: sácala cada vez que se llene.' : `La basura es de ${nombre(b)}.`];
        const antes = w - 1 >= s ? tareaDe(estado, w - 1, m.id) : undefined;
        if (antes?.estado === 'pendiente') partes.push(`Ojo: el ${antes.zona.nombre} de la semana pasada sigue sin hacer.`);
        if (antes?.estado === 'suspendida') partes.push(`Ojo: el ${antes.zona.nombre} sigue suspendido.`);
        r.push({
          para: m.id,
          titulo: w === s ? `🎉 Arranca la Jamacasa: te toca el ${zona.nombre}` : `🧹 Esta semana te toca el ${zona.nombre}`,
          texto: partes.join(' '),
          pantalla: 'hoy',
          etiqueta: `semana-${w}`,
        });
      }
    }
    // Domingo a las 20: quien aún no ha marcado su piso
    if (en(aLas(lunesDe(w) + 6, 20))) {
      for (const m of config.miembros) {
        const t = tareaDe(estado, w, m.id);
        if (t?.estado !== 'pendiente') continue;
        r.push({ para: m.id, titulo: `⏰ El ${t.zona.nombre} sigue sin marcar`, texto: `Tienes hasta las 23:59. Desde mañana, ${pts(n.puntosRetrasoDia)} por día.`, pantalla: 'hoy', etiqueta: `domingo-${w}` });
      }
    }
  }

  // La basura: dos horas antes del plazo y, si se pasa, la queja
  for (const a of estado.semanasBasura.flatMap((x) => x.avisos)) {
    if (a.estado === 'abierto' && en(a.limite - 2 * HORA)) {
      r.push({ para: a.responsable, titulo: `⏰ Te quedan ${duracion(a.limite - ahora)} para sacar la basura`, texto: `Si no, queja: ${pts(n.puntosQuejaBasura)}.`, pantalla: 'hoy', etiqueta: `basura-${a.semana}` });
    }
    if (a.estado === 'queja' && en(a.limite)) {
      r.push({ para: a.responsable, titulo: `🗑️ Se acabaron las ${n.horasBasura} horas`, texto: `Queja por la basura: ${pts(n.puntosQuejaBasura)}. Sácala cuanto antes.`, pantalla: 'hoy', etiqueta: `basura-${a.semana}` });
    }
  }

  // «Esto es tuyo»: dos horas antes del plazo y, si se pasa, el punto
  for (const a of estado.tuyos) {
    const que = a.que ? mayus(a.que) : 'Lo que te dejaste por ahí';
    if (a.estado === 'abierto' && en(a.limite - 2 * HORA)) {
      r.push({ para: a.para, titulo: `⏰ Te quedan ${duracion(a.limite - ahora)} para recoger lo tuyo`, texto: `${que}. Si no, ${pts(n.puntosEstoEsTuyo)}.`, pantalla: 'hoy', etiqueta: `tuyo-${a.id}` });
    }
    if (a.estado === 'multa' && en(a.limite)) {
      r.push({ para: a.para, titulo: '🧦 Sin recoger a tiempo', texto: `${que}: ${pts(n.puntosEstoEsTuyo)}.`, pantalla: 'hoy', etiqueta: `tuyo-${a.id}` });
    }
  }

  // Notas: seis horas antes de que se cierre el plazo y, al cerrarse, el resultado
  for (const t of estado.tareas) {
    for (const i of t.intentos) {
      if (!i.resuelto && en(i.fin - 6 * HORA)) {
        for (const j of i.sinVotar) {
          r.push({ para: j, titulo: `⏰ Te quedan ${duracion(i.fin - ahora)} para puntuar`, texto: `El ${t.zona.nombre} de ${nombre(t.miembro)}. Puntuar a tiempo da ${pts(n.puntosRevisar)}.`, pantalla: 'hoy', etiqueta: `puntuar-${t.semana}-${t.miembro}-${i.n}` });
        }
      }
      // Con todas las notas, el resultado sale al votar (avisosDeEvento); si no, al cerrarse el plazo
      if (i.resuelto && i.resueltoEn === i.fin && i.sinVotar.length > 0 && en(i.fin)) r.push(resultado(t, i, n));
    }
  }

  // El alquiler: el día de pago a las 10, a quien aún no lo ha pagado
  const al = config.alquiler;
  if (al && al.total > 0) {
    for (const m of mesesEntre(al.desde, mes(hasta))) {
      const [y, mm] = m.split('-').map(Number);
      if (!en(instanteLocal(y, mm, al.dia, 10))) continue;
      for (const persona of config.miembros.map((x) => x.id)) {
        const p = alquilerPendiente(estado.cuentas, persona, m);
        if (!p || p.parte <= 0) continue;
        r.push({ para: persona, titulo: '🏠 Hoy toca el alquiler', texto: `${eur(p.parte)} a ${nombre(al.paga)}. Cuando hagas el Bizum, márcalo en Cuentas.`, pantalla: 'cuentas', etiqueta: `alquiler-${m}` });
      }
    }
  }
  return r;
}
