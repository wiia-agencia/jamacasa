// El cuadro de la semana (la B que eligió Javi el 14 de noviembre: «que podamos movernos de un piso a otro
// fácilmente»): los tres pisos y la basura con quién está en cada uno. Se coge a cualquiera (su cara, arriba o en una
// fila) y se suelta en un piso o en la basura; o se toca la fila y se elige a quién (Javi, 14 de noviembre: «coger a un
// personaje y moverlo al piso que quiera… pulsar en el piso y poder añadir a quien yo quiera»). Sale lo que se puede
// hacer: echar una mano, limpiarlo, «Ya lo ha limpiado», sacar la basura o quedársela; y quitar a quien esté.
import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { avisosBasuraAbiertos, basuraTocaba, paraPuntuar, tareaDe } from '../core/estado';
import { nota } from '../core/noticias';
import { diaLocal, inicioDia, lunesDe, nombreDia } from '../core/tiempo';
import type { Tarea } from '../core/limpieza';
import type { MiembroId } from '../core/tipos';
import { claseColor, useCasa } from './contexto';
import { BotonAccion, Hoja, Nombre } from './piezas';

// ——— El cuadro de la semana: lo que se puede hacer en cada fila ———

/** Para ir a la lista de un piso desde una hoja (la pantalla de Limpieza lo escucha). */
export function verPiso(m: MiembroId) {
  window.dispatchEvent(new CustomEvent('jamacasa-ver-piso', { detail: m }));
}

// las caras de los muñecos (las dibuja la casa en 3D); las hojas del cuadro las usan si ya están
let carasGuardadas: Record<string, string> = {};

/** Una opción grande de las hojas del cuadro: su emoji, qué es y una línea de qué pasa. */
function Opcion({ e, titulo, texto, hacer, principal = false, children }: { e: string; titulo: string; texto?: ReactNode; hacer?: () => Promise<void> | void; principal?: boolean; children?: ReactNode }) {
  const [ocupada, setOcupada] = useState(false);
  return (
    <button
      type="button"
      className={`opcion-grande ${principal ? 'principal' : ''}`}
      disabled={ocupada || !hacer}
      onClick={async () => {
        if (!hacer) return;
        setOcupada(true);
        try { await hacer(); } finally { setOcupada(false); }
      }}
    >
      <span className="e" aria-hidden="true">{e}</span>
      <span className="crece">
        <b>{ocupada ? 'Guardando…' : titulo}</b>
        {texto && <span>{texto}</span>}
        {children}
      </span>
    </button>
  );
}

/** «¿Quién?»: a quién se refiere lo de la hoja (tú, o a quien has arrastrado); se cambia tocando otra cara. */
function EligeQuien({ quien, elegir }: { quien: MiembroId; elegir: (m: MiembroId) => void }) {
  const { config, yo } = useCasa();
  const orden = [yo, ...config.miembros.map((m) => m.id).filter((id) => id !== yo)];
  return (
    <div className="elige-quien" role="radiogroup" aria-label="Quién">
      {orden.map((id) => {
        const m = config.miembros.find((x) => x.id === id)!;
        return (
          <button key={id} type="button" role="radio" aria-checked={quien === id} className={`elige-cara ${claseColor(m.color)}`} onClick={() => elegir(id)}>
            <span className={`cuadro-cara ${claseColor(m.color)}`}>{carasGuardadas[id] ? <img src={carasGuardadas[id]} alt="" /> : <span className="cuadro-inicial">{m.nombre.charAt(0)}</span>}</span>
            <b>{id === yo ? 'Tú' : m.nombre}</b>
          </button>
        );
      })}
    </div>
  );
}

