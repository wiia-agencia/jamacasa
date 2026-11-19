// Hoy, la E2 (la que eligió Javi el 19 de noviembre, tras las rondas 8 a 12 de propuestas): una frase que lo dice todo,
// con cristales que se tocan y abren su baldosa de «Para ti»; los pisos en tarjetas, una al lado de otra; y los atajos.
// Vidrio cálido sobre un fondo que respira, oscuro o claro como el resto de la app; «lo tuyo», en tu color.
// Las reglas (qué dice la frase, qué baldosas salen, qué dice cada tarjeta) están en src/core/hoy.ts.
import { Armchair, Bath, Clock3, CookingPot, DoorOpen, Flame, Flower2, Footprints, Hand, Palette, Plane, ShoppingCart, Sofa, Sparkle, Sparkles, Star, Trash, Trash2, Wallet, type LucideIcon } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { tareaDe } from '../core/estado';
import { fraseDeHoy, paraTi, tarjetasPisos, type AccionHoy, type Baldosa, type BotonHoy, type ColorHoy, type IconoHoy, type TarjetaPiso, type Trozo } from '../core/hoy';
import { nombreDia, nombreMes, partes } from '../core/tiempo';
import { esOscuro, momentoDelSol, type ColorTema, type LuzTema } from '../core/tema';
import type { Config } from '../core/tipos';
import { miembro, useCasa, type Hoja } from './contexto';
import { verPiso } from './Cuadro';
import { Avatar, FotoRef } from './piezas';
import './hoy2.css';

/** El color de cada uno en Hoy (más vivo que el del resto de la app): el normal, uno oscuro para letras sobre claro y
 *  uno claro para letras sobre oscuro. */
const COLORES: Record<string, { c: string; osc: string; claro: string }> = {
  naranja: { c: '#ff8a3d', osc: '#c4560b', claro: '#ffc27a' },
  verde: { c: '#2fbf6b', osc: '#138a46', claro: '#8fe3b0' },
  azul: { c: '#3d8bff', osc: '#1d63d1', claro: '#9cc4ff' },
};
const GRIS = { c: '#8a8580', osc: '#5a5550', claro: '#d8d2cc' };
const FIJOS: Record<string, string> = { verde: '#2fb36b', ambar: '#f2b233', rojo: '#ff6b5a', oro: '#c99a2e', rosa: '#e9608a', azul: '#3d8bff' };
const ICONOS: Record<IconoHoy, LucideIcon> = { estrella: Star, chispas: Sparkles, basura: Trash2, cartera: Wallet, carro: ShoppingCart, calcetin: Footprints, reloj: Clock3, avion: Plane };
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function colorDe(c: ColorHoy, config: Config): string {
  if (c === 'tuyo') return 'var(--h-tuyo)';
  if (c.startsWith('p:')) return (COLORES[miembro(config, c.slice(2)).color] ?? GRIS).c;
  return FIJOS[c] ?? GRIS.c;
}

const movilOscuro = () => {
  try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
};
/** ¿Va en oscuro? Lo mismo que el resto de la app: tu tema (como el móvil, claro, oscuro o con el sol). */
export function hoyOscuro(tema: LuzTema, ahora = Date.now()): boolean {
  return esOscuro(tema, movilOscuro(), ahora);
}
/** El color de arriba del fondo de Hoy (para la barra de arriba del móvil), oscuro o claro, de cada color. */
const ARRIBA: Record<ColorTema, [string, string]> = {
  naranja: ['#2a221c', '#fbf3ea'], azul: ['#19243a', '#f1f6fd'], verde: ['#172b21', '#f0f8f2'],
  morado: ['#261c37', '#f6f2fc'], rosa: ['#2e1c25', '#fdf2f5'], grafito: ['#252527', '#f5f5f6'],
};
export const barraHoy = (oscuro: boolean, color: ColorTema = 'naranja') => ARRIBA[color][oscuro ? 0 : 1];

