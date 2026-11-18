// Tareas extra (Javi, 18 de noviembre; lo pidió Josu): apuntar lo que has hecho de más (+1, +2 o +3, lo dices tú), los
// extras de la semana con «¿No vale?» para los otros (48 horas) y el máximo de 6 a la semana.
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { enPlazo, hastaLas, IDEAS_EXTRA, llevaSemana, minus, TAMANOS_EXTRA, valeAhora, type Extra } from '../core/extras';
import { pt } from '../core/noticias';
import { haceRato, semana } from '../core/tiempo';
import type { MiembroId } from '../core/tipos';
import { miembro, useCasa } from './contexto';
import { Avatar, BotonAccion, FotoRef, Hoja, Seccion, SelectorFotos } from './piezas';

/** Los otros, por su nombre: «Jose y Josu». */
function losOtros(nombres: string[]): string {
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0] ?? 'los demás';
}

/** Los puntitos de la semana: lo que llevas de los 6. */
function Llevas({ lleva, max }: { lleva: number; max: number }) {
  return (
    <span className="extra-llevas" aria-label={`Llevas ${lleva} de ${max} esta semana`}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < lleva ? 'lleno' : ''} />)}
    </span>
  );
}

/** «¿Qué has hecho de más?»: qué (de un toque o escrito), cuánto (+1, +2 o +3) y, si quieres, una foto. */
export function HojaExtra() {
  const { cerrar, acciones, avisar, estado, config, yo } = useCasa();
  const [que, setQue] = useState('');
  const [puntos, setPuntos] = useState(0);
  const [fotos, setFotos] = useState<string[]>([]);
  const max = estado.normas.puntosExtraSemana;
  const lleva = llevaSemana(estado.extras, yo, estado.semana);
  const queda = Math.max(0, max - lleva);
  const otros = losOtros(config.miembros.filter((m) => m.id !== yo).map((m) => m.nombre));
  const listo = que.trim() && puntos > 0;
  const suma = Math.min(puntos, queda);
  return (
    <Hoja
      titulo="Tarea extra"
      subtitulo={`Lo que has hecho de más en casa. Suma solo; ${otros} tienen ${estado.normas.horasExtra} horas para decir si no vale.`}
      onCerrar={cerrar}
      pie={
        <BotonAccion
          desactivado={!listo}
          hacer={async () => {
            await acciones.extra(que.trim(), puntos, fotos);
            cerrar();
            avisar(suma > 0 ? `Apuntado: ${pt(suma)}. ${otros} tienen ${estado.normas.horasExtra} h para decir si no vale.` : 'Apuntado. Esta semana ya no suma: llevas el máximo.');
          }}
        >
          {!que.trim() ? 'Di qué has hecho' : !puntos ? 'Elige cuánto es' : suma > 0 ? `Apuntar · ${pt(suma)}` : 'Apuntar (no suma)'}
        </BotonAccion>
      }
    >
      <div className="pila-s" style={{ gap: 20 }}>
        <div className="campo">
          <span className="etiqueta">¿Qué has hecho?</span>
          <div className="opciones">
            {IDEAS_EXTRA.map((c) => (
              <button key={c} type="button" className="opcion" aria-pressed={que === c} onClick={() => setQue(que === c ? '' : c)}>{c}</button>
            ))}
          </div>
          <input id="extra-que" className="entrada" aria-label="U otra cosa" value={IDEAS_EXTRA.includes(que) ? '' : que} onChange={(e) => setQue(e.target.value)} placeholder="U otra cosa: fregar la terraza…" />
        </div>
        <div className="campo">
          <span className="etiqueta">¿Cuánto es?</span>
          <div className="tamanos">
            {TAMANOS_EXTRA.map((t) => (
              <button key={t.puntos} type="button" className="tamano" aria-pressed={puntos === t.puntos} onClick={() => setPuntos(t.puntos)}>
                <span className="tamano-cifra">+{t.puntos}</span>
                <b>{t.nombre}</b>
                <span>{t.ejemplo}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span className="etiqueta">Una foto (si quieres)</span>
          <SelectorFotos fotos={fotos} cambiar={setFotos} max={2} texto="Hacer foto" />
        </div>
        <div className="extra-semana-nota">
          <Llevas lleva={lleva} max={max} />
          <span className="peq suave">
            {queda === 0
              ? `Ya llevas los ${max} de esta semana: se apunta, pero no suma.`
              : puntos > queda
                ? `Llevas ${lleva} de ${max} esta semana: solo sumará ${pt(queda)}.`
                : `Llevas ${lleva} de ${max} esta semana (es lo más que suman los extras).`}
          </span>
        </div>
      </div>
    </Hoja>
  );
}

const PORQUES = ['Era de su piso esta semana', 'No está hecho', 'Es muy poca cosa'];

/** «¿No vale?»: no vale nada o vale menos, y por qué (si quieres). Se lo dices a quien lo hizo. */
export function HojaNoVale({ extra }: { extra: Extra }) {
  const { cerrar, acciones, avisar, estado, config, yo } = useCasa();
  // el de ahora (si alguien ha dicho algo mientras estaba abierta)
  const x = estado.extras.find((y) => y.id === extra.id) ?? extra;
  const mia = x.noVale.find((p) => p.autor === yo);
  const [puntos, setPuntos] = useState<number>(mia?.puntos ?? 0);
  const [porque, setPorque] = useState(mia?.porque ?? '');
  const Q = miembro(config, x.quien).nombre;
  const plazo = enPlazo(x, estado.ahora);
  const opciones = [0, 1, 2].filter((p) => p < x.puntos);
  return (
    <Hoja
      titulo="¿No vale?"
      subtitulo={plazo ? `${Q} dice ${pt(x.puntos)} por ${minus(x.que)}. Puedes decirlo ${hastaLas(x.hasta, estado.ahora)}.` : 'Ya ha pasado el plazo para decirlo.'}
      onCerrar={cerrar}
      pie={
        plazo && (
          <div className="pila-s">
            <BotonAccion
              hacer={async () => {
                await acciones.extraNoVale(x.id, puntos, porque.trim() || undefined);
                cerrar();
                avisar(puntos === 0 ? `Dicho: no vale. Se lo decimos a ${Q}.` : `Dicho: vale ${pt(puntos)}. Se lo decimos a ${Q}.`);
              }}
            >
              Decírselo a {Q}
            </BotonAccion>
            {mia && (
              <BotonAccion clase="boton ancho claro" hacer={async () => { await acciones.extraRetirar(x.id); cerrar(); avisar('Retirado: vuelve a valer.'); }}>
                Sí vale: retiro mi pega
              </BotonAccion>
            )}
          </div>
        )
      }
    >
      <div className="pila-s" style={{ gap: 20 }}>
        {x.fotos.length > 0 && (
          <div className="fila" style={{ gap: 8 }}>
            {x.fotos.map((f) => <FotoRef key={f} ref_={f} />)}
          </div>
        )}
        <div className="campo">
          <span className="etiqueta">¿Qué le dices?</span>
          <div className="opciones">
            {opciones.map((p) => (
              <button key={p} type="button" className="opcion" aria-pressed={puntos === p} onClick={() => setPuntos(p)}>
                {p === 0 ? 'No vale nada' : `Vale ${pt(p)}`}
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span className="etiqueta">¿Por qué? (si quieres)</span>
          <div className="opciones">
            {PORQUES.map((c) => (
              <button key={c} type="button" className="opcion" aria-pressed={porque === c} onClick={() => setPorque(porque === c ? '' : c)}>{c}</button>
            ))}
          </div>
          <input className="entrada" aria-label="Otro porqué" value={PORQUES.includes(porque) ? '' : porque} onChange={(e) => setPorque(e.target.value)} placeholder="O cuéntaselo" />
        </div>
      </div>
    </Hoja>
  );
}

/** Lo que se ve de un extra: lo que se dijo, lo que suma y las pegas. */
function LineaExtra({ x }: { x: Extra }) {
  const { estado, config, yo, abrir, acciones, avisar } = useCasa();
  const n = (m: MiembroId) => (m === yo ? 'Tú' : miembro(config, m).nombre);
  const plazo = enPlazo(x, estado.ahora);
  const vale = valeAhora(x);
  const mia = x.noVale.find((p) => p.autor === yo);
  const pegas = x.noVale.map((p) => `${n(p.autor)}: ${p.puntos === 0 ? 'no vale' : `vale ${pt(p.puntos)}`}${p.porque ? ` («${p.porque}»)` : ''}`);
  const estadoTexto = x.anulado !== undefined
    ? 'Quitado'
    : pegas.length
      ? pegas.join(' · ')
      : plazo
        ? x.quien === yo
          ? `pueden decir que no vale ${hastaLas(x.hasta, estado.ahora)}`
          : `puedes decir que no vale ${hastaLas(x.hasta, estado.ahora)}`
        : 'Vale';
  return (
    <div className={`item extra-item ${x.anulado !== undefined || vale === 0 ? 'no-vale' : ''}`}>
      <Avatar id={x.quien} tam="s" />
      <span className="crece pila-s" style={{ gap: 2, minWidth: 0 }}>
        <span><b>{n(x.quien)}</b> · {minus(x.que)}</span>
        <span className="peq tenue">{haceRato(x.evento.ts, estado.ahora)} · {estadoTexto}{x.tope && x.cuenta < vale ? ` · suma ${pt(x.cuenta)} (máximo de la semana)` : ''}</span>
        {x.fotos.length > 0 && (
          <span className="fila" style={{ gap: 6, marginTop: 4 }}>
            {x.fotos.map((f) => <FotoRef key={f} ref_={f} />)}
          </span>
        )}
      </span>
      <span className="pila-s extra-derecha">
        <span className={`extra-puntos ${vale < x.puntos ? 'rebajado' : ''}`}>
          {vale < x.puntos && <s>{pt(x.puntos)}</s>}
          {pt(vale)}
        </span>
        {x.anulado === undefined && x.quien === yo && (
          <BotonAccion clase="enlace mini tenue" hacer={async () => { await acciones.extraQuitar(x.id); avisar('Quitado.'); }}>Quitar</BotonAccion>
        )}
        {plazo && x.quien !== yo && (
          <button type="button" className="boton mini claro" onClick={() => abrir({ tipo: 'no-vale', extra: x })}>{mia ? 'Cambiar' : '¿No vale?'}</button>
        )}
      </span>
    </div>
  );
}

/** En Ranking: los extras de esta semana (y los de antes que aún se pueden discutir), lo que llevas y «Tarea extra». */
export function ExtrasSemana() {
  const { estado, yo, abrir } = useCasa();
  const max = estado.normas.puntosExtraSemana;
  const lleva = llevaSemana(estado.extras, yo, estado.semana);
  const lista = estado.extras
    .filter((x) => (x.semana === estado.semana || enPlazo(x, estado.ahora)) && x.anulado === undefined)
    .sort((a, b) => b.evento.ts - a.evento.ts);
  return (
    <Seccion titulo="Extras de la semana">
      <div className="caja">
        <div className="extra-cabeza">
          <div className="crece pila-s" style={{ gap: 4 }}>
            <Llevas lleva={lleva} max={max} />
            <span className="peq suave">{lleva >= max ? `Ya llevas los ${max} de esta semana.` : `Llevas ${lleva} de ${max} esta semana.`}</span>
          </div>
          <button type="button" className="boton mini" onClick={() => abrir({ tipo: 'extra' })}>
            <Sparkles size={16} aria-hidden="true" /> Tarea extra
          </button>
        </div>
        <div className="lista">
          {lista.length === 0 && <p className="vacio">Nadie ha apuntado nada de más esta semana.</p>}
          {lista.map((x) => <LineaExtra key={x.id} x={x} />)}
        </div>
      </div>
    </Seccion>
  );
}

/** En Hoy y en Limpieza: el atajo para apuntar algo de más. */
export function AtajoExtra() {
  const { abrir, estado, yo } = useCasa();
  const lleva = llevaSemana(estado.extras, yo, semana(estado.ahora));
  const max = estado.normas.puntosExtraSemana;
  return (
    <button type="button" className="atajo-fuera atajo-extra" onClick={() => abrir({ tipo: 'extra' })}>
      <span aria-hidden="true">✨</span>
      <span className="crece">
        ¿Has hecho algo de más?
        {lleva > 0 && <small>Llevas {lleva} de {max} esta semana</small>}
      </span>
      <b>Tarea extra</b>
    </button>
  );
}