/** El piso de alguien en el cuadro: lo que puede hacer ahí quien elijas (tú, o a quien has arrastrado). */
export function PonermePiso({ de, quien: inicial }: { de: MiembroId; quien?: MiembroId }) {
  const { cerrar, abrir, acciones, avisar, config, yo, estado } = useCasa();
  const [p, setP] = useState<MiembroId>(inicial ?? yo);
  const t = tareaDe(estado, estado.semana, de);
  if (!t) return null;
  const n = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? '';
  const y = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
  const z = t.zona.nombre;
  const zl = z.toLowerCase();
  const titulo = t.miembro === yo ? `Tu ${zl}` : `${z} de ${n(t.miembro)}`;
  const abierto = t.estado === 'pendiente' || t.estado === 'suspendida';
  const i = t.intentos[t.intentos.length - 1];
  const listo = (texto: string) => { cerrar(); avisar(texto); };

  if (!abierto) {
    // ya está hecho: ponerle nota (si te toca) o decir quién lo limpió de verdad
    const pp = paraPuntuar(estado, yo).find((x) => x.tarea.miembro === t.miembro && x.tarea.semana === t.semana);
    const sub = t.estado === 'esperando' ? `Ya está hecho: ${i.quien === yo ? 'lo limpiaste tú' : `lo limpió ${n(i.quien)}`} y espera nota.` : t.estado === 'aprobada' ? `Aprobado con un ${nota(t.nota!)}.` : 'Está hecho.';
    return (
      <Hoja titulo={titulo} subtitulo={sub} onCerrar={cerrar}>
        <div className="pila-s">
          {pp
            ? <Opcion e="★" titulo={`Ponle nota a ${n(pp.intento.quien)}`} principal hacer={() => abrir({ tipo: 'puntuar', tarea: pp.tarea, intento: pp.intento })} />
            : <Opcion e="🔎" titulo="Ver cómo ha quedado" hacer={() => abrir({ tipo: 'tarea', tarea: t })} />}
          <LoLimpioOtro t={t} />
        </div>
      </Hoja>
    );
  }

  const con = t.cubre ?? t.miembro; // quien lo está limpiando
  const sub = `${con === yo ? 'Lo limpias tú' : `Lo limpia ${n(con)}`}${t.ayudan.length ? ` · 🤝 ${y(t.ayudan.map((a) => (a === yo ? 'tú' : n(a))))}` : ''}.`;
  const tu = p === yo;
  const P = n(p);
  const para = tu ? 'ti' : P; // «la nota es para ti» / «para Jose»
  const esDueno = p === t.miembro;
  const esCubre = p === t.cubre;
  const ayuda = t.ayudan.includes(p);
  const elDueno = t.miembro === yo ? 'ti' : n(t.miembro);
  const ops: { k: string; e: string; titulo: string; texto?: string; hacer: () => Promise<void> | void }[] = [];

  if (tu && (esDueno || esCubre || ayuda)) {
    ops.push({ k: 'lista', e: '📋', titulo: t.miembro === yo ? 'Ver tu lista' : 'Ver su lista', texto: esDueno ? 'Lo que se limpia en tu piso.' : 'Lo que marques cuenta en su lista.', hacer: () => { cerrar(); verPiso(t.miembro); } });
  }
  if (!esDueno && !esCubre && !ayuda) {
    ops.push({
      k: 'ayuda', e: '🤝', titulo: tu ? 'Le echo una mano' : `${P} le echa una mano`,
      texto: `Lo ${tu ? 'hacéis' : 'hacen'} entre los dos: la nota es ${con === yo ? 'tuya' : `de ${n(con)}`} y, si se aprueba, ${nota(estado.normas.puntosAyuda)} puntos para ${para}.`,
      hacer: async () => {
        await acciones.ayudar(t.semana, t.miembro, p);
        listo(tu ? `Le echas una mano a ${n(con)}. Ya lo sabe.` : `${P} le echa una mano ${con === yo ? 'contigo' : `a ${n(con)}`}. Ya lo saben.`);
        if (tu) verPiso(t.miembro);
      },
    });
  }
  if (!esDueno && !esCubre) {
    ops.push({
      k: 'cubre', e: '🧹', titulo: tu ? 'Lo limpio yo' : `Lo limpia ${P}`,
      texto: t.cubre !== undefined
        ? `En vez de ${t.cubre === yo ? 'ti' : n(t.cubre)}: la nota es para ${para}.`
        : `${tu ? 'Te lo quedas' : 'Se lo queda'} esta semana: la nota es para ${para} y ${t.miembro === yo ? 'tú ni sumas ni restas' : `${n(t.miembro)} ni suma ni resta`}.`,
      hacer: async () => {
        await acciones.cubrir(t.semana, t.miembro, p);
        listo(tu ? `Te encargas del ${zl} de ${n(t.miembro)}.` : `${P} se encarga del ${zl}${t.miembro === yo ? ' (el tuyo)' : ` de ${n(t.miembro)}`}. Ya lo sabe.`);
        if (tu) verPiso(t.miembro);
      },
    });
  }
  if (!ayuda) {
    ops.push({
      k: 'hecho', e: '✅', titulo: tu ? 'Ya lo he limpiado yo' : `Ya lo ha limpiado ${P}`,
      texto: tu ? `Lo marcas hecho del tirón: la nota es para ti.` : `Lo marcas tú como hecho: la nota es para ${P} y le ponen nota los demás.`,
      hacer: async () => {
        if (tu) {
          // te lo quedas (o vuelve a ser tuyo) y lo marcas hecho, con sus fotos si quieres
          if (t.miembro !== yo && !esCubre) await acciones.cubrir(t.semana, t.miembro);
          if (t.miembro === yo && t.cubre !== undefined) await acciones.dejarDeCubrir(t.semana, t.miembro, t.cubre);
          abrir({ tipo: 'hecho', tarea: t });
          return;
        }
        await acciones.marcarHecho(t.semana, [], undefined, t.miembro !== yo ? t.miembro : undefined, p);
        listo(`Apuntado: lo ha limpiado ${P}. Ya le pueden poner nota.`);
      },
    });
  }
  if (esCubre) {
    ops.push({ k: 'deja', e: '↩️', titulo: tu ? 'Ya no lo limpio yo' : `${P} ya no lo limpia`, texto: `Vuelve a ser cosa de ${elDueno}.`, hacer: async () => { await acciones.dejarDeCubrir(t.semana, t.miembro, p); listo(`Vale: el ${zl} vuelve a ser cosa de ${elDueno}.`); } });
  }
  if (ayuda) {
    ops.push({ k: 'noayuda', e: '↩️', titulo: tu ? 'Ya no ayudo' : `${P} ya no ayuda`, hacer: async () => { await acciones.dejarDeAyudar(t.semana, t.miembro, p); listo(tu ? 'Vale: ya no sales ayudando.' : `Vale: ${P} ya no sale ayudando.`); } });
  }
  if (esDueno && t.cubre !== undefined) {
    const cubre = t.cubre;
    ops.push({ k: 'vuelve', e: '↩️', titulo: tu ? 'Lo limpio yo' : `Lo limpia ${P}`, texto: `${cubre === yo ? 'Dejas' : `${n(cubre)} deja`} de encargarse: vuelve a ser ${tu ? 'tuyo' : `de ${P}`}.`, hacer: async () => { await acciones.dejarDeCubrir(t.semana, t.miembro, cubre); listo(`Vale: el ${zl} vuelve a ser cosa de ${tu ? 'ti' : P}.`); } });
  }

  return (
    <Hoja titulo={titulo} subtitulo={sub} onCerrar={cerrar}>
      <div className="pila-s">
        <EligeQuien quien={p} elegir={setP} />
        {ops.map((o, k) => <Opcion key={`${p}-${o.k}`} e={o.e} titulo={o.titulo} texto={o.texto} principal={k === 0} hacer={o.hacer} />)}
      </div>
    </Hoja>
  );
}

