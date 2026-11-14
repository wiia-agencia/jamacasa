// Avisos al móvil: a quién hay que avisar, cuándo y con qué palabras.
// Son reglas puras, como el resto de src/core: la función del servidor (servidor/avisos.ts)
// solo trae los datos, las llama y manda lo que salga.
//  · avisosDeEvento: lo que hay que avisar en cuanto alguien apunta algo.
//  · avisosDelReloj: lo que toca por la hora (se llama cada hora con la hora que acaba de pasar).
import { basuraDe, zonaDe } from './calendario';
import { resumen } from './chat';
import { alquilerPendiente, euros } from './cuentas';
import { desdeAntes, responsableEn } from './basura';
import { derivar, tareaDe } from './estado';
import type { Intento, Tarea } from './limpieza';
import { nota } from './noticias';
import { HORA, diaLocal, duracion, fechaDeDia, instanteLocal, lunesDe, mes, mesesEntre, nombreDia, nombreMes, semana } from './tiempo';
import type { Config, Evento, MiembroId, Normas } from './tipos';

export type Pantalla = 'hoy' | 'limpieza' | 'cuentas' | 'juego' | 'chat';

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

/** Aprobado o suspendido: se le dice a quien lo limpió (el dueño del piso o quien lo hizo por él). */
function resultado(t: Tarea, i: Intento, n: Normas, nombre: (m: MiembroId) => string): Aviso {
  const etiqueta = `nota-${t.semana}-${t.miembro}-${i.n}`;
  const piso = i.quien === t.miembro ? t.zona.nombre : `${t.zona.nombre} de ${nombre(t.miembro)}`;
  if (i.aprobado) {
    return {
      para: i.quien,
      titulo: `✅ ${piso}: aprobado con un ${nota(i.media!)}`,
      texto: i.auto ? 'Nadie te puso nota a tiempo: va con la nota automática.' : `Suma ${nota(i.media!)} puntos.`,
      pantalla: 'limpieza',
      etiqueta,
    };
  }
  return {
    para: i.quien,
    titulo: `❌ ${piso}: suspendido con un ${nota(i.media!)}`,
    texto: `Son ${pts(n.puntosSuspenso)}. Repásalo y vuelve a marcarlo.`,
    pantalla: 'limpieza',
    etiqueta,
  };
}

