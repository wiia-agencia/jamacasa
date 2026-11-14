// El cuadro de la semana (la B que eligió Javi el 14 de noviembre: «que podamos movernos de un piso a otro
// fácilmente»): los tres pisos y la basura con quién está en cada uno. Arrastras tu cara a una fila (o la tocas) y
// sale lo que puedes hacer: echar una mano, limpiarlo tú, «Esta la saqué yo» o quedarte la basura.
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { avisosBasuraAbiertos, basuraTocaba, paraPuntuar, tareaDe } from '../core/estado';
import { nota } from '../core/noticias';
import { diaLocal, inicioDia, lunesDe, nombreDia } from '../core/tiempo';
import type { MiembroId } from '../core/tipos';
import { useCasa } from './contexto';
import { BotonAccion, Hoja } from './piezas';

// ——— El cuadro de la semana: lo que puedes hacer en cada fila (Javi, 14 de noviembre: la B) ———

/** Para ir a la lista de un piso desde una hoja (la pantalla de Limpieza lo escucha). */
export function verPiso(m: MiembroId) {
  window.dispatchEvent(new CustomEvent('jamacasa-ver-piso', { detail: m }));
}

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

/** Lo que puedes hacer en el piso de alguien (o en el tuyo) desde el cuadro de la semana. */
export function PonermePiso({ de }: { de: MiembroId }) {
  const { cerrar, abrir, acciones, avisar, config, yo, estado } = useCasa();
  const t = tareaDe(estado, estado.semana, de);
  if (!t) return null;
  const n = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? '';
  const y = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
  const z = t.zona.nombre;
  const abierto = t.estado === 'pendiente' || t.estado === 'suspendida';
  const i = t.intentos[t.intentos.length - 1];
  const con = t.cubre ?? t.miembro; // quien lo está limpiando
  const ver = (m: MiembroId) => { cerrar(); verPiso(m); };
  let sub: string;
  let ops: ReactNode;
  if (t.miembro === yo) {
    sub = t.cubre && abierto ? `Se encarga ${n(t.cubre)}.` : t.ayudan.length ? `Te echa una mano ${y(t.ayudan.map(n))}.` : 'Es tu piso esta semana.';
    ops = <Opcion e="📋" titulo="Ver tu lista" texto="Lo que se limpia en tu piso." hacer={() => ver(yo)} principal />;
  } else if (abierto && t.cubre === yo) {
    sub = 'Te encargas tú esta semana: la nota es para ti.';
    ops = (
      <>
        <Opcion e="📋" titulo="Ver su lista" texto="La marcas como si fuera la tuya." hacer={() => ver(t.miembro)} principal />
        <Opcion e="↩️" titulo="Ya no lo limpio yo" texto={`Vuelve a ser cosa de ${n(t.miembro)}.`} hacer={async () => { await acciones.dejarDeCubrir(t.semana, t.miembro); cerrar(); avisar(`Vale: el piso vuelve a ser de ${n(t.miembro)}.`); }} />
      </>
    );
  } else if (abierto && t.ayudan.includes(yo)) {
    sub = `Le echas una mano a ${n(con)}: si se aprueba, ${nota(estado.normas.puntosAyuda)} puntos para ti.`;
    ops = (
      <>
        <Opcion e="📋" titulo="Ver su lista" texto="Lo que marques cuenta en su lista." hacer={() => ver(t.miembro)} principal />
        <Opcion e="↩️" titulo="Ya no ayudo" hacer={async () => { await acciones.dejarDeAyudar(t.semana, t.miembro); cerrar(); avisar('Vale: ya no sales ayudando.'); }} />
      </>
    );
  } else if (abierto) {
    sub = t.cubre ? `Se encarga ${n(t.cubre)}. ¿Le echas una mano?` : '¿Qué haces?';
    ops = (
      <>
        <Opcion
          e="🤝"
          titulo="Le echo una mano"
          texto={`Lo hacéis entre los dos: la nota es de ${n(con)} y, si se aprueba, ${nota(estado.normas.puntosAyuda)} puntos para ti.`}
          principal
          hacer={async () => { await acciones.ayudar(t.semana, t.miembro); cerrar(); avisar(`Le echas una mano a ${n(con)}. Ya lo sabe.`); verPiso(t.miembro); }}
        />
        {!t.cubre && (
          <Opcion e="🧹" titulo="Lo limpio yo" texto={`Te lo quedas esta semana: la nota es para ti y ${n(t.miembro)} ni suma ni resta.`} hacer={async () => { await acciones.cubrir(t.semana, t.miembro); cerrar(); avisar(`Te encargas del ${z.toLowerCase()} de ${n(t.miembro)}.`); verPiso(t.miembro); }} />
        )}
        {!t.cubre && (
          <Opcion e="✅" titulo="Ya lo he limpiado yo" texto="Te lo quedas y lo marcas hecho del tirón." hacer={async () => { await acciones.cubrir(t.semana, t.miembro); abrir({ tipo: 'hecho', tarea: t }); }} />
        )}
      </>
    );
  } else {
    const p = paraPuntuar(estado, yo).find((x) => x.tarea.miembro === t.miembro && x.tarea.semana === t.semana);
    sub = t.estado === 'esperando' ? `Ya está hecho: ${i.quien === yo ? 'lo limpiaste tú' : `lo limpió ${n(i.quien)}`} y espera nota.` : t.estado === 'aprobada' ? `Aprobado con un ${nota(t.nota!)}.` : 'Está hecho.';
    ops = p
      ? <Opcion e="★" titulo={`Ponle nota a ${n(p.intento.quien)}`} principal hacer={() => abrir({ tipo: 'puntuar', tarea: p.tarea, intento: p.intento })} />
      : <Opcion e="🔎" titulo="Ver cómo ha quedado" hacer={() => abrir({ tipo: 'tarea', tarea: t })} />;
  }
  return (
    <Hoja titulo={t.miembro === yo ? `Tu ${z.charAt(0).toLowerCase()}${z.slice(1)}` : `${z} de ${n(t.miembro)}`} subtitulo={sub} onCerrar={cerrar}>
      <div className="pila-s">{ops}</div>
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

/** Lo que puedes hacer con la basura desde el cuadro de la semana. */
export function PonermeBasura() {
  const { cerrar, abrir, acciones, avisar, config, yo, estado } = useCasa();
  const resp = estado.basura;
  if (!resp) return null;
  const n = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? '';
  const tocaba = basuraTocaba(estado);
  const abiertos = avisosBasuraAbiertos(estado, resp);
  const mia = resp === yo;
  const deOtro = tocaba !== null && resp !== tocaba;
  const titulo = 'La basura';
  const quienLaTiene = mia ? (deOtro ? `Es tuya: te la quedaste (le tocaba a ${n(tocaba!)}).` : 'Esta semana es tuya.') : deOtro ? `La tiene ${n(resp)}: se la quedó (le tocaba a ${n(tocaba!)}).` : `Le toca a ${n(resp)}.`;
  const sub = `${quienLaTiene} ${abiertos.length ? 'Está llena: avisada.' : 'Nadie ha avisado de que esté llena.'}`;
  return (
    <Hoja titulo={titulo} subtitulo={sub} onCerrar={cerrar}>
      <div className="pila-s">
        {mia ? (
          <>
            <Opcion e="🗑️" titulo="Ya la saqué" texto={abiertos.length ? 'Y se acaba el aviso.' : 'Queda apuntado.'} principal hacer={async () => { await acciones.basuraSacada(); cerrar(); avisar('Basura sacada. ¡Gracias!'); }} />
            {deOtro && <Opcion e="↩️" titulo="Devolvérsela" texto={`Vuelve a ser de ${n(tocaba!)} desde ahora.`} hacer={async () => { await acciones.devolverBasura(estado.semana, tocaba!); cerrar(); avisar('Devuelta: vuelve a ser suya.'); }} />}
          </>
        ) : (
          <>
            <Opcion
              e="🗑️"
              titulo="Esta la saqué yo"
              texto={`La has sacado tú esta vez: ${nota(estado.normas.puntosSacarAjena)} punto para ti (uno al día)${abiertos.length ? ' y se acaba el aviso' : ''}.`}
              principal
              hacer={async () => { await acciones.basuraSacada(); cerrar(); avisar(`Apuntado: la has sacado tú. Se lo decimos a ${n(resp)}.`); }}
            />
            <Opcion e="📣" titulo="Avisar: está llena" texto={`Le llega a ${n(resp)} y tiene ${estado.normas.horasBasura} horas.`} hacer={() => abrir({ tipo: 'basura' })} />
            <div className="opcion-grande sin-boton">
              <span className="e" aria-hidden="true">🙋</span>
              <span className="crece"><b>Me la quedo yo</b><span>Te la quedas esta semana (o desde el día que digas).</span></span>
            </div>
            <QuedarmeBasura despues={cerrar} />
          </>
        )}
      </div>
    </Hoja>
  );
}


// ——— El cuadro ———

type Fila = MiembroId | 'basura'; // el piso de alguien (por su dueño) o la basura

/** El cuadro de la semana: cuatro filas (los tres pisos y la basura) con quién está en cada una. Arrastras tu cara
 *  hasta una fila y, al soltarla, sale lo que puedes hacer ahí; tocar la fila hace lo mismo. */
export function CuadroSemana({ caras = {} }: { caras?: Record<string, string> }) {
  const { estado, config, yo, abrir, avisar } = useCasa();
  const w = estado.semana;
  const [arrastre, setArrastre] = useState<{ x: number; y: number; x0: number; y0: number; fila: Fila | null } | null>(null);
  const n = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? '';
  const color = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.color ?? '';
  const pisos = config.zonas.map((z) => estado.tareas.find((t) => t.semana === w && t.zona.id === z.id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const sb = estado.semanasBasura.find((x) => x.semana === w);

  const filaEn = (x: number, y: number): Fila | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return (el?.closest('[data-fila]')?.getAttribute('data-fila') as Fila | null) ?? null;
  };

  const cara = (m: MiembroId, etiqueta: string, { fuera = false, insignia = '', peq = false } = {}) => (
    <span className="cuadro-persona" key={`${m}-${etiqueta}`}>
      <span className={`cuadro-cara c-${color(m)} ${fuera ? 'fuera' : ''} ${peq ? 'peq' : ''}`}>
        {caras[m] ? <img src={caras[m]} alt="" /> : <span className="cuadro-inicial">{n(m).charAt(0)}</span>}
        {insignia && <i aria-hidden="true">{insignia}</i>}
      </span>
      <em>{etiqueta}</em>
    </span>
  );
  const quien = (m: MiembroId) => (m === yo ? 'Tú' : n(m));
  const flecha = <span className="cuadro-flecha" aria-hidden="true">→</span>;

  return (
    <div className="cuadro">
      <div className="cuadro-cabeza">
        <span
          className={`cuadro-yo c-${color(yo)} ${arrastre ? 'cogida' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Tu cara: arrástrala a un piso o a la basura"
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setArrastre({ x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, fila: null }); }}
          onPointerMove={(e) => { if (arrastre) setArrastre({ ...arrastre, x: e.clientX, y: e.clientY, fila: filaEn(e.clientX, e.clientY) }); }}
          onPointerUp={(e) => {
            const a = arrastre;
            setArrastre(null);
            if (!a) return;
            const f = filaEn(e.clientX, e.clientY);
            if (f) abrir({ tipo: 'ponerme', fila: f });
            else if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 10) avisar('Arrastra tu cara hasta un piso o la basura (o toca la fila).');
          }}
          onPointerCancel={() => setArrastre(null)}
        >
          {caras[yo] ? <img src={caras[yo]} alt="" /> : <span className="cuadro-inicial">{n(yo).charAt(0)}</span>}
        </span>
        <p><b>Arrastra tu cara</b> a un piso o a la basura para ponerte (o toca la fila).</p>
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
          <button key={t.miembro} type="button" data-fila={t.miembro} className={`cuadro-fila ${arrastre?.fila === t.miembro ? 'suelta' : ''}`} onClick={() => abrir({ tipo: 'ponerme', fila: t.miembro })}>
            <span className="cuadro-tarea"><b>{t.zona.nombre}</b><small>{estadoTxt}</small></span>
            <span className="cuadro-gente">
              {hace !== t.miembro && <>{cara(t.miembro, quien(t.miembro), { fuera: true })}{flecha}</>}
              {cara(hace, quien(hace))}
              {ayudan.map((a) => cara(a, a === yo ? 'Tú' : 'ayuda', { insignia: '🤝', peq: true }))}
            </span>
          </button>
        );
      })}

      {sb && (() => {
        const ultimo = sb.tramos[sb.tramos.length - 1];
        const desdeAntes = ultimo.evento && ultimo.desde < ultimo.evento.ts - 60_000;
        const veces = new Map<MiembroId, number>();
        for (const x of sb.ajenas) veces.set(x.autor, (veces.get(x.autor) ?? 0) + 1);
        const abiertos = avisosBasuraAbiertos(estado, sb.responsable).length;
        const estadoTxt = abiertos ? 'Llena: avisada' : sb.quejas ? `${sb.quejas} ${sb.quejas === 1 ? 'queja' : 'quejas'}` : 'Sin avisos';
        return (
          <button type="button" data-fila="basura" className={`cuadro-fila ${arrastre?.fila === 'basura' ? 'suelta' : ''}`} onClick={() => abrir({ tipo: 'ponerme', fila: 'basura' })}>
            <span className="cuadro-tarea"><b>🗑️ La basura</b><small>{estadoTxt}</small></span>
            <span className="cuadro-gente">
              {sb.responsable !== sb.tocaba && <>{cara(sb.tocaba, quien(sb.tocaba), { fuera: true })}{flecha}</>}
              {cara(sb.responsable, desdeAntes ? `desde ${nombreDia(ultimo.desde, true)}` : quien(sb.responsable))}
              {[...veces.entries()].map(([m, k]) => cara(m, `×${k}`, { insignia: '🗑️', peq: true }))}
            </span>
          </button>
        );
      })()}

      {/* tu cara mientras la arrastras (fuera del cajón, que se mueve con transform y descolocaría lo fijo) */}
      {arrastre && Math.hypot(arrastre.x - arrastre.x0, arrastre.y - arrastre.y0) > 6 && createPortal(
        <span className="cuadro-fantasma" style={{ left: arrastre.x, top: arrastre.y }} aria-hidden="true">
          <span className={`cuadro-cara grande c-${color(yo)}`}>{caras[yo] ? <img src={caras[yo]} alt="" /> : <span className="cuadro-inicial">{n(yo).charAt(0)}</span>}</span>
          {arrastre.fila && <b>Suelta para ponerte</b>}
        </span>,
        document.body,
      )}
    </div>
  );
}
