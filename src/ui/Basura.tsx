// La basura clara (Javi, 17 de noviembre): «no estaba muy claro cuánta basura había, no estaba muy claro si alguien
// había avisado… no es lo mismo que haya una bolsa a que haya 6». Por colores (verde, amarillo, rojo), con las bolsas
// y las caras de quien avisa; «¿Cuándo la sacaste?» por si lo apuntas más tarde, y «Recuérdamelo» si la tienes tú.
import { useState } from 'react';
import { ATRAS_MAX } from '../core/basura';
import { basuraAhora, basuraTocaba, type BasuraAhora } from '../core/estado';
import { cuando, diaLocal, duracion, fechaDeDia, inicioDia, instanteLocal, nombreDia, partes } from '../core/tiempo';
import type { MiembroId } from '../core/tipos';
import { miembro, useCasa } from './contexto';
import { Avatar, BotonAccion, Hoja, SelectorFotos } from './piezas';

/** Una bolsa de basura, dibujada. */
export function Bolsa() {
  return (
    <svg className="bolsa" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.9 6.5C9.7 5.3 7.7 3.5 6.7 4.3c-.7.6.7 2.5 3.8 3.1z" fill="currentColor" />
      <path d="M13.1 6.5c1.2-1.2 3.2-3 4.2-2.2.7.6-.7 2.5-3.8 3.1z" fill="currentColor" />
      <path d="M10.4 6.2h3.2l.9 2.2c3.6 1.3 5.6 4.9 5 8.7-.5 3.1-3.3 4.9-7.5 4.9s-7-1.8-7.5-4.9c-.6-3.8 1.4-7.4 5-8.7z" fill="currentColor" />
      <path d="M8.3 12.2c-.9 1.5-1.1 3.4-.6 4.9" fill="none" stroke="#ffffff" strokeOpacity=".4" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Las bolsas que hay (hasta 6 y «+N»). */
export function Bolsas({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="bolsas" role="img" aria-label={n === 1 ? '1 bolsa' : `${n} bolsas`}>
      {Array.from({ length: Math.min(n, 6) }, (_, k) => <Bolsa key={k} />)}
      {n > 6 && <b>+{n - 6}</b>}
    </span>
  );
}

const unaBolsa = (n: number) => (n === 1 ? '1 bolsa' : `${n} bolsas`);
/** «hace 20 min», «hace 3 h», «hace 2 días» (sin minutos sueltos). */
const hace = (ms: number, ahora: number) => {
  const min = Math.round((ahora - ms) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} días`;
};
/** Lo que queda: «9 h» (con más de 2 horas, sin minutos), «1 h 20 min», «45 min». */
const queda = (ms: number) => (ms >= 2 * 3_600_000 ? `${Math.round(ms / 3_600_000)} h` : duracion(ms));
const yJunto = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] ?? '');

/** Lo que se dice de la basura: el título (con las bolsas) y quién avisa, desde cuándo y cuánto queda. */
export function textosBasura(b: BasuraAhora, yo: MiembroId, nombre: (m: MiembroId) => string, ahora: number, horasQueja: number) {
  const mia = b.quien === yo;
  if (b.nivel === 'tranquila') {
    return { titulo: !b.quien ? 'La basura' : mia ? 'La basura es tuya' : `La basura es de ${nombre(b.quien)}`, linea: 'Nadie ha avisado de que esté llena.' };
  }
  const bolsas = b.bolsas ? ` · ${unaBolsa(b.bolsas)}` : '';
  const titulo = b.pasada ? `Sin sacar${bolsas}` : b.nivel === 'urgente' ? `Muy llena${bolsas}` : `Llena${bolsas}`;
  const partesLinea: string[] = [];
  if (b.avisan.length) partesLinea.push(`${b.avisan.length > 1 ? 'Avisan' : 'Avisa'} ${yJunto(b.avisan.map((m) => (m === yo ? 'tú' : nombre(m))))} ${hace(b.desde!, ahora)}.`);
  else if (b.recordatorio) partesLinea.push(b.recordatorio.quien === yo ? `Lo apuntaste ${hace(b.recordatorio.desde, ahora)}: te lo recuerdo.` : `${nombre(b.recordatorio.quien)} lo sabe: la saca en un rato.`);
  if (b.pasada && b.aviso) partesLinea.push(`Se pasaron las ${horasQueja} h: queja para ${b.aviso.responsable === yo ? 'ti' : nombre(b.aviso.responsable)}.`);
  else if (b.limite !== undefined) partesLinea.push(`${mia ? 'Te quedan' : `A ${b.quien ? nombre(b.quien) : 'quien la tiene'} le quedan`} ${queda(b.limite - ahora)}.`);
  return { titulo, linea: partesLinea.join(' ') };
}

/** La basura en Hoy: de quién es y cómo está, con sus botones. Si está llena, ocupa todo el ancho. */
export function TarjetaBasura() {
  const { estado, yo, abrir, config } = useCasa();
  const b = basuraAhora(estado);
  const nombre = (m: MiembroId) => miembro(config, m).nombre;
  const { titulo, linea } = textosBasura(b, yo, nombre, estado.ahora, estado.normas.horasBasura);
  const mia = b.quien === yo;
  const tocaba = basuraTocaba(estado);
  const yaAvise = b.avisan.includes(yo) && b.aviso?.estado === 'abierto';
  return (
    <div className={`atajo basura ${b.nivel}`}>
      <div className="basura-cabeza">
        <span className="emoji" aria-hidden="true">🗑️</span>
        {b.bolsas > 0 && <Bolsas n={b.bolsas} />}
        <span className="crece" />
        {b.avisan.length > 0 && (
          <span className="basura-caras" aria-hidden="true">
            {b.avisan.map((m) => <Avatar key={m} id={m} tam="s" />)}
          </span>
        )}
      </div>
      <strong>{titulo}</strong>
      <span className="peq">
        {linea}
        {b.nivel === 'tranquila' && mia && tocaba && tocaba !== yo && ` Te la quedaste tú: le tocaba a ${nombre(tocaba)}.`}
      </span>
      <div className="basura-botones">
        {mia ? (
          <>
            <button type="button" className={`boton mini ${b.nivel !== 'tranquila' ? 'verde' : ''}`} onClick={() => abrir({ tipo: 'sacada' })}>Ya la saqué</button>
            {!b.aviso && !b.recordatorio && <button type="button" className="enlace atajo-enlace" onClick={() => abrir({ tipo: 'basura' })}>Está llena: recuérdamelo</button>}
          </>
        ) : (
          <>
            <button type="button" className="boton mini" disabled={!b.quien || yaAvise} onClick={() => abrir({ tipo: 'basura' })}>
              {yaAvise ? 'Ya avisaste' : b.avisan.length ? 'Avisar yo también' : 'Basura llena'}
            </button>
            {b.quien && b.nivel !== 'tranquila' && <button type="button" className="enlace atajo-enlace" onClick={() => abrir({ tipo: 'sacada' })}>La saqué yo</button>}
          </>
        )}
      </div>
    </div>
  );
}

/** «Basura llena» (o, si la tienes tú, «Recuérdamelo»): cuántas bolsas hay y, si quieres, una foto. */
export function HojaBasura() {
  const { cerrar, acciones, avisar, estado, config, yo } = useCasa();
  const [fotos, setFotos] = useState<string[]>([]);
  const [bolsas, setBolsas] = useState(1);
  const b = basuraAhora(estado);
  if (!b.quien) return null;
  const mia = b.quien === yo;
  const nombre = (m: MiembroId) => miembro(config, m).nombre;
  const N = nombre(b.quien);
  const abierto = b.aviso?.estado === 'abierto' && b.avisan.length > 0;
  const titulo = mia ? '¿Te lo recuerdo?' : abierto ? '¿Sigue llena?' : '¿La basura está llena?';
  const sub = mia
    ? 'Es tuya: te aviso dentro de 2 horas y, si sigue, otra vez más tarde (de noche, no). Sin quejas.'
    : abierto
      ? `Ya avisó ${yJunto(b.avisan.map(nombre))} ${hace(b.desde!, estado.ahora)}. Si avisas tú también, a ${N} le llega que sois dos (el plazo sigue igual).`
      : `Le llega el aviso a ${N}. Tiene ${estado.normas.horasBasura} horas para sacarla o se lleva una queja.`;
  return (
    <Hoja
      titulo={titulo}
      subtitulo={sub}
      onCerrar={cerrar}
      pie={
        <BotonAccion
          hacer={async () => {
            await acciones.basuraLlena(fotos, bolsas);
            cerrar();
            avisar(mia ? 'Vale: te lo recuerdo dentro de 2 horas.' : abierto ? `Hecho: ${N} sabe que sois dos.` : `Aviso enviado a ${N}.`);
          }}
        >
          {mia ? 'Recuérdamelo' : abierto ? 'Avisar yo también' : `Avisar a ${N}`}
        </BotonAccion>
      }
    >
      <div className="campo">
        <span className="etiqueta">¿Cuántas bolsas hay?</span>
        <div className="elige-bolsas" role="radiogroup" aria-label="Cuántas bolsas hay">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <button key={k} type="button" role="radio" aria-checked={bolsas === k} onClick={() => setBolsas(k)}>
              <Bolsa />
              <b>{k === 6 ? '6+' : k}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="campo">
        <span className="etiqueta">Foto (si quieres)</span>
        <SelectorFotos fotos={fotos} cambiar={setFotos} max={2} />
      </div>
    </Hoja>
  );
}

type Dia = 'ahora' | 'anoche' | number;

/** De un día que se elige y una hora («02:30»), el instante. «Anoche» es la noche pasada: antes de las 12, hoy de
 *  madrugada; si no, ayer por la noche. */
function instanteDe(dia: Exclude<Dia, 'ahora'>, hhmm: string, hoy: number): number {
  const [h, mi] = hhmm.split(':').map((x) => Number(x) || 0);
  const d = dia === 'anoche' ? (h < 12 ? hoy : hoy - 1) : dia;
  const f = fechaDeDia(d);
  return instanteLocal(f.y, f.m, f.d, h, mi);
}

const dosCifras = (x: number) => String(x).padStart(2, '0');

/** «¿Cuándo la sacaste?» (Javi, 17 de noviembre: la sacó a las 2 de la mañana y se acordó de apuntarlo al mediodía).
 *  «Ahora mismo», o el día y la hora: si la sacó dentro del plazo, no hay queja. Con `quien`, desde el cuadro. */
export function HojaSacada({ quien }: { quien?: MiembroId }) {
  const { cerrar, acciones, avisar, estado, config, yo } = useCasa();
  const p = quien ?? yo;
  const tu = p === yo;
  const nombre = (m: MiembroId) => miembro(config, m).nombre;
  const P = nombre(p);
  const ahora = estado.ahora;
  const hoy = diaLocal(ahora);
  const [dia, setDia] = useState<Dia>('ahora');
  const [hhmm, setHhmm] = useState('21:00');
  const b = basuraAhora(estado);
  const elegir = (d: Dia) => {
    setDia(d);
    if (d === 'anoche') setHhmm('23:00');
    else if (d === hoy) setHhmm(`${dosCifras(Math.max(0, partes(ahora).h - 1))}:00`);
    else if (d !== 'ahora') setHhmm('21:00');
  };
  const t = dia === 'ahora' ? ahora : instanteDe(dia, hhmm, hoy);
  const futuro = t > ahora + 60_000;
  const lejos = t < ahora - ATRAS_MAX;
  // lo que pasa si la sacó entonces: se acaba el aviso o se quita la queja
  const avisos = estado.semanasBasura.flatMap((s) => s.avisos);
  const quita = avisos.find((a) => a.estado === 'queja' && a.desde <= t && t <= a.limite);
  const acaba = avisos.find((a) => a.estado === 'abierto' && a.desde <= t);
  const queda = b.aviso && b.aviso.estado === 'abierto' && t < b.aviso.desde;
  const dias: Dia[] = ['ahora', 'anoche', hoy, hoy - 1, hoy - 2, hoy - 3, hoy - 4];
  const etiqueta = (d: Dia) => (d === 'ahora' ? 'Ahora mismo' : d === 'anoche' ? 'Anoche' : d === hoy ? 'Hoy' : d === hoy - 1 ? 'Ayer' : `${nombreDia(inicioDia(d), true)} ${fechaDeDia(d).d}`);
  const efecto = futuro
    ? 'Esa hora aún no ha llegado.'
    : lejos
      ? 'Más de una semana: no se puede.'
      : quita
        ? `Se quita la queja de ${quita.responsable === yo ? 'ti' : nombre(quita.responsable)}: la ${tu ? 'sacaste' : 'sacó'} a tiempo.`
        : acaba
          ? 'Y se acaba el aviso.'
          : queda
            ? `Ojo: el aviso de ${yJunto(b.avisan.map(nombre))} es de después, así que sigue.`
            : '';
  return (
    <Hoja
      titulo={tu ? '¿Cuándo la sacaste?' : `¿Cuándo la sacó ${P}?`}
      subtitulo="Si la sacaste antes y lo apuntas ahora, dinos cuándo: cuenta esa hora."
      onCerrar={cerrar}
      pie={
        <BotonAccion
          desactivado={futuro || lejos}
          hacer={async () => {
            await acciones.basuraSacada(quien, dia === 'ahora' ? undefined : t);
            cerrar();
            avisar(dia === 'ahora' ? (tu ? 'Basura sacada. ¡Gracias!' : `Apuntado: la ha sacado ${P}.`) : `Apuntado: ${tu ? 'la sacaste' : `la sacó ${P}`} ${cuando(t, ahora)}.`);
          }}
        >
          {dia === 'ahora' ? (tu ? 'Ya la saqué' : `La ha sacado ${P}`) : `${tu ? 'La saqué' : 'La sacó'} ${cuando(t, ahora)}`}
        </BotonAccion>
      }
    >
      <div className="cuando-dias" role="radiogroup" aria-label="Qué día">
        {dias.map((d) => (
          <button key={String(d)} type="button" role="radio" aria-checked={dia === d} className={d === 'ahora' ? 'grande' : ''} onClick={() => elegir(d)}>
            {etiqueta(d)}
          </button>
        ))}
      </div>
      {dia !== 'ahora' && (
        <label className="cuando-hora">
          <span>A las</span>
          <input type="time" value={hhmm} onChange={(e) => e.target.value && setHhmm(e.target.value)} />
        </label>
      )}
      {efecto && <p className={`peq ${futuro || lejos ? 'mal' : 'suave'}`}>{efecto}</p>}
    </Hoja>
  );
}
