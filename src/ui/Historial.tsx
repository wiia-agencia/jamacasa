// Historial: el calendario de la casa. Cada día se ve como estaba al acabar el día (quién limpió, las notas,
// quién debía qué, el alquiler, la basura, las medallas…) y, si quieres, la casa en 3D tal cual estaba.
import { ArrowLeft, Box, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { euros } from '../core/cuentas';
import { escenaCasa } from '../core/escena';
import { diaDeLaCasa, marcasDelMes, rejillaDelMes, resumenDelMes, type ComoAcabo, type MarcaDelDia, type PersonaDelDia, type SemanaDelMes } from '../core/historial';
import { MEDALLAS, TITULOS } from '../core/juego';
import { diaLocal, fechaCorta, fechaDeDia, hora, inicioDia, lunesDe, mesAnterior, mesDeDia, mesSiguiente, nombreDia, nombreMes, rangoSemana } from '../core/tiempo';
import { Casa3D } from './Casa3D';
import { claseColor, miembro, useCasa } from './contexto';
import { Avatar, Placa, Puntos, Seccion } from './piezas';

const DEF = new Map([...MEDALLAS, ...TITULOS].map((d) => [d.id, d]));
const CAB = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** «martes 3 de noviembre» */
function fechaLarga(dia: number): string {
  const f = fechaDeDia(dia);
  return `${nombreDia(inicioDia(dia) + 12 * 3_600_000)} ${f.d} de ${nombreMes(mesDeDia(dia))}`;
}
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const tituloMes = (m: string) => `${mayuscula(nombreMes(m))} de ${m.slice(0, 4)}`;

/** «3, 10 y 17» */
function listaDias(dias: number[]): string {
  const n = dias.map((d) => String(fechaDeDia(d).d));
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

export function Historial({ dia: diaInicial, vista: vistaInicial, onCerrar }: { dia: number; vista: 'dia' | 'mes'; onCerrar: () => void }) {
  const { config, estado, eventos, yo } = useCasa();
  const hoy = diaLocal(estado.ahora);
  const primerMes = estado.meses[0] ?? estado.mes;
  const [dia, setDia] = useState(Math.min(diaInicial, hoy));
  const [mesVisto, setMesVisto] = useState(mesDeDia(Math.min(diaInicial, hoy)));
  const [vista, setVista] = useState(vistaInicial);
  const marcas = useMemo(() => marcasDelMes(config, eventos, mesVisto, estado, yo), [config, eventos, mesVisto, estado, yo]);
  const rejilla = useMemo(() => rejillaDelMes(mesVisto), [mesVisto]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  const cambiarMes = (m: string) => {
    setMesVisto(m);
    // al cambiar de mes, el día elegido pasa a ese mes (el último que ya ha pasado)
    const dias = rejillaDelMes(m).filter((d): d is number => d !== null && d <= hoy);
    if (dias.length) setDia(dias[dias.length - 1]);
  };

  return (
    <div className="margen pila historial">
      <header className="cabecera" style={{ alignItems: 'center', justifyContent: 'flex-start' }}>
        <button type="button" className="icono-boton" onClick={onCerrar} aria-label="Volver">
          <ArrowLeft size={20} />
        </button>
        <div className="crece">
          <h1 className="display titulo-pantalla">Historial</h1>
          <p className="suave peq" style={{ marginTop: 4 }}>Todo lo que ha pasado en la casa, día a día</p>
        </div>
      </header>

      <section className="tarjeta cal-tarjeta" aria-label="Calendario">
        <div className="cal-mes">
          <button type="button" className="icono-boton" onClick={() => cambiarMes(mesAnterior(mesVisto))} disabled={mesVisto <= primerMes} aria-label="Mes anterior">
            <ChevronLeft size={20} />
          </button>
          <h2 className="titulo-seccion">{tituloMes(mesVisto)}</h2>
          <button type="button" className="icono-boton" onClick={() => cambiarMes(mesSiguiente(mesVisto))} disabled={mesVisto >= estado.mes} aria-label="Mes siguiente">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="cal" role="grid" aria-label={`Días de ${nombreMes(mesVisto)}`}>
          {CAB.map((c) => <span key={c} className="cal-cab" aria-hidden="true">{c}</span>)}
          {rejilla.map((d, k) => (d === null ? <span key={`h${k}`} /> : (
            <Dia key={d} dia={d} marca={marcas.get(d)!} elegido={d === dia && vista === 'dia'} hoy={d === hoy} futuro={d > hoy}
              onElegir={() => { setDia(d); setVista('dia'); }} />
          )))}
        </div>
        <p className="cal-leyenda">
          <span><i className="pt" /> limpió su piso</span>
          <span><b className="m-dinero">€</b> pagó</span>
          <span><b className="m-medalla">★</b> medalla</span>
          <span><b className={`m-espacio ${claseColor(miembro(config, yo).color)}`}>✓</b> tu espacio</span>
        </p>
      </section>

      <div className="pestanas" role="tablist" aria-label="Qué ver">
        <button type="button" role="tab" aria-selected={vista === 'dia'} onClick={() => setVista('dia')}>
          {dia === hoy ? 'Hoy' : `El ${fechaDeDia(dia).d} de ${nombreMes(mesDeDia(dia))}`}
        </button>
        <button type="button" role="tab" aria-selected={vista === 'mes'} onClick={() => setVista('mes')}>
          Todo {nombreMes(mesVisto)}
        </button>
      </div>

      {vista === 'dia' ? <ElDia dia={dia} /> : <ElMes mesId={mesVisto} marcas={marcas} irADia={(d) => { setDia(d); setVista('dia'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
    </div>
  );
}

function Dia({ dia, marca, elegido, hoy, futuro, onElegir }: { dia: number; marca: MarcaDelDia; elegido: boolean; hoy: boolean; futuro: boolean; onElegir: () => void }) {
  const { config, yo } = useCasa();
  const dinero = marca.pagaron.length > 0 || marca.alquiler.length > 0;
  const partes = [
    marca.limpiaron.length ? `limpió ${marca.limpiaron.map((m) => miembro(config, m).nombre).join(' y ')}` : '',
    dinero ? 'hubo pagos' : '',
    marca.medallas.length ? 'hubo medallas' : '',
    marca.espacio.length ? 'limpiaste tu espacio' : '',
  ].filter(Boolean);
  return (
    <button type="button" role="gridcell" className={`cal-dia ${elegido ? 'elegido' : ''} ${hoy ? 'hoy' : ''}`} disabled={futuro} onClick={onElegir}
      aria-selected={elegido} aria-label={`${fechaLarga(dia)}${partes.length ? `: ${partes.join(', ')}` : ''}`}>
      <span className="num">{fechaDeDia(dia).d}</span>
      <span className="pts" aria-hidden="true">
        {marca.limpiaron.map((m) => <i key={m} className={`pt ${claseColor(miembro(config, m).color)}`} />)}
      </span>
      <span className="mk" aria-hidden="true">
        {dinero && <b className="m-dinero">€</b>}
        {marca.medallas.length > 0 && <b className="m-medalla">★</b>}
        {marca.espacio.length > 0 && <b className={`m-espacio ${claseColor(miembro(config, yo).color)}`}>✓</b>}
      </span>
    </button>
  );
}

// ——— Un día ———

function ElDia({ dia }: { dia: number }) {
  const { config, eventos, ahora, yo, estado } = useCasa();
  const d = useMemo(() => diaDeLaCasa(config, eventos, dia, ahora, yo), [config, eventos, dia, ahora, yo]);
  const [ver3d, setVer3d] = useState(false);
  const escena = useMemo(() => (ver3d ? escenaCasa(d.estado) : null), [ver3d, d]);
  const empezado = d.estado.empezado;
  const medallas = d.personas.flatMap((p) => p.medallas.map((id) => ({ quien: p.miembro, id })));
  const mensajes = eventos.filter((e) => e.tipo === 'mensaje' && e.ts <= d.ts && diaLocal(e.ts) === dia).length;
  const hoy = d.hoy;

  return (
    <div className="pila">
      <div>
        <h2 className="display hist-fecha">{hoy ? 'Hoy' : mayuscula(fechaLarga(dia))}</h2>
        <p className="suave peq">
          {hoy ? `${mayuscula(fechaLarga(dia))} · así está la casa ahora` : `Así estaba la casa al acabar el día · semana ${rangoSemana(d.estado.semana, true)}`}
        </p>
      </div>

      {empezado && (
        <div className="pila-s">
          {ver3d && escena ? (
            <Casa3D miembros={config.miembros} escena={escena} yo={yo} />
          ) : (
            <button type="button" className="boton ancho claro" onClick={() => setVer3d(true)}>
              <Box size={18} /> {hoy ? 'Ver la casa ahora' : 'Ver la casa como estaba ese día'}
            </button>
          )}
          {ver3d && <p className="tenue mini">Toca otro día del calendario y la casa cambia a ese día.</p>}
        </div>
      )}

      {empezado ? (
        <Seccion titulo={hoy ? 'Cada uno, ahora' : 'Cada uno, ese día'}>
          <div className="caja">
            <div className="lista">
              {d.personas.map((p) => <Persona key={p.miembro} p={p} pasado={!hoy} />)}
            </div>
          </div>
        </Seccion>
      ) : (
        <p className="vacio">La casa todavía no había empezado: el primer lunes fue el {fechaCorta(lunesDe(estado.semanaInicio))}.</p>
      )}

      {medallas.length > 0 && (
        <Seccion titulo="Medallas de ese día">
          <div className="hist-medallas">
            {medallas.map((m, k) => {
              const def = DEF.get(m.id);
              return (
                <span key={k} className={`hist-medalla ${def?.mala ? 'mala' : ''}`}>
                  <span className="moneda" aria-hidden="true">{def?.emoji ?? '🏅'}</span>
                  <span className="crece">
                    <span className="negrita" style={{ display: 'block' }}>{def?.nombre ?? m.id}</span>
                    <span className="peq suave">{miembro(config, m.quien).nombre}</span>
                  </span>
                </span>
              );
            })}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Lo que pasó">
        {d.noticias.length === 0 && mensajes === 0 ? (
          <p className="vacio">{hoy ? 'Hoy todavía no ha pasado nada.' : 'Ese día no pasó nada en la casa.'}</p>
        ) : (
          <div className="lista">
            {d.noticias.map((n) => (
              <div key={n.id} className="item noticia">
                <Avatar id={n.quien} tam="s" />
                <div className="crece">
                  {n.oficial && <p className="oficial-etiqueta">Comunicado oficial</p>}
                  <p className="peq">{n.texto}</p>
                  <p className="cuando">a las {hora(n.ts)}</p>
                </div>
              </div>
            ))}
            {mensajes > 0 && (
              <div className="item noticia">
                <span className="avatar s" style={{ background: 'var(--papel-2)', color: 'var(--texto-2)', fontSize: '0.8rem' }} aria-hidden="true">💬</span>
                <p className="peq suave crece">{mensajes === 1 ? 'Y un mensaje en el chat.' : `Y ${mensajes} mensajes en el chat.`}</p>
              </div>
            )}
          </div>
        )}
      </Seccion>

      {d.espacio.length > 0 && (
        <Seccion titulo="Tu espacio" extra={<span className="chapa"><Lock size={12} /> Solo lo ves tú</span>}>
          <div className="caja">
            <div className="lista">
              {d.espacio.map((c) => {
                const ese = c.ultima !== null && diaLocal(c.ultima) === dia;
                return (
                  <div key={c.id} className="item">
                    <span className="crece">
                      <span className="negrita" style={{ display: 'block' }}>{c.nombre}</span>
                      <span className={`peq ${c.toca && !ese ? 'mal' : 'suave'}`}>
                        {ese ? (hoy ? 'Lo has limpiado hoy' : 'Lo limpiaste ese día')
                          : c.ultima === null ? 'Sin marcar todavía'
                          : `${hoy ? 'Llevas' : 'Llevabas'} ${c.dias === 1 ? '1 día' : `${c.dias} días`} sin limpiarlo${c.toca ? (hoy ? ' · ya toca' : ' · ya tocaba') : ''}`}
                      </span>
                    </span>
                    {ese && <span className="chapa oro">Hecho</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </Seccion>
      )}
    </div>
  );
}

function ChapaSituacion({ p }: { p: PersonaDelDia }) {
  switch (p.situacion) {
    case 'aprobado': return <Placa valor={p.nota ?? 0} peq />;
    case 'suspendido': return <span className="chapa mal">Suspendido</span>;
    case 'esperando': return <span className="chapa">Esperando nota</span>;
    case 'limpiando': return <span className="chapa oro">Limpiando</span>;
    case 'tarde': return <span className="chapa mal">Tarde</span>;
    case 'sin_hacer': return <span className="chapa mal">Sin hacer</span>;
    case 'sin_empezar': return <span className="chapa">Sin empezar</span>;
    default: return null;
  }
}

function Persona({ p, pasado }: { p: PersonaDelDia; pasado: boolean }) {
  const { config } = useCasa();
  const m = miembro(config, p.miembro);
  const debe = pasado ? 'Debía' : 'Debe';
  const leDeben = pasado ? 'Le debían' : 'Le deben';
  const dinero = p.saldo < 0 ? `${debe} ${euros(-p.saldo)}` : p.saldo > 0 ? `${leDeben} ${euros(p.saldo)}` : 'En paz con las cuentas';
  const alquiler = !p.alquiler ? null
    : p.alquiler.pagado ? `Alquiler pagado el ${fechaDeDia(p.alquiler.dia!).d}${p.alquiler.diasTarde > 0 ? ` (${p.alquiler.diasTarde} ${p.alquiler.diasTarde === 1 ? 'día' : 'días'} tarde)` : ''}`
    : p.alquiler.diasTarde > 0 ? `Alquiler sin pagar · ${p.alquiler.diasTarde} ${p.alquiler.diasTarde === 1 ? 'día' : 'días'} tarde`
    : 'Alquiler sin pagar todavía';
  return (
    <div className="item hist-persona">
      <Avatar id={p.miembro} />
      <div className="crece">
        <p className="negrita">{m.nombre}{p.zona && <span className="suave" style={{ fontWeight: 500 }}> · {p.zona}</span>}</p>
        <p className="peq suave">{dinero}</p>
        {alquiler && <p className={`peq ${p.alquiler && !p.alquiler.pagado && p.alquiler.diasTarde > 0 ? 'mal' : 'suave'}`}>{alquiler}</p>}
        {(p.basura || p.porPuntuar > 0 || p.atrasada || p.puntos !== 0) && (
          <p className="hist-etiquetas">
            {p.puntos !== 0 && <span className="chapa oro"><Puntos valor={p.puntos} /> pts</span>}
            {p.basura && <span className="chapa">🗑️ La basura</span>}
            {p.porPuntuar > 0 && <span className="chapa">{p.porPuntuar === 1 ? '1 nota por poner' : `${p.porPuntuar} notas por poner`}</span>}
            {p.atrasada && <span className="chapa mal">{pasado ? 'Debía' : 'Debe'} el piso anterior</span>}
          </p>
        )}
      </div>
      <ChapaSituacion p={p} />
    </div>
  );
}

// ——— Un mes ———

function ChapaComo({ como, nota: n }: { como: ComoAcabo; nota?: number }) {
  switch (como) {
    case 'aprobado': return <Placa valor={n ?? 0} peq />;
    case 'suspendido': return <span className="chapa mal">Susp.</span>;
    case 'esperando': return <span className="chapa" title="Hecho, esperando la nota">Hecho</span>;
    case 'limpiando': return <span className="chapa oro">Limpiando</span>;
    case 'en_curso': return <span className="chapa">En curso</span>;
    case 'tarde': return <span className="chapa mal">Tarde</span>;
    case 'sin_hacer': return <span className="chapa mal">Sin hacer</span>;
  }
}

function ElMes({ mesId, marcas, irADia }: { mesId: string; marcas: Map<number, MarcaDelDia>; irADia: (d: number) => void }) {
  const { config, estado, yo } = useCasa();
  const r = useMemo(() => resumenDelMes(config, estado, mesId), [config, estado, mesId]);
  const nombre = nombreMes(mesId);
  const medallas = [...marcas.entries()].flatMap(([d, k]) => k.medallas.map((g) => ({ ...g, dia: d })));
  const espacio = new Map<string, number[]>();
  for (const [d, k] of marcas) for (const n of k.espacio) (espacio.get(n) ?? espacio.set(n, []).get(n)!).push(d);
  const titulos = TITULOS.filter((t) => (r.titulos[t.id] ?? []).length > 0);

  return (
    <div className="pila">
      {r.semanas.length > 0 && (
        <Seccion titulo="Cómo acabó cada semana">
          <div className="caja" style={{ padding: 16 }}>
            <div className="rotacion hist-semanas">
              <span />
              {config.miembros.map((m) => <span key={m.id} className="fila" style={{ gap: 6 }}><Avatar id={m.id} tam="s" /></span>)}
              <span className="tenue mini" style={{ textAlign: 'center' }} aria-label="La basura">🗑️</span>
              {r.semanas.map((s) => (
                <SemanaFila key={s.semana} s={s} irADia={irADia} />
              ))}
            </div>
          </div>
          <p className="tenue mini">Toca una semana para ver su domingo. La placa es la nota con la que se aprobó.</p>
        </Seccion>
      )}

      {r.alquiler.length > 0 && (
        <Seccion titulo={`El alquiler de ${nombre}`}>
          <div className="caja">
            <div className="lista">
              {r.alquiler.map((a) => (
                <div key={a.miembro} className="item">
                  <Avatar id={a.miembro} tam="s" />
                  <span className="crece negrita">{miembro(config, a.miembro).nombre}</span>
                  {a.pagadoDia !== undefined ? (
                    <button type="button" className={`chapa ${a.diasTarde > 0 ? 'mal' : ''}`} style={{ border: 0 }} onClick={() => irADia(a.pagadoDia!)}>
                      Pagado el {fechaDeDia(a.pagadoDia).d}{a.diasTarde > 0 ? ` · ${a.diasTarde} ${a.diasTarde === 1 ? 'día' : 'días'} tarde` : ''}
                    </button>
                  ) : (
                    <span className={`chapa ${a.diasTarde > 0 ? 'mal' : ''}`}>{a.diasTarde > 0 ? `Sin pagar · ${a.diasTarde} días tarde` : 'Sin pagar todavía'}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Seccion>
      )}

      {titulos.length > 0 && (
        <Seccion titulo={r.cerrado ? `Títulos de ${nombre}` : `Así van los títulos de ${nombre}`}>
          <div className="caja">
            <div className="lista">
              {titulos.map((t) => (
                <div key={t.id} className="item">
                  <span className={`moneda-mini ${t.mala ? 'mala' : ''}`} aria-hidden="true">{t.emoji}</span>
                  <span className="crece">
                    <span className="negrita" style={{ display: 'block' }}>{t.nombre}</span>
                    <span className="peq suave">{t.texto}</span>
                  </span>
                  <span className="fila" style={{ gap: 4 }}>{r.titulos[t.id].map((id) => <Avatar key={id} id={id} tam="s" />)}</span>
                </div>
              ))}
            </div>
          </div>
          {!r.cerrado && <p className="tenue mini">Se deciden al acabar el mes: hasta entonces pueden cambiar.</p>}
        </Seccion>
      )}

      <Seccion titulo={`Medallas de ${nombre}`}>
        {medallas.length === 0 ? (
          <p className="vacio">Nadie ganó medallas en {nombre}.</p>
        ) : (
          <div className="caja">
            <div className="lista">
              {medallas.map((g, k) => {
                const def = DEF.get(g.medalla);
                return (
                  <button key={k} type="button" className="item item-boton" onClick={() => irADia(g.dia)}>
                    <span className={`moneda-mini ${def?.mala ? 'mala' : ''}`} aria-hidden="true">{def?.emoji ?? '🏅'}</span>
                    <span className="crece">
                      <span className="negrita" style={{ display: 'block' }}>{def?.nombre ?? g.medalla}</span>
                      <span className="peq suave">{miembro(config, g.miembro).nombre} · el {fechaCorta(g.dia)}</span>
                    </span>
                    <ChevronRight size={18} className="tenue" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Seccion>

      {(estado.espacio[yo] ?? []).length > 0 && (
        <Seccion titulo={`Tu espacio en ${nombre}`} extra={<span className="chapa"><Lock size={12} /> Solo lo ves tú</span>}>
          <div className="caja">
            <div className="lista">
              {(estado.espacio[yo] ?? []).map((c) => {
                const dias = espacio.get(c.nombre) ?? [];
                return (
                  <div key={c.id} className="item">
                    <span className="crece">
                      <span className="negrita" style={{ display: 'block' }}>{c.nombre}</span>
                      <span className="peq suave">{dias.length ? `Lo limpiaste el ${listaDias(dias)} de ${nombre}` : `No lo limpiaste en ${nombre}`}</span>
                    </span>
                    {c.ultima !== null && <span className="chapa">Última: {fechaCorta(diaLocal(c.ultima))}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </Seccion>
      )}
    </div>
  );
}

function SemanaFila({ s, irADia }: { s: SemanaDelMes; irADia: (d: number) => void }) {
  const { config, estado } = useCasa();
  const domingo = Math.min(s.lunes + 6, diaLocal(estado.ahora));
  return (
    <>
      <button type="button" className="sem item-boton" style={{ padding: 0 }} onClick={() => irADia(domingo)}>
        {rangoSemana(s.semana)}
        {s.racha === 'ok' && <span aria-label="racha"> 🔥</span>}
      </button>
      {config.miembros.map((m) => {
        const p = s.personas.find((x) => x.miembro === m.id);
        return (
          <span key={m.id} className="celda-zona">
            {p ? (
              <button type="button" className="item-boton" style={{ padding: 0, width: 'auto' }} onClick={() => irADia(p.hechoDia ?? domingo)} aria-label={`${m.nombre}: ${p.zona}`}>
                <ChapaComo como={p.como} nota={p.nota} />
              </button>
            ) : <span className="tenue">—</span>}
          </span>
        );
      })}
      <span className="fila" style={{ justifyContent: 'center', gap: 2 }}>
        {s.basura ? (
          <>
            <Avatar id={s.basura.miembro} tam="s" />
            {s.basura.quejas > 0 && <span className="chapa mal" style={{ padding: '1px 6px' }} aria-label={`${s.basura.quejas} quejas`}>{s.basura.quejas}</span>}
          </>
        ) : <span className="tenue">—</span>}
      </span>
    </>
  );
}