/** «Me la quedo yo», con desde cuándo: ahora (lo normal) o desde un día de esta semana (el lunes, toda la semana). */
export function QuedarmeBasura({ despues }: { despues?: () => void }) {
  const { estado, acciones, avisar } = useCasa();
  const [desde, setDesde] = useState<number | null>(null);
  const lunes = lunesDe(estado.semana);
  const hoy = diaLocal(estado.ahora);
  const dias = Array.from({ length: Math.max(0, hoy - lunes + 1) }, (_, k) => lunes + k);
  const pts = estado.normas.puntosBasuraSemana;
  return (
    <div className="quedarme">
      <div className="desde-dias" role="radiogroup" aria-label="Desde cuándo te la quedas">
        <span>Desde</span>
        <button type="button" role="radio" aria-checked={desde === null} onClick={() => setDesde(null)}>ahora</button>
        {dias.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={desde === d} onClick={() => setDesde(d)}>
            {d === hoy ? 'hoy' : nombreDia(inicioDia(d), true)}
          </button>
        ))}
      </div>
      <p className="mini tenue">
        {desde === null
          ? `Desde ahora es tuya: los avisos te llegan a ti y, si acabas la semana sin quejas, sus ${pts} puntos también.`
          : desde === lunes
            ? `Toda la semana: cuenta como si te hubiera tocado a ti desde el lunes (sus ${pts} puntos y lo que haya pasado).`
            : `Desde el ${nombreDia(inicioDia(desde))}: lo de esos días (avisos y quejas) pasa a ser tuyo, y sus ${pts} puntos al acabar.`}
      </p>
      <BotonAccion
        clase="boton ancho borde"
        hacer={async () => {
          await acciones.quedarmeBasura(estado.semana, desde === null ? undefined : inicioDia(desde));
          despues?.();
          avisar(desde === null ? 'Te quedas la basura esta semana. Ya lo saben.' : `Te quedas la basura desde el ${nombreDia(inicioDia(desde))}. Ya lo saben.`);
        }}
      >
        Me la quedo yo
      </BotonAccion>
    </div>
  );
}


