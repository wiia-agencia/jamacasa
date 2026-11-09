import { Bath, BedDouble, ChevronRight, Dices, House, Info, Lock, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { escenaCasa } from '../core/escena';
import { CADA_ESPACIO, SUGERENCIAS_ESPACIO, textoEspacio } from '../core/espacio';
import { rotacionFutura, semanaBasura, tareaDe } from '../core/estado';
import type { Tarea } from '../core/limpieza';
import { rangoSemana } from '../core/tiempo';
import type { Zona } from '../core/tipos';
import { Casa3D } from './Casa3D';
import { useCasa } from './contexto';
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
  if (t.empezada !== undefined) return <span className="chapa oro">Limpiando</span>;
  return <span className="chapa">Pendiente</span>;
}

export function Limpieza() {
  const { estado, config, abrir, yo, abrirHistorial } = useCasa();
  const w = estado.semana;
  const escena = useMemo(() => escenaCasa(estado), [estado]);
  const basura = semanaBasura(estado, w);
  const futuras = rotacionFutura(config, Math.max(w, estado.semanaInicio), 6);
  const historial = [];
  for (let k = w - 1; k >= Math.max(estado.semanaInicio, w - 8); k--) historial.push(k);

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

      {escena && <Casa3D miembros={config.miembros} escena={escena} yo={yo} />}
      {estado.empezado && <TuPisoAhora />}
      <TuEspacio />

      {estado.empezado && (
        <Seccion titulo="Esta semana">
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
    </div>
  );
}

/** Tu piso de esta semana: lo que tiene que quedar limpio y los botones (empezar y marcar como hecho). */
function TuPisoAhora() {
  const { estado, yo, abrir, acciones, avisar } = useCasa();
  const [empezando, setEmpezando] = useState(false);
  const t = tareaDe(estado, estado.semana, yo);
  if (!t) return null;
  const puedeEmpezar = t.estado === 'pendiente' && t.empezada === undefined;
  // lo que solo entra cuando el piso te toca a ti (el pasillo de las habitaciones de arriba)
  const extras = (t.zona.extras ?? []).filter((x) => x.para.includes(yo));
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
      {(t.zona.checklist.length > 0 || extras.length > 0) && (
        <ul className="lista-limpiar" aria-label="Lo que tiene que quedar limpio">
          {t.zona.checklist.map((c) => <li key={c}>{c}</li>)}
          {extras.map((x) => <li key={x.id}>{x.nombre}</li>)}
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
  if (n.includes('piso') || n.includes('casa')) return <House size={18} />;
  return <Sparkles size={18} />;
}

/** «Tu espacio»: lo tuyo, que no sale en la casa de los tres. Solo lo ves tú y no da puntos: te dice cuánto llevas
 *  sin limpiarlo y te avisa cuando toca. */
function TuEspacio() {
  const { estado, yo, acciones, avisar } = useCasa();
  const cosas = estado.espacio[yo] ?? [];
  const [cambiando, setCambiando] = useState(false);
  const [otra, setOtra] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sugeridas = SUGERENCIAS_ESPACIO.filter((s) => !cosas.some((c) => c.nombre.toLowerCase() === s.toLowerCase()));
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

  return (
    <Seccion titulo="Tu espacio" extra={<span className="mini tenue fila" style={{ gap: 5 }}><Lock size={13} aria-hidden="true" />Solo lo ves tú</span>}>
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
      ) : (
        <p className="peq suave">Apunta lo tuyo (tu habitación, tu baño…): te dice cuánto llevas sin limpiarlo y te avisa cuando toca. Los otros dos no lo ven.</p>
      )}
      {(cosas.length === 0 || cambiando) && (
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