function useOscuro(): boolean {
  const { tema, ahora } = useCasa();
  const [oscuro, setOscuro] = useState(() => hoyOscuro(tema, ahora));
  useEffect(() => {
    setOscuro(hoyOscuro(tema, ahora));
    let mq: MediaQueryList | null = null;
    try { mq = matchMedia('(prefers-color-scheme: dark)'); } catch { /* sin media queries */ }
    const cambia = () => setOscuro(hoyOscuro(tema, Date.now()));
    mq?.addEventListener('change', cambia);
    return () => mq?.removeEventListener('change', cambia);
  }, [tema, ahora]);
  return oscuro;
}

/** Lo que hace cada botón (o tarjeta): abrir su hoja, empezar, ir a la lista… */
function useHacer() {
  const { estado, abrir, acciones, avisar, ir } = useCasa();
  return async (a: AccionHoy) => {
    switch (a.tipo) {
      case 'puntuar': {
        const t = tareaDe(estado, a.semana, a.de);
        const i = t?.intentos.find((x) => x.n === a.intento);
        if (t && i) abrir({ tipo: 'puntuar', tarea: t, intento: i, ...(a.propia ? { propia: true } : {}) });
        return;
      }
      case 'empezar':
        await acciones.empezar(a.semana);
        avisar('¡A por ello! Ya saben que has empezado.');
        return;
      case 'lista':
        ir('limpieza');
        window.setTimeout(() => verPiso(a.de), 250);
        return;
      case 'hecho':
      case 'tarea': {
        const t = tareaDe(estado, a.semana, a.de);
        if (t) abrir({ tipo: a.tipo, tarea: t });
        return;
      }
      case 'ponerme':
        abrir({ tipo: 'ponerme', fila: a.de });
        return;
      case 'hoja':
        abrir({ tipo: a.hoja } as Hoja);
        return;
      case 'recogido':
        await acciones.recogido(a.aviso);
        avisar('Apuntado: ya está recogido.');
        return;
      case 'comprado': {
        const f = estado.super.faltas.find((x) => x.id === a.falta);
        if (f) abrir({ tipo: 'comprado', falta: f });
        return;
      }
      case 'pasar':
        await acciones.faltaPaso(a.falta);
        avisar('Vale: se lo pasamos al siguiente.');
        return;
      case 'pantalla':
        ir(a.pantalla);
    }
  };
}
type Hacer = ReturnType<typeof useHacer>;

// la frase se escribe palabra a palabra solo cuando cambia (no cada vez que vuelves a Hoy)
let fraseVista = '';

function Frase({ trozos, abierta, tocar }: { trozos: Trozo[]; abierta: string | null; tocar: (clave: string) => void }) {
  const { config } = useCasa();
  const texto = trozos.map((x) => x.texto).join('');
  const [escribe] = useState(() => texto !== fraseVista);
  useEffect(() => { fraseVista = texto; }, [texto]);
  let k = 0;
  const retraso = () => (escribe ? { animationDelay: `${250 + k++ * 55}ms` } : {});
  return (
    <p className={`hoy2-grande ${escribe ? 'escribe' : ''}`}>
      {trozos.map((x, i) => {
        if (x.t === 'cristal') {
          const Icono = ICONOS[x.icono];
          return (
            <button key={i} type="button" className={`hoy2-cristal p ${abierta === x.clave ? 'abierta' : ''}`} style={{ ['--c' as string]: colorDe(x.color, config), ...retraso() } as CSSProperties} aria-expanded={abierta === x.clave} onClick={() => tocar(x.clave)}>
              <span className="bola"><Icono size={16} /></span>
              {x.texto}
            </button>
          );
        }
        const palabras = x.texto.split(/(\s+)/).map((w, j) => (!w || /^\s+$/.test(w) ? w : <span key={j} className="p" style={retraso()}>{w}</span>));
        return x.t === 'negrita' ? <strong key={i}>{palabras}</strong> : <Fragment key={i}>{palabras}</Fragment>;
      })}
    </p>
  );
}

