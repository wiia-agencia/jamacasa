// Lo de arriba de Hoy, en tres estilos para elegir (Javi, 17 de noviembre: «entras y es todo texto y plano… no me
// siento dentro de una aplicación»). Los tres llevan las caras de los muñecos (las de la casa en 3D) y lo tuyo de la
// semana con un botón grande:
//   · juguete: piezas de plástico que se pulsan (borde de color abajo), el cielo de la casa en 3D.
//   · marcador: la casa como un marcador de la tele: los tres con sus puntos en cifras de placa y tu cuenta atrás.
//   · plastilina: blandito y de colores suaves; tu muñeco grande, saliendo de tu tarjeta.
import { Flame } from 'lucide-react';
import type { ReactNode } from 'react';
import { marcaDe } from '../core/bocadillos';
import { puntosDelMes, tareaDe } from '../core/estado';
import { enMarcha, type Tarea } from '../core/limpieza';
import { nota } from '../core/noticias';
import { duracion, fechaDeDia, finSemana, lunesDe, nombreMes } from '../core/tiempo';
import type { MiembroId } from '../core/tipos';
import { carasDe } from './caras';
import { claseColor, miembro, useCasa } from './contexto';
import { euros } from '../core/cuentas';

export type EstiloHoy = 'juguete' | 'marcador' | 'plastilina';

/** Para la vista previa: «?estilo=juguete» en la dirección. */
export function estiloHoy(): EstiloHoy | null {
  try {
    const e = new URLSearchParams(location.search).get('estilo');
    return e === 'juguete' || e === 'marcador' || e === 'plastilina' ? e : null;
  } catch {
    return null;
  }
}

const CORTO: Record<string, string> = { abajo: 'Abajo', medio: 'Medio', arriba: 'Arriba' };

function Cara({ id, tam }: { id: MiembroId; tam: number }) {
  const { config } = useCasa();
  const m = miembro(config, id);
  const src = carasDe()[id];
  return (
    <span className={`hoy-cara ${claseColor(m.color)}`} style={{ width: tam, height: tam }}>
      {src ? <img src={src} alt="" /> : <b>{m.nombre.charAt(0)}</b>}
    </span>
  );
}

/** Lo tuyo de la semana: qué pasa y el botón que toca. */
function loTuyo(t: Tarea, ahora: number): { estado: string; linea: string; boton: string; accion: 'limpieza' | 'hecho' | 'nota' | 'nada' } {
  const quedan = duracion(finSemana(t.semana) - ahora);
  const hechas = t.lista.length ? `${t.marcadas.length} de ${t.lista.length}` : '';
  if (t.libre && t.estado === 'pendiente') return { estado: 'Estás fuera', linea: 'Tu piso queda libre esta semana', boton: 'Ver la casa', accion: 'limpieza' };
  if (t.estado === 'aprobada') return { estado: `Aprobado con un ${nota(t.nota!)}`, linea: 'Hasta el lunes, nada más', boton: 'Ver la casa', accion: 'limpieza' };
  if (t.estado === 'esperando') return { estado: 'Esperando nota', linea: 'Si nadie dice nada, se queda la tuya', boton: 'Ver tu nota', accion: 'nota' };
  if (t.estado === 'suspendida') return { estado: 'Toca repasarlo', linea: hechas ? `Llevas ${hechas}` : 'Mira qué falló', boton: 'Repasar', accion: 'limpieza' };
  if (enMarcha(t)) return { estado: 'Limpiando', linea: `${hechas ? `${hechas} · ` : ''}quedan ${quedan}`, boton: 'Ya está: marcar hecho', accion: 'hecho' };
  return { estado: t.enCurso ? 'Te toca' : 'Vas tarde', linea: t.enCurso ? `Quedan ${quedan}` : `${t.retrasoDias} ${t.retrasoDias === 1 ? 'día' : 'días'} tarde`, boton: 'Empezar a limpiar', accion: 'limpieza' };
}