/** La basura en el cuadro: lo que puede hacer quien elijas (tú, o a quien has arrastrado). */
export function PonermeBasura({ quien: inicial }: { quien?: MiembroId }) {
  const { cerrar, abrir, acciones, avisar, config, yo, estado } = useCasa();
  const [p, setP] = useState<MiembroId>(inicial ?? yo);
  const resp = estado.basura;
  if (!resp) return null;
  const n = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? '';
  const tocaba = basuraTocaba(estado);
  const abiertos = avisosBasuraAbiertos(estado, resp);
  const deOtro = tocaba !== null && resp !== tocaba;
  const quienLaTiene = resp === yo ? (deOtro ? `Es tuya: te la quedaste (le tocaba a ${n(tocaba!)}).` : 'Esta semana es tuya.') : deOtro ? `La tiene ${n(resp)} (le tocaba a ${tocaba === yo ? 'ti' : n(tocaba!)}).` : `Le toca a ${n(resp)}.`;
  const sub = `${quienLaTiene} ${abiertos.length ? 'Está llena: avisada.' : 'Nadie ha avisado de que esté llena.'}`;
  const tu = p === yo;
  const P = n(p);
  const tiene = p === resp;
  const listo = (texto: string) => { cerrar(); avisar(texto); };
  return (
    <Hoja titulo="La basura" subtitulo={sub} onCerrar={cerrar}>
      <div className="pila-s">
        <EligeQuien quien={p} elegir={setP} />
        {tiene ? (
          <>
            <Opcion
              key={`${p}-sacada`}
              e="🗑️"
              titulo={tu ? 'Ya la saqué' : `La ha sacado ${P}`}
              texto={abiertos.length ? 'Y se acaba el aviso.' : 'Queda apuntado.'}
              principal
              hacer={async () => { await acciones.basuraSacada(p); listo(tu ? 'Basura sacada. ¡Gracias!' : `Apuntado: la ha sacado ${P}.`); }}
            />
            {deOtro && (
              <Opcion
                key={`${p}-devuelve`}
                e="↩️"
                titulo={tu ? 'Devolvérsela' : `Que vuelva a ser de ${tocaba === yo ? 'ti' : n(tocaba!)}`}
                texto={`Vuelve a ser de ${tocaba === yo ? 'ti' : n(tocaba!)} desde ahora.`}
                hacer={async () => { await acciones.pasarBasura(estado.semana, tocaba!); listo(tocaba === yo ? 'Vale: vuelve a ser tuya.' : `Devuelta: vuelve a ser de ${n(tocaba!)}.`); }}
              />
            )}
          </>
        ) : (
          <>
            <Opcion
              key={`${p}-ajena`}
              e="🗑️"
              titulo={tu ? 'Esta la saqué yo' : `La ha sacado ${P}`}
              texto={`${tu ? 'La has sacado tú' : `La sacó ${P}`} esta vez: ${nota(estado.normas.puntosSacarAjena)} punto para ${tu ? 'ti' : 'él'} (uno al día)${abiertos.length ? ' y se acaba el aviso' : ''}.`}
              principal
              hacer={async () => { await acciones.basuraSacada(p); listo(tu ? `Apuntado: la has sacado tú. Se lo decimos a ${n(resp)}.` : `Apuntado: la ha sacado ${P}. Ya lo saben.`); }}
            />
            {tu ? (
              <>
                <Opcion e="📣" titulo="Avisar: está llena" texto={`Le llega a ${n(resp)} y tiene ${estado.normas.horasBasura} horas.`} hacer={() => abrir({ tipo: 'basura' })} />
                <div className="opcion-grande sin-boton">
                  <span className="e" aria-hidden="true">🙋</span>
                  <span className="crece"><b>Me la quedo yo</b><span>Te la quedas esta semana (o desde el día que digas).</span></span>
                </div>
                <QuedarmeBasura despues={cerrar} />
              </>
            ) : (
              <Opcion
                key={`${p}-queda`}
                e="🙋"
                titulo={`Se la queda ${P}`}
                texto={`Desde ahora: si se llena, le avisan a él y, si acaba la semana sin quejas, sus ${estado.normas.puntosBasuraSemana} puntos.`}
                hacer={async () => { await acciones.pasarBasura(estado.semana, p); listo(`${P} se queda la basura desde ahora. Ya lo sabe.`); }}
              />
            )}
          </>
        )}
      </div>
    </Hoja>
  );
}