function BotonH({ x, hacer }: { x: BotonHoy; hacer: Hacer }) {
  const { config } = useCasa();
  const [ocupado, setOcupado] = useState(false);
  const claro = x.tono === 'claro';
  const tuyo = x.tono === 'tuyo';
  const fondo = x.tono && x.tono !== 'claro' && x.tono !== 'tuyo' ? colorDe(x.tono, config) : undefined;
  return (
    <button
      type="button"
      className={`hoy2-boton ${claro ? 'claro' : ''} ${tuyo ? 'tuyo' : ''}`}
      style={fondo ? { background: fondo } : undefined}
      disabled={ocupado}
      onClick={async (e) => {
        e.stopPropagation();
        setOcupado(true);
        try { await hacer(x.accion); } finally { setOcupado(false); }
      }}
    >
      {x.texto}
    </button>
  );
}

function MiniAnillo({ hechas, total }: { hechas: number; total: number }) {
  const L = 2 * Math.PI * 15;
  const v = total ? Math.max(0.02, hechas / total) : 0;
  return (
    <svg className="hoy2-anillo" viewBox="0 0 38 38" aria-hidden="true">
      <circle className="p0" cx="19" cy="19" r="15" />
      <circle className="v" cx="19" cy="19" r="15" strokeDasharray={`${v * L} ${L}`} />
    </svg>
  );
}

const nombreVT = (clave: string) => `hb-${clave.replace(/[^a-zA-Z0-9-]/g, '-')}`;