/** El resultado a quien lo limpió y, si se aprobó, a los que le echaron una mano (su +2). */
function resultados(t: Tarea, i: Intento, n: Normas, nombre: (m: MiembroId) => string): Aviso[] {
  const r = [resultado(t, i, n, nombre)];
  if (i.aprobado) {
    for (const a of i.ayudaron) {
      r.push({ para: a, titulo: `✅ El ${t.zona.nombre.toLowerCase()} de ${nombre(i.quien)}: aprobado con un ${nota(i.media!)}`, texto: `Le echaste una mano: ${pts(n.puntosAyuda)}.`, pantalla: 'limpieza', etiqueta: `nota-${t.semana}-${t.miembro}-${i.n}` });
    }
  }
  return r;
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
      // a quien la tiene ahora (la del sorteo o quien se la ha quedado)
      const s = estado.semanasBasura.find((x) => x.semana === w);
      const r = s ? responsableEn(s, e.ts) : basuraDe(config, w);
      if (!r || r === e.autor) return [];
      return [{ para: r, titulo: '🗑️ La basura está llena', texto: `Te avisa ${yo}. Tienes ${n.horasBasura} horas para sacarla.`, pantalla: 'hoy', etiqueta: `basura-${w}` }];
    }
    case 'esto_es_tuyo': {
      const a = estado.tuyos.find((x) => x.id === e.id);
      if (!a || a.para === e.autor) return [];
      const que = a.que ? `${mayus(a.que)}. ` : '';
      return [{ para: a.para, titulo: `🧦 ${yo} dice que esto es tuyo`, texto: `${que}Tienes ${n.horasEstoEsTuyo} horas para recogerlo.`, pantalla: 'hoy', etiqueta: `tuyo-${e.id}` }];
    }
    case 'zona_empezada': {
      // Solo la primera vez de esa semana, y si aún no lo ha marcado como hecho
      const t = tareaDe(estado, Number(e.datos?.semana), e.autor);
      if (!t || t.empezada !== e.ts || t.primerHecho !== undefined) return [];
      return config.miembros
        .filter((x) => x.id !== e.autor)
        .map((x) => ({ para: x.id, titulo: `🧽 ${yo} ha empezado a limpiar`, texto: `El ${t.zona.nombre.toLowerCase()}.`, pantalla: 'limpieza' as const, etiqueta: `empezada-${t.semana}-${e.autor}` }));
    }
    case 'zona_hecha': {
      // si lo ha limpiado por otro (`de`), el piso es de ese otro
      const de = config.miembros.some((x) => x.id === e.datos?.de) ? e.datos.de : e.autor;
      const t = tareaDe(estado, Number(e.datos?.semana), de);
      const i = t?.intentos[t.intentos.length - 1];
      if (!t || !i || i.hecho.id !== e.id) return []; // marcado de más: no cuenta
      const hecho = i.n > 1 ? 'ha repasado' : 'ha terminado';
      return i.sinVotar.map((j) => {
        const piso = de === e.autor ? `el ${t.zona.nombre}` : j === de ? `tu ${t.zona.nombre.toLowerCase()}` : `el ${t.zona.nombre} de ${nombre(de)}`;
        return { para: j, titulo: `🧹 ${yo} ${hecho} ${piso}`, texto: `Ponle nota: tienes ${n.horasRevision} horas.`, pantalla: 'hoy' as const, etiqueta: `puntuar-${t.semana}-${t.miembro}-${i.n}` };
      });
    }
    case 'zona_cubierta': {
      // «Lo limpio yo»: se lo dice al dueño del piso y al otro (si lo deja, solo al dueño)
      const t = tareaDe(estado, Number(e.datos?.semana), e.datos?.de);
      if (!t || t.miembro === e.autor) return [];
      const z = t.zona.nombre.toLowerCase();
      if (e.datos?.deja) {
        if (t.cubre !== undefined || t.primerHecho !== undefined) return [];
        return [{ para: t.miembro, titulo: `🤝 ${yo} ya no se encarga de tu piso`, texto: `El ${z} vuelve a ser cosa tuya esta semana.`, pantalla: 'limpieza', etiqueta: `cubierta-${t.semana}-${t.miembro}` }];
      }
      if (t.cubre !== e.autor || t.cubiertaEn !== e.ts) return [];
      return config.miembros
        .filter((x) => x.id !== e.autor)
        .map((x) => ({
          para: x.id,
          titulo: x.id === t.miembro ? `🤝 ${yo} se encarga de tu piso esta semana` : `🤝 ${yo} se encarga del piso de ${nombre(t.miembro)}`,
          texto: `El ${z}. Cuando lo marque, le pones nota.`,
          pantalla: 'limpieza' as const,
          etiqueta: `cubierta-${t.semana}-${t.miembro}`,
        }));
    }
    case 'zona_hecha_por': {
      // «Lo limpió Jose»: a los otros dos (al que lo limpió, que la nota es suya; a los demás, quién fue)
      const t = tareaDe(estado, Number(e.datos?.semana), e.datos?.de);
      const i = t?.intentos.find((x) => x.n === Number(e.datos?.intento));
      if (!t || !i || i.corregido?.ts !== e.ts || i.quien !== e.datos?.quien) return [];
      const z = t.zona.nombre.toLowerCase();
      return config.miembros
        .filter((x) => x.id !== e.autor)
        .map((x) => {
          const piso = x.id === t.miembro ? `tu ${z}` : `el ${z} de ${nombre(t.miembro)}`;
          const suyo = x.id === i.quien;
          return {
            para: x.id,
            titulo: `✏️ ${yo} dice que ${piso} lo ${suyo ? 'limpiaste tú' : `limpió ${nombre(i.quien)}`}`,
            texto: suyo ? 'La nota es para ti.' : i.sinVotar.includes(x.id) ? `La nota es para ${nombre(i.quien)}: ponle nota.` : `La nota es para ${nombre(i.quien)}.`,
            pantalla: 'limpieza' as const,
            etiqueta: `corregido-${t.semana}-${t.miembro}-${i.n}`,
          };
        });
    }
    case 'zona_ayuda': {
      // «Le echo una mano»: a quien lo está limpiando (y al dueño, si lo limpia otro); al dejarlo, nada
      if (e.datos?.deja) return [];
      const t = tareaDe(estado, Number(e.datos?.semana), e.datos?.de);
      if (!t || !t.ayudan.includes(e.autor)) return [];
      const con = t.cubre ?? t.miembro;
      const z = t.zona.nombre.toLowerCase();
      const r: Aviso[] = [{ para: con, titulo: `🤝 ${yo} te echa una mano con el ${z}`, texto: `Lo que marque cuenta en tu lista. Si se aprueba, ${pts(n.puntosAyuda)} para él.`, pantalla: 'limpieza', etiqueta: `ayuda-${t.semana}-${t.miembro}-${e.autor}` }];
      if (con !== t.miembro) r.push({ para: t.miembro, titulo: `🤝 ${yo} le echa una mano a ${nombre(con)} con tu piso`, texto: `El ${z}.`, pantalla: 'limpieza', etiqueta: `ayuda-${t.semana}-${t.miembro}-${e.autor}` });
      return r.filter((x) => x.para !== e.autor);
    }
    case 'basura_sacada': {
      // «Esta la saqué yo»: si la saca otro, se lo dice a quien la tiene
      const s = estado.semanasBasura.find((x) => x.ajenas.some((a) => a.id === e.id));
      if (!s) return [];
      const quien = responsableEn(s, e.ts);
      const resolvio = s.avisos.some((a) => a.resueltoEn === e.ts && a.estado === 'resuelto');
      return [{ para: quien, titulo: `🗑️ ${yo} ha sacado tu basura`, texto: `${resolvio ? 'Ya no te cae la queja. ' : ''}${pts(n.puntosSacarAjena)} para él.`, pantalla: 'hoy', etiqueta: `basura-${s.semana}` }];
    }
    case 'basura_cubierta': {
      // «Me la quedo yo» (o «Te la devuelvo»): se lo dice a los otros dos
      const s = estado.semanasBasura.find((x) => x.semana === Number(e.datos?.semana));
      const tr = s?.tramos.find((x) => x.evento?.id === e.id);
      if (!s || !tr) return [];
      // quien la tenía justo antes de desde cuándo se la queda (ahora o el día que dijo)
      const antes = responsableEn(s, tr.desde - 1);
      if (tr.quien === e.autor) {
        return config.miembros
          .filter((x) => x.id !== e.autor)
          .map((x) => ({
            para: x.id,
            titulo: `🗑️ ${yo} se queda la basura ${desdeAntes(tr) ? `desde el ${nombreDia(tr.desde)}` : 'esta semana'}`,
            texto: x.id === antes ? 'Ya no te toca: los avisos le llegan a él.' : 'Si se llena, ahora se le avisa a él.',
            pantalla: 'hoy' as const,
            etiqueta: `basura-${s.semana}`,
          }));
      }
      return [{ para: tr.quien, titulo: `🗑️ ${yo} te devuelve la basura`, texto: 'Esta semana vuelve a ser tuya: sácala cada vez que se llene.', pantalla: 'hoy', etiqueta: `basura-${s.semana}` }];
    }
    case 'puntuacion': {
      const d = e.datos ?? {};
      const t = tareaDe(estado, Number(d.semana), d.de);
      const i = t?.intentos.find((x) => x.n === d.intento);
      // Solo cuando con este voto queda resuelto (el otro ya había votado)
      if (!t || !i || !i.resuelto || i.resueltoEn !== e.ts) return [];
      return resultados(t, i, n, nombre);
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
    case 'mensaje': {
      const m = estado.chat.mensajes.find((x) => x.id === e.id);
      if (!m || m.borrado) return [];
      return config.miembros
        .filter((x) => x.id !== e.autor)
        .map((x) => ({ para: x.id, titulo: `💬 ${yo}`, texto: resumen(m), pantalla: 'chat' as const, etiqueta: `chat-${e.autor}` }));
    }
    case 'mensaje_fijado': {
      const f = estado.chat.fijado;
      if (!f || f.id !== e.datos?.mensaje) return [];
      return config.miembros
        .filter((x) => x.id !== e.autor)
        .map((x) => ({ para: x.id, titulo: `📌 ${yo} ha fijado un mensaje`, texto: resumen(f), pantalla: 'chat' as const, etiqueta: 'chat-fijado' }));
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
      const sb = estado.semanasBasura.find((x) => x.semana === w);
      const b = sb ? responsableEn(sb, aLas(lunesDe(w), 9)) : basuraDe(config, w);
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
        const lleva = t.cubre !== undefined ? ` Lo lleva ${nombre(t.cubre)}, pero el piso sigue siendo tuyo.` : '';
        r.push({ para: m.id, titulo: `⏰ El ${t.zona.nombre} sigue sin marcar`, texto: `Tienes hasta las 23:59. Desde mañana, ${pts(n.puntosRetrasoDia)} por día.${lleva}`, pantalla: 'hoy', etiqueta: `domingo-${w}` });
        // y a quien dijo «Lo limpio yo»
        if (t.cubre !== undefined) {
          r.push({ para: t.cubre, titulo: `⏰ El ${t.zona.nombre} de ${nombre(m.id)} sigue sin marcar`, texto: 'Te encargas tú: hasta las 23:59.', pantalla: 'limpieza', etiqueta: `domingo-${w}-${m.id}` });
        }
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
          const que = i.quien === t.miembro ? `El ${t.zona.nombre} de ${nombre(t.miembro)}` : j === t.miembro ? `Tu ${t.zona.nombre.toLowerCase()}, que limpió ${nombre(i.quien)}` : `El ${t.zona.nombre} de ${nombre(t.miembro)}, que limpió ${nombre(i.quien)}`;
          r.push({ para: j, titulo: `⏰ Te quedan ${duracion(i.fin - ahora)} para puntuar`, texto: `${que}. Puntuar a tiempo da ${pts(n.puntosRevisar)}.`, pantalla: 'hoy', etiqueta: `puntuar-${t.semana}-${t.miembro}-${i.n}` });
        }
      }
      // Con todas las notas, el resultado sale al votar (avisosDeEvento); si no, al cerrarse el plazo
      if (i.resuelto && i.resueltoEn === i.fin && i.sinVotar.length > 0 && en(i.fin)) r.push(...resultados(t, i, n, nombre));
    }
  }

  // «Tu espacio»: el día que toca, a las 19:00, y si sigue sin hacer, otra vez a los 3 días (solo a su dueño)
  for (const [m, cosas] of Object.entries(estado.espacio)) {
    for (const c of cosas) {
      for (const d of [c.venceDia, c.venceDia + 3]) {
        if (!en(aLas(d, 19))) continue;
        const dias = d - diaLocal(c.ultima ?? c.creada);
        r.push({
          para: m,
          titulo: `🧽 ${c.nombre} lleva ${dias} días`,
          texto: d === c.venceDia ? '¿Le das un repaso? Cuando lo hagas, márcalo en Limpieza.' : 'Sigue sin hacer. Cuando lo limpies, márcalo en Limpieza.',
          pantalla: 'limpieza',
          etiqueta: `espacio-${c.id}`,
        });
      }
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
