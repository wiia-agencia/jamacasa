import { Bell, BellOff, CheckCircle2, Clock3, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { euros } from '../core/cuentas';
import { atrasadas, avisosBasuraAbiertos, basuraTocaba, paraPuntuar, puntosDelMes, tareaDe, tuyosAbiertos } from '../core/estado';
import type { Intento, Tarea } from '../core/limpieza';
import { nota } from '../core/noticias';
import { cuando, duracion, fechaCorta, finSemana, haceRato, lunesDe, nombreMes, rangoSemana } from '../core/tiempo';
import { leer, guardar } from '../datos/guardado';
import { miembro, useCasa } from './contexto';
import { ChapaEstado } from './Limpieza';
import { PortadaHoy } from './PortadaHoy';
import { Avatar, FotoRef, Nombre, Placa, Puntos, Seccion } from './piezas';

export function Hoy() {
  return (
    <div className="pila">
      <div>
        <PortadaHoy />
        <div className="margen pila-s">
          <TuPiso />
          <Cifras />
        </div>
      </div>
      <div className="margen pila">
        <ActivarAvisos />
        <Atrasadas />
        <Atajos />
        <AvisosParaMi />
        <PorPuntuar />
        <RankingMini />
        <LoUltimo />
      </div>
    </div>
  );
}

/** Para que los avisos lleguen aunque la app esté cerrada: se piden con un toque (el móvil pregunta). */
function ActivarAvisos() {
  const { avisos, activarAvisos } = useCasa();
  const [luego, setLuego] = useState(() => leer('jamacasa-avisos-luego') === avisos);
  const [pidiendo, setPidiendo] = useState(false);
  if ((avisos !== 'apagados' && avisos !== 'bloqueados') || luego) return null;
  const ahoraNo = () => { guardar('jamacasa-avisos-luego', avisos); setLuego(true); };
  if (avisos === 'bloqueados') {
    return (
      <section className="caja aviso-avisos pila-s" aria-label="Avisos al móvil">
        <div className="fila" style={{ alignItems: 'flex-start' }}>
          <span className="icono-redondo" aria-hidden="true"><BellOff size={20} /></span>
          <div className="crece pila-s" style={{ gap: 4 }}>
            <p className="negrita">Los avisos están bloqueados</p>
            <p className="peq suave">Actívalos en los ajustes del móvil: Aplicaciones → La Jamacasa → Notificaciones.</p>
          </div>
        </div>
        <button type="button" className="boton claro mini" style={{ alignSelf: 'flex-end' }} onClick={ahoraNo}>Entendido</button>
      </section>
    );
  }
  return (
    <section className="caja aviso-avisos pila-s" aria-label="Avisos al móvil">
      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <span className="icono-redondo" aria-hidden="true"><Bell size={20} /></span>
        <div className="crece pila-s" style={{ gap: 4 }}>
          <p className="negrita">Activa los avisos</p>
          <p className="peq suave">Para enterarte de la basura, las notas y lo que te toque, aunque tengas la app cerrada.</p>
        </div>
      </div>
      <div className="fila" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="boton claro mini" onClick={ahoraNo}>Ahora no</button>
        <button
          type="button"
          className="boton mini"
          disabled={pidiendo}
          onClick={async () => {
            setPidiendo(true);
            await activarAvisos();
            setPidiendo(false);
          }}
        >
          Activar
        </button>
      </div>
    </section>
  );
}

function TuPiso() {
  const { estado, yo, abrir, ir } = useCasa();
  if (!estado.empezado) {
    return (
      <section className="tarjeta tu-piso pila-s">
        <p className="suave peq">La Jamacasa arranca el lunes {fechaCorta(lunesDe(estado.semanaInicio))}</p>
        <h2 className="display zona">Primer sorteo ese día</h2>
        <p className="suave peq">Ese lunes se reparten los pisos y sale el primero de la bolsa de la basura.</p>
      </section>
    );
  }
  const t = tareaDe(estado, estado.semana, yo);
  if (!t) return null;
  // Cómo va la casa esta semana: pisos ya hechos (aprobados o esperando nota)
  const deLaSemana = estado.tareas.filter((x) => x.semana === estado.semana);
  const hechos = deLaSemana.filter((x) => x.estado === 'aprobada' || x.estado === 'esperando').length;
  return (
    <section className="tarjeta tu-piso pila-s" aria-label="Tu piso esta semana">
      <div className="fila entre">
        <p className="suave peq">Esta semana te toca</p>
        <ChapaEstado t={t} />
      </div>
      <div className="fila entre">
        <h2 className="display zona">{t.zona.nombre}</h2>
        <button type="button" className="icono-boton" aria-label={`Qué entra en el ${t.zona.nombre.toLowerCase()}`} onClick={() => abrir({ tipo: 'zona', zona: t.zona })}>
          <Info size={19} />
        </button>
      </div>
      <p className="suave peq" style={{ marginTop: -6 }}>{t.zona.incluye}</p>
      <EstadoTarea t={t} />
      {deLaSemana.length > 0 && (
        <div className="progreso-casa">
          <div className="barra" aria-hidden="true"><span style={{ width: `${Math.round((hechos / deLaSemana.length) * 100)}%` }} /></div>
          <span className="peq negrita">{hechos} de {deLaSemana.length} pisos hechos</span>
          <button type="button" className="enlace peq" onClick={() => ir('limpieza')}>Ver la casa</button>
        </div>
      )}
    </section>
  );
}

/** Tus puntos del mes y cómo están tus cuentas, de un vistazo. */
function Cifras() {
  const { estado, config, yo, ir } = useCasa();
  if (!estado.empezado) return null;
  const puntos = puntosDelMes(estado, yo);
  const puesto = 1 + config.miembros.filter((m) => puntosDelMes(estado, m.id) > puntos).length;
  const saldo = estado.cuentas.saldo[yo] ?? 0;
  const debo = estado.cuentas.transferencias.filter((x) => x.de === yo);
  const meDeben = estado.cuentas.transferencias.filter((x) => x.a === yo);
  const eur = (c: number) => euros(Math.abs(c)).replace(',00 €', ' €');
  const nombre = (id: string) => miembro(config, id).nombre;
  let cuentas = 'Todo saldado';
  if (saldo < 0) cuentas = debo.length === 1 ? `Debes a ${nombre(debo[0].a)}` : 'Debes';
  if (saldo > 0) cuentas = meDeben.length === 1 ? `Te debe ${nombre(meDeben[0].de)}` : 'Te deben';
  return (
    <div className="cifras">
      <button type="button" className="cifra-tarjeta" onClick={() => ir('juego')}>
        <span className="etiqueta-cifra">Tus puntos</span>
        <span className="cifra">{nota(puntos)}</span>
        <span className="peq suave">{puesto}.º en {nombreMes(estado.mes)}</span>
      </button>
      <button type="button" className="cifra-tarjeta" onClick={() => ir('cuentas')}>
        <span className="etiqueta-cifra">Cuentas</span>
        <span className={`cifra ${saldo < 0 ? 'mal' : ''}`}>{saldo === 0 ? '0 €' : `${saldo < 0 ? '−' : '+'}${eur(saldo)}`}</span>
        <span className="peq suave">{cuentas}</span>
      </button>
    </div>
  );
}

export function EstadoTarea({ t, compacto = false }: { t: Tarea; compacto?: boolean }) {
  const { estado, abrir, yo } = useCasa();
  const i = t.intentos[t.intentos.length - 1];
  // tu piso o el de otro del que te encargas tú («Lo limpio yo»)
  const mia = t.miembro === yo || t.cubre === yo;
  const ahora = estado.ahora;
  const fin = finSemana(t.semana);

  if (t.estado === 'pendiente') {
    const tarde = ahora > fin;
    return (
      <div className="pila-s">
        {tarde ? (
          <p className="estado-linea mal">
            <TriangleAlert size={17} /> Vas tarde: {t.retrasoDias} {t.retrasoDias === 1 ? 'día' : 'días'}, <Puntos valor={t.retrasoDias * estado.normas.puntosRetrasoDia} /> por ahora
          </p>
        ) : (
          <p className="estado-linea">
            <Clock3 size={17} /> Hasta el domingo a las 23:59. Quedan {duracion(fin - ahora)}.
          </p>
        )}
        {mia && (
          <button type="button" className="boton ancho" onClick={() => abrir({ tipo: 'hecho', tarea: t })}>
            Marcar como hecho
          </button>
        )}
      </div>
    );
  }

  if (t.estado === 'esperando') {
    return (
      <div className="pila-s">
        <p className="estado-linea">
          <CheckCircle2 size={17} /> {i.n > 1 ? 'Repasado' : 'Hecho'} {cuando(i.hecho.ts, ahora)}. Esperando nota.
        </p>
        <Jueces t={t} i={i} />
        {!compacto && <p className="tenue peq">Se cierra en {duracion(i.fin - ahora)}. Si nadie puntúa, se aprueba con un {estado.normas.notaAutomatica}.</p>}
      </div>
    );
  }

  if (t.estado === 'aprobada') {
    return (
      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <div className="crece pila-s">
          <p className="estado-linea">
            <CheckCircle2 size={17} /> Aprobado{i.auto ? ' sin notas' : ''}. <Puntos valor={i.media!} /> puntos
          </p>
          {!i.auto && <Jueces t={t} i={i} />}
        </div>
        <Placa valor={i.media!} auto={i.auto} />
      </div>
    );
  }

  // suspendida
  const faltan = [...new Set(i.votos.flatMap((v) => v.faltan))];
  const comentarios = i.votos.filter((v) => v.comentario).map((v) => ({ autor: v.autor, texto: v.comentario! }));
  return (
    <div className="pila-s">
      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <div className="crece pila-s">
          <p className="estado-linea mal">
            <TriangleAlert size={17} /> Suspendido: hay que repasarlo
          </p>
          <Jueces t={t} i={i} />
        </div>
        <Placa valor={i.media!} suspensa />
      </div>
      {faltan.length > 0 && (
        <div className="opciones" aria-label="Lo que falta">
          {faltan.map((f) => (
            <span key={f} className="chapa mal">Falta: {f}</span>
          ))}
        </div>
      )}
      {comentarios.map((c) => (
        <p key={c.autor} className="peq suave">
          <strong><Nombre id={c.autor} />:</strong> {c.texto}
        </p>
      ))}
      {i.votos.some((v) => v.fotos.length) && (
        <div className="fotos">{i.votos.flatMap((v) => v.fotos).map((f) => <FotoRef key={f} ref_={f} />)}</div>
      )}
      {mia && (
        <button type="button" className="boton ancho" onClick={() => abrir({ tipo: 'hecho', tarea: t })}>
          Ya lo he repasado
        </button>
      )}
    </div>
  );
}

export function Jueces({ t, i }: { t: Tarea; i: Intento }) {
  const { config } = useCasa();
  // los que no lo limpiaron (si lo limpió otro, también el dueño)
  const jueces = config.miembros.filter((m) => i.jueces.includes(m.id));
  return (
    <div className="jueces">
      {jueces.map((j) => {
        const v = i.votos.find((x) => x.autor === j.id);
        return (
          <span key={j.id} className={`juez ${v ? '' : 'espera'}`}>
            <Avatar id={j.id} tam="s" />
            <span>{j.nombre}</span>
            <span className="cifra" aria-label={v ? `nota ${v.nota}` : 'sin nota todavía'}>{v ? v.nota : '…'}</span>
          </span>
        );
      })}
    </div>
  );
}

function Atrasadas() {
  const { estado, yo } = useCasa();
  const lista = atrasadas(estado, yo);
  if (!lista.length) return null;
  return (
    <Seccion titulo="Te queda de antes">
      <div className="pila-s">
        {lista.map((t) => (
          <div key={`${t.semana}`} className="caja" style={{ padding: 16 }}>
            <div className="pila-s">
              <p className="negrita">{t.zona.nombre} <span className="suave">({rangoSemana(t.semana)})</span></p>
              {t.sinHacer && <p className="peq mal">Pasó el miércoles: {estado.normas.puntosSinHacer} puntos. Sigue siendo tuyo hasta que se apruebe.</p>}
              <EstadoTarea t={t} compacto />
            </div>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

function Atajos() {
  const { estado, yo, abrir, acciones, avisar } = useCasa();
  if (!estado.empezado) {
    // Hasta el primer sorteo no hay nadie de basura ni cuenta nada: se dice, para que no parezcan botones de adorno
    return (
      <div className="atajos">
        <div className="atajo">
          <span className="emoji" aria-hidden="true">🗑️</span>
          <strong>La basura, desde el lunes</strong>
          <span className="peq">Ese día sale el primero de la bolsa. Cuando se llene, le avisas desde aquí.</span>
          <button type="button" className="boton mini" style={{ marginTop: 'auto' }} disabled>
            Desde el lunes
          </button>
        </div>
        <div className="atajo">
          <span className="emoji" aria-hidden="true">🧦</span>
          <strong>¿Algo tirado por ahí?</strong>
          <span className="peq">Desde el lunes, le haces una foto y avisas a su dueño.</span>
          <button type="button" className="boton mini" style={{ marginTop: 'auto' }} disabled>
            Desde el lunes
          </button>
        </div>
      </div>
    );
  }
  const resp = estado.basura;
  const tocaba = basuraTocaba(estado);
  // los avisos abiertos de quien la tiene (si te la has quedado tú, los tuyos)
  const aviso = resp ? avisosBasuraAbiertos(estado, resp)[0] : undefined;
  return (
    <div className="atajos">
      {resp === yo ? (
        <div className={`atajo ${aviso ? 'alerta' : ''}`}>
          <span className="emoji" aria-hidden="true">🗑️</span>
          <strong>{aviso ? 'La basura está llena' : 'Esta semana la basura es tuya'}</strong>
          <span className="peq">
            {aviso ? <>Avisó <Nombre id={aviso.pulsaciones[0].autor} />. Te quedan {duracion(aviso.limite - estado.ahora)}.</>
              : tocaba && tocaba !== yo ? <>Te la has quedado tú: le tocaba a <Nombre id={tocaba} />.</>
              : 'Sácala cada vez que se llene.'}
          </span>
          <button
            type="button"
            className="boton mini"
            style={{ marginTop: 'auto' }}
            onClick={async () => {
              await acciones.basuraSacada();
              avisar('Basura sacada. ¡Gracias!');
            }}
          >
            Ya la saqué
          </button>
        </div>
      ) : (
        <div className="atajo">
          <span className="emoji" aria-hidden="true">🗑️</span>
          <strong>La basura es de {resp ? <Nombre id={resp} /> : 'nadie aún'}</strong>
          <span className="peq">
            {aviso ? <>Aviso enviado {haceRato(aviso.desde, estado.ahora)}. Le quedan {duracion(aviso.limite - estado.ahora)}.</> : '¿Está llena? Avísale.'}
          </span>
          <button type="button" className="boton mini" style={{ marginTop: 'auto' }} disabled={!resp || Boolean(aviso)} onClick={() => abrir({ tipo: 'basura' })}>
            {aviso ? 'Aviso enviado' : 'Basura llena'}
          </button>
          {resp && (
            // si no está (o la sacas tú igualmente), te la quedas: desde ahora es tuya y sus puntos también
            <button
              type="button"
              className="enlace atajo-enlace"
              onClick={async () => {
                await acciones.quedarmeBasura(estado.semana);
                avisar('Te quedas la basura esta semana. Ya lo saben.');
              }}
            >
              Me la quedo yo
            </button>
          )}
        </div>
      )}
      <div className="atajo">
        <span className="emoji" aria-hidden="true">🧦</span>
        <strong>¿Algo tirado por ahí?</strong>
        <span className="peq">Hazle una foto y avisa a su dueño.</span>
        <button type="button" className="boton mini" style={{ marginTop: 'auto' }} onClick={() => abrir({ tipo: 'tuyo' })}>
          Esto es tuyo
        </button>
      </div>
    </div>
  );
}

function AvisosParaMi() {
  const { estado, yo, acciones, avisar } = useCasa();
  const lista = tuyosAbiertos(estado, yo);
  if (!lista.length) return null;
  return (
    <Seccion titulo="Te han pillado algo">
      <div className="pila-s">
        {lista.map((a) => (
          <div key={a.id} className="caja" style={{ padding: 14 }}>
            <div className="fila" style={{ alignItems: 'flex-start' }}>
              {a.fotos[0] && <FotoRef ref_={a.fotos[0]} />}
              <div className="crece pila-s" style={{ gap: 6 }}>
                <p className="negrita"><Nombre id={a.de} /> dice que esto es tuyo{a.que ? `: ${a.que}` : ''}</p>
                <p className="peq suave">Te quedan {duracion(a.limite - estado.ahora)} para recogerlo o {nota(Math.abs(estado.normas.puntosEstoEsTuyo))} punto menos.</p>
                <button
                  type="button"
                  className="boton mini"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={async () => {
                    await acciones.recogido(a.id);
                    avisar('Apuntado: ya está recogido.');
                  }}
                >
                  Ya lo recogí
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

function PorPuntuar() {
  const { estado, yo, abrir } = useCasa();
  const lista = paraPuntuar(estado, yo);
  if (!lista.length) return null;
  return (
    <Seccion titulo="Te toca puntuar">
      <div className="caja">
        <div className="lista">
          {lista.map(({ tarea, intento }) => (
            <div key={`${tarea.semana}-${tarea.miembro}`} className="item">
              <Avatar id={tarea.miembro} />
              <div className="crece">
                <p className="negrita"><Nombre id={tarea.miembro} />: {tarea.zona.nombre.toLowerCase()}</p>
                <p className="peq suave">Se cierra en {duracion(intento.fin - estado.ahora)}</p>
              </div>
              <button type="button" className="boton mini" onClick={() => abrir({ tipo: 'puntuar', tarea, intento })}>
                Puntuar
              </button>
            </div>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

function RankingMini() {
  const { estado, config, ir } = useCasa();
  const filas = config.miembros
    .map((m) => ({ id: m.id, puntos: puntosDelMes(estado, m.id) }))
    .sort((a, b) => b.puntos - a.puntos);
  const rey = estado.titulos[estado.mes]?.rey ?? [];
  return (
    <Seccion
      titulo={`Así va ${nombreMes(estado.mes)}`}
      extra={<button type="button" className="enlace" onClick={() => ir('juego')}>Ver el ranking</button>}
    >
      <div className="caja">
        <div className="lista">
          {filas.map((f) => (
            <div key={f.id} className="item">
              <Avatar id={f.id} corona={rey.includes(f.id)} />
              <p className="crece negrita"><Nombre id={f.id} /></p>
              <span className="cifra" style={{ fontSize: '1.7rem' }}>{nota(f.puntos)}</span>
            </div>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

function LoUltimo() {
  const { estado, abrirHistorial } = useCasa();
  const [todas, setTodas] = useState(false);
  const lista = estado.noticias.slice(0, todas ? 40 : 8);
  if (!lista.length) return null;
  return (
    <Seccion titulo="Lo último en la casa" extra={<button type="button" className="enlace" onClick={() => abrirHistorial()}>Historial</button>}>
      <div className="lista">
        {lista.map((n) => (
          <div key={n.id} className="item noticia">
            <Avatar id={n.quien} tam="s" />
            <div className="crece">
              {n.oficial && <p className="oficial-etiqueta">Comunicado oficial</p>}
              <p className="peq">{n.texto}</p>
              <p className="cuando">{cuando(n.ts, estado.ahora)}</p>
            </div>
          </div>
        ))}
      </div>
      {estado.noticias.length > 8 && (
        <button type="button" className="enlace" style={{ alignSelf: 'flex-start' }} onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </Seccion>
  );
}