// ——— El cuadro ———

type Fila = MiembroId | 'basura'; // el piso de alguien (por su dueño) o la basura
type Arrastre = { quien: MiembroId; desde?: Fila; x: number; y: number; x0: number; y0: number; fila: Fila | null };

/** El cuadro de la semana: cuatro filas (los tres pisos y la basura) con quién está en cada una. Se coge a cualquiera
 *  (su cara arriba o la de una fila) y, al soltarlo en una fila, sale lo que puede hacer ahí; tocar la fila abre lo
 *  mismo para ti (y ahí se elige a otro); tocar una cara de una fila, para esa persona. */
export function CuadroSemana({ caras = {} }: { caras?: Record<string, string> }) {
  const { estado, config, yo, abrir, avisar } = useCasa();
  if (Object.keys(caras).length) carasGuardadas = caras;
  const w = estado.semana;
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const movido = useRef(false);
  const n = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? '';
  const color = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.color ?? '';
  const pisos = config.zonas.map((z) => estado.tareas.find((t) => t.semana === w && t.zona.id === z.id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const sb = estado.semanasBasura.find((x) => x.semana === w);
  const orden = [yo, ...config.miembros.map((m) => m.id).filter((id) => id !== yo)];

  const filaEn = (x: number, y: number): Fila | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return (el?.closest('[data-fila]')?.getAttribute('data-fila') as Fila | null) ?? null;
  };
  const lejos = (a: Arrastre) => Math.hypot(a.x - a.x0, a.y - a.y0) > 6;

  // coger a alguien (arriba, o en la fila `desde`) y soltarlo en una fila: sale su hoja en esa fila
  const asa = (quien: MiembroId, desde?: Fila) => ({
    role: 'button' as const,
    tabIndex: 0,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      movido.current = false;
      setArrastre({ quien, desde, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, fila: null });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!arrastre) return;
      const a = { ...arrastre, x: e.clientX, y: e.clientY };
      if (lejos(a)) movido.current = true;
      setArrastre({ ...a, fila: movido.current ? filaEn(e.clientX, e.clientY) : null });
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      const a = arrastre;
      setArrastre(null);
      if (!a || !movido.current) return; // un toque: lo hace onClick
      const f = filaEn(e.clientX, e.clientY);
      if (f) abrir({ tipo: 'ponerme', fila: f, quien: a.quien });
    },
    onPointerCancel: () => setArrastre(null),
    onClick: (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation(); // que no abra también la fila de debajo
      if (movido.current) { movido.current = false; return; }
      if (desde) abrir({ tipo: 'ponerme', fila: desde, quien });
      else avisar(`Arrastra ${quien === yo ? 'tu cara' : `a ${n(quien)}`} hasta un piso o la basura.`);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      if (desde) abrir({ tipo: 'ponerme', fila: desde, quien });
    },
  });
  const cogido = (m: MiembroId, desde?: Fila) => Boolean(arrastre && lejos(arrastre) && arrastre.quien === m && arrastre.desde === desde);
  const foto = (m: MiembroId) => (caras[m] ? <img src={caras[m]} alt="" /> : <span className="cuadro-inicial">{n(m).charAt(0)}</span>);

  const cara = (fila: Fila, m: MiembroId, etiqueta: string, { fuera = false, insignia = '', peq = false } = {}) => (
    <span className={`cuadro-persona mueve ${cogido(m, fila) ? 'cogida' : ''}`} key={`${m}-${etiqueta}`} aria-label={`${m === yo ? 'Tú' : n(m)}: tócalo o arrástralo a otra fila`} {...asa(m, fila)}>
      <span className={`cuadro-cara c-${color(m)} ${fuera ? 'fuera' : ''} ${peq ? 'peq' : ''}`}>
        {foto(m)}
        {insignia && <i aria-hidden="true">{insignia}</i>}
      </span>
      <em>{etiqueta}</em>
    </span>
  );
  const quien = (m: MiembroId) => (m === yo ? 'Tú' : n(m));
  const flecha = <span className="cuadro-flecha" aria-hidden="true">→</span>;
  const tocarFila = (fila: Fila) => ({
    role: 'button' as const,
    tabIndex: 0,
    'data-fila': fila,
    onClick: () => abrir({ tipo: 'ponerme', fila }),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir({ tipo: 'ponerme', fila }); } },
  });

  return (
    <div className="cuadro">
      <div className="cuadro-cabeza">
        <div className="cuadro-banco">
          {orden.map((m) => (
            <span key={m} className={`cuadro-mueve ${cogido(m) ? 'cogida' : ''}`} aria-label={`${m === yo ? 'Tú' : n(m)}: arrástralo a un piso o a la basura`} {...asa(m)}>
              <span className={`cuadro-cara c-${color(m)}`}>{foto(m)}</span>
              <em>{quien(m)}</em>
            </span>
          ))}
        </div>
        <p><b>Coge a cualquiera</b> y suéltalo en un piso o en la basura. O toca la fila.</p>
      </div>

      {pisos.map((t) => {
        const i = t.intentos[t.intentos.length - 1];
        const abierto = t.estado === 'pendiente' || t.estado === 'suspendida';
        const hace = abierto ? t.cubre ?? t.miembro : i?.quien ?? t.miembro; // quien lo limpia (o lo limpió)
        const ayudan = abierto ? t.ayudan : i?.ayudaron ?? [];
        const lleva = t.lista.length ? ` · ${t.marcadas.length} de ${t.lista.length}` : '';
        const estadoTxt =
          t.estado === 'aprobada' ? `Aprobado ✓ ${nota(t.nota!)}`
          : t.estado === 'esperando' ? 'Esperando nota ★'
          : t.estado === 'suspendida' ? 'Suspenso: a repasar'
          : !t.enCurso ? `Va ${t.retrasoDias} ${t.retrasoDias === 1 ? 'día' : 'días'} tarde`
          : t.empezada !== undefined || t.cubre !== undefined || t.marcadas.length ? `Limpiando${lleva}`
          : 'Sin empezar';
        return (
          <div key={t.miembro} className={`cuadro-fila ${arrastre?.fila === t.miembro ? 'suelta' : ''}`} {...tocarFila(t.miembro)}>
            <span className="cuadro-tarea"><b>{t.zona.nombre}</b><small>{estadoTxt}</small></span>
            <span className="cuadro-gente">
              {hace !== t.miembro && <>{cara(t.miembro, t.miembro, quien(t.miembro), { fuera: true })}{flecha}</>}
              {cara(t.miembro, hace, quien(hace))}
              {ayudan.map((a) => cara(t.miembro, a, a === yo ? 'Tú' : 'ayuda', { insignia: '🤝', peq: true }))}
            </span>
          </div>
        );
      })}

      {sb && (() => {
        const ultimo = sb.tramos[sb.tramos.length - 1];
        const desdeAntes = ultimo.evento && ultimo.desde < ultimo.evento.ts - 60_000;
        const veces = new Map<MiembroId, number>();
        for (const x of sb.ajenas) {
          const q = typeof x.datos?.quien === 'string' && x.datos.quien ? x.datos.quien : x.autor; // quien la sacó
          veces.set(q, (veces.get(q) ?? 0) + 1);
        }
        const abiertos = avisosBasuraAbiertos(estado, sb.responsable).length;
        const estadoTxt = abiertos ? 'Llena: avisada' : sb.quejas ? `${sb.quejas} ${sb.quejas === 1 ? 'queja' : 'quejas'}` : 'Sin avisos';
        return (
          <div className={`cuadro-fila ${arrastre?.fila === 'basura' ? 'suelta' : ''}`} {...tocarFila('basura')}>
            <span className="cuadro-tarea"><b>🗑️ La basura</b><small>{estadoTxt}</small></span>
            <span className="cuadro-gente">
              {sb.responsable !== sb.tocaba && <>{cara('basura', sb.tocaba, quien(sb.tocaba), { fuera: true })}{flecha}</>}
              {cara('basura', sb.responsable, desdeAntes ? `desde ${nombreDia(ultimo.desde, true)}` : quien(sb.responsable))}
              {[...veces.entries()].map(([m, k]) => cara('basura', m, `×${k}`, { insignia: '🗑️', peq: true }))}
            </span>
          </div>
        );
      })()}

      {/* la cara que arrastras (fuera del cajón, que se mueve con transform y descolocaría lo fijo) */}
      {arrastre && lejos(arrastre) && createPortal(
        <span className="cuadro-fantasma" style={{ left: arrastre.x, top: arrastre.y }} aria-hidden="true">
          <span className={`cuadro-cara grande c-${color(arrastre.quien)}`}>{foto(arrastre.quien)}</span>
          {arrastre.fila && <b>Suelta: {arrastre.quien === yo ? 'tú' : n(arrastre.quien)}</b>}
        </span>,
        document.body,
      )}
    </div>
  );
}

