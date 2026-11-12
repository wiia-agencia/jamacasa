import { Bath, BedDouble, Check, ChevronDown, ChevronRight, Clock3, Dices, DoorOpen, House, Info, Lock, Plus, Sparkles, TriangleAlert, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PEvento, type ReactNode } from 'react';
import { bocadillos, fichaDe, marcaDe, resumenDe, type Bocadillo } from '../core/bocadillos';
import { escenaCasa } from '../core/escena';
import { CADA_ESPACIO, SUGERENCIAS_ESPACIO, textoEspacio } from '../core/espacio';
import { avisosBasuraAbiertos, rotacionFutura, semanaBasura, tareaDe } from '../core/estado';
import type { Tarea } from '../core/limpieza';
import { luzDe } from '../core/luz';
import { parteDe, type CuartoParte } from '../core/parte';
import { diaLocal, duracion, fechaDeDia, finSemana, inicioDia, lunesDe, rangoSemana } from '../core/tiempo';
import type { MiembroId, Zona } from '../core/tipos';
import { Casa3D, type BurbujaCasa, type ParteCasa } from './Casa3D';
import { claseColor, miembro, useCasa } from './contexto';
import { EstadoTarea } from './Hoy';
import { Avatar, Nombre, Placa, Seccion } from './piezas';