export function HoyArriba({ estilo }: { estilo: EstiloHoy }) {
  const { estado, config, yo, abrir, ir } = useCasa();
  const t = tareaDe(estado, estado.semana, yo);
  const yoM = miembro(config, yo);
  const orden = [yo, ...config.miembros.map((m) => m.id).filter((id) => id !== yo)];
  const a = fechaDeDia(lunesDe(estado.semana)), b = fechaDeDia(lunesDe(estado.semana) + 6);
  const semana = `Semana del ${a.d} al ${b.d}`;
  const puntos = (m: MiembroId) => puntosDelMes(estado, m);
  const puesto = 1 + config.miembros.filter((m) => puntos(m.id) > puntos(yo)).length;
  const saldo = estado.cuentas.saldo[yo] ?? 0;
  const tuyo = t ? loTuyo(t, estado.ahora) : null;
  const pulsar = () => {
    if (!t || !tuyo) return;
    if (tuyo.accion === 'hecho') abrir({ tipo: 'hecho', tarea: t });
    else if (tuyo.accion === 'nota') { const i = t.intentos[t.intentos.length - 1]; if (i) abrir({ tipo: 'puntuar', tarea: t, intento: i, propia: true }); }
    else ir('limpieza');
  };
  const racha = estado.racha.actual > 0 ? <span className="hoy-racha"><Flame size={15} aria-hidden="true" /> {estado.racha.actual} {estado.racha.actual === 1 ? 'semana' : 'semanas'} de racha</span> : null;
  const persona = (m: MiembroId) => {
    const tm = tareaDe(estado, estado.semana, m);
    return { m, c: miembro(config, m), piso: tm ? CORTO[tm.zona.id] ?? tm.zona.nombre : '—', marca: marcaDe(estado, m, yo) };
  };
  const cuentas = saldo === 0 ? 'En paz' : saldo < 0 ? 'Debes' : 'Te deben';

  if (estilo === 'marcador') {
    const filas = orden.map(persona).sort((x, y) => puntos(y.m) - puntos(x.m));
    const quedan = t ? Math.max(0, finSemana(t.semana) - estado.ahora) : 0;
    const dd = Math.floor(quedan / 86_400_000), hh = Math.floor((quedan % 86_400_000) / 3_600_000);
    return (
      <div className="hoy-arriba hoy-marcador">
        <header className="marcador-tablero">
          <div className="margen marcador-cabeza">
            <h1 className="display marca">JAMACASA</h1>
            <span>{semana}</span>
          </div>
          <div className="margen marcador-filas" role="list" aria-label="Así va el mes">
            {filas.map(({ m, c, piso, marca }, k) => (
              <button key={m} type="button" role="listitem" className={`marcador-fila ${claseColor(c.color)} ${m === yo ? 'tu' : ''}`} onClick={() => ir('juego')}>
                <span className="marcador-puesto">{k + 1}</span>
                <Cara id={m} tam={40} />
                <span className="marcador-nombre">{m === yo ? 'Tú' : c.nombre}<small>{piso}{marca.marca ? ` · ${marca.marca}` : ''}</small></span>
                <span className="marcador-puntos">{nota(puntos(m))}</span>
              </button>
            ))}
          </div>
          <div className="margen marcador-pie">{racha}<span>Puntos de {nombreMes(estado.mes)}</span></div>
        </header>
        {t && tuyo && (
          <section className="margen">
            <div className="marcador-prueba">
              <div className="crece">
                <p className="marcador-eti">{tuyo.estado}</p>
                <h2 className="display">{t.zona.nombre}</h2>
                <p className="peq suave">{tuyo.linea}</p>
              </div>
              {t.estado === 'pendiente' && !t.libre && (
                <div className="marcador-reloj" aria-label={`Quedan ${dd} días y ${hh} horas`}>
                  <span className="placa peq"><span className="cifra">{dd}</span></span><small>d</small>
                  <span className="placa peq"><span className="cifra">{String(hh).padStart(2, '0')}</span></span><small>h</small>
                </div>
              )}
            </div>
            <button type="button" className="boton ancho marcador-boton" onClick={pulsar}>{tuyo.boton}</button>
          </section>
        )}
      </div>
    );
  }

  if (estilo === 'plastilina') {
    const otros = orden.slice(1).map(persona);
    return (
      <div className={`hoy-arriba hoy-plastilina ${claseColor(yoM.color)}`}>
        <header className="margen plastilina-cabeza">
          <h1 className="display marca">JAMACASA</h1>
          <p>{semana}{racha && <> · {racha}</>}</p>
        </header>
        {t && tuyo && (
          <section className="margen">
            <div className={`plastilina-tuya ${claseColor(yoM.color)}`}>
              <span className="plastilina-yo"><Cara id={yo} tam={112} /></span>
              <p className="plastilina-eti">{tuyo.estado}</p>
              <h2 className="display">{t.zona.nombre}</h2>
              <p className="peq">{tuyo.linea}</p>
              <button type="button" className="plastilina-boton" onClick={pulsar}>{tuyo.boton}</button>
            </div>
          </section>
        )}
        <div className="margen plastilina-otros">
          {otros.map(({ m, c, piso, marca }) => (
            <button key={m} type="button" className={`plastilina-otro ${claseColor(c.color)}`} onClick={() => ir('limpieza')}>
              <Cara id={m} tam={52} />
              <span><b>{c.nombre}</b><small>{piso}{marca.marca ? ` ${marca.marca}` : ''}</small></span>
            </button>
          ))}
        </div>
        <div className="margen plastilina-fichas">
          <button type="button" onClick={() => ir('juego')}><b className="cifra">{nota(puntos(yo))}</b><span>puntos · {puesto}.º</span></button>
          <button type="button" onClick={() => ir('cuentas')}><b className={`cifra ${saldo < 0 ? 'mal' : ''}`}>{saldo === 0 ? '0 €' : euros(saldo).replace(',00 €', ' €')}</b><span>{cuentas}</span></button>
        </div>
      </div>
    );
  }

  // juguete
  const piezas = orden.map(persona);
  return (
    <div className="hoy-arriba hoy-juguete">
      <header className="margen juguete-cabeza">
        <h1 className="display marca">JAMACASA</h1>
        <p>{semana}{racha && <> · {racha}</>}</p>
      </header>
      <div className="margen juguete-piezas" role="list" aria-label="Quién tiene cada piso">
        {piezas.map(({ m, c, piso, marca }) => (
          <button key={m} type="button" role="listitem" className={`juguete-pieza ${claseColor(c.color)} ${m === yo ? 'tu' : ''}`} onClick={() => ir('limpieza')}>
            <Cara id={m} tam={58} />
            {marca.marca && <i className={`juguete-marca ${marca.tono}`} aria-hidden="true">{marca.marca}</i>}
            <b>{m === yo ? 'Tú' : c.nombre}</b>
            <small>{piso}</small>
          </button>
        ))}
      </div>
      {t && tuyo && (
        <section className="margen">
          <div className={`juguete-tuya ${claseColor(yoM.color)}`}>
            <p className="juguete-eti">{tuyo.estado}</p>
            <h2 className="display">{t.zona.nombre}</h2>
            <p className="peq">{tuyo.linea}</p>
            <Pulsable onClick={pulsar}>{tuyo.accion === 'limpieza' && !enMarcha(t) && t.estado === 'pendiente' && !t.libre ? '▶ ' : ''}{tuyo.boton}</Pulsable>
          </div>
        </section>
      )}
      <div className="margen juguete-fichas">
        <button type="button" className="juguete-ficha oro" onClick={() => ir('juego')}><b className="cifra">{nota(puntos(yo))}</b><span>puntos · {puesto}.º del mes</span></button>
        <button type="button" className={`juguete-ficha ${saldo < 0 ? 'rojo' : 'verde'}`} onClick={() => ir('cuentas')}><b className="cifra">{saldo === 0 ? '0 €' : euros(saldo).replace(',00 €', ' €')}</b><span>{cuentas}</span></button>
      </div>
    </div>
  );
}

function Pulsable({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" className="juguete-boton" onClick={onClick}>{children}</button>;
}