/** «¿Lo limpió otro?»: si se marcó como hecho pero lo limpió otro, cualquiera puede decir quién fue (menos ponérselo a
 *  sí mismo); les llega a los otros dos y la nota pasa a ser de ese (Javi, 14 de noviembre: lo marcó Josu y lo había
 *  limpiado Jose). */
export function LoLimpioOtro({ t }: { t: Tarea }) {
  const { config, yo, acciones, avisar } = useCasa();
  const i = t.intentos[t.intentos.length - 1];
  if (!i) return null;
  const otros = config.miembros.filter((m) => m.id !== yo && m.id !== i.quien);
  if (!otros.length) return null;
  const quien = config.miembros.find((m) => m.id === i.quien)?.nombre ?? '';
  return (
    <div className="lo-limpio-otro">
      <p className="peq suave">{i.corregido ? <>Lo limpió <b>{quien}</b> ({i.corregido.por === yo ? 'lo dijiste tú' : <>lo dijo <Nombre id={i.corregido.por} /></>}). </> : <>Lo marcó <b>{quien}</b>. </>}¿Lo limpió otro?</p>
      <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
        {otros.map((m) => (
          <BotonAccion
            key={m.id}
            clase="boton mini borde"
            hacer={async () => {
              await acciones.corregirQuien(t.semana, t.miembro, i.n, m.id);
              avisar(`Apuntado: lo limpió ${m.nombre}. La nota es para él y ya lo saben.`);
            }}
          >
            Lo limpió {m.nombre}
          </BotonAccion>
        ))}
      </div>
    </div>
  );
}