function BaldosaHoy({ b, abierta, tocar, hacer }: { b: Baldosa; abierta: boolean; tocar: () => void; hacer: Hacer }) {
  const { config } = useCasa();
  const Icono = ICONOS[b.icono];
  return (
    <div
      className={`hoy2-baldosa ${b.encendida ? 'on' : ''} ${abierta ? 'grande' : ''}`}
      data-vt={nombreVT(b.clave)}
      style={{ '--c': colorDe(b.color, config) } as CSSProperties}
    >
      {/* toda la baldosa se toca (y lo de dentro, al abrirse, va por encima con sus botones) */}
      <button type="button" className="hoy2-toque" aria-expanded={abierta} aria-label={`${b.titulo}: ${b.sub}`} onClick={tocar} />
      <span className="arriba">
        <span className="ico"><Icono size={20} /></span>
        {b.cuenta && <MiniAnillo {...b.cuenta} />}
      </span>
      <span className="txt">
        <b>{b.titulo}</b>
        <span>{b.sub}</span>
      </span>
      {b.cuenta && !abierta && <span className="cuenta">{b.cuenta.hechas} de {b.cuenta.total}</span>}
      {abierta && (
        <span className="mas">
          {b.foto && <FotoRef ref_={b.foto} />}
          {b.linea && <span className="linea">{b.linea}</span>}
          {b.botones.length > 0 && (
            <span className="hoy2-botones">
              {b.botones.map((x) => <BotonH key={x.texto} x={x} hacer={hacer} />)}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function IconoSala({ sala }: { sala: string }) {
  const s = sala.toLowerCase();
  const I = s.includes('cocina') ? CookingPot : s.includes('salón') || s.includes('salon') ? Sofa : s.includes('baño') ? Bath : s.includes('entrad') ? DoorOpen : s.includes('terraza') ? Flower2 : s.includes('rellano') ? Armchair : null;
  return I ? <I size={14} /> : null;
}

function TarjetaPisoHoy({ p, hacer }: { p: TarjetaPiso; hacer: Hacer }) {
  // las estancias que caben en una línea (las demás, «+N»)
  const salas: string[] = [];
  let letras = 0;
  for (const s of p.salas) {
    if (salas.length >= 3 || (salas.length && letras + s.length > 20)) break;
    salas.push(s);
    letras += s.length;
  }
  const resto = p.salas.length - salas.length;
  const tocar = () => hacer(p.alTocar);
  return (
    <article className={`hoy2-carta ${p.tuya ? 'on' : ''}`}>
      <button type="button" className="hoy2-toque" aria-label={`${p.titulo}, ${p.sub}: ${p.dias} ${p.dias === 1 ? 'día' : 'días'} sin limpiar`} onClick={tocar} />
      <div className="cab-c">
        <div className="quien">
          <Avatar id={p.limpia} tam="l" />
          <div style={{ minWidth: 0 }}>
            <b>{p.titulo}</b>
            <span>{p.sub}</span>
          </div>
        </div>
        <div className="num">
          <b>{p.dias}</b>
          <span>{p.dias === 1 ? 'día' : 'días'} sin limpiar</span>
        </div>
      </div>
      <div className="fresco" aria-hidden="true"><i style={{ width: `${Math.round(p.fresco * 100)}%` }} /></div>
      <p className="frase">
        {p.frase.map((x, i) => (x.t === 'texto' ? <Fragment key={i}>{x.texto}</Fragment> : <strong key={i}>{x.texto}</strong>))}
      </p>
      <div className="salas">
        {salas.map((s) => <span key={s}><IconoSala sala={s} />{s}</span>)}
        {resto > 0 && <span>+{resto}</span>}
      </div>
      <div className="pie">{p.boton && <BotonH x={p.boton} hacer={hacer} />}</div>
    </article>
  );
}

function PisosEnFila({ pisos, hacer }: { pisos: TarjetaPiso[]; hacer: Hacer }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  if (!pisos.length) return null;
  const alDeslizar = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setK(max > 0 ? Math.round((el.scrollLeft / max) * (pisos.length - 1)) : 0);
  };
  return (
    <section aria-label="Los pisos" data-vt="hoy2-pisos">
      <h2 className="hoy2-h2">Los pisos {pisos.length > 1 && <span className="sub">Desliza</span>}</h2>
      <div className="hoy2-carrusel" ref={ref} onScroll={alDeslizar}>
        {pisos.map((p) => <TarjetaPisoHoy key={p.clave} p={p} hacer={hacer} />)}
      </div>
      {pisos.length > 1 && (
        <div className="hoy2-puntos" aria-hidden="true">
          {pisos.map((p, i) => <i key={p.clave} className={i === k ? 'on' : ''} />)}
        </div>
      )}
    </section>
  );
}

const ESCENAS: { texto: string; color: string; Icono: LucideIcon; hoja: Hoja }[] = [
  { texto: 'Tarea extra', color: '#a26cf0', Icono: Sparkle, hoja: { tipo: 'extra' } },
  { texto: 'Basura llena', color: '#2fb36b', Icono: Trash, hoja: { tipo: 'basura' } },
  { texto: 'Esto es tuyo', color: '#e9608a', Icono: Footprints, hoja: { tipo: 'tuyo' } },
  { texto: 'Se ha acabado algo', color: '#c99a2e', Icono: ShoppingCart, hoja: { tipo: 'falta' } },
  { texto: 'Me voy unos días', color: '#3d8bff', Icono: Plane, hoja: { tipo: 'fuera' } },
];

function Escenas() {
  const { abrir } = useCasa();
  return (
    <div className="hoy2-escenas" data-vt="hoy2-escenas" aria-label="Atajos">
      {ESCENAS.map(({ texto, color, Icono, hoja }) => (
        <button key={texto} type="button" className="hoy2-escena" onClick={() => abrir(hoja)}>
          <span className="hoy2-ico" style={{ '--c': color } as CSSProperties}><Icono size={18} /></span>
          {texto}
        </button>
      ))}
    </div>
  );
}

function CabeceraHoy() {
  const { estado, yo, abrir } = useCasa();
  const rey = estado.titulos[estado.mes]?.rey ?? [];
  const fecha = `${mayus(nombreDia(estado.ahora))} ${partes(estado.ahora).d} de ${nombreMes(estado.mes)}`;
  return (
    <header className="hoy2-cab">
      <p className="hoy2-fecha">
        <span>{fecha}</span>
        {estado.racha.actual > 0 && (
          <span className="hoy2-racha"><Flame size={14} /> {estado.racha.actual} {estado.racha.actual === 1 ? 'semana' : 'semanas'} de racha</span>
        )}
      </p>
      <span className="hoy2-cab-d">
        <button type="button" className="hoy2-redondo" aria-label="Tu tema: el color de Hoy y la luz" onClick={() => abrir({ tipo: 'tema' })}><Palette size={19} /></button>
        <Avatar id={yo} corona={rey.includes(yo)} onClick={() => abrir({ tipo: 'ajustes' })} />
      </span>
    </header>
  );
}

/** Hoy (la E2). `arriba`: lo que va debajo de la frase si hace falta (activar los avisos); `abajo`: lo de siempre. */
export function HoyE2({ arriba, abajo }: { arriba?: ReactNode; abajo?: ReactNode }) {
  const { config, estado, yo, tema, color } = useCasa();
  const oscuro = useOscuro();
  // con el sol, el fondo se tiñe al amanecer y al atardecer (y de noche, la luz de la luna)
  const momento = tema === 'sol' ? momentoDelSol(estado.ahora) : null;
  const baldosas = useMemo(() => paraTi(config, estado, yo), [config, estado, yo]);
  const frase = useMemo(() => fraseDeHoy(config, estado, yo, baldosas), [config, estado, yo, baldosas]);
  const pisos = useMemo(() => tarjetasPisos(config, estado, yo), [config, estado, yo]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const hacer = useHacer();
  // si lo que estaba abierto ya no está (ya lo hiciste), se cierra
  useEffect(() => {
    if (abierta && !baldosas.some((x) => x.clave === abierta)) setAbierta(null);
  }, [abierta, baldosas]);
  // tocar un cristal (o una baldosa) la abre en su sitio; cada cosa va a su sitio nuevo con una transición
  const tocar = (clave: string) => {
    const cambiar = () => setAbierta((a) => (a === clave ? null : clave));
    const doc = document as Document & { startViewTransition?: (f: () => void) => { finished: Promise<void> } };
    let quieto = false;
    try { quieto = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* nada */ }
    if (!doc.startViewTransition || quieto || !raiz.current) { cambiar(); return; }
    const con = [...raiz.current.querySelectorAll<HTMLElement>('[data-vt]')];
    con.forEach((x) => { x.style.setProperty('view-transition-name', x.dataset.vt!); });
    doc.startViewTransition(() => flushSync(cambiar)).finished.finally(() => con.forEach((x) => { x.style.removeProperty('view-transition-name'); }));
  };
  // la barra de arriba del móvil, del color de arriba del fondo
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barraHoy(oscuro, color));
  }, [oscuro, color]);
  const mio = COLORES[miembro(config, yo).color] ?? GRIS;
  const tuyo = { '--h-tuyo': mio.c, '--h-tuyo-osc': mio.osc, '--h-tuyo-claro': mio.claro } as CSSProperties;
  return (
    <div className={`hoy2 hoy2-c-${color} ${oscuro ? 'hoy2-oscuro' : ''} ${momento ? `hoy2-${momento}` : ''}`} ref={raiz} style={tuyo}>
      <div className="hoy2-fondo" aria-hidden="true" />
      <div className="hoy2-dentro margen">
        <CabeceraHoy />
        <section aria-label="Lo de hoy">
          <Frase trozos={frase} abierta={abierta} tocar={tocar} />
          <p className="hoy2-ayuda"><Hand size={15} /> Toca lo que va en vidrio</p>
        </section>
        {arriba}
        <section aria-label="Para ti" data-vt="hoy2-parati">
          <h2 className="hoy2-h2">Para ti</h2>
          <div className={`hoy2-rejilla ${baldosas.length % 2 ? 'impar' : ''}`}>
            {baldosas.map((b) => <BaldosaHoy key={b.clave} b={b} abierta={abierta === b.clave} tocar={() => tocar(b.clave)} hacer={hacer} />)}
          </div>
        </section>
        <PisosEnFila pisos={pisos} hacer={hacer} />
        <Escenas />
        {abajo && <div className="hoy2-abajo pila" data-vt="hoy2-abajo">{abajo}</div>}
      </div>
    </div>
  );
}