export const corto = (z: Zona | null | undefined) => {
  if (!z) return '—';
  const t = z.nombre.replace(/^piso (de la |del |de )?/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function ChapaEstado({ t }: { t: Tarea }) {
  const i = t.intentos[t.intentos.length - 1];
  if (t.estado === 'aprobada') return <Placa valor={i.media!} peq auto={i.auto} />;
  if (t.estado === 'suspendida') return <Placa valor={i.media!} peq suspensa />;
  if (t.estado === 'esperando') return <span className="chapa">Esperando nota</span>;
  if (!t.enCurso) return <span className="chapa mal">{t.sinHacer ? 'Sin hacer' : 'Tarde'}</span>;
  if (t.empezada !== undefined || t.marcadas.length > 0) return <span className="chapa oro">Limpiando</span>;
  return <span className="chapa">Pendiente</span>;
}

/** Limpieza: la pantalla de juego (la D, la que eligió Javi el 10 de noviembre) con la casa viva (la H). Si la casa
 *  no se puede dibujar (aún no ha empezado la rotación o el móvil no tiene 3D), la lista de siempre. */
export function Limpieza() {
  const { estado } = useCasa();
  const escena = useMemo(() => escenaCasa(estado), [estado]);
  const [sin3D, setSin3D] = useState(false);
  if (!escena || sin3D) return <ListaLimpieza />;
  return <PantallaJuego alFallar={() => setSin3D(true)} />;
}

// ——— La pantalla de juego ———

/** Para las capturas y las pruebas: ?hora=20:30 enseña la luz de esa hora (solo la luz). */
export function horaForzada(ahora: number): number | null {
  try {
    const h = new URLSearchParams(location.search).get('hora');
    const m = h && /^(\d{1,2}):(\d{2})$/.exec(h);
    if (!m) return null;
    return inicioDia(diaLocal(ahora)) + (Number(m[1]) * 60 + Number(m[2])) * 60_000;
  } catch {
    return null;
  }
}

function tituloSemana(w: number): string {
  const a = fechaDeDia(lunesDe(w)), b = fechaDeDia(lunesDe(w) + 6);
  return a.m === b.m ? `Semana del ${a.d} al ${b.d}` : `Semana ${rangoSemana(w)}`;
}

const ALTO_CABECERA = 92;
const ASOMA_CAJON = 66;

function PantallaJuego({ alFallar }: { alFallar: () => void }) {
  const { estado, config, yo, abrir, acciones, avisar } = useCasa();
  const escena = useMemo(() => escenaCasa(estado)!, [estado]);
  const w = estado.semana;
  const mia = tareaDe(estado, w, yo);
  const [foco, setFoco] = useState<MiembroId | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [menuBasura, setMenuBasura] = useState(false);
  // tu cara abre un desplegable escondido: las zonas comunes o «Mi parte», que solo ves tú (Javi, 10 de noviembre)
  const [menuCara, setMenuCara] = useState(false);
  const [enParte, setEnParte] = useState(false);
  const [caras, setCaras] = useState<Record<string, string>>({});
  const [cielo, setCielo] = useState('');
  const [altoCajon, setAltoCajon] = useState(0);

  // «Mi parte»: tus cuartos (config de la casa) y cómo está cada uno (lo tuyo de «Tu espacio»)
  const cuartos = useMemo(() => parteDe(config, estado.espacio[yo] ?? [], yo), [config, estado.espacio, yo]);
  const parte: ParteCasa | null = useMemo(
    () =>
      enParte && cuartos.length
        ? { cuartos: cuartos.map((c) => c.id), dias: Object.fromEntries(cuartos.map((c) => [c.id, c.dias])), brillo: Object.fromEntries(cuartos.map((c) => [c.id, c.brillo])) }
        : null,
    [enParte, cuartos],
  );
  const verComunes = () => { setEnParte(false); setFoco(null); setMenuCara(false); };
  const verParte = () => {
    setEnParte(true); setFoco(null); setMenuCara(false); setMenuBasura(false);
    // tus cuartos arriba y, en el cajón, lo tuyo (cuánto lleva cada uno y «Hecho»)
    setAbierto(true);
  };

  // la luz de la hora de verdad (se recalcula cada minuto)
  const minuto = Math.floor(estado.ahora / 60_000);
  const luz = useMemo(() => luzDe(horaForzada(estado.ahora) ?? estado.ahora), [minuto]); // eslint-disable-line react-hooks/exhaustive-deps
  const deNoche = luz.dia < 0.45;

  useEffect(() => {
    if (!cielo) return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cielo);
  }, [cielo]);

  // la pantalla de juego ocupa todo lo que hay entre lo de arriba (la banda del modo prueba) y el menú; la página no se mueve
  const [banda, setBanda] = useState(0);
  useLayoutEffect(() => {
    let h = 0;
    document.querySelectorAll('.banda-prueba').forEach((b) => { h += b.getBoundingClientRect().height; });
    setBanda(h);
    document.documentElement.classList.add('sin-scroll');
    window.scrollTo({ top: 0 });
    return () => document.documentElement.classList.remove('sin-scroll');
  }, []);

  const empezar = async (t: Tarea) => {
    await acciones.empezar(t.semana);
    avisar('¡A por ello! Ya saben que has empezado.');
    setAbierto(true);
  };

  const viendoOtro = foco !== null && foco !== yo;
  const burbujas: BurbujaCasa[] = useMemo(
    () =>
      enParte ? [] : bocadillos(config, estado, yo).map((b: Bocadillo) => {
        const t = tareaDe(estado, w, b.miembro);
        let alTocar: (() => void) | undefined;
        if (t && b.accion === 'empezar') alTocar = () => { empezar(t); };
        else if (b.accion === 'lista') alTocar = () => { setFoco(null); setAbierto(true); };
        else if (t && b.accion === 'puntuar') {
          const i = t.intentos[t.intentos.length - 1];
          alTocar = () => abrir({ tipo: 'puntuar', tarea: t, intento: i });
        } else if (t && b.accion === 'tarea') alTocar = () => (b.miembro === yo ? setAbierto(true) : abrir({ tipo: 'tarea', tarea: t }));
        return { id: b.miembro, titulo: b.titulo, sub: b.sub, tono: b.tono, alTocar };
      }),
    [estado, config, yo, enParte], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // lo que tapan la cabecera y el cajón (o la ficha): la casa se encuadra en lo que queda y los bocadillos no se meten debajo
  const abajo = viendoOtro ? 175 : abierto ? Math.max(altoCajon, 300) : ASOMA_CAJON + (enParte ? 28 : 44);
  const margenes = useMemo(() => ({ arriba: ALTO_CABECERA, abajo }), [abajo]);

  const ordenCaras = [yo, ...config.miembros.map((m) => m.id).filter((id) => id !== yo)];
  const basura = escena.basura;
  const basuraMia = estado.basura === yo && avisosBasuraAbiertos(estado).length > 0;

  return (
    <div className={`juego ${deNoche ? 'de-noche' : ''} ${enParte ? 'en-parte' : ''} ${enParte && !cuartos.length ? 'sin-parte' : ''}`} style={{ top: banda || undefined, ['--cielo-arriba' as string]: cielo || undefined }}>
      <Casa3D
        miembros={config.miembros}
        escena={escena}
        yo={yo}
        alFallar={alFallar}
        juego={{ foco, cerca: abierto, parte, burbujas, luz, margenes, alListo: (v) => { setCaras(v.caras); setCielo(v.cielo); } }}
      />

      <header className="juego-arriba">
        <div className="juego-semana">
          {enParte ? (
            <>
              <h1>Mi parte</h1>
              <p className="fila" style={{ gap: 5 }}><Lock size={14} aria-hidden="true" /> Solo la ves tú</p>
            </>
          ) : (
            <>
              <h1>{tituloSemana(w)}</h1>
              <p>{resumenDe(estado, yo)}</p>
            </>
          )}
        </div>
        <div className="juego-caras" role="group" aria-label="Ver el piso de cada uno">
          {ordenCaras.map((id) => {
            const m = miembro(config, id);
            const mc = marcaDe(estado, id, yo);
            const tu = id === yo;
            const activa = (foco ?? yo) === id;
            return (
              <button
                key={id}
                type="button"
                className={`juego-cara ${claseColor(m.color)} ${activa ? 'activa' : ''}`}
                aria-pressed={tu ? undefined : activa}
                aria-expanded={tu ? menuCara : undefined}
                aria-haspopup={tu ? 'menu' : undefined}
                aria-label={tu ? 'Tú: zonas comunes o tu parte' : `El piso de ${m.nombre}`}
                onClick={() => {
                  setMenuBasura(false);
                  if (tu) { setMenuCara(!menuCara); return; }
                  setMenuCara(false); setEnParte(false); setFoco(id); setAbierto(false);
                }}
              >
                <span className="juego-foto">{caras[id] ? <img src={caras[id]} alt="" /> : <Avatar id={id} />}</span>
                {tu && enParte ? (
                  <i className="juego-marca candado" aria-hidden="true"><Lock size={11} strokeWidth={3} /></i>
                ) : (
                  mc.marca && <i className={`juego-marca ${mc.tono}`} aria-hidden="true">{mc.marca}</i>
                )}
                <span className="juego-nombre">{tu ? <>Tú<ChevronDown size={12} strokeWidth={3} aria-hidden="true" /></> : m.nombre}</span>
              </button>
            );
          })}
          {menuCara && <MenuCara enParte={enParte} cuartos={cuartos} comunes={verComunes} parte={verParte} cerrar={() => setMenuCara(false)} />}
        </div>
      </header>

      {enParte && !cuartos.length && (
        // José, de momento: su parte aún no está dibujada en la casa
        <div className="juego-sin-parte" role="note">
          <Lock size={20} aria-hidden="true" />
          <b>Tu parte aún no está dibujada</b>
          <span>Cuando lo esté, saldrá aquí. Lo tuyo lo tienes abajo.</span>
        </div>
      )}

      {!abierto && !viendoOtro && !enParte && (
        <>
          <button type="button" className="juego-redondo der" onClick={() => { setMenuBasura(!menuBasura); setMenuCara(false); }} aria-expanded={menuBasura} aria-label="La basura">
            <Trash2 size={25} aria-hidden="true" />
            {basura && <b className={basuraMia ? 'tuya' : ''}>{basura.bolsas}</b>}
            <span>Basura</span>
          </button>
          {menuBasura && <MenuBasura cerrar={() => setMenuBasura(false)} />}
        </>
      )}

      {viendoOtro && <FichaPiso id={foco!} caras={caras} volver={() => setFoco(null)} />}

      {!viendoOtro && enParte && (
        <Cajon abierto={abierto} setAbierto={setAbierto} alMedir={setAltoCajon} resumen={<ResumenParte />}>
          <TuEspacio cuartos={cuartos} />
        </Cajon>
      )}
      {!viendoOtro && !enParte && (
        <Cajon abierto={abierto} setAbierto={setAbierto} alMedir={setAltoCajon} resumen={<ResumenCajon t={mia} />}>
          {mia ? <LoQueSeLimpia t={mia} empezar={empezar} /> : <p className="peq suave">Esta semana no te toca piso.</p>}
          <TuEspacio />
          <Secciones />
        </Cajon>
      )}
    </div>
  );
}

/** El desplegable de tu cara: las zonas comunes (la casa de los tres) o «Mi parte», que solo ves tú. */
function MenuCara({ enParte, cuartos, comunes, parte, cerrar }: { enParte: boolean; cuartos: CuartoParte[]; comunes: () => void; parte: () => void; cerrar: () => void }) {
  // se cierra al tocar fuera (las caras ya hacen lo suyo)
  const alCerrar = useRef(cerrar);
  alCerrar.current = cerrar;
  useEffect(() => {
    const fuera = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.juego-menu-cara, .juego-cara')) alCerrar.current(); };
    document.addEventListener('pointerdown', fuera, true);
    return () => document.removeEventListener('pointerdown', fuera, true);
  }, []);
  return (
    <>
      <div className="juego-menu juego-menu-cara" role="menu" aria-label="Qué ver">
        <button type="button" role="menuitemradio" aria-checked={!enParte} className={`juego-opcion ${!enParte ? 'elegida' : ''}`} onClick={comunes}>
          <House size={19} aria-hidden="true" />
          <span className="crece"><b>Zonas comunes</b><small>La casa de los tres</small></span>
          {!enParte && <Check size={17} strokeWidth={3} aria-hidden="true" />}
        </button>
        <button type="button" role="menuitemradio" aria-checked={enParte} className={`juego-opcion ${enParte ? 'elegida' : ''}`} onClick={parte}>
          <Lock size={19} aria-hidden="true" />
          <span className="crece"><b>Mi parte</b><small>{cuartos.length ? 'Solo la ves tú' : 'Solo la ves tú · aún sin dibujar'}</small></span>
          {enParte && <Check size={17} strokeWidth={3} aria-hidden="true" />}
        </button>
      </div>
    </>
  );
}

/** Lo que se ve del cajón cerrado en «Mi parte»: «Tu espacio» y lo que ya toca. */
function ResumenParte() {
  const { estado, yo } = useCasa();
  const cosas = estado.espacio[yo] ?? [];
  const tocan = cosas.filter((c) => c.toca).length;
  return (
    <>
      <h2>Tu espacio</h2>
      <span className={`cuenta ${tocan ? 'mal' : ''}`}>{cosas.length === 0 ? 'Sin apuntar' : tocan ? (tocan === 1 ? '1 toca' : `${tocan} tocan`) : 'Al día'}</span>
    </>
  );
}

/** Lo que se ve del cajón cerrado: «Lo que se limpia · 2 de 6» o cómo está tu piso. */
function ResumenCajon({ t }: { t: Tarea | undefined }) {
  if (!t) return <h2>Esta semana</h2>;
  const i = t.intentos[t.intentos.length - 1];
  let derecha: ReactNode = <span className="cuenta">{t.lista.length ? `${t.marcadas.length} de ${t.lista.length}` : ''}</span>;
  if (t.estado === 'aprobada') derecha = <Placa valor={i.media!} peq auto={i.auto} />;
  else if (t.estado === 'esperando') derecha = <span className="cuenta">Esperando nota</span>;
  return (
    <>
      <h2>Lo que se limpia</h2>
      {derecha}
    </>
  );
}

/** El cajón de abajo: cerrado asoma lo que se limpia; se abre tocándolo o subiéndolo con el dedo. */
function Cajon({ abierto, setAbierto, alMedir, resumen, children }: { abierto: boolean; setAbierto: (a: boolean) => void; alMedir: (h: number) => void; resumen: ReactNode; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ y: number; dy: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(() => alMedir(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [alMedir]);
  const bajar = (e: PEvento) => { arrastre.current = { y: e.clientY, dy: 0, t: Date.now() }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const mover = (e: PEvento) => {
    const a = arrastre.current;
    if (!a) return;
    a.dy = e.clientY - a.y;
    setDy(abierto ? Math.max(0, a.dy) : Math.min(0, a.dy));
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    setDy(0);
    if (!a) return;
    if (Math.abs(a.dy) < 8) setAbierto(!abierto);
    else if (a.dy < -40) setAbierto(true);
    else if (a.dy > 40) setAbierto(false);
  };
  return (
    <section
      ref={caja}
      className={`cajon ${abierto ? 'abierto' : ''} ${dy ? 'arrastrando' : ''}`}
      style={dy ? { ['--arrastre' as string]: `${dy}px` } : undefined}
      aria-label="Lo que se limpia y el resto de Limpieza"
    >
      <div className="cajon-cabeza" onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        <span className="cajon-asa" aria-hidden="true" />
        <button type="button" className="cajon-titulo" aria-expanded={abierto} onClick={(e) => { if (e.detail === 0) setAbierto(!abierto); }}>
          {resumen}
        </button>
      </div>
      <div className="cajon-dentro pila">{children}</div>
    </section>
  );
}

/** Tu lista de esta semana: se marca cosa a cosa (y al marcar la primera, empiezas a limpiar). */
function LoQueSeLimpia({ t, empezar }: { t: Tarea; empezar: (t: Tarea) => Promise<void> }) {
  const { abrir, acciones, estado } = useCasa();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const marcable = t.estado === 'pendiente' || t.estado === 'suspendida';
  const empezada = t.empezada !== undefined || t.marcadas.length > 0;
  const todo = t.lista.length > 0 && t.marcadas.length === t.lista.length;
  const fin = finSemana(t.semana);
  const marcar = async (cosa: string) => {
    if (!marcable || ocupada) return;
    setOcupada(cosa);
    try {
      if (!empezada && t.estado === 'pendiente') await acciones.empezar(t.semana);
      await acciones.marcarCosa(t.semana, cosa, !t.marcadas.includes(cosa));
    } finally {
      setOcupada(null);
    }
  };
  return (
    <section className="pila-s" aria-label="Lo que se limpia en tu piso">
      <div className="fila entre">
        <p className="suave peq" style={{ margin: 0 }}>{t.zona.nombre}</p>
        <button type="button" className="icono-boton" aria-label={`Qué entra en el ${t.zona.nombre.toLowerCase()}`} onClick={() => abrir({ tipo: 'zona', zona: t.zona })}>
          <Info size={19} />
        </button>
      </div>
      {t.lista.length > 0 && (
        <ul className="marcar" aria-label="Lo que tiene que quedar limpio">
          {t.lista.map((c) => {
            const hecha = t.marcadas.includes(c);
            return (
              <li key={c}>
                <button type="button" className={`marcar-cosa ${hecha ? 'hecha' : ''}`} aria-pressed={hecha} disabled={!marcable || ocupada === c} onClick={() => marcar(c)}>
                  <span className="marcar-caja" aria-hidden="true">{hecha && <Check size={15} strokeWidth={3} />}</span>
                  <span>{c}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {t.estado === 'pendiente' ? (
        <div className="cajon-accion pila-s">
          {estado.ahora > fin ? (
            <p className="estado-linea mal"><TriangleAlert size={17} /> Vas tarde: {t.retrasoDias} {t.retrasoDias === 1 ? 'día' : 'días'}</p>
          ) : (
            <p className="estado-linea"><Clock3 size={17} /> Hasta el domingo a las 23:59. Quedan {duracion(fin - estado.ahora)}.</p>
          )}
          {!empezada ? (
            <button type="button" className="boton ancho naranja" onClick={() => empezar(t)}>Empezar a limpiar</button>
          ) : (
            <button type="button" className={`boton ancho ${todo ? 'verde' : ''}`} onClick={() => abrir({ tipo: 'hecho', tarea: t })}>Ya está limpio</button>
          )}
        </div>
      ) : (
        <EstadoTarea t={t} />
      )}
    </section>
  );
}

/** La ficha de otro, al tocar su cara: su piso, cómo va y, si te toca, ponerle nota. */
function FichaPiso({ id, caras, volver }: { id: MiembroId; caras: Record<string, string>; volver: () => void }) {
  const { config, estado, yo, abrir } = useCasa();
  const f = fichaDe(config, estado, id, yo);
  const t = tareaDe(estado, estado.semana, id);
  if (!f || !t) return null;
  const m = miembro(config, id);
  const i = t.intentos[t.intentos.length - 1];
  return (
    <div className={`juego-ficha ${claseColor(m.color)}`} role="region" aria-label={`El piso de ${m.nombre}`}>
      <button type="button" className="juego-ficha-cuerpo" onClick={() => abrir({ tipo: 'tarea', tarea: t })}>
        <span className="juego-foto">{caras[id] ? <img src={caras[id]} alt="" /> : <Avatar id={id} />}</span>
        <span className="crece">
          <b>{f.titulo}</b>
          <span>{f.texto}</span>
        </span>
      </button>
      {f.boton ? (
        <button type="button" className="boton oro" onClick={() => abrir({ tipo: 'puntuar', tarea: t, intento: i })}>{f.boton.texto}</button>
      ) : f.nota !== undefined ? (
        <Placa valor={f.nota} suspensa={f.suspensa} />
      ) : null}
      <button type="button" className="juego-ficha-volver" onClick={volver}>Tu piso</button>
    </div>
  );
}

/** El menú del botón de la basura: de quién es esta semana y lo que se puede hacer. */
function MenuBasura({ cerrar }: { cerrar: () => void }) {
  const { estado, yo, acciones, avisar, abrir } = useCasa();
  const resp = estado.basura;
  const abiertos = avisosBasuraAbiertos(estado);
  const mia = resp === yo;
  return (
    <div className="juego-menu" role="dialog" aria-label="La basura">
      <p className="negrita">{resp ? (mia ? 'Esta semana la basura es tuya' : <>La basura: le toca a <Nombre id={resp} /></>) : 'La basura'}</p>
      <p className="peq suave">{abiertos.length ? `Está llena: ${abiertos.length === 1 ? '1 aviso' : `${abiertos.length} avisos`} sin sacar.` : 'Nadie ha avisado de que esté llena.'}</p>
      {mia && abiertos.length > 0 && (
        <button type="button" className="boton ancho verde" onClick={async () => { await acciones.basuraSacada(); cerrar(); avisar('Basura sacada. ¡Gracias!'); }}>Ya la saqué</button>
      )}
      {!mia && resp && (
        <button type="button" className="boton ancho claro" onClick={() => { cerrar(); abrir({ tipo: 'basura' }); }}>Avisar: está llena</button>
      )}
    </div>
  );
}

// ——— La lista de siempre (sin la casa en 3D) y lo que va dentro del cajón ———

function ListaLimpieza() {
  const { estado, abrir } = useCasa();
  const w = estado.semana;
  return (
    <div className="margen pila">
      <header className="cabecera">
        <div>
          <h1 className="display titulo-pantalla">Limpieza</h1>
          <p className="suave peq" style={{ marginTop: 6 }}>Semana {rangoSemana(w, true)}</p>
        </div>
        {estado.empezado && (
          <button type="button" className="boton mini claro" onClick={() => abrir({ tipo: 'sorteo' })}>
            <Dices size={17} /> Sorteo
          </button>
        )}
      </header>
      {estado.empezado && <TuPisoAhora />}
      <TuEspacio />
      <Secciones />
    </div>
  );
}

/** Esta semana, las próximas, los pisos y las semanas anteriores (con «Ver todo», que abre el historial). */
function Secciones() {
  const { estado, config, abrir, abrirHistorial } = useCasa();
  const w = estado.semana;
  const basura = semanaBasura(estado, w);
  const futuras = rotacionFutura(config, Math.max(w, estado.semanaInicio), 6);
  const historial: number[] = [];
  for (let k = w - 1; k >= Math.max(estado.semanaInicio, w - 8); k--) historial.push(k);
  return (
    <>
      {estado.empezado && (
        // el sorteo ya sale solo a cada uno al empezar la semana; aquí queda para volver a verlo (sin botón en la casa)
        <Seccion titulo="Esta semana" extra={<button type="button" className="enlace" onClick={() => abrir({ tipo: 'sorteo' })}>Ver el sorteo</button>}>
          <div className="caja">
            <div className="lista">
              {config.miembros.map((m) => {
                const t = tareaDe(estado, w, m.id);
                if (!t) return null;
                return (
                  <button key={m.id} type="button" className="item item-boton" onClick={() => abrir({ tipo: 'tarea', tarea: t })}>
                    <Avatar id={m.id} />
                    <span className="crece">
                      <span className="negrita" style={{ display: 'block' }}>{t.zona.nombre}</span>
                      <span className="peq suave">{m.nombre}</span>
                    </span>
                    <ChapaEstado t={t} />
                    <ChevronRight size={18} className="tenue" />
                  </button>
                );
              })}
              {basura && (
                <div className="item">
                  <span className="avatar" style={{ background: 'var(--papel-2)', fontSize: '1.1rem' }} aria-hidden="true">🗑️</span>
                  <span className="crece">
                    <span className="negrita" style={{ display: 'block' }}>La basura</span>
                    <span className="peq suave"><Nombre id={basura.responsable} />{basura.avisos.length ? `: ${basura.avisos.length} ${basura.avisos.length === 1 ? 'aviso' : 'avisos'} esta semana` : ', sin avisos esta semana'}</span>
                  </span>
                  <Avatar id={basura.responsable} tam="s" />
                </div>
              )}
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Próximas semanas">
        <div className="caja" style={{ padding: 16 }}>
          <div className="rotacion" role="table" aria-label="Rotación de pisos">
            <span />
            {config.miembros.map((m) => (
              <span key={m.id} className="fila" style={{ gap: 6 }}>
                <Avatar id={m.id} tam="s" />
                <span className="peq negrita">{m.nombre}</span>
              </span>
            ))}
            {futuras.map((f) => (
              <Fila key={f.semana} semana={f.semana} hoy={f.semana === w} celdas={f.reparto.map((r) => corto(r.zona))} />
            ))}
          </div>
          <p className="tenue mini" style={{ marginTop: 14 }}>Cada uno avanza un piso por semana. La basura se sortea cada lunes: sale uno de la bolsa y no vuelve a entrar hasta que hayan salido los tres.</p>
        </div>
      </Seccion>

      <Seccion titulo="Los pisos">
        <div className="caja">
          <div className="lista">
            {config.zonas.map((z) => (
              <button key={z.id} type="button" className="item item-boton" onClick={() => abrir({ tipo: 'zona', zona: z })}>
                <span className="crece">
                  <span className="negrita" style={{ display: 'block' }}>{z.nombre}</span>
                  <span className="peq suave">{z.incluye}</span>
                </span>
                <ChevronRight size={18} className="tenue" />
              </button>
            ))}
          </div>
        </div>
        <p className="tenue mini">{config.notaLimpieza ?? 'Cada uno limpia su habitación y su baño.'}</p>
      </Seccion>

      {historial.length > 0 && (
        <Seccion titulo="Semanas anteriores" extra={<button type="button" className="enlace" onClick={() => abrirHistorial(undefined, 'mes')}>Ver todo</button>}>
          <div className="caja" style={{ padding: 16 }}>
            <div className="rotacion">
              <span />
              {config.miembros.map((m) => (
                <span key={m.id} className="fila" style={{ gap: 6 }}>
                  <Avatar id={m.id} tam="s" />
                </span>
              ))}
              {historial.map((k) => (
                <HistFila key={k} semana={k} />
              ))}
            </div>
          </div>
        </Seccion>
      )}
    </>
  );
}

/** Tu piso de esta semana (en la lista de siempre): lo que tiene que quedar limpio y los botones. */
function TuPisoAhora() {
  const { estado, yo, abrir, acciones, avisar } = useCasa();
  const [empezando, setEmpezando] = useState(false);
  const t = tareaDe(estado, estado.semana, yo);
  if (!t) return null;
  const puedeEmpezar = t.estado === 'pendiente' && t.empezada === undefined;
  return (
    <section className="tarjeta pila-s tu-piso-limpieza" aria-label="Tu piso esta semana">
      <div className="fila entre" style={{ alignItems: 'flex-start' }}>
        <div className="crece">
          <p className="suave peq">Tu piso esta semana</p>
          <h2 className="display zona">{t.zona.nombre}</h2>
        </div>
        <ChapaEstado t={t} />
        <button type="button" className="icono-boton" aria-label={`Qué entra en el ${t.zona.nombre.toLowerCase()}`} onClick={() => abrir({ tipo: 'zona', zona: t.zona })}>
          <Info size={19} />
        </button>
      </div>
      {t.lista.length > 0 && (
        <ul className="lista-limpiar" aria-label="Lo que tiene que quedar limpio">
          {t.lista.map((c) => <li key={c}>{c}</li>)}
        </ul>
      )}
      {puedeEmpezar && (
        <button
          type="button"
          className="boton ancho claro"
          disabled={empezando}
          onClick={async () => {
            setEmpezando(true);
            try {
              await acciones.empezar(t.semana);
              avisar('¡A por ello! Ya saben que has empezado.');
            } finally {
              setEmpezando(false);
            }
          }}
        >
          Empezar a limpiar
        </button>
      )}
      <EstadoTarea t={t} />
    </section>
  );
}

function iconoEspacio(nombre: string) {
  const n = nombre.toLowerCase();
  if (n.includes('baño') || n.includes('bano') || n.includes('ducha')) return <Bath size={18} />;
  if (n.includes('habitaci') || n.includes('cuarto') || n.includes('cama')) return <BedDouble size={18} />;
  if (n.includes('pasillo')) return <DoorOpen size={18} />;
  if (n.includes('piso') || n.includes('casa')) return <House size={18} />;
  return <Sparkles size={18} />;
}

/** «Tu espacio»: lo tuyo, que no sale en la casa de los tres. Solo lo ves tú y no da puntos: te dice cuánto llevas
 *  sin limpiarlo y te avisa cuando toca. En «Mi parte» (con tus cuartos), ofrece apuntar los que faltan: lo que
 *  apuntas ahí es lo que enseña la casa en cada cuarto. */
function TuEspacio({ cuartos }: { cuartos?: CuartoParte[] }) {
  const { estado, yo, acciones, avisar } = useCasa();
  const cosas = estado.espacio[yo] ?? [];
  const [cambiando, setCambiando] = useState(false);
  const [otra, setOtra] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // en «Mi parte», los cuartos sin apuntar se apuntan con su propio nombre de cuarto (así se juntan seguro)
  const faltan = (cuartos ?? []).filter((c, i, a) => !c.cosa && a.findIndex((d) => d.nombre === c.nombre && !d.cosa) === i);
  const sugeridas = SUGERENCIAS_ESPACIO.filter(
    (s) => !cosas.some((c) => c.nombre.toLowerCase() === s.toLowerCase()) && !faltan.some((c) => c.nombre.toLowerCase() === s.toLowerCase()),
  );
  const hacer = async (f: () => Promise<void>, texto?: string) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await f();
      if (texto) avisar(texto);
    } finally {
      setOcupado(false);
    }
  };
  const anadir = (nombre: string) => hacer(() => acciones.espacioCosa(`c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nombre, CADA_ESPACIO));

  const cuerpo = (
    <>
      {cosas.length > 0 ? (
        <div className="caja">
          <div className="lista">
            {cosas.map((c) => (
              <div key={c.id} className="item">
                <span className="avatar" style={{ background: 'var(--papel-2)', color: 'var(--texto-2)' }} aria-hidden="true">{iconoEspacio(c.nombre)}</span>
                <span className="crece">
                  <span className="negrita" style={{ display: 'block' }}>{c.nombre}</span>
                  <span className={c.toca ? 'peq mal negrita' : 'peq suave'}>{textoEspacio(c)}</span>
                </span>
                {cambiando ? (
                  <button type="button" className="boton mini peligro" disabled={ocupado} onClick={() => hacer(() => acciones.espacioQuitar(c.id))}>
                    Quitar
                  </button>
                ) : (
                  <button
                    type="button"
                    className={c.toca ? 'boton mini' : 'boton mini claro'}
                    disabled={ocupado}
                    onClick={() => hacer(() => acciones.espacioHecho(c.id), `${c.nombre}: hecho. Te aviso dentro de ${c.cada === 7 ? 'una semana' : `${c.cada} días`}.`)}
                  >
                    Hecho
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : faltan.length === 0 ? (
        <p className="peq suave">Apunta lo tuyo (tu habitación, tu baño…): te dice cuánto llevas sin limpiarlo y te avisa cuando toca. Los otros dos no lo ven.</p>
      ) : null}
      {faltan.length > 0 && (
        <div className="pila-s">
          <p className="peq suave" style={{ margin: 0 }}>
            {cosas.length === 0 ? 'Apunta tus cuartos: la casa enseña cuánto lleva cada uno sin limpiarse y te avisa cuando toca. Los otros dos no lo ven.' : 'Apunta lo que falta y se verá en tu parte de la casa:'}
          </p>
          <div className="opciones">
            {faltan.map((c) => (
              <button key={c.id} type="button" className="opcion" disabled={ocupado} onClick={() => hacer(() => acciones.espacioCosa(c.id, c.nombre, CADA_ESPACIO))}>
                <Plus size={15} aria-hidden="true" /> {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
      {((cosas.length === 0 && faltan.length === 0) || cambiando) && (
        <div className="opciones">
          {sugeridas.map((s) => (
            <button key={s} type="button" className="opcion" disabled={ocupado} onClick={() => anadir(s)}>
              <Plus size={15} aria-hidden="true" /> {s}
            </button>
          ))}
          {otra === null && (
            <button type="button" className="opcion" onClick={() => setOtra('')}>
              <Plus size={15} aria-hidden="true" /> Otra cosa
            </button>
          )}
        </div>
      )}
      {otra !== null && (
        <form
          className="fila"
          onSubmit={(ev) => {
            ev.preventDefault();
            const n = otra.trim();
            if (!n) return;
            anadir(n);
            setOtra(null);
          }}
        >
          <input className="entrada crece" value={otra} onChange={(ev) => setOtra(ev.target.value)} placeholder="Por ejemplo, el armario" maxLength={40} autoFocus aria-label="Qué quieres apuntar" />
          <button type="submit" className="boton mini" disabled={!otra.trim() || ocupado}>Añadir</button>
        </form>
      )}
      {cosas.length > 0 && (
        <button type="button" className="enlace" style={{ alignSelf: 'flex-start' }} onClick={() => { setCambiando(!cambiando); setOtra(null); }}>
          {cambiando ? 'Listo' : 'Añadir o quitar cosas'}
        </button>
      )}
    </>
  );
  // en «Mi parte» ya dice arriba que solo lo ves tú y el cajón se llama «Tu espacio»
  if (cuartos) return <section className="pila-s" aria-label="Tu espacio">{cuerpo}</section>;
  return (
    <Seccion titulo="Tu espacio" extra={<span className="mini tenue fila" style={{ gap: 5 }}><Lock size={13} aria-hidden="true" />Solo lo ves tú</span>}>
      {cuerpo}
    </Seccion>
  );
}

function Fila({ semana, hoy, celdas }: { semana: number; hoy: boolean; celdas: string[] }) {
  return (
    <>
      <span className={`sem ${hoy ? 'hoy' : ''}`}>{hoy ? 'Esta' : rangoSemana(semana)}</span>
      {celdas.map((c, k) => (
        <span key={k} className="celda-zona"><span>{c}</span></span>
      ))}
    </>
  );
}

function HistFila({ semana }: { semana: number }) {
  const { estado, config, abrir } = useCasa();
  return (
    <>
      <span className="sem">{rangoSemana(semana)}</span>
      {config.miembros.map((m) => {
        const t = tareaDe(estado, semana, m.id);
        return (
          <span key={m.id} className="celda-zona">
            {t ? (
              <button type="button" className="item-boton" style={{ padding: 0 }} onClick={() => abrir({ tipo: 'tarea', tarea: t })} aria-label={`${m.nombre}: ${t.zona.nombre}`}>
                <ChapaEstado t={t} />
              </button>
            ) : (
              <span className="tenue">—</span>
            )}
          </span>
        );
      })}
    </>
  );
}
