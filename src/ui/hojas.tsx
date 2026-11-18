import { Plus, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { resumen, type Mensaje } from '../core/chat';
import { euros, leerImporte, repartir, type Gasto, type Transferencia } from '../core/cuentas';
import type { DefMedalla } from '../core/juego';
import type { Intento, Tarea } from '../core/limpieza';
import { nota } from '../core/noticias';
import { cuando, diaDeTexto, diaLocal, fechaCorta, nombreMes, rangoSemana, textoDeDia } from '../core/tiempo';
import type { MiembroId, Zona } from '../core/tipos';
import { claseColor, miembro, useCasa, type Hoja as TipoHoja } from './contexto';
import { HojaBasura, HojaSacada } from './Basura';
import { HojaFuera } from './Fuera';
import { HojaComprado, HojaFalta } from './Compras';
import { LoLimpioOtro, PonermeBasura, PonermePiso } from './Cuadro';
import { EstadoTarea, Jueces } from './Hoy';
import { Avatar, BotonAccion, FotoRef, Hoja, Nombre, Placa, SelectorFotos } from './piezas';

export function Hojas({ hoja }: { hoja: TipoHoja }) {
  switch (hoja.tipo) {
    case 'hecho': return <HojaHecho tarea={hoja.tarea} />;
    case 'cubrir': return <HojaCubrir tarea={hoja.tarea} />;
    case 'ponerme': return hoja.fila === 'basura' ? <PonermeBasura key={`b-${hoja.quien ?? ''}`} quien={hoja.quien} /> : <PonermePiso key={`${hoja.fila}-${hoja.quien ?? ''}`} de={hoja.fila} quien={hoja.quien} />;
    case 'puntuar': return <HojaPuntuar tarea={hoja.tarea} intento={hoja.intento} propia={hoja.propia} />;
    case 'basura': return <HojaBasura />;
    case 'sacada': return <HojaSacada quien={hoja.quien} />;
    case 'fuera': return <HojaFuera quien={hoja.quien} />;
    case 'falta': return <HojaFalta />;
    case 'comprado': return <HojaComprado falta={hoja.falta} />;
    case 'tuyo': return <HojaTuyo />;
    case 'gasto': return <HojaGasto />;
    case 'detalle-gasto': return <HojaDetalleGasto gasto={hoja.gasto} />;
    case 'saldar': return <HojaSaldar transferencia={hoja.transferencia} alquiler={hoja.alquiler} />;
    case 'zona': return <HojaZona zona={hoja.zona} />;
    case 'tarea': return <HojaTarea tarea={hoja.tarea} />;
    case 'medalla': return <HojaMedalla def={hoja.def} titulo={hoja.titulo} />;
    case 'ajustes': return <HojaAjustes />;
    case 'mensaje': return <HojaMensaje m={hoja.mensaje} />;
    default: return null;
  }
}

/** Del 0 al 10, en botones (los de menos del aprobado, en rojo). */
function SelectorNota({ valor, cambiar, minima }: { valor: number | null; cambiar: (v: number) => void; minima: number }) {
  return (
    <div className="notas" role="radiogroup" aria-label="Nota del 0 al 10">
      {Array.from({ length: 11 }, (_, k) => (
        <button key={k} type="button" role="radio" aria-checked={valor === k} aria-pressed={valor === k} className={`nota-boton ${k < minima ? 'baja' : ''}`} onClick={() => cambiar(k)}>
          {k}
        </button>
      ))}
    </div>
  );
}

const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Lo que falta, buscándolo (Javi, 17 de noviembre: «no tener que estar una a una todas las cosas de cada planta…
 *  pones no he limpiado y en el buscador buscas el horno»): lo escribes y lo tocas; lo que no está en la lista también
 *  se puede añadir. Debajo, lo que llevas y, si quieres, toda la lista para tocar ahí. */
function BuscaFalta({ lista, faltan, cambiar, pista = 'horno, microondas, el suelo…' }: { lista: string[]; faltan: string[]; cambiar: (f: string[]) => void; pista?: string }) {
  const [q, setQ] = useState('');
  const [entera, setEntera] = useState(false);
  const busca = sinTildes(q.trim());
  const sale = busca ? lista.filter((c) => !faltan.includes(c) && busca.split(/\s+/).every((p) => sinTildes(c).includes(p))).slice(0, 6) : [];
  // lo que no está en la lista (y no se parece a nada de ella) también se puede añadir
  const nueva = q.trim().length > 2 && !sale.length && !lista.some((c) => sinTildes(c).includes(busca)) && !faltan.some((c) => sinTildes(c) === busca) ? q.trim() : '';
  const poner = (c: string) => { cambiar([...faltan, c]); setQ(''); };
  return (
    <div className="busca-falta">
      <div className="busca-caja">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          className="entrada"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (sale[0] || nueva)) { e.preventDefault(); poner(sale[0] ?? nueva); } }}
          placeholder={`Busca: ${pista}`}
          aria-label="Busca lo que falta"
          enterKeyHint="done"
        />
      </div>
      {(sale.length > 0 || nueva) && (
        <div className="opciones busca-sale">
          {sale.map((c) => <button key={c} type="button" className="opcion" onClick={() => poner(c)}><Plus size={14} aria-hidden="true" />{c}</button>)}
          {nueva && <button type="button" className="opcion" onClick={() => poner(nueva)}><Plus size={14} aria-hidden="true" />Añadir «{nueva}»</button>}
        </div>
      )}
      {faltan.length > 0 && (
        <div className="opciones">
          {faltan.map((c) => (
            <button key={c} type="button" className="opcion falta" aria-pressed="true" aria-label={`Quitar: ${c}`} onClick={() => cambiar(faltan.filter((x) => x !== c))}>
              {c}<X size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {lista.length > 0 && (
        <button type="button" className="enlace busca-entera" aria-expanded={entera} onClick={() => setEntera(!entera)}>
          {entera ? 'Esconder la lista' : `Ver toda la lista (${lista.length})`}
        </button>
      )}
      {entera && (
        <div className="opciones">
          {lista.map((c) => (
            <button key={c} type="button" className="opcion falta" aria-pressed={faltan.includes(c)} onClick={() => cambiar(faltan.includes(c) ? faltan.filter((x) => x !== c) : [...faltan, c])}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const yJunto = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** Marcar tu piso como hecho, con tu nota (Javi, 16 de noviembre: «el propio que limpia el piso tenga que darse una
 *  propia puntuación… pues mira, esto no lo hice, chicos, o lo hago más tarde»). Solo se dice lo que falta (Javi, 17 de
 *  noviembre: «nadie quiere» ir marcando una a una): lo demás cuenta como hecho, y la nota sale sola (un 10, menos uno
 *  por cada cosa que falta) hasta que la cambies. Si los otros no dicen nada, se queda tu nota. */
function HojaHecho({ tarea }: { tarea: Tarea }) {
  const { cerrar, acciones, avisar, config, yo, estado } = useCasa();
  const vivo = estado.tareas.find((t) => t.semana === tarea.semana && t.miembro === tarea.miembro) ?? tarea;
  // si fuiste tachando la lista y te dejaste algo, se ofrece (no se da por hecho que falte)
  const sinTachar = vivo.marcadas.length > 0 ? vivo.lista.filter((c) => !vivo.marcadas.includes(c)) : [];
  const [faltan, setFaltan] = useState<string[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  const valor = elegida ?? Math.max(0, 10 - faltan.length);
  const [fotos, setFotos] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const repaso = vivo.estado === 'suspendida';
  // el piso de otro que limpias tú («Lo limpio yo»): se apunta a su nombre y la nota es para ti
  const deOtro = vivo.miembro !== yo ? vivo.miembro : undefined;
  const dueno = config.miembros.find((m) => m.id === vivo.miembro)?.nombre ?? '';
  // te ponen nota los que no lo han limpiado (ni te han echado una mano)
  const jueces = yJunto(config.miembros.filter((m) => m.id !== yo && !vivo.ayudan.includes(m.id)).map((m) => m.nombre));
  const piso = deOtro ? `${vivo.zona.nombre} de ${dueno}` : vivo.zona.nombre;
  const quedan = sinTachar.filter((c) => !faltan.includes(c));
  return (
    <Hoja
      titulo={repaso ? `Repaso del ${piso.charAt(0).toLowerCase()}${piso.slice(1)}` : `¿Has terminado el ${piso.charAt(0).toLowerCase()}${piso.slice(1)}?`}
      subtitulo="Solo dinos lo que te faltó: lo demás cuenta como hecho."
      onCerrar={cerrar}
      pie={
        <div className="pila-s">
          <BotonAccion
            hacer={async () => {
              await acciones.marcarHecho(vivo.semana, fotos, texto.trim() || undefined, deOtro, undefined, { nota: valor, faltan });
              cerrar();
              avisar(jueces ? `Marcado con un ${valor}. Si ${jueces} no dicen nada, se queda.` : `Marcado con un ${valor}.`);
            }}
          >
            {repaso ? 'Marcar como repasado' : faltan.length ? 'Hecho, menos eso' : 'Todo hecho'} · un {valor}
          </BotonAccion>
          {!repaso && (
            <button type="button" className="enlace" style={{ alignSelf: 'center' }} onClick={() => { cerrar(); avisar('Vale, sigue abierto: márcalo cuando acabes.'); }}>
              Aún no he terminado: solo he dado un repaso
            </button>
          )}
        </div>
      }
    >
      <div className="pila-s" style={{ gap: 22 }}>
        {vivo.lista.length > 0 && (
          <div className="campo">
            <span className="etiqueta">¿Te faltó algo?</span>
            <BuscaFalta lista={vivo.lista} faltan={faltan} cambiar={setFaltan} />
            {quedan.length > 0 && (
              <p className="peq suave">
                No tachaste {quedan.length === 1 ? '1 cosa' : `${quedan.length} cosas`} de la lista.{' '}
                <button type="button" className="enlace" onClick={() => setFaltan([...faltan, ...quedan])}>¿Te faltaron? Añádelas</button>
              </p>
            )}
          </div>
        )}
        <div className="campo">
          <span className="etiqueta">
            Tu nota{elegida === null ? (faltan.length ? `: un ${valor}, uno menos por cada cosa que falta. Cámbiala si quieres` : ': un 10. Cámbiala si quieres') : ''}
          </span>
          <SelectorNota valor={valor} cambiar={(v) => setElegida(v)} minima={estado.normas.notaMinima} />
          <p className="peq tenue">{jueces ? `${jueces} tienen ${estado.normas.horasRevision} horas para votar: si no dicen nada, se queda la tuya.` : 'Lo habéis limpiado entre todos: se queda la tuya.'}</p>
        </div>
        <div className="campo">
          <label htmlFor="nota-hecho">Cuéntales (si quieres)</label>
          <textarea id="nota-hecho" className="entrada" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Por ejemplo: el horno lo limpio el sábado" />
        </div>
        <div className="campo">
          <span className="etiqueta">Fotos de cómo ha quedado (si quieres)</span>
          <SelectorFotos fotos={fotos} cambiar={setFotos} />
        </div>
      </div>
    </Hoja>
  );
}

/** «Lo limpio yo»: te encargas del piso de otro esta semana. Lo que marques va a su piso y la nota es para ti. */
function HojaCubrir({ tarea }: { tarea: Tarea }) {
  const { cerrar, abrir, acciones, avisar, config, yo, estado } = useCasa();
  const vivo = estado.tareas.find((t) => t.semana === tarea.semana && t.miembro === tarea.miembro) ?? tarea;
  const dueno = config.miembros.find((m) => m.id === vivo.miembro)?.nombre ?? '';
  const otros = config.miembros.filter((m) => m.id !== yo).map((m) => m.nombre).join(' y ');
  const piso = vivo.zona.nombre.toLowerCase();
  return (
    <Hoja
      titulo={`¿Limpias tú el ${piso} de ${dueno}?`}
      subtitulo={`Si no está, lo haces tú: lo marcas como si fuera el tuyo, te ponen nota ${otros} y los puntos son para ti.`}
      onCerrar={cerrar}
      pie={
        <div className="pila-s">
          <BotonAccion
            hacer={async () => {
              await acciones.cubrir(vivo.semana, vivo.miembro);
              cerrar();
              avisar(`Te encargas del ${piso} de ${dueno}. Ya lo saben.`);
            }}
          >
            Lo limpio yo
          </BotonAccion>
          <BotonAccion
            clase="boton ancho claro"
            hacer={async () => {
              // ya lo ha limpiado: se encarga y lo marca hecho del tirón
              if (vivo.cubre !== yo) await acciones.cubrir(vivo.semana, vivo.miembro);
              abrir({ tipo: 'hecho', tarea: vivo });
            }}
          >
            Ya lo he limpiado
          </BotonAccion>
        </div>
      }
    >
      <ul className="pila-s peq" style={{ margin: 0, paddingLeft: 18 }}>
        <li>El piso sigue siendo de {dueno}: si al final no lo hace nadie, el retraso es suyo.</li>
        <li>Lo que marques de la lista va a su piso y la casa se limpia igual.</li>
        <li>Ganas su nota y la medalla Salvavidas 🛟.</li>
      </ul>
    </Hoja>
  );
}

/** Ponerle nota al piso de otro o, con `propia`, cambiarte la tuya («ya lo fregué»). Arriba, la nota que se puso él:
 *  si te parece bien, no hace falta votar (se queda la suya); para bajarle de ahí hay que decir el fallo (Javi, 16 de
 *  noviembre: «si no quieren que te lleves la puntuación máxima, pues tienen que buscar fallos en tu piso»). */
function HojaPuntuar({ tarea, intento, propia = false }: { tarea: Tarea; intento: Intento; propia?: boolean }) {
  const { cerrar, acciones, avisar, estado, config } = useCasa();
  const ya = propia ? intento.propia : undefined; // tu nota de antes
  const [valor, setValor] = useState<number | null>(ya?.nota ?? null);
  const [faltan, setFaltan] = useState<string[]>(ya?.faltan ?? []);
  const [fotos, setFotos] = useState<string[]>([]);
  const [comentario, setComentario] = useState(ya?.comentario ?? '');
  const [error, setError] = useState('');
  // se puntúa a quien lo limpió (si tu piso lo limpió otro, a él)
  const quien = config.miembros.find((m) => m.id === intento.quien)!.nombre;
  const minima = estado.normas.notaMinima;
  const suya = intento.propia?.nota ?? estado.normas.notaAutomatica; // la que se queda si no dices nada
  const fotosHecho: string[] = intento.hecho.datos?.fotos ?? [];
  const notaHecho: string | undefined = intento.hecho.datos?.nota;
  const lista = tarea.lista.length ? tarea.lista : tarea.zona.checklist;

  const enviar = async () => {
    if (valor === null) { setError('Elige una nota del 0 al 10.'); return; }
    if (!propia) {
      if (valor < minima && faltan.length === 0 && fotos.length === 0) {
        setError(`Para poner menos de un ${minima}, marca qué falta o sube una foto.`);
        return;
      }
      if (valor < suya && faltan.length === 0 && fotos.length === 0 && !comentario.trim()) {
        setError(`Para ponerle menos de ${intento.propia ? 'lo que se puso' : 'un 10'} (un ${nota(suya)}), di qué falla: márcalo, sube una foto o cuéntalo.`);
        return;
      }
    }
    await acciones.puntuar(tarea, intento, valor, faltan, fotos, comentario.trim() || undefined, propia);
    cerrar();
    avisar(propia ? `Tu nota: un ${valor}. Ya lo saben.` : `Nota enviada: un ${valor} para ${quien}.`);
  };

  return (
    <Hoja
      titulo={propia ? 'Tu nota' : `Puntuar a ${quien}`}
      subtitulo={propia ? `${tarea.zona.nombre}. Si los otros no dicen nada, se queda esta.` : `${tarea.zona.nombre}, ${intento.n > 1 ? 'repasado' : 'hecho'} ${cuando(intento.hecho.ts, estado.ahora)}.`}
      onCerrar={cerrar}
      pie={<BotonAccion hacer={enviar} desactivado={valor === null}>{propia ? 'Cambiar mi nota' : 'Enviar nota'}{valor !== null ? `: ${valor}` : ''}</BotonAccion>}
    >
      <div className="pila-s" style={{ gap: 22 }}>
        {!propia && (
          <div className="nota-propia">
            <Placa valor={suya} peq />
            <div className="crece">
              <b>{intento.propia ? `${quien} se pone un ${nota(intento.propia.nota)}` : `${quien} no se ha puesto nota`}</b>
              {intento.propia && intento.propia.faltan.length > 0 && <span>Dice que le faltó: {intento.propia.faltan.map((f) => f.toLowerCase()).join(' · ')}</span>}
              {(intento.propia?.comentario ?? notaHecho) && <span className="suave">«{intento.propia?.comentario ?? notaHecho}»</span>}
              <span className="tenue">Si te parece bien, no hace falta que votes: se queda {intento.propia ? 'su nota' : 'con un 10'}.</span>
            </div>
          </div>
        )}
        {fotosHecho.length > 0 && <div className="fotos">{fotosHecho.map((f) => <FotoRef key={f} ref_={f} />)}</div>}
        <div className="campo">
          <span className="etiqueta">{propia ? 'Tu nota: ¿cómo te ha quedado?' : 'Tu nota'}</span>
          <SelectorNota valor={valor} cambiar={(v) => { setValor(v); setError(''); }} minima={minima} />
        </div>
        {lista.length > 0 && (
          <div className="campo">
            <span className="etiqueta">{propia ? '¿Te faltó algo?' : '¿Falta algo? Búscalo y tócalo'}</span>
            <BuscaFalta lista={lista} faltan={faltan} cambiar={(f) => { setFaltan(f); setError(''); }} />
          </div>
        )}
        {!propia && (
          <div className="campo">
            <span className="etiqueta">Foto de lo que has visto {valor !== null && valor < suya ? '' : '(si quieres)'}</span>
            <SelectorFotos fotos={fotos} cambiar={(f) => { setFotos(f); setError(''); }} max={3} />
          </div>
        )}
        <div className="campo">
          <label htmlFor="comentario">{propia ? 'Cuéntales (si quieres)' : 'Comentario (si quieres)'}</label>
          <textarea id="comentario" className="entrada" value={comentario} onChange={(e) => { setComentario(e.target.value); setError(''); }} placeholder={propia ? 'Ya fregué el suelo' : 'Te dejaste el espejo del baño'} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Hoja>
  );
}

function HojaTuyo() {
  const { cerrar, acciones, avisar, estado, config, yo } = useCasa();
  const [fotos, setFotos] = useState<string[]>([]);
  const [para, setPara] = useState<MiembroId | null>(null);
  const [que, setQue] = useState('');
  const otros = config.miembros.filter((m) => m.id !== yo);
  const nombre = otros.find((m) => m.id === para)?.nombre;
  return (
    <Hoja
      titulo="Esto es tuyo"
      subtitulo={`Haz una foto de lo que está tirado y elige de quién es. Tiene ${estado.normas.horasEstoEsTuyo} horas para recogerlo.`}
      onCerrar={cerrar}
      pie={
        <BotonAccion
          desactivado={!para || fotos.length === 0}
          hacer={async () => {
            await acciones.estoEsTuyo(para!, fotos, que.trim() || undefined);
            cerrar();
            avisar(`Aviso enviado a ${nombre}.`);
          }}
        >
          {para ? `Avisar a ${nombre}` : 'Enviar aviso'}
        </BotonAccion>
      }
    >
      <div className="pila-s" style={{ gap: 20 }}>
        <div className="campo">
          <span className="etiqueta">La foto</span>
          <SelectorFotos fotos={fotos} cambiar={setFotos} max={2} texto="Hacer foto" />
        </div>
        <div className="campo">
          <span className="etiqueta">¿De quién es?</span>
          <div className="personas" style={{ gridTemplateColumns: `repeat(${otros.length}, 1fr)` }}>
            {otros.map((m) => (
              <button key={m.id} type="button" className="persona" aria-pressed={para === m.id} onClick={() => setPara(m.id)}>
                <Avatar id={m.id} />
                {m.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <label htmlFor="que">¿Qué es? (si quieres)</label>
          <input id="que" className="entrada" value={que} onChange={(e) => setQue(e.target.value)} placeholder="Las pesas en el jardín" />
        </div>
      </div>
    </Hoja>
  );
}

function HojaGasto() {
  const { cerrar, acciones, avisar, config, yo, estado } = useCasa();
  const ids = config.miembros.map((m) => m.id);
  const [categoria, setCategoria] = useState('compra');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [pagador, setPagador] = useState<MiembroId>(yo);
  const [participantes, setParticipantes] = useState<MiembroId[]>(ids);
  const [fecha, setFecha] = useState(textoDeDia(diaLocal(estado.ahora)));
  const [fotos, setFotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const cent = leerImporte(importe);
  const reparto = useMemo(() => (cent ? repartir(cent, participantes, pagador, ids) : {}), [cent, participantes, pagador]);

  const categorias = [{ id: 'compra', nombre: 'Súper de casa', paga: null as MiembroId | null }, ...config.facturas, { id: 'otro', nombre: 'Otro', paga: null }];
  const elegir = (c: (typeof categorias)[number]) => {
    setCategoria(c.id);
    setConcepto(c.id === 'otro' || c.id === 'compra' ? '' : c.nombre);
    if (c.paga) setPagador(c.paga);
  };
  const guardar = async () => {
    if (!concepto.trim()) { setError('Escribe qué es el gasto.'); return; }
    if (!cent) { setError('Escribe el importe, por ejemplo 36,80.'); return; }
    if (!participantes.length) { setError('Elige entre quién se reparte.'); return; }
    await acciones.gasto({ concepto: concepto.trim(), categoria, importe: cent, pagador, participantes, fecha, fotos });
    cerrar();
    avisar(`Gasto guardado: ${concepto.trim()}, ${euros(cent)}.`);
  };

  return (
    <Hoja titulo="Apuntar un gasto" onCerrar={cerrar} pie={<BotonAccion hacer={guardar}>Guardar gasto</BotonAccion>}>
      <div className="pila-s" style={{ gap: 20 }}>
        <div className="opciones" aria-label="Qué es">
          {categorias.map((c) => (
            <button key={c.id} type="button" className="opcion" aria-pressed={categoria === c.id} onClick={() => elegir(c)}>
              {c.nombre}
            </button>
          ))}
        </div>
        <div className="campo">
          <label htmlFor="concepto">Concepto</label>
          <input id="concepto" className="entrada" value={concepto} onChange={(e) => { setConcepto(e.target.value); setError(''); }} placeholder="Aceite, papel de cocina…" />
        </div>
        <div className="campo">
          <label htmlFor="importe">Importe</label>
          <input id="importe" className="entrada importe" inputMode="decimal" autoComplete="off" value={importe} onChange={(e) => { setImporte(e.target.value); setError(''); }} placeholder="0,00 €" />
        </div>
        <div className="campo">
          <span className="etiqueta">Lo pagó</span>
          <div className="personas">
            {config.miembros.map((m) => (
              <button key={m.id} type="button" className="persona" aria-pressed={pagador === m.id} onClick={() => setPagador(m.id)}>
                <Avatar id={m.id} />
                {m.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span className="etiqueta">Se reparte a partes iguales entre</span>
          <div className="opciones">
            {config.miembros.map((m) => (
              <button
                key={m.id}
                type="button"
                className="opcion"
                aria-pressed={participantes.includes(m.id)}
                onClick={() => setParticipantes(participantes.includes(m.id) ? participantes.filter((x) => x !== m.id) : ids.filter((x) => x === m.id || participantes.includes(x)))}
              >
                <span className={`avatar punto ${claseColor(m.color)}`} />
                {m.nombre}
              </button>
            ))}
          </div>
          {cent && participantes.length > 0 && (
            <p className="peq suave">
              {participantes.map((p) => `${config.miembros.find((m) => m.id === p)!.nombre}: ${euros(reparto[p] ?? 0)}`).join('. ')}.
            </p>
          )}
        </div>
        <div className="campo">
          <label htmlFor="fecha">Fecha</label>
          <input id="fecha" type="date" className="entrada" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="campo">
          <span className="etiqueta">Foto del ticket (si quieres)</span>
          <SelectorFotos fotos={fotos} cambiar={setFotos} max={2} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Hoja>
  );
}

function HojaDetalleGasto({ gasto }: { gasto: Gasto }) {
  const { cerrar, acciones, avisar, yo, config } = useCasa();
  const [confirmar, setConfirmar] = useState(false);
  const puedeAnular = !gasto.alquiler && !gasto.anulado && (gasto.evento?.autor === yo || gasto.pagador === yo);
  return (
    <Hoja
      titulo={gasto.concepto}
      subtitulo={`Pagó ${config.miembros.find((m) => m.id === gasto.pagador)?.nombre} el ${fechaCorta(diaDeTexto(gasto.fecha))}.${gasto.anulado ? ' Anulado.' : ''}`}
      onCerrar={cerrar}
      pie={
        puedeAnular ? (
          confirmar ? (
            <div className="pila-s">
              <p className="peq suave">Se quita de las cuentas de los tres. Queda en el historial como anulado.</p>
              <div className="fila">
                <button type="button" className="boton claro" style={{ flex: 1 }} onClick={() => setConfirmar(false)}>Mejor no</button>
                <BotonAccion clase="boton peligro" hacer={async () => { await acciones.anularGasto(gasto.id); cerrar(); avisar('Gasto anulado.'); }}>
                  Sí, anular
                </BotonAccion>
              </div>
            </div>
          ) : (
            <button type="button" className="boton borde ancho" onClick={() => setConfirmar(true)}>Anular gasto</button>
          )
        ) : undefined
      }
    >
      <div className="pila-s" style={{ gap: 18 }}>
        <span className="cifra" style={{ fontSize: '3rem' }}>{euros(gasto.importe)}</span>
        <div className="caja">
          <div className="lista">
            {Object.entries(gasto.partes).map(([m, v]) => (
              <div key={m} className="item">
                <Avatar id={m} tam="s" />
                <span className="crece"><Nombre id={m} />{m === gasto.pagador ? ' (pagó)' : ''}</span>
                <span className="negrita">{euros(v)}</span>
              </div>
            ))}
          </div>
        </div>
        {gasto.alquiler && <p className="peq suave">El alquiler se apunta solo cada mes. Cada uno marca en Cuentas cuándo le ha pagado su parte a <Nombre id={gasto.pagador} />.</p>}
        {gasto.fotos.length > 0 && <div className="fotos">{gasto.fotos.map((f) => <FotoRef key={f} ref_={f} />)}</div>}
        {/* lo que se apuntó como «Otro» y era del súper de casa (los aceites del 16 de noviembre): se anula y se vuelve a
            apuntar como súper (de turno, no deuda), con lo mismo */}
        {puedeAnular && gasto.categoria === 'otro' && gasto.evento && (
          <BotonAccion
            clase="boton claro ancho"
            hacer={async () => {
              const d = gasto.evento!.datos;
              await acciones.anularGasto(gasto.id);
              await acciones.gasto({ concepto: gasto.concepto, categoria: 'compra', importe: gasto.importe, pagador: gasto.pagador, participantes: d.participantes ?? config.miembros.map((m) => m.id), fecha: gasto.fecha, fotos: gasto.fotos });
              cerrar();
              avisar('Pasado al súper de casa: ya no es deuda, cuenta en el marcador.');
            }}
          >
            Es del súper de casa
          </BotonAccion>
        )}
      </div>
    </Hoja>
  );
}

function HojaSaldar({ transferencia, alquiler }: { transferencia?: Transferencia; alquiler?: string }) {
  const { cerrar, acciones, avisar, config, yo } = useCasa();
  const otros = config.miembros.filter((m) => m.id !== yo);
  const [a, setA] = useState<MiembroId>(transferencia?.a ?? otros[0].id);
  const [importe, setImporte] = useState(transferencia ? (transferencia.importe / 100).toFixed(2).replace('.', ',') : '');
  const [conAlquiler, setConAlquiler] = useState(Boolean(alquiler));
  const [error, setError] = useState('');
  const cent = leerImporte(importe);
  const nombre = config.miembros.find((m) => m.id === a)?.nombre;
  return (
    <Hoja
      titulo="Apuntar un pago"
      subtitulo="Apúntalo cuando hayas hecho el Bizum o le hayas dado el dinero."
      onCerrar={cerrar}
      pie={
        <BotonAccion
          hacer={async () => {
            if (!cent) { setError('Escribe el importe que le has pagado.'); return; }
            await acciones.pago(yo, a, cent, conAlquiler ? alquiler : undefined);
            cerrar();
            avisar(`Pago apuntado: ${euros(cent)} a ${nombre}.`);
          }}
        >
          Apuntar pago a {nombre}
        </BotonAccion>
      }
    >
      <div className="pila-s" style={{ gap: 20 }}>
        <div className="campo">
          <span className="etiqueta">Le has pagado a</span>
          <div className="personas" style={{ gridTemplateColumns: `repeat(${otros.length}, 1fr)` }}>
            {otros.map((m) => (
              <button key={m.id} type="button" className="persona" aria-pressed={a === m.id} onClick={() => setA(m.id)}>
                <Avatar id={m.id} />
                {m.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <label htmlFor="importe-pago">Importe</label>
          <input id="importe-pago" className="entrada importe" inputMode="decimal" value={importe} onChange={(e) => { setImporte(e.target.value); setError(''); }} />
        </div>
        {alquiler && a === config.alquiler.paga && (
          <button type="button" className="opcion" aria-pressed={conAlquiler} onClick={() => setConAlquiler(!conAlquiler)} style={{ alignSelf: 'flex-start' }}>
            {conAlquiler ? '✓ ' : ''}Incluye mi alquiler de {nombreMes(alquiler)}
          </button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Hoja>
  );
}

function HojaZona({ zona }: { zona: Zona }) {
  const { cerrar } = useCasa();
  return (
    <Hoja titulo={zona.nombre} subtitulo={zona.incluye} onCerrar={cerrar}>
      <div className="pila-s">
        <span className="etiqueta">Qué tiene que estar limpio</span>
        <div className="caja">
          <div className="lista">
            {zona.checklist.map((c) => (
              <div key={c} className="item"><span className="crece">{c}</span></div>
            ))}
          </div>
        </div>
        <p className="tenue mini">Es un borrador: repasadlo entre los tres y se ajusta. Al puntuar, lo que falta se marca de esta lista.</p>
      </div>
    </Hoja>
  );
}

function HojaTarea({ tarea }: { tarea: Tarea }) {
  const { cerrar, abrir, yo, estado, config } = useCasa();
  const vivo = estado.tareas.find((t) => t.semana === tarea.semana && t.miembro === tarea.miembro) ?? tarea;
  const i = vivo.intentos[vivo.intentos.length - 1];
  const puedoPuntuar = i && !i.resuelto && i.sinVotar.includes(yo);
  const nombre = (m: MiembroId) => config.miembros.find((x) => x.id === m)?.nombre ?? '';
  const quien = nombre(vivo.miembro);
  // el de otro, sin hacer y sin nadie que se encargue: «Lo limpio yo» (solo esta semana o la pasada)
  const puedoCubrir = vivo.miembro !== yo && vivo.cubre === undefined && (vivo.estado === 'pendiente' || vivo.estado === 'suspendida') && vivo.semana >= estado.semana - 1;
  const lleva = vivo.cubre !== undefined && (vivo.estado === 'pendiente' || vivo.estado === 'suspendida') ? (vivo.cubre === yo ? 'Te encargas tú' : `Se encarga ${nombre(vivo.cubre)}`) : i && i.quien !== vivo.miembro ? (i.quien === yo ? 'Lo limpiaste tú' : `Lo limpió ${nombre(i.quien)}`) : '';
  return (
    <Hoja titulo={`${quien}: ${vivo.zona.nombre.toLowerCase()}`} subtitulo={`Semana ${rangoSemana(vivo.semana, true)}${lleva ? ` · ${lleva}` : ''}`} onCerrar={cerrar}
      pie={
        puedoPuntuar ? <button type="button" className="boton ancho" onClick={() => abrir({ tipo: 'puntuar', tarea: vivo, intento: i })}>Puntuar a {nombre(i.quien)}</button>
        : puedoCubrir ? <button type="button" className="boton ancho claro" onClick={() => abrir({ tipo: 'cubrir', tarea: vivo })}>Lo limpio yo</button>
        : undefined
      }
    >
      <div className="pila-s" style={{ gap: 18 }}>
        <EstadoTarea t={vivo} />
        {i && vivo.semana >= estado.semana - 1 && <LoLimpioOtro t={vivo} />}
        {vivo.retrasoDias > 0 && vivo.primerHecho && <p className="peq mal">Se marcó con {vivo.retrasoDias} {vivo.retrasoDias === 1 ? 'día' : 'días'} de retraso.</p>}
        {i?.hecho.datos?.fotos?.length > 0 && <div className="fotos">{i.hecho.datos.fotos.map((f: string) => <FotoRef key={f} ref_={f} />)}</div>}
        {i?.hecho.datos?.nota && <p className="peq suave">«{i.hecho.datos.nota}»</p>}
        {vivo.intentos.length > 1 && (
          <div className="pila-s">
            <span className="etiqueta">Intentos</span>
            {vivo.intentos.map((x) => (
              <div key={x.n} className="caja" style={{ padding: 12 }}>
                <p className="peq negrita">Intento {x.n}: {x.resuelto ? (x.aprobado ? `aprobado con un ${nota(x.media!)}` : `suspendido con un ${nota(x.media!)}`) : 'esperando nota'}</p>
                <div style={{ marginTop: 8 }}><Jueces t={vivo} i={x} /></div>
              </div>
            ))}
          </div>
        )}
        {i?.votos.filter((v) => v.comentario).map((v) => (
          <p key={v.evento} className="peq"><strong><Nombre id={v.autor} />:</strong> {v.comentario}</p>
        ))}
      </div>
    </Hoja>
  );
}

function HojaMedalla({ def, titulo }: { def: DefMedalla; titulo?: boolean }) {
  const { cerrar, estado, config } = useCasa();
  const meses = estado.meses.slice().reverse();
  return (
    <Hoja titulo={<span><span aria-hidden="true">{def.emoji} </span>{def.nombre}</span>} subtitulo={def.texto} onCerrar={cerrar}>
      {titulo ? (
        <div className="caja">
          <div className="lista">
            {meses.map((m) => {
              const quien = estado.titulos[m]?.[def.id] ?? [];
              return (
                <div key={m} className="item">
                  <span className="crece">{nombreMes(m).charAt(0).toUpperCase() + nombreMes(m).slice(1)}{m === estado.mes ? ' (por ahora)' : ''}</span>
                  {quien.length ? quien.map((q) => <Avatar key={q} id={q} tam="s" />) : <span className="peq tenue">Nadie</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : def.proximamente ? (
        <p className="peq suave">Esta medalla llega más adelante.</p>
      ) : (
        <div className="caja">
          <div className="lista">
            {config.miembros.map((m) => (
              <div key={m.id} className="item">
                <Avatar id={m.id} tam="s" />
                <span className="crece">{m.nombre}</span>
                <span className="negrita">{estado.medallas[m.id]?.[def.id] ? `×${estado.medallas[m.id][def.id]}` : 'Aún no'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Hoja>
  );
}

/** Las opciones de un mensaje del chat (al mantenerlo pulsado). */
function HojaMensaje({ m }: { m: Mensaje }) {
  const { cerrar, yo, estado, acciones, avisar } = useCasa();
  const [borrar, setBorrar] = useState(false);
  const fijado = estado.chat.fijado?.id === m.id;
  const mio = m.autor === yo;
  return (
    <Hoja titulo="Mensaje" subtitulo={m.borrado ? 'Mensaje borrado' : resumen(m, 90)} onCerrar={cerrar}>
      <div className="pila-s">
        {!m.borrado && (
          <BotonAccion
            clase="boton claro ancho"
            hacer={async () => {
              await acciones.fijar(fijado ? null : m.id);
              cerrar();
              avisar(fijado ? 'Ya no está fijado.' : 'Fijado arriba del chat.');
            }}
          >
            {fijado ? 'Quitar de arriba' : 'Fijar arriba del chat'}
          </BotonAccion>
        )}
        {!m.borrado && m.texto && (
          <button
            type="button"
            className="boton claro ancho"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(m.texto);
                avisar('Texto copiado.');
              } catch {
                avisar('No se pudo copiar.');
              }
              cerrar();
            }}
          >
            Copiar el texto
          </button>
        )}
        {mio && !m.borrado &&
          (borrar ? (
            <div className="fila">
              <button type="button" className="boton claro" style={{ flex: 1 }} onClick={() => setBorrar(false)}>Mejor no</button>
              <BotonAccion clase="boton peligro" hacer={async () => { await acciones.borrarMensaje(m.id); cerrar(); }}>
                Sí, borrarlo
              </BotonAccion>
            </div>
          ) : (
            <button type="button" className="boton borde ancho" onClick={() => setBorrar(true)}>Borrar el mensaje</button>
          ))}
      </div>
    </Hoja>
  );
}

function AjusteAvisos({ prueba }: { prueba: boolean }) {
  const { avisos, activarAvisos, probarAvisos } = useCasa();
  const [ocupado, setOcupado] = useState(false);
  const hacer = async (f: () => Promise<void>) => {
    setOcupado(true);
    try { await f(); } catch { /* ya avisa la app */ } finally { setOcupado(false); }
  };
  if (avisos === 'no') {
    return (
      <p className="peq suave">
        {__VISTA__ || prueba
          ? 'En el modo prueba no hay avisos. En la casa de verdad, cada uno los activa en su móvil.'
          : 'Este navegador no puede recibir avisos. Instala la app desde Chrome y actívalos aquí.'}
      </p>
    );
  }
  if (avisos === 'bloqueados') {
    return <p className="peq suave">Están bloqueados en este móvil. Actívalos en los ajustes del móvil: Aplicaciones → La Jamacasa → Notificaciones.</p>;
  }
  if (avisos === 'apagados') {
    return (
      <div className="pila-s">
        <p className="peq suave">Te avisa de la basura, las notas, «Esto es tuyo» y las cuentas, aunque tengas la app cerrada.</p>
        <button type="button" className="boton" style={{ alignSelf: 'flex-start' }} disabled={ocupado} onClick={() => hacer(activarAvisos)}>
          Activar los avisos
        </button>
      </div>
    );
  }
  return (
    <div className="pila-s">
      <p className="peq suave">Activados en este móvil. Solo te llega lo que te toca a ti.</p>
      <button type="button" className="boton borde" style={{ alignSelf: 'flex-start' }} disabled={ocupado} onClick={() => hacer(probarAvisos)}>
        Mandarme un aviso de prueba
      </button>
    </div>
  );
}

/** Las fotos de los tres (Javi, 18 de noviembre: fuera de Limpieza, fotos de verdad y no los muñecos). Cualquiera
 *  puede poner la de cualquiera; se ven en toda la app menos en la casa en 3D, que sigue con los muñecos. */
function FotosDeLaCasa() {
  const { config, yo, estado, almacen, acciones, avisar } = useCasa();
  const [subiendo, setSubiendo] = useState<MiembroId | null>(null);
  const [error, setError] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const para = useRef<MiembroId | null>(null);
  const elegir = async (lista: FileList | null) => {
    const q = para.current;
    if (!lista?.length || !q) return;
    setError('');
    setSubiendo(q);
    try {
      const ref = await almacen.subirFoto(lista[0]);
      await acciones.ponerFoto(q, ref);
      avisar(q === yo ? 'Tu foto, puesta.' : `Foto de ${miembro(config, q).nombre}, puesta.`);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo subir la foto.');
    }
    setSubiendo(null);
    if (entrada.current) entrada.current.value = '';
  };
  return (
    <div className="campo">
      <span className="etiqueta">Las fotos de la casa</span>
      <div className="fotos-casa">
        {config.miembros.map((m) => (
          <div key={m.id} className="foto-casa">
            <Avatar id={m.id} tam="l" />
            <b>{m.id === yo ? 'Tú' : m.nombre}</b>
            <button type="button" className="enlace" disabled={subiendo !== null} onClick={() => { para.current = m.id; entrada.current?.click(); }}>
              {subiendo === m.id ? 'Subiendo…' : estado.fotos[m.id] ? 'Cambiar' : 'Poner foto'}
            </button>
            {estado.fotos[m.id] && subiendo !== m.id && (
              <button type="button" className="enlace tenue" onClick={async () => { await acciones.ponerFoto(m.id, null); avisar('Foto quitada.'); }}>Quitar</button>
            )}
          </div>
        ))}
      </div>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => elegir(e.target.files)} />
      {error && <p className="error">{error}</p>}
      <p className="tenue mini">Salen en toda la app. En la casa en 3D seguís siendo los muñecos.</p>
    </div>
  );
}

function HojaAjustes() {
  const { cerrar, almacen, yo, config, cambiarYo, tema, cambiarTema, reiniciarPrueba, salir } = useCasa();
  const [confirmar, setConfirmar] = useState(false);
  const prueba = almacen.modo === 'prueba';
  const nombre = config.miembros.find((m) => m.id === yo)?.nombre;
  return (
    <Hoja titulo={`Eres ${nombre}`} subtitulo={prueba ? 'Estás en el modo prueba: los datos son inventados y solo están en este móvil.' : undefined} onCerrar={cerrar}>
      <div className="pila-s" style={{ gap: 24 }}>
        {prueba && (
          <div className="campo">
            <span className="etiqueta">Ver la app como</span>
            <div className="personas">
              {config.miembros.map((m) => (
                <button key={m.id} type="button" className="persona" aria-pressed={yo === m.id} onClick={() => { cambiarYo(m.id); cerrar(); }}>
                  <Avatar id={m.id} />
                  {m.nombre}
                </button>
              ))}
            </div>
            <p className="tenue mini">Así puedes marcar un piso como uno y puntuarlo como otro.</p>
          </div>
        )}
        <FotosDeLaCasa />
        <div className="campo">
          <span className="etiqueta">Apariencia</span>
          <div className="opciones">
            {([['auto', 'Como el móvil'], ['claro', 'Claro'], ['oscuro', 'Oscuro']] as const).map(([v, t]) => (
              <button key={v} type="button" className="opcion" aria-pressed={tema === v} onClick={() => cambiarTema(v)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span className="etiqueta">Avisos al móvil</span>
          <AjusteAvisos prueba={prueba} />
        </div>
        <div className="campo">
          <span className="etiqueta">Tenerla en el móvil</span>
          <p className="peq suave">
            {__VISTA__
              ? 'Esta vista previa no se instala. La app de verdad sí: en Chrome o Samsung Internet, menú y «Añadir a pantalla de inicio». Se abre como una app más, con su icono.'
              : 'En Chrome o Samsung Internet: abre el menú y toca «Añadir a pantalla de inicio» o «Instalar app». Se abre como una app más, con su icono.'}
          </p>
        </div>
        <div className="campo">
          <span className="etiqueta">{prueba ? 'Datos de prueba' : 'Este móvil'}</span>
          {confirmar ? (
            <div className="pila-s">
              <p className="peq suave">{prueba ? 'Se borra lo que hayas tocado y vuelve el mes de ejemplo.' : 'Para volver a entrar necesitarás el código de la casa y tu PIN.'}</p>
              <div className="fila">
                <button type="button" className="boton claro" style={{ flex: 1 }} onClick={() => setConfirmar(false)}>Mejor no</button>
                <button type="button" className="boton peligro" style={{ flex: 1 }} onClick={() => { setConfirmar(false); cerrar(); prueba ? reiniciarPrueba() : salir(); }}>
                  {prueba ? 'Sí, empezar de nuevo' : 'Sí, salir'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="boton borde" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmar(true)}>
              {prueba ? 'Volver a empezar la prueba' : 'Salir de la casa en este móvil'}
            </button>
          )}
        </div>
        <p className="tenue mini">Versión 0.1</p>
      </div>
    </Hoja>
  );
}
